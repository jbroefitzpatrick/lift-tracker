// Training for an event: a race (running, cycling or triathlon) or a powerlifting meet.
//
// Races. The plan works back from race day through base, build, peak and taper phases, with an
// easier week every fourth week. About 80% of training stays easy (seiler2010).
// - Running paces come from VDOT, an equivalent-performance score from any recent race (daniels2014),
//   so a 10k result sets marathon paces too. Race time predictions use the same tables.
// - Cycling intensities are percentages of FTP (allen2010); without a power meter, by feel (RPE).
// - Swimming intervals are set from critical swim speed, the pace you can hold for about 30 minutes
//   (wakayoshi1992).
// - Volume grows gradually from what you do now toward a peak set by the event, and the taper cuts
//   volume by roughly half while keeping some intensity (bosquet2007).
// - Lifting: none, minimal (1 session), supportive (2 sessions of heavy and explosive work, which
//   improves running and cycling economy: ronnestad2014, blagrove2018) or hybrid (your own lifting
//   plan, eased off near the race). The last heavy leg session is at least a week before the race.
// - The plan adjusts as you go: a missed key session moves to the next suitable easy day (never
//   crammed next to another hard one); a week with less than half the plan done holds volume back
//   the next week instead of jumping ahead; and optional 5K time trials in easier weeks, or a race
//   you log, update your paces.
//
// Meets. Blocks build from volume (sets of 5–8) to strength (sets of 3–5) to a peak of heavy singles
// and doubles, then a taper week and the meet (travis2020, pritchard2015). Squat and bench come up
// twice a week, deadlift once or twice. Weights are percentages of your current max; attempts are
// planned from your goal: an opener you could triple, a second near your current best, a third at
// the goal.
//
// db.event = { type: 'race' | 'meet', date, start, ... } (see newRace / newMeet).

import { todayStr, addDays, mondayOf, daysBetween, dateOfDay } from './store.js';
import { roundToGym, activeGym, isAvailable } from './gym.js';
import { wUnit } from './units.js';
import { CARDIO } from './cardio-bank.js';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const KM = 1000;
const MI = 1609.34;

// ---------- Events ----------

export const SPORTS = { run: 'Running', bike: 'Cycling', tri: 'Triathlon' };
export const DISTANCES = {
  run: { '5k': ['5K', 5000], '10k': ['10K', 10000], half: ['Half marathon', 21097.5], marathon: ['Marathon', 42195] },
  bike: { '40k': ['40 km', 40000], '100k': ['100 km', 100000], century: ['100 miles', 160934] },
  tri: { sprint: ['Sprint', 25750], olympic: ['Olympic', 51500], '70.3': ['Half Ironman (70.3)', 113000], ironman: ['Ironman', 226000] },
};
export const TRI_LEGS = {
  sprint: { swim: 750, bike: 20000, run: 5000 }, olympic: { swim: 1500, bike: 40000, run: 10000 },
  '70.3': { swim: 1900, bike: 90000, run: 21097.5 }, ironman: { swim: 3800, bike: 180000, run: 42195 },
};
// Weeks to taper, and a sensible plan length.
const TAPER = { '5k': 1, '10k': 1, half: 2, marathon: 3, '40k': 1, '100k': 2, century: 2, sprint: 1, olympic: 2, '70.3': 2, ironman: 3 };
export const RECOMMENDED_WEEKS = { '5k': 8, '10k': 10, half: 12, marathon: 16, '40k': 8, '100k': 12, century: 14, sprint: 10, olympic: 12, '70.3': 16, ironman: 24 };
// Peak weekly training time (minutes) a plan builds toward, for a recreational athlete.
const PEAK_MIN = { '5k': 210, '10k': 250, half: 300, marathon: 390, '40k': 330, '100k': 450, century: 540, sprint: 330, olympic: 450, '70.3': 630, ironman: 840 };
// Longest single session (minutes) by event.
const LONG_CAP = { '5k': 70, '10k': 90, half: 120, marathon: 180, '40k': 120, '100k': 210, century: 300, sprint: 75, olympic: 120, '70.3': 210, ironman: 330 };

export const LIFT_LEVELS = {
  none: ['No lifting', 'Mobility and easy cross-training instead'],
  minimal: ['Minimal', 'One short strength session a week to hold strength'],
  support: ['Supportive', 'Two heavy, explosive sessions a week. The best-studied option for economy'],
  hybrid: ['Keep my plan, adapted', 'Your lifting days stay; leg work eases off as the race gets closer'],
};

export const eventLabel = (ev) => (ev?.type === 'meet' ? 'Powerlifting meet' : `${DISTANCES[ev.sport]?.[ev.distance]?.[0] || 'Race'}${ev.sport === 'bike' ? ' ride' : ev.sport === 'tri' ? ' triathlon' : ''}`);
export const eventDistance = (ev) => ev.customM || DISTANCES[ev.sport]?.[ev.distance]?.[1] || 0;

// Which week of the plan a date falls in (0-based), and the plan's length in weeks.
export function planWeeks(ev) { return Math.max(1, Math.floor(daysBetween(ev.start, mondayOf(ev.date)) / 7) + 1); }
export function weekIndex(ev, date = todayStr()) {
  if (!ev) return null;
  const i = Math.floor(daysBetween(ev.start, mondayOf(date)) / 7);
  return i >= 0 && i < planWeeks(ev) && date <= ev.date ? i : null;
}
export const eventActive = (db, date = todayStr()) => !!db.event && weekIndex(db.event, date) != null;

// ---------- Running: VDOT (Daniels and Gilbert) ----------

const vo2At = (v) => -4.6 + 0.182258 * v + 0.000104 * v * v; // v in m/min
const fracAt = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t); // t in min
export const vdotOf = (m, sec) => { const t = sec / 60; return vo2At(m / t) / fracAt(t); };
export function predictSec(vdot, m) {
  let lo = m / 600, hi = m / 40; // minutes
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (vdotOf(m, mid * 60) > vdot) lo = mid; else hi = mid; }
  return Math.round(((lo + hi) / 2) * 60);
}
// Pace (seconds per km) at a fraction of VO2max.
const paceAt = (vdot, f) => { const c = 4.6 + f * vdot; const v = (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * c)) / (2 * 0.000104); return (KM / v) * 60; };
export function runPaces(vdot) {
  const easy = [paceAt(vdot, 0.74), paceAt(vdot, 0.62)];
  return {
    easy, long: [easy[0] * 1.02, easy[1]],
    marathon: predictSec(vdot, 42195) / 42.195, half: predictSec(vdot, 21097.5) / 21.0975,
    threshold: paceAt(vdot, 0.88), tenk: predictSec(vdot, 10000) / 10, fivek: predictSec(vdot, 5000) / 5,
    interval: paceAt(vdot, 0.98), rep: paceAt(vdot, 0.98) * 0.94,
  };
}

