// Exercise variety: how often the plan swaps exercises for similar ones.
//
// What the research supports:
// - Rotating exercises for a muscle can match or beat fixed selection for muscle growth, and
//   people enjoy it more (fonseca2014, bazvalle2019).
// - Too much, unplanned rotation hurts strength, because strength is partly skill on a specific
//   lift (kassiano2022). So focus lifts never rotate, and rotation follows a schedule.
// - Swaps stay within the same movement pattern and main muscle, so weekly volume per muscle
//   doesn't change.
//
// Levels:
//   low    — the same exercises every week (best for strength and for learning lifts)
//   medium — accessories rotate each training block; compounds stay
//   high   — accessories rotate every week; non-focus compounds rotate each block
// Rotation uses the same "variants" mechanism as grip rotation (engine.js), so each variation
// keeps its own weights and history. Items the user set up by hand are left alone.
import { similarExercises } from './bank.js';
import { isAvailable } from './gym.js';

export const VARIETY = {
  low: { name: 'Consistent', desc: 'Same lifts every week. Best for strength and for learning the movements.' },
  medium: { name: 'Some variety', desc: 'Main lifts stay; accessories change each training block.' },
  high: { name: 'High variety', desc: 'Accessories change every week and secondary compounds each block. Focus lifts stay.' },
};

function candidates(db, item, taken, n, level) {
  const ex = db.exercises[item.exerciseId];
  return similarExercises(db.exercises, ex.id, 40)
    .filter(({ ex: e, samePattern }) => e.category === ex.category
      && (level === 'high' || samePattern) // some variety: the same movement; high: anything for that muscle
      && e.primary[0] === ex.primary[0]
      && isAvailable(db, e)
      && !['never', 'avoid'].includes(db.exPrefs?.[e.id])
      && !taken.has(e.id))
    .slice(0, n)
    .map(({ ex: e }) => e.id);
}

// Applies a variety level to the whole plan. focus: exercise ids that must not rotate.
export function applyVariety(db, level, focus = []) {
  let rotating = 0;
  for (const plan of Object.values(db.plan)) {
    if (!plan?.items) continue;
    const taken = new Set(plan.items.map((i) => i.exerciseId));
    for (const item of plan.items) {
      if (item.autoVar) { delete item.variants; delete item.rotate; delete item.autoVar; }
      if (item.role || item.variants || item.autoCore || item.lock) continue; // hand-made rotations and core (which keeps its own weekly balance) stay as they are
      const ex = db.exercises[item.exerciseId];
      if (!ex || ex.category === 'conditioning' || level === 'low' || !VARIETY[level]) continue;
      let n = 0;
      let rotate = '';
      if (ex.category === 'accessory') { n = level === 'high' ? 3 : 2; rotate = level === 'high' ? 'week' : 'block'; }
      else if (level === 'high' && !focus.includes(ex.id)) { n = 2; rotate = 'block'; }
      if (!n) continue;
      const alts = candidates(db, item, taken, n, level);
      if (!alts.length) continue;
      for (const id of alts) taken.add(id);
      Object.assign(item, { variants: [item.exerciseId, ...alts], rotate, autoVar: true });
      rotating += 1;
    }
  }
  db.settings.variety = level;
  return rotating;
}
