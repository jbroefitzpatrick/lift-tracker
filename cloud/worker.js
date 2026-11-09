// Lift Tracker cloud backup — a Cloudflare Worker that stores encrypted backups in Workers KV.
//
// The app encrypts every backup on the phone before upload (AES-256-GCM, key from the user's
// recovery code), so this server only ever holds unreadable blobs. It can't see workouts, food
// or anything else, and it never sees the recovery code itself — only a SHA-256 hash of it,
// used as the storage key.
//
// API (every request needs the X-Access-Key header matching the ACCESS_KEY secret):
//   PUT /v1/backups/:id              store a backup (body: encrypted JSON from the app)
//   GET /v1/backups/:id              list stored versions: latest + one per day for KEEP_DAYS
//   GET /v1/backups/:id/latest       download the newest backup
//   GET /v1/backups/:id/YYYY-MM-DD   download that day's last backup
// :id is 64 hex characters (SHA-256 of the recovery code).
//
// Free plan budget: KV allows 1,000 writes a day. Each upload is 2 writes, so a few testers
// backing up a few times a day use well under 5% of it.

const MAX_BYTES = 10 * 1024 * 1024; // backups without photos are far smaller than this
const KEEP_DAYS = 60;

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.ACCESS_KEY) return json({ error: 'Server is missing its ACCESS_KEY secret.' }, 500);
    if (!safeEqual(req.headers.get('X-Access-Key') || '', env.ACCESS_KEY)) return json({ error: 'Wrong access key.' }, 401);

    const m = new URL(req.url).pathname.match(/^\/v1\/backups\/([0-9a-f]{64})(?:\/(latest|\d{4}-\d{2}-\d{2}))?$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    const [, id, which] = m;

    if (req.method === 'PUT' && !which) {
      const declared = Number(req.headers.get('Content-Length') || 0);
      if (declared > MAX_BYTES) return json({ error: 'Backup is too large.' }, 413);
      const body = await req.text();
      if (body.length > MAX_BYTES) return json({ error: 'Backup is too large.' }, 413);
      let parsed;
      try { parsed = JSON.parse(body); } catch { return json({ error: 'Backup must be JSON.' }, 400); }
      // Only accept encrypted backups, so plain data can never end up on the server by mistake.
      if (!parsed || parsed.app !== 'lift-tracker' || parsed.encrypted !== true || typeof parsed.data !== 'string') {
        return json({ error: 'Only encrypted Lift Tracker backups are accepted.' }, 400);
      }
      const savedAt = Date.now();
      const day = new Date(savedAt).toISOString().slice(0, 10);
      const metadata = { savedAt, size: body.length };
      await env.BACKUPS.put(`${id}:latest`, body, { metadata });
      await env.BACKUPS.put(`${id}:day:${day}`, body, { metadata, expirationTtl: KEEP_DAYS * 86400 });
      return json({ ok: true, savedAt, day });
    }

    if (req.method === 'GET' && !which) {
      const out = [];
      let cursor;
      do {
        const page = await env.BACKUPS.list({ prefix: `${id}:`, cursor });
        for (const k of page.keys) {
          const name = k.name.slice(id.length + 1);
          out.push({ version: name === 'latest' ? 'latest' : name.replace('day:', ''), ...(k.metadata || {}) });
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      return json({ versions: out });
    }

    if (req.method === 'GET' && which) {
      const key = which === 'latest' ? `${id}:latest` : `${id}:day:${which}`;
      const body = await env.BACKUPS.get(key);
      if (body == null) return json({ error: 'No backup found.' }, 404);
      return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }

    return json({ error: 'Method not allowed.' }, 405);
  },
};

// Only the app's own site may call this from a browser (ALLOWED_ORIGINS, comma-separated).
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || 'null'),
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// Constant-time comparison, so response timing doesn't leak how much of the key was right.
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
