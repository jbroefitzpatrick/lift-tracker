import { loadDb, save, onSaveError, dailySnapshot, safetySnapshot, requestPersistence, todayStr, mondayOf, parseDate, daysBetween } from './store.js';
import { TYPES, ROW_ROTATION, defaultPlan } from './plan.js';
import {
  DAY_KEYS, DAY_NAMES, dayKeyOf, weekInfo, needsRotationPrompt, nextRowCompound, resolveDay,
  targetsFor, getState, painWarning, evaluate, groupNum, e1rm, roundTo,
} from './engine.js';
import { lineChart } from './chart.js';
import { MUSCLES, CATEGORIES, PATTERNS, similarExercises } from './bank.js';
import { CARDIO, INTENSITY, MODALITIES } from './cardio-bank.js';
import { suggestCardio } from './cardio.js';
import { currentFatigue, freshness, dayMode, MUSCLE_GROUPS } from './fatigue.js';
import {
  GOALS, EXPERIENCE, EQUIPMENT, LIMITS, WEIGHT_GOALS, WEEK_LAYOUT, VOLUME_MUSCLES, defaultProfile, prescription, suggestDays,
  splitOptions, generatePlan, goalWeights, suggestedWeightGoal, volumeTarget, fmtSec,
} from './builder.js';
import { REFS } from './science.js';
import { activeGym, roundToGym, plateText, warmupSets, isAvailable } from './gym.js';
import { detectPRs, applyCheckins } from './records.js';
import { activePhase, PHASE_TYPES, cardioTargetFor, suggestYear } from './year.js';
import { goalFor } from './nutrition.js';
import { weeklySets } from './builder.js';
import { createFood } from './ui-food.js';
import { createYear } from './ui-year.js';
import { createExtras } from './ui-extra.js';

