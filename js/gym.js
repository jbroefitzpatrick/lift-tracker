// Gym equipment: real weight steps, plate math and warm-up sets.

export function activeGym(db) {
  return db.gyms.find((g) => g.id === db.settings.activeGym) || db.gyms[0];
}

const isBarbell = (ex) => ex?.type?.startsWith('barbell');

// Smallest jump the gym allows for this exercise.
export function weightStep(ex, gym) {
  if (isBarbell(ex)) return 2 * Math.min(...(gym.plates.length ? gym.plates : [2.5]));
  if (ex?.type === 'dumbbell') return gym.dbStep || 5;
  if (ex?.type === 'bodyweight') return 5;
  return gym.machineStep || 5;
}

// Plates per side for a barbell weight (greedy, largest first). Unlimited plates of each size.
export function platesFor(weight, gym) {
  const plates = [...gym.plates].sort((a, b) => b - a);
  let side = (weight - gym.barWeight) / 2;
  if (side < 0) return { perSide: [], leftover: side * 2, under: true };
  const out = [];
  for (const p of plates) {
    while (side >= p - 1e-9) { out.push(p); side -= p; }
  }
  return { perSide: out, leftover: Math.round(side * 2 * 100) / 100 };
}

// Nearest weight this gym can actually load for the exercise.
export function roundToGym(ex, weight, gym) {
  if (weight == null) return weight;
  if (isBarbell(ex)) {
    if (weight <= gym.barWeight) return gym.barWeight;
    const step = weightStep(ex, gym);
    const r = gym.barWeight + Math.round((weight - gym.barWeight) / step) * step;
    const { leftover } = platesFor(r, gym);
    return leftover ? r - leftover : r;
  }
  const step = weightStep(ex, gym);
  let r = Math.round(weight / step) * step;
  if (ex?.type === 'dumbbell' && gym.dbMax) r = Math.min(r, gym.dbMax);
  return Math.max(0, r);
}

export function plateText(weight, gym) {
  const { perSide, under } = platesFor(weight, gym);
  if (under) return `Below the ${gym.barWeight} lb bar`;
  if (!perSide.length) return 'Empty bar';
  // Group: 45×2 + 10
  const counts = [];
  for (const p of perSide) {
    const last = counts[counts.length - 1];
    if (last && last.p === p) last.n += 1; else counts.push({ p, n: 1 });
  }
  return `${counts.map((c) => (c.n > 1 ? `${c.p}×${c.n}` : `${c.p}`)).join(' + ')} per side`;
}

// Ramp-up sets before the first working set (common practice: ~40/60/80% of working weight).
// Warm-up sets that only ever add plates on the way up.
// Barbell: every warm-up is the bar plus the first few plates of the working set's stack
// (largest plates first), so 365 goes 45 → 135 → 225 → 315 → 365 with nothing taken off.
// Small change plates (2.5s, 5s) only appear on the working set. Targets are roughly 40/60/80%
// of the working weight; a step is used only if it's reasonably close to its target.
// Dumbbells and machines round down to easy numbers (whole dumbbells, 10 lb on a stack).
export function warmupSets(ex, workWeight, gym) {
  if (!workWeight || ex?.type === 'bodyweight') return [];
  const plan = [[0.4, 5], [0.6, 3], [0.8, 2]];
  if (isBarbell(ex)) {
    const bar = gym.barWeight;
    if (workWeight <= bar) return [];
    const out = [{ weight: bar, reps: 10 }];
    const { perSide } = platesFor(workWeight, gym);
    const steps = [];
    let acc = bar;
    for (const p of perSide) { acc += 2 * p; if (acc < workWeight - 0.01 && p >= 10) steps.push(acc); }
    for (const [pct, reps] of plan) {
      const target = workWeight * pct;
      const pick = steps.filter((w) => w > out[out.length - 1].weight)
        .sort((x, y) => Math.abs(x - target) - Math.abs(y - target))[0];
      if (pick && Math.abs(pick - target) <= workWeight * 0.16) out.push({ weight: pick, reps });
    }
    return out;
  }
  const step = ex?.type === 'dumbbell' ? Math.max(5, gym.dbStep || 5) : 10;
  const out = [];
  for (const [pct, reps] of [[0.5, 8], [0.75, 4]]) {
    const w = Math.floor((workWeight * pct) / step) * step;
    if (w > 0 && w > (out[out.length - 1]?.weight || 0) && w < workWeight) out.push({ weight: w, reps });
  }
  return out;
}

