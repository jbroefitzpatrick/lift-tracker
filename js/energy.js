// Energy: resting rate, calories burned by workouts and cardio, and the daily energy balance.
//
// Method (reference ids are in science.js):
// - Intensity in METs from the Compendium of Physical Activities (herrmann2024, ainsworth2011).
// - One MET is set to the person's own resting rate instead of the textbook 3.5 mL/kg/min,
//   which overstates resting burn for many adults (byrne2005, kozey2010). Resting rate comes from
//   lean mass when body fat is known (cunningham1991), otherwise Mifflin-St Jeor (mifflin1990).
// - Runs and walks logged with a distance use the ACSM metabolic equations (acsm2021).
//   Cardio logged with an average heart rate uses Keytel's equations (keytel2005).
// - "Active" calories are the part above resting (MET − 1), so they add to resting and
//   daily-activity burn without counting rest twice.
// Estimates like these are typically within about ±20–30% for an individual; the weight-trend
// calibration below corrects the systematic part over time.

import { CARDIO } from './cardio-bank.js';

const LB_PER_KG = 2.2046;

// Mifflin-St Jeor (mifflin1990). Without a sex, the midpoint of the two equations.
export function bmr(p, lb) {
  p = p || {};
  const kg = lb / LB_PER_KG;
  const cm = (+p.heightIn || 70) * 2.54;
  const age = +p.age || 30;
  const s = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return 10 * kg + 6.25 * cm - 5 * age + s;
}

// Resting kcal/day. Lean mass predicts it better than weight when body fat is known (cunningham1991).
export function restingKcal(p, lb) {
  p = p || {};
  const bf = parseFloat(p.bodyFat);
  if (Number.isFinite(bf) && bf > 3 && bf < 60) return 370 + 21.6 * (lb / LB_PER_KG) * (1 - bf / 100);
  return bmr(p, lb);
}

// Body weight on a date: the latest weigh-in on or before it, else the profile weight.
export function weightOn(db, date) {
  let best = null;
  for (const b of db.bodyweight || []) if (b.date <= date && (!best || b.date > best.date)) best = b;
  return best?.weight || +db.profile?.weightLb || (db.bodyweight || []).at(-1)?.weight || 180;
}

function kcalFromMet(db, met, minutes, date) {
  const perMin = restingKcal(db.profile, weightOn(db, date)) / 1440;
  return { total: met * perMin * minutes, active: Math.max(0, met - 1) * perMin * minutes };
}

// ---------- Workouts ----------

// Compendium values for resistance work (herrmann2024): multiple exercises at 8–15 reps 3.5,
// heavy squats/deadlifts 5.0, circuits with reciprocal supersets 5.8.
// Conditioning patterns: bodyweight high-intensity 6.5; others from the nearest Compendium activity.
const COND_MET = { sprint: 9.0, erg: 8.0, plyo: 7.0, 'circuit-move': 6.5, isometric: 3.0, carry: 6.0, hinge: 8.0, run: 9.0, mobility: 2.3, prehab: 2.8 };

function entrySets(e) {
  return e.sets.filter((x) => (x.done ?? true) && !x.pain).length;
}

// MET for a whole workout from what was in it: share of compound lifts, share done as supersets
// or circuits (less rest), and any conditioning.
export function workoutMet(db, entries) {
  let lift = 0; let compound = 0; let grouped = 0; let cond = 0; let condMet = 0;
  for (const e of entries) {
    const ex = db.exercises[e.exerciseId];
    const n = entrySets(e);
    if (!n) continue;
    if (ex?.category === 'conditioning') {
      cond += n; condMet += n * (COND_MET[ex.pattern] || 6.5);
      continue;
    }
    lift += n;
    if (ex?.category === 'compound') compound += n;
    if (/[a-z]$/i.test(String(e.group || ''))) grouped += n;
  }
  const total = lift + cond;
  if (!total) return 3.5;
  const base = 3.5 + 1.5 * (lift ? compound / lift : 0); // 3.5 accessories … 5.0 heavy compounds
  const g = lift ? grouped / lift : 0;
  const liftMet = base * (1 - g) + 5.8 * g;
  return (liftMet * lift + condMet) / total;
}

export function workoutMinutes(s) {
  const m = ((s.finishedAt || 0) - (s.startedAt || 0) - (s.pausedMs || 0)) / 60000;
  if (m >= 5 && m <= 240) return m;
  // No reliable clock (edited or imported workouts): about 2.5 minutes per set including rest.
  return Math.max(10, s.entries.reduce((a, e) => a + entrySets(e), 0) * 2.5);
}

