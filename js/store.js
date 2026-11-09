// Data storage. Everything stays on this device.
//
// Primary store: IndexedDB (database "lift", object store "kv", key "db").
// Mirror: localStorage "lift.db" — a second copy in case one store is lost.
// On load, whichever copy was saved most recently wins.
// Daily snapshots (last 7) and labelled safety snapshots (last 5) live in IndexedDB too,
// as do progress photos (kept out of the main record so it stays small).
import { defaultExercises, defaultPlan, seedState, DEFAULT_INCREMENTS } from './plan.js';
import { syncBank } from './bank.js';
import { CARDIO } from './cardio-bank.js';

const KEY = 'lift.db';
export const SCHEMA_VERSION = 6;

// ---------- Dates ----------

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

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export function mondayOf(dateStr) {
  const d = parseDate(dateStr);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return todayStr(d);
}

// ---------- Shape ----------

export function defaultGym(id = 'gym-1', name = 'My gym') {
  return {
    id, name,
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    barWeight: 45,
    plates: [45, 35, 25, 10, 5, 2.5], // available per side
    dbStep: 5, // dumbbell jumps
    dbMax: 150,
    machineStep: 5, // stack / plate-loaded step
    unavailable: [], // exercise ids this gym doesn't have
  };
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
      welcomed: false, // first-run welcome on Today
      defaultIncrements: { ...DEFAULT_INCREMENTS },
      activeGym: 'gym-1',
      warmups: true, // warm-up sets on the first main lift
      rampEffort: true, // reps-in-reserve target tightens across each block
      rampStart: 3, // reps in reserve in week 1 of a block
      rampEnd: null, // reps in reserve in the last week before deload (null = from profile)
      deloadOff: false, // no scheduled deloads
      lastBackupAt: null,
      backupReminder: true,
    },
    exercises: syncBank(defaultExercises(), DEFAULT_INCREMENTS),
    plan: defaultPlan(),
    state: seedState(),
    sessions: [],
    activeSession: null,
    bodyweight: [], // { date, weight }
    measurements: [], // { date, waist, chest, arms, thighs, hips, neck } (inches)
    photos: [], // { id, date, note } — image data is in IndexedDB
    cardio: [], // { id, date, ts, cardioId, minutes, distance?, rpe?, note? }
    gyms: [defaultGym()],
    exPrefs: {}, // exercise id -> 'fav' | 'never'
    foodLog: [], // { id, date, ts, meal, name, qty, unit, grams?, kcal, p, c, f, fiber, ref? }
    customFoods: [], // { id, name, serving, grams?, kcal, p, c, f, fiber }
    meals: [], // saved meals: { id, name, items: [{ ref, name, qty, unit, grams, kcal, p, c, f, fiber }] }
    nutrition: { mealsPerDay: 4, activity: 'some', kcalOffset: 0, checkins: [] },
    yearPlan: null, // { start, phases: [{ id, type, weeks, note }] }
    blocks: { focus: {}, reviews: {} }, // focus lifts and check-ins per training block
    profile: null, // plan builder answers + prescription summary
    previousPlan: null, // last plan replaced by the builder, for undo
  };
}

// Each step takes a db at version N and returns version N+1.
// New collections are added with defaults (see migrate), so older backups keep working.
const MIGRATIONS = {
  // v2: exercise bank. Classification is filled in by syncBank on every load.
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
  // v4: plan builder profile. Existing users skip the first-run welcome.
  3: (db) => {
    db.profile = db.profile ?? null;
    db.previousPlan = db.previousPlan ?? null;
    db.settings.welcomed = true;
    db.schemaVersion = 4;
    return db;
  },
  // v5: gyms, exercise preferences, measurements, photos, nutrition log, year plan.
  // The old placeholder `nutrition` array becomes the nutrition settings object.
  4: (db) => {
    if (Array.isArray(db.nutrition)) {
      const old = db.nutrition;
      db.nutrition = { mealsPerDay: 4, activity: 'some', kcalOffset: 0, checkins: [] };
      db.foodLog = db.foodLog || [];
      for (const n of old) {
        if (!n || !n.date || !n.calories) continue;
        db.foodLog.push({ id: `f${Date.parse(n.date)}`, date: n.date, ts: Date.parse(n.date), meal: 1, name: 'Daily total', qty: 1, unit: 'entry', kcal: +n.calories || 0, p: +n.protein || 0, c: +n.carbs || 0, f: +n.fat || 0, fiber: 0 });
      }
    }
    db.schemaVersion = 5;
    return db;
  },
  // v6: training blocks (focus lifts, check-ins) and more training settings; defaults fill in below.
  5: (db) => { db.blocks = db.blocks || { focus: {}, reviews: {} }; db.schemaVersion = 6; return db; },
};

