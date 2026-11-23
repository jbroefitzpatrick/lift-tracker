// FitBod's workout export. Columns: Date, Exercise, Reps, Weight(kg), Duration(s), Distance(m),
// Incline, Resistance, isWarmup, Note, multiplier.
//
// - One row per set. Every set in a workout shares the workout's timestamp (UTC).
// - Weight is always in kilograms, per dumbbell for dumbbell lifts. "multiplier" only tells FitBod
//   how to total volume (2 for a pair, 4 for a pair done on each side), so it isn't applied here.
// - The file has no workout names or lengths. Length is estimated from the sets.
// - Running and swimming rows become cardio entries, so they count toward miles and cardio goals.
//
// Names are matched only through this list or an exact name. Loose word matching isn't safe here:
// it would file "Dumbbell Incline Bench Press" under the barbell lift and skew strength numbers.
// Anything else becomes your own exercise, with its muscles worked out from the name.

import { KG } from './units.js';
import { EXTRA_FITBOD } from './bank-extra.js';

export const FITBOD_NAMES = {
  'Barbell Bench Press': 'bench-press', 'Barbell Incline Bench Press': 'incline-bench', 'Barbell Decline Bench Press': 'decline-bench', 'Close-Grip Bench Press': 'close-grip-bench',
  'Dumbbell Bench Press': 'db-bench', 'Dumbbell Incline Bench Press': 'db-incline-bench', 'Dumbbell Decline Bench Press': 'db-decline-bench', 'Smith Machine Bench Press': 'smith-bench', 'Smith Machine Incline Bench Press': 'smith-incline',
  'Floor Press': 'floor-press', 'Hammerstrength Chest Press': 'plate-chest-press', 'Machine Fly': 'machine-fly', 'Dumbbell Fly': 'db-fly', 'Dumbbell Incline Fly': 'db-incline-fly', 'Cable Crossover Fly': 'cable-fly',
  'Push Up': 'pushup', 'Decline Push Up': 'decline-pushup', 'Diamond Push Up': 'diamond-pushup', 'Pike Push Up': 'pike-pushup', 'Handstand Push Up': 'hspu', 'Dip': 'dip', 'Bench Dip': 'bench-dip', 'Machine Tricep Dip': 'machine-dip',
  'Barbell Shoulder Press': 'ohp', 'Seated Barbell Shoulder Press': 'seated-ohp', 'Push Press': 'push-press', 'Dumbbell Shoulder Press': 'db-shoulder-press', 'Standing Dumbbell Shoulder Press': 'db-shoulder-press', 'Arnold Dumbbell Press': 'arnold-press',
  'Machine Shoulder Press': 'machine-shoulder-press', 'Smith Machine Overhead Shoulder Press': 'smith-ohp', 'Dumbbell Lateral Raise': 'db-lat-raise', 'Cable Lateral Raise': 'cable-lat-raise', 'Dumbbell Front Raise': 'db-front-raise', 'Front Plate Raise': 'plate-front-raise',
  'Machine Rear Delt Fly': 'rear-delt-fly', 'Dumbbell Rear Delt Raise': 'db-rear-delt-fly', 'Dumbbell Back Fly': 'db-rear-delt-fly', 'Cable Rear Delt Fly': 'cable-rear-delt-fly', 'Cable Face Pull': 'face-pull', 'Upright Row': 'upright-row', 'Dumbbell Upright Row': 'db-upright-row',
  'Pull Up': 'pullup', 'Chin Up': 'chinup', 'Neutral Grip Pull Up': 'neutral-pullup', 'Lat Pulldown': 'lat-pulldown', 'Wide Grip Lat Pulldown': 'wide-grip-pulldown', 'V-Bar Pulldown': 'close-grip-pulldown', 'Reverse Grip Pull Down': 'underhand-pulldown',
  'Bent Over Barbell Row': 'bb-row', 'Barbell Row': 'bb-row', 'Dumbbell Row': 'db-row', 'Cable Row': 'cable-row', 'Hammerstrength Iso Row': 'iso-row', 'Smith Machine Bent Over Row': 'smith-row', 'Kettlebell Row': 'kb-row', 'Renegade Row': 'renegade-row', 'Dumbbell Pullover': 'db-pullover',
  'Barbell Shrug': 'bb-shrug', 'Dumbbell Shrug': 'db-shrug', 'Smith Machine Shrug': 'smith-shrug', 'Trap Bar Shrugs': 'trap-bar-shrug', 'Cable Shrugs': 'cable-shrug',
  'Barbell Curl': 'bb-curl', 'EZ-Bar Curl': 'ez-curl', 'Dumbbell Bicep Curl': 'db-curl', 'Seated Dumbbell Curl': 'db-curl', 'Incline Dumbbell Curl': 'incline-db-curl', 'Hammer Curls': 'hammer-curl', 'Cross Body Hammer Curls': 'cross-body-hammer-curl', 'Cable Rope Hammer Curls': 'rope-hammer-curl',
  'Preacher Curl': 'ez-preacher-curl', 'Dumbbell Preacher Curls': 'db-preacher-curl', 'Machine Preacher Curl': 'preacher-curl', 'Machine Bicep Curl': 'machine-curl', 'Cable Bicep Curl': 'cable-curl', 'Behind the Back Cable Bicep Curl': 'btb-cable-curl', 'Concentration Curl': 'concentration-curl',
  'Reverse Barbell Curl': 'reverse-curl', 'Spider Curls': 'spider-curl', 'Zottman Curl': 'zottman-curl', 'Barbell Bicep Drag Curl': 'drag-curl',
  'Skullcrusher': 'skullcrusher', 'Dumbbell Skullcrusher': 'db-skullcrusher', 'Cable Tricep Pushdown': 'cable-pushdown', 'Cable Rope Tricep Extension': 'rope-pushdown', 'Cable Rope Overhead Triceps Extension': 'overhead-cable-ext', 'Cable Underhand Tricep Pushdown': 'reverse-pushdown',
  'Dumbbell Tricep Extension': 'db-overhead-ext', 'EZ-Bar Overhead Tricep Extension': 'ez-overhead-ext', 'Dumbbell Kickbacks': 'db-kickback', 'Machine Tricep Extension': 'machine-tri-ext',
  'Back Squat': 'back-squat', 'Front Squat': 'front-squat', 'Pause Back Squat': 'pause-squat', 'Box Squat': 'box-squat', 'Hack Squat': 'hack-squat', 'Smith Machine Squat': 'smith-squat', 'Dumbbell Squat': 'db-squat', 'Dumbbell Goblet Squat': 'goblet-squat', 'Dumbbell Sumo Squat': 'db-sumo-squat',
  'Leg Press': 'leg-press', 'Machine Leg Press': 'leg-press', 'Leg Extension': 'leg-extension', 'Single Leg Leg Extension': 'single-leg-extension', 'Bulgarian Split Squat': 'bulgarian-split-squat', 'Dumbbell Bulgarian Split Squat': 'bulgarian-split-squat', 'Barbell Lunge': 'bb-lunge', 'Lunge': 'bodyweight-lunge', 'Side Lunge': 'lateral-lunge',
  'Step Up': 'step-up-bw', 'Dumbbell Step Up': 'step-up', 'Air Squats': 'air-squat', 'Jump Squat': 'squat-jump',
  'Deadlift': 'deadlift', 'Sumo Deadlift': 'sumo-deadlift', 'Trap Bar Deadlift': 'trap-bar-deadlift', 'Rack Pulls': 'rack-pull', 'Romanian Deadlift': 'rdl', 'Dumbbell Romanian Deadlift': 'db-rdl', 'Single Leg Romanian Deadlift': 'single-leg-rdl', 'Smith Machine Stiff-Legged Deadlift': 'smith-rdl', 'Good Morning': 'good-morning', 'Power Clean': 'power-clean',
  'Barbell Hip Thrust': 'hip-thrust', 'Hip Thrust': 'hip-thrust', 'Dumbbell Hip Thrust': 'db-hip-thrust', 'Single Leg Hip Thrust': 'single-leg-hip-thrust', 'Barbell Glute Bridge': 'bb-glute-bridge', 'Dumbbell Glute Bridge': 'db-glute-bridge', 'Single Leg Glute Bridge': 'single-leg-glute-bridge',
  'Cable Pull Through': 'cable-pull-through', 'Glute Kickback Machine': 'glute-kickback-machine', 'Lying Hamstrings Curl': 'lying-ham-curl', 'Seated Leg Curl': 'seated-ham-curl', 'Glute Ham Raise': 'ghr', 'Machine Hip Adductor': 'hip-adductor', 'Machine Hip Abductor': 'hip-abductor',
  'Back Extensions': 'back-extension', 'Seated Back Extension': 'back-ext-machine', 'Reverse Hyperextension': 'reverse-hyper', 'Superman': 'superman',
  'Calf Press': 'calf-press', 'Standing Machine Calf Press': 'standing-calf', 'Seated Machine Calf Press': 'seated-calf', 'Standing Barbell Calf Raise': 'bb-calf-raise', 'Smith Machine Calf Raise': 'smith-calf', 'Calf Raise': 'bw-calf-raise',
  'Plank': 'plank', 'Side Bridge': 'side-plank', 'Plank Shoulder Taps': 'plank-shoulder-tap', 'Plank Body Saw': 'body-saw', 'Stir the Pot': 'stir-the-pot', 'Dead Bug': 'dead-bug', 'Bird Dog': 'bird-dog', 'Crunches': 'crunch', 'Bicycle Crunch': 'bicycle-crunch', 'Reverse Crunch': 'reverse-crunch', 'Decline Crunch': 'decline-crunch', 'Cable Crunch': 'cable-crunch', 'Ab Crunch Machine': 'ab-crunch-machine', 'Exercise Ball Crunch': 'ball-crunch',
  'Sit Up': 'situp', 'Decline Sit Up': 'decline-situp', 'Russian Twist': 'russian-twist', 'Leg Raise': 'leg-raise', 'Vertical Leg Raise': 'vertical-leg-raise', 'Hanging Leg Raise': 'hanging-leg-raise', 'Vertical Knee Raise': 'hanging-knee-raise', 'Barbell Ab Rollout': 'barbell-rollout', 'Ab Rollout': 'ab-wheel', 'Cable Wood Chop': 'cable-woodchop',
  'Burpee': 'burpee', 'Mountain Climber': 'mountain-climber', 'Box Jump': 'box-jump', 'Tuck Jump': 'tuck-jump', 'Kettlebell Swing': 'kb-swing', 'Kettlebell Power Clean': 'kb-clean',
  'Forward Arm Circle': 'arm-circle', 'Backward Arm Circle': 'arm-circle', 'Leg Swing': 'leg-swing', 'Lateral Leg Swing': 'leg-swing', 'Butt Kick': 'butt-kick', "Runner's Butt Kicks": 'butt-kick', 'Wall Slide Stretch': 'wall-slide', 'Scapular Pull Up': 'scap-pull', 'Clam': 'clamshell', 'Inchworm': 'inchworm', 'Airplane': 'hip-airplane', 'Reach Behind and Open': 'reach-open', 'Dead Hang': 'dead-hang',
  'Tricep Stretch': 'stretch-triceps', 'Chest Doorway Stretch': 'corner-pec-stretch', 'Wall Pectoral Stretch': 'stretch-chest', 'Cross-body Arm Stretch': 'stretch-crossbody', 'Couch Stretch': 'stretch-couch', 'Pigeon Pose': 'stretch-pigeon', 'Cat Cow': 'stretch-catcow', 'Downward Dog': 'stretch-down-dog', "Child's Pose": 'stretch-child', 'Lying Figure Four': 'stretch-figure4', 'Seated Figure Four': 'stretch-figure4',
  'Butterfly Stretch': 'stretch-butterfly', 'Frog Stretch': 'stretch-frog', 'Kneeling Hip Flexor Stretch': 'kneeling-hip-flexor', 'Knee to Chest Stretch': 'knee-to-chest', 'Seated Forward Bend': 'seated-forward-fold', 'Side Bend Stretch': 'side-stretch', 'Lateral Lunge Stretch': 'lateral-lunge-stretch', 'Seated Neck Release Stretch': 'neck-stretch', 'Open Book Stretch': 'open-book',
  'Foam Roll Lats': 'roll-lats', 'Foam Roll Upper Back': 'roll-upper-back', 'Foam Roll Quadriceps': 'roll-quads', 'Foam Roll Hamstrings': 'roll-hamstrings', 'Foam Roll Glutes': 'roll-glutes', 'Foam Roll Hip Adductors': 'roll-adductors',
  ...EXTRA_FITBOD,
};

