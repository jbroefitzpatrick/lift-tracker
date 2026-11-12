// Warm-up and cool-down routines around a lifting session.
//
// The warm-up follows the RAMP structure (jeffreys2007), which the research on warming up supports
// (mcgowan2015, fradkin2010):
//   1. Raise   — 3–5 minutes of easy cardio to raise muscle temperature.
//   2. Mobilize — dynamic stretches through the ranges today's lifts use, one easy set each.
//      Dynamic stretching beforehand helps or is neutral for performance; long static holds right
//      before lifting can blunt it slightly, so static stretching waits for the cool-down (behm2016).
//   3. Prime   — two light sets of 8–10 reps of a movement that wakes up today's main muscles.
//      Easy enough to leave you fresh; the ramp-up sets on your first lift finish the job.
//   4. Rehab   — when pain is logged, standard physical-therapy drills for that area (aaos2017,
//      mcgill2010), e.g. isometric holds for sore knee tendons (rio2015). None for sharp pain.
// About 8–10 minutes in all. The cool-down is a short static stretch; it does little for recovery
// (vanhooren2018) but is a pleasant way to wind down, so it's optional.
import { groupOf } from './engine.js';
import { activePain, areaLabel, JOINTS } from './pain.js';
import { todayStr, mondayOf, addDays } from './store.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// [exerciseId, sets, metric, target]
const MOBILIZE = {
  legs: [['leg-swing', 1, 'reps', 10], ['stretch-wgs', 1, 'reps', 5]],
  push: [['arm-circle', 1, 'time', 30], ['stretch-thread', 1, 'reps', 6]],
  pull: [['arm-circle', 1, 'time', 30], ['stretch-catcow', 1, 'reps', 8]],
  core: [['stretch-catcow', 1, 'reps', 8]],
};
const PRIME = {
  legs: [['glute-bridge', 2, 'reps', 10], ['lateral-band-walk', 2, 'reps', 10]],
  push: [['scap-pushup', 2, 'reps', 10], ['band-pull-apart', 2, 'reps', 12]],
  pull: [['scap-pull', 2, 'reps', 8], ['band-pull-apart', 2, 'reps', 12]],
  core: [['dead-bug', 2, 'reps', 6]],
};
const PREHAB = {
  shoulder: [['band-external-rotation', 2, 'reps', 12], ['scap-pushup', 2, 'reps', 10]],
  knee: [['spanish-squat-hold', 3, 'time', 30], ['tke', 2, 'reps', 15]],
  hip: [['clamshell', 2, 'reps', 12], ['glute-bridge', 2, 'reps', 12]],
  back: [['mcgill-curl-up', 2, 'reps', 6], ['bird-dog', 2, 'reps', 6], ['side-plank', 2, 'time', 20]],
  elbow: [['wrist-ext-eccentric', 2, 'reps', 12], ['forearm-stretch', 1, 'time', 30]],
  wrist: [['wrist-circle', 1, 'time', 30], ['forearm-stretch', 1, 'time', 30]],
  ankle: [['calf-raise-slow', 2, 'reps', 12], ['stretch-calf', 1, 'time', 30]],
  neck: [['chin-tuck', 2, 'reps', 10]],
};
const AREA_SET = {
  shoulder: 'shoulder', chest: 'shoulder', 'front-delts': 'shoulder', 'side-delts': 'shoulder', 'rear-delts': 'shoulder', lats: 'shoulder', 'upper-back': 'shoulder', traps: 'neck', neck: 'neck',
  knee: 'knee', quads: 'knee', hamstrings: 'hip', hip: 'hip', glutes: 'hip', adductors: 'hip', abductors: 'hip', 'hip-flexors': 'hip',
  'lower-back': 'back', abs: 'back', obliques: 'back', elbow: 'elbow', biceps: 'elbow', triceps: 'elbow', forearms: 'wrist', wrist: 'wrist', ankle: 'ankle', calves: 'ankle',
};
const COOL = {
  legs: [['stretch-couch', 1, 'time', 45], ['stretch-hamstring', 1, 'time', 45], ['stretch-pigeon', 1, 'time', 45]],
  push: [['stretch-chest', 1, 'time', 45], ['stretch-crossbody', 1, 'time', 30]],
  pull: [['stretch-child', 1, 'time', 45], ['dead-hang', 1, 'time', 30]],
  core: [['stretch-catcow', 1, 'time', 40]],
};

