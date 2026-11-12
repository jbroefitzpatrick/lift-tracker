import { loadDb, LoadError, allowReplace, download, save, onSaveError, dailySnapshot, safetySnapshot, requestPersistence, todayStr, mondayOf, parseDate, daysBetween, addDays } from './store.js';
import { onReorder, setAnnouncer } from './drag.js';
import { icon } from './icons.js';
import { EX_INFO } from './exercise-info.js';
import { blockInfo, focusFor, liftProgress, checkinDue, planCompounds, adherence } from './blocks.js';
import { TEMPLATES, TEMPLATE_KINDS, templateItems, fmtTarget, METRIC_FIELDS } from './conditioning.js';
import { METRICS } from './bank.js';
import { TYPES, ROW_ROTATION, defaultPlan } from './plan.js';
import {
  DAY_KEYS, DAY_NAMES, dayKeyOf, weekInfo, needsRotationPrompt, nextRowCompound, resolveDay,
  targetsFor, getState, painWarning, evaluate, groupNum, e1rm, roundTo, dayPlan, weekOverride,
} from './engine.js';
import { lineChart } from './chart.js';
import { MUSCLES, CATEGORIES, PATTERNS, similarExercises } from './bank.js';
import { CARDIO, INTENSITY, MODALITIES } from './cardio-bank.js';
import { suggestCardio } from './cardio.js';
import { currentFatigue, freshness, dayMode, MUSCLE_GROUPS, liftLoads } from './fatigue.js';
import { bodyPair, bodySvg, muscleIcon } from './body.js';
import {
  GOALS, EXPERIENCE, EQUIPMENT, LIMITS, WEIGHT_GOALS, WEEK_LAYOUT, VOLUME_MUSCLES, defaultProfile, prescription, suggestDays,
  splitOptions, generatePlan, goalWeights, suggestedWeightGoal, volumeTarget, fmtSec,
} from './builder.js';
import { REFS } from './science.js';
import { activeGym, roundToGym, plateText, warmupSets, isAvailable } from './gym.js';
import { detectPRs, applyCheckins } from './records.js';
import { activePhase, PHASE_TYPES, cardioTargetFor, suggestYear } from './year.js';
import { goalFor } from './nutrition.js';
import { weeklySets, estimateMinutes } from './builder.js';
import { createFood } from './ui-food.js';
import { createYear } from './ui-year.js';
import { createExtras } from './ui-extra.js';
import { createCloud } from './ui-cloud.js';
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
import { PROGRESSIONS } from './engine.js';
import { dayExtras, setDayExtra, warmupItems, cooldownItems } from './warmcool.js';
import { adjustDay } from './week.js';
import { splitTemplates, mainLiftOptions } from './builder.js';
import { createPlanTools, keepManual, countManual } from './ui-plantools.js';
import { GOALS as MGOALS, applyGoals } from './goals.js';
import { warmupMinutes } from './warmcool.js';
import { createHealth } from './health.js';

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
  if (sec < 120) return `${sec} sec`;
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
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#0c0e12' : '#f5f6f8');
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

function metricOf(item) {
  return item.metric || db.exercises[item.exerciseId]?.metric || 'reps';
}

