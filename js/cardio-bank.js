// Cardio bank: each option lists the muscles it loads (0–1), intensity, usual duration and impact.

export const INTENSITY = {
  recovery: { label: 'Recovery', factor: 0.25, hardWeight: 0.3, volume: 0.3 },
  easy: { label: 'Easy (zone 2)', factor: 0.5, hardWeight: 0.6, volume: 0.5 },
  moderate: { label: 'Moderate', factor: 0.9, hardWeight: 1, volume: 0.8 },
  hard: { label: 'Hard intervals', factor: 1.4, hardWeight: 1.4, volume: 1 },
  sprint: { label: 'Sprints', factor: 2, hardWeight: 1.8, volume: 1 },
};
// factor: fatigue it adds per minute. hardWeight: how much tired muscles count against it today.
// volume: how much its total leg/muscle volume carries into tomorrow's lifting.

export const MODALITIES = {
  run: 'Run', bike: 'Bike', row: 'Row', ski: 'SkiErg', swim: 'Swim', elliptical: 'Elliptical',
  stairs: 'Stairs', walk: 'Walk', sled: 'Sled', rope: 'Jump rope', arm: 'Arm bike', recovery: 'Recovery',
};

const L = {
  run: { calves: 0.8, quads: 0.5, hamstrings: 0.5, glutes: 0.5, 'hip-flexors': 0.5 },
  sprint: { hamstrings: 1, glutes: 0.8, calves: 0.8, quads: 0.6, 'hip-flexors': 0.8 },
  hill: { glutes: 0.9, calves: 0.9, quads: 0.7, hamstrings: 0.7, 'hip-flexors': 0.6 },
  bike: { quads: 0.8, glutes: 0.4, calves: 0.2, hamstrings: 0.2 },
  airbike: { quads: 0.7, glutes: 0.4, lats: 0.3, 'front-delts': 0.3, chest: 0.2, triceps: 0.2 },
  row: { lats: 0.5, 'upper-back': 0.5, quads: 0.5, glutes: 0.4, hamstrings: 0.3, 'lower-back': 0.3, biceps: 0.2 },
  ski: { lats: 0.7, triceps: 0.5, abs: 0.4, 'upper-back': 0.3 },
  swim: { lats: 0.6, 'front-delts': 0.5, chest: 0.3, triceps: 0.3, 'rear-delts': 0.3 },
  elliptical: { quads: 0.4, glutes: 0.3, calves: 0.2 },
  stairs: { quads: 0.7, glutes: 0.7, calves: 0.6 },
  walk: { calves: 0.3, glutes: 0.2 },
  inclineWalk: { calves: 0.6, glutes: 0.5, hamstrings: 0.3 },
  ruck: { calves: 0.5, glutes: 0.4, quads: 0.4, traps: 0.4, 'upper-back': 0.3 },
  sled: { quads: 1, glutes: 0.8, calves: 0.8 },
  rope: { calves: 1, 'front-delts': 0.2 },
  arm: { 'front-delts': 0.5, 'rear-delts': 0.3, triceps: 0.3, biceps: 0.3 },
  none: {},
};

