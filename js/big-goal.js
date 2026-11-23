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

function bestEver(db, ids) {
  let best = 0;
  for (const s of db.sessions || []) for (const e of s.entries) {
    if (!ids.includes(e.exerciseId) || e.pain) continue;
    for (const x of goodSets(e)) if (x.weight > 0 && x.reps <= 10) best = Math.max(best, e1rm(x.weight, x.reps));
  }
  for (const m of db.maxes || []) if (ids.includes(m.exerciseId)) best = Math.max(best, e1rm(m.weight, m.reps || 1));
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

// ---------- What's behind the goal ----------
const NAMES = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' };
const DAY = 864e5;
const between = (a, b) => (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY;
const shift = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

// Every qualifying set for one of the big lifts, oldest first.
function bigLiftEvents(db, ids) {
  const out = [];
  for (const s of db.sessions || []) for (const e of s.entries) {
    if (!ids.includes(e.exerciseId) || e.pain) continue;
    for (const x of goodSets(e)) if (x.weight > 0 && x.reps <= 10) out.push({ date: s.date, v: e1rm(x.weight, x.reps), w: x.weight, r: x.reps, exId: e.exerciseId });
  }
  for (const m of db.maxes || []) if (ids.includes(m.exerciseId)) out.push({ date: m.date, v: e1rm(m.weight, m.reps || 1), w: m.weight, r: m.reps || 1, exId: m.exerciseId, logged: true });
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
// Weeks to the target at a steady rate, if it's moving the right way.
const etaWeeks = (left, perWeek) => (perWeek > 0 && left > 0 ? left / perWeek : null);

export function goalDetails(db, today = todayStr()) {
  const p = goalProgress(db); const g = getGoal(db);
  if (p.type === 'club') {
    const lifts = BIG3.map(([k, ids]) => {
      const ev = bigLiftEvents(db, ids);
      const best = ev.reduce((a, b) => (!a || b.v > a.v ? b : a), null);
      return { k, name: NAMES[k], exId: best?.exId || ids[0], v: Math.round(best?.v || 0), w: best?.w, r: best?.r, date: best?.date, logged: best?.logged, share: p.value ? (best?.v || 0) / p.value : 0, ev };
    });
    // The running total each time a best moved.
    const all = lifts.flatMap((l) => l.ev.map((e) => ({ ...e, k: l.k }))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const cur = {}; const byDate = new Map();
    for (const e of all) { if (e.v > (cur[e.k] || 0)) cur[e.k] = e.v; if (lifts.every((l) => cur[l.k])) byDate.set(e.date, Math.round(Object.values(cur).reduce((a, b) => a + b, 0))); }
    const history = [...byDate].map(([x, v]) => ({ x, v }));
    const from = shift(today, -182);
    const then = [...history].reverse().find((h) => h.x <= from)?.v ?? history[0]?.v;
    const span = history.length ? Math.max(between(history[0].x > from ? history[0].x : from, today), 7) : 0;
    const perWeek = then != null && p.value > then ? (p.value - then) / (span / 7) : 0;
    const clubs = CLUBS.map((t) => ({ t, date: history.find((h) => h.v >= t)?.x || null }));
    return { p, lifts: lifts.map(({ ev, ...l }) => l), history, clubs, gained: then != null ? p.value - then : 0, etaWeeks: p.reached ? null : etaWeeks(p.target - p.value, perWeek) };
  }
  const since = g.since || today;
  const runs = runLog(db).sort((a, b) => a.date.localeCompare(b.date));
  if (p.type === 'mile') {
    const timed = runs.filter((r) => r.mi >= 1 && r.sec > 0).map((r) => ({ ...r, pace: r.sec / r.mi }));
    const fastest = [...timed].sort((a, b) => a.pace - b.pace).slice(0, 3);
    return { p, fastest, entered: +g.best > 0 ? +g.best : null, history: timed.map((r) => ({ x: r.date, v: r.pace })), gap: p.value ? p.value - p.target : null, runs: timed.length };
  }
  if (p.type === 'longrun') {
    const top = [...runs].sort((a, b) => b.mi - a.mi).slice(0, 3);
    const recent = runs.filter((r) => r.date >= shift(today, -28));
    return { p, top, recentLong: recent.length ? Math.max(...recent.map((r) => r.mi)) : 0, history: runs.map((r) => ({ x: r.date, v: r.mi })), runs: runs.length };
  }
  const weeks = Math.max(between(since, today) / 7, 1);
  if (p.type === 'miles') {
    const list = runs.filter((r) => r.date >= since); let sum = 0;
    const history = list.map((r) => { sum += r.mi; return { x: r.date, v: Math.round(sum * 10) / 10 }; });
    const perWeek = p.value / weeks;
    return { p, since, runs: list.length, perWeek, avgRun: list.length ? p.value / list.length : 0, history, etaWeeks: p.reached ? null : etaWeeks(p.target - p.value, perWeek) };
  }
  let lifting = 0; let cardio = 0; const daily = new Map();
  for (const s of db.sessions || []) if (s.date >= since) { const v = workoutBurn(db, s).active || 0; lifting += v; daily.set(s.date, (daily.get(s.date) || 0) + v); }
  for (const c of db.cardio || []) if (c.date >= since && !c.fromWorkout) { const v = cardioBurn(db, c, CARDIO[c.cardioId]).active || 0; cardio += v; daily.set(c.date, (daily.get(c.date) || 0) + v); }
  let sum = 0;
  const history = [...daily].sort((a, b) => a[0].localeCompare(b[0])).map(([x, v]) => { sum += v; return { x, v: Math.round(sum) }; });
  const perWeek = p.value / weeks;
  return { p, since, lifting: Math.round(lifting), cardio: Math.round(cardio), perWeek, history, etaWeeks: p.reached ? null : etaWeeks(p.target - p.value, perWeek) };
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
