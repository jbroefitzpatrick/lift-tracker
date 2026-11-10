// Exercise detail, gyms & equipment, data & security, measurements & photos, weekly volume, backups.
import { icon } from './icons.js';
import { EX_INFO } from './exercise-info.js';
import { bestRecords } from './records.js';
import { activeGym } from './gym.js';
import { MUSCLES } from './bank.js';
import { VOLUME_MUSCLES, volumeTarget } from './builder.js';
import {
  defaultGym, todayStr, daysBetween, exportJson, exportCsv, download, parseBackup, importData, storageInfo, requestPersistence,
  listSnapshots, readSnapshot, safetySnapshot, putPhoto, getPhoto, deletePhoto, freshDb,
} from './store.js';
import { encryptText, decryptText, isEncrypted, cryptoAvailable } from './crypto.js';

const MEASURES = { waist: 'Waist', chest: 'Chest', arms: 'Arms', thighs: 'Thighs', hips: 'Hips', neck: 'Neck' };
const BAR_OPTIONS = [45, 35, 33, 25, 20, 15];
const PLATE_OPTIONS = [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25];
const EQUIP = { barbell: 'Barbell', dumbbell: 'Dumbbells', machine: 'Machines', cable: 'Cables', bodyweight: 'Pull-up bar / bodyweight' };

