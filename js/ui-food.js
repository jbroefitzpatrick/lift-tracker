// Food tab: daily targets, meal logging, saved meals, meal ideas and the weekly check-in.
import { icon } from './icons.js';
import { FOODS } from './foods.js';
import { targets, dayTotals, weeklyCheckin, MEAL_TEMPLATES, solveMeal, macrosFor, foodById, ACTIVITY } from './nutrition.js';
import { PHASE_TYPES } from './year.js';
import { todayStr, addDays } from './store.js';

const CATS = { protein: 'Protein', carb: 'Carbs', fruit: 'Fruit', veg: 'Veg', dairy: 'Dairy', fat: 'Fats & nuts', treat: 'Treats', drink: 'Drinks', other: 'Sauces' };
const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;

export function createFood(ctx) {
  const { esc, $ } = ctx;
  const ui = ctx.ui;
  const st = { q: '', cat: 'all', meal: 1, pickFood: null };

  const date = () => ui.foodDate || todayStr();
  const fmtDay = (d) => (d === todayStr() ? 'Today' : d === addDays(todayStr(), -1) ? 'Yesterday' : ctx.fmtDate(d));

  function screen() {
    const db = ctx.db;
    const d = date();
    const t = targets(db, d);
    const tot = dayTotals(db, d);
    const ph = t.goal.phase;
    const goalChip = ph ? `${PHASE_TYPES[ph.phase.type].label} · week ${ph.weekInPhase} of ${ph.weeks}` : `${PHASE_TYPES[t.goal.type].label}${db.profile ? '' : ' · default targets'}`;
    const entries = db.foodLog.filter((x) => x.date === d);
    const left = t.kcal - r0(tot.kcal);
    const pct = Math.min(100, (tot.kcal / t.kcal) * 100);
    const meals = Array.from({ length: t.meals }, (_, i) => i + 1);
    const mealCards = meals.map((m) => {
      const items = entries.filter((x) => Math.min(x.meal, t.meals) === m);
      const mt = items.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p }), { kcal: 0, p: 0 });
      const low = items.length && mt.p < t.perMealProtein * 0.8;
      return `<section class="card meal" aria-label="Meal ${m}">
        <div class="meal-head">
          <div class="grow"><h3>Meal ${m}</h3><p class="muted small">${items.length ? `${r0(mt.kcal)} kcal · ${r0(mt.p)} g protein${low ? ` · <span class="hint">aim ~${t.perMealProtein} g</span>` : ''}` : `Aim ~${Math.round(t.kcal / t.meals / 10) * 10} kcal · ${t.perMealProtein} g protein`}</p></div>
          <button class="icon-btn accent" data-a="food-add" data-meal="${m}" aria-label="Add food to meal ${m}">${icon('plus')}</button>
        </div>
        ${items.map((x) => `<div class="list-row food-row"><span class="grow"><b>${esc(x.name)}</b><span class="pick-sub">${esc(fmtQty(x))} · ${r0(x.kcal)} kcal · P ${r0(x.p)} · C ${r0(x.c)} · F ${r0(x.f)}</span></span>
          <button class="icon-btn subtle" data-a="food-del" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">${icon('x')}</button></div>`).join('')}
        <div class="row wrap controls">
          <button class="mini" data-a="food-ideas" data-meal="${m}">Meal ideas</button>
          ${items.length ? `<button class="mini" data-a="meal-save" data-meal="${m}">Save meal</button>` : `<button class="mini" data-a="meal-saved" data-meal="${m}">Saved meals</button>`}
        </div>
      </section>`;
    }).join('');
    const yEntries = db.foodLog.filter((x) => x.date === addDays(d, -1));
    const macro = (label, val, target, cls) => {
      const p = target ? Math.min(100, (val / target) * 100) : 0;
      return `<div class="macro ${cls}"><div class="row between"><span>${label}</span><span class="tnum small">${r0(val)}<span class="muted">/${r0(target)} g</span></span></div>
        <span class="progress thin" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${r0(target)}" aria-valuenow="${r0(val)}"><i style="width:${Math.max(p, 2)}%"></i></span></div>`;
    };

    return `<header class="top"><div class="grow"><h1>Nutrition</h1><p class="subtitle">${esc(goalChip)}</p></div></header>
      <div class="date-nav" role="group" aria-label="Day">
        <button class="icon-btn" data-a="food-day" data-v="-1" aria-label="Previous day">${icon('left')}</button>
        <b>${fmtDay(d)}</b>
        <button class="icon-btn" data-a="food-day" data-v="1" aria-label="Next day" ${d >= todayStr() ? 'disabled' : ''}>${icon('right')}</button>
      </div>
      ${db.profile ? '' : '<div class="banner"><p>These targets use defaults. Set up the <b>plan builder</b> (Plan tab) for personal targets.</p></div>'}
      <section class="card hero" aria-label="Today's targets">
        <div class="row between">
          <div><span class="hero-num tnum ${left < 0 ? 'over' : ''}">${Math.abs(left).toLocaleString()}</span> <span class="muted">kcal ${left >= 0 ? 'left' : 'over'}</span></div>
          <button class="link-btn" data-a="food-why">How it's set</button>
        </div>
        <span class="progress" role="progressbar" aria-label="Calories" aria-valuemin="0" aria-valuemax="${t.kcal}" aria-valuenow="${r0(tot.kcal)}"><i style="width:${Math.max(pct, 2)}%"></i></span>
        <p class="muted small">${r0(tot.kcal).toLocaleString()} of ${t.kcal.toLocaleString()} kcal${t.floored ? ' · held at a safe minimum' : ''}</p>
        <div class="macro-grid">
          ${macro('Protein', tot.p, t.protein, 'm-p')}
          ${macro('Carbs', tot.c, t.carbs, 'm-c')}
          ${macro('Fat', tot.f, t.fat, 'm-f')}
          ${macro('Fiber', tot.fiber, t.fiber, 'm-fi')}
        </div>
      </section>
      <div class="chips quick-row">
        <button class="chip" data-a="food-quick">Quick add</button>
        ${!entries.length && yEntries.length ? '<button class="chip" data-a="food-copy">Copy yesterday</button>' : ''}
        <button class="chip" data-a="food-mine">My foods</button>
        <button class="chip" data-a="food-settings">Settings</button>
      </div>
      ${mealCards}
      ${checkinCard()}
      <p class="muted small center pad">Food data: USDA FoodData Central (public domain). Phases are set in Plan → Year.</p>`;
  }

  function openSettings() {
    const db = ctx.db;
    const t = targets(db, date());
    ctx.openSheet(`<h2>Nutrition settings</h2>
      <div class="field"><span>Meals per day</span><div class="segmented small-seg" role="radiogroup" aria-label="Meals per day">${[3, 4, 5, 6].map((n) => `<button class="${t.meals === n ? 'on' : ''}" data-a="food-meals" data-v="${n}" role="radio" aria-checked="${t.meals === n}">${n}</button>`).join('')}</div></div>
      <div class="field"><span>Daily activity outside workouts</span><div class="list-group">${Object.entries(ACTIVITY).map(([k, v]) => `<button class="list-row" data-a="food-activity" data-v="${k}" aria-pressed="${db.nutrition.activity === k}"><span class="grow">${v.label}</span>${db.nutrition.activity === k ? `<span class="chev accent">${icon('check')}</span>` : ''}</button>`).join('')}</div></div>
      ${db.nutrition.kcalOffset ? `<div class="list-group"><div class="list-row"><span class="grow">Check-in adjustment: <b>${db.nutrition.kcalOffset > 0 ? '+' : ''}${db.nutrition.kcalOffset} kcal/day</b></span><button class="mini" data-a="food-offset-reset">Reset</button></div></div>` : ''}
      <button class="btn ghost block" data-a="close-sheet">Done</button>`);
  }

  function fmtQty(x) {
    if (x.unit === 'g') return `${r0(x.qty)} g`;
    if (x.unit === 'oz') return `${r1(x.qty)} oz`;
    if (x.unit === 'entry' || x.unit === 'quick') return x.unit === 'quick' ? 'Quick add' : 'Entry';
    return `${r1(x.qty)} × ${x.unit}`;
  }

  function checkinCard() {
    const db = ctx.db;
    const c = weeklyCheckin(db);
    const recent = (db.nutrition.checkins || []).find((x) => x.date > addDays(todayStr(), -6));
    return `<div class="card">
      <h3>Weekly check-in</h3>
      ${c.messages.map((m) => `<p class="small">${esc(m)}</p>`).join('')}
      ${c.refs.length ? `<p>${ctx.refChips(c.refs)}</p>` : ''}
      ${c.suggestion && !recent ? `<button class="btn primary block" data-a="food-apply" data-v="${c.suggestion}">Apply ${c.suggestion > 0 ? '+' : ''}${c.suggestion} kcal/day</button>` : ''}
      ${recent ? `<p class="muted small">Adjusted ${ctx.fmtDate(recent.date)} (${recent.kcal > 0 ? '+' : ''}${recent.kcal} kcal). Give it a week before changing again.</p>` : ''}
    </div>`;
  }

  // ---------- Sheets ----------

  function openWhy() {
    const db = ctx.db;
    const t = targets(db, date());
    const a = t.adaptive;
    ctx.openSheet(`<h2>How your targets are set</h2>
      <div class="rx-row"><span class="muted">Maintenance</span><b>${t.maintenance} kcal</b></div>
      <p class="muted small">${a.ready ? `From your log: you ate ~${r0(a.intake)} kcal/day while weight changed ${a.lbPerWeek >= 0 ? '+' : ''}${a.lbPerWeek.toFixed(2)} lb/week (${a.loggedDays} days logged).` : `Estimated: resting energy (Mifflin-St Jeor) × daily activity + planned training. After ~2 weeks of food and weight logging this switches to your real numbers (${a.loggedDays}/10 food days, ${a.weighIns}/6 weigh-ins).`} ${ctx.refChips(['mifflin1990', 'ainsworth2011', 'hall2008'])}</p>
      <div class="rx-row"><span class="muted">${PHASE_TYPES[t.goal.type].label} adjustment</span><b>${t.deltaKcal >= 0 ? '+' : ''}${t.deltaKcal} kcal</b></div>
      <p class="muted small">${t.goal.goal === 'gain' ? `Gain ${t.rate[0]}–${t.rate[1]}% of bodyweight per week.` : t.goal.goal === 'lose' ? `Lose ${t.rate[0]}–${t.rate[1]}% of bodyweight per week.` : 'Hold your weight steady.'} ${ctx.refChips(t.goal.goal === 'lose' ? ['helms2014'] : ['iraki2019'])}</p>
      ${t.offset ? `<div class="rx-row"><span class="muted">Check-in adjustment</span><b>${t.offset > 0 ? '+' : ''}${t.offset} kcal</b></div>` : ''}
      <div class="rx-row"><span class="muted">Protein</span><b>${t.protein} g (range ${t.proteinRange[0]}–${t.proteinRange[1]})</b></div>
      <p class="muted small">${t.goal.goal === 'lose' ? 'Higher while dieting to protect muscle.' : 'Around 1.6–2.2 g/kg, where muscle gains plateau.'} About ${t.perMealProtein} g per meal across ${t.meals} meals. ${ctx.refChips(t.goal.goal === 'lose' ? ['helms2014protein', 'morton2018'] : ['morton2018', 'jager2017', 'schoenfeld2018meal'])}</p>
      <div class="rx-row"><span class="muted">Fat</span><b>${t.fat} g</b></div>
      <p class="muted small">About 25% of calories, never below ~0.6 g/kg. ${ctx.refChips(['helms2014'])}</p>
      <div class="rx-row"><span class="muted">Carbs</span><b>${t.carbs} g</b></div>
      <p class="muted small">The rest of your calories — fuel for training.</p>
      <div class="rx-row"><span class="muted">Fiber</span><b>${t.fiber} g</b></div>
      <p class="muted small">14 g per 1,000 kcal. ${ctx.refChips(['dga2020'])}</p>
      <p class="muted small">Estimates, not medical advice. If you have a medical condition or a history of disordered eating, work with a doctor or dietitian.</p>
      <button class="btn block" data-a="close-sheet">Close</button>`);
  }

  function foodList() {
    const db = ctx.db;
    const q = st.q.trim().toLowerCase();
    const mine = db.customFoods.map((f) => ({ ...f, cat: 'mine' }));
    const all = [...mine, ...FOODS];
    const list = all.filter((f) => (st.cat === 'all' || f.cat === st.cat) && (!q || f.name.toLowerCase().includes(q))).slice(0, 80);
    return list.map((f) => `<button class="pick-row" data-a="food-pick" data-id="${f.id}">
      <span class="grow"><b>${esc(f.name)}</b><span class="pick-sub">${f.per100 ? `per 100 g: ${f.per100.kcal} kcal · P ${f.per100.p} · C ${f.per100.c} · F ${f.per100.f}` : `per ${esc(f.serving || 'serving')}: ${f.kcal} kcal · P ${f.p} · C ${f.c} · F ${f.f}`}</span></span>
      ${f.cat === 'mine' ? '<span class="cat">Mine</span>' : ''}</button>`).join('') || '<p class="muted small pad">No matches. Create it as your own food.</p>';
  }

  function openAdd(meal) {
    st.meal = meal; st.q = ''; st.cat = 'all';
    ctx.openSheet(`<h2>Add to meal ${meal}</h2>
      <input id="food-q" class="search" type="search" placeholder="Search foods" autocomplete="off">
      <div class="chips pk-filters">${[['all', 'All'], ['mine', 'Mine'], ...Object.entries(CATS)].map(([k, v]) => `<button class="chip ${k === 'all' ? 'on' : ''}" data-a="food-cat" data-v="${k}">${v}</button>`).join('')}</div>
      <button class="btn block" data-a="food-custom">Create your own food</button>
      <div id="food-list">${foodList()}</div>`);
  }

  function unitsFor(f) {
    if (!f.per100) return [['serving', 1]];
    return [['g', 1], ['oz', 28.35], ...(f.portions || [])];
  }

  function openAmount(id) {
    const f = foodById(ctx.db, id);
    if (!f) return;
    st.pickFood = f;
    const units = unitsFor(f);
    const defUnit = f.per100 ? (units[2] ? 2 : 0) : 0;
    const defQty = f.per100 ? (units[2] ? 1 : 100) : 1;
    ctx.openSheet(`<h2>${esc(f.name)}</h2>
      ${f.fdc ? `<p class="muted small">USDA FoodData Central #${f.fdc}</p>` : ''}
      <div class="field"><span>Amount</span>${ctx.stepper('amt-qty', defQty, f.per100 && defUnit === 0 ? 10 : 0.5)}</div>
      <div class="field"><span>Unit</span><select id="amt-unit" data-a="amt-unit">${units.map(([n, g], i) => `<option value="${i}" ${i === defUnit ? 'selected' : ''}>${esc(n)}${g !== 1 && n !== 'oz' ? ` (${g} g)` : ''}</option>`).join('')}</select></div>
      <div id="amt-preview" class="macro-preview"></div>
      <button class="btn primary block big" data-a="amt-save">Add to meal ${st.meal}</button>
      <button class="btn block" data-a="close-sheet">Cancel</button>`);
    preview();
  }

  function currentAmount() {
    const f = st.pickFood;
    const qty = ctx.num('amt-qty') || 0;
    const units = unitsFor(f);
    const [unit, g] = units[+($('#amt-unit')?.value || 0)];
    if (!f.per100) {
      return { qty, unit: f.serving || 'serving', grams: f.grams ? f.grams * qty : undefined, kcal: f.kcal * qty, p: f.p * qty, c: f.c * qty, f: f.f * qty, fiber: (f.fiber || 0) * qty };
    }
    const grams = qty * g;
    return { qty, unit, grams, ...macrosFor(f, grams) };
  }

  function preview() {
    const el = $('#amt-preview');
    if (!el || !st.pickFood) return;
    const a = currentAmount();
    el.innerHTML = `<b>${r0(a.kcal)} kcal</b> · P ${r1(a.p)} g · C ${r1(a.c)} g · F ${r1(a.f)} g${a.grams ? ` · ${r0(a.grams)} g` : ''}`;
  }

  function addEntry(meal, item) {
    ctx.db.foodLog.push({ id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`, date: date(), ts: Date.now(), meal, ...item });
  }

  function openQuick() {
    ctx.openSheet(`<h2>Quick add</h2>
      <div class="field"><span>Name (optional)</span><input id="qa-name" type="text" placeholder="e.g. Restaurant dinner"></div>
      <div class="grid2">
        <div class="field"><span>Calories</span><input id="qa-kcal" type="text" inputmode="decimal"></div>
        <div class="field"><span>Protein (g)</span><input id="qa-p" type="text" inputmode="decimal"></div>
        <div class="field"><span>Carbs (g)</span><input id="qa-c" type="text" inputmode="decimal"></div>
        <div class="field"><span>Fat (g)</span><input id="qa-f" type="text" inputmode="decimal"></div>
      </div>
      <div class="field"><span>Meal</span><div class="chips">${Array.from({ length: ctx.db.nutrition.mealsPerDay }, (_, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-a="qa-meal" data-v="${i + 1}">${i + 1}</button>`).join('')}</div></div>
      <button class="btn primary block big" data-a="qa-save">Add</button>
      <button class="btn block" data-a="close-sheet">Cancel</button>`);
    st.meal = 1;
  }

  function openCustom(editId) {
    const f = editId ? ctx.db.customFoods.find((x) => x.id === editId) : {};
    ctx.openSheet(`<h2>${editId ? 'Edit food' : 'Your own food'}</h2>
      <p class="muted small">Copy the numbers from the nutrition label.</p>
      <div class="field"><span>Name</span><input id="cf-name" type="text" value="${esc(f.name || st.q || '')}"></div>
      <div class="grid2">
        <div class="field"><span>Serving</span><input id="cf-serving" type="text" value="${esc(f.serving || '1 serving')}"></div>
        <div class="field"><span>Grams per serving (optional)</span><input id="cf-grams" type="text" inputmode="decimal" value="${f.grams ?? ''}"></div>
        <div class="field"><span>Calories</span><input id="cf-kcal" type="text" inputmode="decimal" value="${f.kcal ?? ''}"></div>
        <div class="field"><span>Protein (g)</span><input id="cf-p" type="text" inputmode="decimal" value="${f.p ?? ''}"></div>
        <div class="field"><span>Carbs (g)</span><input id="cf-c" type="text" inputmode="decimal" value="${f.c ?? ''}"></div>
        <div class="field"><span>Fat (g)</span><input id="cf-f" type="text" inputmode="decimal" value="${f.f ?? ''}"></div>
        <div class="field"><span>Fiber (g)</span><input id="cf-fiber" type="text" inputmode="decimal" value="${f.fiber ?? ''}"></div>
      </div>
      <button class="btn primary block big" data-a="cf-save" data-id="${editId || ''}">Save food</button>
      <button class="btn block" data-a="close-sheet">Cancel</button>`);
  }

  function openMine() {
    const db = ctx.db;
    ctx.openSheet(`<h2>My foods & meals</h2>
      <h3 class="sect">Saved meals</h3>
      ${db.meals.map((m) => `<div class="list-row"><span class="grow"><b>${esc(m.name)}</b><span class="pick-sub">${m.items.length} items · ${r0(m.items.reduce((a, x) => a + x.kcal, 0))} kcal</span></span><button class="mini danger" data-a="meal-del" data-id="${m.id}">${icon('x')}</button></div>`).join('') || '<p class="muted small">None yet — use "Save meal" on a meal.</p>'}
      <h3 class="sect">My foods</h3>
      ${db.customFoods.map((f) => `<div class="list-row"><span class="grow"><b>${esc(f.name)}</b><span class="pick-sub">${esc(f.serving)} · ${f.kcal} kcal</span></span><button class="mini" data-a="cf-edit" data-id="${f.id}">Edit</button><button class="mini danger" data-a="cf-del" data-id="${f.id}">${icon('x')}</button></div>`).join('') || '<p class="muted small">None yet.</p>'}
      <button class="btn block" data-a="food-custom">Create your own food</button>
      <button class="btn block" data-a="close-sheet">Close</button>`);
  }

  function openSaved(meal) {
    st.meal = meal;
    const db = ctx.db;
    ctx.openSheet(`<h2>Saved meals</h2>
      ${db.meals.map((m) => `<button class="pick-row" data-a="meal-log" data-id="${m.id}"><span class="grow"><b>${esc(m.name)}</b><span class="pick-sub">${esc(m.items.map((x) => x.name).join(', '))}</span></span><span class="muted small">${r0(m.items.reduce((a, x) => a + x.kcal, 0))} kcal</span></button>`).join('') || '<p class="muted small pad">No saved meals yet. Log a meal, then tap "Save meal".</p>'}
      <button class="btn block" data-a="close-sheet">Close</button>`);
  }

  function openIdeas(meal) {
    st.meal = meal;
    const t = targets(ctx.db, date());
    const kcal = Math.round(t.kcal / t.meals / 10) * 10;
    const prot = t.perMealProtein;
    ctx.openSheet(`<h2>Meal ideas</h2>
      <p class="muted small">Portions scaled to about ${kcal} kcal and ${prot} g protein — one meal's share of your targets. ${ctx.refChips(['schoenfeld2018meal'])}</p>
      ${MEAL_TEMPLATES.map((tpl) => {
        const m = solveMeal(tpl, kcal, prot);
        return `<div class="idea"><div class="row between"><b>${esc(tpl.name)}</b><span class="muted small">${r0(m.totals.kcal)} kcal · ${r0(m.totals.p)} g P</span></div>
          <p class="small muted">${m.items.map((x) => `${esc(x.food.name)} ${x.grams} g`).join(' · ')}</p>
          <button class="mini" data-a="idea-log" data-id="${tpl.id}">Log to meal ${meal}</button></div>`;
      }).join('')}
      <button class="btn block" data-a="close-sheet">Close</button>`);
  }

  // ---------- Actions ----------

  const actions = {
    'food-day': (d) => { ui.foodDate = addDays(date(), +d.v); if (ui.foodDate > todayStr()) ui.foodDate = todayStr(); ctx.render(); },
    'food-why': () => openWhy(),
    'food-add': (d) => openAdd(+d.meal),
    'food-cat': (d, el) => { st.cat = d.v; el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); $('#food-list').innerHTML = foodList(); },
    'food-pick': (d) => openAmount(d.id),
    'amt-save': () => {
      const f = st.pickFood;
      const a = currentAmount();
      if (!a.qty) return ctx.toast('Enter an amount.');
      addEntry(st.meal, { name: f.name, ref: f.id, qty: a.qty, unit: a.unit, grams: a.grams, kcal: a.kcal, p: r1(a.p), c: r1(a.c), f: r1(a.f), fiber: r1(a.fiber) });
      ctx.persist(); ctx.closeSheet(); ctx.render(); ctx.toast(`Added ${f.name}.`);
    },
    'food-del': (d) => { ctx.db.foodLog = ctx.db.foodLog.filter((x) => x.id !== d.id); ctx.persist(); ctx.render(); },
    'food-quick': () => openQuick(),
    'qa-meal': (d, el) => { st.meal = +d.v; el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); },
    'qa-save': () => {
      const kcal = ctx.num('qa-kcal') || 0;
      const p = ctx.num('qa-p') || 0; const c = ctx.num('qa-c') || 0; const f = ctx.num('qa-f') || 0;
      const k = kcal || p * 4 + c * 4 + f * 9;
      if (!k) return ctx.toast('Enter calories or macros.');
      addEntry(st.meal, { name: $('#qa-name').value.trim() || 'Quick add', qty: 1, unit: 'quick', kcal: k, p, c, f, fiber: 0 });
      ctx.persist(); ctx.closeSheet(); ctx.render();
    },
    'food-copy': () => {
      const y = ctx.db.foodLog.filter((x) => x.date === addDays(date(), -1));
      for (const x of y) { const { id, date: dd, ts, meal, ...rest } = x; addEntry(meal, rest); }
      ctx.persist(); ctx.render(); ctx.toast(`Copied ${y.length} items from yesterday.`);
    },
    'food-custom': () => openCustom(),
    'cf-edit': (d) => openCustom(d.id),
    'cf-save': (d) => {
      const name = $('#cf-name').value.trim();
      const kcal = ctx.num('cf-kcal');
      if (!name || kcal == null) return ctx.toast('Name and calories are required.');
      const food = {
        id: d.id || `cf-${Date.now().toString(36)}`, name, serving: $('#cf-serving').value.trim() || '1 serving',
        grams: ctx.num('cf-grams') || undefined, kcal, p: ctx.num('cf-p') || 0, c: ctx.num('cf-c') || 0, f: ctx.num('cf-f') || 0, fiber: ctx.num('cf-fiber') || 0,
      };
      const list = ctx.db.customFoods;
      const i = list.findIndex((x) => x.id === food.id);
      if (i >= 0) list[i] = food; else list.push(food);
      ctx.persist();
      if (!d.id) openAmount(food.id); else { ctx.closeSheet(); ctx.render(); }
    },
    'cf-del': (d) => { if (!confirm('Delete this food? Logged entries stay.')) return; ctx.db.customFoods = ctx.db.customFoods.filter((x) => x.id !== d.id); ctx.persist(); openMine(); },
    'food-mine': () => openMine(),
    'meal-save': (d) => {
      const items = ctx.db.foodLog.filter((x) => x.date === date() && x.meal === +d.meal);
      const name = prompt('Name this meal', items.map((x) => x.name.split(',')[0]).slice(0, 3).join(' + '));
      if (!name) return;
      ctx.db.meals.push({ id: `m${Date.now().toString(36)}`, name, items: items.map(({ name: n, ref, qty, unit, grams, kcal, p, c, f, fiber }) => ({ name: n, ref, qty, unit, grams, kcal, p, c, f, fiber })) });
      ctx.persist(); ctx.toast(`Saved "${name}".`);
    },
    'meal-saved': (d) => openSaved(+d.meal),
    'meal-log': (d) => {
      const m = ctx.db.meals.find((x) => x.id === d.id);
      for (const x of m.items) addEntry(st.meal, { ...x });
      ctx.persist(); ctx.closeSheet(); ctx.render(); ctx.toast(`Logged ${m.name}.`);
    },
    'meal-del': (d) => { ctx.db.meals = ctx.db.meals.filter((x) => x.id !== d.id); ctx.persist(); openMine(); },
    'food-ideas': (d) => openIdeas(+d.meal),
    'idea-log': (d) => {
      const tpl = MEAL_TEMPLATES.find((x) => x.id === d.id);
      const t = targets(ctx.db, date());
      const m = solveMeal(tpl, Math.round(t.kcal / t.meals / 10) * 10, t.perMealProtein);
      for (const x of m.items) {
        const mm = macrosFor(x.food, x.grams);
        addEntry(st.meal, { name: x.food.name, ref: x.food.id, qty: x.grams, unit: 'g', grams: x.grams, kcal: mm.kcal, p: r1(mm.p), c: r1(mm.c), f: r1(mm.f), fiber: r1(mm.fiber) });
      }
      ctx.persist(); ctx.closeSheet(); ctx.render(); ctx.toast(`Logged ${tpl.name}. Adjust portions if you ate a different amount.`);
    },
    'food-settings': () => openSettings(),
    'food-meals': (d) => { ctx.db.nutrition.mealsPerDay = +d.v; ctx.persist(); ctx.render(); openSettings(); },
    'food-activity': (d) => { ctx.db.nutrition.activity = d.v; ctx.persist(); ctx.render(); openSettings(); },
    'food-apply': (d) => {
      const v = +d.v;
      ctx.db.nutrition.kcalOffset = (ctx.db.nutrition.kcalOffset || 0) + v;
      (ctx.db.nutrition.checkins ||= []).push({ date: todayStr(), kcal: v });
      ctx.persist(); ctx.render(); ctx.toast(`Daily calories ${v > 0 ? 'raised' : 'lowered'} by ${Math.abs(v)}.`);
    },
    'food-offset-reset': () => { ctx.db.nutrition.kcalOffset = 0; ctx.persist(); ctx.render(); openSettings(); },
  };

  function onInput(e) {
    if (e.target.id === 'food-q') { st.q = e.target.value; $('#food-list').innerHTML = foodList(); return true; }
    if (e.target.id === 'amt-qty') { preview(); return true; }
    return false;
  }
  function onChange(e) {
    if (e.target.id === 'amt-unit') { preview(); return true; }
    return false;
  }
  // Stepper buttons change the amount without an input event.
  function afterStep(id) { if (id === 'amt-qty') preview(); }

  return { screen, actions, onInput, onChange, afterStep };
}