// Exercise availability: "never" preference or not at this gym (or its equipment type is missing).
const equipOf = (type) => (type?.startsWith('barbell') ? 'barbell' : type);
export function isAvailable(db, ex, gym = activeGym(db)) {
  if (!ex) return false;
  if (db.exPrefs[ex.id] === 'never') return false;
  if (gym.unavailable.includes(ex.id)) return false;
  return gym.equipment.includes(equipOf(ex.type)) && hasGear(gym, ex.needs);
}

// ---------- Specific equipment ----------
// The five broad types above decide what a plan can be built from. This finer list lets a gym say
// "no hack squat, no SkiErg". Each gym keeps the keys it does NOT have in gym.missing, so new
// equipment added to the app shows up as available until the user says otherwise.
export const GEAR = {
  free: { name: 'Bars and free weights', items: { rack: 'Squat rack', 'ez-bar': 'EZ curl bar', 'trap-bar': 'Trap bar', 'safety-bar': 'Safety squat bar', landmine: 'Landmine', kettlebell: 'Kettlebells', 'dip-belt': 'Dip belt' } },
  benches: { name: 'Benches and stations', items: { bench: 'Flat bench', 'incline-bench': 'Adjustable bench', 'preacher-bench': 'Preacher bench', 'pullup-bar': 'Pull-up bar', 'dip-station': 'Dip station', 'back-ext': 'Back extension / GHD', box: 'Plyo box' } },
  legs: { name: 'Leg machines', items: { smith: 'Smith machine', 'leg-press': 'Leg press', 'hack-squat': 'Hack squat', pendulum: 'Pendulum squat', 'belt-squat': 'Belt squat', 'leg-ext': 'Leg extension', 'lying-curl': 'Lying leg curl', 'seated-curl': 'Seated leg curl', 'standing-curl': 'Standing leg curl', 'hip-thrust-machine': 'Hip thrust machine', 'glute-kick': 'Glute kickback machine', 'hip-machine': 'Hip adductor / abductor', 'standing-calf': 'Standing calf raise', 'seated-calf': 'Seated calf raise', 'reverse-hyper': 'Reverse hyper' } },
  upper: { name: 'Upper body machines', items: { 'chest-press': 'Chest press', 'pec-deck': 'Pec deck / rear delt fly', 'shoulder-press': 'Shoulder press', 'lat-raise-machine': 'Lateral raise', 'plate-row': 'Plate-loaded row', 'machine-row': 'Chest-supported row', 'tbar': 'T-bar row', 'plate-pulldown': 'Plate-loaded pulldown', 'pullover-machine': 'Pullover', 'assisted-pullup': 'Assisted pull-up / dip', 'curl-machine': 'Biceps curl', 'tri-machine': 'Triceps extension / dip', 'ab-machine': 'Ab crunch' } },
  cables: { name: 'Cables', items: { 'cable-tower': 'Adjustable cable / crossover', 'lat-pulldown': 'Lat pulldown', 'cable-row': 'Seated cable row' } },
  cardio: { name: 'Cardio', items: { treadmill: 'Treadmill', bike: 'Exercise bike', 'air-bike': 'Air bike', rower: 'Rower', 'ski-erg': 'SkiErg', elliptical: 'Elliptical', stairs: 'Stair climber', sled: 'Sled', 'arm-bike': 'Arm bike' } },
  small: { name: 'Small gear', items: { bands: 'Resistance bands', 'ab-wheel': 'Ab wheel', 'med-ball': 'Medicine ball', 'stability-ball': 'Stability ball', 'jump-rope': 'Jump rope', 'battle-ropes': 'Battle ropes', 'foam-roller': 'Foam roller' } },
};
export const GEAR_NAMES = Object.fromEntries(Object.values(GEAR).flatMap((g) => Object.entries(g.items)));

// Does the gym have everything in keys (a string or array of gear keys)?
export function hasGear(gym, keys) {
  if (!keys?.length) return true;
  const miss = gym?.missing || [];
  return (Array.isArray(keys) ? keys : [keys]).every((k) => !miss.includes(k));
}
