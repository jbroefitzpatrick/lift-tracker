// Weekly streaks, streak freezes and the two tiers.
//
// A week counts when you train on enough days for your goal (settings.streakGoal):
//   easy    1 day a week
//   steady  most of your planned days, about three quarters (3 of 4, 4 of 5); the default
//   all     every planned day
// With no plan, 1 day. Missing one occasion doesn't undo a habit (lally2010), so "most weeks, most
// days" is the default rather than every planned day. Lifting and cardio both count; a short or
// mobility-only session doesn't. Each week's target is saved as the week begins, so changing your
// plan later doesn't rewrite past weeks. Weeks from before this existed need one active day.
//
// Miss a week and you're asked whether to spend a freeze (two per calendar year). A frozen week
// keeps the streak alive but doesn't add to it.
//
// Tiers are separate on purpose. Strength: the average percentile across squat, deadlift, push and
// pull, and you keep your best. Consistency: weeks hit out of the last 12, so it reflects habits now.

import { todayStr, addDays, mondayOf } from './store.js';
import { liftTemplates } from './week.js';

export const FREEZES_PER_YEAR = 2;
const MIN_CARDIO = 10;
export const CONSISTENCY = [[12, 'Relentless'], [10, 'Dedicated'], [8, 'Committed'], [6, 'Regular'], [3, 'Starter']];
const STRENGTH = [[95, 'Elite'], [80, 'Advanced'], [50, 'Intermediate'], [20, 'Novice'], [5, 'Beginner']];

const box = (db) => { db.streak ||= {}; db.streak.targets ||= {}; db.streak.frozen ||= []; db.streak.declined ||= []; return db.streak; };
// Stored weeks are matched by range, so changing the first day of the week doesn't lose them.
const inWeek = (date, w) => date >= w && date <= addDays(w, 6);

export const STREAK_GOALS = {
  easy: { name: 'Easy', sub: '1 day a week' },
  steady: { name: 'Steady', sub: 'Most of your planned days: 3 of 4, 4 of 5' },
  all: { name: 'All in', sub: 'Every planned day' },
};
export const goalOf = (db) => (STREAK_GOALS[db.settings?.streakGoal] ? db.settings.streakGoal : 'steady');
export const targetFromPlan = (days, goal = 'steady') => (!(days > 0) || goal === 'easy' ? 1 : goal === 'all' ? days : Math.ceil(days * 0.75));
// A new goal applies to this week right away (up or down); later weeks follow it as they begin.
export function setStreakGoal(db, goal, today = todayStr()) {
  if (!STREAK_GOALS[goal]) return;
  db.settings.streakGoal = goal;
  const w = mondayOf(today);
  const s = box(db);
  const key = Object.keys(s.targets).find((k) => inWeek(k, w)) || w;
  s.targets[key] = targetFromPlan(plannedDays(db), goal);
}
export function plannedDays(db) {
  const lifts = liftTemplates(db).length;
  if (lifts) return lifts;
  return Object.values(db.settings?.dayModes || {}).filter((m) => m === 'cardio').length;
}

// Save this week's target. It can come down (days off) but raising the plan waits for next week.
export function syncStreak(db, today = todayStr()) {
  const w = mondayOf(today);
  const s = box(db);
  const since = db.settings?.planSince || '';
  const now = since > w && inWeek(since, w) ? 1 : targetFromPlan(plannedDays(db), goalOf(db));
  const key = Object.keys(s.targets).find((k) => inWeek(k, w)) || w;
  const prev = s.targets[key];
  const next = prev == null ? now : Math.min(prev, now);
  if (next === prev) return false;
  s.targets[key] = next;
  return true;
}

export function activeDays(db) {
  const out = new Set();
  for (const x of db.sessions || []) out.add(x.date);
  for (const c of db.cardio || []) if (!c.fromWorkout && c.cardioId !== 'mobility' && (+c.minutes || 0) >= MIN_CARDIO) out.add(c.date);
  return out;
}

