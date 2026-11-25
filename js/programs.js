// Well-known programs as starting plans. Each follows the program's structure (days, main lifts,
// sets and reps). Where a program uses the same lift at two rep ranges on different days (GZCLP's
// T1 and T2), the second uses a close variation, so each lift keeps one progression in the app.
// Sources are the programs' own published descriptions; this is a faithful outline, not the full
// rule set (e.g. 5/3/1's percentages come from the app's 5/3/1 wave progression).

const it = (exerciseId, sets, repMin, repMax = repMin, restSec = 120) => ({ exerciseId, sets, repMin, repMax, restSec });
const DAYS = { 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] };

export const PROGRAMS = {
  fullbody: {
    name: 'Full body, 3 days', level: 'Beginner', goal: 'Strength and muscle', progression: 'double',
    desc: 'Every major muscle three times a week with a few big lifts. The simplest way to start.',
    days: [
      { name: 'Full body A', items: [it('back-squat', 3, 6, 8, 150), it('bench-press', 3, 6, 8, 150), it('lat-pulldown', 3, 8, 10, 90), it('db-curl', 2, 10, 12, 60), it('plank', 2, 1, 1, 60)] },
      { name: 'Full body B', items: [it('rdl', 3, 8, 10, 150), it('ohp', 3, 6, 8, 120), it('cable-row', 3, 8, 10, 90), it('leg-press', 2, 10, 12, 90), it('cable-pushdown', 2, 10, 12, 60)] },
      { name: 'Full body C', items: [it('goblet-squat', 3, 8, 10, 90), it('db-incline-bench', 3, 8, 10, 90), it('db-row', 3, 8, 10, 90), it('hip-thrust', 3, 8, 10, 90), it('db-lat-raise', 2, 12, 15, 60)] },
    ],
  },
  ss: {
    name: 'Starting Strength', level: 'Beginner', goal: 'Strength', progression: 'linear', focus: ['back-squat', 'bench-press', 'deadlift', 'ohp'],
    desc: 'Mark Rippetoe\'s barbell program: squat every session, alternate bench and press, add weight every workout.',
    days: [
      { name: 'Workout A', items: [it('back-squat', 3, 5, 5, 180), it('bench-press', 3, 5, 5, 180), it('deadlift', 1, 5, 5, 180)] },
      { name: 'Workout B', items: [it('back-squat', 3, 5, 5, 180), it('ohp', 3, 5, 5, 180), it('deadlift', 1, 5, 5, 180)] },
      { name: 'Workout A', items: [it('back-squat', 3, 5, 5, 180), it('bench-press', 3, 5, 5, 180), it('deadlift', 1, 5, 5, 180)] },
    ],
  },
  gzclp: {
    name: 'GZCLP', level: 'Beginner to intermediate', goal: 'Strength and muscle', progression: 'double', focus: ['back-squat', 'bench-press', 'deadlift', 'ohp'],
    desc: 'Cody Lefever\'s tiered program: a heavy main lift (T1, 5×3), a lighter volume lift (T2, 3×10) and back work (T3, 3×15).',
    days: [
      { name: 'A1', items: [it('back-squat', 5, 3, 3, 180), it('close-grip-bench', 3, 10, 10, 120), it('lat-pulldown', 3, 15, 15, 75)] },
      { name: 'B1', items: [it('ohp', 5, 3, 3, 180), it('rdl', 3, 10, 10, 120), it('db-row', 3, 15, 15, 75)] },
      { name: 'A2', items: [it('bench-press', 5, 3, 3, 180), it('front-squat', 3, 10, 10, 120), it('lat-pulldown', 3, 15, 15, 75)] },
      { name: 'B2', items: [it('deadlift', 5, 3, 3, 180), it('db-shoulder-press', 3, 10, 10, 120), it('db-row', 3, 15, 15, 75)] },
    ],
  },
  w531: {
    name: '5/3/1', level: 'Intermediate', goal: 'Strength', progression: 'wave', focus: ['ohp', 'deadlift', 'bench-press', 'back-squat'],
    desc: 'Jim Wendler\'s program: one main lift a day on a 3-week wave (5s, 3s, 5/3/1), then assistance work.',
    days: [
      { name: 'Press day', items: [it('ohp', 3, 5, 5, 180), it('db-shoulder-press', 5, 10, 10, 90), it('lat-pulldown', 5, 10, 10, 90), it('db-lat-raise', 3, 12, 15, 60)] },
      { name: 'Deadlift day', items: [it('deadlift', 3, 5, 5, 180), it('rdl', 5, 10, 10, 120), it('hanging-leg-raise', 3, 10, 15, 60), it('back-extension', 3, 10, 15, 60)] },
      { name: 'Bench day', items: [it('bench-press', 3, 5, 5, 180), it('db-bench', 5, 10, 10, 90), it('db-row', 5, 10, 10, 90), it('cable-pushdown', 3, 10, 15, 60)] },
      { name: 'Squat day', items: [it('back-squat', 3, 5, 5, 180), it('leg-press', 5, 10, 10, 120), it('lying-ham-curl', 3, 10, 15, 60), it('standing-calf', 3, 10, 15, 60)] },
    ],
  },
  phul: {
    name: 'PHUL', level: 'Intermediate', goal: 'Strength and muscle', progression: 'double', focus: ['bench-press', 'back-squat', 'deadlift', 'bb-row'],
    desc: 'Power Hypertrophy Upper Lower: two heavy days (3–5 reps) and two volume days (8–12 reps).',
    days: [
      { name: 'Upper power', items: [it('bench-press', 4, 3, 5, 180), it('bb-row', 4, 3, 5, 180), it('ohp', 3, 5, 8, 150), it('lat-pulldown', 3, 6, 10, 90), it('ez-curl', 3, 6, 10, 60), it('skullcrusher', 3, 6, 10, 60)] },
      { name: 'Lower power', items: [it('back-squat', 4, 3, 5, 180), it('deadlift', 3, 3, 5, 180), it('leg-press', 4, 10, 15, 120), it('lying-ham-curl', 4, 6, 10, 90), it('standing-calf', 4, 6, 10, 60)] },
      { name: 'Upper hypertrophy', items: [it('db-incline-bench', 4, 8, 12, 90), it('cable-fly', 4, 8, 12, 60), it('cable-row', 4, 8, 12, 90), it('db-row', 4, 8, 12, 90), it('db-lat-raise', 4, 10, 15, 60), it('db-curl', 4, 8, 12, 60), it('rope-pushdown', 4, 8, 12, 60)] },
      { name: 'Lower hypertrophy', items: [it('front-squat', 4, 8, 12, 150), it('walking-lunge', 4, 8, 12, 90), it('leg-extension', 4, 10, 15, 60), it('seated-ham-curl', 4, 10, 15, 60), it('seated-calf', 4, 8, 12, 60)] },
    ],
  },
  ppl: {
    name: 'Push Pull Legs', level: 'Intermediate', goal: 'Muscle', progression: 'double', focus: ['bench-press', 'deadlift', 'back-squat'],
    desc: 'Six days: push, pull and legs twice a week. Lots of volume for size.',
    days: [
      { name: 'Push', items: [it('bench-press', 4, 6, 8, 150), it('ohp', 3, 8, 10, 120), it('db-incline-bench', 3, 8, 12, 90), it('db-lat-raise', 3, 12, 15, 60), it('cable-pushdown', 3, 10, 12, 60)] },
      { name: 'Pull', items: [it('deadlift', 3, 5, 5, 180), it('lat-pulldown', 3, 8, 10, 90), it('cable-row', 3, 10, 12, 90), it('face-pull', 3, 12, 15, 60), it('db-curl', 3, 10, 12, 60)] },
      { name: 'Legs', items: [it('back-squat', 4, 6, 8, 180), it('rdl', 3, 8, 10, 150), it('leg-press', 3, 10, 12, 120), it('lying-ham-curl', 3, 10, 12, 60), it('standing-calf', 4, 10, 15, 60)] },
      { name: 'Push', items: [it('bench-press', 4, 6, 8, 150), it('ohp', 3, 8, 10, 120), it('db-incline-bench', 3, 8, 12, 90), it('db-lat-raise', 3, 12, 15, 60), it('cable-pushdown', 3, 10, 12, 60)] },
      { name: 'Pull', items: [it('deadlift', 3, 5, 5, 180), it('lat-pulldown', 3, 8, 10, 90), it('cable-row', 3, 10, 12, 90), it('face-pull', 3, 12, 15, 60), it('db-curl', 3, 10, 12, 60)] },
      { name: 'Legs', items: [it('back-squat', 4, 6, 8, 180), it('rdl', 3, 8, 10, 150), it('leg-press', 3, 10, 12, 120), it('lying-ham-curl', 3, 10, 12, 60), it('standing-calf', 4, 10, 15, 60)] },
    ],
  },
};

