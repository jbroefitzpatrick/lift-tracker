// Nutrition targets, adaptive maintenance, weekly check-ins and meal templates.
// Every rule cites a reference id from science.js.
import { FOODS } from './foods.js';
import { todayStr, daysBetween, addDays } from './store.js';
import { activePhase, PHASE_TYPES, cardioTargetFor } from './year.js';
import { estimateMinutes } from './builder.js';

export const ACTIVITY = {
  low: { label: 'Mostly sitting (desk job)', pal: 1.2 },
  some: { label: 'On my feet some of the day', pal: 1.35 },
  active: { label: 'On my feet most of the day', pal: 1.5 },
  physical: { label: 'Physical job', pal: 1.7 },
};

const LB_PER_KG = 2.2046;
const KCAL_PER_LB = 3500; // rough rule of thumb; real tissue change varies (hall2008)

export const foodById = (db, id) => FOODS.find((f) => f.id === id) || db.customFoods.find((f) => f.id === id);

export function latestWeight(db) {
  const list = [...db.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1].weight : +db.profile?.weightLb || null;
}

// ---------- Energy ----------

// Mifflin-St Jeor (mifflin1990). Without a sex, the midpoint of the two equations.
export function bmr(p, lb) {
  const kg = lb / LB_PER_KG;
  const cm = (+p.heightIn || 70) * 2.54;
  const age = +p.age || 30;
  const s = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  return 10 * kg + 6.25 * cm - 5 * age + s;
}

// Planned weekly training minutes from the current plan and cardio target.
export function weeklyTrainingMinutes(db) {
  let lift = 0;
  for (const [day, d] of Object.entries(db.plan)) {
    const mode = db.settings.dayModes?.[day] || 'lift';
    if (mode !== 'lift' && mode !== 'both') continue;
    lift += estimateMinutes(d.items.map((i) => ({ ...i, group: i.group })));
  }
  return { lift, cardio: cardioTargetFor(db) };
}

// Net exercise energy per day using Compendium METs (ainsworth2011): lifting ~5 METs, mixed cardio ~7.
export function exerciseKcalPerDay(db, lb) {
  const kg = lb / LB_PER_KG;
  const { lift, cardio } = weeklyTrainingMinutes(db);
  return ((5 - 1) * kg * (lift / 60) + (7 - 1) * kg * (cardio / 60)) / 7;
}

export function estimatedMaintenance(db, lb) {
  const p = db.profile || {};
  const pal = ACTIVITY[db.nutrition.activity]?.pal || 1.35;
  return bmr(p, lb) * pal + exerciseKcalPerDay(db, lb);
}

// Daily totals for a date.
export function dayTotals(db, date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0, n: 0 };
  for (const x of db.foodLog) {
    if (x.date !== date) continue;
    t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.f += x.f; t.fiber += x.fiber || 0; t.n += 1;
  }
  return t;
}

function slope(points) {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0; let den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den ? num / den : 0;
}

// Adaptive maintenance: average intake minus the energy implied by the weight trend (last 28 days).
export function adaptiveMaintenance(db, today = todayStr()) {
  const from = addDays(today, -28);
  const days = [];
  for (let i = 1; i <= 28; i++) {
    const d = addDays(from, i - 1);
    const t = dayTotals(db, d);
    if (t.kcal > 300) days.push(t.kcal);
  }
  const weights = db.bodyweight.filter((b) => b.date >= from && b.date < today)
    .map((b) => ({ x: daysBetween(from, b.date), y: b.weight }));
  if (days.length < 10 || weights.length < 6 || Math.max(...weights.map((w) => w.x)) - Math.min(...weights.map((w) => w.x)) < 14) {
    return { ready: false, loggedDays: days.length, weighIns: weights.length };
  }
  const intake = days.reduce((a, b) => a + b, 0) / days.length;
  const lbPerDay = slope(weights);
  return { ready: true, tdee: intake - lbPerDay * KCAL_PER_LB, intake, lbPerWeek: lbPerDay * 7, loggedDays: days.length, weighIns: weights.length };
}

// ---------- Targets ----------

export function goalFor(db, date = todayStr()) {
  const ph = activePhase(db, date);
  if (ph) return { type: ph.phase.type, ...PHASE_TYPES[ph.phase.type], phase: ph };
  const wg = db.profile?.rx?.weightGoal || 'maintain';
  const type = wg === 'gain' ? 'bulk' : wg === 'lose' ? 'cut' : 'maintain';
  return { type, ...PHASE_TYPES[type], phase: null };
}

