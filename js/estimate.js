// Estimated one-rep max, tuned. Method and sources: docs/ESTIMATES.md.
//
// One set: Epley (lesuer1997) on the reps done plus the reps left in reserve when logged, eased off
// above 5 reps. Reps to failure at a given %1RM run higher than Epley assumes (nuzzo2023: bench at
// 80% averages 8.8 reps, Epley assumes 7.5), so a hard set of 6–10 reads about 3% high; RIR is
// judged to within about a rep on sets under ~12 reps near failure (zourdos2016, refalo2023).
//
// A lift's current max: the best session, unless it stands alone (more than 3% above every other
// session), then it's met halfway until another session backs it up. A tested max (a max-test
// workout or one logged by hand) resets the estimate to what was lifted; later sets can raise it.
// Each test also records what was predicted beforehand, and after 3 tests the median miss becomes
// a personal correction (within ±10%).

import { e1rm } from './engine.js';

export const METHOD = 2; // bump when the rules change, so old checks can be told apart
export const P = { damp: 0.005, dampFrom: 5, rirMax: 5, maxReps: 10, alone: 0.03, minChecks: 3, clamp: 0.1 };

// One set's estimate.
export function setMax(weight, reps, rir) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  const r = reps + (rir != null && rir >= 0 ? Math.min(P.rirMax, +rir) : 0);
  if (r <= 1) return weight;
  return e1rm(weight, r) * (1 - P.damp * Math.max(0, r - P.dampFrom));
}

const goodSet = (x) => x.done !== false && !x.pain && x.type !== 'w' && x.weight > 0 && x.reps > 0;

// How well the estimates have matched tested maxes, and the personal correction from them.
export function calibration(db) {
  const c = (db.calib || []).filter((k) => k.pred > 0 && k.actual > 0);
  if (!c.length) return { factor: 1, n: 0, err: null, bias: null };
  const ratios = c.map((k) => k.actual / k.pred).sort((a, b) => a - b);
  const mid = ratios.length % 2 ? ratios[(ratios.length - 1) / 2] : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2;
  const err = c.reduce((a, k) => a + Math.abs(k.actual - k.pred) / k.actual, 0) / c.length;
  const factor = c.length >= P.minChecks ? Math.min(1 + P.clamp, Math.max(1 - P.clamp, mid)) : 1;
  return { factor, n: c.length, err, bias: mid - 1 };
}

// Every set and test for the lift(s), oldest first.
function events(db, ids, { since, until, skipSid } = {}) {
  const out = [];
  for (const s of db.sessions || []) {
    if ((since && s.date < since) || (until && s.date > until) || s.id === skipSid) continue;
    for (const e of s.entries || []) {
      if (!ids.includes(e.exerciseId) || e.pain) continue;
      if (e.maxTest) {
        const best = e.sets.filter((x) => goodSet(x) && x.reps >= 1).reduce((a, x) => (x.weight > (a?.weight || 0) ? x : a), null);
        if (best) out.push({ date: s.date, sid: s.id, v: best.weight, w: best.weight, r: best.reps, test: true, exId: e.exerciseId });
        continue;
      }
      for (const x of e.sets) if (goodSet(x) && x.reps <= P.maxReps) out.push({ date: s.date, sid: s.id, v: setMax(x.weight, x.reps, x.rir), w: x.weight, r: x.reps, rir: x.rir, exId: e.exerciseId });
    }
  }
  for (const m of db.maxes || []) {
    if (!ids.includes(m.exerciseId) || (since && m.date < since) || (until && m.date > until)) continue;
    const r = m.reps || 1;
    out.push({ date: m.date, sid: `max:${m.id}`, v: setMax(m.weight, r), w: m.weight, r, test: r === 1, logged: true, exId: m.exerciseId });
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.test ? 1 : 0) - (b.test ? 1 : 0));
}

// The estimate over time: after each event, the lift's current max ({ date, v, from, tested }).
export function liftSeries(db, ids, opts = {}) {
  const f = opts.factor ?? calibration(db).factor;
  let top = null; let second = null; let test = null;
  const best = new Map();
  const out = [];
  for (const e of events(db, ids, opts)) {
    // A test starts over from what was lifted, and counts as a session later ones must agree with.
    if (e.test) { best.clear(); best.set(e.sid, e); top = e; second = null; test = e; } else {
      const prev = best.get(e.sid);
      if (!prev || e.v > prev.v) {
        best.set(e.sid, e);
        const pool = [top, second, e].filter(Boolean);
        const bySid = new Map(); for (const p of pool) if (!bySid.has(p.sid) || p.v > bySid.get(p.sid).v) bySid.set(p.sid, p);
        [top, second] = [...bySid.values()].sort((a, b) => b.v - a.v);
      }
    }
    let cur = null;
    if (top) {
      const alone = !second ? false : top.v - second.v > top.v * P.alone;
      cur = { v: (alone ? (top.v + second.v) / 2 : top.v) * f, from: top, alone };
    }
    if (test && (!cur || test.v >= cur.v)) cur = { v: test.v, from: test, tested: true };
    out.push({ date: e.date, ...cur });
  }
  return out;
}

// The lift's current estimated max (lb), or 0.
export function liftMax(db, ids, opts) {
  const s = liftSeries(db, ids, opts);
  return s.length ? s[s.length - 1] : null;
}

// The heaviest weight actually lifted (any reps, warm-ups and painful sets left out), over time.
export function liftedSeries(db, ids) {
  const ev = [];
  for (const s of db.sessions || []) for (const e of s.entries || []) {
    if (!ids.includes(e.exerciseId) || e.pain) continue;
    for (const x of e.sets) if (goodSet(x)) ev.push({ date: s.date, w: x.weight, r: x.reps, exId: e.exerciseId });
  }
  for (const m of db.maxes || []) if (ids.includes(m.exerciseId) && m.weight > 0) ev.push({ date: m.date, w: m.weight, r: m.reps || 1, exId: m.exerciseId, logged: true });
  ev.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let best = null; const out = [];
  for (const e of ev) if (!best || e.w > best.w) { best = e; out.push({ ...e }); }
  return out;
}
export const liftedMax = (db, ids) => { const s = liftedSeries(db, ids); return s[s.length - 1] || null; };

// A tested max just logged: keep what the estimate said beforehand, to check (and tune) it.
export function recordCheck(db, exId, actual, date, skipSid) {
  const before = liftMax(db, [exId], { skipSid, until: date, factor: 1 });
  if (!before?.v || before.tested && before.from?.sid === skipSid) return null;
  const src = before.from || {};
  const gapDays = src.date ? Math.max(0, Math.round((Date.parse(date) - Date.parse(src.date)) / 864e5)) : null;
  const k = { id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date, exId, pred: Math.round(before.v), actual: Math.round(actual), method: METHOD, srcReps: src.r ?? null, srcRir: src.rir ?? null, gapDays };
  (db.calib ||= []).push(k);
  if (db.calib.length > 200) db.calib.splice(0, db.calib.length - 200);
  return k;
}
