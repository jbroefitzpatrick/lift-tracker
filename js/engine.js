// Progression engine: double progression + adaptation + deloads (spec section 3).
import { daysBetween, parseDate, todayStr, mondayOf } from './store.js';
import { runItemsFor } from './running.js';
import { ROW_ROTATION } from './plan.js';
import { activeGym, isAvailable } from './gym.js';
import { similarExercises } from './bank.js';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

export function dayKeyOf(dateStr) {
  return DAY_KEYS[(parseDate(dateStr).getDay() + 6) % 7];
}

export const e1rm = (weight, reps) => (weight || 0) * (1 + (reps || 0) / 30);

export function roundTo(w, step) {
  const s = step > 0 ? step : 5;
  return Math.round(w / s) * s;
}

function reduceBy(w, pct, step) {
  let r = roundTo(w * (1 - pct), step);
  if (r >= w) r = w - step;
  return Math.max(0, r);
}

export function groupNum(group) {
  const m = String(group || '').match(/^\d+/);
  return m ? m[0] : String(group);
}

// ---------- Weeks & deloads ----------

export function weekInfo(db, date = todayStr()) {
  const n = Number(db.settings.deloadEvery) || 5;
  const days = daysBetween(db.settings.programStart, date);
  const week = Math.max(1, Math.floor(days / 7) + 1);
  const cyclePos = ((week - 1) % n) + 1;
  return { week, cyclePos, cycleLen: n, isDeload: cyclePos === n && !db.settings.deloadOff };
}

// True during the week right after a deload, until the user answers the prompt.
export function needsRotationPrompt(db, date = todayStr()) {
  const rotates = Object.values(db.plan).some((d) => d.items?.some((i) => i.role === 'rowCompound'));
  if (!rotates) return false;
  const { week, cyclePos } = weekInfo(db, date);
  return week > 1 && cyclePos === 1 && db.settings.rotationPromptWeek !== week;
}

export function nextRowCompound(db) {
  return ROW_ROTATION[(db.settings.rowRotation + 1) % ROW_ROTATION.length];
}

// ---------- Plan resolution ----------