function makeEntry(item, isDeload) {
  const metric = metricOf(item);
  if (metric !== 'reps' || db.exercises[item.exerciseId]?.category === 'conditioning') {
    // Conditioning: sets are rounds measured in time, distance, calories or reps.
    const n = isDeload ? Math.ceil(item.sets / 2) : item.sets;
    const key = METRIC_FIELDS[metric][0][0];
    return {
      uid: item.uid, exerciseId: item.exerciseId, group: item.group, repMin: item.repMin, repMax: item.repMax,
      restSec: item.restSec, metric, target: item.target, phase: item.phase, dropSet: false, pain: false, painFree: false,
      sets: Array.from({ length: n }, () => ({ [key]: item.target ?? null, rir: null, done: false, pain: false })),
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
    dropSet: false,
    pain: false,
    painFree: false,
    // Strength waves ladder up to a top set; the other schemes repeat one weight.
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
    session.order.push(item.uid);
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
  const nx = members.length > 1 ? nextInCircuit(session, uid, setIndex) : null;
  const nextEx = nx?.uid ? db.exercises[session.entries[nx.uid].exerciseId] : null;
  const label = nextEx ? `Rest · next: ${nextEx.name}, set ${nx.round + 1}` : members.length > 1 ? `Rest · round ${setIndex + 1} done` : 'Rest';
  startRest(sec, label);
}

function prefillFollowing(entry, fromIdx) {
  if (entry.scheme === 'wave') return; // each set has its own planned weight
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
  // On the exercise screen, move through the superset/circuit automatically.
  if (ui.tab === 'exercise' && ui.exUid === uid && db.settings.autoAdvance !== false) {
    const nx = nextInCircuit(session, uid, idx);
    if (nx?.uid) {
      ui.backUid = uid;
      ui.exUid = nx.uid;
      window.scrollTo(0, 0);
      const name = db.exercises[session.entries[nx.uid].exerciseId]?.name || 'next exercise';
      toast(nx.groupDone ? `${linkLabel(nextGroupSize(session, uid))} done. Next: ${name}` : `${nx.sameRound ? 'Next' : 'After the rest'}: ${name}, set ${nx.round + 1}`);
    }
  }
  render();
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

function finishWorkout() {
  const s = db.activeSession;
  if (!s) return;
  resumeSession(s);
  const finishedAt = Date.now();
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

// ---------- Screens: Today ----------

function dayTabs(current, action, days = DAY_KEYS) {
  const today = defaultDay();
  const mon = mondayOf(todayStr());
  return `<div class="day-strip" role="tablist" aria-label="Day of the week">${days.map((d) => {
    const date = parseDate(addDays(mon, DAY_KEYS.indexOf(d))).getDate();
    const mode = dayMode(db, d);
    return `<button class="day ${d === current ? 'on' : ''} ${d === today ? 'is-today' : ''}" data-a="${action}" data-day="${d}" role="tab" aria-selected="${d === current}"
      aria-label="${FULL_DAY[d]} ${date}, ${MODE_LABELS[mode]} day${d === today ? ', today' : ''}">
      <span class="d-name">${DAY_NAMES[d]}</span><span class="d-num">${date}</span><span class="d-dot m-${mode}" aria-hidden="true"></span></button>`;
  }).join('')}</div>`;
}

// Reps-in-reserve target for this week of the block: starts around 3 and tightens toward the
// lifter's usual effort just before the deload (block-periodized effort).
function rirTarget(wi) {
  if (!db.settings.rampEffort) return null;
  if (wi.isDeload) return null;
  const end = Math.max(0, db.settings.rampEnd ?? db.profile?.rx?.rirLo ?? 1);
  const start = Math.max(end + 1, db.settings.rampStart ?? 3);
  const work = Math.max(2, wi.cycleLen - 1);
  const v = Math.round(start - ((start - end) * (wi.cyclePos - 1)) / (work - 1));
  return String(Math.max(end, Math.min(start, v)));
}

// On cardio days only the plan's conditioning work is on; lifting stays parked for when the day switches back.
function plannedFor(day) {
  const items = resolveDay(db, day);
  const lifts = items.filter((i) => i.ex.category !== 'conditioning');
  if (lifts.length && dayMode(db, day) !== 'cardio') {
    const x = dayExtras(db, day);
    return [...(x.warm ? warmupItems(db, day, lifts) : []), ...items, ...(x.cool ? cooldownItems(db, day, lifts) : [])];
  }
  if (dayMode(db, day) !== 'cardio') return items;
  return items.filter((i) => db.exercises[i.exerciseId]?.category === 'conditioning');
}

// The day's exercises in display order: the session once started, otherwise the plan.
function todayItems(day = ui.day) {
  const session = sessionFor(day);
  const planned = plannedFor(day);
  if (!session) return planned;
  const items = session.freestyle ? [] : planned;
  syncSession(session, items);
  return sessionItems(session, items);
}

// Consecutive items sharing a slot number form a superset (2) or circuit (3+).
function groupsOf(items) {
  const groups = [];
  for (const item of items) {
    const g = groupNum(item.group);
    const last = groups[groups.length - 1];
    if (last && last.g === g) last.items.push(item);
    else groups.push({ g, items: [item] });
  }
  // Exercises added during a workout can be linked too; a swap's replacement row can't.
  return groups.map((grp) => ({ ...grp, linked: grp.items.filter((i) => !i.swapChild).length > 1 }));
}

const linkLabel = (n) => (n > 2 ? 'Circuit' : 'Superset');

function thumb(ex) {
  const img = EX_INFO[ex.id]?.images?.[0];
  return img
    ? `<img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fb='${muscleIcon(ex.primary[0] || 'chest').replace(/'/g, '&#39;')}'>`
    : muscleIcon(ex.primary[0] || 'chest');
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
  const title = session?.freestyle ? 'Workout'
    : dayPlan(db, day) && (mode === 'lift' || mode === 'both' || session) ? esc(dayPlan(db, day).name) : `${MODE_LABELS[mode]} day`;
  const dateLabel = parseDate(addDays(mondayOf(todayStr()), DAY_KEYS.indexOf(day))).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const subtitle = [
    dateLabel,
    db.settings.deloadOff ? `Week ${wi.week}` : `Week ${wi.cyclePos} of ${wi.cycleLen}${wi.isDeload ? ' (deload)' : ''}`,
    ph ? `${PHASE_TYPES[ph.phase.type].label}, week ${ph.weekInPhase}` : '',
  ].filter(Boolean).join(' · ');
  let html = `
    <header class="top">
      <div class="grow"><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>
      <button class="icon-btn" data-a="open-recovery" aria-label="Muscle recovery">${icon('body')}</button>
      <button class="icon-btn" data-a="day-options" aria-label="Day options">${icon('more')}</button>
    </header>
    ${session ? '' : dayTabs(day, 'day')}
    ${!session && day === dayKeyOf(todayStr()) && db.settings.welcomed ? weekStrip() : ''}`;
  if (session) html = workoutBar(session) + html;

  if (!db.settings.welcomed) {
    html += `<div class="notice-card">
      <p><b>Welcome.</b> Build a plan around your goals, experience and schedule, or start with the sample plan.</p>
      <div class="row"><button class="btn primary" data-a="open-builder">Build my plan</button><button class="btn" data-a="welcome-sample">Use sample plan</button></div>
    </div>`;
  }
  if (ui.saveBlocked) html += saveBlockedBanner();
  // Pain always shows; of the other prompts, only one at a time (the rest wait their turn).
  if (!session) html += pain.todayCard(); // during a workout, pain shows on the exercises it affects
  // None while a workout is open: that screen is for logging.
  if (!session) html += [train.recoveryCheck(), train.weekPrompt(), extras.backupBanner(), db.settings.welcomed ? train.installHint() : ''].filter(Boolean).slice(0, 1).join('');
  html += blockCheckinBanner();
  if (needsRotationPrompt(db)) {
    const nextId = nextRowCompound(db);
    html += `<div class="notice-card">
      <p><b>Deload complete.</b> Rotate Thursday's row to ${esc(db.exercises[nextId].name)}?</p>
      <div class="row"><button class="btn primary" data-a="rotate-yes">Rotate</button><button class="btn" data-a="rotate-no">Keep current</button></div>
    </div>`;
  }
  if (other) {
    html += `<div class="notice-card">
      <p>Your ${FULL_DAY[other.day]} workout is still open.</p>
      <div class="row"><button class="btn primary" data-a="day" data-day="${other.day}">Resume</button><button class="btn" data-a="discard">Discard</button></div>
    </div>`;
  }

  // Cardio-only and rest days (an unfinished workout still shows so it can be finished).
  const condOnly = !session && mode !== 'rest' && resolveDay(db, day).some((i) => i.ex.category === 'conditioning');
  if (!session && !condOnly && (!dayPlan(db, day) || mode === 'cardio' || mode === 'rest')) {
    html += train.recoveryCards(day, []);
    html += train.recoveryReminder(day, mode);
    html += `<p class="muted small pad">${mode === 'rest' ? 'Rest day. Light recovery work is optional.' : 'Cardio day.'}</p>`;
    html += cardioSection(day, mode === 'rest' ? 'Recovery' : 'Cardio', true);
    return html;
  }

  const items = todayItems(day);
  if (session && session.date !== todayStr()) html += `<div class="notice-card"><p>This workout was started on ${fmtDate(session.date)}. Finish or discard it to start a new one.</p></div>`;

  html += train.recoveryCards(day, items);
  html += train.recoveryReminder(day, mode);

  // Overview: what's ahead, or progress once started.
  const counts = items.map((i) => {
    const e = session?.entries[i.uid];
    if (e) return { total: e.pain ? e.sets.filter((s) => s.done).length : e.sets.length, done: e.sets.filter((s) => s.done).length };
    return { total: targetsFor(db, i, isDeload).sets, done: 0 };
  });
  const allCond = items.length > 0 && items.every((i) => db.exercises[i.exerciseId]?.category === 'conditioning');
  const total = counts.reduce((a, c) => a + c.total, 0);
  const done = counts.reduce((a, c) => a + c.done, 0);
  const est = estimateMinutes(items.map((i, k) => ({ group: i.group, sets: counts[k].total || i.sets, restSec: i.restSec, metric: i.metric, target: i.target, paceSec: i.paceSec })));
  const left = Math.max(0, Math.round(est * (1 - (total ? done / total : 0))));
  if (items.length) {
    html += session
      ? (db.settings.tips?.log ? '' : `<div class="tip" role="note"><p><b>Logging.</b> Tap the check when a set is done; the rest timer starts by itself. Tap <b>Previous</b> to reuse last time's numbers, the set number for warm-up or drop sets, and swipe a set left to delete it.</p><button class="link-btn" data-a="tip-ok" data-k="log">Got it</button></div>`)
      : `<div class="day-pills">
          <button class="pill" data-a="adj-open" data-day="${day}" aria-label="About ${est} minutes. Change time">${est} min ${icon('down')}</button>
          <button class="pill" data-a="adj-open" data-day="${day}" aria-label="Gym: ${esc(activeGym(db).name)}. Change">${esc(db.gyms.find((g) => g.id === weekOverride(db, day)?.gymId)?.name || activeGym(db).name)} ${icon('down')}</button>
          <button class="pill toggle-pill ${dayExtras(db, day).warm ? 'on' : ''}" data-a="extra-toggle" data-k="warm" data-day="${day}" aria-pressed="${dayExtras(db, day).warm}">Warm-up</button>
          <button class="pill toggle-pill ${dayExtras(db, day).cool ? 'on' : ''}" data-a="extra-toggle" data-k="cool" data-day="${day}" aria-pressed="${dayExtras(db, day).cool}">Cool-down</button>
          <span class="pill-note">${allCond ? `${total} rounds` : `${total} sets`}${isDeload ? ' · deload' : ''}</span>
          <button class="help-btn" data-a="why-workout" aria-label="Why this workout is built this way">?</button>
        </div>
        <button class="cta" data-a="start-workout">Start workout</button>`;
    if (!session) html += targetMuscles(items);
  }

  // Exercise list
  const selecting = !!ui.selecting;
  const sel = ui.selected || new Set();
  html += `<div class="list-head">
    <h2>${items.length} exercise${items.length === 1 ? '' : 's'}</h2>
    <div class="row">
      ${!selecting && items.length ? `<button class="link-btn" data-a="list-view">${db.settings.listView === 'full' ? 'Hide sets' : 'Show sets'}</button>` : ''}
      ${items.length > 1 ? `<button class="link-btn" data-a="select-mode">${selecting ? 'Done' : 'Edit'}</button>` : ''}
      <button class="icon-btn accent" data-a="today-add" aria-label="Add exercise">${icon('plus')}</button>
    </div>
  </div>`;
  if (selecting) html += `<p class="muted small">Select exercises to link into a superset or circuit, or drag to reorder. ${session ? 'Changes apply to today\'s workout.' : `Changes apply to every ${FULL_DAY[day]}.`}</p>`;
  // The exercise you're on: the last one opened if it has sets left, else the first with sets left.
  ui.nextUid = session ? ((ui.exUid && items.find((i) => i.uid === ui.exUid && setsLeft(session, i))) || items.find((i) => setsLeft(session, i)))?.uid : null;
  html += '<div class="ex-list">';
  let lastPhase = null;
  for (const grp of groupsOf(items)) {
    const full = db.settings.listView === 'full' && !selecting;
    const rows = grp.items.map((i) => (full ? exerciseFull(i, session, isDeload) : exerciseRow(i, session, isDeload, selecting, sel))).join('');
    const phase = grp.items[0].phase || 'main';
    if (phase !== lastPhase && (phase !== 'main' || lastPhase)) html += `<h3 class="phase-h">${phase === 'warmup' ? `Warm-up · about ${warmupMinutes(items.filter((x) => x.phase === 'warmup'))} min` : phase === 'cooldown' ? 'Cool-down' : 'Workout'}</h3>`;
    lastPhase = phase;
    if (grp.linked) {
      const restSec = Math.max(...grp.items.map((i) => i.restSec || 0));
      html += `<section class="link-group" aria-label="${linkLabel(grp.items.length)}">
        <div class="link-label"><b>${linkLabel(grp.items.length)}</b> · rest ${fmtRest(restSec)} after each round</div>${rows}</section>`;
    } else html += rows;
  }
  html += '</div>';
  if (selecting) {
    html += `<div class="select-bar" role="toolbar" aria-label="Selection actions">
      <span class="muted small">${sel.size} selected</span>
      <button class="btn sm" data-a="unlink-selected" ${sel.size ? '' : 'disabled'}>Unlink</button>
      <button class="btn sm primary" data-a="link-selected" ${sel.size < 2 ? 'disabled' : ''}>Link ${sel.size > 2 ? 'as circuit' : 'as superset'}</button>
    </div>`;
  }
  if (session?.freestyle && !items.length) html += '<p class="muted small center pad">Add exercises from the library to build this workout.</p>';

  if (session && mode !== 'both') { /* cardio stays out of the way during a workout */ } else if (mode === 'both') html += cardioSection(day, 'Cardio after lifting', true);
  else html += cardioSection(day, 'Cardio', !!ui.showCardio);

  if (session) {
    html += `<div class="finish-bar">
      <button class="btn block" data-a="fin-open">${icon('plus')} Add finisher</button>
      ${session.pausedAt ? '<button class="btn primary block big" data-a="resume">Resume workout</button>' : '<button class="btn primary block big" data-a="finish">Finish workout</button>'}
      <div class="row">${session.pausedAt ? '<button class="btn grow" data-a="finish">Finish</button>' : '<button class="btn grow" data-a="pause">Pause</button>'}<button class="btn plain grow" data-a="discard">Discard</button></div>
    </div>`;
  }
  return html;
}

// The muscles today's exercises train, with how recovered each one is.
function targetMuscles(items) {
  const loads = liftLoads(db, items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets || 3 })));
  const fresh = freshness(currentFatigue(db));
  // One tile per group, ordered by how much work it gets today.
  const tiles = GROUPS.map((g) => {
    const used = g.muscles.filter((m) => (loads[m] || 0) >= 2);
    if (!used.length) return null;
    const lead = used.sort((x, y) => (loads[y] || 0) - (loads[x] || 0))[0];
    return { g, lead, load: used.reduce((a, m) => a + loads[m], 0), pct: Math.round(Math.min(...used.map((m) => fresh[m] ?? 1)) * 100) };
  }).filter(Boolean).sort((x, y) => y.load - x.load).slice(0, 6);
  if (!tiles.length) return '';
  return `<section class="targets" aria-label="Target muscles">
    <h2>Target muscles</h2>
    <div class="target-strip">${tiles.map(({ g, lead, pct }) => `<button class="target-tile" data-a="open-recovery" data-g="${g.id}" aria-label="${g.name}, ${pct}% recovered"><span class="tile-art">${muscleIcon(lead)}<span class="pct-badge ${pct < 50 ? 'low' : pct < 80 ? 'mid' : ''}">${pct}%</span></span><span class="tile-name">${g.name}</span></button>`).join('')}</div>
  </section>`;
}

function exerciseRow(item, session, isDeload, selecting, sel) {
  const ex = item.ex;
  const { t, target, entry, sets, notices, conditioning, metric } = cardModel(item, session, isDeload);
  const doneN = sets.filter((s) => s.done).length;
  const allDone = entry && sets.length && doneN === sets.length;
  const reps = item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`;
  const weight = target != null ? ` · ${fmtW(target, ex)}` : '';
  const meta = conditioning
    ? `${entry && doneN ? `${doneN} of ${sets.length} rounds` : `${t.sets} ${t.sets === 1 ? 'round' : 'rounds'}`} · ${fmtTarget(metric, item.target)}${item.restSec ? ` · rest ${fmtRest(item.restSec)}` : ''}`
    : entry && doneN ? `${doneN} of ${sets.length} sets${weight}`
      : t.setReps ? `${t.setReps.join(' / ')}${t.wave?.amrap ? '+' : ''} reps · top set ${fmtW(target, ex)}`
        : t.scheme === 'linear' ? `${t.sets} × ${item.repMin}${weight}` : `${t.sets} sets · ${reps} reps${weight}`;
  const checked = sel.has(item.uid);
  const isNext = session && item.uid === ui.nextUid;
  return `<div class="ex-item ${allDone ? 'is-done' : ''} ${checked ? 'is-selected' : ''} ${isNext ? 'is-next' : ''}" data-drag-item data-drag-list="session" data-drag-id="${item.uid}" ${session && !selecting ? `data-swipe="ex-remove" data-swipe-label="Remove" data-uid="${item.uid}"` : ''}>
    ${selecting ? `<label class="sel"><input type="checkbox" data-a="sel-toggle" data-uid="${item.uid}" ${checked ? 'checked' : ''} aria-label="Select ${esc(ex.name)}"></label>` : ''}
    <button class="ex-item-main" data-a="ex-open" data-uid="${item.uid}" ${selecting ? 'tabindex="-1"' : ''}>
      <span class="thumb">${thumb(ex)}</span>
      <span class="grow">${isNext ? '<span class="eyebrow next">Up next</span>' : (focusFor(db, blockInfo(db).index) || []).includes(ex.id) ? '<span class="eyebrow">Focus lift</span>' : ''}<span class="ex-name2">${esc(ex.name)}</span><span class="ex-meta">${meta}</span>
        ${notices.length ? `<span class="row-notice ${notices[0][0]}">${esc(notices[0][1])}</span>` : ''}</span>
    </button>
    ${allDone ? `<span class="status-done" aria-label="Done">${icon('check')}</span>` : ''}
    ${selecting
      ? `<button class="drag-handle" data-drag-handle aria-label="Reorder ${esc(ex.name)} (arrow keys move it)">${GRIP}</button>`
      : `<button class="icon-btn plain" data-a="ex-sheet" data-uid="${item.uid}" aria-label="Options for ${esc(ex.name)}">${icon('more')}</button>`}
  </div>`;
}

// Expanded list (Strong/Hevy style): each exercise with its set table, logged without leaving the list.
function exerciseFull(item, session, isDeload) {
  const ex = item.ex;
  const { t, entry, sets, notices, conditioning, metric } = cardModel(item, session, isDeload);
  const ended = entry?.pain;
  const fields = conditioning ? METRIC_FIELDS[metric] : null;
  const doneN = sets.filter((s) => s.done).length;
  return `<section class="ex-full ${doneN === sets.length && entry ? 'is-done' : ''}" aria-label="${esc(ex.name)}">
    <div class="ex-full-head">
      <button class="ex-item-main" data-a="ex-open" data-uid="${item.uid}"><span class="thumb sm">${thumb(ex)}</span>
        <span class="grow"><span class="ex-name2">${esc(ex.name)}</span>${notices.length ? `<span class="row-notice ${notices[0][0]}">${esc(notices[0][1])}</span>` : `<span class="ex-meta">${conditioning ? fmtTarget(metric, item.target) : `${item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`} reps`}${item.restSec ? ` · rest ${fmtRest(item.restSec)}` : ''}</span>`}</span></button>
      <button class="icon-btn plain" data-a="ex-sheet" data-uid="${item.uid}" aria-label="Options for ${esc(ex.name)}">${icon('more')}</button>
    </div>
    <div class="set-table" role="group" aria-label="Sets">${setHead(conditioning, fields, ex)}${conditioning ? condRows(item, sets, fields, metric, ended, train.condPlaceholder(item, ex, metric)) : liftRows(item, sets, ended, t, ex)}</div>
    ${!ended ? `<button class="text-btn small-text" data-a="add-set" data-uid="${item.uid}">${icon('plus')} ${conditioning ? 'Add round' : 'Add set'}</button>` : ''}
  </section>`;
}

// What's left after this exercise, so the rest of the workout is always in view.
const setsLeft = (session, i) => { const e = session.entries[i.uid]; return !e || (!e.pain && e.sets.some((s) => !s.done)); };
function comingUp(items, idx, session) {
  if (!session) return '';
  const upcoming = items.slice(idx + 1).filter((i) => setsLeft(session, i));
  const skipped = items.slice(0, idx).filter((i) => setsLeft(session, i) && session.entries[i.uid]?.sets.some((s) => s.done) === false);
  const groups = groupsOf(items);
  const row = (i) => {
    const e = session.entries[i.uid];
    const total = e ? e.sets.length : i.sets;
    const done = e ? e.sets.filter((s) => s.done).length : 0;
    const linked = groups.find((g) => g.items.includes(i))?.linked;
    return `<button class="coming-row" data-a="ex-go" data-uid="${i.uid}"><span class="thumb sm">${thumb(i.ex)}</span>
      <span class="grow"><b>${esc(i.ex.name)}</b><span class="pick-sub">${done ? `${done} of ${total} ${i.ex.category === 'conditioning' ? 'rounds' : 'sets'}` : `${total} ${i.ex.category === 'conditioning' ? 'rounds' : 'sets'}`}${linked ? ' · linked' : ''}</span></span>${icon('right', 'chev')}</button>`;
  };
  return `<section class="coming-up" aria-label="Coming up">
    <div class="row between"><h3>${upcoming.length ? 'Coming up' : skipped.length ? 'Still to do' : 'Last exercise'}</h3><button class="link-btn" data-a="ex-close">Whole workout</button></div>
    ${(upcoming.length ? upcoming.slice(0, 3) : skipped.slice(0, 3)).map(row).join('')}
    ${upcoming.length > 3 ? `<p class="muted small">+ ${upcoming.length - 3} more</p>` : ''}
  </section>`;
}

// ---------- Live workout bar ----------

const fmtElapsed = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); return `${h ? `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Pinned to the top while a workout is open: elapsed time, sets done, Finish.
function workoutBar(session) {
  const es = session.order.map((u) => session.entries[u]).filter(Boolean);
  const total = es.reduce((a, e) => a + (e.pain ? e.sets.filter((s) => s.done).length : e.sets.length), 0);
  const done = es.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const onExercise = ui.tab === 'exercise';
  return `<div class="workout-bar" role="group" aria-label="Workout in progress">
    ${onExercise ? `<button class="wb-back" data-a="ex-close" aria-label="Back to the whole workout">${icon('left')}<span>Workout</span></button>` : ''}
    <div class="wb-info"><b class="num" id="wb-time" data-start="${session.startedAt + (session.pausedMs || 0)}" ${session.pausedAt ? 'data-paused="1"' : ''}>${fmtElapsed((session.pausedAt || Date.now()) - session.startedAt - (session.pausedMs || 0))}</b><span class="muted small">${session.pausedAt ? 'Paused' : `${done} of ${total} sets`}</span></div>
    ${session.pausedAt ? '<button class="btn sm primary" data-a="resume">Resume</button>' : '<button class="btn sm primary" data-a="finish">Finish</button>'}
    <i class="wb-progress" style="width:${total ? (done / total) * 100 : 0}%" aria-hidden="true"></i>
  </div>`;
}
setInterval(() => { const el = document.getElementById('wb-time'); if (el && !el.dataset.paused) el.textContent = fmtElapsed(Date.now() - +el.dataset.start); }, 1000);

// ---------- This week at a glance ----------

function ring(pct, cls, size = 44, stroke = 5) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function weekStats() {
  const start = mondayOf(todayStr());
  const end = addDays(start, 6);
  const inWeek = (d) => d >= start && d <= end;
  const planned = liftTemplates(db).length;
  const lifts = planned ? doneTemplates(db).size : db.sessions.filter((s) => inWeek(s.date)).length;
  const cardioMin = db.cardio.filter((c) => inWeek(c.date) && c.cardioId !== 'mobility').reduce((a, c) => a + c.minutes, 0);
  const cardioTarget = cardioTargetFor(db) || 0;
  let pSum = 0; let pDays = 0;
  for (let i = 0; i < 7; i++) { const t = dayTotals(db, addDays(start, i)); if (t.kcal > 300) { pSum += t.p; pDays += 1; } }
  const pTarget = foodTargets(db).protein;
  return { lifts, planned, cardioMin, cardioTarget, protein: pDays ? pSum / pDays : null, pTarget, pDays };
}

function weekStrip() {
  const w = weekStats();
  const item = (cls, pct, big, small) => `<span class="wk-item">${ring(pct, cls, 30, 4)}<span><b class="num">${big}</b><span class="muted">${small}</span></span></span>`;
  return `<button class="week-strip" data-a="tab" data-tab="progress" aria-label="This week: ${w.lifts} of ${w.planned} workouts, ${w.cardioMin} of ${w.cardioTarget} cardio minutes${w.protein != null ? `, protein averaging ${Math.round(w.protein)} of ${w.pTarget} grams` : ''}. Open progress.">
    ${item('r-lift', w.planned ? w.lifts / w.planned : 0, `${w.lifts}${w.planned ? `/${w.planned}` : ''}`, 'workouts')}
    ${item('r-cardio', w.cardioTarget ? w.cardioMin / w.cardioTarget : 0, `${w.cardioMin}${w.cardioTarget ? `/${w.cardioTarget}` : ''}`, 'cardio min')}
    ${item('r-protein', w.protein != null ? w.protein / w.pTarget : 0, w.protein != null ? `${Math.round(w.protein)} g` : '—', 'protein avg')}
  </button>`;
}

// Weeks in a row (ending this week or last) with at least one workout.
function weekStreak() {
  const weeks = new Set(db.sessions.map((x) => mondayOf(x.date)));
  let w = mondayOf(todayStr());
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) { n += 1; w = addDays(w, -7); }
  return n;
}

