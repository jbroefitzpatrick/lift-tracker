// Train tab and workouts: today's list, the exercise screen with its set rows, the summary, and editing a past workout.
// Split out of app.js. App state and the helpers this needs come from A: live getters (and
// setters for variables), so db and the rest stay shared with app.js.
import { isMeetDay } from './event-plan.js';
import { addDays, dateOfDay, mondayOf, parseDate, todayStr, weekOrder, weekPos } from './store.js';
import { currentFatigue, dayMode, freshness, liftLoads } from './fatigue.js';
import { DAY_KEYS, DAY_NAMES, dayKeyOf, dayPlan, evaluate, groupNum, needsRotationPrompt, nextRowCompound, resolveDay, targetsFor, weekInfo, weekOverride } from './engine.js';
import { cooldownItems, dayExtras, extraStored, warmupItems, warmupMinutes } from './warmcool.js';
import { EX_INFO } from './exercise-info.js';
import { bodyPair, muscleIcon, MUSCLE_NAMES } from './body.js';
import { PHASE_TYPES, activePhase } from './year.js';
import { icon } from './icons.js';
import { estimateMinutes, volumeTarget } from './builder.js';
import { activeGym, isAvailable, plateText, roundToGym, warmupSets } from './gym.js';
import { GROUPS, groupById, groupFreshness, groupOfMuscle, weeklySets as setsByPart } from './groups.js';
import { METRIC_FIELDS, fmtTarget } from './conditioning.js';
import { VARIETY } from './variety.js';
import { CATEGORIES, METRICS, MUSCLES, sideNote, loadNote } from './bank.js';
import { fromDisp, toDisp, wUnit } from './units.js';
import { addOptions, muscleWork } from './review.js';
import { workoutBurn, workoutMinutes } from './energy.js';
import { detectPRs } from './records.js';
import { peakWeek } from './maxes.js';
import { familyDisc, loadSetup } from './equipment.js';

