// Fewer days than usual this week: rebuild the week as a balanced split instead of bolting lifts
// onto leftover days.
//
// 1. Pool every exercise from the sessions still to do, merging repeats.
// 2. Sort each by movement (push, pull, legs, core) and place it in a day of the chosen split.
// 3. Trim to the time available, taking from whichever muscle is best covered, so accessories
//    and focus lifts both stay balanced. Focus lifts go last, and no muscle loses its only lift.
//
// Why: with weekly volume matched, how often a muscle trains makes little difference to growth or
// strength (schoenfeld2019freq, grgic2018freq), so a split can change for a week if the sets are
// kept. Sets per session have diminishing returns (pelland2026), so one day shouldn't absorb
// everything. For a short stretch, keeping the load matters most (spiering2021), and about 6 sets
// per muscle a week holds what you have (rpLandmarks).

import { groupNum } from './engine.js';
import { estimateMinutes } from './builder.js';

const SESSION_CAP = 11; // hard sets per muscle in one session, counting helpers as half
const MAINTAIN = 6; // sets per muscle per week that hold size and strength
const MAIN_MUSCLES = ['chest', 'lats', 'upper-back', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves'];
const BUCKET = {
  'horizontal-push': 'push', 'incline-push': 'push', 'vertical-push': 'push', dip: 'push', 'chest-fly': 'push', 'lateral-raise': 'push', 'front-raise': 'push', 'elbow-extension': 'push',
  'horizontal-pull': 'pull', 'vertical-pull': 'pull', pullover: 'pull', shrug: 'pull', 'rear-delt': 'pull', 'elbow-flexion': 'pull', wrist: 'pull',
  squat: 'legs', lunge: 'legs', hinge: 'legs', 'hip-extension': 'legs', 'back-extension': 'legs', 'knee-flexion': 'legs', 'knee-extension': 'legs', 'hip-adduction': 'legs', 'hip-abduction': 'legs', 'calf-raise': 'legs',
};
const BY_MUSCLE = { chest: 'push', 'front-delts': 'push', 'side-delts': 'push', triceps: 'push', lats: 'pull', 'upper-back': 'pull', traps: 'pull', 'rear-delts': 'pull', biceps: 'pull', forearms: 'pull', quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs', 'lower-back': 'legs' };
const bucketOf = (ex) => BUCKET[ex?.pattern] || BY_MUSCLE[ex?.primary?.[0]] || 'core';

const S = {
  push: { name: 'Push', takes: ['push'] }, pull: { name: 'Pull', takes: ['pull'] }, legs: { name: 'Legs', takes: ['legs'] },
  upper: { name: 'Upper', takes: ['push', 'pull'] }, lower: { name: 'Lower', takes: ['legs'] }, full: { name: 'Full body', takes: ['push', 'pull', 'legs'] },
};
const named = (s, name) => ({ ...s, name });
const SHAPES = {
  ppl: { name: 'Push, pull, legs', why: 'Each muscle gets one full day, with its main lifts and accessories together.', slots: [S.push, S.pull, S.legs] },
  ulf: { name: 'Upper, lower, full body', why: 'Two focused days, then a full-body day to train the big muscles again.', slots: [S.upper, S.lower, S.full] },
  full3: { name: 'Full body', why: 'Each muscle trains more often in smaller doses. Best with a rest day between sessions.', slots: [named(S.full, 'Full body A'), named(S.full, 'Full body B'), named(S.full, 'Full body C')] },
  full2: { name: 'Full body', why: 'Each muscle still trains twice, with the big lifts shared between the days.', slots: [named(S.full, 'Full body A'), named(S.full, 'Full body B')] },
  ul: { name: 'Upper, lower', why: 'One long day for each half of the body.', slots: [S.upper, S.lower] },
  full1: { name: 'Full body', why: 'One session with the most important lifts for each muscle.', slots: [S.full] },
  ul4: { name: 'Upper, lower, twice', why: 'Each muscle trains twice, with shorter days.', slots: [named(S.upper, 'Upper A'), named(S.lower, 'Lower A'), named(S.upper, 'Upper B'), named(S.lower, 'Lower B')] },
  pplf: { name: 'Push, pull, legs, full body', why: 'Your usual split, plus a day to train the big muscles again.', slots: [S.push, S.pull, S.legs, S.full] },
  ulppl: { name: 'Upper, lower, push, pull, legs', why: 'A balanced five-day week.', slots: [S.upper, S.lower, S.push, S.pull, S.legs] },
  ppl2: { name: 'Push, pull, legs, twice', why: 'Each muscle trains twice.', slots: [named(S.push, 'Push A'), named(S.pull, 'Pull A'), named(S.legs, 'Legs A'), named(S.push, 'Push B'), named(S.pull, 'Pull B'), named(S.legs, 'Legs B')] },
};

// Which splits fit this many days, the closest to the person's usual training first.
function shapesFor(n, names) {
  const t = names.join(' ').toLowerCase();
  const ppl = /push/.test(t) && /pull/.test(t) && /leg/.test(t);
  const ul = /upper/.test(t) && /lower/.test(t);
  if (n === 1) return ['full1'];
  if (n === 2) return ['full2', 'ul'];
  if (n === 3) return ppl ? ['ppl', 'ulf', 'full3'] : ul ? ['ulf', 'ppl', 'full3'] : ['full3', 'ppl', 'ulf'];
  if (n === 4) return ppl && !ul ? ['pplf', 'ul4'] : ['ul4', 'pplf'];
  if (n === 5) return ['ulppl'];
  if (n === 6) return ['ppl2'];
  return [];
}

// Every exercise once. A lift that appears on two days keeps its combined sets, up to a sensible limit.
function poolOf(db, sessions, skip) {
  const out = new Map();
  for (const s of sessions) {
    const sizes = {};
    for (const it of s.items) sizes[groupNum(it.group)] = (sizes[groupNum(it.group)] || 0) + 1;
    for (const raw of s.items) {
      const ex = db.exercises[raw.exerciseId];
      if (!ex || skip.has(raw.exerciseId)) continue;
      const have = out.get(raw.exerciseId);
      if (have) { have.sets = Math.min(ex.category === 'compound' ? 5 : 4, have.sets + raw.sets); have._orig += raw.sets; have._from.add(s.day); continue; }
      const { ex: _x, ...it } = raw;
      out.set(raw.exerciseId, { ...it, _orig: raw.sets, _from: new Set([s.day]), _link: sizes[groupNum(raw.group)] > 1 ? `${s.day}:${groupNum(raw.group)}` : null });
    }
  }
  return [...out.values()];
}

const rankIn = (db, it, focus) => (focus.includes(it.exerciseId) ? 0 : bucketOf(db.exercises[it.exerciseId]) === 'core' ? 3 : db.exercises[it.exerciseId]?.category === 'compound' ? 1 : 2);
function musclesOf(db, items) {
  const m = {};
  for (const it of items) {
    const ex = db.exercises[it.exerciseId];
    for (const p of ex?.primary || []) m[p] = (m[p] || 0) + it.sets;
    for (const p of ex?.secondary || []) m[p] = (m[p] || 0) + it.sets / 2;
  }
  return m;
}
// Main lifts first, linked exercises kept together, numbered for the workout list.
function arrange(db, slot, focus) {
  const first = {};
  for (const it of slot.items) if (it._link) first[it._link] = Math.min(first[it._link] ?? 9, rankIn(db, it, focus));
  const key = (it) => (it._link ? first[it._link] : rankIn(db, it, focus));
  const order = slot.items.map((it, i) => ({ it, i })).sort((a, b) => key(a.it) - key(b.it) || String(a.it._link || a.i).localeCompare(String(b.it._link || b.i), undefined, { numeric: true }) || a.i - b.i).map((x) => x.it);
  const counts = {};
  for (const it of order) if (it._link) counts[it._link] = (counts[it._link] || 0) + 1;
  let n = 0; const seen = {};
  for (const it of order) {
    const linked = it._link && counts[it._link] > 1;
    if (!linked) { n++; it.group = String(n); continue; }
    if (!(it._link in seen)) { n++; seen[it._link] = { n, i: 0 }; }
    it.group = `${seen[it._link].n}${'abcdef'[seen[it._link].i++]}`;
  }
  slot.items = order;
}

function build(db, pool, days, avail, focus, key, fallback) {
  const def = SHAPES[key];
  const slots = def.slots.map((s, i) => ({ ...s, day: days[i], budget: +avail[days[i]]?.minutes || fallback, items: [] }));
  const items = pool.map((it) => ({ ...it, _from: new Set(it._from) }));
  const original = musclesOf(db, items.map((it) => ({ ...it, sets: it._orig })));
  const est = (s) => { arrange(db, s, focus); return estimateMinutes(s.items); };
  // Biggest and most important first, each to the lightest day that takes it and doesn't already
  // have that movement.
  const place = [...items].sort((a, b) => rankIn(db, a, focus) - rankIn(db, b, focus) || b.sets - a.sets);
  for (const it of place) {
    const ex = db.exercises[it.exerciseId];
    const b = bucketOf(ex);
    // One core exercise a day is plenty in a shortened week.
    if (b === 'core' && slots.every((s) => s.items.some((x) => bucketOf(db.exercises[x.exerciseId]) === 'core'))) continue;
    const partner = it._link && slots.find((s) => s.items.some((x) => x._link === it._link) && (b === 'core' || s.takes.includes(b)));
    const open = slots.filter((s) => b !== 'core' || !s.items.some((x) => bucketOf(db.exercises[x.exerciseId]) === 'core'));
    const options = partner && open.includes(partner) ? [partner] : open.filter((s) => b === 'core' || s.takes.includes(b));
    const score = (s) => {
      const m = musclesOf(db, [...s.items, it]);
      const over = (ex.primary || []).some((p) => m[p] > SESSION_CAP) ? 60 : 0;
      const same = s.items.some((x) => db.exercises[x.exerciseId]?.pattern === ex.pattern) ? 18 : 0;
      const sameMuscle = s.items.some((x) => db.exercises[x.exerciseId]?.primary?.[0] === ex.primary?.[0]) ? 6 : 0;
      return estimateMinutes(s.items) + over + same + sameMuscle;
    };
    options.reduce((a, s) => (score(s) < score(a) ? s : a)).items.push(it);
  }
  // Two accessories doing the same job on one day (two lateral raises, two calf raises) become one
  // with their sets combined, up to five, which saves changing equipment.
  for (const s of slots) {
    const byJob = {};
    for (const it of [...s.items]) {
      if (rankIn(db, it, focus) !== 2) continue;
      const ex = db.exercises[it.exerciseId];
      const job = `${ex.pattern}:${ex.primary?.[0]}`;
      if (!byJob[job]) { byJob[job] = it; continue; }
      byJob[job].sets = Math.min(5, byJob[job].sets + it.sets);
      s.items.splice(s.items.indexOf(it), 1);
    }
  }
  const all = () => slots.flatMap((s) => s.items);
  const covered = (it) => { const now = musclesOf(db, all()); return Math.max(...(db.exercises[it.exerciseId]?.primary || ['']).map((p) => (now[p] || 0) / (original[p] || 1))); };
  const others = (it) => all().some((x) => x !== it && x.exerciseId !== it.exerciseId && (db.exercises[x.exerciseId]?.primary || []).some((p) => db.exercises[it.exerciseId]?.primary?.[0] === p));
  const best = (list) => list.reduce((a, x) => (covered(x) > covered(a) ? x : a));
  // Cut one thing from a day that's too long or too heavy on a muscle.
  const cut = (s, only) => {
    const can = (t) => s.items.filter((x) => rankIn(db, x, focus) === t && (!only || (db.exercises[x.exerciseId]?.primary || []).includes(only)));
    const acc = [...can(2), ...can(3)];
    const a = acc.filter((x) => x.sets > 2); if (a.length) { best(a).sets--; return true; }
    const d = acc.filter(others); if (d.length) { s.items.splice(s.items.indexOf(best(d)), 1); return true; }
    const c = can(1).filter((x) => x.sets > 2); if (c.length) { best(c).sets--; return true; }
    const e = can(1).filter(others); if (e.length > 1) { s.items.splice(s.items.indexOf(best(e)), 1); return true; }
    const f = can(0).filter((x) => x.sets > 2); if (f.length) { best(f).sets--; return true; }
    return false;
  };
  for (const s of slots) {
    for (let g = 0; g < 120; g++) {
      const m = musclesOf(db, s.items);
      const heavy = Object.keys(m).find((p) => m[p] > SESSION_CAP && s.items.some((x) => db.exercises[x.exerciseId]?.primary?.includes(p)));
      if (!heavy || !cut(s, heavy)) break;
    }
    // Short on time: pair accessories for different muscles before removing work.
    if (est(s) > s.budget + 2) {
      const free = s.items.filter((x) => rankIn(db, x, focus) >= 2 && !x._link);
      while (free.length > 1 && est(s) > s.budget + 2) {
        const a = free.shift();
        const i = free.findIndex((x) => !(db.exercises[x.exerciseId]?.primary || []).some((p) => db.exercises[a.exerciseId]?.primary?.includes(p)));
        if (i < 0) continue;
        const [b] = free.splice(i, 1);
        a._link = b._link = `pair:${a.exerciseId}`;
      }
    }
    for (let g = 0; g < 120 && est(s) > s.budget + 2; g++) if (!cut(s)) break;
    arrange(db, s, focus);
  }
  const kept = musclesOf(db, all());
  const main = MAIN_MUSCLES.filter((m) => original[m] >= MAINTAIN);
  const under = main.filter((m) => (kept[m] || 0) < MAINTAIN);
  // How well each main muscle is covered, up to the 10 weekly sets most guidance treats as a solid dose.
  const coverage = main.length ? main.reduce((a, m) => a + Math.min(1, (kept[m] || 0) / Math.min(original[m], 10)), 0) / main.length : 1;
  const totalSets = pool.reduce((a, x) => a + x._orig, 0);
  const keptSets = all().reduce((a, x) => a + x.sets, 0);
  // Back-to-back days training the same muscles leave less recovery.
  let overlap = 0;
  for (let i = 1; i < slots.length; i++) {
    if (avail._order.indexOf(slots[i].day) - avail._order.indexOf(slots[i - 1].day) === 1 && slots[i].takes.some((t) => slots[i - 1].takes.includes(t))) overlap++;
  }
  return {
    key, name: def.name, why: def.why, totalSets, keptSets, under, overlap, coverage,
    minutes: slots.map((s) => estimateMinutes(s.items)),
    days: slots.map((s) => ({ day: s.day, name: s.name, from: [...new Set(s.items.flatMap((x) => [...x._from]))], items: s.items.map(({ _orig, _from, _link, ...x }) => x) })),
    score: coverage * 100 - under.length * 5 - overlap * 10,
  };
}

// The split options for these days, recommended first.
export function weekShapes(db, sessions, days, avail, focus, order, skip = new Set()) {
  if (!sessions.length || !days.length) return [];
  const keys = shapesFor(days.length, sessions.map((s) => s.name));
  const pool = poolOf(db, sessions, skip);
  const fallback = Math.max(60, ...sessions.map((s) => estimateMinutes(s.items)));
  const ctx = { ...avail, _order: order };
  const opts = keys.map((k) => build(db, pool, days, ctx, focus, k, fallback));
  if (!opts.length) return [];
  // The split closest to their usual training wins unless it covers the muscles clearly worse, leaves a main
  // muscle short, or stacks the same muscles on back-to-back days. Sticking with what's familiar
  // costs little here, since matched weekly volume matters more than the split.
  const best = Math.max(...opts.map((o) => o.coverage));
  const fewestShort = Math.min(...opts.map((o) => o.under.length));
  const top = Math.max(...opts.map((o) => o.score));
  const pick = opts.find((o) => o.coverage >= best - 0.1 && o.under.length <= fewestShort && !o.overlap) || opts.find((o) => o.score === top);
  return [pick, ...opts.filter((o) => o !== pick)].map((o, i) => ({ ...o, recommended: i === 0 }));
}
