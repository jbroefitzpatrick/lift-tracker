// Sync: the data record split into small documents, so phones exchange only what changed.
//
//   collections of items  → one document each: sessions/<id>, foodLog/<id>, bodyweight/<date>, …
//   keyed maps            → one document per key: exercises/<id>, state/<id>, plan/<day>
//   everything else       → one document per top-level key: root/settings, root/profile, …
// Progress photos stay on the phone (images live outside the record and are large), as do a few
// device-only settings and the "reopen today's workout" snapshot.
//
// What was last synced is remembered as a short hash per document (localStorage "lift.sync").
// A document whose hash changed is sent with the time it was noticed; one that disappeared is sent
// as deleted. The server returns everything newer than this phone's last version, and those
// documents are applied to the record (the server's copy is the newest of each).

import { account, api } from './account.js';

const ARRAYS = { sessions: 'id', pain: 'id', bodyweight: 'date', measurements: 'date', cardio: 'id', foodLog: 'id', customFoods: 'id', meals: 'id' };
const MAPS = ['exercises', 'state', 'plan'];
const SKIP = new Set(['photos', 'savedAt', 'schemaVersion', 'lastFinish']);
// Settings that describe this phone, not the person.
const LOCAL_SETTINGS = ['tours', 'installHintDismissed', 'lastBackupAt', 'backupSnoozeUntil', 'backupReminder', 'healthSetupHidden', 'weekPromptDismissed', 'tips'];
const STATE_KEY = 'lift.sync';

export function syncState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || { ver: 0, hashes: {} }; } catch { return { ver: 0, hashes: {} }; }
}
function saveState(s) { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch {} }
export function resetSyncState() { try { localStorage.removeItem(STATE_KEY); } catch {} }

// FNV-1a over the JSON text, plus its length: plenty to notice a change.
function hash(v) {
  const s = JSON.stringify(v ?? null);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}.${s.length}`;
}

const enc = (k) => encodeURIComponent(String(k));
const dec = (k) => decodeURIComponent(k);

export function flatten(db) {
  const out = new Map();
  for (const [k, v] of Object.entries(db)) {
    if (SKIP.has(k)) continue;
    if (ARRAYS[k] && Array.isArray(v)) { for (const it of v) if (it?.[ARRAYS[k]] != null) out.set(`${k}/${enc(it[ARRAYS[k]])}`, it); continue; }
    if (MAPS.includes(k) && v && typeof v === 'object') { for (const [kk, vv] of Object.entries(v)) if (vv != null) out.set(`${k}/${enc(kk)}`, vv); continue; }
    if (k === 'settings') {
      const s = { ...v };
      for (const x of LOCAL_SETTINGS) delete s[x];
      out.set('root/settings', s);
      continue;
    }
    out.set(`root/${k}`, v);
  }
  return out;
}

// Apply documents from the server to the record.
export function applyDocs(db, docs) {
  let touched = 0;
  const sortFor = new Set();
  for (const d of docs) {
    const slash = d.id.indexOf('/');
    const coll = d.id.slice(0, slash);
    const key = dec(d.id.slice(slash + 1));
    if (coll === 'root') {
      if (SKIP.has(key)) continue;
      if (key === 'settings') {
        const local = Object.fromEntries(LOCAL_SETTINGS.filter((x) => db.settings?.[x] !== undefined).map((x) => [x, db.settings[x]]));
        if (!d.deleted) db.settings = { ...(d.data || {}), ...local };
      } else if (d.deleted) delete db[key];
      else db[key] = d.data;
      touched++;
    } else if (ARRAYS[coll]) {
      const idKey = ARRAYS[coll];
      const arr = (db[coll] ||= []);
      const i = arr.findIndex((x) => String(x?.[idKey]) === key);
      if (d.deleted) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = d.data; else arr.push(d.data);
      sortFor.add(coll);
      touched++;
    } else if (MAPS.includes(coll)) {
      const map = (db[coll] ||= {});
      if (d.deleted) delete map[key]; else map[key] = d.data;
      touched++;
    }
  }
  // Keep date-ordered lists in order.
  if (sortFor.has('sessions')) db.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.finishedAt || 0) - (b.finishedAt || 0)));
  for (const c of ['bodyweight', 'measurements']) if (sortFor.has(c)) db[c].sort((a, b) => (a.date < b.date ? -1 : 1));
  return touched;
}

// True when the record holds the person's own data (not just the empty starting state).
export const hasOwnData = (db) => (db.sessions?.length || 0) + (db.foodLog?.length || 0) + (db.bodyweight?.length || 0) > 0;

let running = null;

// One sync round. mode: 'merge' (default) or 'replace' (take the account's data, first link only).
// Returns { sent, received }.
export async function syncNow(getDb, { onApply, mode = 'merge' } = {}) {
  if (running) return running;
  running = (async () => {
    const acct = account();
    if (!acct?.token) throw new Error('Not signed in.');
    let st = syncState();
    if (st.userId !== acct.user.id) st = { userId: acct.user.id, ver: 0, hashes: {} };
    const db = getDb();
    const local = flatten(db);
    // On a phone's first link its documents carry the oldest possible time, so where the account
    // already has the same document (settings, plan days) the account's copy is kept.
    const ts = st.ver === 0 ? 1 : Date.now();
    // Replace: forget local differences, so nothing local is sent and the account's copy is applied.
    const changes = [];
    if (mode !== 'replace') {
      for (const [id, v] of local) { const h = hash(v); if (st.hashes[id] !== h) changes.push({ id, ts, data: v, h }); }
      for (const id of Object.keys(st.hashes)) if (!local.has(id)) changes.push({ id, ts, deleted: true });
    }
    let received = [];
    let since = st.ver;
    // Send in chunks; each reply also brings what's new on the server.
    let i = 0;
    do {
      const part = changes.slice(i, i + 300);
      const res = await api('/v2/sync', { since, changes: part.map(({ h, ...c }) => c) }, { auth: true });
      for (const c of part) { if (c.deleted) delete st.hashes[c.id]; else st.hashes[c.id] = c.h; }
      received = received.concat(res.docs || []);
      since = res.ver;
      i += 300;
      if (i >= changes.length && !res.more) break;
    } while (true); // eslint-disable-line no-constant-condition
    // Apply what came back, skipping documents this phone already has as they are.
    const fresh = received.filter((d) => d.deleted ? local.has(d.id) || st.hashes[d.id] : hash(d.data) !== hash(local.get(d.id)));
    if (fresh.length) await onApply?.(fresh, mode);
    for (const d of received) { if (d.deleted) delete st.hashes[d.id]; else st.hashes[d.id] = hash(d.data); }
    st.ver = since;
    st.lastSync = Date.now();
    st.count = Object.keys(st.hashes).length;
    saveState(st);
    return { sent: changes.length, received: fresh.length };
  })();
  try { return await running; } finally { running = null; }
}

// What the server holds, without sending anything (to decide how to link a phone that has data).
export async function peekRemote() {
  const res = await api('/v2/sync', { since: 0, changes: [] }, { auth: true });
  return { count: (res.docs || []).length, more: !!res.more };
}
