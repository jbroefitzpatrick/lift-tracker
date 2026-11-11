// Conditioning workout templates: intervals, circuits, plyometrics and finishers.
// Each item: [exerciseId, sets (rounds), metric, target (sec | m | cal | reps), rest sec after it / after the round].
// `circuit: true` links every item into one group, done as rounds with rest after each round.
// Protocols follow the cited studies; references are in science.js.

import { isAvailable } from './gym.js';

export const TEMPLATE_KINDS = { interval: 'Intervals', circuit: 'Circuits', plyo: 'Plyometrics', finisher: 'Finishers', recovery: 'Recovery' };

export const TEMPLATES = [
  {
    id: 'tabata', kind: 'interval', name: 'Tabata', minutes: 14,
    desc: '8 rounds of 20 sec all-out, 10 sec rest — 4 minutes of work after a 10-minute warm-up.',
    refs: ['tabata1996'],
    items: [['bike-sprint', 8, 'time', 20, 10]],
  },
  {
    id: 'sprint-intervals', kind: 'interval', name: 'Sprint intervals', minutes: 25,
    desc: '4–6 × 30 sec all-out on a bike with 4 min easy spinning between. Very hard; leave 48 hours before the next one.',
    refs: ['burgomaster2005', 'gibala2012'],
    items: [['bike-sprint', 5, 'time', 30, 240]],
  },
  {
    id: 'ten-by-one', kind: 'interval', name: '10 × 1 minute', minutes: 25,
    desc: '10 × 60 sec hard (around 90% of max heart rate) with 75 sec easy between.',
    refs: ['little2010', 'gibala2012'],
    items: [['bike-interval', 10, 'time', 60, 75]],
  },
  {
    id: 'four-by-four', kind: 'interval', name: '4 × 4 minutes', minutes: 35,
    desc: '4 × 4 min at 85–95% of max heart rate with 3 min easy jogging between. A proven way to raise VO₂max.',
    refs: ['helgerud2007'],
    items: [['run-interval', 4, 'time', 240, 180]],
  },
  {
    id: 'hill-sprints', kind: 'interval', name: 'Hill sprints', minutes: 20,
    desc: '8 × 10 sec fast uphill, walking back down to recover.',
    refs: ['gibala2012'],
    items: [['hill-sprint', 8, 'time', 10, 90]],
  },
  {
    id: 'track-sprints', kind: 'interval', name: 'Track sprints', minutes: 25,
    desc: '8 × 100 m fast with full recovery (about 2 min) so every rep stays quick.',
    refs: ['gibala2012'],
    items: [['run-sprint', 8, 'distance', 100, 120]],
  },
  {
    id: 'row-500s', kind: 'interval', name: 'Rower 500s', minutes: 25,
    desc: '5 × 500 m hard with 2 min easy rowing between.',
    refs: ['gibala2012'],
    items: [['row-interval', 5, 'distance', 500, 120]],
  },
  {
    id: 'seven-minute', kind: 'circuit', name: '7-minute circuit', minutes: 8,
    desc: '12 bodyweight exercises, 30 sec each with 10 sec to switch. Repeat 2–3 times for a fuller session.',
    refs: ['klika2013'],
    items: [
      ['jumping-jack', 1, 'time', 30, 10], ['wall-sit', 1, 'time', 30, 10], ['pushup', 1, 'time', 30, 10],
      ['crunch', 1, 'time', 30, 10], ['step-up-bw', 1, 'time', 30, 10], ['air-squat', 1, 'time', 30, 10],
      ['bench-dip', 1, 'time', 30, 10], ['plank', 1, 'time', 30, 10], ['high-knees', 1, 'time', 30, 10],
      ['bodyweight-lunge', 1, 'time', 30, 10], ['pushup-rotation', 1, 'time', 30, 10], ['side-plank', 1, 'time', 30, 0],
    ],
  },
  {
    id: 'kb-circuit', kind: 'circuit', name: 'Kettlebell circuit', minutes: 20, circuit: true,
    desc: '5 rounds of swings, push-ups and air squats, resting 90 sec after each round.',
    refs: ['klika2013'],
    items: [['kb-swing', 5, 'reps', 15, 0], ['pushup', 5, 'reps', 10, 0], ['air-squat', 5, 'reps', 15, 90]],
  },
  {
    id: 'burpee-ladder', kind: 'circuit', name: 'Engine circuit', minutes: 20, circuit: true,
    desc: '4 rounds: air bike calories, burpees, mountain climbers. Rest 2 min after each round.',
    refs: ['gibala2012'],
    items: [['assault-bike-cal', 4, 'cal', 12, 0], ['burpee', 4, 'reps', 10, 0], ['mountain-climber', 4, 'time', 30, 120]],
  },
  {
    id: 'plyo-circuit', kind: 'plyo', name: 'Plyometric circuit', minutes: 20, circuit: true,
    desc: '3 rounds of low-rep jumps with full recovery. Quality over fatigue — stop if landings get sloppy. Best before lifting, on fresh legs.',
    refs: ['markovic2007'],
    items: [['box-jump', 3, 'reps', 5, 0], ['broad-jump', 3, 'reps', 5, 0], ['lateral-bound', 3, 'reps', 6, 0], ['squat-jump', 3, 'reps', 6, 150]],
  },
  {
    id: 'pogo-rope', kind: 'plyo', name: 'Ankle stiffness', minutes: 10, circuit: true,
    desc: 'Short, springy contacts for running economy: pogo hops and jump rope, 3 rounds.',
    refs: ['markovic2007'],
    items: [['pogo-hop', 3, 'time', 20, 0], ['jump-rope', 3, 'time', 60, 60]],
  },
  {
    id: 'sled-carry', kind: 'finisher', name: 'Sled and carry finisher', minutes: 12, circuit: true,
    desc: '4 rounds of a 20 m sled push and a 40 m farmer\'s carry. Low impact and easy on the joints.',
    refs: ['gibala2012'],
    items: [['sled-push', 4, 'distance', 20, 0], ['farmers-carry', 4, 'distance', 40, 90]],
  },
  // Recovery: timed foam rolling and stretching. Effects on soreness are small but real, and
  // it feels good; hold each position without forcing it (wiewelhove2019, behm2016).
  {
    id: 'recover-lower', kind: 'recovery', name: 'Lower-body recovery', minutes: 10, groups: ['legs'],
    desc: 'Foam roll, then stretch hips, hamstrings and calves. Easy pressure, slow breathing.',
    refs: ['wiewelhove2019', 'behm2016'],
    items: [['roll-quads', 1, 'time', 60, 10], ['roll-hamstrings', 1, 'time', 60, 10], ['roll-glutes', 1, 'time', 60, 10],
      ['stretch-couch', 2, 'time', 45, 10], ['stretch-hamstring', 2, 'time', 45, 10], ['stretch-pigeon', 2, 'time', 45, 10], ['stretch-calf', 2, 'time', 30, 0]],
  },
  {
    id: 'recover-upper', kind: 'recovery', name: 'Upper-body recovery', minutes: 10, groups: ['push', 'pull'],
    desc: 'Upper back and lats, then chest and shoulders. Good after pressing and pulling days.',
    refs: ['wiewelhove2019', 'behm2016'],
    items: [['roll-upper-back', 1, 'time', 60, 10], ['roll-lats', 2, 'time', 45, 10], ['stretch-thread', 2, 'time', 45, 10],
      ['stretch-chest', 2, 'time', 45, 10], ['stretch-crossbody', 2, 'time', 30, 10], ['dead-hang', 2, 'time', 30, 0]],
  },
  {
    id: 'recover-full', kind: 'recovery', name: 'Full-body mobility', minutes: 12, groups: ['legs', 'push', 'pull', 'core'],
    desc: 'A rest-day flow: spine, hips and shoulders through their range.',
    refs: ['behm2016'],
    items: [['stretch-catcow', 1, 'time', 60, 10], ['stretch-wgs', 2, 'time', 45, 10], ['stretch-9090', 1, 'time', 60, 10],
      ['stretch-child', 1, 'time', 60, 10], ['stretch-thread', 2, 'time', 30, 10], ['stretch-couch', 2, 'time', 45, 10], ['roll-upper-back', 1, 'time', 60, 0]],
  },
  {
    id: 'recover-quick', kind: 'recovery', name: '5-minute cool-down', minutes: 5,
    desc: 'Right after a workout: a few long breaths, then the stretches that matter most.',
    refs: ['behm2016'],
    items: [['stretch-wgs', 2, 'time', 30, 5], ['stretch-hamstring', 2, 'time', 30, 5], ['stretch-chest', 1, 'time', 45, 5], ['stretch-child', 1, 'time', 45, 0]],
  },
];

