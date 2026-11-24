// Progress tab: this week's rings, calendar, strength, exercise history and body weight.
// Split out of app.js. App state and the helpers this needs come from A: live getters (and
// setters for variables), so db and the rest stay shared with app.js.
import { addDays, daysBetween, mondayOf, parseDate, todayStr, weekOrder, weekPos } from './store.js';
import { doneTemplates, liftTemplates } from './week.js';
import { cardioTargetFor } from './year.js';
import { dayTotals, goalFor, targets as foodTargets } from './nutrition.js';
import { workoutBurn } from './energy.js';
import { icon } from './icons.js';
import { blockInfo, focusFor } from './blocks.js';
import { toDisp, wUnit, wt, wtEst } from './units.js';
import { GROUPS, groupById } from './groups.js';
import { muscleIcon } from './body.js';
import { DAY_NAMES, dayKeyOf, e1rm, weekInfo } from './engine.js';
import { loadNote } from './bank.js';
import { lineChart, trendChart } from './chart.js';
import { CHART_METRICS, CHART_RANGES, chartStats, defaultMetric, inRange, liftSeries, metricsFor, stepTrend, dayNum } from './lift-metrics.js';
import { strengthAreas, LEVELS } from './standards.js';

const LV_COLORS = ['#f4f4f1', '#1d8a4e', '#f2c21b', '#1f5fbf', '#d3232e'];
const levelBar = (lv) => `<svg class="lv-bar" viewBox="0 0 92 30" role="img" aria-label="${lv >= 0 ? LEVELS[lv] : 'Starting out'}"><rect y="14" width="92" height="2.5" fill="var(--bar)"/>${[10, 15, 20, 25, 30].map((h, i) => `<rect x="${6 + i * 17}" y="${15 - h / 2}" width="12" height="${h}" rx="1.5" fill="${i <= lv ? LV_COLORS[i] : 'var(--surface-3)'}" stroke="var(--edge)"/>`).join('')}</svg>`;
import { roundToGym, activeGym } from './gym.js';
import { CATEGORIES } from './bank.js';
import { maxesFor } from './maxes.js';
import { getGoal } from './big-goal.js';
import { familyDisc } from './equipment.js';
import { EX_INFO } from './exercise-info.js';
import { streakInfo, strengthTier } from './streak.js';
import { dayMode } from './fatigue.js';

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

  // Streaks follow the rules in streak.js: your own weekly target, cardio counts, freezes.
  const weekStreak = () => streakInfo(A.db).current;
  const bestStreak = () => streakInfo(A.db).best;

  // Is this date a planned training day? This week uses its adjustments; other weeks the plan.
  function plannedOn(date, thisWeek) {
    if (date < (A.db.settings.planSince || '')) return false;
    const key = dayKeyOf(date);
    const mode = thisWeek ? dayMode(A.db, key) : A.db.settings.dayModes?.[key] || (A.db.plan?.[key] ? 'lift' : 'rest');
    return ['lift', 'both', 'cardio'].includes(mode);
  }

  // Month calendar, one row per week in your week order. Weeks that count share a band, so a
  // streak reads as one unbroken block. Planned days are ringed; missed ones only show in a week
  // that fell short, since moving a workout inside a good week isn't a miss.
  function calendarCard() {
    const today = todayStr();
    const month = A.ui.calMonth || today.slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const first = `${month}-01`;
    const daysIn = new Date(y, m, 0).getDate();
    const lead = weekPos(dayKeyOf(first));
    const byDate = {};
    for (const s of A.db.sessions) if (s.date.startsWith(month)) (byDate[s.date] ||= { lift: [], cardio: 0 }).lift.push(s);
    for (const c of A.db.cardio) if (c.date.startsWith(month) && !c.fromWorkout) (byDate[c.date] ||= { lift: [], cardio: 0 }).cardio += c.minutes;
    const panel = A.streak.panel();
    const info = streakInfo(A.db, today);
    const thisWeek = mondayOf(today);
    const cellFor = (d) => {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const x = byDate[date];
      const wk = mondayOf(date); const st = info.states[wk];
      const mins = x ? Math.round(x.lift.reduce((a, s) => a + workoutBurn(A.db, s).minutes, 0) + x.cardio) : 0;
      const plan = !x && plannedOn(date, wk === thisWeek);
      const future = date > today;
      const missed = plan && !future && date !== today && st === 'missed';
      const cls = [x?.lift.length ? 'lift' : x?.cardio ? 'cardio' : '', date === today ? 'today' : '', future ? 'future' : '', plan && (future || date === today) ? 'planned' : '', missed ? 'missed' : ''].join(' ');
      const what = x ? `: ${x.lift.length ? `${x.lift.length} workout${x.lift.length > 1 ? 's' : ''}` : 'cardio'}, ${mins} minutes` : missed ? ': missed' : plan ? ': planned' : '';
      const label = `${parseDate(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${what}`;
      return future
        ? `<span class="cal-cell ${cls}" aria-label="${label}"><span class="cal-n">${d}</span><span class="cal-m"></span></span>`
        : `<button class="cal-cell ${cls}" data-a="cal-day" data-date="${date}" aria-label="${label}${x?.lift.length ? '' : '. Tap to log a workout'}"><span class="cal-n">${d}</span>${x?.lift.length ? `<span class="cal-m">${mins}m</span>` : x?.cardio ? '<span class="cal-dot"></span>' : '<span class="cal-m"></span>'}</button>`;
    };
    const rows = [];
    let cells = Array.from({ length: lead }, () => '<span class="cal-cell empty"></span>');
    let rowDay = 1;
    const flush = () => {
      while (cells.length < 7) cells.push('<span class="cal-cell empty"></span>');
      const wk = mondayOf(`${month}-${String(rowDay).padStart(2, '0')}`);
      const st = info.states[wk];
      const deload = A.db.sessions.some((s) => s.isDeload && mondayOf(s.date) === wk) || (wk >= thisWeek && weekInfo(A.db, wk).isDeload);
      rows.push(`<div class="cal-grid cal-week ${st === 'hit' ? 'sk-hit' : st === 'frozen' ? 'sk-frozen' : ''} ${deload ? 'is-deload' : ''}">${cells.join('')}</div>`);
      cells = [];
    };
    for (let d = 1; d <= daysIn; d++) {
      if (!cells.length) rowDay = d;
      cells.push(cellFor(d));
      if (cells.length === 7) flush();
    }
    if (cells.length) flush();
    const count = Object.values(byDate).filter((x) => x.lift.length || x.cardio).length;
    const prev = addDays(first, -1).slice(0, 7);
    const next = addDays(`${month}-${String(daysIn).padStart(2, '0')}`, 1).slice(0, 7);
    const letters = weekOrder().map((k) => k[0].toUpperCase());
    return `<section class="card cal-card" aria-label="Workout calendar">
      ${panel}
      ${A.streak.prompt()}
      <div class="cal-head"><h3>${parseDate(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <div class="row"><button class="icon-btn" data-a="cal-month" data-v="${prev}" aria-label="Previous month">${icon('left')}</button><button class="icon-btn" data-a="cal-month" data-v="${next}" aria-label="Next month" ${next > today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div></div>
      <div class="cal-grid" aria-hidden="true">${letters.map((x) => `<span class="cal-wd">${x}</span>`).join('')}</div>
      <div class="cal-rows">${rows.join('')}</div>
      <div class="cal-key" aria-hidden="true"><span><i class="k-lift"></i>Lift</span><span><i class="k-cardio"></i>Cardio</span><span><i class="k-deload"></i>Deload week</span><span><i class="k-plan"></i>Planned</span><span><i class="k-miss"></i>Missed</span><span><i class="k-freeze"></i>Frozen</span></div>
      <div class="tile-row three"><div class="tile"><span>This month</span><b class="num">${count}</b></div><div class="tile"><span>Best</span><b class="num">${info.best} wk</b></div><div class="tile"><span>Freezes left</span><b class="num">${info.freezesLeft}</b></div></div>
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
    const rows = h.slice(-12);
    if (rows.length < 2) return '';
    const vals = rows.map((x) => x.best1rm);
    const lo = Math.min(...vals); const hi = Math.max(...vals); const span = hi - lo || 1;
    const t0 = dayNum(rows[0].date); const tspan = dayNum(rows[rows.length - 1].date) - t0 || 1;
    const px = (t) => ((t - t0) / tspan) * 96 + 2;
    const py = (v) => 26 - ((v - lo) / span) * 22;
    // Points for each workout, the line for the stepped trend of best efforts.
    const curve = stepTrend(rows.map((r) => ({ x: r.date, v: r.best1rm })), 'best');
    const line = curve.map((p) => `${px(p.t).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ');
    const dots = rows.map((r) => `M${px(dayNum(r.date)).toFixed(1)} ${py(r.best1rm).toFixed(1)}h0`).join('');
    return `<svg class="${cls}" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="sp-pts" d="${dots}"/><polyline points="${line}"/></svg>`;
  }
  // A small chart inside a row or tile: tapping it opens the full chart.
  const chartSpark = (s, cls) => { const svg = sparkSvg(s.h, cls); return svg ? `<span class="spark-tap" data-a="chart-open" data-id="${s.id}">${svg}</span>` : ''; };

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
      <span class="key-sub">${s.pct != null ? `${pctText(s.pct)} in 8 wk` : 'New'}${ratio ? ` · ${ratio.toFixed(2)}× body weight` : ''}</span>
      ${chartSpark(s, 'spark key-spark')}
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
  const partNames = (a) => a.parts.map((p) => p.name.toLowerCase()).join(' or ');
  function standardsPanel() {
    const me = person();
    const list = areas();
    const tier = strengthTier(A.db, list);
    const missing = [!me.bw && 'body weight', !me.age && 'age', !me.sex && 'sex'].filter(Boolean);
    const lvl = (n) => (n >= 0 ? LEVELS[n] : 'Starting out');
    const ladder = (part) => {
      const now = part.basis ? part.equiv : null; const cells = [];
      for (let i = 4; i >= 0; i--) {
        const here = now != null && now >= part.levels[i] * me.bw && (i === 4 || now < part.levels[i + 1] * me.bw);
        if (here) cells.push(`<div class="lad you"><i></i><span>You</span><b>${wtEst(now)}</b></div>`);
        cells.push(`<div class="lad"><i style="background:${LV_COLORS[i]}"></i><span>${LEVELS[i]}</span><b>${wtEst(part.levels[i] * me.bw)}</b></div>`);
      }
      if (now != null && now < part.levels[0] * me.bw) cells.push(`<div class="lad you"><i></i><span>You</span><b>${wtEst(now)}</b></div>`);
      return `<div class="ladder">${cells.join('')}</div>`;
    };
    const rowFor = (a) => {
      const on = A.ui.stdOpen === a.id;
      const head = `<button class="lv-head" data-a="${a.pct == null ? 'std-area' : 'std-open'}" data-v="${a.id}" ${a.pct == null ? '' : `aria-expanded="${on}"`}><span><b>${a.name}</b><small>${a.pct == null ? (me.bw ? `Log a ${partNames(a)}` : 'Add your body weight') : lvl(a.level)}</small></span>${levelBar(a.pct == null ? -1 : a.level)}<span class="lv-pct">${a.pct == null ? '' : `${a.pct}<small>%</small>`}</span></button>`;
      const more = on && a.pct != null ? `<div class="lv-more">${a.parts.filter((x) => x.basis).map((x) => { const next = x.level < 4 ? x.levels[x.level + 1] * me.bw : null; return `<div class="lv-lift"><div class="lv-lh"><b>${A.esc(x.name)}</b>${next ? `<small>${wtEst(Math.max(0, next - x.equiv))} to ${LEVELS[x.level + 1]}</small>` : '<small>Top level</small>'}</div>${ladder(x)}</div>`; }).join('')}<button class="text-btn" data-a="std-area" data-v="${a.id}">Details and sources</button></div>` : '';
      return `<div class="lv-row ${on ? 'on' : ''}">${head}${more}</div>`;
    };
    return `<section class="std-panel">
      <div class="row between"><h3>How you compare</h3>${tier ? `<span class="small"><b>${tier.name}</b> · stronger than ${tier.avg}%</span>` : ''}</div>
      <div class="lv-rows">${list.map(rowFor).join('')}</div>
      <p class="str-note">Percent of lifters your sex, size and age you out-lift.</p>
      ${missing.length ? `<p class="muted small">Add your ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} in <button class="text-link small-link" data-a="open-builder">Training goals</button> for a closer comparison.</p>` : ''}
    </section>`;
  }
  function openStrengthArea(id) {
    const a = areas().find((x) => x.id === id);
    if (!a) return;
    const bw = person().bw;
    const lvl = (n) => (n >= 0 ? LEVELS[n] : 'Starting out');
    const parts = a.parts.map((p) => p.basis
      ? `<div class="post-metric"><span class="pm-label">${A.esc(p.name)}${p.basis.f !== 1 ? ` (from ${A.esc(p.basis.s.ex.name)})` : ''}</span><b class="num">${wtEst(p.equiv)} · ${p.ratio.toFixed(2)}× body weight</b><span class="pm-sub">${lvl(p.level)} · stronger than ${p.pct}%</span></div>`
      : `<p class="small muted">${A.esc(p.name)}: not logged yet</p>`).join('');
    const multi = a.parts.length > 1;
    const val = (p, i) => (bw ? wtEst(p.levels[i] * bw) : `${p.levels[i].toFixed(2)}×`);
    const rows = LEVELS.map((l, i) => `<div class="kv ${a.level === i ? 'std-here' : ''}"><span>${l}<span class="pick-sub">stronger than ${[5, 20, 50, 80, 95][i]}%${i === 2 ? " (average)" : ""}</span></span><b>${a.parts.map((p) => val(p, i)).join(' · ')}</b></div>`).join('');
    const related = a.parts.flatMap((p) => p.related.map((x) => ({ x, p }))).map(({ x, p }) => `<button class="list-row" data-a="ex-info-close" data-id="${x.id}"><span class="grow"><b>${A.esc(x.s.ex.name)}</b><span class="pick-sub">Est. max ${wtEst(x.s.now)}${x.f !== 1 ? ` · ≈ ${wtEst(x.s.now * x.f)} ${p.name.toLowerCase()}` : ''}${x === p.basis ? ' · used' : ''}</span></span>${icon('right', 'chev')}</button>`).join('');
    A.openSheet(`<h2>${a.name}</h2>
      ${a.pct != null ? `<p class="small"><b>${lvl(a.level)}</b> · stronger than ${a.pct}% of lifters like you${multi && a.parts.every((p) => p.basis) ? ' (bench 60%, overhead press 40%)' : ''}</p>` : ''}
      ${parts}
      <h3 class="sheet-h">Standards for you${multi ? ` <span class="muted small">${a.parts.map((p) => p.name.toLowerCase()).join(' · ')}</span>` : ''}</h3>
      <div class="kv-list">${rows}</div>
      ${related ? `<h3 class="sheet-h">Your lifts</h3><div class="list-group">${related}</div>` : ''}
      <p class="muted small">Compared with people who lift, adjusted for your sex, age and body weight. Variations are converted with typical ratios. ${A.refChips(['strengthlevel', 'jaric2002', 'keller2013'])}</p>
      <button class="btn block" data-a="prog-sub-close" data-v="strength-${a.group}">See all ${A.esc(GROUPS.find((g) => g.id === a.group)?.name.toLowerCase() || a.name.toLowerCase())} lifts</button>`);
  }

  function strengthPage() {
    const keys = keyLifts();
    const overall = median(keys.map((k) => k.pct));
    const prs8 = A.db.sessions.filter((s) => s.date >= addDays(todayStr(), -56)).reduce((a, s) => a + (s.prs || []).filter((p) => p.type === 'e1rm').length, 0);
    const groups = GROUPS.map((g) => ({ g, lifts: groupLifts(g) })).filter((x) => x.lifts.length);
    if (!keys.length && !groups.length) return `${A.subHeader('Strength', 'progress-back')}<p class="muted small pad">Log a few workouts with weights and your lifts show up here.</p>`;
    const tab = A.ui.strTab || 'levels';
    const tabs = `<div class="segmented str-tabs" role="tablist" aria-label="Strength">${[['levels', 'Levels'], ['muscles', 'Muscles'], ['lifts', 'Lifts']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="str-tab" data-v="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
    const liftRow = (s) => { const img = EX_INFO[s.id]?.images?.[0]; return `<button class="list-row strength-row" data-a="ex-info" data-id="${s.id}"><span class="thumb sm">${img ? `<img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer">` : muscleIcon(s.ex.primary?.[0] || 'chest')}${familyDisc(s.ex, 18)}</span><span class="grow"><b>${A.esc(s.ex.name)}</b><span class="pick-sub">${s.pct != null ? `${pctText(s.pct)} in 8 weeks` : 'New'}</span></span>${chartSpark(s, 'spark row-spark')}<span class="row-val">${Math.round(toDisp(s.now))}<small>${s.ex.type === 'dumbbell' ? `${wUnit()} each` : wUnit()}</small></span></button>`; };
    const body = tab === 'levels' ? standardsPanel()
      : tab === 'muscles' ? `<div class="list-group">${groups.map(({ g, lifts }) => {
        const top = lifts[0]; const p2 = median(lifts.filter((x) => x.recent).map((x) => x.pct));
        return `<button class="list-row" data-a="prog-sub" data-v="strength-${g.id}"><span class="grp-art">${muscleIcon(g.muscles[0])}</span><span class="grow"><b>${g.name}</b><span class="pick-sub">${A.esc(top.ex.name)} ${wtEst(top.now)}</span></span>${p2 != null ? `<span class="small">${pctText(p2)}</span>` : ''}${icon('right', 'chev')}</button>`;
      }).join('')}</div>`
        : `${keys.length ? `<div class="list-group">${keys.map(liftRow).join('')}</div>` : '<p class="muted small pad">Log a main lift to see it here.</p>'}${prs8 ? `<p class="str-note">${prs8} new ${prs8 === 1 ? 'best' : 'bests'} in the last 8 weeks.${overall != null ? ` Overall ${overall > 0 ? '+' : ''}${overall}%.` : ''}</p>` : ''}`;
    return `${A.subHeader('Strength', 'progress-back')}
      ${getGoal(A.db).on && getGoal(A.db).type === 'club' ? A.goals.card() : ''}
      ${tabs}
      ${body}
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
        const good = e.sets.filter((x) => !x.pain && x.reps > 0).map((x) => ({ ...x, weight: Number(x.weight) || 0 }));
        if (!good.length) continue;
        const top = good.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
        out.push({
          date: s.date, isDeload: s.isDeload && !e.maxTest, excluded: e.excluded, sets: e.sets,
          top, best1rm: Math.max(...good.map((x) => e1rm(x.weight, x.reps))),
          totalReps: good.reduce((a, x) => a + x.reps, 0),
        });
      }
    }
    // Maxes logged by hand (tested somewhere else).
    for (const m of A.db.maxes || []) if (m.exerciseId === exId) out.push({ date: m.date, logged: true, sets: [{ weight: m.weight, reps: m.reps || 1 }], top: { weight: m.weight, reps: m.reps || 1 }, best1rm: e1rm(m.weight, m.reps || 1), totalReps: m.reps || 1 });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  function screenHistory() {
    if (A.ui.chartEx && A.db.exercises[A.ui.chartEx]) return chartPage(A.ui.chartEx);
    if (A.ui.historyEx) return screenExerciseHistory(A.ui.historyEx);
    if (A.ui.progSub) return progressPage(A.ui.progSub);
    const lastWorkout = A.db.sessions[A.db.sessions.length - 1];
    const seenN = new Set(A.db.sessions.flatMap((s) => s.entries.map((e) => e.exerciseId))).size;
    return `<header class="top"><h1 class="grow">Progress</h1></header>
      ${!A.db.sessions.length && !A.db.cardio.length ? '<div class="empty"><div class="big">No workouts yet</div><p class="muted">Finished workouts show up here.</p></div>' : ''}
      ${weekRingsCard()}
      ${A.db.sessions.length || A.db.cardio.length ? A.goals.card() : ''}
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
          <span class="grow"><b>${s.freestyle ? 'Custom workout' : A.esc(A.db.plan[s.day]?.name || DAY_NAMES[s.day])}${s.isDeload ? ' · deload' : ''}</b><span class="pick-sub">${A.fmtDate(s.date)} · ${Math.round(workoutBurn(A.db, s).minutes)} min · ~${Math.round(workoutBurn(A.db, s).active)} kcal</span></span>
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

  // Rep maxes: the most you could likely lift for 1 to 12 reps, from your best set in the last
  // 8 weeks (Epley's formula, rounded to weights your gym has). Most accurate near the reps you
  // actually did; beyond about 10 reps from that, treat as rough.
  function repMaxCard(ex, hist) {
    if (ex.category === 'conditioning' || ex.noLoad) return '';
    const recent = hist.filter((h) => !h.isDeload && !h.excluded && h.date >= addDays(todayStr(), -56));
    if (!recent.length) return '';
    const best = recent.reduce((a, h) => (h.best1rm > a.best1rm ? h : a));
    const gym = activeGym(A.db);
    const rows = [1, 2, 3, 4, 5, 6, 8, 10, 12].map((r) => {
      const w = roundToGym(ex, best.best1rm / (1 + (r === 1 ? 0 : r) / 30), gym);
      return `<div class="rm-cell"><span>${r} ${r === 1 ? 'rep' : 'reps'}</span><b class="num">${toDisp(w)}</b></div>`;
    }).join('');
    return `<div class="card"><div class="row between"><h3>Rep maxes</h3><span class="muted small">${wUnit()}${loadNote(ex) ? ` ${loadNote(ex)}` : ''}</span></div>
      <p class="muted small">Estimated from your best set in the last 8 weeks (${A.fmtDate(best.date)}).</p>
      <div class="rm-grid">${rows}</div></div>`;
  }

  // Tested and logged maxes, with a quiet way to add one.
  function maxesCard(ex) {
    const list = maxesFor(A.db, ex.id);
    return `<div class="card"><div class="row between"><h3>Maxes</h3><button class="btn sm" data-a="logmax-open" data-id="${ex.id}">Log a max</button></div>
      ${list.length ? `<div class="kv-list">${list.slice(0, 8).map((m) => `<div class="kv"><span>${A.fmtDate(m.date)}<span class="pick-sub">${m.tested ? 'Tested in a workout' : 'Logged'}</span></span><b>${wt(m.weight)}${m.reps > 1 ? ` × ${m.reps}` : ''}${m.logged ? ` <button class="mini" data-a="logmax-del" data-id="${m.id}" aria-label="Delete">${icon('x')}</button>` : ''}</b></div>`).join('')}</div>`
        : '<p class="muted small">Test one from a workout (exercise menu → Test your max) or log one you did elsewhere.</p>'}
    </div>`;
  }

  function screenExerciseHistory(exId) {
    const ex = A.db.exercises[exId];
    const hist = exerciseHistory(exId);
    const bw = ex.type === 'bodyweight' && hist.every((h) => h.top.weight === 0);
    const series = liftSeries(A.db, exId);
    const histRow = (h) => `
      <div class="hist-row">
        <div class="row between"><b>${A.fmtDate(h.date)}</b><span class="muted small">${h.logged ? 'logged max' : h.isDeload ? 'deload' : h.excluded ? 'not counted' : bw ? `${h.totalReps} reps` : `est. max ${Math.round(toDisp(h.best1rm))}`}</span></div>
        <p class="small">${h.sets.map((x) => `${x.weight == null ? '' : `${A.fmtW(x.weight, ex).replace(` ${wUnit()}`, '')}×`}${x.reps ?? 0}${x.rir != null ? ` @${x.rir}` : ''}${x.pain ? ' (pain)' : ''}`).join(', ')}</p>
      </div>`;
    // The last five, the rest one tap away.
    const recent = [...hist].reverse();
    const rows = recent.slice(0, 5).map(histRow).join('') + (recent.length > 5 ? `<details class="more-hist"><summary>Show all ${recent.length} workouts</summary>${recent.slice(5).map(histRow).join('')}</details>` : '');
    setTimeout(() => {
      const el = A.$('#hist-chart');
      if (!el) return;
      const key = defaultMetric(series);
      trendChart(el, { compact: true, height: 170, name: CHART_METRICS[key].name, fmt: chartAxis(key), points: series.map((r) => ({ x: r.date, v: chartValue(key, r[key]) })) });
    });
    return `<header class="top"><button class="back" data-a="history-back" aria-label="Back">${icon('left')}</button><div><h1>${A.esc(ex.name)}</h1><p class="muted small">${CATEGORIES[ex.category]} · ${A.esc(A.muscleLine(ex))}</p></div></header>
      ${A.extras.exerciseInfo(ex)}
      ${series.length ? `<button class="card chart-card" data-a="chart-open" data-id="${exId}" aria-label="Open the ${A.esc(ex.name)} chart"><span class="row between"><span class="chart-card-t">${CHART_METRICS[defaultMetric(series)].name}</span><span class="muted small chart-more">Details ${icon('right', 'chev')}</span></span><div id="hist-chart"></div></button>` : ''}
      ${bw ? '' : repMaxCard(ex, hist)}
      ${bw || ex.category === 'conditioning' || ex.noLoad ? '' : maxesCard(ex)}
      <div class="card"><h3>Workouts</h3>${rows || '<p class="muted small">No workouts yet.</p>'}</div>`;
  }

  // ---------- One chart in detail ----------
  const chartValue = (key, v) => (CHART_METRICS[key].kind === 'weight' ? toDisp(v) : v);
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const chartAxis = (key) => (CHART_METRICS[key].kind === 'time' ? clock : (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))));
  const chartText = (key, v) => {
    const k = CHART_METRICS[key].kind;
    if (k === 'time') return v >= 60 ? clock(v) : `${Math.round(v)} sec`;
    if (k === 'reps') return `${Math.round(v)} reps`;
    return `${Math.round(toDisp(v)).toLocaleString()} ${wUnit()}`;
  };
  function chartPage(exId) {
    const ex = A.db.exercises[exId];
    const all = liftSeries(A.db, exId);
    const avail = metricsFor(all);
    const key = avail.includes(A.ui.chartMetric) ? A.ui.chartMetric : defaultMetric(all);
    const withKey = all.filter((r) => r[key] > 0);
    const range = A.ui.chartRange || '6m';
    const rows = inRange(withKey, range, todayStr());
    const st = chartStats(rows, key);
    const ch = st ? st.change : 0;
    const flat = CHART_METRICS[key].kind === 'weight' ? Math.abs(toDisp(ch)) < 0.5 : Math.abs(ch) < 0.5;
    const changeText = !st || st.count < 2 ? '—' : flat ? 'Steady' : `${ch > 0 ? '+' : '−'}${chartText(key, Math.abs(ch))}`;
    const stat = (v, l, cls = '') => `<div class="${cls}"><b class="num">${v}</b><span>${l}</span></div>`;
    setTimeout(() => {
      const el = A.$('#cd-chart');
      if (!el || !rows.length) return;
      trendChart(el, {
        name: `${ex.name} ${CHART_METRICS[key].name}`, height: 250, fmt: chartAxis(key), trend: 'best',
        points: rows.map((r) => ({ x: r.date, v: chartValue(key, r[key]), row: r })),
        onPick: (p) => {
          const out = A.$('#cd-read'); if (!out) return;
          const t = p.row.top;
          out.innerHTML = `<b>${A.fmtDate(p.row.date)}</b><span>${chartText(key, p.row[key])}${t && key !== 'heavy' ? ` · top set ${wt(t.w)} × ${t.r}` : ''}${p.row.logged ? ' · logged max' : ''}</span>`;
        },
      });
    });
    return `<header class="top"><button class="back" data-a="chart-back" aria-label="Back">${icon('left')}</button><div class="grow"><h1>${A.esc(ex.name)}</h1><p class="muted small">${CHART_METRICS[key].name}</p></div></header>
      ${avail.length > 1 ? `<div class="chips chart-metrics" role="radiogroup" aria-label="Metric">${avail.map((k) => `<button class="chip ${k === key ? 'on' : ''}" data-a="chart-metric" data-v="${k}" role="radio" aria-checked="${k === key}">${CHART_METRICS[k].short}</button>`).join('')}</div>` : ''}
      <div class="card chart-detail">
        <div id="cd-chart">${rows.length ? '' : `<div class="empty small-empty"><p class="muted">No workouts in this range.</p>${withKey.length ? '<button class="btn" data-a="chart-range" data-v="all">Show all time</button>' : ''}</div>`}</div>
        ${rows.length ? '<div class="cd-read" id="cd-read" aria-live="polite"></div>' : ''}
        <div class="segmented small-seg" role="radiogroup" aria-label="Range">${CHART_RANGES.map(([k, l]) => `<button class="${k === range ? 'on' : ''}" data-a="chart-range" data-v="${k}" role="radio" aria-checked="${k === range}">${l}</button>`).join('')}</div>
      </div>
      ${st ? `<div class="cd-stats">${stat(chartText(key, st.latest), 'Latest')}${stat(chartText(key, st.best), 'Best in range')}${stat(changeText, 'Trend change', !flat && st.count > 1 ? (ch > 0 ? 'up' : 'down') : '')}${stat(String(st.count), st.count === 1 ? 'Workout' : 'Workouts')}</div>
      ${st.perMonth != null && !flat ? `<p class="muted small pad">Your trend is moving about ${st.perMonth > 0 ? 'up' : 'down'} ${chartText(key, Math.abs(st.perMonth))} a month in this range.</p>` : ''}` : ''}
      <p class="muted small pad">Each dot is a workout. The line steps through your best efforts in each ${rows.length && dayNum(rows[rows.length - 1].date) - dayNum(rows[0].date) > 400 ? 'two months' : rows.length && dayNum(rows[rows.length - 1].date) - dayNum(rows[0].date) > 120 ? 'month' : 'two weeks'}, so light days don't pull it down. A dashed stretch is time off. Warm-ups and deloads aren't counted.</p>`;
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
    const fmtLb = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(toDisp(x)).toFixed(1)}`;
    let rate = '';
    if (avg7 && prev7) {
      const pct = ((avg7 - prev7) / prev7) * 100;
      const verdict = pct < tr[0] ? 'below target' : pct > tr[1] ? 'above target' : 'on target';
      rate = `<div class="bw-rate"><b>${fmtLb(avg7 - prev7)} ${wUnit()}</b><span>a week · ${verdict}</span></div><p class="muted small bw-target">${goalLabel} target: ${fmtLb((avg7 * tr[0]) / 100)} to ${fmtLb((avg7 * tr[1]) / 100)} ${wUnit()} a week</p>`;
    }
    const range = A.ui.bwRange || 84;
    const since = addDays(todayStr(), -range);
    // 7-day rolling average per entry for the chart.
    const pts = list.filter((b) => b.date >= since).map((b) => {
      const win = list.filter((x) => { const d = daysBetween(x.date, b.date); return d >= 0 && d <= 6; });
      return { x: b.date, values: [toDisp(b.weight), toDisp(win.reduce((a, x) => a + x.weight, 0) / win.length)] };
    });
    setTimeout(() => { const el = A.$('#bw-chart'); if (el && pts.length) lineChart(el, { points: pts, series: [{ name: 'Weigh-ins', cls: 's2' }, { name: 'Average', cls: 's1' }], unit: wUnit() }); });
    const tab = A.ui.bodyTab || 'weight';
    const tabs = `<div class="segmented" role="tablist" aria-label="Body">${[['weight', 'Weight'], ['measure', 'Measurements'], ['photos', 'Photos']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="body-tab" data-v="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('')}</div>`;
    if (tab !== 'weight') return `${A.subHeader('Body', 'progress-back')}${tabs}${A.extras.bodyCards(tab)}`;
    const recent = [...list].reverse();
    const shown = A.ui.bwAll ? recent : recent.slice(0, 4);
    const start = todays?.weight ?? last?.weight ?? null;
    return `${A.subHeader('Body', 'progress-back')}
      ${tabs}
      <section class="body-log">
        <div class="body-dial">${A.stepper('bw-input', toDisp(start) ?? '', wUnit() === 'kg' ? 0.1 : 0.2, { placeholder: wUnit() === 'kg' ? '84.1' : '185.4' })}<span class="dial-unit">${wUnit()} today</span></div>
        <button class="btn primary block" data-a="bw-save">${todays ? 'Update weight' : 'Save weight'}</button>
      </section>
      ${rate}
      ${pts.length > 1 ? `<div class="segmented bw-range" role="radiogroup" aria-label="Chart range">${[[28, '4 weeks'], [84, '12 weeks'], [365, 'Year']].map(([v, l]) => `<button class="${range === v ? 'on' : ''}" data-a="bw-range" data-v="${v}" role="radio" aria-checked="${range === v}">${l}</button>`).join('')}</div><div class="bw-chart"><div id="bw-chart"></div></div>` : ''}
      ${list.length ? `<h2 class="group-title">History</h2><div class="bw-history">${shown.map((b) => `<div class="hrow" data-swipe="bw-del" data-swipe-label="Delete weigh-in from ${A.fmtDate(b.date)}" data-date="${b.date}"><span>${A.fmtDate(b.date)}</span><b class="num">${toDisp(b.weight)}</b></div>`).join('')}</div>
        <p class="muted small bw-hint">Swipe left to delete.${recent.length > 4 ? ` <button class="text-link small-link" data-a="bw-all">${A.ui.bwAll ? 'Show less' : `Show all ${recent.length}`}</button>` : ''}</p>` : ''}
  `;
  }

  return { openStrengthArea, ring, weekStats, weekStrip, weekStreak, bestStreak, calendarCard, weekRingsCard, KEY_SLOTS, liftStats, sparkSvg, pctText, keyLifts, keyTile, median, groupLifts, strengthPage, strengthGroupPage, latestBodyweight, exerciseHistory, screenHistory, progressPage, screenExerciseHistory, bwStats, screenBody };
}
