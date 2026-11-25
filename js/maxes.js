// Max testing: a one-rep max test on any lift during a workout, a max-out day for a few lifts,
// and peaking blocks that lead up to one. Also maxes logged by hand (tested somewhere else).
//
// The test follows the NSCA protocol (nsca2016): a light set of 5–10 reps, a heavier set of 3–5,
// then near-max singles, reaching the max within 3–5 attempts with 3–5 minutes' rest between.
// Here: warm-ups at about 40% × 5, 60% × 3, 75% × 2 and 85% × 1 of the estimated max (after the
// empty bar), then three attempts: an opener at ~92% that should feel sure, a second at ~98%, and
// a third at ~102% only if the second moved well. Testing is for experienced lifters, every few
// months at most.
//
// Peaking (travis2020): over the weeks before a test, intensity rises while volume falls, and the
// last week before the test is a taper (volume cut by about half, one heavy single kept). Weights
// are percentages of the estimated max when the block starts.

import { e1rm } from './engine.js';
import { liftMax } from './estimate.js';
import { roundToGym, activeGym } from './gym.js';
import { todayStr, addDays, mondayOf, daysBetween } from './store.js';

export const WARM = [[0.4, 5], [0.6, 3], [0.75, 2], [0.85, 1]];
export const ATTEMPTS = [0.92, 0.98, 1.02];
export const TEST_REST = 240;
export const MAX_AIM = 'Max test · opener, then go up if it moved well · rest 3–5 min';

// Weeks before the test week: each week's sets as [fraction of max, reps].
const rep = (n, p, r) => Array.from({ length: n }, () => [p, r]);
const TAPER = [[0.93, 1], [0.8, 2], [0.8, 2]];
export const PEAKS = {
  4: { name: '4-week peak', desc: 'Short and heavy. For when you are already training hard.', weeks: [rep(3, 0.85, 3), rep(3, 0.9, 2), TAPER] },
  6: { name: '6-week peak', desc: 'The usual choice: fives down to doubles, then a taper week.', weeks: [rep(4, 0.75, 5), rep(4, 0.8, 4), rep(4, 0.85, 3), rep(3, 0.89, 2), TAPER] },
  8: { name: '8-week peak', desc: 'More time to build: more volume early, the same finish.', weeks: [rep(5, 0.7, 5), rep(4, 0.75, 5), rep(4, 0.79, 4), rep(4, 0.83, 3), rep(3, 0.86, 3), rep(3, 0.9, 2), TAPER] },
};
export const peakLength = (n) => PEAKS[n].weeks.length + 1;

// Best estimated max lately: work sets of 1–10 reps and logged maxes in the last 16 weeks.
export function estimatedMax(db, exId, date = todayStr()) {
  const m = liftMax(db, [exId], { since: addDays(date, -112), until: date });
  return m?.v ? Math.round(m.v) : null;
}

// Warm-ups and attempts for a test, rounded to what the gym can load.
export function testPlan(ex, est, gym) {
  const r = (p) => roundToGym(ex, est * p, gym);
  const warm = [];
  if (ex.type?.startsWith('barbell') && gym.barWeight < est * 0.35) warm.push({ weight: gym.barWeight, reps: 10 });
  for (const [p, reps] of WARM) { const w = r(p); if (w > (warm[warm.length - 1]?.weight || 0)) warm.push({ weight: w, reps }); }
  const attempts = ATTEMPTS.map(r);
  for (let i = 1; i < attempts.length; i++) if (attempts[i] <= attempts[i - 1]) attempts[i] = roundToGym(ex, attempts[i - 1] + (Number(ex.increment) || 5), gym);
  return { warm, attempts };
}

// ---------- Peaking block ----------
export function peakWeek(db, date = todayStr()) {
  const p = db.peak;
  if (!p || !PEAKS[p.weeks]) return null;
  const idx = Math.floor(daysBetween(p.start, date) / 7);
  const total = peakLength(p.weeks);
  if (idx < 0 || idx >= total) return null;
  return { idx, total, test: idx === total - 1, taper: idx === total - 2, sets: PEAKS[p.weeks].weeks[idx] || null };
}
export function startPeak(db, lifts, weeks) {
  db.peak = { lifts, weeks, start: mondayOf(todayStr()), est: Object.fromEntries(lifts.map((id) => [id, estimatedMax(db, id)])), created: Date.now() };
}
export const peakTestDate = (p) => addDays(p.start, (peakLength(p.weeks) - 1) * 7);

const testedSince = (db, exId, date) => (db.sessions || []).some((s) => s.date >= date && s.entries.some((e) => e.exerciseId === exId && e.maxTest));

// Targets that replace the usual progression: a max test (an item flagged maxTest, or a peaking
// lift in its test week) or a peaking week. Null when neither applies.
export function maxOverride(db, item, isDeload) {
  const ex = db.exercises[item.exerciseId];
  if (!ex || ex.category === 'conditioning' || ex.type === 'bodyweight' || ex.noLoad) return null;
  const gym = activeGym(db);
  const pkNow = db.peak?.lifts?.includes(item.exerciseId) ? peakWeek(db) : null;
  const pk = pkNow && (pkNow.test || !isDeload) ? pkNow : null;
  if (pk?.test && !item.maxTest && testedSince(db, ex.id, peakTestDate(db.peak))) return null;
  if (item.maxTest || pk?.test) {
    const est = Math.max(estimatedMax(db, ex.id) || 0, pk ? db.peak.est?.[ex.id] || 0 : 0);
    if (!est) return null;
    const { attempts, warm } = testPlan(ex, est, gym);
    return { scheme: 'max', maxTest: true, est, warm, weight: attempts[0], reps: 1, sets: attempts.length, setWeights: attempts, setReps: attempts.map(() => 1), rir: null, fixedLadder: true, restSec: TEST_REST,
      aim: MAX_AIM };
  }
  if (pk?.sets && db.peak.est?.[ex.id]) {
    const est = db.peak.est[ex.id];
    const setWeights = pk.sets.map(([p]) => roundToGym(ex, est * p, gym));
    const setReps = pk.sets.map(([, r]) => r);
    const top = pk.sets[0];
    return { scheme: 'peak', weight: setWeights[0], reps: setReps[0], sets: setWeights.length, setWeights, setReps, rir: null, fixedLadder: true,
      aim: `${PEAKS[db.peak.weeks].name}, week ${pk.idx + 1} of ${pk.total}${pk.taper ? ' · taper: one heavy single, then light doubles' : ` · ${pk.sets.length} × ${top[1]} at ${Math.round(top[0] * 100)}%`}` };
  }
  return null;
}

// Every max: tested in a workout (a max-test entry's best single) or logged by hand. Newest first.
export function maxesFor(db, exId) {
  const out = [];
  for (const s of db.sessions || []) for (const e of s.entries) {
    if (e.exerciseId !== exId || !e.maxTest) continue;
    const best = e.sets.filter((x) => x.done !== false && x.reps >= 1 && x.weight > 0 && x.type !== 'w').reduce((a, x) => (x.weight > (a?.weight || 0) ? x : a), null);
    if (best) out.push({ date: s.date, weight: best.weight, reps: best.reps, tested: true, sid: s.id });
  }
  for (const m of db.maxes || []) if (m.exerciseId === exId) out.push({ ...m, logged: true });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
