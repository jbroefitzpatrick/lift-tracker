// Posting one lift or run from a workout, showing just what you choose: every set, one set, your
// max, the volume, or a run's distance, time and pace. Only the chosen numbers are sent.

import { setMax } from './estimate.js';
import { e1rm } from './engine.js';
import { CARDIO } from './cardio-bank.js';
import { fmtTime, goalProgress, runLog, getGoal } from './big-goal.js';
import { streakInfo } from './streak.js';

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const clock = (sec) => { const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };
const goodSets = (e) => (e.sets || []).filter((x) => x.done !== false && !x.pain && x.type !== 'w' && (x.reps > 0 || x.time > 0 || x.dist > 0));
const isRun = (db, e) => String(e.exerciseId).startsWith('run-') || db.exercises?.[e.exerciseId]?.pattern === 'run';

// Recent workouts and runs, newest first.
export function activities(db, limit = 8) {
  const out = [];
  for (const s of db.sessions || []) {
    if (!(s.entries || []).some((e) => goodSets(e).length)) continue;
    out.push({ id: `s:${s.id}`, date: s.date, ts: s.finishedAt || s.startedAt || 0, name: s.freestyle ? (s.name && s.name !== 'FitBod workout' ? s.name : 'Workout') : db.plan?.[s.day]?.name || 'Workout' });
  }
  for (const c of db.cardio || []) {
    if (CARDIO[c.cardioId]?.modality !== 'run' || c.fromWorkout) continue;
    out.push({ id: `c:${c.id}`, date: c.date, ts: c.ts || 0, name: CARDIO[c.cardioId].name });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, limit);
}

function bestBefore(db, exId, date) {
  let best = 0;
  for (const s of db.sessions || []) {
    if (s.date >= date) continue;
    for (const e of s.entries || []) if (e.exerciseId === exId) for (const x of goodSets(e)) if (x.weight > 0 && x.reps > 0) best = Math.max(best, setMax(x.weight, x.reps, x.rir));
  }
  for (const m of db.maxes || []) if (m.exerciseId === exId && m.date < date) best = Math.max(best, setMax(m.weight, m.reps || 1));
  return best;
}

// What can be posted from one workout or run.
export function activityItems(db, id) {
  if (String(id).startsWith('c:')) {
    const c = (db.cardio || []).find((x) => x.id === id.slice(2));
    if (!c) return [];
    const mi = num(c.distance); const sec = num(c.minutes) * 60;
    return [{ kind: 'run', name: CARDIO[c.cardioId]?.name || 'Run', date: c.date, mi, sec, pace: mi && sec ? sec / mi : 0 }];
  }
  const s = (db.sessions || []).find((x) => x.id === id.slice(2));
  if (!s) return [];
  const out = [];
  for (const e of s.entries || []) {
    const sets = goodSets(e);
    if (!sets.length) continue;
    const name = db.exercises?.[e.exerciseId]?.name || e.name || 'Exercise';
    if (isRun(db, e)) {
      const mi = sets.reduce((a, x) => a + num(x.dist), 0) / 1609.34; const sec = sets.reduce((a, x) => a + num(x.time), 0);
      out.push({ kind: 'run', name, date: s.date, exId: e.exerciseId, mi: Math.round(mi * 100) / 100, sec, pace: mi && sec ? sec / mi : 0 });
      continue;
    }
    const loaded = sets.filter((x) => x.weight > 0 && x.reps > 0);
    const top = loaded.length ? loaded.reduce((a, b) => (setMax(b.weight, b.reps, b.rir) > setMax(a.weight, a.reps, a.rir) ? b : a)) : null;
    const est = top ? setMax(top.weight, top.reps, top.rir) : 0;
    const before = top ? bestBefore(db, e.exerciseId, s.date) : 0;
    out.push({ kind: 'lift', name, date: s.date, exId: e.exerciseId, sets: sets.map((x) => [num(x.weight), num(x.reps), x.reps > 0 ? 0 : num(x.time)]), top: top ? [top.weight, top.reps] : null, est, isNew: !!top && before > 0 && est > before, volume: loaded.reduce((a, x) => a + x.weight * x.reps, 0) });
  }
  return out;
}

export function modesFor(item) {
  if (!item || item.kind !== 'lift') return [];
  return [['sets', 'All sets'], ['set', 'One set'], ...(item.est ? [['max', item.isNew ? 'New max' : 'Est. max']] : []), ...(item.volume ? [['volume', 'Volume']] : [])];
}
export const runFields = (item) => [['mi', 'Distance'], ['sec', 'Time'], ['pace', 'Pace']].filter(([k]) => item?.[k] > 0);

