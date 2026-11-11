// The week planner: fit the plan to the days and time actually available this week.
//
// The weekly plan stays the template. For one Monday–Sunday week, db.week holds overrides:
//   db.week = { start, avail: { day: { on, minutes, gymId } }, days: { day: { name, mode, items,
//               base, minutes, gymId, from: [templateDay], later?: [...] } } }
// Rules:
// - Each template session (a lift day in the plan) is done once a week; fewer days than
//   sessions means the main lifts of the leftover sessions move into the days you have, and
//   their accessories are dropped. Weekly volume matters more than how it's spread across days
//   (schoenfeld2016freq), so redistributing keeps most of the benefit.
// - Each day is fitted to its minutes: supersets first, then fewer accessory sets, then
//   fewer accessories, then fewer compound sets. Extra time adds work for muscles that are
//   behind on weekly sets.
// - A day at a different gym swaps exercises that gym can't do for the closest ones it can.
import { DAY_KEYS, resolveDay, groupNum, groupOf } from './engine.js';
import { mondayOf, todayStr, addDays } from './store.js';
import { estimateMinutes } from './builder.js';
import { similarExercises } from './bank.js';
import { isAvailable } from './gym.js';
import { focusFor, blockInfo } from './blocks.js';
import { liftLoads } from './fatigue.js';

