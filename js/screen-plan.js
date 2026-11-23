// Plan tab: this week, the program, a day's exercises and the exercise editor.
// Split out of app.js. App state and the helpers this needs come from A: live getters (and
// setters for variables), so db and the rest stay shared with app.js.
import { icon } from './icons.js';
import { DAY_NAMES, PROGRESSIONS, dayKeyOf, deloadDose, deloadText, dayPlan, getState, groupNum, resolveDay, weekOverride } from './engine.js';
import { addDays, mondayOf, todayStr, weekOrder } from './store.js';
import { dayMode } from './fatigue.js';
import { estimateMinutes } from './builder.js';
import { blockInfo } from './blocks.js';
import { weekReview } from './review.js';
import { fmtTarget } from './conditioning.js';
import { CATEGORIES, METRICS, MUSCLES, PATTERNS, similarExercises } from './bank.js';
import { ROW_ROTATION, TYPES } from './plan.js';
import { fromDisp, toDisp, wUnit } from './units.js';

export function createPlanScreens(A) {
  // Program notation for the order: A, B, then supersets as C1, C2 (stored as 1, 2, 3a, 3b).
  const groupLabel = (g) => { const m = /^(\d+)([a-z]?)$/i.exec(String(g || '')); if (!m) return String(g || ''); const letter = String.fromCharCode(64 + Math.min(26, +m[1])); return m[2] ? letter + (m[2].toLowerCase().charCodeAt(0) - 96) : letter; };
  // ---------- Plan editor ----------

  function builderEntry() {
    const prev = A.db.previousPlan;
    return `<div class="list-group">
        <button class="list-row" data-a="open-builder"><span class="row-icon accent" aria-hidden="true">${icon('sparkle')}</span><span class="grow"><b>${A.db.profile ? 'Goals & plan builder' : 'Build a plan from your goals'}</b><span class="pick-sub">Sets, reps, days and exercises for your goals</span></span>${icon('right', 'chev')}</button>
        ${prev ? `<button class="list-row" data-a="undo-plan"><span class="row-icon" aria-hidden="true">${icon('undo')}</span><span class="grow">Undo plan change<span class="pick-sub">From ${new Date(prev.savedAt).toLocaleDateString()}</span></span></button>` : ''}
      </div>`;
  }

  function planViewTabs() {
    return `<header class="top"><h1 class="grow">Plan</h1></header>
      <div class="segmented" role="tablist" aria-label="Plan view">
        <button class="${A.ui.planView === 'week' ? 'on' : ''}" data-a="plan-view" data-v="week" role="tab" aria-selected="${A.ui.planView === 'week'}">Week</button>
        <button class="${A.ui.planView === 'year' ? 'on' : ''}" data-a="plan-view" data-v="year" role="tab" aria-selected="${A.ui.planView === 'year'}">Year</button>
      </div>`;
  }

  // A sub-page header: back arrow, title, optional subtitle.
  const subHeader = (title, back, sub = '') => `<header class="top"><button class="back" data-a="${back}" aria-label="Back">${icon('left')}</button><div class="grow"><h1>${title}</h1>${sub ? `<p class="subtitle">${sub}</p>` : ''}</div></header>`;

  // Plan opens on the week as seven rows; a day, the program and goals are one tap deeper.
  function screenPlan() {
    if (A.ui.planView === 'year') return subHeader('Goals and year', 'plan-back') + A.train.runCard() + A.year.view();
    if (A.ui.planView === 'program') return planProgram();
    if (A.ui.planView !== 'day') return planWeek();
    return planDay();
  }

  // A future week, read only: the plan as it stands, with that week's block and deload.
  function futureWeek(off) {
    const start = addDays(mondayOf(todayStr()), off * 7);
    const b = blockInfo(A.db, start);
    const rows = weekOrder().map((d) => {
      const mode = A.db.settings.dayModes?.[d] || (A.db.plan[d] ? 'lift' : 'rest');
      const p = A.db.plan[d];
      const lift = p?.items?.length && (mode === 'lift' || mode === 'both');
      const name = lift ? A.esc(p.name) : mode === 'cardio' ? 'Cardio' : 'Rest';
      const sub = lift ? `${p.items.length} exercises · ~${estimateMinutes(p.items)} min${mode === 'both' ? ' + cardio' : ''}` : '';
      return lift
        ? `<button class="list-row week-row" data-a="wk-peek" data-day="${d}" data-off="${off}"><span class="wd">${DAY_NAMES[d]}</span><span class="grow"><b>${name}</b><span class="pick-sub">${sub}</span></span>${icon('right', 'chev')}</button>`
        : `<div class="list-row week-row"><span class="wd">${DAY_NAMES[d]}</span><span class="grow"><b>${name}</b></span></div>`;
    }).join('');
    return `<p class="muted small week-note">Block ${b.index} · week ${b.weekInBlock} of ${b.n}${b.isDeload ? ' · <b>Deload week</b>' : ''}</p><div class="list-group">${rows}</div>`;
  }
  const weekLabel = (off) => (off === 0 ? 'This week' : off === 1 ? 'Next week' : `In ${off} weeks`);
  const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const weekNav = (off) => {
    const start = addDays(mondayOf(todayStr()), off * 7);
    return `<div class="week-nav"><button class="icon-btn" data-a="wk-ahead" data-v="-1" aria-label="Earlier week" ${off ? '' : 'disabled'}>${icon('left')}</button><div class="grow"><h2>${weekLabel(off)}</h2><span class="muted small">${shortDate(start)} to ${shortDate(addDays(start, 6))}</span></div><button class="icon-btn" data-a="wk-ahead" data-v="1" aria-label="Later week" ${off >= 8 ? 'disabled' : ''}>${icon('right')}</button></div>`;
  };

  function planWeek() {
    const ahead = A.ui.weekAhead || 0;
    const today = dayKeyOf(todayStr());
    const adjusted = A.db.week?.start === mondayOf(todayStr());
    const rows = weekOrder().map((d) => {
      const mode = dayMode(A.db, d);
      const p = dayPlan(A.db, d);
      const lift = p?.items?.length && (mode === 'lift' || mode === 'both');
      const name = lift ? A.esc(p.name) : mode === 'cardio' ? 'Cardio' : 'Rest';
      const note = weekOverride(A.db, d)?.note;
      const sub = lift ? `${p.items.length} exercises · ~${estimateMinutes(p.items)} min${mode === 'both' ? ' + cardio' : ''}` : note ? A.esc(note) : '';
      const off = lift && A.train.canTakeOff(d) ? `data-swipe="day-off" data-swipe-label="Can't make it"` : '';
      return `<button class="list-row week-row ${d === today ? 'is-today' : ''}" data-a="plan-open-day" data-day="${d}" ${off}><span class="wd">${DAY_NAMES[d]}</span><span class="grow"><b>${name}</b>${sub ? `<span class="pick-sub">${sub}</span>` : ''}</span>${icon('right', 'chev')}</button>`;
    }).join('');
    const b = blockInfo(A.db);
    const rv = weekReview(A.db);
    const nSug = rv.items.filter((x) => x.action).length;
    return `<header class="top"><h1 class="grow">Plan</h1></header>
      ${weekNav(ahead)}
      ${ahead ? '' : `<div class="week-tools">${adjusted ? '<button class="link-btn" data-a="wk-reset">Reset</button>' : ''}<button class="link-btn" data-a="wk-open">Adjust</button></div>`}
      ${!ahead && adjusted ? '<p class="muted small week-note">Adjusted for this week only.</p>' : ''}
      ${Object.keys(A.db.plan || {}).length ? '' : '<div class="notice-card"><b>No plan yet</b><p class="small">Answer three questions and Lift builds your week, or tap a day below to set it up yourself.</p><div class="row"><button class="btn primary" data-a="quick-build">Build my plan</button></div></div>'}
      ${ahead ? futureWeek(ahead) : `<div class="list-group">${rows}</div>`}
      <h2 class="group-title">Program</h2>
      <div class="list-group">
        <button class="list-row" data-a="plan-view" data-v="program"><span class="grow"><b>Block ${b.index} · week ${b.weekInBlock} of ${b.n}</b><span class="pick-sub">Focus lifts, deloads, progression</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="rv-open"><span class="grow"><b>Last week</b><span class="pick-sub">${rv.sessions ? (nSug ? (nSug > 3 ? `Top 3 of ${nSug} suggestions` : `${nSug} suggestion${nSug === 1 ? '' : 's'}`) : 'Nothing to change') : 'No workouts logged'}</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="plan-view" data-v="year"><span class="grow"><b>Goals and year</b><span class="pick-sub">Running goal, training phases</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="plan-change"><span class="grow"><b>Change plan</b><span class="pick-sub">Rebuild from goals or start a known program</span></span>${icon('right', 'chev')}</button>
      </div>`;
  }

  function planProgram() {
    const name = PROGRESSIONS[A.db.settings.progression] ? PROGRESSIONS[A.db.settings.progression].name : PROGRESSIONS.double.name;
    return `${subHeader('Program', 'plan-back')}
      ${A.blockCard()}
      <div class="list-group">
        <button class="list-row" data-a="open-settings" data-page="training"><span class="grow"><b>Progression</b><span class="pick-sub">${A.esc(name)}</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="open-settings" data-page="training"><span class="grow"><b>Blocks and deloads</b><span class="pick-sub">${A.db.settings.deloadOff ? 'No scheduled deloads' : `Deload every ${A.db.settings.deloadEvery} weeks`}</span></span>${icon('right', 'chev')}</button>
      </div>`;
  }

  function planDay() {
    const day = A.ui.planDay;
    const plan = A.db.plan[day];
    const mode = dayMode(A.db, day);
    const modes = plan ? ['lift', 'both', 'cardio', 'rest'] : ['cardio', 'rest'];
    const head = `<div class="segmented small-seg" role="radiogroup" aria-label="Day type">${modes.map((m) =>
        `<button class="${m === mode ? 'on' : ''}" data-a="day-mode" data-v="${m}" role="radio" aria-checked="${m === mode}">${A.MODE_LABELS[m]}</button>`).join('')}</div>`;
    const weekAdjusted = A.db.week?.start === mondayOf(todayStr());
    const weekBar = `<div class="week-bar"><button class="btn grow" data-a="wk-open">Adjust week</button><button class="btn" data-a="rv-open">Last week</button>${weekAdjusted ? '<button class="btn" data-a="wk-reset">Reset</button>' : ''}</div>${weekAdjusted ? '<p class="muted small week-note">This week is adjusted. Your plan returns Monday.</p>' : ''}`;
    if (!plan) return subHeader(A.FULL_DAY[day], 'plan-back') + head + `<div class="empty small-empty"><p class="muted">No lifting on ${A.FULL_DAY[day]}s. Cardio days get suggestions based on your fatigue and upcoming lift days.</p></div><button class="btn block" data-a="pt-add" data-day="${day}">Add lifting on ${A.FULL_DAY[day]}s</button><button class="btn block" data-a="open-templates" data-day="${day}" data-mode="plan">Add conditioning</button>${builderEntry()}`;
    const items = plan.items;
    const est = estimateMinutes(items);
    const totalSets = items.reduce((a, i) => a + i.sets, 0);
    return `${subHeader(A.FULL_DAY[day], 'plan-back')}${head}
      ${mode === 'cardio' || mode === 'rest' ? `<p class="muted small pad">Lifting is off on ${A.FULL_DAY[day]}s. The exercises below are kept for when you switch back.</p>` : ''}
      <div class="card plan-day">
        <div class="row between"><input id="plan-name" class="title-input" type="text" value="${A.esc(plan.name)}" data-a="plan-name" aria-label="Day name"><button class="icon-btn plain" data-a="plan-day-menu" data-day="${day}" aria-label="${A.FULL_DAY[day]} options: move, edit all, remove">${icon('more')}</button></div>
        <div class="row between plan-day-meta">
          <span class="muted small nowrap">${items.length} exercises · ${totalSets} sets · ~${est} min</span></div>
        <div class="plan-list">
        ${items.map((it, i) => {
          const ex = A.db.exercises[it.exerciseId];
          const rot = it.role === 'rowCompound' ? ' · rotates each block' : it.role === 'rowAccessory' ? ' · follows rotation' : it.variants?.length > 1 ? ` · rotates ${it.variants.length} variations each ${it.rotate === 'workout' ? 'workout' : 'block'}` : '';
          return `<div class="plan-row region-${ex ? A.regionOf(ex) : 'core'}" data-drag-item data-drag-list="plan" data-drag-id="${it.uid}">
            <button class="drag-handle" data-drag-handle aria-label="Reorder ${A.esc(ex?.name || '')} (arrow keys move it)">${A.GRIP}</button>
            <button class="plan-row-main" data-a="plan-edit" data-i="${i}" aria-label="Edit ${A.esc(ex?.name || it.exerciseId)}">
              <span class="tag" title="Group ${A.esc(it.group)}">${A.esc(groupLabel(it.group))}</span>
              <span class="grow"><b>${A.esc(ex?.name || it.exerciseId)}</b><span class="pick-sub">${it.metric || ex?.category === 'conditioning' ? `${it.sets} × ${fmtTarget(it.metric || ex?.metric || 'reps', it.target ?? it.repMax)}` : `${it.sets} × ${it.repMin}–${it.repMax}`}${it.restSec ? ` · rest ${A.fmtRest(it.restSec)}` : ''}${rot}</span></span>
              ${icon('right', 'chev')}
            </button>
          </div>`;
        }).join('')}
        </div>
        <div class="plan-actions"><button class="text-btn" data-a="plan-add">${icon('plus')} Exercise</button><button class="text-btn" data-a="open-templates" data-day="${day}" data-mode="plan">${icon('plus')} Conditioning</button><button class="text-btn" data-a="browse-bank">Library</button></div>
      </div>
  `;
  }

  function openPlanEdit(i) {
    const day = A.ui.planDay;
    const isNew = i === -1;
    const it = isNew ? { group: String(A.db.plan[day].items.length + 1), exerciseId: '', sets: 3, repMin: 8, repMax: 12, restSec: 90, note: '' } : A.db.plan[day].items[i];
    const ex = A.db.exercises[it.exerciseId] || { type: 'machine', increment: 5, substitute: '', notes: '', minRir: 0, rules: {} };
    const st = it.exerciseId ? getState(A.db, it.exerciseId) : { targetWeight: null };
    const byMuscle = {};
    for (const e of Object.values(A.db.exercises)) (byMuscle[e.primary[0] || '_other'] ||= []).push(e);
    const opts = [...Object.keys(MUSCLES), '_other'].filter((k) => byMuscle[k]).map((k) =>
      `<optgroup label="${MUSCLES[k] || 'Other'}">${byMuscle[k].sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => `<option value="${e.id}" ${e.id === it.exerciseId ? 'selected' : ''}>${A.esc(e.name)}</option>`).join('')}</optgroup>`).join('');
    A.openSheet(`
      <h2>${isNew ? 'Add exercise' : 'Edit slot'}</h2>
      ${it.role ? `<p class="muted small">This slot rotates: ${ROW_ROTATION.map((id) => A.esc(A.db.exercises[id].name)).join(' → ')}. Choosing a different exercise stops the rotation.</p>` : ''}
      <div class="field"><span>Exercise</span>
        <select id="pe-ex" data-a="pe-ex"><option value="__new" ${isNew ? 'selected' : ''}>New exercise…</option>${opts}</select></div>
      <div class="field" id="pe-new" ${isNew ? '' : 'hidden'}><span>New exercise name</span><input id="pe-name" type="text" placeholder="e.g. Cable row (wide grip)"></div>
      <div class="grid2">
        <div class="field"><span>Group</span><input id="pe-group" type="text" value="${A.esc(it.group)}" placeholder="3a"></div>
        <div class="field"><span>Sets</span><input id="pe-sets" type="text" inputmode="numeric" value="${it.sets}"></div>
        <div class="field"><span>Rep min</span><input id="pe-min" type="text" inputmode="numeric" value="${it.repMin}"></div>
        <div class="field"><span>Rep max</span><input id="pe-max" type="text" inputmode="numeric" value="${it.repMax}"></div>
        <div class="field"><span>Rest (sec)</span><input id="pe-rest" type="text" inputmode="numeric" value="${it.restSec}"></div>
        <div class="field"><span>Measure</span><select id="pe-metric">${Object.entries(METRICS).map(([k, v]) => `<option value="${k}" ${k === (it.metric || ex.metric || 'reps') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><span>Target per round</span><input id="pe-target" type="text" inputmode="numeric" value="${it.target ?? ''}" placeholder="sec, m, cal or reps"></div>
      </div>
      <p class="muted small">Measure and target are for conditioning: time, distance or calories per round. Lifts use reps and the rep range above.</p>
      <div class="field"><span>Slot note (this day only)</span><input id="pe-note" type="text" value="${A.esc(it.note || '')}"></div>
      ${it.exerciseId && !it.role ? (() => {
        const opts = similarExercises(A.db.exercises, it.exerciseId, 12).filter((x) => x.samePattern).slice(0, 8);
        if (!opts.length) return '';
        const sel = new Set(it.variants || [it.exerciseId]);
        return `<div class="field"><span>Variety ${A.helpBtn()}</span><p class="help-text" hidden>Auto follows your variety setting. Keep uses this exact exercise every week. The others rotate through the variations you pick below, on that schedule.</p>
          <div class="segmented small-seg" role="radiogroup" aria-label="Rotate">${[['auto', 'Auto'], ['lock', 'Keep'], ['week', 'Weekly'], ['block', 'Each block'], ['workout', 'Each workout']].map(([v, l]) => `<button class="${(it.lock ? 'lock' : it.variants && !it.autoVar ? it.rotate : 'auto') === v ? 'on' : ''}" data-a="pe-rot" data-v="${v}" role="radio">${l}</button>`).join('')}</div>
          <div class="chips wrap" id="pe-variants" aria-label="Variations">${[A.db.exercises[it.exerciseId], ...opts.map((o) => o.ex)].map((e) => `<button class="chip ${sel.has(e.id) ? 'on' : ''}" data-a="pe-var" data-id="${e.id}" aria-pressed="${sel.has(e.id)}">${A.esc(e.name)}</button>`).join('')}</div>
          <p class="muted small">Each variation keeps its own weights and progress.</p></div>`;
      })() : ''}
      <h3 class="sect">Exercise settings <span class="muted small">(all days)</span></h3>
      <div class="grid2">
        <div class="field"><span>Type</span><select id="pe-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === ex.type ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><span>Increment (${wUnit()})</span><input id="pe-inc" type="text" inputmode="decimal" value="${toDisp(ex.increment)}"></div>
        <div class="field"><span>Target weight</span><input id="pe-weight" type="text" inputmode="decimal" value="${st.targetWeight ?? ''}" placeholder="TBD"></div>
        <div class="field"><span>Min RIR to progress</span><input id="pe-rir" type="text" inputmode="numeric" value="${ex.minRir || 0}"></div>
      </div>
      <div class="grid2">
        <div class="field"><span>Category</span><select id="pe-cat">${Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === (ex.category || 'accessory') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><span>Movement</span><select id="pe-pattern"><option value="">—</option>${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${k === ex.pattern ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="field"><span>Primary muscles</span><div class="chips wrap mus" id="pe-prim">${muscleChips(ex.primary)}</div></div>
      <div class="field"><span>Secondary muscles</span><div class="chips wrap mus" id="pe-sec">${muscleChips(ex.secondary)}</div></div>
      <div class="field"><span>Substitute (shown on pain)</span><input id="pe-sub" type="text" value="${A.esc(ex.substitute)}"></div>
      <div class="field"><span>Notes</span><input id="pe-notes" type="text" value="${A.esc(ex.notes)}"></div>
      <label class="toggle"><input id="pe-drop" type="checkbox" ${ex.rules?.dropSet ? 'checked' : ''}><span>Allow drop-set mode</span></label>
      <label class="toggle"><input id="pe-rehab" type="checkbox" ${ex.rules?.rehab ? 'checked' : ''}><span>Rehab rule (go up only when pain-free)</span></label>
      <button class="btn primary block big" data-a="pe-save" data-i="${i}">Save</button>
      ${isNew ? '' : `<div class="list-group">
        <button class="list-row" data-a="plan-swap" data-i="${i}"><span class="grow">Swap exercise</span></button>
        ${(() => { const items = A.db.plan[day].items; const linked = items.filter((x) => groupNum(x.group) === groupNum(it.group)).length > 1;
          return linked ? `<button class="list-row" data-a="plan-unlink" data-i="${i}"><span class="grow">Unlink from group</span></button>`
            : i < items.length - 1 ? `<button class="list-row" data-a="plan-link-next" data-i="${i}"><span class="grow">Superset with next exercise</span></button>` : ''; })()}
        <button class="list-row" data-a="plan-up" data-i="${i}" ${i === 0 ? 'disabled' : ''}><span class="grow">Move up</span></button>
        <button class="list-row" data-a="plan-down" data-i="${i}" ${i === A.db.plan[day].items.length - 1 ? 'disabled' : ''}><span class="grow">Move down</span></button>
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
    const ex = A.db.exercises[exId];
    A.$('#pe-cat').value = ex?.category || 'accessory';
    A.$('#pe-pattern').value = ex?.pattern || '';
    A.$('#pe-prim').innerHTML = muscleChips(ex?.primary);
    A.$('#pe-sec').innerHTML = muscleChips(ex?.secondary);
    if (ex) {
      A.$('#pe-type').value = ex.type;
      A.$('#pe-inc').value = toDisp(ex.increment);
      A.$('#pe-weight').value = getState(A.db, exId).targetWeight ?? '';
      A.$('#pe-sub').value = ex.substitute || '';
      A.$('#pe-notes').value = ex.notes || '';
      A.$('#pe-rir').value = ex.minRir || 0;
      A.$('#pe-drop').checked = !!ex.rules?.dropSet;
      A.$('#pe-rehab').checked = !!ex.rules?.rehab;
    }
  }

  function savePlanEdit(i) {
    const day = A.ui.planDay;
    const items = A.db.plan[day].items;
    let exId = A.$('#pe-ex').value;
    const type = A.$('#pe-type').value;
    if (exId === '__new') {
      const name = A.$('#pe-name').value.trim();
      if (!name) return A.toast('Enter a name for the new exercise.');
      exId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise';
      while (A.db.exercises[exId]) exId += '-2';
      A.db.exercises[exId] = {
        id: exId, name, type, increment: A.db.settings.defaultIncrements[type] || 5, substitute: '', notes: '', minRir: 0, rules: {},
        startWeight: null, category: 'accessory', pattern: '', primary: [], secondary: [], customMeta: true,
      };
    }
    const ex = A.db.exercises[exId];
    const meta = {
      category: A.$('#pe-cat').value,
      pattern: A.$('#pe-pattern').value,
      primary: chosenMuscles('pe-prim'),
      secondary: chosenMuscles('pe-sec').filter((m) => !chosenMuscles('pe-prim').includes(m)),
    };
    // Hand-edited classification is kept even when the built-in bank is updated.
    if (JSON.stringify(meta) !== JSON.stringify({ category: ex.category, pattern: ex.pattern || '', primary: ex.primary, secondary: ex.secondary })) {
      Object.assign(ex, meta, { customMeta: true });
    }
    const intOr = (id, d) => { const v = parseInt(A.$(`#${id}`).value, 10); return Number.isFinite(v) ? v : d; };
    const repMin = Math.max(1, intOr('pe-min', 8));
    const repMax = Math.max(repMin, intOr('pe-max', 12));
    const slot = {
      group: A.$('#pe-group').value.trim() || String(items.length + 1),
      sets: Math.max(1, intOr('pe-sets', 3)),
      repMin, repMax,
      restSec: Math.max(0, intOr('pe-rest', 90)),
      note: A.$('#pe-note').value.trim(),
    };
    // Rotation: chosen variations, in the order shown, starting with this exercise.
    const rot = document.querySelector('[data-a="pe-rot"].on')?.dataset.v || '';
    const vars = [...document.querySelectorAll('#pe-variants .chip.on')].map((b) => b.dataset.id);
    const prevItem = i === -1 ? null : items[i];
    if (rot === 'lock') Object.assign(slot, { lock: true, rotate: undefined, variants: undefined, autoVar: undefined });
    else if (rot && rot !== 'auto' && vars.length > 1) Object.assign(slot, { lock: undefined, autoVar: undefined, rotate: rot, variants: vars.includes(exId) ? [exId, ...vars.filter((v) => v !== exId)] : vars });
    else { slot.lock = undefined; if (!prevItem?.autoVar) { slot.rotate = undefined; slot.variants = undefined; } }
    const metric = A.$('#pe-metric')?.value || 'reps';
    if (metric !== 'reps' || ex.category === 'conditioning') {
      slot.metric = metric;
      slot.target = intOr('pe-target', metric === 'reps' ? repMax : metric === 'time' ? 30 : metric === 'distance' ? 100 : 10);
    } else { slot.metric = undefined; slot.target = undefined; }
    if (i === -1) items.push({ uid: `${day}-${Date.now()}`, exerciseId: exId, ...slot });
    else {
      const it = items[i];
      // Changing the exercise on a rotating slot turns the rotation off for that slot.
      const resolved = resolveDay(A.db, day).find((r) => r.uid === it.uid);
      if (it.role && resolved && resolved.exerciseId !== exId) delete it.role;
      if (!it.role && it.exerciseId !== exId) { it.exerciseId = exId; it.manual = true; }
      Object.assign(it, slot);
    }
    ex.type = type;
    ex.increment = fromDisp(A.num('pe-inc')) || ex.increment;
    ex.minRir = Math.max(0, intOr('pe-rir', 0));
    ex.substitute = A.$('#pe-sub').value.trim();
    ex.notes = A.$('#pe-notes').value.trim();
    ex.rules = { ...ex.rules, dropSet: A.$('#pe-drop').checked, rehab: A.$('#pe-rehab').checked };
    const w = A.num('pe-weight');
    const st = A.db.state[exId] || {};
    st.targetWeight = w;
    A.db.state[exId] = st;
    A.persist();
    A.closeSheet();
    A.render();
  }

  return { builderEntry, planViewTabs, subHeader, screenPlan, planWeek, planProgram, planDay, openPlanEdit, muscleChips, chosenMuscles, fillMeta, savePlanEdit };
}

// One day of a future week, read only.
export function weekPeek(A, day, off) {
  const start = addDays(mondayOf(todayStr()), off * 7);
  const date = addDays(start, weekOrder().indexOf(day));
  const p = A.db.plan[day];
  const b = blockInfo(A.db, start);
  const items = resolveDay(A.db, day, { template: true });
  const rows = items.map((it) => {
    const metric = it.metric || it.ex.metric || 'reps';
    const n = b.isDeload ? deloadDose(A.db, it).sets : it.sets;
    const dose = metric === 'reps' ? `${n} × ${it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`}` : `${n} × ${fmtTarget(metric, it.target)}`;
    return `<div class="kv"><span>${A.esc(it.ex.name)}</span><b>${dose}</b></div>`;
  }).join('');
  return `<h2>${A.esc(p?.name || 'Workout')}</h2>
    <p class="muted small">${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}${b.isDeload ? ` · Deload week: ${A.esc(deloadText(A.db).toLowerCase())}` : ''}</p>
    <div class="kv-list">${rows}</div>
    <p class="muted small">Weights are set from your latest workouts when the day arrives. Changes to your plan show here too.</p>
    <button class="btn block" data-a="close-sheet">Close</button>`;
}
