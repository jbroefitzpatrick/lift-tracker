import { loadDb, LoadError, allowReplace, download, save, onSaveError, dailySnapshot, safetySnapshot, requestPersistence, todayStr, mondayOf, parseDate, setWeekStart, weekOrder, weekPos, dateOfDay, daysBetween, addDays } from './store.js';
import { onReorder, setAnnouncer } from './drag.js';
import { icon } from './icons.js';
import { EX_INFO } from './exercise-info.js';
import { blockInfo, focusFor, liftProgress, checkinDue, planCompounds, adherence } from './blocks.js';
import { TEMPLATES, TEMPLATE_KINDS, templateItems, fmtTarget, METRIC_FIELDS } from './conditioning.js';
import { METRICS, sideNote } from './bank.js';
import { TYPES, ROW_ROTATION, defaultPlan } from './plan.js';
import {
  DAY_KEYS, DAY_NAMES, dayKeyOf, weekInfo, needsRotationPrompt, nextRowCompound, resolveDay,
  targetsFor, getState, painWarning, evaluate, groupNum, e1rm, roundTo, dayPlan, weekOverride,
} from './engine.js';
import { lineChart } from './chart.js';
import { MUSCLES, CATEGORIES, PATTERNS, similarExercises, similarity } from './bank.js';
import { CARDIO, INTENSITY, MODALITIES } from './cardio-bank.js';
import { suggestCardio } from './cardio.js';
import { currentFatigue, freshness, dayMode, MUSCLE_GROUPS, liftLoads } from './fatigue.js';
import { bodyPair, bodySvg, muscleIcon } from './body.js';
import {
  GOALS, EXPERIENCE, EQUIPMENT, LIMITS, WEIGHT_GOALS, WEEK_LAYOUT, VOLUME_MUSCLES, defaultProfile, prescription, suggestDays,
  splitOptions, generatePlan, goalWeights, suggestedWeightGoal, volumeTarget, fmtSec,
} from './builder.js';
import { REFS } from './science.js';
import { activeGym, roundToGym, plateText, warmupSets, isAvailable, GEAR_NAMES } from './gym.js';
import { detectPRs, applyCheckins } from './records.js';
import { activePhase, PHASE_TYPES, cardioTargetFor, suggestYear } from './year.js';
import { goalFor } from './nutrition.js';
import { weeklySets, estimateMinutes } from './builder.js';
import { createFood } from './ui-food.js';
import { createYear } from './ui-year.js';
import { createExtras } from './ui-extra.js';
import { createCloud } from './ui-cloud.js';
import { createAccountUi } from './ui-account.js';
import { createPeople } from './ui-people.js';
import { moveDay } from './week.js';
import { scheduleRest, cancelRest } from './push.js';
import { account } from './account.js';
import { cloudReady } from './cloud.js';
import { workoutBurn, cardioBurn, workoutMinutes } from './energy.js';
import { createPain } from './ui-pain.js';
import { LEVELS as PAIN_LEVELS, JOINTS, activePain, areaLabel } from './pain.js';
import { sideOf } from './body.js';
import { GROUPS, PARTS, groupById, groupOfMuscle, groupFreshness, weeklySets as setsByPart } from './groups.js';
import { hoursToReady } from './fatigue.js';
import { createTrain } from './ui-train.js';
import { condScore, condHistory } from './conditioning.js';
import { goalWeek } from './running.js';
import { liftTemplates, doneTemplates } from './week.js';
import { targets as foodTargets, dayTotals } from './nutrition.js';
import { VARIETY, applyVariety } from './variety.js';
import { initSwipe, initPullDown, initSideSwipe } from './swipe.js';
import { createFocus } from './ui-focus.js';
import { createExerciseEditor } from './ui-exercise.js';
import { CORE_PLACEMENTS, applyCore, coreCircuit } from './core.js';
import { PROGRESSIONS, recommendScheme, schemeFor } from './engine.js';
import { dayExtras, setDayExtra, warmupItems, cooldownItems, shuffleWarmup } from './warmcool.js';
import { weekReview, applySuggestion, lastWeekStart, muscleWork, addOptions } from './review.js';
import { createTour } from './tour.js';
import { initGestures } from './gestures.js';
import { setUnit, wUnit, toDisp, fromDisp, wt, KG_GYM, LB_GYM, weightStepper } from './units.js';
import { adjustDay } from './week.js';
import { splitTemplates, mainLiftOptions } from './builder.js';
import { createPlanTools, keepManual, countManual } from './ui-plantools.js';
import { GOALS as MGOALS, applyGoals } from './goals.js';
import { warmupMinutes } from './warmcool.js';
import { createHealth } from './health.js';
import { morph } from './morph.js';
import { createProgressScreens } from './screen-progress.js';
import { createWorkoutScreens } from './screen-workout.js';
import { createPlanScreens } from './screen-plan.js';
import { createBuilderScreens } from './screen-builder.js';

// ---------- Split modules: live access to app state ----------
const A = {
  get $() { return $; },
  todayStrNow: () => todayStr(),
  get peopleOn() { return peopleOn; },
  latestBodyweight: () => { const l = [...(db.bodyweight || [])].sort((a, b) => a.date.localeCompare(b.date)); return l.length ? l[l.length - 1].weight : null; },
  get bodyRegion() { return bodyRegion; },
  get cardioHistory() { return cardioHistory; },
  get db() { return db; }, set db(v) { db = v; },
  get esc() { return esc; },
  get extras() { return extras; },
  get fmtDate() { return fmtDate; },
  get fmtW() { return fmtW; },
  get foodOn() { return foodOn; },
  get freshnessCard() { return freshnessCard; },
  get muscleLine() { return muscleLine; },
  get stepper() { return stepper; },
  get subHeader() { return subHeader; },
  get ui() { return ui; },
  get $() { return $; },
  get FULL_DAY() { return FULL_DAY; },
  get GRIP() { return GRIP; },
  get MODE_LABELS() { return MODE_LABELS; },
  get blockCheckinBanner() { return blockCheckinBanner; },
  get canReopen() { return canReopen; },
  get cardModel() { return cardModel; },
  get cardioSection() { return cardioSection; },
  get defaultDay() { return defaultDay; },
  get doneTodayCard() { return doneTodayCard; },
  get ensureSession() { return ensureSession; },
  get fmtRest() { return fmtRest; },
  get health() { return health; },
  get helpBtn() { return helpBtn; },
  get isDeloadFor() { return isDeloadFor; },
  get metricOf() { return metricOf; },
  get openSheet() { return openSheet; },
  get pain() { return pain; },
  get refChips() { return refChips; },
  get reviewCard() { return reviewCard; },
  get saveBlockedBanner() { return saveBlockedBanner; },
  get screenHistory() { return screenHistory; },
  get sessionFor() { return sessionFor; },
  get sessionItems() { return sessionItems; },
  get skippedPrompt() { return skippedPrompt; },
  get syncSession() { return syncSession; },
  get targetOf() { return targetOf; },
  get train() { return train; },
  get $() { return $; },
  get blockCard() { return blockCard; },
  get closeSheet() { return closeSheet; },
  get num() { return num; },
  get persist() { return persist; },
  get regionOf() { return regionOf; },
  get render() { return render; },
  get toast() { return toast; },
  get year() { return year; },
  get $() { return $; },
  get ask() { return ask; },
};
const { liftDayKeys, builderCompounds, builderFocus, B_STEPS, BUILD_LABELS, openBuilder, refLinks, REF_ORDER, refNum, builderState, recommendProgression, progressionList, helpBtn, bChips, screenBuilder, SPLIT_DAY_NAMES, splitDayName, reviewHtml, retargetWeights, applyBuilt, builderInput } = createBuilderScreens(A);
const { builderEntry, planViewTabs, subHeader, screenPlan, planWeek, planProgram, planDay, openPlanEdit, muscleChips, chosenMuscles, fillMeta, savePlanEdit } = createPlanScreens(A);
const { dayTabs, rirTarget, plannedFor, plannedRaw, rank, todayItems, groupsOf, linkLabel, thumb, screenToday, targetMuscles, exerciseRow, exerciseFull, setsLeft, comingUp, fmtElapsed, workoutBar, openWhyWorkout, screenExercise, warmBlock, warmFor, defaultWarm, SET_TYPES, setHead, liftRows, condRows, relabel, openMuscleWork, STATUS, screenSummary, isLatestFor, recomputeSession, screenEditSession, readEditInputs, openBackfill } = createWorkoutScreens(A);
const { ring, weekStats, weekStrip, weekStreak, bestStreak, calendarCard, weekRingsCard, KEY_SLOTS, liftStats, sparkSvg, pctText, keyLifts, keyTile, median, groupLifts, strengthPage, strengthGroupPage, latestBodyweight, exerciseHistory, screenHistory, progressPage, screenExerciseHistory, bwStats, screenBody } = createProgressScreens(A);

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
// After each save, sync is scheduled (when signed in to an account).
let afterPersist = null;
const persist = () => { if (!save(db)) toast('Could not save — storage may be full.'); afterPersist?.(); };
// iPhone ignores the vibration call; toggling a hidden switch control gives a light tap (iOS 18+).
let tapLabel = null;
function iosTap() {
  if (!tapLabel) {
    tapLabel = document.createElement('label');
    tapLabel.setAttribute('aria-hidden', 'true');
    tapLabel.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    const sw = document.createElement('input');
    sw.type = 'checkbox'; sw.setAttribute('switch', ''); sw.tabIndex = -1;
    tapLabel.appendChild(sw);
    document.body.appendChild(tapLabel);
  }
  tapLabel.click();
}
const haptic = (ms = 15) => { try { if (navigator.vibrate) navigator.vibrate(ms); else iosTap(); } catch {} };

function defaultDay() {
  return dayKeyOf(todayStr());
}

function fmtW(w, ex) {
  if (w == null) return 'TBD';
  if (ex?.type === 'bodyweight') return w === 0 ? 'BW' : `BW+${toDisp(w)}`;
  return wt(w);
}

function fmtRest(sec) {
  if (!sec) return '';
  if (sec < 120) return `${sec} sec`;
  return sec % 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec / 60} min`;
}

function fmtLast(last, ex) {
  if (!last) return '';
  const same = last.weights.every((w) => w === last.weights[0]);
  if (same) return `${last.reps.join(' · ')} @ ${fmtW(last.weights[0], ex)}`;
  return last.reps.map((r, i) => `${r}×${fmtW(last.weights[i], ex).replace(` ${wUnit()}`, '')}`).join(', ');
}

function fmtDate(s) {
  return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function toast(msg, act = null) {
  const t = $('#toast');
  t.textContent = msg;
  if (act) {
    const b = document.createElement('button');
    b.className = 'toast-act'; b.dataset.a = act.a; b.textContent = act.label;
    t.append(' ', b);
  }
  t.classList.toggle('has-act', !!act);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, act ? 5000 : 3200);
}

// ---------- Theme ----------

function applyTheme() {
  const t = db.settings.theme;
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#0c0e12' : '#f5f6f8');
  // Color accents: ember for achievements and a glow on each screen's main card (default),
  // or settings.colorStyle with any of ember, wash, region, flow ('' for none).
  const style = String(db.settings.colorStyle ?? 'ember wash').split(/\s+/).filter(Boolean);
  for (const c of [...document.body.classList]) if (c.startsWith('c-')) document.body.classList.remove(c);
  for (const c of style) document.body.classList.add(`c-${c}`);
  if (style.includes('flow') && !document.getElementById('color-defs')) {
    document.body.insertAdjacentHTML('beforeend', `<svg id="color-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="g-lift" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7aa2ff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
      <linearGradient id="g-cardio" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#facc15"/></linearGradient>
      <linearGradient id="g-protein" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
      <linearGradient id="g-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7aa2ff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs></svg>`);
  }
}
// Body region of a muscle (push, pull, legs or core), for the region color accents.
const bodyRegion = (m) => REGION[m] || 'legs';

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
// Work interval: counts down, then logs the set (which starts the rest automatically).
let workDone = null;
function startWork(sec, label, onDone) {
  workDone = onDone;
  rest = { endAt: Date.now() + sec * 1000, total: sec, label, work: true };
  runRest();
}
function stopRest() {
  workDone = null;
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
      if (rest.work && workDone) {
        const cb = workDone;
        workDone = null; rest = null; clearInterval(restTick);
        beep(); haptic([200, 100, 200]);
        cb();
        return;
      }
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

// How a move is measured: your Reps/Time choice for it, then the plan's, as long as the
// exercise allows it (a swapped-in stretch is timed even if the drill it replaced counted reps).
function metricOf(item) {
  const ex = db.exercises[item.exerciseId];
  const allowed = ex?.modes?.length ? ex.modes : [ex?.metric || 'reps'];
  if (ex?.metricPref && allowed.includes(ex.metricPref)) return ex.metricPref;
  if (item.metric && allowed.includes(item.metric)) return item.metric;
  return allowed[0];
}
const DEFAULT_TARGET = { time: 30, reps: 10, distance: 200, cal: 10 };
// The planned target, unless it was set for a different measure.
const targetOf = (item, metric) => (item.metric === metric || (!item.metric && metric === (db.exercises[item.exerciseId]?.metric || 'reps')) ? item.target : null) ?? DEFAULT_TARGET[metric];

function makeEntry(item, isDeload) {
  const metric = metricOf(item);
  if (metric !== 'reps' || db.exercises[item.exerciseId]?.category === 'conditioning') {
    // Conditioning: sets are rounds measured in time, distance, calories or reps.
    const n = isDeload ? Math.ceil(item.sets / 2) : item.sets;
    const key = METRIC_FIELDS[metric][0][0];
    const target = targetOf(item, metric);
    return {
      uid: item.uid, exerciseId: item.exerciseId, group: item.group, repMin: item.repMin, repMax: item.repMax,
      restSec: item.restSec, metric, target, phase: item.phase, dropSet: false, pain: false, painFree: false,
      sets: Array.from({ length: n }, () => ({ [key]: target ?? null, rir: null, done: false, pain: false })),
    };
  }
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
    scheme: t.scheme !== 'double' ? t.scheme : undefined,
    ...(t.ratios ? { ratios: t.ratios } : {}),
    ...(t.fixedLadder ? { fixedLadder: true } : {}),
    dropSet: false,
    pain: false,
    painFree: false,
    // Percentage cycles, top sets and pyramids plan each set's weight; the other schemes repeat one weight.
    sets: t.setWeights
      ? t.setWeights.map((w, i) => newSet(roundToGym(db.exercises[item.exerciseId], w, activeGym(db)), t.setReps[i]))
      : Array.from({ length: t.sets }, () => newSet(weight, t.reps)),
  };
}

// Add entries for exercises added to the plan after the workout started.
function syncSession(session, items) {
  if (session.freestyle) return;
  let changed = false;
  for (const item of items) {
    if (session.entries[item.uid] || session.removed?.includes(item.uid)) continue;
    session.entries[item.uid] = makeEntry(item, session.isDeload);
    // A warm-up added mid-workout goes first (after any warm-up already there); the rest go last.
    if (item.phase === 'warmup') {
      let at = 0;
      while (at < session.order.length && session.entries[session.order[at]]?.phase === 'warmup') at++;
      session.order.splice(at, 0, item.uid);
    } else session.order.push(item.uid);
    changed = true;
  }
  if (changed) persist();
}

