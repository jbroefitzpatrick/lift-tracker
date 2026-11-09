// Muscle fatigue model.
//
// Each hard set adds fatigue: 1 "set" to every primary muscle, 0.5 to every secondary muscle.
// Cardio adds set-equivalents from its duration, intensity and which muscles it loads.
// Fatigue fades exponentially; big muscles take longer to recover than small ones.
// Freshness = 1 - fatigue / FULL_FATIGUE, so ~10 hard sets on a muscle leaves it at 0% fresh.
import { resolveDay } from './engine.js';
import { CARDIO, cardioLoad } from './cardio-bank.js';

export const FULL_FATIGUE = 10;
const HALF_LIFE_H = {
  quads: 30, hamstrings: 30, glutes: 30, 'lower-back': 30, adductors: 28,
  chest: 26, lats: 26, 'upper-back': 26,
};
const DEFAULT_HALF_LIFE_H = 20;
const WINDOW_H = 7 * 24;
const HOUR = 3600000;

export const MUSCLE_GROUPS = {
  Upper: ['chest', 'front-delts', 'side-delts', 'rear-delts', 'lats', 'upper-back', 'traps', 'biceps', 'triceps', 'forearms'],
  Core: ['abs', 'obliques', 'lower-back', 'hip-flexors'],
  Lower: ['glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves'],
};

const decay = (m, hoursAgo) => 0.5 ** (Math.max(0, hoursAgo) / (HALF_LIFE_H[m] || DEFAULT_HALF_LIFE_H));

function addLoads(into, loads, hoursAgo = 0, scale = 1) {
  for (const [m, v] of Object.entries(loads)) into[m] = (into[m] || 0) + v * scale * decay(m, hoursAgo);
  return into;
}

// Muscle loads (in sets) from a list of { exerciseId, sets } using the exercise bank's muscles.
export function liftLoads(db, items) {
  const out = {};
  for (const { exerciseId, sets } of items) {
    const ex = db.exercises[exerciseId];
    if (!ex || !sets) continue;
    for (const m of ex.primary) out[m] = (out[m] || 0) + sets;
    for (const m of ex.secondary) out[m] = (out[m] || 0) + sets * 0.5;
  }
  return out;
}

// Planned lifting load for a weekday, or {} if that day isn't a lift day.
export function plannedLoads(db, day) {
  const mode = dayMode(db, day);
  if (mode !== 'lift' && mode !== 'both') return {};
  return liftLoads(db, resolveDay(db, day).map((i) => ({ exerciseId: i.exerciseId, sets: i.sets })));
}

export function dayMode(db, day) {
  const m = db.settings.dayModes?.[day];
  if (m) return m;
  return db.plan[day] ? 'lift' : 'rest';
}

const goodSets = (entry) => entry.sets.filter((s) => !s.pain && (s.done ?? true) && (s.reps > 0 || s.time > 0 || s.dist > 0 || s.cal > 0)).length;

// Measured fatigue right now from logged lifting (including an in-progress workout) and cardio.
export function currentFatigue(db, now = Date.now()) {
  const f = {};
  for (const s of db.sessions) {
    const t = s.finishedAt || s.startedAt;
    const h = (now - t) / HOUR;
    if (!t || h > WINDOW_H || h < 0) continue;
    // A 'too much' check-in counts a bit more fatigue, 'easy' a bit less.
    const fbMult = (e) => (e.feedback === 'hard' || e.joint ? 1.25 : e.feedback === 'easy' ? 0.8 : 1);
    const loads = liftLoads(db, s.entries.map((e) => ({ exerciseId: e.exerciseId, sets: goodSets(e) * fbMult(e) })));
    addLoads(f, loads, h, s.isDeload ? 0.6 : 1);
  }
  const a = db.activeSession;
  if (a) {
    const loads = liftLoads(db, a.order.map((u) => a.entries[u]).map((e) => ({ exerciseId: e.exerciseId, sets: goodSets(e) })));
    addLoads(f, loads, (now - a.startedAt) / HOUR);
  }
  for (const c of db.cardio || []) {
    const h = (now - c.ts) / HOUR;
    if (h > WINDOW_H || h < 0) continue;
    addLoads(f, cardioLoad(CARDIO[c.cardioId], c.minutes), h);
  }
  return f;
}

// Sets still to come in today's planned workout (not logged yet).
export function remainingPlannedLoads(db, day) {
  const a = db.activeSession && db.activeSession.day === day ? db.activeSession : null;
  if (!a) return plannedLoads(db, day);
  return liftLoads(db, a.order.map((u) => a.entries[u]).filter((e) => !e.pain)
    .map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((s) => !s.done).length })));
}

export function freshness(fatigue) {
  const out = {};
  for (const ms of Object.values(MUSCLE_GROUPS)) {
    for (const m of ms) out[m] = Math.max(0, Math.min(1, 1 - (fatigue[m] || 0) / FULL_FATIGUE));
  }
  return out;
}

export { addLoads };
