// Import runs, rides and swims from other apps, so race plans see what you did and paces stay current.
//
// Strava: Settings → My Account → Download or Delete Your Account → Request an archive. In the zip,
//   activities.csv (Activity Date, Activity Name, Activity Type, Elapsed Time, Moving Time, Distance,
//   Average Heart Rate…). Strava repeats some columns; the later Distance is in meters.
// Garmin Connect: Activities list → Export CSV. Columns: Activity Type, Date, Title, Distance, Time,
//   Avg HR. Distances are in the account's units, which the file doesn't say, so it's asked.
// Runkeeper: Account → Export data. cardioActivities.csv: Date, Type, Distance (mi|km), Duration,
//   Average Heart Rate (bpm).
// Apple Health: Health app → profile → Export All Health Data, unzip, then export.xml. Its Workout
//   records carry the activity type, duration and distance (this also covers Nike Run Club, Peloton
//   and anything else that saves workouts to Health).
// GPX and TCX: single activities from Coros, Polar, Suunto, Wahoo, Zwift and most watches and apps.
//
// Imported activities become cardio log entries (run, ride or swim), marked with their source so the
// same file can be imported twice without duplicates.

import { parseCsv } from './import-apps.js';
import { vdotOf } from './event-plan.js';

const MI = 1609.34;
const SPORT_OF = [
  [/trail|treadmill|track|run|jog/i, 'run'], [/virtual ?ride|e-?bike|gravel|mountain|indoor cycl|spin|cycl|bik|ride/i, 'bike'],
  [/swim|pool|open water/i, 'swim'], [/hike|walk/i, 'walk'], [/row/i, 'row'],
];
export const sportOf = (type) => (SPORT_OF.find(([re]) => re.test(type || '')) || [null, null])[1];
const CARDIO_ID = { run: 'zone2-run', bike: 'zone2-bike', swim: 'easy-swim', walk: 'easy-walk', row: 'zone2-row' };

const iso = (d) => (Number.isFinite(d?.getTime?.()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
// "1:05:12", "45:12" or seconds.
function seconds(v) {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (s.includes(':')) { const p = s.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  return parseFloat(s.replace(/,/g, '')) || 0;
}
const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

// ---------- Recognising a file ----------
export function detectActivities(name, text) {
  const head = text.slice(0, 4000);
  if (/<TrainingCenterDatabase/i.test(head)) return 'tcx';
  if (/<gpx[\s>]/i.test(head)) return 'gpx';
  if (/<HealthData|<!DOCTYPE HealthData|<Workout /i.test(head) || /export\.xml$/i.test(name)) return 'health';
  const first = (head.split(/\r?\n/, 1)[0] || '').toLowerCase();
  if (first.includes('activity id') && first.includes('activity type') && first.includes('elapsed time')) return 'strava';
  if (first.includes('activity type') && first.includes('title') && /(^|,)\s*"?time"?\s*(,|$)/.test(first)) return 'garmin';
  if (first.includes('type') && first.includes('duration') && /distance \((mi|km)\)/.test(first)) return 'runkeeper';
  return null;
}
export const ACTIVITY_SOURCES = { strava: 'Strava', garmin: 'Garmin Connect', runkeeper: 'Runkeeper', health: 'Apple Health', gpx: 'GPX file', tcx: 'TCX file' };

// ---------- Reading ----------
// Each activity: { date, ts, sport, sec, distM, hr, name, source, extId }
export function readActivities(format, text, opts = {}) {
  if (format === 'strava') {
    return parseCsv(text).map((r) => {
      const d = new Date(r['activity date']);
      const sec = num(r['moving time']) || num(r['elapsed time']);
      const raw = num(r.distance);
      return { date: iso(d), ts: d.getTime(), sport: sportOf(r['activity type']), sec, distM: raw > 300 || sportOf(r['activity type']) === 'swim' ? raw : raw * 1000, hr: num(r['average heart rate']) || null, name: r['activity name'], source: 'strava', extId: r['activity id'] };
    });
  }
  if (format === 'garmin') {
    const unit = opts.unit === 'km' ? 1000 : MI;
    return parseCsv(text).map((r) => {
      const d = new Date(String(r.date).replace(' ', 'T'));
      const sport = sportOf(r['activity type']);
      const dist = num(r.distance);
      // Garmin gives pool swims in meters or yards.
      const distM = sport === 'swim' ? (dist > 50 ? dist * (opts.unit === 'km' ? 1 : 0.9144) : dist * unit) : dist * unit;
      return { date: iso(d), ts: d.getTime(), sport, sec: seconds(r.time), distM, hr: num(r['avg hr']) || null, name: r.title, source: 'garmin', extId: `${r.date}|${r.title}` };
    });
  }
  if (format === 'runkeeper') {
    return parseCsv(text).map((r) => {
      const d = new Date(String(r.date).replace(' ', 'T'));
      const km = 'distance (km)' in r;
      return { date: iso(d), ts: d.getTime(), sport: sportOf(r.type), sec: seconds(r.duration), distM: num(km ? r['distance (km)'] : r['distance (mi)']) * (km ? 1000 : MI), hr: num(r['average heart rate (bpm)']) || null, name: r['route name'] || r.type, source: 'runkeeper', extId: r['activity id'] || r.date };
    });
  }
  if (format === 'health') {
    const out = [];
    const re = /<Workout\s([^>]*?)\/?>/g;
    let m;
    while ((m = re.exec(text))) {
      const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
      const type = (a.workoutActivityType || '').replace('HKWorkoutActivityType', '');
      const d = new Date(String(a.startDate || '').replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));
      const dur = num(a.duration) * ({ min: 60, s: 1, sec: 1, hr: 3600, h: 3600 }[a.durationUnit] || 60);
      const dist = num(a.totalDistance) * ({ mi: MI, km: 1000, m: 1, yd: 0.9144 }[a.totalDistanceUnit] || 1);
      out.push({ date: iso(d), ts: d.getTime(), sport: sportOf(type.replace(/([a-z])([A-Z])/g, '$1 $2')), sec: dur, distM: dist, hr: null, name: type.replace(/([a-z])([A-Z])/g, '$1 $2'), source: 'health', extId: `${a.startDate}|${type}` });
    }
    return out;
  }
  if (format === 'tcx') {
    const sport = sportOf(/<Activity\s+Sport="([^"]+)"/i.exec(text)?.[1]);
    const sec = [...text.matchAll(/<TotalTimeSeconds>([\d.]+)</gi)].reduce((a, x) => a + num(x[1]), 0);
    const laps = [...text.matchAll(/<Lap[^>]*>[\s\S]*?<DistanceMeters>([\d.]+)</gi)].reduce((a, x) => a + num(x[1]), 0);
    const id = /<Id>([^<]+)</i.exec(text)?.[1];
    const d = new Date(id || /<Lap\s+StartTime="([^"]+)"/i.exec(text)?.[1]);
    const hrs = [...text.matchAll(/<AverageHeartRateBpm>\s*<Value>(\d+)</gi)].map((x) => num(x[1]));
    return [{ date: iso(d), ts: d.getTime(), sport, sec, distM: laps, hr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b) / hrs.length) : null, name: opts.name || 'Activity', source: 'tcx', extId: id || opts.name }];
  }
  if (format === 'gpx') {
    const pts = [...text.matchAll(/<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>[\s\S]*?<time>([^<]+)</gi)].map((x) => ({ lat: +x[1], lon: +x[2], t: Date.parse(x[3]) }));
    if (pts.length < 2) return [];
    let distM = 0;
    const R = 6371000; const rad = (x) => (x * Math.PI) / 180;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]; const b = pts[i];
      const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
      distM += 2 * R * Math.asin(Math.sqrt(h));
    }
    const type = /<type>([^<]+)</i.exec(text)?.[1] || /<name>([^<]+)</i.exec(text)?.[1] || '';
    const d = new Date(pts[0].t);
    const speed = distM / ((pts.at(-1).t - pts[0].t) / 1000);
    // No type in the file: guess from speed (over about 4.5 m/s is almost always a ride).
    const sport = sportOf(type) || (speed > 4.5 ? 'bike' : 'run');
    return [{ date: iso(d), ts: d.getTime(), sport, sec: (pts.at(-1).t - pts[0].t) / 1000, distM, hr: null, name: /<name>([^<]+)</i.exec(text)?.[1] || opts.name || 'Activity', source: 'gpx', extId: `${pts[0].t}` }];
  }
  return [];
}

