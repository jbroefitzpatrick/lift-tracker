// Running goal (e.g. a faster 5k) alongside lifting.
//
// Training paces come from the current 5k time, the way Daniels-style plans set them (daniels2014):
// easy runs well slower than race pace, tempo near threshold, intervals around 5k pace. About 80% of
// running stays easy (seiler2010). Hard runs are kept away from heavy leg days to limit the
// interference between strength and endurance work (schumann2022), and lifting can drop to
// maintenance volume, which holds strength and size for months (bickel2011).
//
// db.runGoal = { start, weeks, current5k (sec), target5k (sec), runsPerWeek, days: { kind: dayKey },
//                liftMaintenance, trials: [{ date, sec }] }
import { todayStr, daysBetween } from './store.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MI = 1609.34;

export const RUN_KINDS = {
  intervals: { name: 'Intervals', hard: true },
  tempo: { name: 'Tempo run', hard: true },
  long: { name: 'Long run', hard: false },
  easy: { name: 'Easy run', hard: false },
};

export const fmtClock = (sec) => {
  if (!Number.isFinite(sec)) return '—';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function parseClock(text) {
  const m = String(text || '').trim().match(/^(\d{1,3})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const sec = +m[1] * 60 + (m[2] ? +m[2] : 0);
  return sec >= 600 && sec <= 3600 ? sec : null; // a 5k between 10 and 60 minutes
}

// The plan week (1-based) for a date, or null outside the goal.
export function goalWeek(goal, date = todayStr()) {
  if (!goal) return null;
  const w = Math.floor(daysBetween(goal.start, date) / 7) + 1;
  return w >= 1 && w <= goal.weeks ? w : null;
}

// Paces in seconds per mile. Interval pace moves from the current 5k pace toward the target.
export function paces(goal, week = goalWeek(goal) || 1) {
  const cur = (goal.trials?.at(-1)?.sec || goal.current5k) / (5000 / MI);
  const tgt = goal.target5k / (5000 / MI);
  const t = goal.weeks > 1 ? Math.min(1, (week - 1) / (goal.weeks - 1)) : 1;
  const race = cur + (tgt - cur) * t * 0.85; // aim most of the way to goal pace by the end
  return { race, interval: race * 0.98, tempo: cur * 1.07, easy: cur * 1.27, long: cur * 1.3, goal: tgt };
}

// This week's runs: what each one is, as conditioning items the workout screens already handle.
export function weekRuns(goal, week) {
  const p = paces(goal, week);
  const last = week === goal.weeks;
  const trial = !last && week % 4 === 0; // a 5k time trial every 4th week replaces intervals
  const per800 = (p.interval / MI) * 800;
  const per1000 = (p.interval / MI) * 1000;
  const reps = last ? [3, 800] : week <= 2 ? [5, 800] : week <= 4 ? [6, 800] : week <= 6 ? [4, 1000] : [5, 1000];
  const out = {
    intervals: trial
      ? { exerciseId: 'run-5k', sets: 1, metric: 'distance', target: 5000, restSec: 0, paceSec: (p.race / MI) * 5000, note: `5k time trial: run it hard and log your time. Last: ${fmtClock(goal.trials?.at(-1)?.sec || goal.current5k)}` }
      : { exerciseId: 'run-repeat', sets: reps[0], metric: 'distance', target: reps[1], restSec: reps[1] === 800 ? 120 : 150, paceSec: reps[1] === 800 ? per800 : per1000, note: `${reps[0]} × ${reps[1]} m at ${fmtClock(reps[1] === 800 ? per800 : per1000)} each (${fmtClock(p.interval)}/mi), easy jog between` },
    tempo: { exerciseId: 'run-tempo', sets: 1, metric: 'time', target: Math.min(25, 14 + week * 1.5) * 60 | 0, restSec: 0, note: `Comfortably hard at ${fmtClock(p.tempo)}/mi, after a 10-minute easy warm-up` },
    long: { exerciseId: 'run-long', sets: 1, metric: 'time', target: Math.min(70, 35 + week * 4) * 60 | 0, restSec: 0, note: `Easy and conversational, ${fmtClock(p.long)}/mi or slower` },
    easy: { exerciseId: 'run-easy', sets: 1, metric: 'time', target: (last ? 20 : 30) * 60, restSec: 0, note: `Easy, ${fmtClock(p.easy)}/mi or slower` },
  };
  if (last) out.long = { ...out.long, target: 30 * 60, note: 'Short and easy — race week' };
  return out;
}

const KINDS_FOR = { 2: ['intervals', 'long'], 3: ['intervals', 'tempo', 'long'], 4: ['intervals', 'tempo', 'easy', 'long'], 5: ['intervals', 'easy', 'tempo', 'easy', 'long'] };
export const runKinds = (n) => KINDS_FOR[Math.max(2, Math.min(5, n))];

// Pick run days around the lifting week. legLoad: dayKey → planned leg sets that day.
export function scheduleRuns(kinds, legLoad, liftDays) {
  const legDay = (d) => (legLoad[d] || 0) >= 6;
  const idx = (d) => DAY_KEYS.indexOf(d);
  const next = (d) => DAY_KEYS[(idx(d) + 1) % 7];
  const prev = (d) => DAY_KEYS[(idx(d) + 6) % 7];
  const taken = {};
  const out = {};
  const order = [...kinds].sort((a, b) => (RUN_KINDS[b].hard ? 1 : 0) - (RUN_KINDS[a].hard ? 1 : 0) || (a === 'long' ? -1 : 1));
  for (const k of order) {
    let best = null;
    for (const d of DAY_KEYS) {
      if (taken[d]) continue;
      let s = 0;
      if (RUN_KINDS[k].hard) {
        if (legDay(d)) s -= 6;
        if (legDay(next(d))) s -= 4; // hard run the day before heavy legs hurts the lift
        if (legDay(prev(d))) s -= 2;
        // keep hard runs at least a day apart
        for (const [kk, dd] of Object.entries(out)) if (RUN_KINDS[kk.split('#')[0]].hard && Math.abs(idx(dd) - idx(d)) <= 1) s -= 5;
      } else if (legDay(next(d))) s -= 1.5;
      if (liftDays.includes(d)) s -= 1; // prefer days without lifting
      if (k === 'long' && (d === 'sat' || d === 'sun')) s += 2;
      for (const [kk, dd] of Object.entries(out)) if (Math.abs(idx(dd) - idx(d)) === 0) s -= 10;
      if (!best || s > best.s) best = { d, s };
    }
    const key = out[k] ? `${k}#${Object.keys(out).filter((x) => x.startsWith(k)).length}` : k;
    out[key] = best.d;
    taken[best.d] = true;
  }
  return out; // { intervals: 'tue', tempo: 'thu', long: 'sat', 'easy#1': 'fri', … }
}

export function runDays(db) {
  const g = db.runGoal;
  if (!g || !goalWeek(g)) return [];
  return Object.values(g.days || {});
}

// The running-goal items for a weekday this week.
export function runItemsFor(db, day, date = todayStr()) {
  const g = db.runGoal;
  const week = goalWeek(g, date);
  if (!week) return [];
  const runs = weekRuns(g, week);
  return Object.entries(g.days || {}).filter(([, d]) => d === day).map(([k], i) => {
    const kind = k.split('#')[0];
    return { uid: `run-${day}-${week}-${kind}-${i}`, group: `R${i + 1}`, repMin: 1, repMax: 1, runKind: kind, ...runs[kind] };
  });
}