export function workoutBurn(db, s) {
  const met = workoutMet(db, s.entries);
  const minutes = workoutMinutes(s);
  return { met, minutes, ...kcalFromMet(db, met, minutes, s.date) };
}

// ---------- Cardio ----------

// Compendium METs by modality and intensity (ainsworth2011, herrmann2024).
const CARDIO_MET = {
  run: { recovery: 6.0, easy: 8.3, moderate: 9.8, hard: 11.0, sprint: 12.0 },
  bike: { recovery: 3.5, easy: 4.8, moderate: 6.8, hard: 8.8, sprint: 11.0 },
  row: { recovery: 3.5, easy: 4.8, moderate: 7.0, hard: 8.5, sprint: 12.0 },
  ski: { recovery: 3.5, easy: 5.0, moderate: 7.0, hard: 8.5, sprint: 12.0 },
  swim: { recovery: 4.0, easy: 5.8, moderate: 8.3, hard: 9.8, sprint: 10.0 },
  elliptical: { recovery: 3.5, easy: 4.6, moderate: 5.0, hard: 7.0, sprint: 8.0 },
  stairs: { recovery: 4.0, easy: 5.0, moderate: 9.0, hard: 9.0, sprint: 9.0 },
  walk: { recovery: 2.8, easy: 3.5, moderate: 4.3, hard: 5.3, sprint: 6.0 },
  sled: { recovery: 4.0, easy: 5.0, moderate: 6.0, hard: 8.0, sprint: 8.0 },
  rope: { recovery: 8.3, easy: 8.8, moderate: 11.8, hard: 12.3, sprint: 12.3 },
  arm: { recovery: 2.8, easy: 3.5, moderate: 4.3, hard: 5.5, sprint: 6.0 },
  recovery: { recovery: 2.5, easy: 2.5, moderate: 3.0, hard: 3.0, sprint: 3.0 },
};
const HARD_FALLBACK = 8.0; // workout conditioning logged as cardio is counted with the workout itself

// ACSM metabolic equations on level ground (acsm2021): VO2 (mL/kg/min) from speed in m/min.
function acsmMet(modality, miles, minutes) {
  if (!(miles > 0) || !(minutes > 0)) return null;
  const v = (miles * 1609.34) / minutes;
  if (modality === 'run' || v > 134) return v >= 80 ? (0.2 * v + 3.5) / 3.5 : null; // running ≥ ~3 mph
  if (modality === 'walk') return v >= 50 && v <= 134 ? (0.1 * v + 3.5) / 3.5 : null; // walking 1.9–5 mph
  return null;
}

// Keytel 2005: gross kcal/min from average heart rate, weight (kg) and age, by sex.
function keytelKcalPerMin(p, hr, kg) {
  const age = +p.age || 30;
  const male = (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age) / 4.184;
  const female = (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age) / 4.184;
  return p.sex === 'male' ? male : p.sex === 'female' ? female : (male + female) / 2;
}

// Returns { met, minutes, total, active, method } for a logged cardio session.
export function cardioBurn(db, c, info) {
  const minutes = +c.minutes || 0;
  const lb = weightOn(db, c.date);
  const perMin = restingKcal(db.profile, lb) / 1440;
  if (c.hr >= 90 && c.hr <= 210) {
    const gross = Math.max(perMin, keytelKcalPerMin(db.profile || {}, c.hr, lb / LB_PER_KG)) * minutes;
    return { met: gross / (perMin * minutes || 1), minutes, total: gross, active: Math.max(0, gross - perMin * minutes), method: 'heart rate' };
  }
  const fromPace = acsmMet(info?.modality, +c.distance, minutes);
  const met = fromPace || CARDIO_MET[info?.modality]?.[info?.intensity] || HARD_FALLBACK;
  return { met, minutes, ...kcalFromMet(db, met, minutes, c.date), method: fromPace ? 'pace' : 'activity' };
}

// ---------- Daily energy ----------

// Exercise burn on one day. Cardio entries created from a workout's conditioning are skipped,
// because the workout's own estimate already includes that time.
export function dayExercise(db, date) {
  let active = 0;
  for (const s of db.sessions) if (s.date === date) active += workoutBurn(db, s).active;
  for (const c of db.cardio || []) {
    if (c.date !== date || c.cardioId === 'conditioning' || c.fromWorkout) continue;
    active += cardioBurn(db, c, CARDIO[c.cardioId]).active;
  }
  return active;
}
