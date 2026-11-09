import { load, save, todayStr, mondayOf, parseDate, daysBetween, exportJson, importJson, exportCsv, download, freshDb } from './store.js';
import { TYPES, ROW_ROTATION, defaultPlan } from './plan.js';
import {
  DAY_KEYS, DAY_NAMES, dayKeyOf, weekInfo, needsRotationPrompt, nextRowCompound, resolveDay,
  targetsFor, getState, painWarning, evaluate, groupNum, e1rm,
} from './engine.js';
import { lineChart } from './chart.js';

let db = load();
const ui = {
  tab: 'today',
  day: defaultDay(),
  deloadOverride: {}, // `${date}:${day}` -> bool, before a session starts
  historyEx: null,
  planDay: 'mon',
  summaryId: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const persist = () => { if (!save(db)) toast('Could not save — storage may be full.'); };
const haptic = (ms = 15) => { try { navigator.vibrate?.(ms); } catch {} };

function defaultDay() {
  return dayKeyOf(todayStr());
}

function fmtW(w, ex) {
  if (w == null) return 'TBD';
  if (ex?.type === 'bodyweight') return w === 0 ? 'BW' : `BW+${w}`;
  return `${w} lb`;
}

function fmtRest(sec) {
  if (!sec) return '';
  if (sec < 120) return `${sec}s`;
  return sec % 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec / 60} min`;
}

function fmtLast(last, ex) {
  if (!last) return '';
  const same = last.weights.every((w) => w === last.weights[0]);
  if (same) return `${last.reps.join(' · ')} @ ${fmtW(last.weights[0], ex)}`;
  return last.reps.map((r, i) => `${r}×${fmtW(last.weights[i], ex).replace(' lb', '')}`).join(', ');
}

function fmtDate(s) {
  return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- Theme ----------

function applyTheme() {
  const t = db.settings.theme;
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#111214' : '#f6f6f4');
}

// ---------- Audio (rest timer) ----------

let audioCtx = null;
function unlockAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const b = audioCtx.createBuffer(1, 1, 22050);
    const s = audioCtx.createBufferSource();
    s.buffer = b;
    s.connect(audioCtx.destination);
    s.start(0);
  } catch {}
}
function beep() {
  if (!db.settings.sound || !audioCtx) return;
  try {
    audioCtx.resume();
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t);
      o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch {}
}

// ---------- Rest timer ----------

const REST_KEY = 'lift.rest';
let rest = null; // { endAt, total, label }
try { rest = JSON.parse(localStorage.getItem(REST_KEY)); } catch {}
let restTick = null;

function startRest(sec, label) {
  if (!sec) return;
  rest = { endAt: Date.now() + sec * 1000, total: sec, label };
  try { localStorage.setItem(REST_KEY, JSON.stringify(rest)); } catch {}
  runRest();
}
function stopRest() {
  rest = null;
  try { localStorage.removeItem(REST_KEY); } catch {}
  clearInterval(restTick);
  renderRest();
}
function adjustRest(sec) {
  if (!rest) return;
  rest.endAt += sec * 1000;
  rest.total = Math.max(1, rest.total + sec);
  try { localStorage.setItem(REST_KEY, JSON.stringify(rest)); } catch {}
  renderRest();
}
function runRest() {
  clearInterval(restTick);
  renderRest();
  restTick = setInterval(() => {
    if (!rest) return clearInterval(restTick);
    if (Date.now() >= rest.endAt) {
      beep();
      haptic([200, 100, 200]);
      toast('Rest over — next set');
      stopRest();
    } else renderRest();
  }, 250);
}
function renderRest() {
  const el = $('#rest');
  if (!rest || Date.now() >= rest.endAt) { el.hidden = true; document.body.classList.remove('resting'); return; }
  const left = Math.ceil((rest.endAt - Date.now()) / 1000);
  el.hidden = false;
  document.body.classList.add('resting');
  $('#rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('#rest-label').textContent = rest.label || 'Rest';
  $('#rest-bar').style.width = `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%`;
}

// ---------- Session ----------

function sessionFor(day) {
  const s = db.activeSession;
  return s && s.day === day ? s : null;
}

function isDeloadFor(day) {
  const s = sessionFor(day);
  if (s) return s.isDeload;
  const k = `${todayStr()}:${day}`;
  if (k in ui.deloadOverride) return ui.deloadOverride[k];
  return weekInfo(db).isDeload;
}

function newSet(weight, reps) {
  return { weight: weight ?? null, reps, rir: null, done: false, pain: false };
}

function makeEntry(item, isDeload) {
  const t = targetsFor(db, item, isDeload);
  return {
    uid: item.uid,
    exerciseId: item.exerciseId,
    group: item.group,
    repMin: item.repMin,
    repMax: item.repMax,
    restSec: item.restSec,
    dropSet: false,
    pain: false,
    painFree: false,
    sets: Array.from({ length: t.sets }, () => newSet(t.weight, t.reps)),
  };
}

// Add entries for exercises added to the plan after the workout started.
function syncSession(session, items) {
  let changed = false;
  for (const item of items) {
    if (session.entries[item.uid]) continue;
    session.entries[item.uid] = makeEntry(item, session.isDeload);
    session.order.push(item.uid);
    changed = true;
  }
  if (changed) persist();
}

function startSession(day) {
  const isDeload = isDeloadFor(day);
  const items = resolveDay(db, day);
  const entries = {};
  for (const item of items) entries[item.uid] = makeEntry(item, isDeload);
  db.activeSession = {
    id: `s${Date.now()}`,
    date: todayStr(),
    day,
    startedAt: Date.now(),
    isDeload,
    order: items.map((i) => i.uid),
    entries,
  };
  persist();
  return db.activeSession;
}

function ensureSession(day) {
  const s = sessionFor(day);
  if (s) return s;
  if (db.activeSession) {
    toast(`Finish or discard the ${DAY_NAMES[db.activeSession.day]} workout first.`);
    return null;
  }
  return startSession(day);
}

// Superset rest: start only once every member of the group has finished this round.
function maybeRest(session, uid, setIndex) {
  const entry = session.entries[uid];
  const g = groupNum(entry.group);
  const members = session.order.map((u) => session.entries[u]).filter((e) => groupNum(e.group) === g);
  const roundDone = members.every((m) => m.pain || setIndex >= m.sets.length || m.sets[setIndex].done);
  if (!roundDone) return;
  const allDone = session.order.every((u) => {
    const e = session.entries[u];
    return e.pain || e.sets.every((s) => s.done);
  });
  if (allDone) { stopRest(); return; }
  const sec = Math.max(...members.map((m) => m.restSec || 0));
  const label = members.length > 1 ? `Rest · superset ${groupNum(entry.group)}, round ${setIndex + 1}` : 'Rest';
  startRest(sec, label);
}

function prefillFollowing(entry, fromIdx) {
  const src = entry.sets[fromIdx];
  const st = getState(db, entry.exerciseId);
  for (let j = fromIdx + 1; j < entry.sets.length; j++) {
    const s = entry.sets[j];
    if (s.done) continue;
    if (entry.dropSet) {
      s.weight = Math.max(0, src.weight - 10 * (j - fromIdx));
      if (st.last?.reps[j]) s.reps = st.last.reps[j];
    } else s.weight = src.weight;
  }
}

function logSet(uid, idx, vals) {
  const session = sessionFor(ui.day);
  const entry = session.entries[uid];
  Object.assign(entry.sets[idx], vals, { done: true });
  prefillFollowing(entry, idx);
  persist();
  haptic();
  maybeRest(session, uid, idx);
  render();
}

function finishWorkout() {
  const s = db.activeSession;
  if (!s) return;
  const results = [];
  const entries = [];
  for (const uid of s.order) {
    const e = s.entries[uid];
    const ex = db.exercises[e.exerciseId];
    const { result, state } = evaluate(db, e, s);
    if (state) db.state[e.exerciseId] = state;
    results.push({ ...result, group: e.group });
    const sets = e.sets.filter((x) => x.done || x.pain).map((x) => {
      const o = { weight: x.weight, reps: x.reps };
      if (x.rir != null) o.rir = x.rir;
      if (x.pain) o.pain = true;
      return o;
    });
    if (sets.length) {
      entries.push({
        uid, exerciseId: e.exerciseId, name: ex.name, group: e.group, repMin: e.repMin, repMax: e.repMax,
        dropSet: e.dropSet || undefined, pain: e.pain || undefined, painFree: e.painFree || undefined,
        excluded: e.pain || s.isDeload || undefined, sets,
      });
    }
  }
  const saved = {
    id: s.id, date: s.date, day: s.day, isDeload: s.isDeload,
    startedAt: s.startedAt, finishedAt: Date.now(), entries, results,
  };
  db.sessions.push(saved);
  db.activeSession = null;
  persist();
  stopRest();
  ui.summaryId = saved.id;
  ui.tab = 'summary';
  render();
}

// ---------- Screens: Today ----------

function dayTabs(current, action, days = DAY_KEYS) {
  const today = defaultDay();
  return `<div class="chips days" role="tablist">${days.map((d) => `
    <button class="chip ${d === current ? 'on' : ''} ${d === today ? 'is-today' : ''}" data-a="${action}" data-day="${d}" role="tab" aria-selected="${d === current}">${DAY_NAMES[d]}</button>`).join('')}</div>`;
}

function screenToday() {
  const day = ui.day;
  const wi = weekInfo(db);
  const session = sessionFor(day);
  const other = db.activeSession && db.activeSession.day !== day ? db.activeSession : null;
  const isDeload = isDeloadFor(day);
  let html = `
    <header class="top">
      <div>
        <h1>${day in db.plan ? `${DAY_NAMES[day]} · ${esc(db.plan[day].name)}` : day === 'sat' ? 'Saturday' : 'Sunday'}</h1>
        <p class="muted small">Week ${wi.week} · ${wi.cyclePos} of ${wi.cycleLen} in block${wi.isDeload ? ' · deload week' : ''}</p>
      </div>
    </header>
    ${dayTabs(day, 'day')}`;

  if (needsRotationPrompt(db)) {
    const nextId = nextRowCompound(db);
    html += `<div class="banner">
      <p><b>Deload done.</b> Rotate Thursday's row compound to <b>${esc(db.exercises[nextId].name)}</b>?</p>
      <div class="row"><button class="btn primary" data-a="rotate-yes">Rotate</button><button class="btn" data-a="rotate-no">Keep current</button></div>
    </div>`;
  }
  if (other) {
    html += `<div class="banner">
      <p>A <b>${DAY_NAMES[other.day]}</b> workout is in progress.</p>
      <div class="row"><button class="btn primary" data-a="day" data-day="${other.day}">Resume</button><button class="btn" data-a="discard">Discard it</button></div>
    </div>`;
  }

  if (day === 'sat') return html + screenYoga();
  if (day === 'sun') return html + `<div class="empty"><div class="big">Rest day</div><p class="muted">Recover. Pick another day above to train anyway.</p></div>`;

  const items = resolveDay(db, day);
  if (session) {
    syncSession(session, items);
    if (session.date !== todayStr()) html += `<div class="banner"><p>This workout was started on <b>${fmtDate(session.date)}</b>. Finish or discard it to start fresh.</p></div>`;
  }
  html += `<div class="row between deload-row">
    <label class="toggle"><input type="checkbox" data-a="deload-toggle" ${isDeload ? 'checked' : ''} ${session ? 'disabled' : ''}><span>Deload session</span></label>
    ${isDeload ? '<span class="muted small">Half the sets · same or ≤10% lighter · RIR 3–4</span>' : ''}
  </div>`;

  // Group consecutive items by superset number.
  const groups = [];
  for (const item of items) {
    const g = groupNum(item.group);
    const last = groups[groups.length - 1];
    if (last && last.g === g) last.items.push(item);
    else groups.push({ g, items: [item] });
  }
  for (const grp of groups) {
    if (grp.items.length > 1) {
      const restSec = Math.max(...grp.items.map((i) => i.restSec || 0));
      html += `<section class="group"><div class="group-label">Superset ${grp.g} · rest ${fmtRest(restSec)} after each round</div>
        ${grp.items.map((i) => exerciseCard(i, session, isDeload, true)).join('')}</section>`;
    } else html += exerciseCard(grp.items[0], session, isDeload, false);
  }

  if (session) {
    html += `<div class="finish-bar">
      <button class="btn primary block" data-a="finish">Finish workout</button>
      <button class="btn ghost block" data-a="discard">Discard workout</button>
    </div>`;
  } else {
    html += `<p class="muted small center pad">Tap a set to log it. The workout starts with your first set.</p>`;
  }
  return html;
}

function exerciseCard(item, session, isDeload, inGroup) {
  const ex = item.ex;
  const t = targetsFor(db, item, isDeload);
  const entry = session?.entries[item.uid];
  const sets = entry ? entry.sets : Array.from({ length: t.sets }, () => newSet(t.weight, t.reps));
  const ended = entry?.pain;
  const allDone = entry && sets.every((s) => s.done);
  const targetLine = [
    `${t.sets} × ${item.repMin}–${item.repMax}`,
    fmtW(t.weight, ex),
    item.restSec && !inGroup ? `rest ${fmtRest(item.restSec)}` : '',
  ].filter(Boolean).join(' · ');
  const aim = t.weight == null
    ? 'First session: pick a working weight to set the baseline.'
    : t.total ? `Aim ${t.reps}+ reps · beat ${t.total - 1} total` : `Aim ${t.reps} reps/set`;

  const flags = [];
  if (t.stalled) flags.push(`<div class="flag warn">⚠ Stalled 3 sessions. Drop a set for a week, or swap to a variation next block.</div>`);
  if (t.painWarning) flags.push(`<div class="flag bad">⚠ 2 pain flags in 2 weeks.${ex.substitute ? ` Consider: ${esc(ex.substitute)}.` : ''}</div>`);
  if (ex.type === 'bodyweight' && t.weight === 0 && t.st.status === 'progressed') flags.push(`<div class="flag good">Top of range hit — try adding 5–10 lb.</div>`);

  const rows = sets.map((s, i) => {
    const disabled = ended && !s.done && !s.pain;
    return `<div class="set ${s.done ? 'done' : ''} ${s.pain ? 'pain' : ''} ${disabled ? 'disabled' : ''}">
      <button class="set-main" data-a="open-set" data-uid="${item.uid}" data-i="${i}" ${disabled ? 'disabled' : ''} aria-label="Edit set ${i + 1}">
        <span class="set-n">${i + 1}</span>
        <span class="set-val">${s.weight == null ? 'TBD' : fmtW(s.weight, ex)} <span class="x">×</span> ${s.reps}</span>
        <span class="set-rir">${s.pain ? 'pain' : s.rir != null ? `RIR ${s.rir}` : ''}</span>
      </button>
      <button class="check" data-a="check" data-uid="${item.uid}" data-i="${i}" ${disabled || s.pain ? 'disabled' : ''} aria-label="${s.done ? 'Undo' : 'Complete'} set ${i + 1}">${s.done ? '✓' : ''}</button>
    </div>`;
  }).join('');

  const controls = [];
  if (!ended) {
    controls.push(`<button class="mini" data-a="add-set" data-uid="${item.uid}">+ Set</button>`);
    if (sets.length > 1) controls.push(`<button class="mini" data-a="remove-set" data-uid="${item.uid}">− Set</button>`);
    if (ex.rules?.dropSet) controls.push(`<label class="mini toggle"><input type="checkbox" data-a="dropset" data-uid="${item.uid}" ${entry?.dropSet ? 'checked' : ''}><span>Drop sets</span></label>`);
  }
  const rehab = ex.rules?.rehab && !ended ? `<label class="toggle painfree ${allDone ? 'attn' : ''}"><input type="checkbox" data-a="painfree" data-uid="${item.uid}" ${entry?.painFree ? 'checked' : ''}><span>Pain-free today (needed to go up)</span></label>` : '';

  return `<article class="card ex ${allDone ? 'complete' : ''} ${ended ? 'ended' : ''}">
    <div class="ex-head">
      <span class="tag">${esc(item.group)}</span>
      <div class="grow">
        <h3>${esc(ex.name)}</h3>
        <p class="sub">${targetLine}</p>
      </div>
    </div>
    <p class="aim">${aim}${t.rir ? ` · RIR ${t.rir}` : ''}</p>
    ${t.st.last ? `<p class="muted small">Last: ${fmtLast(t.st.last, ex)}</p>` : ''}
    ${item.note || ex.notes ? `<p class="note">${esc([item.note, ex.notes].filter(Boolean).join(' · '))}</p>` : ''}
    ${flags.join('')}
    ${ended ? `<div class="flag bad">Stopped for pain — not counted toward progression.${ex.substitute ? ` Substitute: <b>${esc(ex.substitute)}</b>` : ''}</div>` : ''}
    <div class="sets">${rows}</div>
    ${controls.length ? `<div class="row wrap controls">${controls.join('')}</div>` : ''}
    ${rehab}
  </article>`;
}

function screenYoga() {
  const recent = db.activities.filter((a) => a.type === 'yoga').slice(-5).reverse();
  const todays = db.activities.find((a) => a.date === todayStr() && a.type === 'yoga');
  return `<div class="card">
    <h3>Yoga / breathwork <span class="muted small">(optional)</span></h3>
    <div class="field"><span>Minutes</span>${stepper('yoga-min', todays?.minutes ?? 30, 5)}</div>
    <div class="field"><span>Note</span><input id="yoga-note" type="text" value="${esc(todays?.note || '')}" placeholder="e.g. mobility flow"></div>
    <button class="btn primary block" data-a="yoga-save">${todays ? 'Update' : 'Log'} session</button>
  </div>
  ${recent.length ? `<div class="card"><h3>Recent</h3>${recent.map((a) => `<p class="small">${fmtDate(a.date)} · ${a.minutes} min${a.note ? ` · ${esc(a.note)}` : ''}</p>`).join('')}</div>` : ''}`;
}

function stepper(id, value, step, opts = {}) {
  return `<div class="stepper">
    <button class="step" data-a="step" data-for="${id}" data-step="${-step}" aria-label="Decrease">−</button>
    <input id="${id}" type="text" inputmode="decimal" value="${value ?? ''}" ${opts.placeholder ? `placeholder="${opts.placeholder}"` : ''}>
    <button class="step" data-a="step" data-for="${id}" data-step="${step}" aria-label="Increase">+</button>
  </div>`;
}

// ---------- Set sheet ----------

function openSetSheet(uid, idx) {
  const existed = !!sessionFor(ui.day);
  const session = sessionFor(ui.day) || ensureSession(ui.day);
  if (!session) return;
  if (!existed) render();
  const entry = session.entries[uid];
  if (!entry) return;
  if (idx >= entry.sets.length) return;
  const ex = db.exercises[entry.exerciseId];
  const s = entry.sets[idx];
  const step = ex.type === 'dumbbell' || ex.increment >= 5 ? 5 : ex.increment || 5;
  const weightLabel = ex.type === 'bodyweight' ? 'Added load (lb, 0 = bodyweight)' : ex.type === 'dumbbell' ? 'Weight per DB (lb)' : 'Weight (lb)';
  openSheet(`
    <h2>${esc(ex.name)}</h2>
    <p class="muted small">Set ${idx + 1} of ${entry.sets.length} · range ${entry.repMin}–${entry.repMax}</p>
    <div class="field"><span>${weightLabel}</span>${stepper('f-weight', s.weight, step)}</div>
    <div class="field"><span>Reps</span>${stepper('f-reps', s.reps, 1)}</div>
    <div class="field"><span>RIR <span class="muted">(reps in reserve, optional)</span></span>
      <div class="chips rir">${['–', 0, 1, 2, 3, 4, 5].map((r) => `<button class="chip ${(r === '–' ? s.rir == null : s.rir === r) ? 'on' : ''}" data-a="rir" data-v="${r}">${r}</button>`).join('')}</div>
    </div>
    <button class="btn primary block big" data-a="save-set" data-uid="${uid}" data-i="${idx}">${s.done ? 'Update set' : 'Done ✓'}</button>
    <div class="row">
      <button class="btn danger grow" data-a="pain" data-uid="${uid}" data-i="${idx}">Pain — stop exercise</button>
      ${s.done ? `<button class="btn grow" data-a="undo-set" data-uid="${uid}" data-i="${idx}">Mark not done</button>` : `<button class="btn grow" data-a="close-sheet">Cancel</button>`}
    </div>`);
  sheetState.rir = s.rir;
}

const sheetState = { rir: null };

function openSheet(html) {
  const sh = $('#sheet');
  $('#sheet-body').innerHTML = html;
  sh.hidden = false;
  requestAnimationFrame(() => sh.classList.add('open'));
}
function closeSheet() {
  const sh = $('#sheet');
  sh.classList.remove('open');
  setTimeout(() => { sh.hidden = true; $('#sheet-body').innerHTML = ''; }, 180);
}

const num = (id) => {
  const v = parseFloat(String($(`#${id}`)?.value ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

// ---------- Summary ----------

const STATUS = {
  progressed: ['↑', 'Progressed', 'good'],
  held: ['→', 'Hold', ''],
  missed: ['•', 'Missed range', 'warn'],
  reduced: ['↓', 'Reduced', 'warn'],
  pain: ['✕', 'Pain', 'bad'],
  deload: ['~', 'Deload', ''],
  skipped: ['–', 'Skipped', 'muted'],
};

function screenSummary() {
  const s = db.sessions.find((x) => x.id === ui.summaryId);
  if (!s) { ui.tab = 'today'; return screenToday(); }
  const mins = Math.round((s.finishedAt - s.startedAt) / 60000);
  const sets = s.entries.reduce((a, e) => a + e.sets.filter((x) => !x.pain).length, 0);
  const vol = s.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.pain ? 0 : x.weight * x.reps), 0), 0);
  const res = s.results.filter((r) => r.status !== 'skipped');
  const progressed = res.filter((r) => r.status === 'progressed');
  const stalled = res.filter((r) => r.stalled || r.status === 'missed' || r.status === 'reduced');
  const row = (r) => {
    const [icon, label, cls] = STATUS[r.status];
    const ex = db.exercises[r.exerciseId];
    return `<div class="result ${cls}">
      <span class="r-icon" aria-hidden="true">${icon}</span>
      <div class="grow"><b>${esc(r.name)}</b> <span class="pill ${cls}">${label}${r.stalled ? ' · stalled' : ''}</span>
        <p class="small muted">${esc(r.message)}</p>
        ${r.next ? `<p class="small">Next: <b>${fmtW(r.next.weight, ex)}</b> × ${r.next.reps}${r.next.total ? ` · beat ${r.next.total - 1} total` : ''}</p>` : ''}
      </div></div>`;
  };
  return `<header class="top"><div><h1>Workout done</h1><p class="muted small">${fmtDate(s.date)} · ${DAY_NAMES[s.day]} · ${esc(db.plan[s.day]?.name || '')}${s.isDeload ? ' · deload' : ''}</p></div></header>
    <div class="stats">
      <div class="stat"><b>${mins}</b><span>min</span></div>
      <div class="stat"><b>${sets}</b><span>sets</span></div>
      <div class="stat"><b>${Math.round(vol).toLocaleString()}</b><span>lb volume</span></div>
    </div>
    ${s.isDeload ? '<p class="muted small pad">Deload sessions don\'t change targets.</p>' : `
    <div class="card"><h3>Progressed (${progressed.length})</h3>${progressed.length ? progressed.map(row).join('') : '<p class="muted small">None this time.</p>'}</div>
    ${stalled.length ? `<div class="card"><h3>Stalled or missed (${stalled.length})</h3>${stalled.map(row).join('')}</div>` : ''}`}
    <div class="card"><h3>Next session targets</h3>${res.filter((r) => !progressed.includes(r) && !stalled.includes(r)).map(row).join('') || '<p class="muted small">See above.</p>'}</div>
    <button class="btn primary block" data-a="tab" data-tab="today">Done</button>`;
}

