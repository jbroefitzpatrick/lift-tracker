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
  ['copenhagen-plank', 'Copenhagen plank', 'A', 'bodyweight', 'hip-adduction', 'adductors', 'obliques', 'time'],
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

  // ---- More lifts ----
  ['incline-cable-fly', 'Incline cable fly', 'A', 'cable', 'chest-fly', 'chest front-delts', ''],
  ['db-squeeze-press', 'DB squeeze press', 'C', 'dumbbell', 'horizontal-push', 'chest triceps', 'front-delts'],
  ['incline-pushup', 'Incline pushup', 'C', 'bodyweight', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['decline-pushup', 'Decline pushup', 'C', 'bodyweight', 'incline-push', 'chest front-delts', 'triceps'],
  ['deficit-pushup', 'Deficit pushup', 'C', 'bodyweight', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['diamond-pushup', 'Diamond pushup', 'C', 'bodyweight', 'horizontal-push', 'triceps chest', 'front-delts'],
  ['z-press', 'Z press', 'C', 'barbell-upper', 'vertical-push', 'front-delts', 'triceps side-delts abs'],
  ['seated-db-lat-raise', 'Seated DB lateral raise', 'A', 'dumbbell', 'lateral-raise', 'side-delts', 'traps'],
  ['incline-y-raise', 'Incline DB Y-raise', 'A', 'dumbbell', 'lateral-raise', 'side-delts traps', 'rear-delts'],
  ['plate-front-raise', 'Plate front raise', 'A', 'barbell-upper', 'front-raise', 'front-delts', 'side-delts'],
  ['band-face-pull', 'Band face pull', 'A', 'bodyweight', 'rear-delt', 'rear-delts upper-back', 'traps'],
  ['cable-shrug', 'Cable shrug', 'A', 'cable', 'shrug', 'traps', 'forearms'],
  ['yates-row', 'Underhand barbell row', 'C', 'barbell-upper', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts lower-back'],
  ['low-row-machine', 'Low row (plate-loaded)', 'C', 'machine', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['renegade-row', 'Renegade row', 'C', 'dumbbell', 'horizontal-pull', 'upper-back lats', 'abs obliques biceps'],
  ['band-assisted-pullup', 'Band-assisted pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['negative-pullup', 'Negative pullup', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['weighted-back-ext', 'Weighted back extension', 'A', 'bodyweight', 'back-extension', 'lower-back glutes', 'hamstrings'],
  ['superman', 'Superman hold', 'A', 'bodyweight', 'back-extension', 'lower-back', 'glutes upper-back', 'time'],
  ['zottman-curl', 'Zottman curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps forearms', ''],
  ['drag-curl', 'Drag curl', 'A', 'barbell-upper', 'elbow-flexion', 'biceps', 'forearms'],
  ['cable-preacher-curl', 'Cable preacher curl', 'A', 'cable', 'elbow-flexion', 'biceps', 'forearms'],
  ['cable-kickback-tri', 'Cable tricep kickback', 'A', 'cable', 'elbow-extension', 'triceps', ''],
  ['reverse-pushdown', 'Reverse-grip pushdown', 'A', 'cable', 'elbow-extension', 'triceps', 'forearms'],
  ['tate-press', 'Tate press', 'A', 'dumbbell', 'elbow-extension', 'triceps', 'chest'],
  ['plate-pinch', 'Plate pinch hold', 'A', 'barbell-upper', 'isometric', 'forearms', '', 'time'],
  ['ffe-split-squat', 'Front-foot elevated split squat', 'C', 'dumbbell', 'lunge', 'quads glutes', 'adductors'],
  ['lateral-lunge', 'Lateral lunge', 'C', 'dumbbell', 'lunge', 'adductors glutes quads', ''],
  ['curtsy-lunge', 'Curtsy lunge', 'C', 'dumbbell', 'lunge', 'glutes quads', 'abductors adductors'],
  ['cossack-squat', 'Cossack squat', 'C', 'bodyweight', 'lunge', 'adductors quads glutes', ''],
  ['zercher-squat', 'Zercher squat', 'C', 'barbell-lower', 'squat', 'quads glutes', 'upper-back abs adductors'],
  ['pause-squat', 'Pause back squat', 'C', 'barbell-lower', 'squat', 'quads glutes', 'adductors lower-back'],
  ['deficit-deadlift', 'Deficit deadlift', 'C', 'barbell-lower', 'hinge', 'glutes hamstrings lower-back', 'quads traps forearms'],
  ['stiff-leg-deadlift', 'Stiff-leg deadlift', 'C', 'barbell-lower', 'hinge', 'hamstrings glutes', 'lower-back'],
  ['b-stance-rdl', 'B-stance DB RDL', 'C', 'dumbbell', 'hinge', 'hamstrings glutes', 'lower-back'],
  ['frog-pump', 'Frog pump', 'A', 'bodyweight', 'hip-extension', 'glutes', ''],
  ['side-lying-abduction', 'Side-lying hip abduction', 'A', 'bodyweight', 'hip-abduction', 'abductors', 'glutes'],
  ['band-seated-abduction', 'Banded seated hip abduction', 'A', 'bodyweight', 'hip-abduction', 'abductors', 'glutes'],
  ['reverse-nordic', 'Reverse Nordic', 'A', 'bodyweight', 'knee-extension', 'quads', 'hip-flexors'],
  ['tibialis-raise', 'Tibialis raise', 'A', 'bodyweight', 'calf-raise', 'calves', ''],
  ['seated-db-calf', 'Seated DB calf raise', 'A', 'dumbbell', 'calf-raise', 'calves', ''],
  ['bicycle-crunch', 'Bicycle crunch', 'A', 'bodyweight', 'rotation', 'abs obliques', 'hip-flexors'],
  ['reverse-crunch', 'Reverse crunch', 'A', 'bodyweight', 'hip-flexion', 'abs', 'hip-flexors'],
  ['v-up', 'V-up', 'A', 'bodyweight', 'core-flexion', 'abs hip-flexors', ''],
  ['toes-to-bar', 'Toes to bar', 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'lats forearms obliques'],
  ['stir-the-pot', 'Stir the pot', 'A', 'bodyweight', 'anti-extension', 'abs', 'obliques'],
  ['plank-shoulder-tap', 'Plank shoulder taps', 'A', 'bodyweight', 'anti-rotation', 'abs obliques', 'front-delts'],
  ['decline-crunch', 'Decline crunch', 'A', 'bodyweight', 'core-flexion', 'abs', 'obliques'],
  ['barbell-rollout', 'Barbell rollout', 'A', 'barbell-upper', 'anti-extension', 'abs', 'lats obliques'],
  ['overhead-carry', 'Overhead carry', 'A', 'dumbbell', 'carry', 'front-delts abs', 'traps obliques', 'distance'],
  ['body-saw', 'Body saw', 'A', 'bodyweight', 'anti-extension', 'abs', 'front-delts'],
  ['side-plank-dip', 'Side plank hip dip', 'A', 'bodyweight', 'anti-lateral', 'obliques', 'abs'],
  ['hanging-oblique-raise', 'Hanging oblique knee raise', 'A', 'bodyweight', 'hip-flexion', 'obliques abs', 'hip-flexors'],

  // ---- Equipment variety ----
  ['cable-chest-press', 'Standing cable chest press', 'C', 'cable', 'horizontal-push', 'chest', 'front-delts triceps'],
  ['suspension-pushup', 'Suspension pushup', 'C', 'bodyweight', 'horizontal-push', 'chest', 'front-delts triceps abs'],
  ['db-single-arm-press', 'Single-arm DB shoulder press', 'C', 'dumbbell', 'vertical-push', 'front-delts', 'triceps side-delts abs'],
  ['kb-press', 'Kettlebell overhead press', 'C', 'dumbbell', 'vertical-push', 'front-delts', 'triceps side-delts abs'],
  ['pike-pushup', 'Pike pushup', 'C', 'bodyweight', 'vertical-push', 'front-delts triceps', 'side-delts'],
  ['band-lat-raise', 'Band lateral raise', 'A', 'bodyweight', 'lateral-raise', 'side-delts', 'traps'],
  ['db-rear-delt-row', 'Chest-supported rear delt row', 'A', 'dumbbell', 'rear-delt', 'rear-delts upper-back', 'traps'],
  ['band-lat-pulldown', 'Band lat pulldown', 'C', 'bodyweight', 'vertical-pull', 'lats', 'biceps upper-back'],
  ['band-row', 'Band row', 'C', 'bodyweight', 'horizontal-pull', 'upper-back lats', 'biceps rear-delts'],
  ['suspension-row', 'Suspension row', 'C', 'bodyweight', 'horizontal-pull', 'upper-back lats', 'biceps rear-delts abs'],
  ['kb-row', 'Kettlebell row', 'C', 'dumbbell', 'horizontal-pull', 'lats upper-back', 'biceps rear-delts'],
  ['wide-cable-row', 'Wide-grip cable row', 'C', 'cable', 'horizontal-pull', 'upper-back rear-delts', 'lats biceps'],
  ['bb-pullover', 'Barbell pullover', 'A', 'barbell-upper', 'pullover', 'lats chest', 'triceps'],
  ['back-ext-machine', 'Back extension machine', 'A', 'machine', 'back-extension', 'lower-back', 'glutes hamstrings'],
  ['band-good-morning', 'Band good morning', 'C', 'bodyweight', 'hinge', 'hamstrings lower-back', 'glutes'],
  ['band-curl', 'Band curl', 'A', 'bodyweight', 'elbow-flexion', 'biceps', 'forearms'],
  ['kb-curl', 'Kettlebell curl', 'A', 'dumbbell', 'elbow-flexion', 'biceps forearms', ''],
  ['bb-wrist-curl', 'Barbell wrist curl', 'A', 'barbell-upper', 'wrist', 'forearms', ''],
  ['cable-wrist-curl', 'Cable wrist curl', 'A', 'cable', 'wrist', 'forearms', ''],
  ['band-pushdown', 'Band tricep pushdown', 'A', 'bodyweight', 'elbow-extension', 'triceps', ''],
  ['ez-overhead-ext', 'EZ-bar overhead tricep extension', 'A', 'barbell-upper', 'elbow-extension', 'triceps', ''],
  ['db-squat', 'DB squat', 'C', 'dumbbell', 'squat', 'quads glutes', 'adductors'],
  ['db-sumo-squat', 'DB sumo squat', 'C', 'dumbbell', 'squat', 'adductors glutes quads', ''],
  ['kb-goblet-squat', 'Kettlebell goblet squat', 'C', 'dumbbell', 'squat', 'quads glutes', 'abs upper-back'],
  ['v-squat', 'V-squat machine', 'C', 'machine', 'squat', 'quads glutes', 'adductors'],
  ['single-leg-extension', 'Single-leg leg extension', 'A', 'machine', 'knee-extension', 'quads', ''],
  ['bb-walking-lunge', 'Barbell walking lunge', 'C', 'barbell-lower', 'lunge', 'quads glutes', 'adductors hamstrings'],
  ['bb-split-squat', 'Barbell split squat', 'C', 'barbell-lower', 'lunge', 'quads glutes', 'adductors'],
  ['bw-split-squat', 'Bodyweight split squat', 'C', 'bodyweight', 'lunge', 'quads glutes', 'adductors'],
  ['kb-deadlift', 'Kettlebell deadlift', 'C', 'dumbbell', 'hinge', 'glutes hamstrings', 'lower-back quads'],
  ['db-deadlift', 'DB deadlift', 'C', 'dumbbell', 'hinge', 'glutes hamstrings', 'lower-back quads forearms'],
  ['trap-bar-rdl', 'Trap bar RDL', 'C', 'barbell-lower', 'hinge', 'hamstrings glutes', 'lower-back forearms'],
  ['snatch-grip-deadlift', 'Snatch-grip deadlift', 'C', 'barbell-lower', 'hinge', 'glutes hamstrings upper-back', 'lower-back traps quads forearms'],
  ['band-pull-through', 'Band pull-through', 'C', 'bodyweight', 'hinge', 'glutes hamstrings', 'lower-back'],
  ['bb-glute-bridge', 'Barbell glute bridge', 'A', 'barbell-lower', 'hip-extension', 'glutes', 'hamstrings'],
  ['db-glute-bridge', 'DB glute bridge', 'A', 'dumbbell', 'hip-extension', 'glutes', 'hamstrings'],
  ['single-leg-glute-bridge', 'Single-leg glute bridge', 'A', 'bodyweight', 'hip-extension', 'glutes', 'hamstrings'],
  ['band-hip-thrust', 'Banded hip thrust', 'A', 'bodyweight', 'hip-extension', 'glutes', 'hamstrings abductors'],
  ['kb-hip-thrust', 'Kettlebell hip thrust', 'A', 'dumbbell', 'hip-extension', 'glutes', 'hamstrings'],
  ['cable-leg-curl', 'Standing cable leg curl', 'A', 'cable', 'knee-flexion', 'hamstrings', 'calves'],
  ['slider-leg-curl', 'Slider leg curl', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', 'glutes'],
  ['db-leg-curl', 'DB lying leg curl', 'A', 'dumbbell', 'knee-flexion', 'hamstrings', 'calves'],
  ['band-leg-curl', 'Band leg curl', 'A', 'bodyweight', 'knee-flexion', 'hamstrings', ''],
  ['cable-adduction', 'Cable hip adduction', 'A', 'cable', 'hip-adduction', 'adductors', ''],
  ['side-lying-adduction', 'Side-lying hip adduction', 'A', 'bodyweight', 'hip-adduction', 'adductors', ''],
  ['bb-calf-raise', 'Standing barbell calf raise', 'A', 'barbell-lower', 'calf-raise', 'calves', ''],
  ['donkey-calf', 'Donkey calf raise', 'A', 'machine', 'calf-raise', 'calves', ''],
  ['bw-calf-raise', 'Single-leg calf raise', 'A', 'bodyweight', 'calf-raise', 'calves', ''],
  ['plate-crunch', 'Weighted crunch', 'A', 'barbell-upper', 'core-flexion', 'abs', 'obliques'],
  ['ball-pike', 'Stability ball pike', 'A', 'bodyweight', 'hip-flexion', 'abs hip-flexors', 'front-delts'],
  ['ball-rollout', 'Stability ball rollout', 'A', 'bodyweight', 'anti-extension', 'abs', 'lats obliques'],
  ['band-pallof', 'Band Pallof press', 'A', 'bodyweight', 'anti-rotation', 'obliques', 'abs'],
  ['band-woodchop', 'Band woodchop', 'A', 'bodyweight', 'rotation', 'obliques', 'abs'],
  ['suitcase-deadlift', 'Suitcase deadlift', 'C', 'dumbbell', 'anti-lateral', 'obliques glutes', 'hamstrings forearms'],
  ['trap-bar-carry', 'Trap bar carry', 'C', 'barbell-lower', 'carry', 'forearms traps', 'abs glutes quads', 'distance'],
  ['kb-rack-carry', 'Kettlebell front rack carry', 'A', 'dumbbell', 'carry', 'abs', 'front-delts upper-back forearms', 'distance'],

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
  ['kb-clean', 'Kettlebell clean', 'X', 'dumbbell', 'hinge', 'glutes hamstrings', 'forearms upper-back traps', 'reps'],
  ['kb-snatch', 'Kettlebell snatch', 'X', 'dumbbell', 'hinge', 'glutes front-delts', 'hamstrings traps', 'reps'],
  ['tuck-jump', 'Tuck jump', 'X', 'bodyweight', 'plyo', 'quads glutes', 'calves abs', 'reps'],
  ['skater-jump', 'Skater jump', 'X', 'bodyweight', 'plyo', 'glutes abductors', 'quads calves', 'reps'],
  ['shuttle-run', 'Shuttle run', 'X', 'bodyweight', 'sprint', 'quads hamstrings', 'calves glutes', 'distance'],
  ['bear-crawl', 'Bear crawl', 'X', 'bodyweight', 'circuit-move', 'abs front-delts quads', '', 'distance'],
  ['stair-climber', 'Stair climber', 'X', 'machine', 'erg', 'glutes quads', 'calves', 'time'],
  ['elliptical-interval', 'Elliptical interval', 'X', 'machine', 'erg', 'quads glutes', 'calves', 'time'],
  ['incline-walk', 'Incline treadmill walk', 'X', 'machine', 'erg', 'calves glutes', 'hamstrings', 'time'],
  ['sled-drag', 'Sled drag', 'X', 'machine', 'carry', 'quads hamstrings', 'glutes', 'distance'],

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
  ['hip-circle', 'Hip circles', 'X', 'bodyweight', 'prehab', 'glutes hip-flexors', '', 'reps'],
  ['ankle-rock', 'Ankle rocks', 'X', 'bodyweight', 'prehab', 'calves', '', 'reps'],
  ['open-book', 'Open book rotation', 'X', 'bodyweight', 'prehab', 'upper-back', 'chest', 'reps'],
  ['inchworm', 'Inchworm', 'X', 'bodyweight', 'prehab', 'hamstrings abs', 'front-delts', 'reps'],
  ['knee-hug-walk', 'Walking knee hug', 'X', 'bodyweight', 'prehab', 'glutes hip-flexors', '', 'reps'],
  ['band-dislocate', 'Band pass-through', 'X', 'bodyweight', 'prehab', 'front-delts rear-delts', 'chest', 'reps'],
  ['wall-slide', 'Wall slides', 'X', 'bodyweight', 'prehab', 'upper-back traps', 'side-delts', 'reps'],
  ['prone-ytw', 'Prone Y-T-W', 'X', 'bodyweight', 'prehab', 'rear-delts upper-back traps', '', 'reps'],
  ['glute-bridge-march', 'Glute bridge march', 'X', 'bodyweight', 'prehab', 'glutes', 'hamstrings abs', 'reps'],

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
  ['stretch-butterfly', 'Butterfly stretch', 'X', 'bodyweight', 'mobility', 'adductors', '', 'time'],
  ['stretch-frog', 'Frog stretch', 'X', 'bodyweight', 'mobility', 'adductors', 'hip-flexors', 'time'],
  ['stretch-lat', 'Bench lat stretch', 'X', 'bodyweight', 'mobility', 'lats', 'triceps', 'time'],
  ['stretch-triceps', 'Overhead triceps stretch', 'X', 'bodyweight', 'mobility', 'triceps', 'lats', 'time'],
  ['stretch-quad', 'Standing quad stretch', 'X', 'bodyweight', 'mobility', 'quads', 'hip-flexors', 'time'],
  ['stretch-figure4', 'Figure-four stretch', 'X', 'bodyweight', 'mobility', 'glutes', '', 'time'],
  ['stretch-spinal-twist', 'Seated spinal twist', 'X', 'bodyweight', 'mobility', 'lower-back obliques', 'glutes', 'time'],
  ['stretch-cobra', 'Cobra stretch', 'X', 'bodyweight', 'mobility', 'abs', 'hip-flexors', 'time'],
  ['stretch-down-dog', 'Downward dog', 'X', 'bodyweight', 'mobility', 'hamstrings calves', 'lats', 'time'],
  ['roll-adductors', 'Foam roll inner thighs', 'X', 'bodyweight', 'mobility', 'adductors', '', 'time'],
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
  'cable-chest-press': 'cable-tower', 'suspension-pushup': 'suspension', 'kb-press': 'kettlebell', 'band-lat-raise': 'bands', 'db-rear-delt-row': 'incline-bench', 'band-lat-pulldown': 'bands', 'band-row': 'bands', 'suspension-row': 'suspension', 'kb-row': 'kettlebell', 'wide-cable-row': 'cable-row', 'bb-pullover': 'bench', 'back-ext-machine': 'back-ext-machine', 'band-good-morning': 'bands', 'band-curl': 'bands', 'kb-curl': 'kettlebell', 'bb-wrist-curl': 'bench', 'cable-wrist-curl': 'cable-tower', 'band-pushdown': 'bands', 'ez-overhead-ext': 'ez-bar', 'kb-goblet-squat': 'kettlebell', 'v-squat': 'v-squat', 'single-leg-extension': 'leg-ext', 'bb-walking-lunge': 'rack', 'bb-split-squat': 'rack', 'kb-deadlift': 'kettlebell', 'trap-bar-rdl': 'trap-bar', 'band-pull-through': 'bands', 'band-hip-thrust': 'bench bands', 'kb-hip-thrust': 'bench kettlebell', 'cable-leg-curl': 'cable-tower', 'db-leg-curl': 'bench', 'band-leg-curl': 'bands', 'cable-adduction': 'cable-tower', 'bb-calf-raise': 'rack', 'donkey-calf': 'donkey-calf', 'ball-pike': 'stability-ball', 'ball-rollout': 'stability-ball', 'band-pallof': 'bands', 'band-woodchop': 'bands', 'trap-bar-carry': 'trap-bar', 'kb-rack-carry': 'kettlebell',
  'incline-cable-fly': 'cable-tower incline-bench', 'db-squeeze-press': 'bench', 'z-press': 'rack', 'incline-y-raise': 'incline-bench', 'band-face-pull': 'bands', 'cable-shrug': 'cable-tower',
  'low-row-machine': 'plate-row', 'band-assisted-pullup': 'pullup-bar bands', 'negative-pullup': 'pullup-bar', 'weighted-back-ext': 'back-ext',
  'cable-preacher-curl': 'cable-tower preacher-bench', 'cable-kickback-tri': 'cable-tower', 'reverse-pushdown': 'cable-tower', 'tate-press': 'bench',
  'ffe-split-squat': 'box', 'zercher-squat': 'rack', 'pause-squat': 'rack', 'band-seated-abduction': 'bands', 'seated-db-calf': 'bench',
  'toes-to-bar': 'pullup-bar', 'stir-the-pot': 'stability-ball', 'decline-crunch': 'incline-bench', 'hanging-oblique-raise': 'pullup-bar',
  'kb-clean': 'kettlebell', 'kb-snatch': 'kettlebell', 'stair-climber': 'stairs', 'elliptical-interval': 'elliptical', 'incline-walk': 'treadmill', 'sled-drag': 'sled',
  'band-dislocate': 'bands', 'stretch-lat': 'bench', 'roll-adductors': 'foam-roller',
};
// Old names, so exercises keep up with renames unless the user renamed them.
const RENAMED = {
  'hip-thrust': ['Barbell hip thrust (Smith bar + bench)'], 'iso-row': ['Hammer Strength iso row'], 'machine-pulldown': ['Machine pulldown (Hammer Strength)'],
  'hammer-curl': ['Hammer curl / cross-body hammer curl'], 'machine-fly': ['Machine fly'], 'rear-delt-fly': ['Machine rear delt fly'], 'calf-press': ['Calf press'],
  'preacher-curl': ['Preacher curl'], 'vertical-leg-raise': ['Vertical leg raise'], 'assisted-pullup': ['Assisted pullup machine'],
};

// One limb or one side at a time: what the logged weight, reps or time refer to.
const SIDED = {
  arm: 'db-single-arm-press kb-press kb-row cable-kickback-tri kb-clean kb-snatch stretch-triceps db-row single-arm-pulldown single-arm-cable-row cable-tri-ext concentration-curl db-preacher-curl meadows-row wrist-ext-eccentric band-external-rotation forearm-stretch',
  leg: 'single-leg-extension bb-walking-lunge bb-split-squat bw-split-squat single-leg-glute-bridge cable-leg-curl band-leg-curl cable-adduction side-lying-adduction bw-calf-raise ffe-split-squat lateral-lunge curtsy-lunge cossack-squat b-stance-rdl side-lying-abduction ankle-rock stretch-quad bulgarian-split-squat single-leg-rdl step-up reverse-lunge walking-lunge single-leg-press single-leg-calf single-leg-hip-thrust smith-split-squat bb-lunge cable-kickback cable-hip-abduction glute-kickback-machine step-up-bw bodyweight-lunge lateral-bound leg-swing tke calf-raise-slow',
  side: 'band-pallof band-woodchop suitcase-deadlift side-plank-dip open-book stretch-figure4 stretch-spinal-twist side-plank copenhagen-plank pallof-press cable-woodchop landmine-rotation suitcase-carry db-side-bend cable-oblique-crunch clamshell stretch-couch stretch-hamstring stretch-pigeon stretch-calf stretch-chest stretch-thread stretch-wgs stretch-crossbody stretch-9090 roll-lats',
};
// Moves that can be logged more than one way (the first is the default). Anything measured by
// distance can also be timed. Everything else has just its own measure.
const MODES = {
  'mountain-climber': 'time reps', 'high-knees': 'time reps', 'jumping-jack': 'time reps', 'jump-rope': 'time reps', 'pogo-hop': 'time reps',
  burpee: 'reps time', 'air-squat': 'reps time', 'bodyweight-lunge': 'reps time', 'squat-jump': 'reps time', 'kb-swing': 'reps time',
  'wall-ball': 'reps time', 'med-ball-slam': 'reps time', 'plank-shoulder-tap': 'reps time', 'lateral-band-walk': 'reps time',
  'arm-circle': 'time reps', 'leg-swing': 'reps time', 'stretch-catcow': 'time reps', 'stretch-wgs': 'time reps', 'stretch-thread': 'time reps',
  'stretch-9090': 'time reps', 'open-book': 'reps time', superman: 'time reps', 'dead-bug': 'reps time', 'bird-dog': 'reps time',
  'hip-circle': 'reps time', inchworm: 'reps time', pushup: 'reps time', crunch: 'reps time', 'step-up-bw': 'reps time', 'bench-dip': 'reps time', 'pushup-rotation': 'reps time', 'tuck-jump': 'reps time', 'skater-jump': 'reps time',
  'assault-bike-cal': 'cal time', 'bike-sprint': 'time cal', 'bike-interval': 'time cal distance', 'row-interval': 'distance time cal',
  'ski-interval': 'time cal distance', 'elliptical-interval': 'time distance', 'stair-climber': 'time', 'incline-walk': 'time distance',
};
const modesOf = (id, metric) => {
  const m = MODES[id] ? MODES[id].split(' ') : [metric || 'reps'];
  if (m.includes('distance') && !m.includes('time')) m.push('time');
  return m;
};

const SIDE_OF = Object.fromEntries(Object.entries(SIDED).flatMap(([k, ids]) => ids.split(' ').map((id) => [id, k])));
// Short note under each set's numbers, e.g. 'per arm'.
export function sideNote(ex) {
  const k = ex?.sided || SIDE_OF[ex?.id];
  if (!k) return '';
  return `per ${k}`;
}

const split = (s) => (s ? s.split(' ') : []);

export const BANK = Object.fromEntries(RAW.map(([id, name, cat, type, pattern, primary, secondary, metric]) => [id, {
  id, name, type, pattern, metric: metric || 'reps', needs: split(NEEDS[id]), modes: modesOf(id, metric),
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
        category: b.category, pattern: b.pattern, metric: b.metric, primary: [...b.primary], secondary: [...b.secondary], needs: [...b.needs], modes: [...b.modes],
      };
    } else if (!ex.customMeta) {
      if (RENAMED[b.id]?.includes(ex.name)) ex.name = b.name;
      Object.assign(ex, { category: b.category, pattern: b.pattern, metric: b.metric, primary: [...b.primary], secondary: [...b.secondary] });
    }
    if (ex) { ex.needs = [...b.needs]; ex.modes = [...b.modes]; } // equipment and measures always follow the bank
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
  // The same movement on other equipment ("hip thrust": barbell, machine, DB, Smith) ranks first.
  const shared = moveWords(a.name).filter((w) => moveWords(b.name).includes(w)).length;
  score += Math.min(shared, 2) * 2;
  return score;
}

// The words that name the movement, without the equipment or setup.
const NOT_MOVE = new Set(['barbell', 'bb', 'db', 'dumbbell', 'dumbbells', 'kettlebell', 'kb', 'cable', 'machine', 'smith', 'band', 'banded', 'plate', 'plate-loaded', 'loaded', 'weighted', 'single-arm', 'single-leg', 'one-arm', 'seated', 'standing', 'lying', 'incline', 'decline', 'chest-supported', 'iso-lateral', 'ez-bar', 'ez', 'trap', 'bar', 'suspension', 'bodyweight', 'the', 'with', 'and', 'of', 'a']);
function moveWords(name) {
  return name.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[\s/]+/).filter((w) => w.length > 2 && !NOT_MOVE.has(w));
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