// A freestyle session starts empty (travel days, unplanned workouts); exercises are added as you go.
function startSession(day, freestyle = false) {
  const isDeload = freestyle ? false : isDeloadFor(day);
  const items = freestyle ? [] : plannedFor(day);
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
const nextGroupSize = (session, uid) => session.order.filter((u) => groupNum(session.entries[u].group) === groupNum(session.entries[uid].group)).length;

// Where to go after logging a set in a superset or circuit: the next exercise in this round,
// then (after the rest) the first exercise with a set left in the next round. Exercises with
// fewer sets drop out of later rounds. When the whole group is done: the next exercise after it.
function nextInCircuit(session, uid, idx) {
  const entry = session.entries[uid];
  const g = groupNum(entry.group);
  const members = session.order.filter((u) => groupNum(session.entries[u].group) === g && !session.entries[u].pain);
  if (members.length < 2) return null;
  const open = (u, r) => { const s = session.entries[u].sets[r]; return !!s && !s.done && !s.pain; };
  const pos = members.indexOf(uid);
  for (let k = pos + 1; k < members.length; k++) if (open(members[k], idx)) return { uid: members[k], round: idx, sameRound: true };
  const rounds = Math.max(...members.map((u) => session.entries[u].sets.length));
  for (let r = idx + 1; r < rounds; r++) for (const u of members) if (open(u, r)) return { uid: u, round: r };
  // Anything skipped earlier in the group.
  for (const u of members) { const r = session.entries[u].sets.findIndex((s) => !s.done && !s.pain); if (r >= 0) return { uid: u, round: r }; }
  // Group finished: the next exercise in the workout with sets left.
  const last = Math.max(...members.map((u) => session.order.indexOf(u)));
  const after = session.order.slice(last + 1).find((u) => { const e = session.entries[u]; return !e.pain && e.sets.some((s) => !s.done); });
  return after ? { uid: after, round: 0, groupDone: true } : { groupDone: true, end: true };
}

// When an exercise (or every exercise in its superset/circuit) is finished, it moves up to just
// before the first unfinished one in the same section, so what's left is always below what's done.
// Warm-up, workout and cool-down are reordered separately.
function settleDone(session, uid) {
  const e = session.entries[uid];
  if (!e) return;
  const phaseOf = (u) => session.entries[u]?.phase || 'main';
  const done = (u) => { const x = session.entries[u]; return !x || x.pain || x.sets.every((st) => st.done); };
  const g = groupNum(e.group);
  const members = session.order.filter((u) => groupNum(session.entries[u]?.group) === g && phaseOf(u) === phaseOf(uid));
  if (!members.every(done)) return;
  const firstOpen = session.order.find((u) => phaseOf(u) === phaseOf(uid) && !members.includes(u) && !done(u));
  if (!firstOpen || session.order.indexOf(members[0]) < session.order.indexOf(firstOpen)) return;
  session.order = session.order.filter((u) => !members.includes(u));
  session.order.splice(session.order.indexOf(firstOpen), 0, ...members);
}

function maybeRest(session, uid, setIndex) {
  const entry = session.entries[uid];
  const g = groupNum(entry.group);
  const members = session.order.map((u) => session.entries[u]).filter((e) => groupNum(e.group) === g);
  const roundDone = members.every((m) => m.pain || setIndex >= m.sets.length || m.sets[setIndex].done);
  if (!roundDone) return;
  // Exercise (or the whole superset/circuit) finished: no rest, straight on to the next thing.
  if (members.every((m) => m.pain || m.sets.every((x) => x.done))) { stopRest(); return; }
  const allDone = session.order.every((u) => {
    const e = session.entries[u];
    return e.pain || e.sets.every((s) => s.done);
  });
  if (allDone) { stopRest(); return; }
  const sec = Math.max(...members.map((m) => m.restSec || 0));
  const nx = members.length > 1 ? nextInCircuit(session, uid, setIndex) : null;
  const nextEx = nx?.uid ? db.exercises[session.entries[nx.uid].exerciseId] : null;
  const label = nextEx ? `Rest · next: ${nextEx.name}, set ${nx.round + 1}` : members.length > 1 ? `Rest · round ${setIndex + 1} done` : 'Rest';
  startRest(sec, label);
}

function prefillFollowing(entry, fromIdx) {
  if (entry.fixedLadder || entry.scheme === 'wave') return; // each set has its own planned weight
  const src = entry.sets[fromIdx];
  const ex = db.exercises[entry.exerciseId];
  const st = getState(db, entry.exerciseId);
  for (let j = fromIdx + 1; j < entry.sets.length; j++) {
    const s = entry.sets[j];
    if (s.done) continue;
    if (entry.dropSet) {
      s.weight = Math.max(0, src.weight - 10 * (j - fromIdx));
      if (st.last?.reps[j]) s.reps = st.last.reps[j];
    } else s.weight = followWeight(entry, ex, src.weight, fromIdx, j);
  }
}

// Weight for a later set when an earlier one changes: same weight, or the planned ratio
// for top-set and pyramid schemes (back-offs ~90%, each pyramid step ~10% lighter).
function followWeight(entry, ex, w, from, j) {
  if (!entry.ratios || entry.ratios[from] == null || entry.ratios[j] == null) return w;
  return roundToGym(ex, (w * entry.ratios[j]) / entry.ratios[from], activeGym(db));
}

function resumeSession(s = db.activeSession) {
  if (!s?.pausedAt) return;
  s.pausedMs = (s.pausedMs || 0) + (Date.now() - s.pausedAt);
  delete s.pausedAt;
  keepAwake();
}

function logSet(uid, idx, vals) {
  const session = sessionFor(ui.day);
  resumeSession(session); // logging a set picks the workout back up
  const entry = session.entries[uid];
  Object.assign(entry.sets[idx], vals, { done: true });
  prefillFollowing(entry, idx);
  persist();
  haptic();
  maybeRest(session, uid, idx);
  settleDone(session, uid);
  persist();
  render();
  // On the exercise screen, move through the superset/circuit automatically, after a short beat
  // so the logged set registers before the next exercise slides in.
  if (ui.tab === 'exercise' && ui.exUid === uid && db.settings.autoAdvance !== false) {
    const nx = nextInCircuit(session, uid, idx);
    if (nx?.uid) {
      clearTimeout(logSet.adv);
      logSet.adv = setTimeout(() => {
        if (ui.tab !== 'exercise' || ui.exUid !== uid || db.activeSession !== session) return;
        ui.backUid = uid;
        ui.exUid = nx.uid;
        window.scrollTo(0, 0);
        const name = db.exercises[session.entries[nx.uid]?.exerciseId]?.name || 'next exercise';
        toast(nx.groupDone ? `${linkLabel(nextGroupSize(session, uid))} done. Next: ${name}` : `${nx.sameRound ? 'Next' : 'After the rest'}: ${name}, set ${nx.round + 1}`);
        render();
      }, 550);
    }
  }
}

function saveEntrySets(e) {
  return e.sets.filter((x) => x.done || x.pain).map((x) => {
    const o = { weight: x.weight, reps: x.reps };
    for (const k of ['time', 'dist', 'cal']) if (x[k] != null) o[k] = x[k];
    if (x.rir != null) o.rir = x.rir;
    if (x.type) o.type = x.type;
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

// A workout finished today can be reopened (until midnight), unless another one is under way.
function canReopen(id) {
  const lf = db.lastFinish;
  return !!lf && lf.date === todayStr() && !db.activeSession && (!id || lf.id === id) && db.sessions.some((x) => x.id === lf.id);
}

function finishWorkout() {
  const s = db.activeSession;
  if (!s) return;
  resumeSession(s);
  const finishedAt = Date.now();
  // Everything finishing changes, so "Resume workout" can put it all back (same day only).
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const reopen = { active: clone(s), state: clone(db.state), plan: clone(db.plan), week: clone(db.week), runGoal: clone(db.runGoal), recoveryAdjust: clone(db.recoveryAdjust) };
  const results = [];
  const entries = [];
  const stateBefore = {}; // lets a later edit of this workout redo the progression math
  const prs = [];
  for (const uid of s.order) {
    const e = s.entries[uid];
    const ex = db.exercises[e.exerciseId];
    if (!(e.exerciseId in stateBefore)) stateBefore[e.exerciseId] = db.state[e.exerciseId] ? JSON.parse(JSON.stringify(db.state[e.exerciseId])) : null;
    if (!s.isDeload && !e.metric && ex.category !== 'conditioning') for (const pr of detectPRs(db, { ...e, sets: e.sets.filter((x) => x.done && x.type !== 'w') }, finishedAt)) prs.push({ exerciseId: e.exerciseId, name: ex.name, ...pr });
    if (e.metric || ex.category === 'conditioning') {
      const metric = e.metric || ex.metric || 'reps';
      const done = e.sets.filter((x) => x.done);
      const sc = condScore(metric, done);
      results.push({ exerciseId: e.exerciseId, name: ex.name, status: done.length ? 'logged' : 'skipped', group: e.group, message: `${done.length} ${done.length === 1 ? 'round' : 'rounds'}${sc && !sc.weak ? ` · ${sc.label}` : ''}` });
      // Conditioning records: best average time over the same distance, most calories or reps.
      if (sc && !sc.weak && ex.pattern !== 'mobility') {
        const hist = condHistory(db, e.exerciseId, metric, e.target, finishedAt);
        if (hist.length) {
          const best = hist.reduce((a, h) => (sc.lower ? Math.min(a, h.score.value) : Math.max(a, h.score.value)), hist[0].score.value);
          if (sc.lower ? sc.value < best - 0.05 : sc.value > best) prs.push({ exerciseId: e.exerciseId, name: ex.name, type: 'conditioning', text: `${sc.label}, best yet (was ${sc.lower ? `${best.toFixed(1)} s` : `${Math.round(best)} ${sc.unit}`})` });
        }
      }
      // A 5k time trial updates the running goal's paces.
      if (e.exerciseId === 'run-5k' && db.runGoal && done[0]?.time > 600) db.runGoal.trials = [...(db.runGoal.trials || []), { date: s.date, sec: done[0].time }];
    } else {
      const working = e.sets.filter((x) => x.type !== 'w');
      const { result, state } = evaluate(db, working.length ? { ...e, sets: working } : e, s);
      if (state) db.state[e.exerciseId] = state;
      results.push({ ...result, group: e.group });
    }
    const sets = saveEntrySets(e);
    if (sets.length) {
      entries.push({
        uid, exerciseId: e.exerciseId, name: ex.name, group: e.group, repMin: e.repMin, repMax: e.repMax,
        dropSet: e.dropSet || undefined, pain: e.pain || undefined, painFree: e.painFree || undefined,
        excluded: e.pain || s.isDeload || undefined, sets, metric: e.metric || undefined, target: e.target ?? undefined, rpe: e.rpe ?? undefined,
        feedback: e.feedback || undefined, joint: e.joint || undefined, note: e.note || undefined,
      });
    }
  }
  const saved = {
    id: s.id, date: s.date, day: s.day, isDeload: s.isDeload, freestyle: s.freestyle || undefined,
    startedAt: s.startedAt, finishedAt, pausedMs: s.pausedMs || undefined, entries, results, prs, stateBefore,
  };
  const o = !s.freestyle ? weekOverride(db, s.day) : null;
  if (o?.from) saved.templates = o.from;
  // Split day: the second half becomes the day's workout.
  if (o?.later?.length) { o.items = o.later; delete o.later; o.name = `${o.name} (part 2)`; }
  saved.adjustments = applyCheckins(db, saved, weeklyCapReached);
  // Conditioning work counts toward the week's cardio minutes.
  const isCond = (e) => db.exercises[e.exerciseId]?.category === 'conditioning';
  const light = (e) => ['mobility', 'prehab'].includes(db.exercises[e.exerciseId]?.pattern);
  // Warm-up and cool-down drills inside a lifting workout don't count as cardio.
  const condEntries = entries.filter((e) => isCond(e) && (!light(e) || entries.every(isCond)));
  if (condEntries.length) {
    const all = entries.reduce((a, e) => a + e.sets.length, 0);
    const cond = condEntries.reduce((a, e) => a + e.sets.length, 0);
    const minutes = Math.max(1, Math.round(((finishedAt - s.startedAt) / 60000) * (cond / Math.max(1, all))));
    // Label it by what it was: recovery work, easy running, or hard conditioning.
    const ids = condEntries.map((e) => e.exerciseId);
    const pats = condEntries.map((e) => db.exercises[e.exerciseId]?.pattern);
    const cardioId = pats.every((p) => p === 'mobility') ? 'mobility' : ids.every((id) => id === 'run-easy' || id === 'run-long') ? 'zone2-run' : 'conditioning';
    db.cardio.push({ id: `c${finishedAt}`, date: s.date, ts: finishedAt, cardioId, minutes, note: 'From workout', fromWorkout: true });
  }
  db.sessions.push(saved);
  db.lastFinish = { id: saved.id, date: s.date, finishedAt, reopen };
  db.activeSession = null;
  persist();
  stopRest();
  releaseAwake();
  ui.summaryId = saved.id;
  ui.summaryFresh = true;
  ui.tab = 'summary';
  render();
  cloud.auto('workout');
}


setInterval(() => { const el = document.getElementById('wb-time'); if (el && !el.dataset.paused) el.textContent = fmtElapsed(Date.now() - +el.dataset.start); }, 1000);



// ---------- Train: today's finished workout ----------
function doneTodayCard(day) {
  const done = db.sessions.filter((x) => x.date === todayStr() && x.day === day);
  if (!done.length) return '';
  const s = done[done.length - 1];
  const prs = s.prs?.length || 0;
  return `<button class="done-card" data-a="summary" data-id="${s.id}"><span class="done-check" aria-hidden="true">${icon('check')}</span><span class="grow"><b>Done today</b><span class="pick-sub">${Math.round(workoutMinutes(s))} min · ${s.entries.reduce((a, e) => a + e.sets.length, 0)} sets${prs ? ` · ${prs} record${prs === 1 ? '' : 's'}` : ''}</span></span>${icon('right', 'chev')}</button>`;
}

// ---------- Train: an exercise skipped three times running ----------
function skippedPrompt(day) {
  const plan = db.plan[day];
  if (!plan?.items?.length) return '';
  const recent = db.sessions.filter((x) => x.day === day && !x.freestyle).slice(-3);
  if (recent.length < 3) return '';
  const keep = db.settings.skipKeep || {};
  const it = plan.items.find((i) => !keep[i.uid] && db.exercises[i.exerciseId]?.category !== 'conditioning'
    && recent.every((x) => !x.entries.some((e) => e.uid === i.uid || e.exerciseId === i.exerciseId)));
  if (!it) return '';
  const name = db.exercises[it.exerciseId].name;
  return `<div class="slim-banner review-card"><span class="grow banner-main"><span class="dot" aria-hidden="true"></span><span><b>Skipped ${esc(name)}</b> the last 3 times</span></span><button class="btn sm" data-a="swap" data-uid="${it.uid}">Swap</button><button class="btn sm" data-a="skip-remove" data-uid="${it.uid}">Remove</button><button class="icon-btn subtle" data-a="skip-keep" data-uid="${it.uid}" aria-label="Keep it">${icon('x')}</button></div>`;
}

// ---------- Quick start: three questions to a plan ----------
const QB_GOALS = {
  muscle: { label: 'Build muscle', goals: { strength: 2, hypertrophy: 5, physique: 2, stamina: 0, endurance: 1, fatLoss: 0 } },
  strength: { label: 'Get stronger', goals: { strength: 5, hypertrophy: 3, physique: 0, stamina: 0, endurance: 1, fatLoss: 0 } },
  fat: { label: 'Lose fat', goals: { strength: 2, hypertrophy: 3, physique: 1, stamina: 1, endurance: 2, fatLoss: 5 }, weightGoal: 'lose' },
  general: { label: 'Get fit overall', goals: { strength: 3, hypertrophy: 3, physique: 0, stamina: 2, endurance: 3, fatLoss: 1 } },
};
const QB_EQUIP = { gym: { label: 'Full gym', eq: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] }, db: { label: 'Dumbbells', eq: ['dumbbell', 'bodyweight'] }, bw: { label: 'Bodyweight', eq: ['bodyweight'] } };
// Plan builder, step 1: age, weight and height set the calorie and protein targets, so they're needed.
function aboutYouOk() {
  const p = ui.b.draft;
  const missing = [!(+p.age >= 13 && +p.age <= 100) && 'age', !(+p.weightLb > 60) && 'weight', !(+p.heightIn >= 48) && 'height'].filter(Boolean);
  if (missing.length) toast(`Add your ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} to continue.`);
  return !missing.length;
}

function openQuickBuild() {
  const q = (ui.qb ||= { goal: 'muscle', exp: 'beginner', days: 3, equip: 'gym' });
  q.exp ||= 'beginner';
  const seg = (k, opts) => `<div class="segmented small-seg wrap-seg" role="radiogroup">${opts.map(([v, l]) => `<button class="${String(q[k]) === String(v) ? 'on' : ''}" data-a="qb-set" data-k="${k}" data-v="${v}" role="radio" aria-checked="${String(q[k]) === String(v)}">${l}</button>`).join('')}</div>`;
  openSheet(`<h2>Build my plan</h2>
    <p class="muted small">Four quick questions. Everything can be fine-tuned later.</p>
    <div class="field"><span>Main goal</span>${seg('goal', Object.entries(QB_GOALS).map(([k, v]) => [k, v.label]))}</div>
    <div class="field"><span>Lifting experience</span>${seg('exp', [['beginner', 'New to it'], ['intermediate', '1–3 years'], ['advanced', '3+ years']])}</div>
    <div class="field"><span>Days a week</span>${seg('days', [2, 3, 4, 5, 6].map((n) => [n, n]))}</div>
    <div class="field"><span>Where you train</span>${seg('equip', Object.entries(QB_EQUIP).map(([k, v]) => [k, v.label]))}</div>
    <button class="btn primary block big" data-a="qb-go">Create my plan</button>
    <button class="btn plain block" data-a="qb-full">Answer more questions instead</button>`);
}

// ---------- First time on a lift: find a working weight from one set ----------
function openBaseFind(uid) {
  const item = todayItems(ui.day).find((i) => i.uid === uid);
  if (!item) return;
  openSheet(`<h2>Find your weight</h2>
    <p class="small">Do one set of ${item.ex.name.toLowerCase()} at a weight you could lift about 10 times, stopping with a couple of reps left. Then enter it here.</p>
    <div class="grid2"><div class="field"><span>Weight (${wUnit()})</span><input id="bf-w" type="text" inputmode="decimal" placeholder="e.g. ${wUnit() === 'kg' ? '40' : '95'}"></div>
    <div class="field"><span>Reps you did</span><input id="bf-r" type="text" inputmode="numeric" placeholder="e.g. 10"></div></div>
    <button class="btn primary block big" data-a="base-set" data-uid="${uid}">Set my weights</button>
    <p class="muted small">The app estimates your max from that set and picks a weight for ${item.repMin} reps with about 2 in reserve.</p>`);
}

// ---------- Exercise photos ahead of time (they're cached when fetched) ----------
function prefetchImages() {
  try {
    const stamp = localStorage.getItem('lift.imgPrefetch');
    if (stamp === todayStr() || !navigator.onLine) return;
    localStorage.setItem('lift.imgPrefetch', todayStr());
  } catch { return; }
  const ids = new Set(Object.values(db.plan).flatMap((d) => (d?.items || []).flatMap((i) => [i.exerciseId, ...(i.variants || [])])));
  const urls = [...ids].flatMap((id) => (EX_INFO[id]?.images || []).slice(0, 2));
  let i = 0;
  const next = () => { if (i >= urls.length) return; fetch(urls[i++], { mode: 'no-cors' }).catch(() => {}).finally(() => setTimeout(next, 150)); };
  setTimeout(next, 4000);
}

// ---------- Numbers count up on a fresh summary ----------
function countUp() {
  if (reduceMotion.matches) return;
  for (const el of document.querySelectorAll('[data-count]:not([data-counted])')) {
    el.dataset.counted = '1';
    const to = +el.dataset.count;
    if (!(to > 0)) continue;
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 700); const e = 1 - (1 - k) ** 3; el.textContent = Math.round(to * e).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
}

// ---------- Weekly review ----------
// Early in a new week (first three days), a card offers last week's review until it's opened.
function reviewCard() {
  const start = lastWeekStart();
  if (db.settings.reviewSeen === start || weekPos(dayKeyOf(todayStr())) > 2) return '';
  const r = weekReview(db, start);
  if (!r.sessions) return '';
  const n = r.items.filter((x) => x.action).length;
  return `<div class="slim-banner review-card"><button class="grow banner-main" data-a="rv-open"><span class="dot" aria-hidden="true"></span><b>Last week</b> · ${n ? `${n} suggestion${n === 1 ? '' : 's'}` : `${r.lifts ?? r.sessions} of ${r.planned || r.sessions} workouts`}</button><button class="icon-btn subtle" data-a="rv-dismiss" aria-label="Dismiss">${icon('x')}</button></div>`;
}

function openReview() {
  const r = weekReview(db);
  ui.rv = r;
  db.settings.reviewSeen = r.start; persist();
  const fmt = (d) => parseDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const max = Math.max(...r.bars.map((b) => Math.max(b.sets, b.hi)), 1);
  const bar = (b) => {
    const state = b.sets < b.lo ? 'under' : b.sets > b.hi * 1.15 ? 'over' : 'ok';
    return `<div class="vbar ${state}"><span class="vbar-name">${esc(b.name)}</span><span class="vbar-track"><i class="vbar-band" style="left:${(b.lo / max) * 100}%;width:${((b.hi - b.lo) / max) * 100}%"></i><i class="vbar-fill" style="width:${Math.min(100, (b.sets / max) * 100)}%"></i></span><b class="num">${b.sets}</b></div>`;
  };
  openSheet(`<h2>Last week</h2>
    <p class="muted small">${fmt(r.start)}–${fmt(r.end)} · ${r.sessions ? `${r.lifts ?? r.sessions} of ${r.planned || r.sessions} workouts` : 'No workouts logged'}</p>
    ${r.items.length ? (() => {
      // The three that matter most first; the rest one tap away.
      const item = (x, i) => `<div class="rv-item ${x.kind}"><b>${esc(x.title)}</b><p class="small muted">${esc(x.text)}</p>${x.action ? `<button class="btn sm" data-a="rv-apply" data-i="${i}">${esc(x.action.label)}</button>` : ''}</div>`;
      const all = r.items.map(item);
      return all.slice(0, 3).join('') + (all.length > 3 ? `<details class="more-hist"><summary>See all ${all.length} suggestions</summary>${all.slice(3).join('')}</details>` : '');
    })()
      : r.sessions ? '<p class="small">Nothing to change: every muscle was in its range.</p>' : ''}
    ${r.bars.length ? `<h3 class="sheet-h">Sets per muscle ${helpBtn()}</h3><p class="help-text" hidden>Hard sets logged last week; assisting muscles count half. The shaded band is your target range. ${refChips(['schoenfeld2017vol', 'pelland2026'])}</p><div class="vbars">${r.bars.map(bar).join('')}</div>` : ''}`);
}

// ---------- Switch it up: rotate a lift through close variations ----------
// The same fields the plan editor uses (variants + rotate, or lock), edited from an exercise's sheet.
function varyField(it) {
  const base = it.variants?.[0] || it.exerciseId;
  const opts = similarExercises(db.exercises, base, 16).filter((x) => x.samePattern && isAvailable(db, x.ex)).slice(0, 8).map((x) => x.ex);
  if (!opts.length) return '';
  const sel = new Set(it.variants || [base]);
  const mode = it.lock ? 'lock' : it.rotate || 'auto';
  return `<div class="field"><span>Switch it up ${helpBtn()}</span><p class="help-text" hidden>Rotate this lift through close variations you pick, for example hammer curls one week and cross-body hammer curls the next. Each variation keeps its own weights and progress. Keep holds this exact exercise. Auto follows your variety setting.</p>
    <div class="segmented small-seg" role="radiogroup" aria-label="How often to switch">${[['auto', 'Auto'], ['lock', 'Keep'], ['week', 'Weekly'], ['block', 'Each block'], ['workout', 'Each workout']].map(([v, l]) => `<button class="${mode === v ? 'on' : ''}" data-a="xv-rot" data-uid="${it.uid}" data-v="${v}" role="radio" aria-checked="${mode === v}">${l}</button>`).join('')}</div>
    ${mode === 'lock' || mode === 'auto' ? '' : `<div class="chips wrap" aria-label="Variations">${[db.exercises[base], ...opts].map((e) => `<button class="chip ${sel.has(e.id) ? 'on' : ''}" data-a="xv-var" data-uid="${it.uid}" data-id="${e.id}" aria-pressed="${sel.has(e.id)}" ${e.id === base ? 'disabled' : ''}>${esc(e.name)}</button>`).join('')}</div>
    <p class="muted small">${sel.size > 1 ? `Rotating ${sel.size} variations.` : 'Pick at least one more to rotate with.'}</p>`}</div>`;
}

// ---------- Undo for list edits (move, link, unlink, remove) ----------
function listSnapshot() {
  const s = sessionFor(ui.day);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  if (s) return { day: ui.day, session: s.id, order: [...s.order], entries: clone(s.entries), removed: [...(s.removed || [])] };
  return { day: ui.day, plan: clone(db.plan[ui.day]), week: clone(db.week) };
}
function pushUndo() { (ui.undo ||= []).push(listSnapshot()); if (ui.undo.length > 30) ui.undo.shift(); }
function undoList() {
  const snap = ui.undo?.pop();
  if (!snap) return toast('Nothing to undo.');
  if (snap.session) {
    const s = sessionFor(snap.day);
    if (!s || s.id !== snap.session) return toast('That workout has ended, so it can\'t be undone.');
    // Order and links go back; sets logged since stay logged. Removed exercises come back.
    for (const [u, e] of Object.entries(snap.entries)) {
      if (s.entries[u]) { s.entries[u].group = e.group; s.entries[u].restSec = e.restSec; } else s.entries[u] = e;
    }
    s.order = [...snap.order, ...s.order.filter((u) => !snap.order.includes(u))];
    s.removed = snap.removed;
  } else {
    db.plan[snap.day] = snap.plan;
    if (snap.week === undefined) delete db.week; else db.week = snap.week;
  }
  persist(); render(); toast('Undone.');
}

// Where today's list lives: the workout once started, otherwise the plan for this weekday.
function editableList() {
  const session = sessionFor(ui.day);
  if (session) return { list: session.order.map((u) => session.entries[u]), save: (list) => { session.order = list.map((e) => e.uid); } };
  const plan = db.plan[ui.day];
  return { list: plan.items, save: (list) => { plan.items = list; } };
}

// The plan for the day open in Plan → Week.
function planDayList() {
  const plan = db.plan[ui.planDay];
  return { list: plan.items, save: (list) => { plan.items = list; } };
}

// Link the chosen exercises: they move together (to where the first one was) and share a slot.
function linkUids(uids, src = editableList()) {
  const { list, save } = src;
  const chosen = list.filter((x) => uids.includes(x.uid));
  if (chosen.length < 2) return;
  const prevKey = new Map(list.map((x) => [x, groupNum(x.group)]));
  const first = list.indexOf(chosen[0]);
  const rest = list.filter((x) => !uids.includes(x.uid));
  const before = list.slice(0, first).filter((x) => !uids.includes(x.uid)).length;
  const next = [...rest.slice(0, before), ...chosen, ...rest.slice(before)];
  relabel(next, (x) => (uids.includes(x.uid) ? 'link' : `g${prevKey.get(x)}`));
  save(next);
}

function unlinkUids(uids, src = editableList()) {
  const { list, save } = src;
  const prevKey = new Map(list.map((x) => [x, groupNum(x.group)]));
  relabel(list, (x) => (uids.includes(x.uid) ? `solo:${x.uid}` : `g${prevKey.get(x)}`));
  save(list);
}

// Day options: the less frequent controls live here instead of on the screen.
function openDayOptions() {
  const day = ui.day;
  const session = sessionFor(day);
  const isDeload = isDeloadFor(day);
  const isToday = day === dayKeyOf(todayStr());
  const go = (a, label, extra = '') => `<button class="list-row" data-a="${a}" ${extra}><span class="grow">${label}</span>${icon('right', 'chev')}</button>`;
  // Two groups: this workout, then everything else. Changing what a weekday is (lift, cardio,
  // rest) lives in Plan, since it applies every week.
  const today = [
    db.plan[day] && !session?.freestyle ? `<label class="list-row toggle"><span class="grow">Deload workout<span class="pick-sub">Half the sets, same or slightly lighter weights</span></span><input type="checkbox" data-a="deload-toggle" ${isDeload ? 'checked' : ''} ${session ? 'disabled' : ''}></label>` : '',
    canReopen() && db.lastFinish.reopen.active.day === day ? go('resume-finished', 'Resume finished workout') : '',
    !db.activeSession ? go('start-empty', 'Empty workout') : '',
    session ? go('leave-workout-view', 'Plan, food and progress') : '',
    !session && train.canTakeOff(day) ? go('day-off', `Can't make it ${isToday ? 'today' : `this ${FULL_DAY[day]}`}`, `data-day="${day}"`) : '',
    go('wk-open', 'Adjust week'),
  ].filter(Boolean).join('');
  openSheet(`<h2>${FULL_DAY[day]}</h2>
    <h3 class="sheet-h">${isToday ? 'Today' : 'This workout'}</h3>
    <div class="list-group">${today}</div>
    <h3 class="sheet-h">More</h3>
    <div class="list-group">
      ${go('open-recovery', 'Muscle recovery')}
      ${go('pain-report', 'Log pain')}
      ${go('open-templates', 'Conditioning and recovery', `data-day="${day}"`)}
      ${go('goto-plan-day', `Change ${FULL_DAY[day]}s in Plan`, `data-day="${day}"`)}
      <button class="list-row" data-a="list-view-menu"><span class="grow">${db.settings.listView === 'full' ? 'Hide set tables in the list' : 'Show set tables in the list'}</span></button>
      ${go('open-settings', 'Settings')}
    </div>
    ${session ? '<div class="list-group"><button class="list-row danger-row" data-a="discard"><span class="grow">Discard this workout</span></button></div>' : ''}
    <button class="btn plain block" data-a="close-sheet">Done</button>`);
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
      sets: e.sets.length, note: planned && !swappedFrom ? planned.note : '', swappedFrom, extra: !!e.parentUid || !!e.added, swapChild: !!e.parentUid,
      metric: e.metric, target: e.target, phase: e.phase,
    };
  }).filter(Boolean);
}