// ---------- Into the log ----------
// What would be added, what's already there, and the best recent running effort.
export function planActivities(db, list) {
  const seen = new Set((db.cardio || []).map((c) => c.extId && `${c.source}|${c.extId}`).filter(Boolean));
  const near = (a) => (db.cardio || []).some((c) => c.date === a.date && Math.abs((+c.minutes || 0) - a.sec / 60) < 2 && sportOf(c.cardioId) === a.sport);
  const valid = list.filter((a) => a.date && a.sport && a.sec >= 60);
  const fresh = valid.filter((a) => !seen.has(`${a.source}|${a.extId}`) && !near(a));
  const counts = {};
  for (const a of fresh) counts[a.sport] = (counts[a.sport] || 0) + 1;
  // Best running effort in the last 8 weeks, as VDOT (runs of 3 km to a marathon, sensible paces).
  const since = new Date(Date.now() - 56 * 864e5).toISOString().slice(0, 10);
  let best = null;
  for (const a of valid) {
    if (a.sport !== 'run' || a.date < since || a.distM < 3000 || a.distM > 43000) continue;
    const pace = a.sec / (a.distM / 1000);
    if (pace < 150 || pace > 600) continue;
    const v = vdotOf(a.distM, a.sec);
    if (!best || v > best.vdot) best = { ...a, vdot: v };
  }
  const dates = fresh.map((a) => a.date).sort();
  return { fresh, skipped: valid.length - fresh.length, ignored: list.length - valid.length, counts, from: dates[0], to: dates.at(-1), best };
}

export function applyActivities(db, fresh) {
  db.cardio ||= [];
  for (const a of fresh) {
    const entry = { id: `i${a.ts || Date.now()}${Math.random().toString(36).slice(2, 6)}`, date: a.date, ts: a.ts || Date.now(), cardioId: CARDIO_ID[a.sport] || 'zone2-run', minutes: Math.max(1, Math.round(a.sec / 60)), source: a.source, extId: a.extId };
    if (a.distM > 0 && a.sport !== 'swim') entry.distance = Math.round((a.distM / MI) * 100) / 100;
    if (a.sport === 'swim' && a.distM > 0) entry.distM = Math.round(a.distM);
    if (a.hr >= 60 && a.hr <= 220) entry.hr = Math.round(a.hr);
    if (a.name) entry.note = String(a.name).slice(0, 80);
    db.cardio.push(entry);
  }
  db.cardio.sort((x, y) => x.date.localeCompare(y.date) || (x.ts || 0) - (y.ts || 0));
  return fresh.length;
}