// Longest run of consecutive weeks with at least one workout.
function bestStreak() {
  const weeks = [...new Set(db.sessions.map((x) => mondayOf(x.date)))].sort();
  let best = 0; let run = 0; let prev = null;
  for (const w of weeks) { run = prev && addDays(prev, 7) === w ? run + 1 : 1; best = Math.max(best, run); prev = w; }
  return best;
}

// Month calendar: lifting days filled, cardio-only days dotted, minutes under each workout.
function calendarCard() {
  const today = todayStr();
  const month = ui.calMonth || today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const daysIn = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
  const byDate = {};
  for (const s of db.sessions) if (s.date.startsWith(month)) (byDate[s.date] ||= { lift: [], cardio: 0 }).lift.push(s);
  for (const c of db.cardio) if (c.date.startsWith(month) && !c.fromWorkout) (byDate[c.date] ||= { lift: [], cardio: 0 }).cardio += c.minutes;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell empty"></span>');
  for (let d = 1; d <= daysIn; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const x = byDate[date];
    const mins = x ? Math.round(x.lift.reduce((a, s) => a + workoutBurn(db, s).minutes, 0) + x.cardio) : 0;
    const cls = [x?.lift.length ? 'lift' : x?.cardio ? 'cardio' : '', date === today ? 'today' : '', date > today ? 'future' : ''].join(' ');
    const label = `${parseDate(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${x ? `: ${x.lift.length ? `${x.lift.length} workout${x.lift.length > 1 ? 's' : ''}` : 'cardio'}, ${mins} minutes` : ''}`;
    cells.push(date > today
      ? `<span class="cal-cell ${cls}" aria-label="${label}"><span class="cal-n">${d}</span><span class="cal-m"></span></span>`
      : `<button class="cal-cell ${cls}" data-a="cal-day" data-date="${date}" aria-label="${label}${x?.lift.length ? '' : '. Tap to log a workout'}"><span class="cal-n">${d}</span>${x?.lift.length ? `<span class="cal-m">${mins}m</span>` : x?.cardio ? '<span class="cal-dot"></span>' : '<span class="cal-m"></span>'}</button>`);
  }
  const count = Object.values(byDate).filter((x) => x.lift.length).length;
  const prev = addDays(first, -1).slice(0, 7);
  const next = addDays(`${month}-${String(daysIn).padStart(2, '0')}`, 1).slice(0, 7);
  return `<section class="card cal-card" aria-label="Workout calendar">
    <div class="cal-head"><h3>${parseDate(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
      <div class="row"><button class="icon-btn" data-a="cal-month" data-v="${prev}" aria-label="Previous month">${icon('left')}</button><button class="icon-btn" data-a="cal-month" data-v="${next}" aria-label="Next month" ${next > today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div></div>
    <div class="cal-grid" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="cal-wd">${x}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    <div class="tile-row three"><div class="tile"><span>This month</span><b class="num">${count}</b></div><div class="tile"><span>Streak</span><b class="num">${weekStreak()} wk</b></div><div class="tile"><span>Best</span><b class="num">${bestStreak()} wk</b></div></div>
  </section>`;
}

function weekRingsCard() {
  const w = weekStats();
  const big = (cls, pct, value, of, label) => `<div class="ring-stat"><div class="ring-wrap">${ring(pct, cls, 84, 9)}<b class="num">${value}</b></div><span class="ring-label">${label}</span><span class="muted small">${of}</span></div>`;
  return `<section class="card week-rings" aria-label="This week">
    <h3>This week</h3>
    <div class="ring-row">
      ${big('r-lift', w.planned ? w.lifts / w.planned : 0, w.lifts, w.planned ? `of ${w.planned} planned` : 'this week', 'Workouts')}
      ${big('r-cardio', w.cardioTarget ? w.cardioMin / w.cardioTarget : 0, w.cardioMin, w.cardioTarget ? `of ${w.cardioTarget} min` : 'minutes', 'Cardio')}
      ${big('r-protein', w.protein != null ? w.protein / w.pTarget : 0, w.protein != null ? Math.round(w.protein) : '—', w.protein != null ? `of ${w.pTarget} g a day` : 'log food to see', 'Protein')}
    </div>

  </section>`;
}

// The reasoning behind how a workout is put together, with sources.
function openWhyWorkout() {
  const v = db.settings.variety || 'low';
  const row = (title, text, refs) => `<div class="why-row"><b>${title}</b><p class="muted small">${text} ${refChips(refs)}</p></div>`;
  openSheet(`<h2>Why it's built this way</h2>
    ${row('Big lifts first', 'Compound lifts come before accessories. Exercises done early in a session get the best performance, so the ones that matter most go first.', ['simao2012'])}
    ${row('Rest by lift size', 'Two to three minutes on heavy compounds, 60–90 seconds on accessories. Longer rests on big lifts keep reps and load higher.', ['schoenfeld2016rest', 'grgic2018rest'])}
    ${row('Stop short of failure', 'Most sets end with a few reps in reserve. That builds as much muscle as going to failure with less fatigue, so you recover for the next session.', ['refalo2023'])}
    ${row('Add reps, then weight', 'Hit the top of the rep range on every set, then the weight goes up and reps reset. Small steady jumps beat big ones.', ['nsca2016'])}
    ${row('Enough weekly sets', 'Each muscle aims for roughly 10–20 hard sets a week, spread over the days you train.', ['schoenfeld2017vol'])}
    ${row(`Variety: ${VARIETY[v].name.toLowerCase()}`, `${VARIETY[v].desc} Rotating exercises can match fixed ones for growth and is more enjoyable, but constant change slows strength on specific lifts, so focus lifts never rotate. Change it in Settings → Training.`, ['fonseca2014', 'bazvalle2019', 'kassiano2022'])}
    <button class="btn block" data-a="close-sheet">Close</button>`);
}

// ---------- Exercise screen: log sets for one exercise ----------

function screenExercise() {
  const day = ui.day;
  const session = sessionFor(day);
  const isDeload = isDeloadFor(day);
  const items = todayItems(day);
  const idx = items.findIndex((i) => i.uid === ui.exUid);
  if (idx < 0) { ui.tab = 'today'; return screenToday(); }
  const item = items[idx];
  const { ex, gym, t, target, entry, sets, notices, conditioning, metric } = cardModel(item, session, isDeload);
  const info = EX_INFO[ex.id] || {};
  const ended = entry?.pain;
  const fields = conditioning ? METRIC_FIELDS[metric] : null;
  const barbell = ex.type?.startsWith('barbell');
  const grp = groupsOf(items).find((g) => g.items.includes(item));
  const firstCompound = items.find((i) => i.ex.category === 'compound' && i.ex.type !== 'bodyweight');
  const warm = entry?.warm || (db.settings.warmups && item === firstCompound && target ? warmupSets(ex, target, gym) : []);
  const rir = rirTarget(weekInfo(db));
  const allDone = entry && sets.every((s) => s.done);
  const prev = items[idx - 1];
  // After an automatic move within a circuit, back returns to the exercise just done.
  const back = (ui.backUid && ui.backUid !== item.uid && items.find((i) => i.uid === ui.backUid)) || prev;
  const next = items[idx + 1];
  const aim = conditioning ? `${t.sets} × ${fmtTarget(metric, item.target)}${item.restSec ? `, rest ${fmtRest(item.restSec)}` : ''}`
    : t.weight == null ? 'Pick a working weight to set your baseline'
    : t.wave ? `Week ${t.wave.week} of 3 · last set: ${t.reps}${t.wave.amrap ? '+ reps, as many as you can with good form' : ' reps'}`
    : t.scheme === 'linear' ? `${t.sets} × ${t.reps} · complete every set to add weight next time`
    : t.total ? `Aim for ${t.reps}+ reps · beat ${t.total - 1} total` : `Aim for ${t.reps} reps`;

  const rows = conditioning ? condRows(item, sets, fields, metric, ended, train.condPlaceholder(item, ex, metric)) : liftRows(item, sets, ended, t, ex);

  const checkin = entry && allDone && !ended && !session.isDeload ? `<div class="checkin" role="group" aria-label="How did that feel">
    <span class="muted small">How did that feel?</span>
    <div class="seg-mini">${[['easy', 'Easy'], ['right', 'Right'], ['hard', 'Too hard']].map(([v, l]) => `<button class="${entry.feedback === v ? 'on' : ''}" data-a="fb" data-uid="${item.uid}" data-v="${v}" aria-pressed="${entry.feedback === v}">${l}</button>`).join('')}</div>
    <button class="text-btn" data-a="pain-report" data-uid="${item.uid}">Report pain</button>
  </div>` : '';

  const img = info.images?.[0];
  return `${session ? workoutBar(session) : ''}<div class="ex-screen">
    <div class="ex-hero">${img ? `<img src="${img}" alt="${esc(ex.name)}" referrerpolicy="no-referrer">` : `<div class="hero-body">${bodyPair(Object.fromEntries(ex.primary.map((m) => [m, 1])))}</div>`}
      <button class="icon-btn hero-btn" data-a="ex-close" aria-label="Back to workout">${icon('left')}</button>
      <button class="icon-btn hero-btn right" data-a="ex-sheet" data-uid="${item.uid}" aria-label="More options">${icon('more')}</button>
    </div>
    <div class="ex-title-row"><h1>${esc(ex.name)}</h1><button class="btn sm" data-a="ex-info" data-id="${ex.id}">${icon('play')}How-to</button></div>
    <p class="subtitle">${CATEGORIES[ex.category]} · ${esc(muscleLine(ex))}</p>
    ${(() => { const f = freshness(currentFatigue(db)); const gs = [...new Set(ex.primary.map((m) => groupOfMuscle(m)).filter(Boolean))]; return gs.length ? `<button class="rec-line" data-a="open-recovery" data-g="${gs[0].id}">${gs.map((g) => `${g.name} <b class="num">${Math.round(groupFreshness(g, f) * 100)}%</b>`).join(' · ')} recovered ${icon('right', 'chev')}</button>` : ''; })()}
    <div class="chips quick-row">
      <button class="chip" data-a="ex-rest" data-uid="${item.uid}">Rest ${fmtRest(item.restSec || grp.items.reduce((a, i) => Math.max(a, i.restSec || 0), 0)) || 'off'}</button>
      <button class="chip" data-a="ex-info" data-id="${ex.id}">History</button>
      <button class="chip" data-a="swap" data-uid="${item.uid}">Replace</button>
      ${grp.linked ? `<button class="chip" data-a="unlink-one" data-uid="${item.uid}">Unlink</button>` : next ? `<button class="chip" data-a="link-next" data-uid="${item.uid}">Link</button>` : ''}
    </div>
    ${grp.linked ? `<div class="group-note"><b>${linkLabel(grp.items.length)}</b>${entry ? (() => { const n = Math.max(...grp.items.map((i) => session.entries[i.uid]?.sets.length || i.sets)); const r = entry.sets.findIndex((x) => !x.done); return ` · round ${r < 0 ? entry.sets.length : r + 1} of ${n}`; })() : ''} · ${grp.items.map((i) => (i === item ? `<span class="cur">${esc(i.ex.name)}</span>` : esc(i.ex.name))).join(' → ')}</div>` : ''}
    <p class="aim-line">${aim}${conditioning || t.wave ? '' : t.rir ? ` · ${t.rir} RIR` : rir ? ` · about ${rir} in reserve` : ''}</p>
    ${conditioning ? train.condInfo(item, entry, ex, metric) : ''}
    ${item.note && conditioning ? `<p class="small">${esc(item.note)}</p>` : ''}
    ${notices.filter((n) => n[2] !== 'pain').map(([c, m]) => `<p class="notice ${c}">${esc(m)}</p>`).join('')}
    ${pain.exerciseCard(ex, item, entry, t, (e) => isAvailable(db, e))}
    ${warmBlock(item, entry, warm, ex, gym, barbell)}
    <div class="set-table" role="group" aria-label="Sets">
      ${setHead(conditioning, fields, ex)}
      ${rows}
    </div>
    ${barbell && target ? `<p class="muted small plates">Plates: ${plateText(target, gym)}</p>` : ''}
    ${!ended ? `<button class="text-btn" data-a="add-set" data-uid="${item.uid}">${icon('plus')} ${conditioning ? 'Add round' : 'Add set'}</button>${conditioning ? '' : `<button class="text-btn" data-a="add-drop" data-uid="${item.uid}">${icon('arrowDown')} Drop set</button>`}` : ''}
    ${ex.rules?.rehab && !ended ? `<label class="toggle"><input type="checkbox" data-a="painfree" data-uid="${item.uid}" ${entry?.painFree ? 'checked' : ''}><span>Pain-free today (needed to increase weight)</span></label>` : ''}
    ${checkin}
    ${comingUp(items, idx, session)}
    <div class="ex-nav">
      ${back ? `<button class="btn" data-a="ex-go" data-uid="${back.uid}" aria-label="Back to ${esc(back.ex.name)}">${icon('left')}</button>` : ''}
      ${!session ? '<button class="btn primary grow" data-a="start-workout">Start workout</button>'
        : next ? `<button class="btn primary grow" data-a="ex-go" data-uid="${next.uid}">Next: ${esc(next.ex.name)}</button>`
          : '<button class="btn primary grow" data-a="finish">Finish workout</button>'}
    </div>
  </div>`;
}

