// Exercise bank: every exercise the app knows about, with how it's classified.
//
// Classification follows common strength-training references:
//  - Compound vs accessory: NSCA "Essentials of Strength Training and Conditioning" definitions
//    (compound = multi-joint / core lift; accessory = single-joint or assistance exercise).
//  - Primary vs secondary muscles: ExRx.net exercise directory ("target" and "synergist" muscles),
//    simplified to the muscle groups below.
// Hip thrusts, pull-throughs and back extensions move one joint, so they're listed as accessories.

export const MUSCLES = {
  chest: 'Chest',
  'front-delts': 'Front delts',
  'side-delts': 'Side delts',
  'rear-delts': 'Rear delts',
  lats: 'Lats',
  'upper-back': 'Upper back',
  traps: 'Traps',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  'lower-back': 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves: 'Calves',
  'hip-flexors': 'Hip flexors',
};

export const CATEGORIES = { compound: 'Compound', accessory: 'Accessory' };

export const PATTERNS = {
  'horizontal-push': 'Horizontal push',
  'incline-push': 'Incline push',
  'vertical-push': 'Vertical push',
  dip: 'Dip',
  'chest-fly': 'Chest fly',
  'horizontal-pull': 'Horizontal pull (row)',
  'vertical-pull': 'Vertical pull',
  pullover: 'Pullover',
  shrug: 'Shrug',
  'rear-delt': 'Rear delt / face pull',
  'lateral-raise': 'Lateral raise',
  'front-raise': 'Front raise',
  'elbow-flexion': 'Curl',
  'elbow-extension': 'Tricep extension',
  squat: 'Squat / press',
  lunge: 'Lunge / split squat',
  hinge: 'Hip hinge',
  'hip-extension': 'Hip extension',
  'back-extension': 'Back extension',
  'knee-flexion': 'Leg curl',
  'knee-extension': 'Leg extension',
  'hip-adduction': 'Hip adduction',
  'hip-abduction': 'Hip abduction',
  'calf-raise': 'Calf raise',
  'core-flexion': 'Crunch',
  'hip-flexion': 'Leg raise',
  'anti-extension': 'Anti-extension',
  'anti-rotation': 'Anti-rotation',
  rotation: 'Rotation',
  carry: 'Carry',
};

