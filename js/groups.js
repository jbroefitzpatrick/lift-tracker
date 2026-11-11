// Display groups: the high-level view of the body. Tracking stays per muscle (20 of them);
// these roll the related ones up so recovery and weekly volume read at a glance, with the
// detail one tap away.
//
// - Groups of muscles that are usually trained together: Upper back (lats, mid back, traps),
//   Shoulders (front, side, rear delts), Core (abs, obliques), Hips (flexors, abductors, adductors).
// - Parts within a single muscle, estimated from which exercises were done: biceps (long head,
//   short head, brachialis), triceps (long head vs lateral and medial heads), chest (upper vs mid
//   and lower). Exercise choice shifts emphasis between these, not on/off: arm position changes
//   which biceps head is stretched (incline curls: long head; preacher curls: short head), a
//   neutral or overhand grip moves work to the brachialis, overhead work stretches the triceps'
//   long head, and incline pressing favors the upper chest. Treat part numbers as a guide.

export const GROUPS = [
  { id: 'chest', name: 'Chest', muscles: ['chest'], parts: 'chest' },
  { id: 'back', name: 'Upper back', muscles: ['lats', 'upper-back', 'traps'] },
  { id: 'shoulders', name: 'Shoulders', muscles: ['front-delts', 'side-delts', 'rear-delts'] },
  { id: 'biceps', name: 'Biceps', muscles: ['biceps'], parts: 'biceps' },
  { id: 'triceps', name: 'Triceps', muscles: ['triceps'], parts: 'triceps' },
  { id: 'forearms', name: 'Forearms', muscles: ['forearms'] },
  { id: 'core', name: 'Core', muscles: ['abs', 'obliques'] },
  { id: 'lower-back', name: 'Lower back', muscles: ['lower-back'] },
  { id: 'glutes', name: 'Glutes', muscles: ['glutes'] },
  { id: 'quads', name: 'Quads', muscles: ['quads'] },
  { id: 'hamstrings', name: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'hips', name: 'Hips', muscles: ['hip-flexors', 'abductors', 'adductors'] },
  { id: 'calves', name: 'Calves', muscles: ['calves'] },
];
export const groupById = (id) => GROUPS.find((g) => g.id === id);
export const groupOfMuscle = (m) => GROUPS.find((g) => g.muscles.includes(m));

export const PARTS = {
  biceps: { long: 'Long head', short: 'Short head', brachialis: 'Brachialis' },
  triceps: { long: 'Long head', lateral: 'Lateral and medial heads' },
  chest: { upper: 'Upper chest', mid: 'Mid and lower chest' },
};

// Share of an exercise's work going to each part of a muscle, from its name and movement.
export function emphasis(ex, muscle) {
  const n = `${ex.id} ${ex.name}`.toLowerCase();
  if (muscle === 'biceps') {
    if (/hammer|reverse|cross-body|neutral|zottman/.test(n)) return { brachialis: 0.6, long: 0.25, short: 0.15 };
    if (/incline|drag|behind-the-back|btb|bayesian/.test(n)) return { long: 0.6, short: 0.3, brachialis: 0.1 };
    if (/preacher|spider|concentration|wide/.test(n)) return { short: 0.6, long: 0.25, brachialis: 0.15 };
    return { long: 0.4, short: 0.4, brachialis: 0.2 };
  }
  if (muscle === 'triceps') {
    if (/overhead|skull|french|pullover/.test(n)) return { long: 0.65, lateral: 0.35 };
    return { long: 0.3, lateral: 0.7 };
  }
  if (muscle === 'chest') {
    if (ex.pattern === 'incline-push' || /incline|low-to-high|landmine/.test(n)) return { upper: 0.65, mid: 0.35 };
    return { upper: 0.25, mid: 0.75 };
  }
  return null;
}

// Hard sets per muscle and per part over the last `days` days (assisting muscles count half).
export function weeklySets(db, days = 7, now = Date.now()) {
  const since = now - days * 86400000;
  const muscles = {};
  const parts = { biceps: {}, triceps: {}, chest: {} };
  for (const s of db.sessions) {
    if ((s.finishedAt || 0) < since) continue;
    for (const e of s.entries) {
      const ex = db.exercises[e.exerciseId];
      if (!ex || ['mobility', 'prehab'].includes(ex.pattern)) continue;
      const n = e.sets.filter((x) => !x.pain && x.type !== 'w' && (x.reps > 0 || x.time > 0 || x.dist > 0)).length;
      if (!n) continue;
      const add = (m, w) => {
        muscles[m] = (muscles[m] || 0) + n * w;
        const em = parts[m] && emphasis(ex, m);
        if (em) for (const [p, share] of Object.entries(em)) parts[m][p] = (parts[m][p] || 0) + n * w * share;
      };
      for (const m of ex.primary) add(m, 1);
      for (const m of ex.secondary) add(m, 0.5);
    }
  }
  return { muscles, parts };
}

// A group's recovery is that of its most fatigued muscle (that's what limits the next session).
export function groupFreshness(g, fresh) {
  return Math.min(...g.muscles.map((m) => fresh[m] ?? 1));
}