const CARDIO_NAMES = { running: 'run', swimming: 'swim' };

// A clean number of pounds: FitBod stores pounds converted to kilograms.
const lbFromKg = (kg) => { const lb = kg / KG; const half = Math.round(lb * 2) / 2; return Math.abs(lb - half) < 0.03 ? half : Math.round(lb * 100) / 100; };
const parseStamp = (s) => { const m = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) \+(\d\d)(\d\d)$/.exec(String(s).trim()); if (!m) return null; const t = new Date(`${m[1]}T${m[2]}+${m[3]}:${m[4]}`); return Number.isNaN(+t) ? null : t; };
const localDay = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

export const isFitbod = (rows) => { const k = Object.keys(rows[0] || {}); return k.includes('weight(kg)') && k.includes('iswarmup'); };

// Rows → workouts in the importer's shape, each with any cardio from that session.
export function readFitbod(rows) {
  const byStamp = new Map();
  for (const r of rows) {
    const start = parseStamp(r.date); const name = r.exercise;
    if (!start || !name) continue;
    if (!byStamp.has(r.date)) byStamp.set(r.date, { name: 'FitBod workout', date: localDay(start), start: +start, end: +start, entries: [], cardio: [], key: r.date });
    const w = byStamp.get(r.date);
    const reps = parseInt(r.reps, 10) || 0; const seconds = parseFloat(r['duration(s)']) || 0; const meters = parseFloat(r['distance(m)']) || 0; const kg = parseFloat(r['weight(kg)']) || 0;
    const modality = CARDIO_NAMES[name.toLowerCase()];
    if (modality) { if (seconds > 0 || meters > 0) w.cardio.push({ modality, seconds, meters }); continue; }
    if (!(reps > 0 || seconds > 0)) continue;
    let e = w.entries.find((x) => x.name === name);
    if (!e) { e = { name, sets: [] }; w.entries.push(e); }
    e.sets.push({ weight: kg > 0 ? lbFromKg(kg) : 0, reps, seconds: reps ? 0 : seconds, type: String(r.iswarmup).toLowerCase() === 'true' ? 'w' : undefined });
    if (r.note && !e.note) e.note = r.note.slice(0, 200);
  }
  const out = [...byStamp.values()].filter((w) => w.entries.length || w.cardio.length);
  for (const w of out) {
    const sets = w.entries.reduce((a, e) => a + e.sets.length, 0);
    const timed = w.entries.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.seconds, 0), 0);
    w.end = w.start + Math.min(150, Math.max(10, sets * 1.75 + timed / 60)) * 60000;
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------- Exercises not in the library ----------
const MOBILITY = /stretch|foam roll|pose|bend\b|circle|cat cow|up dog|hip flow|neck|head tilt|chin drop|shin box|point and flex|walkout|leg crossover|crab reach|fan\b|kick\b|kicks\b|swing$|open\b|isometric/i;
const MUSCLE_RULES = [
  [/foam roll lower back|lower back|back extension|hyperextension|superman/i, ['lower-back'], ['glutes', 'hamstrings']],
  [/calf|calves/i, ['calves'], []], [/neck|head tilt|chin drop/i, ['traps'], []], [/hip flexor/i, ['hip-flexors'], []], [/adductor/i, ['adductors'], []], [/abductor|clam|side leg/i, ['abductors'], ['glutes']],
  [/tricep|skull|kickbacks?$/i, ['triceps'], []], [/curl|bicep/i, ['biceps'], ['forearms']], [/wrist/i, ['forearms'], []],
  [/lateral raise|forward raise|front raise|upright|shoulder|overhead|snatch|arnold|press.*shoulder/i, ['front-delts', 'side-delts'], ['triceps']], [/rear delt|rear deltoid|back fly/i, ['rear-delts'], ['upper-back']],
  [/shrug/i, ['traps'], []], [/pull ?up|chin up|pull ?down|lat\b|lats/i, ['lats'], ['biceps']], [/row/i, ['upper-back', 'lats'], ['biceps']],
  [/bench|chest|push up|pec|fly|floor press/i, ['chest'], ['front-delts', 'triceps']], [/deadlift|good morning|hamstring|hinge/i, ['hamstrings', 'glutes'], ['lower-back']],
  [/glute|hip thrust|hip bridge|bridge|hip/i, ['glutes'], ['hamstrings']], [/squat|lunge|step|leg press|jump|quad/i, ['quads', 'glutes'], ['hamstrings']],
  [/crunch|sit.?up|plank|twist|leg raise|knee raise|flutter|scissor|heel touch|rollout|vacuum|toe touch|pull-in|jackknife|climber/i, ['abs'], ['obliques']],
];
export function customExercise(id, name, sets) {
  const rule = MUSCLE_RULES.find(([re]) => re.test(name));
  const timed = sets.length && sets.every((s) => s.seconds > 0 && !s.reps);
  const weighted = sets.some((s) => s.weight > 0);
  const mobile = MOBILITY.test(name) && !weighted;
  const n = name.toLowerCase();
  const type = /dumbbell|kettlebell/.test(n) ? 'dumbbell' : /smith|machine|hammerstrength/.test(n) ? 'machine' : /cable|handle band|loop band/.test(n) ? 'cable' : /barbell|ez-bar|trap bar|clean|landmine/.test(n) ? (/squat|deadlift|lunge|hip|step|good morning/.test(n) ? 'barbell-lower' : 'barbell-upper') : 'bodyweight';
  const big = /squat|deadlift|press|row|pull ?up|chin up|lunge|clean|snatch|dip/.test(n);
  return {
    id, name, type, category: mobile ? 'conditioning' : big ? 'compound' : 'accessory', primary: rule ? rule[1] : ['abs'], secondary: rule ? rule[2] : [],
    pattern: mobile ? 'mobility' : '', increment: type === 'dumbbell' ? 5 : 5, ...(timed || mobile ? { metric: timed ? 'time' : 'reps' } : {}), ...(type === 'bodyweight' && !weighted ? { noLoad: true } : {}), custom: true, imported: true,
  };
}

// An earlier import filed some exercises as custom. Now that the library has them, move that
// history onto the library exercise and remove the leftover custom one. Safe to run every start.
export function relinkFitbod(db) {
  const moved = {};
  for (const ex of Object.values(db.exercises)) {
    const to = ex.imported && String(ex.id).startsWith('imp-') ? FITBOD_NAMES[ex.name] : null;
    if (to && db.exercises[to]) moved[ex.id] = to;
  }
  if (!Object.keys(moved).length) return 0;
  for (const s of db.sessions || []) for (const e of s.entries || []) {
    const to = moved[e.exerciseId];
    if (!to) continue;
    e.exerciseId = to;
    if (!e.metric && (db.exercises[to].metric || 'reps') !== 'reps') e.metric = 'reps';
  }
  const inUse = JSON.stringify([db.plan, db.week, db.activeSession, db.routines]);
  for (const id of Object.keys(moved)) if (!inUse.includes(`"${id}"`)) delete db.exercises[id];
  return Object.keys(moved).length;
}
