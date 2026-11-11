// Core training: where it goes in the week, and a balanced rotation of core exercises.
//
// The evidence (refs in science.js):
// - Train the trunk in all its jobs: resisting extension (planks, rollouts, dead bugs), resisting
//   rotation and side-bending (Pallof press, side planks, carries), plus flexion and hip flexion
//   (crunches, leg raises) (mcgill2010, hibbs2008).
// - Abs grow with progressive load like other muscles, so some of the week is weighted; the rest is
//   bodyweight holds and control work, which build the endurance that protects the spine.
// - Hard core work right before heavy squats or deadlifts tires the muscles that brace the spine
//   (granata2008), so core goes after lifting by default; "warm-up" uses light activation only.
//
// Placements (db.settings.corePlacement):
//   end          — one core exercise finishes every lifting day (default)
//   warmup       — light activation before the first lift; no hard core on lift days
//   finisher     — core goes into end-of-workout finishers instead of lift days
//   conditioning — core circuits are added to interval/conditioning sessions only
// Core exercises taken off lift days are kept in db.coreParked and come back when switching to "end".
import { DAY_KEYS } from './engine.js';
import { isAvailable } from './gym.js';
import { relabelGroups } from './week.js';

export const CORE_PLACEMENTS = {
  end: { name: 'End of lifts', desc: 'One core exercise finishes each lifting day, alternating weighted and bodyweight through the week.' },
  warmup: { name: 'Warm-up', desc: 'Light core activation before your first lift. Low effort, so it doesn\'t tire you for heavy lifts.' },
  finisher: { name: 'Finishers', desc: 'Core goes into your end-of-workout finishers instead of lifting days.' },
  conditioning: { name: 'Cardio only', desc: 'A short core circuit is added to interval and conditioning sessions.' },
};

// Each kind of core work, with weighted and bodyweight options in order of preference.
const KINDS = {
  flexion: { w: ['cable-crunch', 'ab-crunch-machine', 'decline-situp', 'ball-crunch'], bw: ['mcgill-curl-up', 'crunch'] },
  antiExtension: { w: ['weighted-plank', 'ab-wheel'], bw: ['dead-bug', 'plank', 'hollow-hold', 'ab-wheel'] },
  antiRotation: { w: ['pallof-press'], bw: ['bird-dog', 'side-plank'] },
  hipFlexion: { w: ['hanging-leg-raise', 'vertical-leg-raise'], bw: ['hanging-leg-raise', 'leg-raise', 'vertical-leg-raise'] },
  rotation: { w: ['cable-woodchop', 'landmine-rotation'], bw: ['bird-dog'] },
  lateral: { w: ['suitcase-carry'], bw: ['side-plank'] },
};
// Through the week: a different kind each lifting day, alternating weighted and bodyweight.
const ROTATION = [['flexion', 'w'], ['antiExtension', 'bw'], ['antiRotation', 'w'], ['hipFlexion', 'bw'], ['rotation', 'w'], ['lateral', 'bw']];
const ACTIVATION = ['dead-bug', 'bird-dog', 'side-plank', 'mcgill-curl-up', 'plank'];
export const CORE_FINISHER = ['mountain-climber', 'plank', 'hollow-hold', 'crunch', 'dead-bug', 'ab-wheel'];

const CORE_PATTERNS = ['core-flexion', 'hip-flexion', 'anti-extension', 'anti-rotation', 'rotation', 'anti-lateral'];
const ALL_IDS = new Set([...Object.values(KINDS).flatMap((k) => [...k.w, ...k.bw]), ...ACTIVATION]);

export function isCore(ex) {
  if (!ex) return false;
  if (ALL_IDS.has(ex.id)) return true;
  return ex.category !== 'compound' && ex.primary.some((m) => m === 'abs' || m === 'obliques') && CORE_PATTERNS.includes(ex.pattern);
}

