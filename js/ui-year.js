// Plan → Year: phases over the calendar, with nutrition, cardio and training blocks lined up.
import { PHASE_TYPES, PHASE_GUIDE, activePhase, suggestYear, newPhase, yearWeeks, projection, phaseWeeksTotal } from './year.js';
import { estimatedMaintenance, latestWeight } from './nutrition.js';
import { todayStr, addDays, mondayOf, parseDate } from './store.js';

export function createYear(ctx) {
  const { esc } = ctx;
  const fmt = (d) => parseDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const monthOf = (d) => parseDate(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function weekKcal(db, phaseType, weight) {
    const t = PHASE_TYPES[phaseType];
    const mid = (t.rate[0] + t.rate[1]) / 2;
    const sign = t.goal === 'gain' ? 1 : t.goal === 'lose' ? -1 : 0;
    return Math.round((estimatedMaintenance(db, weight) + (sign * mid / 100) * weight * 3500 / 7) / 10) * 10;
  }

  function view() {
    const db = ctx.db;
    const plan = db.yearPlan;
    if (!plan) {
      return `<div class="card">
        <h3>Plan your year</h3>
        <p class="muted small">Lay out bulking, cutting and maintenance phases over the next 12 months. Calorie targets, cardio and the Body tab follow the phase you're in, and deload weeks line up underneath.</p>
        <button class="btn primary block" data-a="yr-suggest">${db.profile ? 'Suggest a year from my goals' : 'Suggest a year'}</button>
        <button class="btn block" data-a="yr-blank">Start from scratch</button>
      </div>`;
    }
    const weeks = yearWeeks(db);
    const total = phaseWeeksTotal(plan);
    const now = activePhase(db);
    const nowIdx = weeks.findIndex((w) => w.start <= todayStr() && addDays(w.start, 7) > todayStr());
    const segs = plan.phases.map((p) => `<span class="seg ${PHASE_TYPES[p.type].cls}" style="flex:${p.weeks}" title="${PHASE_TYPES[p.type].label} · ${p.weeks} wk"></span>`).join('');
    const marker = nowIdx >= 0 ? `<span class="now-mark" style="left:${((nowIdx + 0.5) / total) * 100}%"></span>` : '';
    let acc = 0;
    const phaseCards = plan.phases.map((p, i) => {
      const start = addDays(plan.start, acc * 7);
      acc += p.weeks;
      const end = addDays(plan.start, acc * 7 - 1);
      const isNow = now?.index === i;
      return `<div class="card phase ${isNow ? 'is-now' : ''}">
        <div class="row between"><div class="row"><span class="dot ${PHASE_TYPES[p.type].cls}"></span>
          <select data-yr="type" data-id="${p.id}" aria-label="Phase type">${Object.entries(PHASE_TYPES).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
          <span class="muted small">${fmt(start)} – ${fmt(end)}${isNow ? ` · <b>now (wk ${now.weekInPhase})</b>` : ''}</span></div>
        <div class="row between controls">
          <div class="row"><button class="mini" data-a="yr-weeks" data-id="${p.id}" data-v="-1" aria-label="Fewer weeks">−</button><b class="tnum">${p.weeks} wk</b><button class="mini" data-a="yr-weeks" data-id="${p.id}" data-v="1" aria-label="More weeks">+</button></div>
          <div class="row"><button class="mini" data-a="yr-move" data-id="${p.id}" data-v="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move earlier">↑</button><button class="mini" data-a="yr-move" data-id="${p.id}" data-v="1" ${i === plan.phases.length - 1 ? 'disabled' : ''} aria-label="Move later">↓</button><button class="mini danger" data-a="yr-del" data-id="${p.id}" aria-label="Remove">✕</button></div>
        </div>
        <input type="text" class="note-input" data-yr="note" data-id="${p.id}" value="${esc(p.note || '')}" placeholder="Note (optional)">
      </div>`;
    }).join('');

    // Week table grouped by month, with estimates at the projected bodyweight.
    const startW = latestWeight(db) || 180;
    const proj = projection(db, startW);
    const months = {};
    weeks.forEach((w, i) => {
      const t = PHASE_TYPES[w.phase.type];
      const cardio = (w.phase.type === 'cut' || w.phase.type === 'minicut') ? Math.max(db.profile?.rx?.cardioMin || 0, 200) : (db.profile?.rx?.cardioMin || 0);
      (months[monthOf(w.start)] ||= []).push(`<div class="wk-row ${i === nowIdx ? 'is-now' : ''} ${w.block.isDeload ? 'deload' : ''}">
        <span class="tnum">${fmt(w.start)}</span>
        <span><span class="dot ${t.cls}"></span>${t.label} ${w.weekInPhase}/${w.phase.weeks}</span>
        <span class="tnum">~${weekKcal(db, w.phase.type, proj[i].weight).toLocaleString()}</span>
        <span class="tnum">${cardio || '—'}</span>
        <span class="small">${w.block.isDeload ? '<b>Deload</b>' : `B${Math.ceil(w.block.week / w.block.cycleLen)}·${w.block.cyclePos}`}</span>
      </div>`);
    });
    const monthHtml = Object.entries(months).map(([m, rows], i) => `<details class="month" ${rows.some((r) => r.includes('is-now')) || (i === 0 && nowIdx < 0) ? 'open' : ''}>
      <summary>${m}</summary>
      <div class="wk-row head"><span>Week of</span><span>Phase</span><span>kcal/day</span><span>Cardio min</span><span>Block</span></div>${rows.join('')}</details>`).join('');

    setTimeout(() => {
      const el = document.getElementById('yr-chart');
      if (!el) return;
      const actual = (d) => {
        const xs = db.bodyweight.filter((b) => b.date >= d && b.date < addDays(d, 7));
        return xs.length ? xs.reduce((a, b) => a + b.weight, 0) / xs.length : null;
      };
      ctx.lineChart(el, { points: proj.map((p) => ({ x: p.date, values: [Math.round(p.weight * 10) / 10, actual(p.date)] })), series: [{ name: 'Projected', cls: 's1' }, { name: 'Actual (weekly avg)', cls: 's2' }] });
    });

    const guide = now ? PHASE_GUIDE[now.phase.type] : null;
    return `<div class="card">
        <div class="row between"><h3>Your year</h3><span class="muted small">${total} weeks from ${fmt(plan.start)}</span></div>
        <div class="timeline">${segs}${marker}</div>
        <div class="legend">${Object.entries(PHASE_TYPES).filter(([k]) => plan.phases.some((p) => p.type === k)).map(([, v]) => `<span><i class="swatch ${v.cls}"></i>${v.label}</span>`).join('')}</div>
        ${total !== 52 ? `<p class="small hint">${total < 52 ? `${52 - total} weeks unplanned` : `${total - 52} weeks past one year`} — adjust phase lengths.</p>` : ''}
      </div>
      ${guide ? `<div class="card"><h3>Now: ${PHASE_TYPES[now.phase.type].label}, week ${now.weekInPhase} of ${now.weeks}</h3><p class="small">${esc(guide.text)} ${ctx.refChips(guide.refs)}</p></div>` : ''}
      <div class="card"><h3>Bodyweight path</h3><div id="yr-chart"></div><p class="muted small">Projected from the middle of each phase's target rate. Real progress varies — the weekly check-in on the Food tab corrects course.</p></div>
      <h2 class="sect-h">Phases</h2>
      <div class="field inline"><span>Start date (a Monday)</span><input type="date" data-yr="start" value="${plan.start}"></div>
      ${phaseCards}
      <button class="btn block" data-a="yr-add">+ Add phase</button>
      <h2 class="sect-h">Week by week</h2>
      <p class="muted small">Calories are estimates at the projected bodyweight. "B2·3" = training block 2, week 3.</p>
      ${monthHtml}
      <button class="btn block" data-a="yr-suggest">Replace with a suggested year</button>
      <button class="btn ghost block" data-a="yr-clear">Remove year plan</button>`;
  }

  const find = (id) => ctx.db.yearPlan.phases.findIndex((p) => p.id === id);
  const actions = {
    'yr-suggest': () => {
      if (ctx.db.yearPlan && !confirm('Replace your year plan with a suggested one?')) return;
      ctx.db.yearPlan = suggestYear(ctx.db.profile, mondayOf(todayStr()));
      ctx.persist(); ctx.render(); ctx.toast('Suggested year added — edit any phase.');
    },
    'yr-blank': () => { ctx.db.yearPlan = { start: mondayOf(todayStr()), phases: [newPhase('maintain', 52)] }; ctx.persist(); ctx.render(); },
    'yr-clear': () => { if (!confirm('Remove the year plan? Targets go back to your profile goal.')) return; ctx.db.yearPlan = null; ctx.persist(); ctx.render(); },
    'yr-add': () => { ctx.db.yearPlan.phases.push(newPhase('maintain', 4)); ctx.persist(); ctx.render(); },
    'yr-del': (d) => { const ph = ctx.db.yearPlan.phases; if (ph.length <= 1) return ctx.toast('Keep at least one phase.'); ph.splice(find(d.id), 1); ctx.persist(); ctx.render(); },
    'yr-weeks': (d) => { const p = ctx.db.yearPlan.phases[find(d.id)]; p.weeks = Math.max(1, Math.min(52, p.weeks + +d.v)); ctx.persist(); ctx.render(); },
    'yr-move': (d) => {
      const ph = ctx.db.yearPlan.phases; const i = find(d.id); const j = i + +d.v;
      if (j < 0 || j >= ph.length) return;
      [ph[i], ph[j]] = [ph[j], ph[i]]; ctx.persist(); ctx.render();
    },
  };

  function onChange(e) {
    const k = e.target.dataset?.yr;
    if (!k || !ctx.db.yearPlan) return false;
    if (k === 'start') { if (e.target.value) ctx.db.yearPlan.start = mondayOf(e.target.value); }
    else {
      const p = ctx.db.yearPlan.phases[find(e.target.dataset.id)];
      if (k === 'type') p.type = e.target.value;
      if (k === 'note') p.note = e.target.value.trim();
    }
    ctx.persist();
    if (k !== 'note') ctx.render();
    return true;
  }

  return { view, actions, onChange };
}
