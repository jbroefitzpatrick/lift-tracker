// Default exercises and the preloaded training plan (spec section 4).
// startWeight: null means "TBD" — the first logged session sets the baseline.
// For bodyweight exercises, weight is *added* load (0 = bodyweight only).

export const TYPES = {
  'barbell-upper': 'Barbell (upper)',
  'barbell-lower': 'Barbell (lower)',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
};

export const DEFAULT_INCREMENTS = {
  'barbell-upper': 5,
  'barbell-lower': 10,
  dumbbell: 5,
  machine: 5,
  cable: 5,
  bodyweight: 5,
};

// [id, name, type, startWeight, extra]
const EX = [
  // Monday
  ['iso-row', 'Hammer Strength iso row', 'machine', 105],
  ['db-incline-bench', 'DB incline bench', 'dumbbell', 95, { notes: 'Weight is per DB. Current range 85–95.' }],
  ['btb-cable-curl', 'Behind-the-back cable curl', 'cable', 35],
  ['cable-tri-ext', 'One-arm cable tricep side extension', 'cable', 35, { substitute: 'Cable tricep pushdown' }],
  ['neutral-pullup', 'Neutral-grip pullup', 'bodyweight', 0],
  ['cable-lat-raise', 'Cable lateral raise', 'cable', null],
  ['rear-delt-fly', 'Machine rear delt fly', 'machine', 160],
  ['machine-fly', 'Machine fly', 'machine', 200, { notes: 'Stop at chest level.' }],
  ['hspu', 'Handstand pushup', 'bodyweight', 0, { notes: 'Past 22 reps: add a deficit or slow the tempo.' }],
  ['ball-crunch', 'Exercise ball crunch (weighted)', 'dumbbell', null],
  // Tuesday
  ['back-squat', 'Back squat', 'barbell-lower', 365],
  ['calf-press', 'Calf press', 'machine', 360, { notes: 'Full stretch, pause at bottom.' }],
  ['hip-adductor', 'Machine hip adductor', 'machine', 190],
  ['lying-ham-curl', 'Lying hamstring curl', 'machine', 160],
  ['leg-extension', 'Leg extension', 'machine', 190],
  ['cable-pull-through', 'Cable pull-through', 'cable', 105],
  ['cable-crunch', 'Weighted cable crunch', 'cable', 110],
  // Wednesday
  ['bench-press', 'Barbell bench press', 'barbell-upper', 285, {
    substitute: 'Machine chest press',
    notes: 'Shoulder rehab: stay 8–12. Go up only after all sets hit 12 and it was pain-free.',
    rules: { rehab: true },
  }],
  ['db-shoulder-press', 'DB shoulder press', 'dumbbell', 55],
  ['skullcrusher', 'Skullcrusher', 'barbell-upper', 100],
  ['db-incline-fly', 'DB incline fly', 'dumbbell', 30, { notes: 'Stop at chest level.' }],
  ['db-lat-raise', 'DB lateral raise', 'dumbbell', 30],
  ['dip', 'Dip', 'bodyweight', 0, { substitute: 'Close-grip bench or weighted pushup' }],
  ['vertical-leg-raise', 'Vertical leg raise', 'bodyweight', 20],
  // Thursday
  ['cable-row', 'Seated cable row', 'cable', 190],
  ['lat-pulldown', 'Lat pulldown', 'cable', 165],
  ['bb-row', 'Bent-over barbell row', 'barbell-upper', null],
  ['preacher-curl', 'Preacher curl', 'machine', 90, {
    notes: 'Alternate wide/narrow grip weekly.',
    rules: { dropSet: true },
  }],
  ['hammer-curl', 'Hammer curl / cross-body hammer curl', 'dumbbell', 30],
  ['bb-shrug', 'Barbell shrug', 'barbell-upper', 225],
  ['face-pull', 'Cable face pull', 'cable', 80],
  ['ab-crunch-machine', 'Ab crunch machine', 'machine', null],
  // Friday
  ['deadlift', 'Deadlift', 'barbell-lower', 385],
  ['hip-thrust', 'Barbell hip thrust (Smith bar + bench)', 'barbell-lower', 275],
  ['leg-press', 'Leg press', 'machine', 410],
  ['standing-calf', 'Standing calf raise', 'machine', 360, { notes: 'Full stretch, pause at bottom.' }],
  ['hip-abductor', 'Machine hip abductor', 'machine', 190],
  ['ghr', 'Glute ham raise', 'bodyweight', 20],
  ['leg-raise', 'Leg raise', 'bodyweight', 0, { notes: 'Add ankle weights once 30 is easy.' }],
  // Race block
  ['rdl', 'Romanian deadlift', 'barbell-lower', null],
];