export function createWorkoutScreens(A) {
  // ---------- Screens: Today ----------

  function dayTabs(current, action, days = weekOrder()) {
    const today = A.defaultDay();
    const mon = mondayOf(todayStr());
    return `<div class="day-strip" role="tablist" aria-label="Day of the week">${days.map((d) => {
      const iso = addDays(mon, weekPos(d));
      const date = parseDate(iso).getDate();
      const mode = dayMode(A.db, d);
      const done = A.db.sessions.some((x) => x.date === iso);
      return `<button class="day ${d === current ? 'on' : ''} ${d === today ? 'is-today' : ''}" data-a="${action}" data-day="${d}" role="tab" aria-selected="${d === current}"
        aria-label="${A.FULL_DAY[d]} ${date}, ${A.MODE_LABELS[mode]} day${d === today ? ', today' : ''}">
        <span class="d-name">${DAY_NAMES[d][0]}</span><span class="d-dot m-${mode} ${done ? 'done' : ''}" aria-hidden="true"></span></button>`;
    }).join('')}</div>`;
  }

  // Reps-in-reserve target for this week of the block: starts around 3 and tightens toward the
  // lifter's usual effort just before the deload (block-periodized effort).
  function rirTarget(wi) {
    if (!A.db.settings.rampEffort) return null;
    if (wi.isDeload) return null;
    const end = Math.max(0, A.db.settings.rampEnd ?? A.db.profile?.rx?.rirLo ?? 1);
    const start = Math.max(end + 1, A.db.settings.rampStart ?? 3);
    const work = Math.max(2, wi.cycleLen - 1);
    const v = Math.round(start - ((start - end) * (wi.cyclePos - 1)) / (work - 1));
    return String(Math.max(end, Math.min(start, v)));
  }

  // On cardio days only the plan's conditioning work is on; lifting stays parked for when the day switches back.
  function plannedFor(day) {
    return plannedRaw(day).map((it) => {
      const ex = A.db.exercises[it.exerciseId];
      if (!ex) return it;
      const metric = A.metricOf(it);
      if (metric === 'reps' && ex.category !== 'conditioning') return it.metric && it.metric !== 'reps' ? { ...it, metric: undefined } : it;
      return metric === it.metric && it.target != null ? it : { ...it, metric, target: A.targetOf(it, metric) };
    });
  }

  function plannedRaw(day) {
    const items = resolveDay(A.db, day);
    const lifts = items.filter((i) => i.ex.category !== 'conditioning');
    if (lifts.length && dayMode(A.db, day) !== 'cardio') {
      const x = dayExtras(A.db, day);
      const order = A.db.plan[day]?.extraOrder || {};
      const sorted = (list, k) => (order[k] && !extraStored(A.db, day, k) ? [...list].sort((a, b) => rank(order[k], a.uid) - rank(order[k], b.uid)) : list);
      return [...(x.warm ? sorted(warmupItems(A.db, day, lifts), 'warmup') : []), ...items, ...(x.cool ? sorted(cooldownItems(A.db, day, lifts), 'cooldown') : [])];
    }
    if (dayMode(A.db, day) !== 'cardio') return items;
    return items.filter((i) => A.db.exercises[i.exerciseId]?.category === 'conditioning');
  }

  const rank = (order, uid) => { const i = order.indexOf(uid); return i < 0 ? 999 : i; };

  // The day's exercises in display order: the session once started, otherwise the plan.
  function todayItems(day = A.ui.day) {
    const session = A.sessionFor(day);
    const planned = plannedFor(day);
    if (!session) return planned;
    const items = session.freestyle ? [] : planned;
    A.syncSession(session, items);
    return A.sessionItems(session, items);
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
  const repsLabel = (ex, word = 'Reps') => (sideNote(ex) ? `${word} ${sideNote(ex)}` : word);
  const unitLabel = (ex) => (loadNote(ex) ? `${wUnit()} ${loadNote(ex)}` : wUnit());

  function thumb(ex) {
    const img = EX_INFO[ex.id]?.images?.[0];
    return img
      ? `<img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fb='${muscleIcon(ex.primary[0] || 'chest').replace(/'/g, '&#39;')}'>`
      : muscleIcon(ex.primary[0] || 'chest');
  }

  // A plan made today on a day without lifting: the first workout, and the option to do it now.
  function planReadyCard() {
    const order = weekOrder();
    const t = order.indexOf(dayKeyOf(todayStr()));
    const lifts = order.filter((d) => A.db.plan[d]?.items?.some((i) => A.db.exercises[i.exerciseId]?.category !== 'conditioning') && ['lift', 'both'].includes(A.db.settings.dayModes?.[d] || 'lift'));
    const next = lifts.find((d) => order.indexOf(d) > t) || lifts[0];
    if (!next) return '';
    const thisWeek = order.indexOf(next) > t;
    return `<section class="start-card">
        <h2>Your plan is ready</h2>
        <button class="start-opt primary" data-a="plan-first-today" data-day="${next}"><b>Do ${A.esc(A.db.plan[next].name)} today</b><span>Your first workout is ${thisWeek ? '' : 'next '}${A.FULL_DAY[next]}. Start now instead; the rest of the week stays the same.</span></button>
        <button class="start-opt" data-a="tab" data-tab="plan"><b>See your week</b><span>${lifts.length} lifting days. Change days, exercises or time any time.</span></button>
      </section>`;
  }

  // No plan yet (a new install): two ways to start, nothing else.
  function startScreen() {
    const first = !A.db.settings.welcomed;
    return `<header class="top"><div class="grow"><h1>${first ? 'Welcome to ProFitz (working title)' : 'Train'}</h1><p class="subtitle">${first ? 'Plan your training and log every set' : 'No plan yet'}</p></div>
        <button class="icon-btn" data-a="open-settings" aria-label="Settings">${icon('gear')}</button></header>
      <section class="start-card">
        <h2>${first ? 'How would you like to start?' : 'Ready when you are'}</h2>
        <button class="start-opt primary" data-a="quick-build"><b>Build my plan</b><span>A few quick questions: goal, experience, days a week and equipment. Starting weights fit you.</span></button>
        <button class="start-opt" data-a="quick-start"><b>Pick a ready-made plan</b><span>Full body, upper and lower, push pull legs, dumbbells only or no equipment.</span></button>
        <button class="start-opt" data-a="start-empty"><b>Start an empty workout</b><span>Add exercises as you go. The app learns your weights from what you log.</span></button>
      </section>
      ${first ? '<p class="muted small center pad">Use ProFitz (working title) on another phone? <button class="text-link" data-a="open-settings" data-page="account">Sign in to sync</button></p>' : ''}`;
  }

  function screenToday() {
    const day = A.ui.day;
    const wi = weekInfo(A.db);
    const session = A.sessionFor(day);
    if (!session && !A.db.activeSession && !Object.keys(A.db.plan || {}).length) return startScreen();
    const other = A.db.activeSession && A.db.activeSession.day !== day ? A.db.activeSession : null;
    const isDeload = A.isDeloadFor(day);
    const mode = dayMode(A.db, day);
    const ph = activePhase(A.db);
    const rir = rirTarget(wi);
    const title = session?.freestyle ? 'Workout'
      : dayPlan(A.db, day) && (mode === 'lift' || mode === 'both' || session) ? A.esc(dayPlan(A.db, day).name) : `${A.MODE_LABELS[mode]} day`;
    const dateLabel = parseDate(dateOfDay(day)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const subtitle = [
      dateLabel,
      !Object.keys(A.db.plan || {}).length ? '' : `<button class="sub-link" data-a="explain-week">${A.db.settings.deloadOff ? `Week ${wi.week}` : `Week ${wi.cyclePos} of ${wi.cycleLen}${wi.isDeload ? ' (deload)' : ''}`}</button>`,
      ph ? `${PHASE_TYPES[ph.phase.type].label}, week ${ph.weekInPhase}` : '',
      A.db.peak && peakWeek(A.db) ? `<button class="sub-link" data-a="peak-open">${peakWeek(A.db).test ? 'Test week' : `Peak ${peakWeek(A.db).idx + 1} of ${peakWeek(A.db).total}`}</button>` : '',
    ].filter(Boolean).join(' · ');
    let html = `
      <header class="top">
        <div class="grow"><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>
        <button class="icon-btn" data-a="day-options" aria-label="More: day options, recovery, settings">${icon('more')}</button>
      </header>
      ${session ? '' : dayTabs(day, 'day')}`;
    if (session) html = workoutBar(session) + html;

    if (A.ui.saveBlocked) html += A.saveBlockedBanner();
    // Pain always shows; of the other prompts, only one at a time (the rest wait their turn).
    if (!session) html += A.pain.todayCard(); // during a workout, pain shows on the exercises it affects
    // None while a workout is open: that screen is for logging.
    if (!session && day === dayKeyOf(todayStr())) html += A.doneTodayCard(day);
    // The day a plan is made: nothing but the plan (no check-ins, reviews or reminders yet).
    const planDay0 = A.db.settings.planSince === todayStr() && day === dayKeyOf(todayStr());
    const banner = !session && !planDay0 ? [A.peopleOn() ? A.people.togetherBanner(dateOfDay(day)) : '', A.train.recoveryCheck(), A.skippedPrompt(day), A.train.weekPrompt(), A.extras.backupBanner(), A.db.settings.welcomed ? A.train.installHint() : ''].filter(Boolean)[0] || '' : '';
    html += banner;
    html += A.blockCheckinBanner();
    if (needsRotationPrompt(A.db)) {
      const nextId = nextRowCompound(A.db);
      html += `<div class="notice-card">
        <p><b>Deload complete.</b> Rotate Thursday's row to ${A.esc(A.db.exercises[nextId].name)}?</p>
        <div class="row"><button class="btn primary" data-a="rotate-yes">Rotate</button><button class="btn" data-a="rotate-no">Keep current</button></div>
      </div>`;
    }
    if (other) {
      html += `<div class="notice-card">
        <p>Your ${A.FULL_DAY[other.day]} workout is still open.</p>
        <div class="row"><button class="btn primary" data-a="day" data-day="${other.day}">Resume</button><button class="btn" data-a="discard">Discard</button></div>
      </div>`;
    }

    // Cardio-only and rest days (an unfinished workout still shows so it can be finished).
    const condOnly = !session && mode !== 'rest' && resolveDay(A.db, day).some((i) => i.ex.category === 'conditioning');
    if (!session && !condOnly && !isMeetDay(A.db, day) && (!dayPlan(A.db, day) || mode === 'cardio' || mode === 'rest')) {
      if (planDay0) return html + planReadyCard();
      html += A.train.recoveryCards(day, []);
      if (!banner) html += A.train.recoveryReminder(day, mode);
      html += `<button class="add-workout-big" data-a="add-workout" data-day="${day}"><span class="aw-plus">${icon('plus')}</span><span class="grow"><b>Add a workout</b><span>Cardio, mobility, lifting, or build your own</span></span></button>`;
      html += A.cardioSection(day, mode === 'rest' ? 'Recovery' : 'Cardio', mode !== 'rest');
      return html;
    }

    const items = todayItems(day);
    if (session && session.date !== todayStr()) html += `<div class="notice-card"><p>This workout was started on ${A.fmtDate(session.date)}. Finish or discard it to start a new one.</p></div>`;

    html += A.train.recoveryCards(day, items);
    if (!banner) html += A.train.recoveryReminder(day, mode);

    // Overview: what's ahead, or progress once started.
    const counts = items.map((i) => {
      const e = session?.entries[i.uid];
      if (e) return { total: e.pain ? e.sets.filter((s) => s.done).length : e.sets.length, done: e.sets.filter((s) => s.done).length };
      return { total: targetsFor(A.db, i, isDeload).sets, done: 0 };
    });
    const allCond = items.length > 0 && items.every((i) => A.db.exercises[i.exerciseId]?.category === 'conditioning');
    const total = counts.reduce((a, c) => a + c.total, 0);
    const done = counts.reduce((a, c) => a + c.done, 0);
    const est = estimateMinutes(items.map((i, k) => ({ group: i.group, sets: counts[k].total || i.sets, restSec: i.restSec, metric: i.metric, target: i.target, paceSec: i.paceSec })));
    const left = Math.max(0, Math.round(est * (1 - (total ? done / total : 0))));
    if (items.length) {
      html += session
        ? ''
        : `<div class="day-meta"><button class="day-line" data-a="day-edit" data-day="${day}" aria-label="Time, gym, warm-up and cool-down for this workout"><span class="grow"><b>${est} min</b> · ${A.esc(A.db.gyms.find((g) => g.id === weekOverride(A.db, day)?.gymId)?.name || activeGym(A.db).name)}${dayExtras(A.db, day).warm ? ' · warm-up' : ''}${isDeload ? ' · deload' : ''}</span>
            ${icon('down')}</button>${readyChip(items)}</div>
          <button class="cta" data-a="start-workout">Start workout</button>`;
      if (!session && A.ui.showMuscles) html += targetMuscles(items, true);
    }

    // Exercise list
    const selecting = !!A.ui.selecting;
    const sel = A.ui.selected || new Set();
    html += `<div class="list-head">
      <h2>${items.length} exercise${items.length === 1 ? '' : 's'}</h2>
      <div class="row">
        ${items.length > 1 ? `<button class="link-btn" data-a="select-mode">${selecting ? 'Done' : 'Arrange'}</button>` : ''}
        <button class="icon-btn accent" data-a="today-add" aria-label="Add exercise">${icon('plus')}</button>
      </div>
    </div>`;
    if (selecting) html += `<p class="muted small">Select to link as a superset, or drag to reorder. ${session ? 'Today only.' : `Applies every ${A.FULL_DAY[day]}.`}</p>`;
    // The exercise you're on: the last one opened if it has sets left, else the first with sets left.
    A.ui.nextUid = session ? ((A.ui.exUid && items.find((i) => i.uid === A.ui.exUid && setsLeft(session, i))) || items.find((i) => setsLeft(session, i)))?.uid : null;
    html += '<div class="ex-list">';
    let lastPhase = null;
    let linkN = 0;
    const warmOpen = A.ui.warmList ?? !!session;
    const warmItems = items.filter((x) => x.phase === 'warmup');
    for (const grp of groupsOf(items)) {
      const full = A.db.settings.listView === 'full' && !selecting;
      const rows = grp.items.map((i) => (full ? exerciseFull(i, session, isDeload) : exerciseRow(i, session, isDeload, selecting, sel))).join('');
      const phase = grp.items[0].phase || 'main';
      if (phase !== lastPhase && (phase !== 'main' || lastPhase)) html += `<h3 class="phase-h">${phase === 'warmup' ? `<button class="phase-toggle" data-a="warm-list" aria-expanded="${warmOpen}"><span>Warm-up</span><small>${warmItems.length} moves · about ${warmupMinutes(warmItems)} min ${warmOpen ? '▴' : '▾'}</small></button>${!session && warmOpen ? ' <button class="text-btn phase-act" data-a="warm-shuffle">Shuffle</button>' : ''}` : phase === 'cooldown' ? 'Cool-down' : 'Workout'}</h3>`;
      lastPhase = phase;
      if (phase === 'warmup' && !warmOpen) continue;
      if (grp.linked) {
        const restSec = Math.max(...grp.items.map((i) => i.restSec || 0));
        const letter = 'ABCDEFGH'[linkN++ % 8];
        html += `<section class="link-group" style="--g:'${letter}'" aria-label="${linkLabel(grp.items.length)} ${letter}">
          <div class="link-label"><b>${linkLabel(grp.items.length)} ${letter}</b>${restSec ? `<span>Rest ${A.fmtRest(restSec)} after each round</span>` : ''}</div>${rows}</section>`;
      } else html += rows;
    }
    html += '</div>';
    if (selecting) {
      html += `<div class="select-bar" role="toolbar" aria-label="Selection actions">
        <span class="muted small">${sel.size} selected</span>
        <button class="btn sm" data-a="list-undo" ${A.ui.undo?.length ? '' : 'disabled'}>Undo</button>
        <button class="btn sm" data-a="unlink-selected" ${sel.size ? '' : 'disabled'}>Unlink</button>
        <button class="btn sm primary" data-a="link-selected" ${sel.size < 2 ? 'disabled' : ''}>Link ${sel.size > 2 ? 'as circuit' : 'as superset'}</button>
      </div>`;
    }
    if (session?.freestyle && !items.length) html += '<p class="muted small center pad">Add exercises from the library to build this workout.</p>';

    if (session && mode !== 'both' && A.ui.workoutCardio !== day) { /* cardio stays out of the way during a workout */ } else if (session || mode === 'both') html += A.cardioSection(day, session ? 'Cardio' : 'Cardio after lifting', true);
    else if (A.ui.showCardio) html += A.cardioSection(day, 'Cardio', true);
    if (!session) html += `<div class="quick-log"><button class="chip" data-a="quick-log" data-day="${day}">${icon('plus')} Log cardio, yoga or mobility</button></div>`;

    if (session) {
      const has = (ph) => session.order.some((u) => session.entries[u]?.phase === ph);
      html += `<div class="finish-bar">
        <div class="add-row" role="group" aria-label="Add to this workout">
          ${!session.freestyle && !has('warmup') ? `<button class="chip" data-a="add-routine" data-k="warm">${icon('plus')} Warm-up</button>` : ''}
          <button class="chip" data-a="fin-open">${icon('plus')} Finisher</button>
          ${A.ui.workoutCardio !== day && mode !== 'both' ? `<button class="chip" data-a="add-cardio">${icon('plus')} Cardio</button>` : ''}
          ${!session.freestyle && !has('cooldown') ? `<button class="chip" data-a="add-routine" data-k="cool">${icon('plus')} Cool-down</button>` : ''}
        </div>
        ${session.pausedAt ? '<button class="btn primary block big" data-a="resume">Resume workout</button>' : ''}
        <div class="row">${session.pausedAt ? '' : '<button class="btn grow" data-a="pause">Pause</button>'}<button class="btn plain grow" data-a="discard">Discard</button></div>
      </div>`;
    }
    return html;
  }

  // The muscles today's exercises train, with how recovered each one is.
  function muscleTiles(items) {
    const loads = liftLoads(A.db, items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets || 3 })));
    const fresh = freshness(currentFatigue(A.db));
    return GROUPS.map((g) => {
      const used = g.muscles.filter((m) => (loads[m] || 0) >= 2);
      if (!used.length) return null;
      return { g, pct: Math.round(Math.min(...used.map((m) => fresh[m] ?? 1)) * 100) };
    }).filter(Boolean);
  }
  function readyChip(items) {
    const tiles = muscleTiles(items);
    if (!tiles.length) return '';
    const low = Math.min(...tiles.map((x) => x.pct));
    return `<button class="ready-chip ${low < 50 ? 'low' : low < 80 ? 'mid' : ''}" data-a="muscles-toggle" aria-expanded="${!!A.ui.showMuscles}" aria-label="Muscles for today: ${low}% recovered. Show details">${low}% ready</button>`;
  }
  function targetMuscles(items, open = false) {
    const loads = liftLoads(A.db, items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets || 3 })));
    const fresh = freshness(currentFatigue(A.db));
    // One tile per group, ordered by how much work it gets today.
    const tiles = GROUPS.map((g) => {
      const used = g.muscles.filter((m) => (loads[m] || 0) >= 2);
      if (!used.length) return null;
      const lead = used.sort((x, y) => (loads[y] || 0) - (loads[x] || 0))[0];
      return { g, lead, load: used.reduce((a, m) => a + loads[m], 0), pct: Math.round(Math.min(...used.map((m) => fresh[m] ?? 1)) * 100) };
    }).filter(Boolean).sort((x, y) => y.load - x.load);
    if (!tiles.length) return '';
    // Small body icons with names, scrolling sideways so a big day doesn't push the list down.
    const names = tiles.slice(0, 3).map((x) => x.g.name).join(', ');
    const low = Math.min(...tiles.map((x) => x.pct));
    const line = `<button class="muscle-line" data-a="muscles-toggle" aria-expanded="${!!A.ui.showMuscles}"><span class="grow"><b>${A.esc(names)}${tiles.length > 3 ? ` +${tiles.length - 3}` : ''}</b><span class="${low < 50 ? 'low' : low < 80 ? 'mid' : ''}"> · ${low === 100 ? 'fully recovered' : `${low}% recovered`}</span></span>${icon('down')}</button>`;
    const TILE = (g, lead, pct) => `<button class="target-tile" data-a="open-recovery" data-g="${g.id}" aria-label="${g.name}, ${pct}% recovered"><span class="tile-art">${muscleIcon(lead)}<span class="pct-badge ${pct < 50 ? 'low' : pct < 80 ? 'mid' : ''}">${pct}%</span></span><span class="tile-name">${g.name}</span></button>`;
    if (!A.ui.showMuscles && !open) return line;
    if (open) return `<div class="target-strip" role="group" aria-label="Muscles worked today">${tiles.map(({ g, lead, pct }) => TILE(g, lead, pct)).join('')}</div>`;
    return line + `<div class="target-strip" role="group" aria-label="Muscles worked today">${tiles.map(({ g, lead, pct }) => `<button class="target-tile" data-a="open-recovery" data-g="${g.id}" aria-label="${g.name}, ${pct}% recovered"><span class="tile-art">${muscleIcon(lead)}<span class="pct-badge ${pct < 50 ? 'low' : pct < 80 ? 'mid' : ''}">${pct}%</span></span><span class="tile-name">${g.name}</span></button>`).join('')}</div>`;
  }

  function exerciseRow(item, session, isDeload, selecting, sel) {
    const ex = item.ex;
    const { t, target, entry, sets, notices, conditioning, metric } = A.cardModel(item, session, isDeload);
    const doneN = sets.filter((s) => s.done).length;
    const allDone = entry && sets.length && doneN === sets.length;
    const reps = item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`;
    const weight = '';
    const showLoad = !conditioning && target != null && !ex.noLoad && ex.type !== 'bodyweight';
    const rowVal = conditioning ? [fmtTarget(metric, item.target), ''] : showLoad ? [toDisp(target), unitLabel(ex)] : [item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`, 'reps'];
    const meta = conditioning
      ? `${entry && doneN ? `${doneN} of ${sets.length} rounds` : `${t.sets} ${t.sets === 1 ? 'round' : 'rounds'}`} · ${fmtTarget(metric, item.target)}${item.restSec ? ` · rest ${A.fmtRest(item.restSec)}` : ''}`
      : entry && doneN ? `${doneN} of ${sets.length} sets${weight}`
        : t.setReps ? (t.setReps.every((r) => r === t.setReps[0]) ? `${t.setReps.length} × ${t.setReps[0]}${t.cycle?.amrap ? '+' : ''}` : `${t.setReps.join(' / ')}${t.cycle?.amrap ? '+' : ''} reps`) + (t.setWeights.every((w) => w === t.setWeights[0]) ? weight : ` · top set ${A.fmtW(t.weight, ex)}`)
          : t.scheme === 'linear' || t.scheme === 'stages' ? `${t.sets} × ${t.reps}${weight}` : `${t.sets} ${t.sets === 1 ? 'set' : 'sets'} · ${reps} ${repsLabel(ex, 'reps')}${weight}`;
    const checked = sel.has(item.uid);
    const isNext = session && item.uid === A.ui.nextUid;
    return `<div class="ex-item ${allDone ? 'is-done' : ''} ${checked ? 'is-selected' : ''} ${isNext ? 'is-next' : ''}" data-drag-item data-drag-press ${session || (item.phase || 'main') === 'main' ? 'data-drag-join' : ''} data-drag-list="session" data-drag-id="${item.uid}" ${session && !selecting ? `data-swipe="ex-remove" data-swipe-label="Remove" data-uid="${item.uid}"` : ''}>
      ${selecting ? `<label class="sel"><input type="checkbox" data-a="sel-toggle" data-uid="${item.uid}" ${checked ? 'checked' : ''} aria-label="Select ${A.esc(ex.name)}"></label>` : ''}
      <button class="ex-item-main" data-a="ex-open" data-uid="${item.uid}" ${selecting ? 'tabindex="-1"' : ''}>
        <span class="thumb">${thumb(ex)}${familyDisc(ex)}</span>
        <span class="grow">${isNext ? '<span class="eyebrow next">Up next</span>' : ''}<span class="ex-name2">${A.esc(ex.name)}</span><span class="ex-meta">${meta}</span>
          ${notices.length ? `<span class="row-notice ${notices[0][0]}">${A.esc(notices[0][1])}</span>` : ''}</span>
        ${allDone || selecting ? '' : `<span class="row-val">${rowVal[0]}${rowVal[1] ? `<small>${rowVal[1]}</small>` : ''}</span>`}
      </button>
      ${allDone ? `<span class="status-done" aria-label="Done">${icon('check')}</span>` : ''}
      ${selecting
        ? `<button class="drag-handle" data-drag-handle aria-label="Reorder ${A.esc(ex.name)} (arrow keys move it)">${A.GRIP}</button>`
        : `<button class="icon-btn plain" data-a="ex-sheet" data-uid="${item.uid}" aria-label="Options for ${A.esc(ex.name)}">${icon('more')}</button>`}
    </div>`;
  }

  // Expanded list (Strong/Hevy style): each exercise with its set table, logged without leaving the list.
  function exerciseFull(item, session, isDeload) {
    const ex = item.ex;
    const { t, entry, sets, notices, conditioning, metric } = A.cardModel(item, session, isDeload);
    const ended = entry?.pain;
    const fields = conditioning ? METRIC_FIELDS[metric] : null;
    const doneN = sets.filter((s) => s.done).length;
    return `<section class="ex-full ${doneN === sets.length && entry ? 'is-done' : ''}" aria-label="${A.esc(ex.name)}">
      <div class="ex-full-head">
        <button class="ex-item-main" data-a="ex-open" data-uid="${item.uid}"><span class="thumb sm">${thumb(ex)}</span>
          <span class="grow"><span class="ex-name2">${A.esc(ex.name)}</span>${notices.length ? `<span class="row-notice ${notices[0][0]}">${A.esc(notices[0][1])}</span>` : `<span class="ex-meta">${conditioning ? fmtTarget(metric, item.target) : `${item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`} reps`}${item.restSec ? ` · rest ${A.fmtRest(item.restSec)}` : ''}</span>`}</span></button>
        <button class="icon-btn plain" data-a="ex-sheet" data-uid="${item.uid}" aria-label="Options for ${A.esc(ex.name)}">${icon('more')}</button>
      </div>
      <div class="set-table" role="group" aria-label="Sets">${setHead(conditioning, fields, ex)}${conditioning ? condRows(item, sets, fields, metric, ended, A.train.condPlaceholder(item, ex, metric)) : liftRows(item, sets, ended, t, ex)}</div>
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
        <span class="grow"><b>${A.esc(i.ex.name)}</b><span class="pick-sub">${done ? `${done} of ${total} ${i.ex.category === 'conditioning' ? 'rounds' : 'sets'}` : `${total} ${i.ex.category === 'conditioning' ? (total === 1 ? 'round' : 'rounds') : (total === 1 ? 'set' : 'sets')}`}${linked ? ' · linked' : ''}</span></span>${icon('right', 'chev')}</button>`;
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
    const onExercise = A.ui.tab === 'exercise';
    return `<div class="workout-bar" role="group" aria-label="Workout in progress">
      ${onExercise ? `<button class="wb-back" data-a="ex-close" aria-label="Back to the whole workout">${icon('left')}<span>Workout</span></button>` : ''}
      <div class="wb-info"><b class="num" id="wb-time" data-start="${session.startedAt + (session.pausedMs || 0)}" ${session.pausedAt ? 'data-paused="1"' : ''}>${fmtElapsed((session.pausedAt || Date.now()) - session.startedAt - (session.pausedMs || 0))}</b><span class="muted small">${session.pausedAt ? 'Paused' : `${done} of ${total} sets`}</span></div>
      ${session.pausedAt ? '<button class="btn sm primary" data-a="resume">Resume</button>' : '<button class="btn sm primary" data-a="finish">Finish</button>'}
      <i class="wb-progress" style="width:${total ? (done / total) * 100 : 0}%" aria-hidden="true"></i>
    </div>`;
  }

  // The reasoning behind how a workout is put together, with sources.
  function openWhyWorkout() {
    const v = A.db.settings.variety || 'low';
    const row = (title, text, refs) => `<div class="why-row"><b>${title}</b><p class="muted small">${text} ${A.refChips(refs)}</p></div>`;
    A.openSheet(`<h2>Why it's built this way</h2>
      ${row('Big lifts first', 'Compound lifts come before accessories. Exercises done early in a workout get the best performance, so the ones that matter most go first.', ['simao2012'])}
      ${row('Rest by lift size', 'Two to three minutes on heavy compounds, 60–90 seconds on accessories. Longer rests on big lifts keep reps and load higher.', ['schoenfeld2016rest', 'grgic2018rest'])}
      ${row('Stop short of failure', 'Most sets end with a few reps in reserve. That builds as much muscle as going to failure with less fatigue, so you recover for the next session.', ['refalo2023'])}
      ${row('Add reps, then weight', 'Hit the top of the rep range on every set, then the weight goes up and reps reset. Small steady jumps beat big ones.', ['nsca2016'])}
      ${row('Enough weekly sets', 'Each muscle aims for roughly 10–20 hard sets a week, spread over the days you train.', ['schoenfeld2017vol'])}
      ${row(`Variety: ${VARIETY[v].name.toLowerCase()}`, `${VARIETY[v].desc} Rotating exercises can match fixed ones for growth and is more enjoyable, but constant change slows strength on specific lifts, so focus lifts never rotate. Change it in Settings → Training.`, ['fonseca2014', 'bazvalle2019', 'kassiano2022'])}
      <button class="btn block" data-a="close-sheet">Close</button>`);
  }

  // ---------- Exercise screen: log sets for one exercise ----------

  function screenExercise() {
    const day = A.ui.day;
    const session = A.sessionFor(day);
    const isDeload = A.isDeloadFor(day);
    const items = todayItems(day);
    const idx = items.findIndex((i) => i.uid === A.ui.exUid);
    if (idx < 0) { A.ui.tab = 'today'; return screenToday(); }
    const item = items[idx];
    const { ex, gym, t, target, entry, sets, notices, conditioning, metric } = A.cardModel(item, session, isDeload);
    const info = EX_INFO[ex.id] || {};
    const ended = entry?.pain;
    const fields = conditioning ? METRIC_FIELDS[metric] : null;
    const barbell = ex.type?.startsWith('barbell');
    const grp = groupsOf(items).find((g) => g.items.includes(item));
    const firstCompound = items.find((i) => i.ex.category === 'compound' && i.ex.type !== 'bodyweight');
    // Ramp-up sets: the full ramp for the day's first compound; a short one (about 60% and 80%) for
    // each later compound that starts a new movement pattern, since you're already warm by then.
    const newPattern = ex.category === 'compound' && ex.type !== 'bodyweight' && !items.slice(0, idx).some((i) => i.ex.category === 'compound' && i.ex.pattern === ex.pattern);
    const autoWarm = !A.db.settings.warmups || !target ? [] : item === firstCompound ? warmupSets(ex, target, gym) : newPattern ? warmupSets(ex, target, gym).slice(-2) : [];
    const warm = entry?.warm || item.warm || t.warm || autoWarm;
    const rir = rirTarget(weekInfo(A.db));
    const allDone = entry && sets.every((s) => s.done);
    const prev = items[idx - 1];
    // After an automatic move within a circuit, back returns to the exercise just done.
    const back = (A.ui.backUid && A.ui.backUid !== item.uid && items.find((i) => i.uid === A.ui.backUid)) || prev;
    const left = (i) => !session || setsLeft(session, i);
    const next = items.slice(idx + 1).find(left) || items.slice(0, idx).find(left) || null;
    const aim = conditioning ? `${t.sets} × ${fmtTarget(metric, item.target)}${item.restSec ? `, rest ${A.fmtRest(item.restSec)}` : ''}`
      : t.weight == null ? 'Pick a working weight to set your baseline'
      : t.aim ? t.aim
      : t.scheme === 'linear' ? `${t.sets} × ${t.reps} · complete every set to add weight next time`
      : t.total ? `Aim for ${t.reps}+ reps · beat ${t.total - 1} total` : `Aim for ${t.reps} ${repsLabel(ex, 'reps')}`;

    const rows = conditioning ? condRows(item, sets, fields, metric, ended, A.train.condPlaceholder(item, ex, metric)) : liftRows(item, sets, ended, t, ex);

    const prep = ['warmup', 'cooldown'].includes(item.phase || entry?.phase) || ['mobility', 'prehab'].includes(ex.pattern);
    const checkin = entry && allDone && !ended && !session.isDeload && !prep ? `<div class="checkin" role="group" aria-label="How did that feel">
      <span class="muted small">How did that feel?</span>
      <div class="seg-mini">${[['easy', 'Easy'], ['right', 'Right'], ['hard', 'Too hard']].map(([v, l]) => `<button class="${entry.feedback === v ? 'on' : ''}" data-a="fb" data-uid="${item.uid}" data-v="${v}" aria-pressed="${entry.feedback === v}">${l}</button>`).join('')}</div>
      <button class="text-btn" data-a="pain-report" data-uid="${item.uid}">Log pain</button>
    </div>` : '';

    const img = info.images?.[0];
    return `${session ? workoutBar(session) : ''}<div class="ex-screen">
      ${session ? '' : `<button class="text-btn station-back" data-a="ex-close">${icon('left')} Back</button>`}
      ${A.ui.heroBig && img ? `<button class="station-big ex-hero big" data-a="hero-toggle" aria-label="Make photo smaller"><img src="${img}" alt="${A.esc(ex.name)}" referrerpolicy="no-referrer"></button>` : ''}
      <div class="station-head">
        ${A.ui.heroBig && img ? '<span></span>' : `<button class="station-pic ex-hero" data-a="hero-toggle" aria-label="Enlarge photo">${thumb(ex)}${familyDisc(ex, 26)}</button>`}
        <div><h1>${A.esc(ex.name)}</h1>${muscleRow(ex)}
          <div class="ex-tools">
            <button class="tool-btn" data-a="ex-info" data-id="${ex.id}" aria-label="How-to">${icon('play')}<span>How-to</span></button>
            ${A.db.exCues?.[ex.id]?.length && A.db.settings.showCues !== false ? '' : `<button class="tool-btn" data-a="cues-open" data-id="${ex.id}" aria-label="Cues">${icon('bolt')}<span>Cues</span></button>`}
            ${A.db.exNotes?.[ex.id] ? '' : `<button class="tool-btn" data-a="ex-note" data-id="${ex.id}" aria-label="Note">${icon('note')}<span>Note</span></button>`}
          </div></div>
        <button class="station-more" data-a="ex-sheet" data-uid="${item.uid}" aria-label="More options">${icon('more')}</button>
      </div>
      ${A.db.exCues?.[ex.id]?.length && A.db.settings.showCues !== false ? `<button class="my-cues" data-a="cues-open" data-id="${ex.id}" aria-label="Your cues. Tap to edit"><ul>${A.db.exCues[ex.id].map((c) => `<li>${A.esc(c)}</li>`).join('')}</ul></button>` : ''}
      ${A.db.exNotes?.[ex.id] ? `<button class="ex-note" data-a="ex-note" data-id="${ex.id}">${icon('note')}<span>${A.esc(A.db.exNotes[ex.id])}</span></button>` : ''}
      ${grp.linked ? `<div class="group-note"><b>${linkLabel(grp.items.length)}</b>${entry ? (() => { const n = Math.max(...grp.items.map((i) => session.entries[i.uid]?.sets.length || i.sets)); const r = entry.sets.findIndex((x) => !x.done); return ` · round ${r < 0 ? entry.sets.length : r + 1} of ${n}`; })() : ''} · ${grp.items.map((i) => (i === item ? `<span class="cur">${A.esc(i.ex.name)}</span>` : A.esc(i.ex.name))).join(' → ')}</div>` : ''}
      ${dialBlock(item, session, ex, sets, conditioning, fields, gym, info, ended)}
      <p class="aim-line">${aim}${conditioning || t.aim ? '' : t.rir || rir ? ` · ${A.effort(t.rir || rir, 'aim')}` : ''} · <button class="aim-rest" data-a="ex-rest" data-uid="${item.uid}" aria-label="Rest time. Change">Rest ${A.fmtRest(item.restSec || grp.items.reduce((a, i) => Math.max(a, i.restSec || 0), 0)) || 'off'}</button></p>
      ${(() => {
        // A lift never logged before: the weight shown is a starting guess.
        const fresh = !conditioning && !ex.noLoad && ex.type !== 'bodyweight' && !A.db.sessions.some((x) => x.entries.some((e) => e.exerciseId === ex.id));
        if (allDone || conditioning || !(fresh || t.weight == null)) return '';
        return `<div class="first-weight">${t.weight != null ? '<p class="small muted">First time: the weight is a starting guess.</p>' : ''}${session ? `<button class="btn sm base-find" data-a="base-find" data-uid="${item.uid}">Help me pick a weight</button>` : ''}</div>`;
      })()}
      ${ex.modes?.length > 1 ? `<div class="segmented small-seg metric-seg" role="radiogroup" aria-label="Measure by">${ex.modes.map((m) => `<button class="${m === metric ? 'on' : ''}" data-a="set-metric" data-uid="${item.uid}" data-v="${m}" role="radio" aria-checked="${m === metric}">${METRICS[m]}</button>`).join('')}</div>` : ''}
      ${conditioning ? A.train.condInfo(item, entry, ex, metric) : ''}
      ${item.note && conditioning ? `<p class="small">${A.esc(item.note)}</p>` : ''}
      ${notices.filter((n) => n[2] !== 'pain').map(([c, m]) => `<p class="notice ${c}">${A.esc(m)}</p>`).join('')}
      ${A.pain.exerciseCard(ex, item, entry, t, (e) => isAvailable(A.db, e))}
      ${warmBlock(item, entry, warm, ex, gym, barbell)}
      ${!warm.length && !conditioning && !ended && !prep ? `<button class="text-btn warm-make" data-a="warm-make" data-uid="${item.uid}">${icon('plus')} Ramp-up sets</button>` : ''}
      <div class="set-table" role="group" aria-label="Sets">
        ${setHead(conditioning, fields, ex)}
        ${rows}
      </div>
      ${!ended ? `<button class="text-btn" data-a="add-set" data-uid="${item.uid}">${icon('plus')} ${conditioning ? 'Add round' : 'Add set'}</button>${conditioning || entry?.maxTest ? '' : `<button class="text-btn" data-a="add-drop" data-uid="${item.uid}">${icon('plus')} Add drop set</button>`}` : ''}
      ${ex.rules?.rehab && !ended && !entry?.maxTest ? `<label class="toggle"><input type="checkbox" data-a="painfree" data-uid="${item.uid}" ${entry?.painFree ? 'checked' : ''}><span>Pain-free today<span class="pick-sub">Weight goes up only after pain-free sessions</span></span></label>` : ''}
      ${checkin}
      <div class="ex-nav">
        ${back ? `<button class="btn prev-ex" data-a="ex-go" data-uid="${back.uid}" aria-label="Previous exercise: ${A.esc(back.ex.name)}">${icon('left')}<span>Prev</span></button>` : ''}
        ${!session ? '<button class="btn primary grow" data-a="start-workout">Start workout</button>'
          : next ? `<button class="btn primary grow" data-a="ex-go" data-uid="${next.uid}"><span class="ell">Next: ${A.esc(next.ex.name)}</span></button>`
            : '<button class="btn primary grow" data-a="finish">Finish workout</button>'}
      </div>
    </div>`;
  }

  // Main muscles bold, helpers grayer, each with its small body icon.
  function muscleRow(ex) {
    const list = [...(ex.primary || []).map((m) => [m, 'main']), ...(ex.secondary || []).map((m) => [m, ''])].slice(0, 4);
    return `<div class="mus-row">${list.map(([m, c]) => `<span class="mus-i ${c}">${muscleIcon(m)}${A.esc(MUSCLES[m] || m)}</span>`).join('')}</div>`;
  }

  // The number that matters for this exercise, always in the same spot, then how to set it up.
  function dialBlock(item, session, ex, sets, conditioning, fields, gym, info, ended) {
    const cur = sets.find((s) => !s.done) || sets[sets.length - 1] || {};
    const repsFirst = !conditioning && (ex.noLoad || ex.type === 'bodyweight');
    const k = conditioning ? fields[0][0] : repsFirst ? 'reps' : 'weight';
    const raw = cur[k];
    const unit = conditioning ? ({ time: 'seconds', dist: 'meters', cal: 'calories', reps: 'reps' }[k]) : repsFirst ? repsLabel(ex, 'reps') : unitLabel(ex);
    const shown = raw == null || raw === '' ? '—' : k === 'weight' ? toDisp(raw) : raw;
    const live = !!session && !ended;
    const dial = `<div class="dial ${live ? '' : 'solo'}">${live ? `<button class="dial-btn" data-a="dial" data-uid="${item.uid}" data-k="${k}" data-v="-1" aria-label="Less">−</button>` : ''}<div><span class="dial-val">${shown}</span><span class="dial-unit">${unit}</span></div>${live ? `<button class="dial-btn" data-a="dial" data-uid="${item.uid}" data-k="${k}" data-v="1" aria-label="More">+</button>` : ''}</div>`;
    if (conditioning) { const cue = String(info.cues || '').split(' · ')[0]; return dial + (cue ? `<div class="setup text"><b>${A.esc(cue)}</b></div>` : ''); }
    if (ex.noLoad) return dial;
    if (ex.type === 'bodyweight') {
      const added = Number(cur.weight) || 0;
      if (added > 0) { const su = loadSetup(ex, added, gym); return `${dial}<div class="setup">${su.art}<div><b>${A.esc(su.line)}</b>${live ? `<button class="text-btn" data-a="bw-weight" data-uid="${item.uid}" data-v="off">Remove weight</button>` : ''}</div></div>`; }
      return `${dial}<div class="setup text"><div><b>Body weight</b><span>Add weight when reps feel easy</span></div>${live ? `<button class="text-btn" data-a="bw-weight" data-uid="${item.uid}" data-v="on">+ Add weight</button>` : ''}</div>`;
    }
    const su = raw > 0 ? loadSetup(ex, raw, gym) : null;
    if (!su) return dial;
    return dial + (su.line ? `<div class="setup">${su.art}<div><b>${A.esc(su.line)}</b>${su.sub ? `<span>${su.sub}</span>` : ''}</div></div>` : `<div class="setup solo">${su.art}</div>`);
  }

  // Warm-up sets: collapsed by default, editable, checked off like work sets (they don't count
  // toward progression, volume or records). Stored on the workout entry once edited or started.
  function warmBlock(item, entry, warm, ex, gym, barbell) {
    if (!warm.length) return '';
    const done = warm.filter((w) => w.done).length;
    const open = A.ui.warmOpen?.[item.uid] ?? !!entry?.maxTest; // a max test starts with its warm-ups showing
    return `<details class="warmup" data-uid="${item.uid}" ${open ? 'open' : ''}>
      <summary>Ramp-up sets <span class="ws-hint">${done ? `${done} of ${warm.length} done` : `${warm.length} before your first set`}</span></summary>
      <div class="set-head warm" aria-hidden="true"><span></span><span>${unitLabel(ex)}</span><span>${repsLabel(ex)}</span><span></span></div>
      ${warm.map((w, i) => `<div class="set-row warm ${w.done ? 'done' : ''}" data-swipe="warm-del" data-swipe-label="Delete" data-uid="${item.uid}" data-i="${i}">
        <span class="set-badge ty-w">R</span>
        <input class="cell" type="text" inputmode="decimal" data-warm="${item.uid}:${i}:weight" value="${toDisp(w.weight) ?? ''}" aria-label="Ramp-up set ${i + 1} weight">
        <input class="cell" type="text" inputmode="numeric" data-warm="${item.uid}:${i}:reps" value="${w.reps}" aria-label="Ramp-up set ${i + 1} reps">
        <button class="check" data-a="warm-check" data-uid="${item.uid}" data-i="${i}" aria-pressed="${!!w.done}" aria-label="${w.done ? 'Undo' : 'Complete'} ramp-up set ${i + 1}">${icon('check')}</button>
        ${barbell ? `<span class="wu-plates">${plateText(w.weight, gym)}</span>` : ''}
      </div>`).join('')}
      <button class="text-btn small-text" data-a="warm-add" data-uid="${item.uid}">${icon('plus')} Add ramp-up set</button>
    </details>`;
  }

  // The warm-ups for an entry, copied onto the workout the first time they're touched.
  function warmFor(uid) {
    if (!A.sessionFor(A.ui.day)) return A.draftWarm(uid);
    const sx = A.ensureSession(A.ui.day);
    const e = sx?.entries[uid];
    if (!e) return null;
    if (!e.warm) {
      const item = todayItems(A.ui.day).find((i) => i.uid === uid);
      const t = targetsFor(A.db, item, sx.isDeload);
      const gym = activeGym(A.db);
      e.warm = defaultWarm(item.ex, roundToGym(item.ex, t.weight, gym), gym).map((w) => ({ ...w, done: false }));
    }
    return e.warm;
  }

  // Warm-up sets for any lift: the usual ramp for compounds (40/60/80%), one light set for an
  // isolation exercise, and a light practice set when there's no working weight yet.
  function defaultWarm(ex, weight, gym) {
    if (weight && ex.category === 'accessory') return [{ weight: roundToGym(ex, weight * 0.5, gym), reps: 10 }];
    const ramp = warmupSets(ex, weight, gym);
    if (ramp.length) return ramp;
    return [{ weight: ex.type === 'bodyweight' ? 0 : weight ? roundToGym(ex, weight * 0.5, gym) : null, reps: 8 }];
  }

  const SET_TYPES = { w: ['R', 'Ramp-up'], d: ['D', 'Drop set'], f: ['F', 'To failure'] };

  function setHead(conditioning, fields, ex) {
    if (conditioning) return `<div class="set-head" aria-hidden="true"><span>Round</span><span>${fields[0][1]}${sideNote(ex) ? ` ${sideNote(ex)}` : ''}</span><span>${fields[1][1]}</span><span></span></div>`;
    if (ex.noLoad) return '<div class="set-head lift no-load" aria-hidden="true"><span>Set</span><span>Previous</span><span>' + repsLabel(ex) + '</span><span></span></div>';
    return `<div class="set-head lift" aria-hidden="true"><span>Set</span><span>Previous</span><span>${ex.type === 'bodyweight' ? `+ ${wUnit()}` : unitLabel(ex)}</span><span>${repsLabel(ex)}</span><span></span></div>`;
  }

  // Set rows for lifts: set number (tap for type and effort), last time's result (tap to copy),
  // weight, reps and the check. Weight comes before reps, the way lifters say it: "135 for 8".
  function liftRows(item, sets, ended, t, ex) {
    const last = t.st?.last;
    return sets.map((s, i) => {
      const disabled = ended && !s.done && !s.pain;
      const pw = last?.weights?.[i];
      const pr = last?.reps?.[i];
      const prev = pr != null ? (ex.noLoad ? `${pr} reps` : (ex.type === 'bodyweight' && !pw ? `${pr} reps` : `${pw} × ${pr}`)) : '';
      const ty = SET_TYPES[s.type];
      const ask = A.ui.rirAsk && A.ui.rirAsk.uid === item.uid && A.ui.rirAsk.idx === i && s.done;
      const rpe = A.db.settings.effortScale === 'rpe';
      return `<div class="set-row lift ${s.best && s.done ? 'best' : ''} ${ex.noLoad ? 'no-load' : ''} ${s.done ? 'done' : ''} ${s.pain ? 'pain' : ''} ${disabled ? 'disabled' : ''}" data-swipe="del-set" data-uid="${item.uid}" data-i="${i}" data-swipe-label="Delete"${s.type === 'w' ? '' : ` data-swipe2="swipe-drop" data-swipe2-label="${s.type === 'd' ? 'Normal' : 'Drop set'}"`}>
        <button class="set-badge ${ty ? `ty-${s.type}` : ''}" data-a="open-set" data-uid="${item.uid}" data-i="${i}" aria-label="Set ${i + 1}${ty ? `, ${ty[1]}` : ''}. Options: type, effort, pain">${ty ? ty[0] : i + 1}</button>
        ${prev ? `<button class="prev" data-a="copy-prev" data-uid="${item.uid}" data-i="${i}" data-w="${pw ?? 0}" data-r="${pr}" ${s.done || disabled ? 'disabled' : ''} aria-label="Last time ${prev}${sideNote(ex) ? ` ${sideNote(ex)}` : ''}. Tap to use these numbers">${prev}</button>` : '<span class="prev none" aria-label="No previous set">—</span>'}
        ${ex.noLoad ? '' : `<input class="cell" type="text" inputmode="decimal" data-set="${item.uid}:${i}:weight" value="${toDisp(s.weight) ?? ''}" placeholder="—" aria-label="Set ${i + 1} weight in ${wUnit() === 'kg' ? 'kilograms' : 'pounds'}" ${disabled ? 'disabled' : ''}>`}
        <input class="cell" type="text" inputmode="numeric" data-set="${item.uid}:${i}:reps" value="${s.reps ?? ''}" aria-label="Set ${i + 1} reps${sideNote(ex) ? ` ${sideNote(ex)}` : ''}" ${disabled ? 'disabled' : ''}>
        <button class="check" data-a="check-inline" data-uid="${item.uid}" data-i="${i}" ${disabled || s.pain ? 'disabled' : ''} aria-pressed="${s.done}" aria-label="${s.done ? 'Undo' : 'Complete'} set ${i + 1}">${icon('check')}</button>
      </div>${s.best && s.done ? '<p class="set-extra best-chip"><span>New best</span></p>' : ''}${ask ? `<div class="rir-ask" role="group" aria-label="${rpe ? 'How hard was it, RPE' : 'Reps left in the tank'}"><span>${rpe ? 'RPE?' : 'Reps left?'}</span>${[0, 1, 2, 3].map((v) => `<button data-a="rir-quick" data-uid="${item.uid}" data-i="${i}" data-v="${v}">${rpe ? 10 - v : v === 3 ? '3+' : v}</button>`).join('')}<button class="rir-skip" data-a="rir-later" aria-label="Skip">${icon('x')}</button></div>` : s.rir != null || s.pain ? `<p class="set-extra">${s.pain ? 'Pain flagged' : A.effort(s.rir, 'done')}</p>` : ''}`;
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
        run.forEach((x, r) => { if (x.restSec) x.soloRest = x.restSec; x.restSec = r === run.length - 1 ? rest : 0; });
      } else if (!run[0].restSec && !run[0].phase) {
        // Back on its own: its own rest again, or the usual rest for its type if it never had one.
        const ex = A.db.exercises[run[0].exerciseId];
        run[0].restSec = run[0].soloRest || (ex?.category === 'conditioning' || ['mobility', 'prehab'].includes(ex?.pattern) ? 0 : ex?.category === 'compound' ? 150 : 90);
      }
      i = j;
    }
  }

  // ---------- One muscle's week: what worked it, and what to add ----------
  function openMuscleWork(d) {
    A.ui.volSel = { m: d.m, g: d.g };
    const g = d.g ? groupById(d.g) : null;
    const muscles = g ? g.muscles : [d.m];
    const name = g ? g.name : MUSCLES[d.m];
    const ws = setsByPart(A.db).muscles;
    const rx = { weekly: A.db.profile?.rx?.weekly || [10, 20], includePhysique: !!A.db.profile?.rx?.includePhysique };
    const t = muscles.map((m) => volumeTarget(rx, m));
    const r2 = (x) => Math.round(x * 2) / 2;
    const v = r2(muscles.reduce((a, m) => a + (ws[m] || 0), 0));
    const lo = t.reduce((a, x) => a + x[0], 0);
    const hi = t.reduce((a, x) => a + x[1], 0);
    const work = muscleWork(A.db, muscles);
    // For a group, suggest work for the member furthest below its target.
    const lead = g ? muscles.slice().sort((a, b) => (ws[a] || 0) / volumeTarget(rx, a)[0] - (ws[b] || 0) / volumeTarget(rx, b)[0])[0] : d.m;
    const opts = addOptions(A.db, lead);
    const session = A.db.activeSession && A.sessionFor(A.ui.day);
    A.openSheet(`<h2>${A.esc(name)}</h2>
      <p class="muted"><b class="num">${v}</b> sets in the last 7 days · target ${lo}–${hi}${v < lo ? ' · below' : v > hi ? ' · above' : ''}</p>
      <h3 class="sheet-h">Worked by</h3>
      ${work.length ? `<div class="list-group">${work.map((w) => `<button class="list-row" data-a="ex-info" data-id="${w.exerciseId}"><span class="grow"><b>${A.esc(A.db.exercises[w.exerciseId].name)}</b><span class="pick-sub">${r2(w.sets)} sets · last ${A.fmtDate(w.date)}</span></span>${icon('right', 'chev')}</button>`).join('')}</div>` : '<p class="muted small">Nothing logged for it in the last 7 days.</p>'}
      <h3 class="sheet-h">Add more${g ? ` for ${A.esc(MUSCLES[lead].toLowerCase())}` : ''}</h3>
      <div class="list-group">${opts.map(({ ex, day }) => `<div class="list-row add-opt"><span class="grow"><b>${A.esc(ex.name)}</b><span class="pick-sub">3 sets</span></span>
        ${session ? `<button class="btn sm" data-a="vol-add-today" data-id="${ex.id}">Add today</button>` : ''}
        ${day ? `<button class="btn sm" data-a="vol-add-plan" data-id="${ex.id}" data-day="${day}">Add to ${DAY_NAMES[day]}</button>` : ''}</div>`).join('') || '<p class="muted small pad">No other exercises for it at this gym.</p>'}</div>
      <p class="muted small">Sets count once logged. "Add to" a day changes your weekly plan${session ? '; "Add today" is for this workout only' : ''}.</p>`);
  }

  // ---------- Summary ----------

  // The muscles this workout trained: hard sets per muscle (helpers count half), shaded front and back.
  function workedMap(s) {
    const items = s.entries.map((e) => ({ exerciseId: e.exerciseId, sets: (e.sets || []).filter((x) => x.type !== 'w' && x.done !== false && !x.pain && (x.reps > 0 || x.time > 0 || x.dist > 0)).length })).filter((i) => i.sets);
    const loads = liftLoads(A.db, items);
    const top = Math.max(0, ...Object.values(loads));
    if (!top) return '';
    const values = Object.fromEntries(Object.entries(loads).map(([m, v]) => [m, Math.max(0.18, v / top)]));
    const lead = Object.entries(loads).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return `<section class="card worked"><h3>Muscles worked</h3>
      ${bodyPair(values, { cls: 'worked-map', label: 'Muscles worked this workout' })}
      <p class="small worked-top">${lead.map(([m, v]) => `<span><b>${A.esc(MUSCLE_NAMES[m] || m)}</b> ${Math.round(v * 2) / 2} ${v === 1 ? 'set' : 'sets'}</span>`).join('')}</p></section>`;
  }

  const STATUS = {
    progressed: ['up', 'Going up', 'good'],
    held: ['minus', 'Same next time', ''],
    missed: ['minus', 'Short of target', 'warn'],
    reduced: ['arrowDown', 'Reduced', 'warn'],
    pain: ['x', 'Pain', 'bad'],
    deload: ['minus', 'Deload', ''],
    logged: ['check', 'Logged', ''],
    tested: ['up', 'Max test', 'good'],
    peak: ['check', 'Peaking', ''],
    skipped: ['minus', 'Skipped', 'muted'],
  };

  // A finished workout's exercises: a line or two each; tap one for its sets and what happens next.
  function exerciseList(s, withResults) {
    const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
    const dist = (m) => (wUnit() === 'kg' ? `${(m / 1000).toFixed(2)} km` : `${(m / 1609.34).toFixed(2)} mi`);
    const tag = { d: 'Drop set', f: 'To failure' };
    const one = (x, ex) => {
      const parts = [];
      if (x.weight || x.reps) parts.push(ex?.noLoad || (!x.weight && ex?.type === 'bodyweight') ? `${x.reps} ${repsLabel(ex, 'reps')}` : `${A.fmtW(x.weight || 0, ex)} × ${x.reps}`);
      if (x.time) parts.push(mmss(x.time));
      if (x.dist) parts.push(dist(x.dist));
      if (x.cal) parts.push(`${x.cal} cal`);
      return parts.join(' · ') || '—';
    };
    const prepOf = (e) => /^(warmup|cooldown)-/.test(e.uid || '') || ['mobility', 'prehab'].includes(A.db.exercises[e.exerciseId]?.pattern);
    const prep = s.entries.filter((e) => e.sets?.length && prepOf(e));
    const rows = s.entries.filter((e) => e.sets?.length && !prepOf(e)).map((e) => {
      const ex = A.db.exercises[e.exerciseId];
      const work = e.sets.filter((x) => x.type !== 'w' && !x.pain);
      const top = work.reduce((m, x) => (!m || (x.weight || 0) * (1 + (x.reps || 0) / 30) > (m.weight || 0) * (1 + (m.reps || 0) / 30) ? x : m), null);
      const r = withResults && (s.results || []).find((q) => q.exerciseId === e.exerciseId && q.status !== 'skipped');
      const st = r && STATUS[r.status];
      const line = `${work.length} ${work.length === 1 ? 'set' : 'sets'}${top ? ` · best ${A.esc(one(top, ex))}` : ''}`;
      let n = 0;
      const lines = e.sets.map((x) => {
        const no = x.type === 'w' ? 'R' : String(++n);
        const note = [tag[x.type] || '', x.rir != null ? `${x.rir} in reserve` : '', x.pain ? 'Pain' : ''].filter(Boolean).join(' · ');
        return `<li class="${x.type === 'w' ? 'ramp' : ''}${x.pain ? ' pain' : ''}"><span class="ps-no">${no}</span><span class="ps-val tnum">${A.esc(one(x, ex))}</span><span class="ps-note">${note}</span></li>`;
      }).join('');
      const detail = r ? `<p class="small">${r.next ? `Next time: <b>${A.fmtW(r.next.weight, ex)} × ${r.next.reps}</b>. ` : ''}<span class="muted">${A.esc(r.message || '')}</span></p>` : '';
      return `<details class="past-ex"><summary><span class="grow"><b>${A.esc(ex?.name || e.name || 'Exercise')}</b><span class="pick-sub">${line}</span></span>${st ? `<span class="pill ${st[2]}">${st[1]}</span>` : ''}${icon('down', 'chev')}</summary>
        <ol class="past-sets">${lines}</ol>${detail}<button class="text-btn small-text" data-a="ex-info" data-id="${e.exerciseId}">History and how-to</button></details>`;
    }).join('');
    const prepRow = prep.length ? `<details class="past-ex"><summary><span class="grow"><b>Warm-up and mobility</b><span class="pick-sub">${prep.length} ${prep.length === 1 ? 'move' : 'moves'}</span></span>${icon('down', 'chev')}</summary><ul class="past-prep">${prep.map((e) => `<li>${A.esc(A.db.exercises[e.exerciseId]?.name || e.name || '')}</li>`).join('')}</ul></details>` : '';
    return rows || prepRow ? `<section class="card past-card"><h3>Exercises</h3>${rows}${prepRow}</section>` : '';
  }

  function screenSummary() {
    const s = A.db.sessions.find((x) => x.id === A.ui.summaryId);
    if (!s) { A.ui.tab = 'today'; return screenToday(); }
    const mins = Math.round(workoutMinutes(s));
    const sets = s.entries.reduce((a, e) => a + e.sets.filter((x) => !x.pain).length, 0);
    const vol = s.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + (x.pain ? 0 : (x.weight || 0) * (x.reps || 0)), 0), 0);
    const res = (s.results || []).filter((r) => r.status !== 'skipped');
    const progressed = res.filter((r) => r.status === 'progressed');
    const stalled = res.filter((r) => r.stalled || r.status === 'missed' || r.status === 'reduced');
    // What happened and what's next, in one line: "190 × 5 → 195 × 5", with a short tag.
    const SHORT = {"progressed":"Up","held":"Same","missed":"Short","reduced":"Down","pain":"Pain","deload":"Deload","logged":"Logged","tested":"Max test","peak":"Peaking","skipped":"Skipped"};
    const row = (r) => {
      const [ic, , cls] = STATUS[r.status];
      const ex = A.db.exercises[r.exerciseId];
      const e = s.entries.find((x) => x.exerciseId === r.exerciseId);
      const top = (e?.sets || []).filter((x) => x.type !== 'w' && x.weight > 0 && x.reps > 0).reduce((a, x) => (!a || x.weight > a.weight || (x.weight === a.weight && x.reps > a.reps) ? x : a), null);
      const now = top ? `${A.fmtW(top.weight, ex)} × ${top.reps}` : '';
      const next = r.next ? `${A.fmtW(r.next.weight, ex)} × ${r.next.reps}` : '';
      // Same weight, more reps next time (double progression): say so instead of "Same".
      const moreReps = r.status === 'held' && top && r.next && r.next.weight === top.weight && r.next.reps > top.reps ? r.next.reps - top.reps : 0;
      const hint = r.status === 'held' && r.next?.total ? `Beat ${r.next.total - 1} reps in total` : r.status !== 'held' && r.status !== 'progressed' ? r.message : '';
      return `<div class="result nt ${cls}">
        <div class="grow"><b>${A.esc(r.name)}</b>
          ${next ? `<span class="nt-line">${now ? `<span class="muted">${now}</span> <span class="nt-arrow" role="img" aria-label="next time">${icon('arrowRight')}</span> ` : 'Next '}<b>${next}</b></span>` : ''}
          ${hint ? `<span class="small muted nt-hint">${A.esc(hint)}</span>` : ''}
        </div>
        <span class="nt-tag ${cls}${moreReps ? ' good' : ''}">${icon(moreReps ? 'up' : ic)}${moreReps ? `+${moreReps} ${moreReps === 1 ? 'rep' : 'reps'}` : SHORT[r.status] || ''}</span></div>`;
    };
    const prs = s.prs || [];
    const adj = s.adjustments || [];
    const stamp = `<span class="finish-stamp${A.ui.summaryFresh ? ' fresh' : ''}" aria-hidden="true">Done</span>`;
    return `<header class="top summary-top">${stamp}<div><h1>${A.ui.summaryFresh ? 'Workout done' : 'Workout'}</h1><p class="muted small">${A.fmtDate(s.date)} · ${DAY_NAMES[s.day]} · ${s.freestyle ? 'Custom workout' : A.esc(A.db.plan[s.day]?.name || '')}${s.isDeload ? ' · deload' : ''}</p></div></header>
      <div class="stats sum-stats">
        <div class="stat"><b data-count="${mins}">${mins}</b><span>min</span></div>
        <div class="stat"><b data-count="${sets}">${sets}</b><span>sets</span></div>
        <div class="stat"><b data-count="${Math.round(toDisp(vol))}">${Math.round(toDisp(vol)).toLocaleString()}</b><span>${wUnit()} volume</span></div>
        <button class="stat" data-a="energy-why" aria-label="About ${Math.round(workoutBurn(A.db, s).active)} active calories"><b>~${Math.round(workoutBurn(A.db, s).active)}</b><span>active kcal</span></button>
      </div>
      ${prs.length ? `<div class="card pr-card ${A.ui.summaryFresh ? 'celebrate' : ''}"><h3>${prs.length === 1 ? 'New record' : `${prs.length} new records`}</h3>${prs.filter((p) => p.type === 'e1rm' && p.to > p.from).slice(0, 1).map((p) => `<div class="pr-big"><b class="num" ${A.ui.summaryFresh ? `data-from="${Math.round(toDisp(p.from))}" data-count="${Math.round(toDisp(p.to))}"` : ''}>${Math.round(toDisp(p.to))}</b><span>${wUnit()} est. max · ${A.esc(p.name)}<br><small>up from ${Math.round(toDisp(p.from))}</small></span></div>`).join('')}${prs.map((p) => `<p class="small"><b>${A.esc(p.name)}</b> — ${A.esc(p.text)}</p>`).join('')}${A.peopleOn() && prs.some((p) => p.type === 'e1rm' || p.type === 'reps') ? `<button class="btn block" data-a="ppl-share-pr" data-sid="${s.id}">Share with friends</button>` : ''}</div>` : ''}
      ${s.goalHit ? `<div class="card pr-card ${A.ui.summaryFresh ? 'celebrate' : ''}"><h3>Big goal reached</h3><p class="small"><b>${A.esc(s.goalHit)}</b></p></div>` : ''}
      ${!A.ui.summaryFresh && !s.isDeload ? '' : s.isDeload ? '<p class="muted small pad">Deload workouts don\'t change targets.</p>' : res.length ? `<div class="card"><h3>Next time${progressed.length ? ` · <span class="up-count">${progressed.length} up</span>` : ''}</h3>${[...progressed, ...res.filter((r) => !progressed.includes(r) && !stalled.includes(r)), ...stalled].map(row).join('')}</div>` : ''}
      ${adj.length ? `<div class="card"><h3>Plan adjustments from your check-ins</h3>${adj.map((a) => `<p class="small">${A.esc(a.text)}</p>`).join('')}</div>` : ''}
      ${workedMap(s)}
      ${exerciseList(s, !A.ui.summaryFresh)}
      ${A.ui.summaryFresh ? A.extras.summaryBackupCard() : ''}
      <details class="card note-card" ${s.note ? 'open' : ''}><summary>${s.note ? 'Note' : 'Add a note'}</summary><textarea id="session-note" data-sid="${s.id}" rows="3" placeholder="How did it go?">${A.esc(s.note || '')}</textarea></details>
      ${A.health.button(s)}
      ${A.peopleOn() ? `<button class="btn block" data-a="ppl-post-session" data-id="${s.id}">Post a lift or run</button>` : ''}
      <div class="row"><button class="btn grow" data-a="share-session" data-id="${s.id}">Share</button><button class="btn grow" data-a="session-more" data-id="${s.id}">More</button></div>
      <button class="btn primary block" data-a="tab" data-tab="${A.ui.summaryFresh ? 'today' : 'history'}">Done</button>
      ${A.canReopen(s.id) ? '<button class="text-link center-link" data-a="resume-finished">Resume workout</button>' : ''}`;
  }

  // ---------- Edit a finished workout ----------

  function isLatestFor(session, exId) {
    return !A.db.sessions.some((x) => x !== session && x.finishedAt > session.finishedAt && x.entries.some((e) => e.exerciseId === exId));
  }

  // Re-run progression for exercises where this is still the most recent workout, from the saved
  // pre-workout state. Older workouts only change history (newer workouts already built on them).
  function recomputeSession(s) {
    const changed = [];
    for (const exId of new Set(s.entries.map((e) => e.exerciseId).concat(Object.keys(s.stateBefore || {})))) {
      if (!s.stateBefore || !(exId in s.stateBefore) || !isLatestFor(s, exId)) continue;
      if (s.stateBefore[exId]) A.db.state[exId] = JSON.parse(JSON.stringify(s.stateBefore[exId])); else delete A.db.state[exId];
      const e = s.entries.find((x) => x.exerciseId === exId);
      if (!e) continue;
      const { result, state } = evaluate(A.db, { ...e, sets: e.sets.map((x) => ({ ...x, done: !x.pain })) }, s);
      if (state) A.db.state[exId] = state;
      const i = s.results.findIndex((r) => r.exerciseId === exId);
      if (i >= 0) s.results[i] = { ...result, group: e.group }; else s.results.push({ ...result, group: e.group });
      changed.push(exId);
    }
    s.prs = s.isDeload ? [] : s.entries.flatMap((e) => detectPRs(A.db, e, s.finishedAt).map((p) => ({ exerciseId: e.exerciseId, name: e.name, ...p })));
    return changed;
  }

  function screenEditSession() {
    const s = A.db.sessions.find((x) => x.id === A.ui.editId);
    if (!s) { A.ui.tab = 'history'; return A.screenHistory(); }
    return `<header class="top"><button class="back" data-a="summary" data-id="${s.id}" aria-label="Back">${icon('left')}</button><div><h1>Edit workout</h1><p class="muted small">${A.fmtDate(s.date)} · changes save when you tap Save</p></div></header>
      <div class="card"><div class="field"><span>Duration (minutes) ${A.helpBtn()}</span><p class="help-text" hidden>Used for calories burned. Leave it to the app and it uses the workout clock, or about 2.5 minutes per set if the clock looks too short.</p>
        <input id="es-dur" type="text" inputmode="numeric" value="${s.durationMin || ''}" placeholder="${Math.round(workoutMinutes({ ...s, durationMin: 0 }))} (estimated)"></div></div>
      ${s.entries.map((e, ei) => `<div class="card">
        <div class="row between"><h3>${A.esc(e.name)}</h3><button class="mini danger" data-a="es-del-entry" data-i="${ei}">Remove</button></div>
        ${e.sets.map((x, si) => `<div class="edit-set"><span class="set-n">${si + 1}</span>
          <input type="text" inputmode="decimal" data-es="${ei}:${si}:weight" value="${toDisp(x.weight)}" aria-label="Weight"><span class="muted">${wUnit()} ×</span>
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
    const dur = parseFloat(A.$('#es-dur')?.value);
    if (A.$('#es-dur')) {
      if (Number.isFinite(dur) && dur > 0) { s.durationMin = Math.round(dur); s.finishedAt = s.startedAt + s.durationMin * 60000 + (s.pausedMs || 0); }
      else delete s.durationMin;
    }
    for (const el of document.querySelectorAll('[data-es]')) {
      const [ei, si, k] = el.dataset.es.split(':');
      const v = parseFloat(el.value);
      if (Number.isFinite(v) && s.entries[ei]?.sets[si]) s.entries[ei].sets[si][k] = k === 'reps' ? Math.round(v) : k === 'weight' ? fromDisp(v) : v;
    }
  }

  // Log a workout on a past day: start from one of the plan's days, or empty.
  function openBackfill(date) {
    const days = DAY_KEYS.filter((k) => A.db.plan[k]?.items?.length);
    const same = dayKeyOf(date);
    A.openSheet(`<h2>Log a workout</h2><p class="muted small">${A.fmtDate(date)}</p>
      <div class="list-group menu">
        ${[...days.filter((k) => k === same), ...days.filter((k) => k !== same)].map((k) => `<button class="list-row" data-a="backfill-go" data-date="${date}" data-tpl="${k}">${icon('copy')}<span class="grow">${A.esc(A.db.plan[k].name)}<span class="pick-sub">${DAY_NAMES[k]}'s plan · ${A.db.plan[k].items.length} exercises</span></span></button>`).join('')}
        <button class="list-row" data-a="backfill-go" data-date="${date}" data-tpl="">${icon('plus')}<span class="grow">Empty workout</span></button>
      </div>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  return { dayTabs, rirTarget, plannedFor, plannedRaw, rank, todayItems, groupsOf, linkLabel, thumb, screenToday, targetMuscles, exerciseRow, exerciseFull, setsLeft, comingUp, fmtElapsed, workoutBar, openWhyWorkout, screenExercise, warmBlock, warmFor, defaultWarm, SET_TYPES, setHead, liftRows, condRows, relabel, openMuscleWork, STATUS, screenSummary, isLatestFor, recomputeSession, screenEditSession, readEditInputs, openBackfill };
}
