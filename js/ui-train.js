// Flexible training: the week planner, adjust-today, recovery check-ins and routines, finishers,
// conditioning targets, the running goal, and sharing/installing the app.
import { icon } from './icons.js';
import { DAY_KEYS, RECOVERY_GROUPS, resolveDay, weekOverride, groupOf } from './engine.js';
import { todayStr, mondayOf, addDays } from './store.js';
import { estimateMinutes } from './builder.js';
import { composeWeek, adjustDay, splitDay, liftTemplates, doneTemplates, missedTemplates, todayKey, dayIndex } from './week.js';
import { dueChecks, record, notReady, learnSlowRecovery, RATINGS, groupSets } from './recovery.js';
import { TEMPLATES, buildFinisher, condHistory, condTarget, fmtTarget } from './conditioning.js';
import { RUN_KINDS, runKinds, scheduleRuns, goalWeek, paces, fmtClock, parseClock, weekRuns } from './running.js';
import { liftLoads } from './fatigue.js';

const MIN_CHOICES = [20, 30, 45, 60, 75, 90, 120];
const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const FULL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const APP_URL = 'https://jbroefitzpatrick.github.io/lift-tracker/';

export function createTrain(ctx) {
  const { $, esc } = ctx;
  const st = { avail: null, fin: { minutes: 10, mode: 'burn', format: 'rounds' }, adjust: null, run: null };
  const defMin = () => +ctx.db.profile?.sessionMin || 60;

  // ---------- Week planner ----------

  function defaultAvail(n) {
    const db = ctx.db;
    const from = dayIndex(todayKey());
    const days = DAY_KEYS.filter((d) => dayIndex(d) >= from);
    const prev = db.week?.start === mondayOf(todayStr()) ? db.week.avail || {} : {};
    const done = doneTemplates(db);
    const out = {};
    if (n != null) {
      // n days spread evenly over what's left of the week
      const pick = new Set();
      const k = Math.min(n, days.length);
      // Even spacing from today (2 of 7 → Mon and Fri, 3 → Mon, Wed, Sat) leaves recovery between sessions.
      for (let i = 0; i < k; i++) pick.add(days[Math.min(days.length - 1, Math.round((i * days.length) / k))]);
      for (const d of days) out[d] = { on: pick.has(d), minutes: prev[d]?.minutes || defMin(), gymId: prev[d]?.gymId || '' };
      return out;
    }
    const planned = liftTemplates(db).filter((t) => !done.has(t.day)).map((t) => t.day);
    for (const d of days) out[d] = prev[d] || { on: planned.includes(d), minutes: defMin(), gymId: '' };
    return out;
  }

  function plannerBody() {
    const db = ctx.db;
    const gyms = db.gyms.length > 1;
    const rows = Object.entries(st.avail).map(([d, a]) => `<div class="avail-row ${a.on ? 'on' : ''}">
      <label class="avail-day"><input type="checkbox" data-wk="${d}:on" ${a.on ? 'checked' : ''}><span>${SHORT[d]}${d === todayKey() ? ' · today' : ''}</span></label>
      <select data-wk="${d}:minutes" aria-label="${FULL[d]} minutes" ${a.on ? '' : 'disabled'}>${MIN_CHOICES.map((m) => `<option value="${m}" ${+a.minutes === m ? 'selected' : ''}>${m} min</option>`).join('')}</select>
      ${gyms ? `<select data-wk="${d}:gymId" aria-label="${FULL[d]} gym" ${a.on ? '' : 'disabled'}><option value="">Usual gym</option>${db.gyms.map((g) => `<option value="${g.id}" ${a.gymId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>` : ''}
    </div>`).join('');
    const { week, summary } = composeWeek(db, st.avail);
    const preview = DAY_KEYS.filter((d) => st.avail[d]).map((d) => {
      const v = week.days[d];
      if (!v?.items?.length) return `<div class="wk-day muted"><b>${SHORT[d]}</b><span>${st.avail[d].on ? 'Free: cardio or recovery' : 'Rest'}</span></div>`;
      const lifts = v.items.filter((i) => db.exercises[i.exerciseId]?.category !== 'conditioning');
      return `<div class="wk-day"><b>${SHORT[d]}</b><span><b>${esc(v.name)}</b> · ${lifts.length} exercises · ~${estimateMinutes(lifts)} min</span></div>`;
    }).join('');
    return `<div class="avail-list">${rows}</div>
      <h3 class="sheet-h">This week</h3>
      <div class="wk-preview">${preview}</div>
      ${summary.length ? `<ul class="wk-notes">${summary.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`;
  }

  function openPlanner(n = null) {
    st.avail = defaultAvail(n);
    const left = DAY_KEYS.length - dayIndex(todayKey());
    ctx.openSheet(`<h2>Plan this week</h2>
      <p class="muted small">Pick the days you can train and how long you have. Every main lift still gets done; accessories are fitted to your time. Your normal plan is unchanged and comes back next week.</p>
      <div class="chips" role="group" aria-label="Number of days">${Array.from({ length: Math.min(6, left) }, (_, i) => `<button class="chip ${n === i + 1 ? 'on' : ''}" data-a="wk-n" data-v="${i + 1}">${i + 1} day${i ? 's' : ''}</button>`).join('')}</div>
      <div id="wk-body">${plannerBody()}</div>
      <button class="btn primary block big" data-a="wk-apply">Use this week</button>
      ${ctx.db.week?.start === mondayOf(todayStr()) ? '<button class="btn block" data-a="wk-reset">Back to my normal plan</button>' : ''}
      <button class="btn plain block" data-a="close-sheet">Cancel</button>
      <p class="muted small">Weekly volume matters more than which day it lands on. ${ctx.refChips(['schoenfeld2016freq'])}</p>`);
  }

  function refreshPlanner() { const el = $('#wk-body'); if (el) el.innerHTML = plannerBody(); }

  // Today: missed sessions, and early in the week a quick "how many days?" prompt.
  function weekPrompt() {
    const db = ctx.db;
    const start = mondayOf(todayStr());
    if (db.settings.weekPromptDismissed === `${start}:${todayStr()}`) return '';
    const missed = missedTemplates(db);
    const planned = db.week?.start === start;
    if (missed.length && !planned) {
      return `<div class="notice-card week-prompt"><p><b>Missed ${missed.map((t) => `${FULL[t.day]}'s ${esc(t.name)}`).join(' and ')}?</b> Fit ${missed.length > 1 ? 'them' : 'it'} into the rest of the week. Main lifts first, accessories as time allows.</p>
        <div class="row"><button class="btn primary" data-a="wk-open">Rearrange my week</button><button class="btn" data-a="wk-dismiss">Not now</button></div></div>`;
    }
    if (!planned && dayIndex(todayKey()) <= 1 && liftTemplates(db).length) {
      const left = 7 - dayIndex(todayKey());
      return `<div class="notice-card week-prompt"><div class="row between"><b>How many days can you train this week?</b><button class="icon-btn subtle" data-a="wk-dismiss" aria-label="Dismiss">${icon('x')}</button></div>
        <div class="chips">${Array.from({ length: Math.min(6, left) }, (_, i) => `<button class="chip" data-a="wk-open" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
        <p class="muted small">Or ignore this and follow your plan as usual.</p></div>`;
    }
    return '';
  }

  // ---------- Adjust today ----------

  function openAdjust(day) {
    const db = ctx.db;
    const o = weekOverride(db, day);
    st.adjust = { day, minutes: o?.minutes || null, gymId: o?.gymId || '' };
    const lifts = resolveDay(db, day).filter((i) => i.ex.category !== 'conditioning');
    const est = estimateMinutes(lifts);
    ctx.openSheet(`<h2>Adjust ${day === todayKey() ? 'today' : FULL[day]}</h2>
      <p class="muted small">Planned: about ${est} min. Pick the time you have; supersets and accessories adjust to fit, and main lifts stay.</p>
      <div class="field"><span>Time available</span><div class="chips">${MIN_CHOICES.map((m) => `<button class="chip ${st.adjust.minutes === m ? 'on' : ''}" data-a="adj-min" data-v="${m}">${m} min</button>`).join('')}</div></div>
      ${db.gyms.length > 1 ? `<div class="field"><span>Where you're training</span><select id="adj-gym"><option value="">Usual gym</option>${db.gyms.map((g) => `<option value="${g.id}" ${st.adjust.gymId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>` : '<p class="muted small">Training somewhere with less equipment? Add it under Settings → Gym & equipment, then pick it here.</p>'}
      <button class="btn primary block big" data-a="adj-apply">Apply</button>
      <div class="list-group">
        <button class="list-row" data-a="adj-split"><span class="grow">Two shorter sessions today<span class="pick-sub">Do the first half now, the rest later</span></span>${icon('right', 'chev')}</button>
        ${o ? `<button class="list-row" data-a="adj-reset"><span class="grow">Back to the planned workout</span>${icon('right', 'chev')}</button>` : ''}
      </div>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  // ---------- Recovery ----------

  // The daily "how do you feel" question for groups trained in the last few days.
  function recoveryCheck() {
    const db = ctx.db;
    let html = '';
    const due = dueChecks(db);
    if (due.length) {
      html += `<section class="card recov-card" aria-label="Recovery check"><h3>How do you feel today?</h3>
        ${due.map((c) => `<div class="recov-row"><span class="grow"><b>${esc(c.name)}</b><span class="pick-sub">Trained ${c.hours < 36 ? 'yesterday' : `${Math.round(c.hours / 24)} days ago`}</span></span>
          <div class="seg-mini" role="group" aria-label="${esc(c.name)}">${RATINGS.map(([l, v]) => `<button data-a="rec-rate" data-g="${c.group}" data-v="${v}" data-s="${c.sessionId}" data-h="${Math.round(c.hours)}">${l}</button>`).join('')}</div></div>`).join('')}
        <p class="muted small">Your answers teach the app how fast you recover. ${ctx.refChips(['laurent2011'])}</p></section>`;
    }
    return html;
  }

  // Today's planned muscles aren't ready: offer alternatives.
  function recoveryCards(day, items) {
    const db = ctx.db;
    let html = '';
    if (day === todayKey() && !ctx.sessionFor(day) && items.length) {
      const nr = notReady(db, items, ctx.fresh());
      if (nr.length) {
        const g = nr[0];
        const alt = swapCandidate(day, g.group);
        html += `<section class="card notready-card" aria-label="Not recovered"><h3>${esc(g.name)} not recovered yet</h3>
          <p class="small">You said ${esc(g.name.toLowerCase())} ${g.rating === 2 ? 'are very sore' : 'are still sore'}. Some options:</p>
          <div class="list-group flush-inner">
            ${alt ? `<button class="list-row" data-a="rec-swap" data-g="${g.group}" data-t="${alt.day}"><span class="grow">Do ${esc(alt.name)} today instead<span class="pick-sub">Swap days; ${esc(g.name.toLowerCase())} get more time</span></span>${icon('right', 'chev')}</button>` : ''}
            <button class="list-row" data-a="rec-routine" data-g="${g.group}"><span class="grow">Recovery session<span class="pick-sub">${esc(recoveryTemplateFor([g.group]).name)}, ${recoveryTemplateFor([g.group]).minutes} min</span></span>${icon('right', 'chev')}</button>
            <button class="list-row" data-a="rec-cardio" data-g="${g.group}"><span class="grow">Easy cardio or a bodyweight circuit instead</span>${icon('right', 'chev')}</button>
            <button class="list-row" data-a="rec-lighter" data-g="${g.group}"><span class="grow">Train anyway, lighter<span class="pick-sub">One set fewer on ${esc(g.name.toLowerCase())} today</span></span>${icon('right', 'chev')}</button>
          </div>
          <p class="muted small">Next week's ${esc(g.name.toLowerCase())} sessions will be a set lighter so you recover faster.</p></section>`;
      }
    }
    return html;
  }

  function swapCandidate(day, group) {
    const db = ctx.db;
    const done = doneTemplates(db);
    const today = weekOverride(db, day)?.from || [day];
    return liftTemplates(db).find((t) => !done.has(t.day) && !today.includes(t.day)
      && (groupSets(db, resolveDay(db, t.day, { template: true }).map((i) => ({ exerciseId: i.exerciseId, sets: Array.from({ length: i.sets }, () => ({ done: true })) })))[group] || 0) < 6) || null;
  }

  function recoveryTemplateFor(groups) {
    const rec = TEMPLATES.filter((t) => t.kind === 'recovery' && t.groups);
    if (groups.includes('legs')) return rec.find((t) => t.id === 'recover-lower');
    if (groups.includes('push') || groups.includes('pull')) return rec.find((t) => t.id === 'recover-upper');
    return rec.find((t) => t.id === 'recover-full');
  }

  // Rest days and the day after a hard session: a nudge toward a short recovery routine.
  function recoveryReminder(day, mode) {
    const db = ctx.db;
    if (day !== todayKey() || ctx.sessionFor(day) || db.settings.recoveryDismissed === todayStr()) return '';
    const recent = db.sessions.filter((s) => Date.now() - (s.finishedAt || 0) < 36 * 3600000);
    const groups = [...new Set(recent.flatMap((s) => Object.entries(groupSets(db, s.entries)).filter(([, n]) => n >= 8).map(([g]) => g)))];
    // Rest and cardio days, or after today's workout — not before a lifting session.
    const trainedToday = db.sessions.some((s) => s.date === todayStr());
    if (mode !== 'rest' && mode !== 'cardio' && !trainedToday) return '';
    const tpl = recoveryTemplateFor(groups);
    return `<div class="slim-banner recov-banner"><span class="grow"><b>${esc(tpl.name)}</b><span class="pick-sub">${tpl.minutes} min of foam rolling and stretching${groups.length ? ` for ${groups.map((g) => RECOVERY_GROUPS[g].name.toLowerCase()).join(' and ')}` : ''}</span></span>
      <button class="btn sm primary" data-a="tpl-start" data-id="${tpl.id}">Start</button><button class="icon-btn subtle" data-a="rec-dismiss" aria-label="Not today">${icon('x')}</button></div>`;
  }

  // ---------- Finisher ----------

  function finisherPreview() {
    const db = ctx.db;
    const s = ctx.sessionFor(ctx.ui.day);
    const muscles = s ? [...new Set(s.order.map((u) => s.entries[u]).filter((e) => e.sets.some((x) => x.done)).flatMap((e) => db.exercises[e.exerciseId]?.primary || []))] : [];
    const tpl = buildFinisher(db, { ...st.fin, muscles });
    st.finTpl = tpl;
    return `<p class="small">${esc(tpl.desc)}</p>
      <ol class="fin-list">${tpl.items.map(([id, , metric, target]) => `<li><b>${esc(db.exercises[id]?.name || id)}</b> · ${fmtTarget(metric, target)}</li>`).join('')}</ol>
      ${muscles.length ? '' : '<p class="muted small">Log a few sets first and the finisher will match what you trained.</p>'}`;
  }

  function openFinisher() {
    ctx.openSheet(`<h2>Add a finisher</h2>
      <div class="field"><span>Length</span><div class="segmented small-seg" role="radiogroup" aria-label="Length">${[5, 10, 15].map((m) => `<button class="${st.fin.minutes === m ? 'on' : ''}" data-a="fin-set" data-k="minutes" data-v="${m}" role="radio">${m} min</button>`).join('')}</div></div>
      <div class="field"><span>Focus</span><div class="segmented small-seg" role="radiogroup" aria-label="Focus">
        <button class="${st.fin.mode === 'burn' ? 'on' : ''}" data-a="fin-set" data-k="mode" data-v="burn" role="radio">Burn out today's muscles</button>
        <button class="${st.fin.mode === 'spare' ? 'on' : ''}" data-a="fin-set" data-k="mode" data-v="spare" role="radio">Spare them</button></div></div>
      <div class="field"><span>Format</span><div class="segmented small-seg" role="radiogroup" aria-label="Format">
        <button class="${st.fin.format === 'rounds' ? 'on' : ''}" data-a="fin-set" data-k="format" data-v="rounds" role="radio">Rounds</button>
        <button class="${st.fin.format === 'emom' ? 'on' : ''}" data-a="fin-set" data-k="format" data-v="emom" role="radio">Every minute</button></div></div>
      <div id="fin-preview">${finisherPreview()}</div>
      <button class="btn primary block big" data-a="fin-add">Add to workout</button>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  // ---------- Conditioning targets ----------

  // Last result, best and the next target for a conditioning exercise on its screen.
  function condInfo(item, entry, ex, metric) {
    const db = ctx.db;
    let html = '';
    if (item.paceSec) html += `<p class="cond-target"><b>Target:</b> ${fmtClock(item.paceSec)} per ${fmtTarget(metric, item.target)}</p>`;
    const hist = condHistory(db, ex.id, metric, item.target);
    const t = condTarget(hist);
    if (t) {
      html += `<p class="muted small">Last time: ${esc(t.last.label)}${hist.length > 1 ? ` · best ${t.lower ? `${t.best.toFixed(1)} s` : `${Math.round(t.best)} ${t.unit}`}` : ''}</p>`;
      if (!item.paceSec) html += `<p class="cond-target"><b>Target:</b> ${esc(t.label)}${t.held ? ' (same as last time — it felt hard)' : ''}</p>`;
    }
    if (entry && entry.sets.length && entry.sets.every((x) => x.done)) {
      html += `<div class="checkin" role="group" aria-label="How hard was that"><span class="muted small">How hard was that, 1–10?</span>
        <div class="seg-mini">${[5, 6, 7, 8, 9, 10].map((v) => `<button class="${entry.rpe === v ? 'on' : ''}" data-a="cond-rpe" data-uid="${item.uid}" data-v="${v}" aria-pressed="${entry.rpe === v}">${v}</button>`).join('')}</div></div>`;
    }
    return html;
  }

  // What to show in an empty secondary field (e.g. target seconds per sprint).
  function condPlaceholder(item, ex, metric) {
    if (item.paceSec && metric === 'distance') return `${Math.round(item.paceSec)}`;
    const t = condTarget(condHistory(ctx.db, ex.id, metric, item.target));
    return t?.lower ? `≤${t.value.toFixed(1)}` : '';
  }

  // ---------- Running goal ----------

  function legLoads() {
    const db = ctx.db;
    const out = {};
    for (const d of DAY_KEYS) {
      // The regular weekly plan, not this week's adjustments.
      const lift = db.plan[d] && ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift');
      const l = lift ? liftLoads(db, resolveDay(db, d, { template: true }).map((i) => ({ exerciseId: i.exerciseId, sets: i.sets }))) : {};
      out[d] = ['quads', 'hamstrings', 'glutes'].reduce((a, m) => a + (l[m] || 0), 0) / 2;
    }
    return out;
  }

  function runCard() {
    const db = ctx.db;
    const g = db.runGoal;
    const wk = goalWeek(g);
    if (!g || !wk) {
      return `<div class="card run-card"><div class="row between"><div><h3>Running goal</h3><p class="muted small">Train for a faster 5k while keeping your strength. Runs are placed around your lifting.</p></div>
        <button class="btn sm" data-a="run-open">${g ? 'Start a new goal' : 'Set up'}</button></div></div>`;
    }
    const p = paces(g, wk);
    const runs = weekRuns(g, wk);
    return `<div class="card run-card"><div class="row between"><h3>5k: ${fmtClock(g.trials?.at(-1)?.sec || g.current5k)} → ${fmtClock(g.target5k)}</h3><button class="link-btn" data-a="run-open">Edit</button></div>
      <p class="muted small">Week ${wk} of ${g.weeks} · easy ${fmtClock(p.easy)}/mi · tempo ${fmtClock(p.tempo)}/mi · intervals ${fmtClock(p.interval)}/mi${g.liftMaintenance ? ' · lifting at maintenance' : ''}</p>
      ${Object.entries(g.days).sort((a, b) => dayIndex(a[1]) - dayIndex(b[1])).map(([k, d]) => { const kind = k.split('#')[0]; const r = runs[kind]; return `<div class="run-row"><b>${SHORT[d]}</b><span class="grow">${esc(db.exercises[r.exerciseId]?.name || RUN_KINDS[kind].name)}<span class="pick-sub">${esc(r.note)}</span></span></div>`; }).join('')}
    </div>`;
  }

  function openRunGoal() {
    const g = ctx.db.runGoal || {};
    st.run = { runsPerWeek: g.runsPerWeek || 3, liftMaintenance: g.liftMaintenance ?? true, weeks: g.weeks || 8 };
    ctx.openSheet(`<h2>Running goal</h2>
      <p class="muted small">Your current 5k sets your training paces. About 80% of running stays easy; hard runs avoid your heavy leg days. ${ctx.refChips(['daniels2014', 'seiler2010', 'schumann2022'])}</p>
      <div class="grid2">
        <div class="field"><span>Current 5k (mm:ss)</span><input id="rg-cur" type="text" inputmode="numeric" placeholder="25:00" value="${g.current5k ? fmtClock(g.trials?.at(-1)?.sec || g.current5k) : ''}"></div>
        <div class="field"><span>Goal 5k (mm:ss)</span><input id="rg-tgt" type="text" inputmode="numeric" placeholder="23:00" value="${g.target5k ? fmtClock(g.target5k) : ''}"></div>
      </div>
      <div class="field"><span>Length</span><div class="segmented small-seg" role="radiogroup">${[6, 8, 10, 12].map((w) => `<button class="${st.run.weeks === w ? 'on' : ''}" data-a="rg-set" data-k="weeks" data-v="${w}" role="radio">${w} weeks</button>`).join('')}</div></div>
      <div class="field"><span>Runs per week</span><div class="segmented small-seg" role="radiogroup">${[2, 3, 4, 5].map((n) => `<button class="${st.run.runsPerWeek === n ? 'on' : ''}" data-a="rg-set" data-k="runsPerWeek" data-v="${n}" role="radio">${n}</button>`).join('')}</div></div>
      <label class="toggle"><input type="checkbox" id="rg-maint" ${st.run.liftMaintenance ? 'checked' : ''}><span>Keep lifting at maintenance (fewer accessory sets) ${ctx.refChips(['bickel2011'])}</span></label>
      <button class="btn primary block big" data-a="rg-save">Save goal</button>
      ${ctx.db.runGoal ? '<button class="btn block danger" data-a="rg-remove">Remove running goal</button>' : ''}
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  // ---------- Share and install ----------

  function openShare() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    ctx.openSheet(`<h2>Share or install the app</h2>
      <p class="small">Anyone can use it, free, with nothing to download from an app store. Send them this link:</p>
      <p class="code-box small-code">${APP_URL}</p>
      <div class="row"><button class="btn primary grow" data-a="share-app">Share link</button><button class="btn grow" data-a="cloud-copy" data-v="${APP_URL}">Copy link</button></div>
      <h3 class="sheet-h">Put it on the home screen</h3>
      <ol class="steps">
        ${ios ? `<li>Open the link in <b>Safari</b> (the compass icon).</li>
        <li>Tap the <b>Share</b> button (a square with an arrow pointing up) at the bottom.</li>
        <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>` : `<li>Open the link in <b>Chrome</b>.</li>
        <li>Tap the <b>⋮</b> menu at the top right.</li>
        <li>Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b>.</li>`}
        <li>Open it from the new icon. It works like a normal app, even offline.</li>
      </ol>
      <p class="muted small">Each person's data stays on their own phone. To keep a copy safe, turn on cloud backup in Settings → Data & security.</p>
      <button class="btn plain block" data-a="close-sheet">Done</button>`);
  }

  // A one-time hint when the app is open in a browser tab instead of from the home screen.
  function installHint() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone || ctx.db.settings.installHintDismissed) return '';
    return `<div class="slim-banner"><span class="grow"><b>Add this app to your home screen</b><span class="pick-sub">It opens full screen, works offline, and keeps your data safer.</span></span>
      <button class="btn sm primary" data-a="open-share">How</button><button class="icon-btn subtle" data-a="install-dismiss" aria-label="Dismiss">${icon('x')}</button></div>`;
  }

  // ---------- Actions ----------

  const actions = {
    'wk-open': (d) => openPlanner(d.v ? +d.v : null),
    'wk-n': (d) => { st.avail = defaultAvail(+d.v); document.querySelectorAll('[data-a="wk-n"]').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); refreshPlanner(); },
    'wk-apply': () => {
      const db = ctx.db;
      const { week, summary } = composeWeek(db, st.avail);
      db.week = week;
      db.settings.weekPromptDismissed = `${week.start}:${todayStr()}`;
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(summary[0] || 'This week is set.');
    },
    'wk-reset': () => { ctx.db.week = null; ctx.persist(); ctx.closeSheet(); ctx.render(); ctx.toast('Back to your normal plan.'); },
    'wk-dismiss': () => { ctx.db.settings.weekPromptDismissed = `${mondayOf(todayStr())}:${todayStr()}`; ctx.persist(); ctx.render(); },
    'adj-open': (d) => openAdjust(d.day || ctx.ui.day),
    'adj-min': (d) => { st.adjust.minutes = +d.v; document.querySelectorAll('[data-a="adj-min"]').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); },
    'adj-apply': () => {
      if (ctx.sessionFor(st.adjust.day)) return ctx.toast('Finish or discard the current workout first.');
      const r = adjustDay(ctx.db, st.adjust.day, { minutes: st.adjust.minutes, gymId: $('#adj-gym')?.value || st.adjust.gymId });
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(`About ${r.minutes} min${r.notes.length ? `: ${r.notes.join('; ')}` : ''}.`);
    },
    'adj-split': () => {
      if (ctx.sessionFor(st.adjust.day)) return ctx.toast('Finish or discard the current workout first.');
      if (!splitDay(ctx.db, st.adjust.day)) return ctx.toast('Not enough exercises to split.');
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast('Split in two. Finish this part and the second part shows up here.');
    },
    'adj-reset': () => {
      const w = ctx.db.week;
      if (w?.days) delete w.days[st.adjust.day];
      ctx.persist(); ctx.closeSheet(); ctx.render();
    },
    'rec-rate': (d) => {
      record(ctx.db, d.g, +d.v, d.s, +d.h);
      // Very sore two or more days after training: learn that this group needs longer.
      if (+d.v === 2 && +d.h >= 40) learnSlowRecovery(ctx.db, d.g, 'very sore two days after');
      ctx.persist(); ctx.render();
    },
    'rec-swap': (d) => {
      const db = ctx.db;
      const day = ctx.ui.day;
      const start = mondayOf(todayStr());
      if (!db.week || db.week.start !== start) db.week = { start, avail: {}, days: {} };
      const mine = weekOverride(db, day)?.from || [day];
      const t = liftTemplates(db).find((x) => x.day === d.t);
      const base = resolveDay(db, d.t, { template: true }).filter((i) => i.ex.category !== 'conditioning').map(({ ex, ...r }) => r);
      db.week.days[day] = { name: t.name, mode: 'lift', from: [d.t], base, items: base };
      // The swapped-out session takes the other one's slot later this week, if it had one.
      const later = DAY_KEYS.find((x) => dayIndex(x) > dayIndex(day) && ((weekOverride(db, x)?.from || (!weekOverride(db, x) ? [x] : [])).includes(d.t)));
      if (later) {
        const back = resolveDay(db, mine[0], { template: true }).filter((i) => i.ex.category !== 'conditioning').map(({ ex, ...r }) => r);
        db.week.days[later] = { name: liftTemplates(db).find((x) => x.day === mine[0])?.name || 'Workout', mode: 'lift', from: mine, base: back, items: back };
      }
      learnSlowRecovery(db, d.g, 'needed a swap');
      ctx.persist(); ctx.render();
      ctx.toast(later ? `Swapped: ${t.name} today, the other session on ${FULL[later]}.` : `${t.name} today.`);
    },
    'rec-routine': (d) => { learnSlowRecovery(ctx.db, d.g, 'took a recovery day'); ctx.persist(); ctx.startTemplate(recoveryTemplateFor([d.g]).id); },
    'rec-cardio': (d) => { learnSlowRecovery(ctx.db, d.g, 'swapped for cardio'); ctx.persist(); ctx.openCardioOptions(ctx.ui.day); },
    'rec-lighter': (d) => {
      const db = ctx.db;
      const day = ctx.ui.day;
      adjustDay(db, day, { minutes: weekOverride(db, day)?.minutes || null, gymId: weekOverride(db, day)?.gymId || null });
      for (const it of db.week.days[day].items) if (groupOf(db.exercises[it.exerciseId]?.primary[0]) === d.g && it.sets > 2) it.sets -= 1;
      learnSlowRecovery(db, d.g, 'trained while still sore');
      ctx.persist(); ctx.render();
      ctx.toast(`One set fewer on ${RECOVERY_GROUPS[d.g].name.toLowerCase()} today.`);
    },
    'rec-dismiss': () => { ctx.db.settings.recoveryDismissed = todayStr(); ctx.persist(); ctx.render(); },
    'fin-open': () => openFinisher(),
    'fin-set': (d) => {
      st.fin[d.k] = d.k === 'minutes' ? +d.v : d.v;
      document.querySelectorAll(`[data-a="fin-set"][data-k="${d.k}"]`).forEach((b) => b.classList.toggle('on', b.dataset.v === d.v));
      const el = $('#fin-preview');
      if (el) el.innerHTML = finisherPreview();
    },
    'fin-add': () => { ctx.addTemplateToSession(st.finTpl); ctx.closeSheet(); ctx.toast('Finisher added at the end. Tap a round\'s play button to time it.'); },
    'cond-rpe': (d) => { const e = ctx.sessionEntry(d.uid, true); if (!e) return; e.rpe = +d.v; ctx.persist(); ctx.render(); },
    'run-open': () => openRunGoal(),
    'rg-set': (d) => { st.run[d.k] = +d.v; document.querySelectorAll(`[data-a="rg-set"][data-k="${d.k}"]`).forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); },
    'rg-save': () => {
      const db = ctx.db;
      const cur = parseClock($('#rg-cur').value);
      const tgt = parseClock($('#rg-tgt').value);
      if (!cur || !tgt) return ctx.toast('Enter both 5k times as minutes:seconds, e.g. 24:30.');
      if (tgt >= cur) return ctx.toast('The goal should be faster than your current time.');
      const kinds = runKinds(st.run.runsPerWeek);
      const liftDays = DAY_KEYS.filter((d) => db.plan[d] && ['lift', 'both'].includes(db.settings.dayModes?.[d] || 'lift'));
      const days = scheduleRuns(kinds, legLoads(), liftDays);
      const prev = db.runGoal;
      db.runGoal = {
        start: prev && goalWeek(prev) && prev.target5k === tgt ? prev.start : mondayOf(todayStr()),
        weeks: st.run.weeks, current5k: cur, target5k: tgt, runsPerWeek: st.run.runsPerWeek, days,
        liftMaintenance: $('#rg-maint').checked, trials: prev?.trials || [],
      };
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(`Runs on ${Object.values(days).sort((a, b) => dayIndex(a) - dayIndex(b)).map((d) => SHORT[d]).join(', ')}. Hard runs avoid heavy leg days.`);
    },
    'rg-remove': () => { if (!confirm('Remove the running goal? Logged runs stay in your history.')) return; ctx.db.runGoal = null; ctx.persist(); ctx.closeSheet(); ctx.render(); },
    'open-share': () => openShare(),
    'share-app': async () => {
      try { if (navigator.share) await navigator.share({ title: 'Lift Tracker', text: 'Workout, cardio and nutrition tracker', url: APP_URL }); else { await navigator.clipboard.writeText(APP_URL); ctx.toast('Link copied.'); } } catch {}
    },
    'install-dismiss': () => { ctx.db.settings.installHintDismissed = true; ctx.persist(); ctx.render(); },
  };

  // Planner inputs change several things at once, so they're handled on 'change'.
  function onChange(e) {
    const k = e.target.dataset?.wk;
    if (!k) return false;
    const [d, field] = k.split(':');
    st.avail[d][field] = field === 'on' ? e.target.checked : field === 'minutes' ? +e.target.value : e.target.value;
    document.querySelectorAll('[data-a="wk-n"]').forEach((b) => b.classList.remove('on'));
    refreshPlanner();
    return true;
  }

  return { weekPrompt, openPlanner, recoveryCheck, recoveryCards, recoveryReminder, condInfo, condPlaceholder, runCard, installHint, openShare, actions, onChange };
}
