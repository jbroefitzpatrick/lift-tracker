// Strength standards: where you land against other lifters of the same sex, age and size.
//
// Four movement patterns, the way strength coaches group lifts (squat, hinge, push, pull), so no
// muscle is counted twice. Each pattern is scored only from lifts with published standards: back
// squat; deadlift; bench press and overhead press; barbell row. Close variations count, converted
// to the reference lift with a typical ratio (e.g. an incline bench is about 83% of a flat bench).
// Arm isolation lifts (curls, extensions) are left out: there are no reliable standards for them,
// and arm strength already shows up in pressing and pulling.
//
// Push blends two lifts when both are logged: bench 60%, overhead press 40%. With one logged, that
// one is used alone.
//
// Metric: estimated one-rep max ÷ body weight. Levels follow Strength Level's published standards
// (strengthlevel.com), built from millions of logged lifts: beginner = stronger than 5% of
// lifters, novice 20%, intermediate 50% (the average lifter), advanced 80%, elite 95%.
//
// Adjustments:
// - Body size: strength scales with body mass to about the 2/3 power (jaric2002), so the expected
//   ratio is scaled by (reference weight / your weight)^(1/3); references 180 lb (men), 140 lb (women).
// - Age: strength falls by roughly 1% a year from about 40 and faster after 60 (keller2013).
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
};

// Patterns: reference lifts (weight in the blend) and the variations that stand in for each
// (factor: that lift's estimated max × factor ≈ the reference lift's; dumbbells are per hand).
const BENCH = [['bench-press', 1], ['close-grip-bench', 1.05], ['smith-bench', 0.95], ['incline-bench', 1.2], ['floor-press', 1.1], ['db-bench', 2.4], ['db-incline-bench', 2.8]];
const OHP = [['ohp', 1], ['seated-ohp', 1.05], ['push-press', 0.8], ['z-press', 1.1], ['db-shoulder-press', 2.3]];
export const AREAS = [
  { id: 'squat', name: 'Squat', group: 'quads', parts: [{ key: 'squat', name: 'Back squat', w: 1, lifts: [['back-squat', 1], ['pause-squat', 1.1], ['box-squat', 1.0], ['safety-bar-squat', 1.05], ['front-squat', 1.2], ['zercher-squat', 1.2], ['hack-squat', 0.75], ['leg-press', 0.5]] }] },
  { id: 'hinge', name: 'Deadlift', group: 'hamstrings', parts: [{ key: 'deadlift', name: 'Deadlift', w: 1, lifts: [['deadlift', 1], ['sumo-deadlift', 1], ['trap-bar-deadlift', 0.95], ['deficit-deadlift', 1.1], ['rdl', 1.35], ['stiff-leg-deadlift', 1.3]] }] },
  { id: 'push', name: 'Push', group: 'chest', parts: [{ key: 'bench', name: 'Bench press', w: 0.6, lifts: BENCH }, { key: 'ohp', name: 'Overhead press', w: 0.4, lifts: OHP }] },
  { id: 'pull', name: 'Pull', group: 'back', parts: [{ key: 'row', name: 'Barbell row', w: 1, lifts: [['bb-row', 1], ['pendlay-row', 1.05], ['yates-row', 0.95], ['seal-row', 1.15], ['t-bar-row', 0.9], ['cable-row', 1.0], ['lat-pulldown', 1.0], ['db-row', 2.0]] }] },
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

const PCT_AT = [5, 20, 50, 80, 95];
const levelOfPct = (p) => { let n = -1; PCT_AT.forEach((v, i) => { if (p >= v) n = i; }); return n; };

// One reference lift: the best basis (the lift itself if done lately, otherwise the strongest
// variation), its equivalent max, ratio, level and percentile.
function scorePart(p, statsFor, person) {
  const done = p.lifts.map(([id, f]) => ({ id, f, s: statsFor(id) })).filter((x) => x.s && x.s.now > 0);
  const levels = standardsFor(p.key, person);
  if (!done.length || !person.bw) return { ...p, levels, basis: null, related: done };
  const basis = done.find((x) => x.f === 1 && x.s.recent) || [...done].sort((x, y) => y.s.now * y.f - x.s.now * x.f)[0];
  const equiv = basis.s.now * basis.f;
  const ratio = equiv / person.bw;
  return { ...p, levels, basis, equiv, ratio, pct: percentileOf(ratio, levels), level: levelOf(ratio, levels), related: done };
}

// Each pattern: its scored parts and the blended percentile and level. statsFor(id) gives
// { now (est. max, lb), recent }.
export function strengthAreas(statsFor, person) {
  return AREAS.map((a) => {
    const parts = a.parts.map((p) => scorePart(p, statsFor, person));
    const scored = parts.filter((p) => p.pct != null);
    if (!scored.length) return { ...a, parts, pct: null, level: -1 };
    const wsum = scored.reduce((t, p) => t + p.w, 0);
    const pct = Math.round(scored.reduce((t, p) => t + p.pct * p.w, 0) / wsum);
    return { ...a, parts, pct, level: levelOfPct(pct) };
  });
}