// ---------- Finisher builder ----------
// A short circuit at the end of a workout, from the conditioning and bodyweight moves.
// mode 'burn': finish off the muscles trained today. mode 'spare': conditioning that leaves them alone.
// format 'rounds': work each move, rest after the round. 'emom': one move per minute, rest the remainder.
const FIN_POOL_EXTRA = ['pushup', 'dip', 'pullup', 'chinup', 'inverted-row'];

export function buildFinisher(db, { minutes = 10, mode = 'burn', format = 'rounds', muscles = [], core = false, coreIds = [] }) {
  const trained = new Set(muscles);
  const OUTDOOR = ['hill-sprint', 'run-sprint', 'run-interval'];
  const ok = (e) => e && !OUTDOOR.includes(e.id) && e.pattern !== 'mobility' && e.pattern !== 'prehab' && e.pattern !== 'run' && e.metric !== 'distance' && isAvailable(db, e) && db.exPrefs?.[e.id] !== 'never';
  const pool = Object.values(db.exercises).filter((e) => ok(e) && (e.category === 'conditioning' || FIN_POOL_EXTRA.includes(e.id)));
  const overlap = (e) => e.primary.filter((m) => trained.has(m)).length + 0.5 * e.secondary.filter((m) => trained.has(m)).length;
  const scored = pool.map((e) => {
    const o = overlap(e);
    let sc = mode === 'burn' ? o * 3 + (e.category !== 'conditioning' ? 1 : 0) : -o * 3 + (['erg', 'sprint'].includes(e.pattern) ? 3 : 0) + (e.pattern === 'circuit-move' ? 1 : 0);
    if (e.pattern === 'isometric') sc -= 1;
    return { e, sc };
  }).sort((a, b) => b.sc - a.sc || a.e.name.localeCompare(b.e.name));
  // Three moves with different patterns; in burn mode, one conditioning move to raise the heart rate.
  const picks = [];
  for (const { e } of scored) {
    if (picks.length >= 3) break;
    if (picks.some((p) => p.pattern === e.pattern && e.pattern !== 'circuit-move') || picks.some((p) => p.primary[0] === e.primary[0])) continue;
    picks.push(e);
  }
  if (mode === 'burn' && !picks.some((p) => ['erg', 'sprint', 'plyo'].includes(p.pattern))) {
    const cardio = scored.find(({ e }) => ['erg', 'plyo'].includes(e.pattern) && !picks.includes(e));
    if (cardio) picks[picks.length - 1] = cardio.e;
  }
  // Core placement "finishers" or "cardio only": one move is always a core move.
  if (core && !picks.some((p) => coreIds.includes(p.id))) {
    const c = coreIds.map((id) => db.exercises[id]).find((e) => e && ok(e) && !picks.includes(e));
    if (c) picks[Math.min(picks.length, 2)] = c;
  }
  const target = (e) => (e.metric === 'cal' ? 10 : e.metric === 'time' ? (format === 'emom' ? 40 : 30)
    : ['dip', 'pullup', 'chinup'].includes(e.id) ? 8 : e.pattern === 'plyo' ? 8 : 12);
  const metric = (e) => (e.metric === 'distance' ? 'time' : e.metric || 'reps');
  let rounds;
  let items;
  if (format === 'emom') {
    rounds = Math.max(2, Math.round(minutes / picks.length));
    items = picks.map((e, i) => [e.id, rounds, metric(e), target(e), i === picks.length - 1 ? 20 : 20]);
  } else {
    const roundSec = picks.length * 45 + 60;
    rounds = Math.max(2, Math.round((minutes * 60) / roundSec));
    items = picks.map((e, i) => [e.id, rounds, metric(e), target(e), i === picks.length - 1 ? 60 : 0]);
  }
  return {
    id: 'finisher', kind: 'finisher', circuit: true, minutes,
    name: `${minutes}-minute ${format === 'emom' ? 'EMOM' : 'finisher'}`,
    desc: format === 'emom'
      ? `Every minute on the minute: one move per minute, rest for the rest of the minute. ${rounds} rounds.`
      : `${rounds} rounds, moving between exercises without rest, then 60 sec rest.`,
    items,
  };
}

