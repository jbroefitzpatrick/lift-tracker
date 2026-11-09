// Plan builder: turns a person's profile and goals into a training prescription and a weekly plan.
// Every number traces back to a reference in science.js (ids in `refs`).
import { MUSCLES } from './bank.js';

export const GOALS = {
  strength: { label: 'Strength', desc: 'Lift heavier on the big compound lifts.' },
  hypertrophy: { label: 'Muscle growth', desc: 'Build overall muscle size.' },
  physique: { label: 'Bodybuilding / physique', desc: 'Balanced, aesthetic development — extra isolation for delts, arms and calves.' },
  stamina: { label: 'Muscular endurance', desc: 'More reps, shorter rests, better work capacity.' },
  endurance: { label: 'Cardio endurance', desc: 'Aerobic fitness for running, cycling or events.' },
  fatLoss: { label: 'Fat loss', desc: 'Lose fat while keeping muscle.' },
};

export const EXPERIENCE = {
  beginner: { label: 'Beginner', desc: 'Under ~1 year of consistent lifting' },
  intermediate: { label: 'Intermediate', desc: '1–3 years; progress week to week has slowed' },
  advanced: { label: 'Advanced', desc: '3+ years; progress takes months' },
};

export const EQUIPMENT = { barbell: 'Barbell', dumbbell: 'Dumbbells', machine: 'Machines', cable: 'Cables', bodyweight: 'Pull-up bar / bodyweight' };
export const LIMITS = { shoulder: 'Shoulders', lowerBack: 'Lower back', knee: 'Knees' };
export const WEIGHT_GOALS = { gain: 'Gain (build)', maintain: 'Maintain', lose: 'Lose (cut)' };

// Per-goal prescription. Reps are [low, high]; rest in seconds; rir = typical reps in reserve;
// weekly = hard sets per muscle per week; cardioMin = minutes of cardio per week.
const GOAL_RX = {
  strength: { main: [3, 6], comp: [5, 8], iso: [8, 12], mainSets: 4, sets: 3, isoSets: 2, restMain: 210, rest: 150, restIso: 90, rir: 2, weekly: [6, 12], cardioMin: 60, superset: 0 },
  hypertrophy: { main: [6, 10], comp: [8, 12], iso: [10, 15], mainSets: 3, sets: 3, isoSets: 3, restMain: 165, rest: 120, restIso: 75, rir: 1, weekly: [10, 20], cardioMin: 90, superset: 0.3 },
  physique: { main: [6, 10], comp: [8, 12], iso: [12, 20], mainSets: 3, sets: 3, isoSets: 3, restMain: 150, rest: 105, restIso: 60, rir: 1, weekly: [12, 20], cardioMin: 120, superset: 0.6 },
  stamina: { main: [10, 15], comp: [12, 20], iso: [15, 25], mainSets: 3, sets: 3, isoSets: 3, restMain: 75, rest: 60, restIso: 40, rir: 2, weekly: [8, 14], cardioMin: 120, superset: 1 },
  endurance: { main: [4, 8], comp: [6, 10], iso: [10, 15], mainSets: 3, sets: 3, isoSets: 2, restMain: 150, rest: 120, restIso: 60, rir: 2.5, weekly: [6, 10], cardioMin: 240, superset: 0.3 },
  fatLoss: { main: [6, 10], comp: [8, 12], iso: [12, 15], mainSets: 3, sets: 3, isoSets: 2, restMain: 120, rest: 90, restIso: 60, rir: 2, weekly: [8, 14], cardioMin: 200, superset: 0.8 },
};

export function latestBodyweight(db) {
  const list = [...(db.bodyweight || [])].sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1].weight : null;
}

export function defaultProfile(db) {
  return {
    age: 30, sex: '', heightIn: 70, weightLb: latestBodyweight(db) || 180, bodyFat: '', build: 'average',
    experience: 'intermediate',
    goals: { strength: 2, hypertrophy: 4, physique: 2, stamina: 0, endurance: 1, fatLoss: 0 },
    weightGoal: null, liftDays: null, cardioDays: null, sessionMin: 60,
    equipment: Object.keys(EQUIPMENT), limits: [], split: null,
  };
}

// Body composition class. Body fat % if given (ACE-style cutoffs), else the self-chosen build, else BMI.
export function bodyClass(p) {
  const bmi = p.heightIn && p.weightLb ? (703 * p.weightLb) / (p.heightIn * p.heightIn) : null;
  const bf = parseFloat(p.bodyFat);
  if (Number.isFinite(bf) && bf > 0) {
    const [lean, high] = p.sex === 'female' ? [21, 32] : p.sex === 'male' ? [14, 25] : [17, 28];
    return { cls: bf < lean ? 'lean' : bf > high ? 'higher' : 'average', bmi, source: 'body fat %' };
  }
  if (p.build) return { cls: p.build, bmi, source: 'your build' };
  return { cls: bmi >= 30 ? 'higher' : 'average', bmi, source: 'BMI' };
}