// ---------- History ----------

function exerciseHistory(exId) {
  const out = [];
  for (const s of db.sessions) {
    for (const e of s.entries) {
      if (e.exerciseId !== exId) continue;
      const good = e.sets.filter((x) => !x.pain && x.reps > 0);
      if (!good.length) continue;
      const top = good.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
      out.push({
        date: s.date, isDeload: s.isDeload, excluded: e.excluded, sets: e.sets,
        top, best1rm: Math.max(...good.map((x) => e1rm(x.weight, x.reps))),
        totalReps: good.reduce((a, x) => a + x.reps, 0),
      });
    }
  }
  return out;
}

function screenHistory() {
  if (ui.historyEx) return screenExerciseHistory(ui.historyEx);
  const seen = new Map();
  for (const s of [...db.sessions].reverse()) for (const e of s.entries) if (!seen.has(e.exerciseId)) seen.set(e.exerciseId, s.date);
  const recent = [...db.sessions].reverse().slice(0, 8);
  return `<header class="top"><h1>History</h1></header>
    ${!db.sessions.length ? '<div class="empty"><div class="big">No workouts yet</div><p class="muted">Finished workouts show up here.</p></div>' : ''}
    ${recent.length ? `<div class="card"><h3>Recent workouts</h3>${recent.map((s) => `
      <button class="list-row" data-a="summary" data-id="${s.id}">
        <span class="grow"><b>${fmtDate(s.date)}</b> · ${DAY_NAMES[s.day]} ${esc(db.plan[s.day]?.name || '')}${s.isDeload ? ' · deload' : ''}</span>
        <span class="muted small">${s.results.filter((r) => r.status === 'progressed').length}↑</span><span class="chev">›</span>
      </button>`).join('')}</div>` : ''}
    ${seen.size ? `<div class="card"><h3>By exercise</h3>${[...seen.entries()].map(([id, date]) => `
      <button class="list-row" data-a="history-ex" data-id="${id}">
        <span class="grow">${esc(db.exercises[id]?.name || id)}</span><span class="muted small">${fmtDate(date)}</span><span class="chev">›</span>
      </button>`).join('')}</div>` : ''}`;
}

