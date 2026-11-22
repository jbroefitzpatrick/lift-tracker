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
import { mondayOf, todayStr, addDays, weekPos, weekOrder } from './store.js';
import { estimateMinutes } from './builder.js';
import { similarExercises, MUSCLES } from './bank.js';
import { weeklySets } from './groups.js';
import { isAvailable } from './gym.js';
import { focusFor, blockInfo } from './blocks.js';
import { liftLoads } from './fatigue.js';

// Position in the week (0 = the first day, which follows the week-start setting).
export const dayIndex = (d) => weekPos(d);
export const todayKey = (date = todayStr()) => DAY_KEYS[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
const isLiftItem = (db, it) => db.exercises[it.exerciseId]?.category !== 'conditioning';

// Lift sessions in the weekly plan, in weekday order.
export function liftTemplates(db) {
  return weekOrder().filter((d) => db.plan[d] && ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift'))
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
// Skipped on purpose, or moved to a later day this week, doesn't count as missed.
export function missedTemplates(db, date = todayStr()) {
  const done = doneTemplates(db, mondayOf(date));
  const today = dayIndex(todayKey(date));
  const off = offDays(db, date);
  const later = new Set(db.week?.start === mondayOf(date) ? Object.entries(db.week.days || {}).filter(([d]) => dayIndex(d) >= today).flatMap(([, v]) => v.from || []) : []);
  // Days before the plan was made (settings.planSince) weren't missed.
  const since = db.settings?.planSince || '';
  return liftTemplates(db).filter((t) => dayIndex(t.day) < today && !done.has(t.day) && !off.includes(t.day) && !later.has(t.day)
    && addDays(mondayOf(date), dayIndex(t.day)) >= since);
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
export function composeWeek(db, avail, fromDay = todayKey(), { keepCardio = false } = {}) {
  const start = mondayOf(todayStr());
  const prev = db.week?.start === start ? db.week : null;
  const days = {};
  for (const d of weekOrder()) if (dayIndex(d) < dayIndex(fromDay) && prev?.days?.[d]) days[d] = prev.days[d];
  const done = doneTemplates(db, start);
  const off = offDays(db);
  const todo = liftTemplates(db).filter((t) => !done.has(t.day) && !off.includes(t.day));
  const open = weekOrder().filter((d) => dayIndex(d) >= dayIndex(fromDay) && avail[d]?.on);
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
  // (With no days at all there is nothing to fold into; the summary says the week is off.)
  for (const t of open.length ? todo.slice(slots.length) : []) {
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
  for (const d of weekOrder()) {
    if (dayIndex(d) < dayIndex(fromDay)) continue;
    const a = assigned[d];
    // Conditioning planned on this weekday stays with the weekday when you're training that day.
    const cond = avail[d]?.on || keepCardio ? (db.plan[d]?.items || []).filter((i) => !isLiftItem(db, i)).map((i) => ({ ...i })) : [];
    if (!a) {
      days[d] = { name: db.plan[d]?.name || 'Conditioning', mode: avail[d]?.on || (keepCardio && cond.length) ? 'cardio' : 'rest', items: cond, minutes: avail[d]?.minutes || null };
      continue;
    }
    days[d] = { name: a.merged ? `${a.name} + ${a.merged} focus lift${a.merged > 1 ? 's' : ''}` : a.name, mode: cond.length ? 'both' : 'lift', from: a.from, base: a.base.map(({ ex, ...rest }) => rest), cond, minutes: avail[d].minutes, gymId: avail[d].gymId || null };
  }
  const extra = lagging(db, Object.fromEntries(Object.entries(days).map(([d, v]) => [d, { items: v.base || [] }])));
  for (const d of weekOrder()) {
    const v = days[d];
    if (!v?.base || dayIndex(d) < dayIndex(fromDay)) continue; // earlier days this week may have nothing stored
    const g = adaptToGym(db, clone(v.base), gymOf(d));
    const fit = fitItems(db, g.items, v.minutes, { focus, extraFor: extra });
    v.items = [...fit.items, ...(v.cond || [])];
    const label = d[0].toUpperCase() + d.slice(1);
    if (g.notes.length || fit.notes.length) summary.push(`${label}: ${[...g.notes, ...fit.notes].join('; ')}`);
  }
  const week = { start, avail, days, off };
  if (todo.length > open.length && open.length) summary.unshift(`${todo.length} sessions in ${open.length} day${open.length > 1 ? 's' : ''}: every focus lift still gets done once.`);
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

// ---------- A day that doesn't work, or a missed day ----------
// All of these change this week only (db.week); the plan stays as it is and "Reset" undoes them.
// db.week.off lists template days the person chose to skip or spread, so they aren't "missed".

const FULLD = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const offDays = (db, date = todayStr()) => (db.week?.start === mondayOf(date) ? db.week.off || [] : []);
function ensureWeek(db, date = todayStr()) {
  const start = mondayOf(date);
  if (!db.week || db.week.start !== start) db.week = { start, avail: {}, days: {} };
  db.week.days ||= {};
  return db.week;
}
// This week's version of a day, made editable (its untrimmed items kept as base).
function weekDay(db, day) {
  const w = ensureWeek(db);
  let o = w.days[day];
  if (!o) {
    const items = resolveDay(db, day, { template: true }).filter((it) => isLiftItem(db, it)).map(({ ex, ...rest }) => rest);
    const cond = (db.plan[day]?.items || []).filter((i) => !isLiftItem(db, i)).map((i) => ({ ...i }));
    o = { name: db.plan[day]?.name || 'Workout', mode: items.length ? (cond.length ? 'both' : 'lift') : cond.length ? 'cardio' : 'rest', from: items.length ? [day] : [], base: items, items: [...clone(items), ...cond], cond };
    w.days[day] = o;
  }
  return o;
}
const liftItemsOf = (db, o) => (o?.items || []).filter((it) => isLiftItem(db, it));
// Days from today on that still have a lifting workout to do this week.
function openLiftDays(db, date = todayStr(), except = null) {
  const today = dayIndex(todayKey(date));
  const doneDays = new Set(db.sessions.filter((s) => s.date >= mondayOf(date) && s.date <= date && !s.freestyle).map((s) => s.day));
  return weekOrder().filter((d) => d !== except && dayIndex(d) >= today && !doneDays.has(d) && (resolveDay(db, d).filter((it) => isLiftItem(db, it)).length));
}

// "Do it today": the missed workout today, and every workout after it moves by the same number of
// days, so the rest days between sessions stay as planned. Workouts pushed past the end of the
// week can't fit: their main lifts join the lightest remaining day (as in composeWeek).
export function shiftWeek(db, date = todayStr()) {
  const today = todayKey(date);
  const missed = missedTemplates(db, date);
  if (!missed.length) return null;
  const delta = dayIndex(today) - dayIndex(missed[0].day);
  const done = doneTemplates(db, mondayOf(date));
  const off = offDays(db, date);
  const todo = liftTemplates(db).filter((t) => !done.has(t.day) && !off.includes(t.day));
  const order = weekOrder();
  const targets = todo.map((t) => order[dayIndex(t.day) + delta]).filter(Boolean);
  const prev = db.week?.start === mondayOf(date) ? db.week.avail || {} : {};
  const avail = {};
  for (const d of order) if (dayIndex(d) >= dayIndex(today)) avail[d] = { on: targets.includes(d), minutes: prev[d]?.minutes || null, gymId: prev[d]?.gymId || '' };
  const res = composeWeek(db, avail, today, { keepCardio: true });
  res.week.off = off;
  res.moves = todo.slice(0, targets.length).map((t, i) => ({ from: t.day, to: targets[i], name: t.name }));
  res.overflow = todo.slice(targets.length).map((t) => t.name);
  // Days left without their workout say where it went.
  for (const m of res.moves) {
    const v = res.week.days[m.from];
    if (m.from !== m.to && !v?.from?.length) res.week.days[m.from] = { ...(v || { name: m.name, items: [] }), mode: v?.items?.length ? 'cardio' : 'rest', note: `Moved to ${FULLD[m.to]}` };
  }
  return res;
}

// Move one day's workout to another day this week (one without a workout of its own).
export function moveDay(db, day, to) {
  const src = weekDay(db, day);
  const dst = weekDay(db, to);
  const lift = liftItemsOf(db, src);
  const cond = (dst.items || []).filter((i) => !isLiftItem(db, i));
  db.week.days[to] = { ...dst, name: src.name, mode: cond.length ? 'both' : 'lift', from: [...new Set([...(src.from || [day])])], base: clone(src.base || lift), items: [...clone(lift), ...cond] };
  const keep = (src.items || []).filter((i) => !isLiftItem(db, i));
  db.week.days[day] = { ...src, mode: keep.length ? 'cardio' : 'rest', from: [], base: [], items: keep, note: `Moved to ${FULLD[to]}` };
  return `${src.name} moved to ${FULLD[to]}.`;
}

// Skip one day's workout this week.
export function skipDay(db, day) {
  const src = weekDay(db, day);
  db.week.days[day] = { ...src, mode: 'rest', from: [], base: [], items: [], note: 'Skipped this week' };
  db.week.off = [...new Set([...(db.week.off || []), ...(src.from || [day])])];
  return `${src.name} skipped this week.`;
}

// Spread one day's exercises over the other workouts left this week, each where it fits best:
// - the same exercise elsewhere: that one gets the extra sets;
// - otherwise the day that already trains those muscles (a lower-body lift joins the lower-body day),
//   but not a day that already has the same kind of big lift (two squats in one session);
// - not the day before or after another hard session for the same muscles;
// - accessories that would push a day well past its time are left out this week.
// Focus lifts and other compounds are placed first, so they get the best spots.
export function planSpread(db, day, date = todayStr()) {
  const snapshot = JSON.stringify(db.week || null);
  const src = weekDay(db, day);
  const items = liftItemsOf(db, src).map((it) => ({ ...it, ex: db.exercises[it.exerciseId] })).filter((it) => it.ex);
  const targets = openLiftDays(db, date, day);
  const focus = focusFor(db, blockInfo(db).index) || [];
  const budget = (d) => db.week.days[d]?.minutes || db.week.avail?.[d]?.minutes || +db.profile?.sessionMin || 60;
  const result = { placed: [], dropped: [], targets };
  if (!targets.length) { db.week = JSON.parse(snapshot); return null; }
  for (const d of targets) weekDay(db, d);
  const ordered = items.sort((a, b) => prio(db, a, focus) - prio(db, b, focus));
  const lifts = (d) => liftItemsOf(db, db.week.days[d]).map((x) => ({ ...x, ex: db.exercises[x.exerciseId] })).filter((x) => x.ex);
  const near = (d, k) => weekOrder()[dayIndex(d) + k];
  for (const it of ordered) {
    const compound = it.ex.category === 'compound';
    let best = null;
    for (const d of targets) {
      const L = lifts(d);
      const same = L.find((x) => x.exerciseId === it.exerciseId);
      let score = same ? 50 : 0;
      score += Math.min(9, L.filter((x) => x.ex.primary.some((m) => it.ex.primary.includes(m))).length * 3);
      if (compound && !same && L.some((x) => x.ex.category === 'compound' && x.ex.pattern && x.ex.pattern === it.ex.pattern)) score -= 8;
      for (const k of [-1, 1]) {
        const nd = near(d, k);
        if (!nd || nd === day) continue;
        const nl = (db.week.days[nd] ? liftItemsOf(db, db.week.days[nd]) : resolveDay(db, nd).filter((x) => isLiftItem(db, x)));
        if (compound && nl.some((x) => db.exercises[x.exerciseId]?.category === 'compound' && db.exercises[x.exerciseId]?.primary?.[0] === it.ex.primary[0])) score -= 3;
      }
      const over = estimateMinutes([...L, it]) - budget(d);
      if (over > 10) score -= compound ? 3 : 8;
      score -= L.length * 0.5;
      if (!best || score > best.score) best = { d, score, same, over };
    }
    if (!compound && !best.same && best.over > 10) { result.dropped.push(it.ex.name); continue; }
    const o = db.week.days[best.d];
    if (best.same) {
      const tgt = o.items.find((x) => x.exerciseId === it.exerciseId);
      const add = Math.min(2, it.sets);
      tgt.sets = Math.min(tgt.maxSets || 6, tgt.sets + add);
      result.placed.push({ name: it.ex.name, to: best.d, extra: add });
    } else {
      const { ex, ...rest } = it;
      const moved = { ...rest, uid: `${it.uid}-w`, group: `m${it.uid}` };
      const firstAcc = o.items.findIndex((x) => isLiftItem(db, x) && db.exercises[x.exerciseId]?.category !== 'compound');
      const condAt = o.items.findIndex((x) => !isLiftItem(db, x));
      const at = compound ? (firstAcc < 0 ? (condAt < 0 ? o.items.length : condAt) : firstAcc) : (condAt < 0 ? o.items.length : condAt);
      o.items.splice(at, 0, moved);
      result.placed.push({ name: it.ex.name, to: best.d });
    }
    o.items = [...relabelGroups(o.items.filter((x) => isLiftItem(db, x))), ...o.items.filter((x) => !isLiftItem(db, x))];
    o.base = clone(liftItemsOf(db, o));
    o.mode = o.items.some((x) => !isLiftItem(db, x)) ? 'both' : 'lift';
    if (!o.from.includes(day)) o.from = [...o.from, ...(src.from || [day]).filter((f) => !o.from.includes(f))];
  }
  const to = [...new Set(result.placed.map((p) => p.to))].sort((a, b) => dayIndex(a) - dayIndex(b));
  db.week.days[day] = { ...src, mode: 'rest', from: [], base: [], items: [], note: `Spread over ${to.map((d) => FULLD[d].slice(0, 3)).join(', ')}` };
  db.week.off = [...new Set([...(db.week.off || []), ...(src.from || [day])])];
  return result;
}

// What spreading would do, without changing anything.
export function previewSpread(db, day, date = todayStr()) {
  const saved = JSON.stringify(db.week || null);
  const r = planSpread(db, day, date);
  db.week = JSON.parse(saved);
  return r;
}

// ---------- Adding a workout to a day without one ----------

// Do another plan day's lifting again (doubling up, e.g. a second push day). The original day
// stays scheduled, and this one doesn't count as doing it.
export function copyDayTo(db, from, to) {
  const tpl = resolveDay(db, from, { template: true }).filter((it) => isLiftItem(db, it)).map(({ ex, ...rest }, i) => ({ ...rest, uid: `${to}-x${i}` }));
  const dst = weekDay(db, to);
  const cond = (dst.items || []).filter((i) => !isLiftItem(db, i));
  db.week.days[to] = { ...dst, name: db.plan[from]?.name || 'Workout', mode: cond.length ? 'both' : 'lift', from: [], base: clone(tpl), items: [...tpl, ...cond], note: undefined };
  return db.week.days[to].name;
}

// The muscles with the fewest hard sets in the last 7 days (the big and commonly skipped ones).
const CATCH_UP = ['chest', 'lats', 'upper-back', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
export function laggingMuscles(db, n = 3, now = Date.now()) {
  const { muscles } = weeklySets(db, 7, now);
  return [...CATCH_UP].sort((a, b) => (muscles[a] || 0) - (muscles[b] || 0)).slice(0, n);
}

// A workout for what's behind: one or two exercises for each of the least-trained muscles, chosen
// from lifts the person already does where possible, available at the gym and not avoided.
export function catchUpDay(db, to, now = Date.now()) {
  const low = laggingMuscles(db, 3, now);
  const known = new Set([...Object.values(db.plan || {}).flatMap((p) => (p.items || []).map((i) => i.exerciseId)), ...(db.sessions || []).flatMap((x) => x.entries.map((e) => e.exerciseId))]);
  const used = new Set();
  const items = [];
  low.forEach((m, mi) => {
    const cands = Object.values(db.exercises).filter((e) => e?.primary?.[0] === m && e.category !== 'conditioning' && !e.noLoad
      && !['mobility', 'prehab'].includes(e.pattern) && isAvailable(db, e) && !['never', 'avoid'].includes(db.exPrefs?.[e.id]) && !used.has(e.id))
      .sort((a, b) => (known.has(b.id) - known.has(a.id)) || ((db.exPrefs?.[b.id] === 'prefer') - (db.exPrefs?.[a.id] === 'prefer')) || ((b.category === 'compound') - (a.category === 'compound')) || a.name.localeCompare(b.name));
    for (const e of cands.slice(0, mi === 0 ? 2 : 1)) {
      used.add(e.id);
      const big = e.category === 'compound';
      items.push({ uid: `${to}-c${items.length}`, exerciseId: e.id, group: String(items.length + 1), sets: 3, repMin: big ? 6 : 10, repMax: big ? 10 : 15, restSec: big ? 120 : 75, note: 'Catch-up: least trained this week', manual: true });
    }
  });
  if (!items.length) return null;
  const dst = weekDay(db, to);
  const cond = (dst.items || []).filter((i) => !isLiftItem(db, i));
  const name = `Catch-up: ${low.map((m) => MUSCLES[m] || m).join(', ')}`;
  db.week.days[to] = { ...dst, name, mode: cond.length ? 'both' : 'lift', from: [], base: clone(items), items: [...items, ...cond], note: undefined };
  return { name, muscles: low };
}

// A max-out day: each chosen lift becomes a max test (guided warm-ups, then three attempts).
// Cardio already on that day stays.
export function maxDayTo(db, to, ids) {
  const items = ids.filter((id) => db.exercises[id]).map((id, i) => ({ uid: `${to}-x${i}`, exerciseId: id, group: String(i + 1), sets: 3, repMin: 1, repMax: 1, restSec: 240, maxTest: true, manual: true }));
  if (!items.length) return null;
  const dst = weekDay(db, to);
  const cond = (dst.items || []).filter((i) => !isLiftItem(db, i));
  db.week.days[to] = { ...dst, name: 'Max-out day', mode: cond.length ? 'both' : 'lift', from: [], base: clone(items), items: [...items, ...cond], note: undefined };
  return items;
}
