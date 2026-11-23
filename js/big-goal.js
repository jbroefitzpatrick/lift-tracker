// The big goal: one long-term target shown on Progress. The default is the strength total
// (squat + bench + deadlift, best estimated maxes) working through the 1,000 to 2,000-lb clubs.
// Lifters can turn it off or pick a running or calorie goal instead (settings.bigGoal).
//
// Also the numbers behind head-to-head challenges (minutes, miles, weight lifted, workouts).

import { todayStr } from './store.js';
import { e1rm } from './engine.js';
import { workoutBurn, cardioBurn, workoutMinutes } from './energy.js';
import { CARDIO } from './cardio-bank.js';

export const CLUBS = [1000, 1250, 1500, 1750, 2000];
const BIG3 = [['squat', ['back-squat']], ['bench', ['bench-press']], ['deadlift', ['deadlift', 'sumo-deadlift']]];
export const GOAL_TYPES = {
  club: { name: 'Strength total', sub: 'Squat + bench + deadlift, from the 1,000-lb club up' },
  longrun: { name: 'Longest run', sub: 'A distance in one run', unit: 'mi', def: 13.1 },
  miles: { name: 'Miles run', sub: 'Total miles from today', unit: 'mi', def: 500 },
  calories: { name: 'Calories burned', sub: 'Total from today', unit: 'kcal', def: 100000 },
  mile: { name: 'Mile time', sub: 'Your fastest mile', def: 420 },
};
export const getGoal = (db) => ({ on: true, type: 'club', ...(db.settings?.bigGoal || {}) });
export const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

const goodSets = (e) => (e.sets || []).filter((x) => x.done !== false && !x.pain && x.type !== 'w' && x.reps > 0);

// A single is the max itself; higher reps are estimated.
const maxOf = (weight, reps) => (reps <= 1 ? weight : e1rm(weight, reps));

function bestEver(db, ids) {
  let best = 0;
  for (const s of db.sessions || []) for (const e of s.entries) {
    if (!ids.includes(e.exerciseId) || e.pain) continue;
    for (const x of goodSets(e)) if (x.weight > 0 && x.reps <= 10) best = Math.max(best, maxOf(x.weight, x.reps));
  }
  for (const m of db.maxes || []) if (ids.includes(m.exerciseId)) best = Math.max(best, maxOf(m.weight, m.reps || 1));
  return Math.round(best);
}

// Every logged run with a distance: cardio entries, and run sets inside workouts.
export function runLog(db) {
  const out = [];
  for (const c of db.cardio || []) if (CARDIO[c.cardioId]?.modality === 'run' && +c.distance > 0) out.push({ date: c.date, mi: +c.distance, sec: (+c.minutes || 0) * 60 });
  for (const s of db.sessions || []) for (const e of s.entries) {
    if (!String(e.exerciseId).startsWith('run-') || e.metric !== 'distance') continue;
    for (const x of e.sets || []) if (x.done !== false && x.dist > 0) out.push({ date: s.date, mi: x.dist / 1609.34, sec: +x.time || 0 });
  }
  return out;
}

function caloriesSince(db, since) {
  let total = 0;
  for (const s of db.sessions || []) if (s.date >= since) total += workoutBurn(db, s).active || 0;
  for (const c of db.cardio || []) if (c.date >= since && !c.fromWorkout) total += cardioBurn(db, c, CARDIO[c.cardioId]).active || 0;
  return Math.round(total);
}

export function goalProgress(db) {
  const g = getGoal(db);
  if (g.type === 'club') {
    const parts = BIG3.map(([k, ids]) => ({ k, v: bestEver(db, ids) }));
    const value = parts.reduce((a, p) => a + p.v, 0);
    const earned = CLUBS.filter((t) => value >= t).pop() || 0;
    const target = CLUBS.find((t) => value < t) || CLUBS[CLUBS.length - 1];
    return { type: 'club', value, target, earned, parts, missing: parts.filter((p) => !p.v).map((p) => p.k), reached: value >= CLUBS[CLUBS.length - 1], pct: Math.min(1, value / target), title: `${target.toLocaleString()}-lb club` };
  }
  const since = g.since || todayStr();
  const target = +g.target || GOAL_TYPES[g.type].def;
  const runs = runLog(db);
  if (g.type === 'mile') {
    const paces = runs.filter((r) => r.mi >= 1 && r.sec > 0).map((r) => r.sec / r.mi);
    if (+g.best > 0) paces.push(+g.best);
    const value = paces.length ? Math.min(...paces) : null;
    return { type: 'mile', value, target, reached: value != null && value <= target, pct: value ? Math.min(1, target / value) : 0, title: `${fmtTime(target)} mile` };
  }
  const value = g.type === 'longrun' ? Math.max(0, ...runs.map((r) => r.mi))
    : g.type === 'miles' ? runs.filter((r) => r.date >= since).reduce((a, r) => a + r.mi, 0)
      : caloriesSince(db, since);
  const title = g.type === 'longrun' ? `${target} mile run` : g.type === 'miles' ? `${target.toLocaleString()} miles` : `${target.toLocaleString()} calories`;
  return { type: g.type, value, target, reached: value >= target, pct: Math.min(1, value / target), title };
}

// What a finished workout just achieved, if anything.
export function goalHit(before, after) {
  if (!before || !after || before.type !== after.type) return null;
  if (after.type === 'club') return after.earned > before.earned ? `${after.earned.toLocaleString()}-lb club` : null;
  return after.reached && !before.reached ? after.title : null;
}

// ---------- Head-to-head challenge numbers ----------
export const CONTEST_KINDS = {
  workouts: { name: 'Workouts', label: 'Most workouts', desc: 'Whoever finishes more workouts wins.' },
  minutes: { name: 'Minutes', label: 'Most minutes', desc: 'Total time working out, lifting and cardio.' },
  miles: { name: 'Miles', label: 'Most miles run', desc: 'Runs logged with a distance.' },
  volume: { name: 'Weight lifted', label: 'Most weight lifted', desc: 'Weight × reps across working sets.' },
  lift: { name: 'Strength gain', label: 'Biggest gain', desc: 'Percent gain on one lift, so size doesn\'t matter.' },
};
export const SCORED_KINDS = ['minutes', 'miles', 'volume'];

export function metricValue(db, kind, from, to) {
  const inRange = (d) => d >= from && d <= to;
  const sessions = (db.sessions || []).filter((s) => inRange(s.date));
  if (kind === 'workouts') return sessions.length;
  if (kind === 'minutes') return Math.round(sessions.reduce((a, s) => a + workoutMinutes(s), 0) + (db.cardio || []).filter((c) => inRange(c.date) && !c.fromWorkout).reduce((a, c) => a + (+c.minutes || 0), 0));
  if (kind === 'miles') return Math.round(runLog(db).filter((r) => inRange(r.date)).reduce((a, r) => a + r.mi, 0) * 100) / 100;
  if (kind === 'volume') return Math.round(sessions.reduce((a, s) => a + s.entries.reduce((b, e) => (db.exercises?.[e.exerciseId]?.category === 'conditioning' || e.metric ? b : b + goodSets(e).reduce((c, x) => c + (x.weight || 0) * x.reps, 0)), 0), 0));
  return 0;
}