// Warm-up sets: collapsed by default, editable, checked off like work sets (they don't count
// toward progression, volume or records). Stored on the workout entry once edited or started.
function warmBlock(item, entry, warm, ex, gym, barbell) {
  if (!warm.length) return '';
  const done = warm.filter((w) => w.done).length;
  const open = ui.warmOpen?.[item.uid];
  return `<details class="warmup" data-uid="${item.uid}" ${open ? 'open' : ''}>
    <summary>Warm-up · ${done ? `${done} of ${warm.length} done` : `${warm.length} sets`}</summary>
    <div class="set-head warm" aria-hidden="true"><span></span><span>${ex.type === 'dumbbell' ? 'lb each' : 'lb'}</span><span>Reps</span><span></span></div>
    ${warm.map((w, i) => `<div class="set-row warm ${w.done ? 'done' : ''}" data-swipe="warm-del" data-swipe-label="Delete" data-uid="${item.uid}" data-i="${i}">
      <span class="set-badge ty-w">W</span>
      <input class="cell" type="text" inputmode="decimal" data-warm="${item.uid}:${i}:weight" value="${w.weight}" aria-label="Warm-up ${i + 1} weight">
      <input class="cell" type="text" inputmode="numeric" data-warm="${item.uid}:${i}:reps" value="${w.reps}" aria-label="Warm-up ${i + 1} reps">
      <button class="check" data-a="warm-check" data-uid="${item.uid}" data-i="${i}" aria-pressed="${!!w.done}" aria-label="${w.done ? 'Undo' : 'Complete'} warm-up ${i + 1}">${icon('check')}</button>
      ${barbell ? `<span class="wu-plates">${plateText(w.weight, gym)}</span>` : ''}
    </div>`).join('')}
    <button class="text-btn small-text" data-a="warm-add" data-uid="${item.uid}">${icon('plus')} Add warm-up</button>
  </details>`;
}

// The warm-ups for an entry, copied onto the workout the first time they're touched.
function warmFor(uid) {
  const sx = ensureSession(ui.day);
  const e = sx?.entries[uid];
  if (!e) return null;
  if (!e.warm) {
    const item = todayItems(ui.day).find((i) => i.uid === uid);
    const t = targetsFor(db, item, sx.isDeload);
    const gym = activeGym(db);
    e.warm = warmupSets(item.ex, roundToGym(item.ex, t.weight, gym), gym).map((w) => ({ ...w, done: false }));
  }
  return e.warm;
}

const SET_TYPES = { w: ['W', 'Warm-up'], d: ['D', 'Drop set'], f: ['F', 'To failure'] };

function setHead(conditioning, fields, ex) {
  if (conditioning) return `<div class="set-head" aria-hidden="true"><span>Round</span><span>${fields[0][1]}</span><span>${fields[1][1]}</span><span></span></div>`;
  return `<div class="set-head lift" aria-hidden="true"><span>Set</span><span>Previous</span><span>${ex.type === 'bodyweight' ? '+ lb' : ex.type === 'dumbbell' ? 'lb each' : 'lb'}</span><span>Reps</span><span></span></div>`;
}

// Set rows for lifts: set number (tap for type and effort), last time's result (tap to copy),
// weight, reps and the check. Weight comes before reps, the way lifters say it: "135 for 8".
function liftRows(item, sets, ended, t, ex) {
  const last = t.st?.last;
  return sets.map((s, i) => {
    const disabled = ended && !s.done && !s.pain;
    const pw = last?.weights?.[i];
    const pr = last?.reps?.[i];
    const prev = pr != null ? `${ex.type === 'bodyweight' && !pw ? 'BW' : pw} × ${pr}` : '';
    const ty = SET_TYPES[s.type];
    return `<div class="set-row lift ${s.done ? 'done' : ''} ${s.pain ? 'pain' : ''} ${disabled ? 'disabled' : ''}" data-swipe="del-set" data-uid="${item.uid}" data-i="${i}" data-swipe-label="Delete">
      <button class="set-badge ${ty ? `ty-${s.type}` : ''}" data-a="open-set" data-uid="${item.uid}" data-i="${i}" aria-label="Set ${i + 1}${ty ? `, ${ty[1]}` : ''}. Options: type, effort, pain">${ty ? ty[0] : i + 1}</button>
      ${prev ? `<button class="prev" data-a="copy-prev" data-uid="${item.uid}" data-i="${i}" data-w="${pw ?? 0}" data-r="${pr}" ${s.done || disabled ? 'disabled' : ''} aria-label="Last time ${prev}. Tap to use these numbers">${prev}</button>` : '<span class="prev none" aria-label="No previous set">—</span>'}
      <input class="cell" type="text" inputmode="decimal" data-set="${item.uid}:${i}:weight" value="${s.weight ?? ''}" placeholder="—" aria-label="Set ${i + 1} weight in pounds" ${disabled ? 'disabled' : ''}>
      <input class="cell" type="text" inputmode="numeric" data-set="${item.uid}:${i}:reps" value="${s.reps ?? ''}" aria-label="Set ${i + 1} reps" ${disabled ? 'disabled' : ''}>
      <button class="check" data-a="check-inline" data-uid="${item.uid}" data-i="${i}" ${disabled || s.pain ? 'disabled' : ''} aria-pressed="${s.done}" aria-label="${s.done ? 'Undo' : 'Complete'} set ${i + 1}">${icon('check')}</button>
    </div>${s.rir != null || s.pain ? `<p class="set-extra">${s.pain ? 'Pain flagged' : `${s.rir} reps in reserve`}</p>` : ''}`;
  }).join('');
}

// Set rows for conditioning: the measure's fields, plus a start button for timed work.
function condRows(item, sets, fields, metric, ended, ph2 = '') {
  return sets.map((s, i) => {
    const disabled = ended && !s.done;
    const [[k1, l1, m1], [k2, l2, m2]] = fields;
    const timed = metric === 'time' && !s.done && !disabled;
    return `<div class="set-row ${s.done ? 'done' : ''} ${disabled ? 'disabled' : ''}">
      <button class="set-badge" data-a="open-set" data-uid="${item.uid}" data-i="${i}" aria-label="Round ${i + 1} options">${i + 1}</button>
      <input class="cell" type="text" inputmode="${m1}" data-set="${item.uid}:${i}:${k1}" value="${s[k1] ?? ''}" aria-label="Round ${i + 1} ${l1}" ${disabled ? 'disabled' : ''}>
      <input class="cell" type="text" inputmode="${m2}" data-set="${item.uid}:${i}:${k2}" value="${s[k2] ?? ''}" placeholder="${ph2 || '—'}" aria-label="Round ${i + 1} ${l2}" ${disabled ? 'disabled' : ''}>
      ${timed
        ? `<button class="check play" data-a="work-start" data-uid="${item.uid}" data-i="${i}" aria-label="Start round ${i + 1} timer">${icon('play')}</button>`
        : `<button class="check" data-a="check-inline" data-uid="${item.uid}" data-i="${i}" ${disabled ? 'disabled' : ''} aria-pressed="${s.done}" aria-label="${s.done ? 'Undo' : 'Complete'} round ${i + 1}">${icon('check')}</button>`}
    </div>`;
  }).join('');
}

// ---------- Linking supersets and circuits ----------