export function defaultExercises() {
  const out = {};
  for (const [id, name, type, startWeight, extra = {}] of EX) {
    out[id] = {
      id,
      name,
      type,
      increment: DEFAULT_INCREMENTS[type],
      substitute: extra.substitute || '',
      notes: extra.notes || '',
      minRir: 0,
      rules: extra.rules || {},
      startWeight,
    };
  }
  return out;
}

// [group, exerciseId, sets, repMin, repMax, restSec, note, extra]
// restSec on the first member of a superset is ignored; the group rests after the round.
const DAYS = {
  mon: ['Upper', [
    ['1', 'iso-row', 3, 6, 10, 150, 'Pull compound', { maxSets: 4 }],
    ['2', 'db-incline-bench', 3, 8, 12, 120, 'Push compound'],
    ['3a', 'btb-cable-curl', 3, 8, 12, 0],
    ['3b', 'cable-tri-ext', 3, 8, 12, 90, 'Or cable pushdown'],
    ['4a', 'neutral-pullup', 3, 8, 12, 0],
    ['4b', 'cable-lat-raise', 4, 12, 20, 90, '4th set alone after the last round'],
    ['5a', 'rear-delt-fly', 3, 10, 15, 0],
    ['5b', 'machine-fly', 3, 10, 15, 90],
    ['6a', 'hspu', 3, 18, 22, 0],
    ['6b', 'ball-crunch', 3, 15, 25, 90],
  ]],
  tue: ['Lower', [
    ['1', 'back-squat', 3, 5, 8, 180, '', { maxSets: 4 }],
    ['2a', 'calf-press', 4, 8, 12, 0, '4th calf set alone after the last round'],
    ['2b', 'hip-adductor', 3, 10, 15, 90],
    ['3a', 'lying-ham-curl', 3, 8, 12, 0],
    ['3b', 'leg-extension', 3, 8, 12, 90],
    ['4a', 'cable-pull-through', 3, 10, 15, 0],
    ['4b', 'cable-crunch', 3, 10, 15, 90],
  ]],
  wed: ['Push', [
    ['1', 'bench-press', 3, 8, 12, 150, '', { maxSets: 4 }],
    ['2a', 'db-shoulder-press', 3, 8, 12, 0, 'Do first each round'],
    ['2b', 'skullcrusher', 3, 8, 12, 120],
    ['3a', 'db-incline-fly', 3, 10, 15, 0],
    ['3b', 'db-lat-raise', 4, 12, 20, 90],
    ['4a', 'dip', 3, 8, 16, 0],
    ['4b', 'vertical-leg-raise', 3, 8, 16, 90],
  ]],
  thu: ['Pull', [
    ['1', 'cable-row', 3, 5, 8, 150, 'Rotates at each deload', { maxSets: 4, role: 'rowCompound' }],
    ['2', 'preacher-curl', 3, 8, 14, 90, '', { maxSets: 4 }],
    ['3a', 'lat-pulldown', 3, 10, 12, 0, 'Do first each round', { role: 'rowAccessory' }],
    ['3b', 'hammer-curl', 3, 8, 12, 120],
    ['4a', 'bb-shrug', 3, 8, 12, 0],
    ['4b', 'face-pull', 3, 12, 15, 90],
    ['5', 'ab-crunch-machine', 3, 10, 20, 75],
  ]],
  fri: ['Legs', [
    ['1', 'deadlift', 3, 5, 8, 180, '', { maxSets: 4 }],
    ['2', 'hip-thrust', 3, 8, 12, 120],
    ['3', 'leg-press', 3, 8, 12, 120, '', { maxSets: 4 }],
    ['4a', 'standing-calf', 4, 10, 15, 0],
    ['4b', 'hip-abductor', 3, 10, 15, 90],
    ['5a', 'ghr', 3, 8, 16, 0],
    ['5b', 'leg-raise', 3, 15, 30, 90],
  ]],
};

export const ROW_ROTATION = ['cable-row', 'lat-pulldown', 'bb-row'];

export function defaultPlan() {
  const out = {};
  for (const [day, [name, items]] of Object.entries(DAYS)) {
    out[day] = {
      name,
      items: items.map(([group, exerciseId, sets, repMin, repMax, restSec, note = '', extra = {}], i) => ({
        uid: `${day}-${i + 1}`,
        exerciseId,
        group,
        sets,
        repMin,
        repMax,
        restSec,
        note,
        ...extra,
      })),
    };
  }
  return out;
}

// Last logged result the spec gives for preacher curl, so its first session has a reference.
export function seedState() {
  return {
    'preacher-curl': {
      last: { date: null, weight: 90, weights: [90, 80, 80, 70], reps: [8, 12, 12, 14], totalReps: 46 },
      targetReps: 8,
    },
  };
}