const dateOf = (day) => addDays(mondayOf(todayStr()), DAY_KEYS.indexOf(day));

export function dayExtras(db, day) {
  const o = db.dayExtras?.[dateOf(day)] || {};
  return { warm: o.warm ?? !!db.settings.warmupRoutine, cool: o.cool ?? !!db.settings.cooldownRoutine };
}

export function setDayExtra(db, day, key, on) {
  db.dayExtras ||= {};
  const date = dateOf(day);
  db.dayExtras[date] = { ...(db.dayExtras[date] || {}), [key]: on };
  for (const d of Object.keys(db.dayExtras)) if (d < addDays(todayStr(), -14)) delete db.dayExtras[d];
}

function groupsTrained(items) {
  const sets = {};
  for (const it of items) { const g = groupOf(it.ex?.primary[0]); if (g) sets[g] = (sets[g] || 0) + (it.sets || 3); }
  return Object.keys(sets).sort((a, b) => sets[b] - sets[a]);
}

function build(db, day, rows, phase) {
  const seen = new Set();
  return rows.filter(([id]) => db.exercises[id] && !seen.has(id) && seen.add(id)).map(([id, sets, metric, target, note], i) => ({
    uid: `${phase}-${day}-${id}`, exerciseId: id, group: `${phase === 'warmup' ? 'W' : 'C'}${i + 1}`, sets, metric, target,
    repMin: metric === 'reps' ? target : 1, repMax: metric === 'reps' ? target : 1, restSec: 0, note: note || '', phase,
    ex: db.exercises[id],
  }));
}

export function warmupItems(db, day, liftItems) {
  const groups = groupsTrained(liftItems);
  const main = groups[0];
  const second = groups.find((g) => g !== main && g !== 'core');
  const rows = [['warmup-cardio', 1, 'time', 180, 'Raise: bike, rower or brisk walk, easy pace']];
  for (const g of [main, second].filter(Boolean)) for (const r of MOBILIZE[g] || []) rows.push([...r, 'Mobilize: smooth, through the full range']);
  // PT drills for logged pain (not sharp pain), most relevant to today's muscles first.
  const trained = new Set(liftItems.flatMap((i) => [...(i.ex?.primary || []), ...(i.ex?.secondary || [])]));
  const pains = activePain(db).filter((r) => r.level < 3)
    .sort((a, b) => (JOINTS[b.area]?.muscles || [b.area]).some((m) => trained.has(m)) - (JOINTS[a.area]?.muscles || [a.area]).some((m) => trained.has(m)));
  let rehab = 0;
  for (const r of pains) {
    const set = PREHAB[AREA_SET[r.area]];
    if (!set || rehab >= 3) continue;
    for (const [id, sets, metric, target] of set.slice(0, 2)) { rows.push([id, sets, metric, target, `Rehab: for your ${areaLabel(r.area, r.side).toLowerCase()}`]); rehab += 1; }
  }
  // Prime: the main muscle group (two light sets), plus the second group if there's no rehab work.
  for (const g of [main, rehab ? null : second].filter(Boolean)) {
    const p = PRIME[g]?.[0];
    if (p) rows.push([...p, 'Prime: 2 light sets, stop well short of tired']);
  }
  return build(db, day, rows.slice(0, 8), 'warmup');
}

export function cooldownItems(db, day, liftItems) {
  const rows = groupsTrained(liftItems).slice(0, 2).flatMap((g) => COOL[g] || []).map((r) => [...r, 'Hold gently, breathe slowly']);
  return build(db, day, rows.slice(0, 4), 'cooldown');
}

// Rough length of a warm-up, in minutes.
export const warmupMinutes = (items) => Math.round(items.reduce((a, it) => a + (it.metric === 'time' ? (it.target * it.sets) / 60 : it.sets * 0.6), 0) + items.length * 0.25);
