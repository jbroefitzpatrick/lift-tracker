// Web push for Lift: rest-timer alerts while the phone is locked, coach notes, plan suggestions,
// invites and challenges.
//
// Standards, implemented with Web Crypto (no libraries):
// - Message encryption: RFC 8291 (aes128gcm content coding, RFC 8188), keyed to each phone's
//   subscription keys, so push services only relay ciphertext.
// - Server identity: VAPID, RFC 8292 (an ES256-signed JWT). The key pair is set once:
//   VAPID_PUBLIC (var, base64url raw P-256 point) and VAPID_PRIVATE (secret, JWK JSON).
// On iPhone, web push works for the app added to the Home Screen (iOS 16.4+), after the person
// allows notifications.
//
// Rest alerts need a timer that runs while the phone is locked: a Durable Object per account
// holds the pending alert and sends it from an alarm at the exact time.

const enc = new TextEncoder();
const b64u = {
  encode(buf) { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(str) { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// RFC 8291: encrypt one message for a subscription (p256dh and auth from the phone).
export async function encryptPayload(payload, p256dh, authSecret, { salt = crypto.getRandomValues(new Uint8Array(16)), asKeys = null } = {}) {
  const uaPublic = b64u.decode(p256dh);
  const auth = b64u.decode(authSecret);
  const as = asKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // one record, last-record delimiter
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

// RFC 8292: the Authorization header for one push service.
export async function vapidHeader(endpoint, env, now = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const jwk = JSON.parse(env.VAPID_PRIVATE);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o) => b64u.encode(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud, exp: now + 12 * 3600, sub: env.VAPID_SUBJECT || 'https://jbroefitzpatrick.github.io/lift-tracker/' })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${env.VAPID_PUBLIC}`;
}

// Send to every phone of an account that turned notifications on. Subscriptions the push service
// says are gone (404/410) are removed.
export async function pushTo(env, userId, msg) {
  if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC || !env.DB) return 0;
  const subs = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?').bind(userId).all();
  let sent = 0;
  for (const s of subs.results || []) {
    try {
      const body = await encryptPayload(JSON.stringify(msg), s.p256dh, s.auth);
      const res = await fetch(s.endpoint, {
        method: 'POST',
        headers: { Authorization: await vapidHeader(s.endpoint, env), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(msg.ttl || 3600), Urgency: msg.urgent ? 'high' : 'normal', ...(msg.tag ? { Topic: String(msg.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}) },
        body,
      });
      if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run();
      else if (res.ok) sent++;
    } catch { /* one phone failing doesn't stop the others */ }
  }
  return sent;
}

// Routes: /v2/push/key, /subscribe, /unsubscribe, /schedule, /cancel (signed in).
export async function handlePush(path, body, user, env, json) {
  if (path === '/v2/push/key') return json({ key: env.VAPID_PUBLIC || null });
  if (path === '/v2/push/subscribe') {
    const sub = body.subscription || {};
    if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: 'Not a push subscription.' }, 400);
    await env.DB.prepare('INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth')
      .bind(sub.endpoint, user.id, sub.keys.p256dh, sub.keys.auth, Date.now()).run();
    return json({ ok: true });
  }
  if (path === '/v2/push/unsubscribe') {
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').bind(String(body.endpoint || ''), user.id).run();
    return json({ ok: true });
  }
  if (path === '/v2/push/test') {
    const n = await pushTo(env, user.id, { title: 'Notifications are on', body: 'Rest timers, coach notes and challenges will show up here.', tag: 'test' });
    return json({ ok: true, sent: n });
  }
  // Rest alert at a time (ms); a new one replaces the last. Cancel when the app is back on screen.
  if (path === '/v2/push/schedule' || path === '/v2/push/cancel') {
    if (!env.ALERTS) return json({ error: 'Alerts are not set up on this server.' }, 503);
    const stub = env.ALERTS.get(env.ALERTS.idFromName(user.id));
    const res = await stub.fetch('https://alerts/', { method: 'POST', body: JSON.stringify(path.endsWith('cancel') ? { cancel: true } : { userId: user.id, at: Number(body.at) || 0, title: String(body.title || '').slice(0, 80), body: String(body.body || '').slice(0, 200), tag: 'rest' }) });
    return json(await res.json());
  }
  return json({ error: 'Not found.' }, 404);
}

// One per account: the pending rest alert, sent by an alarm at its time.
export class RestAlerts {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(req) {
    const b = await req.json();
    if (b.cancel) { await this.state.storage.deleteAlarm(); await this.state.storage.delete('alert'); return Response.json({ ok: true }); }
    const at = Math.max(Date.now() + 1000, Math.min(b.at, Date.now() + 30 * 60000)); // within 30 minutes
    await this.state.storage.put('alert', { userId: b.userId, title: b.title, body: b.body, tag: b.tag });
    await this.state.storage.setAlarm(at);
    return Response.json({ ok: true, at });
  }
  async alarm() {
    const a = await this.state.storage.get('alert');
    if (!a) return;
    await this.state.storage.delete('alert');
    await pushTo(this.env, a.userId, { title: a.title || 'Rest is over', body: a.body || 'Time for the next set.', tag: a.tag || 'rest', urgent: true, ttl: 120, url: './' });
  }
}

// Hourly: challenges that ended get one notification each for both people.
export async function finishedContests(env, now = Date.now()) {
  if (!env.DB) return;
  const today = new Date(now).toISOString().slice(0, 10);
  const r = await env.DB.prepare("SELECT c.*, ua.name AS a_name, ub.name AS b_name FROM contests c JOIN users ua ON ua.id = c.a JOIN users ub ON ub.id = c.b WHERE c.status = 'active' AND c.start IS NOT NULL AND c.id NOT IN (SELECT id FROM contest_done)").all();
  for (const c of r.results || []) {
    const end = new Date(Date.parse(`${c.start}T12:00:00Z`) + (c.days - 1) * 86400000).toISOString().slice(0, 10);
    if (end >= today) continue;
    await env.DB.prepare('INSERT OR IGNORE INTO contest_done (id, done) VALUES (?, ?)').bind(c.id, now).run();
    const what = { workouts: 'Most workouts', minutes: 'Most minutes', miles: 'Most miles run', volume: 'Most weight lifted' }[c.kind] || `Biggest gain on ${c.ex_name || 'a lift'}`;
    await pushTo(env, c.a, { title: `Challenge over: ${what}`, body: `See how you did against ${c.b_name}.`, tag: `contest-${c.id}`, url: './?open=people' });
    await pushTo(env, c.b, { title: `Challenge over: ${what}`, body: `See how you did against ${c.a_name}.`, tag: `contest-${c.id}`, url: './?open=people' });
  }
  // Group challenges that ended: everyone who joined hears who won.
  const g = await env.DB.prepare("SELECT * FROM contests WHERE status = 'active' AND b = 'group' AND start IS NOT NULL AND id NOT IN (SELECT id FROM contest_done)").all();
  for (const c of g.results || []) {
    const end = new Date(Date.parse(`${c.start}T12:00:00Z`) + (c.days - 1) * 86400000).toISOString().slice(0, 10);
    if (end >= today) continue;
    await env.DB.prepare('INSERT OR IGNORE INTO contest_done (id, done) VALUES (?, ?)').bind(c.id, now).run();
    const ranked = await standings(env, c);
    const what = CONTEST_WORDS[c.kind] || 'Challenge';
    for (const m of ranked) await pushTo(env, m.id, { title: `Challenge over: ${what}`, body: ranked[0]?.value > 0 ? (ranked[0].id === m.id ? 'You won. Nicely done.' : `${ranked[0].name} won. You finished ${ordinal(ranked.indexOf(m) + 1)}.`) : 'See how everyone did.', tag: `contest-${c.id}`, url: './?open=people' });
  }
  // A day before any challenge ends: where you stand.
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  const act = await env.DB.prepare("SELECT * FROM contests WHERE status = 'active' AND start IS NOT NULL AND id NOT IN (SELECT id FROM contest_remind)").all();
  for (const c of act.results || []) {
    const end = new Date(Date.parse(`${c.start}T12:00:00Z`) + (c.days - 1) * 86400000).toISOString().slice(0, 10);
    if (end !== tomorrow) continue;
    await env.DB.prepare('INSERT OR IGNORE INTO contest_remind (id, done) VALUES (?, ?)').bind(c.id, now).run();
    const ranked = await standings(env, c);
    const what = CONTEST_WORDS[c.kind] || 'your challenge';
    for (const m of ranked) {
      const place = ranked.indexOf(m);
      const body = !ranked.some((r) => r.value > 0) ? 'One day left. A workout today could decide it.' : place === 0 ? 'One day left and you\'re in front. Hold it.' : `One day left. You're ${ordinal(place + 1)}, behind ${ranked[0].name}.`;
      await pushTo(env, m.id, { title: `${what}: last day tomorrow`, body, tag: `contest-${c.id}-remind`, url: './?open=people' });
    }
  }
}
const CONTEST_WORDS = { workouts: 'Most workouts', minutes: 'Most minutes', miles: 'Most miles run', volume: 'Most weight lifted', sets: 'Most hard sets', days: 'Most active days', cardio: 'Most cardio minutes', lift: 'Strength gain' };
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
// Everyone in a challenge, best score first (scores each phone reported).
async function standings(env, c) {
  const people = c.b === 'group'
    ? ((await env.DB.prepare("SELECT m.user_id AS id, u.name FROM contest_members m JOIN users u ON u.id = m.user_id WHERE m.contest_id = ? AND m.status = 'in'").bind(c.id).all()).results || [])
    : ((await env.DB.prepare('SELECT id, name FROM users WHERE id IN (?, ?)').bind(c.a, c.b).all()).results || []);
  const sc = (await env.DB.prepare('SELECT user_id, value FROM contest_scores WHERE contest_id = ?').bind(c.id).all()).results || [];
  return people.map((p) => ({ ...p, value: sc.find((s) => s.user_id === p.id)?.value ?? 0 })).sort((a, b) => b.value - a.value);
}
