// Plan builder: goals and profile, the generated plan, and applying it.
// Split out of app.js. App state and the helpers this needs come from A: live getters (and
// setters for variables), so db and the rest stay shared with app.js.
import { DAY_KEYS, DAY_NAMES, PROGRESSIONS, e1rm, recommendScheme, roundTo } from './engine.js';
import { EQUIPMENT, EXPERIENCE, GOALS, LIMITS, VOLUME_MUSCLES, WEEK_LAYOUT, WEIGHT_GOALS, defaultProfile, fmtSec, generatePlan, goalWeights, mainLiftOptions, secondLiftOptions, liftChoices, prescription, splitOptions, splitTemplates, suggestDays, suggestedWeightGoal, volumeTarget } from './builder.js';
import { activeGym } from './gym.js';
import { REFS } from './science.js';
import { fromDisp, toDisp, wUnit } from './units.js';
import { safetySnapshot, weekOrder } from './store.js';
import { GROUPS } from './groups.js';
import { GOALS as MGOALS, applyGoals } from './goals.js';
import { VARIETY, applyVariety } from './variety.js';
import { CORE_PLACEMENTS, applyCore } from './core.js';
import { icon } from './icons.js';
import { MUSCLES } from './bank.js';
import { countManual, keepManual } from './ui-plantools.js';
import { blockInfo } from './blocks.js';