// ---------- Scores and targets ----------
// One number per conditioning entry that can be compared with last time.
// lower: true when smaller is better (time over a distance).
export function condScore(metric, sets) {
  const done = sets.filter((x) => x.done ?? true);
  if (!done.length) return null;
  const sum = (k) => done.reduce((a, x) => a + (+x[k] || 0), 0);
  if (metric === 'distance') {
    const timed = done.filter((x) => x.time > 0);
    if (timed.length) { const avg = sum('time') / timed.length; return { value: avg, lower: true, label: `avg ${avg.toFixed(1)} s`, unit: 's' }; }
    const d = sum('dist'); return { value: d, label: `${Math.round(d)} m total`, unit: 'm' };
  }
  if (metric === 'cal') { const c = sum('cal'); return { value: c, label: `${Math.round(c)} cal total`, unit: 'cal' }; }
  if (metric === 'time') {
    const r = sum('reps');
    if (r > 0) return { value: r, label: `${r} reps total`, unit: 'reps' };
    const t = sum('time'); return { value: t, label: `${Math.round(t)} s total`, unit: 's', weak: true };
  }
  const r = sum('reps'); return { value: r, label: `${r} reps total`, unit: 'reps' };
}

// Past results for the same exercise, measure and target (e.g. 100 m sprints, not 200 m).
export function condHistory(db, exId, metric, target, beforeTs = Infinity) {
  const out = [];
  for (const s of db.sessions) {
    if ((s.finishedAt || 0) >= beforeTs) continue;
    for (const e of s.entries) {
      if (e.exerciseId !== exId) continue;
      const m = e.metric || db.exercises[exId]?.metric || 'reps';
      if (m !== metric || (target != null && e.target != null && +e.target !== +target)) continue;
      const sc = condScore(m, e.sets);
      if (sc && !sc.weak) out.push({ date: s.date, ts: s.finishedAt, score: sc, rounds: e.sets.length, rpe: e.rpe });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// Next target: a small step past last time if it went well (effort 8/10 or less), else the same.
export function condTarget(hist) {
  const last = hist.at(-1);
  if (!last) return null;
  const sc = last.score;
  const easy = last.rpe == null || last.rpe <= 8;
  const best = hist.reduce((a, h) => (sc.lower ? Math.min(a, h.score.value) : Math.max(a, h.score.value)), sc.value);
  let v = sc.value;
  if (easy) v = sc.lower ? Math.round(sc.value * 0.99 * 10) / 10 : Math.ceil(sc.value * 1.03);
  return { last: sc, best, value: v, lower: !!sc.lower, unit: sc.unit,
    label: sc.lower ? `avg ${v.toFixed(1)} s or faster` : `${v} ${sc.unit} or more`, held: !easy };
}

// Turn a template into plan / session items with linked groups.
export function templateItems(tpl, startGroup = 1, uidPrefix = 't') {
  const stamp = Date.now().toString(36);
  return tpl.items.map(([exerciseId, sets, metric, target, restSec], i) => ({
    uid: `${uidPrefix}-${stamp}-${i}`,
    exerciseId, sets, metric, target, restSec,
    repMin: metric === 'reps' ? target : 1, repMax: metric === 'reps' ? target : 1,
    group: tpl.circuit ? `${startGroup}${'abcdefghijkl'[i]}` : String(startGroup + i),
    note: '',
  }));
}

export function fmtTarget(metric, v) {
  if (v == null || v === '') return '';
  if (metric === 'time') return v >= 120 && v % 60 === 0 ? `${v / 60} min` : `${v} sec`;
  if (metric === 'distance') return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} km` : `${v} m`;
  if (metric === 'cal') return `${v} cal`;
  return `${v} reps`;
}

// Which set fields each metric logs: [primary, secondary (optional)].
export const METRIC_FIELDS = {
  reps: [['reps', 'Reps', 'numeric'], ['weight', 'Weight (lb)', 'decimal']],
  time: [['time', 'Seconds', 'numeric'], ['reps', 'Reps (opt.)', 'numeric']],
  distance: [['dist', 'Meters', 'numeric'], ['time', 'Seconds (opt.)', 'numeric']],
  cal: [['cal', 'Calories', 'numeric'], ['time', 'Seconds (opt.)', 'numeric']],
};