let db = null; // loaded asynchronously at startup (see bottom)
const ui = {
  tab: 'today',
  day: defaultDay(),
  deloadOverride: {}, // `${date}:${day}` -> bool, before a session starts
  historyEx: null,
  planDay: 'mon',
  planView: 'week', // week | year
  summaryId: null,
  editId: null,
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

// ---------- Screen wake lock ----------
// Keeps the screen on during a workout so the rest timer stays visible and can beep.

let wakeLock = null;
async function keepAwake() {
  try {
    if (!db?.activeSession || document.hidden || wakeLock || !navigator.wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}
function releaseAwake() {
  try { wakeLock?.release(); } catch {}
  wakeLock = null;
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
  // Prefill with a weight this gym can actually load.
  const weight = t.weight == null ? null : roundToGym(db.exercises[item.exerciseId], t.weight, activeGym(db));
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
    sets: Array.from({ length: t.sets }, () => newSet(weight, t.reps)),
  };
}

// Add entries for exercises added to the plan after the workout started.
function syncSession(session, items) {
  if (session.freestyle) return;
  let changed = false;
  for (const item of items) {
    if (session.entries[item.uid] || session.removed?.includes(item.uid)) continue;
    session.entries[item.uid] = makeEntry(item, session.isDeload);
    session.order.push(item.uid);
    changed = true;
  }
  if (changed) persist();
}

// A freestyle session starts empty (travel days, unplanned workouts); exercises are added as you go.
function startSession(day, freestyle = false) {
  const isDeload = freestyle ? false : isDeloadFor(day);
  const items = freestyle ? [] : resolveDay(db, day);
  const entries = {};
  for (const item of items) entries[item.uid] = makeEntry(item, isDeload);
  db.activeSession = {
    id: `s${Date.now()}`,
    date: todayStr(),
    day,
    startedAt: Date.now(),
    isDeload,
    freestyle,
    order: items.map((i) => i.uid),
    entries,
  };
  keepAwake();
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

function saveEntrySets(e) {
  return e.sets.filter((x) => x.done || x.pain).map((x) => {
    const o = { weight: x.weight, reps: x.reps };
    if (x.rir != null) o.rir = x.rir;
    if (x.pain) o.pain = true;
    return o;
  });
}

// Whether a muscle this exercise mainly trains is already at the top of its weekly target.
function weeklyCapReached(exId) {
  const rx = db.profile?.rx;
  if (!rx?.weekly) return false;
  const ws = weeklySets(db, db.plan);
  return db.exercises[exId].primary.some((m) => (ws[m] || 0) >= volumeTarget({ weekly: rx.weekly, includePhysique: rx.includePhysique }, m)[1]);
}

function finishWorkout() {
  const s = db.activeSession;
  if (!s) return;
  const finishedAt = Date.now();
  const results = [];
  const entries = [];
  const stateBefore = {}; // lets a later edit of this workout redo the progression math
  const prs = [];
  for (const uid of s.order) {
    const e = s.entries[uid];
    const ex = db.exercises[e.exerciseId];
    if (!(e.exerciseId in stateBefore)) stateBefore[e.exerciseId] = db.state[e.exerciseId] ? JSON.parse(JSON.stringify(db.state[e.exerciseId])) : null;
    if (!s.isDeload) for (const pr of detectPRs(db, { ...e, sets: e.sets.filter((x) => x.done) }, finishedAt)) prs.push({ exerciseId: e.exerciseId, name: ex.name, ...pr });
    const { result, state } = evaluate(db, e, s);
    if (state) db.state[e.exerciseId] = state;
    results.push({ ...result, group: e.group });
    const sets = saveEntrySets(e);
    if (sets.length) {
      entries.push({
        uid, exerciseId: e.exerciseId, name: ex.name, group: e.group, repMin: e.repMin, repMax: e.repMax,
        dropSet: e.dropSet || undefined, pain: e.pain || undefined, painFree: e.painFree || undefined,
        excluded: e.pain || s.isDeload || undefined, sets,
        feedback: e.feedback || undefined, joint: e.joint || undefined, note: e.note || undefined,
      });
    }
  }
  const saved = {
    id: s.id, date: s.date, day: s.day, isDeload: s.isDeload, freestyle: s.freestyle || undefined,
    startedAt: s.startedAt, finishedAt, entries, results, prs, stateBefore,
  };
  saved.adjustments = applyCheckins(db, saved, weeklyCapReached);
  db.sessions.push(saved);
  db.activeSession = null;
  persist();
  stopRest();
  releaseAwake();
  ui.summaryId = saved.id;
  ui.summaryFresh = true;
  ui.tab = 'summary';
  render();
}

// ---------- Screens: Today ----------

function dayTabs(current, action, days = DAY_KEYS) {
  const today = defaultDay();
  return `<div class="chips days" role="tablist">${days.map((d) => `
    <button class="chip ${d === current ? 'on' : ''} ${d === today ? 'is-today' : ''}" data-a="${action}" data-day="${d}" role="tab" aria-selected="${d === current}">${DAY_NAMES[d]}</button>`).join('')}</div>`;
}

// Reps-in-reserve target for this week of the block: starts around 3 and tightens toward the
// lifter's usual effort just before the deload (block-periodized effort).
function rirTarget(wi) {
  if (!db.settings.rampEffort) return null;
  if (wi.isDeload) return null;
  const end = Math.max(0, db.profile?.rx?.rirLo ?? 1);
  const start = Math.max(end + 1, 3);
  const work = Math.max(2, wi.cycleLen - 1);
  const v = Math.round(start - ((start - end) * (wi.cyclePos - 1)) / (work - 1));
  return String(Math.max(end, Math.min(start, v)));
}

function screenToday() {
  const day = ui.day;
  const wi = weekInfo(db);
  const session = sessionFor(day);
  const other = db.activeSession && db.activeSession.day !== day ? db.activeSession : null;
  const isDeload = isDeloadFor(day);
  const mode = dayMode(db, day);
  const ph = activePhase(db);
  const rir = rirTarget(wi);
  const title = session?.freestyle ? `${DAY_NAMES[day]} · Workout`
    : db.plan[day] && (mode === 'lift' || mode === 'both' || session) ? `${DAY_NAMES[day]} · ${esc(db.plan[day].name)}` : FULL_DAY[day];
  let html = `
    <header class="top">
      <div>
        <h1>${title}</h1>
        <p class="muted small">Week ${wi.week} · ${wi.cyclePos} of ${wi.cycleLen} in block${wi.isDeload ? ' · deload week' : ''}${rir ? ` · aim ~${rir} reps in reserve` : ''}</p>
        ${ph ? `<p class="muted small"><span class="dot ${PHASE_TYPES[ph.phase.type].cls}"></span>${PHASE_TYPES[ph.phase.type].label} · week ${ph.weekInPhase} of ${ph.weeks}</p>` : ''}
      </div>
    </header>
    ${dayTabs(day, 'day')}
    <div class="row between mode-line"><span class="mode-pill ${mode}">${MODE_LABELS[mode]} day</span><button class="mini" data-a="edit-day-mode" data-day="${day}">Change</button></div>`;

  if (!db.settings.welcomed) {
    html += `<div class="banner">
      <p><b>Welcome!</b> Build a plan around your goals, experience and schedule — or start with the sample plan below.</p>
      <div class="row"><button class="btn primary" data-a="open-builder">Build my plan</button><button class="btn" data-a="welcome-sample">Use sample plan</button></div>
    </div>`;
  }
  html += extras.backupBanner();
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

  // Cardio-only and rest days (an unfinished workout still shows so it can be finished).
  if (!session && (!db.plan[day] || mode === 'cardio' || mode === 'rest')) {
    if (mode === 'rest') html += '<div class="empty small-empty"><div class="big">Rest day</div><p class="muted">Recover. Light recovery work is optional.</p></div>';
    html += cardioSection(day, mode === 'rest' ? 'Optional recovery' : 'Cardio');
    if (!db.activeSession) html += '<button class="btn block" data-a="start-empty">Start an empty workout</button>';
    return html;
  }

  let items = session?.freestyle ? [] : resolveDay(db, day);
  if (session) {
    syncSession(session, items);
    items = sessionItems(session, items);
    if (session.date !== todayStr()) html += `<div class="banner"><p>This workout was started on <b>${fmtDate(session.date)}</b>. Finish or discard it to start fresh.</p></div>`;
  }
  if (!session?.freestyle) {
    html += `<div class="row between deload-row">
      <label class="toggle"><input type="checkbox" data-a="deload-toggle" ${isDeload ? 'checked' : ''} ${session ? 'disabled' : ''}><span>Deload session</span></label>
      ${isDeload ? '<span class="muted small">Half the sets · same or ≤10% lighter · RIR 3–4</span>' : ''}
    </div>`;
  }
  // Warm-ups go on the first compound lift of the day.
  const firstCompound = items.find((i) => i.ex.category === 'compound' && i.ex.type !== 'bodyweight');

  // Group consecutive items by superset number.
  const groups = [];
  for (const item of items) {
    const g = groupNum(item.group);
    const last = groups[groups.length - 1];
    if (last && last.g === g) last.items.push(item);
    else groups.push({ g, items: [item] });
  }
  const card = (i, inGroup) => exerciseCard(i, session, isDeload, inGroup, { rir, warm: db.settings.warmups && i === firstCompound });
  for (const grp of groups) {
    // A swapped-in exercise shares its slot number but doesn't make a superset on its own.
    if (grp.items.filter((i) => !i.extra).length > 1) {
      const restSec = Math.max(...grp.items.map((i) => i.restSec || 0));
      html += `<section class="group"><div class="group-label">Superset ${grp.g} · rest ${fmtRest(restSec)} after each round</div>
        ${grp.items.map((i) => card(i, true)).join('')}</section>`;
    } else html += grp.items.map((i) => card(i, false)).join('');
  }
  if (session) html += '<button class="btn block" data-a="session-add">+ Add an exercise</button>';
  if (session?.freestyle && !items.length) html += '<p class="muted small center pad">Add exercises from the bank to build this workout.</p>';

  if (mode === 'both') html += cardioSection(day, 'Cardio · after lifting');
  else if (ui.showCardio) html += cardioSection(day, 'Cardio');
  else html += '<button class="btn block" data-a="show-cardio">+ Add cardio today</button>';

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

// Once a workout starts, the session's own order is the source of truth: swaps, added exercises
// and reordering all live there. Plan notes still show for exercises that match the plan.
function sessionItems(session, planItems) {
  const byUid = Object.fromEntries(planItems.map((i) => [i.uid, i]));
  return session.order.map((u) => {
    const e = session.entries[u];
    const ex = e && db.exercises[e.exerciseId];
    if (!ex) return null;
    const planned = byUid[u];
    let swappedFrom = null;
    if (e.parentUid) swappedFrom = db.exercises[e.swappedFrom]?.name || byUid[e.parentUid]?.ex.name || null;
    else if (planned && planned.exerciseId !== e.exerciseId) swappedFrom = planned.ex.name;
    return {
      uid: u, exerciseId: e.exerciseId, ex, group: e.group, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec,
      sets: e.sets.length, note: planned && !swappedFrom ? planned.note : '', swappedFrom, extra: !!e.parentUid || !!e.added,
    };
  }).filter(Boolean);
}

function muscleLine(ex) {
  const p = ex.primary.map((m) => MUSCLES[m] || m).join(', ') || 'No muscles set';
  const s = ex.secondary.map((m) => (MUSCLES[m] || m).toLowerCase()).join(', ');
  return s ? `${p} · also ${s}` : p;
}

function exerciseCard(item, session, isDeload, inGroup, opts = {}) {
  const ex = item.ex;
  const gym = activeGym(db);
  const t = targetsFor(db, item, isDeload);
  const target = t.weight == null ? null : roundToGym(ex, t.weight, gym);
  const entry = session?.entries[item.uid];
  const sets = entry ? entry.sets : Array.from({ length: t.sets }, () => newSet(target, t.reps));
  const ended = entry?.pain;
  const allDone = entry && sets.every((s) => s.done);
  const barbell = ex.type?.startsWith('barbell');
  const targetLine = [
    `${t.sets} × ${item.repMin}–${item.repMax}`,
    fmtW(target, ex),
    item.restSec && !inGroup ? `rest ${fmtRest(item.restSec)}` : '',
  ].filter(Boolean).join(' · ');
  const aim = t.weight == null
    ? 'First session: pick a working weight to set the baseline.'
    : t.total ? `Aim ${t.reps}+ reps · beat ${t.total - 1} total` : `Aim ${t.reps} reps/set`;
  const effort = t.rir ? ` · RIR ${t.rir}` : opts.rir ? ` · ~${opts.rir} in reserve` : '';

  const flags = [];
  if (!isAvailable(db, ex)) {
    const why = db.exPrefs[ex.id] === 'never' ? 'You marked this "never suggest"' : `Not available at ${esc(gym.name)}`;
    flags.push(`<div class="flag warn">${why} — tap Swap for an alternative.</div>`);
  }
  if (t.stalled) flags.push(`<div class="flag warn">⚠ Stalled 3 sessions. Drop a set for a week, or swap to a variation next block.</div>`);
  if (t.painWarning) flags.push(`<div class="flag bad">⚠ 2 pain flags in 2 weeks.${ex.substitute ? ` Consider: ${esc(ex.substitute)}.` : ''}</div>`);
  if (ex.type === 'bodyweight' && t.weight === 0 && t.st.status === 'progressed') flags.push(`<div class="flag good">Top of range hit — try adding 5–10 lb.</div>`);

  const warm = opts.warm && target ? warmupSets(ex, target, gym) : [];
  const warmHtml = warm.length ? `<details class="warmup"><summary>Warm-up · ${warm.length} sets</summary>
    ${warm.map((w) => `<div class="wu-row"><span>${fmtW(w.weight, ex)} × ${w.reps}</span><span class="muted small">${barbell ? plateText(w.weight, gym) : ''}</span></div>`).join('')}
    <p class="muted small">Easy ramp-up — not counted as working sets.</p></details>` : '';

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
  controls.push(`<button class="mini" data-a="swap" data-uid="${item.uid}">⇄ Swap</button>`);
  if (!ended) {
    controls.push(`<button class="mini" data-a="add-set" data-uid="${item.uid}">+ Set</button>`);
    if (sets.length > 1) controls.push(`<button class="mini" data-a="remove-set" data-uid="${item.uid}">− Set</button>`);
    if (ex.rules?.dropSet) controls.push(`<label class="mini toggle"><input type="checkbox" data-a="dropset" data-uid="${item.uid}" ${entry?.dropSet ? 'checked' : ''}><span>Drop sets</span></label>`);
  }
  controls.push(`<button class="mini" data-a="ex-more" data-uid="${item.uid}" aria-label="More options">⋯</button>`);
  const rehab = ex.rules?.rehab && !ended ? `<label class="toggle painfree ${allDone ? 'attn' : ''}"><input type="checkbox" data-a="painfree" data-uid="${item.uid}" ${entry?.painFree ? 'checked' : ''}><span>Pain-free today (needed to go up)</span></label>` : '';
  const checkin = entry && allDone && !ended && !session.isDeload ? `<div class="checkin"><span class="small muted">How did that feel?</span>
    <div class="chips wrap">${[['easy', 'Easy'], ['right', 'About right'], ['hard', 'Too much']].map(([v, l]) => `<button class="chip sm ${entry.feedback === v ? 'on' : ''}" data-a="fb" data-uid="${item.uid}" data-v="${v}">${l}</button>`).join('')}
    <button class="chip sm ${entry.joint ? 'on bad' : ''}" data-a="fb-joint" data-uid="${item.uid}">Joint pain</button></div></div>` : '';

  return `<article class="card ex ${allDone ? 'complete' : ''} ${ended ? 'ended' : ''}">
    <div class="ex-head">
      <span class="tag">${esc(item.group)}</span>
      <div class="grow">
        <h3><button class="linkish" data-a="ex-info" data-id="${ex.id}">${db.exPrefs[ex.id] === 'fav' ? '★ ' : ''}${esc(ex.name)}</button></h3>
        <p class="muscles">${esc(muscleLine(ex))}</p>
        <p class="sub">${targetLine}</p>
        ${barbell && target ? `<p class="muted small">Plates: ${plateText(target, gym)}</p>` : ''}
      </div>
    </div>
    <p class="aim">${aim}${effort}</p>
    ${t.st.last ? `<p class="muted small">Last: ${fmtLast(t.st.last, ex)}</p>` : ''}
    ${item.swappedFrom ? `<p class="note">Swapped in for ${esc(item.swappedFrom)} today</p>` : ''}
    ${item.note || ex.notes ? `<p class="note">${esc([item.note, ex.notes].filter(Boolean).join(' · '))}</p>` : ''}
    ${entry?.note ? `<p class="note">📝 ${esc(entry.note)}</p>` : ''}
    ${flags.join('')}
    ${ended ? `<div class="flag bad">Stopped for pain — not counted toward progression.${ex.substitute ? ` Substitute: <b>${esc(ex.substitute)}</b>.` : ''} Tap Swap for alternatives.</div>` : ''}
    ${warmHtml}
    <div class="sets">${rows}</div>
    ${controls.length ? `<div class="row wrap controls">${controls.join('')}</div>` : ''}
    ${rehab}
    ${checkin}
  </article>`;
}

// Per-exercise options during a workout.
function openExerciseMore(uid) {
  const session = sessionFor(ui.day) || ensureSession(ui.day);
  if (!session) return;
  const e = session.entries[uid];
  const i = session.order.indexOf(uid);
  render();
  openSheet(`<h2>${esc(db.exercises[e.exerciseId].name)}</h2>
    <div class="field"><span>Note for today</span><textarea id="ex-note" rows="2" placeholder="e.g. seat height 4, felt a tweak on set 3">${esc(e.note || '')}</textarea></div>
    <button class="btn primary block" data-a="ex-note-save" data-uid="${uid}">Save note</button>
    <div class="row"><button class="btn grow" data-a="ex-move" data-uid="${uid}" data-v="-1" ${i <= 0 ? 'disabled' : ''}>Move up</button>
      <button class="btn grow" data-a="ex-move" data-uid="${uid}" data-v="1" ${i >= session.order.length - 1 ? 'disabled' : ''}>Do later</button></div>
    <button class="btn block" data-a="ex-info" data-id="${e.exerciseId}">Form tips & records</button>
    <button class="btn danger block" data-a="ex-remove" data-uid="${uid}">Remove from today</button>
    <button class="btn block" data-a="close-sheet">Close</button>`);
}

// ---------- Cardio ----------

const MODE_LABELS = { lift: 'Lift', both: 'Lift + cardio', cardio: 'Cardio', rest: 'Rest' };
const FULL_DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const VERDICT = { good: 'Good', ok: 'OK', skip: 'Skip' };

function weeklyCardioLine() {
  const target = cardioTargetFor(db);
  if (!target) return '';
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = db.cardio.filter((c) => c.ts >= weekAgo);
  const mins = recent.reduce((a, c) => a + c.minutes, 0);
  const hard = recent.filter((c) => (INTENSITY[CARDIO[c.cardioId]?.intensity]?.factor || 0) >= 1.4).reduce((a, c) => a + c.minutes, 0);
  const pct = Math.min(100, Math.round((mins / target) * 100));
  return `<div class="cardio-week"><div class="row between small"><span>Last 7 days: <b>${mins}</b> of ${target} min</span><span class="muted">${mins ? `${Math.round(((mins - hard) / mins) * 100)}% easy` : ''}</span></div>
    <span class="fr-bar"><i style="width:${Math.max(pct, 2)}%"></i></span></div>`;
}

function cardioRow(r) {
  const c = r.c;
  return `<button class="pick-row" data-a="cardio-log" data-id="${c.id}">
    <span class="grow"><b>${esc(c.name)}</b>
      <span class="pick-sub">~${c.minutes} min · ${INTENSITY[c.intensity].label} · ${esc(r.reasons.join(' · '))}</span></span>
    <span class="verdict ${r.verdict}">${VERDICT[r.verdict]}</span>
  </button>`;
}

function fatigueSummary(fresh) {
  const tired = Object.entries(fresh).filter(([, v]) => v < 0.8).sort((a, b) => a[1] - b[1]).slice(0, 3);
  if (!tired.length) return 'All muscles fresh.';
  return `Most fatigued: ${tired.map(([m, v]) => `${MUSCLES[m]} ${Math.round(v * 100)}%`).join(', ')}.`;
}

function cardioSection(day, title) {
  const isToday = day === defaultDay();
  const { ctx, list } = suggestCardio(db, day, isToday);
  const top = list.filter((r) => r.verdict !== 'skip').slice(0, 4);
  const tomorrow = ctx.next[0];
  const nextLine = Object.keys(tomorrow.loads).length ? ` Tomorrow: ${esc(tomorrow.name || 'lifting')}.` : '';
  const logged = isToday ? db.cardio.filter((c) => c.date === todayStr()) : [];
  return `<section class="card cardio">
    <h3>${title}</h3>
    <p class="muted small">${isToday ? '' : 'Projected from your plan. '}${ctx.mode === 'lift' || ctx.mode === 'both' ? 'After today\'s lifting: ' : ''}${fatigueSummary(ctx.fresh)}${nextLine}</p>
    ${logged.map((c) => `<div class="list-row logged"><span class="grow">✓ <b>${esc(CARDIO[c.cardioId]?.name || c.cardioId)}</b> · ${c.minutes} min${c.distance ? ` · ${c.distance} mi` : ''}${c.rpe ? ` · RPE ${c.rpe}` : ''}</span>
      <button class="mini" data-a="cardio-del" data-id="${c.id}" aria-label="Delete">✕</button></div>`).join('')}
    ${weeklyCardioLine()}
    <h4 class="sub-h">Suggested</h4>
    ${top.map(cardioRow).join('') || '<p class="muted small">Everything is a stretch today — consider resting.</p>'}
    <button class="btn block" data-a="cardio-all" data-day="${day}">All cardio options</button>
  </section>`;
}

function openCardioAll(day) {
  const { list } = suggestCardio(db, day, day === defaultDay());
  const sect = (v, label) => {
    const rows = list.filter((r) => r.verdict === v);
    return rows.length ? `<h3 class="sect">${label} <span class="muted small">${rows.length}</span></h3>${rows.map(cardioRow).join('')}` : '';
  };
  openSheet(`<h2>Cardio options</h2>
    <p class="muted small">Ranked by how fresh the muscles each one uses are, and what you lift in the next two days.</p>
    <div id="pk-list">${sect('good', 'Good fits')}${sect('ok', 'OK')}${sect('skip', 'Better another day')}</div>
    <button class="btn block" data-a="close-sheet">Close</button>`);
}

function openCardioSheet(id) {
  const c = CARDIO[id];
  const r = suggestCardio(db, defaultDay(), true).list.find((x) => x.c.id === id);
  sheetState.rpe = null;
  openSheet(`
    <h2>${esc(c.name)}</h2>
    <p class="muted small">${MODALITIES[c.modality]} · ${INTENSITY[c.intensity].label} · ${c.impact === 'high' ? 'high impact' : c.impact === 'low' ? 'low impact' : 'no impact'}</p>
    <p class="small">${esc(c.how)}</p>
    ${r ? `<p class="small"><span class="verdict ${r.verdict}">${VERDICT[r.verdict]}</span> today: ${esc(r.reasons.join(' · '))}</p>` : ''}
    <div class="field"><span>Minutes</span>${stepper('c-min', c.minutes, 5)}</div>
    <div class="field"><span>Distance (miles, optional)</span><input id="c-dist" type="text" inputmode="decimal" placeholder="—"></div>
    <div class="field"><span>Effort (RPE 1–10, optional)</span>
      <div class="chips rir">${['–', 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<button class="chip ${v === '–' ? 'on' : ''}" data-a="rpe" data-v="${v}">${v}</button>`).join('')}</div></div>
    <div class="field"><span>Note</span><input id="c-note" type="text" placeholder="optional"></div>
    <button class="btn primary block big" data-a="cardio-save" data-id="${id}">Log for today</button>
    <button class="btn block" data-a="close-sheet">Cancel</button>`);
}

function freshnessCard() {
  const fresh = freshness(currentFatigue(db));
  const groups = Object.entries(MUSCLE_GROUPS).map(([g, ms]) => `
    <h4 class="sub-h">${g}</h4>
    ${ms.map((m) => {
      const pct = Math.round(fresh[m] * 100);
      return `<div class="fresh-row"><span class="fr-name">${MUSCLES[m]}</span>
        <span class="fr-bar" role="img" aria-label="${MUSCLES[m]} ${pct}% fresh"><i class="${pct < 50 ? 'low' : ''}" style="width:${Math.max(pct, 2)}%"></i></span>
        <span class="fr-pct">${pct}%</span></div>`;
    }).join('')}`).join('');
  return `<div class="card"><h3>Muscle freshness</h3>
    <p class="muted small">100% = fully recovered. Counts hard sets (primary muscles 1, secondary ½) and cardio from the past week, fading over 2–3 days.</p>
    ${groups}</div>`;
}

function cardioHistory() {
  const recent = [...db.cardio].sort((a, b) => b.ts - a.ts).slice(0, 8);
  if (!recent.length) return '';
  return `<div class="card"><h3>Recent cardio</h3>${recent.map((c) => `
    <div class="list-row"><span class="grow"><b>${fmtDate(c.date)}</b> · ${esc(CARDIO[c.cardioId]?.name || c.cardioId)}</span>
    <span class="muted small">${c.minutes} min${c.distance ? ` · ${c.distance} mi` : ''}${c.rpe ? ` · RPE ${c.rpe}` : ''}</span></div>`).join('')}</div>`;
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

// ---------- Exercise bank picker ----------

const picker = { mode: null, uid: null, currentId: null, scope: 'today', q: '', cat: 'all', muscle: 'all' };
const PICKER_TITLES = { swap: 'Swap exercise', 'plan-swap': 'Swap in plan', add: 'Add exercise', browse: 'Exercise library', 'session-add': 'Add to today' };

function openPicker(opts) {
  Object.assign(picker, { uid: null, currentId: null, scope: 'today', q: '', cat: 'all', muscle: 'all', showHidden: false }, opts);
  const cur = picker.currentId ? db.exercises[picker.currentId] : null;
  openSheet(`
    <h2>${PICKER_TITLES[picker.mode]}</h2>
    ${cur ? `<p class="muted small">Replacing <b>${esc(cur.name)}</b> · ${esc(muscleLine(cur))}</p>` : ''}
    ${picker.mode === 'swap' ? `<div class="chips seg">
      <button class="chip on" data-a="pk-scope" data-v="today">Today only</button>
      <button class="chip" data-a="pk-scope" data-v="plan">Replace in plan</button>
    </div>` : ''}
    <input id="pk-q" class="search" type="search" placeholder="Search name, muscle or movement" autocomplete="off" enterkeyhint="search">
    <div class="chips pk-filters">${[['all', 'All'], ['compound', 'Compound'], ['accessory', 'Accessory']].map(([v, l]) =>
      `<button class="chip ${v === 'all' ? 'on' : ''}" data-a="pk-cat" data-v="${v}">${l}</button>`).join('')}</div>
    <select id="pk-muscle" class="pk-muscle" data-a="pk-muscle" aria-label="Muscle">
      <option value="all">All muscles</option>
      ${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
    </select>
    ${picker.mode === 'add' ? '<button class="btn block" data-a="pk-custom">+ Create a custom exercise</button>' : ''}
    <div id="pk-list"></div>`);
  renderPickerList();
}

function pickRow(ex, why) {
  return `<button class="pick-row" data-a="pick" data-id="${ex.id}">
    <span class="grow"><b>${db.exPrefs[ex.id] === 'fav' ? '★ ' : ''}${esc(ex.name)}</b><span class="pick-sub">${isAvailable(db, ex) ? '' : '<em class="warn-t">Hidden</em> · '}${why ? `<em>${why}</em> · ` : ''}${esc(muscleLine(ex))}</span></span>
    <span class="cat ${ex.category}">${CATEGORIES[ex.category]}</span>
  </button>`;
}

function renderPickerList() {
  const el = $('#pk-list');
  if (!el) return;
  const q = picker.q.trim().toLowerCase();
  // Exercises marked 'never' or not available at this gym are hidden unless asked for.
  const hiddenCount = Object.values(db.exercises).filter((ex) => !isAvailable(db, ex)).length;
  const match = (ex) => (picker.showHidden || picker.mode === 'browse' || isAvailable(db, ex))
    && (picker.cat === 'all' || ex.category === picker.cat)
    && (picker.muscle === 'all' || ex.primary.includes(picker.muscle) || ex.secondary.includes(picker.muscle))
    && (!q || ex.name.toLowerCase().includes(q)
      || [...ex.primary, ...ex.secondary].some((m) => (MUSCLES[m] || '').toLowerCase().includes(q))
      || (PATTERNS[ex.pattern] || '').toLowerCase().includes(q));
  let html = '';
  if (picker.currentId) {
    const sugg = similarExercises(db.exercises, picker.currentId, 12).filter((x) => match(x.ex))
      .sort((a, b) => (db.exPrefs[b.ex.id] === 'fav') - (db.exPrefs[a.ex.id] === 'fav')).slice(0, 8);
    if (sugg.length) {
      html += `<h3 class="sect">Most similar</h3>${sugg.map((x) => pickRow(x.ex, x.samePattern ? 'Same movement' : 'Similar muscles')).join('')}`;
    }
  }
  // Group the full list by main (first) primary muscle; compounds first within each group.
  const groups = {};
  for (const ex of Object.values(db.exercises)) {
    if (ex.id === picker.currentId || !match(ex)) continue;
    const key = picker.muscle !== 'all' ? (ex.primary.includes(picker.muscle) ? picker.muscle : '_secondary') : ex.primary[0] || '_other';
    (groups[key] ||= []).push(ex);
  }
  const label = (k) => MUSCLES[k] || (k === '_secondary' ? `${MUSCLES[picker.muscle]} as a secondary muscle` : 'Other');
  const keys = [...Object.keys(MUSCLES), '_secondary', '_other'].filter((k) => groups[k]);
  html += keys.map((k) => {
    const fav = (x) => (db.exPrefs[x.id] === 'fav' ? 0 : 1);
    const list = groups[k].sort((a, b) => fav(a) - fav(b) || (a.category === b.category ? a.name.localeCompare(b.name) : a.category === 'compound' ? -1 : 1));
    return `<h3 class="sect">${label(k)} <span class="muted small">${list.length}</span></h3>${list.map((ex) => pickRow(ex)).join('')}`;
  }).join('');
  if (hiddenCount && picker.mode !== 'browse') html += `<button class="btn ghost block" data-a="pk-hidden">${picker.showHidden ? 'Hide' : 'Show'} ${hiddenCount} hidden exercises (never / not at this gym)</button>`;
  el.innerHTML = html || '<p class="muted small pad">No matches.</p>';
}

function planItemFor(day, uid) {
  return db.plan[day]?.items.find((i) => i.uid === uid);
}

// Point a plan slot at a different exercise. A rotating slot stops rotating.
function swapInPlan(day, uid, newId) {
  const baseUid = db.activeSession?.entries[uid]?.parentUid || uid;
  const it = planItemFor(day, baseUid);
  if (!it) return;
  delete it.role;
  it.exerciseId = newId;
  persist();
}

// Swap within today's workout. If sets were already logged, those stay with the original
// exercise and the new one is added right after it.
function swapInSession(uid, newId) {
  const session = ensureSession(ui.day);
  if (!session) return;
  const entry = session.entries[uid];
  const baseUid = entry.parentUid || uid;
  const planned = resolveDay(db, session.day).find((i) => i.uid === baseUid);
  const item = {
    uid, exerciseId: newId, group: entry.group, repMin: entry.repMin, repMax: entry.repMax,
    restSec: entry.restSec, sets: planned?.sets ?? entry.sets.length,
  };
  const logged = entry.sets.some((x) => x.done || x.pain);
  if (!logged) {
    const fresh = makeEntry(item, session.isDeload);
    Object.assign(entry, { exerciseId: newId, sets: fresh.sets, dropSet: false, painFree: false });
  } else {
    entry.sets = entry.sets.filter((x) => x.done || x.pain);
    const newUid = `${baseUid}-x${Date.now()}`;
    const fresh = makeEntry({ ...item, uid: newUid }, session.isDeload);
    session.entries[newUid] = { ...fresh, parentUid: baseUid, swappedFrom: entry.exerciseId };
    session.order.splice(session.order.indexOf(uid) + 1, 0, newUid);
  }
  persist();
}

// Add an exercise to today's workout only (the plan is unchanged).
function addToSession(exId) {
  const session = ensureSession(ui.day);
  if (!session) return;
  const ex = db.exercises[exId];
  const compound = ex.category === 'compound';
  const n = session.order.filter((u) => session.entries[u].added).length + 1;
  const uid = `add-${Date.now()}`;
  const item = { uid, exerciseId: exId, group: `+${n}`, sets: 3, repMin: compound ? 6 : 10, repMax: compound ? 10 : 15, restSec: compound ? 150 : 90 };
  session.entries[uid] = { ...makeEntry(item, session.isDeload), added: true };
  session.order.push(uid);
  persist();
}

function addPlanItem(exId) {
  const day = ui.planDay;
  const items = db.plan[day].items;
  const ex = db.exercises[exId];
  const nextGroup = Math.max(0, ...items.map((i) => parseInt(groupNum(i.group), 10) || 0)) + 1;
  const defaults = ex.category === 'compound'
    ? { sets: 3, repMin: 6, repMax: 10, restSec: 150 }
    : { sets: 3, repMin: 10, repMax: 15, restSec: 90 };
  items.push({ uid: `${day}-${Date.now()}`, exerciseId: exId, group: String(nextGroup), note: '', ...defaults });
  persist();
  render();
  openPlanEdit(items.length - 1);
}

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
  const prs = s.prs || [];
  const adj = s.adjustments || [];
  return `<header class="top"><div><h1>${ui.summaryFresh ? 'Workout done' : 'Workout'}</h1><p class="muted small">${fmtDate(s.date)} · ${DAY_NAMES[s.day]} · ${s.freestyle ? 'Freestyle' : esc(db.plan[s.day]?.name || '')}${s.isDeload ? ' · deload' : ''}</p></div></header>
    <div class="stats">
      <div class="stat"><b>${mins}</b><span>min</span></div>
      <div class="stat"><b>${sets}</b><span>sets</span></div>
      <div class="stat"><b>${Math.round(vol).toLocaleString()}</b><span>lb volume</span></div>
    </div>
    ${prs.length ? `<div class="card pr-card"><h3>🏆 Personal records (${prs.length})</h3>${prs.map((p) => `<p class="small"><b>${esc(p.name)}</b> — ${esc(p.text)}</p>`).join('')}</div>` : ''}
    ${s.isDeload ? '<p class="muted small pad">Deload sessions don\'t change targets.</p>' : `
    <div class="card"><h3>Progressed (${progressed.length})</h3>${progressed.length ? progressed.map(row).join('') : '<p class="muted small">None this time.</p>'}</div>
    ${stalled.length ? `<div class="card"><h3>Stalled or missed (${stalled.length})</h3>${stalled.map(row).join('')}</div>` : ''}`}
    ${adj.length ? `<div class="card"><h3>Plan adjustments from your check-ins</h3>${adj.map((a) => `<p class="small">${esc(a.text)}</p>`).join('')}</div>` : ''}
    <div class="card"><h3>Next session targets</h3>${res.filter((r) => !progressed.includes(r) && !stalled.includes(r)).map(row).join('') || '<p class="muted small">See above.</p>'}</div>
    <div class="card"><h3>Notes</h3><textarea id="session-note" data-sid="${s.id}" rows="3" placeholder="How did it go? Sleep, energy, anything to remember">${esc(s.note || '')}</textarea></div>
    <div class="row"><button class="btn grow" data-a="share-session" data-id="${s.id}">Share</button><button class="btn grow" data-a="edit-session" data-id="${s.id}">Edit workout</button></div>
    <button class="btn primary block" data-a="tab" data-tab="${ui.summaryFresh ? 'today' : 'history'}">Done</button>`;
}

// ---------- Edit a finished workout ----------

function isLatestFor(session, exId) {
  return !db.sessions.some((x) => x !== session && x.finishedAt > session.finishedAt && x.entries.some((e) => e.exerciseId === exId));
}

// Re-run progression for exercises where this is still the most recent workout, from the saved
// pre-workout state. Older workouts only change history (newer workouts already built on them).
function recomputeSession(s) {
  const changed = [];
  for (const exId of new Set(s.entries.map((e) => e.exerciseId).concat(Object.keys(s.stateBefore || {})))) {
    if (!s.stateBefore || !(exId in s.stateBefore) || !isLatestFor(s, exId)) continue;
    if (s.stateBefore[exId]) db.state[exId] = JSON.parse(JSON.stringify(s.stateBefore[exId])); else delete db.state[exId];
    const e = s.entries.find((x) => x.exerciseId === exId);
    if (!e) continue;
    const { result, state } = evaluate(db, { ...e, sets: e.sets.map((x) => ({ ...x, done: !x.pain })) }, s);
    if (state) db.state[exId] = state;
    const i = s.results.findIndex((r) => r.exerciseId === exId);
    if (i >= 0) s.results[i] = { ...result, group: e.group }; else s.results.push({ ...result, group: e.group });
    changed.push(exId);
  }
  s.prs = s.isDeload ? [] : s.entries.flatMap((e) => detectPRs(db, e, s.finishedAt).map((p) => ({ exerciseId: e.exerciseId, name: e.name, ...p })));
  return changed;
}

function screenEditSession() {
  const s = db.sessions.find((x) => x.id === ui.editId);
  if (!s) { ui.tab = 'history'; return screenHistory(); }
  return `<header class="top"><button class="back" data-a="summary" data-id="${s.id}" aria-label="Back">‹</button><div><h1>Edit workout</h1><p class="muted small">${fmtDate(s.date)} · changes save when you tap Save</p></div></header>
    ${s.entries.map((e, ei) => `<div class="card">
      <div class="row between"><h3>${esc(e.name)}</h3><button class="mini danger" data-a="es-del-entry" data-i="${ei}">Remove</button></div>
      ${e.sets.map((x, si) => `<div class="edit-set"><span class="set-n">${si + 1}</span>
        <input type="text" inputmode="decimal" data-es="${ei}:${si}:weight" value="${x.weight}" aria-label="Weight"><span class="muted">lb ×</span>
        <input type="text" inputmode="numeric" data-es="${ei}:${si}:reps" value="${x.reps}" aria-label="Reps">
        <button class="mini" data-a="es-del-set" data-i="${ei}" data-j="${si}" aria-label="Delete set">✕</button></div>`).join('')}
    </div>`).join('')}
    <button class="btn primary block big" data-a="es-save">Save changes</button>
    <button class="btn danger block" data-a="es-delete">Delete this workout</button>
    <p class="muted small pad">If this is your most recent workout for an exercise, its next targets are recalculated. Older workouts only update history.</p>`;
}

function readEditInputs(s) {
  for (const el of document.querySelectorAll('[data-es]')) {
    const [ei, si, k] = el.dataset.es.split(':');
    const v = parseFloat(el.value);
    if (Number.isFinite(v) && s.entries[ei]?.sets[si]) s.entries[ei].sets[si][k] = k === 'reps' ? Math.round(v) : v;
  }
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
    ${!db.sessions.length && !db.cardio.length ? '<div class="empty"><div class="big">No workouts yet</div><p class="muted">Finished workouts show up here.</p></div>' : ''}
    ${extras.volumeCard()}
    ${recent.length ? `<div class="card"><h3>Recent workouts</h3>${recent.map((s) => `
      <button class="list-row" data-a="summary" data-id="${s.id}">
        <span class="grow"><b>${fmtDate(s.date)}</b> · ${DAY_NAMES[s.day]} ${s.freestyle ? 'Freestyle' : esc(db.plan[s.day]?.name || '')}${s.isDeload ? ' · deload' : ''}</span>
        <span class="muted small">${s.prs?.length ? `🏆${s.prs.length} ` : ''}${s.results.filter((r) => r.status === 'progressed').length}↑</span><span class="chev">›</span>
      </button>`).join('')}</div>` : ''}
    <button class="btn block" data-a="browse-bank">Browse the exercise library</button>
    ${cardioHistory()}
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
  return `<header class="top"><button class="back" data-a="history-back" aria-label="Back">‹</button><div><h1>${esc(ex.name)}</h1><p class="muted small">${CATEGORIES[ex.category]} · ${esc(muscleLine(ex))}</p></div></header>
    ${extras.exerciseInfo(ex)}
    ${hist.length ? `<div class="card"><p class="muted small">${bw ? 'Total reps per session' : 'Est. 1RM (Epley) and top-set weight'}</p><div id="hist-chart"></div></div>` : ''}
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
  // Target follows the current year-plan phase, else the builder's bodyweight goal.
  const goal = goalFor(db);
  const tr = goal.goal === 'lose' ? [-goal.rate[1], -goal.rate[0]] : goal.goal === 'gain' ? goal.rate : [-0.25, 0.25];
  const goalLabel = goal.label;
  const { list, avg7, prev7 } = bwStats();
  const todays = list.find((b) => b.date === todayStr());
  const last = list[list.length - 1];
  let rate = '';
  if (avg7 && prev7) {
    const pct = ((avg7 - prev7) / prev7) * 100;
    const verdict = pct < tr[0] ? 'below target range' : pct > tr[1] ? 'above target range' : 'on target';
    rate = `<p class="small">Weekly change: <b>${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</b> (${(avg7 - prev7 >= 0 ? '+' : '')}${(avg7 - prev7).toFixed(1)} lb) · ${verdict}</p>`;
  }
  const lb = (x) => `${x >= 0 ? '+' : '−'}${Math.abs((avg7 * x) / 100).toFixed(1)}`;
  const target = avg7 ? `<p class="muted small">${goalLabel} target: ${lb(tr[0])} to ${lb(tr[1])} lb/week (${tr[0]}% to ${tr[1]}%)</p>` : '';
  // 7-day rolling average per entry for the chart.
  const pts = list.slice(-60).map((b) => {
    const win = list.filter((x) => { const d = daysBetween(x.date, b.date); return d >= 0 && d <= 6; });
    return { x: b.date, values: [b.weight, win.reduce((a, x) => a + x.weight, 0) / win.length] };
  });
  setTimeout(() => { const el = $('#bw-chart'); if (el && pts.length) lineChart(el, { points: pts, series: [{ name: 'Weigh-in', cls: 's2' }, { name: '7-day average', cls: 's1' }] }); });
  return `<header class="top"><h1>Body</h1></header>
    ${freshnessCard()}
    <h2 class="sect-h">Bodyweight</h2>
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
    ${list.length ? `<div class="card"><h3>Entries</h3>${[...list].reverse().slice(0, 10).map((b) => `
      <div class="list-row"><span class="grow">${fmtDate(b.date)}</span><b>${b.weight}</b><button class="mini" data-a="bw-del" data-date="${b.date}" aria-label="Delete">✕</button></div>`).join('')}</div>` : ''}
    <h2 class="sect-h">Measurements & photos</h2>
    ${extras.bodyCards()}`;
}

// ---------- Plan editor ----------

function builderEntry() {
  const prev = db.previousPlan;
  return `<div class="card builder-cta">
      <div class="row between"><div class="grow"><b>${db.profile ? 'Rebuild from your goals' : 'Build a plan from your goals'}</b>
      <p class="muted small">Sets, reps, rest, days and exercises picked for your experience, age and goals.</p></div>
      <button class="btn primary" data-a="open-builder">${db.profile ? 'Rebuild' : 'Start'}</button></div>
      ${prev ? `<p class="small">Plan changed ${new Date(prev.savedAt).toLocaleDateString()}. <button class="mini" data-a="undo-plan">Undo</button></p>` : ''}
    </div>`;
}

function planViewTabs() {
  return `<header class="top"><h1>Plan</h1></header>
    <div class="chips seg view-tabs">
      <button class="chip ${ui.planView === 'week' ? 'on' : ''}" data-a="plan-view" data-v="week">This week</button>
      <button class="chip ${ui.planView === 'year' ? 'on' : ''}" data-a="plan-view" data-v="year">Year</button>
    </div>`;
}

function screenPlan() {
  if (ui.planView === 'year') return planViewTabs() + year.view();
  const day = ui.planDay;
  const plan = db.plan[day];
  const mode = dayMode(db, day);
  const modes = plan ? ['lift', 'both', 'cardio', 'rest'] : ['cardio', 'rest'];
  const head = `${dayTabs(day, 'plan-day')}
    <div class="field"><span>Day type</span><div class="chips">${modes.map((m) =>
      `<button class="chip ${m === mode ? 'on' : ''}" data-a="day-mode" data-v="${m}">${MODE_LABELS[m]}</button>`).join('')}</div></div>`;
  if (!plan) return planViewTabs() + builderEntry() + head + `<p class="muted small pad">No lifting is planned on ${FULL_DAY[day]}s. Cardio days get suggestions based on your fatigue and the next lift days.</p><button class="btn block" data-a="add-lift-day">+ Add lifting on ${FULL_DAY[day]}s</button>`;
  const items = plan.items;
  return `${planViewTabs()}${builderEntry()}${head}
    ${mode === 'cardio' || mode === 'rest' ? `<p class="muted small pad">Lifting is off on ${FULL_DAY[day]}s. The plan below is kept for when you switch back.</p>` : ''}
    <div class="field inline"><span>Day name</span><input id="plan-name" type="text" value="${esc(plan.name)}" data-a="plan-name"></div>
    ${items.map((it, i) => {
      const ex = db.exercises[it.exerciseId];
      const st = getState(db, it.exerciseId);
      const rot = it.role === 'rowCompound' ? ' · rotates each block' : it.role === 'rowAccessory' ? ' · follows rotation' : '';
      return `<div class="card plan-item">
        <div class="ex-head"><span class="tag">${esc(it.group)}</span>
          <div class="grow"><h3>${esc(ex?.name || it.exerciseId)}</h3>
          <p class="muscles">${ex ? esc(muscleLine(ex)) : ''}</p><p class="sub">${it.sets} × ${it.repMin}–${it.repMax}${it.restSec ? ` · rest ${fmtRest(it.restSec)}` : ''} · ${fmtW(st.targetWeight, ex)} · +${ex?.increment} lb${rot}</p></div>
        </div>
        <div class="row controls">
          <button class="mini" data-a="plan-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="mini" data-a="plan-down" data-i="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="mini grow" data-a="plan-edit" data-i="${i}">Edit</button>
          <button class="mini grow" data-a="plan-swap" data-i="${i}">⇄ Swap</button>
          <button class="mini danger" data-a="plan-del" data-i="${i}" aria-label="Remove">✕</button>
        </div>
      </div>`;
    }).join('')}
    <button class="btn block" data-a="plan-add">+ Add exercise</button>
    <button class="btn block" data-a="browse-bank">Browse exercise bank</button>
    <p class="muted small pad">Swapping keeps each exercise's history. Rest on the first exercise of a superset is ignored — the group rests after the round.</p>`;
}

function openPlanEdit(i) {
  const day = ui.planDay;
  const isNew = i === -1;
  const it = isNew ? { group: String(db.plan[day].items.length + 1), exerciseId: '', sets: 3, repMin: 8, repMax: 12, restSec: 90, note: '' } : db.plan[day].items[i];
  const ex = db.exercises[it.exerciseId] || { type: 'machine', increment: 5, substitute: '', notes: '', minRir: 0, rules: {} };
  const st = it.exerciseId ? getState(db, it.exerciseId) : { targetWeight: null };
  const byMuscle = {};
  for (const e of Object.values(db.exercises)) (byMuscle[e.primary[0] || '_other'] ||= []).push(e);
  const opts = [...Object.keys(MUSCLES), '_other'].filter((k) => byMuscle[k]).map((k) =>
    `<optgroup label="${MUSCLES[k] || 'Other'}">${byMuscle[k].sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => `<option value="${e.id}" ${e.id === it.exerciseId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
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
    <div class="grid2">
      <div class="field"><span>Category</span><select id="pe-cat">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === (ex.category || 'accessory') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><span>Movement</span><select id="pe-pattern"><option value="">—</option>${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${k === ex.pattern ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="field"><span>Primary muscles</span><div class="chips wrap mus" id="pe-prim">${muscleChips(ex.primary)}</div></div>
    <div class="field"><span>Secondary muscles</span><div class="chips wrap mus" id="pe-sec">${muscleChips(ex.secondary)}</div></div>
    <div class="field"><span>Substitute (shown on pain)</span><input id="pe-sub" type="text" value="${esc(ex.substitute)}"></div>
    <div class="field"><span>Notes</span><input id="pe-notes" type="text" value="${esc(ex.notes)}"></div>
    <label class="toggle"><input id="pe-drop" type="checkbox" ${ex.rules?.dropSet ? 'checked' : ''}><span>Allow drop-set mode</span></label>
    <label class="toggle"><input id="pe-rehab" type="checkbox" ${ex.rules?.rehab ? 'checked' : ''}><span>Rehab rule (go up only when pain-free)</span></label>
    <button class="btn primary block big" data-a="pe-save" data-i="${i}">Save</button>
    <button class="btn block" data-a="close-sheet">Cancel</button>`);
}

function muscleChips(selected = []) {
  return Object.entries(MUSCLES).map(([k, v]) =>
    `<button class="chip sm ${selected.includes(k) ? 'on' : ''}" data-a="mus" data-m="${k}" aria-pressed="${selected.includes(k)}">${v}</button>`).join('');
}

const chosenMuscles = (id) => [...document.querySelectorAll(`#${id} .chip.on`)].map((c) => c.dataset.m);

// When a different exercise is picked in the edit sheet, show its classification.
function fillMeta(exId) {
  const ex = db.exercises[exId];
  $('#pe-cat').value = ex?.category || 'accessory';
  $('#pe-pattern').value = ex?.pattern || '';
  $('#pe-prim').innerHTML = muscleChips(ex?.primary);
  $('#pe-sec').innerHTML = muscleChips(ex?.secondary);
  if (ex) {
    $('#pe-type').value = ex.type;
    $('#pe-inc').value = ex.increment;
    $('#pe-weight').value = getState(db, exId).targetWeight ?? '';
    $('#pe-sub').value = ex.substitute || '';
    $('#pe-notes').value = ex.notes || '';
    $('#pe-rir').value = ex.minRir || 0;
    $('#pe-drop').checked = !!ex.rules?.dropSet;
    $('#pe-rehab').checked = !!ex.rules?.rehab;
  }
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
    db.exercises[exId] = {
      id: exId, name, type, increment: db.settings.defaultIncrements[type] || 5, substitute: '', notes: '', minRir: 0, rules: {},
      startWeight: null, category: 'accessory', pattern: '', primary: [], secondary: [], customMeta: true,
    };
  }
  const ex = db.exercises[exId];
  const meta = {
    category: $('#pe-cat').value,
    pattern: $('#pe-pattern').value,
    primary: chosenMuscles('pe-prim'),
    secondary: chosenMuscles('pe-sec').filter((m) => !chosenMuscles('pe-prim').includes(m)),
  };
  // Hand-edited classification is kept even when the built-in bank is updated.
  if (JSON.stringify(meta) !== JSON.stringify({ category: ex.category, pattern: ex.pattern || '', primary: ex.primary, secondary: ex.secondary })) {
    Object.assign(ex, meta, { customMeta: true });
  }
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

// ---------- Plan builder ----------

const B_STEPS = ['About you', 'Goals', 'Schedule', 'Split', 'Review'];
const BUILD_LABELS = { lean: 'Lean', average: 'Average', higher: 'Higher body fat' };

function openBuilder() {
  const base = defaultProfile(db);
  const draft = db.profile ? { ...base, ...JSON.parse(JSON.stringify(db.profile)) } : base;
  delete draft.rx;
  draft.equipment = [...activeGym(db).equipment]; // the builder works with the active gym's equipment
  ui.b = { step: 0, draft, liftEdited: !!db.profile, cardioEdited: !!db.profile, splitEdited: !!db.profile };
  ui.tab = 'builder';
  window.scrollTo(0, 0);
  render();
}

function refLinks(ids) {
  return ids.map((id) => `<a class="ref" href="#ref-${id}" data-a="b-ref" data-id="${id}">${refNum(id)}</a>`).join('');
}
const REF_ORDER = Object.keys(REFS);
const refNum = (id) => REF_ORDER.indexOf(id) + 1;

function builderState() {
  const p = ui.b.draft;
  const rx = prescription(p);
  const sug = suggestDays(p, rx);
  if (!ui.b.liftEdited || !p.liftDays) p.liftDays = sug.lift;
  if (!ui.b.cardioEdited || p.cardioDays == null) p.cardioDays = sug.cardio;
  const opts = splitOptions(p.liftDays);
  if (!ui.b.splitEdited || !opts.some((o) => o.id === p.split)) p.split = (opts.find((o) => o.recommended) || opts[0]).id;
  return { p, rx, sug, opts };
}

function bChips(key, options, current, multi = false) {
  return `<div class="chips wrap">${Object.entries(options).map(([v, label]) => {
    const on = multi ? (current || []).includes(v) : String(current ?? '') === v;
    return `<button class="chip ${on ? 'on' : ''}" data-a="b-set" data-k="${key}" data-v="${v}" ${multi ? 'data-multi="1"' : ''} aria-pressed="${on}">${label}</button>`;
  }).join('')}</div>`;
}

function screenBuilder() {
  if (!ui.b) openBuilder();
  const { p, rx, sug, opts } = builderState();
  const step = ui.b.step;
  let body = '';

  if (step === 0) {
    const bc = rx.bodyClass;
    body = `
      <div class="card">
        <div class="grid2">
          <div class="field"><span>Age</span><input type="text" inputmode="numeric" data-b="age" value="${esc(p.age)}"></div>
          <div class="field"><span>Weight (lb)</span><input type="text" inputmode="decimal" data-b="weightLb" value="${esc(p.weightLb)}"></div>
          <div class="field"><span>Height (ft)</span><input type="text" inputmode="numeric" data-b="heightFt" value="${Math.floor((p.heightIn || 0) / 12)}"></div>
          <div class="field"><span>Height (in)</span><input type="text" inputmode="numeric" data-b="heightInch" value="${(p.heightIn || 0) % 12}"></div>
        </div>
        <div class="field"><span>Sex <span class="muted">(optional — only used to read body fat %)</span></span>${bChips('sex', { '': 'Prefer not to say', male: 'Male', female: 'Female' }, p.sex)}</div>
        <div class="field"><span>Body fat % <span class="muted">(optional)</span></span><input type="text" inputmode="decimal" data-b="bodyFat" value="${esc(p.bodyFat)}" placeholder="e.g. 18"></div>
        <div class="field"><span>Build <span class="muted">(used when body fat % is blank)</span></span>${bChips('build', BUILD_LABELS, p.build)}</div>
        <p class="muted small">Body composition: <b>${BUILD_LABELS[bc.cls]}</b> (from ${bc.source})${bc.bmi ? ` · BMI ${bc.bmi.toFixed(1)}` : ''}. BMI can't tell muscle from fat, so body fat % or build wins when given.</p>
      </div>
      <div class="card"><h3>Training experience</h3>
        ${Object.entries(EXPERIENCE).map(([k, v]) => `<button class="pick-row ${p.experience === k ? 'picked' : ''}" data-a="b-set" data-k="experience" data-v="${k}">
          <span class="grow"><b>${v.label}</b><span class="pick-sub">${v.desc}</span></span><span class="radio" aria-hidden="true"></span></button>`).join('')}
      </div>`;
  } else if (step === 1) {
    const w = goalWeights(p);
    const mix = Object.entries(w).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
      .map(([g, v]) => `${Math.round(v * 100)}% ${GOALS[g].label.toLowerCase()}`).join(', ');
    body = `
      <div class="card">
        <p class="muted small">Rate how much each goal matters to you (0 = not at all, 5 = top priority). The mix sets your reps, sets, rest and cardio.</p>
        ${Object.entries(GOALS).map(([g, v]) => `<div class="goal-row">
          <div class="row between"><b>${v.label}</b><span class="goal-val" id="gv-${g}">${p.goals[g]}</span></div>
          <p class="muted small">${v.desc}</p>
          <input type="range" min="0" max="5" step="1" value="${p.goals[g]}" data-bgoal="${g}" aria-label="${v.label}">
        </div>`).join('')}
        <p class="small"><b>Your mix:</b> ${mix}</p>
      </div>
      <div class="card"><h3>Bodyweight goal</h3>
        ${bChips('weightGoal', { '': `Suggested (${WEIGHT_GOALS[suggestedWeightGoal(p)].toLowerCase()})`, ...WEIGHT_GOALS }, p.weightGoal)}
        <p class="muted small">${rx.weightGoal === 'gain' ? `Gain ${rx.rate[0]}–${rx.rate[1]}% of bodyweight per week` : rx.weightGoal === 'lose' ? `Lose ${rx.rate[0]}–${rx.rate[1]}% of bodyweight per week` : 'Stay within about ±0.25% per week'}. The Body tab tracks this.</p>
      </div>`;
  } else if (step === 2) {
    const dayChips = (key, from, to, cur) => `<div class="chips">${Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map((n) => `<button class="chip ${n === cur ? 'on' : ''}" data-a="b-days" data-k="${key}" data-v="${n}">${n}</button>`).join('')}</div>`;
    body = `
      <div class="card">
        <div class="field"><span>Lifting days per week · suggested <b>${sug.lift}</b></span>${dayChips('liftDays', 2, 6, p.liftDays)}</div>
        <div class="field"><span>Cardio sessions per week · suggested <b>${sug.cardio}</b> (${rx.cardioMin} min)</span>${dayChips('cardioDays', 0, 7, p.cardioDays)}</div>
        ${ui.b.liftEdited || ui.b.cardioEdited ? '<button class="mini" data-a="b-suggested">Use suggested days</button>' : ''}
        <ul class="reasons small muted">${sug.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <p class="muted small">Cardio sessions go on non-lifting days first, then after lifting on upper-body days.</p>
      </div>
      <div class="card">
        <div class="field"><span>Session length</span>${bChips('sessionMin', { 30: '30 min', 45: '45 min', 60: '60 min', 75: '75 min', 90: '90 min' }, p.sessionMin)}</div>
        <div class="field"><span>Equipment you have</span>${bChips('equipment', EQUIPMENT, p.equipment, true)}</div>
        <div class="field"><span>Go easy on <span class="muted">(skips exercises that commonly bother these)</span></span>${bChips('limits', LIMITS, p.limits, true)}</div>
      </div>`;
  } else if (step === 3) {
    const days = WEEK_LAYOUT[p.liftDays];
    body = `<p class="muted small pad">${p.liftDays} lifting days. Pick how to split the work — the recommended option trains each muscle about twice a week ${refLinks(['schoenfeld2016freq', 'pelland2026'])}.</p>
      ${opts.map((o) => `<button class="card split-card ${p.split === o.id ? 'picked' : ''}" data-a="b-split" data-v="${o.id}">
        <div class="row between"><b>${o.label}</b>${o.recommended ? '<span class="verdict good">Recommended</span>' : ''}</div>
        <p class="small muted">${o.desc}</p>
        <p class="small">${o.templates.map((t, i) => `${DAY_NAMES[days[i]]}: ${splitDayName(t)}`).join(' · ')}</p>
      </button>`).join('')}`;
  } else {
    let out;
    try { out = generatePlan(db, p, rx, p.liftDays, p.cardioDays, p.split); } catch (e) { out = null; body = `<p class="flag bad">${esc(e.message)}</p>`; }
    ui.b.out = out;
    if (out) body = reviewHtml(p, rx, out);
  }

  return `<header class="top"><button class="back" data-a="b-exit" aria-label="Close builder">‹</button><div><h1>Plan builder</h1><p class="muted small">Step ${step + 1} of ${B_STEPS.length} · ${B_STEPS[step]}</p></div></header>
    <div class="chips steps">${B_STEPS.map((s, i) => `<button class="chip ${i === step ? 'on' : ''}" data-a="b-step" data-v="${i}">${i + 1}. ${s}</button>`).join('')}</div>
    ${body}
    <div class="b-nav row">
      ${step > 0 ? '<button class="btn grow" data-a="b-back">Back</button>' : ''}
      ${step < B_STEPS.length - 1 ? '<button class="btn primary grow" data-a="b-next">Next</button>' : '<button class="btn primary grow" data-a="b-apply">Use this plan</button>'}
    </div>`;
}

const SPLIT_DAY_NAMES = {
  fbA: 'Full body A', fbB: 'Full body B', fbC: 'Full body C', fbA2: 'Full body D', upperA: 'Upper A', upperB: 'Upper B', upperA2: 'Upper C',
  lowerA: 'Lower A', lowerB: 'Lower B', lowerA2: 'Lower C', push: 'Push', pull: 'Pull', legs: 'Legs', push2: 'Push B', pull2: 'Pull B', legs2: 'Legs B',
};
const splitDayName = (t) => SPLIT_DAY_NAMES[t] || t;

function reviewHtml(p, rx, out) {
  const rows = [
    ['Main lifts', `${rx.mainSets} × ${rx.main[0]}–${rx.main[1]} · rest ${fmtSec(rx.restMain)}`],
    ['Other compounds', `${rx.sets} × ${rx.comp[0]}–${rx.comp[1]} · rest ${fmtSec(rx.rest)}`],
    ['Isolation', `${rx.isoSets} × ${rx.iso[0]}–${rx.iso[1]} · rest ${fmtSec(rx.restIso)}${rx.pairIso ? ' · supersets' : ''}`],
    ['Effort', `${rx.rir} reps in reserve`],
    ['Weekly sets / muscle', `${rx.weekly[0]}–${rx.weekly[1]}`],
    ['Cardio', `${rx.cardioMin} min/week · ~80% easy${rx.preferLowImpact ? ' · low impact' : ''}`],
    ['Deload', `every ${rx.deloadEvery} weeks`],
    ['Bodyweight', rx.weightGoal === 'gain' ? `+${rx.rate[0]}–${rx.rate[1]}%/week` : rx.weightGoal === 'lose' ? `−${rx.rate[0]}–${rx.rate[1]}%/week` : 'maintain'],
  ];
  const week = DAY_KEYS.map((d) => {
    const mode = out.dayModes[d];
    const day = out.plan[d];
    const label = day ? `${esc(day.name)} · ~${out.minutes[d]} min${mode === 'both' ? ' + cardio' : ''}` : mode === 'cardio' ? 'Cardio' : 'Rest';
    if (!day) return `<div class="list-row"><span class="day-k">${DAY_NAMES[d]}</span><span class="grow muted">${label}</span></div>`;
    return `<details class="day-detail"><summary class="list-row"><span class="day-k">${DAY_NAMES[d]}</span><span class="grow"><b>${label}</b></span><span class="chev">›</span></summary>
      ${day.items.map((it) => `<div class="b-item"><span class="tag">${esc(it.group)}</span><span class="grow">${esc(db.exercises[it.exerciseId].name)}${it.note ? `<span class="pick-sub">${esc(it.note)}</span>` : ''}</span><span class="muted small">${it.sets} × ${it.repMin}–${it.repMax}</span></div>`).join('')}
    </details>`;
  }).join('');
  const vol = VOLUME_MUSCLES.map((m) => {
    const v = Math.round((out.weekly[m] || 0) * 2) / 2;
    const [lo, hi] = volumeTarget(rx, m);
    const st = v < lo ? 'low' : v > hi * 1.2 ? 'high' : 'ok';
    return `<div class="vol-row"><span>${MUSCLES[m]}</span><span class="tnum">${v}</span><span class="muted tnum">${lo}–${hi}</span><span class="verdict ${st === 'ok' ? 'good' : 'ok'}">${st === 'ok' ? 'On target' : st === 'low' ? 'Low' : 'High'}</span></div>`;
  }).join('');
  const usedRefs = [...new Set(rx.why.flatMap((x) => x.refs).concat(['schoenfeld2016freq', 'pelland2026']))].sort((a, b) => refNum(a) - refNum(b));
  return `
    <div class="card"><h3>Your prescription</h3>
      ${rows.map(([k, v]) => `<div class="rx-row"><span class="muted">${k}</span><b>${v}</b></div>`).join('')}
      <p class="muted small">Starting weights are blank: your first session sets them. Pick a weight you could do for about ${rx.rirLo + 2} more reps than the bottom of the range.</p>
    </div>
    <div class="card"><h3>Your week</h3>${week}<p class="muted small">You can swap any exercise or edit sets and reps after applying.</p></div>
    <div class="card"><h3>Weekly sets per muscle</h3>
      <div class="vol-row head"><span>Muscle</span><span>Planned</span><span>Target</span><span></span></div>${vol}
      <p class="muted small">A set counts ½ for muscles that only assist ${refLinks(['pelland2026'])}. Some low counts are a trade-off for your session length.</p></div>
    <div class="card"><h3>Why these numbers</h3>
      ${rx.why.map((x) => `<p class="why"><b>${x.k}.</b> ${esc(x.t)} ${refLinks(x.refs)}</p>`).join('')}
      <details class="refs"><summary>References (${usedRefs.length})</summary>
        <ol>${usedRefs.map((id) => `<li id="ref-${id}" value="${refNum(id)}"><a href="${REFS[id].url}" target="_blank" rel="noopener">${esc(REFS[id].cite)}</a><span class="muted small block">${esc(REFS[id].finding)}</span></li>`).join('')}</ol>
      </details>
      <p class="muted small">These are evidence-based starting points, not medical advice. Check with a doctor before starting if you have health conditions.</p>
    </div>`;
}

function retargetWeights(plan) {
  for (const day of Object.values(plan)) {
    for (const it of day.items) {
      const st = db.state[it.exerciseId];
      const ex = db.exercises[it.exerciseId];
      if (!st?.last || !ex) continue;
      const reps = st.last.reps[0];
      const w = st.last.weights[0];
      if (!w || (reps >= it.repMin && reps <= it.repMax + 2)) continue;
      // New rep range: estimate 1RM (Epley), then aim for ~2 reps in reserve at the bottom of the range.
      const target = e1rm(w, reps) / (1 + (it.repMin + 2) / 30);
      const inc = Number(ex.increment) || 5;
      Object.assign(st, { targetWeight: Math.max(inc, roundTo(target, inc)), targetReps: it.repMin, targetTotal: null });
    }
  }
}

function applyBuilt() {
  const { p, rx } = builderState();
  const out = ui.b.out;
  if (!out) return;
  if (!confirm('Replace your current plan with this one? Workout history and targets are kept, and you can undo from the Plan tab.')) return;
  safetySnapshot(db, 'Before new plan');
  db.previousPlan = { plan: db.plan, dayModes: { ...db.settings.dayModes }, deloadEvery: db.settings.deloadEvery, savedAt: Date.now() };
  activeGym(db).equipment = [...p.equipment];
  db.plan = out.plan;
  db.settings.dayModes = out.dayModes;
  db.settings.deloadEvery = rx.deloadEvery;
  db.settings.welcomed = true;
  db.profile = {
    ...p, builtAt: Date.now(),
    rx: {
      cardioMin: rx.cardioMin, easyShare: rx.easyShare, preferLowImpact: rx.preferLowImpact, weightGoal: rx.weightGoal, rate: rx.rate,
      rir: rx.rir, rirLo: rx.rirLo, weekly: rx.weekly, includePhysique: rx.includePhysique, bodyClass: rx.bodyClass.cls,
    },
  };
  retargetWeights(out.plan);
  persist();
  ui.b = null;
  ui.tab = 'plan';
  ui.planDay = Object.keys(out.plan)[0];
  window.scrollTo(0, 0);
  render();
  toast('New plan applied. Swap or edit anything in Plan.');
}

function builderInput(el) {
  const p = ui.b.draft;
  const k = el.dataset.b;
  if (k === 'heightFt' || k === 'heightInch') {
    const ft = parseInt($('[data-b="heightFt"]').value, 10) || 0;
    const inch = parseInt($('[data-b="heightInch"]').value, 10) || 0;
    p.heightIn = ft * 12 + inch;
  } else if (k === 'bodyFat') p.bodyFat = el.value.trim();
  else {
    const v = parseFloat(el.value);
    p[k] = Number.isFinite(v) ? v : '';
  }
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
      <div class="field"><span>Deload every</span><div class="chips">${[4, 5, 6].map((n) => `<button class="chip ${s.deloadEvery === n ? 'on' : ''}" data-a="deload-every" data-v="${n}">${n} weeks</button>`).join('')}</div></div>
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
      <h3>Goals & profile</h3>
      <p class="muted small">${db.profile ? `Built ${new Date(db.profile.builtAt).toLocaleDateString()} · ${EXPERIENCE[db.profile.experience]?.label || ''} · ${db.profile.liftDays} lifting days` : 'Not set up yet.'}</p>
      <button class="btn block" data-a="open-builder">${db.profile ? 'Update goals & rebuild plan' : 'Build a plan from your goals'}</button>
    </div>
    ${extras.gymCard()}
    ${extras.dataCard()}
    <div class="card">
      <h3>Reset</h3>
      <button class="btn block" data-a="reset-plan">Restore default plan</button>
      <button class="btn danger block" data-a="reset-all">Erase all data</button>
    </div>
    <p class="muted small center pad">Lift Tracker · ${db.sessions.length} workouts logged</p>`;
}

// ---------- Feature modules ----------

function refChips(ids) {
  return (ids || []).map((id) => REFS[id] ? `<button class="ref" data-a="ref-sheet" data-ids="${ids.join(',')}">${refNum(id)}</button>` : '').join('');
}

function openRefs(ids) {
  openSheet(`<h2>Sources</h2>${ids.filter((id) => REFS[id]).map((id) => `<div class="ref-item"><span class="ref">${refNum(id)}</span><div><a href="${REFS[id].url}" target="_blank" rel="noopener">${esc(REFS[id].cite)}</a><p class="muted small">${esc(REFS[id].finding)}</p></div></div>`).join('')}
    <button class="btn block" data-a="close-sheet">Close</button>`);
}

const ctx = {
  get db() { return db; },
  ui, $, esc, toast, persist, render, openSheet, closeSheet, stepper, num, fmtDate, lineChart, refChips,
  replaceDb(next) { db = next; persist(); applyTheme(); render(); },
};
const food = createFood(ctx);
const year = createYear(ctx);
const extras = createExtras(ctx);

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
  if (!db) return;
  const screens = {
    today: screenToday, summary: screenSummary, history: screenHistory, body: screenBody, food: () => food.screen(),
    plan: screenPlan, settings: screenSettings, builder: screenBuilder, 'edit-session': screenEditSession,
  };
  $('#main').innerHTML = (screens[ui.tab] || screenToday)();
  const active = { summary: ui.summaryFresh ? 'today' : 'history', builder: 'plan', 'edit-session': 'history' }[ui.tab] || ui.tab;
  $('#tabs').innerHTML = TABS.map(([k, label, icon]) => `
    <button class="tab ${k === active ? 'on' : ''}" data-a="tab" data-tab="${k}" aria-current="${k === active ? 'page' : 'false'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span>
    </button>`).join('');
  renderRest();
}

// ---------- Events ----------

const actions = {
  tab: (d) => { if (!$('#sheet').hidden) closeSheet(); ui.summaryFresh = false; ui.tab = d.tab; if (d.tab === 'today') ui.summaryId = null; if (d.tab === 'history') ui.historyEx = null; window.scrollTo(0, 0); render(); },
  day: (d) => { ui.day = d.day; ui.tab = 'today'; ui.showCardio = false; render(); },
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
    food.afterStep(d.for);
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
  'show-cardio': () => { ui.showCardio = true; render(); },
  'start-empty': () => { if (db.activeSession) return toast('Finish or discard the current workout first.'); startSession(ui.day, true); render(); openPicker({ mode: 'session-add' }); },
  'session-add': () => openPicker({ mode: 'session-add' }),
  'ex-more': (d) => openExerciseMore(d.uid),
  'ex-note-save': (d) => { const sx = sessionFor(ui.day); sx.entries[d.uid].note = $('#ex-note').value.trim(); persist(); closeSheet(); render(); },
  'ex-move': (d) => {
    // Move past a whole neighbouring group so supersets stay together.
    const sx = sessionFor(ui.day); const o = sx.order; const i = o.indexOf(d.uid);
    const g = (u) => groupNum(sx.entries[u].group);
    o.splice(i, 1);
    if (+d.v > 0) {
      let j = i;
      if (j < o.length) { const ng = g(o[j]); while (j < o.length && g(o[j]) === ng) j++; }
      o.splice(j, 0, d.uid);
    } else {
      let j = i - 1;
      if (j >= 0) { const pg = g(o[j]); while (j >= 0 && g(o[j]) === pg) j--; }
      o.splice(j + 1, 0, d.uid);
    }
    persist(); closeSheet(); render();
  },
  'ex-remove': (d) => {
    const sx = sessionFor(ui.day); const e = sx.entries[d.uid];
    if (e.sets.some((x) => x.done) && !confirm('Remove this exercise and its logged sets from today?')) return;
    sx.order = sx.order.filter((u) => u !== d.uid); delete sx.entries[d.uid];
    if (!sx.freestyle) (sx.removed ||= []).push(d.uid);
    persist(); closeSheet(); render();
  },
  'ex-info': (d) => { closeSheet(); ui.historyEx = d.id; ui.tab = 'history'; window.scrollTo(0, 0); render(); },
  fb: (d) => { const e = sessionFor(ui.day).entries[d.uid]; e.feedback = e.feedback === d.v ? undefined : d.v; persist(); render(); },
  'fb-joint': (d) => { const e = sessionFor(ui.day).entries[d.uid]; e.joint = !e.joint; persist(); render(); },
  'plan-view': (d) => { ui.planView = d.v; render(); },
  'ref-sheet': (d) => openRefs(d.ids.split(',')),
  'share-session': async (d) => {
    const sx = db.sessions.find((x) => x.id === d.id);
    const lines = [`${fmtDate(sx.date)} — ${sx.freestyle ? 'Workout' : db.plan[sx.day]?.name || 'Workout'}`];
    for (const e of sx.entries) lines.push(`${e.name}: ${e.sets.filter((x) => !x.pain).map((x) => `${x.weight ? x.weight + '×' : ''}${x.reps}`).join(', ')}`);
    for (const p of sx.prs || []) lines.push(`🏆 ${p.name}: ${p.text}`);
    const text = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Copied to clipboard.'); }
    } catch {}
  },
  'edit-session': (d) => { ui.editId = d.id; ui.tab = 'edit-session'; window.scrollTo(0, 0); render(); },
  'es-del-set': (d) => {
    const sx = db.sessions.find((x) => x.id === ui.editId); readEditInputs(sx);
    sx.entries[+d.i].sets.splice(+d.j, 1);
    if (!sx.entries[+d.i].sets.length) sx.entries.splice(+d.i, 1);
    render();
  },
  'es-del-entry': (d) => { const sx = db.sessions.find((x) => x.id === ui.editId); readEditInputs(sx); sx.entries.splice(+d.i, 1); render(); },
  'es-save': () => {
    const sx = db.sessions.find((x) => x.id === ui.editId);
    readEditInputs(sx);
    const changed = recomputeSession(sx);
    persist(); ui.summaryId = sx.id; ui.summaryFresh = false; ui.tab = 'summary'; render();
    toast(changed.length ? `Saved. Targets updated for ${changed.length} exercise${changed.length > 1 ? 's' : ''}.` : 'Saved.');
  },
  'es-delete': () => {
    const sx = db.sessions.find((x) => x.id === ui.editId);
    if (!confirm('Delete this workout permanently?')) return;
    safetySnapshot(db, 'Before deleting a workout');
    // Undo its effect on targets where it was the latest workout for an exercise.
    for (const [exId, prev] of Object.entries(sx.stateBefore || {})) {
      if (!isLatestFor(sx, exId)) continue;
      if (prev) db.state[exId] = prev; else delete db.state[exId];
    }
    db.sessions = db.sessions.filter((x) => x !== sx);
    persist(); ui.tab = 'history'; render(); toast('Workout deleted.');
  },
  'open-builder': () => openBuilder(),
  'welcome-sample': () => { db.settings.welcomed = true; persist(); render(); },
  'b-exit': () => { ui.b = null; ui.tab = 'plan'; render(); },
  'b-next': () => { ui.b.step = Math.min(B_STEPS.length - 1, ui.b.step + 1); window.scrollTo(0, 0); render(); },
  'b-back': () => { ui.b.step = Math.max(0, ui.b.step - 1); window.scrollTo(0, 0); render(); },
  'b-step': (d) => { ui.b.step = +d.v; window.scrollTo(0, 0); render(); },
  'b-set': (d) => {
    const p = ui.b.draft;
    if (d.multi) {
      const arr = new Set(p[d.k] || []);
      if (arr.has(d.v)) arr.delete(d.v); else arr.add(d.v);
      p[d.k] = [...arr];
    } else p[d.k] = d.k === 'sessionMin' ? +d.v : d.v || (d.k === 'weightGoal' ? null : '');
    render();
  },
  'b-days': (d) => {
    ui.b.draft[d.k] = +d.v;
    if (d.k === 'liftDays') ui.b.liftEdited = true; else ui.b.cardioEdited = true;
    render();
  },
  'b-suggested': () => { ui.b.liftEdited = false; ui.b.cardioEdited = false; ui.b.splitEdited = false; render(); },
  'b-split': (d) => { ui.b.draft.split = d.v; ui.b.splitEdited = true; render(); },
  'b-apply': () => applyBuilt(),
  'b-ref': (d) => {
    const det = $('details.refs');
    if (det) det.open = true;
    $(`#ref-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  'undo-plan': () => {
    const prev = db.previousPlan;
    if (!prev || !confirm('Switch back to your previous plan? (You can switch again afterwards.)')) return;
    db.previousPlan = { plan: db.plan, dayModes: { ...db.settings.dayModes }, deloadEvery: db.settings.deloadEvery, savedAt: Date.now() };
    db.plan = prev.plan;
    db.settings.dayModes = prev.dayModes;
    db.settings.deloadEvery = prev.deloadEvery;
    persist(); render(); toast('Previous plan restored.');
  },
  'add-lift-day': () => {
    const day = ui.planDay;
    db.plan[day] = { name: 'Custom', items: [] };
    db.settings.dayModes[day] = 'lift';
    persist(); render();
  },
  'edit-day-mode': (d) => { ui.planDay = d.day; ui.tab = 'plan'; window.scrollTo(0, 0); render(); },
  'day-mode': (d) => {
    db.settings.dayModes[ui.planDay] = d.v;
    persist(); render();
    toast(`${FULL_DAY[ui.planDay]}s are now ${MODE_LABELS[d.v].toLowerCase()} days.`);
  },
  'cardio-log': (d) => openCardioSheet(d.id),
  'cardio-all': (d) => openCardioAll(d.day),
  rpe: (d, el) => {
    sheetState.rpe = d.v === '–' ? null : +d.v;
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  'cardio-save': (d) => {
    const minutes = Math.round(num('c-min') || 0);
    if (!minutes) return toast('Enter minutes.');
    const entry = { id: `c${Date.now()}`, date: todayStr(), ts: Date.now(), cardioId: d.id, minutes };
    const dist = num('c-dist');
    if (dist) entry.distance = dist;
    if (sheetState.rpe != null) entry.rpe = sheetState.rpe;
    const note = $('#c-note').value.trim();
    if (note) entry.note = note;
    db.cardio.push(entry);
    persist(); closeSheet(); render(); haptic();
    toast(`Logged ${CARDIO[d.id].name}, ${minutes} min.`);
  },
  'cardio-del': (d) => {
    if (!confirm('Delete this cardio entry?')) return;
    db.cardio = db.cardio.filter((c) => c.id !== d.id);
    persist(); render();
  },
  summary: (d) => { ui.summaryId = d.id; ui.summaryFresh = false; ui.tab = 'summary'; window.scrollTo(0, 0); render(); },
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
  'plan-add': () => openPicker({ mode: 'add' }),
  'plan-swap': (d) => {
    const it = db.plan[ui.planDay].items[+d.i];
    const resolved = resolveDay(db, ui.planDay).find((r) => r.uid === it.uid);
    openPicker({ mode: 'plan-swap', uid: it.uid, currentId: resolved?.exerciseId || it.exerciseId });
  },
  'browse-bank': () => openPicker({ mode: 'browse' }),
  swap: (d) => {
    const s = sessionFor(ui.day);
    if (!s && db.activeSession) return toast(`Finish or discard the ${DAY_NAMES[db.activeSession.day]} workout first.`);
    const cur = s?.entries[d.uid]?.exerciseId || resolveDay(db, ui.day).find((i) => i.uid === d.uid)?.exerciseId;
    openPicker({ mode: 'swap', uid: d.uid, currentId: cur });
  },
  'pk-scope': (d, el) => {
    picker.scope = d.v;
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  'pk-cat': (d, el) => {
    picker.cat = d.v;
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
    renderPickerList();
  },
  'pk-custom': () => openPlanEdit(-1),
  'pk-hidden': () => { picker.showHidden = !picker.showHidden; renderPickerList(); },
  pick: (d) => {
    const ex = db.exercises[d.id];
    if (picker.mode === 'browse') { closeSheet(); ui.tab = 'history'; ui.historyEx = d.id; window.scrollTo(0, 0); render(); return; }
    if (picker.mode === 'add') { closeSheet(); setTimeout(() => addPlanItem(d.id), 200); return; }
    if (picker.mode === 'session-add') { addToSession(d.id); closeSheet(); render(); toast(`Added ${ex.name}.`); return; }
    if (picker.mode === 'plan-swap') {
      swapInPlan(ui.planDay, picker.uid, d.id);
      closeSheet(); render(); toast(`${DAY_NAMES[ui.planDay]} plan now uses ${ex.name}.`);
      return;
    }
    // From today's workout
    const entry = sessionFor(ui.day)?.entries[picker.uid];
    if (entry && !entry.pain && entry.sets.some((x) => x.done)
      && !confirm(`Keep your logged ${db.exercises[entry.exerciseId].name} sets and add ${ex.name} after them?`)) return;
    if (picker.scope === 'plan') swapInPlan(ui.day, picker.uid, d.id);
    if (picker.scope === 'today' || sessionFor(ui.day)) swapInSession(picker.uid, d.id);
    closeSheet(); render();
    toast(picker.scope === 'plan' ? `Swapped to ${ex.name} (plan updated).` : `Swapped to ${ex.name} for today.`);
  },

  'pe-save': (d) => savePlanEdit(+d.i),
  mus: (d, el) => { el.classList.toggle('on'); el.setAttribute('aria-pressed', el.classList.contains('on')); },
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
  'reset-plan': () => {
    if (!confirm('Restore the default plan? History and targets are kept.')) return;
    safetySnapshot(db, 'Before restoring default plan');
    db.plan = defaultPlan(); persist(); toast('Default plan restored.');
  },
};

Object.assign(actions, food.actions, year.actions, extras.actions);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = actions[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const a = el.dataset?.a;
  if (el.id === 'import-file' || el.id === 'photo-file') { extras.onChange(e); return; }
  if (food.onChange(e) || year.onChange(e)) return;
  if (el.id === 'session-note') { const sx = db.sessions.find((x) => x.id === el.dataset.sid); if (sx) { sx.note = el.value.trim(); persist(); } return; }
  if (el.dataset?.bgoal && ui.b) { render(); return; }
  if (a === 'pk-muscle') { picker.muscle = el.value; renderPickerList(); return; }
  if (a === 'pe-ex') { $('#pe-new').hidden = el.value !== '__new'; fillMeta(el.value); return; }
  if (a === 'plan-name') { db.plan[ui.planDay].name = el.value.trim() || db.plan[ui.planDay].name; persist(); return; }
  if (a === 'def-inc') { const v = parseFloat(el.value); if (v > 0) { db.settings.defaultIncrements[el.dataset.k] = v; persist(); } return; }
  if (el.type === 'checkbox' && actions[a]) actions[a](el.dataset, el);
});

document.addEventListener('input', (e) => {
  if (food.onInput(e)) return;
  if (e.target.id === 'pk-q') { picker.q = e.target.value; renderPickerList(); }
  if (e.target.dataset?.b && ui.b) builderInput(e.target);
  if (e.target.dataset?.bgoal && ui.b) {
    ui.b.draft.goals[e.target.dataset.bgoal] = +e.target.value;
    const lbl = $(`#gv-${e.target.dataset.bgoal}`);
    if (lbl) lbl.textContent = e.target.value;
  }
});

$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
$('#rest-minus').addEventListener('click', () => adjustRest(-15));
$('#rest-plus').addEventListener('click', () => adjustRest(15));
$('#rest-skip').addEventListener('click', stopRest);
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderRest(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// Ask iOS to keep our storage (helps avoid eviction where supported).
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
}

onSaveError(() => toast('Could not save — storage may be full. Export a backup.'));

(async () => {
  db = await loadDb();
  applyTheme();
  render();
  if (rest) runRest();
  if (db.activeSession) keepAwake();
  dailySnapshot(db);
  // Ask once to keep data permanently (granted more readily for Home Screen apps).
  if (!db.settings.persistAsked) { db.settings.persistAsked = true; persist(); requestPersistence(); }
})();
