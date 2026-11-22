// Progress tab: this week's rings, calendar, strength, exercise history and body weight.
// Split out of app.js. App state and the helpers this needs come from A: live getters (and
// setters for variables), so db and the rest stay shared with app.js.
import { addDays, daysBetween, mondayOf, parseDate, todayStr } from './store.js';
import { doneTemplates, liftTemplates } from './week.js';
import { cardioTargetFor } from './year.js';
import { dayTotals, goalFor, targets as foodTargets } from './nutrition.js';
import { workoutBurn } from './energy.js';
import { icon } from './icons.js';
import { blockInfo, focusFor } from './blocks.js';
import { toDisp, wUnit, wt, wtEst } from './units.js';
import { GROUPS, groupById } from './groups.js';
import { muscleIcon } from './body.js';
import { DAY_NAMES, e1rm } from './engine.js';
import { lineChart } from './chart.js';
import { strengthAreas, LEVELS } from './standards.js';
import { CATEGORIES } from './bank.js';

export function createProgressScreens(A) {
  // ---------- This week at a glance ----------

  function ring(pct, cls, size = 44, stroke = 5) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, pct || 0));
    return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
  }

  function weekStats() {
    const start = mondayOf(todayStr());
    const end = addDays(start, 6);
    const inWeek = (d) => d >= start && d <= end;
    const planned = liftTemplates(A.db).length;
    const lifts = planned ? doneTemplates(A.db).size : A.db.sessions.filter((s) => inWeek(s.date)).length;
    const cardioMin = A.db.cardio.filter((c) => inWeek(c.date) && c.cardioId !== 'mobility').reduce((a, c) => a + c.minutes, 0);
    const cardioTarget = cardioTargetFor(A.db) || 0;
    let pSum = 0; let pDays = 0;
    for (let i = 0; i < 7; i++) { const t = dayTotals(A.db, addDays(start, i)); if (t.kcal > 300) { pSum += t.p; pDays += 1; } }
    const pTarget = foodTargets(A.db).protein;
    return { lifts, planned, cardioMin, cardioTarget, protein: pDays ? pSum / pDays : null, pTarget, pDays };
  }

  function weekStrip() {
    const w = weekStats();
    const item = (cls, pct, big, small) => `<span class="wk-item">${ring(pct, cls, 30, 4)}<span><b class="num">${big}</b><span class="muted">${small}</span></span></span>`;
    return `<button class="week-strip" data-a="tab" data-tab="progress" aria-label="This week: ${w.lifts} of ${w.planned} workouts, ${w.cardioMin} of ${w.cardioTarget} cardio minutes${w.protein != null ? `, protein averaging ${Math.round(w.protein)} of ${w.pTarget} grams` : ''}. Open progress.">
      ${item('r-lift', w.planned ? w.lifts / w.planned : 0, `${w.lifts}${w.planned ? `/${w.planned}` : ''}`, 'workouts')}
      ${item('r-cardio', w.cardioTarget ? w.cardioMin / w.cardioTarget : 0, `${w.cardioMin}${w.cardioTarget ? `/${w.cardioTarget}` : ''}`, 'cardio min')}
      ${item('r-protein', w.protein != null ? w.protein / w.pTarget : 0, w.protein != null ? `${Math.round(w.protein)} g` : '—', 'protein avg')}
    </button>`;
  }

  // Weeks in a row (ending this week or last) with at least one workout.
  function weekStreak() {
    const weeks = new Set(A.db.sessions.map((x) => mondayOf(x.date)));
    let w = mondayOf(todayStr());
    if (!weeks.has(w)) w = addDays(w, -7);
    let n = 0;
    while (weeks.has(w)) { n += 1; w = addDays(w, -7); }
    return n;
  }

  // Longest run of consecutive weeks with at least one workout.
  function bestStreak() {
    const weeks = [...new Set(A.db.sessions.map((x) => mondayOf(x.date)))].sort();
    let best = 0; let run = 0; let prev = null;
    for (const w of weeks) { run = prev && addDays(prev, 7) === w ? run + 1 : 1; best = Math.max(best, run); prev = w; }
    return best;
  }

  // Month calendar: lifting days filled, cardio-only days dotted, minutes under each workout.
  function calendarCard() {
    const today = todayStr();
    const month = A.ui.calMonth || today.slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`;
    const daysIn = new Date(y, m, 0).getDate();
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
    const byDate = {};
    for (const s of A.db.sessions) if (s.date.startsWith(month)) (byDate[s.date] ||= { lift: [], cardio: 0 }).lift.push(s);
    for (const c of A.db.cardio) if (c.date.startsWith(month) && !c.fromWorkout) (byDate[c.date] ||= { lift: [], cardio: 0 }).cardio += c.minutes;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell empty"></span>');
    for (let d = 1; d <= daysIn; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const x = byDate[date];
      const mins = x ? Math.round(x.lift.reduce((a, s) => a + workoutBurn(A.db, s).minutes, 0) + x.cardio) : 0;
      const cls = [x?.lift.length ? 'lift' : x?.cardio ? 'cardio' : '', date === today ? 'today' : '', date > today ? 'future' : ''].join(' ');
      const label = `${parseDate(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${x ? `: ${x.lift.length ? `${x.lift.length} workout${x.lift.length > 1 ? 's' : ''}` : 'cardio'}, ${mins} minutes` : ''}`;
      cells.push(date > today
        ? `<span class="cal-cell ${cls}" aria-label="${label}"><span class="cal-n">${d}</span><span class="cal-m"></span></span>`
        : `<button class="cal-cell ${cls}" data-a="cal-day" data-date="${date}" aria-label="${label}${x?.lift.length ? '' : '. Tap to log a workout'}"><span class="cal-n">${d}</span>${x?.lift.length ? `<span class="cal-m">${mins}m</span>` : x?.cardio ? '<span class="cal-dot"></span>' : '<span class="cal-m"></span>'}</button>`);
    }
    const count = Object.values(byDate).filter((x) => x.lift.length).length;
    const prev = addDays(first, -1).slice(0, 7);
    const next = addDays(`${month}-${String(daysIn).padStart(2, '0')}`, 1).slice(0, 7);
    return `<section class="card cal-card" aria-label="Workout calendar">
      <div class="cal-head"><h3>${parseDate(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <div class="row"><button class="icon-btn" data-a="cal-month" data-v="${prev}" aria-label="Previous month">${icon('left')}</button><button class="icon-btn" data-a="cal-month" data-v="${next}" aria-label="Next month" ${next > today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div></div>
      <div class="cal-grid" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<span class="cal-wd">${x}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <div class="tile-row three"><div class="tile"><span>This month</span><b class="num">${count}</b></div><div class="tile"><span>Streak</span><b class="num">${weekStreak()} wk</b></div><div class="tile"><span>Best</span><b class="num">${bestStreak()} wk</b></div></div>
    </section>`;
  }

  function weekRingsCard() {
    const w = weekStats();
    const big = (cls, pct, value, of, label) => `<div class="ring-stat"><div class="ring-wrap">${ring(pct, cls, 84, 9)}<b class="num">${value}</b></div><span class="ring-label">${label}</span><span class="muted small">${of}</span></div>`;
    return `<section class="card week-rings" aria-label="This week">
      <h3>This week</h3>
      <div class="ring-row">
        ${big('r-lift', w.planned ? w.lifts / w.planned : 0, w.lifts, w.planned ? `of ${w.planned} planned` : 'this week', 'Workouts')}
        ${big('r-cardio', w.cardioTarget ? w.cardioMin / w.cardioTarget : 0, w.cardioMin, w.cardioTarget ? `of ${w.cardioTarget} min` : 'minutes', 'Cardio')}
        ${A.foodOn() ? big('r-protein', w.protein != null ? w.protein / w.pTarget : 0, w.protein != null ? Math.round(w.protein) : '—', w.protein != null ? `of ${w.pTarget} g a day` : 'log food to see', 'Protein') : ''}
      </div>

    </section>`;
  }

  // ---------- Strength: key lifts first, then by muscle group ----------
  // The big barbell lifts are the usual yardsticks of strength (NSCA; powerlifting's squat, bench and
  // deadlift). Each slot takes the closest lift the person actually does, so someone who leg-presses
  // instead of squatting still sees a lower-body number. Block focus lifts always show.
  const KEY_SLOTS = [
    { id: 'squat', name: 'Squat', ids: ['back-squat', 'front-squat', 'safety-bar-squat', 'pause-squat', 'box-squat', 'zercher-squat', 'hack-squat', 'smith-squat', 'pendulum-squat', 'belt-squat', 'leg-press', 'v-squat', 'goblet-squat', 'db-squat'] },
    { id: 'bench', name: 'Bench', ids: ['bench-press', 'close-grip-bench', 'incline-bench', 'db-bench', 'db-incline-bench', 'smith-bench', 'floor-press', 'machine-chest-press', 'plate-chest-press', 'incline-machine-press'] },
    { id: 'deadlift', name: 'Deadlift', ids: ['deadlift', 'sumo-deadlift', 'trap-bar-deadlift', 'deficit-deadlift', 'snatch-grip-deadlift', 'rdl', 'stiff-leg-deadlift', 'trap-bar-rdl', 'db-deadlift', 'db-rdl', 'kb-deadlift', 'hip-thrust'] },
    { id: 'press', name: 'Overhead press', ids: ['ohp', 'seated-ohp', 'push-press', 'z-press', 'db-shoulder-press', 'smith-ohp', 'machine-shoulder-press', 'arnold-press', 'landmine-press'] },
    { id: 'pull', name: 'Pull', ids: ['bb-row', 'pendlay-row', 't-bar-row', 'yates-row', 'chest-supported-tbar', 'db-row', 'iso-row', 'machine-row', 'cable-row', 'lat-pulldown', 'machine-pulldown'] },
  ];

  // Per lift: estimated max now (best of the last three workouts), eight weeks ago, all-time best.
  function liftStats(id) {
    const ex = A.db.exercises[id];
    if (!ex || ex.category === 'conditioning' || ex.type === 'bodyweight' || ex.noLoad) return null;
    const h = exerciseHistory(id).filter((x) => !x.isDeload && !x.excluded && x.best1rm > 0);
    if (!h.length) return null;
    const now = Math.max(...h.slice(-3).map((x) => x.best1rm));
    const cut = addDays(todayStr(), -56);
    const then = [...h].reverse().find((x) => x.date <= cut) || h[0];
    const best = Math.max(...h.map((x) => x.best1rm));
    const pct = h.length > 1 && then !== h[h.length - 1] ? Math.round(((now - then.best1rm) / then.best1rm) * 1000) / 10 : null;
    const recent = h[h.length - 1].date >= addDays(todayStr(), -84);
    return { id, ex, h, now, best, pct, since: then.date, recent };
  }

  function sparkSvg(h, cls = 'spark') {
    const pts = h.slice(-12).map((x) => x.best1rm);
    if (pts.length < 2) return '';
    const lo = Math.min(...pts); const hi = Math.max(...pts); const span = hi - lo || 1;
    const d = pts.map((v, i) => `${((i / (pts.length - 1)) * 96 + 2).toFixed(1)},${(26 - ((v - lo) / span) * 22).toFixed(1)}`).join(' ');
    return `<svg class="${cls}" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${d}"/></svg>`;
  }

  const pctText = (p) => (p == null ? '' : `<span class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '+' : ''}${p}%</span>`);

  function keyLifts() {
    const focus = focusFor(A.db, blockInfo(A.db).index) || [];
    const out = []; const used = new Set();
    for (const id of focus) { const s = liftStats(id); if (s && !used.has(id)) { out.push({ ...s, label: 'Focus', focus: true }); used.add(id); } }
    for (const slot of KEY_SLOTS) {
      if (out.some((x) => slot.ids.includes(x.id))) continue;
      const s = slot.ids.map(liftStats).find((x) => x && x.recent);
      if (s && !used.has(s.id)) { out.push({ ...s, label: slot.name }); used.add(s.id); }
    }
    // Doesn't do the classic lifts: their most-trained compound lifts instead.
    if (out.length < 4) {
      const seen = [...new Set(A.db.sessions.flatMap((x) => x.entries.map((e) => e.exerciseId)))];
      const more = seen.map(liftStats).filter((x) => x && x.recent && !used.has(x.id) && x.ex.category === 'compound').sort((a, b) => b.h.length - a.h.length);
      for (const s of more.slice(0, 4 - out.length)) { out.push({ ...s, label: 'Main lift' }); used.add(s.id); }
    }
    return out.slice(0, 6);
  }

  function keyTile(s, bw) {
    const ratio = bw && s.ex.type !== 'dumbbell' && s.ex.type !== 'machine' && s.ex.type !== 'cable' ? s.now / bw : null;
    return `<button class="key-tile ${s.focus ? 'focus' : ''}" data-r="${A.bodyRegion(s.ex.primary?.[0])}" data-a="ex-info" data-id="${s.id}">
      <span class="key-label">${A.esc(s.label)}</span>
      <b class="key-name">${A.esc(s.ex.name)}</b>
      <span class="key-val num">${Math.round(toDisp(s.now))}<small> ${wUnit()}</small></span>
      <span class="key-sub">${s.pct != null ? `${pctText(s.pct)} in 8 wk` : 'New'}${ratio ? ` · ${ratio.toFixed(2)}× BW` : ''}</span>
      ${sparkSvg(s.h, 'spark key-spark')}
    </button>`;
  }

  const median = (v) => { const a = v.filter((x) => x != null).sort((x, y) => x - y); if (!a.length) return null; const m = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; return Math.round(m * 10) / 10; };

  // Lifts that train a group (primary muscle in it).
  function groupLifts(g) {
    const seen = [...new Set(A.db.sessions.flatMap((x) => x.entries.map((e) => e.exerciseId)))];
    return seen.map((id) => A.db.exercises[id]?.primary?.some((m) => g.muscles.includes(m)) ? liftStats(id) : null).filter(Boolean)
      .sort((a, b) => (b.ex.category === 'compound') - (a.ex.category === 'compound') || b.recent - a.recent || b.now - a.now);
  }

  // ---------- How you compare: strength per area against lifters like you ----------
  function person() {
    const p = A.db.profile || {};
    return { sex: p.sex || '', age: +p.age || null, bw: latestBodyweight() };
  }
  const areas = () => strengthAreas((id) => liftStats(id), person());
  function standardsPanel() {
    const me = person();
    const list = areas();
    const scored = list.filter((a) => a.pct != null);
    const pcts = scored.map((a) => a.pct).sort((x, y) => x - y);
    const overall = pcts.length ? pcts[Math.floor((pcts.length - 1) / 2)] : null;
    const missing = [!me.bw && 'body weight', !me.age && 'age', !me.sex && 'sex'].filter(Boolean);
    const tile = (a) => {
      if (a.pct == null) return `<button class="std-tile empty" data-a="std-area" data-v="${a.id}"><span class="std-name">${a.name}</span><span class="std-sub">${me.bw ? `Log a ${a.keyName.toLowerCase()} or similar` : 'Add your body weight'}</span></button>`;
      return `<button class="std-tile" data-a="std-area" data-v="${a.id}">
        <span class="std-name">${a.name}</span>
        <span class="std-val num">${a.ratio.toFixed(2)}<small>× BW</small></span>
        <span class="std-bar" aria-hidden="true"><i class="std-avg"></i><i class="std-you" style="left:${Math.min(98, Math.max(2, a.pct))}%"></i></span>
        <span class="std-sub">${a.level >= 0 ? LEVELS[a.level] : 'Starting out'} · stronger than ${a.pct}%</span>
      </button>`;
    };
    return `<section class="card strength-hero std-panel">
      <div class="row between"><h3>How you compare</h3>${overall != null ? `<span class="small">Overall: <b>stronger than ${overall}%</b></span>` : ''}</div>
      <p class="muted small">Estimated max ÷ body weight on each area's key lift, against lifters of your sex, age and weight. The line marks the average lifter.</p>
      <div class="std-grid">${list.map(tile).join('')}</div>
      ${missing.length ? `<p class="muted small">Add your ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} in <button class="text-link small-link" data-a="open-builder">Profile and goals</button>${!me.bw ? ' or Body' : ''} for a closer comparison.</p>` : ''}
    </section>`;
  }
  function openStrengthArea(id) {
    const a = areas().find((x) => x.id === id);
    if (!a) return;
    const me = person();
    const bw = me.bw;
    const rows = LEVELS.map((l, i) => `<div class="kv ${a.level === i ? 'std-here' : ''}"><span>${l}<span class="pick-sub">stronger than ${[5, 20, 50, 80, 95][i]}% of lifters${i === 2 ? ' (average)' : ''}</span></span><b>${bw ? wtEst(a.levels[i] * bw) : `${a.levels[i].toFixed(2)}× BW`}</b></div>`).join('');
    const related = a.related.map((x) => `<button class="list-row" data-a="ex-info-close" data-id="${x.id}"><span class="grow"><b>${A.esc(x.s.ex.name)}</b><span class="pick-sub">Est. max ${wtEst(x.s.now)}${x.f !== 1 ? ` · ≈ ${wtEst(x.s.now * x.f)} ${a.keyName.toLowerCase()}` : ''}${x === a.basis ? ' · used here' : ''}</span></span>${icon('right', 'chev')}</button>`).join('');
    A.openSheet(`<h2>${a.name}</h2>
      ${a.basis ? `<div class="post-metric"><span class="pm-label">${A.esc(a.keyName)}${a.basis.f !== 1 ? ` (from ${A.esc(a.basis.s.ex.name)})` : ''}</span><b class="num">${wtEst(a.equiv)} · ${a.ratio.toFixed(2)}× BW</b><span class="pm-sub">${a.level >= 0 ? LEVELS[a.level] : 'Starting out'} · stronger than about ${a.pct}% of lifters like you</span></div>`
        : `<p class="small">Log a ${a.keyName.toLowerCase()} (or a close variation) to see where you stand.</p>`}
      <h3 class="sheet-h">Standards for you${bw ? ` (${wtEst(bw)} body weight)` : ''}</h3>
      <div class="kv-list">${rows}</div>
      ${related ? `<h3 class="sheet-h">Related lifts</h3><div class="list-group">${related}</div>` : ''}
      <p class="muted small">Standards come from people who lift, so "average" means the average lifter. They're adjusted for body weight (heavier lifters lift less per pound), age (about 1% less a year after 40) and sex. Variations are converted with typical ratios, so they're estimates. ${A.refChips(['strengthlevel', 'jaric2002', 'keller2013'])}</p>
      <button class="btn block" data-a="prog-sub-close" data-v="strength-${a.group}">See ${a.name.toLowerCase()} lifts</button>`);
  }

  function strengthPage() {
    const keys = keyLifts();
    const bw = latestBodyweight();
    const overall = median(keys.map((k) => k.pct));
    const prs8 = A.db.sessions.filter((s) => s.date >= addDays(todayStr(), -56)).reduce((a, s) => a + (s.prs || []).filter((p) => p.type === 'e1rm').length, 0);
    const groups = GROUPS.map((g) => ({ g, lifts: groupLifts(g) })).filter((x) => x.lifts.length);
    if (!keys.length && !groups.length) return `${A.subHeader('Strength', 'progress-back')}<p class="muted small pad">Log a few workouts with weights and your lifts show up here.</p>`;
    return `${A.subHeader('Strength', 'progress-back', 'Estimated one-rep max from your best set each workout')}
      ${standardsPanel()}
      <h2 class="group-title">By muscle group</h2>
      <div class="list-group">${groups.map(({ g, lifts }) => {
        const top = lifts[0]; const p = median(lifts.filter((x) => x.recent).map((x) => x.pct));
        return `<button class="list-row" data-a="prog-sub" data-v="strength-${g.id}"><span class="grp-art">${muscleIcon(g.muscles[0])}</span><span class="grow"><b>${g.name}</b><span class="pick-sub">${A.esc(top.ex.name)} ${wtEst(top.now)}</span></span>${p != null ? `<span class="small">${pctText(p)}</span>` : ''}${icon('right', 'chev')}</button>`;
      }).join('')}</div>
      ${keys.length ? `<section class="card">
        <div class="row between"><h3>Key lifts</h3>${overall != null ? `<span class="small">Overall ${pctText(overall)} in 8 weeks</span>` : ''}</div>
        <div class="key-grid">${keys.map((k) => keyTile(k, bw)).join('')}</div>
        ${prs8 ? `<p class="muted small">${prs8} new ${prs8 === 1 ? 'best' : 'bests'} in the last 8 weeks.</p>` : ''}
      </section>` : ''}
`;
  }

  function strengthGroupPage(gid) {
    const g = groupById(gid);
    if (!g) return strengthPage();
    const lifts = groupLifts(g);
    const bw = latestBodyweight();
    const big = lifts.filter((x) => x.recent).slice(0, 3);
    const rest = lifts.filter((x) => !big.includes(x));
    return `${A.subHeader(g.name, 'progress-back', 'Strength in the lifts that train it most')}
      ${big.length ? `<section class="card strength-hero"><h3>Biggest lifts</h3><div class="key-grid">${big.map((s) => keyTile({ ...s, label: s.ex.category === 'compound' ? 'Compound' : 'Accessory' }, bw)).join('')}</div></section>` : ''}
      ${rest.length ? `<details class="sub-details all-lifts" ${big.length ? '' : 'open'}><summary>All ${g.name.toLowerCase()} exercises (${rest.length})</summary>
        <div class="list-group compact">${rest.map((s) => `<button class="list-row strength-row" data-a="ex-info" data-id="${s.id}"><span class="grow"><span>${A.esc(s.ex.name)}</span><span class="pick-sub">${wtEst(s.now)}${s.pct != null ? ` · ${pctText(s.pct)}` : ''}${s.recent ? '' : ' · not lately'}</span></span>${sparkSvg(s.h)}</button>`).join('')}</div></details>` : ''}`;
  }

  function latestBodyweight() {
    const list = [...(A.db.bodyweight || [])].sort((a, b) => a.date.localeCompare(b.date));
    return list.length ? list[list.length - 1].weight : +A.db.profile?.weightLb || null;
  }

  // ---------- History ----------

  function exerciseHistory(exId) {
    const out = [];
    for (const s of A.db.sessions) {
      for (const e of s.entries) {
        if (e.exerciseId !== exId) continue;
        const good = e.sets.filter((x) => !x.pain && x.reps > 0);
        if (!good.length) continue;
        const top = good.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
        out.push({
          date: s.date, isDeload: s.isDeload, excluded: e.excluded, sets: e.sets,
          top, best1rm: Math.max(...good.map((x) => e1rm(x.weight, x.reps))),
          totalReps: good.reduce((a, x) => a + x.reps, 0),
        });
      }
    }
    return out;
  }

  function screenHistory() {
    if (A.ui.historyEx) return screenExerciseHistory(A.ui.historyEx);
    if (A.ui.progSub) return progressPage(A.ui.progSub);
    const lastWorkout = A.db.sessions[A.db.sessions.length - 1];
    const seenN = new Set(A.db.sessions.flatMap((s) => s.entries.map((e) => e.exerciseId))).size;
    return `<header class="top"><h1 class="grow">Progress</h1></header>
      ${!A.db.sessions.length && !A.db.cardio.length ? '<div class="empty"><div class="big">No workouts yet</div><p class="muted">Finished workouts show up here.</p></div>' : ''}
      ${weekRingsCard()}
      ${calendarCard()}
      <div class="list-group">
        <button class="list-row" data-a="prog-sub" data-v="strength"><span class="grow"><b>Strength</b><span class="pick-sub">Estimated max for your main lifts over time</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="prog-sub" data-v="muscles"><span class="grow"><b>Muscles</b><span class="pick-sub">Weekly sets, recovery, last week's review</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="progress-view" data-v="body"><span class="grow"><b>Body</b><span class="pick-sub">Weight, measurements, photos</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="prog-sub" data-v="workouts"><span class="grow"><b>Workouts</b><span class="pick-sub">${lastWorkout ? `Last: ${A.fmtDate(lastWorkout.date)}` : 'Every workout and cardio session'}</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="prog-sub" data-v="exercises"><span class="grow"><b>Exercises</b><span class="pick-sub">${seenN ? `History and records for ${seenN} lifts` : 'History and records for each lift'}</span></span>${icon('right', 'chev')}</button>
      </div>`;
  }

  function progressPage(which) {
    if (which === 'strength') return strengthPage();
    if (which?.startsWith('strength-')) return strengthGroupPage(which.slice(9));
    const seen = new Map();
    for (const s of [...A.db.sessions].reverse()) for (const e of s.entries) if (!seen.has(e.exerciseId)) seen.set(e.exerciseId, s.date);
    const recent = [...A.db.sessions].reverse().slice(0, 40);
    if (which === 'muscles') return `${A.subHeader('Muscles', 'progress-back')}
      ${A.freshnessCard()}
      <div class="list-group"><button class="list-row" data-a="open-recovery"><span class="grow"><b>Recovery</b><span class="pick-sub">How ready each muscle is</span></span>${icon('right', 'chev')}</button><button class="list-row" data-a="rv-open"><span class="grow"><b>Last week's review</b><span class="pick-sub">Suggestions for your plan</span></span>${icon('right', 'chev')}</button></div>
      ${A.extras.volumeCard()}`;
    if (which === 'workouts') {
      const all = [...A.db.sessions].reverse();
      const row = (s) => `
        <button class="list-row" data-a="summary" data-id="${s.id}">
          <span class="grow"><b>${s.freestyle ? 'Freestyle' : A.esc(A.db.plan[s.day]?.name || DAY_NAMES[s.day])}${s.isDeload ? ' · deload' : ''}</b><span class="pick-sub">${A.fmtDate(s.date)} · ${Math.round(workoutBurn(A.db, s).minutes)} min · ~${Math.round(workoutBurn(A.db, s).active)} kcal</span></span>
          ${s.prs?.length ? `<span class="pill good">${s.prs.length} PR${s.prs.length > 1 ? 's' : ''}</span>` : (() => { const up = s.results.filter((r) => r.status === 'progressed').length; return up ? `<span class="muted small">${up} up</span>` : ''; })()}${icon('right', 'chev')}
        </button>`;
      const months = [];
      for (const s of all) { const m = s.date.slice(0, 7); const last = months[months.length - 1]; if (last?.m === m) last.list.push(s); else months.push({ m, list: [s] }); }
      const label = (m) => parseDate(`${m}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const section = (g) => `<h3 class="month-h">${label(g.m)} <span class="muted small">${g.list.length} ${g.list.length === 1 ? 'workout' : 'workouts'}</span></h3><div class="list-group">${g.list.map(row).join('')}</div>`;
      return `${A.subHeader('Workouts', 'progress-back')}
        ${months.length ? section(months[0]) + (months.length > 1 ? `<details class="more-hist"><summary>Show earlier months</summary>${months.slice(1).map(section).join('')}</details>` : '') : '<p class="muted small pad">No workouts yet.</p>'}
        ${A.cardioHistory()}`;
    }
    return `${A.subHeader('Exercises', 'progress-back')}
      ${seen.size ? `<div class="card"><div class="row between"><h3>By exercise</h3><button class="link-btn" data-a="browse-bank">Exercise library</button></div>${seen.size > 6 ? '<input class="search list-filter" type="search" placeholder="Search your exercises" data-filter="#by-ex" autocomplete="off" enterkeyhint="search">' : ''}<div id="by-ex">${[...seen.entries()].map(([id, date]) => `
        <button class="list-row" data-a="history-ex" data-id="${id}">
          <span class="grow">${A.esc(A.db.exercises[id]?.name || id)}</span><span class="muted small">${A.fmtDate(date)}</span>${icon('right', 'chev')}
        </button>`).join('')}</div></div>` : ''}`;
  }

  function screenExerciseHistory(exId) {
    const ex = A.db.exercises[exId];
    const hist = exerciseHistory(exId);
    const bw = ex.type === 'bodyweight' && hist.every((h) => h.top.weight === 0);
    const histRow = (h) => `
      <div class="hist-row">
        <div class="row between"><b>${A.fmtDate(h.date)}</b><span class="muted small">${h.isDeload ? 'deload' : h.excluded ? 'not counted' : bw ? `${h.totalReps} reps` : `est. max ${Math.round(toDisp(h.best1rm))}`}</span></div>
        <p class="small">${h.sets.map((x) => `${A.fmtW(x.weight, ex).replace(` ${wUnit()}`, '')}×${x.reps}${x.rir != null ? ` @${x.rir}` : ''}${x.pain ? ' (pain)' : ''}`).join(', ')}</p>
      </div>`;
    // The last five, the rest one tap away.
    const recent = [...hist].reverse();
    const rows = recent.slice(0, 5).map(histRow).join('') + (recent.length > 5 ? `<details class="more-hist"><summary>Show all ${recent.length} workouts</summary>${recent.slice(5).map(histRow).join('')}</details>` : '');
    setTimeout(() => {
      const el = A.$('#hist-chart');
      if (!el) return;
      const pts = hist.filter((h) => !h.isDeload && !h.excluded);
      if (bw) lineChart(el, { points: pts.map((h) => ({ x: h.date, values: [h.totalReps] })), series: [{ name: 'Total reps', cls: 's1' }], unit: 'reps' });
      else lineChart(el, { points: pts.map((h) => ({ x: h.date, values: [Math.round(toDisp(h.best1rm)), toDisp(h.top.weight)] })), series: [{ name: 'Estimated max', cls: 's1' }, { name: 'Heaviest set', cls: 's2' }], unit: wUnit() });
    });
    return `<header class="top"><button class="back" data-a="history-back" aria-label="Back">${icon('left')}</button><div><h1>${A.esc(ex.name)}</h1><p class="muted small">${CATEGORIES[ex.category]} · ${A.esc(A.muscleLine(ex))}</p></div></header>
      ${A.extras.exerciseInfo(ex)}
      ${hist.length ? `<div class="card"><p class="muted small">${bw ? 'Total reps per workout' : 'Estimated max and heaviest set'}</p><div id="hist-chart"></div></div>` : ''}
      <div class="card"><h3>Workouts</h3>${rows || '<p class="muted small">No workouts yet.</p>'}</div>`;
  }

  // ---------- Bodyweight ----------

  function bwStats() {
    const list = [...A.db.bodyweight].sort((a, b) => a.date.localeCompare(b.date));
    const today = todayStr();
    const avg = (from, to) => {
      const xs = list.filter((b) => { const d = daysBetween(b.date, today); return d >= from && d <= to; });
      return xs.length ? xs.reduce((a, b) => a + b.weight, 0) / xs.length : null;
    };
    return { list, avg7: avg(0, 6), prev7: avg(7, 13) };
  }

  function screenBody() {
    // Target follows the current year-plan phase, else the builder's bodyweight goal.
    const goal = goalFor(A.db);
    const tr = goal.goal === 'lose' ? [-goal.rate[1], -goal.rate[0]] : goal.goal === 'gain' ? goal.rate : [-0.25, 0.25];
    const goalLabel = goal.label;
    const { list, avg7, prev7 } = bwStats();
    const todays = list.find((b) => b.date === todayStr());
    const last = list[list.length - 1];
    let rate = '';
    if (avg7 && prev7) {
      const pct = ((avg7 - prev7) / prev7) * 100;
      const verdict = pct < tr[0] ? 'below target range' : pct > tr[1] ? 'above target range' : 'on target';
      rate = `<p class="small">Weekly change: <b>${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</b> (${(avg7 - prev7 >= 0 ? '+' : '')}${toDisp(avg7 - prev7)} ${wUnit()}) · ${verdict}</p>`;
    }
    const lb = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(toDisp((avg7 * x) / 100)).toFixed(1)}`;
    const target = avg7 ? `<p class="muted small">${goalLabel} target: ${lb(tr[0])} to ${lb(tr[1])} ${wUnit()}/week (${tr[0]}% to ${tr[1]}%)</p>` : '';
    // 7-day rolling average per entry for the chart.
    const pts = list.slice(-60).map((b) => {
      const win = list.filter((x) => { const d = daysBetween(x.date, b.date); return d >= 0 && d <= 6; });
      return { x: b.date, values: [toDisp(b.weight), toDisp(win.reduce((a, x) => a + x.weight, 0) / win.length)] };
    });
    setTimeout(() => { const el = A.$('#bw-chart'); if (el && pts.length) lineChart(el, { points: pts, series: [{ name: 'Weigh-in', cls: 's2' }, { name: '7-day average', cls: 's1' }], unit: wUnit() }); });
    const tab = A.ui.bodyTab || 'weight';
    const tabs = `<div class="segmented" role="tablist" aria-label="Body">${[['weight', 'Weight'], ['measure', 'Measurements'], ['photos', 'Photos']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="body-tab" data-v="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
    if (tab !== 'weight') return `${A.subHeader('Body', 'progress-back')}${tabs}${A.extras.bodyCards(tab)}`;
    return `${A.subHeader('Body', 'progress-back')}
      ${tabs}
      <div class="card">
        <div class="field"><span>Today's weigh-in (${wUnit()})</span>${A.stepper('bw-input', toDisp(todays?.weight ?? last?.weight ?? null) ?? '', wUnit() === 'kg' ? 0.1 : 0.2, { placeholder: wUnit() === 'kg' ? 'e.g. 84.1' : 'e.g. 185.4' })}</div>
        <button class="btn primary block" data-a="bw-save">${todays ? 'Update' : 'Save'} weigh-in</button>
      </div>
      <div class="stats">
        <div class="stat"><b>${avg7 ? toDisp(avg7).toFixed(1) : '—'}</b><span>7-day avg</span></div>
        <div class="stat"><b>${prev7 ? toDisp(prev7).toFixed(1) : '—'}</b><span>prior 7 days</span></div>
      </div>
      ${rate || target ? `<div class="card">${rate}${target}</div>` : ''}
      ${pts.length > 1 ? '<div class="card"><div id="bw-chart"></div></div>' : ''}
      ${list.length ? `<div class="card"><h3>Entries</h3>${[...list].reverse().slice(0, 10).map((b) => `
        <div class="list-row"><span class="grow">${A.fmtDate(b.date)}</span><b>${toDisp(b.weight)}</b><button class="mini" data-a="bw-del" data-date="${b.date}" aria-label="Delete">${icon('x')}</button></div>`).join('')}</div>` : ''}
  `;
  }

  return { openStrengthArea, ring, weekStats, weekStrip, weekStreak, bestStreak, calendarCard, weekRingsCard, KEY_SLOTS, liftStats, sparkSvg, pctText, keyLifts, keyTile, median, groupLifts, strengthPage, strengthGroupPage, latestBodyweight, exerciseHistory, screenHistory, progressPage, screenExerciseHistory, bwStats, screenBody };
}