export function migrate(db) {
  const base = freshDb();
  while ((db.schemaVersion || 1) < SCHEMA_VERSION) {
    const v = db.schemaVersion || 1;
    db = MIGRATIONS[v](db);
  }
  // Fill any missing top-level keys or settings without touching existing data.
  for (const k of Object.keys(base)) if (db[k] === undefined || db[k] === null && base[k] !== null) db[k] = base[k];
  db.settings = { ...base.settings, ...db.settings };
  db.settings.defaultIncrements = { ...base.settings.defaultIncrements, ...db.settings.defaultIncrements };
  db.settings.dayModes = { ...base.settings.dayModes, ...db.settings.dayModes };
  db.nutrition = { ...base.nutrition, ...db.nutrition };
  if (!db.gyms.length) db.gyms = [defaultGym()];
  db.gyms = db.gyms.map((g) => ({ ...defaultGym(g.id, g.name), ...g }));
  if (!db.gyms.some((g) => g.id === db.settings.activeGym)) db.settings.activeGym = db.gyms[0].id;
  syncBank(db.exercises, db.settings.defaultIncrements);
  return db;
}

// ---------- IndexedDB ----------

const hasIdb = () => typeof indexedDB !== 'undefined';
let dbPromise = null;

function idb() {
  if (!hasIdb()) return Promise.reject(new Error('IndexedDB unavailable'));
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('lift', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of ['kv', 'snapshots', 'photos']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return idb().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const idbGet = (store, key) => tx(store, 'readonly', (s) => s.get(key));
const idbPut = (store, key, val) => tx(store, 'readwrite', (s) => { s.put(val, key); });
const idbDel = (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); });
function idbAll(store) {
  return idb().then((d) => new Promise((resolve, reject) => {
    const out = [];
    const req = d.transaction(store, 'readonly').objectStore(store).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else resolve(out);
    };
    req.onerror = () => reject(req.error);
  }));
}

// ---------- Load & save ----------

let saveErrorHandler = () => {};
export function onSaveError(fn) { saveErrorHandler = fn; }

export async function loadDb() {
  let fromIdb = null;
  let fromLs = null;
  try { const raw = await idbGet('kv', 'db'); if (raw) fromIdb = JSON.parse(raw); } catch (e) { console.warn('IndexedDB read failed', e); }
  try { const raw = localStorage.getItem(KEY); if (raw) fromLs = JSON.parse(raw); } catch (e) { console.warn('localStorage read failed', e); }
  const data = [fromIdb, fromLs].filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  if (!data) return freshDb();
  const db = migrate(data);
  save(db);
  return db;
}

let pending = null;
let timer = null;

function writeIdb() {
  clearTimeout(timer);
  timer = null;
  if (!pending) return Promise.resolve();
  const json = pending;
  pending = null;
  return idbPut('kv', 'db', json).catch((e) => { console.error('IndexedDB write failed', e); saveErrorHandler(e); });
}

// Saves the mirror immediately and the main store shortly after (batched).
export function save(db) {
  db.savedAt = Date.now();
  const json = JSON.stringify(db);
  let ok = false;
  try { localStorage.setItem(KEY, json); ok = true; } catch (e) { console.warn('localStorage write failed', e); }
  if (hasIdb()) {
    pending = json;
    if (!timer) timer = setTimeout(writeIdb, 250);
    ok = true;
  }
  if (!ok) saveErrorHandler(new Error('No storage available'));
  return ok;
}

export function flushSave() { return writeIdb(); }
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { writeIdb(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) writeIdb(); });
}

