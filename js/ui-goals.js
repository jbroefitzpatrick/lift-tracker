// The big goal: its card on Progress and Strength, and the sheet to change or turn it off.

import { icon } from './icons.js';
import { todayStr } from './store.js';
import { wtEst } from './units.js';
import { GOAL_TYPES, getGoal, goalProgress, fmtTime } from './big-goal.js';

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
    return `<button class="goal-card" data-a="goal-open" aria-label="Big goal: ${esc(p.title)}. ${esc(valueText(p))}. ${esc(leftText(p))}. Change goal.">
      <span class="goal-top"><span class="goal-name">${esc(p.title)}</span>${icon('right', 'chev')}</span>
      <b class="goal-val num">${esc(valueText(p))}</b>
      <span class="goal-track" aria-hidden="true"><i style="width:${Math.round(p.pct * 100)}%"></i></span>
      <span class="goal-sub">${esc(leftText(p))}</span>
    </button>`;
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