// Quick starts: simple plans a new lifter can begin today, for a full gym, dumbbells or no equipment.
// Plain structure (a few compound lifts, then accessories, 2–3 sets of 6–15), as general
// guidelines recommend for novices (ACSM 2009 position stand on progression models).
export const QUICKSTARTS = {
  fullbody: { ...PROGRAMS.fullbody, where: 'Full gym' },
  upperlower: {
    name: 'Upper and lower, 4 days', level: 'Beginner to intermediate', goal: 'Strength and muscle', progression: 'double', where: 'Full gym',
    desc: 'Upper body twice and lower body twice a week. More time per muscle than full body.',
    days: [
      { name: 'Upper A', items: [it('bench-press', 3, 6, 8, 150), it('cable-row', 3, 8, 10, 120), it('db-shoulder-press', 3, 8, 12, 90), it('lat-pulldown', 2, 10, 12, 90), it('db-curl', 2, 10, 15, 60), it('cable-pushdown', 2, 10, 15, 60)] },
      { name: 'Lower A', items: [it('back-squat', 3, 6, 8, 180), it('rdl', 3, 8, 10, 150), it('leg-press', 2, 10, 12, 120), it('lying-ham-curl', 2, 10, 15, 60), it('standing-calf', 3, 10, 15, 60), it('plank', 2, 1, 1, 60)] },
      { name: 'Upper B', items: [it('db-incline-bench', 3, 8, 10, 120), it('lat-pulldown', 3, 8, 10, 120), it('db-row', 3, 8, 12, 90), it('db-lat-raise', 3, 12, 15, 60), it('hammer-curl', 2, 10, 15, 60), it('db-overhead-ext', 2, 10, 15, 60)] },
      { name: 'Lower B', items: [it('deadlift', 3, 5, 6, 180), it('goblet-squat', 3, 8, 12, 120), it('walking-lunge', 2, 10, 12, 90), it('leg-extension', 2, 12, 15, 60), it('seated-calf', 3, 12, 15, 60), it('dead-bug', 2, 8, 12, 60)] },
    ],
  },
  ppl3: {
    name: 'Push, pull, legs, 3 days', level: 'Beginner to intermediate', goal: 'Muscle', progression: 'double', where: 'Full gym',
    desc: 'One day each for pushing muscles, pulling muscles and legs.',
    days: [
      { name: 'Push', items: [it('bench-press', 3, 6, 8, 150), it('db-shoulder-press', 3, 8, 12, 120), it('db-incline-bench', 2, 10, 12, 90), it('db-lat-raise', 3, 12, 15, 60), it('cable-pushdown', 3, 10, 15, 60)] },
      { name: 'Pull', items: [it('lat-pulldown', 3, 8, 10, 120), it('cable-row', 3, 8, 12, 120), it('face-pull', 3, 12, 15, 60), it('db-curl', 3, 10, 15, 60), it('hammer-curl', 2, 10, 15, 60)] },
      { name: 'Legs', items: [it('back-squat', 3, 6, 8, 180), it('rdl', 3, 8, 10, 150), it('leg-press', 2, 10, 12, 120), it('lying-ham-curl', 2, 10, 15, 60), it('standing-calf', 3, 10, 15, 60)] },
    ],
  },
  dumbbell3: {
    name: 'Dumbbells only, 3 days', level: 'Beginner', goal: 'Strength and muscle', progression: 'double', where: 'Dumbbells',
    desc: 'Full body with a pair of dumbbells and a bench, at home or a small gym.',
    days: [
      { name: 'Dumbbell A', items: [it('goblet-squat', 3, 8, 12, 120), it('db-bench', 3, 8, 12, 120), it('db-row', 3, 8, 12, 90), it('db-rdl', 3, 8, 12, 120), it('db-curl', 2, 10, 15, 60)] },
      { name: 'Dumbbell B', items: [it('reverse-lunge', 3, 8, 12, 90), it('db-shoulder-press', 3, 8, 12, 90), it('chest-supported-db-row', 3, 8, 12, 90), it('db-hip-thrust', 3, 10, 15, 90), it('db-overhead-ext', 2, 10, 15, 60)] },
      { name: 'Dumbbell C', items: [it('db-squat', 3, 8, 12, 120), it('db-incline-bench', 3, 8, 12, 90), it('db-row', 3, 10, 12, 90), it('single-leg-rdl', 2, 8, 12, 90), it('db-lat-raise', 2, 12, 15, 60)] },
    ],
  },
  bodyweight3: {
    name: 'No equipment, 3 days', level: 'Beginner', goal: 'Get fit overall', progression: 'double', where: 'No equipment',
    desc: 'Bodyweight only, anywhere. Add reps each week; harder versions come up as you improve.',
    days: [
      { name: 'Bodyweight A', items: [it('air-squat', 3, 12, 20, 60), it('pushup', 3, 6, 15, 90), it('inverted-row', 3, 6, 12, 90), it('glute-bridge', 3, 12, 20, 60), it('plank', 3, 1, 1, 60)] },
      { name: 'Bodyweight B', items: [it('bw-split-squat', 3, 8, 12, 60), it('pike-pushup', 3, 5, 10, 90), it('inverted-row', 3, 6, 12, 90), it('single-leg-glute-bridge', 2, 8, 12, 60), it('dead-bug', 3, 8, 12, 60)] },
      { name: 'Bodyweight C', items: [it('air-squat', 3, 15, 25, 60), it('knee-pushup', 2, 10, 20, 60), it('pushup', 2, 6, 15, 90), it('bw-calf-raise', 3, 15, 25, 45), it('hollow-hold', 3, 1, 1, 60)] },
    ],
  },
};

// The program as a plan: { plan, dayModes }.
export function programPlan(id) {
  const p = PROGRAMS[id] || QUICKSTARTS[id];
  const days = DAYS[p.days.length];
  const plan = {}; const dayModes = {};
  for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) dayModes[d] = 'rest';
  p.days.forEach((day, i) => {
    const key = days[i];
    plan[key] = { name: day.name, items: day.items.map((x, j) => ({ uid: `${key}-${j + 1}`, group: String(j + 1), note: '', ...x })) };
    dayModes[key] = 'lift';
  });
  return { plan, dayModes };
}
