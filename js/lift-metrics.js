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

// The trend as straight steps: workouts grouped into periods (2 weeks for a short range, a month
// for a year, two months beyond), one value per period. 'best' (lifts): the average of the period's
// two best workouts (the best one when it had only one or two), so light days and deloads don't pull it down. 'median' (body measures): the
// middle value. gap: an empty period before this one (drawn dashed, not as a break).
export function stepTrend(points, mode = 'median') {
  const pts = points.filter((p) => Number.isFinite(p.v)).map((p) => ({ t: p.t ?? dayNum(p.x), v: p.v })).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return [];
  const t0 = pts[0].t; const span = pts[pts.length - 1].t - t0;
  if (!span) return [];
  const bin = span <= 120 ? 14 : span <= 400 ? 28 : 56;
  const bins = new Map();
  for (const p of pts) { const k = Math.floor((p.t - t0) / bin); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(p); }
  const keys = [...bins.keys()].sort((a, b) => a - b);
  if (keys.length < 2) {
    // Everything inside one period: a straight least-squares line across it.
    const n = pts.length; const mt = pts.reduce((a, p) => a + p.t, 0) / n; const mv = pts.reduce((a, p) => a + p.v, 0) / n;
    const sxx = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0); const slope = sxx ? pts.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0) / sxx : 0;
    return [{ t: pts[0].t, v: mv + slope * (pts[0].t - mt) }, { t: pts[n - 1].t, v: mv + slope * (pts[n - 1].t - mt) }];
  }
  return keys.map((k, i) => {
    const g = bins.get(k);
    const vs = g.map((p) => p.v).sort((a, b) => b - a);
    const v = mode === 'best' ? (vs.length > 2 ? (vs[0] + vs[1]) / 2 : vs[0]) : vs.length % 2 ? vs[(vs.length - 1) / 2] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2;
    const t = g.reduce((a, p) => a + p.t, 0) / g.length;
    return { t, v, gap: i > 0 && k - keys[i - 1] > 1 };
  });
}

// Summary for a chart: latest, best, and the change along the trend (not one lucky session).
export function chartStats(rows, key) {
  const pts = rows.filter((r) => r[key] > 0);
  if (!pts.length) return null;
  const trend = stepTrend(pts.map((r) => ({ x: r.date, v: r[key] })), 'best');
  const first = trend[0]?.v ?? pts[0][key];
  const last = trend[trend.length - 1]?.v ?? pts[pts.length - 1][key];
  const days = dayNum(pts[pts.length - 1].date) - dayNum(pts[0].date);
  return { latest: pts[pts.length - 1][key], best: Math.max(...pts.map((r) => r[key])), change: last - first, pct: first ? ((last - first) / first) * 100 : 0, perMonth: days >= 14 ? ((last - first) / days) * 30.4 : null, count: pts.length };
}