// [id, name, category (C/A), equipment type, pattern, primary muscles, secondary muscles]
const RAW = [
  // ---- Chest ----
  ['bench-press', 'Barbell bench press', 'C', 'barbell-upper', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['incline-bench', 'Incline barbell bench press', 'C', 'barbell-upper', 'incline-push', 'chest front-delts', 'triceps'],
  ['decline-bench', 'Decline bench press', 'C', 'barbell-upper', 'horizontal-push', 'chest', 'triceps front-delts'],
  ['close-grip-bench', 'Close-grip bench press', 'C', 'barbell-upper', 'horizontal-push', 'triceps chest', 'front-delts'],
  ['db-bench', 'DB bench press', 'C', 'dumbbell', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['db-incline-bench', 'DB incline bench', 'C', 'dumbbell', 'incline-push', 'chest front-delts', 'triceps'],
  ['smith-incline', 'Smith machine incline press', 'C', 'machine', 'incline-push', 'chest front-delts', 'triceps'],
  ['machine-chest-press', 'Machine chest press', 'C', 'machine', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['incline-machine-press', 'Incline machine press', 'C', 'machine', 'incline-push', 'chest front-delts', 'triceps'],
  ['pushup', 'Pushup', 'C', 'bodyweight', 'horizontal-push', 'chest', 'front-delts triceps abs'],
  ['weighted-pushup', 'Weighted pushup', 'C', 'bodyweight', 'horizontal-push', 'chest', 'front-delts triceps abs'],
  ['dip', 'Dip', 'C', 'bodyweight', 'dip', 'chest triceps', 'front-delts'],
  ['machine-fly', 'Machine fly', 'A', 'machine', 'chest-fly', 'chest', 'front-delts'],
  ['cable-fly', 'Cable fly', 'A', 'cable', 'chest-fly', 'chest', 'front-delts'],
  ['low-high-cable-fly', 'Low-to-high cable fly', 'A', 'cable', 'chest-fly', 'chest', 'front-delts'],
  ['db-fly', 'DB fly', 'A', 'dumbbell', 'chest-fly', 'chest', 'front-delts'],
  ['db-incline-fly', 'DB incline fly', 'A', 'dumbbell', 'chest-fly', 'chest', 'front-delts'],

  // ---- Shoulders ----
  ['ohp', 'Standing overhead press', 'C', 'barbell-upper', 'vertical-push', 'front-delts', 'triceps side-delts abs'],
  ['db-shoulder-press', 'DB shoulder press', 'C', 'dumbbell', 'vertical-push', 'front-delts', 'triceps side-delts'],
  ['arnold-press', 'Arnold press', 'C', 'dumbbell', 'vertical-push', 'front-delts', 'side-delts triceps'],
  ['machine-shoulder-press', 'Machine shoulder press', 'C', 'machine', 'vertical-push', 'front-delts', 'triceps side-delts'],
  ['landmine-press', 'Landmine press', 'C', 'barbell-upper', 'incline-push', 'front-delts chest', 'triceps abs'],
  ['hspu', 'Handstand pushup', 'C', 'bodyweight', 'vertical-push', 'front-delts triceps', 'side-delts traps'],
  ['db-lat-raise', 'DB lateral raise', 'A', 'dumbbell', 'lateral-raise', 'side-delts', 'traps'],
  ['cable-lat-raise', 'Cable lateral raise', 'A', 'cable', 'lateral-raise', 'side-delts', 'traps'],
  ['machine-lat-raise', 'Machine lateral raise', 'A', 'machine', 'lateral-raise', 'side-delts', 'traps'],
  ['upright-row', 'Cable upright row', 'A', 'cable', 'lateral-raise', 'side-delts traps', 'biceps'],
  ['db-front-raise', 'DB front raise', 'A', 'dumbbell', 'front-raise', 'front-delts', 'chest side-delts'],
  ['rear-delt-fly', 'Machine rear delt fly', 'A', 'machine', 'rear-delt', 'rear-delts', 'upper-back'],
  ['db-rear-delt-fly', 'Bent-over DB rear delt fly', 'A', 'dumbbell', 'rear-delt', 'rear-delts', 'upper-back'],
  ['cable-rear-delt-fly', 'Cable rear delt fly', 'A', 'cable', 'rear-delt', 'rear-delts', 'upper-back'],
  ['face-pull', 'Cable face pull', 'A', 'cable', 'rear-delt', 'rear-delts upper-back', 'traps'],

  // ---- Back: vertical pulls ----
  ['pullup', 'Pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['neutral-pullup', 'Neutral-grip pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back forearms'],
  ['chinup', 'Chin-up', 'C', 'bodyweight', 'vertical-pull', 'lats biceps', 'upper-back'],
  ['assisted-pullup', 'Assisted pullup machine', 'C', 'machine', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['lat-pulldown', 'Lat pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['close-grip-pulldown', 'Close-grip (V-bar) pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['single-arm-pulldown', 'Single-arm cable pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'biceps'],
  ['machine-pulldown', 'Machine pulldown (Hammer Strength)', 'C', 'machine', 'vertical-pull', 'lats', 'biceps upper-back'],

  // ---- Back: rows ----
  ['bb-row', 'Bent-over barbell row', 'C', 'barbell-upper', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps lower-back'],
  ['pendlay-row', 'Pendlay row', 'C', 'barbell-upper', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps lower-back'],
  ['t-bar-row', 'T-bar row', 'C', 'barbell-upper', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps lower-back'],
  ['meadows-row', 'Meadows row', 'C', 'barbell-upper', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps'],
  ['db-row', 'One-arm DB row', 'C', 'dumbbell', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps'],
  ['chest-supported-db-row', 'Chest-supported DB row', 'C', 'dumbbell', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps'],
  ['cable-row', 'Seated cable row', 'C', 'cable', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['iso-row', 'Hammer Strength iso row', 'C', 'machine', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['machine-row', 'Chest-supported machine row', 'C', 'machine', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps'],
  ['inverted-row', 'Inverted row', 'C', 'bodyweight', 'horizontal-pull', 'upper-back lats', 'biceps rear-delts'],

  // ---- Back: accessories ----
  ['straight-arm-pulldown', 'Straight-arm cable pulldown', 'A', 'cable', 'pullover', 'lats', 'triceps'],
  ['db-pullover', 'DB pullover', 'A', 'dumbbell', 'pullover', 'lats chest', 'triceps'],
  ['bb-shrug', 'Barbell shrug', 'A', 'barbell-upper', 'shrug', 'traps', 'forearms'],
  ['db-shrug', 'DB shrug', 'A', 'dumbbell', 'shrug', 'traps', 'forearms'],
  ['back-extension', '45° back extension', 'A', 'bodyweight', 'back-extension', 'lower-back glutes', 'hamstrings'],

  // ---- Biceps & forearms ----
  ['bb-curl', 'Barbell curl', 'A', 'barbell-upper', 'elbow-flexion', 'biceps', 'forearms'],
  ['ez-curl', 'EZ-bar curl', 'A', 'barbell-upper', 'elbow-flexion', 'biceps', 'forearms'],
  ['db-curl', 'DB curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['incline-db-curl', 'Incline DB curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['spider-curl', 'Spider curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['hammer-curl', 'Hammer curl / cross-body hammer curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps forearms', ''],
  ['preacher-curl', 'Preacher curl', 'A', 'machine', 'elbow-flexion', 'biceps', 'forearms'],
  ['cable-curl', 'Cable curl', 'A', 'cable', 'elbow-flexion', 'biceps', 'forearms'],
  ['btb-cable-curl', 'Behind-the-back cable curl', 'A', 'cable', 'elbow-flexion', 'biceps', 'forearms'],
  ['reverse-curl', 'Reverse-grip EZ curl', 'A', 'barbell-upper', 'elbow-flexion', 'forearms biceps', ''],

  // ---- Triceps ----
  ['skullcrusher', 'Skullcrusher', 'A', 'barbell-upper', 'elbow-extension', 'triceps', ''],
  ['cable-pushdown', 'Cable tricep pushdown', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['cable-tri-ext', 'One-arm cable tricep side extension', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['overhead-cable-ext', 'Overhead cable tricep extension', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['db-overhead-ext', 'DB overhead tricep extension', 'A', 'dumbbell', 'elbow-extension', 'triceps', ''],
  ['db-kickback', 'DB tricep kickback', 'A', 'dumbbell', 'elbow-extension', 'triceps', ''],
  ['machine-dip', 'Machine tricep dip', 'A', 'machine', 'dip', 'triceps', 'chest front-delts'],

  // ---- Quads: squats & presses ----
  ['back-squat', 'Back squat', 'C', 'barbell-lower', 'squat', 'quads glutes', 'adductors lower-back'],
  ['front-squat', 'Front squat', 'C', 'barbell-lower', 'squat', 'quads', 'glutes upper-back abs'],
  ['safety-bar-squat', 'Safety bar squat', 'C', 'barbell-lower', 'squat', 'quads glutes', 'adductors upper-back'],
  ['hack-squat', 'Hack squat', 'C', 'machine', 'squat', 'quads', 'glutes adductors'],
  ['pendulum-squat', 'Pendulum squat', 'C', 'machine', 'squat', 'quads', 'glutes adductors'],
  ['smith-squat', 'Smith machine squat', 'C', 'machine', 'squat', 'quads glutes', 'adductors'],
  ['leg-press', 'Leg press', 'C', 'machine', 'squat', 'quads glutes', 'adductors'],
  ['belt-squat', 'Belt squat', 'C', 'machine', 'squat', 'quads glutes', 'adductors'],
  ['goblet-squat', 'Goblet squat', 'C', 'dumbbell', 'squat', 'quads glutes', 'abs upper-back'],

  // ---- Lunges ----
  ['bulgarian-split-squat', 'Bulgarian split squat', 'C', 'dumbbell', 'lunge', 'quads glutes', 'adductors'],
  ['walking-lunge', 'Walking lunge', 'C', 'dumbbell', 'lunge', 'quads glutes', 'adductors hamstrings'],
  ['reverse-lunge', 'Reverse lunge', 'C', 'dumbbell', 'lunge', 'glutes quads', 'adductors hamstrings'],
  ['step-up', 'DB step-up', 'C', 'dumbbell', 'lunge', 'quads glutes', 'hamstrings'],

  // ---- Hinges ----
  ['deadlift', 'Deadlift', 'C', 'barbell-lower', 'hinge', 'glutes hamstrings lower-back', 'quads traps forearms lats'],
  ['sumo-deadlift', 'Sumo deadlift', 'C', 'barbell-lower', 'hinge', 'glutes quads adductors', 'hamstrings lower-back traps'],
  ['trap-bar-deadlift', 'Trap bar deadlift', 'C', 'barbell-lower', 'hinge', 'quads glutes', 'hamstrings lower-back traps'],
  ['rdl', 'Romanian deadlift', 'C', 'barbell-lower', 'hinge', 'hamstrings glutes', 'lower-back forearms'],
  ['db-rdl', 'DB Romanian deadlift', 'C', 'dumbbell', 'hinge', 'hamstrings glutes', 'lower-back forearms'],
  ['single-leg-rdl', 'Single-leg DB RDL', 'C', 'dumbbell', 'hinge', 'hamstrings glutes', 'abductors lower-back'],
  ['good-morning', 'Good morning', 'C', 'barbell-lower', 'hinge', 'hamstrings lower-back', 'glutes'],

  // ---- Glutes ----
  ['hip-thrust', 'Barbell hip thrust (Smith bar + bench)', 'A', 'barbell-lower', 'hip-extension', 'glutes', 'hamstrings'],
  ['machine-hip-thrust', 'Hip thrust machine', 'A', 'machine', 'hip-extension', 'glutes', 'hamstrings'],
  ['glute-bridge', 'Barbell glute bridge', 'A', 'barbell-lower', 'hip-extension', 'glutes', 'hamstrings'],
  ['cable-pull-through', 'Cable pull-through', 'A', 'cable', 'hinge', 'glutes hamstrings', 'lower-back'],
  ['cable-kickback', 'Cable glute kickback', 'A', 'cable', 'hip-extension', 'glutes', 'hamstrings'],

  // ---- Hamstrings ----
  ['lying-ham-curl', 'Lying hamstring curl', 'A', 'machine', 'knee-flexion', 'hamstrings', 'calves'],
  ['seated-ham-curl', 'Seated hamstring curl', 'A', 'machine', 'knee-flexion', 'hamstrings', 'calves'],
  ['ghr', 'Glute ham raise', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', 'glutes calves'],
  ['nordic-curl', 'Nordic curl', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', 'calves'],

  // ---- Quads, adductors, abductors ----
  ['leg-extension', 'Leg extension', 'A', 'machine', 'knee-extension', 'quads', ''],
  ['hip-adductor', 'Machine hip adductor', 'A', 'machine', 'hip-adduction', 'adductors', ''],
  ['copenhagen-plank', 'Copenhagen plank', 'A', 'bodyweight', 'hip-adduction', 'adductors', 'obliques'],
  ['hip-abductor', 'Machine hip abductor', 'A', 'machine', 'hip-abduction', 'abductors', 'glutes'],
  ['cable-hip-abduction', 'Cable hip abduction', 'A', 'cable', 'hip-abduction', 'abductors', 'glutes'],

  // ---- Calves ----
  ['standing-calf', 'Standing calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['calf-press', 'Calf press', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['seated-calf', 'Seated calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['smith-calf', 'Smith machine calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['single-leg-calf', 'Single-leg DB calf raise', 'A', 'dumbbell', 'calf-raise', 'calves', ''],

  // ---- Core ----
  ['cable-crunch', 'Weighted cable crunch', 'A', 'cable', 'core-flexion', 'abs', 'obliques'],
  ['ab-crunch-machine', 'Ab crunch machine', 'A', 'machine', 'core-flexion', 'abs', 'obliques'],
  ['ball-crunch', 'Exercise ball crunch (weighted)', 'A', 'dumbbell', 'core-flexion', 'abs', 'obliques'],
  ['decline-situp', 'Weighted decline sit-up', 'A', 'bodyweight', 'core-flexion', 'abs', 'hip-flexors obliques'],
  ['hanging-leg-raise', 'Hanging leg raise', 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'obliques forearms'],
  ['vertical-leg-raise', 'Vertical leg raise', 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'obliques'],
  ['leg-raise', 'Leg raise', 'A', 'bodyweight', 'hip-flexion', 'abs', 'hip-flexors'],
  ['ab-wheel', 'Ab wheel rollout', 'A', 'bodyweight', 'anti-extension', 'abs', 'lats obliques'],
  ['pallof-press', 'Pallof press', 'A', 'cable', 'anti-rotation', 'obliques', 'abs'],
  ['cable-woodchop', 'Cable woodchop', 'A', 'cable', 'rotation', 'obliques', 'abs'],

  // ---- Full body ----
  ['farmers-carry', "Farmer's carry", 'C', 'dumbbell', 'carry', 'forearms traps', 'abs glutes'],
];

const split = (s) => (s ? s.split(' ') : []);

export const BANK = Object.fromEntries(RAW.map(([id, name, cat, type, pattern, primary, secondary]) => [id, {
  id, name, type, pattern,
  category: cat === 'C' ? 'compound' : 'accessory',
  primary: split(primary),
  secondary: split(secondary),
}]));

// Add bank exercises the user doesn't have yet, and refresh classification on the ones they do.
// Name, equipment, increment, notes etc. the user set are never overwritten.
export function syncBank(exercises, defaultIncrements) {
  for (const b of Object.values(BANK)) {
    const ex = exercises[b.id];
    if (!ex) {
      exercises[b.id] = {
        id: b.id, name: b.name, type: b.type, increment: defaultIncrements[b.type] || 5,
        substitute: '', notes: '', minRir: 0, rules: {}, startWeight: null,
        category: b.category, pattern: b.pattern, primary: [...b.primary], secondary: [...b.secondary],
      };
    } else if (!ex.customMeta) {
      Object.assign(ex, { category: b.category, pattern: b.pattern, primary: [...b.primary], secondary: [...b.secondary] });
    }
  }
  for (const ex of Object.values(exercises)) {
    ex.category ||= 'accessory';
    ex.primary ||= [];
    ex.secondary ||= [];
  }
  return exercises;
}

// How alike two exercises are: same movement pattern counts most, then shared primary muscles,
// then overlapping secondary muscles, same category and same equipment. Mismatched primaries cost points.
export function similarity(a, b) {
  let score = 0;
  if (a.pattern && a.pattern === b.pattern) score += 6;
  const sharedPrimary = b.primary.filter((m) => a.primary.includes(m)).length;
  score += sharedPrimary * 3;
  score += b.secondary.filter((m) => a.primary.includes(m)).length * 0.5;
  score += b.primary.filter((m) => a.secondary.includes(m)).length * 0.5;
  score += b.secondary.filter((m) => a.secondary.includes(m)).length * 0.5;
  // Penalize primaries that don't line up (e.g. close-grip bench is half a triceps lift).
  score -= b.primary.filter((m) => !a.primary.includes(m)).length;
  score -= a.primary.filter((m) => !b.primary.includes(m)).length;
  if (a.category === b.category) score += 2;
  if (a.type === b.type) score += 0.5;
  return score;
}

export function similarExercises(exercises, exId, limit = 8, exclude = []) {
  const a = exercises[exId];
  if (!a) return [];
  return Object.values(exercises)
    .filter((b) => b.id !== exId && !exclude.includes(b.id))
    .filter((b) => (a.pattern && b.pattern === a.pattern) || b.primary.some((m) => a.primary.includes(m)))
    .map((b) => ({ ex: b, score: similarity(a, b), samePattern: !!a.pattern && a.pattern === b.pattern }))
    .sort((x, y) => y.score - x.score || x.ex.name.localeCompare(y.ex.name))
    .slice(0, limit);
}
