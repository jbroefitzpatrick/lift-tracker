// The big goal: one long-term target shown on Progress. The default is the strength total
// (squat + bench + deadlift, best estimated maxes) working through the 1,000 to 2,000-lb clubs.
// Lifters can turn it off or pick a running or calorie goal instead (settings.bigGoal).
//
// Also the numbers behind head-to-head challenges (minutes, miles, weight lifted, workouts).

import { todayStr } from './store.js';
import { liftMax, liftSeries, liftedSeries, liftedMax, calibration } from './estimate.js';
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

// Best estimated max (js/estimate.js), and the heaviest weight actually lifted.
const bestEver = (db, ids) => Math.round(liftMax(db, ids)?.v || 0);
const liftedEver = (db, ids) => liftedMax(db, ids)?.w || 0;

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
    const parts = BIG3.map(([k, ids]) => ({ k, v: bestEver(db, ids), lifted: liftedEver(db, ids) }));
    const value = parts.reduce((a, p) => a + p.v, 0);
    const lifted = parts.every((p) => p.lifted) ? parts.reduce((a, p) => a + p.lifted, 0) : 0;
    const earned = CLUBS.filter((t) => value >= t).pop() || 0;
    const target = CLUBS.find((t) => value < t) || CLUBS[CLUBS.length - 1];
    // Clubs the estimate has reached but the lifted total hasn't: the lowest one is "to lift".
    const sealed = CLUBS.filter((t) => lifted >= t).pop() || 0;
    const pending = CLUBS.find((t) => value >= t && lifted < t) || null;
    return { type: 'club', value, lifted, sealed, pending, target, earned, parts, missing: parts.filter((p) => !p.v).map((p) => p.k), reached: value >= CLUBS[CLUBS.length - 1], pct: Math.min(1, value / target), title: `${target.toLocaleString()}-lb club` };
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

// Weeks to the target at a steady rate, if it's moving the right way.
const etaWeeks = (left, perWeek) => (perWeek > 0 && left > 0 ? left / perWeek : null);

export function goalDetails(db, today = todayStr()) {
  const p = goalProgress(db); const g = getGoal(db);
  if (p.type === 'club') {
    const lifts = BIG3.map(([k, ids]) => {
      const ser = liftSeries(db, ids); const cur = ser[ser.length - 1];
      const lser = liftedSeries(db, ids); const lw = lser[lser.length - 1];
      const v = Math.round(cur?.v || 0);
      return { k, name: NAMES[k], exId: cur?.from?.exId || lw?.exId || ids[0], v, w: cur?.from?.w, r: cur?.from?.r, rir: cur?.from?.rir, date: cur?.from?.date, logged: cur?.from?.logged, tested: !!cur?.tested, alone: !!cur?.alone,
        lifted: lw ? { w: lw.w, r: lw.r, date: lw.date } : null, gap: lw ? Math.max(0, v - lw.w) : 0, share: p.value ? v / p.value : 0, ser, lser };
    });
    // The running total each time one of the three moved.
    const totalOver = (key, val) => {
      const all = lifts.flatMap((l) => l[key].map((e) => ({ date: e.date, k: l.k, v: val(e) }))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const cur = {}; const byDate = new Map();
      for (const e of all) { cur[e.k] = e.v; if (lifts.every((l) => cur[l.k])) byDate.set(e.date, Math.round(Object.values(cur).reduce((s, v) => s + v, 0))); }
      return [...byDate].map(([x, v]) => ({ x, v }));
    };
    const history = totalOver('ser', (e) => e.v);
    const liftedHistory = totalOver('lser', (e) => e.w);
    const from = shift(today, -182);
    const then = [...history].reverse().find((h) => h.x <= from)?.v ?? history[0]?.v;
    const span = history.length ? Math.max(between(history[0].x > from ? history[0].x : from, today), 7) : 0;
    const perWeek = then != null && p.value > then ? (p.value - then) / (span / 7) : 0;
    const clubs = CLUBS.map((t) => ({ t, date: history.find((h) => h.v >= t)?.x || null, lifted: liftedHistory.find((h) => h.v >= t)?.x || null }));
    return { p, lifts: lifts.map(({ ser, lser, ...l }) => l), history, liftedHistory, clubs, cal: calibration(db), gained: then != null ? p.value - then : 0, etaWeeks: p.reached ? null : etaWeeks(p.target - p.value, perWeek) };
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
  if (after.type === 'club') {
    if (after.earned > before.earned) return `${after.earned.toLocaleString()}-lb club`;
    if ((after.sealed || 0) > (before.sealed || 0)) return `${after.sealed.toLocaleString()}-lb club, lifted`;
    return null;
  }
  return after.reached && !before.reached ? after.title : null;
}

// ---------- Head-to-head challenge numbers ----------
export const CONTEST_KINDS = {
  workouts: { name: 'Workouts', label: 'Most workouts', desc: 'Whoever finishes more workouts wins.' },
  minutes: { name: 'Minutes', label: 'Most minutes', desc: 'Total time working out, lifting and cardio.' },
  miles: { name: 'Miles', label: 'Most miles run', desc: 'Runs logged with a distance.' },
  volume: { name: 'Weight lifted', label: 'Most weight lifted', desc: 'Weight × reps across working sets.' },
  lift: { name: 'Strength gain', label: 'Biggest gain', desc: 'Percent gain on one lift, so size doesn\'t matter.' },
  sets: { name: 'Hard sets', label: 'Most hard sets', desc: 'Working sets across every workout.' },
  days: { name: 'Active days', label: 'Most active days', desc: 'Days with a workout or any cardio.' },
  cardio: { name: 'Cardio', label: 'Most cardio minutes', desc: 'Runs, rides, swims and other cardio.' },
};
export const SCORED_KINDS = ['minutes', 'miles', 'volume', 'sets', 'days', 'cardio'];

export function metricValue(db, kind, from, to) {
  const inRange = (d) => d >= from && d <= to;
  const sessions = (db.sessions || []).filter((s) => inRange(s.date));
  if (kind === 'workouts') return sessions.length;
  if (kind === 'minutes') return Math.round(sessions.reduce((a, s) => a + workoutMinutes(s), 0) + (db.cardio || []).filter((c) => inRange(c.date) && !c.fromWorkout).reduce((a, c) => a + (+c.minutes || 0), 0));
  if (kind === 'miles') return Math.round(runLog(db).filter((r) => inRange(r.date)).reduce((a, r) => a + r.mi, 0) * 100) / 100;
  if (kind === 'volume') return Math.round(sessions.reduce((a, s) => a + s.entries.reduce((b, e) => (db.exercises?.[e.exerciseId]?.category === 'conditioning' || e.metric ? b : b + goodSets(e).reduce((c, x) => c + (x.weight || 0) * x.reps, 0)), 0), 0));
  if (kind === 'sets') return sessions.reduce((a, s) => a + s.entries.reduce((b, e) => b + (db.exercises?.[e.exerciseId]?.category === 'conditioning' ? 0 : goodSets(e).length), 0), 0);
  if (kind === 'days') return new Set([...sessions.map((s) => s.date), ...(db.cardio || []).filter((c) => inRange(c.date)).map((c) => c.date)]).size;
  if (kind === 'cardio') return Math.round((db.cardio || []).filter((c) => inRange(c.date) && c.cardioId !== 'mobility').reduce((a, c) => a + (+c.minutes || 0), 0));
  return 0;
}