export function createBuilderScreens(A) {
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
      const ex = A.db.exercises[it.exerciseId];
      if (ex?.category === 'compound' && !seen.has(ex.id)) seen.set(ex.id, ex);
    }
    return [...seen.values()];
  }

  // A lift list with the recommended few first, then everything else.
  function groupedOptions({ top, rest }, sel, skip = null) {
    const opt = (e) => (e.id === skip ? '' : `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${A.esc(e.name)}</option>`);
    return `${top.length ? `<optgroup label="Recommended">${top.map(opt).join('')}</optgroup>` : ''}${rest.length ? `<optgroup label="${top.length ? 'More lifts' : 'Lifts'}">${rest.map(opt).join('')}</optgroup>` : ''}`;
  }

  // Focus lifts: each day's main lift, plus any second focus lift chosen for a day.
  function builderFocus(p, out) {
    const ids = [];
    for (const d of Object.values(out?.plan || {})) {
      for (const it of d.items) if (/Focus lift|Second focus lift/.test(it.note || '') && !ids.includes(it.exerciseId)) ids.push(it.exerciseId);
    }
    return ids;
  }

  const B_STEPS = ['About you', 'Goals', 'Schedule', 'Split', 'Review'];

  const BUILD_LABELS = { lean: 'Lean', average: 'Average', higher: 'Higher body fat' };

  function openBuilder() {
    const base = defaultProfile(A.db);
    // First time: no guessed age, height or weight (they drive calorie and protein targets).
    const draft = A.db.profile ? { ...base, ...JSON.parse(JSON.stringify(A.db.profile)) } : { ...base, age: '', heightIn: '', weightLb: A.latestBodyweight() || '' };
    delete draft.rx;
    draft.equipment = [...activeGym(A.db).equipment]; // the builder works with the active gym's equipment
    A.ui.b = { step: 0, draft, liftEdited: !!A.db.profile, cardioEdited: !!A.db.profile, splitEdited: !!A.db.profile };
    A.ui.tab = 'builder';
    window.scrollTo(0, 0);
    A.render();
  }

  function refLinks(ids) {
    return ids.map((id) => `<a class="ref" href="#ref-${id}" data-a="b-ref" data-id="${id}">${refNum(id)}</a>`).join('');
  }

  const REF_ORDER = Object.keys(REFS);

  const refNum = (id) => REF_ORDER.indexOf(id) + 1;

  function builderState() {
    const p = A.ui.b.draft;
    const rx = prescription(p);
    const sug = suggestDays(p, rx);
    if (!A.ui.b.liftEdited || !p.liftDays) p.liftDays = sug.lift;
    if (!A.ui.b.cardioEdited || p.cardioDays == null) p.cardioDays = sug.cardio;
    const opts = splitOptions(p.liftDays);
    if (!A.ui.b.splitEdited || !opts.some((o) => o.id === p.split)) p.split = (opts.find((o) => o.recommended) || opts[0]).id;
    return { p, rx, sug, opts };
  }

  // Strength-first goals suit a strength scheme: add weight for newer lifters, cycles once that stalls.
  const recommendProgression = (p) => recommendScheme(p);

  // Progression picker: one row per scheme with what it is and who it suits.
  function progressionList(cur, rec, action) {
    return `<div class="choice-list" role="radiogroup" aria-label="Progression">${Object.entries(PROGRESSIONS).map(([k, v]) => `<button class="choice ${cur === k ? 'on' : ''}" data-a="${action}" data-v="${k}" data-k="progression" role="radio" aria-checked="${cur === k}">
      <span class="grow"><b>${v.name}${rec === k ? ' <span class="tag">Suggested</span>' : ''}</b><span class="pick-sub">${v.short} · ${v.fit}</span></span><span class="radio-dot" aria-hidden="true"></span></button>`).join('')}</div>
      <p class="muted small">${PROGRESSIONS[cur].desc} ${A.refChips(PROGRESSIONS[cur].refs)}</p>`;
  }

  const helpBtn = () => '<button class="help-btn" data-a="help" aria-expanded="false" aria-label="What is this?">?</button>';

  function bChips(key, options, current, multi = false) {
    return `<div class="chips wrap">${Object.entries(options).map(([v, label]) => {
      const on = multi ? (current || []).includes(v) : String(current ?? '') === v;
      return `<button class="chip ${on ? 'on' : ''}" data-a="b-set" data-k="${key}" data-v="${v}" ${multi ? 'data-multi="1"' : ''} aria-pressed="${on}">${label}</button>`;
    }).join('')}</div>`;
  }

  function screenBuilder() {
    if (!A.ui.b) openBuilder();
    const { p, rx, sug, opts } = builderState();
    const step = A.ui.b.step;
    let body = '';

    if (step === 0) {
      const bc = rx.bodyClass;
      body = `
        <div class="card">
          <div class="grid2">
            <div class="field"><span>Age</span><input type="text" inputmode="numeric" data-b="age" value="${A.esc(p.age)}" placeholder="e.g. 30"></div>
            <div class="field"><span>Weight (${wUnit()})</span><input type="text" inputmode="decimal" data-b="weightLb" value="${A.esc(p.weightLb === '' || p.weightLb == null ? '' : toDisp(p.weightLb))}" placeholder="${wUnit() === 'kg' ? 'e.g. 80' : 'e.g. 175'}"></div>
            <div class="field"><span>Height (ft)</span><input type="text" inputmode="numeric" data-b="heightFt" value="${p.heightIn ? Math.floor(p.heightIn / 12) : ''}" placeholder="e.g. 5"></div>
            <div class="field"><span>Height (in)</span><input type="text" inputmode="numeric" data-b="heightInch" value="${p.heightIn ? p.heightIn % 12 : ''}" placeholder="e.g. 9"></div>
          </div>
          <div class="field"><span>Sex ${helpBtn()}</span><p class="help-text" hidden>Optional. Only used to interpret body fat %.</p>${bChips('sex', { '': 'Prefer not to say', male: 'Male', female: 'Female' }, p.sex)}</div>
          <div class="field"><span>Body fat % ${helpBtn()}</span><p class="help-text" hidden>Optional. If you know it, calorie and protein targets use your lean mass.</p><input type="text" inputmode="decimal" data-b="bodyFat" value="${A.esc(p.bodyFat)}" placeholder="e.g. 18"></div>
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
        <button class="card ev-card ev-empty" data-a="ev-choose"><span class="grow"><b>${A.db.event ? 'Your race or meet' : 'Training for a race or meet?'}</b><span class="muted small">${A.db.event ? 'One is set. Tap to change it.' : 'Running, cycling, triathlon or powerlifting: set a date and a target'}</span></span></button>
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
          <div class="field"><span>Days ${helpBtn()}</span><p class="help-text" hidden>The weekdays you lift. You can adjust any single week later.</p><div class="chips wrap" role="group" aria-label="Lifting days">${weekOrder().map((d) => {
            const on = liftDayKeys(p).includes(d);
            return `<button class="chip ${on ? 'on' : ''}" data-a="b-weekday" data-v="${d}" aria-pressed="${on}">${DAY_NAMES[d]}</button>`;
          }).join('')}</div></div>
          <div class="field"><span>Cardio sessions per week · suggested <b>${sug.cardio}</b> (${rx.cardioMin} min)</span>${dayChips('cardioDays', 0, 7, p.cardioDays)}</div>
          ${A.ui.b.liftEdited || A.ui.b.cardioEdited ? '<button class="mini" data-a="b-suggested">Use suggested days</button>' : ''}
          <ul class="reasons small muted">${sug.reasons.map((r) => `<li>${A.esc(r)}</li>`).join('')}</ul>
          <p class="muted small">Cardio sessions go on non-lifting days first, then after lifting on upper-body days.</p>
        </div>
        <div class="card">
          <div class="field"><span>Workout length ${helpBtn()}</span><p class="help-text" hidden>How long you usually have. Shorter workouts use more supersets and fewer accessories.</p>${bChips('sessionMin', { 30: '30 min', 45: '45 min', 60: '60 min', 75: '75 min', 90: '90 min', 105: '105 min', 120: '120 min' }, p.sessionMin)}</div>
          <details class="pain-list"><summary>Different goals for different muscles</summary>
            <p class="muted small">Optional. For example size for arms, strength for chest, endurance for legs.</p>
            ${GROUPS.filter((g) => g.id !== 'core' && g.id !== 'lower-back' && g.id !== 'forearms').map((g) => `<div class="mgoal-row"><span>${g.name}</span><select data-a="b-mgoal" data-g="${g.id}" aria-label="Goal for ${g.name}">${[['', 'Plan default'], ...Object.entries(MGOALS).map(([k, v]) => [k, v.name])].map(([k, l]) => `<option value="${k}" ${(p.muscleGoals?.[g.id] || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}
          </details>
          <div class="field"><span>Variety ${helpBtn()}</span><p class="help-text" hidden>How often exercises change. Focus lifts always stay the same.</p>${bChips('variety', Object.fromEntries(Object.entries(VARIETY).map(([k, v]) => [k, v.name])), p.variety || 'low')}
            <p class="muted small">${VARIETY[p.variety || 'low'].desc} ${A.refChips(['kassiano2022', 'bazvalle2019', 'fonseca2014'])}</p></div>
          <div class="field"><span>For your focus lifts ${helpBtn()}</span><p class="help-text" hidden>How your focus lifts move forward. Every other lift adds reps, then weight. You can also pick a progression for any single lift from its options.</p>${progressionList(p.progression || recommendProgression(p), recommendProgression(p), 'b-set')}</div>
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
          return `<div class="card"><h3>Your week ${helpBtn()}</h3><p class="help-text" hidden>Use the arrows to change the order of the days. Each day is built around its main lift, with an optional second focus lift after it. Focus lifts get your progression method and are reviewed at each deload; everything else is filled in to match.</p>
            ${order.map((t, i) => {
              const optsM = mainLiftOptions(A.db, p, t);
              const cur = p.mainLift?.[t] || optsM[0]?.id;
              return `<div class="order-row"><b class="order-day">${DAY_NAMES[days[i]]}</b>
                <div class="grow"><span class="order-name">${splitDayName(t)}</span>
                  <label class="focus-pick"><span>Main lift</span><select data-a="b-main" data-k="${t}" aria-label="Main lift for ${splitDayName(t)}">${groupedOptions(liftChoices(A.db, p, t, 'main', prescription(p)), cur)}</select></label>
                  <label class="focus-pick"><span>Second focus</span><select data-a="b-second" data-k="${t}" aria-label="Second focus lift for ${splitDayName(t)}"><option value="">None</option>${groupedOptions(liftChoices(A.db, p, t, 'second', prescription(p)), p.secondLift?.[t], cur)}</select></label></div>
                <button class="icon-btn" data-a="b-order" data-i="${i}" data-v="-1" aria-label="Move ${splitDayName(t)} earlier" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
                <button class="icon-btn" data-a="b-order" data-i="${i}" data-v="1" aria-label="Move ${splitDayName(t)} later" ${i === order.length - 1 ? 'disabled' : ''}>${icon('arrowDown')}</button></div>`;
            }).join('')}</div>`;
        })()}`;
    } else {
      let out;
      try { out = generatePlan(A.db, p, rx, p.liftDays, p.cardioDays, p.split); } catch (e) { out = null; body = `<p class="flag bad">${A.esc(e.message)}</p>`; }
      A.ui.b.out = out;
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
      ['Focus lifts', `${rx.mainSets} × ${rx.main[0]}–${rx.main[1]} · rest ${fmtSec(rx.restMain)}`],
      ['Other compounds', `${rx.sets} × ${rx.comp[0]}–${rx.comp[1]} · rest ${fmtSec(rx.rest)}`],
      ['Isolation', `${rx.isoSets} × ${rx.iso[0]}–${rx.iso[1]} · rest ${fmtSec(rx.restIso)}${rx.pairIso ? ' · supersets' : ''}`],
      ['Effort', `${rx.rir} reps in reserve`],
      ['Weekly sets / muscle', `${rx.weekly[0]}–${rx.weekly[1]}`],
      ['Cardio', `${rx.cardioMin} min/week · ~80% easy${rx.preferLowImpact ? ' · low impact' : ''}`],
      ['Deload', `every ${rx.deloadEvery} weeks`],
      ['Bodyweight', rx.weightGoal === 'gain' ? `+${rx.rate[0]}–${rx.rate[1]}%/week` : rx.weightGoal === 'lose' ? `−${rx.rate[0]}–${rx.rate[1]}%/week` : 'maintain'],
    ];
    const week = weekOrder().map((d) => {
      const mode = out.dayModes[d];
      const day = out.plan[d];
      const label = day ? `${A.esc(day.name)} · ~${out.minutes[d]} min${mode === 'both' ? ' + cardio' : ''}` : mode === 'cardio' ? 'Cardio' : 'Rest';
      if (!day) return `<div class="list-row"><span class="day-k">${DAY_NAMES[d]}</span><span class="grow muted">${label}</span></div>`;
      return `<details class="day-detail"><summary class="list-row"><span class="day-k">${DAY_NAMES[d]}</span><span class="grow"><b>${label}</b></span>${icon('right', 'chev')}</summary>
        ${day.items.map((it) => `<div class="b-item"><span class="tag">${A.esc(it.group)}</span><span class="grow">${A.esc(A.db.exercises[it.exerciseId].name)}${it.note ? `<span class="pick-sub">${A.esc(it.note)}</span>` : ''}</span><span class="muted small">${it.sets} × ${it.repMin}–${it.repMax}</span></div>`).join('')}
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
        <p class="muted small">Starting weights are blank: your first workout sets them. Pick a weight you could do for about ${rx.rirLo + 2} more reps than the bottom of the range.</p>
      </div>
      <div class="card"><h3>Your week</h3>${week}<p class="muted small">You can swap any exercise or edit sets and reps after applying.</p>
        ${countManual(A.db.plan) ? `<label class="toggle"><input type="checkbox" data-a="b-keep" ${p.keepManual !== false ? 'checked' : ''}><span>Keep ${countManual(A.db.plan)} exercise${countManual(A.db.plan) === 1 ? '' : 's'} I chose</span></label>` : ''}</div>
      <div class="card"><h3>Focus lifts</h3>
        <p class="small">${builderFocus(p, out).map((id) => A.esc(A.db.exercises[id]?.name || id)).join(', ') || 'None yet'}</p>
        <p class="muted small">Each day's main lift and second focus, set on the Split step. They get your progression method and are reviewed at every deload.</p></div>
      <div class="card"><h3>Weekly sets per muscle</h3>
        <div class="vol-row head"><span>Muscle</span><span>Planned</span><span>Target</span><span></span></div>${vol}
        <p class="muted small">A set counts ½ for muscles that only assist ${refLinks(['pelland2026'])}. Some low counts are a trade-off for your workout length.</p></div>
      <div class="card"><h3>Why these numbers</h3>
        ${rx.why.map((x) => `<p class="why"><b>${x.k}.</b> ${A.esc(x.t)} ${refLinks(x.refs)}</p>`).join('')}
        <details class="refs"><summary>References (${usedRefs.length})</summary>
          <ol>${usedRefs.map((id) => `<li id="ref-${id}" value="${refNum(id)}"><a href="${REFS[id].url}" target="_blank" rel="noopener">${A.esc(REFS[id].cite)}</a><span class="muted small block">${A.esc(REFS[id].finding)}</span></li>`).join('')}</ol>
        </details>
        <p class="muted small">These are evidence-based starting points, not medical advice. Check with a doctor before starting if you have health conditions.</p>
      </div>`;
  }

  function retargetWeights(plan) {
    for (const day of Object.values(plan)) {
      for (const it of day.items) {
        const st = A.db.state[it.exerciseId];
        const ex = A.db.exercises[it.exerciseId];
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

  async function applyBuilt() {
    const { p, rx } = builderState();
    const out = A.ui.b.out;
    if (!out) return;
    if (!A.ui.b.quick && !(await A.ask('Replace your current plan with this one? Workout history and targets are kept, and you can undo from the Plan tab.', 'Replace plan'))) return;
    safetySnapshot(A.db, 'Before new plan');
    A.db.previousPlan = { plan: A.db.plan, dayModes: { ...A.db.settings.dayModes }, deloadEvery: A.db.settings.deloadEvery, savedAt: Date.now() };
    activeGym(A.db).equipment = [...p.equipment];
    const oldPlan = A.db.plan;
    A.db.plan = out.plan;
    if (p.keepManual !== false) keepManual(A.db, oldPlan, A.db.plan);
    A.db.muscleGoals = { ...(p.muscleGoals || {}) };
    applyGoals(A.db);
    A.db.settings.dayModes = out.dayModes;
    A.db.settings.deloadEvery = rx.deloadEvery;
    A.db.settings.welcomed = true;
    A.db.settings.planSince = A.todayStrNow();
    A.db.profile = {
      ...p, builtAt: Date.now(),
      rx: {
        cardioMin: rx.cardioMin, easyShare: rx.easyShare, preferLowImpact: rx.preferLowImpact, weightGoal: rx.weightGoal, rate: rx.rate,
        rir: rx.rir, rirLo: rx.rirLo, weekly: rx.weekly, includePhysique: rx.includePhysique, bodyClass: rx.bodyClass.cls,
      },
    };
    retargetWeights(out.plan);
    A.db.blocks.focus[blockInfo(A.db).index] = builderFocus(p, out);
    applyCore(A.db, p.corePlacement || 'end');
    A.db.settings.progression = p.progression || recommendProgression(p);
    A.db.settings.warmupRoutine = (p.routines || []).includes('warm');
    A.db.settings.cooldownRoutine = (p.routines || []).includes('cool');
    applyVariety(A.db, p.variety || 'low', A.db.blocks.focus[blockInfo(A.db).index] || []);
    A.persist();
    A.ui.b = null;
    A.ui.tab = 'plan';
    A.ui.planDay = Object.keys(out.plan)[0];
    window.scrollTo(0, 0);
    A.render();
    A.toast('New plan applied. Swap or edit anything in Plan.');
  }

  function builderInput(el) {
    const p = A.ui.b.draft;
    const k = el.dataset.b;
    if (k === 'heightFt' || k === 'heightInch') {
      const ft = parseInt(A.$('[data-b="heightFt"]').value, 10) || 0;
      const inch = parseInt(A.$('[data-b="heightInch"]').value, 10) || 0;
      p.heightIn = ft * 12 + inch || '';
    } else if (k === 'bodyFat') p.bodyFat = el.value.trim();
    else {
      const v = parseFloat(el.value);
      p[k] = Number.isFinite(v) ? (k === 'weightLb' ? fromDisp(v) : v) : '';
    }
  }

  return { liftDayKeys, builderCompounds, builderFocus, B_STEPS, BUILD_LABELS, openBuilder, refLinks, REF_ORDER, refNum, builderState, recommendProgression, progressionList, helpBtn, bChips, screenBuilder, SPLIT_DAY_NAMES, splitDayName, reviewHtml, retargetWeights, applyBuilt, builderInput };
}