export function createExtras(ctx) {
  const { esc, $ } = ctx;
  const photoUrls = new Map();
  let pendingImport = null;

  // ---------- Exercise detail ----------

  function exerciseInfo(ex) {
    const db = ctx.db;
    const info = EX_INFO[ex.id] || {};
    const gym = activeGym(db);
    const pref = db.exPrefs[ex.id];
    const unavailable = gym.unavailable.includes(ex.id);
    const rec = bestRecords(db, ex.id);
    const demo = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} exercise proper form`)}`;
    return `<div class="card ex-info">
      ${info.images ? `<div class="ex-imgs">${info.images.map((src, i) => `<img src="${src}" alt="${esc(ex.name)} — ${i ? 'end' : 'start'} position" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>
        <p class="muted small">${info.approx ? `Photos show a close variation (${esc(info.src)}). ` : ''}Images & steps: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (public domain).</p>` : ''}
      ${info.cues ? `<h3 class="sect">Key cues</h3><ul class="cues">${info.cues.split(' · ').map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${info.steps ? `<details class="refs"><summary>Step by step${info.level ? ` · ${esc(info.level)}` : ''}</summary><ol>${info.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
      <a class="btn block demo-link" href="${demo}" target="_blank" rel="noopener">Watch a demo on YouTube</a>
      <div class="row wrap controls">
        <button class="mini ${pref === 'fav' ? 'on-good' : ''}" data-a="pref" data-id="${ex.id}" data-v="fav">${pref === 'fav' ? 'Favorited' : 'Favorite'}</button>
        <button class="mini ${pref === 'never' ? 'on-bad' : ''}" data-a="pref" data-id="${ex.id}" data-v="never">${pref === 'never' ? 'Never suggested' : 'Never suggest'}</button>
        <button class="mini ${unavailable ? 'on-bad' : ''}" data-a="unavail" data-id="${ex.id}">${unavailable ? `Not at ${esc(gym.name)}` : `Not at ${esc(gym.name)}`}</button>
      </div>
    </div>
    ${rec ? `<div class="card"><h3>Personal records</h3>
      ${rec.e1.v ? `<div class="rx-row"><span class="muted">Best est. 1RM</span><b>${Math.round(rec.e1.v)} lb <span class="muted small">(${rec.e1.w}×${rec.e1.r}, ${ctx.fmtDate(rec.e1.date)})</span></b></div>` : ''}
      <div class="rx-row"><span class="muted">Heaviest set</span><b>${rec.heavy.v} lb × ${rec.heavy.r}</b></div>
      <div class="rx-row"><span class="muted">Most reps</span><b>${rec.reps.v}${rec.reps.w ? ` @ ${rec.reps.w} lb` : ''}</b></div>
      ${rec.vol.v ? `<div class="rx-row"><span class="muted">Best session volume</span><b>${Math.round(rec.vol.v).toLocaleString()} lb</b></div>` : ''}
    </div>` : ''}`;
  }

  // ---------- Weekly volume (History) ----------

  function volumeCard() {
    const db = ctx.db;
    const since = Date.now() - 7 * 86400000;
    const ws = {};
    for (const s of db.sessions) {
      if ((s.finishedAt || 0) < since) continue;
      for (const e of s.entries) {
        const ex = db.exercises[e.exerciseId];
        if (!ex) continue;
        const n = e.sets.filter((x) => !x.pain && x.reps > 0).length * (s.isDeload ? 1 : 1);
        for (const m of ex.primary) ws[m] = (ws[m] || 0) + n;
        for (const m of ex.secondary) ws[m] = (ws[m] || 0) + n * 0.5;
      }
    }
    if (!Object.keys(ws).length) return '';
    const rx = { weekly: db.profile?.rx?.weekly || [10, 20], includePhysique: !!db.profile?.rx?.includePhysique };
    const rows = VOLUME_MUSCLES.map((m) => {
      const v = Math.round((ws[m] || 0) * 2) / 2;
      const [lo, hi] = volumeTarget(rx, m);
      const pct = Math.min(100, (v / hi) * 100);
      return `<div class="fresh-row vol"><span class="fr-name">${MUSCLES[m]}</span>
        <span class="fr-bar target" style="--lo:${(lo / hi) * 100}%"><i class="${v < lo ? 'low' : ''}" style="width:${Math.max(pct, 2)}%"></i></span>
        <span class="fr-pct"><b>${v}</b> <span class="muted">/ ${lo}–${hi}</span></span></div>`;
    }).join('');
    return `<div class="card"><h3>Sets per muscle, last 7 days</h3>
      <p class="muted small">Hard sets, counting ½ for assisting muscles, against your weekly target${db.profile ? '' : ' (default 10–20)'}. The tick marks the low end of the target. ${ctx.refChips(['pelland2026', 'schoenfeld2017vol'])}</p>${rows}</div>`;
  }

  // ---------- Body: measurements & photos ----------

  function bodyCards() {
    const db = ctx.db;
    const list = [...db.measurements].sort((a, b) => b.date.localeCompare(a.date));
    const last = list[0];
    const first = list[list.length - 1];
    const today = list.find((m) => m.date === todayStr()) || {};
    const delta = (k) => (last && first && last !== first && last[k] != null && first[k] != null ? last[k] - first[k] : null);
    const photos = [...db.photos].sort((a, b) => b.date.localeCompare(a.date));
    setTimeout(loadThumbs);
    return `<div class="card"><h3>Measurements</h3><p class="muted small">Inches</p>
        <div class="grid3">${Object.entries(MEASURES).map(([k, v]) => `<div class="field"><span>${v}</span><input id="ms-${k}" type="text" inputmode="decimal" value="${today[k] ?? ''}" placeholder="${last?.[k] ?? ''}"></div>`).join('')}</div>
        <button class="btn primary block" data-a="ms-save">${today.date ? 'Update' : 'Save'} today's measurements</button>
        ${list.length > 1 ? `<p class="small">Since ${ctx.fmtDate(first.date)}: ${Object.entries(MEASURES).map(([k, v]) => { const d = delta(k); return d == null ? '' : `${v} ${d >= 0 ? '+' : ''}${d.toFixed(1)}`; }).filter(Boolean).join(' · ')}</p>` : ''}
        ${list.slice(0, 5).map((m) => `<div class="list-row small"><span class="grow">${ctx.fmtDate(m.date)}</span><span class="muted">${Object.keys(MEASURES).filter((k) => m[k] != null).map((k) => `${MEASURES[k][0]} ${m[k]}`).join(' · ')}</span><button class="mini" data-a="ms-del" data-date="${m.date}" aria-label="Delete">${icon('x')}</button></div>`).join('')}
      </div>
      <div class="card"><h3>Progress photos</h3>
        <p class="muted small">Stored only on this phone (resized to save space). Same pose and lighting each time makes them easier to compare.</p>
        <label class="btn block file-btn">Add photo<input id="photo-file" type="file" accept="image/*" hidden></label>
        ${photos.length >= 2 ? '<button class="btn block" data-a="photo-compare">Compare first and latest</button>' : ''}
        <div class="photo-grid">${photos.map((p) => `<button class="photo-thumb" data-a="photo-open" data-id="${p.id}"><img data-photo="${p.id}" alt="Progress photo ${ctx.fmtDate(p.date)}"><span>${ctx.fmtDate(p.date)}</span></button>`).join('')}</div>
      </div>`;
  }

  async function photoUrl(id) {
    if (photoUrls.has(id)) return photoUrls.get(id);
    const blob = await getPhoto(id).catch(() => null);
    if (!blob) return '';
    const url = URL.createObjectURL(blob);
    photoUrls.set(id, url);
    return url;
  }

  async function loadThumbs() {
    for (const img of document.querySelectorAll('img[data-photo]')) img.src = await photoUrl(img.dataset.photo);
  }

  async function resizeImage(file, max = 1280) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  }

  // ---------- Gyms ----------

  function gymCard() {
    const db = ctx.db;
    const g = activeGym(db);
    return `<div class="card">
      <div class="chips wrap">${db.gyms.map((x) => `<button class="chip ${x.id === g.id ? 'on' : ''}" data-a="gym-use" data-id="${x.id}">${esc(x.name)}</button>`).join('')}
        <button class="chip" data-a="gym-add">Add gym</button></div>
      <p class="small">${esc(g.name)}: ${g.barWeight} lb bar · plates ${g.plates.join(', ')} · dumbbells every ${g.dbStep} lb up to ${g.dbMax} · machines every ${g.machineStep} lb${g.unavailable.length ? ` · ${g.unavailable.length} exercises marked unavailable` : ''}</p>
      <button class="btn block" data-a="gym-edit" data-id="${g.id}">Edit ${esc(g.name)}</button>
    </div>`;
  }

  function openGym(id) {
    const db = ctx.db;
    const g = db.gyms.find((x) => x.id === id);
    const chips = (key, opts, cur, multi) => `<div class="chips wrap">${opts.map((v) => {
      const on = multi ? cur.includes(v) : cur === v;
      return `<button class="chip ${on ? 'on' : ''}" data-a="gym-set" data-k="${key}" data-v="${v}" ${multi ? 'data-multi="1"' : ''}>${EQUIP[v] || v}</button>`;
    }).join('')}</div>`;
    ctx.openSheet(`<h2>Edit gym</h2>
      <div class="field"><span>Name</span><input id="gym-name" type="text" value="${esc(g.name)}"></div>
      <div class="field"><span>Equipment</span>${chips('equipment', Object.keys(EQUIP), g.equipment, true)}</div>
      <div class="field"><span>Barbell weight (lb)</span>${chips('barWeight', BAR_OPTIONS, g.barWeight)}</div>
      <div class="field"><span>Plates available (lb)</span>${chips('plates', PLATE_OPTIONS, g.plates, true)}</div>
      <div class="grid2">
        <div class="field"><span>Dumbbell jumps (lb)</span>${chips('dbStep', [2.5, 5, 10], g.dbStep)}</div>
        <div class="field"><span>Machine / stack step (lb)</span>${chips('machineStep', [2.5, 5, 10, 15, 20], g.machineStep)}</div>
      </div>
      <div class="field"><span>Heaviest dumbbell (lb)</span><input id="gym-dbmax" type="text" inputmode="numeric" value="${g.dbMax}"></div>
      ${g.unavailable.length ? `<h3 class="sect">Not available here</h3>${g.unavailable.map((exId) => `<div class="list-row"><span class="grow">${esc(db.exercises[exId]?.name || exId)}</span><button class="mini" data-a="gym-unblock" data-id="${exId}">Available</button></div>`).join('')}` : '<p class="muted small">Mark exercises "Not at this gym" from their detail page (tap an exercise name).</p>'}
      <button class="btn primary block big" data-a="gym-save" data-id="${g.id}">Done</button>
      ${db.gyms.length > 1 ? `<button class="btn danger block" data-a="gym-del" data-id="${g.id}">Delete this gym</button>` : ''}`);
    ui.gymEdit = id;
  }
  const ui = ctx.ui;

  // ---------- Data & security ----------

  function dataCard() {
    const db = ctx.db;
    const last = db.settings.lastBackupAt;
    setTimeout(async () => {
      const el = $('#storage-status');
      if (!el) return;
      const s = await storageInfo();
      const mb = (x) => (x / 1048576).toFixed(1);
      el.textContent = `Stored on this device in two copies${s.usage != null ? ` (${mb(s.usage)} MB)` : ''}. ${s.persisted ? 'Protected from automatic clearing.' : 'The browser may clear it if storage runs low.'}`;
    });
    const chev = icon('right', 'chev');
    return `<div class="card">
      <div class="kv-list"><div class="kv"><span>Last backup</span><b>${last ? ctx.fmtDate(todayStr(new Date(last))) : 'Never'}</b></div></div>
      <p class="muted small" id="storage-status">Checking storage…</p>
      <label class="toggle"><input type="checkbox" data-a="set-backup-remind" ${db.settings.backupReminder ? 'checked' : ''}><span>Remind me to back up weekly</span></label>
      <label class="toggle"><input type="checkbox" id="bk-photos"><span>Include progress photos in backups</span></label>
      <button class="btn primary block" data-a="quick-backup">Back up</button>
      ${savedPass() ? '<p class="muted small">Passphrase remembered on this device for one-tap backups. <button class="text-btn inline" data-a="forget-pass">Forget it</button></p>' : ''}
    </div>
    <div class="list-group">
      <button class="list-row" data-a="export-json"><span class="grow">Export plain backup</span>${chev}</button>
      <button class="list-row" data-a="export-csv"><span class="grow">Export history as CSV</span>${chev}</button>
      <label class="list-row"><span class="grow">Check a backup file</span>${chev}<input id="check-file" type="file" accept="application/json,.json" hidden></label>
      <label class="list-row"><span class="grow">Import a backup</span>${chev}<input id="import-file" type="file" accept="application/json,.json" hidden></label>
      <button class="list-row" data-a="snapshots"><span class="grow">Restore an automatic snapshot</span>${chev}</button>
      <button class="list-row" data-a="persist-req"><span class="grow">Keep data permanently</span>${chev}</button>
    </div>
    <p class="muted small pad">Everything stays on this device. Encrypted backups use AES-256 with your passphrase. Keep it somewhere safe; it can't be recovered. A snapshot is kept each day for a week, before every import, erase or plan change, and before each app update changes how data is stored. Saves that would erase most of your history are blocked.</p>`;
  }

  function backupBanner() {
    const db = ctx.db;
    const s = db.settings;
    if (!s.backupReminder || db.sessions.length < 3) return '';
    const last = s.lastBackupAt || 0;
    const snooze = s.backupSnoozeUntil || 0;
    if (Date.now() - last < 7 * 86400000 || Date.now() < snooze) return '';
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    return `<div class="slim-banner" role="status"><span class="grow"><b>Back up your data</b><span class="pick-sub">${days ? `Last backup ${days} days ago` : 'No backup yet'} · or turn on cloud backup in Settings</span></span>
      <button class="btn sm primary" data-a="quick-backup">Back up</button><button class="icon-btn subtle" data-a="backup-snooze" aria-label="Remind me later">${icon('x')}</button></div>`;
  }

  async function backupPayload(withPhotos) {
    const db = ctx.db;
    const extra = {};
    if (withPhotos) {
      extra.photoData = [];
      for (const p of db.photos) {
        const blob = await getPhoto(p.id).catch(() => null);
        if (!blob) continue;
        const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        extra.photoData.push({ id: p.id, dataUrl });
      }
    }
    return exportJson(db, extra);
  }

  function markBackedUp() { ctx.db.settings.lastBackupAt = Date.now(); ctx.persist(); }

  // The backup passphrase can be remembered on this device for one-tap backups. It's kept outside
  // the data record (so it's never inside a backup); the data on the phone is unencrypted anyway,
  // so remembering it doesn't weaken anything — it protects the copies that leave the phone.
  const PASS_KEY = 'lift.bkpass';
  const savedPass = () => { try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; } };
  const setSavedPass = (p) => { try { p ? localStorage.setItem(PASS_KEY, p) : localStorage.removeItem(PASS_KEY); } catch {} };

  async function encryptedBackup(pass, withPhotos) {
    ctx.toast('Encrypting…');
    const text = await encryptText(await backupPayload(withPhotos), pass);
    const ok = await download(`lift-backup-${todayStr()}.enc.json`, text, 'application/json');
    if (ok) { markBackedUp(); ctx.toast('Backup saved.'); ctx.render(); }
    return ok;
  }

  // Shown on the finished-workout screen when the last backup is more than a day old.
  function summaryBackupCard() {
    const last = ctx.db.settings.lastBackupAt || 0;
    if (Date.now() - last < 20 * 3600000) return '';
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    return `<div class="card backup-card"><div class="row between">
      <div><b>Back up this workout</b><p class="muted small">${days == null ? 'No backup yet.' : days === 0 ? 'Last backup earlier today.' : `Last backup ${days} ${days === 1 ? 'day' : 'days'} ago.`} Save a copy to iCloud Drive in Files.</p></div>
      <button class="btn sm primary" data-a="quick-backup">Back up</button></div></div>`;
  }

  // Opens a backup file and reports what's in it, without changing anything.
  async function checkBackup(text, pass) {
    let data = parseBackup(text);
    if (isEncrypted(data)) {
      const p = pass ?? savedPass();
      try { data = parseBackup(await decryptText(data, p)); } catch {
        pendingCheck = text;
        ctx.openSheet(`<h2>Check an encrypted backup</h2>
          <div class="field"><span>Passphrase</span><input id="chk-pass" type="password" autocomplete="current-password"></div>
          <button class="btn primary block big" data-a="check-decrypt">Check</button>
          <button class="btn block" data-a="close-sheet">Cancel</button>`);
        if (p && pass != null) ctx.toast('That passphrase doesn\'t open this file.');
        return;
      }
    }
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'unknown date';
    const { db: d, photos } = importData(JSON.parse(JSON.stringify(data)));
    const last = d.sessions.at(-1);
    ctx.openSheet(`<h2>Backup is good</h2>
      <p class="muted small">This file opens and passes every check. Nothing on this phone was changed.</p>
      <div class="kv-list">
        <div class="kv"><span>Saved</span><b>${esc(when)}</b></div>
        <div class="kv"><span>Workouts</span><b>${d.sessions.length}${last ? ` · last ${ctx.fmtDate(last.date)}` : ''}</b></div>
        <div class="kv"><span>Cardio sessions</span><b>${d.cardio.length}</b></div>
        <div class="kv"><span>Food entries</span><b>${d.foodLog.length}</b></div>
        <div class="kv"><span>Body weight entries</span><b>${d.bodyweight.length}</b></div>
        <div class="kv"><span>Progress photos</span><b>${photos.length}</b></div>
      </div>
      <button class="btn block" data-a="close-sheet">Done</button>`);
  }
  let pendingCheck = null;

  async function doImport(text) {
    let data = parseBackup(text);
    if (isEncrypted(data)) {
      pendingImport = data;
      ctx.openSheet(`<h2>Encrypted backup</h2>
        <div class="field"><span>Passphrase</span><input id="imp-pass" type="password" autocomplete="current-password"></div>
        <button class="btn primary block big" data-a="import-decrypt">Unlock & restore</button>
        <button class="btn block" data-a="close-sheet">Cancel</button>`);
      return;
    }
    await finishImport(data);
  }

  async function finishImport(data) {
    const { db: next, photos } = importData(data);
    if (!confirm(`Replace all data with this backup (${next.sessions.length} workouts, ${next.foodLog.length} food entries)? A snapshot of your current data is kept.`)) return;
    await safetySnapshot(ctx.db, 'Before import');
    for (const p of photos) {
      try { const blob = await (await fetch(p.dataUrl)).blob(); await putPhoto(p.id, blob); } catch {}
    }
    ctx.replaceDb(next);
    ctx.toast('Backup restored.');
  }

  const actions = {
    pref: (d) => {
      const db = ctx.db;
      db.exPrefs[d.id] = db.exPrefs[d.id] === d.v ? undefined : d.v;
      if (!db.exPrefs[d.id]) delete db.exPrefs[d.id];
      ctx.persist(); ctx.render();
    },
    unavail: (d) => {
      const g = activeGym(ctx.db);
      g.unavailable = g.unavailable.includes(d.id) ? g.unavailable.filter((x) => x !== d.id) : [...g.unavailable, d.id];
      ctx.persist(); ctx.render();
    },
    'ms-save': () => {
      const db = ctx.db;
      const m = { date: todayStr() };
      for (const k of Object.keys(MEASURES)) { const v = ctx.num(`ms-${k}`); if (v) m[k] = v; }
      if (Object.keys(m).length === 1) return ctx.toast('Enter at least one measurement.');
      db.measurements = db.measurements.filter((x) => x.date !== m.date).concat(m);
      ctx.persist(); ctx.render(); ctx.toast('Measurements saved.');
    },
    'ms-del': (d) => { ctx.db.measurements = ctx.db.measurements.filter((x) => x.date !== d.date); ctx.persist(); ctx.render(); },
    'photo-open': async (d) => {
      const p = ctx.db.photos.find((x) => x.id === d.id);
      ctx.openSheet(`<h2>${ctx.fmtDate(p.date)}</h2><img class="photo-full" src="${await photoUrl(p.id)}" alt="Progress photo">
        <button class="btn danger block" data-a="photo-del" data-id="${p.id}">Delete photo</button><button class="btn block" data-a="close-sheet">Close</button>`);
    },
    'photo-compare': async () => {
      const ps = [...ctx.db.photos].sort((a, b) => a.date.localeCompare(b.date));
      const a = ps[0]; const b = ps[ps.length - 1];
      ctx.openSheet(`<h2>Then and now</h2><div class="compare"><figure><img src="${await photoUrl(a.id)}" alt=""><figcaption>${ctx.fmtDate(a.date)}</figcaption></figure>
        <figure><img src="${await photoUrl(b.id)}" alt=""><figcaption>${ctx.fmtDate(b.date)}</figcaption></figure></div><button class="btn block" data-a="close-sheet">Close</button>`);
    },
    'photo-del': async (d) => {
      if (!confirm('Delete this photo?')) return;
      await deletePhoto(d.id).catch(() => {});
      ctx.db.photos = ctx.db.photos.filter((x) => x.id !== d.id);
      photoUrls.delete(d.id);
      ctx.persist(); ctx.closeSheet(); ctx.render();
    },
    'gym-use': (d) => { ctx.db.settings.activeGym = d.id; ctx.persist(); ctx.render(); ctx.toast(`Using ${activeGym(ctx.db).name}.`); },
    'gym-add': () => {
      const name = prompt('Name this gym', `Gym ${ctx.db.gyms.length + 1}`);
      if (!name) return;
      const g = { ...defaultGym(`gym-${Date.now().toString(36)}`, name) };
      ctx.db.gyms.push(g); ctx.db.settings.activeGym = g.id; ctx.persist(); ctx.render(); openGym(g.id);
    },
    'gym-edit': (d) => openGym(d.id),
    'gym-set': (d, el) => {
      const g = ctx.db.gyms.find((x) => x.id === ui.gymEdit);
      const v = Number.isNaN(+d.v) ? d.v : +d.v;
      if (d.multi) {
        const arr = new Set(g[d.k]);
        if (arr.has(v)) arr.delete(v); else arr.add(v);
        g[d.k] = [...arr];
        if (d.k === 'plates') g.plates.sort((a, b) => b - a);
        el.classList.toggle('on');
      } else {
        g[d.k] = v;
        el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
      }
      ctx.persist();
    },
    'gym-unblock': (d) => { const g = ctx.db.gyms.find((x) => x.id === ui.gymEdit); g.unavailable = g.unavailable.filter((x) => x !== d.id); ctx.persist(); openGym(g.id); },
    'gym-save': (d) => {
      const g = ctx.db.gyms.find((x) => x.id === d.id);
      g.name = $('#gym-name').value.trim() || g.name;
      g.dbMax = ctx.num('gym-dbmax') || g.dbMax;
      if (!g.plates.length) g.plates = [5];
      ctx.persist(); ctx.closeSheet(); ctx.render();
    },
    'gym-del': (d) => {
      if (!confirm('Delete this gym?')) return;
      ctx.db.gyms = ctx.db.gyms.filter((x) => x.id !== d.id);
      ctx.db.settings.activeGym = ctx.db.gyms[0].id;
      ctx.persist(); ctx.closeSheet(); ctx.render();
    },
    'set-warmups': (d, el) => { ctx.db.settings.warmups = el.checked; ctx.persist(); },
    'set-ramp': (d, el) => { ctx.db.settings.rampEffort = el.checked; ctx.persist(); },
    'set-backup-remind': (d, el) => { ctx.db.settings.backupReminder = el.checked; ctx.persist(); },
    'backup-snooze': () => { ctx.db.settings.backupSnoozeUntil = Date.now() + 3 * 86400000; ctx.persist(); ctx.render(); },
    'export-json': async () => {
      const text = await backupPayload($('#bk-photos')?.checked);
      if (await download(`lift-backup-${todayStr()}.json`, text, 'application/json')) markBackedUp();
    },
    'export-csv': () => download(`lift-history-${todayStr()}.csv`, exportCsv(ctx.db), 'text/csv'),
    'quick-backup': () => {
      if (!cryptoAvailable()) return ctx.toast('Encryption needs the app served over https.');
      const p = savedPass();
      if (p) return encryptedBackup(p, $('#bk-photos')?.checked || false);
      return actions['export-enc']();
    },
    'forget-pass': () => { setSavedPass(''); ctx.toast('Passphrase forgotten on this device.'); ctx.render(); },
    'check-decrypt': async () => {
      const p = $('#chk-pass').value;
      ctx.closeSheet();
      try { await checkBackup(pendingCheck, p); } catch (e) { ctx.toast(e.message || 'That file could not be read.'); }
    },
    'export-enc': () => {
      if (!cryptoAvailable()) return ctx.toast('Encryption needs the app served over https.');
      ui.bkPhotos = $('#bk-photos')?.checked || false;
      ctx.openSheet(`<h2>Encrypted backup</h2>
        <p class="muted small">Choose a passphrase. Without it the backup can't be opened — not even by you — so store it somewhere safe.</p>
        <div class="field"><span>Passphrase (8+ characters)</span><input id="enc-pass" type="password" autocomplete="new-password"></div>
        <div class="field"><span>Repeat passphrase</span><input id="enc-pass2" type="password" autocomplete="new-password"></div>
        <label class="toggle"><input type="checkbox" id="enc-remember" checked><span>Remember on this device for one-tap backups</span></label>
        <button class="btn primary block big" data-a="export-enc-go">Encrypt & save</button>
        <button class="btn block" data-a="close-sheet">Cancel</button>`);
    },
    'export-enc-go': async () => {
      const a = $('#enc-pass').value;
      if (a.length < 8) return ctx.toast('Use at least 8 characters.');
      if (a !== $('#enc-pass2').value) return ctx.toast('Passphrases don\'t match.');
      if ($('#enc-remember')?.checked) setSavedPass(a);
      ctx.closeSheet();
      await encryptedBackup(a, ui.bkPhotos);
    },
    'import-decrypt': async () => {
      try {
        const text = await decryptText(pendingImport, $('#imp-pass').value);
        ctx.closeSheet();
        await finishImport(parseBackup(text));
      } catch (e) { ctx.toast(e.message); }
    },
    snapshots: async () => {
      const list = await listSnapshots();
      ctx.openSheet(`<h2>Automatic snapshots</h2>
        <p class="muted small">Copies of all your data kept on this device. Restoring replaces current data (a snapshot of it is kept first).</p>
        ${list.map((s) => `<div class="list-row"><span class="grow"><b>${esc(s.label)}</b><span class="pick-sub">${new Date(s.ts).toLocaleString()} · ${(s.size / 1024).toFixed(0)} KB</span></span><button class="mini" data-a="snap-restore" data-key="${esc(s.key)}">Restore</button></div>`).join('') || '<p class="muted small">No snapshots yet — one is taken each day you open the app.</p>'}
        <button class="btn block" data-a="close-sheet">Close</button>`);
    },
    'snap-restore': async (d) => {
      if (!confirm('Restore this snapshot? Your current data is snapshotted first.')) return;
      const next = await readSnapshot(d.key);
      if (ctx.db) await safetySnapshot(ctx.db, 'Before snapshot restore');
      ctx.closeSheet(); ctx.replaceDb(next); ctx.toast('Snapshot restored.');
    },
    'persist-req': async () => {
      const ok = await requestPersistence();
      ctx.toast(ok ? 'Done — the phone will keep this data.' : 'The browser declined. Keep it on your Home Screen and back up regularly.');
      ctx.render();
    },
    'reset-all': async () => {
      if (!confirm('Erase ALL data on this device? A snapshot is kept, but export a backup first.')) return;
      if (!confirm('Really erase everything?')) return;
      await safetySnapshot(ctx.db, 'Before erase');
      ctx.replaceDb(freshDb());
    },
  };

  async function onChange(e) {
    const el = e.target;
    if (el.id === 'check-file' && el.files[0]) {
      try { await checkBackup(await el.files[0].text()); } catch (err) { ctx.toast(`This backup has a problem: ${err.message || 'it could not be read'}`); }
      el.value = '';
      return true;
    }
    if (el.id === 'import-file' && el.files[0]) {
      try { await doImport(await el.files[0].text()); } catch (err) { ctx.toast(err.message || 'Could not read that file.'); }
      el.value = '';
      return true;
    }
    if (el.id === 'photo-file' && el.files[0]) {
      try {
        const blob = await resizeImage(el.files[0]);
        const id = `p${Date.now().toString(36)}`;
        await putPhoto(id, blob);
        ctx.db.photos.push({ id, date: todayStr() });
        ctx.persist(); ctx.render(); ctx.toast('Photo saved on this device.');
      } catch (err) { ctx.toast('Could not save that photo.'); console.error(err); }
      el.value = '';
      return true;
    }
    return false;
  }

  return { exerciseInfo, volumeCard, bodyCards, gymCard, dataCard, backupBanner, summaryBackupCard, actions, onChange };
}
