// Warm-up and cool-down routines around a lifting session.
//
// The warm-up follows the RAMP structure (jeffreys2007), which the research on warming up supports
// (mcgowan2015, fradkin2010):
//   1. Raise   — 3–5 minutes of easy cardio to raise muscle temperature.
//   2. Mobilize — dynamic drills through the ranges today's lifts use, one easy set each.
//      Dynamic stretching beforehand helps or is neutral for performance; long static holds right
//      before lifting can blunt it slightly, so static stretching waits for the cool-down (behm2016).
//   3. Prime   — two light sets of a movement that wakes up today's main muscles.
//      Easy enough to leave you fresh; the ramp-up sets on your first lift finish the job.
// Tailored to the day: the muscles doing the most work in today's lifts are the focus, and every
// focus muscle gets at least one drill. Drills are picked from the whole warm-up library and vary
// by date (with a shuffle), so two days that train the same muscles don't get the same routine.
//   4. Rehab   — when pain is logged, standard physical-therapy drills for that area (aaos2017,
//      mcgill2010), e.g. isometric holds for sore knee tendons (rio2015). None for sharp pain.
// About 8–10 minutes in all. The cool-down is a short static stretch; it does little for recovery
// (vanhooren2018) but is a pleasant way to wind down, so it's optional.
import { groupOf } from './engine.js';
import { activePain, areaLabel, JOINTS } from './pain.js';
import { todayStr, addDays, dateOfDay } from './store.js';
import { isAvailable } from './gym.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// [exerciseId, sets, metric, target]
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

const dateOf = (day) => dateOfDay(day);

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

// Warm-up drills (conditioning-type moves, so they never count toward progression).
// mobilize: dynamic range of motion, one set. prime: light activation, two sets.
const DRILLS = {
  mobilize: ['leg-swing', 'arm-circle', 'hip-circle', 'ankle-rock', 'open-book', 'inchworm', 'knee-hug-walk', 'band-dislocate', 'wall-slide',
    'stretch-catcow', 'stretch-wgs', 'stretch-thread', 'stretch-9090', 'wrist-circle',
    'arm-swing', 'shoulder-car', 'hip-car', 'reach-open', 'spiderman-lunge', 'lateral-lunge-stretch', 'leg-cradle', 'toy-soldier', 'butt-kick', 'a-skip', 'carioca', 'neck-circle', 'tspine-extension', 'wrist-rock', 'ankle-circle', 'adductor-rockback', 'hip-flexor-rock', 'goblet-hold'],
  prime: ['scap-pushup', 'scap-pull', 'band-pull-apart', 'band-external-rotation', 'prone-ytw', 'glute-bridge', 'glute-bridge-march',
    'lateral-band-walk', 'clamshell', 'air-squat', 'bodyweight-lunge', 'step-up-bw', 'calf-raise-slow', 'plank', 'side-plank',
    'hip-airplane', 'fire-hydrant', 'band-row-light', 'cuban-rotation', 'banded-squat'],
};

// A small seeded random generator, so a day's warm-up stays the same until it's shuffled.
function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

// The muscles today's lifts work hardest, in order (sets on primary muscles, half for assisting).
function recentDrills(db, days = 6) {
  const since = addDays(todayStr(), -days);
  const out = new Map();
  for (const s of db.sessions || []) {
    if (s.date < since) continue;
    for (const e of s.entries) if (/^(warmup|cooldown)-/.test(e.uid || '')) out.set(e.exerciseId, (out.get(e.exerciseId) || 0) + 1);
  }
  return out;
}

function focusMuscles(liftItems) {
  const w = {};
  for (const it of liftItems) {
    const n = it.sets || 3;
    for (const m of it.ex?.primary || []) w[m] = (w[m] || 0) + n;
    for (const m of it.ex?.secondary || []) w[m] = (w[m] || 0) + n * 0.3;
  }
  return Object.keys(w).sort((x, y) => w[y] - w[x]).filter((m) => w[m] >= 3).slice(0, 5);
}

