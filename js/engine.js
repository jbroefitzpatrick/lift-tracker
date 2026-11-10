// Progression engine: double progression + adaptation + deloads (spec section 3).
import { daysBetween, parseDate, todayStr, mondayOf } from './store.js';
import { runItemsFor } from './running.js';
import { ROW_ROTATION } from './plan.js';

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

export function targetsFor(db, item, isDeload) {
  const st = getState(db, item.exerciseId);
  const sets = isDeload ? Math.ceil(item.sets / 2) : item.sets;
  const reps = Math.min(Math.max(st.targetReps ?? item.repMin, item.repMin), item.repMax);
  return {
    weight: st.targetWeight, // null = TBD
    reps,
    sets,
    total: isDeload ? null : st.targetTotal,
    rir: isDeload ? '3–4' : null,
    stalled: st.stallCount >= 3,
    painWarning: painWarning(st),
    st,
  };
}

// ---------- Evaluate one exercise after a session ----------

// entry: { exerciseId, repMin, repMax, dropSet, pain, painFree, sets: [{ weight, reps, rir, done }] }
// Returns { result, state } — state is the new per-exercise state to store.
export function evaluate(db, entry, session) {
  const ex = db.exercises[entry.exerciseId];
  const st = getState(db, entry.exerciseId);
  const { repMin, repMax } = entry;
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

  const done = entry.sets.filter((s) => s.done && s.reps > 0);
  if (!done.length) return { result: { ...res, status: 'skipped', message: 'No sets logged.' }, state: null };

  const evalSets = entry.dropSet ? [done[0]] : done;
  const topWeight = entry.dropSet ? done[0].weight : Math.max(...done.map((s) => s.weight));
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
    next.targetTotal = totalReps + 1;
    next.targetReps = Math.max(...evalSets.map((s) => s.reps));
    message = `In range. Next time beat ${totalReps} total reps.`;
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