// Relabel slots after a change: runs that share a key become 3a/3b/3c, singles become 3.
function relabel(list, keyOf) {
  let n = 0;
  let i = 0;
  while (i < list.length) {
    const k = keyOf(list[i]);
    let j = i + 1;
    while (j < list.length && keyOf(list[j]) === k) j++;
    n += 1;
    const run = list.slice(i, j);
    run.forEach((x, r) => { x.group = run.length > 1 ? `${n}${'abcdefgh'[r] || r}` : String(n); });
    // Linked exercises rest after the round: only the last one carries the rest.
    if (run.length > 1) {
      const rest = Math.max(...run.map((x) => x.restSec || 0)) || 90;
      run.forEach((x, r) => { x.restSec = r === run.length - 1 ? rest : 0; });
    }
    i = j;
  }
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
  const mode = dayMode(db, day);
  const isDeload = isDeloadFor(day);
  const modes = db.plan[day] ? ['lift', 'both', 'cardio', 'rest'] : ['cardio', 'rest'];
  openSheet(`<h2>${FULL_DAY[day]}</h2>
    <div class="field"><span>Day type</span><div class="segmented" role="radiogroup" aria-label="Day type">${modes.map((m) =>
      `<button class="${m === mode ? 'on' : ''}" data-a="day-mode-today" data-v="${m}" role="radio" aria-checked="${m === mode}">${MODE_LABELS[m]}</button>`).join('')}</div>
      <p class="muted small">Applies to every ${FULL_DAY[day]}. Change it for the whole week in Plan.</p></div>
    <div class="list-group">
      ${db.plan[day] && !session?.freestyle ? `<label class="list-row toggle"><span class="grow">Deload session<span class="pick-sub">Half the sets, same or slightly lighter weights</span></span><input type="checkbox" data-a="deload-toggle" ${isDeload ? 'checked' : ''} ${session ? 'disabled' : ''}></label>` : ''}
      ${!db.activeSession ? `<button class="list-row" data-a="start-empty"><span class="grow">Empty workout</span>${icon('right', 'chev')}</button>` : ''}
      ${session ? `<button class="list-row" data-a="leave-workout-view"><span class="grow">Plan, food and progress</span>${icon('right', 'chev')}</button>` : ''}
      <button class="list-row" data-a="wk-open"><span class="grow">Adjust week</span>${icon('right', 'chev')}</button>
      ${dayPlan(db, day) && !session ? `<button class="list-row" data-a="adj-open" data-day="${day}"><span class="grow">Adjust ${day === dayKeyOf(todayStr()) ? 'today' : FULL_DAY[day]}</span>${icon('right', 'chev')}</button>` : ''}
      <button class="list-row" data-a="pain-report"><span class="grow">Log pain</span>${icon('right', 'chev')}</button>
      <button class="list-row" data-a="open-templates" data-day="${day}"><span class="grow">Conditioning and recovery</span>${icon('right', 'chev')}</button>
      <button class="list-row" data-a="open-share"><span class="grow">Share app</span>${icon('right', 'chev')}</button>
      ${session ? `<button class="list-row danger-row" data-a="discard"><span class="grow">Discard this workout</span></button>` : ''}
    </div>
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
  if (t.stalled) notices.push(['warn', 'No progress in 3 sessions']);
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
      ${row('ex-open-close', 'check', 'Log sets')}
      ${row('swap', 'swap', 'Swap')}
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
    : t.total ? `${t.reps}+ reps a set · beat ${t.total - 1} total` : `${t.reps} reps a set`;
  const row = (k, v) => (v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '');
  const lastUndone = entry && entry.sets.length > 1 && !entry.sets[entry.sets.length - 1].done;

  const planIt = db.plan[day]?.items.find((x) => x.uid === uid);
  const curGoal = planIt?.goal || '';
  const grpGoal = db.muscleGoals?.[groupOfMuscle(ex.primary[0])?.id];
  openSheet(`<h2>${esc(ex.name)}</h2>
    <p class="muted">${CATEGORIES[ex.category]} · ${TYPES[ex.type] || ex.type}</p>
    <p class="muted small">${esc(muscleLine(ex))}</p>
    ${planIt && ex.category !== 'conditioning' ? `<div class="field"><span>Goal ${helpBtn()}</span><p class="help-text" hidden>Strength: 3–6 reps on compounds, long rests. Size: 6–15 reps. Endurance: 15–25 reps, short rests. "Auto" follows ${grpGoal ? `your ${groupOfMuscle(ex.primary[0]).name.toLowerCase()} goal (${MGOALS[grpGoal].name.toLowerCase()})` : 'your plan'}.</p>
      <div class="segmented small-seg" role="radiogroup" aria-label="Goal for this exercise">${[['', 'Auto'], ...Object.entries(MGOALS).map(([k, v]) => [k, v.name])].map(([k, l]) => `<button class="${curGoal === k ? 'on' : ''}" data-a="set-exgoal" data-uid="${uid}" data-v="${k}" role="radio" aria-checked="${curGoal === k}">${l}</button>`).join('')}</div></div>` : ''}
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
        ? `<button class="list-row" data-a="unlink-one" data-uid="${uid}">${icon('x')}<span class="grow">Unlink from group</span></button>`
        : i < count - 1 ? `<button class="list-row" data-a="link-next" data-uid="${uid}">${icon('plus')}<span class="grow">Link with next exercise</span></button>` : ''}
      <button class="list-row" data-a="ex-move" data-uid="${uid}" data-v="-1" ${i <= 0 ? 'disabled' : ''}>${icon('up')}<span class="grow">Move up</span></button>
      <button class="list-row" data-a="ex-move" data-uid="${uid}" data-v="1" ${i >= count - 1 ? 'disabled' : ''}>${icon('arrowDown')}<span class="grow">Move down</span></button>
      ${lastUndone ? `<button class="list-row" data-a="remove-set" data-uid="${uid}">${icon('minus')}<span class="grow">Remove last set</span></button>` : ''}
      ${ex.rules?.dropSet ? `<label class="list-row toggle"><span class="grow">Drop sets<span class="pick-sub">Each set about 10 lb lighter</span></span><input type="checkbox" data-a="dropset" data-uid="${uid}" ${entry?.dropSet ? 'checked' : ''}></label>` : ''}
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
  if (p.pct == null) return `Est. 1RM ${p.now} lb`;
  const sign = p.pct >= 0 ? '+' : '';
  return `Est. 1RM ${p.base} → ${p.now} lb (${sign}${p.pct.toFixed(1)}%)`;
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
    ${b.isDeload && !db.blocks.reviews[b.index] ? `<button class="btn primary block" data-a="block-review" data-i="${b.index}">Review this block</button>` : ''}
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
    ${logged.map((c) => `<div class="list-row logged"><span class="grow"><b>${esc(CARDIO[c.cardioId]?.name || c.cardioId)}</b> · ${c.minutes} min${c.distance ? ` · ${c.distance} mi` : ''}${c.cardioId !== 'conditioning' && !c.fromWorkout ? ` · ~${Math.round(cardioBurn(db, c, CARDIO[c.cardioId]).active)} kcal` : ''}</span>
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
    return `<div class="rec-detail-head"><h4>${g.name}</h4></div>
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
  return `<div class="rec-detail-head"><h4>${esc(name)}</h4><button class="btn sm" data-a="pain-report" data-pre="${area}:${side || (joint && area !== 'neck' ? 'left' : 'center')}">Log pain</button></div>
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
    if (sel.side && sel.side !== 'center' && sel.side !== side) return;
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
  ui.recSel = { area, side: area === 'neck' ? 'center' : sideOf(el.closest('svg').dataset.view, el.closest('[data-half]')?.dataset.half) };
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
      <div class="field"><span>${l2}</span>${stepper('f-c2', s[k2], k2 === 'weight' ? 5 : 1)}</div>
      <button class="btn primary block big" data-a="save-round" data-uid="${uid}" data-i="${idx}" data-k1="${k1}" data-k2="${k2}">${s.done ? 'Update round' : 'Log round'}</button>
      <div class="row">
        ${metric === 'time' && !s.done ? `<button class="btn grow" data-a="work-start" data-uid="${uid}" data-i="${idx}">Start timer</button>` : ''}
        ${s.done ? `<button class="btn grow" data-a="undo-set" data-uid="${uid}" data-i="${idx}">Mark not done</button>` : `<button class="btn grow" data-a="close-sheet">Cancel</button>`}
      </div>`);
    return;
  }
  const step = ex.type === 'dumbbell' || ex.increment >= 5 ? 5 : ex.increment || 5;
  const weightLabel = ex.type === 'bodyweight' ? 'Added load (lb, 0 = bodyweight)' : ex.type === 'dumbbell' ? 'Weight per DB (lb)' : 'Weight (lb)';
  openSheet(`
    <h2>${esc(ex.name)}</h2>
    <p class="muted small">Set ${idx + 1} of ${entry.sets.length} · range ${entry.repMin}–${entry.repMax}</p>
    <div class="field"><span>${weightLabel}</span>${stepper('f-weight', s.weight, step)}</div>
    <div class="field"><span>Reps</span>${stepper('f-reps', s.reps, 1)}</div>
    <div class="field"><span>Set type</span>
      <div class="chips" id="set-types">${[['', 'Normal'], ...Object.entries(SET_TYPES).map(([k, v]) => [k, v[1]])].map(([k, l]) => `<button class="chip ${(s.type || '') === k ? 'on' : ''}" data-a="set-type" data-uid="${uid}" data-i="${idx}" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="muted small">Warm-up sets don't count toward progression, volume or records.</p></div>
    <div class="field"><span>RIR <span class="muted">(reps in reserve, optional)</span></span>
      <div class="chips rir">${['–', 0, 1, 2, 3, 4, 5].map((r) => `<button class="chip ${(r === '–' ? s.rir == null : s.rir === r) ? 'on' : ''}" data-a="rir" data-v="${r}">${r}</button>`).join('')}</div>
    </div>
    <button class="btn primary block big" data-a="save-set" data-uid="${uid}" data-i="${idx}">${s.done ? 'Update set' : 'Log set'}</button>
    <div class="row">
      <button class="btn danger grow" data-a="pain-report" data-uid="${uid}" data-i="${idx}">Report pain</button>
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

function openSheet(html) {
  const sh = $('#sheet');
  const body = $('#sheet-body');
  if (sh.hidden) sheetReturnFocus = document.activeElement;
  body.innerHTML = `<div class="sheet-top"><div class="grabber" aria-hidden="true"></div><button class="sheet-x" data-a="close-sheet" aria-label="Close">${icon('x')}</button></div>${html}`;
  const title = body.querySelector('h2');
  if (title) { title.id = 'sheet-title'; body.setAttribute('aria-labelledby', 'sheet-title'); }
  if (sh.hidden) lockPage(true);
  sh.hidden = false;
  $('#main').setAttribute('aria-hidden', 'true');
  requestAnimationFrame(() => {
    sh.classList.add('open');
    // Focus the title (not a text field) so the iPhone keyboard doesn't pop up uninvited.
    if (title) title.setAttribute('tabindex', '-1');
    (title || body).focus?.({ preventScroll: true });
  });
}
function closeSheet() {
  const sh = $('#sheet');
  sh.classList.remove('open');
  $('#main').removeAttribute('aria-hidden');
  lockPage(false);
  setTimeout(() => {
    sh.hidden = true;
    $('#sheet-body').innerHTML = '';
    if (sheetReturnFocus?.isConnected) sheetReturnFocus.focus?.({ preventScroll: true });
    sheetReturnFocus = null;
  }, 180);
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
    <button class="btn block new-ex-btn" data-a="pk-custom">${icon('plus')} New exercise</button>
    <div id="pk-list"></div>`);
  renderPickerList();
}

function pickRow(ex, why) {
  return `<button class="pick-row" data-a="pick" data-id="${ex.id}">
    <span class="grow"><b>${esc(ex.name)}${db.exPrefs[ex.id] === 'fav' ? ' <span class="fav-mark" aria-label="Favorite">' + icon('starFill') + '</span>' : ''}</b><span class="pick-sub">${isAvailable(db, ex) ? '' : '<em class="warn-t">Hidden</em> · '}${why ? `<em>${why}</em> · ` : ''}${esc(muscleLine(ex))}</span></span>
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

// ---------- Summary ----------

const STATUS = {
  progressed: ['up', 'Progressed', 'good'],
  held: ['minus', 'Hold', ''],
  missed: ['minus', 'Missed range', 'warn'],
  reduced: ['arrowDown', 'Reduced', 'warn'],
  pain: ['x', 'Pain', 'bad'],
  deload: ['minus', 'Deload', ''],
  logged: ['check', 'Logged', ''],
  skipped: ['minus', 'Skipped', 'muted'],
};

function screenSummary() {
  const s = db.sessions.find((x) => x.id === ui.summaryId);
  if (!s) { ui.tab = 'today'; return screenToday(); }
  const mins = Math.round(workoutMinutes(s));
  const sets = s.entries.reduce((a, e) => a + e.sets.filter((x) => !x.pain).length, 0);
  const vol = s.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.pain ? 0 : (x.weight || 0) * (x.reps || 0)), 0), 0);
  const res = s.results.filter((r) => r.status !== 'skipped');
  const progressed = res.filter((r) => r.status === 'progressed');
  const stalled = res.filter((r) => r.stalled || r.status === 'missed' || r.status === 'reduced');
  const row = (r) => {
    const [ic, label, cls] = STATUS[r.status];
    const ex = db.exercises[r.exerciseId];
    return `<div class="result ${cls}">
      <span class="r-icon" aria-hidden="true">${icon(ic)}</span>
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
      <button class="stat" data-a="energy-why" aria-label="About ${Math.round(workoutBurn(db, s).active)} active calories"><b>~${Math.round(workoutBurn(db, s).active)}</b><span>active kcal</span></button>
    </div>
    ${prs.length ? `<div class="card pr-card"><h3>Personal records</h3>${prs.map((p) => `<p class="small"><b>${esc(p.name)}</b> — ${esc(p.text)}</p>`).join('')}</div>` : ''}
    ${s.isDeload ? '<p class="muted small pad">Deload sessions don\'t change targets.</p>' : `
    <div class="card"><h3>Progressed (${progressed.length})</h3>${progressed.length ? progressed.map(row).join('') : '<p class="muted small">None this time.</p>'}</div>
    ${stalled.length ? `<div class="card"><h3>Stalled or missed (${stalled.length})</h3>${stalled.map(row).join('')}</div>` : ''}`}
    ${adj.length ? `<div class="card"><h3>Plan adjustments from your check-ins</h3>${adj.map((a) => `<p class="small">${esc(a.text)}</p>`).join('')}</div>` : ''}
    <div class="card"><h3>Next session targets</h3>${res.filter((r) => !progressed.includes(r) && !stalled.includes(r)).map(row).join('') || '<p class="muted small">See above.</p>'}</div>
    ${ui.summaryFresh ? extras.summaryBackupCard() : ''}
    <div class="card"><h3>Notes</h3><textarea id="session-note" data-sid="${s.id}" rows="3" placeholder="How did it go? Sleep, energy, anything to remember">${esc(s.note || '')}</textarea></div>
    ${health.button(s)}
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
  return `<header class="top"><button class="back" data-a="summary" data-id="${s.id}" aria-label="Back">${icon('left')}</button><div><h1>Edit workout</h1><p class="muted small">${fmtDate(s.date)} · changes save when you tap Save</p></div></header>
    <div class="card"><div class="field"><span>Duration (minutes) ${helpBtn()}</span><p class="help-text" hidden>Used for calories burned. Leave it to the app and it uses the workout clock, or about 2.5 minutes per set if the clock looks too short.</p>
      <input id="es-dur" type="text" inputmode="numeric" value="${s.durationMin || ''}" placeholder="${Math.round(workoutMinutes({ ...s, durationMin: 0 }))} (estimated)"></div></div>
    ${s.entries.map((e, ei) => `<div class="card">
      <div class="row between"><h3>${esc(e.name)}</h3><button class="mini danger" data-a="es-del-entry" data-i="${ei}">Remove</button></div>
      ${e.sets.map((x, si) => `<div class="edit-set"><span class="set-n">${si + 1}</span>
        <input type="text" inputmode="decimal" data-es="${ei}:${si}:weight" value="${x.weight}" aria-label="Weight"><span class="muted">lb ×</span>
        <input type="text" inputmode="numeric" data-es="${ei}:${si}:reps" value="${x.reps}" aria-label="Reps">
        <button class="mini" data-a="es-del-set" data-i="${ei}" data-j="${si}" aria-label="Delete set">${icon('x')}</button></div>`).join('')}
      <button class="text-btn small-text" data-a="es-add-set" data-i="${ei}">${icon('plus')} Add set</button>
    </div>`).join('')}
    <button class="btn block" data-a="es-add-ex">${icon('plus')} Add exercise</button>
    <button class="btn primary block big" data-a="es-save">Save changes</button>
    <button class="btn danger block" data-a="es-delete">Delete this workout</button>
    <p class="muted small pad">If this is your most recent workout for an exercise, its next targets are recalculated. Older workouts only update history.</p>`;
}

function readEditInputs(s) {
  const dur = parseFloat($('#es-dur')?.value);
  if ($('#es-dur')) {
    if (Number.isFinite(dur) && dur > 0) { s.durationMin = Math.round(dur); s.finishedAt = s.startedAt + s.durationMin * 60000 + (s.pausedMs || 0); }
    else delete s.durationMin;
  }
  for (const el of document.querySelectorAll('[data-es]')) {
    const [ei, si, k] = el.dataset.es.split(':');
    const v = parseFloat(el.value);
    if (Number.isFinite(v) && s.entries[ei]?.sets[si]) s.entries[ei].sets[si][k] = k === 'reps' ? Math.round(v) : v;
  }
}

// Log a workout on a past day: start from one of the plan's days, or empty.
function openBackfill(date) {
  const days = DAY_KEYS.filter((k) => db.plan[k]?.items?.length);
  const same = dayKeyOf(date);
  openSheet(`<h2>Log a workout</h2><p class="muted small">${fmtDate(date)}</p>
    <div class="list-group menu">
      ${[...days.filter((k) => k === same), ...days.filter((k) => k !== same)].map((k) => `<button class="list-row" data-a="backfill-go" data-date="${date}" data-tpl="${k}">${icon('copy')}<span class="grow">${esc(db.plan[k].name)}<span class="pick-sub">${DAY_NAMES[k]}'s plan · ${db.plan[k].items.length} exercises</span></span></button>`).join('')}
      <button class="list-row" data-a="backfill-go" data-date="${date}" data-tpl="">${icon('plus')}<span class="grow">Empty workout</span></button>
    </div>
    <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
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
  return `<header class="top"><h1 class="grow">Progress</h1></header>
    ${progressTabs()}
    ${!db.sessions.length && !db.cardio.length ? '<div class="empty"><div class="big">No workouts yet</div><p class="muted">Finished workouts show up here.</p></div>' : ''}
    ${weekRingsCard()}
    ${calendarCard()}
    ${extras.volumeCard()}
    ${recent.length ? `<div class="card"><h3>Recent workouts</h3>${recent.map((s) => `
      <button class="list-row" data-a="summary" data-id="${s.id}">
        <span class="grow"><b>${s.freestyle ? 'Freestyle' : esc(db.plan[s.day]?.name || DAY_NAMES[s.day])}${s.isDeload ? ' · deload' : ''}</b><span class="pick-sub">${fmtDate(s.date)} · ${Math.round(workoutBurn(db, s).minutes)} min · ~${Math.round(workoutBurn(db, s).active)} kcal</span></span>
        ${s.prs?.length ? `<span class="pill good">${s.prs.length} PR${s.prs.length > 1 ? 's' : ''}</span>` : (() => { const up = s.results.filter((r) => r.status === 'progressed').length; return up ? `<span class="muted small">${up} up</span>` : ''; })()}${icon('right', 'chev')}
      </button>`).join('')}</div>` : ''}
    ${cardioHistory()}
    ${seen.size ? `<div class="card"><div class="row between"><h3>By exercise</h3><button class="link-btn" data-a="browse-bank">Exercise library</button></div>${seen.size > 6 ? '<input class="search list-filter" type="search" placeholder="Search your exercises" data-filter="#by-ex" autocomplete="off" enterkeyhint="search">' : ''}<div id="by-ex">${[...seen.entries()].map(([id, date]) => `
      <button class="list-row" data-a="history-ex" data-id="${id}">
        <span class="grow">${esc(db.exercises[id]?.name || id)}</span><span class="muted small">${fmtDate(date)}</span>${icon('right', 'chev')}
      </button>`).join('')}</div></div>` : ''}`;
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
  return `<header class="top"><button class="back" data-a="history-back" aria-label="Back">${icon('left')}</button><div><h1>${esc(ex.name)}</h1><p class="muted small">${CATEGORIES[ex.category]} · ${esc(muscleLine(ex))}</p></div></header>
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
  return `<header class="top"><h1 class="grow">Progress</h1></header>
    ${progressTabs()}
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
      <div class="list-row"><span class="grow">${fmtDate(b.date)}</span><b>${b.weight}</b><button class="mini" data-a="bw-del" data-date="${b.date}" aria-label="Delete">${icon('x')}</button></div>`).join('')}</div>` : ''}
    <h2 class="sect-h">Measurements & photos</h2>
    ${extras.bodyCards()}`;
}

// ---------- Plan editor ----------

function builderEntry() {
  const prev = db.previousPlan;
  return `<div class="list-group">
      <button class="list-row" data-a="open-builder"><span class="row-icon accent" aria-hidden="true">${icon('sparkle')}</span><span class="grow"><b>${db.profile ? 'Goals & plan builder' : 'Build a plan from your goals'}</b><span class="pick-sub">Sets, reps, days and exercises for your goals</span></span>${icon('right', 'chev')}</button>
      ${prev ? `<button class="list-row" data-a="undo-plan"><span class="row-icon" aria-hidden="true">${icon('undo')}</span><span class="grow">Undo plan change<span class="pick-sub">From ${new Date(prev.savedAt).toLocaleDateString()}</span></span></button>` : ''}
    </div>`;
}

function planViewTabs() {
  return `<header class="top"><h1 class="grow">Plan</h1></header>
    <div class="segmented" role="tablist" aria-label="Plan view">
      <button class="${ui.planView === 'week' ? 'on' : ''}" data-a="plan-view" data-v="week" role="tab" aria-selected="${ui.planView === 'week'}">Week</button>
      <button class="${ui.planView === 'year' ? 'on' : ''}" data-a="plan-view" data-v="year" role="tab" aria-selected="${ui.planView === 'year'}">Year</button>
    </div>`;
}

function screenPlan() {
  if (ui.planView === 'year') return planViewTabs() + year.view();
  const day = ui.planDay;
  const plan = db.plan[day];
  const mode = dayMode(db, day);
  const modes = plan ? ['lift', 'both', 'cardio', 'rest'] : ['cardio', 'rest'];
  const head = `${dayTabs(day, 'plan-day')}
    <div class="segmented small-seg" role="radiogroup" aria-label="Day type">${modes.map((m) =>
      `<button class="${m === mode ? 'on' : ''}" data-a="day-mode" data-v="${m}" role="radio" aria-checked="${m === mode}">${MODE_LABELS[m]}</button>`).join('')}</div>`;
  const weekAdjusted = db.week?.start === mondayOf(todayStr());
  const weekBar = `<div class="week-bar"><button class="btn grow" data-a="wk-open">Adjust week</button>${weekAdjusted ? '<button class="btn" data-a="wk-reset">Reset</button>' : ''}</div>${weekAdjusted ? '<p class="muted small week-note">This week is adjusted. Your plan returns Monday.</p>' : ''}`;
  if (!plan) return planViewTabs() + weekBar + train.runCard() + head + `<div class="empty small-empty"><p class="muted">No lifting on ${FULL_DAY[day]}s. Cardio days get suggestions based on your fatigue and upcoming lift days.</p></div><button class="btn block" data-a="pt-add" data-day="${day}">Add lifting on ${FULL_DAY[day]}s</button><button class="btn block" data-a="open-templates" data-day="${day}" data-mode="plan">Add conditioning</button>${builderEntry()}`;
  const items = plan.items;
  const est = estimateMinutes(items);
  const totalSets = items.reduce((a, i) => a + i.sets, 0);
  return `${planViewTabs()}${blockCard()}${weekBar}${train.runCard()}${head}
    ${mode === 'cardio' || mode === 'rest' ? `<p class="muted small pad">Lifting is off on ${FULL_DAY[day]}s. The exercises below are kept for when you switch back.</p>` : ''}
    <div class="card plan-day">
      <div class="row between"><input id="plan-name" class="title-input" type="text" value="${esc(plan.name)}" data-a="plan-name" aria-label="Day name"><button class="icon-btn plain" data-a="plan-day-menu" data-day="${day}" aria-label="${FULL_DAY[day]} options: move, edit all, remove">${icon('more')}</button></div>
      <div class="row between plan-day-meta">
        <span class="muted small nowrap">${items.length} exercises · ${totalSets} sets · ~${est} min</span></div>
      <div class="plan-list">
      ${items.map((it, i) => {
        const ex = db.exercises[it.exerciseId];
        const rot = it.role === 'rowCompound' ? ' · rotates each block' : it.role === 'rowAccessory' ? ' · follows rotation' : it.variants?.length > 1 ? ` · rotates ${it.variants.length} variations each ${it.rotate === 'workout' ? 'workout' : 'block'}` : '';
        return `<div class="plan-row region-${ex ? regionOf(ex) : 'core'}" data-drag-item data-drag-list="plan" data-drag-id="${it.uid}">
          <button class="drag-handle" data-drag-handle aria-label="Reorder ${esc(ex?.name || '')} (arrow keys move it)">${GRIP}</button>
          <button class="plan-row-main" data-a="plan-edit" data-i="${i}" aria-label="Edit ${esc(ex?.name || it.exerciseId)}">
            <span class="tag">${esc(it.group)}</span>
            <span class="grow"><b>${esc(ex?.name || it.exerciseId)}</b><span class="pick-sub">${it.metric || ex?.category === 'conditioning' ? `${it.sets} × ${fmtTarget(it.metric || ex?.metric || 'reps', it.target ?? it.repMax)}` : `${it.sets} × ${it.repMin}–${it.repMax}`}${it.restSec ? ` · rest ${fmtRest(it.restSec)}` : ''}${rot}</span></span>
            ${icon('right', 'chev')}
          </button>
        </div>`;
      }).join('')}
      </div>
      <div class="plan-actions"><button class="text-btn" data-a="plan-add">${icon('plus')} Exercise</button><button class="text-btn" data-a="open-templates" data-day="${day}" data-mode="plan">${icon('plus')} Conditioning</button><button class="text-btn" data-a="browse-bank">Library</button></div>
    </div>
    ${builderEntry()}
    <p class="muted small pad">Drag ⠿ to reorder, or tap an exercise to edit, swap or move it. Swapping keeps each exercise's history.</p>`;
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
      <select id="pe-ex" data-a="pe-ex"><option value="__new" ${isNew ? 'selected' : ''}>New exercise…</option>${opts}</select></div>
    <div class="field" id="pe-new" ${isNew ? '' : 'hidden'}><span>New exercise name</span><input id="pe-name" type="text" placeholder="e.g. Cable row (wide grip)"></div>
    <div class="grid2">
      <div class="field"><span>Group</span><input id="pe-group" type="text" value="${esc(it.group)}" placeholder="3a"></div>
      <div class="field"><span>Sets</span><input id="pe-sets" type="text" inputmode="numeric" value="${it.sets}"></div>
      <div class="field"><span>Rep min</span><input id="pe-min" type="text" inputmode="numeric" value="${it.repMin}"></div>
      <div class="field"><span>Rep max</span><input id="pe-max" type="text" inputmode="numeric" value="${it.repMax}"></div>
      <div class="field"><span>Rest (sec)</span><input id="pe-rest" type="text" inputmode="numeric" value="${it.restSec}"></div>
      <div class="field"><span>Measure</span><select id="pe-metric">${Object.entries(METRICS).map(([k, v]) => `<option value="${k}" ${k === (it.metric || ex.metric || 'reps') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><span>Target per round</span><input id="pe-target" type="text" inputmode="numeric" value="${it.target ?? ''}" placeholder="sec, m, cal or reps"></div>
    </div>
    <p class="muted small">Measure and target are for conditioning: time, distance or calories per round. Lifts use reps and the rep range above.</p>
    <div class="field"><span>Slot note (this day only)</span><input id="pe-note" type="text" value="${esc(it.note || '')}"></div>
    ${it.exerciseId && !it.role ? (() => {
      const opts = similarExercises(db.exercises, it.exerciseId, 12).filter((x) => x.samePattern).slice(0, 8);
      if (!opts.length) return '';
      const sel = new Set(it.variants || [it.exerciseId]);
      return `<div class="field"><span>Variety ${helpBtn()}</span><p class="help-text" hidden>Auto follows your variety setting. Keep uses this exact exercise every week. The others rotate through the variations you pick below, on that schedule.</p>
        <div class="segmented small-seg" role="radiogroup" aria-label="Rotate">${[['auto', 'Auto'], ['lock', 'Keep'], ['week', 'Weekly'], ['block', 'Each block'], ['workout', 'Each workout']].map(([v, l]) => `<button class="${(it.lock ? 'lock' : it.variants && !it.autoVar ? it.rotate : 'auto') === v ? 'on' : ''}" data-a="pe-rot" data-v="${v}" role="radio">${l}</button>`).join('')}</div>
        <div class="chips wrap" id="pe-variants" aria-label="Variations">${[db.exercises[it.exerciseId], ...opts.map((o) => o.ex)].map((e) => `<button class="chip ${sel.has(e.id) ? 'on' : ''}" data-a="pe-var" data-id="${e.id}" aria-pressed="${sel.has(e.id)}">${esc(e.name)}</button>`).join('')}</div>
        <p class="muted small">Each variation keeps its own weights and progress.</p></div>`;
    })() : ''}
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
    ${isNew ? '' : `<div class="list-group">
      <button class="list-row" data-a="plan-swap" data-i="${i}"><span class="grow">Swap for a similar exercise</span></button>
      ${(() => { const items = db.plan[day].items; const linked = items.filter((x) => groupNum(x.group) === groupNum(it.group)).length > 1;
        return linked ? `<button class="list-row" data-a="plan-unlink" data-i="${i}"><span class="grow">Unlink from group</span></button>`
          : i < items.length - 1 ? `<button class="list-row" data-a="plan-link-next" data-i="${i}"><span class="grow">Link with next exercise</span></button>` : ''; })()}
      <button class="list-row" data-a="plan-up" data-i="${i}" ${i === 0 ? 'disabled' : ''}><span class="grow">Move up</span></button>
      <button class="list-row" data-a="plan-down" data-i="${i}" ${i === db.plan[day].items.length - 1 ? 'disabled' : ''}><span class="grow">Move down</span></button>
      <button class="list-row danger-row" data-a="plan-del" data-i="${i}"><span class="grow">Remove from this day</span></button>
    </div>`}
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
  // Rotation: chosen variations, in the order shown, starting with this exercise.
  const rot = document.querySelector('[data-a="pe-rot"].on')?.dataset.v || '';
  const vars = [...document.querySelectorAll('#pe-variants .chip.on')].map((b) => b.dataset.id);
  const prevItem = i === -1 ? null : items[i];
  if (rot === 'lock') Object.assign(slot, { lock: true, rotate: undefined, variants: undefined, autoVar: undefined });
  else if (rot && rot !== 'auto' && vars.length > 1) Object.assign(slot, { lock: undefined, autoVar: undefined, rotate: rot, variants: vars.includes(exId) ? [exId, ...vars.filter((v) => v !== exId)] : vars });
  else { slot.lock = undefined; if (!prevItem?.autoVar) { slot.rotate = undefined; slot.variants = undefined; } }
  const metric = $('#pe-metric')?.value || 'reps';
  if (metric !== 'reps' || ex.category === 'conditioning') {
    slot.metric = metric;
    slot.target = intOr('pe-target', metric === 'reps' ? repMax : metric === 'time' ? 30 : metric === 'distance' ? 100 : 10);
  } else { slot.metric = undefined; slot.target = undefined; }
  if (i === -1) items.push({ uid: `${day}-${Date.now()}`, exerciseId: exId, ...slot });
  else {
    const it = items[i];
    // Changing the exercise on a rotating slot turns the rotation off for that slot.
    const resolved = resolveDay(db, day).find((r) => r.uid === it.uid);
    if (it.role && resolved && resolved.exerciseId !== exId) delete it.role;
    if (!it.role && it.exerciseId !== exId) { it.exerciseId = exId; it.manual = true; }
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

// Weekdays the builder will place lifting on: the lifter's picks if they match the count.
function liftDayKeys(p) {
  const chosen = (p.liftDayKeys || []).filter((d) => DAY_KEYS.includes(d));
  return chosen.length === p.liftDays ? chosen : WEEK_LAYOUT[p.liftDays] || [];
}

function builderCompounds(out) {
  if (!out) return [];
  const seen = new Map();
  for (const d of Object.values(out.plan)) for (const it of d.items) {
    const ex = db.exercises[it.exerciseId];
    if (ex?.category === 'compound' && !seen.has(ex.id)) seen.set(ex.id, ex);
  }
  return [...seen.values()];
}

// Focus defaults to each day's first compound (the main lifts), up to three.
function builderFocus(p, out) {
  const valid = builderCompounds(out).map((e) => e.id);
  if (p.focus?.length) return p.focus.filter((id) => valid.includes(id));
  const firsts = [];
  for (const d of Object.values(out?.plan || {})) {
    const it = d.items.find((x) => db.exercises[x.exerciseId]?.category === 'compound');
    if (it && !firsts.includes(it.exerciseId)) firsts.push(it.exerciseId);
  }
  return firsts.slice(0, 3);
}

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

// Strength-first goals suit a strength scheme: add weight for newer lifters, waves once that stalls.
function recommendProgression(p) {
  const g = p?.goals || {};
  const top = Math.max(0, ...Object.values(g));
  if (!top || (g.strength || 0) < top || (g.strength || 0) < 3) return 'double';
  return p.experience === 'beginner' ? 'linear' : 'wave';
}

const helpBtn = () => '<button class="help-btn" data-a="help" aria-expanded="false" aria-label="What is this?">?</button>';

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
        <div class="field"><span>Sex ${helpBtn()}</span><p class="help-text" hidden>Optional. Only used to interpret body fat %.</p>${bChips('sex', { '': 'Prefer not to say', male: 'Male', female: 'Female' }, p.sex)}</div>
        <div class="field"><span>Body fat % ${helpBtn()}</span><p class="help-text" hidden>Optional. If you know it, calorie and protein targets use your lean mass.</p><input type="text" inputmode="decimal" data-b="bodyFat" value="${esc(p.bodyFat)}" placeholder="e.g. 18"></div>
        <div class="field"><span>Build ${helpBtn()}</span><p class="help-text" hidden>A rough stand-in for body fat % when that's blank.</p>${bChips('build', BUILD_LABELS, p.build)}</div>
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
        <div class="field"><span>Days ${helpBtn()}</span><p class="help-text" hidden>The weekdays you lift. You can adjust any single week later.</p><div class="chips wrap" role="group" aria-label="Lifting days">${DAY_KEYS.map((d) => {
          const on = liftDayKeys(p).includes(d);
          return `<button class="chip ${on ? 'on' : ''}" data-a="b-weekday" data-v="${d}" aria-pressed="${on}">${DAY_NAMES[d]}</button>`;
        }).join('')}</div></div>
        <div class="field"><span>Cardio sessions per week · suggested <b>${sug.cardio}</b> (${rx.cardioMin} min)</span>${dayChips('cardioDays', 0, 7, p.cardioDays)}</div>
        ${ui.b.liftEdited || ui.b.cardioEdited ? '<button class="mini" data-a="b-suggested">Use suggested days</button>' : ''}
        <ul class="reasons small muted">${sug.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <p class="muted small">Cardio sessions go on non-lifting days first, then after lifting on upper-body days.</p>
      </div>
      <div class="card">
        <div class="field"><span>Session length ${helpBtn()}</span><p class="help-text" hidden>How long you usually have. Shorter sessions use more supersets and fewer accessories.</p>${bChips('sessionMin', { 30: '30 min', 45: '45 min', 60: '60 min', 75: '75 min', 90: '90 min', 105: '105 min', 120: '120 min' }, p.sessionMin)}</div>
        <details class="pain-list"><summary>Different goals for different muscles</summary>
          <p class="muted small">Optional. For example size for arms, strength for chest, endurance for legs.</p>
          ${GROUPS.filter((g) => g.id !== 'core' && g.id !== 'lower-back' && g.id !== 'forearms').map((g) => `<div class="mgoal-row"><span>${g.name}</span><select data-a="b-mgoal" data-g="${g.id}" aria-label="Goal for ${g.name}">${[['', 'Plan default'], ...Object.entries(MGOALS).map(([k, v]) => [k, v.name])].map(([k, l]) => `<option value="${k}" ${(p.muscleGoals?.[g.id] || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}
        </details>
        <div class="field"><span>Variety ${helpBtn()}</span><p class="help-text" hidden>How often exercises change. Focus lifts always stay the same.</p>${bChips('variety', Object.fromEntries(Object.entries(VARIETY).map(([k, v]) => [k, v.name])), p.variety || 'low')}
          <p class="muted small">${VARIETY[p.variety || 'low'].desc} ${refChips(['kassiano2022', 'bazvalle2019', 'fonseca2014'])}</p></div>
        <div class="field"><span>Progression ${helpBtn()}</span><p class="help-text" hidden>${Object.values(PROGRESSIONS).map((v) => `${v.name}: ${v.desc}`).join(' ')} Strength options apply to your focus lifts.</p>${bChips('progression', Object.fromEntries(Object.entries(PROGRESSIONS).map(([k, v]) => [k, v.name + (recommendProgression(p) === k ? ' ★' : '')])), p.progression || recommendProgression(p))}
          <p class="muted small">★ suggested for your goals. ${refChips(['acsm2009', 'wendler2009'])}</p></div>
        <div class="field"><span>Routines ${helpBtn()}</span><p class="help-text" hidden>Add a short warm-up (easy cardio, dynamic moves, and PT drills for any pain you've logged) and a cool-down stretch to every lifting day. You can switch either off on any day.</p>${bChips('routines', { warm: 'Warm-up', cool: 'Cool-down' }, p.routines || [], true)}</div>
        <div class="field"><span>Core ${helpBtn()}</span><p class="help-text" hidden>Where core work goes. Default: one core exercise to finish each lifting day, mixing weighted and bodyweight.</p>${bChips('corePlacement', Object.fromEntries(Object.entries(CORE_PLACEMENTS).map(([k, v]) => [k, v.name])), p.corePlacement || 'end')}</div>
        <div class="field"><span>Equipment</span>${bChips('equipment', EQUIPMENT, p.equipment, true)}</div>
        <div class="field"><span>Sensitive areas ${helpBtn()}</span><p class="help-text" hidden>Skips exercises that commonly bother these joints.</p>${bChips('limits', LIMITS, p.limits, true)}</div>
      </div>`;
  } else if (step === 3) {
    const days = liftDayKeys(p);
    body = `<p class="muted small pad">${p.liftDays} lifting days. Pick how to split the work — the recommended option trains each muscle about twice a week ${refLinks(['schoenfeld2016freq', 'pelland2026'])}.</p>
      ${opts.map((o) => `<button class="card split-card ${p.split === o.id ? 'picked' : ''}" data-a="b-split" data-v="${o.id}">
        <div class="row between"><b>${o.label}</b>${o.recommended ? '<span class="verdict good">Recommended</span>' : ''}</div>
        <p class="small muted">${o.desc}</p>
        <p class="small">${o.templates.map((t, i) => `${DAY_NAMES[days[i]]}: ${splitDayName(t)}`).join(' · ')}</p>
      </button>`).join('')}
      ${(() => {
        const base = splitTemplates(p.liftDays, p.split);
        const order = p.dayOrder?.length === base.length ? p.dayOrder : base;
        return `<div class="card"><h3>Your week ${helpBtn()}</h3><p class="help-text" hidden>Use the arrows to change the order of the days, and pick the main lift each day is built around. Everything else is filled in to match.</p>
          ${order.map((t, i) => {
            const optsM = mainLiftOptions(db, p, t);
            const cur = p.mainLift?.[t] || optsM[0]?.id;
            return `<div class="order-row"><b class="order-day">${DAY_NAMES[days[i]]}</b>
              <div class="grow"><span class="order-name">${splitDayName(t)}</span>
                <select data-a="b-main" data-k="${t}" aria-label="Main lift for ${splitDayName(t)}">${optsM.map((e) => `<option value="${e.id}" ${e.id === cur ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
              <button class="icon-btn" data-a="b-order" data-i="${i}" data-v="-1" aria-label="Move ${splitDayName(t)} earlier" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
              <button class="icon-btn" data-a="b-order" data-i="${i}" data-v="1" aria-label="Move ${splitDayName(t)} later" ${i === order.length - 1 ? 'disabled' : ''}>${icon('arrowDown')}</button></div>`;
          }).join('')}</div>`;
      })()}`;
  } else {
    let out;
    try { out = generatePlan(db, p, rx, p.liftDays, p.cardioDays, p.split); } catch (e) { out = null; body = `<p class="flag bad">${esc(e.message)}</p>`; }
    ui.b.out = out;
    if (out) body = reviewHtml(p, rx, out);
  }

  return `<header class="top"><button class="back" data-a="b-exit" aria-label="Close builder">${icon('left')}</button><div><h1>Plan builder</h1><p class="muted small">Step ${step + 1} of ${B_STEPS.length} · ${B_STEPS[step]}</p></div></header>
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
    return `<details class="day-detail"><summary class="list-row"><span class="day-k">${DAY_NAMES[d]}</span><span class="grow"><b>${label}</b></span>${icon('right', 'chev')}</summary>
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
    <div class="card"><h3>Your week</h3>${week}<p class="muted small">You can swap any exercise or edit sets and reps after applying.</p>
      ${countManual(db.plan) ? `<label class="toggle"><input type="checkbox" data-a="b-keep" ${p.keepManual !== false ? 'checked' : ''}><span>Keep ${countManual(db.plan)} exercise${countManual(db.plan) === 1 ? '' : 's'} I chose</span></label>` : ''}</div>
    <div class="card"><h3>Focus lifts for your first block</h3>
      <p class="muted small">The compounds you want to push before the first deload. Their progress is tracked each block and reviewed at every deload.</p>
      <div class="chips wrap" role="group" aria-label="Focus lifts">${builderCompounds(out).map((ex) => {
        const on = builderFocus(p, out).includes(ex.id);
        return `<button class="chip ${on ? 'on' : ''}" data-a="b-focus" data-id="${ex.id}" aria-pressed="${on}">${esc(ex.name)}</button>`;
      }).join('')}</div></div>
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
  const oldPlan = db.plan;
  db.plan = out.plan;
  if (p.keepManual !== false) keepManual(db, oldPlan, db.plan);
  db.muscleGoals = { ...(p.muscleGoals || {}) };
  applyGoals(db);
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
  db.blocks.focus[blockInfo(db).index] = builderFocus(p, out);
  applyCore(db, p.corePlacement || 'end');
  db.settings.progression = p.progression || recommendProgression(p);
  db.settings.warmupRoutine = (p.routines || []).includes('warm');
  db.settings.cooldownRoutine = (p.routines || []).includes('cool');
  applyVariety(db, p.variety || 'low', db.blocks.focus[blockInfo(db).index] || []);
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

// Settings: grouped like iOS Settings — related options together, rarely used ones collapsed.
function screenSettings() {
  const s = db.settings;
  const wi = weekInfo(db);
  // Options that only apply to the original sample plan.
  const legacy = Object.values(db.plan).some((d) => d.items?.some((i) => i.role === 'rowCompound' || i.exerciseId === 'iso-row'));
  const p = db.profile;
  return `<header class="top"><button class="back" data-a="settings-back" aria-label="Back">${icon('left')}</button><h1 class="grow">Settings</h1></header>

    <h2 class="group-title">Profile</h2>
    <div class="list-group">
      <button class="list-row" data-a="open-builder"><span class="row-icon accent" aria-hidden="true">${icon('sparkle')}</span>
        <span class="grow"><b>Plan builder</b><span class="pick-sub">${p ? `${EXPERIENCE[p.experience]?.label || ''} · ${p.liftDays} lifting days · built ${new Date(p.builtAt).toLocaleDateString()}` : 'Not set up yet'}</span></span>${icon('right', 'chev')}</button>
    </div>

    <h2 class="group-title">Training</h2>
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
      <div class="field"><span>Progression ${helpBtn()}</span><p class="help-text" hidden>How your lifts move forward. The two strength options apply to your focus lifts; everything else adds reps, then weight.</p>
        <div class="segmented small-seg wrap-seg" role="radiogroup" aria-label="Progression">${Object.entries(PROGRESSIONS).map(([k, v]) => `<button class="${(s.progression || 'double') === k ? 'on' : ''}" data-a="set-progression" data-v="${k}" role="radio" aria-checked="${(s.progression || 'double') === k}">${v.name}</button>`).join('')}</div>
        <p class="muted small">${PROGRESSIONS[s.progression || 'double'].desc}${recommendProgression(db.profile) === (s.progression || 'double') ? ' Recommended for your goals.' : ` For your goals: ${PROGRESSIONS[recommendProgression(db.profile)].name.toLowerCase()}.`} ${refChips(['acsm2009', 'rippetoe2011', 'wendler2009', 'williams2017'])}</p></div>
      <label class="toggle"><input type="checkbox" data-a="set-extra" data-k="warmupRoutine" ${s.warmupRoutine ? 'checked' : ''}><span>Warm-up routine before lifting</span></label>
      <label class="toggle"><input type="checkbox" data-a="set-extra" data-k="cooldownRoutine" ${s.cooldownRoutine ? 'checked' : ''}><span>Cool-down stretch after lifting</span></label>
      <div class="field"><span>Core</span>
        <div class="segmented small-seg wrap-seg" role="radiogroup" aria-label="Core placement">${Object.entries(CORE_PLACEMENTS).map(([k, v]) => `<button class="${(s.corePlacement || 'end') === k ? 'on' : ''}" data-a="set-core" data-v="${k}" role="radio" aria-checked="${(s.corePlacement || 'end') === k}">${v.name}</button>`).join('')}</div>
        <p class="muted small">${CORE_PLACEMENTS[s.corePlacement || 'end'].desc} ${refChips(['mcgill2010', 'hibbs2008', 'granata2008'])}</p></div>
      <div class="field"><span>Exercise variety</span>
        <div class="segmented small-seg" role="radiogroup" aria-label="Exercise variety">${Object.entries(VARIETY).map(([k, v]) => `<button class="${(s.variety || 'low') === k ? 'on' : ''}" data-a="set-variety" data-v="${k}" role="radio" aria-checked="${(s.variety || 'low') === k}">${v.name}</button>`).join('')}</div>
        <p class="muted small">${VARIETY[s.variety || 'low'].desc} ${refChips(['kassiano2022', 'bazvalle2019'])}</p></div>
      <label class="toggle"><input type="checkbox" data-a="set-warmups" ${s.warmups ? 'checked' : ''}><span>Warm-up sets on the first main lift</span></label>
      <label class="toggle"><input type="checkbox" data-a="set-autoadvance" ${s.autoAdvance !== false ? 'checked' : ''}><span>Auto-advance in supersets</span></label>
      <label class="toggle"><input type="checkbox" data-a="set-ramp" ${s.rampEffort ? 'checked' : ''}><span>Ramp effort through each block (reps in reserve 3 → 1)</span></label>
      <label class="toggle"><input type="checkbox" data-a="sound" ${s.sound ? 'checked' : ''}><span>Beep when rest ends</span></label>
      ${legacy ? `<details class="sub-details"><summary>Sample-plan options</summary>
        <div class="field"><span>Thursday row compound</span><div class="row between"><b>${esc(db.exercises[ROW_ROTATION[s.rowRotation % 3]].name)}</b><button class="mini" data-a="rotate-yes">Rotate now</button></div></div>
        <label class="toggle"><input type="checkbox" data-a="race" ${s.raceBlock ? 'checked' : ''}><span>Race block (deadlift moves to Monday, RDL on Friday, no glute ham raises)</span></label>
      </details>` : ''}
      <details class="sub-details"><summary>Weight jumps for new exercises</summary>
        <div class="grid2">${Object.entries(TYPES).map(([k, v]) => `<div class="field"><span>${v} (lb)</span><input type="text" inputmode="decimal" data-a="def-inc" data-k="${k}" value="${s.defaultIncrements[k]}"></div>`).join('')}</div>
        <button class="btn block" data-a="apply-inc">Apply to all existing exercises</button>
      </details>
    </div>

    <h2 class="group-title">Gym & equipment</h2>
    ${extras.gymCard()}

    <h2 class="group-title">Appearance</h2>
    <div class="card">
      <div class="segmented small-seg" role="radiogroup" aria-label="Theme">${['dark', 'light', 'system'].map((t) => `<button class="${s.theme === t ? 'on' : ''}" data-a="theme" data-v="${t}" role="radio" aria-checked="${s.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <p class="muted small">Text follows your iPhone's text size (Settings → Display & Brightness → Text Size).</p>
    </div>

    <h2 class="group-title">Apple Health</h2>
    <div class="list-group"><button class="list-row" data-a="health-setup"><span class="grow">Set up the Lift to Health shortcut<span class="pick-sub">Sends each workout's calories to Health</span></span>${icon('right', 'chev')}</button>${db.settings.healthSetupHidden ? '<button class="list-row" data-a="health-reset"><span class="grow">Show setup steps again</span></button>' : ''}</div>

    <h2 class="group-title">Share</h2>
    <div class="list-group"><button class="list-row" data-a="open-share"><span class="grow">Share app</span>${icon('right', 'chev')}</button></div>

    <h2 class="group-title">Data & security</h2>
    ${cloud.card()}
    ${extras.dataCard()}

    <h2 class="group-title">Reset</h2>
    <div class="list-group">
      <button class="list-row" data-a="reset-plan"><span class="grow">Restore the sample plan</span></button>
      <button class="list-row danger-row" data-a="reset-all"><span class="grow">Erase all data</span></button>
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
const pain = createPain(ctx);
const train = createTrain(ctx);
const focusUi = createFocus(ctx);
const exEditor = createExerciseEditor(ctx);
const planTools = createPlanTools(ctx);
const health = createHealth(ctx);

// ---------- Render ----------

const TABS = [
  ['today', 'Train', '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'],
  ['plan', 'Plan', '<path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/>'],
  ['food', 'Food', '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>'],
  ['progress', 'Progress', '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>'],
];
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/></svg>';
const MAIN_SCREENS = ['today', 'plan', 'food', 'history', 'body'];

function progressTabs() {
  const t = ui.tab === 'body' ? 'body' : 'history';
  return `<div class="segmented" role="tablist" aria-label="Progress view">
    <button class="${t === 'history' ? 'on' : ''}" data-a="progress-view" data-v="history" role="tab" aria-selected="${t === 'history'}">Training</button>
    <button class="${t === 'body' ? 'on' : ''}" data-a="progress-view" data-v="body" role="tab" aria-selected="${t === 'body'}">Body</button>
  </div>`;
}

function render() {
  if (!db) return;
  const screens = {
    today: screenToday, summary: screenSummary, history: screenHistory, body: screenBody, food: () => food.screen(),
    plan: screenPlan, settings: screenSettings, builder: screenBuilder, 'edit-session': screenEditSession, exercise: screenExercise,
  };
  // Workout view: once a workout starts, Train and the exercise screen drop the tab bar and extras.
  if (!db.activeSession) ui.peek = false;
  const inWorkout = !!db.activeSession && ['today', 'exercise'].includes(ui.tab) && !ui.peek;
  document.body.classList.toggle('in-workout', inWorkout);
  $('#main').innerHTML = (screens[ui.tab] || screenToday)();
  // Elsewhere in the app mid-workout: a pill to get back.
  if (db.activeSession && !['today', 'exercise', 'summary'].includes(ui.tab)) $('#main').insertAdjacentHTML('beforeend', '<button class="back-to-workout" data-a="back-to-workout">Back to workout</button>');
  refreshRecovery();
  // Settings is reached from a gear in the header of each main screen.
  const header = $('#main header.top');
  if (header && MAIN_SCREENS.includes(ui.tab) && !(ui.tab === 'history' && ui.historyEx)) {
    header.insertAdjacentHTML('beforeend', `<button class="icon-btn" data-a="open-settings" aria-label="Settings">${GEAR}</button>`);
  }
  const active = { exercise: 'today', summary: ui.summaryFresh ? 'today' : 'progress', builder: 'plan', 'edit-session': 'progress', history: 'progress', body: 'progress', settings: ui.prevTab === 'history' || ui.prevTab === 'body' ? 'progress' : ui.prevTab }[ui.tab] || ui.tab;
  $('#tabs').innerHTML = TABS.map(([k, label, icon]) => `
    <button class="tab ${k === active ? 'on' : ''}" data-a="tab" data-tab="${k}" aria-current="${k === active ? 'page' : 'false'}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span>
    </button>`).join('');
  renderRest();
}

// ---------- Events ----------

const actions = {
  tab: (d) => { if (d.tab === 'today') ui.peek = false; if (!$('#sheet').hidden) closeSheet(); ui.summaryFresh = false; ui.selecting = false; ui.tab = d.tab === 'progress' ? ui.progressTab || 'history' : d.tab; if (d.tab === 'today') ui.summaryId = null; if (d.tab === 'history') ui.historyEx = null; window.scrollTo(0, 0); render(); },
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
  'cardio-toggle': (d) => { (ui.cardioOpen ||= {})[d.day] = d.open !== '1'; render(); },
  'ex-toggle': (d) => { (ui.exOpen ||= {})[d.uid] = d.open !== '1'; render(); },
  'start-workout': () => { ensureSession(ui.day); render(); toast('Workout started. Tap the check as you finish each set.'); },
  'open-settings': () => { ui.prevTab = ui.tab; ui.tab = 'settings'; window.scrollTo(0, 0); render(); },
  'settings-back': () => { ui.tab = ui.prevTab || 'today'; window.scrollTo(0, 0); render(); },
  'progress-view': (d) => { ui.tab = d.v; ui.progressTab = d.v; ui.historyEx = null; render(); },
  'start-empty': () => { if (db.activeSession) return toast('Finish or discard the current workout first.'); startSession(ui.day, true); render(); openPicker({ mode: 'session-add' }); },
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
      const v = k === 'reps' ? parseInt(el.value, 10) : parseFloat(el.value);
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
    if (v2 != null) vals[d.k2] = v2;
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
  'select-mode': () => { ui.selecting = !ui.selecting; ui.selected = new Set(); render(); },
  'link-selected': () => {
    linkUids([...ui.selected]);
    const n = ui.selected.size;
    ui.selecting = false; ui.selected = new Set();
    persist(); render(); toast(`Linked as a ${n > 2 ? 'circuit' : 'superset'}.`);
  },
  'unlink-selected': () => { unlinkUids([...ui.selected]); ui.selecting = false; ui.selected = new Set(); persist(); render(); toast('Unlinked.'); },
  'link-next': (d) => {
    const items = todayItems();
    const i = items.findIndex((x) => x.uid === d.uid);
    const grp = groupsOf(items).find((g) => g.items.some((x) => x.uid === items[i + 1]?.uid));
    const uids = [d.uid, ...(grp ? grp.items.map((x) => x.uid) : [items[i + 1].uid])];
    if (!$('#sheet').hidden) closeSheet();
    linkUids(uids); persist(); render(); toast('Linked with the next exercise.');
  },
  'unlink-one': (d) => { if (!$('#sheet').hidden) closeSheet(); unlinkUids([d.uid]); persist(); render(); toast('Unlinked.'); },
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
    toast(`Drop set added at ${w} lb. Go straight into it after your last set.`);
  },
  'extra-toggle': (d) => {
    const cur = dayExtras(db, d.day)[d.k];
    setDayExtra(db, d.day, d.k, !cur);
    persist(); render();
  },
  'set-progression': (d) => { db.settings.progression = d.v; persist(); render(); toast(d.v === 'double' ? 'All lifts: add reps, then weight.' : 'Applies to your focus lifts. Other lifts keep adding reps, then weight.'); },
  'set-extra': (d, el) => { db.settings[d.k] = el.checked; persist(); render(); },
  'ex-more': (d) => openExerciseSheet(d.uid),
  'day-options': () => openDayOptions(),
  'day-mode-today': (d) => { db.settings.dayModes[ui.day] = d.v; persist(); render(); openDayOptions(); },
  'ex-note-save': (d) => { const sx = ensureSession(ui.day); if (!sx) return; sx.entries[d.uid].note = $('#ex-note').value.trim(); persist(); closeSheet(); render(); toast('Note saved.'); },
  'ex-move': (d) => {
    // Move past a whole neighbouring group so supersets stay together.
    const sx = ensureSession(ui.day);
    if (!sx) return; const o = sx.order; const i = o.indexOf(d.uid);
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
    if (!sessionFor(ui.day)) {
      if (d.uid.startsWith('warmup-') || d.uid.startsWith('cooldown-')) return toast('Turn the warm-up or cool-down off with its button above the list.');
      adjustDay(db, ui.day, { minutes: weekOverride(db, ui.day)?.minutes || null, gymId: weekOverride(db, ui.day)?.gymId || null });
      const o = db.week.days[ui.day];
      o.items = o.items.filter((i) => i.uid !== d.uid);
      if (o.base) o.base = o.base.filter((i) => i.uid !== d.uid);
      persist(); closeSheet(); render();
      return toast('Removed for this week. Your plan is unchanged.');
    }
    const sx = ensureSession(ui.day);
    if (!sx) return; const e = sx.entries[d.uid];
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
  'welcome-sample': () => { db.settings.welcomed = true; applyCore(db, 'end'); persist(); render(); },
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
    const hr = Math.round(num('c-hr') || 0);
    if (hr >= 60 && hr <= 220) entry.hr = hr;
    if (sheetState.rpe != null) entry.rpe = sheetState.rpe;
    const note = $('#c-note').value.trim();
    if (note) entry.note = note;
    db.cardio.push(entry);
    persist(); closeSheet(); render(); haptic();
    toast(`Logged ${CARDIO[d.id].name}, ${minutes} min · ~${Math.round(cardioBurn(db, entry, CARDIO[d.id]).active)} kcal.`);
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
  'plan-del': (d) => {
    if (!$('#sheet').hidden) closeSheet();
    const it = db.plan[ui.planDay].items;
    const ex = db.exercises[it[+d.i].exerciseId];
    if (!confirm(`Remove ${ex?.name} from ${DAY_NAMES[ui.planDay]}? Its history is kept.`)) return;
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
  pick: (d) => {
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
      && !confirm(`Keep your logged ${db.exercises[entry.exerciseId].name} sets and add ${ex.name} after them?`)) return;
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

Object.assign(actions, food.actions, year.actions, extras.actions, cloud.actions, pain.actions, train.actions, focusUi.actions, exEditor.actions, planTools.actions, health.actions);

onReorder('session', (uid, to) => {
  const { list, save } = editableList();
  const it = list.find((x) => x.uid === uid);
  if (!it) return;
  const rest = list.filter((x) => x !== it);
  rest.splice(to, 0, it);
  save(rest);
  persist(); render();
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
    const v = k === 'reps' ? parseInt(el.value, 10) : parseFloat(el.value);
    if (w?.[+i] && Number.isFinite(v)) { w[+i][k] = v; persist(); }
    return;
  }
  if (el.dataset?.set) {
    const [uid, i, k] = el.dataset.set.split(':');
    const sx = ensureSession(ui.day);
    if (!sx) return;
    const entry = sx.entries[uid];
    const v = k === 'reps' ? parseInt(el.value, 10) : parseFloat(el.value);
    if (!entry || !Number.isFinite(v)) return;
    entry.sets[+i][k] = v;
    if (k === 'weight' && entry.scheme !== 'wave') {
      for (let j = +i + 1; j < entry.sets.length; j++) {
        if (entry.sets[j].done || entry.sets[j].type === 'd') continue;
        entry.sets[j].weight = entry.dropSet ? Math.max(0, v - 10 * (j - +i)) : v;
        const cell = document.querySelector(`[data-set="${uid}:${j}:weight"]`);
        if (cell) cell.value = entry.sets[j].weight;
      }
    }
    persist();
    return;
  }
  if (el.id === 'session-note') { const sx = db.sessions.find((x) => x.id === el.dataset.sid); if (sx) { sx.note = el.value.trim(); persist(); } return; }
  if (el.dataset?.bgoal && ui.b) { render(); return; }
  if (a === 'pk-muscle') { picker.muscle = el.value; renderPickerList(); return; }
  if (a === 'b-mgoal') { const mg = (ui.b.draft.muscleGoals ||= {}); if (el.value) mg[el.dataset.g] = el.value; else delete mg[el.dataset.g]; return; }
  if (a === 'b-main') { (ui.b.draft.mainLift ||= {})[el.dataset.k] = el.value; render(); return; }
  if (a === 'pe-ex') { $('#pe-new').hidden = el.value !== '__new'; fillMeta(el.value); return; }
  if (a === 'plan-name') { db.plan[ui.planDay].name = el.value.trim() || db.plan[ui.planDay].name; persist(); return; }
  if (a === 'def-inc') { const v = parseFloat(el.value); if (v > 0) { db.settings.defaultIncrements[el.dataset.k] = v; persist(); } return; }
  if (el.type === 'checkbox' && actions[a]) actions[a](el.dataset, el);
});

document.addEventListener('input', (e) => {
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
  try { db = await loadDb(); } catch (e) {
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
  // Reopened mid-workout (even after the app was fully closed): go straight back to it.
  if (db.activeSession) { ui.day = db.activeSession.day; ui.tab = 'today'; render(); setTimeout(() => toast('Workout resumed where you left off.'), 400); }
  // Existing plans: core placement starts at the default once.
  if (db.settings.welcomed && !db.settings.corePlacement) { applyCore(db, 'end'); persist(); render(); }
  initSwipe();
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