// ---------- Formatting ----------

export const fmtDur = (sec) => {
  if (!Number.isFinite(sec)) return '—';
  const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
export function parseDur(text) {
  const p = String(text || '').trim().split(':').map((x) => Number(x));
  if (!p.length || p.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
  return s > 0 ? s : null;
}
// Pace per mile or km, from seconds per km.
export const fmtPace = (secPerKm, metric) => `${fmtDur(metric ? secPerKm : secPerKm * (MI / KM))}/${metric ? 'km' : 'mi'}`;
export const fmtDist = (m, metric) => (metric ? `${(m / KM).toFixed(m < 10000 ? 1 : 0)} km` : `${(m / MI).toFixed(m < 16000 ? 1 : 0)} mi`);

// ---------- Race plan shape ----------

// Each week: phase, whether it's an easier week, and its training volume as a share of the peak.
export function raceWeeks(ev) {
  const n = planWeeks(ev);
  const taper = Math.min(TAPER[ev.distance] || 1, Math.max(1, n - 3));
  const rest = n - taper;
  const peak = rest >= 4 ? Math.max(1, Math.round(rest * 0.25)) : rest >= 2 ? 1 : 0;
  const build = rest - peak >= 3 ? Math.round((rest - peak) * 0.45) : rest - peak;
  const base = rest - peak - build;
  const peakMin = Math.min(ev.maxMin || Infinity, PEAK_MIN[ev.distance] || 300);
  const start = Math.max(60, Math.min(peakMin, ev.weeklyMin || peakMin * 0.6));
  const out = [];
  let vol = start;
  for (let i = 0; i < n; i++) {
    const phase = i < base ? 'base' : i < base + build ? 'build' : i < rest ? 'peak' : 'taper';
    const cutback = phase !== 'taper' && i < rest - 1 && (i + 1) % 4 === 0;
    if (phase === 'taper') {
      const t = i - rest; const left = taper - t; // left = 1 in race week
      const share = taper === 1 ? [0.55] : taper === 2 ? [0.7, 0.45] : [0.8, 0.6, 0.4];
      out.push({ phase, cutback: false, minutes: Math.round(vol * share[taper - left]), raceWeek: left === 1 });
      continue;
    }
    if (i > 0 && !cutback && !out[i - 1].cutback) vol = Math.min(peakMin, vol * 1.08);
    out.push({ phase, cutback, minutes: Math.round(cutback ? vol * 0.75 : vol), raceWeek: false });
  }
  return out;
}

// ---------- Sessions ----------
// A session: { sport, kind, hard, min, item } where item is a workout item for the day.

const runItem = (id, metric, target, sets, note, extra = {}) => ({ exerciseId: id, metric, target, sets, restSec: extra.restSec ?? 0, repMin: 1, repMax: 1, note, ...extra });

function runSessions(ev, w, wk, n, metric) {
  const vdot = ev.vdotNow ? ev.vdotNow + (ev.vdotGoal - ev.vdotNow) * Math.min(1, wk / Math.max(1, raceWeeks(ev).length - 1)) * 0.85 : null;
  const P = vdot ? runPaces(vdot) : null;
  const pace = (k) => (P ? fmtPace(P[k], metric) : '');
  const easyPace = P ? `${fmtPace(P.easy[0], metric)} or slower` : 'conversational';
  const goalPace = ev.goalSec ? ev.goalSec / (eventDistance(ev) / KM) : P?.[{ '5k': 'fivek', '10k': 'tenk', half: 'half', marathon: 'marathon' }[ev.distance]] || null;
  const gp = goalPace ? fmtPace(goalPace, metric) : 'goal race pace';
  const total = w.minutes;
  const longMin = Math.min(LONG_CAP[ev.distance] || 120, Math.max(30, Math.round(total * (n <= 3 ? 0.35 : 0.3))));
  const out = [];
  const quality = w.raceWeek ? 1 : w.cutback || n <= 3 ? 1 : 2;
  const dist = ev.distance;
  const short = dist === '5k' || dist === '10k';
  // Quality sessions by phase.
  const q = [];
  const reps = (k, count, m, rest) => runItem('run-repeat', 'distance', m, count, `${count} × ${m >= 1000 ? `${m / 1000} km` : `${m} m`} at ${pace(k) || 'hard, even effort'}, ${rest} easy jog between. Warm up and cool down 10 min each.`, { restSec: rest === '2 min' ? 120 : rest === '90 s' ? 90 : 60 });
  if (w.raceWeek) q.push(['sharpen', runItem('run-repeat', 'distance', 400, 4, `4 × 400 m at ${gp}, full recovery. Short and sharp to stay fresh.`, { restSec: 120 }), 35]);
  else if (w.phase === 'base') {
    q.push(['hills', runItem('run-hills', 'time', 60, Math.min(10, 6 + Math.floor(wk / 2)), `Hill repeats: ${Math.min(10, 6 + Math.floor(wk / 2))} × 60 s uphill at a strong effort, walk or jog down. Builds strength and form.`, { restSec: 90 }), 45]);
    q.push(['strides', runItem('run-easy', 'time', 30 * 60, 1, `Easy 30 min at ${easyPace}, then 6 × 20 s strides (quick, relaxed, full recovery)`), 35]);
  } else if (w.phase === 'build') {
    const t = Math.min(5, 3 + Math.floor(wk / 3));
    q.push(['threshold', reps('threshold', t, 1600, '1 min'), 50]);
    q.push(short ? ['intervals', reps('interval', 5, 1000, '2 min'), 50] : ['race-pace', runItem('run-race-pace', 'distance', (dist === 'marathon' ? 8 : 5) * MI, 1, `${dist === 'marathon' ? 8 : 5} mi (${fmtDist((dist === 'marathon' ? 8 : 5) * MI, true)}) at ${gp} inside an easy run`), 70]);
  } else if (w.phase === 'peak') {
    if (dist === '5k') q.push(['race-pace', reps('fivek', 5, 1000, '2 min'), 50], ['speed', reps('rep', 8, 200, '90 s'), 40]);
    else if (dist === '10k') q.push(['race-pace', reps('tenk', 4, 2000, '90 s'), 55], ['threshold', reps('threshold', 4, 1600, '1 min'), 50]);
    else if (dist === 'half') q.push(['race-pace', reps('half', 3, 3000, '90 s'), 60], ['threshold', runItem('run-tempo', 'time', 25 * 60, 1, `25 min steady at ${pace('threshold') || 'comfortably hard'}`), 50]);
    else q.push(['threshold', reps('threshold', 4, 1600, '1 min'), 50], ['marathon-pace', runItem('run-race-pace', 'distance', 6 * MI, 1, `6 mi (${fmtDist(6 * MI, true)}) at ${gp}, with 15 min easy before and after`), 80]);
  } else {
    q.push(['race-pace', reps(short ? (dist === '5k' ? 'fivek' : 'tenk') : dist === 'half' ? 'half' : 'marathon', 4, 1000, '90 s'), 45]);
  }
  for (const [kind, item, min] of q.slice(0, quality)) out.push({ sport: 'run', kind, hard: kind !== 'strides', min, item });
  if (!w.raceWeek) {
    const mpFinish = dist === 'marathon' && w.phase === 'peak' && !w.cutback;
    out.push({ sport: 'run', kind: 'long', hard: mpFinish, min: longMin, item: runItem('run-long', 'time', longMin * 60, 1, `${fmtDur(longMin * 60)} easy at ${easyPace}${mpFinish ? `, the last 20 min at ${gp}` : ''}. Practise race-day fuel and drinks on runs over 75 min.`) });
  }
  const used = out.reduce((a, s) => a + s.min, 0);
  const easyN = Math.max(0, n - out.length - (w.raceWeek ? 1 : 0));
  const each = easyN ? Math.max(20, Math.round((total - used) / easyN)) : 0;
  for (let i = 0; i < easyN; i++) out.push({ sport: 'run', kind: 'easy', hard: false, min: each, item: runItem('run-easy', 'time', each * 60, 1, `Easy ${each} min at ${easyPace}`) });
  return out;
}

function bikeSessions(ev, w, wk, n) {
  const ftp = +ev.ftp || 0;
  const z = (lo, hi, rpe) => (ftp ? `${Math.round(ftp * lo)}–${Math.round(ftp * hi)} W` : rpe);
  const total = w.minutes;
  const longMin = Math.min(LONG_CAP[ev.distance] || 180, Math.max(60, Math.round(total * 0.38)));
  const q = [];
  const iv = (count, m, lo, hi, rpe, name, rest) => runItem('ride-intervals', 'time', m * 60, count, `${name}: ${count} × ${m} min at ${z(lo, hi, rpe)}, ${rest} min easy between. Warm up 15 min first.`, { restSec: rest * 60 });
  if (w.raceWeek) q.push(['openers', iv(3, 3, 0.95, 1.05, 'race effort (RPE 8)', 'Openers', 3), 45]);
  else if (w.phase === 'base') q.push(['tempo', iv(3, Math.min(15, 8 + wk), 0.76, 0.9, 'steady and focused (RPE 6)', 'Tempo', 5), 60]);
  else if (w.phase === 'build') q.push(['sweet-spot', iv(2, Math.min(25, 15 + wk), 0.88, 0.94, 'hard but sustainable (RPE 7)', 'Sweet spot', 5), 70], ['vo2', iv(5, 3, 1.06, 1.2, 'very hard (RPE 9)', 'VO2 max', 3), 55]);
  else if (w.phase === 'peak') q.push(['threshold', iv(3, 12, 0.95, 1.05, '1-hour race effort (RPE 8)', 'Threshold', 5), 70], ev.distance === '40k' ? ['vo2', iv(6, 3, 1.06, 1.2, 'very hard (RPE 9)', 'VO2 max', 3), 55] : ['race-pace', iv(2, 30, 0.8, 0.88, 'your race effort', 'Race pace', 10), 90]);
  else q.push(['openers', iv(4, 4, 0.95, 1.05, 'race effort (RPE 8)', 'Race-effort efforts', 4), 55]);
  const quality = w.raceWeek ? 1 : w.cutback || n <= 3 ? 1 : 2;
  const out = q.slice(0, quality).map(([kind, item, min]) => ({ sport: 'bike', kind, hard: true, min, item }));
  if (!w.raceWeek) out.push({ sport: 'bike', kind: 'long', hard: false, min: longMin, item: runItem('ride-long', 'time', longMin * 60, 1, `Long ride ${fmtDur(longMin * 60)} at ${z(0.56, 0.75, 'an easy, conversational effort')}. Eat and drink as you would on race day.`) });
  const used = out.reduce((a, s) => a + s.min, 0);
  const easyN = Math.max(0, n - out.length - (w.raceWeek ? 1 : 0));
  const each = easyN ? Math.max(30, Math.round((total - used) / easyN)) : 0;
  for (let i = 0; i < easyN; i++) out.push({ sport: 'bike', kind: 'endurance', hard: false, min: each, item: runItem('ride-endurance', 'time', each * 60, 1, `Endurance ride ${each} min at ${z(0.56, 0.75, 'an easy, conversational effort')}`) });
  return out;
}

function swimSessions(ev, w, wk, count) {
  const css = +ev.css || 0; // seconds per 100 m
  const at = (d, rpe) => (css ? `${fmtDur(css + d)}/100 m` : rpe);
  const leg = TRI_LEGS[ev.distance]?.swim || 1500;
  const out = [];
  const tech = runItem('swim-technique', 'distance', Math.round(Math.min(2500, leg * 1.1) / 100) * 100, 1, `Technique: warm up 300 m, then drills (catch-up, fingertip drag, 6-kick switch) in 50s, then ${Math.round(leg / 2 / 100) * 100} m steady at ${at(8, 'an easy effort')}`);
  const cssSet = runItem('swim-intervals', 'distance', 100, Math.min(16, 8 + wk), `${Math.min(16, 8 + wk)} × 100 m at ${at(0, 'a strong, even effort')}, 15 s rest. Warm up 300 m first.`, { restSec: 15 });
  const endur = runItem('swim-endurance', 'distance', Math.round(Math.min(leg * 1.2, 1000 + wk * 150) / 100) * 100, 1, `Continuous swim at ${at(6, 'race effort you could hold')}. ${w.phase === 'peak' ? 'In open water if you can, with sighting every 6–8 strokes.' : 'Practise bilateral breathing.'}`);
  const list = w.raceWeek ? [cssSet] : w.phase === 'base' ? [tech, endur, cssSet] : [cssSet, endur, tech];
  for (const item of list.slice(0, count)) out.push({ sport: 'swim', kind: item.exerciseId.replace('swim-', ''), hard: item === cssSet, min: Math.round(((item.target * item.sets) / 100) * ((css || 120) / 60)) + 10, item });
  return out;
}

// Triathlon: sessions split across swim, bike and run, with a brick (bike then run) once a week
// from the build phase on.
function triSessions(ev, w, wk, n, metric) {
  const swims = n >= 8 ? 3 : 2;
  const runs = n >= 7 ? 3 : 2;
  const rides = Math.max(2, n - swims - runs);
  const out = [...swimSessions(ev, w, wk, swims)];
  const share = (k) => ({ ...w, minutes: Math.round(w.minutes * k) });
  out.push(...bikeSessions({ ...ev, distance: { sprint: '40k', olympic: '40k', '70.3': '100k', ironman: 'century' }[ev.distance] }, share(0.5), wk, rides).map((s) => ({ ...s })));
  out.push(...runSessions({ ...ev, distance: { sprint: '5k', olympic: '10k', '70.3': 'half', ironman: 'marathon' }[ev.distance], goalSec: null }, share(0.3), wk, runs, metric));
  if ((w.phase === 'build' || w.phase === 'peak') && !w.cutback) {
    const ride = out.find((s) => s.sport === 'bike' && s.kind === 'long');
    if (ride) out.push({ sport: 'brick', kind: 'brick', hard: false, min: 20, after: ride, item: runItem('brick-run', 'time', (w.phase === 'peak' ? 20 : 15) * 60, 1, `Straight off the bike: ${w.phase === 'peak' ? 20 : 15} min run, the first 5 min at race pace. Gets your legs used to the change.`) });
  }
  return out;
}

// ---------- Weekly schedule ----------

// Places a week's sessions on the training days: long sessions at the weekend, hard sessions apart,
// strength on a hard day (hard days hard, easy days easy) and never the day before a hard session.
export function scheduleWeek(sessions, days, liftCount, fixed = null) {
  const avail = days.length ? days : DAY_KEYS;
  const load = Object.fromEntries(DAY_KEYS.map((d) => [d, []]));
  const idx = (d) => DAY_KEYS.indexOf(d);
  const gap = (a, b) => Math.min(Math.abs(idx(a) - idx(b)), 7 - Math.abs(idx(a) - idx(b)));
  const place = (s, score) => {
    let best = null;
    for (const d of avail) { const v = score(d); if (best == null || v > best.v) best = { d, v }; }
    load[best.d].push(s);
  };
  const legDays = fixed?.legDays || [];
  const afterLegs = (d) => legDays.includes(DAY_KEYS[(idx(d) + 6) % 7]);
  const longs = sessions.filter((s) => s.kind === 'long').sort((a, b) => (a.sport === 'bike' ? -1 : 1));
  for (const s of longs) place(s, (d) => (d === 'sat' ? 4 : d === 'sun' ? 3.5 : 0) - load[d].length * 6 - (load[d].some((x) => x.kind === 'long') ? 10 : 0) - (afterLegs(d) ? 5 : 0) - (legDays.includes(d) ? 3 : 0));
  for (const s of sessions.filter((x) => x.after)) { for (const d of DAY_KEYS) if (load[d].includes(s.after)) load[d].push(s); }
  const hard = sessions.filter((s) => s.hard && s.kind !== 'long' && !s.after);
  const nextOf = (d) => DAY_KEYS[(idx(d) + 1) % 7];
  for (const s of hard) place(s, (d) => -load[d].length * 4 - DAY_KEYS.reduce((a, o) => a + (load[o].some((x) => x.hard) && gap(o, d) <= 1 ? 5 : 0), 0) + (d === 'tue' || d === 'thu' ? 1 : 0)
    - (load[d].some((x) => x.kind === 'long') ? 8 : 0) - (load[nextOf(d)].some((x) => x.kind === 'long') ? 3 : 0) - (load[d].some((x) => x.sport === s.sport) ? 8 : 0)
    - (afterLegs(d) ? 6 : 0) + (legDays.includes(d) ? 1 : 0));
  for (const s of sessions.filter((x) => !x.hard && x.kind !== 'long' && !x.after)) place(s, (d) => -load[d].length * 3 - (load[d].some((x) => x.sport === s.sport) ? 4 : 0) + (load[d].some((x) => x.hard) ? -1 : 0));
  // Strength days: a hard day, not the day before another hard day or the long session.
  if (fixed?.liftDays) return { byDay: load, liftDays: fixed.liftDays };
  const liftDays = [];
  for (let k = 0; k < liftCount; k++) {
    let best = null;
    for (const d of avail) {
      if (liftDays.includes(d)) continue;
      const next = DAY_KEYS[(idx(d) + 1) % 7];
      let v = (load[d].some((x) => x.hard) ? 3 : 0) - (load[next].some((x) => x.hard || x.kind === 'long') ? 6 : 0) - (load[d].some((x) => x.kind === 'long') ? 5 : 0) - liftDays.reduce((a, o) => a + (gap(o, d) <= 1 ? 4 : 0), 0);
      if (best == null || v > best.v) best = { d, v };
    }
    if (best) liftDays.push(best.d);
  }
  return { byDay: load, liftDays };
}

// The race plan for one week: sessions by day, strength days, and the phase.
// The lifting days already in the plan, and which are heavy for the legs (6+ sets).
export function planLiftDays(db) {
  const legs = ['quads', 'hamstrings', 'glutes'];
  const liftDays = []; const legDays = [];
  for (const d of DAY_KEYS) {
    const p = db.plan?.[d];
    if (!p?.items?.length || !['lift', 'both'].includes(db.settings?.dayModes?.[d] || 'lift')) continue;
    liftDays.push(d);
    const sets = p.items.reduce((a, it) => a + (db.exercises[it.exerciseId]?.primary?.some((m) => legs.includes(m)) ? +it.sets || 0 : 0), 0);
    if (sets >= 6) legDays.push(d);
  }
  return { liftDays, legDays };
}

// Was a planned session done on that date? Any logged workout or cardio of the same sport counts.
const SPORT_PATTERNS = { run: ['run', 'sprint'], bike: ['ride', 'erg'], swim: ['swim'], brick: ['run'], mobility: ['mobility'], race: ['run', 'ride', 'swim'] };
const SPORT_MODALITY = { run: ['run'], bike: ['bike'], swim: ['swim'], brick: ['run'], race: ['run', 'bike', 'swim'] };
export function sessionDone(db, date, s) {
  const pats = SPORT_PATTERNS[s.sport] || [];
  for (const x of db.sessions || []) {
    if (x.date !== date) continue;
    if (x.entries.some((e) => e.exerciseId === s.item.exerciseId || pats.includes(db.exercises[e.exerciseId]?.pattern))) return true;
  }
  return (db.cardio || []).some((c) => c.date === date && (SPORT_MODALITY[s.sport] || []).includes(CARDIO[c.cardioId]?.modality));
}
// Share of a week's planned minutes that was done.
function weekCompletion(db, ev, i, metric) {
  const wp = raceWeekPlan(ev, i, metric);
  if (!wp) return 1;
  let planned = 0; let done = 0;
  for (const d of DAY_KEYS) {
    const date = addDays(addDays(ev.start, i * 7), DAY_KEYS.indexOf(d));
    for (const s of wp.byDay[d]) { if (s.sport === 'mobility') continue; planned += s.min; if (sessionDone(db, date, s)) done += s.min; }
  }
  return planned ? done / planned : 1;
}

// Plans are worked out often (every day shown, every render), so recent ones are kept.
const planCache = new Map();
export function raceWeekPlan(ev, i, metric, db = null, now = todayStr()) {
  const key = db ? [i, metric, now, db.sessions?.length, db.sessions?.at(-1)?.id, (db.cardio || []).length, JSON.stringify(db.settings?.dayModes), JSON.stringify(ev)].join('|') : null;
  if (key && planCache.has(key)) return planCache.get(key);
  const out = raceWeekPlanRaw(ev, i, metric, db, now);
  if (key) { planCache.set(key, out); if (planCache.size > 40) planCache.delete(planCache.keys().next().value); }
  return out;
}
function raceWeekPlanRaw(ev, i, metric, db, now) {
  const weeks = raceWeeks(ev);
  let w = weeks[i];
  if (!w) return null;
  const notes = [];
  // A week mostly missed: hold volume at last week's level and keep just one hard session, rather
  // than jumping ahead (and a second missed week eases back further).
  if (db && i > 0 && !w.raceWeek && w.phase !== 'taper') {
    const prev = weekCompletion(db, ev, i - 1, metric);
    if (prev < 0.5) {
      const prev2 = i > 1 ? weekCompletion(db, ev, i - 2, metric) : 1;
      const minutes = Math.round(weeks[i - 1].minutes * (prev2 < 0.5 ? 0.8 : 0.95));
      if (minutes < w.minutes) { w = { ...w, minutes, cutback: true, eased: true }; notes.push(`Eased back: about ${Math.round(prev * 100)}% of last week was done, so this week holds steady instead of building.`); }
    }
  }
  const n = Math.max(2, Math.min(ev.sport === 'tri' ? 12 : 7, +ev.sessions || 4));
  let sessions = ev.sport === 'run' ? runSessions(ev, w, i, n, metric) : ev.sport === 'bike' ? bikeSessions(ev, w, i, n) : triSessions(ev, w, i, n, metric);
  const liftCount = w.raceWeek ? 0 : { none: 0, minimal: 1, support: w.phase === 'taper' ? 1 : 2, hybrid: 0 }[ev.lifting || 'support'] || 0;
  // An easier running week: the first hard session becomes an optional 5K time trial that updates paces.
  if (w.cutback && !w.eased && ['base', 'build'].includes(w.phase) && (ev.sport === 'run' || ev.sport === 'tri') && i >= 3) {
    const q = sessions.find((s) => s.sport === 'run' && s.hard && s.kind !== 'long');
    if (q) Object.assign(q, { kind: 'time-trial', min: 40, item: runItem('run-5k', 'distance', 5000, 1, 'Optional 5K time trial: warm up 15 min, run 5K hard and even, and log your time. It updates your training paces.') });
  }
  const days = ev.days?.length ? ev.days : DAY_KEYS.filter((d) => d !== 'mon');
  const own = db && ev.lifting === 'hybrid' && db.plan ? planLiftDays(db) : null;
  const sch = scheduleWeek(sessions, days, liftCount, own);
  // Race day itself.
  if (w.raceWeek) {
    const raceDay = DAY_KEYS[(new Date(`${ev.date}T12:00:00`).getDay() + 6) % 7];
    for (const d of DAY_KEYS) if (DAY_KEYS.indexOf(d) >= DAY_KEYS.indexOf(raceDay) - 1 && d !== raceDay) sch.byDay[d] = sch.byDay[d].filter((s) => !s.hard);
    sch.byDay[raceDay] = [{ sport: 'race', kind: 'race', hard: true, min: Math.round((ev.goalSec || 3600) / 60), item: runItem('race-day', 'distance', eventDistance(ev), 1, `Race day: ${eventLabel(ev)}${ev.goalSec ? `, goal ${fmtDur(ev.goalSec)}` : ''}. Start a little slower than goal pace and build.`) }];
  }
  // Mobility (and easy cross-training) when there is no lifting.
  if ((ev.lifting || 'support') === 'none' && ev.mobility !== false) {
    const easyDays = DAY_KEYS.filter((d) => !sch.byDay[d].some((s) => s.hard)).slice(0, 2);
    for (const d of easyDays) sch.byDay[d].push({ sport: 'mobility', kind: 'mobility', hard: false, min: 15, item: runItem('mobility-session', 'time', 15 * 60, 1, 'Mobility: hips, ankles, hamstrings and upper back. 15 min, easy breathing.') });
  }
  // A key session missed earlier this week moves to the next suitable easy day (once a week; a
  // missed long session isn't made up).
  if (db && i === weekIndex(ev, now) && !w.raceWeek) {
    const today = now;
    const dateOf = (d) => addDays(addDays(ev.start, i * 7), DAY_KEYS.indexOf(d));
    const hardOn = (d) => sch.byDay[d]?.some((s) => s.hard || s.kind === 'long');
    for (const d of DAY_KEYS) {
      if (dateOf(d) >= today) continue;
      const missed = sch.byDay[d].find((s) => s.hard && s.kind !== 'long' && s.kind !== 'time-trial' && !sessionDone(db, dateOf(d), s));
      if (!missed) continue;
      const to = DAY_KEYS.find((t) => dateOf(t) >= today && !hardOn(t) && !hardOn(DAY_KEYS[(DAY_KEYS.indexOf(t) + 1) % 7]) && !(dateOf(t) > today && hardOn(DAY_KEYS[(DAY_KEYS.indexOf(t) + 6) % 7])) && days.includes(t));
      if (!to) { notes.push(`${SHORT_DAY[d]}'s ${missed.kind} was missed; there's no good spot for it this week, so it's skipped rather than crammed in.`); break; }
      const easy = sch.byDay[to].findIndex((s) => s.sport === missed.sport && !s.hard);
      const moved = { ...missed, item: { ...missed.item, note: `Moved from ${SHORT_DAY[d]}. ${missed.item.note}` } };
      if (easy >= 0) sch.byDay[to].splice(easy, 1, moved); else sch.byDay[to].push(moved);
      sch.byDay[d] = sch.byDay[d].map((s) => (s === missed ? { ...s, movedTo: to } : s));
      notes.push(`${SHORT_DAY[d]}'s ${missed.kind} moved to ${SHORT_DAY[to]}.`);
      break;
    }
  }
  return { week: w, weeks, byDay: sch.byDay, liftDays: sch.liftDays, notes };
}
const SHORT_DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

// A logged 5K time trial or race updates the running paces.
export function recordRun(db, session) {
  const ev = db.event;
  if (!ev || ev.type !== 'race' || ev.sport === 'bike') return null;
  for (const e of session.entries || []) {
    if (!['run-5k', 'race-day'].includes(e.exerciseId)) continue;
    const set = (e.sets || []).find((x) => x.done !== false && x.time > 0);
    const m = +set?.dist || (e.exerciseId === 'run-5k' ? 5000 : ev.sport === 'run' ? eventDistance(ev) : 0);
    if (!set || !m || set.time < m / 8) continue; // faster than a world record: a typing slip
    const vdot = vdotOf(m, set.time);
    ev.trials = [...(ev.trials || []), { date: session.date, m, sec: set.time, vdot: Math.round(vdot * 10) / 10 }];
    ev.vdotNow = vdot;
    ev.vdotGoal = Math.max(ev.vdotGoal || 0, vdot);
    return { m, sec: set.time, vdot };
  }
  return null;
}

// Workout items for a weekday this week (what the Train screen shows for the event).
export function eventItemsFor(db, day, date = todayStr()) {
  const ev = db.event;
  if (!ev || ev.type !== 'race') return [];
  const d = dateOfDay(day, date);
  const i = weekIndex(ev, d);
  if (i == null || d > ev.date) return [];
  const wp = raceWeekPlan(ev, i, wUnit() === 'kg', db);
  return (wp?.byDay[day] || []).filter((s) => !s.movedTo).map((s, k) => ({ uid: `ev-${day}-${i}-${s.kind}-${k}`, group: `E${k + 1}`, eventKind: s.kind, sport: s.sport, ...s.item }));
}
export function eventDays(db, date = todayStr()) {
  if (!db.event || db.event.type !== 'race') return [];
  const i = weekIndex(db.event, date);
  if (i == null) return [];
  const wp = raceWeekPlan(db.event, i, wUnit() === 'kg', db);
  return DAY_KEYS.filter((d) => wp.byDay[d].some((s) => !s.movedTo) && dateOfDay(d, date) <= db.event.date);
}

// ---------- Strength for endurance athletes ----------

const firstOk = (db, ids) => ids.find((id) => db.exercises[id] && isAvailable(db, db.exercises[id]) && db.exPrefs?.[id] !== 'never') || null;
// Two sessions: A (squat pattern) and B (hinge pattern). Heavy (3–6 reps), explosive work first,
// single-leg strength, the calf and soleus for runners, upper back for swimmers.
export function enduranceStrengthDays(db, ev, plan = null) {
  const run = ev.sport !== 'bike';
  const mine = (pattern) => { for (const d of Object.values(plan || {})) for (const it of d.items || []) { const e = db.exercises[it.exerciseId]; if (e?.pattern === pattern && e.category === 'compound') return [it.exerciseId]; } return []; };
  const swim = ev.sport === 'tri';
  const it = (n, id, sets, lo, hi, rest, note = '') => (id ? { uid: `es-${n}-${id}`, exerciseId: id, group: String(n), sets, repMin: lo, repMax: hi, restSec: rest, note } : null);
  const A = [
    it(1, firstOk(db, run ? ['box-jump', 'squat-jump', 'pogo-hop'] : ['box-jump', 'squat-jump']), 3, 5, 5, 75, 'Jump fast, land softly, full rest'),
    it(2, firstOk(db, [...mine('squat'), 'back-squat', 'safety-bar-squat', 'trap-bar-deadlift', 'goblet-squat', 'leg-press']), 3, 4, 6, 180, 'Heavy: stop 2 reps short of failure'),
    it(3, firstOk(db, [...mine('lunge'), 'bulgarian-split-squat', 'reverse-lunge', 'step-up', 'walking-lunge']), 2, 6, 8, 120, 'Each leg'),
    it(4, firstOk(db, run ? ['seated-calf', 'standing-calf', 'single-leg-calf'] : ['standing-calf', 'seated-calf']), 3, 8, 12, 60, run ? 'Bent knee works the soleus, which takes the most load when running' : ''),
    it(5, firstOk(db, ['pallof-press', 'side-plank', 'dead-bug', 'plank']), 2, 8, 12, 45),
  ];
  const B = [
    it(1, firstOk(db, run ? ['pogo-hop', 'broad-jump', 'lateral-bound'] : ['broad-jump', 'squat-jump']), 3, 5, 5, 75, 'Quick contacts, full rest'),
    it(2, firstOk(db, [...mine('hinge'), 'trap-bar-deadlift', 'deadlift', 'rdl', 'db-rdl']), 3, 4, 6, 180, 'Heavy: stop 2 reps short of failure'),
    it(3, firstOk(db, ['step-up', 'single-leg-rdl', 'reverse-lunge', 'bulgarian-split-squat']), 2, 6, 8, 120, 'Each leg'),
    it(4, firstOk(db, swim ? ['lat-pulldown', 'pullup', 'cable-row'] : ['nordic-curl', 'lying-ham-curl', 'seated-ham-curl']), 3, 6, 10, 90),
    it(5, firstOk(db, swim ? ['face-pull', 'band-pull-apart', 'cable-external-rotation'] : ['copenhagen-plank', 'side-plank', 'hip-adductor']), 2, 8, 12, 45),
  ];
  return [A.filter(Boolean), B.filter(Boolean)];
}

// Lifting near the race: fewer sets in the peak, half the sets in the taper, and nothing heavy in
// the last week. Applied on top of whatever the day's plan is.
export function eventLiftAdjust(db, day, items, date = todayStr()) {
  const ev = db.event;
  if (ev?.type === 'meet') {
    const d = dateOfDay(day, date);
    const i = weekIndex(ev, d);
    if (i == null) return items;
    const w = meetWeeks(ev)[i];
    if (w.block !== 'meet') return w.deload ? items.map((it) => (!it.meet && it.ex?.category !== 'conditioning' && it.sets > 2 ? { ...it, sets: it.sets - 1 } : it)) : items;
    if (d === ev.date) {
      const lifts = MEET_FORMATS[ev.format || 'full'][1];
      return lifts.map((l, k) => ({ uid: `meet-${l}`, exerciseId: MEET_LIFTS[l], group: String(k + 1), sets: 3, repMin: 1, repMax: 1, restSec: 600, meet: { lift: l, kind: 'comp' }, note: 'Meet day', ex: db.exercises[MEET_LIFTS[l]] })).filter((it) => it.ex);
    }
    if (d > ev.date || daysBetween(d, ev.date) < 3) return [];
    return items.filter((it) => it.meet?.kind === 'comp' && it.meet.lift !== 'deadlift').map((it) => ({ ...it, note: 'Meet week: light singles to stay sharp' }));
  }
  if (!ev || ev.type !== 'race') return items;
  const d = dateOfDay(day, date);
  const i = weekIndex(ev, d);
  if (i == null) return items;
  const w = raceWeeks(ev)[i];
  const lift = (it) => it.ex?.category !== 'conditioning';
  if (w.raceWeek || daysBetween(d, ev.date) < 7) return items.filter((it) => !lift(it));
  if (w.phase === 'taper') return items.map((it) => (lift(it) ? { ...it, sets: Math.max(1, Math.ceil(it.sets / 2)), note: it.note || 'Taper: half the sets, same weights' } : it));
  const legs = (it) => it.ex?.primary?.some((m) => ['quads', 'hamstrings', 'glutes', 'calves'].includes(m));
  if (ev.lifting === 'hybrid' && (w.phase === 'base' || w.phase === 'build')) return items.map((it) => (lift(it) && it.ex?.category === 'accessory' && legs(it) && it.sets > 2 ? { ...it, sets: it.sets - 1 } : it));
  if (w.phase === 'peak' && (ev.lifting === 'hybrid' || ev.lifting === 'support')) return items.map((it) => (lift(it) && it.ex?.category === 'accessory' && it.sets > 2 ? { ...it, sets: it.sets - 1 } : it));
  return items;
}

// ---------- Powerlifting meet ----------

export const MEET_LIFTS = { squat: 'back-squat', bench: 'bench-press', deadlift: 'deadlift' };
export const MEET_FORMATS = { full: ['Full power', ['squat', 'bench', 'deadlift']], bench: ['Bench only', ['bench']], pushpull: ['Push-pull', ['bench', 'deadlift']] };
const VARIATIONS = { squat: ['pause-squat', 'front-squat', 'safety-bar-squat', 'back-squat'], bench: ['pause-bench', 'close-grip-bench', 'spoto-press', 'db-bench'], deadlift: ['pause-deadlift', 'deficit-deadlift', 'rdl', 'block-pull'] };

// Blocks for a meet n weeks out: volume, strength, peak, taper week, meet week.
export function meetWeeks(ev) {
  const n = planWeeks(ev);
  const peak = n >= 10 ? 3 : n >= 7 ? 2 : 1;
  const rest = Math.max(0, n - 2 - peak);
  const strength = Math.ceil(rest / 2);
  const volume = rest - strength;
  return Array.from({ length: n }, (_, i) => {
    const block = i < volume ? 'volume' : i < volume + strength ? 'strength' : i < n - 2 ? 'peak' : i === n - 2 ? 'taper' : 'meet';
    const start = block === 'volume' ? 0 : block === 'strength' ? volume : volume + strength;
    const k = i - start;
    const deload = (block === 'volume' || block === 'strength') && k > 0 && (i + 1) % 4 === 0 && i < n - 3;
    return { block, k, deload };
  });
}
// The week's sets for a lift slot: [fraction of max, reps] per set.
function meetSets(w, kind, lift) {
  const r = (n, p, reps) => Array.from({ length: n }, () => [p, reps]);
  const dl = lift === 'deadlift';
  if (w.block === 'meet') return kind === 'comp' && !dl ? [[0.8, 1], [0.85, 1]] : [];
  if (w.block === 'taper') return kind === 'comp' ? (dl ? r(2, 0.75, 2) : [[0.9, 1], ...r(2, 0.8, 2)]) : r(2, 0.7, 2);
  const step = w.deload ? -0.08 : 0;
  if (w.block === 'volume') return kind === 'comp' ? r(w.deload ? 2 : 4, Math.min(0.76, 0.7 + 0.02 * w.k) + step, 6) : kind === 'vol' ? r(3, Math.min(0.7, 0.65 + 0.02 * w.k) + step, 8) : r(3, Math.min(0.68, 0.62 + 0.02 * w.k) + step, 8);
  if (w.block === 'strength') return kind === 'comp' ? r(w.deload ? 2 : 4, Math.min(0.86, 0.78 + 0.025 * w.k) + step, 4) : kind === 'vol' ? r(3, 0.75 + step, 5) : r(3, 0.7 + step, 5);
  const top = Math.min(0.97, 0.88 + 0.03 * w.k);
  return kind === 'comp' ? [[top, 1], ...r(3, 0.85, 2)] : kind === 'vol' ? r(3, 0.8, 3) : r(2, 0.75, 3);
}
// Attempts from the goal: an opener you could triple on a bad day, a second near your best, a third
// at the goal. Rounded to 2.5 kg, as meets load.
export function attemptsFor(goalLb, curLb) {
  const kg = (lb) => Math.round(lb / 2.20462 / 2.5) * 2.5;
  const third = kg(goalLb);
  const opener = kg(Math.min(goalLb * 0.9, curLb * 0.92));
  const second = Math.max(opener + 2.5, Math.min(third - 2.5, kg(goalLb * 0.96)));
  return [opener, second, third].map((k) => ({ kg: k, lb: Math.round(k * 2.20462) }));
}

// The meet's training days. Squat and bench twice a week, deadlift once (plus a variation on 4 days).
export function meetDays(db, ev) {
  const lifts = MEET_FORMATS[ev.format || 'full'][1];
  const has = (l) => lifts.includes(l);
  const n = Math.max(3, Math.min(4, +ev.daysPerWeek || 4));
  const it = (g, id, sets, lo, hi, rest, meet) => (id ? { uid: `mt-${g}-${id}`, exerciseId: id, group: String(g), sets, repMin: lo, repMax: hi, restSec: rest, note: meet ? '' : '', ...(meet ? { meet } : {}) } : null);
  const v = (l) => firstOk(db, VARIATIONS[l]) || MEET_LIFTS[l];
  const acc = (ids, sets = 3, lo = 8, hi = 12) => firstOk(db, ids) && { id: firstOk(db, ids), sets, lo, hi };
  const day = (name, rows) => ({ name, items: rows.filter(Boolean).map((r, i) => (r.meet ? it(i + 1, r.id, 3, 1, 8, r.rest || 240, r.meet) : it(i + 1, r.id, r.sets, r.lo, r.hi, 90))) });
  const comp = (l) => has(l) && { id: MEET_LIFTS[l], meet: { lift: l, kind: 'comp' } };
  const vol = (l) => has(l) && { id: MEET_LIFTS[l], meet: { lift: l, kind: 'vol' } };
  const vari = (l) => has(l) && { id: v(l), meet: { lift: l, kind: 'var' }, rest: 180 };
  const row = acc(['bb-row', 'chest-supported-db-row', 'cable-row']);
  const pull = acc(['lat-pulldown', 'pullup', 'chinup']);
  const ham = acc(['lying-ham-curl', 'seated-ham-curl', 'ghr']);
  const tri = acc(['cable-pushdown', 'skullcrusher', 'db-overhead-ext']);
  const rear = acc(['face-pull', 'rear-delt-fly'], 3, 12, 20);
  const core = acc(['ab-wheel', 'cable-crunch', 'plank'], 3, 8, 15);
  const days = [
    day(has('squat') ? 'Squat and bench' : 'Bench', [comp('squat'), comp('bench'), row, ham, core]),
    day(has('deadlift') ? 'Deadlift and press' : 'Bench variation', [comp('deadlift'), vari('bench'), pull, rear]),
    day(has('squat') ? 'Squat and bench volume' : 'Bench volume', [vari('squat'), vol('bench'), row, tri]),
    day('Pulls and bench', [vari('deadlift'), vari('bench') && { ...vari('bench'), meet: { lift: 'bench', kind: 'vol' }, id: MEET_LIFTS.bench }, pull, tri, core]),
  ];
  return days.slice(0, n).filter((d) => d.items.length);
}

const LIFT_PATTERN = { squat: 'squat', bench: 'horizontal-push', deadlift: 'hinge' };
export function fitMeetIntoPlan(db, ev, plan) {
  const out = JSON.parse(JSON.stringify(plan || {}));
  const changes = [];
  const order = DAY_KEYS.filter((d) => out[d]?.items?.length);
  for (const l of MEET_FORMATS[ev.format || 'full'][1]) {
    const id = MEET_LIFTS[l];
    let hits = order.flatMap((d) => out[d].items.filter((it) => it.exerciseId === id).map((it) => ({ d, it })));
    if (!hits.length) {
      const sub = order.flatMap((d) => out[d].items.filter((it) => db.exercises[it.exerciseId]?.pattern === LIFT_PATTERN[l] && db.exercises[it.exerciseId]?.category === 'compound').map((it) => ({ d, it })))[0];
      if (sub) { changes.push(`${db.exercises[sub.it.exerciseId].name} on ${SHORT_DAY[sub.d]} becomes ${db.exercises[id].name}`); sub.it.exerciseId = id; hits = [sub]; }
      else if (order.length) {
        const d = order[DAY_KEYS.indexOf(order[0]) % order.length];
        out[d].items.unshift({ uid: `${d}-meet-${l}`, exerciseId: id, group: '0', sets: 3, repMin: 1, repMax: 8, restSec: 240 });
        hits = [{ d, it: out[d].items[0] }];
        changes.push(`${db.exercises[id].name} added to ${SHORT_DAY[d]}`);
      }
    }
    hits.forEach(({ it }, k) => { it.meet = { lift: l, kind: k === 0 ? 'comp' : 'vol' }; it.restSec = Math.max(it.restSec || 0, 180); });
    // Same-pattern compounds elsewhere become variations, set from the same max.
    for (const d of order) for (const it of out[d].items) { const e = db.exercises[it.exerciseId]; if (!it.meet && e?.pattern === LIFT_PATTERN[l] && e.category === 'compound' && e.type?.startsWith('barbell')) it.meet = { lift: l, kind: 'var' }; }
    if (hits.length) changes.push(`${db.exercises[id].name}: ${hits.length === 1 ? 'once' : `${hits.length} times`} a week, weights from the meet plan`);
  }
  return { plan: out, changes };
}

// Weights for a meet lift this week, replacing the usual progression.
export function meetOverride(db, item, date = todayStr()) {
  const ev = db.event;
  if (!ev || ev.type !== 'meet' || !item.meet) return null;
  const i = weekIndex(ev, date);
  if (i == null) return null;
  const w = meetWeeks(ev)[i];
  const ex = db.exercises[item.exerciseId];
  const max = ev.current?.[item.meet.lift];
  if (!ex || !max) return null;
  const gym = activeGym(db);
  // On meet day: the three attempts.
  if (w.block === 'meet' && date === ev.date && item.meet.kind === 'comp') {
    const at = attemptsFor(ev.target?.[item.meet.lift] || max, max).map((a) => roundToGym(ex, a.lb, gym));
    return { scheme: 'meet', maxTest: true, weight: at[0], reps: 1, sets: 3, setWeights: at, setReps: [1, 1, 1], rir: null, fixedLadder: true, restSec: 600, aim: 'Meet day: opener, second, third. Take the second only if the opener moved well.' };
  }
  // A variation is a little lighter than the competition lift.
  const scale = item.meet.kind === 'var' ? 0.85 : 1;
  const sets = meetSets(w, item.meet.kind, item.meet.lift);
  if (!sets.length) return { scheme: 'meet', weight: null, reps: 0, sets: 0, setWeights: [], setReps: [], rir: null, fixedLadder: true, skip: true, aim: 'Meet week: rest this one' };
  const setWeights = sets.map(([p]) => roundToGym(ex, max * scale * p, gym));
  const setReps = sets.map(([, r]) => r);
  const label = { volume: 'Volume block', strength: 'Strength block', peak: 'Peak', taper: 'Taper week', meet: 'Meet week' }[w.block];
  return { scheme: 'meet', weight: setWeights[0], reps: setReps[0], sets: sets.length, setWeights, setReps, rir: null, fixedLadder: true,
    aim: `${label}${w.deload ? ' · lighter week' : ''} · ${sets.length} × ${setReps[0]}${setReps.some((r) => r !== setReps[0]) ? ` then ${setReps.at(-1)}s` : ''} at ${Math.round(sets[0][0] * scale * 100)}% of your max` };
}

// A realistic goal: what a lifter at this level usually adds over this many weeks.
export function suggestedGoal(curLb, weeks, experience = 'intermediate') {
  const perWeek = { beginner: 0.01, intermediate: 0.004, advanced: 0.002 }[experience] || 0.004;
  const cap = { beginner: 0.12, intermediate: 0.06, advanced: 0.035 }[experience] || 0.06;
  return Math.round((curLb * (1 + Math.min(cap, perWeek * weeks))) / 5) * 5;
}
// How a goal compares with what is typical.
export function goalCheck(curLb, goalLb, weeks, experience) {
  const sug = suggestedGoal(curLb, weeks, experience);
  const gain = goalLb / curLb - 1;
  if (gain <= 0) return { level: 'easy', text: 'At or below your current max: a good target for a first meet.' };
  if (goalLb <= sug) return { level: 'ok', text: 'Realistic for the time you have.' };
  if (goalLb <= sug + (sug - curLb) * 0.6 + 5) return { level: 'stretch', text: 'Ambitious but possible.' };
  return { level: 'high', text: `More than lifters usually add in ${weeks} weeks. About ${sug} lb is more likely.` };
}

// Race goal check: the predicted time from current fitness, against the goal.
export function raceCheck(ev) {
  if (ev.sport !== 'run' || !ev.vdotNow || !ev.goalSec) return null;
  const m = eventDistance(ev);
  const now = predictSec(ev.vdotNow, m);
  const weeks = planWeeks(ev);
  const gainPct = Math.min(0.08, weeks * 0.006); // VDOT gains of ~0.5–1% a week early on, slowing
  const likely = predictSec(ev.vdotNow * (1 + gainPct), m);
  const level = ev.goalSec >= now ? 'easy' : ev.goalSec >= likely ? 'ok' : ev.goalSec >= likely * 0.97 ? 'stretch' : 'high';
  const text = { easy: 'You could run this now. Consider a faster goal.', ok: 'Realistic with this plan.', stretch: 'Ambitious but possible.', high: `Faster than this many weeks usually allows. About ${fmtDur(likely)} is more likely.` }[level];
  return { now, likely, level, text };
}
