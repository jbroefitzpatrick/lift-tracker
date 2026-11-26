// Pooled tuning records (see docs/TUNING.md in the app): small facts from finished workouts that
// tune defaults for everyone. Same opt-out and same privacy as calib.js: stored under a one-way
// code (no names), removed on opt-out or account deletion, and only aggregates come back out.

import { whoOf } from './calib.js';

const MAX_PER_PERSON = 3000;
const now = () => Date.now();
const num = (v, lo, hi) => (v === null || v === undefined || v === '' ? null : Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : undefined);
const label = (v) => (v == null ? null : /^[\w-]{1,30}$/.test(String(v)) ? String(v) : undefined);
const id = (v) => (/^[\w-]{1,60}$/.test(String(v || '')) ? String(v) : null);

// Each kind: its fields and how to check them. A field that fails makes the record invalid.
const KINDS = {
  start: { guess: [1, 2000], used: [1, 2000], reps: [1, 50], rir: [0, 10, true], pattern: 'label', type: 'label', exp: 'label', sex: 'label', ageBand: [10, 90, true] },
  prog: { inc: [0.1, 200], pct: [0.1, 100], hit: [0, 1], repMin: [1, 50], repMax: [1, 50], sets: [1, 20], type: 'label', exp: 'label' },
  session: { planMin: [1, 400], actualMin: [5, 240], planSets: [0, 200], doneSets: [0, 200], exercises: [1, 60], deload: [0, 1], exp: 'label' },
  rir: { logged: [0, 10], implied: [-5, 30], reps: [1, 12], load: [30, 110] },
  skip: { planned: [1, 60], skipped: 'ids', swapped: 'pairs' },
  trend: { lift: 'label', change: [-60, 100], weeklySets: [0, 100], deload: [0, 1], exp: 'label', sex: 'label' },
};

function clean(r) {
  const spec = KINDS[r?.kind];
  const rid = String(r?.id || '');
  if (!spec || !/^[\w-]{4,40}$/.test(rid)) return null;
  const v = r.v || {};
  const out = {};
  for (const [k, rule] of Object.entries(spec)) {
    let val;
    if (rule === 'label') val = label(v[k]);
    else if (rule === 'ids') val = Array.isArray(v[k]) ? v[k].slice(0, 10).map(id).filter(Boolean) : [];
    else if (rule === 'pairs') val = Array.isArray(v[k]) ? v[k].slice(0, 10).filter((p) => Array.isArray(p) && id(p[0]) && id(p[1])).map((p) => [id(p[0]), id(p[1])]) : [];
    else { val = num(v[k], rule[0], rule[1]); if (val === null && !rule[2]) val = undefined; }
    if (val === undefined) return null;
    out[k] = val;
  }
  if (r.kind === 'start' && (out.used / out.guess > 4 || out.used / out.guess < 0.2)) return null; // a typo, not a guess check
  return { id: rid, kind: r.kind, ex: r.ex ? id(r.ex) : null, month: /^\d{4}-\d{2}$/.test(r.month || '') ? r.month : null, data: out };
}

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const bucket = (v, cuts) => { for (const [lim, name] of cuts) if (v < lim) return name; return cuts[cuts.length - 1][1]; };

// Aggregates only, and only for groups with at least 5 records.
export function summarize(rows) {
  const by = {};
  const add = (kind, key, val) => { ((by[kind] ||= {})[key] ||= []).push(val); };
  for (const row of rows) {
    const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    if (row.kind === 'start') { add('start', `${d.type || 'other'} · ${d.pattern || 'other'}`, d.used / d.guess); add('start', `all · ${d.exp || 'unknown'}`, d.used / d.guess); }
    if (row.kind === 'prog') { add('prog', `${d.type || 'other'} · ${bucket(d.pct, [[2.5, 'under 2.5%'], [5, '2.5–5%'], [10, '5–10%'], [Infinity, '10%+']])}`, d.hit); add('prog', `reps ${bucket(d.repMin, [[6, '1–5'], [9, '6–8'], [13, '9–12'], [Infinity, '13+']])}`, d.hit); }
    if (row.kind === 'session') { add('session', `planned ${bucket(d.planMin, [[30, 'under 30'], [45, '30–44'], [60, '45–59'], [75, '60–74'], [Infinity, '75+']])} min`, d.actualMin / d.planMin); add('session', 'sets done of planned', d.planSets ? d.doneSets / d.planSets : 1); }
    if (row.kind === 'rir') add('rir', `load ${bucket(d.load, [[65, 'under 65%'], [75, '65–74%'], [85, '75–84%'], [Infinity, '85%+']])}`, d.implied - d.logged);
    if (row.kind === 'skip') { for (const x of d.skipped || []) add('skipped', x, 1); for (const [a, b] of d.swapped || []) add('swapped', `${a} → ${b}`, 1); add('skip', 'share of planned skipped', (d.skipped || []).length / d.planned); }
    if (row.kind === 'trend') { add('trend', `${d.lift} · deload ${d.deload ? 'yes' : 'no'}`, d.change); add('trend', `${d.lift} · ${bucket(d.weeklySets, [[6, 'under 6'], [10, '6–9'], [15, '10–14'], [20, '15–19'], [Infinity, '20+']])} sets a week · ${d.exp || 'unknown'}`, d.change); }
  }
  const out = {};
  for (const [kind, groups] of Object.entries(by)) {
    for (const [key, vals] of Object.entries(groups)) {
      if (vals.length < 5) continue;
      const o = (out[kind] ||= {});
      if (kind === 'start' || kind === 'session') o[key] = { n: vals.length, medianRatio: r1(median(vals) * 100) / 100 };
      else if (kind === 'prog') o[key] = { n: vals.length, hitRate: r1(mean(vals) * 100) };
      else if (kind === 'rir') o[key] = { n: vals.length, medianUnderestimate: r1(median(vals)) };
      else if (kind === 'skipped' || kind === 'swapped') o[key] = { n: vals.length };
      else if (kind === 'skip') o[key] = { n: vals.length, mean: r1(mean(vals) * 100) };
      else if (kind === 'trend') o[key] = { n: vals.length, medianChangePct: r1(median(vals)) };
    }
  }
  return out;
}

export async function handleTune(path, body, user, env, json) {
  const who = await whoOf(user.id);
  if (path === '/v2/tune') {
    const list = (Array.isArray(body.records) ? body.records : []).slice(0, 100).map(clean).filter(Boolean);
    if (!list.length) return json({ ok: true, saved: 0 });
    const have = await env.DB.prepare('SELECT COUNT(*) AS n FROM tune WHERE who = ?').bind(who).first();
    const room = Math.max(0, MAX_PER_PERSON - (have?.n || 0));
    const stmts = list.slice(0, room).map((r) => env.DB.prepare('INSERT OR IGNORE INTO tune (id, who, kind, ex, data, month, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(`${who.slice(0, 16)}:${r.id}`, who, r.kind, r.ex, JSON.stringify(r.data), r.month, now()));
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, saved: stmts.length });
  }
  if (path === '/v2/tune/forget') {
    await env.DB.prepare('DELETE FROM tune WHERE who = ?').bind(who).run();
    return json({ ok: true });
  }
  if (path === '/v2/tune/summary') {
    const rows = await env.DB.prepare('SELECT kind, data FROM tune ORDER BY created DESC LIMIT 50000').all();
    const people = await env.DB.prepare('SELECT COUNT(DISTINCT who) AS n FROM tune').first();
    return json({ ok: true, people: people?.n || 0, records: rows.results?.length || 0, groups: summarize(rows.results || []) });
  }
  return json({ error: 'Not found.' }, 404);
}