export const dayIndex = (d) => DAY_KEYS.indexOf(d);
export const todayKey = (date = todayStr()) => DAY_KEYS[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
const isLiftItem = (db, it) => db.exercises[it.exerciseId]?.category !== 'conditioning';

// Lift sessions in the weekly plan, in weekday order.
export function liftTemplates(db) {
  return DAY_KEYS.filter((d) => db.plan[d] && ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift'))
    .map((d) => ({ day: d, name: db.plan[d].name, items: db.plan[d].items.filter((i) => isLiftItem(db, i)) }))
    .filter((t) => t.items.length);
}

// Template sessions already done this week (a session remembers which templates it covered).
export function doneTemplates(db, start = mondayOf(todayStr())) {
  const out = new Set();
  for (const s of db.sessions) {
    if (s.date < start || s.date > addDays(start, 6) || s.freestyle) continue;
    for (const t of s.templates || [s.day]) out.add(t);
  }
  return out;
}

// Plan days already behind us this week with no workout logged.
export function missedTemplates(db, date = todayStr()) {
  const done = doneTemplates(db, mondayOf(date));
  const today = dayIndex(todayKey(date));
  return liftTemplates(db).filter((t) => dayIndex(t.day) < today && !done.has(t.day));
}

const clone = (items) => items.map((i) => ({ ...i }));

function prio(db, it, focus) {
  const ex = db.exercises[it.exerciseId];
  if (focus.includes(it.exerciseId)) return 0;
  if (it.autoCore) return 1; // at least one core exercise stays, even on short days
  return ex?.category === 'compound' ? 1 : 2;
}

// Renumber groups 1, 2, 3a/3b… keeping linked items together.
export function relabelGroups(items) {
  const keys = [];
  for (const it of items) { const k = groupNum(it.group); if (!keys.includes(k)) keys.push(k); }
  const size = (k) => items.filter((i) => groupNum(i.group) === k).length;
  const pos = {};
  for (const it of items) {
    const k = groupNum(it.group);
    const n = keys.indexOf(k) + 1;
    pos[k] = (pos[k] || 0) + 1;
    it.group = size(k) > 1 ? `${n}${'abcdefgh'[pos[k] - 1]}` : String(n);
  }
  return items;
}

// Swap exercises the day's gym can't do for the most similar ones it can.
export function adaptToGym(db, items, gym) {
  const notes = [];
  if (!gym) return { items, notes };
  for (const it of items) {
    const ex = db.exercises[it.exerciseId];
    if (!ex || isAvailable(db, ex, gym)) continue;
    const alt = similarExercises(db.exercises, ex.id, 30).find(({ ex: e }) => isAvailable(db, e, gym) && db.exPrefs?.[e.id] !== 'never');
    if (alt) { notes.push(`${ex.name} → ${alt.ex.name} (${gym.name})`); it.exerciseId = alt.ex.id; delete it.role; delete it.variants; }
  }
  return { items, notes };
}

// Shrink or grow a day's items to fit the minutes available.
export function fitItems(db, items, minutes, { focus = [], extraFor = null } = {}) {
  let out = relabelGroups(clone(items));
  const notes = [];
  const est = () => estimateMinutes(out);
  if (!minutes) return { items: out, notes };
  const before = est();
  if (before > minutes + 2) {
    // 1) Pair up accessories that aren't linked yet (less rest time).
    const solo = out.filter((it) => prio(db, it, focus) === 2 && out.filter((x) => groupNum(x.group) === groupNum(it.group)).length === 1);
    for (let i = 0; i + 1 < solo.length && est() > minutes + 2; i += 2) {
      solo[i + 1].group = `${groupNum(solo[i].group)}b`;
      solo[i].group = `${groupNum(solo[i].group)}a`;
      const at = out.indexOf(solo[i]);
      out.splice(out.indexOf(solo[i + 1]), 1);
      out.splice(at + 1, 0, solo[i + 1]);
      relabelGroups(out);
      notes.push('paired accessories into supersets');
    }
    // 2) Accessories down to 2 sets, from the end.
    for (let j = out.length - 1; j >= 0 && est() > minutes + 2; j--) {
      if (prio(db, out[j], focus) === 2 && out[j].sets > 2) { out[j].sets -= 1; j++; if (!notes.includes('fewer accessory sets')) notes.push('fewer accessory sets'); }
    }
    // 3) Drop accessories from the end.
    let dropped = 0;
    for (let j = out.length - 1; j >= 0 && est() > minutes + 2; j--) if (prio(db, out[j], focus) === 2) { out.splice(j, 1); dropped++; }
    if (dropped) notes.push(`dropped ${dropped} accessor${dropped > 1 ? 'ies' : 'y'}`);
    // 4) Non-focus compounds down to 2 sets.
    for (let j = out.length - 1; j >= 0 && est() > minutes + 2; j--) {
      if (prio(db, out[j], focus) === 1 && out[j].sets > 2) { out[j].sets -= 1; j++; if (!notes.includes('fewer compound sets')) notes.push('fewer compound sets'); }
    }
    relabelGroups(out);
  } else if (extraFor && minutes >= before + 12) {
    // More time than needed: add accessories for the muscles furthest behind this week.
    const added = [];
    // Only muscles in the groups this day already trains (no calf raises on an upper day).
    const groups = new Set(out.flatMap((it) => (db.exercises[it.exerciseId]?.primary || []).map(groupOf)));
    for (const m of extraFor.filter((x) => groups.has(groupOf(x)))) {
      if (est() + 9 > minutes || added.length >= 3) break;
      if (out.some((it) => db.exercises[it.exerciseId]?.primary.includes(m))) continue;
      const pick = Object.values(db.exercises).find((e) => e.category === 'accessory' && e.primary[0] === m && isAvailable(db, e) && db.exPrefs?.[e.id] !== 'never' && db.exPrefs?.[e.id] !== 'avoid');
      if (!pick) continue;
      out.push({ uid: `x-${Date.now().toString(36)}-${added.length}`, exerciseId: pick.id, group: String(out.length + 1), sets: 3, repMin: 10, repMax: 15, restSec: 75, note: 'Added for extra time' });
      added.push(pick.name);
    }
    if (added.length) notes.push(`added ${added.join(', ')}`);
    relabelGroups(out);
  }
  return { items: out, notes, minutes: est() };
}

// Muscles with the fewest planned sets this week relative to ~10 (the low end of most targets).
function lagging(db, days) {
  const loads = liftLoads(db, Object.values(days).flatMap((d) => (d.items || []).map((i) => ({ exerciseId: i.exerciseId, sets: i.sets }))));
  return ['side-delts', 'rear-delts', 'biceps', 'triceps', 'calves', 'hamstrings', 'chest', 'lats', 'quads', 'glutes', 'abs', 'upper-back']
    .sort((a, b) => (loads[a] || 0) - (loads[b] || 0)).filter((m) => (loads[m] || 0) < 10);
}

// Build this week's overrides from availability. avail: { day: { on, minutes, gymId } }.
// Days before `fromDay` keep whatever they had. Returns { week, summary: [lines] }.
export function composeWeek(db, avail, fromDay = todayKey()) {
  const start = mondayOf(todayStr());
  const prev = db.week?.start === start ? db.week : null;
  const days = {};
  for (const d of DAY_KEYS) if (dayIndex(d) < dayIndex(fromDay) && prev?.days?.[d]) days[d] = prev.days[d];
  const done = doneTemplates(db, start);
  const todo = liftTemplates(db).filter((t) => !done.has(t.day));
  const open = DAY_KEYS.filter((d) => dayIndex(d) >= dayIndex(fromDay) && avail[d]?.on);
  const focus = focusFor(db, blockInfo(db).index) || [];
  const summary = [];
  const gymOf = (d) => db.gyms.find((g) => g.id === avail[d]?.gymId) || null;

  // Spread sessions across the open days as evenly as possible.
  const slots = [];
  if (todo.length && open.length) {
    const T = Math.min(todo.length, open.length);
    for (let i = 0; i < T; i++) slots.push(open[T === 1 ? 0 : Math.round((i * (open.length - 1)) / (T - 1))]);
  }
  const assigned = {};
  todo.slice(0, slots.length).forEach((t, i) => {
    assigned[slots[i]] = { name: t.name, from: [t.day], base: clone(resolveDay(db, t.day, { template: true }).filter((it) => isLiftItem(db, it))) };
  });
  // More sessions than days: move each leftover session's main lifts into the lightest day.
  for (const t of todo.slice(slots.length)) {
    const mains = resolveDay(db, t.day, { template: true }).filter((it) => isLiftItem(db, it) && (focus.includes(it.exerciseId) || db.exercises[it.exerciseId]?.category === 'compound')).slice(0, 2);
    for (const m of mains) {
      const target = slots.map((d) => assigned[d]).sort((a, b) => a.base.filter((x) => db.exercises[x.exerciseId]?.category === 'compound').length - b.base.filter((x) => db.exercises[x.exerciseId]?.category === 'compound').length)[0];
      if (!target) break;
      // Main lifts go before the accessories.
      const firstAcc = target.base.findIndex((x) => db.exercises[x.exerciseId]?.category !== 'compound');
      target.base.splice(firstAcc < 0 ? target.base.length : firstAcc, 0, { ...m, group: `m${m.uid}` });
      if (!target.from.includes(t.day)) target.from.push(t.day);
      target.merged = (target.merged || 0) + 1;
      summary.push(`${db.exercises[m.exerciseId].name} moved from ${t.name} into ${target.name}`);
    }
    summary.push(`${t.name}: accessories skipped this week`);
  }
  for (const d of DAY_KEYS) {
    if (dayIndex(d) < dayIndex(fromDay)) continue;
    const a = assigned[d];
    // Conditioning planned on this weekday stays with the weekday when you're training that day.
    const cond = avail[d]?.on ? (db.plan[d]?.items || []).filter((i) => !isLiftItem(db, i)).map((i) => ({ ...i })) : [];
    if (!a) {
      days[d] = { name: db.plan[d]?.name || 'Conditioning', mode: avail[d]?.on ? 'cardio' : 'rest', items: cond, minutes: avail[d]?.minutes || null };
      continue;
    }
    days[d] = { name: a.merged ? `${a.name} + ${a.merged} main lift${a.merged > 1 ? 's' : ''}` : a.name, mode: cond.length ? 'both' : 'lift', from: a.from, base: a.base.map(({ ex, ...rest }) => rest), cond, minutes: avail[d].minutes, gymId: avail[d].gymId || null };
  }
  const extra = lagging(db, Object.fromEntries(Object.entries(days).map(([d, v]) => [d, { items: v.base || [] }])));
  for (const d of DAY_KEYS) {
    const v = days[d];
    if (!v?.base || dayIndex(d) < dayIndex(fromDay)) continue; // earlier days this week may have nothing stored
    const g = adaptToGym(db, clone(v.base), gymOf(d));
    const fit = fitItems(db, g.items, v.minutes, { focus, extraFor: extra });
    v.items = [...fit.items, ...(v.cond || [])];
    const label = d[0].toUpperCase() + d.slice(1);
    if (g.notes.length || fit.notes.length) summary.push(`${label}: ${[...g.notes, ...fit.notes].join('; ')}`);
  }
  const week = { start, avail, days };
  if (todo.length > open.length && open.length) summary.unshift(`${todo.length} sessions in ${open.length} day${open.length > 1 ? 's' : ''}: every main lift still gets done once.`);
  if (!open.length) summary.unshift('No training days this week — the plan picks up again next Monday.');
  return { week, summary };
}

// Re-fit one day (time, gym) from its untrimmed base, keeping the rest of the week as is.
export function adjustDay(db, day, { minutes, gymId }) {
  const start = mondayOf(todayStr());
  if (!db.week || db.week.start !== start) db.week = { start, avail: {}, days: {} };
  let o = db.week.days[day];
  if (!o?.base) {
    const items = resolveDay(db, day, { template: true }).filter((it) => isLiftItem(db, it)).map(({ ex, ...rest }) => rest);
    o = { name: db.plan[day]?.name || 'Workout', mode: 'lift', from: [day], base: items };
  }
  o.minutes = minutes || null;
  o.gymId = gymId || null;
  delete o.later;
  const gym = db.gyms.find((g) => g.id === gymId) || null;
  const g = adaptToGym(db, clone(o.base), gym);
  const focus = focusFor(db, blockInfo(db).index) || [];
  const fit = fitItems(db, g.items, minutes, { focus, extraFor: lagging(db, db.week.days) });
  o.items = fit.items;
  db.week.days[day] = o;
  return { minutes: fit.minutes ?? estimateMinutes(o.items), notes: [...g.notes, ...fit.notes] };
}

// Two shorter sessions today: split by groups into halves of similar length.
export function splitDay(db, day) {
  if (!db.week?.days?.[day]?.items) adjustDay(db, day, {});
  const o = db.week.days[day];
  const groups = [];
  for (const it of o.items) { const k = groupNum(it.group); const g = groups.find((x) => x.k === k); if (g) g.items.push(it); else groups.push({ k, items: [it] }); }
  if (groups.length < 2) return false;
  const total = estimateMinutes(o.items);
  let acc = 0;
  let cut = 1;
  for (let i = 0; i < groups.length; i++) { acc = estimateMinutes(groups.slice(0, i + 1).flatMap((g) => g.items)); if (acc >= total / 2) { cut = Math.max(1, i + (acc - total / 2 > total / 4 ? 0 : 1)); break; } }
  cut = Math.min(cut, groups.length - 1);
  o.items = relabelGroups(groups.slice(0, cut).flatMap((g) => g.items));
  o.later = relabelGroups(groups.slice(cut).flatMap((g) => g.items));
  return true;
}

export function clearWeek(db) { db.week = null; }
