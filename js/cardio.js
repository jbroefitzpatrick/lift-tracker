// Cardio suggestions: score every option in the cardio bank against
//  1) how fatigued the muscles it uses are right now (hard work on tired muscles costs the most), and
//  2) what the next two lifting days train (long or high-volume work on those muscles costs the most).
import { CARDIO, INTENSITY, CARDIO_GEAR } from './cardio-bank.js';
import { activeGym, hasGear } from './gym.js';
import { currentFatigue, remainingPlannedLoads, plannedLoads, dayMode, freshness, addLoads } from './fatigue.js';
import { DAY_KEYS, DAY_NAMES } from './engine.js';
import { MUSCLES } from './bank.js';
import { painMap, cardioPain } from './pain.js';

const shiftDay = (day, n) => DAY_KEYS[(DAY_KEYS.indexOf(day) + n + 7) % 7];
const HEAVY_SETS = 8; // planned sets on a muscle that count as "fully trained" that day

// Fatigue picture for doing cardio on `day`. For today it uses what you've actually logged;
// for other days it projects from the plan (that day's lift, plus the previous two days).
export function cardioContext(db, day, isToday, now = Date.now()) {
  const mode = dayMode(db, day);
  let fat;
  if (isToday) {
    fat = currentFatigue(db, now);
    if (mode === 'lift' || mode === 'both') addLoads(fat, remainingPlannedLoads(db, day)); // cardio after lifting
  } else {
    fat = {};
    if (mode === 'lift' || mode === 'both') addLoads(fat, plannedLoads(db, day), 1);
    addLoads(fat, plannedLoads(db, shiftDay(day, -1)), 24);
    addLoads(fat, plannedLoads(db, shiftDay(day, -2)), 48);
  }
  const next = [1, 2].map((n) => {
    const d = shiftDay(day, n);
    return { day: d, loads: plannedLoads(db, d), weight: n === 1 ? 1 : 0.5, name: db.plan[d]?.name || '' };
  });
  return { day, mode, fatigue: fat, fresh: freshness(fat), next, pain: painMap(db) };
}

function pctList(ms, fresh) {
  return ms.map((m) => `${MUSCLES[m]} ${Math.round(fresh[m] * 100)}%`).join(', ');
}

export function scoreCardio(db, c, ctx) {
  const I = INTENSITY[c.intensity];
  const loads = Object.entries(c.loads);
  const total = loads.reduce((a, [, v]) => a + v, 0);
  const restDay = ctx.mode === 'rest';
  if (c.intensity === 'recovery' && total < 1) {
    return { c, score: restDay ? 92 : 70, verdict: 'good', reasons: ['Helps recovery'] };
  }
  const reasons = [];

  // 1) Today: tired muscles, weighted by how hard the session is.
  const todayConflict = loads.reduce((a, [m, v]) => a + v * (1 - (ctx.fresh[m] ?? 1)), 0) / total;
  // Longer sessions on tired muscles cost more too (a long easy run after leg day is still a lot).
  const lengthFactor = Math.max(1, c.minutes / 30) ** 0.7;
  const todayPenalty = 80 * todayConflict * I.hardWeight * lengthFactor;
  if (todayPenalty >= 12) {
    const tired = loads.filter(([m, v]) => v >= 0.4 && ctx.fresh[m] < 0.7).sort((a, b) => ctx.fresh[a[0]] - ctx.fresh[b[0]]).slice(0, 2).map(([m]) => m);
    if (tired.length) reasons.push(`Still recovering: ${pctList(tired, ctx.fresh)} fresh`);
  }

  // 2) Upcoming lifting: total volume on the muscles the next lift days train.
  let nextPenalty = 0;
  let worst = null;
  for (const n of ctx.next) {
    const conflict = loads.reduce((a, [m, v]) => a + v * Math.min(1, (n.loads[m] || 0) / HEAVY_SETS), 0) / total;
    // Short but hard sessions (sled, sprints) still leave the legs beat up the next day.
    const p = 70 * conflict * n.weight * I.volume * Math.max(c.minutes / 30, I.factor / 2);
    if (p > nextPenalty) { nextPenalty = p; worst = n; }
  }
  if (nextPenalty >= 12 && worst) {
    const overlap = loads.filter(([m, v]) => v >= 0.4 && (worst.loads[m] || 0) >= 3)
      .sort((a, b) => b[1] * (worst.loads[b[0]] || 0) - a[1] * (worst.loads[a[0]] || 0)).slice(0, 2)
      .map(([m]) => MUSCLES[m].toLowerCase()).join(' and ') || 'the same muscles';
    const why = c.minutes >= 50 ? `too long, tires ${overlap}` : I.factor >= 1.4 ? `hard on ${overlap}` : `adds ${overlap} volume`;
    const when = worst.weight === 1 ? 'tomorrow' : `on ${DAY_NAMES[worst.day]}`;
    reasons.push(`${worst.name || 'Lifting'} day ${when}: ${why}`);
  }

  let score = 100 - todayPenalty - nextPenalty;
  if (restDay) score -= I.factor >= 1.4 ? 25 : 5; // rest days favour easy work
  // Sore or injured areas: steer away from options that load them.
  const cp = cardioPain(c, ctx.pain || {});
  if (cp.penalty >= 5) { score -= cp.penalty; reasons.unshift(`Loads your ${cp.label.toLowerCase()}`); }
  const recent = (db.cardio || []).slice(-3).some((x) => x.cardioId === c.id);
  if (recent) score -= 4; // a little variety

  // From the plan builder profile: joint-friendly options, and ~80% easy across the week.
  const prof = db.profile?.rx;
  if (prof?.preferLowImpact && c.impact === 'high') {
    score -= 10;
    reasons.push('Low-impact options are easier on joints');
  }
  if (I.factor >= 1.4) {
    const weekAgo = Date.now() - 7 * 86400000;
    const week = (db.cardio || []).filter((x) => x.ts >= weekAgo);
    const total = week.reduce((a, x) => a + x.minutes, 0);
    const hard = week.filter((x) => (INTENSITY[CARDIO[x.cardioId]?.intensity]?.factor || 0) >= 1.4).reduce((a, x) => a + x.minutes, 0);
    if (total >= 40 && hard / total > 1 - (prof?.easyShare ?? 0.8) + 0.05) {
      score -= 12;
      reasons.push('Already plenty of hard cardio this week — keep ~80% easy');
    }
  }
  if (c.intensity === 'recovery' && !restDay) score = Math.min(score, 70); // training days: suggest real cardio first
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (!reasons.length) {
    const used = loads.filter(([, v]) => v >= 0.4).map(([m]) => m);
    const legs = ['quads', 'hamstrings', 'glutes', 'calves'].reduce((a, m) => a + (c.loads[m] || 0), 0);
    if (legs < 0.6) reasons.push('Spares the legs');
    else if (used.length && used.every((m) => (ctx.fresh[m] ?? 1) >= 0.8)) reasons.push('Muscles it uses are fresh');
    else reasons.push('Fits today');
    if (restDay && I.factor >= 1.4) reasons.push('Hard for a rest day');
  }
  return { c, score, verdict: score >= 70 ? 'good' : score >= 50 ? 'ok' : 'skip', reasons };
}

export function suggestCardio(db, day, isToday, now = Date.now()) {
  const ctx = cardioContext(db, day, isToday, now);
  const gym = activeGym(db);
  const list = Object.values(CARDIO).filter((c) => !c.hidden && hasGear(gym, CARDIO_GEAR[c.id])).map((c) => scoreCardio(db, c, ctx))
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return { ctx, list };
}