function screenExerciseHistory(exId) {
  const ex = db.exercises[exId];
  const hist = exerciseHistory(exId);
  const bw = ex.type === 'bodyweight' && hist.every((h) => h.top.weight === 0);
  const rows = [...hist].reverse().map((h) => `
    <div class="hist-row">
      <div class="row between"><b>${fmtDate(h.date)}</b><span class="muted small">${h.isDeload ? 'deload' : h.excluded ? 'not counted' : bw ? `${h.totalReps} reps` : `e1RM ${Math.round(h.best1rm)}`}</span></div>
      <p class="small">${h.sets.map((x) => `${fmtW(x.weight, ex).replace(' lb', '')}×${x.reps}${x.rir != null ? ` @${x.rir}` : ''}${x.pain ? ' (pain)' : ''}`).join(', ')}</p>
    </div>`).join('');
  setTimeout(() => {
    const el = $('#hist-chart');
    if (!el) return;
    const pts = hist.filter((h) => !h.isDeload && !h.excluded);
    if (bw) lineChart(el, { points: pts.map((h) => ({ x: h.date, values: [h.totalReps] })), series: [{ name: 'Total reps', cls: 's1' }], unit: 'reps' });
    else lineChart(el, { points: pts.map((h) => ({ x: h.date, values: [Math.round(h.best1rm), h.top.weight] })), series: [{ name: 'Est. 1RM', cls: 's1' }, { name: 'Top-set weight', cls: 's2' }] });
  });
  return `<header class="top"><button class="back" data-a="history-back" aria-label="Back">‹</button><div><h1>${esc(ex.name)}</h1><p class="muted small">${bw ? 'Total reps per session' : 'Est. 1RM (Epley) and top-set weight'}</p></div></header>
    <div class="card"><div id="hist-chart"></div></div>
    <div class="card"><h3>Sessions</h3>${rows || '<p class="muted small">No sessions yet.</p>'}</div>`;
}