export function targets(db, date = todayStr()) {
  const p = db.profile || {};
  const lb = latestWeight(db) || 180;
  const kg = lb / LB_PER_KG;
  const goal = goalFor(db, date);
  let rate = goal.rate;
  if (goal.goal === 'gain' && p.experience === 'advanced') rate = [0.25, 0.35];
  const adaptive = adaptiveMaintenance(db, date);
  const estimate = estimatedMaintenance(db, lb);
  const maintenance = adaptive.ready ? adaptive.tdee : estimate;
  const sign = goal.goal === 'gain' ? 1 : goal.goal === 'lose' ? -1 : 0;
  const rateMid = (rate[0] + rate[1]) / 2;
  const delta = sign * (rateMid / 100) * lb * KCAL_PER_LB / 7;
  const floor = Math.round(bmr(p, lb) * 1.1);
  let kcal = Math.round((maintenance + delta + (db.nutrition.kcalOffset || 0)) / 10) * 10;
  const floored = kcal < floor;
  if (floored) kcal = Math.round(floor / 10) * 10;

  // Reference weight for protein: body fat % if known, otherwise cap at a BMI-25 weight for higher body fat.
  const bf = parseFloat(p.bodyFat);
  const heightM = (+p.heightIn || 70) * 0.0254;
  const capKg = 25 * heightM * heightM;
  const refKg = Number.isFinite(bf) && bf > 0 ? null : Math.min(kg, Math.max(capKg, kg * 0.85));
  let pRange;
  if (goal.goal === 'lose') {
    pRange = Number.isFinite(bf) && bf > 0 ? [2.3, 3.1].map((x) => x * kg * (1 - bf / 100)) : [1.8, 2.7].map((x) => x * refKg);
  } else {
    pRange = [1.6, 2.2].map((x) => x * (refKg ?? kg));
  }
  const protein = Math.round(pRange[0] + (pRange[1] - pRange[0]) * 0.4);
  const fat = Math.round(Math.max(0.6 * (refKg ?? kg), (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((14 * kcal) / 1000);
  const meals = db.nutrition.mealsPerDay || 4;
  const perMealProtein = Math.round(Math.max(0.4 * (refKg ?? kg), protein / meals));
  return {
    goal, rate, lb, kcal, protein, proteinRange: pRange.map(Math.round), fat, carbs, fiber, meals, perMealProtein,
    maintenance: Math.round(maintenance), estimate: Math.round(estimate), adaptive, floored, floor,
    offset: db.nutrition.kcalOffset || 0, deltaKcal: Math.round(delta),
  };
}

// ---------- Weekly check-in ----------

export function weeklyCheckin(db, today = todayStr()) {
  const t = targets(db, today);
  const avgW = (from, to) => {
    const xs = db.bodyweight.filter((b) => { const d = daysBetween(b.date, today); return d >= from && d <= to; });
    return xs.length >= 2 ? xs.reduce((a, b) => a + b.weight, 0) / xs.length : null;
  };
  const thisWk = avgW(0, 6);
  const lastWk = avgW(7, 13);
  const logged = [];
  for (let i = 0; i < 7; i++) {
    const tt = dayTotals(db, addDays(today, -i));
    if (tt.kcal > 300) logged.push(tt);
  }
  const out = { targets: t, messages: [], suggestion: 0, refs: [] };
  if (!thisWk || !lastWk) {
    out.status = 'waiting';
    out.messages.push('Weigh in at least 2–3 times in each of the last two weeks to get a check-in.');
    return out;
  }
  const pct = ((thisWk - lastWk) / lastWk) * 100;
  out.actualRate = pct;
  const [lo, hi] = t.goal.goal === 'lose' ? [-t.rate[1], -t.rate[0]] : t.goal.goal === 'gain' ? t.rate : [-0.25, 0.25];
  const mid = (lo + hi) / 2;
  if (pct < lo || pct > hi) {
    const kcalPerDay = ((mid - pct) / 100) * t.lb * KCAL_PER_LB / 7;
    out.suggestion = Math.max(-300, Math.min(300, Math.round(kcalPerDay / 50) * 50));
  }
  const fmt = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`;
  out.status = out.suggestion ? 'adjust' : 'on-track';
  out.messages.push(`Weight trend ${fmt(pct)}/week vs target ${fmt(lo)} to ${fmt(hi)}.`);
  if (out.suggestion > 0) out.messages.push(t.goal.goal === 'lose' ? `Losing faster than planned — eat about ${out.suggestion} kcal more per day to protect muscle.` : `Gaining slower than planned — add about ${out.suggestion} kcal per day.`);
  if (out.suggestion < 0) out.messages.push(t.goal.goal === 'lose' ? `Losing slower than planned — trim about ${-out.suggestion} kcal per day, or add cardio.` : `Gaining faster than planned — cut about ${-out.suggestion} kcal per day to limit fat gain.`);
  if (!out.suggestion) out.messages.push('On track — keep going.');
  out.refs.push(t.goal.goal === 'lose' ? 'helms2014' : 'iraki2019');
  if (logged.length >= 4) {
    const avgK = logged.reduce((a, x) => a + x.kcal, 0) / logged.length;
    const avgP = logged.reduce((a, x) => a + x.p, 0) / logged.length;
    if (Math.abs(avgK - t.kcal) / t.kcal > 0.12) out.messages.push(`You averaged ${Math.round(avgK)} kcal vs a ${t.kcal} target — the trend reflects what you ate, so try hitting the target before changing it.`);
    if (avgP < t.protein * 0.9) { out.messages.push(`Protein averaged ${Math.round(avgP)} g vs ${t.protein} g. Add a protein source to one or two meals.`); out.refs.push('morton2018'); }
  } else out.messages.push(`Food logged on ${logged.length} of the last 7 days — log at least 4 for better feedback.`);
  const ph = t.goal.phase;
  if (ph && t.goal.goal === 'lose' && ph.weekInPhase >= 8) {
    out.messages.push(`Week ${ph.weekInPhase} of this cut — a 1–2 week diet break at maintenance can help with adherence and recovery.`);
    out.refs.push('peos2019', 'byrne2018');
  }
  return out;
}

// ---------- Meal templates ----------
// Each template has a protein food and a carb food that get scaled, plus fixed extras.

export const MEAL_TEMPLATES = [
  { id: 'chicken-rice', name: 'Chicken, rice & broccoli', protein: 'chicken-breast', carb: 'white-rice', fixed: [['broccoli', 100], ['olive-oil', 5]] },
  { id: 'yogurt-bowl', name: 'Greek yogurt bowl', protein: 'greek-yogurt', carb: 'granola', fixed: [['blueberries', 75]] },
  { id: 'eggs-toast', name: 'Eggs, egg whites & toast', protein: 'egg-white', carb: 'wheat-bread', fixed: [['egg', 100], ['spinach', 30]] },
  { id: 'protein-oats', name: 'Protein oats', protein: 'whey', carb: 'oats', fixed: [['banana', 100], ['peanut-butter', 16]] },
  { id: 'salmon-potato', name: 'Salmon, potatoes & green beans', protein: 'salmon', carb: 'potato', fixed: [['green-beans', 100]] },
  { id: 'turkey-wrap', name: 'Turkey wrap', protein: 'turkey-deli', carb: 'flour-tortilla', fixed: [['lettuce', 30], ['tomato', 50], ['cheddar', 15]] },
  { id: 'burrito-bowl', name: 'Beef burrito bowl', protein: 'ground-beef-90', carb: 'brown-rice', fixed: [['black-beans', 80], ['salsa', 60], ['avocado', 40]] },
  { id: 'shake', name: 'Protein shake', protein: 'whey', carb: 'banana', fixed: [['milk-skim', 240], ['peanut-butter', 16]] },
  { id: 'cottage-fruit', name: 'Cottage cheese & fruit', protein: 'cottage-cheese', carb: 'pineapple', fixed: [['almonds', 15]] },
  { id: 'tofu-stirfry', name: 'Tofu stir-fry', protein: 'tofu', carb: 'white-rice', fixed: [['bell-pepper', 80], ['broccoli', 80], ['soy-sauce', 15], ['olive-oil', 5]] },
  { id: 'turkey-pasta', name: 'Turkey pasta', protein: 'ground-turkey', carb: 'pasta', fixed: [['marinara', 120], ['parmesan', 10]] },
  { id: 'tuna-rice-cakes', name: 'Tuna & rice cakes', protein: 'tuna-can', carb: 'rice-cakes', fixed: [['mayo', 10], ['cucumber', 80]] },
];

export function macrosFor(food, grams) {
  const k = grams / 100;
  const v = food.per100;
  return { kcal: v.kcal * k, p: v.p * k, c: v.c * k, f: v.f * k, fiber: v.fiber * k };
}

// Scale a template so it lands near the per-meal calorie and protein targets.
export function solveMeal(tpl, kcalTarget, proteinTarget) {
  const pf = FOODS.find((f) => f.id === tpl.protein);
  const cf = FOODS.find((f) => f.id === tpl.carb);
  const fixed = tpl.fixed.map(([id, g]) => ({ food: FOODS.find((f) => f.id === id), grams: g })).filter((x) => x.food);
  const fx = fixed.reduce((a, x) => { const m = macrosFor(x.food, x.grams); return { kcal: a.kcal + m.kcal, p: a.p + m.p }; }, { kcal: 0, p: 0 });
  let carbG = 0;
  let protG = 0;
  for (let i = 0; i < 3; i++) {
    const carbP = (cf.per100.p * carbG) / 100;
    protG = Math.max(0, ((proteinTarget - fx.p - carbP) / pf.per100.p) * 100);
    const protK = (pf.per100.kcal * protG) / 100;
    carbG = Math.max(0, ((kcalTarget - fx.kcal - protK) / cf.per100.kcal) * 100);
  }
  const r5 = (g) => Math.max(5, Math.round(g / 5) * 5);
  const items = [{ food: pf, grams: r5(protG) }, { food: cf, grams: r5(carbG) }, ...fixed];
  const tot = items.reduce((a, x) => { const m = macrosFor(x.food, x.grams); for (const k of Object.keys(a)) a[k] += m[k]; return a; }, { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 });
  return { items, totals: tot };
}