export function goalWeights(p) {
  const raw = { ...p.goals };
  const total = Object.values(raw).reduce((a, b) => a + (+b || 0), 0);
  if (!total) return { hypertrophy: 1, strength: 0, physique: 0, stamina: 0, endurance: 0, fatLoss: 0 };
  return Object.fromEntries(Object.keys(GOALS).map((g) => [g, (+raw[g] || 0) / total]));
}

const r5 = (x) => Math.round(x / 5) * 5;
const r15 = (x) => Math.round(x / 15) * 15;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function suggestedWeightGoal(p) {
  const g = p.goals;
  const { cls } = bodyClass(p);
  if (g.fatLoss >= 3 || (cls === 'higher' && g.fatLoss >= 1)) return 'lose';
  if (g.fatLoss === 0 && cls !== 'higher' && (g.hypertrophy >= 3 || g.physique >= 3)) return 'gain';
  return 'maintain';
}

// ---------- Prescription ----------

export function prescription(p) {
  const w = goalWeights(p);
  const goals = Object.keys(GOAL_RX);
  const blend = (k) => goals.reduce((a, g) => a + w[g] * GOAL_RX[g][k], 0);
  const blendR = (k) => [0, 1].map((i) => goals.reduce((a, g) => a + w[g] * GOAL_RX[g][k][i], 0));
  const why = [];
  const age = +p.age || 30;
  const exp = p.experience || 'intermediate';

  let main = blendR('main');
  let comp = blendR('comp');
  let iso = blendR('iso');
  let rir = blend('rir');
  let volMult = { beginner: 0.7, intermediate: 1, advanced: 1.15 }[exp];
  let repFloor = 1;

  if (exp === 'beginner') {
    repFloor = 6; rir += 1;
    why.push({ k: 'Experience', t: 'Beginner: fewer sets, reps kept at 6+ and 2–3 reps in reserve while technique develops. Progress comes quickly at this stage.', refs: ['acsm2009'] });
  } else if (exp === 'advanced') {
    why.push({ k: 'Experience', t: 'Advanced: more weekly volume and more frequent deloads, since progress needs a bigger stimulus.', refs: ['acsm2009', 'pelland2026'] });
  }
  let deloadEvery = { beginner: 6, intermediate: 5, advanced: 4 }[exp];
  if (age < 18) {
    repFloor = Math.max(repFloor, 6); rir = Math.max(rir, 2);
    why.push({ k: 'Age', t: 'Under 18: train with qualified supervision, focus on technique, and stay at 6+ reps.', refs: ['faigenbaum2009'] });
  } else if (age >= 65) {
    volMult *= 0.8; repFloor = Math.max(repFloor, 6); rir = Math.max(rir, 2); deloadEvery = Math.min(deloadEvery, 4);
    why.push({ k: 'Age', t: '65+: slightly lower volume, 6+ reps, a little more left in reserve, and more frequent recovery weeks. Keep training hard enough to progress.', refs: ['fragala2019'] });
  } else if (age >= 50) {
    volMult *= 0.9; deloadEvery = Math.min(deloadEvery, 4);
    why.push({ k: 'Age', t: '50+: a bit less volume and a deload every 4 weeks to allow for slower recovery.', refs: ['fragala2019'] });
  }

  const fixRange = ([lo, hi], gap) => {
    let a = Math.max(repFloor, Math.round(lo));
    let b = Math.max(Math.round(hi), a + gap);
    return [a, b];
  };
  main = fixRange(main, 2);
  comp = fixRange(comp, 3);
  iso = fixRange(iso, 4);

  const sets = clamp(Math.round(blend('sets') * volMult), 2, 5);
  const mainSets = clamp(Math.round(blend('mainSets') * volMult), 2, 5);
  const isoSets = clamp(Math.round(blend('isoSets') * volMult), 2, 4);
  const weekly = blendR('weekly').map((x) => Math.round(x * volMult));
  const rirLo = clamp(Math.round(rir - 1), 0, 3);

  let cardioMin = r5(blend('cardioMin') / 10) * 10;
  const g = p.goals;
  if (g.endurance >= 4) cardioMin = Math.max(cardioMin, 240);
  else if (g.endurance >= 3) cardioMin = Math.max(cardioMin, 180);
  if (g.fatLoss >= 4) cardioMin = Math.max(cardioMin, 260);
  else if (g.fatLoss >= 3) cardioMin = Math.max(cardioMin, 200);
  cardioMin = Math.max(60, Math.min(420, cardioMin));

  const bc = bodyClass(p);
  const preferLowImpact = bc.cls === 'higher' || (p.limits || []).includes('knee') || age >= 60;
  let superset = blend('superset');
  if ((+p.sessionMin || 60) <= 45) superset += 0.4;
  const weightGoal = p.weightGoal || suggestedWeightGoal(p);
  const rate = weightGoal === 'gain' ? (exp === 'advanced' ? [0.25, 0.35] : [0.25, 0.5]) : weightGoal === 'lose' ? [0.5, 1] : [-0.25, 0.25];

  const rx = {
    weights: w, main, comp, iso, mainSets, sets, isoSets,
    restMain: r15(blend('restMain')), rest: r15(blend('rest')), restIso: r15(blend('restIso')),
    rir: `${rirLo}–${rirLo + 2}`, rirLo, weekly, deloadEvery, cardioMin, easyShare: 0.8,
    pairIso: superset >= 0.4, includePhysique: w.physique >= 0.15 || g.physique >= 3,
    preferLowImpact, bodyClass: bc, weightGoal, rate, why,
  };

  // Explanations for the core numbers.
  why.unshift(
    { k: 'Reps', t: `Main lifts ${main[0]}–${main[1]}, other compounds ${comp[0]}–${comp[1]}, isolation ${iso[0]}–${iso[1]}. Heavy, low-rep work builds maximal strength best; muscle grows across a wide rep range when sets end near failure, so lighter accessories use higher reps.`, refs: ['nsca2016', 'schoenfeld2017load', 'acsm2009'] },
    { k: 'Volume', t: `${weekly[0]}–${weekly[1]} hard sets per muscle each week (a set counts ½ for muscles that only assist). More volume gives more growth, with diminishing returns.`, refs: ['schoenfeld2017vol', 'pelland2026'] },
    { k: 'Frequency', t: 'Each muscle is trained about twice a week where the schedule allows — better for growth than once, and more frequent practice helps strength.', refs: ['schoenfeld2016freq', 'grgic2018freq', 'pelland2026'] },
    { k: 'Rest', t: `About ${fmtSec(rx.restMain)} on main lifts, ${fmtSec(rx.rest)} on other compounds, ${fmtSec(rx.restIso)} on isolation${rx.pairIso ? ' (paired into supersets to save time)' : ''}. Longer rests on big lifts keep performance — and results — higher.`, refs: ['schoenfeld2016rest', 'grgic2018rest', 'nsca2016'] },
    { k: 'Effort', t: `End most sets with ${rx.rir} reps in reserve. Going all the way to failure adds little and costs more recovery.`, refs: ['refalo2023'] },
  );
  const cardioRefs = ['who2020', 'seiler2010', 'schumann2022'];
  let cardioText = `${cardioMin} min of cardio a week, about 80% easy (conversational) and 20% hard.`;
  if (g.fatLoss >= 3) { cardioText += ' For fat loss, more than 250 min/week gives the clearest results.'; cardioRefs.push('donnelly2009', 'willis2012'); }
  if (g.endurance >= 2) { cardioText += ' Keep 2–3 heavy strength days — it improves running and cycling economy.'; cardioRefs.push('ronnestad2014'); }
  cardioText += ' Cardio done alongside lifting doesn\'t meaningfully reduce muscle or strength gains, especially in separate sessions; cycling interferes less than running.';
  cardioRefs.push('lundberg2022');
  why.push({ k: 'Cardio', t: cardioText, refs: cardioRefs });
  if (preferLowImpact) why.push({ k: 'Impact', t: 'Low-impact cardio (bike, rower, incline walk, swim) is favoured to go easier on joints.', refs: ['garber2011'] });
  why.push({ k: 'Deloads', t: `A lighter week every ${deloadEvery} weeks (half the sets, same weights). Coaches commonly deload every 4–6 weeks; this is practice-based rather than trial-proven.`, refs: ['bell2022'] });
  const rateText = weightGoal === 'gain' ? `gain ${rate[0]}–${rate[1]}% of bodyweight per week` : weightGoal === 'lose' ? `lose ${rate[0]}–${rate[1]}% of bodyweight per week` : 'keep bodyweight within about ±0.25% per week';
  why.push({ k: 'Bodyweight', t: `Aim to ${rateText}.`, refs: weightGoal === 'gain' ? ['iraki2019'] : weightGoal === 'lose' ? ['helms2014'] : [] });
  return rx;
}

