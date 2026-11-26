// Pooled accuracy checks for the estimated one-rep max (see docs/ESTIMATES.md in the app).
//
// Each check is one tested max and what the app predicted just before it. Signed-in phones send
// them unless the person turned it off (Settings → Help improve max estimates). Stored without
// names: "who" is a one-way hash of the account id, so rows can be removed on opt-out or account
// deletion but aren't tied to a name. Only aggregates ever come back out.

const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const whoOf = async (userId) => hex(await crypto.subtle.digest('SHA-256', enc.encode(`calib:${userId}`)));
const now = () => Date.now();
const MAX_PER_PERSON = 500;

const num = (v, lo, hi) => (Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : null);
function clean(k) {
  const id = String(k.id || '').slice(0, 40);
  const ex = String(k.ex || '').slice(0, 60);
  const pred = num(k.pred, 1, 2000); const actual = num(k.actual, 1, 2000);
  const method = num(k.method, 1, 999);
  if (!/^[\w-]{4,40}$/.test(id) || !/^[\w -]{1,60}$/.test(ex) || !pred || !actual || !method) return null;
  if (actual / pred > 2 || actual / pred < 0.5) return null; // a typo, not a check
  return {
    id, ex, pred, actual, method,
    srcReps: num(k.srcReps, 1, 30), srcRir: num(k.srcRir, 0, 10), gapDays: num(k.gapDays, 0, 3650),
    month: /^\d{4}-\d{2}$/.test(k.month || '') ? k.month : null,
  };
}

export async function handleCalib(path, body, user, env, json) {
  const who = await whoOf(user.id);
  if (path === '/v2/calib') {
    const list = (Array.isArray(body.checks) ? body.checks : []).slice(0, 50).map(clean).filter(Boolean);
    if (!list.length) return json({ ok: true, saved: 0 });
    const have = await env.DB.prepare('SELECT COUNT(*) AS n FROM calib WHERE who = ?').bind(who).first();
    const room = Math.max(0, MAX_PER_PERSON - (have?.n || 0));
    const sex = ['male', 'female'].includes(body.sex) ? body.sex : null;
    const ageBand = num(body.ageBand, 10, 90);
    const stmts = list.slice(0, room).map((k) => env.DB.prepare(
      'INSERT OR IGNORE INTO calib (id, who, ex, pred, actual, method, src_reps, src_rir, gap_days, sex, age_band, month, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(`${who.slice(0, 16)}:${k.id}`, who, k.ex, k.pred, k.actual, k.method, k.srcReps, k.srcRir, k.gapDays, sex, ageBand, k.month, now()));
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, saved: stmts.length });
  }
  // Turned off in Settings: everything this person sent is removed.
  if (path === '/v2/calib/forget') {
    await env.DB.batch([env.DB.prepare('DELETE FROM calib WHERE who = ?').bind(who), env.DB.prepare('DELETE FROM tune WHERE who = ?').bind(who)]);
    return json({ ok: true });
  }
  // Aggregates only: how far off the estimate runs, by method and by the reps it came from.
  if (path === '/v2/calib/summary') {
    const rows = await env.DB.prepare('SELECT method, src_reps, pred, actual FROM calib ORDER BY created DESC LIMIT 20000').all();
    const groups = {};
    const add = (key, r) => { (groups[key] ||= []).push(r.actual / r.pred); };
    for (const r of rows.results || []) {
      add(`method ${r.method}`, r);
      const reps = r.src_reps == null ? 'unknown' : r.src_reps <= 1 ? '1' : r.src_reps <= 3 ? '2-3' : r.src_reps <= 6 ? '4-6' : '7-10+';
      add(`method ${r.method} · from ${reps} reps`, r);
    }
    const people = await env.DB.prepare('SELECT COUNT(DISTINCT who) AS n FROM calib').first();
    const out = {};
    for (const [k, v] of Object.entries(groups)) {
      if (v.length < 5) continue; // too few to report
      v.sort((a, b) => a - b);
      out[k] = { n: v.length, bias: +((v[Math.floor(v.length / 2)] - 1) * 100).toFixed(1), meanAbsErr: +((v.reduce((a, x) => a + Math.abs(1 - 1 / x), 0) / v.length) * 100).toFixed(1) };
    }
    return json({ ok: true, people: people?.n || 0, checks: rows.results?.length || 0, groups: out });
  }
  return json({ error: 'Not found.' }, 404);
}
