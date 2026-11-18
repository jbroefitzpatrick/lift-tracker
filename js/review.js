// Weekly review: once a week is over, look at what was actually logged and suggest plan changes.
//
// - Volume per muscle against the weekly target range (hard sets; assisting muscles count half).
//   Below the range for a muscle the plan cares about: add an exercise for it. Well above: trim a set.
//   Most growth happens between ~10 and ~20 hard sets a week per muscle (schoenfeld2017, pelland2026).
// - Balance inside a muscle: biceps (brachialis), triceps (long head) and chest (upper chest) get
//   a nudge toward the exercise that emphasizes the part falling behind.
// - Missed workouts and lifts that have stalled for three sessions.
// Every suggestion carries one action the app can apply (add, trim or swap), or none.
import { addDays, mondayOf, todayStr } from './store.js';
import { emphasis, PARTS } from './groups.js';
import { MUSCLES, similarExercises } from './bank.js';
import { volumeTarget, VOLUME_MUSCLES } from './builder.js';
import { isAvailable } from './gym.js';
import { DAY_KEYS } from './engine.js';

const COUNTED = [...VOLUME_MUSCLES, 'front-delts'];
const UPPER = ['chest', 'lats', 'upper-back', 'front-delts', 'side-delts', 'rear-delts', 'biceps', 'triceps', 'forearms'];
// Go-to isolation work per muscle (first available one not already in the plan is suggested).
const ADD_FOR = {
  chest: ['cable-fly', 'machine-fly', 'db-fly', 'incline-cable-fly'],
  lats: ['straight-arm-pulldown', 'lat-pulldown', 'single-arm-pulldown', 'db-pullover'],
  'upper-back': ['cable-row', 'chest-supported-db-row', 'machine-row', 'face-pull'],
  'front-delts': ['db-front-raise', 'cable-front-raise', 'db-shoulder-press'],
  'side-delts': ['cable-lat-raise', 'db-lat-raise', 'machine-lat-raise'],
  'rear-delts': ['rear-delt-fly', 'cable-rear-delt-fly', 'face-pull', 'db-rear-delt-fly'],
  biceps: ['db-curl', 'cable-curl', 'incline-db-curl', 'preacher-curl'],
  triceps: ['cable-pushdown', 'overhead-cable-ext', 'db-overhead-ext'],
  quads: ['leg-extension', 'leg-press', 'goblet-squat'],
  hamstrings: ['lying-ham-curl', 'seated-ham-curl', 'rdl'],
  glutes: ['hip-thrust', 'machine-hip-thrust', 'db-hip-thrust'],
  calves: ['standing-calf', 'seated-calf', 'calf-press'],
  abs: ['cable-crunch', 'hanging-leg-raise', 'ab-wheel'],
};
const PART_FIX = {
  biceps: { part: 'brachialis', min: 0.2, ids: ['hammer-curl', 'rope-hammer-curl', 'cross-body-hammer-curl', 'reverse-curl'], why: 'Hammer and reverse curls (neutral or overhand grip) shift work to the brachialis.' },
  triceps: { part: 'long', min: 0.35, ids: ['overhead-cable-ext', 'db-overhead-ext', 'ez-overhead-ext', 'skullcrusher'], why: 'Overhead extensions stretch the long head, which pushdowns barely do.' },
  chest: { part: 'upper', min: 0.3, ids: ['db-incline-bench', 'incline-bench', 'low-high-cable-fly', 'incline-machine-press'], why: 'Incline pressing and low-to-high flyes favor the upper chest.' },
};

