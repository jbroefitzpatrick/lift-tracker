// Exercise detail, gyms & equipment, data & security, measurements & photos, weekly volume, backups.
import { icon } from './icons.js';
import { seedFromHistory } from './engine.js';
import { parseCsv, detectFormat, readWorkouts, planImport, applyImport } from './import-apps.js';
import { detectActivities, readActivities, planActivities, applyActivities, ACTIVITY_SOURCES } from './import-activities.js';
import { fmtDur, fmtDist } from './event-plan.js';
import { account, signOut } from './account.js';
import { resetSyncState } from './sync.js';
import { EX_INFO, stepsFor } from './exercise-info.js';
import { EXTRA_STEPS } from './exercise-info-extra.js';
import { bestRecords } from './records.js';
import { activeGym, GEAR } from './gym.js';
import { wt, wtEst, toDisp, wUnit, SMITH_CHOICES, smithBar, BAR_CHOICES, PLATE_CHOICES, DB_STEP_CHOICES, MACHINE_STEP_CHOICES, fromDisp } from './units.js';
import { MUSCLES } from './bank.js';
import { muscleIcon } from './body.js';
import { TRACKED_MUSCLES, volumeTarget } from './builder.js';
import {
  defaultGym, todayStr, daysBetween, exportJson, exportCsv, download, parseBackup, importData, storageInfo, requestPersistence,
  listSnapshots, readSnapshot, safetySnapshot, putPhoto, getPhoto, deletePhoto, freshDb,
} from './store.js';
import { GROUPS, PARTS, weeklySets } from './groups.js';
import { encryptText, decryptText, isEncrypted, cryptoAvailable } from './crypto.js';

const MEASURE_ICON = { waist: 'abs', chest: 'chest', arms: 'biceps', thighs: 'quads', hips: 'glutes', neck: 'traps' };
const MEASURES = { waist: 'Waist', chest: 'Chest', arms: 'Arms', thighs: 'Thighs', hips: 'Hips', neck: 'Neck' };
const EQUIP = { barbell: 'Barbells', dumbbell: 'Dumbbells', machine: 'Machines', cable: 'Cables', bodyweight: 'Bodyweight' };

