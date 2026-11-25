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
      if (p.pending && p.pending < p.target) return `${wtEst(p.target - p.value)} to go · ${p.pending.toLocaleString()}: ${wtEst(p.pending - p.lifted)} to lift`;
      return `${wtEst(p.target - p.value)} to go${p.earned ? ` · ${p.earned.toLocaleString()}-lb club member` : ''}`;
    }
    if (p.reached) return 'Goal reached. Tap to set a new one.';
    if (p.type === 'mile') return p.value ? `${fmtTime(p.value - p.target)} to cut` : 'Log a run of a mile or more';
    if (p.type === 'calories') return `${(p.target - p.value).toLocaleString()} kcal to go`;
    return `${(Math.round((p.target - p.value) * 10) / 10).toLocaleString()} mi to go`;
  };
  const clubPct = (p, v) => Math.max(0, Math.min(100, (v / p.target) * 100)).toFixed(1);
  const bar = (p) => {
    if (p.type !== 'club') return `<span class="goal-track" aria-hidden="true"><i style="width:${Math.round(p.pct * 100)}%"></i></span>`;
    const notch = p.pending && p.pending < p.target ? `<b class="gb-notch" style="left:${clubPct(p, p.pending)}%"></b>` : '';
    return `<span class="gb-wrap" aria-hidden="true"><span class="goal-track gb"><i class="gb-est" style="width:${clubPct(p, p.value)}%"></i><i class="gb-lift" style="width:${clubPct(p, p.lifted)}%"></i></span>${notch}</span>
      ${p.lifted ? `<span class="gb-key"><span><i class="k-lift"></i>Lifted <b>${esc(wtEst(p.lifted))}</b></span><span><i class="k-est"></i>Estimated ${esc(wtEst(p.value))}</span></span>` : ''}`;
  };
  function card() {
    if (!getGoal(ctx.db).on) return '';
    const p = goalProgress(ctx.db);
    return `<button class="goal-card" data-a="goal-detail" aria-label="Big goal: ${esc(p.title)}. ${esc(valueText(p))}${p.type === 'club' && p.lifted ? `, ${esc(wtEst(p.lifted))} actually lifted` : ''}. ${esc(leftText(p))}. See details.">
      <span class="goal-top"><span class="goal-name">${esc(p.title)}</span>${icon('right', 'chev')}</span>
      <b class="goal-val num">${esc(valueText(p))}</b>
      ${bar(p)}
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
      const top = Math.max(1, ...d.lifts.map((l) => Math.max(l.v, l.lifted?.w || 0)));
      const rows = d.lifts.map((l) => `<button class="list-row goal-lift" ${l.v ? `data-a="chart-open" data-id="${l.exId}"` : 'disabled'}><span class="grow">
        <span class="gl-top"><b>${l.name}</b>${l.v ? `<span><b>${wtEst(l.v)}</b> · <b class="gold">${l.lifted ? wtEst(l.lifted.w) : '—'}</b></span>` : '<span>Not logged yet</span>'}</span>
        ${l.v ? `<span class="gl-bar"><i class="gb-est" style="width:${((l.v / top) * 100).toFixed(1)}%"></i><i class="gb-lift" style="width:${(((l.lifted?.w || 0) / top) * 100).toFixed(1)}%"></i></span>` : ''}</span>${l.v ? icon('right', 'chev') : ''}</button>`).join('');
      // Where a max test has the most to show: a club still to lift, or the biggest gap.
      const gaps = [...d.lifts].filter((l) => l.gap > 0).sort((a, b) => b.gap - a.gap);
      const g = gaps[0];
      const nudge = !p.missing.length && (p.pending || (g && g.gap >= 5)) ? `<div class="goal-nudge"><b class="grow">${p.pending ? `${wtEst(p.pending - p.lifted)} to lift the ${p.pending.toLocaleString()}-lb club` : `${wtEst(g.gap)} to lift on ${g.name.toLowerCase()}`}</b>
        <button class="btn gold-btn" data-a="goal-maxday" data-ids="${[...gaps, ...d.lifts.filter((l) => !gaps.includes(l))].map((l) => l.exId).join(',')}">Plan a max day</button></div>` : '';
      const ladder = d.clubs.map((c) => `<div class="goal-club ${c.lifted ? 'sealed' : c.date ? 'done' : c.t === p.target ? 'next' : ''}"><b class="num">${c.t.toLocaleString()}</b>${c.lifted ? '<i class="gc-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 8.4 L7 11.2 L12.4 5.2"/></svg></i>' : ''}<span>${c.lifted ? 'Lifted' : c.date ? (p.pending === c.t ? 'To lift' : 'Estimated') : c.t === p.target ? 'Next' : ''}</span></div>`).join('');
      const eta = !p.missing.length && etaText(d.etaWeeks) ? kv(`Reaching ${p.target.toLocaleString()}`, etaText(d.etaWeeks), 'At your recent pace') : '';
      return `<h3 class="sheet-h gl-head"><span>Your three lifts</span><span class="gl-cols">Estimated · <span class="gold">Lifted</span></span></h3><div class="list-group">${rows}</div>
        ${nudge}
        <h3 class="sheet-h">Clubs</h3><div class="goal-clubs" style="--n:${CLUBS.length}">${ladder}</div>
        ${eta ? `<div class="kv-list">${eta}</div>` : ''}
        <button class="text-link small-link goal-how" data-a="goal-how">How these are worked out</button>`;
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
  // One tap deeper: where each number comes from, how accurate it's been, and the method.
  function howSheet() {
    const d = goalDetails(ctx.db);
    const setText = (l) => (l.r === 1 ? wt(l.w) : `${wt(l.w)} × ${l.r}${l.rir ? ` + ${l.rir} in reserve` : ''}`);
    const day = (s) => ctx.fmtDate(s).replace(/^w+,s*/, '');
    const rows = d.lifts.filter((l) => l.v).map((l) => `<div class="kv"><span>${l.name}<span class="pick-sub">${l.tested ? `Tested ${day(l.date)}` : `From ${setText(l)}, ${day(l.date)}`}${l.alone ? ' · waiting for another session to back it up' : ''}</span><span class="pick-sub">${l.lifted ? `Heaviest lifted ${l.lifted.r === 1 ? wt(l.lifted.w) : `${wt(l.lifted.w)} × ${l.lifted.r}`}, ${day(l.lifted.date)}` : ''}</span></span><b>${wtEst(l.v)}</b></div>`).join('');
    const c = d.cal;
    const acc = c.n ? `Checked against ${c.n} tested ${c.n === 1 ? 'max' : 'maxes'}: off by ${Math.round(c.err * 1000) / 10}% on average.${c.factor !== 1 ? ` Estimates are adjusted ${c.factor > 1 ? 'up' : 'down'} ${Math.round(Math.abs(c.factor - 1) * 1000) / 10}% for you.` : c.n < 3 ? ' After 3 tests, estimates adjust to you.' : ''}` : 'No tested maxes yet. Each test checks the estimate, and after 3 they adjust to you.';
    ctx.openSheet(`<h2>How it's worked out</h2>
      <div class="kv-list">${rows}</div>
      ${d.gained > 0 ? `<div class="kv-list">${kv('Last 6 months', `+${wtEst(d.gained)}`)}</div>` : ''}
      <h3 class="sheet-h">Accuracy</h3><p class="small">${acc}</p>
      <h3 class="sheet-h">Method</h3>
      <p class="small"><b>Estimated</b> uses sets of 10 reps or fewer, counting reps left in reserve when you log them, eased off a little above 5 reps. A best that stands alone waits for another session to back it up. A tested max resets it.</p>
      <p class="small"><b>Lifted</b> is the heaviest weight you've logged. A club gets its gold ring once the lifted total reaches it.</p>
      <button class="btn block" data-a="goal-detail">Back</button>`);
  }
  function detailSheet() {
    const d = goalDetails(ctx.db);
    const p = d.p;
    const chartFmt = p.type === 'mile' ? fmtTime : (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(p.type === 'club' ? toDisp(v) : v)));
    const label = { club: 'Total over time', mile: 'Pace over time', longrun: 'Run distance', miles: 'Miles so far', calories: 'Calories so far' }[p.type];
    ctx.openSheet(`<h2>${esc(p.title)}</h2>
      <div class="goal-hero"><b class="goal-val num">${esc(valueText(p))}</b>${bar(p)}<span class="goal-sub">${esc(leftText(p))}</span></div>
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
    'goal-how': () => howSheet(),
    'goal-maxday': (d) => ctx.openMaxDay(String(d.ids || '').split(',').filter(Boolean)),
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