// Sets per muscle and per part for sessions dated start…start+6.
function setsBetween(db, start) {
  const end = addDays(start, 6);
  const muscles = {};
  const parts = { biceps: {}, triceps: {}, chest: {} };
  const contrib = {}; // muscle -> { exerciseId: sets }
  for (const s of db.sessions) {
    if (s.date < start || s.date > end) continue;
    for (const e of s.entries) {
      const ex = db.exercises[e.exerciseId];
      if (!ex || ['mobility', 'prehab'].includes(ex.pattern)) continue;
      const n = e.sets.filter((x) => !x.pain && x.type !== 'w' && (x.reps > 0 || x.time > 0 || x.dist > 0)).length;
      if (!n) continue;
      const add = (m, w) => {
        muscles[m] = (muscles[m] || 0) + n * w;
        ((contrib[m] ||= {})[ex.id] = (contrib[m][ex.id] || 0) + n * w);
        const em = parts[m] && emphasis(ex, m);
        if (em) for (const [p, share] of Object.entries(em)) parts[m][p] = (parts[m][p] || 0) + n * w * share;
      };
      for (const m of ex.primary) add(m, 1);
      for (const m of ex.secondary) add(m, 0.5);
    }
  }
  return { muscles, parts, contrib };
}

const inPlan = (db, id) => Object.values(db.plan).some((d) => d?.items?.some((it) => it.exerciseId === id));
const firstAvailable = (db, ids) => ids.map((id) => db.exercises[id]).find((e) => e && isAvailable(db, e) && db.exPrefs?.[e.id] !== 'never' && !inPlan(db, e.id))
  || ids.map((id) => db.exercises[id]).find((e) => e && isAvailable(db, e) && db.exPrefs?.[e.id] !== 'never');

// The lifting day that already trains this region and has the fewest exercises.
function dayFor(db, muscle, pending = {}) {
  const upper = UPPER.includes(muscle);
  const days = DAY_KEYS.filter((d) => db.plan[d]?.items?.length);
  const LOWER = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];
  const trains = (d) => db.plan[d].items.some((it) => (db.exercises[it.exerciseId]?.primary || []).some((m) => (muscle === 'abs' ? true : upper ? UPPER.includes(m) : LOWER.includes(m))));
  const pool = days.filter(trains).length ? days.filter(trains) : days;
  // Fewest exercises, counting ones already suggested for that day, so additions spread out.
  const day = pool.sort((a, b) => db.plan[a].items.length + (pending[a] || 0) - db.plan[b].items.length - (pending[b] || 0))[0] || null;
  if (day) pending[day] = (pending[day] || 0) + 1;
  return day;
}

export function lastWeekStart(today = todayStr()) { return addDays(mondayOf(today), -7); }

