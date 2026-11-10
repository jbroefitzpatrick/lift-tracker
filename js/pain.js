// Pain and injury reports: where (a muscle or joint, per side), how bad, and what to do about it.
//
// Levels follow the pain-monitoring model used in tendon and joint rehab (silbernagel2007):
// training can continue when pain stays at or below ~5/10 and settles by the next morning;
// higher or lingering pain means reducing load. Reports are kept as a history; the newest report
// for an area and side is its current state. Areas not checked in on for 3 weeks drop off.
import { MUSCLE_NAMES } from './body.js';
import { similarExercises, similarity } from './bank.js';

export const JOINTS = {
  neck: { name: 'Neck', muscles: ['traps'] },
  shoulder: { name: 'Shoulder', muscles: ['chest', 'front-delts', 'side-delts', 'rear-delts'] },
  elbow: { name: 'Elbow', muscles: ['biceps', 'triceps'] },
  wrist: { name: 'Wrist', muscles: ['forearms'] },
  hip: { name: 'Hip', muscles: ['glutes', 'hip-flexors', 'adductors', 'abductors'] },
  knee: { name: 'Knee', muscles: ['quads', 'hamstrings'] },
  ankle: { name: 'Ankle', muscles: ['calves'] },
};

export const LEVELS = {
  1: {
    name: 'Mild', scale: '1–3 out of 10', cut: 0.1, verb: 'go about 10% lighter',
    advice: 'Keep training if it stays at 3/10 or less and has settled by tomorrow. Go about 10% lighter on exercises that load it.',
  },
  2: {
    name: 'Moderate', scale: '4–5 out of 10', cut: 0.25, verb: 'go about 25% lighter or swap',
    advice: 'Go about 25% lighter or switch to an option that spares it. Stop a set if it climbs past 5/10 or is worse the next morning.',
  },
  3: {
    name: 'Sharp', scale: '6 or more out of 10', cut: null, verb: 'skip it today',
    advice: 'Skip exercises that load it today. If sharp pain lasts more than a few days, or came with a pop, swelling, numbness or weakness, see a doctor or physical therapist.',
  },
};

const ACTIVE_MS = 21 * 86400000;

export function areaName(area) {
  return JOINTS[area]?.name || MUSCLE_NAMES[area] || area;
}

export function areaLabel(area, side) {
  const n = areaName(area);
  if (side === 'center') return n;
  return `${side === 'left' ? 'Left' : 'Right'} ${n.toLowerCase()}`;
}

// Current state per area and side: the newest report, unless resolved or stale.
export function activePain(db, now = Date.now()) {
  const latest = {};
  for (const r of db.pain || []) {
    const k = `${r.area}:${r.side}`;
    if (!latest[k] || r.ts > latest[k].ts) latest[k] = r;
  }
  return Object.values(latest)
    .filter((r) => r.level > 0 && now - r.ts < ACTIVE_MS)
    .sort((a, b) => b.level - a.level || b.ts - a.ts);
}

// Reports due a check-in (not updated in the last ~20 hours).
export const painDue = (db, now = Date.now()) => activePain(db, now).filter((r) => now - r.ts > 20 * 3600000);

// muscle → { level, labels, sides } from active reports (joints count for the muscles that cross them).
export function painMap(db) {
  const out = {};
  for (const r of activePain(db)) {
    for (const m of JOINTS[r.area]?.muscles || [r.area]) {
      const o = out[m] ||= { level: 0, labels: [], sides: [] };
      o.level = Math.max(o.level, r.level);
      const label = areaLabel(r.area, r.side);
      if (!o.labels.includes(label)) o.labels.push(label);
      if (!o.sides.includes(r.side)) o.sides.push(r.side);
    }
  }
  return out;
}

// How much an exercise runs into current pain. Primary muscles count fully; a secondary muscle
// counts one level lower (so moderate pain there means "go a bit lighter").
export function exercisePain(ex, map) {
  if (!ex) return null;
  let level = 0;
  const labels = [];
  const sides = [];
  const add = (m, lv) => {
    if (!map[m] || lv <= 0) return;
    level = Math.max(level, lv);
    for (const l of map[m].labels) if (!labels.includes(l)) labels.push(l);
    for (const s of map[m].sides) if (!sides.includes(s)) sides.push(s);
  };
  for (const m of ex.primary || []) add(m, map[m]?.level);
  for (const m of ex.secondary || []) add(m, (map[m]?.level || 0) - 1);
  if (!level) return null;
  return { level, labels, oneSide: sides.length === 1 && sides[0] !== 'center' ? sides[0] : null, ...LEVELS[level] };
}

// Exercises that don't run into the pain: similar ones first. If nothing close spares it, the same
// body region with a different emphasis (e.g. knee pain → hip-dominant leg work like hip thrusts).
export function painSwaps(db, exId, map, limit = 4) {
  const a = db.exercises[exId];
  // Gentler than the original counts: e.g. a sore knee (moderate) is only lightly involved in a hip thrust.
  const base = exercisePain(a, map)?.level || 1;
  const ok = (e) => e.id !== exId && e.category !== 'conditioning' && (exercisePain(e, map)?.level || 0) < base && db.exPrefs?.[e.id] !== 'never';
  // Only keep "similar" options that still train one of this exercise's main muscles.
  const close = similarExercises(db.exercises, exId, 60).filter(({ ex }) => ok(ex) && ex.primary.some((m) => a?.primary.includes(m)));
  if (close.length >= 2 || !a) return close.slice(0, limit);
  // Train the main muscles that aren't sore (squat with a sore knee → glutes). If every main
  // muscle is sore, there's no sensible stand-in: going lighter or skipping is the advice.
  const target = a.primary.filter((m) => !map[m]);
  if (!target.length) return close.slice(0, limit);
  const extra = Object.values(db.exercises)
    .filter((e) => ok(e) && !close.some((c) => c.ex.id === e.id) && e.primary.some((m) => target.includes(m)))
    .map((e) => ({ ex: e, score: e.primary.filter((m) => target.includes(m)).length * 4 + similarity(a, e) }))
    .sort((x, y) => y.score - x.score);
  return [...close, ...extra].slice(0, limit);
}

const UNILATERAL = /single|one-arm|one arm|split|lunge|step-up|unilateral|bulgarian|pistol/i;

// A one-sided problem on a limb: training the other side keeps some strength in the sore one
// (cross-education, manca2017).
export function crossEducationTip(ex, p) {
  if (!p?.oneSide || p.level < 2) return null;
  const limb = p.labels.some((l) => /knee|ankle|hip|quads|hamstrings|calves|glutes|shoulder|elbow|wrist|biceps|triceps|forearms|delts/i.test(l));
  if (!limb) return null;
  const other = p.oneSide === 'left' ? 'right' : 'left';
  return UNILATERAL.test(ex.name)
    ? `Keep training your ${other} side on this one. Training one limb keeps some strength in the other.`
    : `A single-arm or single-leg version on your ${other} side keeps training going, and some of the strength carries over to the sore side.`;
}

// For cardio suggestions: how much an option loads sore areas.
export function cardioPain(c, map) {
  let penalty = 0;
  let worst = null;
  for (const [m, v] of Object.entries(c.loads || {})) {
    if (!map[m]) continue;
    const p = v * map[m].level * 18;
    penalty += p;
    if (!worst || p > worst.p) worst = { p, label: map[m].labels[0] };
  }
  return { penalty, label: worst?.label || null };
}
