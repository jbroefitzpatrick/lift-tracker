// Focus lifts picker: the lifts to push during a training block.
// Two ways to choose: a few lifts overall (2–4), or one or two per training day.
// Suggestions come first, but any exercise can be chosen. A lift that isn't in the plan yet
// takes the place of the most similar lift (or is added first on the day) when you save.
//
// Stored as db.blocks.focus[block] = [exerciseId] (what the rest of the app reads) and, for
// by-day choices, db.blocks.byDay[block] = { day: [exerciseId] }.
import { icon } from './icons.js';
import { DAY_KEYS, resolveDay } from './engine.js';

const FULL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const BIG = /squat|hinge|deadlift|push|press|pull|row/i;
const MAX_OVERALL = 4;

export function createFocus(ctx) {
  const { $, esc } = ctx;
  let st = null;

  // By-day choices carry forward with the focus lifts until a later block sets its own.
  function byDayFor(index) {
    const f = ctx.db.blocks.focus || {};
    for (let i = index; i >= 1; i--) if (f[i]?.length) return ctx.db.blocks.byDay?.[i] || null;
    return null;
  }

  const liftDays = () => DAY_KEYS.filter((d) => ctx.db.plan[d] && ['lift', 'both'].includes(ctx.db.settings.dayModes?.[d] || 'lift'));
  const dayItems = (d) => resolveDay(ctx.db, d, { template: true }).filter((i) => i.ex.category !== 'conditioning');
  // Upper, lower and full-body days cover enough to push two lifts; narrower days get one.
  const dayLimit = (d) => (/upper|lower|full|leg|total/i.test(ctx.db.plan[d]?.name || '') ? 2 : 1);
  const usable = (e) => e.category !== 'conditioning' && ctx.isAvailable(e) && ctx.db.exPrefs?.[e.id] !== 'never';

  // How good a focus candidate a lift is: big barbell movements done early in the day rank highest.
  function rank(ex, pos = 9) {
    return (ex.category === 'compound' ? 4 : 0) + (ex.type?.startsWith('barbell') ? 3 : 0) + (BIG.test(ex.pattern || '') ? 2 : 0)
      + (ex.id.startsWith('weighted-') ? 1 : 0) + (pos === 0 ? 2 : pos === 1 ? 1 : 0);
  }

  // Where a lift lives in the plan: [{ day, uid }].
  function slotsOf(id) {
    const out = [];
    for (const d of liftDays()) for (const it of dayItems(d)) if (it.exerciseId === id) out.push({ day: d, uid: it.uid });
    return out;
  }

  // For a lift that isn't in the plan (on that day): replace the most similar compound, or add it first.
  function placeFor(id, day = null) {
    const db = ctx.db;
    const ex = db.exercises[id];
    const chosen = new Set([...st.general, ...Object.values(st.byDay).flat()].map((x) => x.id));
    let best = null;
    for (const d of day ? [day] : liftDays()) {
      const items = dayItems(d);
      for (const it of items) {
        if (chosen.has(it.exerciseId) || it.ex.category !== 'compound') continue;
        const same = ex.pattern && it.ex.pattern === ex.pattern;
        const shared = it.ex.primary.filter((m) => ex.primary.includes(m)).length;
        const score = (same ? 10 : 0) + shared * 3;
        if (score >= 6 && (!best || score > best.score)) best = { score, day: d, replaceUid: it.uid, replaces: it.ex.name };
      }
      if (!best && !day) {
        const overlap = items.reduce((a, it) => a + it.ex.primary.filter((m) => ex.primary.includes(m)).length, 0);
        if (!st._add || overlap > st._add.overlap) st._add = { overlap, day: d };
      }
    }
    if (best) return { day: best.day, replaceUid: best.replaceUid, replaces: best.replaces };
    const d = day || st._add?.day || liftDays()[0];
    st._add = null;
    return { day: d, replaceUid: null };
  }

  function pick(id, day = null) {
    const list = day ? (st.byDay[day] ||= []) : st.general;
    if (list.some((x) => x.id === id)) return;
    const limit = day ? dayLimit(day) : MAX_OVERALL;
    if (list.length >= limit) {
      if (day && limit === 1) list.length = 0; // one per day: picking another replaces it
      else return ctx.toast(day ? `Up to ${limit} on ${FULL[day]}s. Remove one first.` : `Up to ${MAX_OVERALL} focus lifts. Remove one first.`);
    }
    const inPlace = day ? dayItems(day).some((i) => i.exerciseId === id) : slotsOf(id).length > 0;
    list.push({ id, place: inPlace ? null : placeFor(id, day) });
  }

  function suggestions(day = null) {
    const db = ctx.db;
    const seen = new Set();
    const inPlan = [];
    for (const d of day ? [day] : liftDays()) {
      dayItems(d).forEach((it, pos) => {
        if (it.ex.category !== 'compound' || seen.has(it.exerciseId)) return;
        seen.add(it.exerciseId);
        inPlan.push({ ex: it.ex, score: rank(it.ex, pos) + 3 });
      });
    }
    // Strong options that aren't in the plan: big lifts for the muscles those days train.
    const muscles = new Set((day ? [day] : liftDays()).flatMap((d) => dayItems(d).flatMap((i) => i.ex.primary)));
    const others = Object.values(db.exercises)
      .filter((e) => e.category === 'compound' && !seen.has(e.id) && usable(e) && muscles.has(e.primary[0]) && rank(e) >= 7)
      .map((e) => ({ ex: e, score: rank(e), other: true }));
    return [...inPlan.sort((a, b) => b.score - a.score).slice(0, day ? 4 : 6), ...others.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name)).slice(0, day ? 3 : 5)];
  }

  // Overall mode: where the focus lifts land in the week. Every training day starts with at least
  // one, and with more lifts than days each day takes two (upper, lower and full-body days), so the
  // main lifts are practised twice a week. Frequency adds strength on top of volume (grgic2018freq,
  // pelland2026), and a lift done first in the session gets the most effort. A second turn goes
  // to the lifts done least so far; hinges (deadlifts) don't repeat, since they're the slowest to
  // recover from. Lifts already on a day stay where they are.
  function spreadFocus(list) {
    const days = liftDays();
    const ids = list.map((x) => x.id);
    if (!ids.length || !days.length) return { map: {}, extra: [] };
    const per = Math.max(1, Math.ceil(ids.length / days.length));
    const cap = (d) => Math.min(dayLimit(d), per);
    const map = Object.fromEntries(days.map((d) => [d, []]));
    const count = (id) => days.filter((d) => map[d].includes(id)).length;
    for (const id of ids) for (const sl of slotsOf(id)) if (map[sl.day] && map[sl.day].length < cap(sl.day) && !map[sl.day].includes(id)) map[sl.day].push(id);
    // Picked lifts that aren't in the plan yet land where they were placed.
    for (const x of list) if (x.place && !count(x.id) && map[x.place.day]) map[x.place.day].push(x.id);
    const extra = [];
    const fits = (id, d) => { const ex = ctx.db.exercises[id]; return /full|total/i.test(ctx.db.plan[d]?.name || '') || dayItems(d).some((i) => i.ex.primary.some((m) => ex.primary.includes(m))); };
    for (const d of days) {
      while (map[d].length < cap(d)) {
        const hinge = (id) => /hinge/.test(ctx.db.exercises[id]?.pattern || '') || /deadlift/.test(id);
        const cands = ids.filter((id) => !map[d].includes(id) && fits(id, d) && !(hinge(id) && count(id) >= 1)
          && !map[d].some((o) => ctx.db.exercises[o]?.pattern && ctx.db.exercises[o].pattern === ctx.db.exercises[id]?.pattern))
          .sort((a, b) => count(a) - count(b) || ids.indexOf(a) - ids.indexOf(b));
        if (!cands.length) break;
        const id = cands[0];
        map[d].push(id);
        if (dayItems(d).some((i) => i.exerciseId === id)) continue;
        // Takes the place of a big lift for the same muscles that day (DB incline bench for bench press),
        // so the day doesn't get longer; otherwise the most similar lift, or it's added first.
        const ex = ctx.db.exercises[id];
        const taken = new Set(extra.filter((e) => e.day === d && e.place.replaceUid).map((e) => e.place.replaceUid));
        const same = dayItems(d).find((i) => i.ex.category === 'compound' && !ids.includes(i.exerciseId) && !taken.has(i.uid) && (i.ex.pattern === ex.pattern || i.ex.primary[0] === ex.primary[0]));
        extra.push({ id, day: d, place: same ? { day: d, replaceUid: same.uid, replaces: same.ex.name } : placeFor(id, d) });
      }
    }
    return { map, extra };
  }

  function selectedRow(x, day) {
    const ex = ctx.db.exercises[x.id];
    if (!ex) return '';
    const where = x.place
      ? (x.place.replaceUid ? `In place of ${x.place.replaces} on ${FULL[x.place.day]}` : `Added first on ${FULL[x.place.day]}`)
      : (day ? 'In this day' : slotsOf(x.id).map((s) => FULL[s.day]).join(', '));
    return `<div class="list-row focus-row"><span class="thumb sm">${ctx.thumb(ex)}</span><span class="grow"><b>${esc(ex.name)}</b><span class="pick-sub ${x.place ? 'accent-text' : ''}">${esc(where)}</span></span>
      <button class="icon-btn subtle" data-a="fx-remove" data-id="${x.id}" data-day="${day || ''}" aria-label="Remove ${esc(ex.name)}">${icon('x')}</button></div>`;
  }

  function chips(day) {
    const chosen = new Set((day ? st.byDay[day] || [] : st.general).map((x) => x.id));
    const list = suggestions(day).filter((s) => !chosen.has(s.ex.id));
    return `<div class="chips wrap" role="group" aria-label="Suggested lifts">
      ${list.map((s) => `<button class="chip ${s.other ? 'ghost' : ''}" data-a="fx-pick" data-id="${s.ex.id}" data-day="${day || ''}">${s.other ? '+ ' : ''}${esc(s.ex.name)}</button>`).join('')}
      <button class="chip search-chip" data-a="fx-search" data-day="${day || ''}">${icon('search')} Any exercise</button></div>`;
  }

  function weekPreview() {
    if (!st.general.length) return '';
    const { map, extra } = spreadFocus(st.general);
    const name = (id) => esc(ctx.db.exercises[id]?.name || id);
    return `<h3 class="sheet-h">Your week</h3>
      <div class="list-group fx-week">${liftDays().map((d) => `<div class="list-row"><span class="grow"><b>${FULL[d]} · ${esc(ctx.db.plan[d].name)}</b><span class="pick-sub">${(map[d] || []).map((id) => { const e = extra.find((x) => x.id === id && x.day === d); return e ? `<span class="accent-text">${name(id)} (${e.place.replaceUid ? `in place of ${esc(e.place.replaces)}` : 'added first'})</span>` : name(id); }).join(', ') || 'No focus lift'}</span></span></div>`).join('')}</div>
      ${extra.length ? `<p class="muted small">So every day starts with a focus lift, ${extra.length === 1 ? 'one lift is' : 'some lifts are'} practised twice a week. ${ctx.refChips(['grgic2018freq'])}</p>` : ''}`;
  }

  function body() {
    if (st.search) return searchBody();
    const seg = `<div class="segmented small-seg" role="radiogroup" aria-label="How to choose">
      <button class="${st.mode === 'general' ? 'on' : ''}" data-a="fx-mode" data-v="general" role="radio" aria-checked="${st.mode === 'general'}">Overall</button>
      <button class="${st.mode === 'day' ? 'on' : ''}" data-a="fx-mode" data-v="day" role="radio" aria-checked="${st.mode === 'day'}">By day</button></div>`;
    let html = '';
    if (st.mode === 'general') {
      html = `<p class="muted small">Pick 2–4 lifts to push this block, from anywhere in your week.</p>
        ${st.general.map((x) => selectedRow(x, null)).join('') || '<p class="muted small pad">Nothing picked yet.</p>'}
        ${weekPreview()}
        <h3 class="sheet-h">Suggested</h3>${chips(null)}`;
    } else {
      html = `<p class="muted small">Pick the lift each training day is built around. Upper, lower and full-body days can have two.</p>
        ${liftDays().map((d) => `<section class="fx-day"><div class="row between"><h3 class="sheet-h">${FULL[d]} · ${esc(ctx.db.plan[d].name)}</h3><span class="muted small">${(st.byDay[d] || []).length} of ${dayLimit(d)}</span></div>
          ${(st.byDay[d] || []).map((x) => selectedRow(x, d)).join('')}
          ${chips(d)}</section>`).join('')}`;
    }
    return `${seg}${html}
      <p class="muted small">Lifts with a + aren't in your plan yet. Picking one swaps it in for the most similar lift when you save. Focus lifts stay the same all block, even with exercise variety on.</p>
      <button class="btn primary block big" data-a="fx-save">Save focus lifts</button>
      <button class="btn plain block" data-a="close-sheet">Cancel</button>`;
  }

  function searchList() {
    const q = st.search.q.trim().toLowerCase();
    const list = Object.values(ctx.db.exercises)
      .filter((e) => usable(e) && (st.search.all || e.category === 'compound') && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name)).slice(0, 60);
    return list.map((e) => `<button class="pick-row" data-a="fx-pick" data-id="${e.id}" data-day="${st.search.day || ''}"><span class="thumb sm">${ctx.thumb(e)}</span>
      <span class="grow"><b>${esc(e.name)}</b><span class="pick-sub">${esc(ctx.muscleLine(e))}</span></span></button>`).join('') || '<p class="muted small pad">No matches.</p>';
  }

  function searchBody() {
    return `<div class="row"><button class="icon-btn" data-a="fx-search-close" aria-label="Back">${icon('left')}</button><input id="fx-q" class="search grow" type="search" placeholder="Search exercises" autocomplete="off" value="${esc(st.search.q)}"></div>
      <div class="chips"><button class="chip ${st.search.all ? '' : 'on'}" data-a="fx-all" data-v="">Compound lifts</button><button class="chip ${st.search.all ? 'on' : ''}" data-a="fx-all" data-v="1">All exercises</button></div>
      <div id="fx-list">${searchList()}</div>`;
  }

  function refresh() { const el = $('#fx-body'); if (el) el.innerHTML = body(); }

  function open(index) {
    const db = ctx.db;
    const stored = byDayFor(index);
    st = { index, mode: stored ? 'day' : 'general', general: [], byDay: {}, search: null };
    for (const id of ctx.focusFor(index)) if (db.exercises[id]) st.general.push({ id, place: null });
    if (stored) for (const [d, ids] of Object.entries(stored)) st.byDay[d] = ids.filter((id) => db.exercises[id]).map((id) => ({ id, place: null }));
    ctx.openSheet(`<h2>Focus lifts · block ${index}</h2><div id="fx-body">${body()}</div>`);
    $('#fx-body').addEventListener('input', (e) => {
      if (e.target.id !== 'fx-q' || !st.search) return;
      st.search.q = e.target.value;
      $('#fx-list').innerHTML = searchList();
    });
  }

  const actions = {
    'fx-mode': (d) => {
      st.mode = d.v;
      if (d.v === 'general' && st.general.length > MAX_OVERALL) st.general.length = MAX_OVERALL;
      // First time in by-day: start each day with its top suggestion.
      if (d.v === 'day' && !Object.values(st.byDay).some((l) => l.length)) {
        for (const day of liftDays()) { const top = suggestions(day)[0]; if (top) st.byDay[day] = [{ id: top.ex.id, place: null }]; }
      }
      refresh();
    },
    'fx-pick': (d) => { pick(d.id, d.day || null); st.search = null; refresh(); },
    'fx-remove': (d) => {
      const list = d.day ? st.byDay[d.day] : st.general;
      const i = list.findIndex((x) => x.id === d.id);
      if (i >= 0) list.splice(i, 1);
      refresh();
    },
    'fx-search': (d) => { st.search = { day: d.day || null, q: '', all: false }; refresh(); $('#fx-q')?.focus(); },
    'fx-search-close': () => { st.search = null; refresh(); },
    'fx-all': (d) => { st.search.all = !!d.v; refresh(); },
    'fx-save': () => {
      const db = ctx.db;
      const chosen = st.mode === 'day' ? liftDays().flatMap((d) => st.byDay[d] || []) : st.general;
      if (!chosen.length) return ctx.toast('Pick at least one lift.');
      const changes = [];
      const spread = st.mode === 'day' ? { extra: [] } : spreadFocus(st.general);
      for (const x of chosen) {
        if (!x.place) continue;
        if (x.place.replaceUid) ctx.planSwap(x.place.day, x.place.replaceUid, x.id); else ctx.planAddTop(x.place.day, x.id);
        changes.push(`${db.exercises[x.id].name} ${x.place.replaceUid ? `replaces ${x.place.replaces}` : 'added'} on ${FULL[x.place.day]}`);
      }
      for (const e of spread.extra) {
        if (e.place.replaceUid) ctx.planSwap(e.day, e.place.replaceUid, e.id); else ctx.planAddTop(e.day, e.id);
        changes.push(`${db.exercises[e.id].name} ${e.place.replaceUid ? `replaces ${e.place.replaces}` : 'added'} on ${FULL[e.day]}`);
      }
      db.blocks.focus[st.index] = [...new Set(chosen.map((x) => x.id))];
      db.blocks.byDay ||= {};
      if (st.mode === 'day') db.blocks.byDay[st.index] = Object.fromEntries(liftDays().filter((d) => st.byDay[d]?.length).map((d) => [d, st.byDay[d].map((x) => x.id)]));
      else delete db.blocks.byDay[st.index];
      ctx.reapplyVariety();
      ctx.persist(); ctx.closeSheet(); ctx.render();
      ctx.toast(changes.length ? `Saved. ${changes.join('; ')}.` : 'Focus lifts saved.');
    },
  };

  // Which day a focus lift belongs to (by-day mode), for labels.
  function dayOf(index, id) {
    const by = byDayFor(index);
    if (!by) return null;
    return Object.keys(by).find((d) => by[d].includes(id)) || null;
  }

  return { open, actions, dayOf };
}