export function streakInfo(db, today = todayStr()) {
  const s = db.streak || {};
  const targets = s.targets || {}; const frozen = s.frozen || []; const declined = s.declined || [];
  const days = activeDays(db);
  const cur = mondayOf(today);
  const targetOf = (w) => { const k = Object.keys(targets).find((x) => inWeek(x, w)); return k ? targets[k] : (w === cur ? targetFromPlan(plannedDays(db), goalOf(db)) : 1); };
  const countOf = (w) => { let n = 0; for (let i = 0; i < 7; i++) if (days.has(addDays(w, i))) n += 1; return n; };
  const stateOf = (w) => {
    const hit = countOf(w) >= targetOf(w);
    if (hit) return 'hit';
    if (w === cur) return 'current';
    return frozen.some((d) => inWeek(d, w)) ? 'frozen' : 'missed';
  };
  const first = [...days].sort()[0];
  const weeks = [];
  if (first) for (let w = mondayOf(first); w <= cur; w = addDays(w, 7)) weeks.push(w);
  const states = Object.fromEntries(weeks.map((w) => [w, stateOf(w)]));

  let best = 0; let run = 0;
  for (const w of weeks) { const x = states[w]; if (x === 'hit') { run += 1; best = Math.max(best, run); } else if (x === 'missed') run = 0; }

  // The streak as it stands, walking back from this week.
  const runBack = (from) => { let n = 0; for (let i = weeks.indexOf(from); i >= 0; i--) { const x = states[weeks[i]]; if (x === 'hit') n += 1; else if (x !== 'frozen' && x !== 'current') break; } return n; };
  const current = weeks.length ? runBack(cur) : 0;

  // Weeks just missed, and whether freezes could save the streak before them.
  const missed = [];
  for (let i = weeks.length - 2; i >= 0 && states[weeks[i]] === 'missed'; i--) missed.unshift(weeks[i]);
  let offer = null;
  if (missed.length && !missed.some((w) => declined.some((d) => inWeek(d, w)))) {
    const beforeIdx = weeks.indexOf(missed[0]) - 1;
    const saved = beforeIdx >= 0 ? runBack(weeks[beforeIdx]) : 0;
    const need = {};
    for (const w of missed) need[w.slice(0, 4)] = (need[w.slice(0, 4)] || 0) + 1;
    const enough = Object.entries(need).every(([y, n]) => frozen.filter((d) => d.startsWith(y)).length + n <= FREEZES_PER_YEAR);
    if (saved > 0 && enough) offer = { weeks: missed, saved };
  }
  const recent = weeks.slice(-12);
  const hits = recent.filter((w) => states[w] === 'hit' || states[w] === 'frozen').length;
  return {
    current, best, states, weeks, offer, hits,
    thisWeek: { done: countOf(cur), target: targetOf(cur), hit: countOf(cur) >= targetOf(cur) },
    freezesLeft: Math.max(0, FREEZES_PER_YEAR - frozen.filter((d) => d.startsWith(cur.slice(0, 4))).length),
    consistency: CONSISTENCY.find(([n]) => hits >= n)?.[1] || null,
  };
}

export function useFreeze(db, weeks) { const s = box(db); for (const w of weeks) if (!s.frozen.includes(w)) s.frozen.push(w); }
export function declineFreeze(db, weeks) { const s = box(db); for (const w of weeks) if (!s.declined.includes(w)) s.declined.push(w); }

// Strength tier from the average of the patterns logged (at least two). The best stays earned.
export function strengthTier(db, areas) {
  const pcts = areas.filter((a) => a.pct != null).map((a) => a.pct);
  if (pcts.length < 2) return null;
  const avg = Math.round(pcts.reduce((a, p) => a + p, 0) / pcts.length);
  const best = Math.max(avg, db.tierBest || 0);
  if (best !== db.tierBest) db.tierBest = best;
  return { avg, best, name: STRENGTH.find(([n]) => best >= n)?.[1] || 'Starting out' };
}
