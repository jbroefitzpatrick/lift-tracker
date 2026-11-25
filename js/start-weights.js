// Starting weights: a first guess for a lift someone has never logged, sized to them.
//
// Built on the same strength standards as Progress (js/standards.js): Strength Level's published
// body-weight multiples by sex, adjusted for age and body size. Experience picks the level:
//   new to lifting   between Beginner and Novice (Strength Level's 5th–20th percentile of lifters)
//   1–3 years        between Novice and Intermediate
//   3+ years         a little past Intermediate (the average lifter who logs)
// The first workout aims low on purpose: the weight you could do for about 10 reps with 3 left in
// the tank (Epley: 1RM ÷ (1 + 13/30), about 70% of a max). The app then adjusts from what you log,
// and "Help me pick a weight" sets it from one set.
//
// Lifts without published standards are a share of a reference lift (bench, overhead press, row,
// squat, deadlift) by movement pattern and equipment, from typical ratios between them in
// Strength Level's data. Dumbbells are per hand. Machines vary by brand, so these are rough.

import { standardsFor, AREAS } from './standards.js';

const LEVEL_BY_EXP = { beginner: 0.4, intermediate: 1.5, advanced: 2.3 };

// Variations the standards already convert: that lift's max × f ≈ the reference max.
const DIRECT = {};
for (const a of AREAS) for (const p of a.parts) for (const [id, f] of p.lifts) DIRECT[id] ||= [p.key, 1 / f];

// Specific lifts where the pattern average is far off.
const BY_ID = {
  'leg-press': ['squat', 1.7], 'single-leg-press': ['squat', 0.8], 'hack-squat': ['squat', 0.9], 'pendulum-squat': ['squat', 0.85],
  'goblet-squat': ['squat', 0.3], 'kb-goblet-squat': ['squat', 0.3], 'cable-pull-through': ['deadlift', 0.3],
  'seated-calf': ['squat', 0.6], 'hip-thrust': ['squat', 1.0], 'face-pull': ['row', 0.3],
};

// Share of the reference lift's max, by pattern and equipment.
const BY_PATTERN = {
  'horizontal-push': ['bench', { barbell: 1, dumbbell: 0.38, machine: 1.0, cable: 0.45 }],
  'incline-push': ['bench', { barbell: 0.83, dumbbell: 0.34, machine: 0.85, cable: 0.4 }],
  'vertical-push': ['ohp', { barbell: 1, dumbbell: 0.42, machine: 1.1, cable: 0.45 }],
  dip: ['bench', { machine: 0.9 }],
  'chest-fly': ['bench', { dumbbell: 0.16, machine: 0.6, cable: 0.22 }],
  'lateral-raise': ['ohp', { dumbbell: 0.15, cable: 0.1, machine: 0.4 }],
  'front-raise': ['ohp', { dumbbell: 0.17, cable: 0.2, barbell: 0.35 }],
  'rear-delt': ['row', { dumbbell: 0.1, cable: 0.25, machine: 0.45 }],
  'vertical-pull': ['row', { cable: 0.95, machine: 0.95 }],
  'horizontal-pull': ['row', { barbell: 1, dumbbell: 0.45, cable: 1, machine: 1 }],
  pullover: ['row', { dumbbell: 0.35, cable: 0.4, machine: 0.6 }],
  shrug: ['deadlift', { barbell: 0.7, dumbbell: 0.3, machine: 0.7 }],
  'back-extension': ['deadlift', { machine: 0.35 }],
  'elbow-flexion': ['row', { barbell: 0.45, dumbbell: 0.2, cable: 0.4, machine: 0.45 }],
  wrist: ['row', { barbell: 0.3, dumbbell: 0.12 }],
  'elbow-extension': ['bench', { barbell: 0.4, dumbbell: 0.17, cable: 0.45, machine: 0.5 }],
  squat: ['squat', { barbell: 1, dumbbell: 0.25, machine: 1.1 }],
  'knee-extension': ['squat', { machine: 0.55 }],
  lunge: ['squat', { barbell: 0.5, dumbbell: 0.22, machine: 0.55 }],
  hinge: ['deadlift', { barbell: 0.8, dumbbell: 0.3, cable: 0.25, machine: 0.6 }],
  'hip-extension': ['squat', { barbell: 1.0, machine: 1.0, dumbbell: 0.35, cable: 0.12 }],
  'knee-flexion': ['squat', { machine: 0.38, cable: 0.12, dumbbell: 0.12 }],
  'hip-adduction': ['squat', { machine: 0.6, cable: 0.12 }],
  'hip-abduction': ['squat', { machine: 0.6, cable: 0.12 }],
  'calf-raise': ['squat', { machine: 0.9, barbell: 0.7, dumbbell: 0.25 }],
  'core-flexion': ['bench', { cable: 0.45, machine: 0.45, dumbbell: 0.12 }],
  carry: ['deadlift', { dumbbell: 0.3 }],
};

// Latest weigh-in, remembered until the log changes (targets are worked out often).
const bwSeen = new WeakMap();
function latestBw(db) {
  const list = db.bodyweight || [];
  const last = list[list.length - 1];
  const hit = bwSeen.get(list);
  if (hit && hit.n === list.length && hit.last === last) return hit.v;
  let best = null;
  for (const b of list) if (!best || b.date >= best.date) best = b;
  const v = best ? +best.weight : null;
  bwSeen.set(list, { n: list.length, last, v });
  return v;
}

// Who the guess is for: answers from the plan builder or a quick start, and the latest weigh-in.
export function personFor(db) {
  const p = db.profile || {}; const a = db.about || {};
  return { sex: a.sex || p.sex || '', age: +(a.age || p.age) || null, bw: latestBw(db) || +a.weightLb || +p.weightLb || null, exp: a.exp || p.experience || null };
}

// Estimated one-rep max for this person, or null when there's nothing sensible to say.
export function estimatedMax(db, ex) {
  if (!ex || ex.noLoad || ex.type === 'bodyweight') return null;
  const who = personFor(db);
  if (!who.bw) return null;
  const eq = String(ex.type || '').startsWith('barbell') ? 'barbell' : ex.type;
  let ref; let share;
  if (BY_ID[ex.id]) [ref, share] = BY_ID[ex.id];
  else if (DIRECT[ex.id]) [ref, share] = DIRECT[ex.id];
  else { const row = BY_PATTERN[ex.pattern]; if (!row || !row[1][eq]) return null; [ref, share] = [row[0], row[1][eq]]; }
  const levels = standardsFor(ref, who);
  const at = LEVEL_BY_EXP[who.exp] ?? LEVEL_BY_EXP.beginner;
  const i = Math.floor(at); const f = at - i;
  const ratio = levels[i] + ((levels[Math.min(levels.length - 1, i + 1)] - levels[i]) * f);
  return ratio * who.bw * share;
}

// The first working weight (lb, before rounding to the gym's plates and dumbbells).
export function startEstimate(db, ex) {
  const max = estimatedMax(db, ex);
  return max ? Math.round(max / (1 + 13 / 30)) : null;
}
