// Plan tools: change the weekly plan in place, without rebuilding it.
// - Move a day's workout to another weekday (swapping if that day already has one).
// - Remove a lifting day: its main lifts move into the other days, so nothing important is lost.
// - Add a lifting day: copy an existing day or start empty.
// - Edit all: change sets, reps or rest for a kind of exercise on one day or every day.
// Every change keeps a copy of the previous plan, so "Undo plan change" can put it back.
import { icon } from './icons.js';
import { DAY_KEYS } from './engine.js';
import { relabelGroups } from './week.js';
import { isCore } from './core.js';

const FULL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

export function createPlanTools(ctx) {
  const { $, esc } = ctx;
  const st = { bulk: null };
  const isLift = (d) => ctx.db.plan[d]?.items?.length && ['lift', 'both'].includes(ctx.db.settings.dayModes?.[d] || 'lift');

  function remember() {
    const db = ctx.db;
    db.previousPlan = { plan: JSON.parse(JSON.stringify(db.plan)), dayModes: { ...db.settings.dayModes }, deloadEvery: db.settings.deloadEvery, savedAt: Date.now() };
  }

  // Plan changes make this week's adjustments for those days stale.
  function dropWeekFor(...days) {
    const w = ctx.db.week;
    if (w?.days) for (const d of days) delete w.days[d];
  }

  function swapKeyed(obj, a, b) {
    if (!obj) return;
    const x = obj[a]; const y = obj[b];
    if (y === undefined) delete obj[a]; else obj[a] = y;
    if (x === undefined) delete obj[b]; else obj[b] = x;
  }

  function moveDay(from, to) {
    const db = ctx.db;
    remember();
    swapKeyed(db.plan, from, to);
    swapKeyed(db.settings.dayModes, from, to);
    swapKeyed(db.coreParked, from, to);
    for (const by of Object.values(db.blocks.byDay || {})) swapKeyed(by, from, to);
    dropWeekFor(from, to);
  }

  // Main lifts of a day: focus lifts first, then the first compounds (at most two).
  function mains(day) {
    const db = ctx.db;
    const focus = ctx.focus();
    const items = db.plan[day].items.filter((it) => !it.autoCore && db.exercises[it.exerciseId]?.category === 'compound');
    return [...items.filter((i) => focus.includes(i.exerciseId)), ...items.filter((i) => !focus.includes(i.exerciseId))].slice(0, 2);
  }

  function removeDay(day) {
    const db = ctx.db;
    remember();
    const moved = [];
    const others = DAY_KEYS.filter((d) => d !== day && isLift(d));
    for (const m of mains(day)) {
      const ex = db.exercises[m.exerciseId];
      // The day that already trains those muscles most, then the shortest day.
      const target = others.map((d) => ({
        d,
        overlap: db.plan[d].items.reduce((a, it) => a + (db.exercises[it.exerciseId]?.primary || []).filter((x) => ex.primary.includes(x)).length, 0),
        size: db.plan[d].items.length,
        has: db.plan[d].items.some((it) => it.exerciseId === m.exerciseId),
      })).filter((x) => !x.has).sort((a, b) => b.overlap - a.overlap || a.size - b.size)[0];
      if (!target) continue;
      const items = db.plan[target.d].items;
      const at = items.reduce((last, it, i) => (db.exercises[it.exerciseId]?.category === 'compound' && !it.autoCore ? i : last), -1) + 1;
      items.splice(at, 0, { ...m, uid: `${target.d}-${Date.now().toString(36)}-${moved.length}`, group: `m${moved.length}` });
      db.plan[target.d].items = relabelGroups(items);
      moved.push(`${ex.name} → ${SHORT[target.d]}`);
    }
    delete db.plan[day];
    db.settings.dayModes[day] = 'rest';
    delete db.coreParked?.[day];
    dropWeekFor(day);
    return moved;
  }

  function addDay(day, source) {
    const db = ctx.db;
    remember();
    const src = source && db.plan[source];
    const stamp = Date.now().toString(36);
    db.plan[day] = src
      ? { name: src.name, items: src.items.map((it, i) => ({ ...JSON.parse(JSON.stringify(it)), uid: `${day}-${stamp}-${i}` })) }
      : { name: 'New day', items: [] };
    db.settings.dayModes[day] = 'lift';
    dropWeekFor(day);
  }

  // ---------- Sheets ----------

  function openDayMenu(day) {
    const db = ctx.db;
    const has = !!db.plan[day];
    const row = (a, ic, label, extra = '', cls = '') => `<button class="list-row ${cls}" data-a="${a}" data-day="${day}" ${extra}>${icon(ic)}<span class="grow">${label}</span></button>`;
    ctx.openSheet(`<h2>${FULL[day]}</h2>
      <div class="list-group menu">
        ${has ? row('pt-move', 'swap', 'Move to another day') : ''}
        ${has ? row('pt-bulk', 'note', 'Edit all exercises') : ''}
        ${has ? row('pt-remove', 'trash', 'Remove this day', '', 'danger-row') : row('pt-add', 'plus', 'Add a lifting day')}
      </div>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  function openMove(day) {
    const db = ctx.db;
    ctx.openSheet(`<h2>Move ${esc(db.plan[day].name)}</h2>
      <p class="muted small">From ${FULL[day]} to:</p>
      <div class="list-group menu">${DAY_KEYS.filter((d) => d !== day).map((d) => `<button class="list-row" data-a="pt-move-to" data-day="${day}" data-to="${d}">
        <span class="grow">${FULL[d]}<span class="pick-sub">${db.plan[d] ? `Swaps with ${esc(db.plan[d].name)}` : isLift(d) ? '' : 'Rest day now'}</span></span></button>`).join('')}</div>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  function openAdd(day) {
    const db = ctx.db;
    const sources = DAY_KEYS.filter((d) => db.plan[d]?.items?.length);
    ctx.openSheet(`<h2>Add lifting on ${FULL[day]}s</h2>
      <div class="list-group menu">
        ${sources.map((d) => `<button class="list-row" data-a="pt-add-go" data-day="${day}" data-src="${d}">${icon('copy')}<span class="grow">Copy ${esc(db.plan[d].name)}<span class="pick-sub">${SHORT[d]} · ${db.plan[d].items.length} exercises</span></span></button>`).join('')}
        <button class="list-row" data-a="pt-add-go" data-day="${day}" data-src="">${icon('plus')}<span class="grow">Start empty</span></button>
      </div>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  const KINDS = { main: 'Focus lifts', compound: 'Compounds', accessory: 'Accessories', all: 'All' };
  function bulkBody() {
    const b = st.bulk;
    const seg = (key, opts) => `<div class="segmented small-seg wrap-seg" role="radiogroup">${(Array.isArray(opts) ? opts : Object.entries(opts)).map(([k, v]) => `<button class="${String(b[key]) === k ? 'on' : ''}" data-a="pt-bulk-set" data-k="${key}" data-v="${k}" role="radio">${v}</button>`).join('')}</div>`;
    const n = targets().length;
    return `<div class="field"><span>Which days</span>${seg('scope', { day: `${SHORT[b.day]} only`, all: 'Every day' })}</div>
      <div class="field"><span>Which exercises</span>${seg('kind', KINDS)}</div>
      <div class="field"><span>Sets</span>${seg('sets', [['keep', 'Keep'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']])}</div>
      <div class="field"><span>Reps</span>${seg('reps', { keep: 'Keep', '3-5': '3–5', '5-8': '5–8', '6-10': '6–10', '8-12': '8–12', '10-15': '10–15', '12-20': '12–20' })}</div>
      <div class="field"><span>Rest</span>${seg('rest', [['keep', 'Keep'], ['60', '1 min'], ['90', '90 sec'], ['120', '2 min'], ['180', '3 min']])}</div>
      <button class="btn primary block big" data-a="pt-bulk-go" ${n ? '' : 'disabled'}>Apply to ${n} exercise${n === 1 ? '' : 's'}</button>`;
  }

  function targets() {
    const db = ctx.db;
    const b = st.bulk;
    const days = b.scope === 'all' ? DAY_KEYS.filter((d) => db.plan[d]) : [b.day];
    const out = [];
    for (const d of days) {
      const main = new Set(mains(d).map((m) => m.uid));
      for (const it of db.plan[d].items) {
        const ex = db.exercises[it.exerciseId];
        if (!ex || it.autoCore || isCore(ex) || ex.category === 'conditioning') continue;
        if (b.kind === 'main' ? main.has(it.uid) : b.kind === 'compound' ? ex.category === 'compound' : b.kind === 'accessory' ? ex.category === 'accessory' : true) out.push(it);
      }
    }
    return out;
  }

  function openBulk(day) {
    st.bulk = { day, scope: 'day', kind: 'accessory', sets: 'keep', reps: 'keep', rest: 'keep' };
    ctx.openSheet(`<h2>Edit all exercises</h2><div id="pt-bulk">${bulkBody()}</div><button class="btn plain block" data-a="close-sheet">Cancel</button>`);
  }

  const actions = {
    'plan-day-menu': (d) => openDayMenu(d.day || ctx.ui.planDay),
    'pt-move': (d) => openMove(d.day),
    'pt-move-to': (d) => {
      const had = !!ctx.db.plan[d.to];
      moveDay(d.day, d.to);
      ctx.ui.planDay = d.to;
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(had ? `Swapped ${FULL[d.day]} and ${FULL[d.to]}.` : `Moved to ${FULL[d.to]}.`);
    },
    'pt-remove': (d) => {
      const name = ctx.db.plan[d.day].name;
      if (!confirm(`Remove ${name} from ${FULL[d.day]}s? Its focus lifts move into your other days. You can undo this from the Plan tab.`)) return;
      const moved = removeDay(d.day);
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(moved.length ? `Removed. Moved ${moved.join(', ')}.` : `${FULL[d.day]} is now a rest day.`);
    },
    'pt-add': (d) => openAdd(d.day),
    'pt-add-go': (d) => {
      addDay(d.day, d.src || null);
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(d.src ? `Copied to ${FULL[d.day]}. Edit it below.` : `${FULL[d.day]} added. Add exercises below.`);
    },
    'pt-bulk': (d) => openBulk(d.day),
    'pt-bulk-set': (d) => { st.bulk[d.k] = d.v; $('#pt-bulk').innerHTML = bulkBody(); },
    'pt-bulk-go': () => {
      const b = st.bulk;
      const list = targets();
      if (!list.length) return;
      remember();
      for (const it of list) {
        if (b.sets !== 'keep') it.sets = +b.sets;
        if (b.reps !== 'keep') { const [lo, hi] = b.reps.split('-').map(Number); it.repMin = lo; it.repMax = hi; }
        if (b.rest !== 'keep') it.restSec = +b.rest;
      }
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(`Updated ${list.length} exercise${list.length === 1 ? '' : 's'}. Undo is on the Plan tab.`);
    },
  };

  return { actions, openDayMenu };
}

// Rebuilding: keep exercises the lifter chose by hand (marked manual) in the new plan.
// Each one replaces the new plan's most similar exercise (same movement, then same main muscle),
// or joins the day that trains its muscles most. Returns how many were kept.
export function keepManual(db, oldPlan, newPlan) {
  const picks = Object.values(oldPlan || {}).flatMap((p) => p.items || []).filter((it) => it.manual && db.exercises[it.exerciseId]);
  let kept = 0;
  const used = new Set();
  for (const pick of picks) {
    const ex = db.exercises[pick.exerciseId];
    if (Object.values(newPlan).some((p) => p.items.some((it) => it.exerciseId === ex.id))) { kept += 1; continue; }
    let best = null;
    for (const [d, p] of Object.entries(newPlan)) {
      p.items.forEach((it, i) => {
        const e = db.exercises[it.exerciseId];
        if (!e || used.has(`${d}:${i}`) || it.manual || e.category !== ex.category) return;
        const score = (e.pattern && e.pattern === ex.pattern ? 10 : 0) + (e.primary[0] === ex.primary[0] ? 5 : 0);
        if (score >= 5 && (!best || score > best.score)) best = { d, i, score };
      });
    }
    if (best) {
      const it = newPlan[best.d].items[best.i];
      it.exerciseId = ex.id; it.manual = true; delete it.role; delete it.variants;
      used.add(`${best.d}:${best.i}`);
      kept += 1;
      continue;
    }
    const target = Object.entries(newPlan).map(([d, p]) => ({ d, overlap: p.items.reduce((a, it) => a + (db.exercises[it.exerciseId]?.primary || []).filter((x) => ex.primary.includes(x)).length, 0) }))
      .sort((a, b) => b.overlap - a.overlap)[0];
    if (target) {
      newPlan[target.d].items.push({ ...pick, uid: `${target.d}-k${Date.now().toString(36)}${kept}`, group: `k${kept}` });
      newPlan[target.d].items = relabelGroups(newPlan[target.d].items);
      kept += 1;
    }
  }
  return kept;
}

export const countManual = (plan) => Object.values(plan || {}).flatMap((p) => p.items || []).filter((it) => it.manual).length;
