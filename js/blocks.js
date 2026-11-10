// Training blocks: the weeks between deloads. Each block has focus lifts whose progress is
// tracked (best estimated 1RM vs the previous block), and a check-in during the deload week.
import { weekInfo, e1rm, resolveDay } from './engine.js';
import { addDays, todayStr } from './store.js';
import { weightOn } from './energy.js';

export function blockInfo(db, date = todayStr()) {
  const wi = weekInfo(db, date);
  const n = wi.cycleLen;
  const index = Math.ceil(wi.week / n);
  const start = addDays(db.settings.programStart, (index - 1) * n * 7);
  return {
    index, n, weekInBlock: wi.cyclePos, isDeload: wi.isDeload, start,
    end: addDays(start, n * 7 - 1), weeksToDeload: db.settings.deloadOff ? null : n - wi.cyclePos,
  };
}

// Compound lifts currently in the plan (the candidates for focus).
export function planCompounds(db) {
  const seen = new Map();
  for (const day of Object.keys(db.plan)) {
    for (const it of resolveDay(db, day)) {
      if (it.ex.category === 'compound' && !seen.has(it.exerciseId)) seen.set(it.exerciseId, it.ex);
    }
  }
  return [...seen.values()];
}

// Default focus: the first compound of each lifting day (the "main lifts").
function defaultFocus(db) {
  const out = [];
  for (const day of Object.keys(db.plan)) {
    const first = resolveDay(db, day).find((i) => i.ex.category === 'compound');
    if (first && !out.includes(first.exerciseId)) out.push(first.exerciseId);
  }
  return out.slice(0, 3);
}

export function focusFor(db, index) {
  const f = db.blocks?.focus || {};
  for (let i = index; i >= 1; i--) if (f[i]?.length) return f[i];
  return defaultFocus(db);
}

function bestE1rm(db, exId, from, to) {
  let best = 0;
  let sessions = 0;
  for (const s of db.sessions) {
    if (s.isDeload || s.date < from || s.date > to) continue;
    const e = s.entries.find((x) => x.exerciseId === exId);
    if (!e) continue;
    sessions += 1;
    const bw = db.exercises[exId]?.type === 'bodyweight' ? weightOn(db, s.date) : 0; // weighted pullups: body weight + added
    for (const x of e.sets) if (!x.pain && x.reps > 0) best = Math.max(best, e1rm(bw + (x.weight || 0), x.reps));
  }
  return { best, sessions };
}

// Progress for one lift in a block: best estimated 1RM this block vs the block before
// (or vs its first session in this block if there's no earlier data).
export function liftProgress(db, exId, block) {
  const now = bestE1rm(db, exId, block.start, block.end);
  const prevStart = addDays(block.start, -block.n * 7);
  let base = bestE1rm(db, exId, prevStart, addDays(block.start, -1)).best;
  if (!base) {
    const first = db.sessions.filter((s) => !s.isDeload && s.date >= block.start && s.date <= block.end)
      .map((s) => s.entries.find((x) => x.exerciseId === exId)).find(Boolean);
    if (first) { const bw = db.exercises[exId]?.type === 'bodyweight' ? weightOn(db, block.start) : 0; base = Math.max(0, ...first.sets.filter((x) => !x.pain && x.reps > 0).map((x) => e1rm(bw + (x.weight || 0), x.reps))); }
  }
  const pct = base && now.best ? ((now.best - base) / base) * 100 : null;
  return { base: Math.round(base), now: Math.round(now.best), pct, sessions: now.sessions };
}

export function checkinDue(db, date = todayStr()) {
  if (db.settings.deloadOff) return null;
  const b = blockInfo(db, date);
  if (!b.isDeload) return null;
  if (db.blocks?.reviews?.[b.index]) return null;
  return b;
}

// Workouts done vs planned in the block's training weeks.
export function adherence(db, block) {
  const liftDays = Object.keys(db.plan).filter((d) => ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift')).length;
  const planned = liftDays * (block.n - 1);
  const done = db.sessions.filter((s) => !s.isDeload && s.date >= block.start && s.date <= block.end).length;
  return { planned, done };
}
