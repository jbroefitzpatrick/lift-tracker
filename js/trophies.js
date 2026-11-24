// Trophies: milestones earned from your own history, with the date each was earned. Shared on your
// card so friends see them on your profile. Each line (workouts, streaks, strength…) has tiers;
// the next one up shows how close you are.
//
// Colors rise with how hard a trophy is to earn, on one scale across every kind:
//   1  your first weeks       white plate   · bronze
//   2  a few months           green plate   · silver
//   3  about a year           yellow plate  · gold
//   4  years of work          blue plate    · platinum
//   5  rare                   red plate     · gold with red (the champion's)
// Plates (strength, workouts, bests) follow competition plate colors, red the heaviest.
// Medals (runs, races) and laurel wreaths (streaks) step up in metal.

import { todayStr, addDays } from './store.js';
import { e1rm } from './engine.js';
import { streakInfo } from './streak.js';
import { runLog } from './big-goal.js';

export const TIER_WORDS = { 1: 'first weeks', 2: 'a few months', 3: 'about a year', 4: 'years of work', 5: 'rare' };

// Lines of trophies: shape, and steps of [id, name, tier, threshold, label on the trophy]
export const LINES = {
  streak: { name: 'Week streaks', shape: 'laurel', unit: 'WEEKS', steps: [['s4', '4-week streak', 1, 4, '4'], ['s12', '12-week streak', 2, 12, '12'], ['s26', '26-week streak', 3, 26, '26'], ['s52', 'A year, every week', 4, 52, '52'], ['s104', 'Two years, every week', 5, 104, '104']] },
  club: { name: 'Strength total', shape: 'plate', unit: 'LB', steps: [['c750', '750-lb club', 2, 750, '750'], ['c1000', '1,000-lb club', 3, 1000, '1,000'], ['c1250', '1,250-lb club', 4, 1250, '1,250'], ['c1500', '1,500-lb club', 5, 1500, '1,500']] },
  workouts: { name: 'Workouts', shape: 'plate', unit: '', steps: [['w1', 'First workout', 1, 1, '1'], ['w10', '10 workouts', 1, 10, '10'], ['w50', '50 workouts', 2, 50, '50'], ['w100', '100 workouts', 3, 100, '100'], ['w250', '250 workouts', 4, 250, '250'], ['w500', '500 workouts', 5, 500, '500']] },
  bests: { name: 'Personal bests', shape: 'plate', unit: 'PRS', steps: [['p1', 'First new best', 1, 1, '1'], ['p25', '25 new bests', 2, 25, '25'], ['p100', '100 new bests', 3, 100, '100'], ['p250', '250 new bests', 4, 250, '250'], ['p500', '500 new bests', 5, 500, '500']] },
  miles: { name: 'Miles run', shape: 'medal', unit: 'MILES', steps: [['m26', 'A marathon, in total', 1, 26.2, '26.2'], ['m100', '100 miles', 2, 100, '100'], ['m500', '500 miles', 3, 500, '500'], ['m1000', '1,000 miles', 4, 1000, '1,000'], ['m2500', '2,500 miles', 5, 2500, '2,500']] },
  events: { name: 'Race and meet days', shape: 'medal', unit: 'RACES', steps: [['e1', 'First race or meet', 2, 1, '1'], ['e5', '5 races or meets', 3, 5, '5'], ['e10', '10 races or meets', 4, 10, '10'], ['e25', '25 races or meets', 5, 25, '25']] },
};
export const TROPHY = Object.fromEntries(Object.entries(LINES).flatMap(([line, L]) => L.steps.map(([id, name, tier, at, label]) => [id, { id, line, name, tier, at, label, shape: L.shape, unit: L.unit }])));

// When each threshold was first reached, from a list of [date, running total], oldest first.
function earned(line, series) {
  const out = [];
  for (const [id, , , at] of LINES[line].steps) { const hit = series.find(([, v]) => v >= at); if (hit) out.push({ id, date: hit[0] }); }
  return out;
}

// Everything earned, and each line's current value and next step.
export function trophyCase(db, today = todayStr()) {
  const sessions = [...(db.sessions || [])].sort((a, b) => a.date.localeCompare(b.date));
  const got = [];
  const progress = {};
  // Workouts
  got.push(...earned('workouts', sessions.map((s, i) => [s.date, i + 1])));
  progress.workouts = sessions.length;
  // Streaks: weeks hit or frozen in a row.
  const st = streakInfo(db, today);
  let run = 0; const sSeries = [];
  for (const w of st.weeks || []) { const s = st.states?.[w]; if (s === 'hit' || s === 'frozen') { run++; sSeries.push([addDays(w, 6) < today ? addDays(w, 6) : today, run]); } else if (s === 'missed') run = 0; }
  got.push(...earned('streak', sSeries));
  progress.streak = Math.max(st.best || 0, run);
  // Strength total: best squat + bench + deadlift so far, by date.
  const big = { squat: ['back-squat'], bench: ['bench-press'], deadlift: ['deadlift', 'sumo-deadlift'] };
  const best = { squat: 0, bench: 0, deadlift: 0 };
  const cSeries = [];
  const events = [];
  for (const s of sessions) for (const e of s.entries || []) {
    const k = Object.keys(big).find((x) => big[x].includes(e.exerciseId));
    if (!k || e.pain) continue;
    for (const x of e.sets || []) if (x.done !== false && !x.pain && x.type !== 'w' && x.weight > 0 && x.reps > 0 && x.reps <= 10) events.push({ date: s.date, k, v: e1rm(x.weight, x.reps) });
  }
  for (const m of db.maxes || []) { const k = Object.keys(big).find((x) => big[x].includes(m.exerciseId)); if (k) events.push({ date: m.date, k, v: e1rm(m.weight, m.reps || 1) }); }
  events.sort((a, b) => a.date.localeCompare(b.date));
  for (const ev of events) { if (ev.v > best[ev.k]) { best[ev.k] = ev.v; if (best.squat && best.bench && best.deadlift) cSeries.push([ev.date, best.squat + best.bench + best.deadlift]); } }
  got.push(...earned('club', cSeries));
  progress.club = Math.round(cSeries.at(-1)?.[1] || 0);
  // Personal bests (records counted at each workout).
  let pbs = 0; const pSeries = [];
  for (const s of sessions) if (s.prs?.length) { pbs += s.prs.length; pSeries.push([s.date, pbs]); }
  got.push(...earned('bests', pSeries));
  progress.bests = pbs;
  // Miles run
  let mi = 0; const mSeries = [];
  for (const r of [...runLog(db)].sort((a, b) => a.date.localeCompare(b.date))) { mi += r.mi; mSeries.push([r.date, mi]); }
  got.push(...earned('miles', mSeries));
  progress.miles = Math.round(mi * 10) / 10;
  // Races and meets finished
  const done = (db.eventHistory || []).filter((e) => e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  got.push(...earned('events', done.map((e, i) => [e.date, i + 1])));
  progress.events = done.length;
  // The next step in each line.
  const next = {};
  for (const [line, L] of Object.entries(LINES)) {
    const step = L.steps.find(([id]) => !got.some((g) => g.id === id));
    if (step) next[line] = { id: step[0], name: step[1], tier: step[2], at: step[3], now: progress[line] || 0, pct: Math.min(1, (progress[line] || 0) / step[3]) };
  }
  got.sort((a, b) => b.date.localeCompare(a.date));
  return { got, next, progress };
}

// For the card: what friends see (ids and dates only).
export const cardTrophies = (db) => trophyCase(db).got.map((g) => ({ id: g.id, date: g.date }));