// Things worth posting that aren't one workout: maxes, streaks, clubs, running bests, milestones.
const WORKOUT_MARKS = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
export function accomplishments(db, today) {
  const out = [];
  const maxes = [];
  for (const m of db.maxes || []) if (m.weight > 0) maxes.push({ exId: m.exerciseId, w: m.weight, r: m.reps || 1, date: m.date, how: 'Logged max' });
  for (const s of db.sessions || []) for (const e of s.entries || []) {
    if (!e.maxTest) continue;
    const best = goodSets(e).filter((x) => x.weight > 0 && x.reps > 0).reduce((a, x) => (!a || x.weight > a.weight ? x : a), null);
    if (best) maxes.push({ exId: e.exerciseId, w: best.weight, r: best.reps, date: s.date, how: 'Tested max' });
  }
  for (const m of maxes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)) out.push({ key: `max:${m.exId}:${m.date}:${m.w}`, t: 'win', title: db.exercises?.[m.exId]?.name || 'Max', label: m.how, w: m.w, r: m.r, exId: m.exId, date: m.date });
  const streak = streakInfo(db, today).current;
  if (streak >= 2) out.push({ key: `streak:${streak}`, t: 'win', title: `${streak}-week streak`, label: 'Streak', big: `${streak} weeks`, sub: 'Hit the weekly goal every week', date: today });
  const n = (db.sessions || []).length;
  const mark = WORKOUT_MARKS.filter((v) => n >= v).pop();
  if (mark) out.push({ key: `count:${mark}`, t: 'win', title: `${mark.toLocaleString()} workouts`, label: 'Milestone', big: `${mark.toLocaleString()} workouts`, sub: 'Logged and counting', date: today });
  const saved = { ...db, settings: { ...db.settings, bigGoal: { on: true, type: 'club' } } };
  const club = goalProgress(saved);
  if (club.earned) out.push({ key: `club:${club.earned}`, t: 'win', title: `${club.earned.toLocaleString()}-lb club`, label: 'Strength club', wBig: club.value, sub: 'Squat, bench and deadlift total', date: today });
  const runs = runLog(db);
  const long = runs.reduce((a, r) => (!a || r.mi > a.mi ? r : a), null);
  if (long) out.push({ key: `long:${long.date}`, t: 'win', title: 'Longest run', label: 'Running best', big: `${(Math.round(long.mi * 100) / 100).toLocaleString()} miles`, sub: long.sec ? fmtTime(long.sec) : '', date: long.date });
  const mile = runs.filter((r) => r.mi >= 1 && r.sec > 0).reduce((a, r) => (!a || r.sec / r.mi < a.sec / a.mi ? r : a), null);
  if (mile) out.push({ key: `pace:${mile.date}`, t: 'win', title: 'Fastest pace', label: 'Running best', big: `${fmtTime(mile.sec / mile.mi)} per mile`, sub: `Over ${(Math.round(mile.mi * 100) / 100)} miles`, date: mile.date });
  const g = getGoal(db);
  if (g.on && g.type !== 'club') { const p = goalProgress(db); if (p.reached) out.push({ key: `goal:${p.title}`, t: 'win', title: p.title, label: 'Big goal reached', big: p.title, sub: '', date: today }); }
  return out;
}

// The data sent with the post. Old versions of the app show it as a plain workout card.
export function buildHighlight(item, { mode, set = 0, show = {} } = {}) {
  if (!item) return null;
  const base = { name: item.name, date: item.date, ...(item.exId ? { exId: item.exId } : {}) };
  if (item.kind === 'run') {
    const f = runFields(item).filter(([k]) => show[k] !== false).map(([k]) => k);
    if (!f.length) return null;
    return { t: 'run', ...base, ...Object.fromEntries(f.map((k) => [k, Math.round(item[k] * 100) / 100])) };
  }
  const m = modesFor(item).some(([k]) => k === mode) ? mode : item.isNew ? 'max' : 'sets';
  if (m === 'set') { const i = Math.min(set, item.sets.length - 1); return { t: 'lift', m, ...base, set: item.sets[i], no: i + 1, of: item.sets.length }; }
  if (m === 'max') return { t: 'lift', m, ...base, est: Math.round(item.est), w: item.top[0], r: item.top[1], isNew: item.isNew };
  if (m === 'volume') return { t: 'lift', m, ...base, vol: Math.round(item.volume), n: item.sets.length };
  return { t: 'lift', m: 'sets', ...base, sets: item.sets.slice(0, 15), n: item.sets.length, vol: Math.round(item.volume) };
}
export const highlightPayload = (hl) => ({ name: hl.name, date: hl.date, sets: hl.n || hl.of || (hl.m === 'max' || hl.t === 'run' ? 1 : 0), hl });

