// Import workout history from Strong, Hevy or FitBod (their CSV exports). FitBod's format is in import-fitbod.js.
//
// Strong: Settings → Export data. Columns: Date, Workout Name, Duration, Exercise Name, Set Order,
//   Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE (comma or semicolon separated).
//   Weights are in the unit the person used in Strong, which the file doesn't say, so it's asked.
// Hevy: Profile → Settings → Export & import data. Columns: title, start_time, end_time, description,
//   exercise_title, superset_id, exercise_notes, set_index, set_type, weight_lbs or weight_kg, reps,
//   distance_*, duration_seconds, rpe.
//
// Exercise names are matched to the library (exact, then by words: "Bench Press (Barbell)" finds
// "Barbell bench press"); anything not found becomes a custom exercise with that name. Imported
// workouts are marked imported and don't change targets; they count for history, charts, records
// and strength standards.

import { KG } from './units.js';
import { dayKeyOf } from './engine.js';
import { FITBOD_NAMES, isFitbod, readFitbod, customExercise } from './import-fitbod.js';

// RFC 4180-style CSV: quoted fields, doubled quotes, commas or semicolons.
export function parseCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function detectFormat(rows) {
  const k = Object.keys(rows[0] || {});
  if (k.includes('exercise name') && k.includes('set order')) return 'strong';
  if (k.includes('exercise_title') && k.includes('start_time')) return 'hevy';
  if (isFitbod(rows)) return 'fitbod';
  return null;
}

