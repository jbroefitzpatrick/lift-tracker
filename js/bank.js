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
  'upper-back': 'Mid back',
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

export const CATEGORIES = { compound: 'Compound', accessory: 'Accessory', conditioning: 'Conditioning' };

// How a set is measured. Lifts use reps (with weight); conditioning uses time, distance or calories.
export const METRICS = { reps: 'Reps', time: 'Time', distance: 'Distance', cal: 'Calories' };

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
  wrist: 'Wrist curl',
  'knee-extension': 'Leg extension',
  'hip-adduction': 'Hip adduction',
  'hip-abduction': 'Hip abduction',
  'calf-raise': 'Calf raise',
  'core-flexion': 'Crunch',
  'hip-flexion': 'Leg raise',
  'anti-extension': 'Anti-extension',
  'anti-rotation': 'Anti-rotation',
  'anti-lateral': 'Anti-side-bend (carry)',
  rotation: 'Rotation',
  carry: 'Carry',
  sprint: 'Sprint',
  erg: 'Erg intervals',
  plyo: 'Plyometric',
  'circuit-move': 'Circuit move',
  isometric: 'Isometric hold',
  run: 'Run',
  mobility: 'Stretch and foam roll',
  prehab: 'Warm-up and prehab',
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
  ['weighted-dip', 'Weighted dip', 'C', 'bodyweight', 'dip', 'chest triceps', 'front-delts'],
  ['machine-fly', 'Pec deck (machine fly)', 'A', 'machine', 'chest-fly', 'chest', 'front-delts'],
  ['cable-fly', 'Cable fly', 'A', 'cable', 'chest-fly', 'chest', 'front-delts'],
  ['low-high-cable-fly', 'Low-to-high cable fly', 'A', 'cable', 'chest-fly', 'chest', 'front-delts'],
  ['db-fly', 'DB fly', 'A', 'dumbbell', 'chest-fly', 'chest', 'front-delts'],
  ['db-incline-fly', 'DB incline fly', 'A', 'dumbbell', 'chest-fly', 'chest', 'front-delts'],
  ['smith-bench', 'Smith machine bench press', 'C', 'machine', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['plate-chest-press', 'Plate-loaded chest press', 'C', 'machine', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['floor-press', 'Barbell floor press', 'C', 'barbell-upper', 'horizontal-push', 'chest triceps', 'front-delts'],
  ['db-decline-bench', 'DB decline bench press', 'C', 'dumbbell', 'horizontal-push', 'chest', 'triceps front-delts'],
  ['assisted-dip', 'Assisted dip machine', 'C', 'machine', 'dip', 'chest triceps', 'front-delts'],
  ['high-low-cable-fly', 'High-to-low cable fly', 'A', 'cable', 'chest-fly', 'chest', 'front-delts'],

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
  ['rear-delt-fly', 'Reverse pec deck (rear delt fly)', 'A', 'machine', 'rear-delt', 'rear-delts', 'upper-back'],
  ['db-rear-delt-fly', 'Bent-over DB rear delt fly', 'A', 'dumbbell', 'rear-delt', 'rear-delts', 'upper-back'],
  ['cable-rear-delt-fly', 'Cable rear delt fly', 'A', 'cable', 'rear-delt', 'rear-delts', 'upper-back'],
  ['face-pull', 'Cable face pull', 'A', 'cable', 'rear-delt', 'rear-delts upper-back', 'traps'],
  ['seated-ohp', 'Seated barbell overhead press', 'C', 'barbell-upper', 'vertical-push', 'front-delts', 'triceps side-delts'],
  ['smith-ohp', 'Smith machine shoulder press', 'C', 'machine', 'vertical-push', 'front-delts', 'triceps side-delts'],
  ['push-press', 'Push press', 'C', 'barbell-upper', 'vertical-push', 'front-delts triceps', 'side-delts quads glutes'],
  ['cable-y-raise', 'Cable Y-raise', 'A', 'cable', 'lateral-raise', 'side-delts', 'traps rear-delts'],
  ['cable-front-raise', 'Cable front raise', 'A', 'cable', 'front-raise', 'front-delts', 'side-delts'],
  ['db-upright-row', 'DB upright row', 'A', 'dumbbell', 'lateral-raise', 'side-delts traps', 'biceps'],

  // ---- Back: vertical pulls ----
  ['pullup', 'Pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['weighted-pullup', 'Weighted pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back forearms'],
  ['weighted-chinup', 'Weighted chin-up', 'C', 'bodyweight', 'vertical-pull', 'lats biceps', 'upper-back forearms'],
  ['weighted-neutral-pullup', 'Weighted neutral-grip pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back forearms'],
  ['neutral-pullup', 'Neutral-grip pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back forearms'],
  ['chinup', 'Chin-up', 'C', 'bodyweight', 'vertical-pull', 'lats biceps', 'upper-back'],
  ['assisted-pullup', 'Assisted pull-up machine', 'C', 'machine', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['lat-pulldown', 'Lat pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['close-grip-pulldown', 'Close-grip (V-bar) pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['single-arm-pulldown', 'Single-arm cable pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'biceps'],
  ['machine-pulldown', 'Iso-lateral pulldown (plate-loaded)', 'C', 'machine', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['underhand-pulldown', 'Underhand-grip pulldown', 'C', 'cable', 'vertical-pull', 'lats biceps', 'upper-back'],
  ['wide-grip-pulldown', 'Wide-grip lat pulldown', 'C', 'cable', 'vertical-pull', 'lats', 'upper-back biceps'],

  // ---- Back: rows ----
  ['bb-row', 'Bent-over barbell row', 'C', 'barbell-upper', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps lower-back'],
  ['pendlay-row', 'Pendlay row', 'C', 'barbell-upper', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps lower-back'],
  ['t-bar-row', 'T-bar row', 'C', 'barbell-upper', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps lower-back'],
  ['meadows-row', 'Meadows row', 'C', 'barbell-upper', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps'],
  ['db-row', 'One-arm DB row', 'C', 'dumbbell', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps'],
  ['chest-supported-db-row', 'Chest-supported DB row', 'C', 'dumbbell', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps'],
  ['cable-row', 'Seated cable row', 'C', 'cable', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['iso-row', 'Iso-lateral row (plate-loaded)', 'C', 'machine', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['machine-row', 'Chest-supported machine row', 'C', 'machine', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps'],
  ['inverted-row', 'Inverted row', 'C', 'bodyweight', 'horizontal-pull', 'upper-back lats', 'biceps rear-delts'],
  ['single-arm-cable-row', 'Single-arm cable row', 'C', 'cable', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['seal-row', 'Seal row', 'C', 'barbell-upper', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps'],
  ['chest-supported-tbar', 'Chest-supported T-bar row', 'C', 'machine', 'horizontal-pull', 'upper-back lats', 'rear-delts biceps'],
  ['smith-row', 'Smith machine row', 'C', 'machine', 'horizontal-pull', 'lats upper-back', 'rear-delts biceps lower-back'],

  // ---- Back: accessories ----
  ['straight-arm-pulldown', 'Straight-arm cable pulldown', 'A', 'cable', 'pullover', 'lats', 'triceps'],
  ['db-pullover', 'DB pullover', 'A', 'dumbbell', 'pullover', 'lats chest', 'triceps'],
  ['bb-shrug', 'Barbell shrug', 'A', 'barbell-upper', 'shrug', 'traps', 'forearms'],
  ['db-shrug', 'DB shrug', 'A', 'dumbbell', 'shrug', 'traps', 'forearms'],
  ['smith-shrug', 'Smith machine shrug', 'A', 'machine', 'shrug', 'traps', 'forearms'],
  ['trap-bar-shrug', 'Trap bar shrug', 'A', 'barbell-lower', 'shrug', 'traps', 'forearms'],
  ['machine-pullover', 'Pullover machine', 'A', 'machine', 'pullover', 'lats', 'chest triceps'],
  ['reverse-hyper', 'Reverse hyperextension', 'A', 'machine', 'back-extension', 'glutes lower-back', 'hamstrings'],
  ['back-extension', '45° back extension', 'A', 'bodyweight', 'back-extension', 'lower-back glutes', 'hamstrings'],

  // ---- Biceps & forearms ----
  ['bb-curl', 'Barbell curl', 'A', 'barbell-upper', 'elbow-flexion', 'biceps', 'forearms'],
  ['ez-curl', 'EZ-bar curl', 'A', 'barbell-upper', 'elbow-flexion', 'biceps', 'forearms'],
  ['db-curl', 'DB curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['incline-db-curl', 'Incline DB curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['spider-curl', 'Spider curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['hammer-curl', 'Hammer curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps forearms', ''],
  ['preacher-curl', 'Machine preacher curl', 'A', 'machine', 'elbow-flexion', 'biceps', 'forearms'],
  ['cable-curl', 'Cable curl', 'A', 'cable', 'elbow-flexion', 'biceps', 'forearms'],
  ['btb-cable-curl', 'Behind-the-back cable curl', 'A', 'cable', 'elbow-flexion', 'biceps', 'forearms'],
  ['reverse-curl', 'Reverse-grip EZ curl', 'A', 'barbell-upper', 'elbow-flexion', 'forearms biceps', ''],
  ['cross-body-hammer-curl', 'Cross-body hammer curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps forearms', ''],
  ['ez-preacher-curl', 'EZ-bar preacher curl', 'A', 'barbell-upper', 'elbow-flexion', 'biceps', 'forearms'],
  ['db-preacher-curl', 'DB preacher curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['machine-curl', 'Biceps curl machine', 'A', 'machine', 'elbow-flexion', 'biceps', 'forearms'],
  ['concentration-curl', 'Concentration curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps', 'forearms'],
  ['bayesian-curl', 'Bayesian cable curl', 'A', 'cable', 'elbow-flexion', 'biceps', 'forearms'],
  ['rope-hammer-curl', 'Cable rope hammer curl', 'A', 'cable', 'elbow-flexion', 'biceps forearms', ''],
  ['wrist-curl', 'Wrist curl', 'A', 'dumbbell', 'wrist', 'forearms', ''],
  ['reverse-wrist-curl', 'Reverse wrist curl', 'A', 'dumbbell', 'wrist', 'forearms', ''],

  // ---- Triceps ----
  ['skullcrusher', 'Skullcrusher', 'A', 'barbell-upper', 'elbow-extension', 'triceps', ''],
  ['cable-pushdown', 'Cable tricep pushdown', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['cable-tri-ext', 'One-arm cable tricep side extension', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['overhead-cable-ext', 'Overhead cable tricep extension', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['db-overhead-ext', 'DB overhead tricep extension', 'A', 'dumbbell', 'elbow-extension', 'triceps', ''],
  ['db-kickback', 'DB tricep kickback', 'A', 'dumbbell', 'elbow-extension', 'triceps', ''],
  ['machine-dip', 'Machine tricep dip', 'A', 'machine', 'dip', 'triceps', 'chest front-delts'],
  ['rope-pushdown', 'Rope tricep pushdown', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['machine-tri-ext', 'Triceps extension machine', 'A', 'machine', 'elbow-extension', 'triceps', ''],
  ['db-skullcrusher', 'DB skullcrusher', 'A', 'dumbbell', 'elbow-extension', 'triceps', ''],
  ['jm-press', 'JM press', 'A', 'barbell-upper', 'elbow-extension', 'triceps', 'chest'],

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
  ['single-leg-press', 'Single-leg leg press', 'C', 'machine', 'squat', 'quads glutes', 'adductors'],
  ['landmine-squat', 'Landmine squat', 'C', 'barbell-lower', 'squat', 'quads glutes', 'abs upper-back'],
  ['box-squat', 'Box squat', 'C', 'barbell-lower', 'squat', 'glutes quads', 'hamstrings adductors lower-back'],
  ['sissy-squat', 'Sissy squat', 'A', 'bodyweight', 'knee-extension', 'quads', ''],

  // ---- Lunges ----
  ['bulgarian-split-squat', 'Bulgarian split squat', 'C', 'dumbbell', 'lunge', 'quads glutes', 'adductors'],
  ['walking-lunge', 'Walking lunge', 'C', 'dumbbell', 'lunge', 'quads glutes', 'adductors hamstrings'],
  ['reverse-lunge', 'Reverse lunge', 'C', 'dumbbell', 'lunge', 'glutes quads', 'adductors hamstrings'],
  ['step-up', 'DB step-up', 'C', 'dumbbell', 'lunge', 'quads glutes', 'hamstrings'],
  ['smith-split-squat', 'Smith machine split squat', 'C', 'machine', 'lunge', 'quads glutes', 'adductors'],
  ['bb-lunge', 'Barbell reverse lunge', 'C', 'barbell-lower', 'lunge', 'glutes quads', 'adductors hamstrings'],

  // ---- Hinges ----
  ['deadlift', 'Deadlift', 'C', 'barbell-lower', 'hinge', 'glutes hamstrings lower-back', 'quads traps forearms lats'],
  ['sumo-deadlift', 'Sumo deadlift', 'C', 'barbell-lower', 'hinge', 'glutes quads adductors', 'hamstrings lower-back traps'],
  ['trap-bar-deadlift', 'Trap bar deadlift', 'C', 'barbell-lower', 'hinge', 'quads glutes', 'hamstrings lower-back traps'],
  ['rdl', 'Romanian deadlift', 'C', 'barbell-lower', 'hinge', 'hamstrings glutes', 'lower-back forearms'],
  ['db-rdl', 'DB Romanian deadlift', 'C', 'dumbbell', 'hinge', 'hamstrings glutes', 'lower-back forearms'],
  ['single-leg-rdl', 'Single-leg DB RDL', 'C', 'dumbbell', 'hinge', 'hamstrings glutes', 'abductors lower-back'],
  ['good-morning', 'Good morning', 'C', 'barbell-lower', 'hinge', 'hamstrings lower-back', 'glutes'],
  ['rack-pull', 'Rack pull', 'C', 'barbell-lower', 'hinge', 'glutes lower-back', 'hamstrings traps forearms upper-back'],
  ['smith-rdl', 'Smith machine RDL', 'C', 'machine', 'hinge', 'hamstrings glutes', 'lower-back'],
  ['kb-rdl', 'Kettlebell RDL', 'C', 'dumbbell', 'hinge', 'hamstrings glutes', 'lower-back forearms'],
  ['power-clean', 'Power clean', 'C', 'barbell-lower', 'hinge', 'glutes quads traps', 'hamstrings upper-back calves'],

  // ---- Glutes ----
  ['hip-thrust', 'Barbell hip thrust', 'A', 'barbell-lower', 'hip-extension', 'glutes', 'hamstrings'],
  ['machine-hip-thrust', 'Hip thrust machine', 'A', 'machine', 'hip-extension', 'glutes', 'hamstrings'],
  ['glute-bridge', 'Barbell glute bridge', 'A', 'barbell-lower', 'hip-extension', 'glutes', 'hamstrings'],
  ['cable-pull-through', 'Cable pull-through', 'A', 'cable', 'hinge', 'glutes hamstrings', 'lower-back'],
  ['cable-kickback', 'Cable glute kickback', 'A', 'cable', 'hip-extension', 'glutes', 'hamstrings'],
  ['smith-hip-thrust', 'Smith machine hip thrust', 'A', 'machine', 'hip-extension', 'glutes', 'hamstrings'],
  ['db-hip-thrust', 'DB hip thrust', 'A', 'dumbbell', 'hip-extension', 'glutes', 'hamstrings'],
  ['single-leg-hip-thrust', 'Single-leg hip thrust', 'A', 'bodyweight', 'hip-extension', 'glutes', 'hamstrings'],
  ['glute-kickback-machine', 'Glute kickback machine', 'A', 'machine', 'hip-extension', 'glutes', 'hamstrings'],

  // ---- Hamstrings ----
  ['lying-ham-curl', 'Lying hamstring curl', 'A', 'machine', 'knee-flexion', 'hamstrings', 'calves'],
  ['seated-ham-curl', 'Seated hamstring curl', 'A', 'machine', 'knee-flexion', 'hamstrings', 'calves'],
  ['ghr', 'Glute ham raise', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', 'glutes calves'],
  ['nordic-curl', 'Nordic curl', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', 'calves'],
  ['standing-ham-curl', 'Standing leg curl', 'A', 'machine', 'knee-flexion', 'hamstrings', 'calves'],
  ['ball-ham-curl', 'Stability ball leg curl', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', 'glutes calves'],

  // ---- Quads, adductors, abductors ----
  ['leg-extension', 'Leg extension', 'A', 'machine', 'knee-extension', 'quads', ''],
  ['hip-adductor', 'Machine hip adductor', 'A', 'machine', 'hip-adduction', 'adductors', ''],
  ['copenhagen-plank', 'Copenhagen plank', 'A', 'bodyweight', 'hip-adduction', 'adductors', 'obliques'],
  ['hip-abductor', 'Machine hip abductor', 'A', 'machine', 'hip-abduction', 'abductors', 'glutes'],
  ['cable-hip-abduction', 'Cable hip abduction', 'A', 'cable', 'hip-abduction', 'abductors', 'glutes'],

  // ---- Calves ----
  ['standing-calf', 'Standing calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['calf-press', 'Leg press calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['seated-calf', 'Seated calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['smith-calf', 'Smith machine calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['single-leg-calf', 'Single-leg DB calf raise', 'A', 'dumbbell', 'calf-raise', 'calves', ''],
  ['hack-calf', 'Hack squat calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],

  // ---- Core ----
  ['cable-crunch', 'Weighted cable crunch', 'A', 'cable', 'core-flexion', 'abs', 'obliques'],
  ['ab-crunch-machine', 'Ab crunch machine', 'A', 'machine', 'core-flexion', 'abs', 'obliques'],
  ['ball-crunch', 'Exercise ball crunch (weighted)', 'A', 'dumbbell', 'core-flexion', 'abs', 'obliques'],
  ['decline-situp', 'Weighted decline sit-up', 'A', 'bodyweight', 'core-flexion', 'abs', 'hip-flexors obliques'],
  ['hanging-leg-raise', 'Hanging leg raise', 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'obliques forearms'],
  ['vertical-leg-raise', "Captain's chair leg raise", 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'obliques'],
  ['leg-raise', 'Leg raise', 'A', 'bodyweight', 'hip-flexion', 'abs', 'hip-flexors'],
  ['ab-wheel', 'Ab wheel rollout', 'A', 'bodyweight', 'anti-extension', 'abs', 'lats obliques'],
  ['pallof-press', 'Pallof press', 'A', 'cable', 'anti-rotation', 'obliques', 'abs'],
  ['dead-bug', 'Dead bug', 'A', 'bodyweight', 'anti-extension', 'abs', 'hip-flexors obliques'],
  ['bird-dog', 'Bird dog', 'A', 'bodyweight', 'anti-rotation', 'lower-back glutes', 'abs obliques'],
  ['mcgill-curl-up', 'McGill curl-up', 'A', 'bodyweight', 'core-flexion', 'abs', 'obliques'],
  ['hollow-hold', 'Hollow body hold', 'A', 'bodyweight', 'anti-extension', 'abs', 'hip-flexors', 'time'],
  ['weighted-plank', 'Weighted plank', 'A', 'bodyweight', 'anti-extension', 'abs', 'obliques front-delts', 'time'],
  ['suitcase-carry', 'Suitcase carry', 'A', 'dumbbell', 'anti-lateral', 'obliques', 'forearms traps abs', 'distance'],
  ['landmine-rotation', 'Landmine rotation', 'A', 'barbell-upper', 'rotation', 'obliques', 'abs front-delts'],
  ['cable-woodchop', 'Cable woodchop', 'A', 'cable', 'rotation', 'obliques', 'abs'],
  ['hanging-knee-raise', 'Hanging knee raise', 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'obliques forearms'],
  ['situp', 'Sit-up', 'A', 'bodyweight', 'core-flexion', 'abs', 'hip-flexors obliques'],
  ['russian-twist', 'Russian twist', 'A', 'bodyweight', 'rotation', 'obliques', 'abs'],
  ['db-side-bend', 'DB side bend', 'A', 'dumbbell', 'anti-lateral', 'obliques', 'abs'],
  ['cable-oblique-crunch', 'Cable oblique crunch', 'A', 'cable', 'rotation', 'obliques', 'abs'],

  // ---- Full body ----
  ['farmers-carry', "Farmer's carry", 'C', 'dumbbell', 'carry', 'forearms traps', 'abs glutes', 'distance'],

  // ---- Conditioning (category X): sprints, ergs, plyometrics, circuit moves ----
  // 8th field = how a set is measured (time | distance | cal | reps).
  ['run-sprint', 'Sprint', 'X', 'bodyweight', 'sprint', 'hamstrings glutes', 'quads calves hip-flexors', 'distance'],
  ['hill-sprint', 'Hill sprint', 'X', 'bodyweight', 'sprint', 'glutes hamstrings', 'calves quads', 'time'],
  ['run-interval', 'Run interval', 'X', 'bodyweight', 'sprint', 'quads calves', 'hamstrings glutes hip-flexors', 'time'],
  ['bike-sprint', 'Bike sprint', 'X', 'machine', 'erg', 'quads glutes', 'hamstrings calves', 'time'],
  ['bike-interval', 'Bike interval', 'X', 'machine', 'erg', 'quads', 'glutes calves', 'time'],
  ['row-interval', 'Rower interval', 'X', 'machine', 'erg', 'lats upper-back quads', 'glutes hamstrings biceps', 'distance'],
  ['ski-interval', 'SkiErg interval', 'X', 'machine', 'erg', 'lats triceps', 'abs upper-back', 'time'],
  ['assault-bike-cal', 'Air bike calories', 'X', 'machine', 'erg', 'quads front-delts', 'glutes lats triceps', 'cal'],
  ['sled-push', 'Sled push', 'X', 'machine', 'carry', 'quads glutes', 'calves', 'distance'],
  ['jump-rope', 'Jump rope', 'X', 'bodyweight', 'plyo', 'calves', 'front-delts', 'time'],
  ['box-jump', 'Box jump', 'X', 'bodyweight', 'plyo', 'quads glutes', 'calves hamstrings', 'reps'],
  ['broad-jump', 'Broad jump', 'X', 'bodyweight', 'plyo', 'glutes quads', 'hamstrings calves', 'reps'],
  ['squat-jump', 'Squat jump', 'X', 'bodyweight', 'plyo', 'quads glutes', 'calves', 'reps'],
  ['lateral-bound', 'Lateral bound', 'X', 'bodyweight', 'plyo', 'glutes abductors', 'quads calves', 'reps'],
  ['pogo-hop', 'Pogo hops', 'X', 'bodyweight', 'plyo', 'calves', 'quads', 'time'],
  ['burpee', 'Burpee', 'X', 'bodyweight', 'circuit-move', 'chest quads', 'front-delts triceps abs', 'reps'],
  ['mountain-climber', 'Mountain climber', 'X', 'bodyweight', 'circuit-move', 'abs hip-flexors', 'front-delts quads', 'time'],
  ['jumping-jack', 'Jumping jacks', 'X', 'bodyweight', 'circuit-move', 'calves', 'side-delts hip-flexors', 'time'],
  ['high-knees', 'High knees', 'X', 'bodyweight', 'circuit-move', 'hip-flexors', 'quads calves abs', 'time'],
  ['air-squat', 'Air squat', 'X', 'bodyweight', 'circuit-move', 'quads glutes', 'adductors', 'reps'],
  ['bodyweight-lunge', 'Walking lunge (bodyweight)', 'X', 'bodyweight', 'circuit-move', 'quads glutes', 'adductors hamstrings', 'reps'],
  ['wall-sit', 'Wall sit', 'X', 'bodyweight', 'isometric', 'quads', 'glutes', 'time'],
  ['plank', 'Plank', 'X', 'bodyweight', 'isometric', 'abs', 'front-delts obliques', 'time'],
  ['side-plank', 'Side plank', 'X', 'bodyweight', 'isometric', 'obliques', 'abs abductors', 'time'],
  ['crunch', 'Crunch', 'X', 'bodyweight', 'circuit-move', 'abs', 'obliques', 'reps'],
  ['bench-dip', 'Bench dip', 'X', 'bodyweight', 'circuit-move', 'triceps', 'chest front-delts', 'reps'],
  ['pushup-rotation', 'Push-up with rotation', 'X', 'bodyweight', 'circuit-move', 'chest obliques', 'front-delts triceps', 'reps'],
  ['step-up-bw', 'Step-up (bodyweight)', 'X', 'bodyweight', 'circuit-move', 'quads glutes', 'calves', 'reps'],
  ['kb-swing', 'Kettlebell swing', 'X', 'dumbbell', 'hinge', 'glutes hamstrings', 'lower-back forearms upper-back', 'reps'],
  ['db-thruster', 'Dumbbell thruster', 'X', 'dumbbell', 'circuit-move', 'quads front-delts', 'glutes triceps', 'reps'],
  ['wall-ball', 'Wall ball', 'X', 'dumbbell', 'circuit-move', 'quads front-delts', 'glutes triceps', 'reps'],
  ['med-ball-slam', 'Medicine ball slam', 'X', 'dumbbell', 'circuit-move', 'lats abs', 'front-delts triceps', 'reps'],
  ['battle-ropes', 'Battle ropes', 'X', 'bodyweight', 'circuit-move', 'front-delts', 'forearms abs', 'time'],

  // ---- Running-goal workouts ----
  ['run-repeat', 'Run repeats', 'X', 'bodyweight', 'run', 'quads calves hamstrings', 'glutes hip-flexors', 'distance'],
  ['run-tempo', 'Tempo run', 'X', 'bodyweight', 'run', 'quads calves', 'hamstrings glutes hip-flexors', 'time'],
  ['run-easy', 'Easy run', 'X', 'bodyweight', 'run', 'calves', 'quads hamstrings', 'time'],
  ['run-long', 'Long run', 'X', 'bodyweight', 'run', 'calves quads', 'hamstrings glutes', 'time'],
  ['run-5k', '5k time trial', 'X', 'bodyweight', 'run', 'quads calves hamstrings', 'glutes hip-flexors', 'distance'],

  // ---- Warm-up and physical-therapy style drills (no training fatigue) ----
  ['warmup-cardio', 'Easy cardio', 'X', 'bodyweight', 'prehab', 'quads calves', '', 'time'],
  ['leg-swing', 'Leg swings', 'X', 'bodyweight', 'prehab', 'hip-flexors hamstrings', 'glutes', 'reps'],
  ['arm-circle', 'Arm circles', 'X', 'bodyweight', 'prehab', 'front-delts side-delts', 'rear-delts', 'time'],
  ['band-pull-apart', 'Band pull-apart', 'X', 'bodyweight', 'prehab', 'rear-delts upper-back', 'traps', 'reps'],
  ['scap-pushup', 'Scapular pushup', 'X', 'bodyweight', 'prehab', 'upper-back', 'chest front-delts', 'reps'],
  ['band-external-rotation', 'Band external rotation', 'X', 'bodyweight', 'prehab', 'rear-delts', 'upper-back', 'reps'],
  ['spanish-squat-hold', 'Spanish squat hold', 'X', 'bodyweight', 'prehab', 'quads', 'glutes', 'time'],
  ['tke', 'Terminal knee extension (band)', 'X', 'bodyweight', 'prehab', 'quads', '', 'reps'],
  ['glute-bridge', 'Glute bridge', 'X', 'bodyweight', 'prehab', 'glutes', 'hamstrings', 'reps'],
  ['clamshell', 'Clamshell', 'X', 'bodyweight', 'prehab', 'abductors glutes', '', 'reps'],
  ['wrist-ext-eccentric', 'Slow wrist extension lowering', 'X', 'dumbbell', 'prehab', 'forearms', '', 'reps'],
  ['forearm-stretch', 'Forearm stretch', 'X', 'bodyweight', 'prehab', 'forearms', '', 'time'],
  ['wrist-circle', 'Wrist circles', 'X', 'bodyweight', 'prehab', 'forearms', '', 'time'],
  ['calf-raise-slow', 'Slow calf raise', 'X', 'bodyweight', 'prehab', 'calves', '', 'reps'],
  ['chin-tuck', 'Chin tuck', 'X', 'bodyweight', 'prehab', 'traps', '', 'reps'],
  ['lateral-band-walk', 'Lateral band walk', 'X', 'bodyweight', 'prehab', 'abductors glutes', '', 'reps'],
  ['scap-pull', 'Scapular pull-up', 'X', 'bodyweight', 'prehab', 'lats upper-back', 'traps', 'reps'],

  // ---- Recovery: stretching and foam rolling (timed holds, no training fatigue) ----
  ['roll-quads', 'Foam roll quads', 'X', 'bodyweight', 'mobility', 'quads', '', 'time'],
  ['roll-hamstrings', 'Foam roll hamstrings and calves', 'X', 'bodyweight', 'mobility', 'hamstrings calves', '', 'time'],
  ['roll-glutes', 'Foam roll glutes', 'X', 'bodyweight', 'mobility', 'glutes', '', 'time'],
  ['roll-upper-back', 'Foam roll upper back', 'X', 'bodyweight', 'mobility', 'upper-back', 'traps', 'time'],
  ['roll-lats', 'Foam roll lats', 'X', 'bodyweight', 'mobility', 'lats', '', 'time'],
  ['stretch-couch', 'Couch stretch (hip flexors)', 'X', 'bodyweight', 'mobility', 'hip-flexors quads', '', 'time'],
  ['stretch-hamstring', 'Hamstring stretch', 'X', 'bodyweight', 'mobility', 'hamstrings', '', 'time'],
  ['stretch-pigeon', 'Pigeon stretch', 'X', 'bodyweight', 'mobility', 'glutes', 'hip-flexors', 'time'],
  ['stretch-calf', 'Calf stretch', 'X', 'bodyweight', 'mobility', 'calves', '', 'time'],
  ['stretch-9090', '90/90 hip switches', 'X', 'bodyweight', 'mobility', 'glutes adductors', 'hip-flexors', 'time'],
  ['stretch-chest', 'Doorway chest stretch', 'X', 'bodyweight', 'mobility', 'chest', 'front-delts', 'time'],
  ['stretch-child', "Child's pose with reach", 'X', 'bodyweight', 'mobility', 'lats', 'lower-back', 'time'],
  ['stretch-thread', 'Thread the needle', 'X', 'bodyweight', 'mobility', 'upper-back', 'rear-delts', 'time'],
  ['stretch-catcow', 'Cat-cow', 'X', 'bodyweight', 'mobility', 'lower-back', 'abs', 'time'],
  ['stretch-wgs', "World's greatest stretch", 'X', 'bodyweight', 'mobility', 'hip-flexors glutes', 'upper-back hamstrings', 'time'],
  ['stretch-crossbody', 'Cross-body shoulder stretch', 'X', 'bodyweight', 'mobility', 'rear-delts', 'side-delts', 'time'],
  ['dead-hang', 'Dead hang', 'X', 'bodyweight', 'mobility', 'lats forearms', 'upper-back', 'time'],
];

// What each exercise needs beyond its broad type (keys from GEAR in gym.js). Missing gear hides it.
const NEEDS = {
  'bench-press': 'rack bench', 'incline-bench': 'rack incline-bench', 'decline-bench': 'incline-bench', 'close-grip-bench': 'rack bench',
  'db-bench': 'bench', 'db-incline-bench': 'incline-bench', 'db-decline-bench': 'incline-bench', 'smith-incline': 'smith incline-bench', 'smith-bench': 'smith bench',
  'machine-chest-press': 'chest-press', 'incline-machine-press': 'chest-press', 'plate-chest-press': 'chest-press',
  dip: 'dip-station', 'weighted-dip': 'dip-station dip-belt', 'assisted-dip': 'assisted-pullup',
  'machine-fly': 'pec-deck', 'cable-fly': 'cable-tower', 'low-high-cable-fly': 'cable-tower', 'high-low-cable-fly': 'cable-tower', 'db-fly': 'bench', 'db-incline-fly': 'incline-bench',
  ohp: 'rack', 'seated-ohp': 'rack incline-bench', 'push-press': 'rack', 'smith-ohp': 'smith incline-bench', 'db-shoulder-press': 'incline-bench', 'arnold-press': 'incline-bench',
  'machine-shoulder-press': 'shoulder-press', 'landmine-press': 'landmine', 'cable-lat-raise': 'cable-tower', 'machine-lat-raise': 'lat-raise-machine',
  'upright-row': 'cable-tower', 'cable-y-raise': 'cable-tower', 'cable-front-raise': 'cable-tower', 'rear-delt-fly': 'pec-deck', 'cable-rear-delt-fly': 'cable-tower', 'face-pull': 'cable-tower',
  pullup: 'pullup-bar', chinup: 'pullup-bar', 'neutral-pullup': 'pullup-bar', 'weighted-pullup': 'pullup-bar dip-belt', 'weighted-chinup': 'pullup-bar dip-belt', 'weighted-neutral-pullup': 'pullup-bar dip-belt',
  'assisted-pullup': 'assisted-pullup', 'lat-pulldown': 'lat-pulldown', 'close-grip-pulldown': 'lat-pulldown', 'underhand-pulldown': 'lat-pulldown', 'wide-grip-pulldown': 'lat-pulldown',
  'single-arm-pulldown': 'cable-tower', 'machine-pulldown': 'plate-pulldown',
  't-bar-row': 'landmine', 'meadows-row': 'landmine', 'db-row': 'bench', 'chest-supported-db-row': 'incline-bench', 'seal-row': 'bench', 'cable-row': 'cable-row', 'single-arm-cable-row': 'cable-tower',
  'iso-row': 'plate-row', 'machine-row': 'machine-row', 'chest-supported-tbar': 'tbar', 'smith-row': 'smith', 'inverted-row': 'rack',
  'straight-arm-pulldown': 'cable-tower', 'db-pullover': 'bench', 'machine-pullover': 'pullover-machine', 'smith-shrug': 'smith', 'trap-bar-shrug': 'trap-bar',
  'back-extension': 'back-ext', 'reverse-hyper': 'reverse-hyper',
  'ez-curl': 'ez-bar', 'reverse-curl': 'ez-bar', 'ez-preacher-curl': 'ez-bar preacher-bench', 'db-preacher-curl': 'preacher-bench', 'preacher-curl': 'preacher-bench',
  'incline-db-curl': 'incline-bench', 'spider-curl': 'incline-bench', 'machine-curl': 'curl-machine', 'cable-curl': 'cable-tower', 'btb-cable-curl': 'cable-tower', 'bayesian-curl': 'cable-tower', 'rope-hammer-curl': 'cable-tower',
  skullcrusher: 'bench', 'db-skullcrusher': 'bench', 'jm-press': 'bench', 'cable-pushdown': 'cable-tower', 'rope-pushdown': 'cable-tower', 'cable-tri-ext': 'cable-tower', 'overhead-cable-ext': 'cable-tower',
  'machine-dip': 'tri-machine', 'machine-tri-ext': 'tri-machine',
  'back-squat': 'rack', 'front-squat': 'rack', 'box-squat': 'rack box', 'safety-bar-squat': 'rack safety-bar', 'landmine-squat': 'landmine',
  'hack-squat': 'hack-squat', 'pendulum-squat': 'pendulum', 'smith-squat': 'smith', 'leg-press': 'leg-press', 'single-leg-press': 'leg-press', 'belt-squat': 'belt-squat',
  'bulgarian-split-squat': 'bench', 'step-up': 'box', 'smith-split-squat': 'smith', 'bb-lunge': 'rack',
  'trap-bar-deadlift': 'trap-bar', 'good-morning': 'rack', 'rack-pull': 'rack', 'smith-rdl': 'smith', 'kb-rdl': 'kettlebell',
  'hip-thrust': 'bench', 'smith-hip-thrust': 'smith bench', 'db-hip-thrust': 'bench', 'single-leg-hip-thrust': 'bench', 'machine-hip-thrust': 'hip-thrust-machine', 'glute-kickback-machine': 'glute-kick',
  'cable-pull-through': 'cable-tower', 'cable-kickback': 'cable-tower',
  'lying-ham-curl': 'lying-curl', 'seated-ham-curl': 'seated-curl', 'standing-ham-curl': 'standing-curl', ghr: 'back-ext', 'ball-ham-curl': 'stability-ball',
  'leg-extension': 'leg-ext', 'hip-adductor': 'hip-machine', 'hip-abductor': 'hip-machine', 'cable-hip-abduction': 'cable-tower',
  'standing-calf': 'standing-calf', 'calf-press': 'leg-press', 'hack-calf': 'hack-squat', 'seated-calf': 'seated-calf', 'smith-calf': 'smith',
  'cable-crunch': 'cable-tower', 'ab-crunch-machine': 'ab-machine', 'ball-crunch': 'stability-ball', 'decline-situp': 'incline-bench',
  'hanging-leg-raise': 'pullup-bar', 'hanging-knee-raise': 'pullup-bar', 'vertical-leg-raise': 'dip-station', 'ab-wheel': 'ab-wheel',
  'pallof-press': 'cable-tower', 'landmine-rotation': 'landmine', 'cable-woodchop': 'cable-tower', 'cable-oblique-crunch': 'cable-tower',
  'bike-sprint': 'bike', 'bike-interval': 'bike', 'row-interval': 'rower', 'ski-interval': 'ski-erg', 'assault-bike-cal': 'air-bike', 'sled-push': 'sled',
  'jump-rope': 'jump-rope', 'box-jump': 'box', 'kb-swing': 'kettlebell', 'wall-ball': 'med-ball', 'med-ball-slam': 'med-ball', 'battle-ropes': 'battle-ropes',
  'band-pull-apart': 'bands', 'band-external-rotation': 'bands', tke: 'bands', 'lateral-band-walk': 'bands',
  'roll-quads': 'foam-roller', 'roll-hamstrings': 'foam-roller', 'roll-glutes': 'foam-roller', 'roll-upper-back': 'foam-roller', 'roll-lats': 'foam-roller',
  'dead-hang': 'pullup-bar', 'scap-pull': 'pullup-bar',
};
// Old names, so exercises keep up with renames unless the user renamed them.
const RENAMED = {
  'hip-thrust': ['Barbell hip thrust (Smith bar + bench)'], 'iso-row': ['Hammer Strength iso row'], 'machine-pulldown': ['Machine pulldown (Hammer Strength)'],
  'hammer-curl': ['Hammer curl / cross-body hammer curl'], 'machine-fly': ['Machine fly'], 'rear-delt-fly': ['Machine rear delt fly'], 'calf-press': ['Calf press'],
  'preacher-curl': ['Preacher curl'], 'vertical-leg-raise': ['Vertical leg raise'], 'assisted-pullup': ['Assisted pullup machine'],
};

const split = (s) => (s ? s.split(' ') : []);

export const BANK = Object.fromEntries(RAW.map(([id, name, cat, type, pattern, primary, secondary, metric]) => [id, {
  id, name, type, pattern, metric: metric || 'reps', needs: split(NEEDS[id]),
  category: cat === 'C' ? 'compound' : cat === 'X' ? 'conditioning' : 'accessory',
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
        category: b.category, pattern: b.pattern, metric: b.metric, primary: [...b.primary], secondary: [...b.secondary], needs: [...b.needs],
      };
    } else if (!ex.customMeta) {
      if (RENAMED[b.id]?.includes(ex.name)) ex.name = b.name;
      Object.assign(ex, { category: b.category, pattern: b.pattern, metric: b.metric, primary: [...b.primary], secondary: [...b.secondary] });
    }
    if (ex) ex.needs = [...b.needs]; // equipment needs always follow the bank
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
