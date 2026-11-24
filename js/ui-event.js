// Setting up a race or a powerlifting meet, and the card that shows where you are in the plan.

import { todayStr, addDays, mondayOf, daysBetween, safetySnapshot } from './store.js';
import { wUnit, toDisp, fromDisp } from './units.js';
import { estimatedMax } from './maxes.js';
import {
  SPORTS, DISTANCES, LIFT_LEVELS, RECOMMENDED_WEEKS, MEET_FORMATS, MEET_LIFTS, TRI_LEGS,
  eventLabel, eventDistance, planWeeks, weekIndex, raceWeeks, raceWeekPlan, vdotOf, predictSec, runPaces,
  fmtDur, parseDur, fmtPace, fmtDist, raceCheck, recoveryDay, recoveryDays, estMaxHr, meetWeeks, meetDays, attemptsFor, suggestedGoal, goalCheck, enduranceStrengthDays, planLiftDays, fitMeetIntoPlan,
} from './event-plan.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHORT = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const MI = 1609.34;
const RECENT = { mile: ['1 mile', MI], '5k': ['5K', 5000], '10k': ['10K', 10000], half: ['Half', 21097.5], marathon: ['Marathon', 42195] };
const PHASE = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', volume: 'Volume', strength: 'Strength', meet: 'Meet week' };
const LIFT_NAME = { squat: 'Squat', bench: 'Bench press', deadlift: 'Deadlift' };