// How to dose each move: holds by time, carries by distance, the rest by reps.
function dose(db, id, warm) {
  const ex = db.exercises[id];
  const perSide = ['side-plank', 'bird-dog', 'pallof-press', 'cable-woodchop', 'landmine-rotation', 'suitcase-carry', 'dead-bug'].includes(id);
  const note = [warm ? 'Core activation · easy effort' : 'Core', perSide ? 'each side' : ''].filter(Boolean).join(' · ');
  if (ex.metric === 'time' || ['hollow-hold', 'weighted-plank'].includes(id)) return { sets: warm ? 2 : 3, metric: 'time', target: warm ? 20 : id === 'side-plank' ? 30 : 40, repMin: 1, repMax: 1, restSec: warm ? 20 : 45, note };
  if (ex.metric === 'distance') return { sets: 3, metric: 'distance', target: 40, repMin: 1, repMax: 1, restSec: 60, note };
  if (warm) return { sets: 2, repMin: 6, repMax: 8, restSec: 20, note };
  const leg = ex.pattern === 'hip-flexion';
  return { sets: 3, repMin: leg ? 8 : 10, repMax: leg ? 12 : 15, restSec: 60, note };
}

function usable(db, id, used) {
  const ex = db.exercises[id];
  return ex && !used.has(id) && isAvailable(db, ex) && db.exPrefs?.[id] !== 'never';
}

function pickFor(db, step, used) {
  const [kind, load] = ROTATION[step % ROTATION.length];
  const k = KINDS[kind];
  const order = load === 'w' ? [...k.w, ...k.bw] : [...k.bw, ...k.w];
  return order.find((id) => usable(db, id, used))
    || ROTATION.flatMap(([kk]) => [...KINDS[kk].w, ...KINDS[kk].bw]).find((id) => usable(db, id, used)) || null;
}

const liftDays = (db) => DAY_KEYS.filter((d) => db.plan[d]?.items?.length && ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift'));

// Rebuilds core across the weekly plan for a placement. Returns a short summary.
export function applyCore(db, placement = 'end') {
  db.coreParked ||= {};
  const used = new Set();
  let step = 0;
  let added = 0;
  for (const d of liftDays(db)) {
    let items = db.plan[d].items.filter((it) => !it.autoCore);
    const isCoreItem = (it) => isCore(db.exercises[it.exerciseId]);
    if (placement === 'end') {
      for (const p of db.coreParked[d] || []) if (!items.some((x) => x.uid === p.uid)) items.push(p);
      delete db.coreParked[d];
      const core = items.filter(isCoreItem);
      items = [...items.filter((it) => !isCoreItem(it)), ...core];
      if (core.length) core.forEach((c) => used.add(c.exerciseId));
      else {
        const id = pickFor(db, step, used);
        if (id) { used.add(id); added++; items.push({ uid: `${d}-core-${Date.now().toString(36)}`, exerciseId: id, group: 'zcore', autoCore: true, ...dose(db, id, false) }); }
      }
    } else {
      const core = items.filter(isCoreItem);
      if (core.length) { db.coreParked[d] = [...(db.coreParked[d] || []), ...core]; items = items.filter((it) => !isCoreItem(it)); }
      if (placement === 'warmup') {
        const id = ACTIVATION.find((x) => usable(db, x, used)) || ACTIVATION.find((x) => db.exercises[x]);
        if (id) { used.add(id); added++; items.unshift({ uid: `${d}-corew-${Date.now().toString(36)}`, exerciseId: id, group: '0core', autoCore: true, coreWarm: true, ...dose(db, id, true) }); }
      }
    }
    step += 1;
    db.plan[d].items = relabelGroups(items);
  }
  db.settings.corePlacement = placement;
  return { added, days: step };
}

// A short core circuit for conditioning sessions: a hold and a side plank, linked.
export function coreCircuit(db) {
  const a = ['plank', 'hollow-hold', 'dead-bug'].find((id) => db.exercises[id]) || 'plank';
  return { id: 'core-circuit', name: 'Core circuit', circuit: true, items: [[a, 2, 'time', 40, 0], ['side-plank', 2, 'time', 30, 45]] };
}
