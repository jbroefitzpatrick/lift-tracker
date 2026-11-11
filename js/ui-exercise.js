// Create or edit your own exercise: name, equipment, muscles (tap the body map), and notes.
// Custom exercises live in db.exercises with custom: true, so everything else (logging,
// progression, swaps, fatigue, history) treats them like built-in ones.
import { icon } from './icons.js';
import { bodySvg, MUSCLE_NAMES } from './body.js';
import { TYPES, DEFAULT_INCREMENTS } from './plan.js';
import { PATTERNS, METRICS } from './bank.js';

const MEASURES = { reps: 'Reps and weight', time: 'Time', distance: 'Distance', cal: 'Calories' };

export function createExerciseEditor(ctx) {
  const { $, esc } = ctx;
  let st = null;

  function mapHtml() {
    // Main muscles in full color, helpers half.
    const values = Object.fromEntries([...st.primary.map((m) => [m, 1]), ...st.secondary.map((m) => [m, 0.45])]);
    return bodySvg('front', values, { cls: 'pick ex-map', label: 'Front. Tap muscles.' }) + bodySvg('back', values, { cls: 'pick ex-map', label: 'Back. Tap muscles.' });
  }

  function musclesHtml() {
    const chip = (m, kind) => `<button class="chip sm ${kind}" data-a="exe-mus" data-m="${m}">${MUSCLE_NAMES[m]}${kind === 'main' ? '' : ' (helper)'} ×</button>`;
    if (!st.primary.length && !st.secondary.length) return '<p class="muted small center">Tap a muscle once for main, twice for helper, three times to clear.</p>';
    return `<div class="chips wrap">${st.primary.map((m) => chip(m, 'main')).join('')}${st.secondary.map((m) => chip(m, 'helper')).join('')}</div>`;
  }

  function cycle(m) {
    if (st.primary.includes(m)) { st.primary = st.primary.filter((x) => x !== m); st.secondary.push(m); }
    else if (st.secondary.includes(m)) st.secondary = st.secondary.filter((x) => x !== m);
    else st.primary.push(m);
    $('#exe-map').innerHTML = mapHtml();
    $('#exe-mus').innerHTML = musclesHtml();
  }

  function seg(key, options, cur) {
    return `<div class="segmented small-seg wrap-seg" role="radiogroup">${Object.entries(options).map(([k, v]) => `<button class="${cur === k ? 'on' : ''}" data-a="exe-set" data-k="${key}" data-v="${k}" role="radio" aria-checked="${cur === k}">${v}</button>`).join('')}</div>`;
  }

  // opts: { name, then(exId) } — then() runs after saving a new exercise (e.g. add it to the workout).
  function open(opts = {}) {
    const ex = opts.id ? ctx.db.exercises[opts.id] : null;
    st = {
      id: ex?.id || null, then: opts.then || null,
      type: ex?.type || 'machine', category: ex?.category || 'accessory', metric: ex?.metric || 'reps',
      primary: [...(ex?.primary || [])], secondary: [...(ex?.secondary || [])],
    };
    ctx.openSheet(`<h2>${ex ? 'Edit exercise' : 'New exercise'}</h2>
      <div class="field"><span>Name</span><input id="exe-name" type="text" autocapitalize="words" value="${esc(ex?.name || opts.name || '')}" placeholder="e.g. Belt squat"></div>
      <div class="field"><span>Equipment</span><div id="exe-type">${seg('type', TYPES, st.type)}</div></div>
      <div class="field"><span>Type ${ctx.helpBtn()}</span><p class="help-text" hidden>Compound: several joints and big muscles (squat, row, press). Accessory: one main muscle (curl, raise). Conditioning: cardio, circuits and carries.</p>
        <div id="exe-category">${seg('category', { compound: 'Compound', accessory: 'Accessory', conditioning: 'Conditioning' }, st.category)}</div></div>
      <div class="field"><span>Muscles</span>
        <div id="exe-map" class="body-pair ex-map-pair">${mapHtml()}</div>
        <div id="exe-mus">${musclesHtml()}</div></div>
      <details class="pain-list" ${st.metric !== 'reps' ? 'open' : ''}><summary>More options</summary>
        <div class="field"><span>Measured by</span><div id="exe-metric">${seg('metric', MEASURES, st.metric)}</div></div>
        <div class="field"><span>Movement ${ctx.helpBtn()}</span><p class="help-text" hidden>Optional. Used to suggest similar exercises when you swap.</p>
          <select id="exe-pattern"><option value="">Not sure</option>${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${ex?.pattern === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><span>Weight jump (lb) ${ctx.helpBtn()}</span><p class="help-text" hidden>How much the weight goes up when you progress.</p>
          <input id="exe-inc" type="text" inputmode="decimal" value="${ex?.increment ?? ''}" placeholder="${DEFAULT_INCREMENTS[st.type] || 5}"></div>
      </details>
      <div class="field"><span>Notes</span><textarea id="exe-notes" rows="2" placeholder="Setup, cues, seat height…">${esc(ex?.notes || '')}</textarea></div>
      <button class="btn primary block big" data-a="exe-save">${ex ? 'Save' : opts.then ? 'Create and add' : 'Create'}</button>
      ${ex?.custom ? '<button class="btn danger block" data-a="exe-delete">Delete exercise</button>' : ''}
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`);
    $('#exe-map').addEventListener('click', (e) => {
      const el = e.target.closest('[data-m]');
      if (el) { cycle(el.dataset.m); ctx.haptic(); }
    });
  }

  const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise';

  const actions = {
    'exe-set': (d, el) => {
      st[d.k] = d.v;
      el.parentElement.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-checked', String(b === el)); });
      if (d.k === 'type') $('#exe-inc').placeholder = DEFAULT_INCREMENTS[d.v] || 5;
      if (d.k === 'category' && d.v === 'conditioning' && st.metric === 'reps') { /* reps still fine for e.g. burpees */ }
    },
    'exe-mus': (d) => cycle(d.m), // tapping a chip moves it along: main → helper → removed
    'exe-save': () => {
      const db = ctx.db;
      let name = $('#exe-name').value.trim().replace(/\s+/g, ' ');
      if (name === name.toLowerCase()) name = name[0]?.toUpperCase() + name.slice(1); // "viking press" from search → "Viking press"
      if (!name) return ctx.toast('Give it a name.');
      if (!st.primary.length) return ctx.toast('Tap at least one main muscle on the body.');
      const inc = parseFloat($('#exe-inc').value);
      const fields = {
        name, type: st.type, category: st.category, metric: st.metric,
        primary: [...st.primary], secondary: st.secondary.filter((m) => !st.primary.includes(m)),
        pattern: $('#exe-pattern').value, notes: $('#exe-notes').value.trim(),
        increment: Number.isFinite(inc) && inc > 0 ? inc : db.settings.defaultIncrements?.[st.type] || DEFAULT_INCREMENTS[st.type] || 5,
      };
      let id = st.id;
      if (id) Object.assign(db.exercises[id], fields, { customMeta: true });
      else {
        const dup = Object.values(db.exercises).find((e) => e.name.toLowerCase() === name.toLowerCase());
        if (dup && !confirm(`"${dup.name}" already exists. Create another one anyway?`)) return;
        id = slug(name);
        while (db.exercises[id]) id += '-2';
        db.exercises[id] = { id, ...fields, substitute: '', minRir: 0, rules: {}, startWeight: null, custom: true, customMeta: true };
      }
      ctx.persist();
      ctx.closeSheet();
      const then = st.then;
      if (then) setTimeout(() => then(id), 200);
      else { ctx.render(); ctx.toast(`${name} saved.`); }
    },
    'exe-delete': () => {
      const db = ctx.db;
      const id = st.id;
      const used = Object.values(db.plan).some((p) => p.items.some((i) => i.exerciseId === id || i.variants?.includes(id)))
        || Object.values(db.activeSession?.entries || {}).some((e) => e.exerciseId === id);
      if (used) return ctx.toast('It\'s in your plan or today\'s workout. Swap it out first.');
      if (db.sessions.some((s) => s.entries.some((e) => e.exerciseId === id))) return ctx.toast('It\'s in your workout history, so it stays. Mark it "Never suggest" to hide it.');
      if (!confirm(`Delete ${db.exercises[id].name}? Past workouts that used it keep their records.`)) return;
      delete db.exercises[id];
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast('Exercise deleted.');
    },
  };

  return { open, actions };
}
