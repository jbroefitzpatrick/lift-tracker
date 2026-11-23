// The numbers behind strength charts: one row per workout for an exercise, the metrics that apply
// to it, and an average trend through the points.
//
// The trend is a local linear fit (LOESS-style, Gaussian weights; Cleveland 1979): each spot on the
// curve is the weighted average direction of nearby workouts, so one great or bad day barely moves
// it and the curve doesn't lag behind at the ends the way a moving average does.

import { e1rm } from './engine.js';

const DAY = 864e5;
export const dayNum = (d) => Date.parse(`${d}T12:00:00Z`) / DAY;

export const CHART_METRICS = {
  est: { name: 'Estimated max', short: 'Est. max', kind: 'weight' },
  heavy: { name: 'Heaviest set', short: 'Heaviest', kind: 'weight' },
  volume: { name: 'Volume', short: 'Volume', kind: 'weight' },
  reps: { name: 'Total reps', short: 'Total reps', kind: 'reps' },
  bestReps: { name: 'Most reps in a set', short: 'Most reps', kind: 'reps' },
  longest: { name: 'Longest hold', short: 'Longest', kind: 'time' },
  time: { name: 'Total time', short: 'Total time', kind: 'time' },
};

export const CHART_RANGES = [['1m', '1M', 31], ['3m', '3M', 92], ['6m', '6M', 183], ['1y', '1Y', 366], ['all', 'All', Infinity]];

// One row per workout. Warm-ups, painful sets and deloads don't count as strength.
export function liftSeries(db, exId) {
  const rows = [];
  for (const s of db.sessions || []) {
    for (const e of s.entries || []) {
      if (e.exerciseId !== exId || e.excluded || (s.isDeload && !e.maxTest)) continue;
      const sets = (e.sets || []).filter((x) => x.done !== false && !x.pain && x.type !== 'w');
      const lifted = sets.filter((x) => x.reps > 0);
      const timed = sets.filter((x) => +x.time > 0);
      if (!lifted.length && !timed.length) continue;
      const loaded = lifted.filter((x) => x.weight > 0);
      const top = loaded.length ? loaded.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a)) : null;
      rows.push({
        date: s.date, sid: s.id, top: top ? { w: top.weight, r: top.reps } : null,
        est: loaded.length ? Math.max(...loaded.map((x) => e1rm(x.weight, x.reps))) : 0,
        heavy: top?.weight || 0,
        volume: loaded.reduce((a, x) => a + x.weight * x.reps, 0),
        reps: lifted.reduce((a, x) => a + x.reps, 0),
        bestReps: lifted.length ? Math.max(...lifted.map((x) => x.reps)) : 0,
        longest: timed.length ? Math.max(...timed.map((x) => +x.time)) : 0,
        time: timed.reduce((a, x) => a + +x.time, 0),
      });
    }
  }
  // Maxes logged by hand count toward the estimated max.
  for (const m of db.maxes || []) {
    if (m.exerciseId !== exId || !(m.weight > 0) || !m.date) continue;
    const est = e1rm(m.weight, m.reps || 1);
    const same = rows.find((r) => r.date === m.date);
    if (same) { if (est > same.est) { same.est = est; same.top = { w: m.weight, r: m.reps || 1 }; same.heavy = Math.max(same.heavy, m.weight); } continue; }
    rows.push({ date: m.date, logged: true, top: { w: m.weight, r: m.reps || 1 }, est, heavy: m.weight, volume: 0, reps: 0, bestReps: 0, longest: 0, time: 0 });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export const metricsFor = (rows) => Object.keys(CHART_METRICS).filter((k) => rows.some((r) => r[k] > 0));
export const defaultMetric = (rows) => metricsFor(rows)[0] || 'est';
export function inRange(rows, range, today) {
  const days = CHART_RANGES.find((r) => r[0] === range)?.[2] ?? Infinity;
  if (days === Infinity) return rows;
  const from = dayNum(today) - days;
  return rows.filter((r) => dayNum(r.date) >= from);
}

// The average curve: [{ t, v }], with null where there's a long gap in training.
export function trendLine(points, samples = 72) {
  const pts = points.filter((p) => Number.isFinite(p.v)).map((p) => ({ t: p.t ?? dayNum(p.x), v: p.v })).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return [];
  const t0 = pts[0].t; const t1 = pts[pts.length - 1].t; const span = t1 - t0;
  if (!span) return [];
  const gap = span / (pts.length - 1);
  const bw = Math.max(7, Math.min(45, Math.max(span / 12, gap * 1.6)));
  const limit = Math.max(bw * 2.5, 30);
  const n = Math.min(samples, Math.max(12, Math.ceil(span / 2)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (span * i) / n;
    let sw = 0; let sx = 0; let sy = 0; let sxx = 0; let sxy = 0; let near = Infinity; let lo = Infinity; let hi = -Infinity;
    for (const p of pts) {
      const d = p.t - t;
      near = Math.min(near, Math.abs(d));
      if (Math.abs(d) > bw * 3) continue;
      const w = Math.exp(-(d * d) / (2 * bw * bw));
      sw += w; sx += w * d; sy += w * p.v; sxx += w * d * d; sxy += w * d * p.v;
      lo = Math.min(lo, p.v); hi = Math.max(hi, p.v);
    }
    if (near > limit || !sw) { out.push({ t, v: null }); continue; }
    const det = sw * sxx - sx * sx;
    const fit = Math.abs(det) > 1e-6 ? (sy * sxx - sx * sxy) / det : sy / sw;
    out.push({ t, v: Math.min(hi, Math.max(lo, fit)) }); // never beyond the nearby workouts
  }
  return out;
}

// Summary for a chart: latest, best, and the change along the trend (not one lucky session).
export function chartStats(rows, key) {
  const pts = rows.filter((r) => r[key] > 0);
  if (!pts.length) return null;
  const trend = trendLine(pts.map((r) => ({ x: r.date, v: r[key] }))).filter((p) => p.v != null);
  const first = trend[0]?.v ?? pts[0][key];
  const last = trend[trend.length - 1]?.v ?? pts[pts.length - 1][key];
  const days = dayNum(pts[pts.length - 1].date) - dayNum(pts[0].date);
  return { latest: pts[pts.length - 1][key], best: Math.max(...pts.map((r) => r[key])), change: last - first, pct: first ? ((last - first) / first) * 100 : 0, perMonth: days >= 14 ? ((last - first) / days) * 30.4 : null, count: pts.length };
}
