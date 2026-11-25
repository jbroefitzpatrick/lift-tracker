// The summary a signed-in person shares with friends and their coach, and how it's compared.
//
// Friends compare effort and personal progress, not raw weights: comparing with people who are
// stronger or more experienced tends to discourage, while progress relative to your own past is a
// fair contest at any level (Festinger 1954; Wheeler & Suls on similar-other comparison). So the card
// carries workouts done against the plan, weekly sets, a streak, strength change as a percentage,
// and records without their weights.

import { setMax } from './estimate.js';
import { todayStr, addDays, mondayOf } from './store.js';
import { e1rm } from './engine.js';
import { liftTemplates, doneTemplates } from './week.js';
import { streakInfo } from './streak.js';
import { cardTrophies } from './trophies.js';

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

  const streak = streakInfo(db, today).current;

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
      const top = Math.max(...good.map((x) => setMax(x.weight, x.reps, x.rir)));
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
  // Weights go out only if the person chose to share them (Settings in their profile).
  const showW = !!db.settings?.shareWeights;
  const exOf = (s) => s.entries.filter((e) => goodSets(e).length && db.exercises?.[e.exerciseId]?.category !== 'conditioning').slice(0, 12).map((e) => {
    const ex = db.exercises?.[e.exerciseId]; const g = goodSets(e);
    return { id: e.exerciseId, name: ex?.name || e.name, n: g.length, reps: g.map((x) => x.reps).slice(0, 8), ...(showW && !ex?.noLoad ? { w: g.map((x) => x.weight || 0).slice(0, 8) } : {}), ...((s.prs || []).some((p) => p.exerciseId === e.exerciseId) ? { best: true } : {}) };
  });
  const workouts = sessions.slice(-10).reverse().map((s) => ({
    id: s.id, date: s.date, ex: exOf(s),
    name: s.freestyle ? 'Workout' : db.plan?.[s.day]?.name || 'Workout',
    sets: s.entries.reduce((a, e) => a + goodSets(e).length, 0),
    prs: s.prs?.length || 0,
    minutes: s.finishedAt && s.startedAt ? Math.round(Math.max(0, Math.min(240, (s.finishedAt - s.startedAt - (s.pausedMs || 0)) / 60000))) : null,
  }));
  return {
    v: 1, name, today, weights: showW,
    // Last week, for the Monday recap and its ranking among friends.
    prev: (() => {
      const ps = addDays(start, -7); const pe = addDays(start, -1);
      const wk = sessions.filter((s) => s.date >= ps && s.date <= pe);
      const best = records.filter((r) => r.date >= ps && r.date <= pe).sort((a, b) => (b.pct || 0) - (a.pct || 0))[0] || null;
      return { start: ps, workouts: wk.length, sets: wk.reduce((a, s) => a + s.entries.reduce((b, e) => b + goodSets(e).length, 0), 0),
        minutes: Math.round(wk.reduce((a, x) => a + Math.max(0, Math.min(240, ((x.finishedAt || 0) - (x.startedAt || 0) - (x.pausedMs || 0)) / 60000)), 0)),
        cardioMin: (db.cardio || []).filter((c) => c.date >= ps && c.date <= pe && c.cardioId !== 'mobility').reduce((a, c) => a + (c.minutes || 0), 0), best };
    })(),
    trophies: cardTrophies(db),
    month: sessions.filter((s) => s.date.slice(0, 7) === today.slice(0, 7)).length,
    // workouts: every workout this week (not just planned ones); minutes: time training.
    week: { start, end, done, planned, sets, cardioMin, workouts: inWeek.length, minutes: Math.round(inWeek.reduce((a, x) => a + Math.max(0, Math.min(240, ((x.finishedAt || 0) - (x.startedAt || 0) - (x.pausedMs || 0)) / 60000)), 0)) },
    streak,
    days: sessions.filter((s) => s.date >= addDays(today, -63)).map((s) => s.date),
    lifts,
    records: records.slice(-12).reverse(),
    workouts,
  };
}

// Weekly points, for the leaderboard: the work actually done, so a small plan finished doesn't
// beat a bigger week. Each part is capped where more stops helping:
// - 10 per workout, up to 6 (a seventh day adds little and raises injury risk);
// - 1 per hard set, up to 120 (around 10–20 sets per muscle a week; past that, extra sets add
//   little for growth or strength: pelland2026);
// - 1 per 5 minutes of cardio, up to 60 (300 minutes, the top of the WHO range: who2020);
// - 15 for finishing your own plan's week, so sticking to a plan still counts.
export const POINTS = { workout: 10, maxWorkouts: 6, maxSets: 120, cardioPer: 5, maxCardio: 60, planBonus: 15 };
export function weekPoints(w) {
  const workouts = Math.min(POINTS.maxWorkouts, w.workouts ?? w.done ?? 0) * POINTS.workout;
  const sets = Math.min(POINTS.maxSets, w.sets || 0);
  const cardio = Math.min(POINTS.maxCardio, Math.floor((w.cardioMin || 0) / POINTS.cardioPer));
  const bonus = w.planned && w.done >= w.planned ? POINTS.planBonus : 0;
  return { total: workouts + sets + cardio + bonus, workouts, sets, cardio, bonus };
}

// This week's numbers, or zeros if the card is from an earlier week.
export function weekOf(card, today = todayStr()) {
  const wk = card?.week;
  if (!wk || today > wk.end) return { done: 0, planned: wk?.planned || 0, sets: 0, cardioMin: 0, workouts: 0, minutes: 0, stale: true };
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

// Recent records with the set that made them (for sharing a specific one, weight included).
export function recentRecords(db, days = 45) {
  const since = addDays(todayStr(), -days);
  const sessions = [...(db.sessions || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const best = {};
  const out = [];
  for (const s of sessions) {
    for (const e of s.entries) {
      const ex = db.exercises?.[e.exerciseId];
      if (!ex || ex.category === 'conditioning' || ex.noLoad || e.metric) continue;
      const good = goodSets(e).filter((x) => x.weight > 0);
      if (!good.length) continue;
      const top = good.reduce((a, x) => (setMax(x.weight, x.reps, x.rir) > setMax(a.weight, a.reps, a.rir) ? x : a));
      const est = setMax(top.weight, top.reps, top.rir);
      const prev = best[e.exerciseId];
      if (prev && est > prev + 0.5 && s.date >= since && !s.isDeload) out.push({ sessionId: s.id, exId: e.exerciseId, name: ex.name, date: s.date, weight: top.weight, reps: top.reps, e1rm: Math.round(est), pct: Math.round((est / prev - 1) * 1000) / 10 });
      best[e.exerciseId] = Math.max(prev || 0, est);
    }
  }
  return out.reverse();
}