// The names Strong and Hevy use for common lifts.
const ALIASES = {
  'squat (barbell)': 'back-squat', 'back squat': 'back-squat', 'front squat (barbell)': 'front-squat', 'pause squat (barbell)': 'pause-squat', 'box squat (barbell)': 'box-squat',
  'deadlift (barbell)': 'deadlift', 'sumo deadlift (barbell)': 'sumo-deadlift', 'trap bar deadlift': 'trap-bar-deadlift', 'romanian deadlift (barbell)': 'rdl', 'romanian deadlift (dumbbell)': 'db-rdl', 'stiff leg deadlift (barbell)': 'stiff-leg-deadlift', 'good morning (barbell)': 'good-morning',
  'bench press (barbell)': 'bench-press', 'incline bench press (barbell)': 'incline-bench', 'decline bench press (barbell)': 'decline-bench', 'close grip bench press (barbell)': 'close-grip-bench',
  'bench press (dumbbell)': 'db-bench', 'incline bench press (dumbbell)': 'db-incline-bench', 'bench press (smith machine)': 'smith-bench', 'chest press (machine)': 'machine-chest-press',
  'chest fly (dumbbell)': 'db-fly', 'cable crossover': 'cable-fly', 'chest fly (cable)': 'cable-fly', 'pec deck (machine)': 'machine-fly', 'butterfly (pec deck)': 'machine-fly',
  'overhead press (barbell)': 'ohp', 'strict military press (barbell)': 'ohp', 'seated overhead press (barbell)': 'seated-ohp', 'push press': 'push-press', 'overhead press (dumbbell)': 'db-shoulder-press', 'shoulder press (dumbbell)': 'db-shoulder-press', 'seated overhead press (dumbbell)': 'db-shoulder-press', 'shoulder press (machine)': 'machine-shoulder-press', 'arnold press (dumbbell)': 'arnold-press',
  'lateral raise (dumbbell)': 'db-lat-raise', 'lateral raise (cable)': 'cable-lat-raise', 'lateral raise (machine)': 'machine-lat-raise', 'front raise (dumbbell)': 'db-front-raise', 'reverse fly (dumbbell)': 'db-rear-delt-fly', 'reverse fly (machine)': 'rear-delt-fly', 'face pull (cable)': 'face-pull', 'face pull': 'face-pull', 'upright row (barbell)': 'upright-row',
  'bent over row (barbell)': 'bb-row', 'pendlay row (barbell)': 'pendlay-row', 't bar row': 't-bar-row', 'bent over row (dumbbell)': 'db-row', 'dumbbell row': 'db-row', 'seated row (cable)': 'cable-row', 'seated cable row - v grip (cable)': 'cable-row', 'lat pulldown (cable)': 'lat-pulldown', 'lat pulldown (machine)': 'machine-pulldown', 'pull up': 'pullup', 'pull up (weighted)': 'weighted-pullup', 'chin up': 'chinup', 'chin up (weighted)': 'weighted-chinup', 'shrug (barbell)': 'bb-shrug', 'shrug (dumbbell)': 'db-shrug', 'back extension': 'back-extension', 'hyperextension': 'back-extension',
  'bicep curl (barbell)': 'bb-curl', 'bicep curl (dumbbell)': 'db-curl', 'bicep curl (cable)': 'cable-curl', 'ez bar curl': 'ez-curl', 'hammer curl (dumbbell)': 'hammer-curl', 'preacher curl (barbell)': 'ez-preacher-curl', 'preacher curl (dumbbell)': 'db-preacher-curl', 'preacher curl (machine)': 'preacher-curl', 'concentration curl (dumbbell)': 'concentration-curl', 'incline curl (dumbbell)': 'incline-db-curl',
  'triceps pushdown (cable - straight bar)': 'cable-pushdown', 'triceps pushdown': 'cable-pushdown', 'triceps rope pushdown': 'rope-pushdown', 'skullcrusher (barbell)': 'skullcrusher', 'skullcrusher (dumbbell)': 'db-skullcrusher', 'triceps extension (dumbbell)': 'db-overhead-ext', 'overhead triceps extension (cable)': 'overhead-cable-ext', 'triceps dip': 'dip', 'chest dip': 'dip', 'dip': 'dip', 'bench dip': 'bench-dip', 'triceps kickback (dumbbell)': 'db-kickback',
  'leg press': 'leg-press', 'leg press (machine)': 'leg-press', 'hack squat': 'hack-squat', 'hack squat (machine)': 'hack-squat', 'leg extension (machine)': 'leg-extension', 'lying leg curl (machine)': 'lying-ham-curl', 'seated leg curl (machine)': 'seated-ham-curl', 'hip thrust (barbell)': 'hip-thrust', 'glute bridge': 'glute-bridge', 'lunge (dumbbell)': 'walking-lunge', 'walking lunge (dumbbell)': 'walking-lunge', 'lunge (barbell)': 'bb-lunge', 'bulgarian split squat': 'bulgarian-split-squat', 'goblet squat (kettlebell)': 'goblet-squat', 'goblet squat (dumbbell)': 'goblet-squat', 'step up': 'step-up', 'hip abductor (machine)': 'hip-abductor', 'hip adductor (machine)': 'hip-adductor',
  'standing calf raise (machine)': 'standing-calf', 'calf raise (machine)': 'standing-calf', 'seated calf raise (machine)': 'seated-calf', 'seated calf raise': 'seated-calf', 'calf press on leg press': 'calf-press',
  'plank': 'plank', 'crunch': 'crunch', 'cable crunch': 'cable-crunch', 'hanging leg raise': 'hanging-leg-raise', 'ab wheel': 'ab-wheel', 'russian twist': 'russian-twist', 'push up': 'pushup', 'sit up': 'situp', 'side plank': 'side-plank',
};
// Words that don't tell lifts apart ("Squat (Barbell)" is the back squat).
const FILLER = new Set(['barbell', 'standing', 'flat', 'back', 'the', 'with', 'bb', 'regular', 'normal']);
const words = (s) => String(s).toLowerCase().replace(/\(([^)]*)\)/g, ' $1 ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\bdumbbells?\b/g, 'db').split(/\s+/).filter((x) => x && !FILLER.has(x));
// The library exercise for a name from another app, or null.
export function matchExercise(exercises, name) {
  const lower = name.toLowerCase().trim();
  const alias = ALIASES[lower] || ALIASES[lower.replace(/\s+-\s+/g, ' ')];
  if (alias && exercises[alias]) return exercises[alias];
  const list = Object.values(exercises).filter((e) => e?.name);
  const exact = list.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;
  const w = new Set(words(name));
  let best = null; let bestScore = 0;
  for (const e of list) {
    const ew = words(e.name);
    const hit = ew.filter((x) => w.has(x)).length;
    const score = hit / Math.max(ew.length, w.size);
    if (hit >= Math.min(2, w.size) && score > bestScore) { best = e; bestScore = score; }
  }
  return bestScore >= 0.6 ? best : null;
}