export function fmtSec(s) {
  if (s < 120) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`;
}

// ---------- Days per week ----------

export function suggestDays(p, rx) {
  const reasons = [];
  const w = rx.weights;
  const exp = p.experience || 'intermediate';
  let lift = { beginner: 3, intermediate: 4, advanced: 5 }[exp];
  reasons.push(`At the ${EXPERIENCE[exp].label.toLowerCase()} level, ${lift} lifting days a week usually works best.`);
  if (w.endurance >= 0.4) {
    lift = Math.min(lift, w.endurance >= 0.6 ? 2 : 3);
    reasons.push(`Endurance focus: ${lift} strength days leaves room for cardio and still improves economy.`);
  }
  if ((+p.sessionMin || 60) <= 45 && lift < 6 && w.endurance < 0.4) { lift += 1; reasons.push('Short sessions: one extra day keeps weekly volume up.'); }
  if ((+p.sessionMin || 60) >= 90 && lift > 3) { lift -= 1; reasons.push('Long sessions: one fewer day covers the same volume.'); }
  if ((+p.age || 30) >= 65 && lift > 3) { lift = 3; reasons.push('Age 65+: 3 days gives more recovery time.'); }
  lift = clamp(lift, 2, 6);
  const perSession = w.endurance >= 0.3 || w.fatLoss >= 0.25 ? 45 : 35;
  const cardio = clamp(Math.round(rx.cardioMin / perSession), 1, exp === 'beginner' ? 5 : 6);
  reasons.push(`${rx.cardioMin} min of cardio ≈ ${cardio} sessions of ~${perSession} min.`);
  return { lift, cardio, perSession, reasons };
}

// ---------- Splits ----------

export const SPLITS = {
  fb: { label: 'Full body', short: 'FB' },
  ul: { label: 'Upper / Lower', short: 'UL' },
  ppl: { label: 'Push / Pull / Legs', short: 'PPL' },
  ulppl: { label: 'Upper / Lower + Push / Pull / Legs', short: 'ULPPL' },
};

const LAYOUT = {
  2: { fb: ['fbA', 'fbB'], ul: ['upperA', 'lowerA'] },
  3: { fb: ['fbA', 'fbB', 'fbC'], ul: ['upperA', 'lowerA', 'fbA'], ppl: ['push', 'pull', 'legs'] },
  4: { ul: ['upperA', 'lowerA', 'upperB', 'lowerB'], fb: ['fbA', 'fbB', 'fbC', 'fbA2'] },
  5: { ulppl: ['upperA', 'lowerA', 'push', 'pull', 'legs'], ul: ['upperA', 'lowerA', 'upperB', 'lowerB', 'fbA'] },
  6: { ppl: ['push', 'pull', 'legs', 'push2', 'pull2', 'legs2'], ul: ['upperA', 'lowerA', 'upperB', 'lowerB', 'upperA2', 'lowerA2'] },
};
const RECOMMENDED = { 2: 'fb', 3: 'fb', 4: 'ul', 5: 'ulppl', 6: 'ppl' };
export const WEEK_LAYOUT = {
  2: ['mon', 'thu'], 3: ['mon', 'wed', 'fri'], 4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'thu', 'fri'], 6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

const SPLIT_DESC = {
  fb: (n) => `Every session trains the whole body, so each muscle gets ${n}× a week. Simple and efficient — the standard for beginners and 2–3 day schedules.`,
  ul: (n) => (n === 2 ? 'One upper and one lower day — each muscle once a week. Workable, but 2× a week grows more muscle.'
    : n === 3 ? 'Upper, lower, then a full-body day — each muscle about twice a week.'
      : n === 5 ? 'Two upper/lower rotations plus a full-body day — each muscle 2–3× a week.'
        : `Alternates upper and lower days — each muscle ${n === 6 ? 3 : 2}× a week with more volume per session.`),
  ppl: (n) => (n === 3 ? 'Each muscle once a week. Fine for maintaining, but twice a week builds more muscle.'
    : 'Push, pull and legs twice through — each muscle 2× a week with plenty of volume. Best for experienced lifters with time.'),
  ulppl: () => 'Upper and lower, then push, pull and legs — each muscle about twice a week in 5 days.',
};

export function splitOptions(liftDays) {
  const opts = LAYOUT[liftDays] || {};
  return Object.keys(opts).map((id) => ({
    id, label: SPLITS[id].label, desc: SPLIT_DESC[id](liftDays), templates: opts[id],
    recommended: RECOMMENDED[liftDays] === id,
    refs: ['schoenfeld2016freq', 'acsm2009'],
  }));
}

// ---------- Exercise slots & day templates ----------

const SLOTS = {
  squat: { patterns: ['squat'], prefer: ['back-squat', 'safety-bar-squat', 'hack-squat', 'front-squat', 'leg-press', 'smith-squat', 'belt-squat', 'goblet-squat'] },
  squat2: { patterns: ['squat'], prefer: ['leg-press', 'hack-squat', 'pendulum-squat', 'belt-squat', 'smith-squat', 'goblet-squat'] },
  hinge: { patterns: ['hinge'], prefer: ['deadlift', 'trap-bar-deadlift', 'sumo-deadlift', 'rdl', 'db-rdl'] },
  rdl: { patterns: ['hinge'], prefer: ['rdl', 'db-rdl', 'good-morning', 'single-leg-rdl', 'cable-pull-through'] },
  lunge: { patterns: ['lunge'], prefer: ['bulgarian-split-squat', 'walking-lunge', 'reverse-lunge', 'step-up'] },
  hipExt: { patterns: ['hip-extension'], prefer: ['hip-thrust', 'machine-hip-thrust', 'glute-bridge', 'cable-kickback'] },
  kneeFlex: { patterns: ['knee-flexion'], prefer: ['lying-ham-curl', 'seated-ham-curl', 'nordic-curl', 'ghr'] },
  kneeExt: { patterns: ['knee-extension'], prefer: ['leg-extension'] },
  calf: { patterns: ['calf-raise'], prefer: ['standing-calf', 'seated-calf', 'calf-press', 'smith-calf', 'single-leg-calf'] },
  abd: { patterns: ['hip-abduction'], prefer: ['hip-abductor', 'cable-hip-abduction'] },
  hPush: { patterns: ['horizontal-push'], prefer: ['bench-press', 'db-bench', 'machine-chest-press', 'weighted-pushup', 'pushup'] },
  iPush: { patterns: ['incline-push'], prefer: ['db-incline-bench', 'incline-bench', 'incline-machine-press', 'smith-incline', 'landmine-press'] },
  vPush: { patterns: ['vertical-push'], prefer: ['db-shoulder-press', 'ohp', 'machine-shoulder-press', 'arnold-press'] },
  fly: { patterns: ['chest-fly'], prefer: ['cable-fly', 'machine-fly', 'db-fly', 'low-high-cable-fly', 'db-incline-fly'] },
  hPull: { patterns: ['horizontal-pull'], prefer: ['bb-row', 'chest-supported-db-row', 'cable-row', 'machine-row', 'db-row', 'iso-row', 't-bar-row', 'inverted-row'] },
  hPull2: { patterns: ['horizontal-pull'], prefer: ['cable-row', 'chest-supported-db-row', 'machine-row', 'db-row', 'iso-row', 'inverted-row'] },
  vPull: { patterns: ['vertical-pull'], prefer: ['pullup', 'lat-pulldown', 'neutral-pullup', 'chinup', 'machine-pulldown', 'assisted-pullup'] },
  vPull2: { patterns: ['vertical-pull'], prefer: ['lat-pulldown', 'close-grip-pulldown', 'neutral-pullup', 'single-arm-pulldown', 'machine-pulldown', 'assisted-pullup'] },
  pullover: { patterns: ['pullover'], prefer: ['straight-arm-pulldown', 'db-pullover'] },
  lat: { patterns: ['lateral-raise'], prefer: ['cable-lat-raise', 'db-lat-raise', 'machine-lat-raise'] },
  rear: { patterns: ['rear-delt'], prefer: ['face-pull', 'rear-delt-fly', 'cable-rear-delt-fly', 'db-rear-delt-fly'] },
  curl: { patterns: ['elbow-flexion'], prefer: ['ez-curl', 'db-curl', 'cable-curl', 'bb-curl', 'incline-db-curl', 'preacher-curl'] },
  curl2: { patterns: ['elbow-flexion'], prefer: ['hammer-curl', 'incline-db-curl', 'preacher-curl', 'spider-curl', 'btb-cable-curl'] },
  tri: { patterns: ['elbow-extension'], prefer: ['cable-pushdown', 'skullcrusher', 'overhead-cable-ext', 'db-overhead-ext'] },
  tri2: { patterns: ['elbow-extension'], prefer: ['overhead-cable-ext', 'db-overhead-ext', 'skullcrusher', 'cable-tri-ext', 'db-kickback'] },
  shrug: { patterns: ['shrug'], prefer: ['db-shrug', 'bb-shrug'] },
  abs: { patterns: ['core-flexion', 'hip-flexion', 'anti-extension'], prefer: ['cable-crunch', 'hanging-leg-raise', 'ab-wheel', 'ab-crunch-machine', 'decline-situp', 'leg-raise'] },
  core2: { patterns: ['anti-rotation', 'hip-flexion', 'rotation'], prefer: ['pallof-press', 'hanging-leg-raise', 'cable-woodchop', 'vertical-leg-raise'] },
};

// [slot, role, priority]: role main | comp | iso. Priority 1 = keep, 2 = normal, 3 = first to drop, 'p' = physique only.
const TEMPLATES = {
  fbA: { name: 'Full body A', legs: true, slots: [['squat', 'main', 1], ['hPush', 'comp', 1], ['hPull', 'comp', 1], ['rdl', 'comp', 2], ['lat', 'iso', 2], ['curl', 'iso', 3], ['tri', 'iso', 3], ['abs', 'iso', 3], ['calf', 'iso', 'p']] },
  fbB: { name: 'Full body B', legs: true, slots: [['hinge', 'main', 1], ['vPush', 'comp', 1], ['vPull', 'comp', 1], ['lunge', 'comp', 2], ['rear', 'iso', 2], ['fly', 'iso', 3], ['tri2', 'iso', 3], ['curl2', 'iso', 3], ['lat', 'iso', 'p']] },
  fbC: { name: 'Full body C', legs: true, slots: [['squat2', 'main', 1], ['iPush', 'comp', 1], ['hPull2', 'comp', 1], ['kneeFlex', 'iso', 2], ['lat', 'iso', 2], ['curl', 'iso', 3], ['tri', 'iso', 3], ['calf', 'iso', 3]] },
  upperA: { name: 'Upper A', slots: [['hPush', 'main', 1], ['hPull', 'comp', 1], ['vPush', 'comp', 2], ['vPull2', 'comp', 1], ['lat', 'iso', 2], ['curl', 'iso', 2], ['tri', 'iso', 2], ['rear', 'iso', 'p']] },
  upperB: { name: 'Upper B', slots: [['iPush', 'main', 1], ['vPull', 'comp', 1], ['hPull2', 'comp', 1], ['fly', 'iso', 2], ['rear', 'iso', 2], ['curl2', 'iso', 2], ['tri2', 'iso', 2], ['lat', 'iso', 'p']] },
  lowerA: { name: 'Lower A', legs: true, slots: [['squat', 'main', 1], ['rdl', 'comp', 1], ['kneeExt', 'iso', 2], ['kneeFlex', 'iso', 2], ['calf', 'iso', 2], ['abs', 'iso', 3], ['abd', 'iso', 'p']] },
  lowerB: { name: 'Lower B', legs: true, slots: [['hinge', 'main', 1], ['squat2', 'comp', 1], ['hipExt', 'comp', 2], ['lunge', 'comp', 3], ['kneeFlex', 'iso', 2], ['calf', 'iso', 2], ['core2', 'iso', 3]] },
  push: { name: 'Push', slots: [['hPush', 'main', 1], ['vPush', 'comp', 1], ['iPush', 'comp', 2], ['fly', 'iso', 2], ['lat', 'iso', 1], ['tri', 'iso', 2], ['tri2', 'iso', 3]] },
  pull: { name: 'Pull', slots: [['vPull', 'main', 1], ['hPull', 'comp', 1], ['vPull2', 'comp', 3], ['pullover', 'iso', 3], ['rear', 'iso', 2], ['curl', 'iso', 2], ['curl2', 'iso', 3], ['shrug', 'iso', 'p'], ['abs', 'iso', 3]] },
  legs: { name: 'Legs', legs: true, slots: [['squat', 'main', 1], ['rdl', 'comp', 1], ['squat2', 'comp', 2], ['kneeFlex', 'iso', 2], ['kneeExt', 'iso', 2], ['calf', 'iso', 2], ['hipExt', 'comp', 3], ['core2', 'iso', 3]] },
};
const VARIANT_NAMES = { fbA2: 'Full body D', upperA2: 'Upper C', lowerA2: 'Lower C', push2: 'Push B', pull2: 'Pull B', legs2: 'Legs B' };

// Exercises that commonly aggravate each area; skipped when that limitation is selected.
const JOINT_STRESS = {
  shoulder: ['ohp', 'dip', 'hspu', 'upright-row', 'bench-press', 'incline-bench', 'decline-bench', 'close-grip-bench', 'skullcrusher', 'arnold-press', 'machine-dip', 'db-fly', 'db-pullover'],
  lowerBack: ['deadlift', 'sumo-deadlift', 'good-morning', 'bb-row', 'pendlay-row', 't-bar-row', 'meadows-row', 'back-squat', 'front-squat', 'rdl', 'bb-shrug'],
  knee: ['back-squat', 'front-squat', 'safety-bar-squat', 'walking-lunge', 'bulgarian-split-squat', 'reverse-lunge', 'step-up', 'leg-extension', 'pendulum-squat', 'jump-rope'],
};

// Exercises that need a strength or skill base; ranked last for beginners and people 65+.
const DEMANDING = ['nordic-curl', 'ghr', 'hspu', 'pullup', 'chinup', 'neutral-pullup', 'pendlay-row', 'good-morning', 'sumo-deadlift', 'ab-wheel', 'copenhagen-plank', 'dip', 'hanging-leg-raise', 'front-squat'];

const equipOf = (type) => (type?.startsWith('barbell') ? 'barbell' : type);

function pickExercise(db, p, slotKey, variant, usedToday, role) {
  const slot = SLOTS[slotKey];
  const equip = p.equipment?.length ? p.equipment : Object.keys(EQUIPMENT);
  const gym = db.gyms?.find((g) => g.id === db.settings?.activeGym);
  const prefs = db.exPrefs || {};
  const blocked = new Set([...(p.limits || []).flatMap((l) => JOINT_STRESS[l] || []), ...(gym?.unavailable || []), ...Object.keys(prefs).filter((k) => prefs[k] === 'never')]);
  const cands = Object.values(db.exercises).filter((e) => slot.patterns.includes(e.pattern)
    && equip.includes(equipOf(e.type)) && !blocked.has(e.id) && !usedToday.has(e.id));
  if (!cands.length) return null;
  const easier = p.experience === 'beginner' || (+p.age || 30) >= 65;
  const rank = (e) => { const i = slot.prefer.indexOf(e.id); return (i < 0 ? 100 : i) + (easier && DEMANDING.includes(e.id) ? 50 : 0) - (prefs[e.id] === 'fav' ? 30 : 0); };
  cands.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const pick = cands[Math.min(variant, cands.length - 1)];
  // A hard isolation move is not worth it for a beginner or older lifter; the slot is skipped.
  if (easier && role === 'iso' && DEMANDING.includes(pick.id)) return null;
  return pick;
}

function roleRx(rx, role) {
  if (role === 'main') return { sets: rx.mainSets, repMin: rx.main[0], repMax: rx.main[1], restSec: rx.restMain };
  if (role === 'comp') return { sets: rx.sets, repMin: rx.comp[0], repMax: rx.comp[1], restSec: rx.rest };
  return { sets: rx.isoSets, repMin: rx.iso[0], repMax: rx.iso[1], restSec: rx.restIso };
}

// ---------- Volume ----------

export const VOLUME_MUSCLES = ['chest', 'lats', 'upper-back', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];

// Weekly hard sets per muscle, counting secondary muscles as half a set.
export function weeklySets(db, plan) {
  const out = {};
  for (const day of Object.values(plan)) {
    for (const it of day.items) {
      const ex = db.exercises[it.exerciseId];
      if (!ex) continue;
      for (const m of ex.primary) out[m] = (out[m] || 0) + it.sets;
      for (const m of ex.secondary) out[m] = (out[m] || 0) + it.sets * 0.5;
    }
  }
  return out;
}

export function volumeTarget(rx, m) {
  const [lo, hi] = rx.weekly;
  if (m === 'abs' || m === 'calves' || m === 'rear-delts') return [Math.round(lo * 0.6), hi];
  if (rx.includePhysique && ['side-delts', 'biceps', 'triceps', 'calves', 'rear-delts'].includes(m)) return [Math.round(lo * 1.1), Math.round(hi * 1.1)];
  return [lo, hi];
}

const FILL_SLOT = {
  'side-delts': 'lat', 'rear-delts': 'rear', biceps: 'curl2', triceps: 'tri2', calves: 'calf', abs: 'abs',
  chest: 'fly', hamstrings: 'kneeFlex', quads: 'kneeExt', lats: 'pullover', 'upper-back': 'hPull2', glutes: 'hipExt',
};
const UPPER = ['chest', 'lats', 'upper-back', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'front-delts'];

// Add one isolation exercise for muscle m to the lightest day that already trains that region.
function addFiller(db, p, plan, rx, m) {
  const slotKey = FILL_SLOT[m];
  if (!slotKey) return false;
  const upper = UPPER.includes(m);
  const region = (exId) => db.exercises[exId].primary.some((x) => (m === 'abs' ? true : UPPER.includes(x) === upper));
  const days = Object.values(plan).filter((d) => d.items.some((it) => region(it.exerciseId)))
    .sort((a, b) => a.items.length - b.items.length);
  for (const d of days) {
    const used = new Set(d.items.map((it) => it.exerciseId));
    const ex = pickExercise(db, p, slotKey, 0, used, 'iso');
    if (!ex) continue;
    d.items.push({ slotKey, role: 'iso', prio: 2, exerciseId: ex.id, ...roleRx(rx, 'iso'), sets: 2 });
    return true;
  }
  return false;
}

function balanceVolume(db, plan, rx, p) {
  let items = Object.values(plan).flatMap((d) => d.items);
  const filled = new Set();
  const cap = { main: 5, comp: 4, iso: 4 };
  for (let i = 0; i < 60; i++) {
    const ws = weeklySets(db, plan);
    let changed = false;
    // Raise the most under-trained muscle that has an exercise to add a set to.
    const under = VOLUME_MUSCLES.map((m) => ({ m, gap: volumeTarget(rx, m)[0] - (ws[m] || 0) }))
      .filter((x) => x.gap >= 1).sort((a, b) => b.gap - a.gap);
    for (const { m } of under) {
      const it = items.filter((x) => x.role !== 'main' && x.sets < cap[x.role] && db.exercises[x.exerciseId].primary.includes(m))
        .sort((a, b) => a.sets - b.sets)[0];
      if (it) { it.sets += 1; changed = true; break; }
      if (!filled.has(m) && addFiller(db, p, plan, rx, m)) {
        filled.add(m);
        items = Object.values(plan).flatMap((d) => d.items);
        changed = true;
        break;
      }
    }
    if (changed) continue;
    // Trim the most over-trained muscle.
    const over = VOLUME_MUSCLES.map((m) => ({ m, extra: (ws[m] || 0) - volumeTarget(rx, m)[1] * 1.2 }))
      .filter((x) => x.extra > 0).sort((a, b) => b.extra - a.extra);
    for (const { m } of over) {
      const it = items.filter((x) => x.role !== 'main' && x.sets > 2 && db.exercises[x.exerciseId].primary.includes(m))
        .sort((a, b) => (a.role === 'iso' ? -1 : 1) - (b.role === 'iso' ? -1 : 1) || b.sets - a.sets)[0];
      if (it) { it.sets -= 1; changed = true; break; }
    }
    if (!changed) break;
  }
}

// ---------- Supersets & session length ----------

function groupDay(items, rx) {
  let n = 0;
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const next = items[i + 1];
    if (rx.pairIso && it.role === 'iso' && next && next.role === 'iso') {
      n += 1;
      out.push({ ...it, group: `${n}a`, restSec: 0 }, { ...next, group: `${n}b`, restSec: Math.max(it.restSec, next.restSec) });
      i += 1;
    } else {
      n += 1;
      out.push({ ...it, group: String(n) });
    }
  }
  return out;
}

const WORK_MIN = 0.75; // ~45 s per set including setup
const WARMUP_MIN = 8;

export function estimateMinutes(items) {
  let total = WARMUP_MIN;
  const groups = {};
  for (const it of items) (groups[String(it.group).match(/^\d+/)?.[0] ?? it.group] ||= []).push(it);
  for (const g of Object.values(groups)) {
    const rounds = Math.max(...g.map((x) => x.sets));
    const rest = Math.max(...g.map((x) => x.restSec || 0));
    total += g.reduce((a, x) => a + x.sets * WORK_MIN, 0) + (rounds - 1) * (rest / 60) + 1;
  }
  return Math.round(total);
}

function fitTime(items, rx, minutes) {
  let day = groupDay(items, rx);
  for (let i = 0; i < 40 && estimateMinutes(day) > minutes + 3; i++) {
    const prioOrder = ['p', 3, 2];
    let dropIdx = -1;
    for (const pr of prioOrder) {
      for (let j = items.length - 1; j >= 0; j--) if (items[j].prio === pr && items[j].role === 'iso') { dropIdx = j; break; }
      if (dropIdx >= 0) break;
    }
    if (dropIdx >= 0 && items.length > 4) items.splice(dropIdx, 1);
    else {
      const it = [...items].reverse().find((x) => x.role === 'iso' && x.sets > 2)
        || [...items].reverse().find((x) => x.role === 'comp' && x.sets > 2)
        || [...items].reverse().find((x) => x.role === 'main' && x.sets > 3);
      if (!it) break;
      it.sets -= 1;
    }
    day = groupDay(items, rx);
  }
  return day;
}

// ---------- Cardio placement ----------

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function placeCardio(liftDays, legDays, cardioDays) {
  const modes = Object.fromEntries(DAYS.map((d) => [d, liftDays.includes(d) ? 'lift' : 'rest']));
  const free = DAYS.filter((d) => !liftDays.includes(d));
  const beforeLegs = (d) => legDays.includes(DAYS[(DAYS.indexOf(d) + 1) % 7]);
  // Prefer free days that aren't right before a leg day; Sunday is the last choice so it stays a rest day.
  const order = [...free].sort((a, b) => (beforeLegs(a) + (a === 'sun') * 1.5) - (beforeLegs(b) + (b === 'sun') * 1.5));
  let n = cardioDays;
  const keepRest = free.length > 1 ? 1 : 0; // leave at least one full rest day
  for (const d of order.slice(0, Math.max(0, free.length - keepRest))) { if (n <= 0) break; modes[d] = 'cardio'; n -= 1; }
  // Any remaining cardio goes after lifting, on non-leg days first.
  const liftOrder = [...liftDays].sort((a, b) => legDays.includes(a) - legDays.includes(b));
  for (const d of liftOrder) { if (n <= 0) break; modes[d] = 'both'; n -= 1; }
  return modes;
}

// ---------- Generate ----------

export function generatePlan(db, p, rx, liftDays, cardioDays, splitId) {
  const templates = LAYOUT[liftDays]?.[splitId];
  if (!templates) throw new Error('That split does not fit that many days.');
  const days = WEEK_LAYOUT[liftDays];
  const plan = {};
  const legDays = [];
  const easier = p.experience === 'beginner' || (+p.age || 30) >= 65;
  days.forEach((day, di) => {
    const key = templates[di];
    const variant = key.endsWith('2') ? 1 : 0;
    const t = TEMPLATES[key.replace(/2$/, '')];
    if (t.legs) legDays.push(day);
    const used = new Set();
    const items = [];
    for (const [slotKey, role, prio] of t.slots) {
      if (prio === 'p' && !rx.includePhysique) continue;
      if (prio === 3 && p.experience === 'beginner') continue;
      const ex = pickExercise(db, p, slotKey, variant, used, role);
      if (!ex) continue;
      used.add(ex.id);
      items.push({ slotKey, role, prio, exerciseId: ex.id, ...roleRx(rx, role) });
    }
    let name = VARIANT_NAMES[key] || t.name;
    if (splitId === 'ppl' && liftDays === 6 && !variant) name += ' A';
    plan[day] = { name, items };
  });

  balanceVolume(db, plan, rx, p);
  const minutes = {};
  for (const [day, d] of Object.entries(plan)) {
    const grouped = fitTime(d.items, rx, +p.sessionMin || 60);
    minutes[day] = estimateMinutes(grouped);
    d.items = grouped.map((it, i) => ({
      uid: `${day}-${i + 1}`,
      exerciseId: it.exerciseId,
      group: it.group,
      sets: it.sets,
      repMin: it.repMin,
      repMax: it.repMax,
      restSec: it.restSec,
      note: [it.role === 'main' ? 'Main lift' : '', easier && DEMANDING.includes(it.exerciseId) ? 'Use a band or slow negatives if needed' : ''].filter(Boolean).join(' · '),
    }));
  }
  const dayModes = placeCardio(days, legDays, cardioDays);
  return { plan, dayModes, minutes, weekly: weeklySets(db, plan) };
}

export function muscleName(m) {
  return MUSCLES[m] || m;
}