// Reads as a sentence: 'Chest, front delts · also triceps'.
function muscleLine(ex) {
  const lower = (m) => (MUSCLES[m] || m).toLowerCase();
  const p = ex.primary.map(lower).join(', ');
  const s = ex.secondary.map(lower).join(', ');
  const line = p ? (s ? `${p} · also ${s}` : p) : 'no muscles set';
  return line[0].toUpperCase() + line.slice(1);
}

const REGION = {
  chest: 'push', 'front-delts': 'push', 'side-delts': 'push', triceps: 'push',
  lats: 'pull', 'upper-back': 'pull', 'rear-delts': 'pull', biceps: 'pull', traps: 'pull', forearms: 'pull',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', adductors: 'legs', abductors: 'legs', calves: 'legs',
  abs: 'core', obliques: 'core', 'lower-back': 'core', 'hip-flexors': 'core',
};
const regionOf = (ex) => REGION[ex.primary[0]] || 'core';
const GRIP = icon('grip');
const CHEVRON = icon('down');

// Everything a card needs, worked out once (also used by the details sheet).
// A short flag when an exercise loads a sore area (details and fixes are on the exercise screen).
function painNotice(ex, entry) {
  if (entry?.pain) return null;
  if (['mobility', 'prehab'].includes(ex.pattern)) return null; // warm-up and stretch drills are already the gentle option
  const p = pain.exercisePain(ex, pain.painMap());
  if (!p) return null;
  return [p.level === 3 ? 'bad' : 'warn', `${p.labels[0]}${p.labels.length > 1 ? ` and ${p.labels.length - 1} more` : ''}: ${p.verb}`, 'pain'];
}

function cardModel(item, session, isDeload) {
  const ex = item.ex;
  const gym = activeGym(db);
  const metric = metricOf(item);
  if (metric !== 'reps' || ex.category === 'conditioning') {
    const entry = session?.entries[item.uid];
    const n = isDeload ? Math.ceil(item.sets / 2) : item.sets;
    const key = METRIC_FIELDS[metric][0][0];
    const sets = entry ? entry.sets : Array.from({ length: n }, () => ({ [key]: item.target ?? null, done: false }));
    const notices = isAvailable(db, ex) ? [] : [['warn', `Not available at ${gym.name} — swap it`]];
    const pn = painNotice(ex, entry);
    if (pn) notices.push(pn);
    return { ex, gym, metric, t: { sets: n, weight: null, reps: item.target, st: getState(db, ex.id) }, target: null, entry, sets, notices, conditioning: true };
  }
  const t = targetsFor(db, item, isDeload);
  const target = t.weight == null ? null : roundToGym(ex, t.weight, gym);
  const entry = session?.entries[item.uid];
  const sets = entry ? entry.sets : t.setWeights ? t.setWeights.map((w, i) => newSet(roundToGym(ex, w, gym), t.setReps[i])) : Array.from({ length: t.sets }, () => newSet(target, t.reps));
  const notices = [];
  if (!isAvailable(db, ex)) notices.push(['warn', db.exPrefs[ex.id] === 'never' ? 'Marked "never suggest" — swap it' : `Not available at ${gym.name} — swap it`]);
  if (entry?.pain) notices.push(['bad', `Stopped for pain${ex.substitute ? ` · try ${ex.substitute}` : ''}`]);
  else if (t.painWarning) notices.push(['bad', 'Two pain flags in two weeks']);
  const pn = painNotice(ex, entry);
  if (pn) notices.push(pn);
  if (t.stalled) notices.push(['warn', 'No progress in 3 workouts']);
  return { ex, gym, t, target, entry, sets, notices };
}