export async function storageInfo() {
  const out = { idb: hasIdb(), persisted: null, usage: null, quota: null };
  try {
    if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) Object.assign(out, await navigator.storage.estimate());
  } catch {}
  return out;
}

export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

// ---------- Snapshots ----------

// Once a day, keep a copy of the whole record (last 7 kept).
export async function dailySnapshot(db) {
  if (!hasIdb()) return;
  const key = `daily-${todayStr()}`;
  try {
    if (await idbGet('snapshots', key)) return;
    await idbPut('snapshots', key, { ts: Date.now(), label: 'Daily', json: JSON.stringify(db) });
    await pruneSnapshots();
  } catch (e) { console.warn('Snapshot failed', e); }
}

// Before risky actions (import, erase, new plan): a labelled copy (last 5 kept).
export async function safetySnapshot(db, label) {
  if (!hasIdb()) return;
  try {
    await idbPut('snapshots', `safe-${Date.now()}`, { ts: Date.now(), label, json: JSON.stringify(db) });
    await pruneSnapshots();
  } catch (e) { console.warn('Snapshot failed', e); }
}

async function pruneSnapshots() {
  const all = await idbAll('snapshots');
  const keep = (prefix, n) => all.filter((x) => String(x.key).startsWith(prefix)).sort((a, b) => b.value.ts - a.value.ts).slice(n);
  for (const x of [...keep('daily-', 7), ...keep('safe-', 5)]) await idbDel('snapshots', x.key);
}

export async function listSnapshots() {
  if (!hasIdb()) return [];
  const all = await idbAll('snapshots');
  return all.map((x) => ({ key: x.key, ts: x.value.ts, label: x.value.label, size: x.value.json.length }))
    .sort((a, b) => b.ts - a.ts);
}

export async function readSnapshot(key) {
  const v = await idbGet('snapshots', key);
  if (!v) throw new Error('Snapshot not found');
  return migrate(JSON.parse(v.json));
}

// ---------- Photos ----------

export const putPhoto = (id, blob) => idbPut('photos', id, blob);
export const getPhoto = (id) => idbGet('photos', id);
export const deletePhoto = (id) => idbDel('photos', id);

// ---------- Export / import ----------

export function exportJson(db, extra = {}) {
  return JSON.stringify({ app: 'lift-tracker', exportedAt: new Date().toISOString(), ...db, ...extra }, null, 2);
}

const MAX_IMPORT_BYTES = 60 * 1024 * 1024;

export function parseBackup(text) {
  if (text.length > MAX_IMPORT_BYTES) throw new Error('That file is too large to be a backup.');
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This file is not a Lift Tracker backup.');
  return data;
}

// Validates and upgrades a parsed backup. Returns { db, photos } where photos is [{ id, dataUrl }].
export function importData(data) {
  if (!data.schemaVersion || typeof data.plan !== 'object' || typeof data.exercises !== 'object') {
    throw new Error('This file is not a Lift Tracker backup.');
  }
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error('This backup is from a newer version of the app.');
  for (const k of ['sessions', 'bodyweight', 'cardio']) {
    if (data[k] !== undefined && !Array.isArray(data[k])) throw new Error(`Backup field "${k}" is damaged.`);
  }
  const photos = Array.isArray(data.photoData) ? data.photoData : [];
  delete data.app; delete data.exportedAt; delete data.photoData;
  return { db: migrate(data), photos };
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
  rows.push(['food_date', 'meal', 'food', 'qty', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']);
  for (const f of db.foodLog || []) rows.push([f.date, f.meal, f.name, f.qty, f.unit, Math.round(f.kcal), f.p, f.c, f.f, f.fiber]);
  rows.push([]);
  rows.push(['bodyweight_date', 'weight_lb']);
  for (const b of db.bodyweight) rows.push([b.date, b.weight]);
  rows.push([]);
  rows.push(['measure_date', 'waist_in', 'chest_in', 'arms_in', 'thighs_in', 'hips_in', 'neck_in']);
  for (const m of db.measurements || []) rows.push([m.date, m.waist, m.chest, m.arms, m.thighs, m.hips, m.neck]);
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