// Muscle groups used for recovery check-ins and "lighter next week" adjustments.
export const RECOVERY_GROUPS = {
  legs: { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'] },
  push: { name: 'Chest and shoulders', muscles: ['chest', 'front-delts', 'side-delts', 'triceps'] },
  pull: { name: 'Back and arms', muscles: ['lats', 'upper-back', 'rear-delts', 'biceps', 'traps', 'forearms'] },
  core: { name: 'Core and lower back', muscles: ['abs', 'obliques', 'lower-back', 'hip-flexors'] },
};
export const groupOf = (m) => Object.keys(RECOVERY_GROUPS).find((g) => RECOVERY_GROUPS[g].muscles.includes(m));

// This week's adjusted version of a day (from the week planner or "adjust today"), if any.
// Overrides belong to one Monday-to-Sunday week and are ignored once it's over.
export function weekOverride(db, day, date = todayStr()) {
  const w = db.week;
  if (!w || w.start !== mondayOf(date)) return null;
  return w.days?.[day] || null;
}

// The day's lifting plan this week: the override if there is one, otherwise the weekly plan.
export function dayPlan(db, day) {
  const o = weekOverride(db, day);
  if (o) return o.items?.length ? o : null;
  return db.plan[day] || null;
}

// Rotating variations (e.g. pullup grips): which one is up, per training block or per workout.
function pickVariant(db, item) {
  const v = item.variants;
  if (!Array.isArray(v) || v.length < 2) return item.exerciseId;
  if (item.rotate === 'workout') {
    const n = db.sessions.filter((s) => s.entries.some((e) => v.includes(e.exerciseId))).length;
    return v[n % v.length];
  }
  const wi = weekInfo(db);
  if (item.rotate === 'week') return v[(wi.week - 1) % v.length];
  return v[(Math.ceil(wi.week / wi.cycleLen) - 1) % v.length];
}

// Returns the day's items with weekly overrides, rotations, race-block swaps, recovery and
// running-goal adjustments applied. The stored plan is never changed by these.
// opts.template: the weekly plan as written, without this week's overrides or runs.
export function resolveDay(db, day, opts = {}) {
  const plan = opts.template ? db.plan[day] || null : dayPlan(db, day);
  const runs = opts.template ? [] : runItemsFor(db, day);
  if (!plan) return runs.map((r) => ({ ...r, ex: db.exercises[r.exerciseId] })).filter((r) => r.ex);
  const race = db.settings.raceBlock;
  const compound = ROW_ROTATION[db.settings.rowRotation % ROW_ROTATION.length];
  const out = [];
  for (const raw of plan.items) {
    const item = { ...raw };
    if (item.variants) item.exerciseId = pickVariant(db, item);
    if (item.role === 'rowCompound') item.exerciseId = compound;
    if (item.role === 'rowAccessory') item.exerciseId = compound === 'lat-pulldown' ? 'cable-row' : 'lat-pulldown';
    if (race && day === 'mon' && raw.exerciseId === 'iso-row') {
      Object.assign(item, { exerciseId: 'deadlift', repMin: 5, repMax: 8, restSec: 180, note: 'Race block: deadlift replaces iso row' });
    }
    if (race && day === 'fri' && raw.exerciseId === 'deadlift') {
      Object.assign(item, { exerciseId: 'rdl', repMin: 8, repMax: 12, restSec: 150, note: 'Race block: RDL replaces deadlift' });
    }
    if (race && raw.exerciseId === 'ghr') continue;
    item.ex = db.exercises[item.exerciseId];
    if (!item.ex) continue;
    // Not at this gym (missing equipment or marked never): use the closest exercise that is.
    if (!opts.template && db.gyms?.length && !isAvailable(db, item.ex)) {
      const alt = similarExercises(db.exercises, item.ex.id, 40).find(({ ex: e }) => isAvailable(db, e) && e.category === item.ex.category);
      if (alt) { item.note = `In place of ${item.ex.name}, which isn't available at ${activeGym(db).name}`; item.exerciseId = alt.ex.id; item.ex = alt.ex; }
    }
    // Slow recovery last week: one set fewer this week on that muscle group (learned from check-ins).
    const adj = db.recoveryAdjust?.[groupOf(item.ex.primary[0])];
    if (adj && adj.week === mondayOf(todayStr()) && item.ex.category !== 'conditioning' && item.sets > 2) {
      item.sets -= 1;
      item.note = item.note || 'One set lighter this week to help recovery';
    }
    // Running goal with lifting at maintenance: accessories drop to 2–3 sets (bickel2011).
    if (db.runGoal?.liftMaintenance && item.ex.category === 'accessory' && item.sets > 2) item.sets -= 1;
    out.push(item);
  }
  for (const r of runs) { const ex = db.exercises[r.exerciseId]; if (ex) out.push({ ...r, ex }); }
  return out;
}

// ---------- Targets ----------

export function getState(db, exId) {
  const ex = db.exercises[exId];
  const st = db.state[exId] || {};
  return {
    targetWeight: st.targetWeight !== undefined ? st.targetWeight : ex?.startWeight ?? null,
    targetReps: st.targetReps ?? null,
    targetTotal: st.targetTotal ?? null,
    tm: st.tm ?? null, // training max, for percentage cycles
    cycleIdx: st.cycleIdx || 0, // where a per-session rotation (heavy, medium, light) is up to
    stage: st.stage || 0, // rep stage for "weight, then fewer reps"
    misses: st.misses || 0,
    stallCount: st.stallCount || 0,
    lastIncreaseDate: st.lastIncreaseDate || null,
    painDates: st.painDates || [],
    last: st.last || null,
    status: st.status || null,
    message: st.message || '',
  };
}

export function painWarning(st, date = todayStr()) {
  return st.painDates.filter((d) => daysBetween(d, date) <= 14).length >= 2;
}

// ---------- Progression schemes ----------
// How a lift moves forward. The global setting (db.settings.progression) applies to the block's
// focus lifts; every other lift adds reps, then weight. A lift can also have its own scheme
// (ex.progression), which wins over the global setting.
//   double     — add reps until every set hits the top of the range, then add weight (acsm2009).
//   linear     — fixed reps; add weight every session all sets are completed (rippetoe2011).
//   stages     — add weight every session; on a miss keep the weight and drop to fewer reps per set
//                (5×3 → 6×2 → 10×1), then reset ~15% lighter. The GZCLP tier-1 model (lefever2016).
//   topset     — one heavy set at ~2 reps in reserve, then back-off sets at 90%. Load follows how
//                the top set went (helms2018).
//   wave       — three-week waves at a percentage of a training max, last set as many reps as
//                possible; the training max rises each wave (wendler2009).
//   undulating — each session of a lift rotates volume → medium → heavy (zourdos2016). Periodized
//                loading builds maximal strength better than unvaried loading (williams2017, moesgaard2022).
//   pyramid    — heaviest set first, then ~10% lighter and 2 more reps each set (reverse pyramid).
export const PROGRESSIONS = {
  double: { name: 'Reps, then weight', short: 'Add reps, then weight', fit: 'Any goal, any level', desc: 'Add reps until every set reaches the top of the range, then add weight and start again.', refs: ['acsm2009'] },
  linear: { name: 'Add weight', short: 'Add weight each time', fit: 'Beginners, strength', desc: 'Same reps every session; the weight goes up each time you complete every set. Fastest while you are new to a lift.', refs: ['rippetoe2011'] },
  stages: { name: 'Weight, then fewer reps', short: '5×3 → 6×2 → 10×1', fit: 'Late beginners, strength', desc: 'Add weight every session at 5 × 3. When you miss, keep the weight and switch to 6 × 2, then 10 × 1. After that, drop about 15% and start again. Stretches out the add-weight phase.', refs: ['lefever2016'] },
  topset: { name: 'Top set and back-offs', short: 'One heavy set, lighter back-offs', fit: 'Intermediate, strength and size', desc: 'One heavy set at about 2 reps in reserve, then back-off sets at 90%. The weight follows how the top set felt, so good and bad days take care of themselves.', refs: ['helms2018'] },
  wave: { name: '5/3/1 waves', short: '3-week waves, max rises each wave', fit: 'Intermediate and up, strength', desc: 'Three-week waves: 5s, 3s, then 5/3/1, each ending in an as-many-reps-as-possible set. Built on a training max that rises a little every wave.', refs: ['wendler2009', 'williams2017'] },
  undulating: { name: 'Heavy, medium, light', short: 'Rotates 10s, 6s and 3s', fit: 'Intermediate and up, strength and size', desc: 'Each time you do the lift it rotates: volume (3 × 10), medium (4 × 6), then heavy (5 × 3). The max rises after each full rotation.', refs: ['zourdos2016', 'moesgaard2022'] },
  pyramid: { name: 'Reverse pyramid', short: 'Heaviest first, then lighter', fit: 'Size and strength on fewer sets', desc: 'Your heaviest set comes first while you are fresh. Each set after is about 10% lighter for 2 more reps. Progress is judged on the top set.', refs: ['acsm2009'] },
};
// Which to suggest: strength-first goals get a strength scheme suited to experience.
export function recommendScheme(profile) {
  const g = profile?.goals || {};
  const top = Math.max(0, ...Object.values(g));
  if (!top || (g.strength || 0) < top || (g.strength || 0) < 3) return 'double';
  return { beginner: 'linear', intermediate: 'wave', advanced: 'undulating' }[profile.experience] || 'wave';
}

// Percentage-of-training-max cycles. step: 'week' follows the block's week; 'session' advances
// every time the lift is done. amrap: last set as many reps as possible.
const WAVES = [
  { pct: [0.65, 0.75, 0.85], reps: [5, 5, 5], label: '5s' },
  { pct: [0.70, 0.80, 0.90], reps: [3, 3, 3], label: '3s' },
  { pct: [0.75, 0.85, 0.95], reps: [5, 3, 1], label: '5/3/1' },
];
const CYCLES = {
  wave: { step: 'week', amrap: true, parts: WAVES },
  undulating: {
    step: 'session', amrap: false, parts: [
      { pct: [0.70, 0.70, 0.70], reps: [10, 10, 10], label: 'Volume day' },
      { pct: [0.82, 0.82, 0.82, 0.82], reps: [6, 6, 6, 6], label: 'Medium day' },
      { pct: [0.92, 0.92, 0.92, 0.92, 0.92], reps: [3, 3, 3, 3, 3], label: 'Heavy day' },
    ],
  },
};
const STAGES = [{ sets: 5, reps: 3 }, { sets: 6, reps: 2 }, { sets: 10, reps: 1 }];

function currentFocus(db) {
  const f = db.blocks?.focus || {};
  const wi = weekInfo(db);
  for (let i = Math.ceil(wi.week / wi.cycleLen); i >= 1; i--) if (f[i]?.length) return f[i];
  // None picked yet: the first compound of each lifting day, up to three (as blocks.js defaults).
  const out = [];
  for (const day of Object.keys(db.plan || {})) {
    const first = (db.plan[day]?.items || []).map((it) => db.exercises[it.exerciseId]).find((e) => e?.category === 'compound');
    if (first && !out.includes(first.id)) out.push(first.id);
  }
  return out.slice(0, 3);
}

export function schemeFor(db, exId) {
  const ex = db.exercises[exId];
  if (!ex || ex.category === 'conditioning' || (ex.metric && ex.metric !== 'reps')) return 'double';
  if (ex.progression && PROGRESSIONS[ex.progression]) return ex.progression;
  const s = db.settings.progression || 'double';
  if (s === 'double' || !PROGRESSIONS[s]) return 'double';
  if (ex.category !== 'compound' || !currentFocus(db).includes(exId)) return 'double';
  return s;
}

// Training max for percentage cycles: 90% of the best recent estimated 1RM.
function trainingMax(st) {
  if (st.tm) return st.tm;
  const best = st.last ? Math.max(...st.last.weights.map((w, i) => e1rm(w, st.last.reps[i]))) : 0;
  const base = best || (st.targetWeight ? e1rm(st.targetWeight, 6) : 0);
  return base ? roundTo(base * 0.9, 5) : null;
}

function cycleFor(db, scheme, st, date = todayStr()) {
  const c = CYCLES[scheme];
  const tm = trainingMax(st);
  if (!c || !tm) return null;
  const idx = c.step === 'week' ? (weekInfo(db, date).cyclePos - 1) % c.parts.length : (st.cycleIdx || 0) % c.parts.length;
  return { tm, idx, of: c.parts.length, amrap: c.amrap, step: c.step, ...c.parts[idx] };
}
export const waveFor = (db, st, date) => cycleFor(db, 'wave', st, date);

const pctText = (p) => `${Math.round(p * 90)}%`; // of estimated max (training max is 90% of it)

export function targetsFor(db, item, isDeload) {
  const st = getState(db, item.exerciseId);
  const scheme = schemeFor(db, item.exerciseId);
  const base = { scheme, total: null, stalled: false, painWarning: painWarning(st), st };
  if (CYCLES[scheme]) {
    const w = cycleFor(db, scheme, st);
    if (w) {
      const pct = isDeload ? [0.4, 0.5, 0.6] : w.pct;
      const setWeights = pct.map((p) => roundTo(w.tm * p, 5));
      const setReps = isDeload ? [5, 5, 5] : w.reps;
      const last = setReps.length - 1;
      const amrap = w.amrap && !isDeload;
      const aim = isDeload ? 'Deload · light sets, leave plenty in reserve'
        : scheme === 'wave' ? `Week ${w.idx + 1} of 3 · last set: ${setReps[last]}+ reps, as many as you can with good form`
          : `${w.label} · ${setReps.length} × ${setReps[0]} at about ${pctText(pct[0])} of your max`;
      return { ...base, weight: setWeights[last], reps: setReps[last], sets: setReps.length, rir: isDeload ? '3–4' : null, setWeights, setReps, cycle: { ...w, amrap }, wave: scheme === 'wave' ? { week: w.idx + 1, tm: w.tm, amrap } : null, aim, fixedLadder: true };
    }
  }
  if (!isDeload && st.targetWeight != null) {
    if (scheme === 'stages') {
      const g = STAGES[st.stage || 0];
      return { ...base, weight: st.targetWeight, reps: g.reps, sets: g.sets, rir: null, aim: `${g.sets} × ${g.reps} · complete every set to add weight next time` };
    }
    if (scheme === 'topset' || scheme === 'pyramid') {
      const reps = Math.min(Math.max(st.targetReps ?? item.repMin, item.repMin), item.repMax);
      const n = Math.max(scheme === 'pyramid' ? 3 : 2, Math.min(item.sets, 4));
      const ratios = Array.from({ length: n }, (_, i) => (scheme === 'topset' ? (i ? 0.9 : 1) : 1 - 0.1 * i));
      const setReps = ratios.map((_, i) => (scheme === 'topset' ? reps : reps + 2 * i));
      const setWeights = ratios.map((r) => roundTo(st.targetWeight * r, 5));
      const aim = scheme === 'topset' ? `Top set: ${reps} reps, about 2 in reserve · then ${n - 1} × ${reps} at 90%` : `Top set: ${reps} reps · then 10% lighter, 2 more reps each set`;
      return { ...base, weight: st.targetWeight, reps, sets: n, rir: null, setWeights, setReps, ratios, aim };
    }
  }
  const sets = isDeload ? Math.ceil(item.sets / 2) : item.sets;
  const repMax = scheme === 'linear' ? item.repMin : item.repMax;
  const reps = Math.min(Math.max(st.targetReps ?? item.repMin, item.repMin), repMax);
  return {
    ...base,
    weight: st.targetWeight, // null = TBD
    reps,
    sets,
    total: isDeload ? null : st.targetTotal,
    rir: isDeload ? '3–4' : null,
    stalled: st.stallCount >= 3,
  };
}

const lastOf = (session, done) => ({ date: session.date, weight: Math.max(...done.map((s) => s.weight)), weights: done.map((s) => s.weight), reps: done.map((s) => s.reps), totalReps: done.reduce((a, s) => a + s.reps, 0) });

// Percentage cycles: judge the session, move the training max at the end of each cycle.
function evaluateCycle(db, scheme, entry, session, ex, st) {
  const done = entry.sets.filter((s) => s.done && s.reps > 0 && s.type !== 'd');
  const w = cycleFor(db, scheme, st, session.date);
  if (!done.length || !w) return null;
  const top = done.reduce((a, s) => (s.weight >= a.weight ? s : a));
  const est = Math.round(e1rm(top.weight, top.reps));
  const inc = Number(ex.increment) || 5;
  const parts = CYCLES[scheme].parts;
  // Wave: the last (top) set must reach its minimum. Undulating: every planned set must.
  const ok = scheme === 'wave' ? top.reps >= w.reps[w.reps.length - 1]
    : done.length >= w.reps.length && done.every((s, i) => s.reps >= (w.reps[i] ?? w.reps[0]));
  const next = { ...st, tm: w.tm, targetTotal: null, stallCount: 0 };
  let status = 'held';
  let message = `Top set ${top.weight} × ${top.reps} (est. max ${est} lb).`;
  const endOfCycle = w.idx === parts.length - 1;
  if (!ok) {
    next.misses = st.misses + 1;
    status = 'missed';
    if (next.misses >= 2) { next.tm = roundTo(w.tm * 0.9, 5); next.misses = 0; status = 'reduced'; message += ` Missed twice: training max back to ${next.tm} lb to rebuild.`; }
    else message += ' Short of the planned reps. Same plan next time.';
  } else {
    next.misses = 0;
    if (endOfCycle) { next.tm = w.tm + inc; next.lastIncreaseDate = session.date; status = 'progressed'; message += ` ${scheme === 'wave' ? 'Wave' : 'Rotation'} done: training max +${inc} lb to ${next.tm}.`; }
  }
  const ni = scheme === 'undulating' ? (w.idx + 1) % parts.length : (w.idx + 1) % parts.length;
  if (scheme === 'undulating') next.cycleIdx = ni;
  const np = parts[ni];
  next.targetWeight = roundTo(next.tm * np.pct[np.pct.length - 1], 5);
  next.targetReps = np.reps[np.reps.length - 1];
  if (status === 'held') message += ` Next: ${np.label}, ${np.reps.length} × ${np.reps[0]}${CYCLES[scheme].amrap ? '+' : ''} at ${next.targetWeight} lb.`;
  next.status = status;
  next.message = message;
  next.last = lastOf(session, done);
  return {
    result: { exerciseId: entry.exerciseId, name: ex.name, prevWeight: st.targetWeight, status, message, stalled: false, next: { weight: next.targetWeight, reps: next.targetReps, total: null } },
    state: next,
  };
}

// Stages: add weight while every set is made; on a miss, same weight with the next rep scheme.
function evaluateStages(entry, session, ex, st) {
  const done = entry.sets.filter((s) => s.done && s.reps > 0 && s.type !== 'd');
  if (!done.length || st.targetWeight == null) return null;
  const stage = st.stage || 0;
  const g = STAGES[stage];
  const inc = Number(ex.increment) || 5;
  const top = Math.max(...done.map((s) => s.weight));
  const made = done.length >= g.sets && done.every((s) => s.reps >= g.reps);
  const next = { ...st, targetTotal: null, misses: 0, stallCount: 0 };
  let status; let message;
  if (made) {
    next.targetWeight = top + inc; next.lastIncreaseDate = session.date; status = 'progressed';
    message = `${g.sets} × ${g.reps} done. +${inc} lb.`;
  } else if (stage < STAGES.length - 1) {
    next.stage = stage + 1; next.targetWeight = top; status = 'held';
    message = `Missed ${g.sets} × ${g.reps}. Same weight next time as ${STAGES[stage + 1].sets} × ${STAGES[stage + 1].reps}.`;
  } else {
    next.stage = 0; next.targetWeight = reduceBy(top, 0.15, inc); status = 'reduced';
    message = `Stages done. Back to 5 × 3 at ${next.targetWeight} lb, about 15% lighter, to build up again.`;
  }
  next.targetReps = STAGES[next.stage || 0].reps;
  next.status = status; next.message = message; next.last = lastOf(session, done);
  return {
    result: { exerciseId: entry.exerciseId, name: ex.name, prevWeight: st.targetWeight, status, message, stalled: false, next: { weight: next.targetWeight, reps: next.targetReps, total: null } },
    state: next,
  };
}

// ---------- Evaluate one exercise after a session ----------

// entry: { exerciseId, repMin, repMax, dropSet, pain, painFree, sets: [{ weight, reps, rir, done }] }
// Returns { result, state } — state is the new per-exercise state to store.
export function evaluate(db, entry, session) {
  const ex = db.exercises[entry.exerciseId];
  const st = getState(db, entry.exerciseId);
  const scheme = entry.scheme || 'double';
  if (CYCLES[scheme] && !session.isDeload && !entry.pain) {
    const r = evaluateCycle(db, scheme, entry, session, ex, st);
    if (r) return r;
  }
  if (scheme === 'stages' && !session.isDeload && !entry.pain) {
    const r = evaluateStages(entry, session, ex, st);
    if (r) return r;
  }
  const judgeTop = entry.dropSet || scheme === 'topset' || scheme === 'pyramid'; // progress is judged on the first (heaviest) set
  const repMin = entry.repMin;
  const repMax = scheme === 'linear' ? entry.repMin : entry.repMax;
  const inc = Number(ex.increment) || 5;
  const res = { exerciseId: entry.exerciseId, name: ex.name, prevWeight: st.targetWeight };
  const next = { ...st };

  if (session.isDeload) {
    return { result: { ...res, status: 'deload', message: 'Deload session — not counted.' }, state: null };
  }
  if (entry.pain) {
    next.painDates = [...st.painDates, session.date].filter((d) => daysBetween(d, session.date) <= 30);
    const warn = painWarning(next, session.date);
    return {
      result: {
        ...res,
        status: 'pain',
        message: `Stopped for pain — not counted.${ex.substitute ? ` Substitute: ${ex.substitute}.` : ''}${warn ? ' Second pain flag in two weeks.' : ''}`,
      },
      state: next,
    };
  }

  const done = entry.sets.filter((s) => s.done && s.reps > 0 && s.type !== 'd'); // drop sets are extra work, not judged
  if (!done.length) return { result: { ...res, status: 'skipped', message: 'No sets logged.' }, state: null };

  const evalSets = judgeTop ? [done[0]] : done;
  const topWeight = judgeTop ? done[0].weight : Math.max(...done.map((s) => s.weight));
  const totalReps = done.reduce((a, s) => a + s.reps, 0);
  const first = evalSets[0];
  const isBW = ex.type === 'bodyweight';
  const unloadedBW = isBW && topWeight === 0;
  const allTop = evalSets.every((s) => s.reps >= repMax && (s.rir == null || s.rir >= (ex.minRir || 0)));
  const anyBelow = evalSets.some((s) => s.reps < repMin);
  const rirAll = evalSets.every((s) => s.rir != null);
  const baseline = st.targetWeight == null;

  let weight = topWeight;
  let status;
  let message;
  next.targetTotal = null;

  if (first.reps <= repMin - 3 && !unloadedBW) {
    weight = reduceBy(topWeight, 0.1, inc);
    status = 'reduced';
    message = `First set missed the range by 3+ reps. Down ~10% to ${weight} lb.`;
    next.targetReps = repMin;
    next.misses = 0;
  } else if (allTop) {
    if (ex.rules?.rehab && !entry.painFree) {
      status = 'held';
      message = 'All sets hit the top. Confirm pain-free next time to go up.';
      next.targetReps = repMax;
      next.misses = 0;
    } else {
      const tooEasy = rirAll && evalSets.every((s) => s.rir >= 4);
      const step = tooEasy ? inc * 2 : inc;
      weight = topWeight + step;
      status = 'progressed';
      if (unloadedBW) {
        message = `Top of range on all sets. Add ${step}–${step + 5} lb of load.`;
      } else {
        message = tooEasy ? `Too easy (RIR 4+). Double jump: +${step} lb.` : `+${step} lb.`;
      }
      next.targetReps = repMin;
      next.lastIncreaseDate = session.date;
      next.misses = 0;
    }
  } else if (anyBelow) {
    next.misses = st.misses + 1;
    next.targetReps = repMin;
    if (next.misses >= 2 && !unloadedBW) {
      weight = reduceBy(topWeight, 0.05, inc);
      status = 'reduced';
      message = `Below range two sessions in a row. Down ~5% to ${weight} lb.`;
      next.misses = 0;
    } else {
      status = 'missed';
      message = 'A set fell below the range. Same weight next time.';
    }
  } else {
    status = 'held';
    next.targetReps = Math.max(...evalSets.map((s) => s.reps));
    if (judgeTop && !entry.dropSet) { next.targetReps = Math.min(repMax, next.targetReps + 1); message = `Top set in range. Next time aim for ${next.targetReps} reps.`; }
    else { next.targetTotal = totalReps + 1; message = `In range. Next time beat ${totalReps} total reps.`; }
    next.misses = 0;
  }

  // Stall detection: no increase in weight or total reps vs last counted session.
  const prior = st.last;
  const improved = prior && (topWeight > prior.weight || (topWeight === prior.weight && totalReps > prior.totalReps));
  if (status === 'reduced' || status === 'progressed' || !prior || improved) next.stallCount = 0;
  else next.stallCount = st.stallCount + 1;
  if (next.stallCount >= 3) {
    message += ' Stalled 3 sessions: drop a set for a week, or swap to a variation next block.';
  }
  if (baseline) message = `Baseline set at ${topWeight} lb. ` + message;

  next.targetWeight = weight;
  next.status = status;
  next.message = message;
  next.last = {
    date: session.date,
    weight: topWeight,
    weights: done.map((s) => s.weight),
    reps: done.map((s) => s.reps),
    totalReps,
  };

  return {
    result: { ...res, status, message, stalled: next.stallCount >= 3, next: { weight, reps: next.targetReps, total: next.targetTotal } },
    state: next,
  };
}