const toLb = (v, unit) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? (unit === 'kg' ? Math.round((n / KG) * 100) / 100 : n) : 0; };
const isoDate = (d) => { const t = new Date(d.replace(' ', 'T')); return Number.isNaN(+t) ? null : t; };
const localDay = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

// Rows → { workouts: [{ name, date, start, end, entries: [{ name, sets: [{ weight, reps, type, rpe }] }] }] }
export function readWorkouts(rows, format, strongUnit = 'lb') {
  if (format === 'fitbod') return readFitbod(rows);
  const byKey = new Map();
  for (const r of rows) {
    let key; let name; let start; let end; let exName; let set;
    if (format === 'strong') {
      start = isoDate(r.date); if (!start) continue;
      key = `${r.date}|${r['workout name']}`; name = r['workout name'] || 'Workout'; exName = r['exercise name'];
      const mins = parseFloat(r.duration) || (/(\d+)h/.exec(r.duration || '')?.[1] * 60 || 0) + (+/(\d+)m/.exec(r.duration || '')?.[1] || 0);
      end = new Date(+start + (mins || 60) * 60000);
      const order = String(r['set order']).toLowerCase();
      set = { weight: toLb(r.weight, strongUnit), reps: parseInt(r.reps, 10) || 0, seconds: parseFloat(r.seconds) || 0, type: order === 'w' ? 'w' : order === 'd' ? 'd' : order === 'f' ? 'f' : undefined, rpe: parseFloat(r.rpe) || null };
    } else {
      start = isoDate(r.start_time); if (!start) continue;
      key = `${r.start_time}|${r.title}`; name = r.title || 'Workout'; exName = r.exercise_title;
      end = isoDate(r.end_time) || new Date(+start + 3600000);
      const kg = r.weight_kg !== undefined && r.weight_kg !== '';
      const t = String(r.set_type || '').toLowerCase();
      set = { weight: kg ? toLb(r.weight_kg, 'kg') : toLb(r.weight_lbs, 'lb'), reps: parseInt(r.reps, 10) || 0, seconds: parseFloat(r.duration_seconds) || 0, type: t === 'warmup' ? 'w' : t === 'dropset' ? 'd' : t === 'failure' ? 'f' : undefined, rpe: parseFloat(r.rpe) || null };
    }
    if (!exName) continue;
    if (!byKey.has(key)) byKey.set(key, { name, date: localDay(start), start: +start, end: +end, entries: [] });
    const w = byKey.get(key);
    let e = w.entries.find((x) => x.name === exName);
    if (!e) { e = { name: exName, sets: [] }; w.entries.push(e); }
    if (set.reps > 0 || set.seconds > 0) e.sets.push(set);
  }
  return [...byKey.values()].filter((w) => w.entries.some((e) => e.sets.length)).sort((a, b) => a.start - b.start);
}

// Plan what an import would do (nothing changes yet).
export function planImport(db, workouts, format) {
  const names = [...new Set(workouts.flatMap((w) => w.entries.map((e) => e.name)))];
  const map = {}; const unmatched = [];
  const fitbod = format === 'fitbod';
  const exactName = (n) => Object.values(db.exercises).find((e) => e?.name?.toLowerCase() === n.toLowerCase());
  for (const n of names) {
    const ex = fitbod ? db.exercises[FITBOD_NAMES[n]] || exactName(n) : matchExercise(db.exercises, n);
    if (ex) map[n] = ex.id; else unmatched.push(n);
  }
  if (fitbod) {
    // Workouts are identified by start time, since some days have two. A day already logged in
    // Lift is left alone so the same workout isn't counted twice.
    const seen = new Set([...(db.sessions || []).filter((s) => s.imported === 'FitBod').map((s) => s.startedAt), ...(db.cardio || []).filter((c) => c.imported === 'FitBod').map((c) => c.ts)]);
    const logged = new Set((db.sessions || []).filter((s) => !s.imported).map((s) => s.date));
    const notSeen = workouts.filter((w) => !seen.has(w.start));
    const fresh = notSeen.filter((w) => !logged.has(w.date));
    return { names, map, unmatched, workouts: fresh, skipped: workouts.length - notSeen.length, overlap: notSeen.length - fresh.length };
  }
  const existing = new Set((db.sessions || []).map((s) => `${s.date}|${s.importedFrom || ''}`));
  const fresh = workouts.filter((w) => !existing.has(`${w.date}|${w.name}`));
  return { names, map, unmatched, workouts: fresh, skipped: workouts.length - fresh.length, overlap: 0 };
}