// How a highlight looks in the feed. Post data comes from other people, so every value is checked.
export function highlightHtml(hl, { esc, wt, wtEst, toDisp, fmtDate, art = () => '' }) {
  const name = esc(String(hl?.name || '').slice(0, 80));
  const when = hl?.date && /^\d{4}-\d\d-\d\d$/.test(hl.date) ? ` · ${esc(fmtDate(hl.date))}` : '';
  if (hl?.t === 'win') {
    const w = num(hl.w);
    const pic = w ? art(hl.exId, w) : '';
    const big = w ? (num(hl.r) > 1 ? `${wt(w)} × ${num(hl.r)}` : wt(w)) : num(hl.wBig) ? wtEst(num(hl.wBig)) : String(hl.big || '').slice(0, 40);
    const line = w ? String(hl.title || '').slice(0, 60) : String(hl.sub || '').slice(0, 60);
    const label = String(hl.label || 'Accomplishment').slice(0, 30);
    const head = w || num(hl.wBig) ? `${esc(label)} · ${name}` : esc(label);
    return `<div class="post-metric fa-win ${pic ? 'has-art' : ''}">${pic}<span class="pm-label">${head}</span><b class="num">${esc(big)}</b>${w ? (when ? `<span class="pm-sub">${esc(when.replace(' · ', ''))}</span>` : '') : line ? `<span class="pm-sub">${esc(line)}</span>` : ''}</div>`;
  }
  if (hl?.t === 'run') {
    const stats = [num(hl.mi) ? [`${num(hl.mi).toFixed(2)}`, 'miles'] : null, num(hl.sec) ? [clock(num(hl.sec)), 'time'] : null, num(hl.pace) ? [clock(num(hl.pace)), 'per mile'] : null].filter(Boolean);
    return `<div class="post-metric hl-post"><span class="pm-label">${name}${when}</span><div class="hl-stats">${stats.map(([v, l]) => `<div><b class="num">${esc(v)}</b><span>${l}</span></div>`).join('')}</div></div>`;
  }
  const setText = (s) => { const [w, r, t] = Array.isArray(s) ? s.map(num) : [0, 0, 0]; return t ? `${t} sec` : w ? `${toDisp(w)} × ${r}` : `${r} reps`; };
  if (hl?.m === 'set') {
    const [w] = Array.isArray(hl.set) ? hl.set.map(num) : [0];
    const pic = w ? art(hl.exId, w) : '';
    const [, r, t] = Array.isArray(hl.set) ? hl.set.map(num) : [0, 0, 0];
    return `<div class="post-metric ${pic ? 'has-art' : ''}">${pic}<span class="pm-label">${name}${when}</span><b class="num">${esc(t ? `${t} sec` : w ? `${wt(w)} × ${r}` : `${r} reps`)}</b><span class="pm-sub">Set ${num(hl.no)} of ${num(hl.of)}</span></div>`;
  }
  if (hl?.m === 'max') {
    const pic = num(hl.w) ? art(hl.exId, num(hl.w)) : '';
    const single = num(hl.r) === 1;
    return `<div class="post-metric ${pic ? 'has-art' : ''}">${pic}<span class="pm-label">${hl.isNew ? 'New max' : single ? 'Max' : 'Est. max'} · ${name}</span><b class="num">${esc(wtEst(num(hl.est)))}</b><span class="pm-sub">${single ? esc(when.replace(' · ', '')) : `From ${esc(wt(num(hl.w)))} × ${num(hl.r)}${when}`}</span></div>`;
  }
  if (hl?.m === 'volume') return `<div class="post-metric"><span class="pm-label">${name}${when}</span><b class="num">${esc(wt(num(hl.vol)))}</b><span class="pm-sub">Total volume · ${num(hl.n)} ${num(hl.n) === 1 ? 'set' : 'sets'}</span></div>`;
  const list = (Array.isArray(hl?.sets) ? hl.sets : []).slice(0, 15);
  return `<div class="post-metric hl-post"><span class="pm-label">${name}${when}</span><b class="num">${num(hl?.n) || list.length} ${(num(hl?.n) || list.length) === 1 ? 'set' : 'sets'}</b><div class="hl-sets">${list.map((s) => `<span>${esc(setText(s))}</span>`).join('')}</div>${num(hl?.vol) ? `<span class="pm-sub">${esc(wt(num(hl.vol)))} total</span>` : ''}</div>`;
}