// Details & options for one exercise: kept off the card so the card stays simple.
// The three-dot menu: a few plain actions. Details live one tap further in.
function openExMenu(uid) {
  const items = todayItems(ui.day);
  const item = items.find((x) => x.uid === uid);
  if (!item) return;
  const grp = groupsOf(items).find((g) => g.items.includes(item));
  const i = items.indexOf(item);
  const planIt = db.plan[ui.day]?.items.find((x) => x.uid === uid);
  const row = (a, ic, label, extra = '', cls = '') => `<button class="list-row ${cls}" data-a="${a}" data-uid="${uid}" ${extra}>${icon(ic)}<span class="grow">${label}</span></button>`;
  openSheet(`<h2>${esc(item.ex.name)}</h2>
    <div class="list-group menu">
      ${row('log-all', 'check', 'Log all sets')}
      ${row('swap', 'swap', 'Swap exercise')}
      ${grp?.linked ? row('unlink-one', 'x', 'Unlink') : i < items.length - 1 ? row('link-next', 'plus', 'Link with next') : ''}
      ${planIt && item.ex.category !== 'conditioning' ? row('ex-lock', 'bookmark', planIt.lock ? 'Allow variety' : 'Keep every week') : ''}
      ${row('ex-details', 'info', 'More info')}
      ${row('ex-remove', 'trash', 'Delete', '', 'danger-row')}
    </div>
    <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
}

function openExerciseSheet(uid, focus) {
  const day = ui.day;
  const session = sessionFor(day);
  const isDeload = isDeloadFor(day);
  const items = todayItems(day);
  const item = items.find((i) => i.uid === uid);
  if (!item) return;
  const { ex, gym, t, target, entry, notices } = cardModel(item, session, isDeload);
  const info = EX_INFO[ex.id] || {};
  const barbell = ex.type?.startsWith('barbell');
  const firstCompound = items.find((i) => i.ex.category === 'compound' && i.ex.type !== 'bodyweight');
  const warm = db.settings.warmups && item === firstCompound && target ? warmupSets(ex, target, gym) : [];
  const rir = rirTarget(weekInfo(db));
  const i = session ? session.order.indexOf(uid) : items.indexOf(item);
  const count = session ? session.order.length : items.length;
  const aim = t.weight == null ? 'Pick a working weight to set your baseline'
    : t.aim ? t.aim : t.total ? `${t.reps}+ reps a set · beat ${t.total - 1} total` : `${t.reps} reps a set`;
  const row = (k, v) => (v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '');
  const lastUndone = entry && entry.sets.length > 1 && !entry.sets[entry.sets.length - 1].done;

  const planIt = db.plan[day]?.items.find((x) => x.uid === uid);
  const curGoal = planIt?.goal || '';
  const grpGoal = db.muscleGoals?.[groupOfMuscle(ex.primary[0])?.id];
  openSheet(`<h2>${esc(ex.name)}</h2>
    <p class="muted">${CATEGORIES[ex.category]} · ${TYPES[ex.type] || ex.type}${ex.needs?.length ? ` · needs ${ex.needs.map((k) => (GEAR_NAMES[k] || k).toLowerCase()).join(", ")}` : ""}</p>
    <p class="muted small">${esc(muscleLine(ex))}</p>
    ${planIt && ex.category !== 'conditioning' ? `<div class="field"><span>Goal ${helpBtn()}</span><p class="help-text" hidden>Strength: 3–6 reps on compounds, long rests. Size: 6–15 reps. Endurance: 15–25 reps, short rests. "Auto" follows ${grpGoal ? `your ${groupOfMuscle(ex.primary[0]).name.toLowerCase()} goal (${MGOALS[grpGoal].name.toLowerCase()})` : 'your plan'}.</p>
      <div class="segmented small-seg" role="radiogroup" aria-label="Goal for this exercise">${[['', 'Auto'], ...Object.entries(MGOALS).map(([k, v]) => [k, v.name])].map(([k, l]) => `<button class="${curGoal === k ? 'on' : ''}" data-a="set-exgoal" data-uid="${uid}" data-v="${k}" role="radio" aria-checked="${curGoal === k}">${l}</button>`).join('')}</div></div>` : ''}
    ${planIt && ex.category !== 'conditioning' ? varyField(planIt) : ''}
    ${ex.category !== 'conditioning' && (ex.metric || 'reps') === 'reps' ? `<div class="field"><span>Progression ${helpBtn()}</span><p class="help-text" hidden>How this lift moves forward. "Plan default" uses your plan's setting${ex.category === 'compound' ? ' (it applies to focus lifts)' : ''}; anything else here applies to this lift wherever it appears.</p>
      <select data-a="set-exprog" data-id="${ex.id}" aria-label="Progression for this exercise"><option value="">Plan default · ${esc(PROGRESSIONS[schemeFor(db, ex.id)]?.name && !ex.progression ? PROGRESSIONS[schemeFor(db, ex.id)].name : PROGRESSIONS[db.settings.progression || 'double'].name)}</option>${Object.entries(PROGRESSIONS).map(([k, v]) => `<option value="${k}" ${ex.progression === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>
      ${ex.progression ? `<p class="muted small">${PROGRESSIONS[ex.progression].desc}</p>` : ''}</div>` : ''}
    ${notices.map(([c, m]) => `<p class="notice ${c}">${esc(m)}</p>`).join('')}

    <h3 class="sheet-h">Today</h3>
    <div class="kv-list">
      ${row('Target', `${t.sets} × ${item.repMin}–${item.repMax}${target != null ? ` at ${fmtW(target, ex)}` : ''}`)}
      ${row('Aim', aim)}
      ${row('Effort', t.rir ? `${t.rir} reps in reserve` : rir ? `About ${rir} reps in reserve` : '')}
      ${row('Rest', item.restSec ? fmtRest(item.restSec) : '')}
      ${row('Plates', barbell && target ? plateText(target, gym) : '')}
      ${row('Last time', t.st.last ? fmtLast(t.st.last, ex) : '')}
    </div>
    ${[item.swappedFrom ? `Swapped in for ${esc(item.swappedFrom)} today.` : '', esc(item.note || ''), esc(ex.notes || '')].filter(Boolean).map((n) => `<p class="muted small">${n}</p>`).join('')}

    ${warm.length ? `<h3 class="sheet-h" id="warmup">Warm-up</h3><div class="kv-list">${warm.map((w) => row(`${fmtW(w.weight, ex)} × ${w.reps}`, barbell ? plateText(w.weight, gym) : '&nbsp;')).join('')}</div>` : ''}

    ${info.cues ? `<h3 class="sheet-h">Form</h3><ul class="cues">${info.cues.split(' · ').map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    <button class="list-row plain-row" data-a="ex-info" data-id="${ex.id}"><span class="grow">Photos, instructions and records</span>${icon('right', 'chev')}</button>

    <h3 class="sheet-h">Note for today</h3>
    <textarea id="ex-note" rows="2" placeholder="Seat height, grip, how it felt">${esc(entry?.note || '')}</textarea>
    <button class="btn block" data-a="ex-note-save" data-uid="${uid}">Save note</button>

    <div class="list-group">
      <button class="list-row" data-a="swap" data-uid="${uid}">${icon('swap')}<span class="grow">Swap exercise</span>${icon('right', 'chev')}</button>
      ${groupsOf(items).find((g) => g.items.includes(item))?.linked
        ? `<button class="list-row" data-a="unlink-one" data-uid="${uid}">${icon('x')}<span class="grow">Unlink</span></button>`
        : i < count - 1 ? `<button class="list-row" data-a="link-next" data-uid="${uid}">${icon('plus')}<span class="grow">Link with next</span></button>` : ''}
      <button class="list-row" data-a="ex-move" data-uid="${uid}" data-v="-1" ${i <= 0 ? 'disabled' : ''}>${icon('up')}<span class="grow">Move up</span></button>
      <button class="list-row" data-a="ex-move" data-uid="${uid}" data-v="1" ${i >= count - 1 ? 'disabled' : ''}>${icon('arrowDown')}<span class="grow">Move down</span></button>
      ${lastUndone ? `<button class="list-row" data-a="remove-set" data-uid="${uid}">${icon('minus')}<span class="grow">Remove last set</span></button>` : ''}
      ${ex.rules?.dropSet ? `<label class="list-row toggle"><span class="grow">Drop sets<span class="pick-sub">Each set about ${wt(10)} lighter</span></span><input type="checkbox" data-a="dropset" data-uid="${uid}" ${entry?.dropSet ? 'checked' : ''}></label>` : ''}
      <button class="list-row danger-row" data-a="ex-remove" data-uid="${uid}">${icon('trash')}<span class="grow">Remove from today</span></button>
    </div>`);
  if (focus) requestAnimationFrame(() => document.getElementById(focus)?.scrollIntoView({ block: 'start' }));
}

// ---------- Conditioning templates ----------

function openTemplates(day, mode) {
  const groups = Object.entries(TEMPLATE_KINDS).map(([kind, label]) => {
    const list = TEMPLATES.filter((t) => t.kind === kind);
    return `<h3 class="sheet-h">${label}</h3>${list.map((t) => `<div class="tpl">
      <div class="row between"><b>${esc(t.name)}</b><span class="muted small nowrap">~${t.minutes} min</span></div>
      <p class="muted small">${esc(t.desc)} ${refChips(t.refs)}</p>
      <p class="small tpl-items">${t.items.map(([id, sets, metric, target]) => `${esc(db.exercises[id]?.name || id)} ${sets > 1 ? `${sets} × ` : ''}${fmtTarget(metric, target)}`).join(t.circuit ? ' → ' : ' · ')}</p>
      <div class="row">
        ${mode === 'today' ? `<button class="btn sm primary" data-a="tpl-start" data-id="${t.id}">Start now</button>` : ''}
        <button class="btn sm" data-a="tpl-add" data-id="${t.id}" data-day="${day}">Add to ${FULL_DAY[day]}s</button>
      </div>
    </div>`).join('')}`;
  }).join('');
  openSheet(`<h2>Conditioning workouts</h2>
    <input class="search list-filter" type="search" placeholder="Search workouts" data-filter="#tpl-list" autocomplete="off" enterkeyhint="search">
    <div id="tpl-list">${groups}</div>
    <button class="btn plain block" data-a="close-sheet">Close</button>`);
}

// ---------- Training blocks: focus lifts and check-ins ----------

function blockCheckinBanner() {
  const b = checkinDue(db);
  if (!b) return '';
  return `<div class="notice-card">
    <p><b>Block ${b.index} check-in.</b> It's your deload week — review how your focus lifts moved and pick the next block's focus.</p>
    <div class="row"><button class="btn primary" data-a="block-review" data-i="${b.index}">Review block</button></div>
  </div>`;
}

function progressText(p) {
  if (!p.now) return 'Not trained yet this block';
  if (p.pct == null) return `Est. max ${wt(p.now)}`;
  const sign = p.pct >= 0 ? '+' : '';
  return `Est. max ${toDisp(p.base)} → ${wt(p.now)} (${sign}${p.pct.toFixed(1)}%)`;
}

// Plan → Week: where you are in the block and how the focus lifts are moving.
function blockCard() {
  const b = blockInfo(db);
  const focus = focusFor(db, b.index);
  return `<section class="card block-card">
    <div class="row between"><div><h3>Block ${b.index}</h3>
      <p class="muted small">${db.settings.deloadOff ? `Week ${b.weekInBlock} of ${b.n} · no scheduled deloads` : b.isDeload ? 'Deload week' : `Week ${b.weekInBlock} of ${b.n} · deload in ${b.weeksToDeload} week${b.weeksToDeload === 1 ? '' : 's'}`}</p></div>
      <button class="link-btn" data-a="block-focus" data-i="${b.index}">Edit focus</button></div>
    ${focus.length ? focus.map((id) => {
      const ex = db.exercises[id];
      if (!ex) return '';
      const p = liftProgress(db, id, b);
      return `<div class="list-row focus-row"><span class="thumb sm">${thumb(ex)}</span><span class="grow"><b>${esc(ex.name)}</b><span class="pick-sub">${focusUi.dayOf(b.index, id) ? `${FULL_DAY[focusUi.dayOf(b.index, id)]} · ` : ''}${progressText(p)}</span></span>
        ${p.pct != null ? `<span class="delta ${p.pct >= 0 ? 'up' : 'down'}">${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(1)}%</span>` : ''}</div>`;
    }).join('') : '<p class="muted small">No focus lifts yet.</p>'}
    ${b.isDeload && !db.blocks.reviews[b.index] ? `<button class="btn primary block" data-a="block-review" data-i="${b.index}">Review block</button>` : ''}
  </section>`;
}

function focusChooser(selected) {
  const options = planCompounds(db);
  return `<div class="chips wrap" role="group" aria-label="Focus lifts">${options.map((ex) => {
    const on = selected.includes(ex.id);
    return `<button class="chip ${on ? 'on' : ''}" data-a="focus-toggle" data-id="${ex.id}" aria-pressed="${on}">${esc(ex.name)}</button>`;
  }).join('')}</div>`;
}

function openFocusPicker(index) { focusUi.open(index); }

function openBlockReview(index) {
  const b = blockInfo(db);
  const blk = b.index === index ? b : { ...b, index, start: addDays(db.settings.programStart, (index - 1) * b.n * 7), end: addDays(db.settings.programStart, index * b.n * 7 - 1) };
  const focus = focusFor(db, index);
  const adh = adherence(db, blk);
  const prs = db.sessions.filter((s) => s.date >= blk.start && s.date <= blk.end).reduce((a, s) => a + (s.prs?.length || 0), 0);
  ui.focusDraft = [...focus];
  ui.focusIndex = index + 1;
  openSheet(`<h2>Block ${index} check-in</h2>
    <div class="kv-list">
      <div class="kv"><span>Workouts</span><b>${adh.done} of ${adh.planned} planned</b></div>
      <div class="kv"><span>Personal records</span><b>${prs}</b></div>
    </div>
    <h3 class="sheet-h">Focus lifts</h3>
    ${focus.map((id) => { const ex = db.exercises[id]; const p = liftProgress(db, id, blk); return ex ? `<div class="list-row focus-row"><span class="thumb sm">${thumb(ex)}</span><span class="grow"><b>${esc(ex.name)}</b><span class="pick-sub">${progressText(p)} · ${p.sessions} sessions</span></span></div>` : ''; }).join('')}
    <h3 class="sheet-h">How did the block feel?</h3>
    <div class="seg-mini wide" role="group" aria-label="How did the block feel">${['Too easy', 'About right', 'Too much'].map((l, i) => `<button data-a="block-feel" data-v="${i}" class="${ui.blockFeel === i ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p class="muted small">Block ${index + 1} keeps the same focus lifts. To change them, use Edit focus on the Plan tab after saving.</p>
    <div class="field"><span>Notes</span><textarea id="block-note" rows="2" placeholder="What worked, what to change"></textarea></div>
    <button class="btn primary block big" data-a="block-save" data-i="${index}">Save check-in</button>
    <p class="muted small">Want different exercises or rep ranges for the next block? Rebuild from Goals & plan builder, or edit days in Plan.</p>`);
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

function cardioSection(day, title, defaultOpen = true) {
  const open = ui.cardioOpen?.[day] ?? defaultOpen;
  const isToday = day === defaultDay();
  const { ctx, list } = suggestCardio(db, day, isToday);
  const top = list.filter((r) => r.verdict !== 'skip').slice(0, 4);
  const tomorrow = ctx.next[0];
  const nextLine = Object.keys(tomorrow.loads).length ? ` Tomorrow: ${esc(tomorrow.name || 'lifting')}.` : '';
  const logged = isToday ? db.cardio.filter((c) => c.date === todayStr()) : [];
  const head = `<button class="section-head" data-a="cardio-toggle" data-day="${day}" data-open="${open ? 1 : 0}" aria-expanded="${open}">
    <span class="grow"><b>${title}</b><span class="pick-sub">${logged.length ? `${logged.length} logged today` : top[0] ? `Best fit now: ${esc(top[0].c.name)}` : ''}</span></span>${CHEVRON}</button>`;
  if (!open) return `<section class="card cardio collapsed">${head}</section>`;
  return `<section class="card cardio">
    ${head}
    <p class="muted small">${isToday ? '' : 'Projected from your plan. '}${ctx.mode === 'lift' || ctx.mode === 'both' ? 'After today\'s lifting: ' : ''}${fatigueSummary(ctx.fresh)}${nextLine}</p>
    ${logged.map((c) => `<div class="list-row logged"><span class="grow"><b>${esc(CARDIO[c.cardioId]?.name || String(c.cardioId || 'Cardio').replace(/[-_]+/g, ' ').replace(/^./, (x) => x.toUpperCase()))}</b> · ${c.minutes} min${c.distance ? ` · ${c.distance} mi` : ''}${c.cardioId !== 'conditioning' && !c.fromWorkout ? ` · ~${Math.round(cardioBurn(db, c, CARDIO[c.cardioId]).active)} kcal` : ''}</span>
      <button class="mini" data-a="cardio-del" data-id="${c.id}" aria-label="Delete">${icon('x')}</button></div>`).join('')}
    ${weeklyCardioLine()}
    <h4 class="sub-h">Suggested</h4>
    ${top.map(cardioRow).join('') || '<p class="muted small">Everything is a stretch today — consider resting.</p>'}
    <button class="btn block" data-a="cardio-all" data-day="${day}">All cardio options</button>
    <button class="btn block" data-a="open-templates" data-day="${day}">Conditioning workouts</button>
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
    <input class="search list-filter" type="search" placeholder="Search cardio" data-filter="#pk-list" autocomplete="off" enterkeyhint="search">
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
    <div class="grid2"><div class="field"><span>Distance (mi, optional)</span><input id="c-dist" type="text" inputmode="decimal" placeholder="—"></div>
      <div class="field"><span>Avg heart rate (optional)</span><input id="c-hr" type="text" inputmode="numeric" placeholder="—"></div></div>
    <p class="muted small">Distance or heart rate makes the calorie estimate more accurate.</p>
    <div class="field"><span>Effort (RPE 1–10, optional)</span>
      <div class="chips rir">${['–', 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<button class="chip ${v === '–' ? 'on' : ''}" data-a="rpe" data-v="${v}">${v}</button>`).join('')}</div></div>
    <div class="field"><span>Note</span><input id="c-note" type="text" placeholder="optional"></div>
    <button class="btn primary block big" data-a="cardio-save" data-id="${id}">Log for today</button>
    <button class="btn block" data-a="close-sheet">Cancel</button>`);
}

// When each muscle was last trained (newest workout first), for the recovery list.
function lastTrainedMap() {
  const out = {};
  for (const s of [...db.sessions].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))) {
    for (const e of s.entries) {
      const ex = db.exercises[e.exerciseId];
      if (!ex) continue;
      for (const m of ex.primary) if (!out[m]) out[m] = { name: ex.name, ts: s.finishedAt || s.startedAt };
    }
  }
  return out;
}

function ago(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

// ---------- Recovery: tap the body map ----------

function painFor(area, side) {
  return activePain(db).filter((r) => (r.area === area || JOINTS[r.area]?.muscles.includes(area)) && (!side || side === 'center' || r.side === 'center' || r.side === side));
}

// Details for the selected muscle or joint: how recovered it is, when it's ready, any pain logged.
function recoveryDetail(sel) {
  if (!sel) return '<p class="muted small center">Tap a muscle to see how recovered it is.</p>';
  if (sel.group) {
    const g = groupById(sel.group);
    const fat = currentFatigue(db);
    const fresh = freshness(fat);
    const pct = Math.round(groupFreshness(g, fresh) * 100);
    const h = Math.max(...g.muscles.map((m) => hoursToReady(m, fat[m] || 0)));
    const pains = g.muscles.flatMap((m) => painFor(m, null)).filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i);
    const pm = g.parts ? setsByPart(db).parts[g.parts] : null;
    return `<div class="rec-detail-head"><h4>${g.name}</h4><button class="btn sm" data-a="pain-report" data-pre="${sel.focus || g.muscles[0]}">Log pain</button></div>
      <div class="rec-stat"><b class="num">${pct}%</b><span><b>${pct >= 80 ? 'Fresh' : pct >= 50 ? 'Recovering' : 'Fatigued'}</b><span class="pick-sub">${h > 0 ? `Ready in about ${h < 20 ? `${Math.max(1, Math.round(h))} h` : `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`}` : 'Ready to train'}</span></span></div>
      <div class="field rec-goal"><span>Goal for ${g.name.toLowerCase()} ${helpBtn()}</span><p class="help-text" hidden>Changes the rep range and rest for every exercise that mainly works ${g.name.toLowerCase()}. Auto keeps your plan's settings.</p>
        <div class="segmented small-seg" role="radiogroup">${[['', 'Auto'], ...Object.entries(MGOALS).map(([k, v]) => [k, v.name])].map(([k, l]) => `<button class="${(db.muscleGoals?.[g.id] || '') === k ? 'on' : ''}" data-a="set-mgoal" data-g="${g.id}" data-v="${k}" role="radio">${l}</button>`).join('')}</div></div>
      ${g.muscles.length > 1 ? `<div class="rec-members">${g.muscles.map((m) => `<button class="rec-member" data-a="rec-pick" data-m="${m}"><span class="grow">${MUSCLES[m]}</span><b class="num">${Math.round(fresh[m] * 100)}%</b>${icon('right', 'chev')}</button>`).join('')}</div>` : ''}
      ${pm && Object.keys(pm).length ? `<div class="rec-members">${Object.entries(PARTS[g.parts]).map(([k, name]) => `<div class="rec-member"><span class="grow">${name}</span><b class="num">${Math.round((pm[k] || 0) * 2) / 2}</b><span class="muted small">sets this week</span></div>`).join('')}</div>` : ''}
      ${pains.map((r) => `<div class="pain-row"><span class="lv-dot lv-${r.level}" aria-hidden="true"></span><span class="grow"><b>${esc(areaLabel(r.area, r.side))}</b><span class="pick-sub">${PAIN_LEVELS[r.level].name} pain</span></span></div>`).join('')}`;
  }
  const { area, side } = sel;
  const joint = JOINTS[area];
  const name = side && side !== 'center' ? areaLabel(area, side) : (joint?.name || MUSCLES[area] || area);
  const pains = painFor(area, side);
  let status = '';
  if (!joint) {
    const fat = currentFatigue(db);
    const pct = Math.round(freshness(fat)[area] * 100);
    const h = hoursToReady(area, fat[area] || 0);
    const last = lastTrainedMap()[area];
    const word = pct >= 80 ? 'Fresh' : pct >= 50 ? 'Recovering' : 'Fatigued';
    status = `<div class="rec-stat"><b class="num">${pct}%</b><span><b>${word}</b><span class="pick-sub">${h > 0 ? `Ready in about ${h < 20 ? `${Math.max(1, Math.round(h))} h` : `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`}` : 'Ready to train'}${last ? ` · last: ${esc(last.name)}, ${ago(last.ts)}` : ''}</span></span></div>`;
  }
  return `<div class="rec-detail-head"><h4>${esc(name)}</h4><button class="btn sm" data-a="pain-report" data-pre="${area}">Log pain</button></div>
    ${status}
    ${pains.map((r) => `<div class="pain-row"><span class="lv-dot lv-${r.level}" aria-hidden="true"></span><span class="grow"><b>${esc(areaLabel(r.area, r.side))}</b><span class="pick-sub">${PAIN_LEVELS[r.level].name} pain · ${ago(r.ts)}</span></span><button class="btn sm" data-a="pain-check" data-id="${r.id}" data-v="-9">Clear</button></div>`).join('')}`;
}

function markRecovery() {
  const sel = ui.recSel;
  document.querySelectorAll('.rec-map .picked').forEach((el) => el.classList.remove('picked'));
  if (!sel) return;
  if (sel.group) {
    for (const m of groupById(sel.group).muscles) document.querySelectorAll(`.rec-map [data-m="${m}"]`).forEach((el) => el.classList.add('picked'));
    return;
  }
  document.querySelectorAll('.rec-map svg').forEach((svg) => svg.querySelectorAll('[data-half]').forEach((g) => {
    const side = sideOf(svg.dataset.view, g.dataset.half);
    g.querySelectorAll(`[data-m="${sel.area}"],[data-j="${sel.area}"]`).forEach((el) => el.classList.add('picked'));
  }));
}

function refreshRecovery() {
  document.querySelectorAll('#rec-detail').forEach((d) => { d.innerHTML = recoveryDetail(ui.recSel); });
  markRecovery();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('.rec-map [data-m], .rec-map [data-j]');
  if (!el) return;
  const area = el.dataset.m || el.dataset.j;
  // A muscle opens its group (recovery, goal, members); a joint opens on its own.
  const grp = el.dataset.m ? groupOfMuscle(area) : null;
  ui.recSel = grp ? { group: grp.id, focus: area } : { area, side: null };
  haptic();
  refreshRecovery();
});

// Body map shaded by fatigue (redder = more tired); pain is outlined. Tap anything for details.
function freshnessCard() {
  const fresh = freshness(currentFatigue(db));
  const all = Object.values(MUSCLE_GROUPS).flat();
  const shade = Object.fromEntries(all.map((m) => [m, Math.min(1, (1 - fresh[m]) / 0.6)]));
  const hurt = new Set(activePain(db).map((r) => `${r.area}:${r.side}`));
  const recovering = all.filter((m) => fresh[m] < 0.8).sort((a, b) => fresh[a] - fresh[b]);
  const recGroups = GROUPS.map((g) => ({ g, f: groupFreshness(g, fresh) })).filter((x) => x.f < 0.8).sort((x, y) => x.f - y.f);
  if (!ui.recSel && recGroups.length) ui.recSel = { group: recGroups[0].g.id };
  const opts = { mark: hurt, joints: true };
  setTimeout(markRecovery);
  return `<section class="card recovery">
    <div class="row between"><h3>Recovery</h3><span class="muted small">${recGroups.length ? `${recGroups.length} recovering` : 'All fresh'}</span></div>
    <div class="body-pair rec-map">${bodySvg('front', shade, { ...opts, label: 'Front of body. Tap a muscle.' })}${bodySvg('back', shade, { ...opts, label: 'Back of body. Tap a muscle.' })}</div>
    <div class="scale" aria-hidden="true"><span>Fresh</span><i></i><span>Fatigued</span>${hurt.size ? '<span class="hurt-key">Pain</span>' : ''}</div>
    <div id="rec-detail" class="rec-detail" aria-live="polite">${recoveryDetail(ui.recSel)}</div>
    ${recGroups.length ? `<div class="chips wrap rec-chips">${recGroups.map(({ g, f }) => `<button class="chip sm" data-a="rec-pick" data-g="${g.id}">${g.name} <b class="num">${Math.round(f * 100)}%</b></button>`).join('')}</div>` : ''}
  </section>`;
}

function cardioHistory() {
  const recent = [...db.cardio].sort((a, b) => b.ts - a.ts).slice(0, 8);
  if (!recent.length) return '';
  return `<div class="card"><h3>Recent cardio</h3>${recent.map((c) => `
    <div class="list-row"><span class="grow"><b>${fmtDate(c.date)}</b> · ${esc(CARDIO[c.cardioId]?.name || c.cardioId)}</span>
    <span class="muted small">${c.minutes} min${c.distance ? ` · ${c.distance} mi` : ''}${c.cardioId !== 'conditioning' && !c.fromWorkout ? ` · ~${Math.round(cardioBurn(db, c, CARDIO[c.cardioId]).active)} kcal` : ''}</span></div>`).join('')}</div>`;
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
  if (entry.metric || ex.category === 'conditioning') {
    const metric = entry.metric || ex.metric || 'reps';
    const [[k1, l1], [k2, l2]] = METRIC_FIELDS[metric];
    openSheet(`
      <h2>${esc(ex.name)}</h2>
      <p class="muted small">Round ${idx + 1} of ${entry.sets.length}${entry.target ? ` · target ${fmtTarget(metric, entry.target)}` : ''}</p>
      <div class="field"><span>${l1}</span>${stepper('f-c1', s[k1], metric === 'distance' ? 10 : metric === 'time' ? 5 : 1)}</div>
      <div class="field"><span>${l2}</span>${stepper('f-c2', k2 === 'weight' ? toDisp(s[k2]) : s[k2], k2 === 'weight' ? weightStepper() : 1)}</div>
      <button class="btn primary block big" data-a="save-round" data-uid="${uid}" data-i="${idx}" data-k1="${k1}" data-k2="${k2}">${s.done ? 'Update round' : 'Log round'}</button>
      <div class="row">
        ${metric === 'time' && !s.done ? `<button class="btn grow" data-a="work-start" data-uid="${uid}" data-i="${idx}">Start timer</button>` : ''}
        ${s.done ? `<button class="btn grow" data-a="undo-set" data-uid="${uid}" data-i="${idx}">Mark not done</button>` : `<button class="btn grow" data-a="close-sheet">Cancel</button>`}
      </div>`);
    return;
  }
  const step = ex.type === 'dumbbell' || ex.increment >= 5 ? 5 : ex.increment || 5;
  const weightLabel = ex.type === 'bodyweight' ? `Added load (${wUnit()}, 0 = bodyweight)` : ex.type === 'dumbbell' ? `Weight per DB (${wUnit()})` : `Weight (${wUnit()})`;
  openSheet(`
    <h2>${esc(ex.name)}</h2>
    <p class="muted small">Set ${idx + 1} of ${entry.sets.length} · range ${entry.repMin}–${entry.repMax}</p>
    <div class="field" ${ex.noLoad ? 'hidden' : ''}><span>${weightLabel}</span>${stepper('f-weight', toDisp(s.weight), wUnit() === 'kg' ? 2.5 : step)}</div>
    <div class="field"><span>Reps</span>${stepper('f-reps', s.reps, 1)}</div>
    <div class="field"><span>Set type</span>
      <div class="chips" id="set-types">${[['', 'Normal'], ...Object.entries(SET_TYPES).map(([k, v]) => [k, v[1]])].map(([k, l]) => `<button class="chip ${(s.type || '') === k ? 'on' : ''}" data-a="set-type" data-uid="${uid}" data-i="${idx}" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="muted small">Warm-up sets don't count toward progression, volume or records.</p></div>
    <div class="field"><span>RIR <span class="muted">(reps in reserve, optional)</span></span>
      <div class="chips rir">${['–', 0, 1, 2, 3, 4, 5].map((r) => `<button class="chip ${(r === '–' ? s.rir == null : s.rir === r) ? 'on' : ''}" data-a="rir" data-v="${r}">${r}</button>`).join('')}</div>
    </div>
    <button class="btn primary block big" data-a="save-set" data-uid="${uid}" data-i="${idx}">${s.done ? 'Update set' : 'Log set'}</button>
    <div class="row">
      <button class="btn danger grow" data-a="pain-report" data-uid="${uid}" data-i="${idx}">Log pain</button>
      ${s.done ? `<button class="btn grow" data-a="undo-set" data-uid="${uid}" data-i="${idx}">Mark not done</button>` : `<button class="btn grow" data-a="close-sheet">Cancel</button>`}
    </div>`);
  sheetState.rir = s.rir;
}

const sheetState = { rir: null };

// Bottom sheets: a grab handle, focus moves into the sheet (and back out when it closes),
// Escape or a tap on the backdrop closes it, and the page behind is hidden from screen readers.
let sheetReturnFocus = null;
// While a sheet is open the page behind it can't scroll or be dragged (iOS would otherwise move both).
let lockedAt = null;
function lockPage(on) {
  const b = document.body;
  if (on && lockedAt == null) {
    lockedAt = window.scrollY;
    Object.assign(b.style, { position: 'fixed', top: `-${lockedAt}px`, left: '0', right: '0', width: '100%' });
  } else if (!on && lockedAt != null) {
    Object.assign(b.style, { position: '', top: '', left: '', right: '', width: '' });
    window.scrollTo(0, lockedAt);
    lockedAt = null;
  }
}

// In-app confirmation in place of the browser's confirm box (which shows the web address on iPhone).
// Resolves true for the main button, false for Cancel or closing the sheet.
let askPending = null;
const AUTO_CONFIRM = /[?&]autoconfirm\b/.test(location.search); // automated tests only
function ask(message, ok = 'OK', danger = false) {
  if (AUTO_CONFIRM) return Promise.resolve(true);
  if (askPending) { const r = askPending; askPending = null; r(false); }
  return new Promise((resolve) => {
    openSheet(`<p class="ask-text">${esc(message)}</p>
      <button class="btn ${danger ? 'danger-fill' : 'primary'} block big" data-a="ask-yes">${esc(ok)}</button>
      <button class="btn plain block" data-a="ask-no">Cancel</button>`);
    askPending = resolve;
  });
}
function answerAsk(v) { const r = askPending; askPending = null; closeSheet(); r?.(v); }

// Set while a sheet slides away; a sheet opened meanwhile cancels the close.
let sheetClosing = null;
function openSheet(html) {
  const sh = $('#sheet');
  const body = $('#sheet-body');
  if (sheetClosing) { clearTimeout(sheetClosing); sheetClosing = null; sh.hidden = true; }
  const wasOpen = !sh.hidden;
  if (!wasOpen) sheetReturnFocus = document.activeElement;
  const full = `<div class="sheet-top"><div class="grabber" aria-hidden="true"></div><button class="sheet-x" data-a="close-sheet" aria-label="Close">${icon('x')}</button></div>${html}`;
  // Re-showing the same sheet (e.g. after a change inside it): patch it so it doesn't jump.
  const newTitle = (html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
  const sameSheet = wasOpen && newTitle != null && body.querySelector('h2')?.innerHTML === newTitle;
  if (sameSheet) { const top = body.scrollTop; morph(body, full); body.scrollTop = top; } else {
    body.innerHTML = full;
    if (wasOpen) { body.scrollTop = 0; if (!reduceMotion.matches) body.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }); }
  }
  const title = body.querySelector('h2');
  if (title) { title.id = 'sheet-title'; body.setAttribute('aria-labelledby', 'sheet-title'); }
  if (sh.hidden) lockPage(true);
  sh.hidden = false;
  $('#main').setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    sh.classList.add('open');
    // Focus the title (not a text field) so the iPhone keyboard doesn't pop up uninvited.
    if (title) title.setAttribute('tabindex', '-1');
    if (!wasOpen) (title || body).focus?.({ preventScroll: true });
  });
}
function closeSheet() {
  const sh = $('#sheet');
  if (askPending) { const r = askPending; askPending = null; r(false); }
  if (sh.hidden || sheetClosing) return;
  sh.classList.remove('open');
  $('#main').removeAttribute('aria-hidden');
  lockPage(false);
  sheetClosing = setTimeout(() => {
    sheetClosing = null;
    sh.hidden = true;
    $('#sheet-body').innerHTML = '';
    if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus?.({ preventScroll: true });
    sheetReturnFocus = null;
  }, 260);
}
let typingSave = null;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
document.addEventListener('toggle', (e) => { const d = e.target; if (d.matches?.('details.warmup')) (ui.warmOpen ||= {})[d.dataset.uid] = d.open; }, true);

const num = (id) => {
  const v = parseFloat(String($(`#${id}`)?.value ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

// ---------- Exercise bank picker ----------

const picker = { mode: null, uid: null, currentId: null, scope: 'today', q: '', cat: 'all', muscle: 'all' };
const PICKER_TITLES = { 'es-add': 'Add exercise', swap: 'Swap exercise', 'plan-swap': 'Swap in plan', add: 'Add exercise', browse: 'Exercise library', 'session-add': 'Add to today', 'today-add': 'Add exercise' };

function openPicker(opts) {
  Object.assign(picker, { uid: null, currentId: null, scope: 'today', q: '', cat: 'all', muscle: 'all', showHidden: false }, opts);
  const cur = picker.currentId ? db.exercises[picker.currentId] : null;
  openSheet(`
    <h2>${PICKER_TITLES[picker.mode]}</h2>
    ${cur ? `<p class="muted small">Swapping out <b>${esc(cur.name)}</b> · ${esc(muscleLine(cur))}</p>` : ''}
    ${picker.mode === 'swap' ? `<div class="chips seg">
      <button class="chip on" data-a="pk-scope" data-v="today">Today only</button>
      <button class="chip" data-a="pk-scope" data-v="plan">Swap in plan</button>
    </div>` : ''}
    <input id="pk-q" class="search" type="search" placeholder="Search name, muscle or movement" autocomplete="off" enterkeyhint="search">
    <div class="chips pk-filters">${[['all', 'All'], ['compound', 'Compound'], ['accessory', 'Accessory']].map(([v, l]) =>
      `<button class="chip ${v === 'all' ? 'on' : ''}" data-a="pk-cat" data-v="${v}">${l}</button>`).join('')}</div>
    <select id="pk-muscle" class="pk-muscle" data-a="pk-muscle" aria-label="Muscle">
      <option value="all">All muscles</option>
      ${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
    </select>
    <button class="btn block new-ex-btn" data-a="pk-custom">${icon('plus')} New exercise</button>
    <div id="pk-list"></div>`);
  renderPickerList();
}

function pickRow(ex, why) {
  return `<button class="pick-row" data-a="pick" data-id="${ex.id}">
    <span class="grow"><b>${esc(ex.name)}${db.exPrefs[ex.id] === 'prefer' ? ' <span class="fav-mark" aria-label="Preferred">' + icon('starFill') + '</span>' : ''}</b><span class="pick-sub">${isAvailable(db, ex) ? '' : '<em class="warn-t">Hidden</em> · '}${why ? `<em>${why}</em> · ` : ''}${esc(muscleLine(ex))}</span></span>
    <span class="cat ${ex.category}">${CATEGORIES[ex.category]}</span>
  </button>`;
}

// Sort key for exercise preferences: preferred first, avoided last.
const prefRank = (db, id) => ({ prefer: 0, avoid: 2 }[db.exPrefs?.[id]] ?? 1);

// The lifts most programs are built on, roughly in the order people learn them.
const COMMON_LIFTS = ['back-squat', 'bench-press', 'deadlift', 'ohp', 'bb-row', 'lat-pulldown', 'pullup', 'rdl', 'leg-press', 'db-bench', 'db-shoulder-press', 'db-row', 'goblet-squat', 'hip-thrust', 'walking-lunge', 'db-curl', 'cable-pushdown', 'db-lat-raise', 'leg-extension', 'lying-ham-curl', 'plank'];

function renderPickerList() {
  const el = $('#pk-list');
  if (!el) return;
  const q = picker.q.trim().toLowerCase();
  // Exercises marked 'never' or not available at this gym are hidden unless asked for.
  const hiddenCount = Object.values(db.exercises).filter((ex) => !isAvailable(db, ex)).length;
  const match = (ex) => (picker.showHidden || picker.mode === 'browse' || isAvailable(db, ex))
    && (picker.cat === 'all' || ex.category === picker.cat)
    && (picker.muscle === 'all' || ex.primary.includes(picker.muscle) || ex.secondary.includes(picker.muscle))
    && (!q || q.split(/\s+/).every((w) => ex.name.toLowerCase().includes(w)
      || [...ex.primary, ...ex.secondary].some((m) => (MUSCLES[m] || '').toLowerCase().includes(w))
      || (PATTERNS[ex.pattern] || '').toLowerCase().includes(w)));
  let html = '';
  const WARM = ['prehab', 'mobility'];
  const curEx = db.exercises[picker.currentId];
  const phase = picker.uid ? (sessionFor(ui.day)?.entries[picker.uid]?.phase || todayItems(ui.day).find((i) => i.uid === picker.uid)?.phase) : null;
  const warmMode = !!curEx && (WARM.includes(curEx.pattern) || phase === 'warmup' || phase === 'cooldown');
  if (warmMode) {
    const want = phase === 'cooldown' || curEx.pattern === 'mobility' ? ['mobility', 'prehab'] : ['prehab', 'mobility'];
    const pool = Object.values(db.exercises).filter((e) => e.id !== curEx.id && WARM.includes(e.pattern) && match(e));
    const score = (e) => similarity(curEx, e) + (e.pattern === want[0] ? 3 : 0) - prefRank(db, e.id);
    const sugg = pool.sort((a, b) => score(b) - score(a)).slice(0, 8);
    if (sugg.length) html += `<h3 class="sect">Warm-up and mobility</h3>${sugg.map((e) => pickRow(e, e.primary.some((m) => curEx.primary.includes(m)) ? 'Same area' : 'Warm-up')).join('')}`;
  } else if (picker.currentId) {
    const sugg = similarExercises(db.exercises, picker.currentId, 12).filter((x) => match(x.ex))
      .sort((a, b) => prefRank(db, a.ex.id) - prefRank(db, b.ex.id)).slice(0, 8);
    if (sugg.length) {
      html += `<h3 class="sect">Most similar</h3>${sugg.map((x) => pickRow(x.ex, x.samePattern ? 'Same movement' : 'Similar muscles')).join('')}`;
    }
  }
  // Browsing without a search: what you've done lately, then the lifts most people start with.
  const shown = new Set();
  if (!picker.currentId && !q && picker.cat === 'all' && picker.muscle === 'all') {
    const recent = [];
    for (const s2 of [...db.sessions].reverse()) for (const e of s2.entries) if (!recent.includes(e.exerciseId) && db.exercises[e.exerciseId] && match(db.exercises[e.exerciseId])) recent.push(e.exerciseId);
    const r = recent.slice(0, 6);
    if (r.length) { html += `<h3 class="sect">Recent</h3>${r.map((id) => pickRow(db.exercises[id])).join('')}`; r.forEach((id) => shown.add(id)); }
    const common = COMMON_LIFTS.filter((id) => db.exercises[id] && !shown.has(id) && match(db.exercises[id])).slice(0, 12);
    if (common.length) { html += `<h3 class="sect">Common lifts</h3>${common.map((id) => pickRow(db.exercises[id])).join('')}`; }
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
    const fav = (x) => prefRank(db, x.id);
    const list = groups[k].sort((a, b) => fav(a) - fav(b) || (a.category === b.category ? a.name.localeCompare(b.name) : a.category === 'compound' ? -1 : 1));
    return `<h3 class="sect">${label(k)} <span class="muted small">${list.length}</span></h3>${list.map((ex) => pickRow(ex)).join('')}`;
  }).join('');
  if (hiddenCount && picker.mode !== 'browse') html += `<button class="btn ghost block" data-a="pk-hidden">${picker.showHidden ? 'Hide' : 'Show'} ${hiddenCount} hidden exercises (never / not at this gym)</button>`;
  el.innerHTML = html || `<div class="empty small-empty"><p class="muted">No matches${q ? ` for “${esc(picker.q.trim())}”` : ''}.</p>${q ? `<button class="btn primary" data-a="pk-custom" data-name="${esc(picker.q.trim())}">Create “${esc(picker.q.trim())}”</button>` : ''}</div>`;
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
  it.manual = true; // chosen by hand: kept when the plan is rebuilt
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
    Object.assign(entry, { exerciseId: newId, sets: fresh.sets, metric: fresh.metric, target: fresh.target, dropSet: false, painFree: false });
  } else {
    entry.sets = entry.sets.filter((x) => x.done || x.pain);
    const newUid = `${baseUid}-x${Date.now()}`;
    const fresh = makeEntry({ ...item, uid: newUid }, session.isDeload);
    session.entries[newUid] = { ...fresh, parentUid: baseUid, swappedFrom: entry.exerciseId };
    session.order.splice(session.order.indexOf(uid) + 1, 0, newUid);
  }
  persist();
}

// Add an exercise to a weekday's plan with sensible defaults for its type.
function addToPlanDay(day, exId) {
  const plan = db.plan[day];
  if (!plan) return;
  const ex = db.exercises[exId];
  const compound = ex.category === 'compound';
  const nextGroup = Math.max(0, ...plan.items.map((i) => parseInt(groupNum(i.group), 10) || 0)) + 1;
  plan.items.push({ uid: `${day}-${Date.now()}`, exerciseId: exId, group: String(nextGroup), sets: 3, repMin: compound ? 6 : 10, repMax: compound ? 10 : 15, restSec: compound ? 150 : 90, note: '' });
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
  items.push({ uid: `${day}-${Date.now()}`, exerciseId: exId, group: String(nextGroup), note: '', manual: true, ...defaults });
  persist();
  render();
  openPlanEdit(items.length - 1);
}




// ---------- Settings ----------

// Settings: grouped like iOS Settings — related options together, rarely used ones collapsed.
function screenSettings() {
  const s = db.settings;
  const wi = weekInfo(db);
  // Options that only apply to the original sample plan.
  const legacy = Object.values(db.plan).some((d) => d.items?.some((i) => i.role === 'rowCompound' || i.exerciseId === 'iso-row'));
  const p = db.profile;
  // Settings: a short list of pages, like iPhone Settings.
  const pages = {
    training: { title: 'Training', html: `    <div class="card">
      <div class="field"><span>Week starts on</span><select data-a="week-start" aria-label="Week starts on">${['mon', 'sun', 'sat', 'tue', 'wed', 'thu', 'fri'].map((d) => `<option value="${d}" ${(db.settings.weekStart || 'mon') === d ? 'selected' : ''}>${FULL_DAY[d]}</option>`).join('')}</select></div>
      <div class="field"><span>Exercise variety</span>
        <div class="segmented small-seg" role="radiogroup" aria-label="Exercise variety">${Object.entries(VARIETY).map(([k, v]) => `<button class="${(s.variety || 'low') === k ? 'on' : ''}" data-a="set-variety" data-v="${k}" role="radio" aria-checked="${(s.variety || 'low') === k}">${v.name}</button>`).join('')}</div>
        <p class="muted small">${VARIETY[s.variety || 'low'].desc} ${refChips(['kassiano2022', 'bazvalle2019'])}</p></div>
      <label class="toggle"><input type="checkbox" data-a="set-extra" data-k="warmupRoutine" ${s.warmupRoutine ? 'checked' : ''}><span>Warm-up routine before lifting</span></label>
      <label class="toggle"><input type="checkbox" data-a="set-extra" data-k="cooldownRoutine" ${s.cooldownRoutine ? 'checked' : ''}><span>Cool-down stretch after lifting</span></label>
      <label class="toggle"><input type="checkbox" data-a="sound" ${s.sound ? 'checked' : ''}><span>Beep when rest ends</span></label>
    </div>
    <h2 class="group-title">Progression</h2>
    <div class="card">
      <div class="field"><span>For your focus lifts ${helpBtn()}</span><p class="help-text" hidden>How your focus lifts move forward. Every other lift adds reps, then weight. You can also pick a progression for any single lift from its options.</p>
        ${progressionList(PROGRESSIONS[s.progression] ? s.progression : 'double', recommendProgression(db.profile), 'set-progression')}</div>
    </div>
    <details class="adv-settings"><summary>Advanced</summary>
    <h2 class="group-title">Blocks and deloads</h2>
    <div class="card">
      <div class="field"><span>Block length (deload in the last week)</span>
        <div class="row stepper-row"><button class="step" data-a="deload-weeks" data-v="-1" aria-label="Shorter block" ${s.deloadEvery <= 3 ? 'disabled' : ''}>−</button><b class="tnum">${s.deloadEvery} weeks</b><button class="step" data-a="deload-weeks" data-v="1" aria-label="Longer block" ${s.deloadEvery >= 8 ? 'disabled' : ''}>+</button></div></div>
      <label class="toggle"><input type="checkbox" data-a="deload-off" ${s.deloadOff ? 'checked' : ''}><span>No scheduled deloads (deload when you choose, from day options)</span></label>
      <div class="field"><span>Effort ramp · reps in reserve in week 1 → before deload</span>
        <div class="row"><div class="segmented small-seg grow" role="radiogroup" aria-label="Week 1 reps in reserve">${[2, 3, 4].map((n) => `<button class="${(s.rampStart ?? 3) === n ? 'on' : ''}" data-a="ramp-start" data-v="${n}" role="radio" aria-checked="${(s.rampStart ?? 3) === n}">${n}</button>`).join('')}</div>
        <span class="muted">→</span>
        <div class="segmented small-seg grow" role="radiogroup" aria-label="Last week reps in reserve">${[0, 1, 2].map((n) => `<button class="${(s.rampEnd ?? db.profile?.rx?.rirLo ?? 1) === n ? 'on' : ''}" data-a="ramp-end" data-v="${n}" role="radio" aria-checked="${(s.rampEnd ?? db.profile?.rx?.rirLo ?? 1) === n}">${n}</button>`).join('')}</div></div></div>
      <div class="field"><span>Current week of program · week ${wi.cyclePos} of ${wi.cycleLen} in this block${wi.isDeload ? ' (deload)' : ''}</span>
        <div class="row">${stepper('set-week', wi.week, 1)}<button class="btn" data-a="set-week">Set</button></div></div>
    </div>
    <h2 class="group-title">Core</h2>
    <div class="card">
      <div class="field"><span>Core</span>
        <div class="segmented small-seg wrap-seg" role="radiogroup" aria-label="Core placement">${Object.entries(CORE_PLACEMENTS).map(([k, v]) => `<button class="${(s.corePlacement || 'end') === k ? 'on' : ''}" data-a="set-core" data-v="${k}" role="radio" aria-checked="${(s.corePlacement || 'end') === k}">${v.name}</button>`).join('')}</div>
        <p class="muted small">${CORE_PLACEMENTS[s.corePlacement || 'end'].desc} ${refChips(['mcgill2010', 'hibbs2008', 'granata2008'])}</p></div>
    </div>
    <h2 class="group-title">Logging</h2>
    <div class="card">
      <label class="toggle"><input type="checkbox" data-a="set-warmups" ${s.warmups ? 'checked' : ''}><span>Warm-up sets on the first big lift</span></label>
      <label class="toggle"><input type="checkbox" data-a="set-autoadvance" ${s.autoAdvance !== false ? 'checked' : ''}><span>Auto-advance in supersets</span></label>
      <label class="toggle"><input type="checkbox" data-a="set-ramp" ${s.rampEffort ? 'checked' : ''}><span>Ramp effort through each block (reps in reserve 3 → 1)</span></label>
      ${legacy ? `<details class="sub-details"><summary>Sample-plan options</summary>
        <div class="field"><span>Thursday row compound</span><div class="row between"><b>${esc(db.exercises[ROW_ROTATION[s.rowRotation % 3]].name)}</b><button class="mini" data-a="rotate-yes">Rotate now</button></div></div>
        <label class="toggle"><input type="checkbox" data-a="race" ${s.raceBlock ? 'checked' : ''}><span>Race block (deadlift moves to Monday, RDL on Friday, no glute ham raises)</span></label>
      </details>` : ''}
      <details class="sub-details"><summary>Weight jumps for new exercises</summary>
        <div class="grid2">${Object.entries(TYPES).map(([k, v]) => `<div class="field"><span>${v} (${wUnit()})</span><input type="text" inputmode="decimal" data-a="def-inc" data-k="${k}" value="${toDisp(s.defaultIncrements[k])}"></div>`).join('')}</div>
        <button class="btn block" data-a="apply-inc">Apply to all existing exercises</button>
      </details>
    </div>
    </details>` },
    gym: { title: 'Gym', html: `    ${extras.gymCard()}` },
    appearance: { title: 'Appearance and units', html: `
    <h2 class="group-title">Weight units</h2>
    <div class="card"><div class="segmented small-seg" role="radiogroup" aria-label="Weight units">${[['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']].map(([v, l]) => `<button class="${wUnit() === v ? 'on' : ''}" data-a="set-units" data-v="${v}" role="radio" aria-checked="${wUnit() === v}">${l}</button>`).join('')}</div>
      <p class="muted small">Everything is saved the same way, so you can switch back at any time.</p></div>
    <h2 class="group-title">Theme</h2>    <div class="card">
      <div class="segmented small-seg" role="radiogroup" aria-label="Theme">${['dark', 'light', 'system'].map((t) => `<button class="${s.theme === t ? 'on' : ''}" data-a="theme" data-v="${t}" role="radio" aria-checked="${s.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <p class="muted small">Text follows your iPhone's text size (Settings → Display & Brightness → Text Size).</p>
    </div>` },
    account: { title: 'Account and sync', html: acctUi.page() },
    backup: { title: 'Backup and data', html: `    ${backupTop()}
    ${extras.dataCard()}
    <h2 class="group-title">Reset</h2>
    <div class="list-group">
      <button class="list-row" data-a="reset-plan"><span class="grow">Load the sample plan</span></button>
      <button class="list-row danger-row" data-a="reset-all"><span class="grow">Erase all data</span></button>
    </div>
    <p class="muted small center pad">Lift Tracker · ${db.sessions.length} workouts logged</p>` },
  };
  const pg = pages[ui.setPage];
  if (pg) return `<header class="top"><button class="back" data-a="settings-back" aria-label="Back">${icon('left')}</button><h1 class="grow">${pg.title}</h1></header>${pg.html}`;
  const row = (a, v, title, sub) => `<button class="list-row" data-a="${a}" ${v ? `data-v="${v}"` : ''}><span class="grow"><b>${title}</b>${sub ? `<span class="pick-sub">${sub}</span>` : ''}</span>${icon('right', 'chev')}</button>`;
  const prog = PROGRESSIONS[s.progression] ? PROGRESSIONS[s.progression].name : PROGRESSIONS.double.name;
  const lastBk = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  return `<header class="top"><button class="back" data-a="settings-back" aria-label="Back">${icon('left')}</button><h1 class="grow">Settings</h1></header>
    <div class="list-group">
      ${row('settings-page', 'account', 'Account and sync', esc(acctUi.summary()))}
    </div>
    <div class="list-group">
      ${row('open-builder', '', 'Profile and goals', p ? 'Plan builder · ' + (EXPERIENCE[p.experience]?.label || '') : 'Set up your goals')}
      ${row('settings-page', 'training', 'Training', `Week starts ${FULL_DAY[s.weekStart || 'mon']} · ${esc(prog)}`)}
      ${row('settings-page', 'gym', 'Gym', esc(activeGym(db).name))}
    </div>
    <div class="list-group">
      ${row('settings-page', 'backup', 'Backup and data', lastBk ? `Last backup ${lastBk}` : 'No backup yet')}
      ${row('health-setup', '', 'Apple Health', 'Send workout calories to Health')}
      <label class="list-row toggle-row"><span class="grow"><b>Food tracking</b><span class="pick-sub">${foodOn() ? 'Food tab, calorie and protein targets' : 'Off. Turn on to show the Food tab'}</span></span><input type="checkbox" switch data-a="set-food" ${foodOn() ? 'checked' : ''} aria-label="Food tracking"></label>
      ${row('settings-page', 'appearance', 'Appearance and units', `${{ dark: 'Dark', light: 'Light', system: 'Match iPhone' }[s.theme] || ''} · ${wUnit()}`)}
      ${row('open-share', '', 'Share the app', '')}
      ${row('tour-replay', '', 'Show the tour again', '')}
      <a class="list-row" href="privacy.html" target="_blank" rel="noopener"><span class="grow"><b>Privacy policy</b></span>${icon('right', 'chev')}</a>
    </div>
    <p class="muted small center pad">Lift Tracker · ${db.sessions.length} workouts logged</p>`;
}

// ---------- Feature modules ----------

// Backup: an account is the way to keep a copy now; the older encrypted cloud backup (with its
// server address and access key) stays for people already using it, folded away for everyone else.
function backupTop() {
  const top = account()
    ? `<div class="card"><b>Synced to your account</b><p class="small muted">${esc(acctUi.summary())}. Your plan, workouts, food and body data are kept on the server and on every phone you sign in on.</p><button class="btn block" data-a="settings-page" data-v="account">Account and sync</button></div>`
    : '<div class="card"><b>Back up with an account</b><p class="small">An account keeps a copy of your data on the server and syncs it to your other phones. Sign in with Face ID; no password.</p><button class="btn primary block" data-a="settings-page" data-v="account">Create an account</button></div>';
  return top + (cloudReady() ? cloud.card() : `<details class="adv-settings"><summary>Encrypted cloud backup</summary>${cloud.card()}</details>`);
}

function refChips(ids) {
  return (ids || []).map((id) => REFS[id] ? `<button class="ref" data-a="ref-sheet" data-ids="${ids.join(',')}">${refNum(id)}</button>` : '').join('');
}

function openRefs(ids) {
  openSheet(`<h2>Sources</h2>${ids.filter((id) => REFS[id]).map((id) => `<div class="ref-item"><span class="ref">${refNum(id)}</span><div><a href="${REFS[id].url}" target="_blank" rel="noopener">${esc(REFS[id].cite)}</a><p class="muted small">${esc(REFS[id].finding)}</p></div></div>`).join('')}
    <button class="btn block" data-a="close-sheet">Close</button>`);
}

const ctx = {
  get db() { return db; },
  ui, $, esc, toast, ask, persist, render, openSheet, closeSheet, stepper, num, fmtDate, lineChart, refChips,
  replaceDb(next) { db = next; allowReplace(); ui.saveBlocked = null; persist(); applyTheme(); render(); },
  haptic: () => haptic(),
  // The workout entry for an exercise; before a workout starts, the planned item (ensure=true starts one).
  sessionEntry(uid, ensure = false) {
    const s = ensure ? ensureSession(ui.day) : sessionFor(ui.day);
    return s?.entries[uid] || (ensure ? null : todayItems(ui.day).find((i) => i.uid === uid) || null);
  },
  stopForPain(uid, i) {
    const s = ensureSession(ui.day);
    const entry = s?.entries[uid];
    if (!entry) return;
    const idx = i ?? entry.sets.findIndex((x) => !x.done);
    if (idx >= 0 && entry.sets[idx] && !entry.sets[idx].done) entry.sets[idx].pain = true;
    entry.pain = true;
    stopRest();
  },
  swapEntry(uid, newId) { swapInSession(uid, newId); render(); toast(`Swapped to ${db.exercises[newId].name}.`); },
  sessionFor: (day) => sessionFor(day),
  focus: () => focusFor(db, blockInfo(db).index) || [],
  helpBtn: () => helpBtn(),
  thumb: (ex) => thumb(ex),
  muscleLine: (ex) => muscleLine(ex),
  isAvailable: (ex) => isAvailable(db, ex),
  focusFor: (index) => focusFor(db, index),
  planSwap: (day, uid, newId) => swapInPlan(day, uid, newId),
  canTakeOff: (d) => train.canTakeOff(d),
  // A new main lift goes first in the day, with heavy-compound defaults.
  planAddTop(day, exId) {
    addToPlanDay(day, exId);
    const items = db.plan[day].items;
    const it = items.pop();
    items.unshift({ ...it, sets: 3, repMin: 4, repMax: 8, restSec: 180, manual: true });
    relabel(items, (x) => `g${groupNum(x.group)}`);
  },
  reapplyVariety: () => applyVariety(db, db.settings.variety || 'low', focusFor(db, blockInfo(db).index) || []),
  fresh: () => freshness(currentFatigue(db)),
  openCardioOptions: (day) => openCardioAll(day),
  startTemplate: (id) => actions['tpl-start']({ id }),
  // Append a template (e.g. a finisher) to today's workout as one linked circuit.
  addTemplateToSession(tpl) {
    const session = ensureSession(ui.day);
    if (!session) return;
    const start = Math.max(0, ...session.order.map((u) => parseInt(groupNum(session.entries[u].group), 10) || 0)) + 1;
    for (const it of templateItems(tpl, start, 'fin')) {
      session.entries[it.uid] = { ...makeEntry(it, false), added: true };
      session.order.push(it.uid);
    }
    persist(); render();
  },
};
const food = createFood(ctx);
const year = createYear(ctx);
const extras = createExtras(ctx);
const cloud = createCloud(ctx);
const acctUi = createAccountUi(ctx);
const people = createPeople(ctx);
ctx.people = people;
afterPersist = () => { acctUi.schedule(); people.schedule(); };
const pain = createPain(ctx);
const train = createTrain(ctx);
const focusUi = createFocus(ctx);
const exEditor = createExerciseEditor(ctx);
const planTools = createPlanTools(ctx);
const health = createHealth(ctx);
const tour = createTour(ctx);

// ---------- Render ----------

const TABS = [
  ['today', 'Train', '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'],
  ['plan', 'Plan', '<path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/>'],
  ['food', 'Food', '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>'],
  ['progress', 'Progress', '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>'],
  ['people', 'People', '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.9-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.3c2.3-.2 4.1 1.4 4.7 4.4"/>'],
];
// People needs an account, so it shows only when signed in.
const peopleOn = () => !!account()?.token;
// Food is hidden when food tracking is off (Food tab, bottom; back on from Settings).
const foodOn = () => db.settings.foodTracking !== false;
function visibleTabs() {
  return TABS.filter(([k]) => (k !== 'food' || foodOn()) && (k !== 'people' || peopleOn()));
}
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/></svg>';
const MAIN_SCREENS = ['today', 'plan', 'food', 'history', 'body', 'people'];

function progressTabs() {
  const t = ui.tab === 'body' ? 'body' : 'history';
  return `<div class="segmented" role="tablist" aria-label="Progress view">
    <button class="${t === 'history' ? 'on' : ''}" data-a="progress-view" data-v="history" role="tab" aria-selected="${t === 'history'}">Training</button>
    <button class="${t === 'body' ? 'on' : ''}" data-a="progress-view" data-v="body" role="tab" aria-selected="${t === 'body'}">Body</button>
  </div>`;
}

// ---------- Screen transitions ----------
// A new screen slides in: pushed screens (an exercise, the summary, settings) from the right, going
// back from the left, and switching tabs fades up. Changes within a screen are patched in place.
const PUSHED = ['exercise', 'summary', 'builder', 'edit-session', 'settings'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function screenKey() {
  if (ui.tab === 'exercise') return `exercise:${ui.exUid}`;
  if (ui.tab === 'history' && ui.historyEx) return `history:${ui.historyEx}`;
  if (ui.tab === 'history' && ui.progSub) return `history:${ui.progSub}`;
  if (ui.tab === 'body') return 'history:body';
  if (ui.tab === 'plan' && ui.planView && ui.planView !== 'week') return `plan:${ui.planView}`;
  if (ui.tab === 'settings' && ui.setPage) return `settings:${ui.setPage}`;
  if (ui.tab === 'people' && ui.people?.client) return `people:${ui.people.edit ? 'edit' : 'client'}`;
  return ui.tab;
}
function navDir(from, to) {
  const [fa, fb] = from.split(':');
  const [ta, tb] = to.split(':');
  if (fa === 'exercise' && ta === 'exercise') {
    const order = sessionFor(ui.day)?.order || todayItems(ui.day).map((i) => i.uid);
    return order.indexOf(tb) < order.indexOf(fb) ? 'back' : 'forward';
  }
  if (fa === ta) return fb === undefined || (tb && tb.startsWith(`${fb}-`)) ? 'forward' : 'back';
  if (PUSHED.includes(ta) && !PUSHED.includes(fa)) return 'forward';
  if (PUSHED.includes(fa) && !PUSHED.includes(ta)) return 'back';
  return 'fade';
}
function animateIn(main, dir) {
  if (reduceMotion.matches || !main.animate) return;
  const x = dir === 'forward' ? 32 : dir === 'back' ? -32 : 0;
  const from = { opacity: 0, transform: x ? `translateX(${x}px)` : 'translateY(10px)' };
  const opts = { duration: x ? 440 : 360, delay: 60, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)', fill: 'backwards' };
  for (const el of main.children) {
    // The live workout bar stays put; pinned buttons only fade (moving them would detach them).
    if (el.matches('.workout-bar, .back-to-workout')) continue;
    if (el.matches('.cta')) { el.animate([{ opacity: 0 }, { opacity: 1 }], opts); continue; }
    el.animate([from, { opacity: 1, transform: 'none' }], opts);
  }
}

function render() {
  if (!db) return;
  const screens = {
    today: screenToday, summary: screenSummary, history: screenHistory, body: screenBody, food: () => food.screen(), people: () => people.screen(),
    plan: screenPlan, settings: screenSettings, builder: screenBuilder, 'edit-session': screenEditSession, exercise: screenExercise,
  };
  // A tab that was switched off (food tracking, or signed out of People) falls back to Train.
  if ((ui.tab === 'food' && !foodOn()) || (ui.tab === 'people' && !peopleOn())) ui.tab = 'today';
  // Workout view: once a workout starts, Train and the exercise screen drop the tab bar and extras.
  if (!db.activeSession) ui.peek = false;
  const inWorkout = !!db.activeSession && ['today', 'exercise'].includes(ui.tab) && !ui.peek;
  document.body.classList.toggle('in-workout', inWorkout);
  // Patch the screen in place (no flash, no jump). A different screen is swapped in whole.
  const main = $('#main');
  const y = window.scrollY;
  const html = (screens[ui.tab] || screenToday)();
  const key = screenKey();
  const prevKey = main.dataset.key;
  if (main.dataset.screen === ui.tab && prevKey === key) morph(main, html); else { main.innerHTML = html; main.dataset.screen = ui.tab; }
  main.dataset.key = key;
  if (prevKey && prevKey !== key) animateIn(main, navDir(prevKey, key));
  if (Math.abs(window.scrollY - y) > 1 && document.body.style.position !== 'fixed') window.scrollTo(0, y);
  // Elsewhere in the app mid-workout: a pill to get back.
  if (db.activeSession && !['today', 'exercise', 'summary'].includes(ui.tab)) $('#main').insertAdjacentHTML('beforeend', '<button class="back-to-workout" data-a="back-to-workout">Back to workout</button>');
  refreshRecovery();
  tour.maybe();
  if (ui.tab === 'summary' && ui.summaryFresh) countUp();
  // Settings is reached from a gear in the header of each main screen.
  const header = $('#main header.top');
  const subPage = (ui.tab === 'plan' && ui.planView && ui.planView !== 'week') || (ui.tab === 'history' && (ui.historyEx || ui.progSub)) || ui.tab === 'body';
  if (header && MAIN_SCREENS.includes(ui.tab) && !['today', 'food', 'people'].includes(ui.tab) && !subPage) {
    header.insertAdjacentHTML('beforeend', `<button class="icon-btn" data-a="open-settings" aria-label="Settings">${GEAR}</button>`);
  }
  const active = { exercise: 'today', summary: ui.summaryFresh ? 'today' : 'progress', builder: 'plan', 'edit-session': 'progress', history: 'progress', body: 'progress', settings: ui.prevTab === 'history' || ui.prevTab === 'body' ? 'progress' : ui.prevTab }[ui.tab] || ui.tab;
  $('#tabs').innerHTML = visibleTabs().map(([k, label, icon]) => `
    <button class="tab ${k === active ? 'on' : ''}" data-a="tab" data-tab="${k}" aria-current="${k === active ? 'page' : 'false'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span>${k === 'people' && people.pendingCount() ? `<span class="tab-badge" aria-label="${people.pendingCount()} new">${people.pendingCount()}</span>` : ''}
    </button>`).join('');
  renderRest();
}

// ---------- Events ----------

const actions = {
  tab: (d) => { ui.infoFrom = null; if (d.tab === 'today') ui.peek = false; if (!$('#sheet').hidden) closeSheet(); ui.summaryFresh = false; ui.selecting = false; ui.tab = d.tab === 'progress' ? 'history' : d.tab; if (d.tab === 'progress') ui.progSub = null; if (d.tab === 'plan') ui.planView = 'week'; if (d.tab === 'today') ui.summaryId = null; if (d.tab === 'history') ui.historyEx = null; if (d.tab === 'people') { if (ui.people) { ui.people.client = null; ui.people.edit = null; } people.refresh(); } window.scrollTo(0, 0); render(); },
  day: (d) => { ui.day = d.day; ui.tab = 'today'; ui.showCardio = false; ui.selecting = false; render(); },
  'open-set': (d) => openSetSheet(d.uid, +d.i),
  'leave-workout-view': () => { closeSheet(); ui.peek = true; render(); toast('Your workout keeps running. Tap "Back to workout" to return.'); },
  'back-to-workout': () => { ui.peek = false; ui.day = db.activeSession.day; ui.tab = 'today'; window.scrollTo(0, 0); render(); },
  // Goals per muscle group or per exercise
  'set-mgoal': (d) => {
    db.muscleGoals ||= {};
    if (d.v) db.muscleGoals[d.g] = d.v; else delete db.muscleGoals[d.g];
    const n = applyGoals(db);
    persist(); render(); refreshRecovery();
    toast(d.v ? `${groupById(d.g).name}: ${MGOALS[d.v].name.toLowerCase()}. ${n} exercise${n === 1 ? '' : 's'} updated.` : `${groupById(d.g).name} follows your plan's goals again.`);
  },
  'set-exgoal': (d) => {
    const it = db.plan[ui.day]?.items.find((x) => x.uid === d.uid);
    if (!it) return toast('This one isn\'t in your weekly plan.');
    if (d.v) it.goal = d.v; else delete it.goal;
    applyGoals(db);
    persist(); closeSheet(); render();
    toast(d.v ? `Set to ${MGOALS[d.v].name.toLowerCase()}: ${it.repMin}–${it.repMax} reps.` : 'Follows the muscle\'s goal again.');
  },
  'warm-check': (d) => { const w = warmFor(d.uid); if (!w?.[+d.i]) return; w[+d.i].done = !w[+d.i].done; (ui.warmOpen ||= {})[d.uid] = true; persist(); haptic(); render(); },
  'warm-add': (d) => { const w = warmFor(d.uid); if (!w) return; const last = w[w.length - 1] || { weight: 45, reps: 5 }; w.push({ weight: last.weight, reps: last.reps, done: false }); (ui.warmOpen ||= {})[d.uid] = true; persist(); render(); },
  'warm-del': (d) => { const w = warmFor(d.uid); if (!w) return; w.splice(+d.i, 1); persist(); render(); },
  pause: () => {
    const s = db.activeSession;
    if (!s || s.pausedAt) return;
    s.pausedAt = Date.now();
    stopRest(); releaseAwake(); persist(); render();
    toast('Workout paused. The clock stops until you resume.');
  },
  resume: () => { resumeSession(); persist(); render(); },
  'cal-month': (d) => { ui.calMonth = d.v; render(); },
  'cal-day': (d) => {
    const list = db.sessions.filter((s) => s.date === d.date);
    if (!list.length) return openBackfill(d.date);
    if (list.length === 1 && !d.more) return actions.summary({ id: list[0].id });
    openSheet(`<h2>${fmtDate(d.date)}</h2><div class="list-group">${list.map((s) => `<button class="list-row" data-a="summary" data-id="${s.id}"><span class="grow"><b>${s.freestyle ? 'Freestyle' : esc(db.plan[s.day]?.name || 'Workout')}</b><span class="pick-sub">${Math.round(workoutBurn(db, s).minutes)} min</span></span>${icon('right', 'chev')}</button>`).join('')}</div><button class="btn block" data-a="close-sheet">Close</button>`);
  },
  'backfill-go': (d) => {
    const date = d.date;
    const tpl = d.tpl;
    const items = tpl ? resolveDay(db, tpl, { template: true }).filter((i) => i.ex.category !== 'conditioning' && !['mobility', 'prehab'].includes(i.ex.pattern)) : [];
    const gym = activeGym(db);
    const start = parseDate(date).setHours(17, 0, 0, 0);
    const entries = items.map((it) => {
      const t = targetsFor(db, it, false);
      const w = t.weight == null ? 0 : roundToGym(it.ex, t.weight, gym);
      return { uid: `b${start}-${it.uid}`, exerciseId: it.exerciseId, name: it.ex.name, group: it.group, repMin: it.repMin, repMax: it.repMax, sets: Array.from({ length: it.sets }, () => ({ weight: w, reps: t.reps })) };
    });
    const minutes = tpl ? estimateMinutes(items) : 45;
    // A past workout: history, volume, calories and calendar, but it doesn't move progression targets.
    const s = { id: `s${start}`, date, day: tpl || dayKeyOf(date), freestyle: tpl ? undefined : true, startedAt: start, finishedAt: start + minutes * 60000, backfilled: true, entries, results: [], prs: [], stateBefore: {} };
    db.sessions.push(s);
    db.sessions.sort((a, b) => (a.finishedAt || 0) - (b.finishedAt || 0));
    persist(); closeSheet();
    actions['edit-session']({ id: s.id });
    toast(tpl ? 'Filled in from your plan. Change anything that was different.' : 'Add the exercises you did.');
  },
  'rec-pick': (d) => { ui.recSel = d.g ? { group: d.g } : { area: d.m, side: null }; refreshRecovery(); },
  // A "?" next to a label shows or hides its explanation.
  help: (d, el) => { const p = el.closest('.field, .help-wrap, label, h3, div')?.querySelector('.help-text') || el.parentElement.nextElementSibling; if (!p) return; p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); },
  'set-type': (d, el) => {
    const s = sessionFor(ui.day)?.entries[d.uid]?.sets[+d.i];
    if (!s) return;
    if (d.v) s.type = d.v; else delete s.type;
    if (d.v === 'f') { s.rir = 0; sheetState.rir = 0; }
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
    persist(); render();
  },
  'copy-prev': (d) => {
    const sx = ensureSession(ui.day);
    const s = sx?.entries[d.uid]?.sets[+d.i];
    if (!s || s.done) return;
    s.weight = +d.w; s.reps = +d.r;
    persist(); haptic(); render();
  },
  'del-set': (d) => {
    const sx = ensureSession(ui.day);
    const e = sx?.entries[d.uid];
    if (!e) return;
    if (e.sets.length <= 1) return toast('An exercise needs at least one set. Remove the exercise instead.');
    e.sets.splice(+d.i, 1);
    persist(); render();
  },
  'list-view': () => { db.settings.listView = db.settings.listView === 'full' ? 'cards' : 'full'; persist(); render(); },
  'open-recovery': (d) => { if (d?.g) ui.recSel = { group: d.g }; return openSheet(`<h2>Recovery</h2>${freshnessCard().replace('<section class="card recovery">', '<section class="recovery in-sheet">').replace('<h3>Recovery</h3>', '<h3 class="sr-only">Recovery</h3>')}<button class="btn block" data-a="close-sheet">Close</button>`); },
  'tip-ok': (d) => { (db.settings.tips ||= {})[d.k] = true; persist(); render(); },
  'why-workout': () => openWhyWorkout(),
  'set-core': (d) => {
    const r = applyCore(db, d.v);
    persist(); render();
    toast(d.v === 'end' ? `Core finishes each lifting day (${r.days} days).` : d.v === 'warmup' ? 'Core activation now starts each lifting day.' : d.v === 'finisher' ? 'Core moves into your finishers.' : 'Core goes into interval and conditioning sessions.');
  },
  'set-variety': (d) => {
    const n = applyVariety(db, d.v, focusFor(db, blockInfo(db).index) || []);
    persist(); render();
    toast(d.v === 'low' ? 'Same exercises every week.' : `${n} exercise${n === 1 ? '' : 's'} will rotate. Focus lifts stay the same.`);
  },
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
    const weight = fromDisp(num('f-weight'));
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
    s.weight = fromDisp(num('f-weight')) ?? s.weight;
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
    if (e.metric && e.metric !== 'reps' || db.exercises[e.exerciseId]?.category === 'conditioning') {
      const { done, pain, rir, ...vals } = last; // copy the round's measures, not its status
      e.sets.push({ ...vals, rir: null, done: false, pain: false });
    } else e.sets.push(newSet(e.dropSet ? Math.max(0, last.weight - 10) : last.weight, last.reps));
    persist(); render();
  },
  'remove-set': (d) => {
    if (!$('#sheet').hidden) closeSheet();
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
  finish: async () => {
    const s = db.activeSession;
    const open = s.order.reduce((a, u) => a + (s.entries[u].pain ? 0 : s.entries[u].sets.filter((x) => !x.done).length), 0);
    if (!(await ask(open ? `${open} set${open > 1 ? 's' : ''} not logged. Finish the workout anyway?` : 'Finish this workout?', 'Finish'))) return;
    finishWorkout();
  },
  discard: async () => {
    if (!(await ask('Discard this workout? Logged sets will be lost.', 'Discard', true))) return;
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
  'cardio-toggle': (d) => { (ui.cardioOpen ||= {})[d.day] = d.open !== '1'; render(); },
  'ex-toggle': (d) => { (ui.exOpen ||= {})[d.uid] = d.open !== '1'; render(); },
  'start-workout': () => { ensureSession(ui.day); haptic(); render(); },
  'open-settings': (d) => { if (!$('#sheet').hidden) closeSheet(); ui.setPage = d?.page || null; ui.prevTab = ui.tab; ui.tab = 'settings'; window.scrollTo(0, 0); render(); },
  'settings-back': () => { if (ui.setPage) { ui.setPage = null; window.scrollTo(0, 0); return render(); } ui.tab = ui.prevTab || 'today'; window.scrollTo(0, 0); render(); },
  'set-food': (d, el) => { db.settings.foodTracking = !!el.checked; persist(); render(); toast(foodOn() ? 'Food tracking is on.' : 'Food tracking is off.'); },
  'food-off': async () => {
    if (!(await ask('Turn off food tracking? The Food tab goes away and your food log is kept. Turn it back on in Settings.', 'Turn off'))) return;
    db.settings.foodTracking = false; persist(); ui.tab = 'today'; window.scrollTo(0, 0); render(); toast('Food tracking is off. Turn it back on in Settings.');
  },
  'settings-page': (d) => { ui.setPage = d.v; window.scrollTo(0, 0); render(); },
  'body-tab': (d) => { ui.bodyTab = d.v; render(); },
  'prog-sub': (d) => { ui.progSub = d.v; window.scrollTo(0, 0); render(); },
  'progress-back': () => { if (ui.tab === 'body') ui.tab = 'history'; ui.progSub = ui.progSub?.startsWith('strength-') ? 'strength' : null; window.scrollTo(0, 0); render(); },
  'ask-yes': () => answerAsk(true),
  'ask-no': () => answerAsk(false),
  'goto-plan-day': (d) => { closeSheet(); ui.tab = 'plan'; ui.planDay = d.day; ui.planView = 'day'; window.scrollTo(0, 0); render(); },
  'plan-open-day': (d) => { ui.planDay = d.day; ui.planView = 'day'; window.scrollTo(0, 0); render(); },
  'plan-back': () => { ui.planView = 'week'; window.scrollTo(0, 0); render(); },
  'progress-view': (d) => { ui.tab = d.v; ui.historyEx = null; window.scrollTo(0, 0); render(); },
  'start-empty': () => { if (db.activeSession) return toast('Finish or discard the current workout first.'); db.settings.welcomed = true; startSession(ui.day, true); render(); openPicker({ mode: 'session-add' }); },
  'session-add': () => openPicker({ mode: 'session-add' }),
  'ex-open-close': (d) => { closeSheet(); actions['ex-open'](d); },
  'ex-open': (d) => { ui.backUid = null; ui.exUid = d.uid; ui.tab = 'exercise'; window.scrollTo(0, 0); render(); },
  'ex-go': (d) => { ui.backUid = null; ui.exUid = d.uid; window.scrollTo(0, 0); render(); },
  'set-autoadvance': (d, el) => { db.settings.autoAdvance = el.checked; persist(); },
  // Back to the whole workout, with the exercise you're on in view.
  'ex-close': () => { ui.tab = 'today'; render(); const el = document.querySelector('.ex-item.is-next'); if (el) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0); },
  'check-inline': (d) => {
    const sx = ensureSession(ui.day);
    if (!sx) return;
    const s = sx.entries[d.uid].sets[+d.i];
    if (s.done) { s.done = false; persist(); render(); return; }
    // Read whichever fields this exercise logs (reps/weight, or time/distance/calories).
    const vals = {};
    for (const el of document.querySelectorAll(`[data-set^="${d.uid}:${d.i}:"]`)) {
      const k = el.dataset.set.split(':')[2];
      const v = k === 'reps' ? parseInt(el.value, 10) : k === 'weight' ? fromDisp(parseFloat(el.value)) : parseFloat(el.value);
      if (Number.isFinite(v)) vals[k] = v;
    }
    const e = sx.entries[d.uid];
    if (e.metric && e.metric !== 'reps' || db.exercises[e.exerciseId]?.category === 'conditioning') {
      const key = METRIC_FIELDS[e.metric || 'reps'][0][0];
      if (!(vals[key] > 0)) return toast(`Enter ${METRIC_FIELDS[e.metric || 'reps'][0][1].toLowerCase()} first.`);
    } else if (!vals.reps || !Number.isFinite(vals.weight)) return toast('Enter reps and weight first.');
    logSet(d.uid, +d.i, vals);
  },
  'today-add': () => openPicker({ mode: 'today-add' }),
  'work-start': (d) => {
    const sx = ensureSession(ui.day);
    if (!sx) return;
    const sec = parseFloat($('#f-c1')?.value) || parseFloat($(`[data-set="${d.uid}:${d.i}:time"]`)?.value) || sx.entries[d.uid].sets[+d.i].time || 30;
    if ($('#f-c1')) closeSheet();
    unlockAudio();
    startWork(sec, `Work · round ${+d.i + 1}`, () => { logSet(d.uid, +d.i, { time: sec }); toast('Round done.'); });
  },
  'open-templates': (d) => openTemplates(d.day || ui.day, d.mode || 'today'),
  'save-round': (d) => {
    const num = (id) => { const v = parseFloat($(`#${id}`)?.value); return Number.isFinite(v) ? v : null; };
    const v1 = num('f-c1');
    if (!(v1 > 0)) return toast('Enter a value first.');
    const vals = { [d.k1]: v1 };
    const v2 = num('f-c2');
    if (v2 != null) vals[d.k2] = d.k2 === 'weight' ? fromDisp(v2) : v2;
    closeSheet();
    logSet(d.uid, +d.i, vals);
  },
  'tpl-start': (d) => {
    const tpl = TEMPLATES.find((t) => t.id === d.id);
    if (db.activeSession) return toast('Finish or discard the current workout first.');
    const session = startSession(ui.day, true);
    const extra = db.settings.corePlacement === 'conditioning' && tpl.kind !== 'recovery' ? templateItems(coreCircuit(db), tpl.items.length + 1, 'core') : [];
    for (const it of [...templateItems(tpl, 1, 'tpl'), ...extra]) {
      session.entries[it.uid] = { ...makeEntry(it, false), added: true };
      session.order.push(it.uid);
    }
    persist(); closeSheet(); ui.tab = 'today'; render();
    toast(`${tpl.name} ready. Warm up first, then tap a round's play button to start its timer.`);
  },
  'tpl-add': (d) => {
    const tpl = TEMPLATES.find((t) => t.id === d.id);
    const day = d.day;
    if (!db.plan[day]) db.plan[day] = { name: tpl.name, items: [] };
    const plan = db.plan[day];
    const start = Math.max(0, ...plan.items.map((i) => parseInt(groupNum(i.group), 10) || 0)) + 1;
    plan.items.push(...templateItems(tpl, start, day));
    if (db.settings.corePlacement === 'conditioning' && tpl.kind !== 'recovery') plan.items.push(...templateItems(coreCircuit(db), start + tpl.items.length, `${day}c`));
    if ((db.settings.dayModes[day] || 'rest') === 'rest') db.settings.dayModes[day] = plan.items.some((i) => db.exercises[i.exerciseId]?.category !== 'conditioning') ? 'both' : 'cardio';
    persist(); closeSheet(); render();
    toast(`${tpl.name} added to ${FULL_DAY[day]}s.`);
  },
  'sel-toggle': (d, el) => {
    ui.selected ||= new Set();
    if (el.checked) ui.selected.add(d.uid); else ui.selected.delete(d.uid);
    render();
  },
  'set-metric': (d) => {
    const items = todayItems(ui.day);
    const item = items.find((x) => x.uid === d.uid);
    const ex = item && db.exercises[item.exerciseId];
    if (!ex?.modes?.includes(d.v)) return;
    ex.metricPref = d.v; // remembered for next time
    const e = sessionFor(ui.day)?.entries[d.uid];
    if (e) {
      // Undone rounds switch over to the new measure; logged ones keep what was logged.
      const key = METRIC_FIELDS[d.v][0][0];
      const target = DEFAULT_TARGET[d.v];
      e.metric = d.v; e.target = target;
      for (const x of e.sets) if (!x.done) { for (const k of ['reps', 'time', 'dist', 'cal', 'weight']) delete x[k]; x[key] = target; }
    }
    persist(); render();
    toast(`${ex.name}: by ${METRICS[d.v].toLowerCase()}.`);
  },
  'add-routine': (d) => {
    const sx = sessionFor(ui.day);
    if (!sx) return;
    setDayExtra(db, ui.day, d.k, true);
    const ph = d.k === 'warm' ? 'warmup' : 'cooldown';
    sx.removed = (sx.removed || []).filter((u) => !u.startsWith(`${ph}-`));
    persist(); render();
    toast(d.k === 'warm' ? 'Warm-up added at the top.' : 'Cool-down added at the end.');
  },
  'add-cardio': () => { ui.workoutCardio = ui.day; (ui.cardioOpen ||= {})[ui.day] = true; render(); requestAnimationFrame(() => document.querySelector('.card.cardio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); },
  'day-edit': (d) => {
    const day = d.day || ui.day;
    const x = dayExtras(db, day);
    openSheet(`<h2>Today's workout</h2>
      <div class="list-group">
        <button class="list-row" data-a="adj-open" data-day="${day}"><span class="grow">Time and gym<span class="pick-sub">Fit the workout to the time you have, or another gym</span></span>${icon('right', 'chev')}</button>
        <label class="list-row toggle"><span class="grow">Warm-up<span class="pick-sub">Picked for today's muscles</span></span><input type="checkbox" data-a="extra-check" data-k="warm" data-day="${day}" ${x.warm ? 'checked' : ''}></label>
        <label class="list-row toggle"><span class="grow">Cool-down<span class="pick-sub">A few stretches at the end</span></span><input type="checkbox" data-a="extra-check" data-k="cool" data-day="${day}" ${x.cool ? 'checked' : ''}></label>
        <button class="list-row" data-a="why-workout"><span class="grow">Why this workout</span>${icon('right', 'chev')}</button>
      </div>`);
  },
  'extra-check': (d, el) => { setDayExtra(db, d.day, d.k, el.checked); persist(); render(); },
  'list-view-menu': () => { closeSheet(); actions['list-view'](); },
  'set-units': async (d) => {
    if (d.v === wUnit()) return;
    db.settings.units = d.v; setUnit(d.v);
    // Offer the matching equipment: kilogram bar and plates, or pound ones.
    const g = activeGym(db);
    const to = d.v === 'kg' ? KG_GYM : LB_GYM;
    if ((await ask(d.v === 'kg' ? `Switch ${g.name} to kilogram equipment (20 kg bar; 25 to 1.25 kg plates; 2.5 kg dumbbell and machine steps)?` : `Switch ${g.name} to pound equipment (45 lb bar; 45 to 2.5 lb plates; 5 lb steps)?`, 'Switch equipment'))) {
      Object.assign(g, { barWeight: to.barWeight, plates: [...to.plates], dbStep: to.dbStep, machineStep: to.machineStep, dbMax: to.dbMax });
      // Weight jumps to the nearest common step in the new unit.
      const steps = d.v === 'kg' ? [1.25, 2.5, 5].map((k) => k / 0.45359237) : [2.5, 5, 10];
      for (const ex of Object.values(db.exercises)) ex.increment = steps.reduce((a, b) => (Math.abs(b - ex.increment) < Math.abs(a - ex.increment) ? b : a));
    }
    persist(); render(); toast(`Weights in ${d.v === 'kg' ? 'kilograms' : 'pounds'}.`);
  },
  'tour-replay': () => { tour.replay(); ui.setPage = null; ui.tab = 'today'; ui.day = defaultDay(); window.scrollTo(0, 0); render(); },
  'vol-open': (d) => openMuscleWork(d),
  'quick-build': () => openQuickBuild(),
  'qb-set': (d) => { ui.qb[d.k] = d.k === 'days' ? +d.v : d.v; openQuickBuild(); },
  'qb-full': () => { closeSheet(); openBuilder(); },
  'plan-first-today': (d) => { moveDay(db, d.day, dayKeyOf(todayStr())); persist(); ui.day = dayKeyOf(todayStr()); render(); toast(`${db.plan[d.day]?.name || 'Workout'} is today. Your other days stay the same.`); },
  'qb-go': () => {
    const q = ui.qb;
    const g = QB_GOALS[q.goal];
    const draft = { ...defaultProfile(db), goals: { ...g.goals }, weightGoal: g.weightGoal || null, liftDays: q.days, equipment: [...QB_EQUIP[q.equip].eq], routines: ['warm'], experience: q.exp || 'beginner' };
    ui.b = { step: 4, draft, liftEdited: true, cardioEdited: false, splitEdited: false, quick: true };
    const { p, rx } = builderState();
    try { ui.b.out = generatePlan(db, p, rx, p.liftDays, p.cardioDays, p.split); } catch (e) { ui.b = null; return toast(e.message || 'Could not build that plan.'); }
    closeSheet();
    applyBuilt();
    ui.tab = 'today'; ui.day = defaultDay(); render(); // Train shows the workout, or 'Your plan is ready'
  },
  'base-find': (d) => openBaseFind(d.uid),
  'base-set': (d) => {
    const w = fromDisp(num('bf-w'));
    const r = Math.round(num('bf-r') || 0);
    if (!(w > 0) || !(r > 0)) return toast('Enter the weight and reps you did.');
    const sx = ensureSession(ui.day);
    const e = sx?.entries[d.uid];
    if (!e) return;
    const ex = db.exercises[e.exerciseId];
    const est = e1rm(w, r);
    const target = roundToGym(ex, est / (1 + (e.repMin + 2) / 30), activeGym(db));
    for (const x of e.sets) if (!x.done) { x.weight = target; x.reps = e.repMin; }
    persist(); closeSheet(); render();
    toast(`${fmtW(target, ex)} × ${e.repMin} to start. It adjusts from here.`);
  },
  'skip-keep': (d) => { (db.settings.skipKeep ||= {})[d.uid] = true; persist(); render(); },
  'skip-remove': (d) => {
    const plan = db.plan[ui.day];
    const it = plan?.items.find((x) => x.uid === d.uid);
    if (!it) return;
    pushUndo();
    plan.items = plan.items.filter((x) => x !== it);
    persist(); render();
    toast(`Removed ${db.exercises[it.exerciseId].name} from ${FULL_DAY[ui.day]}s.`, { label: 'Undo', a: 'list-undo' });
  },
  'vol-add-plan': (d) => {
    const ex = db.exercises[d.id];
    const plan = db.plan[d.day];
    if (!ex || !plan) return;
    const compound = ex.category === 'compound';
    const nextGroup = Math.max(0, ...plan.items.map((i) => parseInt(groupNum(i.group), 10) || 0)) + 1;
    plan.items.push({ uid: `${d.day}-${Date.now()}`, exerciseId: ex.id, group: String(nextGroup), sets: 3, repMin: compound ? 6 : 10, repMax: compound ? 10 : 15, restSec: compound ? 150 : 90, note: '' });
    applyGoals(db); persist(); render();
    toast(`Added ${ex.name} to ${FULL_DAY[d.day]}s.`);
    openMuscleWork(ui.volSel);
  },
  'vol-add-today': (d) => { addToSession(d.id); closeSheet(); render(); toast(`Added ${db.exercises[d.id].name} to today's workout.`); },
  'rv-open': () => openReview(),
  'rv-dismiss': () => { db.settings.reviewSeen = lastWeekStart(); persist(); render(); },
  'rv-apply': (d) => {
    const x = ui.rv?.items[+d.i];
    if (!x?.action) return;
    const makeItem = (day, exId, sets) => {
      const ex = db.exercises[exId];
      const compound = ex.category === 'compound';
      const plan = db.plan[day];
      const nextGroup = Math.max(0, ...plan.items.map((i) => parseInt(groupNum(i.group), 10) || 0)) + 1;
      return { uid: `${day}-${Date.now()}`, exerciseId: exId, group: String(nextGroup), sets, repMin: compound ? 6 : 10, repMax: compound ? 10 : 15, restSec: compound ? 150 : 90, note: '' };
    };
    const msg = applySuggestion(db, x.action, makeItem);
    if (!msg) return toast('That change no longer fits your plan.');
    applyGoals(db);
    persist(); render();
    const btn = document.querySelector(`[data-a="rv-apply"][data-i="${d.i}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Done'; }
    toast(msg);
  },
  'warm-shuffle': () => { shuffleWarmup(db, ui.day); persist(); render(); toast('New warm-up.'); },
  'list-undo': () => { if (!$('#sheet').hidden) closeSheet(); undoList(); },
  'log-all': (d) => {
    closeSheet();
    const sx = ensureSession(ui.day);
    const e = sx?.entries[d.uid];
    if (!e) return;
    const ex = db.exercises[e.exerciseId];
    const cond = (e.metric && e.metric !== 'reps') || ex?.category === 'conditioning';
    const key = cond ? METRIC_FIELDS[e.metric || 'reps'][0][0] : 'reps';
    const logged = [];
    e.sets.forEach((x, i) => {
      if (x.done || x.pain) return;
      if (!cond && x.weight == null && ex?.type === 'bodyweight') x.weight = 0;
      if (cond ? !(x[key] > 0) : !(x.reps > 0 && Number.isFinite(x.weight))) return;
      x.done = true; logged.push(i);
    });
    if (!logged.length) return toast('Fill in weight and reps first, then log them all.');
    settleDone(sx, d.uid);
    resumeSession(sx); persist(); haptic(); render();
    ui.logAllUndo = { uid: d.uid, idx: logged };
    toast(`Logged ${logged.length} set${logged.length === 1 ? '' : 's'} of ${ex.name}.`, { label: 'Undo', a: 'log-all-undo' });
  },
  'log-all-undo': () => {
    const u = ui.logAllUndo; ui.logAllUndo = null;
    const e = u && sessionFor(ui.day)?.entries[u.uid];
    if (!e) return;
    u.idx.forEach((i) => { if (e.sets[i]) e.sets[i].done = false; });
    persist(); render(); toast('Undone.');
  },
  'warm-make': (d) => {
    const sx = ensureSession(ui.day);
    if (!sx?.entries[d.uid]) return;
    delete sx.entries[d.uid].warm;
    warmFor(d.uid);
    (ui.warmOpen ||= {})[d.uid] = true;
    persist(); render();
  },
  'resume-finished': async () => {
    if (!canReopen()) return toast('Only a workout finished today can be reopened.');
    if (!(await ask('Reopen this workout? It comes back exactly as you left it, and your targets update again when you finish.', 'Reopen'))) return;
    const { id, finishedAt, reopen } = db.lastFinish;
    for (const k of ['state', 'plan', 'week', 'runGoal', 'recoveryAdjust']) { if (reopen[k] === undefined) delete db[k]; else db[k] = reopen[k]; }
    db.sessions = db.sessions.filter((x) => x.id !== id);
    db.cardio = (db.cardio || []).filter((c) => c.id !== `c${finishedAt}`);
    const a = reopen.active;
    a.pausedMs = (a.pausedMs || 0) + (Date.now() - finishedAt); // time away doesn't count as workout time
    db.activeSession = a;
    delete db.lastFinish;
    closeSheet();
    ui.day = a.day; ui.tab = 'today'; ui.summaryFresh = false;
    persist(); keepAwake(); render();
    toast('Workout reopened.');
  },
  'select-mode': () => { ui.selecting = !ui.selecting; ui.selected = new Set(); render(); },
  'link-selected': () => {
    pushUndo();
    linkUids([...ui.selected]);
    const n = ui.selected.size;
    ui.selecting = false; ui.selected = new Set();
    persist(); render(); toast(`Linked as a ${n > 2 ? 'circuit' : 'superset'}.`);
  },
  'unlink-selected': () => { pushUndo(); unlinkUids([...ui.selected]); ui.selecting = false; ui.selected = new Set(); persist(); render(); toast('Unlinked.'); },
  'link-next': (d) => {
    const items = todayItems();
    const i = items.findIndex((x) => x.uid === d.uid);
    const grp = groupsOf(items).find((g) => g.items.some((x) => x.uid === items[i + 1]?.uid));
    const uids = [d.uid, ...(grp ? grp.items.map((x) => x.uid) : [items[i + 1].uid])];
    if (!$('#sheet').hidden) closeSheet();
    pushUndo(); linkUids(uids); persist(); render(); toast('Linked with the next exercise.', { label: 'Undo', a: 'list-undo' });
  },
  'unlink-one': (d) => { if (!$('#sheet').hidden) closeSheet(); pushUndo(); unlinkUids([d.uid]); persist(); render(); toast('Unlinked.', { label: 'Undo', a: 'list-undo' }); },
  'ex-rest': (d) => {
    const opts = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
    openSheet(`<h2>Rest timer</h2><p class="muted small">Rest after this exercise${groupsOf(todayItems()).find((g) => g.items.some((x) => x.uid === d.uid))?.linked ? ' (after each round of the group)' : ''}.</p>
      <div class="chips wrap">${opts.map((s) => `<button class="chip" data-a="rest-set" data-uid="${d.uid}" data-v="${s}">${s ? fmtRest(s) : 'Off'}</button>`).join('')}</div>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  },
  'rest-set': (d) => {
    const { list } = editableList();
    const items = todayItems();
    const grp = groupsOf(items).find((g) => g.items.some((x) => x.uid === d.uid));
    const target = grp?.linked ? grp.items[grp.items.length - 1].uid : d.uid;
    const it = list.find((x) => x.uid === target);
    if (it) it.restSec = +d.v;
    persist(); closeSheet(); render(); toast(+d.v ? `Rest set to ${fmtRest(+d.v)}.` : 'Rest timer off.');
  },
  'block-focus': (d) => openFocusPicker(+d.i),
  'block-review': (d) => openBlockReview(+d.i),
  'block-feel': (d, el) => { ui.blockFeel = +d.v; el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); },
  'focus-toggle': (d) => {
    const f = ui.focusDraft;
    const i = f.indexOf(d.id);
    if (i >= 0) f.splice(i, 1); else if (f.length < 4) f.push(d.id); else return toast('Pick up to 4 focus lifts.');
    $('#focus-chooser').innerHTML = focusChooser(f);
  },
  'focus-add': () => {
    const exId = $('#focus-add-ex').value;
    const day = $('#focus-add-day').value;
    if (!exId || !day) return;
    addToPlanDay(day, exId);
    // Main lifts go first in the day.
    const items = db.plan[day].items;
    const it = items.pop();
    items.unshift({ ...it, sets: 3, repMin: 4, repMax: 8, restSec: 180 });
    relabel(items, (x) => `g${groupNum(x.group)}`);
    if (!ui.focusDraft.includes(exId)) { if (ui.focusDraft.length >= 4) ui.focusDraft.pop(); ui.focusDraft.push(exId); }
    persist();
    $('#focus-chooser').innerHTML = focusChooser(ui.focusDraft);
    toast(`${db.exercises[exId].name} added to ${FULL_DAY[day]}.`);
  },
  'focus-save': () => { db.blocks.focus[ui.focusIndex] = [...ui.focusDraft]; persist(); closeSheet(); render(); toast('Focus lifts saved.'); },
  'block-save': (d) => {
    const index = +d.i;
    const b = blockInfo(db);
    db.blocks.reviews[index] = {
      date: todayStr(), feel: ['too-easy', 'right', 'too-much'][ui.blockFeel ?? 1], note: $('#block-note').value.trim(),
      results: focusFor(db, index).map((id) => ({ exerciseId: id, ...liftProgress(db, id, b.index === index ? b : { ...b, index }) })),
    };
    db.blocks.focus[index + 1] = [...ui.focusDraft];
    if (db.blocks.byDay?.[index]) db.blocks.byDay[index + 1] = JSON.parse(JSON.stringify(db.blocks.byDay[index]));
    ui.blockFeel = undefined;
    persist(); closeSheet(); render(); toast(`Block ${index} saved. Block ${index + 1} focus is set.`);
  },
  'deload-weeks': (d) => { db.settings.deloadEvery = Math.max(3, Math.min(8, db.settings.deloadEvery + +d.v)); persist(); render(); },
  'deload-off': (d, el) => { db.settings.deloadOff = el.checked; persist(); render(); },
  'ramp-start': (d) => { db.settings.rampStart = +d.v; persist(); render(); },
  'ramp-end': (d) => { db.settings.rampEnd = +d.v; persist(); render(); },
  'ex-sheet': (d) => openExMenu(d.uid),
  'ex-details': (d) => openExerciseSheet(d.uid, d.focus),
  'xv-rot': (d) => {
    const it = db.plan[ui.day]?.items.find((x) => x.uid === d.uid);
    if (!it) return;
    const base = it.variants?.[0] || it.exerciseId;
    if (d.v === 'lock') Object.assign(it, { lock: true, rotate: undefined, variants: undefined, autoVar: undefined, exerciseId: base });
    else if (d.v === 'auto') Object.assign(it, { lock: undefined, rotate: undefined, variants: undefined, autoVar: undefined, exerciseId: base });
    else Object.assign(it, { lock: undefined, autoVar: undefined, rotate: d.v, variants: it.variants?.length ? it.variants : [base], exerciseId: base });
    persist(); openExerciseSheet(d.uid); render();
  },
  'xv-var': (d) => {
    const it = db.plan[ui.day]?.items.find((x) => x.uid === d.uid);
    if (!it) return;
    const base = it.variants?.[0] || it.exerciseId;
    const v = new Set(it.variants || [base]);
    if (v.has(d.id)) v.delete(d.id); else v.add(d.id);
    v.add(base);
    it.variants = [base, ...[...v].filter((x) => x !== base)];
    it.rotate ||= 'week';
    persist(); openExerciseSheet(d.uid); render();
    if (it.variants.length > 1) toast(`Rotating ${it.variants.map((x) => db.exercises[x].name).join(', ')}.`);
  },
  'ex-lock': (d) => {
    const it = db.plan[ui.day]?.items.find((i) => i.uid === d.uid);
    if (!it) return toast('This one isn\'t in your weekly plan.');
    it.lock = !it.lock;
    if (it.lock) { delete it.variants; delete it.rotate; delete it.autoVar; }
    applyVariety(db, db.settings.variety || 'low', focusFor(db, blockInfo(db).index) || []);
    persist(); closeSheet(); render();
    toast(it.lock ? 'Kept the same every week.' : 'Follows your variety setting again.');
  },
  'add-drop': (d) => {
    const sx = ensureSession(ui.day);
    const e = sx?.entries[d.uid];
    if (!e) return;
    const last = e.sets[e.sets.length - 1];
    const ex = db.exercises[e.exerciseId];
    // About 20% lighter, straight after the last set, for as many reps as you can.
    const w = last.weight ? roundToGym(ex, last.weight * 0.8, activeGym(db)) : last.weight;
    e.sets.push({ ...newSet(w, last.reps), type: 'd' });
    persist(); render();
    toast(`Drop set added at ${wt(w)}. Go straight into it after your last set.`);
  },
  'extra-toggle': (d) => {
    const cur = dayExtras(db, d.day)[d.k];
    setDayExtra(db, d.day, d.k, !cur);
    persist(); render();
  },
  'set-progression': (d) => { db.settings.progression = d.v; persist(); render(); toast(d.v === 'double' ? 'All lifts: add reps, then weight.' : `${PROGRESSIONS[d.v].name} on your focus lifts.`); },
  'set-exprog': (d, el) => { const ex = db.exercises[d.id]; if (!ex) return; const v = el?.value ?? d.v; if (v) ex.progression = v; else delete ex.progression; persist(); render(); toast(v ? `${ex.name}: ${PROGRESSIONS[v].name.toLowerCase()}.${db.activeSession ? " Starts next workout." : ""}` : `${ex.name} follows your plan again.`); },
  'set-extra': (d, el) => { db.settings[d.k] = el.checked; persist(); render(); },
  'ex-more': (d) => openExerciseSheet(d.uid),
  'day-options': () => openDayOptions(),
  'day-mode-today': (d) => { db.settings.dayModes[ui.day] = d.v; persist(); render(); openDayOptions(); },
  'ex-note-save': (d) => { const sx = ensureSession(ui.day); if (!sx) return; sx.entries[d.uid].note = $('#ex-note').value.trim(); persist(); closeSheet(); render(); toast('Note saved.'); },
  'ex-move': (d) => {
    // Move past a whole neighbouring group so supersets stay together.
    const sx = ensureSession(ui.day);
    if (!sx) return; pushUndo(); const o = sx.order; const i = o.indexOf(d.uid);
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
  'ex-remove': async (d) => {
    if (!sessionFor(ui.day)) {
      if (d.uid.startsWith('warmup-') || d.uid.startsWith('cooldown-')) return toast('Turn the warm-up or cool-down off with its button above the list.');
      pushUndo();
      adjustDay(db, ui.day, { minutes: weekOverride(db, ui.day)?.minutes || null, gymId: weekOverride(db, ui.day)?.gymId || null });
      const o = db.week.days[ui.day];
      o.items = o.items.filter((i) => i.uid !== d.uid);
      if (o.base) o.base = o.base.filter((i) => i.uid !== d.uid);
      persist(); closeSheet(); render();
      return toast('Removed for this week. Your plan is unchanged.', { label: 'Undo', a: 'list-undo' });
    }
    const sx = ensureSession(ui.day);
    if (!sx) return; const e = sx.entries[d.uid];
    if (e.sets.some((x) => x.done) && !(await ask('Remove this exercise and its logged sets from today?', 'Remove', true))) return;
    pushUndo();
    sx.order = sx.order.filter((u) => u !== d.uid); delete sx.entries[d.uid];
    if (!sx.freestyle) (sx.removed ||= []).push(d.uid);
    persist(); closeSheet(); render();
    toast(`Removed ${db.exercises[e.exerciseId]?.name || 'exercise'}.`, { label: 'Undo', a: 'list-undo' });
  },
  'ex-info': (d) => {
    closeSheet();
    if (ui.tab !== 'history') ui.infoFrom = { tab: ui.tab, exUid: ui.exUid, y: window.scrollY };
    ui.historyEx = d.id; ui.tab = 'history'; window.scrollTo(0, 0); render();
  },
  fb: (d) => { const e = sessionFor(ui.day).entries[d.uid]; e.feedback = e.feedback === d.v ? undefined : d.v; persist(); render(); },
  'fb-joint': (d) => { const e = sessionFor(ui.day).entries[d.uid]; e.joint = !e.joint; persist(); render(); },
  'plan-view': (d) => { ui.planView = d.v; window.scrollTo(0, 0); render(); },
  'ref-sheet': (d) => openRefs(d.ids.split(',')),
  'share-session': async (d) => {
    const sx = db.sessions.find((x) => x.id === d.id);
    const lines = [`${fmtDate(sx.date)} — ${sx.freestyle ? 'Workout' : db.plan[sx.day]?.name || 'Workout'}`];
    for (const e of sx.entries) lines.push(`${e.name}: ${e.sets.filter((x) => !x.pain).map((x) => `${x.weight ? x.weight + '×' : ''}${x.reps}`).join(', ')}`);
    for (const p of sx.prs || []) lines.push(`PR — ${p.name}: ${p.text}`);
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
  'es-add-set': (d) => {
    const sx = db.sessions.find((x) => x.id === ui.editId);
    readEditInputs(sx);
    const e = sx.entries[+d.i];
    const last = e.sets[e.sets.length - 1] || { weight: 0, reps: 8 };
    e.sets.push({ weight: last.weight, reps: last.reps });
    render();
  },
  'es-add-ex': () => { const sx = db.sessions.find((x) => x.id === ui.editId); readEditInputs(sx); openPicker({ mode: 'es-add' }); },
  'es-del-entry': (d) => { const sx = db.sessions.find((x) => x.id === ui.editId); readEditInputs(sx); sx.entries.splice(+d.i, 1); render(); },
  'es-save': () => {
    const sx = db.sessions.find((x) => x.id === ui.editId);
    readEditInputs(sx);
    const changed = recomputeSession(sx);
    persist(); ui.summaryId = sx.id; ui.summaryFresh = false; ui.tab = 'summary'; render();
    toast(changed.length ? `Saved. Targets updated for ${changed.length} exercise${changed.length > 1 ? 's' : ''}.` : 'Saved.');
  },
  'es-delete': async () => {
    const sx = db.sessions.find((x) => x.id === ui.editId);
    if (!(await ask('Delete this workout permanently?', 'Delete', true))) return;
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
  // The sample plan (no longer offered at first run; kept for "Load the sample plan" and tests).
  'welcome-sample': () => { db.plan = defaultPlan(); db.settings.dayModes = { mon: 'lift', tue: 'lift', wed: 'lift', thu: 'lift', fri: 'lift', sat: 'rest', sun: 'rest' }; db.settings.welcomed = true; db.settings.planSince = todayStr(); applyCore(db, 'end'); persist(); render(); },
  'b-exit': () => { ui.b = null; ui.tab = 'plan'; render(); },
  'b-next': () => {
    if (ui.b.step === 0 && !aboutYouOk()) return;
    ui.b.step = Math.min(B_STEPS.length - 1, ui.b.step + 1); window.scrollTo(0, 0); render();
  },
  'b-back': () => { ui.b.step = Math.max(0, ui.b.step - 1); window.scrollTo(0, 0); render(); },
  'b-step': (d) => {
    if (ui.b.step === 0 && +d.v > 0 && !aboutYouOk()) return; ui.b.step = +d.v; window.scrollTo(0, 0); render(); },
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
    if (d.k === 'liftDays') ui.b.draft.liftDayKeys = null;
    if (d.k === 'liftDays') ui.b.liftEdited = true; else ui.b.cardioEdited = true;
    render();
  },
  'b-suggested': () => { ui.b.liftEdited = false; ui.b.cardioEdited = false; ui.b.splitEdited = false; render(); },
  'b-keep': (d, el) => { ui.b.draft.keepManual = el.checked; },
  'b-split': (d) => { ui.b.draft.split = d.v; ui.b.draft.dayOrder = null; ui.b.draft.mainLift = {}; ui.b.splitEdited = true; render(); },
  'b-order': (d) => {
    const p = ui.b.draft;
    const order = [...(p.dayOrder?.length ? p.dayOrder : splitTemplates(p.liftDays, p.split))];
    const i = +d.i; const j = i + +d.v;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    p.dayOrder = order;
    render();
  },
  'b-weekday': (d) => {
    const p = ui.b.draft;
    const set = new Set(liftDayKeys(p));
    if (set.has(d.v)) set.delete(d.v); else set.add(d.v);
    if (set.size < 2 || set.size > 6) return toast('Pick 2 to 6 lifting days.');
    p.liftDayKeys = DAY_KEYS.filter((k) => set.has(k));
    p.liftDays = set.size;
    ui.b.liftEdited = true;
    render();
  },
  'b-focus': (d) => {
    const p = ui.b.draft;
    const f = [...builderFocus(p, ui.b.out)];
    const i = f.indexOf(d.id);
    if (i >= 0) f.splice(i, 1); else if (f.length < 4) f.push(d.id); else return toast('Pick up to 4 focus lifts.');
    p.focus = f;
    render();
  },
  'b-apply': () => applyBuilt(),
  'b-ref': (d) => {
    const det = $('details.refs');
    if (det) det.open = true;
    $(`#ref-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  'undo-plan': async () => {
    const prev = db.previousPlan;
    if (!prev || !(await ask('Switch back to your previous plan? (You can switch again afterwards.)', 'Switch back'))) return;
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
    const hr = Math.round(num('c-hr') || 0);
    if (hr >= 60 && hr <= 220) entry.hr = hr;
    if (sheetState.rpe != null) entry.rpe = sheetState.rpe;
    const note = $('#c-note').value.trim();
    if (note) entry.note = note;
    db.cardio.push(entry);
    persist(); closeSheet(); render(); haptic();
    toast(`Logged ${CARDIO[d.id].name}, ${minutes} min · ~${Math.round(cardioBurn(db, entry, CARDIO[d.id]).active)} kcal.`);
  },
  'cardio-del': async (d) => {
    if (!(await ask('Delete this cardio entry?', 'Delete', true))) return;
    db.cardio = db.cardio.filter((c) => c.id !== d.id);
    persist(); render();
  },
  summary: (d) => { ui.summaryId = d.id; ui.summaryFresh = false; ui.tab = 'summary'; window.scrollTo(0, 0); render(); },
  'history-ex': (d) => { ui.historyEx = d.id; window.scrollTo(0, 0); render(); },
  'history-back': () => {
    ui.historyEx = null;
    const from = ui.infoFrom; ui.infoFrom = null;
    if (from) { ui.tab = from.tab; ui.exUid = from.exUid; render(); window.scrollTo(0, from.y || 0); return; }
    render();
  },
  'bw-save': () => {
    const w = fromDisp(num('bw-input'));
    if (!w || w < 50 || w > 700) return toast(`Enter your weight in ${wUnit()}.`);
    const date = todayStr();
    db.bodyweight = db.bodyweight.filter((b) => b.date !== date);
    db.bodyweight.push({ date, weight: Math.round(w * 10) / 10 });
    persist(); render(); toast('Saved.');
  },
  'bw-del': (d) => { db.bodyweight = db.bodyweight.filter((b) => b.date !== d.date); persist(); render(); },
  'plan-day': (d) => { ui.planDay = d.day; render(); },
  'plan-up': (d) => {
    if (!$('#sheet').hidden) closeSheet();
    const it = db.plan[ui.planDay].items; const i = +d.i;
    [it[i - 1], it[i]] = [it[i], it[i - 1]]; persist(); render();
  },
  'plan-down': (d) => {
    if (!$('#sheet').hidden) closeSheet();
    const it = db.plan[ui.planDay].items; const i = +d.i;
    [it[i + 1], it[i]] = [it[i], it[i + 1]]; persist(); render();
  },
  'plan-del': async (d) => {
    if (!$('#sheet').hidden) closeSheet();
    const it = db.plan[ui.planDay].items;
    const ex = db.exercises[it[+d.i].exerciseId];
    if (!(await ask(`Remove ${ex?.name} from ${DAY_NAMES[ui.planDay]}? Its history is kept.`, 'Remove', true))) return;
    it.splice(+d.i, 1); persist(); render();
  },
  'plan-edit': (d) => openPlanEdit(+d.i),
  'plan-link-next': (d) => {
    const items = db.plan[ui.planDay].items; const i = +d.i;
    const nextG = groupNum(items[i + 1].group);
    const uids = [items[i].uid, ...items.filter((x, k) => k > i && groupNum(x.group) === nextG).map((x) => x.uid)];
    closeSheet(); linkUids(uids, planDayList()); persist(); render(); toast('Linked.');
  },
  'plan-unlink': (d) => { closeSheet(); unlinkUids([db.plan[ui.planDay].items[+d.i].uid], planDayList()); persist(); render(); toast('Unlinked.'); },
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
  // New exercise from the picker: after saving, it's picked as if chosen from the list.
  'pk-custom': (d) => exEditor.open({ name: d.name || picker.q.trim(), then: (id) => { renderPickerList(); actions.pick({ id }); } }),
  'ex-edit': (d) => exEditor.open({ id: d.id }),
  'ex-new': () => exEditor.open({}),
  'pk-hidden': () => { picker.showHidden = !picker.showHidden; renderPickerList(); },
  pick: async (d) => {
    const ex = db.exercises[d.id];
    if (picker.mode === 'es-add') {
      const sx = db.sessions.find((x) => x.id === ui.editId);
      const st = getState(db, d.id);
      const w = st.last?.weight ?? st.targetWeight ?? 0;
      sx.entries.push({ uid: `${sx.id}-${Date.now().toString(36)}`, exerciseId: d.id, name: ex.name, group: String(sx.entries.length + 1), repMin: 8, repMax: 12, sets: [1, 2, 3].map(() => ({ weight: w, reps: st.last?.reps?.[0] || 10 })) });
      closeSheet(); render(); toast(`Added ${ex.name}. Adjust the sets below.`);
      return;
    }
    if (picker.mode === 'browse') { closeSheet(); ui.tab = 'history'; ui.historyEx = d.id; window.scrollTo(0, 0); render(); return; }
    if (picker.mode === 'add') { closeSheet(); setTimeout(() => addPlanItem(d.id), 200); return; }
    if (picker.mode === 'session-add' || (picker.mode === 'today-add' && sessionFor(ui.day))) { addToSession(d.id); closeSheet(); render(); toast(`Added ${ex.name}.`); return; }
    if (picker.mode === 'today-add') { addToPlanDay(ui.day, d.id); closeSheet(); render(); toast(`Added ${ex.name} to ${FULL_DAY[ui.day]}s.`); return; }
    if (picker.mode === 'plan-swap') {
      swapInPlan(ui.planDay, picker.uid, d.id);
      closeSheet(); render(); toast(`${DAY_NAMES[ui.planDay]} plan now uses ${ex.name}.`);
      return;
    }
    // From today's workout
    const entry = sessionFor(ui.day)?.entries[picker.uid];
    if (entry && !entry.pain && entry.sets.some((x) => x.done)
      && !(await ask(`Keep your logged ${db.exercises[entry.exerciseId].name} sets and add ${ex.name} after them?`, 'Keep and add'))) return;
    if (picker.scope === 'plan') swapInPlan(ui.day, picker.uid, d.id);
    if (picker.scope === 'today' || sessionFor(ui.day)) swapInSession(picker.uid, d.id);
    closeSheet(); render();
    toast(picker.scope === 'plan' ? `Swapped to ${ex.name} (plan updated).` : `Swapped to ${ex.name} for today.`);
  },

  'pe-save': (d) => savePlanEdit(+d.i),
  'pe-rot': (d, el) => el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)),
  'pe-var': (d, el) => { el.classList.toggle('on'); el.setAttribute('aria-pressed', el.classList.contains('on')); },
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
  'apply-inc': async () => {
    if (!(await ask('Set every exercise\'s increment to the default for its type?', 'Apply to all'))) return;
    for (const ex of Object.values(db.exercises)) ex.increment = db.settings.defaultIncrements[ex.type] || ex.increment;
    persist(); toast('Increments updated.');
  },
  'reset-plan': async () => {
    if (!(await ask('Replace your plan with the sample plan (5 days: upper, lower, push, pull, legs)? History and targets are kept.', 'Load sample plan'))) return;
    safetySnapshot(db, 'Before loading the sample plan');
    db.settings.planSince = todayStr();
    db.plan = defaultPlan(); db.settings.dayModes = { mon: 'lift', tue: 'lift', wed: 'lift', thu: 'lift', fri: 'lift', sat: 'rest', sun: 'rest' }; persist(); render(); toast('Sample plan loaded.');
  },
};

Object.assign(actions, food.actions, year.actions, extras.actions, cloud.actions, acctUi.actions, people.actions, pain.actions, train.actions, focusUi.actions, exEditor.actions, planTools.actions, health.actions);

onReorder('session', (uid, to, opt = {}) => {
  const shown = todayItems(ui.day);
  const moving = shown.find((x) => x.uid === uid);
  if (!moving) return;
  pushUndo();
  const phaseOf = (x) => x.phase || 'main';
  const list = shown.filter((x) => x !== moving);
  let at = Math.max(0, Math.min(list.length, to));
  const target = opt.join ? list.find((x) => x.uid === opt.join && phaseOf(x) === phaseOf(moving)) : null;
  if (target) at = list.indexOf(target) + (opt.before ? 0 : 1); // right before or after the exercise it was dropped on
  // Warm-up, workout and cool-down stay in their own sections.
  const same = list.map((x, i) => (phaseOf(x) === phaseOf(moving) ? i : -1)).filter((i) => i >= 0);
  if (same.length) at = Math.max(same[0], Math.min(same[same.length - 1] + 1, at));
  list.splice(at, 0, moving);
  // Dropped onto an exercise, or between two exercises of one group: it joins that group.
  // Anywhere else it stands alone. Other groups keep their links.
  const prev = list[at - 1]; const after = list[at + 1];
  const inside = prev && after && groupNum(prev.group) === groupNum(after.group) && phaseOf(prev) === phaseOf(after);
  // Moved within its own superset/circuit (e.g. to the first spot): it stays in it.
  const own = groupNum(moving.group);
  const ownSize = shown.filter((x) => groupNum(x.group) === own).length;
  const besideOwn = ownSize > 1 && [prev, after].some((x) => x && groupNum(x.group) === own);
  const joinKey = target ? groupNum(target.group) : inside ? groupNum(prev.group) : besideOwn ? own : null;
  const keyOf = (x) => (x.uid === uid ? (joinKey != null ? `g${joinKey}` : `solo:${uid}`) : `g${groupNum(x.group)}`);
  const keys = new Map(list.map((x) => [x.uid, keyOf(x)]));
  const session = sessionFor(ui.day);
  if (session) {
    session.order = list.map((x) => x.uid);
    relabel(session.order.map((u) => session.entries[u]), (e) => keys.get(e.uid));
  } else {
    const ref = weekOverride(db, ui.day)?.items?.length ? weekOverride(db, ui.day) : db.plan[ui.day];
    const stored = new Map(ref.items.map((x) => [x.uid, x]));
    const main = list.filter((x) => stored.has(x.uid)).map((x) => stored.get(x.uid));
    const missing = ref.items.filter((x) => !main.includes(x));
    relabel(main, (x) => keys.get(x.uid) || `g${groupNum(x.group)}`);
    ref.items = [...main, ...missing];
    const ex = (db.plan[ui.day].extraOrder ||= {});
    for (const k of ['warmup', 'cooldown']) { const u = list.filter((x) => x.phase === k).map((x) => x.uid); if (u.length) ex[k] = u; }
  }
  persist(); render();
  if (!ui.selecting) toast(target ? `Linked with ${target.ex.name}.` : 'Moved.', { label: 'Undo', a: 'list-undo' });
});
onReorder('plan', (uid, to) => {
  const items = db.plan[ui.planDay].items;
  const it = items.find((x) => x.uid === uid);
  const rest = items.filter((x) => x !== it);
  rest.splice(to, 0, it);
  db.plan[ui.planDay].items = rest;
  persist(); render();
});
setAnnouncer((msg) => { const el = $('#sr-live'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = msg; }); } });

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = actions[el.dataset.a];
  if (!fn) return;
  e.preventDefault();
  try {
    const r = fn(el.dataset, el);
    if (r?.catch) r.catch((err) => { console.error(err); toast('That didn\'t work. Please try again.'); });
  } catch (err) {
    console.error(err);
    toast('That didn\'t work. Please try again.');
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const a = el.dataset?.a;
  if (el.id === 'import-file' || el.id === 'photo-file' || el.id === 'check-file') { extras.onChange(e); return; }
  if (food.onChange(e) || year.onChange(e) || train.onChange(e)) return;
  if (el.dataset?.warm) {
    const [uid, i, k] = el.dataset.warm.split(':');
    const w = warmFor(uid);
    const v = k === 'reps' ? parseInt(el.value, 10) : k === 'weight' ? fromDisp(parseFloat(el.value)) : parseFloat(el.value);
    if (w?.[+i] && Number.isFinite(v)) { w[+i][k] = v; persist(); }
    return;
  }
  if (el.dataset?.set) {
    const [uid, i, k] = el.dataset.set.split(':');
    const sx = ensureSession(ui.day);
    if (!sx) return;
    const entry = sx.entries[uid];
    const v = k === 'reps' ? parseInt(el.value, 10) : k === 'weight' ? fromDisp(parseFloat(el.value)) : parseFloat(el.value);
    if (!entry || !Number.isFinite(v)) return;
    entry.sets[+i][k] = v;
    if (k === 'weight' && !entry.fixedLadder && entry.scheme !== 'wave') {
      for (let j = +i + 1; j < entry.sets.length; j++) {
        if (entry.sets[j].done || entry.sets[j].type === 'd') continue;
        entry.sets[j].weight = entry.dropSet ? Math.max(0, v - 10 * (j - +i)) : followWeight(entry, db.exercises[entry.exerciseId], v, +i, j);
        const cell = document.querySelector(`[data-set="${uid}:${j}:weight"]`);
        if (cell) cell.value = toDisp(entry.sets[j].weight);
      }
    }
    persist();
    return;
  }
  if (el.id === 'session-note') { const sx = db.sessions.find((x) => x.id === el.dataset.sid); if (sx) { sx.note = el.value.trim(); persist(); } return; }
  if (el.dataset?.bgoal && ui.b) { render(); return; }
  if (a === 'set-exprog') { actions[a](el.dataset, el); return; }
  if (a === 'week-start') { db.settings.weekStart = el.value; setWeekStart(el.value); persist(); render(); toast(`Weeks now start on ${FULL_DAY[el.value]}.`); return; }
  if (a === 'pk-muscle') { picker.muscle = el.value; renderPickerList(); return; }
  if (a === 'b-mgoal') { const mg = (ui.b.draft.muscleGoals ||= {}); if (el.value) mg[el.dataset.g] = el.value; else delete mg[el.dataset.g]; return; }
  if (a === 'b-main') { (ui.b.draft.mainLift ||= {})[el.dataset.k] = el.value; render(); return; }
  if (a === 'pe-ex') { $('#pe-new').hidden = el.value !== '__new'; fillMeta(el.value); return; }
  if (a === 'plan-name') { db.plan[ui.planDay].name = el.value.trim() || db.plan[ui.planDay].name; persist(); return; }
  if (a === 'def-inc') { const v = fromDisp(parseFloat(el.value)); if (v > 0) { db.settings.defaultIncrements[el.dataset.k] = v; persist(); } return; }
  if (el.type === 'checkbox' && actions[a]) actions[a](el.dataset, el);
});

document.addEventListener('input', (e) => {
  if (people.onInput(e)) return;
  // Search boxes on lists: hide rows that don't match, and headings left with nothing under them.
  if (e.target.matches?.('.list-filter')) {
    const q = e.target.value.trim().toLowerCase();
    const box = document.querySelector(e.target.dataset.filter);
    if (box) {
      const kids = [...box.querySelectorAll(':scope > *')];
      for (const k of kids) if (!/^H\d$/.test(k.tagName)) k.hidden = !!q && !k.textContent.toLowerCase().includes(q);
      kids.forEach((k, i) => { if (/^H\d$/.test(k.tagName)) { let j = i + 1; let any = false; while (j < kids.length && !/^H\d$/.test(kids[j].tagName)) { if (!kids[j].hidden) any = true; j++; } k.hidden = !!q && !any; } });
    }
    return;
  }
  // Numbers typed into a set are saved as you type, so nothing is lost if the app closes.
  const ds = e.target.dataset?.set;
  if (ds && db.activeSession) {
    const [uid, i, k] = ds.split(':');
    const v = k === 'reps' ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
    const set = sessionFor(ui.day)?.entries[uid]?.sets[+i];
    if (set && Number.isFinite(v)) { set[k] = v; clearTimeout(typingSave); typingSave = setTimeout(persist, 400); }
  }
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
// Exercise photos that fail to load (offline, first time) fall back to a muscle icon.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img?.tagName === 'IMG' && img.dataset.fb) img.replaceWith(document.createRange().createContextualFragment(img.dataset.fb));
}, true);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderRest(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
// Typing on a phone: the keyboard would lift the pinned rest timer over the fields, so it steps aside.
document.addEventListener('focusin', (e) => { if (e.target.matches?.('input, textarea')) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement?.matches?.('input, textarea')) document.body.classList.remove('typing'); }, 50));

// Ask iOS to keep our storage (helps avoid eviction where supported).
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
}

onSaveError((e) => {
  if (e?.blocked) { ui.saveBlocked = e.message; render(); return; }
  toast('Could not save — storage may be full. Export a backup.');
});

// Shown when a save was refused because it would have erased most of the history.
function saveBlockedBanner() {
  return `<div class="banner bad" role="alert"><p><b>Changes aren't being saved.</b> Something went wrong, and saving would have erased part of your history, so it was stopped. Your saved data is intact. Reopen the app to continue.</p>
    <p class="muted small">${esc(ui.saveBlocked)}</p>
    <div class="row"><button class="btn primary" data-a="reload">Reopen app</button></div></div>`;
}

// Stored data that can't be opened: show this instead of starting fresh, so nothing gets overwritten.
function recoveryScreen(err) {
  recoveryRaw = err.raw || null;
  $('#main').innerHTML = `<header class="top"><div><h1>Your data is safe</h1></div></header>
    <div class="card"><p>${esc(err.message)}</p>
      <p class="muted small">The app hasn't saved anything, so your data is exactly as it was. Download a copy, then try reopening. If that doesn't help, send the file to whoever runs the beta, or restore an earlier snapshot.</p></div>
    <button class="btn primary block" data-a="recovery-download">Download my data</button>
    <button class="btn block" data-a="snapshots">Restore snapshot</button>
    <button class="btn block" data-a="reload">Reopen app</button>`;
}
let recoveryRaw = null;
actions.reload = () => location.reload();
actions['recovery-download'] = () => recoveryRaw && download(`lift-recovery-${todayStr()}.json`, recoveryRaw, 'application/json');

(async () => {
  try { db = await loadDb(); setWeekStart(db.settings.weekStart || 'mon'); setUnit(db.settings.units); setTimeout(prefetchImages, 0); } catch (e) {
    if (!(e instanceof LoadError)) throw e;
    recoveryScreen(e);
    return;
  }
  applyTheme();
  render();
  if (rest) runRest();
  if (db.activeSession) keepAwake();
  dailySnapshot(db);
  cloud.onBoot();
  acctUi.start();
  people.start();
  // Leaving the app during a rest: the server sends "Rest is over" on time; coming back cancels it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (rest && !rest.work && rest.endAt > Date.now()) scheduleRest(rest.endAt, rest.label ? `Next: ${rest.label}` : 'Time for the next set.');
    } else cancelRest();
  });
  // Opened from a notification: go where it points.
  const openTarget = (url) => { if (/[?&]open=people/.test(url) && peopleOn()) { if (!$('#sheet').hidden) closeSheet(); ui.tab = 'people'; if (ui.people) { ui.people.client = null; ui.people.edit = null; } people.refresh(); window.scrollTo(0, 0); render(); } };
  openTarget(location.search);
  if (/[?&]open=/.test(location.search)) history.replaceState(null, '', location.pathname + location.search.replace(/[?&]open=[a-z]+/, '').replace(/^&/, '?'));
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'open') openTarget(e.data.url || ''); });
  // Reopened mid-workout (even after the app was fully closed): go straight back to it.
  if (db.activeSession) { ui.day = db.activeSession.day; ui.tab = 'today'; render(); setTimeout(() => toast('Workout resumed where you left off.'), 400); }
  // Existing plans: core placement starts at the default once.
  if (db.settings.welcomed && !db.settings.corePlacement) { applyCore(db, 'end'); persist(); render(); }
  initSwipe();
  initGestures();
  // Pull the sheet down to close it; pull the rest timer down to skip the rest.
  // Only the top strip of a sheet (the handle and title) pulls it down; the rest scrolls normally.
  initPullDown($('#sheet-body'), closeSheet, { canStart: (e) => e.touches[0].clientY - $('#sheet-body').getBoundingClientRect().top < 64 });
  initPullDown($('#rest'), stopRest);
  // Swipe across the exercise photo to go to the next or previous exercise.
  initSideSwipe('.ex-hero', (dir) => {
    const items = todayItems(ui.day);
    const i = items.findIndex((x) => x.uid === ui.exUid);
    const next = items[i + dir];
    if (ui.tab !== 'exercise' || !next) return;
    ui.backUid = null; ui.exUid = next.uid; window.scrollTo(0, 0); haptic(); render();
  });
  // Ask once to keep data permanently (granted more readily for Home Screen apps).
  if (!db.settings.persistAsked) { db.settings.persistAsked = true; persist(); requestPersistence(); }
})();