export function createExtras(ctx) {
  const { esc, $ } = ctx;
  const photoUrls = new Map();
  let pendingImport = null;

  // ---------- Exercise detail ----------

  function exerciseInfo(ex) {
    const db = ctx.db;
    const info = { ...(EX_INFO[ex.id] || {}) };
    const gym = activeGym(db);
    const pref = db.exPrefs[ex.id];
    const unavailable = gym.unavailable.includes(ex.id);
    const rec = bestRecords(db, ex.id);
    const demo = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} exercise proper form`)}`;
    return `<div class="card ex-info">
      ${info.images ? `<div class="ex-imgs">${info.images.map((src, i) => `<img src="${src}" alt="${esc(ex.name)} — ${i ? 'end' : 'start'} position" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>
        <p class="muted small">${info.approx ? `Photos show a close variation (${esc(info.src)}). ` : ''}Images & steps: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (public domain).</p>` : ''}
      ${info.cues ? `<h3 class="sect">Key cues</h3><ul class="cues">${info.cues.split(' · ').map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${(info.steps = EXTRA_STEPS[ex.id] || stepsFor(ex.id, () => ctx.render())) ? `<details class="refs"><summary>Step by step${info.level ? ` · ${esc(info.level)}` : ''}</summary><ol>${info.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
      ${db.exCues?.[ex.id]?.length ? `<h3 class="sect">Your cues</h3><ul class="cues">${db.exCues[ex.id].map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${ex.notes ? `<h3 class="sect">Your notes</h3><p class="small">${esc(ex.notes)}</p>` : ''}
      <a class="btn block demo-link" href="${demo}" target="_blank" rel="noopener">Watch a demo on YouTube</a>
      <button class="btn block" data-a="ex-edit" data-id="${ex.id}">${ex.custom ? 'Edit exercise' : 'Edit muscles and notes'}</button>
      <div class="field"><span>Use this exercise ${ctx.helpBtn()}</span><p class="help-text" hidden>Prefer: picked first when the app builds a plan, swaps, rotates variations or fills a finisher. Avoid: only used when nothing better fits. Never: not picked at all.</p>
        <div class="segmented small-seg" role="radiogroup" aria-label="Use this exercise">${[['prefer', 'Prefer'], ['', 'Normal'], ['avoid', 'Avoid'], ['never', 'Never']].map(([v, l]) => `<button class="${(pref || '') === v ? 'on' : ''}" data-a="pref" data-id="${ex.id}" data-v="${v}" role="radio" aria-checked="${(pref || '') === v}">${l}</button>`).join('')}</div></div>
      <div class="row wrap controls">
        <button class="mini ${unavailable ? 'on-bad' : ''}" data-a="unavail" data-id="${ex.id}">${unavailable ? `Not at ${esc(gym.name)}` : `Not at ${esc(gym.name)}`}</button>
      </div>
    </div>
    ${rec ? `<div class="card"><h3>Personal records</h3>
      ${rec.e1.v ? `<div class="rx-row"><span class="muted">Best estimated max</span><b>${wtEst(rec.e1.v)} <span class="muted small">(${toDisp(rec.e1.w)}×${rec.e1.r}, ${ctx.fmtDate(rec.e1.date)})</span></b></div>` : ''}
      ${rec.heavy.v ? `<div class="rx-row"><span class="muted">Heaviest set</span><b>${wt(rec.heavy.v)}${rec.heavy.r ? ` × ${rec.heavy.r}` : ''}</b></div>` : ''}
      ${rec.reps.v ? `<div class="rx-row"><span class="muted">Most reps</span><b>${rec.reps.v}${rec.reps.w ? ` @ ${wt(rec.reps.w)}` : ''}</b></div>` : ''}
      ${rec.vol.v ? `<div class="rx-row"><span class="muted">Best workout volume</span><b>${Math.round(toDisp(rec.vol.v)).toLocaleString()} ${wUnit()}</b></div>` : ''}
    </div>` : ''}`;
  }

  // ---------- Weekly volume (History) ----------

  function volumeCard() {
    const db = ctx.db;
    const { muscles: ws, parts } = weeklySets(db);
    if (!Object.keys(ws).length) return '';
    const rx = { weekly: db.profile?.rx?.weekly || [10, 20], includePhysique: !!db.profile?.rx?.includePhysique };
    const r = (x) => Math.round(x * 2) / 2;
    const bar = (v, lo, hi) => `<span class="fr-bar target" style="--lo:${(lo / hi) * 100}%"><i class="${v < lo ? 'low' : ''}" style="width:${Math.max(Math.min(100, (v / hi) * 100), 2)}%"></i></span>`;
    // A row with a muscle (m) opens that muscle's exercises.
    const line = (name, v, lo, hi, cls = '', note = '', m = '') => `<${m ? `button type="button" data-a="vol-open" data-m="${m}"` : 'div'} class="fresh-row vol ${cls} ${m ? 'vol-btn' : ''}"><span class="fr-name">${name}${note}</span>${bar(v, lo, hi)}<span class="fr-pct"><b>${r(v)}</b> <span class="muted">/ ${lo}–${hi}</span></span></${m ? 'button' : 'div'}>`;
    const rows = GROUPS.map((g) => {
      const tracked = g.muscles.filter((m) => TRACKED_MUSCLES.includes(m));
      if (!tracked.length) return '';
      const t = tracked.map((m) => volumeTarget(rx, m));
      const v = tracked.reduce((x, m) => x + (ws[m] || 0), 0);
      const lo = t.reduce((x, y) => x + y[0], 0);
      const hi = t.reduce((x, y) => x + y[1], 0);
      const lowOne = tracked.length > 1 ? tracked.find((m, i) => (ws[m] || 0) < t[i][0] && v >= lo) : null;
      const pm = g.parts && parts[g.parts];
      const sub = [
        ...(g.muscles.length > 1 ? g.muscles.map((m) => (TRACKED_MUSCLES.includes(m)
          ? line(MUSCLES[m], ws[m] || 0, ...volumeTarget(rx, m), 'sub', '', m)
          : `<div class="fresh-row vol sub"><span class="fr-name">${MUSCLES[m]}</span><span></span><span class="fr-pct"><b>${r(ws[m] || 0)}</b></span></div>`)) : []),
        ...(pm ? Object.entries(PARTS[g.parts]).map(([k, name]) => {
          const max = Math.max(1, ...Object.values(pm));
          return `<div class="fresh-row vol sub"><span class="fr-name">${name}</span><span class="fr-bar"><i style="width:${Math.max(2, ((pm[k] || 0) / max) * 100)}%"></i></span><span class="fr-pct"><b>${r(pm[k] || 0)}</b></span></div>`;
        }) : []),
      ];
      const note = lowOne ? ` <span class="low-note">${MUSCLES[lowOne]} low</span>` : '';
      if (!sub.length) return line(g.name, v, lo, hi, '', note, g.muscles[0]);
      const head = line(g.name, v, lo, hi, '', note);
      return `<details class="vol-group"><summary>${head}</summary>${sub.join('')}${pm ? '<p class="muted small sub-note">Estimated from which exercises you did.</p>' : ''}<button class="text-btn small-text vol-more" data-a="vol-open" data-g="${g.id}">Exercises for ${g.name.toLowerCase()}</button></details>`;
    }).join('');
    return `<div class="card"><div class="row between"><h3>Sets this week</h3><button class="help-btn" data-a="help" aria-expanded="false" aria-label="What is this?">?</button></div>
      <p class="help-text" hidden>Hard sets this week so far, counting half for assisting muscles, against your weekly target${db.profile ? '' : ' (default 10–20 per muscle)'}. The tick marks the low end. Tap a row with an arrow to see the muscles or parts inside it. ${ctx.refChips(['pelland2026', 'schoenfeld2017vol'])}</p>${rows}</div>`;
  }

  // ---------- Body: measurements & photos ----------

  // part: 'measure' or 'photos' (both when not given).
  function bodyCards(part = null) {
    const db = ctx.db;
    const list = [...db.measurements].sort((a, b) => b.date.localeCompare(a.date));
    const last = list[0];
    const first = list[list.length - 1];
    const today = list.find((m) => m.date === todayStr()) || {};
    const latest = (k) => list.find((m) => m[k] != null);
    const earliest = (k) => [...list].reverse().find((m) => m[k] != null);
    const delta = (k) => { const a = latest(k); const b = earliest(k); return a && b && a !== b ? a[k] - b[k] : null; };
    const photos = [...db.photos].sort((a, b) => b.date.localeCompare(a.date));
    setTimeout(loadThumbs);
    const changeText = (k) => { const v = delta(k); return v == null ? '' : Math.abs(v) < 0.05 ? 'No change' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace(/0$/, '')} in`; };
    const measure = `<section class="ms-list">${Object.entries(MEASURES).map(([k, v]) => `<label class="ms-row" for="ms-${k}"><span class="mus-i main">${muscleIcon(MEASURE_ICON[k])}</span><span class="grow"><b>${v}</b><small>${changeText(k) || (latest(k) ? `Last ${latest(k)[k]} in` : 'Not logged')}</small></span><input id="ms-${k}" type="text" inputmode="decimal" value="${today[k] ?? ''}" placeholder="${latest(k)?.[k] ?? '—'}" aria-label="${v} in inches"></label>`).join('')}</section>
      <p class="muted small bw-hint">Inches${last && last.date !== todayStr() ? ` · last measured ${ctx.fmtDate(last.date)}` : ''}${list.length > 1 ? ` · changes since ${ctx.fmtDate(first.date)}` : ''}</p>
      <button class="btn primary block" data-a="ms-save">${today.date ? 'Update' : 'Save'} measurements</button>
      ${list.length ? `<details class="ms-history"><summary>History</summary>${list.map((m) => `<div class="hrow" data-swipe="ms-del" data-swipe-label="Delete measurements from ${ctx.fmtDate(m.date)}" data-date="${m.date}"><span>${ctx.fmtDate(m.date)}</span><span class="muted small">${Object.keys(MEASURES).filter((k) => m[k] != null).map((k) => `${MEASURES[k]} ${m[k]}`).join(' · ')}</span></div>`).join('')}</details>` : ''}`;
    const oldest = photos[photos.length - 1]; const newest = photos[0];
    const compare = photos.length >= 2
      ? `<div class="cmp" id="photo-cmp" style="--p:50%"><img data-photo="${newest.id}" alt="Latest photo, ${ctx.fmtDate(newest.date)}"><img class="front" data-photo="${oldest.id}" alt="First photo, ${ctx.fmtDate(oldest.date)}"><i aria-hidden="true"></i><span class="l">${ctx.fmtDate(oldest.date)}</span><span class="r">${ctx.fmtDate(newest.date)}</span></div><input id="photo-cmp-range" type="range" min="0" max="100" value="50" aria-label="Slide between first and latest photo">`
      : `<div class="cmp-empty" aria-hidden="true"><div>First</div><div>Latest</div></div><p class="muted small bw-hint">Add two photos to slide between them.</p>`;
    const photoCard = `${compare}
      <div class="photo-grid">${photos.map((p) => `<button class="photo-thumb" data-a="photo-open" data-id="${p.id}"><img data-photo="${p.id}" alt="Progress photo ${ctx.fmtDate(p.date)}"><span>${ctx.fmtDate(p.date)}</span></button>`).join('')}<label class="photo-add file-btn">+ Add photo<input id="photo-file" type="file" accept="image/*" hidden></label></div>
      <p class="muted small bw-hint">Photos stay on this phone. The same pose and light make them easier to compare.</p>`;
    return part === 'measure' ? measure : part === 'photos' ? photoCard : measure + photoCard;
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
      <p class="small">${esc(g.name)}: ${wt(g.barWeight)} bar · ${wt(smithBar(g))} Smith bar · plates ${g.plates.map(toDisp).join(', ')} · dumbbells every ${wt(g.dbStep)} up to ${toDisp(g.dbMax)} · machines every ${wt(g.machineStep)}${g.unavailable.length ? ` · ${g.unavailable.length} exercises marked unavailable` : ''}</p>
      <button class="btn block" data-a="gym-edit" data-id="${g.id}">Edit ${esc(g.name)}</button>
    </div>`;
  }

  function openGym(id) {
    const db = ctx.db;
    const g = db.gyms.find((x) => x.id === id);
    const chips = (key, opts, cur, multi) => `<div class="chips wrap">${opts.map((v) => {
      const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.001 : a === b);
      const on = multi ? cur.some((c) => same(c, v)) : same(cur, v);
      return `<button class="chip ${on ? 'on' : ''}" data-a="gym-set" data-k="${key}" data-v="${v}" ${multi ? 'data-multi="1"' : ''}>${EQUIP[v] || (typeof v === 'number' ? toDisp(v) : v)}</button>`;
    }).join('')}</div>`;
    ctx.openSheet(`<h2>Edit gym</h2>
      <div class="field"><span>Name</span><input id="gym-name" type="text" value="${esc(g.name)}"></div>
      <div class="field"><span>Equipment</span>${chips('equipment', Object.keys(EQUIP), g.equipment, true)}</div>
      <div class="field"><span>What this gym has ${ctx.helpBtn ? ctx.helpBtn() : ''}</span><p class="help-text" hidden>Tap anything this gym doesn't have. Exercises that need it stop being suggested, and your plan swaps them for the closest thing you can do.</p>
        <div class="gear-groups">${Object.entries(GEAR).map(([gk, grp]) => { const keys = Object.keys(grp.items); const have = keys.filter((k) => !(g.missing || []).includes(k)).length; return `<details class="gear-group" data-id="gear-${gk}"><summary><span class="grow">${grp.name}</span><span class="muted small">${have === keys.length ? 'All' : `${have} of ${keys.length}`}</span></summary>
          <div class="chips wrap">${keys.map((k) => { const on = !(g.missing || []).includes(k); return `<button class="chip ${on ? 'on' : ''}" data-a="gym-gear" data-k="${k}" aria-pressed="${on}">${grp.items[k]}</button>`; }).join('')}</div>
          <div class="row gear-all"><button class="text-btn" data-a="gym-gear-all" data-g="${gk}" data-v="1">Select all</button><button class="text-btn" data-a="gym-gear-all" data-g="${gk}" data-v="0">Select none</button></div></details>`; }).join('')}</div></div>
      <div class="field"><span>Barbell weight (${wUnit()})</span>${chips('barWeight', BAR_CHOICES(), g.barWeight)}</div>
      <div class="field"><span>Smith machine bar (${wUnit()})</span>${chips('smithBar', SMITH_CHOICES(), smithBar(g))}<p class="small muted">Most weigh 15–25 lb. A counterbalanced bar feels lighter; the label on the machine has the number.</p></div>
      <div class="field"><span>Plates available (${wUnit()})</span>${chips('plates', PLATE_CHOICES(), g.plates, true)}</div>
      <div class="grid2">
        <div class="field"><span>Dumbbell jumps (${wUnit()})</span>${chips('dbStep', DB_STEP_CHOICES(), g.dbStep)}</div>
        <div class="field"><span>Machine / stack step (${wUnit()})</span>${chips('machineStep', MACHINE_STEP_CHOICES(), g.machineStep)}</div>
      </div>
      <div class="field"><span>Heaviest dumbbell (${wUnit()})</span><input id="gym-dbmax" type="text" inputmode="numeric" value="${toDisp(g.dbMax)}"></div>
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
      <label class="list-row"><span class="grow">Import from Strong, Hevy or Fitbod<span class="pick-sub">Your workout history from their CSV export</span></span>${chev}<input id="apps-file" type="file" accept=".csv,text/csv" hidden></label>
      <label class="list-row"><span class="grow">Import runs, rides and swims<span class="pick-sub">Strava, Garmin, Runkeeper, Apple Health, or GPX and TCX files</span></span>${chev}<input id="act-file" type="file" accept=".csv,.gpx,.tcx,.xml,text/csv,application/xml,text/xml" multiple hidden></label>
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
        <button class="btn primary block big" data-a="import-decrypt">Unlock and restore</button>
        <button class="btn block" data-a="close-sheet">Cancel</button>`);
      return;
    }
    await finishImport(data);
  }

  async function finishImport(data) {
    const { db: next, photos } = importData(data);
    if (!(await ctx.ask(`Replace all data with this backup (${next.sessions.length} workouts, ${next.foodLog.length} food entries)? A snapshot of your current data is kept.`, 'Replace', true))) return;
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
      db.exPrefs[d.id] = d.v || undefined;
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
      if (!(await ctx.ask('Delete this photo?', 'Delete', true))) return;
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
    'gym-gear': (d) => {
      const g = ctx.db.gyms.find((x) => x.id === ui.gymEdit);
      const miss = new Set(g.missing || []);
      if (miss.has(d.k)) miss.delete(d.k); else miss.add(d.k);
      g.missing = [...miss]; ctx.persist(); ctx.haptic?.(); openGym(g.id);
    },
    'gym-gear-all': (d) => {
      const g = ctx.db.gyms.find((x) => x.id === ui.gymEdit);
      const keys = Object.keys(GEAR[d.g].items);
      const miss = new Set(g.missing || []);
      keys.forEach((k) => (d.v === '1' ? miss.delete(k) : miss.add(k)));
      g.missing = [...miss]; ctx.persist(); openGym(g.id);
    },
    'gym-set': (d, el) => {
      const g = ctx.db.gyms.find((x) => x.id === ui.gymEdit);
      const v = Number.isNaN(+d.v) ? d.v : +d.v;
      if (d.multi) {
        const arr = new Set(g[d.k]);
        const hit = [...arr].find((x) => typeof x === 'number' && typeof v === 'number' ? Math.abs(x - v) < 0.001 : x === v);
        if (hit !== undefined) arr.delete(hit); else arr.add(v);
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
      g.dbMax = fromDisp(ctx.num('gym-dbmax')) || g.dbMax;
      if (!g.plates.length) g.plates = [5];
      ctx.persist(); ctx.closeSheet(); ctx.render();
    },
    'gym-del': async (d) => {
      if (!(await ctx.ask('Delete this gym?', 'Delete', true))) return;
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
        <button class="btn primary block big" data-a="export-enc-go">Encrypt and save</button>
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
      if (!(await ctx.ask('Restore this snapshot? Your current data is snapshotted first.', 'Restore'))) return;
      const next = await readSnapshot(d.key);
      if (ctx.db) await safetySnapshot(ctx.db, 'Before snapshot restore');
      ctx.closeSheet(); ctx.replaceDb(next); ctx.toast('Snapshot restored.');
    },
    'persist-req': async () => {
      const ok = await requestPersistence();
      ctx.toast(ok ? 'Done — the phone will keep this data.' : 'The browser declined. Keep it on your Home Screen and back up regularly.');
      ctx.render();
    },
    'act-unit': (d) => { if (!actImport) return; actImport.unit = d.v; actImportSheet(); },
    'act-paces': (d, el) => { if (actImport) actImport.usePaces = el.checked; },
    'act-import': () => {
      if (!actImport?.plan) return;
      const db = ctx.db;
      safetySnapshot(db, 'Before importing activities');
      const n = applyActivities(db, actImport.plan.fresh);
      const best = actImport.plan.best;
      const ev = db.event;
      let paces = '';
      if (actImport.usePaces && best && ev?.type === 'race') {
        ev.vdotNow = best.vdot; ev.vdotGoal = Math.max(ev.vdotGoal || 0, best.vdot);
        ev.trials = [...(ev.trials || []), { date: best.date, m: Math.round(best.distM), sec: Math.round(best.sec), vdot: Math.round(best.vdot * 10) / 10, imported: true }];
        paces = ' Race paces updated.';
      }
      actImport = null;
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(`Imported ${n} ${n === 1 ? 'activity' : 'activities'}.${paces}`);
    },
    'apps-unit': (d) => { if (!appImport) return; appImport.unit = d.v; appImportSheet(); },
    'apps-import': async () => {
      if (!appImport?.plan) return;
      await safetySnapshot(ctx.db, 'Before importing workouts');
      const n = applyImport(ctx.db, appImport.plan, APP_NAMES[appImport.format]);
      seedFromHistory(ctx.db); // lifts you've done start from your last workout, not a guess
      appImport = null;
      ctx.persist(); ctx.closeSheet(); ctx.render(); ctx.toast(`Imported ${n} workouts.`);
    },
    'reset-all': async () => {
      const signedIn = !!account();
      if (!(await ctx.ask(`Erase ALL data on this device? A snapshot is kept, but export a backup first.${signedIn ? ' This phone is also signed out of your account; the data in your account stays as it is.' : ''}`, 'Erase', true))) return;
      if (!(await ctx.ask('Really erase everything?', 'Erase everything', true))) return;
      await safetySnapshot(ctx.db, 'Before erase');
      // Signed out first, so the erase isn't synced to the account and the other phones.
      if (signedIn) { await signOut(); resetSyncState(); try { localStorage.removeItem('lift.sync.pending'); } catch {} }
      ctx.replaceDb(freshDb());
    },
  };

  // ---------- Import runs, rides and swims ----------
  let actImport = null; // { files: [{ name, format, text }], unit, usePaces }
  // Apple Health's export.xml can be hundreds of MB: read it in pieces and keep only workout records.
  async function readHealthWorkouts(file) {
    const reader = file.stream().getReader();
    const dec = new TextDecoder();
    let buf = ''; const tags = [];
    for (;;) {
      const { value, done } = await reader.read();
      buf += dec.decode(value || new Uint8Array(), { stream: !done });
      let m; const re = /<Workout\s[^>]*?>/g; let last = 0;
      while ((m = re.exec(buf))) { tags.push(m[0]); last = re.lastIndex; }
      const open = buf.lastIndexOf('<Workout ');
      buf = open > last ? buf.slice(open) : buf.slice(-200);
      if (done) break;
    }
    return tags.join('\n');
  }
  function actImportSheet() {
    const db = ctx.db;
    const garmin = actImport.files.some((f) => f.format === 'garmin');
    const list = actImport.files.flatMap((f) => readActivities(f.format, f.text, { unit: actImport.unit, name: f.name }));
    const plan = planActivities(db, list);
    actImport.plan = plan;
    const ev = db.event?.type === 'race' && db.event.sport !== 'bike' ? db.event : null;
    const better = ev && plan.best && (!ev.vdotNow || plan.best.vdot > ev.vdotNow + 0.3);
    if (actImport.usePaces == null) actImport.usePaces = !!better;
    const metric = wUnit() === 'kg';
    const label = { run: 'Runs', bike: 'Rides', swim: 'Swims', walk: 'Walks and hikes', row: 'Rows' };
    ctx.openSheet(`<h2>Import activities</h2>
      <p class="muted small">From ${[...new Set(actImport.files.map((f) => ACTIVITY_SOURCES[f.format]))].join(', ')}.</p>
      <div class="kv-list">
        ${Object.entries(plan.counts).map(([k, n]) => `<div class="kv"><span>${label[k] || k}</span><b>${n}</b></div>`).join('') || '<div class="kv"><span>New activities</span><b>0</b></div>'}
        ${plan.from ? `<div class="kv"><span>Dates</span><b>${monthYear(plan.from)} to ${monthYear(plan.to)}</b></div>` : ''}
        ${plan.skipped ? `<div class="kv"><span>Already logged</span><b>${plan.skipped}</b></div>` : ''}
      </div>
      ${garmin ? `<div class="field"><span>Distances in the Garmin file are in</span><div class="segmented small-seg">${[['mi', 'Miles'], ['km', 'Kilometers']].map(([u, l]) => `<button class="${(actImport.unit || 'mi') === u ? 'on' : ''}" data-a="act-unit" data-v="${u}">${l}</button>`).join('')}</div></div>` : ''}
      ${plan.best ? `<p class="small">Best recent run: ${fmtDist(plan.best.distM, metric)} in ${fmtDur(plan.best.sec)} on ${ctx.fmtDate(plan.best.date)}.</p>` : ''}
      ${better ? `<label class="toggle"><input type="checkbox" data-a="act-paces" ${actImport.usePaces ? 'checked' : ''}><span>Use it to update your race paces<span class="pick-sub">Your plan's paces come from your best recent effort.</span></span></label>` : ''}
      <p class="muted small">Activities go into your cardio log. Race plans count them as done, and calories and recovery include them.</p>
      <button class="btn primary block big" data-a="act-import" ${plan.fresh.length ? '' : 'disabled'}>Import ${plan.fresh.length} ${plan.fresh.length === 1 ? 'activity' : 'activities'}</button>`);
  }

  // ---------- Import from Strong, Hevy or Fitbod ----------
  const APP_NAMES = { strong: 'Strong', hevy: 'Hevy', fitbod: 'FitBod' };
  const monthYear = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  let appImport = null; // { rows, format, unit }
  function appImportSheet() {
    const db = ctx.db;
    const { rows, format } = appImport;
    const unit = appImport.unit || (format === 'strong' ? db.settings.units || 'lb' : null);
    const workouts = readWorkouts(rows, format, unit || 'lb');
    const plan = planImport(db, workouts, format);
    appImport.plan = plan; appImport.unit = unit;
    const src = APP_NAMES[format];
    const first = plan.workouts[0]?.date; const last = plan.workouts[plan.workouts.length - 1]?.date;
    ctx.openSheet(`<h2>Import from ${src}</h2>
      <div class="kv-list">
        <div class="kv"><span>Workouts</span><b>${plan.workouts.length}${first ? ` · ${monthYear(first)} to ${monthYear(last)}` : ''}</b></div>
        <div class="kv"><span>Exercises matched</span><b>${plan.names.length - plan.unmatched.length} of ${plan.names.length}</b></div>
        ${plan.skipped ? `<div class="kv"><span>Already imported</span><b>${plan.skipped}</b></div>` : ''}
        ${plan.overlap ? `<div class="kv"><span>Skipped, day already logged here</span><b>${plan.overlap}</b></div>` : ''}
      </div>
      ${format === 'strong' ? `<div class="field"><span>Weights in the file are in</span><div class="segmented small-seg">${['lb', 'kg'].map((u) => `<button class="${unit === u ? 'on' : ''}" data-a="apps-unit" data-v="${u}">${u === 'lb' ? 'Pounds' : 'Kilograms'}</button>`).join('')}</div><p class="muted small">Strong doesn't say which, so pick what you used there.</p></div>` : ''}
      ${plan.unmatched.length ? `<p class="small">Added as your own exercises: ${ctx.esc(plan.unmatched.slice(0, 8).join(', '))}${plan.unmatched.length > 8 ? ` and ${plan.unmatched.length - 8} more` : ''}.</p>` : ''}
      <p class="muted small">History, charts, records and strength standards include imported workouts. Your plan and targets don't change. A snapshot is kept first.</p>
      <button class="btn primary block big" data-a="apps-import" ${plan.workouts.length ? '' : 'disabled'}>Import ${plan.workouts.length} workouts</button>`);
  }

  async function onChange(e) {
    const el = e.target;
    if (el.id === 'act-file' && el.files.length) {
      try {
        const files = [];
        for (const f of el.files) {
          const head = await f.slice(0, 4000).text();
          const format = detectActivities(f.name, head);
          if (!format) throw new Error(`${f.name} isn't a file this can read. Use Strava's activities.csv, a Garmin Connect or Runkeeper CSV, Apple Health's export.xml, or GPX and TCX files.`);
          files.push({ name: f.name, format, text: format === 'health' ? await readHealthWorkouts(f) : await f.text() });
        }
        actImport = { files, unit: null, usePaces: null };
        actImportSheet();
      } catch (err) { ctx.toast(err.message || 'Could not read that file.'); }
      el.value = '';
      return true;
    }
    if (el.id === 'apps-file' && el.files[0]) {
      try {
        const rows = parseCsv(await el.files[0].text());
        const format = detectFormat(rows);
        if (!format) throw new Error("That file isn't a Strong, Hevy or FitBod export. Export a CSV from the app's settings and try again.");
        appImport = { rows, format, unit: null };
        appImportSheet();
      } catch (err) { ctx.toast(err.message || 'Could not read that file.'); }
      el.value = '';
      return true;
    }
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
