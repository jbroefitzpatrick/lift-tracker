// How readily the app reaches for an exercise.
//   1 Staple: the lifts most programs are built on. Listed first, chosen first.
//   2 Common: solid everyday choices. The default.
//   3 Specialty: useful with a reason. Listed later, chosen only when nothing common fits.
//   4 On request: never chosen automatically, and shown only when searched for.
// Your own use outranks the list: anything you've done a few times, marked Prefer or created
// yourself counts as at least common.

import { EXTRA_RAW } from './bank-extra.js';

const list = (s) => s.trim().split(/\s+/);
const RANKS = {};
for (const id of list(`back-squat front-squat bench-press incline-bench deadlift rdl ohp bb-row pullup chinup lat-pulldown cable-row db-row
  db-bench db-incline-bench db-shoulder-press machine-chest-press machine-shoulder-press leg-press hack-squat goblet-squat walking-lunge bulgarian-split-squat hip-thrust
  db-curl bb-curl hammer-curl cable-curl cable-pushdown rope-pushdown db-overhead-ext db-lat-raise cable-lat-raise face-pull rear-delt-fly machine-fly cable-fly
  leg-extension lying-ham-curl seated-ham-curl standing-calf seated-calf pushup dip plank crunch cable-crunch hanging-leg-raise`)) RANKS[id] = 1;
for (const id of list(`safety-bar-squat belt-squat pendulum-squat sissy-squat zercher-squat cossack-squat box-squat pause-squat landmine-squat v-squat ffe-split-squat
  deficit-deadlift snatch-grip-deadlift stiff-leg-deadlift b-stance-rdl trap-bar-rdl rack-pull good-morning suitcase-deadlift power-clean kb-clean kb-snatch
  jm-press tate-press z-press landmine-press push-press floor-press db-squeeze-press bb-pullover machine-pullover meadows-row yates-row seal-row pendlay-row renegade-row
  hspu pike-pushup deficit-pushup suspension-pushup suspension-row weighted-neutral-pullup negative-pullup band-assisted-pullup
  zottman-curl drag-curl bayesian-curl spider-curl cable-preacher-curl btb-cable-curl wrist-curl reverse-wrist-curl bb-wrist-curl cable-wrist-curl
  nordic-curl ghr reverse-nordic reverse-hyper copenhagen-plank frog-pump tibialis-raise donkey-calf hack-calf toes-to-bar body-saw stir-the-pot barbell-rollout
  ball-pike landmine-rotation hanging-oblique-raise side-plank-dip overhead-carry trap-bar-carry kb-rack-carry sled-drag`)) RANKS[id] = 3;
for (const id of list(`plate-pinch band-seated-abduction slider-leg-curl db-leg-curl band-leg-curl band-hip-thrust kb-hip-thrust seated-db-calf plate-crunch cable-adduction`)) RANKS[id] = 4;
for (const r of EXTRA_RAW) RANKS[r[0]] = r[8] || 2;

export const baseRank = (id) => RANKS[id] || 2;

// This person's rank for an exercise.
export function rankOf(db, ex) {
  if (!ex) return 4;
  const base = baseRank(ex.id);
  if (base <= 2) return db?.exPrefs?.[ex.id] === 'prefer' ? 1 : base;
  return ex.custom || ex.familiar || db?.exPrefs?.[ex.id] === 'prefer' ? 2 : base;
}

// May the app pick this on its own (plans, swaps, finishers)?
export const autoPick = (db, ex) => rankOf(db, ex) < 4;

// Done in at least three workouts: treated as familiar. Runs at startup.
export function markFamiliar(db) {
  const seen = {};
  for (const s of db.sessions || []) for (const id of new Set((s.entries || []).map((e) => e.exerciseId))) seen[id] = (seen[id] || 0) + 1;
  for (const [id, n] of Object.entries(seen)) if (n >= 3 && db.exercises[id] && baseRank(id) > 2) db.exercises[id].familiar = true;
}
