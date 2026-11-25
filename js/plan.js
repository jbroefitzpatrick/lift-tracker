// Default exercise definitions for a new install.
// startWeight: null means no fixed start; a guess sized to the person is used until the first log.
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

// Exercises every new install starts with. No starting weights: the first workout's weight is a
// guess sized to the person (js/start-weights.js), then the app learns from what's logged.
// [id, name, type, extra]
const EX = [
  ['iso-row', 'Hammer Strength iso row', 'machine'],
  ['db-incline-bench', 'DB incline bench', 'dumbbell'],
  ['btb-cable-curl', 'Behind-the-back cable curl', 'cable'],
  ['cable-tri-ext', 'One-arm cable tricep side extension', 'cable', { substitute: 'Cable tricep pushdown' }],
  ['neutral-pullup', 'Neutral-grip pullup', 'bodyweight'],
  ['cable-lat-raise', 'Cable lateral raise', 'cable'],
  ['rear-delt-fly', 'Machine rear delt fly', 'machine'],
  ['machine-fly', 'Machine fly', 'machine'],
  ['hspu', 'Handstand pushup', 'bodyweight'],
  ['ball-crunch', 'Exercise ball crunch', 'dumbbell'],
  ['back-squat', 'Back squat', 'barbell-lower'],
  ['calf-press', 'Calf press', 'machine'],
  ['hip-adductor', 'Machine hip adductor', 'machine'],
  ['lying-ham-curl', 'Lying hamstring curl', 'machine'],
  ['leg-extension', 'Leg extension', 'machine'],
  ['cable-pull-through', 'Cable pull-through', 'cable'],
  ['cable-crunch', 'Weighted cable crunch', 'cable'],
  ['bench-press', 'Barbell bench press', 'barbell-upper', { substitute: 'Machine chest press' }],
  ['db-shoulder-press', 'DB shoulder press', 'dumbbell'],
  ['skullcrusher', 'Skullcrusher', 'barbell-upper'],
  ['db-incline-fly', 'DB incline fly', 'dumbbell'],
  ['db-lat-raise', 'DB lateral raise', 'dumbbell'],
  ['dip', 'Dip', 'bodyweight', { substitute: 'Close-grip bench or weighted pushup' }],
  ['vertical-leg-raise', 'Vertical leg raise', 'bodyweight'],
  ['cable-row', 'Seated cable row', 'cable'],
  ['lat-pulldown', 'Lat pulldown', 'cable'],
  ['bb-row', 'Bent-over barbell row', 'barbell-upper'],
  ['preacher-curl', 'Preacher curl', 'machine'],
  ['hammer-curl', 'Hammer curl', 'dumbbell'],
  ['bb-shrug', 'Barbell shrug', 'barbell-upper'],
  ['face-pull', 'Cable face pull', 'cable'],
  ['ab-crunch-machine', 'Ab crunch machine', 'machine'],
  ['deadlift', 'Deadlift', 'barbell-lower'],
  ['hip-thrust', 'Barbell hip thrust', 'barbell-lower'],
  ['leg-press', 'Leg press', 'machine'],
  ['standing-calf', 'Standing calf raise', 'machine'],
  ['hip-abductor', 'Machine hip abductor', 'machine'],
  ['ghr', 'Glute ham raise', 'bodyweight'],
  ['leg-raise', 'Leg raise', 'bodyweight'],
  ['rdl', 'Romanian deadlift', 'barbell-lower'],
];

export function defaultExercises() {
  const out = {};
  for (const [id, name, type, extra = {}] of EX) {
    out[id] = {
      id,
      name,
      type,
      increment: DEFAULT_INCREMENTS[type],
      substitute: extra.substitute || '',
      notes: extra.notes || '',
      minRir: 0,
      rules: extra.rules || {},
      startWeight: null,
    };
  }
  return out;
}

export const ROW_ROTATION = ['cable-row', 'lat-pulldown', 'bb-row'];

// Nothing logged yet on a new install.
export function seedState() {
  return {};
}
