// Training goal per muscle group or per exercise: strength, size or endurance.
// Each goal sets the rep range and rest. Load and reps can be traded fairly freely for muscle growth,
// but heavy, low-rep work builds the most maximal strength and light, high-rep work the most local
// muscular endurance (schoenfeld2017load, acsm2009, schoenfeld2016rest).
//
// db.muscleGoals = { groupId: goal } and plan items may carry item.goal (one exercise).
// The exercise's own goal wins, then its main muscle's group, then the plan's defaults.
import { groupOfMuscle } from './groups.js';

export const GOALS = {
  strength: { name: 'Strength', desc: 'Heavier weights for fewer reps, with long rests.' },
  size: { name: 'Size', desc: 'Moderate weights in the classic muscle-building range.' },
  endurance: { name: 'Endurance', desc: 'Lighter weights for many reps, with short rests.' },
};

// [repMin, repMax, restSec] for compounds and for accessories under each goal.
const RX = {
  strength: { compound: [3, 6, 180], accessory: [6, 10, 120] },
  size: { compound: [6, 10, 150], accessory: [8, 15, 90] },
  endurance: { compound: [12, 20, 60], accessory: [15, 25, 45] },
};

export function goalFor(db, item, ex) {
  if (item?.goal) return item.goal;
  const g = groupOfMuscle(ex?.primary?.[0]);
  return (g && db.muscleGoals?.[g.id]) || null;
}

// Rep range and rest for an exercise under a goal (null when no goal applies).
export function goalRx(goal, ex) {
  const r = RX[goal]?.[ex?.category === 'compound' ? 'compound' : 'accessory'];
  return r ? { repMin: r[0], repMax: r[1], restSec: r[2] } : null;
}

// Applies goals to the plan: every item whose exercise or main muscle has a goal gets its range.
// Items with no goal are left exactly as they are. Returns how many changed.
export function applyGoals(db) {
  let n = 0;
  for (const p of Object.values(db.plan)) {
    for (const it of p.items || []) {
      const ex = db.exercises[it.exerciseId];
      if (!ex || it.autoCore || ex.category === 'conditioning' || ['mobility', 'prehab'].includes(ex.pattern)) continue;
      const rx = goalRx(goalFor(db, it, ex), ex);
      if (!rx) continue;
      if (it.repMin !== rx.repMin || it.repMax !== rx.repMax || it.restSec !== rx.restSec) n += 1;
      Object.assign(it, rx);
    }
  }
  return n;
}
