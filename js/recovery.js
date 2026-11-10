// Recovery check-ins: after training a muscle group, ask how it feels the next few days, use the
// answers to (1) suggest something else when it isn't ready by the next session, and (2) learn how
// fast this person recovers, so the fatigue model and next week's sessions fit them.
// Ratings follow a simple perceived-recovery scale (laurent2011): 0 fresh, 1 a bit sore, 2 very sore.
//
// db.recovery = [{ ts, date, group, rating, hours, sessionId }]
// db.recoveryAdjust = { group: { week: 'YYYY-MM-DD' (Monday it applies to), sets: -1, why } }
import { RECOVERY_GROUPS, groupOf } from './engine.js';
import { todayStr, mondayOf, addDays } from './store.js';

const HOUR = 3600000;
export const RATINGS = [['Fresh', 0], ['A bit sore', 1], ['Very sore', 2]];

// Hard sets per recovery group in a workout (primary muscles count fully).
export function groupSets(db, entries) {
  const out = {};
  for (const e of entries) {
    const ex = db.exercises[e.exerciseId];
    if (!ex || ex.pattern === 'mobility') continue;
    const n = e.sets.filter((x) => (x.done ?? true) && !x.pain).length;
    const g = groupOf(ex.primary[0]);
    if (g && n) out[g] = (out[g] || 0) + n;
  }
  return out;
}

// Check-ins due today: groups trained hard (6+ sets) 14–80 hours ago, not yet answered today.
export function dueChecks(db, now = Date.now()) {
  const today = todayStr();
  const out = [];
  const seen = new Set();
  for (const s of [...db.sessions].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))) {
    const h = (now - (s.finishedAt || s.startedAt)) / HOUR;
    if (h < 14) continue;
    if (h > 80) break;
    for (const [g, n] of Object.entries(groupSets(db, s.entries))) {
      if (n < 6 || seen.has(g)) continue;
      seen.add(g);
      if ((db.recovery || []).some((r) => r.group === g && r.date === today)) continue;
      out.push({ group: g, name: RECOVERY_GROUPS[g].name, sessionId: s.id, hours: h });
    }
  }
  return out;
}

export function record(db, group, rating, sessionId, hours) {
  (db.recovery ||= []).push({ ts: Date.now(), date: todayStr(), group, rating, sessionId, hours: Math.round(hours) });
}

// Typical soreness after a hard session: sore the next day, mostly gone by day 3.
const expected = (h) => (h < 36 ? 1 : h < 60 ? 0.5 : 0.15);

// How this person's recovery compares with typical, per group: >1 slower, <1 faster.
// Used to stretch or shrink the fatigue model's recovery half-life for that group's muscles.
export function recoveryFactors(db) {
  const out = {};
  for (const g of Object.keys(RECOVERY_GROUPS)) {
    const xs = (db.recovery || []).filter((r) => r.group === g && r.hours >= 14 && r.hours <= 80).slice(-10);
    if (xs.length < 2) continue;
    const diff = xs.reduce((a, r) => a + (r.rating - expected(r.hours)), 0) / xs.length;
    out[g] = Math.max(0.75, Math.min(1.6, 1 + 0.35 * diff));
  }
  return out;
}

export function muscleRecoveryMultipliers(db) {
  const f = recoveryFactors(db);
  const out = {};
  for (const [g, v] of Object.entries(f)) for (const m of RECOVERY_GROUPS[g].muscles) out[m] = v;
  return out;
}

// Today's planned groups that aren't ready: a "very sore" answer today, or "a bit sore" with
// the fatigue model also showing them under ~60% fresh.
export function notReady(db, items, fresh) {
  const today = todayStr();
  const planned = {};
  for (const it of items) {
    if (it.ex?.category === 'conditioning') continue;
    const g = groupOf(it.ex?.primary[0]);
    if (g) planned[g] = (planned[g] || 0) + (it.sets || 3);
  }
  const out = [];
  for (const [g, sets] of Object.entries(planned)) {
    if (sets < 6) continue;
    const r = [...(db.recovery || [])].reverse().find((x) => x.group === g && x.date === today);
    const ms = RECOVERY_GROUPS[g].muscles;
    const avg = ms.reduce((a, m) => a + (fresh[m] ?? 1), 0) / ms.length;
    if (r?.rating === 2 || (r?.rating === 1 && avg < 0.6)) out.push({ group: g, name: RECOVERY_GROUPS[g].name, rating: r.rating, fresh: avg });
  }
  return out;
}

// Not recovered in time: next week's sessions go one set lighter for that group.
export function learnSlowRecovery(db, group, why) {
  (db.recoveryAdjust ||= {})[group] = { week: addDays(mondayOf(todayStr()), 7), sets: -1, why };
}