// [id, name, modality, intensity, minutes, impact, loads, how-to]
const RAW = [
  ['zone2-run', 'Zone 2 run', 'run', 'easy', 35, 'high', L.run, 'Conversational pace.'],
  ['long-run', 'Long run', 'run', 'easy', 75, 'high', L.run, 'Easy pace, 60–90 min.'],
  ['tempo-run', 'Tempo run', 'run', 'hard', 30, 'high', L.run, '20 min comfortably hard, plus warm-up and cool-down.'],
  ['run-intervals', 'Run intervals', 'run', 'hard', 35, 'high', L.run, 'e.g. 6 × 3 min hard / 2 min easy.'],
  ['track-sprints', 'Track sprints', 'run', 'sprint', 25, 'high', L.sprint, '8 × 100 m fast, full rest between.'],
  ['hill-sprints', 'Hill sprints', 'run', 'sprint', 20, 'high', L.hill, '8 × 10 s uphill, walk down.'],
  ['zone2-bike', 'Zone 2 bike', 'bike', 'easy', 40, 'none', L.bike, 'Steady, nose-breathing pace.'],
  ['bike-intervals', 'Bike intervals', 'bike', 'hard', 25, 'none', L.bike, 'e.g. 8 × 1 min hard / 1 min easy.'],
  ['airbike-sprints', 'Assault bike sprints', 'bike', 'sprint', 15, 'none', L.airbike, '10 × 15 s all-out, 45 s easy.'],
  ['recovery-spin', 'Recovery spin', 'bike', 'recovery', 20, 'none', L.bike, 'Very light, just moving the legs.'],
  ['zone2-row', 'Zone 2 row', 'row', 'easy', 30, 'none', L.row, 'Steady strokes, around 20 spm.'],
  ['row-intervals', 'Row intervals', 'row', 'hard', 25, 'none', L.row, 'e.g. 5 × 500 m, 2 min rest.'],
  ['ski-intervals', 'SkiErg intervals', 'ski', 'hard', 20, 'none', L.ski, 'e.g. 10 × 30 s hard / 30 s easy.'],
  ['zone2-ski', 'Zone 2 SkiErg', 'ski', 'easy', 25, 'none', L.ski, 'Steady pace, upper body led.'],
  ['easy-swim', 'Easy swim', 'swim', 'easy', 30, 'none', L.swim, 'Relaxed laps, any stroke.'],
  ['swim-intervals', 'Swim intervals', 'swim', 'hard', 30, 'none', L.swim, 'e.g. 8 × 50 m fast, 30 s rest.'],
  ['zone2-elliptical', 'Zone 2 elliptical', 'elliptical', 'easy', 35, 'low', L.elliptical, 'Steady pace.'],
  ['incline-walk', 'Incline treadmill walk', 'walk', 'easy', 35, 'low', L.inclineWalk, '10–15% incline, brisk walk.'],
  ['stairmaster', 'StairMaster', 'stairs', 'moderate', 20, 'low', L.stairs, 'Steady climb, no leaning on rails.'],
  ['ruck', 'Ruck', 'walk', 'moderate', 45, 'low', L.ruck, 'Brisk walk with a weighted pack.'],
  ['sled-push', 'Sled pushes', 'sled', 'hard', 15, 'low', L.sled, 'e.g. 8 × 20 m, walk back.'],
  ['jump-rope', 'Jump rope intervals', 'rope', 'moderate', 15, 'high', L.rope, 'e.g. 10 × 1 min on / 30 s off.'],
  ['arm-bike', 'Arm bike (UBE)', 'arm', 'moderate', 15, 'none', L.arm, 'Upper-body only — spares the legs.'],
  ['easy-walk', 'Easy walk', 'walk', 'recovery', 30, 'low', L.walk, 'Outdoors if you can.'],
  ['yoga', 'Yoga / breathwork', 'recovery', 'recovery', 30, 'none', L.none, 'Mobility flow and breathing.'],
  ['mobility', 'Mobility routine', 'recovery', 'recovery', 20, 'none', L.none, 'Hips, T-spine, ankles, shoulders.'],
];

export const CARDIO = Object.fromEntries(RAW.map(([id, name, modality, intensity, minutes, impact, loads, how]) =>
  [id, { id, name, modality, intensity, minutes, impact, loads, how }]));

// Fatigue (in set-equivalents per muscle) that a cardio session adds.
export function cardioLoad(c, minutes) {
  if (!c) return {};
  const amount = ((minutes ?? c.minutes) * INTENSITY[c.intensity].factor) / 10;
  return Object.fromEntries(Object.entries(c.loads).map(([m, v]) => [m, v * amount]));
}