// ---------- Bodyweight ----------

function bwStats() {
  const list = [...db.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();
  const avg = (from, to) => {
    const xs = list.filter((b) => { const d = daysBetween(b.date, today); return d >= from && d <= to; });
    return xs.length ? xs.reduce((a, b) => a + b.weight, 0) / xs.length : null;
  };
  return { list, avg7: avg(0, 6), prev7: avg(7, 13) };
}

function screenBody() {
  const { list, avg7, prev7 } = bwStats();
  const todays = list.find((b) => b.date === todayStr());
  const last = list[list.length - 1];
  let rate = '';
  if (avg7 && prev7) {
    const pct = ((avg7 - prev7) / prev7) * 100;
    const verdict = pct < 0.25 ? 'below target — eat a bit more' : pct > 0.5 ? 'above target — ease off slightly' : 'on target';
    rate = `<p class="small">Weekly change: <b>${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</b> (${(avg7 - prev7 >= 0 ? '+' : '')}${(avg7 - prev7).toFixed(1)} lb) · ${verdict}</p>`;
  }
  const target = avg7 ? `<p class="muted small">Bulk target: +${(avg7 * 0.0025).toFixed(1)} to +${(avg7 * 0.005).toFixed(1)} lb/week (0.25–0.5%)</p>` : '';
  // 7-day rolling average per entry for the chart.
  const pts = list.slice(-60).map((b) => {
    const win = list.filter((x) => { const d = daysBetween(x.date, b.date); return d >= 0 && d <= 6; });
    return { x: b.date, values: [b.weight, win.reduce((a, x) => a + x.weight, 0) / win.length] };
  });
  setTimeout(() => { const el = $('#bw-chart'); if (el && pts.length) lineChart(el, { points: pts, series: [{ name: 'Weigh-in', cls: 's2' }, { name: '7-day average', cls: 's1' }] }); });
  return `<header class="top"><h1>Bodyweight</h1></header>
    <div class="card">
      <div class="field"><span>Today's weigh-in (lb)</span>${stepper('bw-input', todays?.weight ?? last?.weight ?? '', 0.2, { placeholder: 'e.g. 185.4' })}</div>
      <button class="btn primary block" data-a="bw-save">${todays ? 'Update' : 'Save'} weigh-in</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${avg7 ? avg7.toFixed(1) : '—'}</b><span>7-day avg</span></div>
      <div class="stat"><b>${prev7 ? prev7.toFixed(1) : '—'}</b><span>prior 7 days</span></div>
    </div>
    ${rate || target ? `<div class="card">${rate}${target}</div>` : ''}
    ${pts.length > 1 ? '<div class="card"><div id="bw-chart"></div></div>' : ''}
    ${list.length ? `<div class="card"><h3>Entries</h3>${[...list].reverse().slice(0, 30).map((b) => `
      <div class="list-row"><span class="grow">${fmtDate(b.date)}</span><b>${b.weight}</b><button class="mini" data-a="bw-del" data-date="${b.date}" aria-label="Delete">✕</button></div>`).join('')}</div>` : ''}`;
}

// ---------- Nutrition ----------

function screenFood() {
  return `<header class="top"><h1>Nutrition</h1></header>
    <div class="empty"><div class="big">Coming later</div>
    <p class="muted">Daily calories, protein, carbs, fat and notes will live here. Your data model is already set up for it.</p></div>`;
}

// ---------- Plan editor ----------

function screenPlan() {
  const day = ui.planDay;
  const plan = db.plan[day];
  const items = plan.items;
  return `<header class="top"><h1>Plan</h1></header>
    ${dayTabs(day, 'plan-day', ['mon', 'tue', 'wed', 'thu', 'fri'])}
    <div class="field inline"><span>Day name</span><input id="plan-name" type="text" value="${esc(plan.name)}" data-a="plan-name"></div>
    ${items.map((it, i) => {
      const ex = db.exercises[it.exerciseId];
      const st = getState(db, it.exerciseId);
      const rot = it.role === 'rowCompound' ? ' · rotates each block' : it.role === 'rowAccessory' ? ' · follows rotation' : '';
      return `<div class="card plan-item">
        <div class="ex-head"><span class="tag">${esc(it.group)}</span>
          <div class="grow"><h3>${esc(ex?.name || it.exerciseId)}</h3>
          <p class="sub">${it.sets} × ${it.repMin}–${it.repMax}${it.restSec ? ` · rest ${fmtRest(it.restSec)}` : ''} · ${fmtW(st.targetWeight, ex)} · +${ex?.increment} lb${rot}</p></div>
        </div>
        <div class="row controls">
          <button class="mini" data-a="plan-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="mini" data-a="plan-down" data-i="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="mini grow" data-a="plan-edit" data-i="${i}">Edit / swap</button>
          <button class="mini danger" data-a="plan-del" data-i="${i}" aria-label="Remove">✕</button>
        </div>
      </div>`;
    }).join('')}
    <button class="btn block" data-a="plan-add">+ Add exercise</button>
    <p class="muted small pad">Swapping keeps each exercise's history. Rest on the first exercise of a superset is ignored — the group rests after the round.</p>`;
}

function openPlanEdit(i) {
  const day = ui.planDay;
  const isNew = i === -1;
  const it = isNew ? { group: String(db.plan[day].items.length + 1), exerciseId: '', sets: 3, repMin: 8, repMax: 12, restSec: 90, note: '' } : db.plan[day].items[i];
  const ex = db.exercises[it.exerciseId] || { type: 'machine', increment: 5, substitute: '', notes: '', minRir: 0, rules: {} };
  const st = it.exerciseId ? getState(db, it.exerciseId) : { targetWeight: null };
  const opts = Object.values(db.exercises).sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => `<option value="${e.id}" ${e.id === it.exerciseId ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  openSheet(`
    <h2>${isNew ? 'Add exercise' : 'Edit slot'}</h2>
    ${it.role ? `<p class="muted small">This slot rotates: ${ROW_ROTATION.map((id) => esc(db.exercises[id].name)).join(' → ')}. Choosing a different exercise stops the rotation.</p>` : ''}
    <div class="field"><span>Exercise</span>
      <select id="pe-ex" data-a="pe-ex"><option value="__new" ${isNew ? 'selected' : ''}>+ New exercise…</option>${opts}</select></div>
    <div class="field" id="pe-new" ${isNew ? '' : 'hidden'}><span>New exercise name</span><input id="pe-name" type="text" placeholder="e.g. Cable row (wide grip)"></div>
    <div class="grid2">
      <div class="field"><span>Group</span><input id="pe-group" type="text" value="${esc(it.group)}" placeholder="3a"></div>
      <div class="field"><span>Sets</span><input id="pe-sets" type="text" inputmode="numeric" value="${it.sets}"></div>
      <div class="field"><span>Rep min</span><input id="pe-min" type="text" inputmode="numeric" value="${it.repMin}"></div>
      <div class="field"><span>Rep max</span><input id="pe-max" type="text" inputmode="numeric" value="${it.repMax}"></div>
      <div class="field"><span>Rest (sec)</span><input id="pe-rest" type="text" inputmode="numeric" value="${it.restSec}"></div>
    </div>
    <div class="field"><span>Slot note (this day only)</span><input id="pe-note" type="text" value="${esc(it.note || '')}"></div>
    <h3 class="sect">Exercise settings <span class="muted small">(all days)</span></h3>
    <div class="grid2">
      <div class="field"><span>Type</span><select id="pe-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === ex.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><span>Increment (lb)</span><input id="pe-inc" type="text" inputmode="decimal" value="${ex.increment}"></div>
      <div class="field"><span>Target weight</span><input id="pe-weight" type="text" inputmode="decimal" value="${st.targetWeight ?? ''}" placeholder="TBD"></div>
      <div class="field"><span>Min RIR to progress</span><input id="pe-rir" type="text" inputmode="numeric" value="${ex.minRir || 0}"></div>
    </div>
    <div class="field"><span>Substitute (shown on pain)</span><input id="pe-sub" type="text" value="${esc(ex.substitute)}"></div>
    <div class="field"><span>Notes</span><input id="pe-notes" type="text" value="${esc(ex.notes)}"></div>
    <label class="toggle"><input id="pe-drop" type="checkbox" ${ex.rules?.dropSet ? 'checked' : ''}><span>Allow drop-set mode</span></label>
    <label class="toggle"><input id="pe-rehab" type="checkbox" ${ex.rules?.rehab ? 'checked' : ''}><span>Rehab rule (go up only when pain-free)</span></label>
    <button class="btn primary block big" data-a="pe-save" data-i="${i}">Save</button>
    <button class="btn block" data-a="close-sheet">Cancel</button>`);
}

function savePlanEdit(i) {
  const day = ui.planDay;
  const items = db.plan[day].items;
  let exId = $('#pe-ex').value;
  const type = $('#pe-type').value;
  if (exId === '__new') {
    const name = $('#pe-name').value.trim();
    if (!name) return toast('Enter a name for the new exercise.');
    exId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise';
    while (db.exercises[exId]) exId += '-2';
    db.exercises[exId] = { id: exId, name, type, increment: db.settings.defaultIncrements[type] || 5, substitute: '', notes: '', minRir: 0, rules: {}, startWeight: null };
  }
  const ex = db.exercises[exId];
  const intOr = (id, d) => { const v = parseInt($(`#${id}`).value, 10); return Number.isFinite(v) ? v : d; };
  const repMin = Math.max(1, intOr('pe-min', 8));
  const repMax = Math.max(repMin, intOr('pe-max', 12));
  const slot = {
    group: $('#pe-group').value.trim() || String(items.length + 1),
    sets: Math.max(1, intOr('pe-sets', 3)),
    repMin, repMax,
    restSec: Math.max(0, intOr('pe-rest', 90)),
    note: $('#pe-note').value.trim(),
  };
  if (i === -1) items.push({ uid: `${day}-${Date.now()}`, exerciseId: exId, ...slot });
  else {
    const it = items[i];
    // Changing the exercise on a rotating slot turns the rotation off for that slot.
    const resolved = resolveDay(db, day).find((r) => r.uid === it.uid);
    if (it.role && resolved && resolved.exerciseId !== exId) delete it.role;
    if (!it.role) it.exerciseId = exId;
    Object.assign(it, slot);
  }
  ex.type = type;
  ex.increment = num('pe-inc') || ex.increment;
  ex.minRir = Math.max(0, intOr('pe-rir', 0));
  ex.substitute = $('#pe-sub').value.trim();
  ex.notes = $('#pe-notes').value.trim();
  ex.rules = { ...ex.rules, dropSet: $('#pe-drop').checked, rehab: $('#pe-rehab').checked };
  const w = num('pe-weight');
  const st = db.state[exId] || {};
  st.targetWeight = w;
  db.state[exId] = st;
  persist();
  closeSheet();
  render();
}

// ---------- Settings ----------

function screenSettings() {
  const s = db.settings;
  const wi = weekInfo(db);
  return `<header class="top"><h1>Settings</h1></header>
    <div class="card">
      <h3>Appearance</h3>
      <div class="chips">${['dark', 'light', 'system'].map((t) => `<button class="chip ${s.theme === t ? 'on' : ''}" data-a="theme" data-v="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" data-a="sound" ${s.sound ? 'checked' : ''}><span>Beep when rest ends</span></label>
    </div>
    <div class="card">
      <h3>Program</h3>
      <div class="field"><span>Deload every</span><div class="chips">${[4, 5].map((n) => `<button class="chip ${s.deloadEvery === n ? 'on' : ''}" data-a="deload-every" data-v="${n}">${n} weeks</button>`).join('')}</div></div>
      <div class="field"><span>Current week of program</span>${stepper('set-week', wi.week, 1)}</div>
      <button class="btn block" data-a="set-week">Set week</button>
      <p class="muted small">This week is ${wi.cyclePos} of ${wi.cycleLen} in the block${wi.isDeload ? ' (deload)' : ''}.</p>
      <div class="field"><span>Thursday row compound</span><p>${esc(db.exercises[ROW_ROTATION[s.rowRotation % 3]].name)} <button class="mini" data-a="rotate-yes">Rotate now</button></p></div>
      <label class="toggle"><input type="checkbox" data-a="race" ${s.raceBlock ? 'checked' : ''}><span>Race block</span></label>
      <p class="muted small">Race block: Monday's iso row becomes deadlift, Friday's deadlift becomes RDL (8–12), glute ham raises are hidden.</p>
    </div>
    <div class="card">
      <h3>Default increments <span class="muted small">(for new exercises)</span></h3>
      <div class="grid2">${Object.entries(TYPES).map(([k, v]) => `<div class="field"><span>${v}</span><input type="text" inputmode="decimal" data-a="def-inc" data-k="${k}" value="${s.defaultIncrements[k]}"></div>`).join('')}</div>
      <button class="btn block" data-a="apply-inc">Apply to all existing exercises</button>
      <p class="muted small">Units: pounds.</p>
    </div>
    <div class="card">
      <h3>Backup</h3>
      <p class="muted small">Data lives only on this phone, and iOS can clear it. Export a backup now and then.</p>
      <button class="btn block" data-a="export-json">Export backup (JSON)</button>
      <button class="btn block" data-a="export-csv">Export history (CSV)</button>
      <button class="btn block" data-a="import">Import backup…</button>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </div>
    <div class="card">
      <h3>Reset</h3>
      <button class="btn block" data-a="reset-plan">Restore default plan</button>
      <button class="btn danger block" data-a="reset-all">Erase all data</button>
    </div>
    <p class="muted small center pad">Lift Tracker · ${db.sessions.length} workouts logged</p>`;
}

// ---------- Render ----------

const TABS = [
  ['today', 'Today', '<path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/>'],
  ['history', 'History', '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>'],
  ['body', 'Body', '<path d="M5 20h14l-1.5-13h-11zM9 7a3 3 0 0 1 6 0"/>'],
  ['plan', 'Plan', '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'],
  ['food', 'Food', '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>'],
  ['settings', 'Settings', '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/>'],
];

function render() {
  const screens = { today: screenToday, summary: screenSummary, history: screenHistory, body: screenBody, food: screenFood, plan: screenPlan, settings: screenSettings };
  $('#main').innerHTML = (screens[ui.tab] || screenToday)();
  const active = ui.tab === 'summary' ? 'today' : ui.tab;
  $('#tabs').innerHTML = TABS.map(([k, label, icon]) => `
    <button class="tab ${k === active ? 'on' : ''}" data-a="tab" data-tab="${k}" aria-current="${k === active ? 'page' : 'false'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span>
    </button>`).join('');
  renderRest();
}

// ---------- Events ----------

const actions = {
  tab: (d) => { if (!$('#sheet').hidden) closeSheet(); ui.tab = d.tab; if (d.tab === 'today') ui.summaryId = null; if (d.tab === 'history') ui.historyEx = null; window.scrollTo(0, 0); render(); },
  day: (d) => { ui.day = d.day; ui.tab = 'today'; render(); },
  'open-set': (d) => openSetSheet(d.uid, +d.i),
  check: (d) => {
    const session = sessionFor(ui.day) || ensureSession(ui.day);
    if (!session) return;
    const s = session.entries[d.uid].sets[+d.i];
    if (s.done) { s.done = false; persist(); render(); return; }
    if (s.weight == null || !s.reps) return openSetSheet(d.uid, +d.i);
    logSet(d.uid, +d.i, {});
  },
  rir: (d, el) => {
    sheetState.rir = d.v === '–' ? null : +d.v;
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  step: (d) => {
    const input = $(`#${d.for}`);
    const cur = parseFloat(input.value) || 0;
    const step = parseFloat(d.step);
    const v = Math.max(0, Math.round((cur + step) * 10) / 10);
    input.value = v;
  },
  'save-set': (d) => {
    const weight = num('f-weight');
    const reps = num('f-reps');
    if (weight == null || !reps) return toast('Enter weight and reps.');
    closeSheet();
    logSet(d.uid, +d.i, { weight, reps: Math.round(reps), rir: sheetState.rir });
  },
  'undo-set': (d) => {
    const s = sessionFor(ui.day).entries[d.uid].sets[+d.i];
    s.done = false;
    persist(); closeSheet(); render();
  },
  pain: (d) => {
    const session = sessionFor(ui.day);
    const entry = session.entries[d.uid];
    const ex = db.exercises[entry.exerciseId];
    const s = entry.sets[+d.i];
    s.pain = true;
    s.weight = num('f-weight') ?? s.weight;
    s.reps = Math.round(num('f-reps') ?? s.reps);
    entry.pain = true;
    persist(); closeSheet(); stopRest(); render();
    toast(ex.substitute ? `Stopped. Substitute: ${ex.substitute}` : 'Stopped for today. Not counted toward progression.');
  },
  'close-sheet': () => closeSheet(),
  'add-set': (d) => {
    const session = ensureSession(ui.day);
    if (!session) return;
    const e = session.entries[d.uid];
    const last = e.sets[e.sets.length - 1];
    e.sets.push(newSet(e.dropSet ? Math.max(0, last.weight - 10) : last.weight, last.reps));
    persist(); render();
  },
  'remove-set': (d) => {
    const session = ensureSession(ui.day);
    if (!session) return;
    const e = session.entries[d.uid];
    const lastIdx = e.sets.length - 1;
    if (e.sets.length > 1 && !e.sets[lastIdx].done) e.sets.pop();
    else if (e.sets[lastIdx].done) toast('Last set is already logged.');
    persist(); render();
  },
  dropset: (d, el) => {
    const session = ensureSession(ui.day);
    if (!session) { el.checked = !el.checked; return; }
    const e = session.entries[d.uid];
    e.dropSet = el.checked;
    const st = getState(db, e.exerciseId);
    const top = e.sets[0].weight;
    e.sets.forEach((s, j) => {
      if (s.done || j === 0) return;
      s.weight = e.dropSet ? Math.max(0, top - 10 * j) : top;
      if (e.dropSet && st.last?.reps[j]) s.reps = st.last.reps[j];
    });
    persist(); render();
  },
  painfree: (d, el) => {
    const session = ensureSession(ui.day);
    if (!session) { el.checked = false; return; }
    session.entries[d.uid].painFree = el.checked;
    persist();
  },
  'deload-toggle': (d, el) => { ui.deloadOverride[`${todayStr()}:${ui.day}`] = el.checked; render(); },
  finish: () => {
    const s = db.activeSession;
    const open = s.order.reduce((a, u) => a + (s.entries[u].pain ? 0 : s.entries[u].sets.filter((x) => !x.done).length), 0);
    if (open && !confirm(`${open} set${open > 1 ? 's' : ''} not logged. Finish anyway?`)) return;
    finishWorkout();
  },
  discard: () => {
    if (!confirm('Discard this workout? Logged sets will be lost.')) return;
    db.activeSession = null; persist(); stopRest(); render();
  },
  'rotate-yes': () => {
    db.settings.rowRotation = (db.settings.rowRotation + 1) % ROW_ROTATION.length;
    db.settings.rotationPromptWeek = weekInfo(db).week;
    persist(); render();
    toast(`Thursday row compound: ${db.exercises[ROW_ROTATION[db.settings.rowRotation]].name}`);
  },
  'rotate-no': () => { db.settings.rotationPromptWeek = weekInfo(db).week; persist(); render(); },
  'yoga-save': () => {
    const minutes = num('yoga-min') || 0;
    const note = $('#yoga-note').value.trim();
    const date = todayStr();
    db.activities = db.activities.filter((a) => !(a.date === date && a.type === 'yoga'));
    db.activities.push({ date, type: 'yoga', minutes, note });
    persist(); render(); toast('Logged.');
  },
  summary: (d) => { ui.summaryId = d.id; ui.tab = 'summary'; render(); },
  'history-ex': (d) => { ui.historyEx = d.id; window.scrollTo(0, 0); render(); },
  'history-back': () => { ui.historyEx = null; render(); },
  'bw-save': () => {
    const w = num('bw-input');
    if (!w || w < 50 || w > 700) return toast('Enter your weight in lb.');
    const date = todayStr();
    db.bodyweight = db.bodyweight.filter((b) => b.date !== date);
    db.bodyweight.push({ date, weight: Math.round(w * 10) / 10 });
    persist(); render(); toast('Saved.');
  },
  'bw-del': (d) => { db.bodyweight = db.bodyweight.filter((b) => b.date !== d.date); persist(); render(); },
  'plan-day': (d) => { ui.planDay = d.day; render(); },
  'plan-up': (d) => { const it = db.plan[ui.planDay].items; const i = +d.i; [it[i - 1], it[i]] = [it[i], it[i - 1]]; persist(); render(); },
  'plan-down': (d) => { const it = db.plan[ui.planDay].items; const i = +d.i; [it[i + 1], it[i]] = [it[i], it[i + 1]]; persist(); render(); },
  'plan-del': (d) => {
    const it = db.plan[ui.planDay].items;
    const ex = db.exercises[it[+d.i].exerciseId];
    if (!confirm(`Remove ${ex?.name} from ${DAY_NAMES[ui.planDay]}? Its history is kept.`)) return;
    it.splice(+d.i, 1); persist(); render();
  },
  'plan-edit': (d) => openPlanEdit(+d.i),
  'plan-add': () => openPlanEdit(-1),
  'pe-save': (d) => savePlanEdit(+d.i),
  theme: (d) => { db.settings.theme = d.v; persist(); applyTheme(); render(); },
  sound: (d, el) => { db.settings.sound = el.checked; persist(); },
  'deload-every': (d) => { db.settings.deloadEvery = +d.v; persist(); render(); },
  'set-week': () => {
    const w = Math.max(1, Math.round(num('set-week') || 1));
    const d = parseDate(mondayOf(todayStr()));
    d.setDate(d.getDate() - (w - 1) * 7);
    db.settings.programStart = todayStr(d);
    db.settings.rotationPromptWeek = w; // don't prompt just because the week was edited
    persist(); render(); toast(`Now week ${w}.`);
  },
  race: (d, el) => { db.settings.raceBlock = el.checked; persist(); },
  'apply-inc': () => {
    if (!confirm('Set every exercise\'s increment to the default for its type?')) return;
    for (const ex of Object.values(db.exercises)) ex.increment = db.settings.defaultIncrements[ex.type] || ex.increment;
    persist(); toast('Increments updated.');
  },
  'export-json': () => download(`lift-backup-${todayStr()}.json`, exportJson(db), 'application/json'),
  'export-csv': () => download(`lift-history-${todayStr()}.csv`, exportCsv(db), 'text/csv'),
  import: () => $('#import-file').click(),
  'reset-plan': () => {
    if (!confirm('Restore the default plan? History and targets are kept.')) return;
    db.plan = defaultPlan(); persist(); toast('Default plan restored.');
  },
  'reset-all': () => {
    if (!confirm('Erase ALL data on this device? Export a backup first.')) return;
    if (!confirm('Really erase everything?')) return;
    db = freshDb(); stopRest(); persist(); applyTheme(); render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = actions[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const a = el.dataset?.a;
  if (el.id === 'import-file' && el.files[0]) {
    el.files[0].text().then((text) => {
      try {
        const data = importJson(text);
        if (!confirm(`Replace all data with this backup (${data.sessions.length} workouts)?`)) return;
        db = data; persist(); applyTheme(); render(); toast('Backup restored.');
      } catch (err) { toast(err.message || 'Could not read that file.'); }
      el.value = '';
    });
    return;
  }
  if (a === 'pe-ex') { $('#pe-new').hidden = el.value !== '__new'; return; }
  if (a === 'plan-name') { db.plan[ui.planDay].name = el.value.trim() || db.plan[ui.planDay].name; persist(); return; }
  if (a === 'def-inc') { const v = parseFloat(el.value); if (v > 0) { db.settings.defaultIncrements[el.dataset.k] = v; persist(); } return; }
  if (el.type === 'checkbox' && actions[a]) actions[a](el.dataset, el);
});

$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
$('#rest-minus').addEventListener('click', () => adjustRest(-15));
$('#rest-plus').addEventListener('click', () => adjustRest(15));
$('#rest-skip').addEventListener('click', stopRest);
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderRest(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// Ask iOS to keep our storage (helps avoid eviction where supported).
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
}

applyTheme();
render();
if (rest) runRest();
