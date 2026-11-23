// The big goal: its card on Progress and Strength, and the sheet to change or turn it off.

import { icon } from './icons.js';
import { todayStr } from './store.js';
import { toDisp, wt, wtEst } from './units.js';
import { CLUBS, GOAL_TYPES, getGoal, goalDetails, goalProgress, fmtTime } from './big-goal.js';
import { trendChart } from './chart.js';

const NAMES = { squat: 'squat', bench: 'bench', deadlift: 'deadlift' };
const listOf = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

export function createGoals(ctx) {
  const { esc } = ctx;
  const valueText = (p) => {
    if (p.type === 'club') return wtEst(p.value);
    if (p.type === 'mile') return p.value ? fmtTime(p.value) : 'No time yet';
    if (p.type === 'calories') return `${p.value.toLocaleString()} kcal`;
    return `${(Math.round(p.value * 10) / 10).toLocaleString()} mi`;
  };
  const leftText = (p) => {
    if (p.type === 'club') {
      if (p.missing.length) return `Log a ${listOf(p.missing.map((k) => NAMES[k]))} to count`;
      if (p.reached) return 'You reached the top club';
      return `${wtEst(p.target - p.value)} to go${p.earned ? ` · ${p.earned.toLocaleString()}-lb club member` : ''}`;
    }
    if (p.reached) return 'Goal reached. Tap to set a new one.';
    if (p.type === 'mile') return p.value ? `${fmtTime(p.value - p.target)} to cut` : 'Log a run of a mile or more';
    if (p.type === 'calories') return `${(p.target - p.value).toLocaleString()} kcal to go`;
    return `${(Math.round((p.target - p.value) * 10) / 10).toLocaleString()} mi to go`;
  };
  function card() {
    if (!getGoal(ctx.db).on) return '';
    const p = goalProgress(ctx.db);
    return `<button class="goal-card" data-a="goal-detail" aria-label="Big goal: ${esc(p.title)}. ${esc(valueText(p))}. ${esc(leftText(p))}. See details.">
      <span class="goal-top"><span class="goal-name">${esc(p.title)}</span>${icon('right', 'chev')}</span>
      <b class="goal-val num">${esc(valueText(p))}</b>
      <span class="goal-track" aria-hidden="true"><i style="width:${Math.round(p.pct * 100)}%"></i></span>
      <span class="goal-sub">${esc(leftText(p))}</span>
    </button>`;
  }
  // ---------- What makes up the goal ----------
  const etaText = (w) => {
    if (w == null) return null;
    if (w < 1.5) return 'About a week';
    if (w < 9) return `About ${Math.round(w)} weeks`;
    const m = w / 4.35;
    return m < 24 ? `About ${Math.round(m)} months` : `About ${Math.round(m / 12)} years`;
  };
  const kv = (l, v, sub = '') => `<div class="kv"><span>${l}${sub ? `<span class="pick-sub">${sub}</span>` : ''}</span><b>${v}</b></div>`;
  const mi = (v) => `${(Math.round(v * 10) / 10).toLocaleString()} mi`;
  const runRow = (r) => kv(ctx.fmtDate(r.date), mi(r.mi), r.sec ? `${fmtTime(r.sec)} · ${fmtTime(r.sec / r.mi)} per mile` : '');
  function detailBody(d) {
    const p = d.p;
    if (p.type === 'club') {
      const rows = d.lifts.map((l) => `<button class="list-row goal-lift" ${l.v ? `data-a="chart-open" data-id="${l.exId}"` : 'disabled'}><span class="grow"><b>${l.name}</b><span class="pick-sub">${l.v ? `${l.r === 1 ? wt(l.w) : `${wt(l.w)} × ${l.r}`} · ${ctx.fmtDate(l.date)}${l.logged ? ' · logged' : ''}` : 'Not logged yet'}</span><span class="goal-share" aria-hidden="true"><i style="width:${Math.round(l.share * 100)}%"></i></span></span><b class="num">${l.v ? wtEst(l.v) : '—'}</b>${l.v ? icon('right', 'chev') : ''}</button>`).join('');
      const ladder = d.clubs.map((c) => `<div class="goal-club ${c.date ? 'done' : c.t === p.target ? 'next' : ''}"><b class="num">${c.t.toLocaleString()}</b><span>${c.date ? ctx.fmtDate(c.date) : c.t === p.target ? 'Next' : ''}</span></div>`).join('');
      const pace = [p.missing.length ? '' : kv('Left to go', p.reached ? 'Done' : wtEst(p.target - p.value)), d.gained > 0 ? kv('Last 6 months', `+${wtEst(d.gained)}`) : '', etaText(d.etaWeeks) ? kv(`Reaching ${p.target.toLocaleString()}`, etaText(d.etaWeeks), 'At your recent pace, an estimate') : ''].join('');
      return `<h3 class="sheet-h">Your three lifts</h3><div class="list-group">${rows}</div>
        ${pace.trim() ? `<div class="kv-list">${pace}</div>` : ''}
        <h3 class="sheet-h">Clubs</h3><div class="goal-clubs" style="--n:${CLUBS.length}">${ladder}</div>
        <p class="muted small">Uses your best estimated max for each lift, from sets of 10 reps or fewer and any max you've logged. A true single counts as its weight.</p>`;
    }
    if (p.type === 'mile') {
      return `<div class="kv-list">${kv('Target pace', `${fmtTime(p.target)} per mile`)}${d.gap != null ? kv(p.reached ? 'Under target by' : 'Left to cut', fmtTime(Math.abs(d.gap))) : ''}${d.entered ? kv('Best time you entered', fmtTime(d.entered)) : ''}${kv('Runs of a mile or more', d.runs)}</div>
        ${d.fastest.length ? `<h3 class="sheet-h">Fastest paces</h3><div class="kv-list">${d.fastest.map((r) => kv(ctx.fmtDate(r.date), fmtTime(r.pace), mi(r.mi))).join('')}</div>` : ''}
        <p class="muted small">Your time is your fastest average pace on any logged run of at least a mile, or the best time you entered.</p>`;
    }
    if (p.type === 'longrun') {
      return `<div class="kv-list">${kv('Left to go', p.reached ? 'Done' : mi(p.target - p.value))}${kv('Longest in the last 4 weeks', d.recentLong ? mi(d.recentLong) : 'None')}${kv('Runs logged', d.runs)}</div>
        ${d.top.length ? `<h3 class="sheet-h">Longest runs</h3><div class="kv-list">${d.top.map(runRow).join('')}</div>` : ''}
        <p class="muted small">Counts any logged run with a distance.</p>`;
    }
    if (p.type === 'miles') {
      return `<div class="kv-list">${kv('Counting since', ctx.fmtDate(d.since))}${kv('Runs', d.runs)}${kv('Average run', d.runs ? mi(d.avgRun) : '—')}${kv('Average week', mi(d.perWeek))}${etaText(d.etaWeeks) ? kv('Reaching your goal', etaText(d.etaWeeks), 'At this pace, an estimate') : ''}</div>
        <p class="muted small">Counts runs with a distance since you set this goal.</p>`;
    }
    return `<div class="kv-list">${kv('Counting since', ctx.fmtDate(d.since))}${kv('From lifting', `${d.lifting.toLocaleString()} kcal`)}${kv('From cardio', `${d.cardio.toLocaleString()} kcal`)}${kv('Average week', `${Math.round(d.perWeek).toLocaleString()} kcal`)}${etaText(d.etaWeeks) ? kv('Reaching your goal', etaText(d.etaWeeks), 'At this pace, an estimate') : ''}</div>
      <p class="muted small">Active calories above resting, estimated from your workouts and cardio.</p>`;
  }
  function detailSheet() {
    const d = goalDetails(ctx.db);
    const p = d.p;
    const chartFmt = p.type === 'mile' ? fmtTime : (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(p.type === 'club' ? toDisp(v) : v)));
    const label = { club: 'Total over time', mile: 'Pace over time', longrun: 'Run distance', miles: 'Miles so far', calories: 'Calories so far' }[p.type];
    ctx.openSheet(`<h2>${esc(p.title)}</h2>
      <div class="goal-hero"><b class="goal-val num">${esc(valueText(p))}</b><span class="goal-track" aria-hidden="true"><i style="width:${Math.round(p.pct * 100)}%"></i></span><span class="goal-sub">${esc(leftText(p))}</span></div>
      ${detailBody(d)}
      ${d.history.length > 1 ? `<h3 class="sheet-h">${label}</h3><div id="goal-chart"></div>` : ''}
      <button class="btn block" data-a="goal-open">Change goal</button>`);
    if (d.history.length > 1) setTimeout(() => { const el = document.getElementById('goal-chart'); if (el) trendChart(el, { compact: true, height: 170, name: label, fmt: chartFmt, points: d.history.map((h) => ({ x: h.x, v: p.type === 'club' ? toDisp(h.v) : h.v })) }); });
  }
  const showTarget = (d) => (d.type === 'mile' ? fmtTime(d.target) : d.target);
  function sheet(err = '') {
    const d = ctx.ui.goalDraft;
    const t = GOAL_TYPES[d.type];
    ctx.openSheet(`<h2>Big goal</h2>
      <label class="toggle"><input type="checkbox" id="goal-on" data-a="goal-on" ${d.on ? 'checked' : ''}><span>Show my big goal</span></label>
      ${d.on ? `<div class="list-group" role="radiogroup" aria-label="Goal">${Object.entries(GOAL_TYPES).map(([k, v]) => `<button class="list-row pick-row ${d.type === k ? 'on' : ''}" data-a="goal-type" data-v="${k}" role="radio" aria-checked="${d.type === k}"><span class="grow"><b>${v.name}</b><span class="pick-sub">${v.sub}</span></span><span class="pick-check">${d.type === k ? icon('check') : ''}</span></button>`).join('')}</div>
      ${d.type === 'club' ? '<p class="muted small">Moves up automatically: 1,000, 1,250, 1,500, 1,750, then 2,000 lb.</p>' : `<div class="field"><label for="goal-target">Target ${d.type === 'mile' ? '(min:sec)' : `(${t.unit})`}</label><input id="goal-target" type="text" inputmode="${d.type === 'mile' ? 'text' : 'decimal'}" value="${esc(showTarget(d))}"></div>`}
      ${d.type === 'mile' ? `<div class="field"><label for="goal-best">Best time so far (optional)</label><input id="goal-best" type="text" placeholder="7:45" value="${d.best ? esc(fmtTime(d.best)) : ''}"></div>` : ''}` : ''}
      ${err ? `<p class="notice bad">${esc(err)}</p>` : ''}
      <button class="btn primary block" data-a="goal-save">Save</button>`);
  }
  const parseTime = (s) => {
    const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(s).trim());
    return m ? +m[1] * 60 + +m[2] : null;
  };
  function readForm() {
    const d = ctx.ui.goalDraft;
    const on = document.getElementById('goal-on');
    if (on) d.on = on.checked;
    const tg = document.getElementById('goal-target');
    if (tg) d.rawTarget = tg.value;
    const b = document.getElementById('goal-best');
    if (b) d.rawBest = b.value;
    return d;
  }
  const actions = {
    'goal-detail': () => detailSheet(),
    'goal-open': () => {
      const g = getGoal(ctx.db);
      ctx.ui.goalDraft = { on: g.on, type: g.type, target: g.target ?? GOAL_TYPES[g.type].def, best: g.best || null };
      sheet();
    },
    'goal-on': () => { readForm(); sheet(); },
    'goal-type': (d) => {
      const x = readForm();
      if (x.type !== d.v) { const g = getGoal(ctx.db); x.type = d.v; x.target = g.type === d.v && g.target ? g.target : GOAL_TYPES[d.v].def; x.best = g.type === d.v ? g.best || null : null; delete x.rawTarget; delete x.rawBest; }
      sheet();
    },
    'goal-save': () => {
      const x = readForm();
      const old = getGoal(ctx.db);
      const next = { on: x.on, type: x.type };
      if (x.on && x.type !== 'club') {
        const raw = x.rawTarget ?? showTarget(x);
        const target = x.type === 'mile' ? parseTime(raw) : Number(String(raw).replace(/,/g, ''));
        if (x.type === 'mile' ? !(target >= 120 && target <= 3600) : !(target > 0)) { x.rawTarget = raw; return sheet(x.type === 'mile' ? 'Enter the target as minutes:seconds, like 6:59.' : 'Enter a target above zero.'); }
        next.target = target;
        if (x.type === 'mile') {
          const rawBest = (x.rawBest ?? (x.best ? fmtTime(x.best) : '')).trim();
          const best = rawBest ? parseTime(rawBest) : null;
          if (rawBest && !best) return sheet('Enter your best time as minutes:seconds, like 7:45.');
          if (best) next.best = best;
        }
        next.since = old.type === x.type && old.since ? old.since : todayStr();
      } else if (x.type !== 'club') { Object.assign(next, { target: old.target, since: old.since, best: old.best }); }
      ctx.db.settings.bigGoal = next;
      ctx.persist(); ctx.closeSheet(); ctx.render(); ctx.toast(x.on ? 'Goal saved.' : 'Big goal hidden.');
    },
  };
  const summary = () => { const g = getGoal(ctx.db); return g.on ? goalProgress(ctx.db).title : 'Off'; };
  return { card, actions, summary };
}
