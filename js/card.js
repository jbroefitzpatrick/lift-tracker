// The summary a signed-in person shares with friends and their coach, and how it's compared.
//
// Friends compare effort and personal progress, not raw weights: comparing with people who are
// stronger or more experienced tends to discourage, while progress relative to your own past is a
// fair contest at any level (Festinger 1954; Wheeler & Suls on similar-other comparison). So the card
// carries workouts done against the plan, weekly sets, a streak, strength change as a percentage,
// and records without their weights.

import { todayStr, addDays, mondayOf } from './store.js';
import { e1rm } from './engine.js';
import { liftTemplates, doneTemplates } from './week.js';

const goodSets = (e) => (e.sets || []).filter((x) => x.done !== false && !x.pain && x.type !== 'w' && x.reps > 0);

export function buildCard(db, name) {
  const today = todayStr();
  const start = mondayOf(today);
  const end = addDays(start, 6);
  const sessions = [...(db.sessions || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const inWeek = sessions.filter((s) => s.date >= start && s.date <= end);
  const planned = liftTemplates(db).length;
  const done = planned ? doneTemplates(db).size : inWeek.length;
  const sets = inWeek.reduce((a, s) => a + s.entries.reduce((b, e) => b + goodSets(e).length, 0), 0);
  const cardioMin = (db.cardio || []).filter((c) => c.date >= start && c.date <= end && c.cardioId !== 'mobility').reduce((a, c) => a + (c.minutes || 0), 0);

  // Weeks in a row with a workout.
  const weeks = new Set(sessions.map((s) => mondayOf(s.date)));
  let w = start; if (!weeks.has(w)) w = addDays(w, -7);
  let streak = 0; while (weeks.has(w)) { streak += 1; w = addDays(w, -7); }

  // Best estimated max per lift per week (12 weeks), and records with the size of the jump.
  const since = addDays(start, -7 * 12);
  const lifts = {};
  const best = {};
  const records = [];
  const recSince = addDays(today, -45);
  for (const s of sessions) {
    for (const e of s.entries) {
      const ex = db.exercises?.[e.exerciseId];
      if (!ex || ex.category === 'conditioning' || ex.type === 'bodyweight' || e.metric) continue;
      const good = goodSets(e).filter((x) => x.weight > 0);
      if (!good.length) continue;
      const top = Math.max(...good.map((x) => e1rm(x.weight, x.reps)));
      const prev = best[e.exerciseId];
      if (prev && top > prev + 0.5 && s.date >= recSince && !s.isDeload) records.push({ id: `${s.id}:${e.exerciseId}`, date: s.date, ex: ex.name, exId: e.exerciseId, pct: Math.round((top / prev - 1) * 1000) / 10 });
      best[e.exerciseId] = Math.max(prev || 0, top);
      if (s.date < since || s.isDeload) continue;
      const wk = mondayOf(s.date);
      const L = (lifts[e.exerciseId] ||= { name: ex.name, pts: [] });
      const last = L.pts[L.pts.length - 1];
      if (last && last[0] === wk) last[1] = Math.max(last[1], Math.round(top * 100) / 100); else L.pts.push([wk, Math.round(top * 100) / 100]);
    }
  }
  const workouts = sessions.slice(-10).reverse().map((s) => ({
    id: s.id, date: s.date,
    name: s.freestyle ? 'Workout' : db.plan?.[s.day]?.name || 'Workout',
    sets: s.entries.reduce((a, e) => a + goodSets(e).length, 0),
    prs: s.prs?.length || 0,
  }));
  return {
    v: 1, name, today,
    week: { start, end, done, planned, sets, cardioMin },
    streak,
    days: sessions.filter((s) => s.date >= addDays(today, -63)).map((s) => s.date),
    lifts,
    records: records.slice(-12).reverse(),
    workouts,
  };
}

// This week's numbers, or zeros if the card is from an earlier week.
export function weekOf(card, today = todayStr()) {
  const wk = card?.week;
  if (!wk || today > wk.end) return { done: 0, planned: wk?.planned || 0, sets: 0, cardioMin: 0, stale: true };
  return wk;
}

// Strength change over about four weeks: for each lift, the best of the last two weeks against the
// best of weeks three to six back; the median across lifts, so one lift can't carry it.
export function progressOf(card, today = todayStr()) {
  const now = mondayOf(today);
  const out = [];
  for (const [id, L] of Object.entries(card?.lifts || {})) {
    const recent = L.pts.filter(([d]) => d >= addDays(now, -7)).map((p) => p[1]);
    const base = L.pts.filter(([d]) => d >= addDays(now, -42) && d < addDays(now, -7)).map((p) => p[1]);
    if (!recent.length || !base.length) continue;
    out.push({ id, name: L.name, pct: (Math.max(...recent) / Math.max(...base) - 1) * 100 });
  }
  if (!out.length) return { pct: null, lifts: [] };
  const v = out.map((x) => x.pct).sort((a, b) => a - b);
  const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return { pct: Math.round(mid * 10) / 10, lifts: out.sort((a, b) => b.pct - a.pct) };
}

// Score in a head-to-head challenge. workouts: workouts in the window. lift: % change in the lift's
// best estimated max during the window against the four weeks before it.
export function contestScore(card, c, today = todayStr()) {
  if (!c.start) return null;
  const end = addDays(c.start, c.days - 1);
  if (c.kind === 'workouts') return { value: (card?.days || []).filter((d) => d >= c.start && d <= end && d <= today).length, unit: 'workouts' };
  const L = card?.lifts?.[c.ex];
  if (!L) return { value: null, unit: '%' };
  const startWk = mondayOf(c.start);
  const base = L.pts.filter(([d]) => d < startWk && d >= addDays(startWk, -28)).map((p) => p[1]);
  const during = L.pts.filter(([d]) => d >= startWk && d <= end).map((p) => p[1]);
  if (!base.length || !during.length) return { value: null, unit: '%' };
  return { value: Math.round((Math.max(...during) / Math.max(...base) - 1) * 1000) / 10, unit: '%' };
}
export const contestEnd = (c) => (c.start ? addDays(c.start, c.days - 1) : null);
