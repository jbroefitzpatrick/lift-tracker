// Pain reporting on the body map, daily check-ins, and lighter options for sore areas.
import { bodySvg, sideOf, MUSCLE_NAMES } from './body.js';
import { JOINTS, LEVELS, areaLabel, activePain, painDue, painMap, exercisePain, painSwaps, crossEducationTip } from './pain.js';
import { roundTo } from './engine.js';
import { todayStr } from './store.js';

export function createPain(ctx) {
  const { $, esc } = ctx;
  // Picker state: which view, what's selected ("area:side"), how bad, and the exercise it came from.
  const st = { view: 'front', sel: new Set(), level: null, uid: null, i: null, hint: [] };

  const AREAS = [...Object.keys(JOINTS), ...Object.keys(MUSCLE_NAMES)];

  function mapHtml() {
    return bodySvg(st.view, {}, { cls: 'pick', sel: st.sel, joints: true, hint: st.hint, label: `Body, ${st.view} view. Tap where it hurts.` });
  }

  function selHtml() {
    if (!st.sel.size) return '<span class="muted small">Nothing selected yet.</span>';
    return [...st.sel].map((k) => {
      const [area, side] = k.split(':');
      return `<button class="chip on" data-a="pain-unsel" data-k="${esc(k)}" aria-label="Remove ${esc(areaLabel(area, side))}">${esc(areaLabel(area, side))} ×</button>`;
    }).join('');
  }

  function refresh() {
    const m = $('#pain-map');
    if (m) m.innerHTML = mapHtml();
    const s = $('#pain-sel');
    if (s) s.innerHTML = selHtml();
    document.querySelectorAll('[data-a="pain-view"]').forEach((b) => { const on = b.dataset.v === st.view; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    document.querySelectorAll('[data-a="pain-level"]').forEach((b) => { const on = +b.dataset.v === st.level; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const adv = $('#pain-advice');
    if (adv) adv.textContent = st.level ? LEVELS[st.level].advice : '';
    const stop = $('#pain-stop-row');
    if (stop) stop.hidden = !st.level;
  }

  // opts: { uid, i } when opened from an exercise during a workout.
  function openPicker(opts = {}) {
    const ex = opts.uid ? ctx.db.exercises[ctx.sessionEntry(opts.uid)?.exerciseId] : null;
    Object.assign(st, { view: 'front', sel: new Set(), level: null, uid: opts.uid || null, i: opts.i ?? null, hint: ex ? ex.primary : [] });
    const BACK = ['lats', 'upper-back', 'traps', 'rear-delts', 'triceps', 'lower-back', 'glutes', 'hamstrings'];
    if (ex && BACK.includes(ex.primary[0])) st.view = 'back';
    if (opts.pre) { st.sel.add(opts.pre); if (BACK.includes(opts.pre.split(':')[0])) st.view = 'back'; }
    const options = AREAS.map((a) => `<option value="${a}">${esc(JOINTS[a]?.name || MUSCLE_NAMES[a])}</option>`).join('');
    ctx.openSheet(`<h2>Where does it hurt?</h2>
      <p class="muted small">Tap muscles or joints (the circles). Left and right are separate.${ex ? ` Outlined: what ${esc(ex.name)} works.` : ''}</p>
      <div class="segmented small-seg" role="radiogroup" aria-label="View">
        <button data-a="pain-view" data-v="front" role="radio">Front</button><button data-a="pain-view" data-v="back" role="radio">Back</button>
      </div>
      <div id="pain-map" class="pain-map"></div>
      <div id="pain-sel" class="chips pain-sel" aria-live="polite"></div>
      <details class="pain-list"><summary>Choose from a list instead</summary>
        <div class="row"><select id="pain-area" aria-label="Area">${options}</select>
        <select id="pain-side" aria-label="Side"><option value="left">Left</option><option value="right">Right</option><option value="center">Middle / both</option></select>
        <button class="btn sm" data-a="pain-add">Add</button></div>
      </details>
      <h3 class="sheet-h">How bad is it?</h3>
      <div class="pain-levels" role="radiogroup" aria-label="How bad">
        ${[1, 2, 3].map((n) => `<button data-a="pain-level" data-v="${n}" role="radio" class="lv-${n}"><b>${LEVELS[n].name}</b><span>${LEVELS[n].scale}</span></button>`).join('')}
      </div>
      <p id="pain-advice" class="small"></p>
      ${opts.uid ? '<label class="toggle" id="pain-stop-row" hidden><input type="checkbox" id="pain-stop"><span>Stop this exercise for today</span></label>' : ''}
      <button class="btn primary block big" data-a="pain-save">Save</button>
      <button class="btn block" data-a="close-sheet">Cancel</button>
      <p class="muted small">Not medical advice. Pain-level guidance follows a model used in sports rehab. ${ctx.refChips(['silbernagel2007'])}</p>`);
    refresh();
    $('#pain-map').addEventListener('click', (e) => {
      const el = e.target.closest('[data-m],[data-j]');
      if (!el) return;
      const half = el.closest('[data-half]')?.dataset.half;
      const area = el.dataset.m || el.dataset.j;
      const side = area === 'neck' ? 'center' : sideOf(st.view, half);
      const k = `${area}:${side}`;
      if (st.sel.has(k)) st.sel.delete(k); else st.sel.add(k);
      ctx.haptic?.();
      refresh();
    });
  }

  function addReports(level, keys, exerciseId) {
    const db = ctx.db;
    db.pain ||= [];
    const ts = Date.now();
    for (const k of keys) {
      const [area, side] = k.split(':');
      db.pain.push({ id: `p${ts}${Math.random().toString(36).slice(2, 6)}`, ts, date: todayStr(), area, side, level, ...(exerciseId ? { exerciseId } : {}) });
    }
  }

  // Today: one compact card with each sore area and, once a day, a check-in.
  function todayCard() {
    const db = ctx.db;
    const act = activePain(db);
    if (!act.length) return '';
    const due = new Set(painDue(db).map((r) => r.id));
    return `<section class="card pain-card" aria-label="Pain and soreness">
      <div class="row between"><h3>Pain check</h3><button class="link-btn" data-a="pain-report">Log</button></div>
      ${act.map((r) => `<div class="pain-row">
        <span class="lv-dot lv-${r.level}" aria-hidden="true"></span>
        <span class="grow"><b>${esc(areaLabel(r.area, r.side))}</b><span class="pick-sub">${LEVELS[r.level].name}</span></span>
        ${due.has(r.id) ? `<div class="seg-mini" role="group" aria-label="How is your ${esc(areaLabel(r.area, r.side).toLowerCase())} today">
          <button data-a="pain-check" data-id="${r.id}" data-v="-1">Better</button><button data-a="pain-check" data-id="${r.id}" data-v="0">Same</button><button data-a="pain-check" data-id="${r.id}" data-v="1">Worse</button></div>`
          : `<button class="text-btn small-text" data-a="pain-check" data-id="${r.id}" data-v="-9">Gone</button>`}
      </div>`).join('')}
    </section>`;
  }

  // Exercise screen: what the pain means for this exercise, with one-tap fixes.
  function exerciseCard(ex, item, entry, t, isAvailable) {
    const map = painMap(ctx.db);
    const p = exercisePain(ex, map);
    if (!p || entry?.pain) return '';
    const cur = entry?.sets.find((s) => !s.done)?.weight ?? t.weight;
    const lighter = p.cut && cur ? roundTo(cur * (1 - p.cut), ex.increment || 5) : null;
    const swaps = painSwaps(ctx.db, ex.id, map, 3).filter(({ ex: e }) => isAvailable(e));
    const tip = crossEducationTip(ex, p);
    return `<div class="pain-advice lv-${p.level}" role="note">
      <p><b>${esc(p.labels.join(', '))}</b> · ${p.name.toLowerCase()} pain. ${p.level === 3 ? 'Skip this one today.' : `Go about ${Math.round(p.cut * 100)}% lighter${lighter != null ? ` (${lighter} lb)` : ''} and keep pain at ${p.level === 1 ? '3' : '5'}/10 or less.`}</p>
      ${tip ? `<p class="small">${esc(tip)} ${ctx.refChips(['manca2017'])}</p>` : ''}
      <div class="row wrap">
        ${lighter != null && lighter !== cur ? `<button class="btn sm" data-a="pain-lighter" data-uid="${item.uid}" data-w="${lighter}">Use ${lighter} lb</button>` : ''}
        ${swaps.map(({ ex: e }) => `<button class="btn sm" data-a="pain-swap" data-uid="${item.uid}" data-id="${e.id}">${esc(e.name)}</button>`).join('')}
      </div>
    </div>`;
  }

  const actions = {
    'pain-report': (d) => openPicker({ uid: d.uid, i: d.i != null ? +d.i : null, pre: d.pre || null }),
    'pain-view': (d) => { st.view = d.v; refresh(); },
    'pain-level': (d) => {
      st.level = +d.v;
      const cb = $('#pain-stop');
      if (cb) cb.checked = st.level >= 2; // a sensible default; it can still be changed
      refresh();
    },
    'pain-unsel': (d) => { st.sel.delete(d.k); refresh(); },
    'pain-add': () => {
      const a = $('#pain-area').value;
      const side = a === 'neck' ? 'center' : $('#pain-side').value;
      st.sel.add(`${a}:${side}`);
      refresh();
    },
    'pain-save': () => {
      if (!st.sel.size) return ctx.toast('Tap where it hurts first.');
      if (!st.level) return ctx.toast('Choose how bad it is.');
      const entry = st.uid ? ctx.sessionEntry(st.uid) : null;
      addReports(st.level, st.sel, entry?.exerciseId);
      if (entry && $('#pain-stop')?.checked) ctx.stopForPain(st.uid, st.i);
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(st.level === 3 ? 'Noted. Exercises that load it are flagged.' : `Noted. ${LEVELS[st.level].verb[0].toUpperCase()}${LEVELS[st.level].verb.slice(1)} on exercises that load it.`);
    },
    'pain-check': (d) => {
      const db = ctx.db;
      const r = (db.pain || []).find((x) => x.id === d.id);
      if (!r) return;
      const v = +d.v;
      const level = v === -9 ? 0 : Math.max(0, Math.min(3, r.level + v));
      addReports(level, [`${r.area}:${r.side}`]);
      ctx.persist(); ctx.render();
      ctx.toast(level === 0 ? `Good to hear. ${areaLabel(r.area, r.side)} cleared.` : v > 0 ? `${areaLabel(r.area, r.side)}: ${LEVELS[level].name.toLowerCase()}. ${level === 3 ? 'Consider seeing a clinician if it keeps getting worse.' : ''}` : 'Thanks, noted.');
    },
    'pain-lighter': (d) => {
      const e = ctx.sessionEntry(d.uid, true);
      if (!e) return;
      for (const s of e.sets) if (!s.done) s.weight = +d.w;
      ctx.persist(); ctx.render();
      ctx.toast(`Remaining sets set to ${d.w} lb.`);
    },
    'pain-swap': (d) => ctx.swapEntry(d.uid, d.id),
  };

  return { openPicker, todayCard, exerciseCard, actions, painMap: () => painMap(ctx.db), exercisePain };
}