export function weekReview(db, start = lastWeekStart()) {
  const rx = db.profile?.rx;
  const weekly = rx?.weekly || [10, 20];
  const { muscles, parts, contrib } = setsBetween(db, start);
  const end = addDays(start, 6);
  const sessions = db.sessions.filter((s) => s.date >= start && s.date <= end);
  const planned = DAY_KEYS.filter((d) => db.plan[d]?.items?.length && ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift')).length;
  const items = [];
  const pending = {};
  if (!sessions.length) return { start, end, sessions: 0, planned, items, bars: [] };

  const bars = COUNTED.map((m) => {
    const [lo, hi] = m === 'front-delts' ? [Math.round(weekly[0] * 0.4), weekly[1]] : volumeTarget({ weekly, includePhysique: rx?.includePhysique }, m);
    return { m, name: MUSCLES[m], sets: Math.round((muscles[m] || 0) * 2) / 2, lo, hi };
  });
  for (const b of bars) {
    if (b.sets < b.lo) {
      const ex = firstAvailable(db, ADD_FOR[b.m] || []);
      const day = dayFor(db, b.m, pending);
      const need = Math.max(2, Math.min(4, Math.round(b.lo - b.sets)));
      items.push({
        kind: 'under', m: b.m, score: (b.lo - b.sets) / b.lo,
        title: `${b.name}: ${b.sets} sets`, text: `Below the ${b.lo}–${b.hi} a week that grows muscle best.`,
        action: ex && day ? { type: 'add', exerciseId: ex.id, day, sets: Math.min(need, 4), label: `Add ${ex.name} to ${day[0].toUpperCase()}${day.slice(1)}` } : null,
      });
    } else if (b.sets > b.hi * 1.15) {
      // Trim the exercise doing the most direct work for it.
      const top = Object.entries(contrib[b.m] || {}).filter(([id]) => db.exercises[id]?.primary.includes(b.m)).sort((x, y) => y[1] - x[1])[0];
      const where = top && DAY_KEYS.find((d) => db.plan[d]?.items?.some((it) => it.exerciseId === top[0] && it.sets > 2));
      items.push({
        kind: 'over', m: b.m, score: (b.sets - b.hi) / b.hi,
        title: `${b.name}: ${b.sets} sets`, text: `Above ${b.hi} a week. More rarely adds growth and eats into recovery.`,
        action: where ? { type: 'trim', exerciseId: top[0], day: where, label: `One set less of ${db.exercises[top[0]].name}` } : null,
      });
    }
  }
  for (const [m, fix] of Object.entries(PART_FIX)) {
    const total = muscles[m] || 0;
    if (total < weekly[0] * 0.6) continue; // too little to judge
    const share = (parts[m][fix.part] || 0) / total;
    if (share >= fix.min) continue;
    const ex = firstAvailable(db, fix.ids);
    const day = dayFor(db, m, pending);
    items.push({
      kind: 'part', m, score: (fix.min - share) / fix.min * 0.8,
      title: `${PARTS[m][fix.part]}: ${Math.round(share * 100)}% of ${MUSCLES[m].toLowerCase()} work`, text: fix.why,
      action: ex && day ? { type: 'add', exerciseId: ex.id, day, sets: 3, label: `Add ${ex.name} to ${day[0].toUpperCase()}${day.slice(1)}` } : null,
    });
  }
  const lifts = sessions.filter((s) => s.entries.some((e) => db.exercises[e.exerciseId]?.category !== 'conditioning')).length;
  if (planned && lifts < planned) {
    items.push({ kind: 'missed', score: 0.5, title: `${planned - lifts} workout${planned - lifts === 1 ? '' : 's'} missed`, text: lifts < planned - 1 ? 'Several workouts were missed. If the week keeps getting away from you, fewer, longer days may fit better.' : 'One workout was missed. Adjust week fits it into the days you have.', action: null });
  }
  const stalled = Object.entries(db.state || {}).filter(([id, st]) => st.stallCount >= 3 && db.exercises[id] && inPlan(db, id));
  for (const [id] of stalled.slice(0, 2)) {
    const day = DAY_KEYS.find((d) => db.plan[d]?.items?.some((it) => it.exerciseId === id));
    const alt = similarExercises(db.exercises, id, 12).find((x) => x.samePattern && isAvailable(db, x.ex) && db.exPrefs?.[x.ex.id] !== 'never' && !inPlan(db, x.ex.id))?.ex;
    items.push({ kind: 'stall', score: 0.6, title: `${db.exercises[id].name} has stalled`, text: 'Three workouts without progress. A close variation for a block often restarts it.', action: alt && day ? { type: 'swap', exerciseId: id, to: alt.id, day, label: `Swap to ${alt.name}` } : null });
  }
  items.sort((a, b) => b.score - a.score);
  return { start, end, sessions: sessions.length, lifts, planned, items, bars };
}

// Apply a suggestion to the weekly plan. Returns a short confirmation.
export function applySuggestion(db, a, makeItem) {
  if (a.type === 'add') {
    const plan = db.plan[a.day];
    if (!plan) return null;
    plan.items.push(makeItem(a.day, a.exerciseId, a.sets));
    return `Added ${db.exercises[a.exerciseId].name} to ${a.day[0].toUpperCase()}${a.day.slice(1)}.`;
  }
  if (a.type === 'trim') {
    const it = db.plan[a.day]?.items.find((x) => x.exerciseId === a.exerciseId && x.sets > 2);
    if (!it) return null;
    it.sets -= 1;
    return `${db.exercises[a.exerciseId].name}: ${it.sets} sets now.`;
  }
  if (a.type === 'swap') {
    const it = db.plan[a.day]?.items.find((x) => x.exerciseId === a.exerciseId);
    if (!it) return null;
    it.exerciseId = a.to; delete it.variants; delete it.role;
    return `${db.exercises[a.exerciseId].name} → ${db.exercises[a.to].name} on ${a.day[0].toUpperCase()}${a.day.slice(1)}.`;
  }
  return null;
}
