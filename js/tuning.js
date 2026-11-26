// Tuning records: small, pre-aggregated facts from finished workouts, pooled (opt-out) to tune the
// app's defaults for everyone. Method, rationale and how to read them: docs/TUNING.md.
//
// Every record is numbers plus exercise ids and a few labels. No names, notes, pain or health data.
// Kinds:
//   start    first time on a lift: the starting-weight guess vs the weight used
//   prog     after the app raised a lift's weight: did the next session hit its reps
//   session  planned minutes and sets vs what happened
//   rir      logged reps in reserve vs what a recent tested max implies
//   skip     planned exercises skipped or swapped in a workout
//   trend    every 4 weeks, per main lift: estimated-max change, weekly hard sets for its main
//            muscle, and whether a deload week fell in the window

import { addDays } from './store.js';
import { liftMax } from './estimate.js';
import { startEstimate } from './start-weights.js';
import { estimateMinutes } from './builder.js';

const QUEUE_MAX = 300;
const MAIN = [['squat', ['back-squat']], ['bench', ['bench-press']], ['deadlift', ['deadlift', 'sumo-deadlift']], ['ohp', ['ohp']]];
const r1 = (v) => Math.round(v * 10) / 10;
const working = (e) => (e.sets || []).filter((x) => x.type !== 'w' && x.done !== false && !x.pain && x.weight > 0 && x.reps > 0);
const ageBand = (db) => { const a = +(db.about?.age || db.profile?.age); return a ? Math.floor(a / 10) * 10 : null; };
const expOf = (db) => db.about?.exp || db.profile?.experience || null;

function push(db, rec) {
  const q = (db.tuneQueue ||= []);
  q.push({ id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...rec });
  if (q.length > QUEUE_MAX) q.splice(0, q.length - QUEUE_MAX);
}

// Called when a workout is finished, before it's added to the history.
//   live:   the session as it was in progress (every planned entry, done or not)
//   saved:  what's kept (entries with logged sets)
//   before: each exercise's progression state before this workout
export function onFinish(db, live, saved, before = {}) {
  const month = String(saved.date).slice(0, 7);
  const exp = expOf(db);
  const loggedBefore = new Set();
  for (const s of db.sessions || []) for (const e of s.entries || []) if (working(e).length) loggedBefore.add(e.exerciseId);
  const lifts = (saved.entries || []).filter((e) => !e.metric && !e.excluded && !e.maxTest && working(e).length);

  for (const e of lifts) {
    const ex = db.exercises[e.exerciseId];
    if (!ex || ex.type === 'bodyweight' || ex.noLoad) continue;
    const sets = working(e);
    // 1. Starting weight: the first time this lift is ever logged.
    if (!loggedBefore.has(e.exerciseId) && ex.startWeight == null) {
      const guess = startEstimate(db, ex);
      const first = sets[0];
      if (guess > 0) push(db, { kind: 'start', ex: e.exerciseId, month, v: { guess, used: first.weight, reps: first.reps, rir: first.rir ?? null, pattern: ex.pattern || null, type: ex.type || null, exp, sex: db.about?.sex || db.profile?.sex || null, ageBand: ageBand(db) } });
    }
    // 2. Progression: the target went up from last time; did every working set reach the bottom of the range?
    const st = before[e.exerciseId];
    const last = st?.last;
    const target = st?.targetWeight;
    if (last?.weight > 0 && target > last.weight && e.repMin) {
      const atTarget = sets.filter((x) => x.weight >= target - 0.01);
      if (atTarget.length) {
        const hit = atTarget.every((x) => x.reps >= e.repMin) ? 1 : 0;
        push(db, { kind: 'prog', ex: e.exerciseId, month, v: { inc: r1(target - last.weight), pct: r1(((target - last.weight) / last.weight) * 100), hit, repMin: e.repMin, repMax: e.repMax || e.repMin, sets: atTarget.length, type: ex.type || null, exp } });
      }
    }
    // 4. Reps in reserve: only against a tested max (otherwise it would check the estimate against itself).
    const m = liftMax(db, [e.exerciseId]);
    if (m?.tested && m.from?.date && m.from.date >= addDays(saved.date, -56)) {
      let n = 0;
      for (const x of sets) {
        if (x.rir == null || x.reps > 12 || n >= 3) continue;
        const toFailure = 30 * (m.v / x.weight - 1); // Epley turned around: reps possible at this weight
        if (toFailure < x.reps - 1 || toFailure > 30) continue;
        push(db, { kind: 'rir', ex: e.exerciseId, month, v: { logged: x.rir, implied: r1(toFailure - x.reps), reps: x.reps, load: Math.round((x.weight / m.v) * 100) } });
        n++;
      }
    }
  }

  // 3. Session length: the plan's estimate vs the clock (skipped for freestyle and implausible clocks).
  const entries = (live.order || []).map((u) => live.entries[u]).filter((e) => e && !e.phase);
  const planned = entries.map((e) => ({ group: e.group, sets: (e.sets || []).length, restSec: e.restSec || 0, metric: e.metric, target: e.target }));
  const actual = ((saved.finishedAt || 0) - (saved.startedAt || 0) - (saved.pausedMs || 0)) / 60000;
  if (!saved.freestyle && planned.length && actual >= 5 && actual <= 240) {
    const done = entries.reduce((a, e) => a + (e.sets || []).filter((x) => x.done && x.type !== 'w').length, 0);
    push(db, { kind: 'session', month, v: { planMin: estimateMinutes(planned), actualMin: Math.round(actual), planSets: planned.reduce((a, p) => a + p.sets, 0), doneSets: done, exercises: planned.length, deload: saved.isDeload ? 1 : 0, exp } });
  }

  // 5. Skipped and swapped exercises.
  if (!saved.freestyle && entries.length) {
    const skipped = entries.filter((e) => !(e.sets || []).some((x) => x.done)).map((e) => e.exerciseId).slice(0, 10);
    const swapped = entries.filter((e) => e.swappedFrom).map((e) => [e.swappedFrom, e.exerciseId]).slice(0, 10);
    if (skipped.length || swapped.length) push(db, { kind: 'skip', month, v: { planned: entries.length, skipped, swapped } });
  }

  // 6 and 7. Every 4 weeks: each main lift's change, hard sets for its main muscle, deloads in the window.
  const marks = (db.tuneMarks ||= {});
  if (!marks.trend || marks.trend <= addDays(saved.date, -28)) {
    const from = addDays(saved.date, -28);
    const all = [...(db.sessions || []), saved];
    const inWindow = all.filter((s) => s.date > from && s.date <= saved.date);
    const deload = inWindow.some((s) => s.isDeload) ? 1 : 0;
    let any = false;
    for (const [lift, ids] of MAIN) {
      const now = liftMax({ ...db, sessions: all }, ids)?.v;
      const then = liftMax(db, ids, { until: from })?.v;
      if (!now || !then) continue;
      const muscle = db.exercises[ids[0]]?.primary?.[0];
      let sets = 0;
      if (muscle) for (const s of inWindow) for (const e of s.entries || []) if (db.exercises[e.exerciseId]?.primary?.includes(muscle)) sets += working(e).length;
      push(db, { kind: 'trend', ex: ids[0], month, v: { lift, change: r1(((now - then) / then) * 100), weeklySets: r1(sets / 4), deload, exp, sex: db.about?.sex || db.profile?.sex || null } });
      any = true;
    }
    if (any) marks.trend = saved.date;
  }
}

// What goes to the server: unsent records, at most `max` at a time.
export const unsent = (db, max = 100) => (db.tuneQueue || []).filter((r) => !r.sent).slice(0, max);
