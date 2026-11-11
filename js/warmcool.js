// Warm-up and cool-down routines around a lifting session.
//
// Warm-up: a few minutes of easy cardio, dynamic moves for the muscles about to work, and, when pain
// is logged, standard physical-therapy drills for that area. Warming up reliably helps performance
// (fradkin2010). The PT drills follow common clinical programs: rotator-cuff and shoulder-blade work
// for shoulders, bridges and clamshells for hips, the McGill "big three" for backs (aaos2017,
// mcgill2010), and isometric holds for sore knee tendons, which reduce pain for a while (rio2015).
// Cool-down: a short stretch. It does little for recovery (vanhooren2018) but helps people wind down,
// so it's optional. Sharp pain (level 3) gets no loading drills: rest it and get it looked at.
import { groupOf } from './engine.js';
import { activePain, areaLabel, JOINTS } from './pain.js';
import { todayStr, mondayOf, addDays } from './store.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// [exerciseId, sets, metric, target]
const GENERAL = {
  legs: [['leg-swing', 1, 'reps', 10], ['stretch-wgs', 1, 'time', 40], ['air-squat', 1, 'reps', 10]],
  push: [['arm-circle', 1, 'time', 30], ['scap-pushup', 1, 'reps', 10]],
  pull: [['arm-circle', 1, 'time', 30], ['band-pull-apart', 1, 'reps', 15]],
  core: [['stretch-catcow', 1, 'time', 40]],
};
const PREHAB = {
  shoulder: [['band-external-rotation', 2, 'reps', 12], ['scap-pushup', 2, 'reps', 10], ['band-pull-apart', 2, 'reps', 15]],
  knee: [['spanish-squat-hold', 3, 'time', 30], ['tke', 2, 'reps', 15], ['glute-bridge', 2, 'reps', 12]],
  hip: [['clamshell', 2, 'reps', 12], ['glute-bridge', 2, 'reps', 12], ['stretch-9090', 1, 'time', 45]],
  back: [['mcgill-curl-up', 2, 'reps', 6], ['bird-dog', 2, 'reps', 6], ['side-plank', 2, 'time', 20]],
  elbow: [['wrist-ext-eccentric', 2, 'reps', 12], ['forearm-stretch', 1, 'time', 30]],
  wrist: [['wrist-circle', 1, 'time', 30], ['forearm-stretch', 1, 'time', 30]],
  ankle: [['calf-raise-slow', 2, 'reps', 12], ['stretch-calf', 1, 'time', 30]],
  neck: [['chin-tuck', 2, 'reps', 10]],
};
// Which drill set a sore area uses.
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

// Whether a day gets a warm-up / cool-down: the plan-wide setting, unless changed for that date.
export function dayExtras(db, day) {
  const o = db.dayExtras?.[dateOf(day)] || {};
  return { warm: o.warm ?? !!db.settings.warmupRoutine, cool: o.cool ?? !!db.settings.cooldownRoutine };
}

export function setDayExtra(db, day, key, on) {
  db.dayExtras ||= {};
  const date = dateOf(day);
  db.dayExtras[date] = { ...(db.dayExtras[date] || {}), [key]: on };
  // Old dates aren't needed.
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
  const rows = [['warmup-cardio', 1, 'time', 180, 'Bike, rower or brisk walk at an easy pace']];
  for (const g of groups.slice(0, 2)) rows.push(...(GENERAL[g] || []));
  // PT drills for logged pain (not sharp pain), most relevant to today's muscles first.
  const trained = new Set(liftItems.flatMap((i) => [...(i.ex?.primary || []), ...(i.ex?.secondary || [])]));
  const pains = activePain(db).filter((r) => r.level < 3)
    .sort((a, b) => (JOINTS[b.area]?.muscles || [b.area]).some((m) => trained.has(m)) - (JOINTS[a.area]?.muscles || [a.area]).some((m) => trained.has(m)));
  let n = 0;
  for (const r of pains) {
    const set = PREHAB[AREA_SET[r.area]];
    if (!set || n >= 4) continue;
    for (const [id, sets, metric, target] of set.slice(0, 2)) { rows.push([id, sets, metric, target, `For your ${areaLabel(r.area, r.side).toLowerCase()}`]); n += 1; }
  }
  return build(db, day, rows.slice(0, 8), 'warmup');
}

export function cooldownItems(db, day, liftItems) {
  const rows = groupsTrained(liftItems).slice(0, 2).flatMap((g) => COOL[g] || []);
  return build(db, day, rows.slice(0, 4), 'cooldown');
}