export function createEvent(ctx) {
  const { esc } = ctx;
  let st = null; // the form while it's open
  const metric = () => wUnit() === 'kg';

  // The lifting plan an event adapts: the one set aside by a current event, or the current plan.
  const basePlan = () => (ctx.db.event?.prev?.plan || ctx.db.plan || {});
  const baseModes = () => (ctx.db.event?.prev?.dayModes || ctx.db.settings.dayModes || {});
  const hasPlan = () => Object.values(basePlan()).some((p) => p?.items?.length);
  const dayList = (days) => days.map((d) => SHORT[d]).join(', ');

  // ---------- Form state → event ----------
  function defaults(type) {
    const db = ctx.db;
    const ev = db.event?.type === type ? db.event : null;
    if (type === 'meet') {
      const weeks = 12;
      const cur = Object.fromEntries(Object.entries(MEET_LIFTS).map(([l, id]) => [l, ev?.current?.[l] || estimatedMax(db, id) || null]));
      return { type, fit: ev?.fit || (hasPlan() ? 'adapt' : 'replace'), date: ev?.date || addDays(mondayOf(todayStr()), weeks * 7 - 2), format: ev?.format || 'full', daysPerWeek: ev?.daysPerWeek || 4, days: ev?.days || null,
        current: cur, target: ev?.target || Object.fromEntries(Object.entries(cur).map(([l, v]) => [l, v ? suggestedGoal(v, weeks, db.profile?.experience) : null])) };
    }
    const sport = ev?.sport || 'run';
    const distance = ev?.distance || 'half';
    return { type, sport, distance, customKm: ev?.customM ? ev.customM / 1000 : '', date: ev?.date || addDays(mondayOf(todayStr()), (RECOMMENDED_WEEKS[distance] || 12) * 7 - 2),
      goal: ev?.goalSec ? fmtDur(ev.goalSec) : '', recentKey: ev?.recentKey || '5k', recent: ev?.recentSec ? fmtDur(ev.recentSec) : '', ftp: ev?.ftp || '', css: ev?.css ? fmtDur(ev.css) : '',
      weekly: ev?.weeklyInput ?? '', maxHr: ev?.maxHr || '', sessions: ev?.sessions || (sport === 'tri' ? 7 : 4), lifting: ev?.lifting || (hasPlan() ? 'hybrid' : 'support'), mobility: ev?.mobility !== false,
      days: ev?.days || DAY_KEYS.filter((d) => d !== 'mon') };
  }
  function toEvent(s) {
    const start = mondayOf(todayStr());
    if (s.type === 'meet') {
      return { type: 'meet', fit: s.fit, start, date: s.date, format: s.format, daysPerWeek: s.daysPerWeek, days: s.days, current: { ...s.current }, target: { ...s.target }, created: Date.now() };
    }
    const ev = { type: 'race', start, date: s.date, sport: s.sport, distance: s.distance, sessions: s.sessions, lifting: s.lifting, mobility: s.mobility, days: s.days, recentKey: s.recentKey, weeklyInput: s.weekly, created: Date.now() };
    if (s.distance === 'custom') {
      const m = (parseFloat(s.customKm) || 0) * (metric() ? 1000 : MI);
      ev.customM = m;
      ev.distance = s.sport === 'run' ? (m <= 7500 ? '5k' : m <= 15000 ? '10k' : m <= 30000 ? 'half' : 'marathon') : (m <= 60000 ? '40k' : m <= 130000 ? '100k' : 'century');
      ev.customLabel = fmtDist(m, metric());
    }
    const goalSec = parseDur(s.goal);
    if (goalSec) ev.goalSec = goalSec;
    const recentSec = parseDur(s.recent);
    if (recentSec && s.sport !== 'bike') { ev.recentSec = recentSec; ev.vdotNow = vdotOf(RECENT[s.recentKey][1], recentSec); }
    if (ev.vdotNow) {
      const runM = s.sport === 'tri' ? TRI_LEGS[ev.distance].run : eventDistance(ev);
      ev.vdotGoal = s.sport === 'run' && goalSec ? Math.max(ev.vdotNow, vdotOf(runM, goalSec)) : ev.vdotNow;
    }
    if (+s.ftp > 0) ev.ftp = +s.ftp;
    if (+s.maxHr > 100 && +s.maxHr < 230) ev.maxHr = +s.maxHr;
    const age = +ctx.db.profile?.age;
    if (age) ev.hrEst = estMaxHr(age);
    const css = parseDur(s.css);
    if (css) ev.css = css;
    const w = parseFloat(s.weekly);
    if (w > 0) ev.weeklyMin = s.sport === 'run' ? Math.round(w * (metric() ? 1000 : MI) * ((ev.vdotNow ? runPaces(ev.vdotNow).easy[0] : 330) / 1000) / 60) : Math.round(w * 60);
    return ev;
  }

  // ---------- What happens to the current plan ----------
  function planChanges(ev) {
    const db = ctx.db;
    if (!hasPlan()) return [];
    const own = planLiftDays({ ...db, plan: basePlan(), settings: { ...db.settings, dayModes: baseModes() } });
    if (ev.type === 'meet') {
      if (ev.fit !== 'adapt') return ['Your lifting plan is set aside for a meet plan, and comes back when the meet is over or you remove it.'];
      const { changes } = fitMeetIntoPlan(db, ev, basePlan());
      return [`Your lifting days stay: ${dayList(own.liftDays)}.`, ...changes.map((c) => `${c}.`), 'Accessories stay as they are, a set lighter in easier weeks; the meet week keeps only light singles.'];
    }
    if (ev.lifting === 'hybrid') return [
      `Your lifting days stay: ${dayList(own.liftDays)}.`,
      `${ev.sport === 'bike' ? 'Rides' : 'Sessions'} are placed around them: hard sessions and the long one avoid the day after heavy legs${own.legDays.length ? ` (${dayList(own.legDays)})` : ''}.`,
      'Leg accessories drop a set through base and build, all accessories in the peak, half the sets in the taper, and no lifting in race week.',
    ];
    if (ev.lifting === 'none') return ['Your lifting plan is set aside until after the race, and comes back when you finish or remove the event.'];
    const [A] = enduranceStrengthDays(db, ev, basePlan());
    const main = A.find((it) => db.exercises[it.exerciseId]?.category === 'compound');
    return [`Your lifting plan is set aside for ${ev.lifting === 'minimal' ? 'one strength session' : 'two strength sessions'} a week, and comes back after the race.`, ...(main ? [`They're built from what you already do, starting with ${db.exercises[main.exerciseId].name}.`] : [])];
  }
  const changesHtml = (ev) => { const c = planChanges(ev); return c.length ? `<h3 class="sheet-h">Your current plan</h3><ul class="ev-changes">${c.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''; };

  // ---------- Previews ----------
  const bar = (weeks, key, at = -1) => `<div class="ev-phases" aria-hidden="true">${weeks.map((w, i) => `<i class="ph-${w[key]}${w.cutback || w.deload ? ' easy' : ''}${i === at ? ' now' : ''}" title="Week ${i + 1}: ${PHASE[w[key]]}"></i>`).join('')}</div>
    <div class="ev-legend">${[...new Set(weeks.map((w) => w[key]))].map((p) => `<span><i class="ph-${p}"></i>${PHASE[p]}</span>`).join('')}</div>`;
  function racePreview(ev) {
    const n = planWeeks(ev);
    if (n < 4) return '<p class="flag bad">Pick a race at least 4 weeks away.</p>';
    const weeks = raceWeeks(ev);
    const max = Math.max(...weeks.map((w) => w.minutes));
    const vol = `<div class="ev-vol" aria-label="Weekly training time">${weeks.map((w) => `<i style="height:${Math.round((w.minutes / max) * 100)}%" class="ph-${w.phase}${w.cutback ? ' easy' : ''}"></i>`).join('')}</div>`;
    const rec = RECOMMENDED_WEEKS[ev.distance];
    const chk = raceCheck(ev);
    const pred = ev.vdotNow && ev.sport === 'run' ? `<p class="small">From your recent race: about <b>${fmtDur(predictSec(ev.vdotNow, eventDistance(ev)))}</b> today${chk ? `, about <b>${fmtDur(chk.likely)}</b> by race day if training goes well` : ''}.</p>` : '';
    const wp = raceWeekPlan(ev, 0, metric(), ev.lifting === 'hybrid' ? { ...ctx.db, plan: basePlan(), settings: { ...ctx.db.settings, dayModes: baseModes() }, sessions: [] } : null);
    const first = DAY_KEYS.filter((d) => wp.byDay[d].length || wp.liftDays.includes(d)).map((d) => `<div class="ev-day"><b>${SHORT[d]}</b><span>${[...wp.byDay[d].map((s) => sessionName(s)), ...(wp.liftDays.includes(d) ? ['Strength'] : [])].join(' + ')}</span></div>`).join('');
    return `<h3 class="sheet-h">Your plan · ${n} weeks</h3>${bar(weeks, 'phase')}
      <p class="muted small">Weekly training time, building to the peak, with an easier week every fourth week, then the taper.</p>${vol}
      ${n < rec ? `<p class="flag warn">${rec} weeks is typical for this race; the plan shortens the base phase to fit.</p>` : ''}
      ${pred}${chk ? `<p class="flag ${chk.level === 'high' ? 'warn' : chk.level === 'stretch' ? 'warn' : ''}">Goal ${fmtDur(ev.goalSec)}: ${esc(chk.text)}</p>` : ''}
      ${ev.vdotNow && ev.sport !== 'bike' ? `<p class="small muted">Paces now: easy ${fmtPace(runPaces(ev.vdotNow).easy[0], metric())} or slower, threshold ${fmtPace(runPaces(ev.vdotNow).threshold, metric())}, intervals ${fmtPace(runPaces(ev.vdotNow).interval, metric())}.</p>` : ev.sport !== 'bike' ? '<p class="small muted">Add a recent race time for exact paces; until then, sessions are set by effort.</p>' : ''}
      ${ev.sport !== 'run' && !ev.ftp ? '<p class="small muted">No FTP: rides are set by effort (RPE). Add it later for watt targets.</p>' : ''}
      <h3 class="sheet-h">Week 1</h3><div class="ev-week">${first}</div>${changesHtml(ev)}`;
  }
  function meetPreview(ev) {
    const n = planWeeks(ev);
    if (n < 6) return '<p class="flag bad">Pick a meet at least 6 weeks away.</p>';
    const weeks = meetWeeks(ev);
    const lifts = MEET_FORMATS[ev.format][1];
    const rows = lifts.map((l) => {
      const cur = ev.current[l]; const goal = ev.target[l];
      if (!cur || !goal) return `<div class="ev-lift"><b>${LIFT_NAME[l]}</b><span class="muted small">Add your current max</span></div>`;
      const at = attemptsFor(goal, cur);
      const chk = goalCheck(cur, goal, n, ctx.db.profile?.experience);
      return `<div class="ev-lift"><b>${LIFT_NAME[l]}</b><span>${Math.round(toDisp(cur))} → ${Math.round(toDisp(goal))} ${wUnit()}</span>
        <span class="small">Attempts: ${at.map((a) => `${a.kg} kg`).join(' · ')} <span class="muted">(${at.map((a) => a.lb).join(' · ')} lb)</span></span>
        <span class="small ${chk.level === 'high' ? 'warn-t' : 'muted'}">${esc(chk.text)}</span></div>`;
    }).join('');
    return `<h3 class="sheet-h">Your plan · ${n} weeks</h3>${bar(weeks, 'block')}
      <p class="muted small">Volume (sets of 6–8) builds work capacity, strength (sets of 3–5) turns it into force, the peak practises heavy singles, then a taper week and the meet. Squat and bench twice a week, deadlift once plus a variation.</p>
      ${n < 10 ? '<p class="flag warn">10–16 weeks is typical; the plan shortens the volume block to fit.</p>' : ''}
      <div class="ev-lifts">${rows}</div>
      <p class="small muted">Opener: a weight you could triple on a bad day. Second: about your current best. Third: your goal.</p>${changesHtml(ev)}`;
  }
  const sessionName = (s) => ({ long: s.sport === 'bike' ? 'Long ride' : 'Long run', easy: 'Easy run', endurance: s.sport === 'swim' ? 'Endurance swim' : 'Endurance ride', race: 'Race', brick: 'Brick run', mobility: 'Mobility', hills: 'Hills', strides: 'Easy + strides', threshold: s.sport === 'bike' ? 'Threshold' : 'Threshold', intervals: s.sport === 'swim' ? 'Swim intervals' : 'Intervals', 'race-pace': 'Race pace', sharpen: 'Sharpen', tempo: 'Tempo', 'sweet-spot': 'Sweet spot', vo2: 'VO2 max', openers: 'Openers', technique: 'Swim technique', speed: 'Speed' }[s.kind] || s.kind);

  // ---------- Sheets ----------
  function openChooser() {
    st = null;
    const ev = ctx.db.event;
    ctx.openSheet(`<h2>Training for a race or meet?</h2>
      <p class="muted small">Set a date and a target, and the plan works back from it.</p>
      <div class="list-group">
        <button class="list-row" data-a="ev-open" data-v="race"><span class="grow"><b>A race</b><span class="pick-sub">Running, cycling or triathlon, from a 5K to an Ironman</span></span></button>
        <button class="list-row" data-a="ev-open" data-v="meet"><span class="grow"><b>A powerlifting meet</b><span class="pick-sub">A meet date and new maxes on squat, bench and deadlift</span></span></button>
      </div>
      ${ev ? `<p class="small muted">You're training for: <b>${esc(eventLabel(ev))}</b> on ${ctx.fmtDate(ev.date)}. Setting up a new one replaces it.</p>` : ''}
      <button class="btn plain block" data-a="close-sheet">Not now</button>`);
  }
  function chips(key, options, cur, multi = false) {
    return `<div class="chips wrap">${options.map(([v, l]) => { const on = multi ? cur.includes(v) : cur === v; return `<button class="chip ${on ? 'on' : ''}" data-a="ev-set" data-k="${key}" data-v="${v}" ${multi ? 'data-multi="1"' : ''} aria-pressed="${on}">${esc(l)}</button>`; }).join('')}</div>`;
  }
  const field = (label, html, help = '') => `<div class="field"><span>${label}</span>${html}${help ? `<p class="small muted">${help}</p>` : ''}</div>`;
  const input = (key, value, ph, mode = 'text', w = '') => `<input class="ev-in${w ? ` ${w}` : ''}" type="${mode === 'date' ? 'date' : 'text'}" ${mode === 'num' ? 'inputmode="decimal"' : ''} data-ev="${key}" id="ev-${key}" value="${esc(String(value ?? ''))}" placeholder="${esc(ph)}" autocomplete="off">`;

  function openRace() {
    const s = st;
    const u = metric() ? 'km' : 'mi';
    const dists = [...Object.entries(DISTANCES[s.sport]).map(([k, [l]]) => [k, l]), ...(s.sport !== 'tri' ? [['custom', 'Other']] : [])];
    ctx.openSheet(`<h2>Race plan</h2>
      ${field('Sport', chips('sport', Object.entries(SPORTS), s.sport))}
      ${field('Distance', chips('distance', dists, s.distance) + (s.distance === 'custom' ? input('customKm', s.customKm, `Distance in ${u}`, 'num') : ''))}
      ${field('Race date', input('date', s.date, '', 'date'))}
      ${field('Goal finish time', input('goal', s.goal, 'h:mm:ss, optional'), s.sport === 'run' ? 'Leave blank to train for your best time.' : '')}
      ${s.sport !== 'bike' ? field('A recent race or time trial', chips('recentKey', Object.entries(RECENT).map(([k, [l]]) => [k, l]), s.recentKey) + input('recent', s.recent, 'Time, e.g. 24:30'), 'Sets your training paces. Within the last couple of months is best.') : ''}
      ${s.sport !== 'run' ? field('FTP (watts)', input('ftp', s.ftp, 'Optional', 'num'), 'Your functional threshold power, if you have a power meter or smart trainer.') : ''}
      ${s.sport === 'tri' ? field('Swim pace per 100 m', input('css', s.css, 'm:ss, e.g. 1:55'), 'The pace you can hold for a steady 400 m.') : ''}
      ${field('Max heart rate', input('maxHr', s.maxHr, 'Optional, e.g. 188', 'num'), 'From your watch or a recent all-out effort. Adds heart-rate zones to each session. Without it, zones are estimated from your age when no pace or power is set.')}
      ${field(s.sport === 'run' ? `Running now, ${u} per week` : 'Training now, hours per week', input('weekly', s.weekly, s.sport === 'run' ? `e.g. ${metric() ? 30 : 18}` : 'e.g. 5', 'num'), 'Volume builds gradually from here.')}
      ${field('Sessions per week', chips('sessions', (s.sport === 'tri' ? [5, 6, 7, 8, 9, 10] : [3, 4, 5, 6, 7]).map((n) => [String(n), String(n)]), String(s.sessions)))}
      ${field('Days you can train', chips('days', DAY_KEYS.map((d) => [d, SHORT[d]]), s.days, true))}
      <div class="field"><span>Lifting alongside</span>${Object.entries(LIFT_LEVELS).map(([k, [l, sub]]) => `<button class="pick-row ${s.lifting === k ? 'picked' : ''}" data-a="ev-set" data-k="lifting" data-v="${k}"><span class="grow"><b>${l}</b><span class="pick-sub">${sub}</span></span><span class="radio" aria-hidden="true"></span></button>`).join('')}</div>
      ${s.lifting === 'none' ? `<label class="toggle"><input type="checkbox" data-a="ev-mobility" ${s.mobility ? 'checked' : ''}><span>Mobility sessions<span class="pick-sub">Two short routines a week for hips, ankles and back</span></span></label>` : ''}
      <div id="ev-preview">${racePreview(toEvent(s))}</div>
      ${ctx.refChips ? ctx.refChips(['daniels2014', 'seiler2010', 'bosquet2007', 'ronnestad2014', 'blagrove2018', ...(s.sport !== 'run' ? ['allen2010'] : []), 'tanaka2001', ...(s.sport === 'tri' ? ['wakayoshi1992'] : [])]) : ''}
      <button class="btn primary block big" data-a="ev-start">${ctx.db.event?.type === 'race' ? 'Update plan' : 'Start plan'}</button>
      ${ctx.db.event ? '<button class="btn plain block danger-text" data-a="ev-remove">Remove event</button>' : ''}`);
  }
  function openMeet() {
    const s = st;
    const lifts = MEET_FORMATS[s.format][1];
    ctx.openSheet(`<h2>Meet plan</h2>
      ${field('Meet date', input('date', s.date, '', 'date'))}
      ${field('Lifts', chips('format', Object.entries(MEET_FORMATS).map(([k, [l]]) => [k, l]), s.format))}
      ${lifts.map((l) => `<div class="field"><span>${LIFT_NAME[l]}</span><div class="ev-pair">${input(`cur-${l}`, s.current[l] ? Math.round(toDisp(s.current[l])) : '', `Current max (${wUnit()})`, 'num')}${input(`goal-${l}`, s.target[l] ? Math.round(toDisp(s.target[l])) : '', `Goal (${wUnit()})`, 'num')}</div></div>`).join('')}
      <p class="small muted">Current max is filled in from your recent heavy sets when there are any. Goals start at what's typical for your experience over this many weeks.</p>
      ${hasPlan() ? field('Your lifting plan', chips('fit', [['adapt', 'Fit the meet into it'], ['replace', 'Use a meet plan']], s.fit)) : ''}
      ${s.fit === 'adapt' && hasPlan() ? '' : field('Days per week', chips('daysPerWeek', [['3', '3 days'], ['4', '4 days']], String(s.daysPerWeek)))}
      <div id="ev-preview">${meetPreview(toEvent(s))}</div>
      ${ctx.refChips ? ctx.refChips(['travis2020', 'pritchard2015', 'nsca2016', 'grgic2018freq']) : ''}
      <button class="btn primary block big" data-a="ev-start">${ctx.db.event?.type === 'meet' ? 'Update plan' : 'Start plan'}</button>
      ${ctx.db.event ? '<button class="btn plain block danger-text" data-a="ev-remove">Remove event</button>' : ''}`);
  }
  const reopen = () => (st.type === 'meet' ? openMeet() : openRace());
  function refreshPreview() { const el = document.getElementById('ev-preview'); if (el && st) el.innerHTML = st.type === 'meet' ? meetPreview(toEvent(st)) : racePreview(toEvent(st)); }

  // ---------- Starting and stopping ----------
  function start() {
    const db = ctx.db;
    const ev = toEvent(st);
    const n = planWeeks(ev);
    if (n < (ev.type === 'meet' ? 6 : 4)) return ctx.toast(`Pick a date at least ${ev.type === 'meet' ? 6 : 4} weeks away.`);
    if (ev.type === 'meet' && MEET_FORMATS[ev.format][1].some((l) => !(ev.current[l] > 0) || !(ev.target[l] > 0))) return ctx.toast('Add a current max and a goal for each lift.');
    safetySnapshot(db, `Before starting a plan for ${eventLabel(ev)}`);
    // The lifting plan is replaced for a meet, or a race with set strength sessions; the old one comes back after.
    const prev = db.event?.prev || { plan: JSON.parse(JSON.stringify(db.plan)), dayModes: { ...(db.settings.dayModes || {}) } };
    const changes = planChanges(ev);
    const replace = (ev.type === 'meet' && ev.fit !== 'adapt') || (ev.type === 'race' && ev.lifting !== 'hybrid');
    if (ev.type === 'meet' && ev.fit === 'adapt' && hasPlan()) {
      ev.prev = prev;
      db.plan = fitMeetIntoPlan(db, ev, prev.plan).plan;
      db.settings.dayModes = { ...prev.dayModes };
    } else if (replace) {
      ev.prev = prev;
      const plan = {};
      const modes = Object.fromEntries(DAY_KEYS.map((d) => [d, 'rest']));
      if (ev.type === 'meet') {
        const days = meetDays(db, ev);
        const at = ev.daysPerWeek >= 4 ? ['mon', 'tue', 'thu', 'fri'] : ['mon', 'wed', 'fri'];
        days.forEach((d, i) => { if (at[i]) { plan[at[i]] = d; modes[at[i]] = 'lift'; } });
      } else if (ev.lifting !== 'none') {
        const typical = Math.max(0, raceWeeks(ev).findIndex((w) => w.phase === 'build'));
        const wp = raceWeekPlan(ev, typical, metric());
        const [A, B] = enduranceStrengthDays(db, ev, prev.plan);
        wp.liftDays.forEach((d, i) => { plan[d] = { name: i ? 'Strength B' : 'Strength A', items: (i ? B : A).map((it) => ({ ...it, uid: `${d}-${it.uid}` })) }; modes[d] = 'lift'; });
      }
      db.plan = plan;
      db.settings.dayModes = modes;
    } else {
      // Hybrid: the plan stays as it is (restored first if another event had changed it).
      if (db.event?.prev) { db.plan = db.event.prev.plan; db.settings.dayModes = db.event.prev.dayModes; }
      ev.prev = db.event?.prev ? null : undefined;
    }
    db.event = ev;
    db.week = null;
    ctx.persist(); ctx.closeSheet(); ctx.render();
    ctx.toast(`${n}-week plan for ${eventLabel(ev).toLowerCase()} started.${changes.length ? ' Your lifting plan was adapted to fit.' : ''}`);
  }
  async function remove(finished = false) {
    const db = ctx.db;
    const ev = db.event;
    if (!ev) return;
    if (!finished && !(await ctx.ask(`Remove the plan for ${eventLabel(ev).toLowerCase()}?${ev.prev ? ' Your previous lifting plan comes back.' : ''} Logged workouts stay in your history.`, 'Remove', true))) return;
    if (ev.prev) { db.plan = ev.prev.plan; db.settings.dayModes = ev.prev.dayModes; }
    delete db.event;
    db.week = null;
    ctx.persist(); ctx.closeSheet(); ctx.render();
    ctx.toast(finished ? 'Your previous plan is back.' : 'Event removed.');
  }

  // ---------- The card on Plan ----------
  function card() {
    const db = ctx.db;
    const ev = db.event;
    if (!ev) return `<button class="card ev-card ev-empty" data-a="ev-choose"><span class="grow"><b>Training for a race or meet?</b><span class="muted small">Running, cycling, triathlon or powerlifting: set a date and a target</span></span></button>`;
    const label = ev.customLabel ? `${ev.customLabel} ${ev.sport === 'bike' ? 'ride' : 'race'}` : eventLabel(ev);
    const left = daysBetween(todayStr(), ev.date);
    const recN = recoveryDay(ev, todayStr());
    if (recN) {
      return `<section class="card ev-card"><h3>${esc(label)} · recovery</h3><p class="small">Day ${recN} of ${recoveryDays(ev)}: ${ev.type === 'meet' ? 'lifting at half the sets, moderate weights' : 'easy sessions only and lifting at half the sets'}. Then your regular plan picks back up.</p>
        <div class="row"><button class="btn grow" data-a="ev-finish">${ev.prev ? 'Restore my plan now' : 'Finish now'}</button><button class="btn grow" data-a="ev-choose">Plan the next one</button></div></section>`;
    }
    if (left < 0) {
      return `<section class="card ev-card"><h3>${esc(label)} · done</h3><p class="small muted">${ctx.fmtDate(ev.date)}. How did it go? Log the result as a workout, then go back to your regular plan.</p>
        <div class="row"><button class="btn primary grow" data-a="ev-finish">${ev.prev ? 'Restore my lifting plan' : 'Finish'}</button><button class="btn grow" data-a="ev-choose">Plan the next one</button></div></section>`;
    }
    const i = weekIndex(ev, todayStr());
    const weeks = ev.type === 'meet' ? meetWeeks(ev) : raceWeeks(ev);
    const w = i != null ? weeks[i] : null;
    const phase = w ? PHASE[ev.type === 'meet' ? w.block : w.phase] : 'Starts soon';
    let body = '';
    if (ev.type === 'meet') {
      body = MEET_FORMATS[ev.format][1].map((l) => { const at = attemptsFor(ev.target[l], ev.current[l]); return `<div class="ev-lift sm"><b>${LIFT_NAME[l]}</b><span>${Math.round(toDisp(ev.current[l]))} → ${Math.round(toDisp(ev.target[l]))} ${wUnit()}</span><span class="small muted">${at.map((a) => `${a.kg}`).join(' / ')} kg</span></div>`; }).join('');
    } else if (i != null) {
      const wp = raceWeekPlan(ev, i, metric(), db);
      body = `${wp.notes?.length ? `<ul class="ev-changes">${wp.notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<div class="ev-week">${DAY_KEYS.filter((d) => wp.byDay[d].length || (db.plan[d] && db.settings.dayModes?.[d] !== 'rest')).map((d) => `<div class="ev-day"><b>${SHORT[d]}</b><span>${[...wp.byDay[d].map((s) => (s.movedTo ? `<s>${sessionName(s)}</s>` : sessionName(s))), ...(db.plan[d] && db.settings.dayModes?.[d] !== 'rest' ? [db.plan[d].name] : [])].join(' + ')}</span></div>`).join('')}</div>`;
    }
    const chk = ev.type === 'race' ? raceCheck(ev) : null;
    return `<section class="card ev-card">
      <div class="row between"><h3>${esc(label)}</h3><button class="link-btn" data-a="ev-edit">Edit</button></div>
      <p class="small muted">${ctx.fmtDate(ev.date)} · ${left === 0 ? 'today' : left === 1 ? 'tomorrow' : `${left} days to go`}${ev.goalSec ? ` · goal ${fmtDur(ev.goalSec)}` : ''}</p>
      ${bar(weeks, ev.type === 'meet' ? 'block' : 'phase', i ?? -1)}
      <p class="small"><b>Week ${i != null ? i + 1 : '–'} of ${weeks.length} · ${phase}</b>${w?.cutback || w?.deload ? ' · easier week' : ''}${chk && ev.vdotNow ? ` · predicted ${fmtDur(chk.likely)}` : ''}</p>
      ${body}
    </section>`;
  }

  const actions = {
    'ev-choose': () => openChooser(),
    'ev-open': (d) => { st = defaults(d.v); reopen(); },
    'ev-edit': () => { st = defaults(ctx.db.event.type); reopen(); },
    'ev-set': (d) => {
      if (!st) return;
      if (d.multi) { const l = new Set(st[d.k]); if (l.has(d.v)) l.delete(d.v); else l.add(d.v); st[d.k] = DAY_KEYS.filter((x) => l.has(x)); }
      else st[d.k] = ['sessions', 'daysPerWeek'].includes(d.k) ? +d.v : d.v;
      if (d.k === 'sport') { st.distance = Object.keys(DISTANCES[st.sport])[1] || Object.keys(DISTANCES[st.sport])[0]; st.sessions = st.sport === 'tri' ? 7 : 4; }
      if (d.k === 'distance' && d.v !== 'custom' && !ctx.db.event) st.date = addDays(mondayOf(todayStr()), (RECOMMENDED_WEEKS[d.v] || 12) * 7 - 2);
      reopen();
    },
    'ev-mobility': (d, el) => { if (st) { st.mobility = el.checked; refreshPreview(); } },
    'ev-start': () => start(),
    'ev-remove': () => remove(false),
    'ev-finish': () => remove(true),
  };
  // Typing in a field updates the preview without redrawing the form.
  function onInput(e) {
    const el = e.target;
    if (!st || !el.dataset?.ev) return false;
    const k = el.dataset.ev;
    if (k.startsWith('cur-') || k.startsWith('goal-')) {
      const [kind, l] = k.split('-');
      const v = fromDisp(parseFloat(el.value));
      (kind === 'cur' ? st.current : st.target)[l] = Number.isFinite(v) && v > 0 ? v : null;
    } else st[k] = el.value;
    refreshPreview();
    return true;
  }
  return { card, openChooser, actions, onInput };
}
