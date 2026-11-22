// Strength standards: where a lift lands against other lifters of the same sex, age and size.
//
// Metric: estimated one-rep max ÷ body weight for one key lift per area (bench for chest, squat
// for legs, deadlift for hips and hamstrings, overhead press for shoulders, barbell row for back,
// barbell curl for arms). Close variations count, converted to the key lift with a typical ratio
// (e.g. an incline bench is about 83% of a flat bench), so someone who never benches still gets
// a chest number. Conversions are rough; the key lift itself is the best basis.
//
// Levels follow Strength Level's published standards (strengthlevel.com), built from millions of
// lifts logged by people who train: beginner = stronger than 5% of lifters, novice 20%,
// intermediate 50% (the average lifter), advanced 80%, elite 95%. They compare you with people who
// lift, not the general population.
//
// Adjustments:
// - Body size: heavier people lift more in total but less per pound. Strength scales with body
//   mass to about the 2/3 power (jaric2002), so the expected ratio is scaled by
//   (reference weight / your weight)^(1/3); references 180 lb (men) and 140 lb (women).
// - Age: strength falls by roughly 1% a year from about 40 and faster after 60 (keller2013), so the
//   standards are scaled down accordingly (and a little for under-18s).
// - Sex not given: the midpoint of the men's and women's standards.

export const LEVELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];
const PCTL = [5, 20, 50, 80, 95];

// Body-weight multiples at each level for the reference lift.
const STD = {
  bench: { m: [0.5, 0.75, 1.0, 1.5, 2.0], f: [0.25, 0.5, 0.75, 1.0, 1.5] },
  squat: { m: [0.75, 1.25, 1.5, 2.25, 2.75], f: [0.5, 0.75, 1.25, 1.5, 2.0] },
  deadlift: { m: [1.0, 1.5, 2.0, 2.5, 3.0], f: [0.5, 1.0, 1.25, 1.75, 2.5] },
  ohp: { m: [0.35, 0.55, 0.8, 1.05, 1.35], f: [0.2, 0.35, 0.5, 0.75, 1.0] },
  row: { m: [0.5, 0.75, 1.0, 1.5, 1.75], f: [0.25, 0.4, 0.65, 0.9, 1.2] },
  curl: { m: [0.2, 0.4, 0.6, 0.85, 1.15], f: [0.1, 0.2, 0.4, 0.6, 0.85] },
};

// Areas: the key lift and the variations that can stand in for it (factor: that lift's estimated
// max × factor ≈ the key lift's; dumbbell weights are per hand).
export const AREAS = [
  { id: 'chest', name: 'Chest', key: 'bench', keyName: 'Bench press', group: 'chest', lifts: [['bench-press', 1], ['close-grip-bench', 1.05], ['smith-bench', 0.95], ['incline-bench', 1.2], ['floor-press', 1.1], ['db-bench', 2.4], ['db-incline-bench', 2.8]] },
  { id: 'back', name: 'Back', key: 'row', keyName: 'Barbell row', group: 'back', lifts: [['bb-row', 1], ['pendlay-row', 1.05], ['yates-row', 0.95], ['seal-row', 1.15], ['t-bar-row', 0.9], ['db-row', 2.0], ['lat-pulldown', 1.0]] },
  { id: 'legs', name: 'Legs', key: 'squat', keyName: 'Back squat', group: 'quads', lifts: [['back-squat', 1], ['pause-squat', 1.1], ['box-squat', 1.0], ['safety-bar-squat', 1.05], ['front-squat', 1.2], ['zercher-squat', 1.2], ['hack-squat', 0.75], ['leg-press', 0.5]] },
  { id: 'hips', name: 'Hips and hamstrings', key: 'deadlift', keyName: 'Deadlift', group: 'hamstrings', lifts: [['deadlift', 1], ['sumo-deadlift', 1], ['trap-bar-deadlift', 0.95], ['deficit-deadlift', 1.1], ['rdl', 1.35], ['stiff-leg-deadlift', 1.3]] },
  { id: 'shoulders', name: 'Shoulders', key: 'ohp', keyName: 'Overhead press', group: 'shoulders', lifts: [['ohp', 1], ['seated-ohp', 1.05], ['push-press', 0.8], ['z-press', 1.1], ['db-shoulder-press', 2.3]] },
  { id: 'arms', name: 'Arms', key: 'curl', keyName: 'Barbell curl', group: 'biceps', lifts: [['bb-curl', 1], ['ez-curl', 1], ['db-curl', 2.2], ['hammer-curl', 2.0]] },
];

export function ageFactor(age) {
  const a = +age || 30;
  if (a < 18) return 0.85;
  if (a <= 40) return 1;
  if (a <= 60) return 1 - 0.01 * (a - 40);
  return Math.max(0.5, 0.8 - 0.015 * (a - 60));
}
function sizeFactor(bw, sex) {
  const ref = sex === 'female' ? 140 : sex === 'male' ? 180 : 160;
  return Math.cbrt(ref / Math.max(80, bw || ref));
}

// The body-weight multiples at each level for this person.
export function standardsFor(key, { sex, age, bw }) {
  const s = STD[key];
  const base = sex === 'female' ? s.f : sex === 'male' ? s.m : s.m.map((v, i) => (v + s.f[i]) / 2);
  const k = ageFactor(age) * sizeFactor(bw, sex);
  return base.map((v) => v * k);
}

// Percentile among lifters for a ratio (interpolated between the level points).
export function percentileOf(ratio, levels) {
  if (!(ratio > 0)) return null;
  if (ratio <= levels[0]) return Math.max(1, Math.round((ratio / levels[0]) * PCTL[0]));
  for (let i = 1; i < levels.length; i++) {
    if (ratio <= levels[i]) return Math.round(PCTL[i - 1] + ((ratio - levels[i - 1]) / (levels[i] - levels[i - 1])) * (PCTL[i] - PCTL[i - 1]));
  }
  return Math.min(99, Math.round(95 + ((ratio - levels[4]) / levels[4]) * 20));
}
export const levelOf = (ratio, levels) => { let n = -1; for (let i = 0; i < levels.length; i++) if (ratio >= levels[i]) n = i; return n; };

// Each area: the best basis lift (the key lift if done, otherwise the strongest variation), the
// equivalent key-lift max, ratio, level and percentile. statsFor(id) gives { now } (est. max, lb).
export function strengthAreas(statsFor, person) {
  return AREAS.map((a) => {
    const done = a.lifts.map(([id, f]) => ({ id, f, s: statsFor(id) })).filter((x) => x.s && x.s.now > 0);
    const levels = standardsFor(a.key, person);
    if (!done.length || !person.bw) return { ...a, levels, basis: null, related: done };
    const basis = done.find((x) => x.f === 1 && x.s.recent) || done.sort((x, y) => y.s.now * y.f - x.s.now * x.f)[0];
    const equiv = basis.s.now * basis.f;
    const ratio = equiv / person.bw;
    return { ...a, levels, basis, equiv, ratio, pct: percentileOf(ratio, levels), level: levelOf(ratio, levels), related: done };
  });
}