export function warmupItems(db, day, liftItems) {
  const date = dateOf(day);
  const rand = rng(`${date}:${day}:${db.dayExtras?.[date]?.warmSeed || 0}`);
  const focus = focusMuscles(liftItems);
  const recent = recentDrills(db);
  const ok = (id) => { const e = db.exercises[id]; return e && isAvailable(db, e) && db.exPrefs?.[id] !== 'never'; };
  const covers = (id, m) => { const e = db.exercises[id]; return e.primary.includes(m) ? 1 : e.secondary.includes(m) ? 0.4 : 0; };
  const rows = [['warmup-cardio', 1, 'time', 180, 'Raise: bike, rower or brisk walk, easy pace']];
  // PT drills for logged pain (not sharp pain), most relevant to today's muscles first.
  const trained = new Set(liftItems.flatMap((i) => [...(i.ex?.primary || []), ...(i.ex?.secondary || [])]));
  const pains = activePain(db).filter((r) => r.level < 3)
    .sort((a, b) => (JOINTS[b.area]?.muscles || [b.area]).some((m) => trained.has(m)) - (JOINTS[a.area]?.muscles || [a.area]).some((m) => trained.has(m)));
  const rehab = [];
  for (const r of pains) {
    const set = PREHAB[AREA_SET[r.area]];
    if (!set || rehab.length >= 2) continue;
    for (const [id, sets, metric, target] of set.slice(0, 2)) if (rehab.length < 2 && ok(id)) rehab.push([id, sets, metric, target, `Rehab: for your ${areaLabel(r.area, r.side).toLowerCase()}`]);
  }
  // Cover every focus muscle: for each one still uncovered, pick a drill that covers it (and as many
  // other focus muscles as possible), choosing at random among the near-best. Mobilize drills first.
  const chosen = { mobilize: [], prime: [] };
  const covered = new Map(focus.map((m) => [m, 0]));
  for (const id of rehab.map((r) => r[0])) for (const m of focus) covered.set(m, covered.get(m) + covers(id, m));
  const limit = { mobilize: 3, prime: 3 };
  const pick = (kind, need) => {
    const pool = DRILLS[kind].filter((id) => ok(id) && !chosen.mobilize.includes(id) && !chosen.prime.includes(id) && !rehab.some((r) => r[0] === id));
    const score = (id) => (need ? covers(id, need) * 3 : 0) + focus.reduce((acc, m) => acc + (covered.get(m) < 1 ? covers(id, m) : covers(id, m) * 0.2), 0)
      - (recent.get(id) || 0) * 0.8 + (db.exPrefs?.[id] === 'prefer' ? 0.6 : 0) - (db.exPrefs?.[id] === 'avoid' ? 2 : 0);
    const ranked = pool.map((id) => ({ id, sc: score(id) })).filter((x) => x.sc > 0 && (!need || covers(x.id, need) > 0)).sort((p, q) => q.sc - p.sc);
    if (!ranked.length) return false;
    const near = ranked.filter((x) => x.sc >= ranked[0].sc - 0.9);
    const id = near[Math.floor(rand() * near.length)].id;
    chosen[kind].push(id);
    for (const m of focus) covered.set(m, covered.get(m) + covers(id, m));
    return true;
  };
  for (const m of focus) {
    if (covered.get(m) >= 1) continue;
    // Alternate which kind tries first, so the routine isn't always the same shape.
    const order = rand() < 0.5 ? ['mobilize', 'prime'] : ['prime', 'mobilize'];
    for (const k of order) if (chosen[k].length < limit[k] && pick(k, m) && covered.get(m) >= 1) break;
  }
  // At least one of each kind.
  for (const k of ['mobilize', 'prime']) if (!chosen[k].length) pick(k, null);
  // At least four drills in all, still chosen for today's muscles.
  while (chosen.mobilize.length + chosen.prime.length < 4) {
    const k = chosen.mobilize.length <= chosen.prime.length ? 'mobilize' : 'prime';
    if (!pick(k, null) && !pick(k === 'mobilize' ? 'prime' : 'mobilize', null)) break;
  }
  const target = (id, kind) => {
    const e = db.exercises[id];
    const metric = e.metric === 'time' ? 'time' : 'reps';
    return [id, kind === 'prime' ? 2 : 1, metric, metric === 'time' ? (kind === 'prime' ? 20 : 30) : kind === 'prime' ? 10 : 8,
      kind === 'prime' ? 'Prime: light, stop well short of tired' : 'Mobilize: smooth, through the full range'];
  };
  rows.push(...chosen.mobilize.map((id) => target(id, 'mobilize')), ...rehab, ...chosen.prime.map((id) => target(id, 'prime')));
  return build(db, day, rows.slice(0, 8), 'warmup');
}

// Which focus muscles a warm-up covers (for the "why" line).
export function warmupFocus(liftItems) { return focusMuscles(liftItems); }

export function shuffleWarmup(db, day) {
  db.dayExtras ||= {};
  const date = dateOf(day);
  db.dayExtras[date] = { ...(db.dayExtras[date] || {}), warmSeed: (db.dayExtras[date]?.warmSeed || 0) + 1 };
}

export function cooldownItems(db, day, liftItems) {
  const date = dateOf(day);
  const rand = rng(`cool:${date}:${day}:${db.dayExtras?.[date]?.warmSeed || 0}`);
  const focus = focusMuscles(liftItems).slice(0, 4);
  const recent = recentDrills(db);
  // Static stretches (timed holds), not foam rolling or dynamic drills.
  const pool = Object.values(db.exercises).filter((e) => e.pattern === 'mobility' && e.metric === 'time' && !/^roll-/.test(e.id)
    && isAvailable(db, e) && !['never', 'avoid'].includes(db.exPrefs?.[e.id]));
  const chosen = [];
  for (const m of focus) {
    if (chosen.length >= 4 || chosen.some((e) => e.primary.includes(m))) continue;
    const opts = pool.filter((e) => e.primary.includes(m) && !chosen.includes(e))
      .map((e) => ({ e, sc: 1 - (recent.get(e.id) || 0) * 0.5 + (db.exPrefs?.[e.id] === 'prefer' ? 0.5 : 0) }))
      .sort((a, b) => b.sc - a.sc);
    if (!opts.length) continue;
    const near = opts.filter((x) => x.sc >= opts[0].sc - 0.5);
    chosen.push(near[Math.floor(rand() * near.length)].e);
  }
  if (chosen.length < 3) for (const r of groupsTrained(liftItems).flatMap((g) => COOL[g] || [])) { const e = db.exercises[r[0]]; if (e && chosen.length < 3 && !chosen.includes(e)) chosen.push(e); }
  const rows = chosen.map((e) => [e.id, 1, 'time', 40, 'Hold gently, breathe slowly']);
  return build(db, day, rows, 'cooldown');
}

// Rough length of a warm-up, in minutes.
export const warmupMinutes = (items) => Math.round(items.reduce((a, it) => a + (it.metric === 'time' ? (it.target * it.sets) / 60 : it.sets * 0.6), 0) + items.length * 0.25);
