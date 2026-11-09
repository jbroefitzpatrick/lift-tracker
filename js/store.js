// All data lives in one JSON document in localStorage, on the device only.
import { defaultExercises, defaultPlan, seedState, DEFAULT_INCREMENTS } from './plan.js';
import { syncBank } from './bank.js';
import { CARDIO } from './cardio-bank.js';

const KEY = 'lift.db';
export const SCHEMA_VERSION = 3;

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function mondayOf(dateStr) {
  const d = parseDate(dateStr);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return todayStr(d);
}

export function freshDb() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      theme: 'dark',
      units: 'lb',
      deloadEvery: 5,
      programStart: mondayOf(todayStr()),
      raceBlock: false,
      rowRotation: 0,
      rotationPromptWeek: 0,
      // lift | cardio | both | rest
      dayModes: { mon: 'lift', tue: 'lift', wed: 'lift', thu: 'lift', fri: 'lift', sat: 'rest', sun: 'rest' },
      sound: true,
      defaultIncrements: { ...DEFAULT_INCREMENTS },
    },
    exercises: syncBank(defaultExercises(), DEFAULT_INCREMENTS),
    plan: defaultPlan(),
    state: seedState(),
    sessions: [],
    activeSession: null,
    bodyweight: [], // { date, weight }
    cardio: [], // { id, date, ts, cardioId, minutes, distance?, rpe?, note? }
    nutrition: [], // future: { date, calories, protein, carbs, fat, notes }
  };
}

// Each step takes a db at version N and returns version N+1.
// New collections are added with defaults, so older backups keep working.
const MIGRATIONS = {
  // v2: exercise bank. Exercises gain category, pattern, primary and secondary muscles
  // (filled in by syncBank below on every load), so this step only bumps the version.
  1: (db) => { db.schemaVersion = 2; return db; },
  // v3: cardio log + day types. Saturday yoga logs move into the cardio log.
  2: (db) => {
    db.cardio = db.cardio || [];
    for (const a of db.activities || []) {
      const ts = new Date(`${a.date}T09:00:00`).getTime();
      db.cardio.push({ id: `c${ts}`, date: a.date, ts, cardioId: 'yoga', minutes: a.minutes || 30, note: a.note || '' });
    }
    delete db.activities;
    db.schemaVersion = 3;
    return db;
  },
};

export function migrate(db) {
  const base = freshDb();
  while ((db.schemaVersion || 1) < SCHEMA_VERSION) {
    const v = db.schemaVersion || 1;
    db = MIGRATIONS[v](db);
  }
  // Fill any missing top-level keys or settings without touching existing data.
  for (const k of Object.keys(base)) if (db[k] === undefined) db[k] = base[k];
  db.settings = { ...base.settings, ...db.settings };
  db.settings.defaultIncrements = { ...base.settings.defaultIncrements, ...db.settings.defaultIncrements };
  db.settings.dayModes = { ...base.settings.dayModes, ...db.settings.dayModes };
  syncBank(db.exercises, db.settings.defaultIncrements);
  return db;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = migrate(JSON.parse(raw));
      save(db); // write upgrades back right away
      return db;
    }
  } catch (e) {
    console.error('Could not read saved data', e);
  }
  return freshDb();
}

export function save(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('Could not save', e);
    return false;
  }
}

export function exportJson(db) {
  return JSON.stringify({ app: 'lift-tracker', exportedAt: new Date().toISOString(), ...db }, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.schemaVersion || !data.plan || !data.exercises) {
    throw new Error('This file is not a Lift Tracker backup.');
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup is from a newer version of the app.');
  }
  delete data.app;
  delete data.exportedAt;
  return migrate(data);
}

function csvCell(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(db) {
  const rows = [['date', 'day', 'deload', 'group', 'exercise', 'set', 'weight_lb', 'reps', 'rir', 'pain', 'excluded_from_progression']];
  for (const s of db.sessions) {
    for (const e of s.entries) {
      e.sets.forEach((set, i) => {
        rows.push([s.date, s.day, s.isDeload ? 'yes' : '', e.group, e.name, i + 1, set.weight, set.reps,
          set.rir ?? '', set.pain ? 'yes' : '', e.excluded ? 'yes' : '']);
      });
    }
  }
  rows.push([]);
  rows.push(['cardio_date', 'activity', 'minutes', 'distance_mi', 'rpe', 'note']);
  for (const c of db.cardio || []) rows.push([c.date, CARDIO[c.cardioId]?.name || c.cardioId, c.minutes, c.distance ?? '', c.rpe ?? '', c.note || '']);
  rows.push([]);
  rows.push(['bodyweight_date', 'weight_lb']);
  for (const b of db.bodyweight) rows.push([b.date, b.weight]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type });
  // On iPhone the share sheet is the most reliable way to save to Files.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: filename }).catch(() => {});
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve();
}