const slug = (s) => `imp-${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
function guessType(name) {
  const n = name.toLowerCase();
  if (/dumbbell|\bdb\b/.test(n)) return 'dumbbell';
  if (/machine|smith|leg press|pec deck|hack/.test(n)) return 'machine';
  if (/cable|pulldown|pushdown/.test(n)) return 'cable';
  if (/barbell|squat|deadlift|bench|row|press/.test(n)) return /squat|deadlift|hip thrust|lunge/.test(n) ? 'barbell-lower' : 'barbell-upper';
  return /pull ?up|chin ?up|push ?up|dip|plank|crunch|sit ?up/.test(n) ? 'bodyweight' : 'machine';
}

// Apply: custom exercises for unmatched names, then the workouts as sessions.
export function applyImport(db, plan, source) {
  for (const n of plan.unmatched) {
    const id = slug(n);
    if (!db.exercises[id]) {
      db.exercises[id] = { id, name: n, type: guessType(n), category: /squat|deadlift|press|row|pull ?up|chin|dip|lunge|clean/i.test(n) ? 'compound' : 'accessory', primary: [], secondary: [], pattern: '', metric: 'reps', increment: 5, notes: `Imported from ${source}`, rules: {}, minRir: 0, startWeight: null, customMeta: true, needs: [], modes: ['reps'] };
      if (source === 'FitBod') Object.assign(db.exercises[id], customExercise(id, n, plan.workouts.flatMap((w) => w.entries.filter((e) => e.name === n).flatMap((e) => e.sets))));
    }
    plan.map[n] = id;
  }
  let n = 0;
  for (const w of plan.workouts) {
    const id = `imp${w.start.toString(36)}${n}`;
    (w.cardio || []).forEach((c, i) => {
      db.cardio = db.cardio || [];
      db.cardio.push({ id: `c${id}-${i}`, date: w.date, ts: w.start, cardioId: c.modality === 'run' ? 'zone2-run' : 'easy-swim', minutes: Math.max(1, Math.round(c.seconds / 60)), ...(c.modality === 'run' && c.meters > 0 ? { distance: Math.round((c.meters / 1609.34) * 100) / 100 } : {}), note: `From ${source}`, imported: source });
    });
    n++;
    if (!w.entries.length) continue;
    db.sessions.push({
      id, date: w.date, day: dayKeyOf(w.date), freestyle: true, imported: source, importedFrom: w.name, name: w.name,
      startedAt: w.start, finishedAt: w.end, results: [], prs: [],
      entries: w.entries.map((e, i) => ({ uid: `${id}-${i}`, exerciseId: plan.map[e.name], name: e.name, group: String(i + 1), ...(e.sets.every((s) => s.seconds > 0 && !s.reps) ? { metric: 'time' } : (db.exercises[plan.map[e.name]]?.metric || 'reps') !== 'reps' ? { metric: 'reps' } : {}), ...(e.note ? { note: e.note } : {}), sets: e.sets.map((s) => ({ weight: s.weight, reps: s.reps, done: true, ...(s.seconds > 0 && !s.reps ? { time: s.seconds } : {}), ...(s.type ? { type: s.type } : {}), ...(s.rpe ? { rir: Math.max(0, Math.round(10 - s.rpe)) } : {}) })) })),
    });
  }
  db.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.finishedAt || 0) - (b.finishedAt || 0)));
  return n;
}
