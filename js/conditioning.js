// Conditioning workout templates: intervals, circuits, plyometrics and finishers.
// Each item: [exerciseId, sets (rounds), metric, target (sec | m | cal | reps), rest sec after it / after the round].
// `circuit: true` links every item into one group, done as rounds with rest after each round.
// Protocols follow the cited studies; references are in science.js.

export const TEMPLATE_KINDS = { interval: 'Intervals', circuit: 'Circuits', plyo: 'Plyometrics', finisher: 'Finishers' };

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
];

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
