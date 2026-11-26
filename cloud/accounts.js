// Accounts and sync for Lift Tracker (step 1 and 2 of the trainer/friends plan).
//
// Sign-in: passkeys (WebAuthn; Face ID on iPhone), verified here with Web Crypto. A recovery code
// (generated on the phone, stored here only as a hash) signs in where the passkey isn't available.
// Each sign-in gets a random session token; only its SHA-256 hash is stored.
//
// Sync: the app splits its data into small documents (one per workout, food entry, plan day,
// exercise, setting…). Each document has the time it was last changed on a phone (ts). The server
// keeps the newest version of each, numbered by a per-account counter (ver), so a phone asks for
// "everything after version N" and sends only what changed. Same document changed on two phones:
// the later change wins.
//
// Storage: Cloudflare D1 (SQLite), binding DB. Tables in schema.sql.

import { handleSocial } from './social.js';
import { handleCalib, whoOf } from './calib.js';
import { handleTune } from './tune.js';
import { handlePush } from './push.js';
import { handleMedia, deleteMedia } from './media.js';

const enc = new TextEncoder();
const b64u = {
  encode(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(str) { const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};
const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomB64u = (n) => b64u.encode(crypto.getRandomValues(new Uint8Array(n)));
const now = () => Date.now();

// ---------- Minimal CBOR decoding (enough for WebAuthn attestation objects and COSE keys) ----------
function cbor(buf) {
  let p = 0;
  const u = () => {
    const ib = buf[p++]; const mt = ib >> 5; const ai = ib & 31;
    let len = ai;
    if (ai === 24) len = buf[p++];
    else if (ai === 25) { len = (buf[p] << 8) | buf[p + 1]; p += 2; }
    else if (ai === 26) { len = ((buf[p] << 24) >>> 0) + (buf[p + 1] << 16) + (buf[p + 2] << 8) + buf[p + 3]; p += 4; }
    else if (ai > 26 && mt !== 7) throw new Error('Unsupported CBOR');
    if (mt === 0) return len;
    if (mt === 1) return -1 - len;
    if (mt === 2) { const v = buf.slice(p, p + len); p += len; return v; }
    if (mt === 3) { const v = new TextDecoder().decode(buf.slice(p, p + len)); p += len; return v; }
    if (mt === 4) { const a = []; for (let i = 0; i < len; i++) a.push(u()); return a; }
    if (mt === 5) { const m = new Map(); for (let i = 0; i < len; i++) { const k = u(); m.set(k, u()); } return m; }
    if (mt === 7) return ai === 20 ? false : ai === 21 ? true : null;
    throw new Error('Unsupported CBOR');
  };
  const v = u();
  return { value: v, end: p };
}

function parseAuthData(ad) {
  const out = { rpIdHash: ad.slice(0, 32), flags: ad[32], signCount: ((ad[33] << 24) >>> 0) + (ad[34] << 16) + (ad[35] << 8) + ad[36] };
  if (out.flags & 0x40) { // attested credential data
    const credLen = (ad[53] << 8) | ad[54];
    out.credId = ad.slice(55, 55 + credLen);
    out.cose = cbor(ad.slice(55 + credLen)).value;
  }
  return out;
}

// COSE public key → JWK + algorithm (ES256 or RS256).
function coseToJwk(cose) {
  const alg = cose.get(3);
  if (cose.get(1) === 2 && alg === -7) return { alg, jwk: { kty: 'EC', crv: 'P-256', x: b64u.encode(cose.get(-2)), y: b64u.encode(cose.get(-3)), ext: true } };
  if (cose.get(1) === 3 && alg === -257) return { alg, jwk: { kty: 'RSA', n: b64u.encode(cose.get(-1)), e: b64u.encode(cose.get(-2)), alg: 'RS256', ext: true } };
  throw new Error('Unsupported passkey type.');
}

// ECDSA signatures arrive DER-encoded; Web Crypto wants raw r||s.
function derToRaw(der) {
  let p = 2; if (der[1] & 0x80) p += der[1] & 0x7f;
  const read = () => { p++; const len = der[p++]; let v = der.slice(p, p + len); p += len; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  const r = read(); const s = read();
  const raw = new Uint8Array(64); raw.set(r, 0); raw.set(s, 32); return raw;
}

async function verifySignature(alg, jwk, data, sig) {
  if (alg === -7) {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig), data);
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
}

function checkClientData(clientDataJSON, type, challenge, origins) {
  const cd = JSON.parse(new TextDecoder().decode(clientDataJSON));
  if (cd.type !== type) throw new Error('Wrong passkey request type.');
  if (cd.challenge !== challenge) throw new Error('Passkey challenge did not match.');
  if (!origins.includes(cd.origin)) throw new Error('Passkey came from an unexpected site.');
  return cd;
}

// ---------- Sessions ----------
async function newSession(env, userId) {
  const token = randomB64u(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created, last_used) VALUES (?, ?, ?, ?)').bind(hex(await sha256(token)), userId, now(), now()).run();
  return token;
}
async function authUser(req, env) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const row = await env.DB.prepare('SELECT s.user_id AS id, u.name AS name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').bind(hex(await sha256(m[1]))).first();
  return row || null;
}

async function newChallenge(env, fields) {
  const id = randomB64u(12);
  const challenge = randomB64u(32);
  await env.DB.prepare('DELETE FROM challenges WHERE created < ?').bind(now() - 10 * 60000).run();
  await env.DB.prepare('INSERT INTO challenges (id, challenge, user_id, name, rp_id, created) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, challenge, fields.userId || null, fields.name || null, fields.rpId, now()).run();
  return { id, challenge };
}
async function takeChallenge(env, id) {
  const row = await env.DB.prepare('SELECT * FROM challenges WHERE id = ? AND created > ?').bind(String(id || ''), now() - 10 * 60000).first();
  if (!row) throw new Error('That sign-in request expired. Try again.');
  await env.DB.prepare('DELETE FROM challenges WHERE id = ?').bind(row.id).run();
  return row;
}

const rpIdFor = (origin) => { try { return new URL(origin).hostname; } catch { return null; } };

// ---------- Routes ----------
export async function handleV2(req, env, url, json, allowedOrigins, accessOk) {
  const path = url.pathname;
  // Photos and videos: raw file bodies and plain GETs, handled before reading JSON.
  if (path.startsWith('/v2/media/')) return handleMedia(req, env, path, json, authUser);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const origin = req.headers.get('Origin') || '';
  const origins = allowedOrigins;
  try {
    // Create an account (beta: needs the access key) — step 1 of 2: a passkey challenge.
    if (path === '/v2/auth/register/start' && req.method === 'POST') {
      // Open sign-up, with a cap per network and overall per day (the beta access key skips it).
      if (!accessOk) {
        const day = now() - 86400000;
        const ip = hex(await sha256(`lift-ip:${req.headers.get('CF-Connecting-IP') || 'unknown'}`));
        const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM signups WHERE ip = ? AND created > ?').bind(ip, day).first();
        const all = await env.DB.prepare('SELECT COUNT(*) AS n FROM signups WHERE created > ?').bind(day).first();
        if ((mine?.n || 0) >= 5 || (all?.n || 0) >= 300) return json({ error: 'Too many new accounts today. Try again tomorrow.' }, 429);
      }
      const name = String(body.name || '').trim().slice(0, 40);
      if (!name) return json({ error: 'Add a name.' }, 400);
      const rpId = rpIdFor(origin);
      if (!rpId || !origins.includes(origin)) return json({ error: 'Unknown site.' }, 400);
      const userId = randomB64u(16);
      const c = await newChallenge(env, { userId, name, rpId });
      return json({ challengeId: c.id, challenge: c.challenge, userId, rpId, name });
    }
    // Add a passkey to the signed-in account (e.g. a phone signed in with the recovery code).
    if (path === '/v2/auth/passkey/start' && req.method === 'POST') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Sign in first.' }, 401);
      const rpId = rpIdFor(origin);
      const c = await newChallenge(env, { userId: user.id, name: user.name, rpId });
      return json({ challengeId: c.id, challenge: c.challenge, userId: user.id, rpId, name: user.name });
    }
    if ((path === '/v2/auth/register/finish' || path === '/v2/auth/passkey/finish') && req.method === 'POST') {
      const ch = await takeChallenge(env, body.challengeId);
      const cred = body.credential || {};
      const clientDataJSON = b64u.decode(cred.clientDataJSON || '');
      checkClientData(clientDataJSON, 'webauthn.create', ch.challenge, origins);
      const att = cbor(b64u.decode(cred.attestationObject || '')).value;
      const ad = parseAuthData(att.get('authData'));
      if (hex(ad.rpIdHash) !== hex(await sha256(ch.rp_id))) throw new Error('Passkey is for a different site.');
      if (!(ad.flags & 0x01)) throw new Error('Passkey needs your confirmation.');
      if (!ad.credId) throw new Error('Passkey was missing its key.');
      const { alg, jwk } = coseToJwk(ad.cose);
      const credId = b64u.encode(ad.credId);
      const adding = path === '/v2/auth/passkey/finish';
      if (adding) {
        const user = await authUser(req, env);
        if (!user || user.id !== ch.user_id) return json({ error: 'Sign in first.' }, 401);
      } else {
        if (!/^[0-9a-f]{64}$/.test(body.codeHash || '')) return json({ error: 'Missing recovery code.' }, 400);
        await env.DB.batch([
          env.DB.prepare('INSERT INTO users (id, name, created, ver) VALUES (?, ?, ?, 0)').bind(ch.user_id, ch.name, now()),
          env.DB.prepare('INSERT INTO signups (ip, created) VALUES (?, ?)').bind(hex(await sha256(`lift-ip:${req.headers.get('CF-Connecting-IP') || 'unknown'}`)), now()),
          env.DB.prepare('INSERT INTO codes (hash, user_id) VALUES (?, ?)').bind(hex(await sha256(body.codeHash)), ch.user_id),
        ]);
      }
      await env.DB.prepare('INSERT INTO creds (id, user_id, alg, jwk, sign_count, created) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(credId, ch.user_id, alg, JSON.stringify(jwk), ad.signCount, now()).run();
      const token = adding ? null : await newSession(env, ch.user_id);
      return json({ token, user: { id: ch.user_id, name: ch.name } });
    }
    // Sign in with a passkey.
    if (path === '/v2/auth/login/start' && req.method === 'POST') {
      const rpId = rpIdFor(origin);
      if (!rpId || !origins.includes(origin)) return json({ error: 'Unknown site.' }, 400);
      const c = await newChallenge(env, { rpId });
      return json({ challengeId: c.id, challenge: c.challenge, rpId });
    }
    if (path === '/v2/auth/login/finish' && req.method === 'POST') {
      const ch = await takeChallenge(env, body.challengeId);
      const cred = body.credential || {};
      const row = await env.DB.prepare('SELECT c.*, u.name AS name FROM creds c JOIN users u ON u.id = c.user_id WHERE c.id = ?').bind(String(cred.id || '')).first();
      if (!row) return json({ error: 'This passkey isn\'t linked to an account.' }, 404);
      const clientDataJSON = b64u.decode(cred.clientDataJSON || '');
      checkClientData(clientDataJSON, 'webauthn.get', ch.challenge, origins);
      const authData = b64u.decode(cred.authenticatorData || '');
      const ad = parseAuthData(authData);
      if (hex(ad.rpIdHash) !== hex(await sha256(ch.rp_id))) throw new Error('Passkey is for a different site.');
      if (!(ad.flags & 0x01)) throw new Error('Passkey needs your confirmation.');
      const signed = new Uint8Array(authData.length + 32);
      signed.set(authData, 0); signed.set(await sha256(clientDataJSON), authData.length);
      const ok = await verifySignature(row.alg, JSON.parse(row.jwk), signed, b64u.decode(cred.signature || ''));
      if (!ok) return json({ error: 'Passkey check failed.' }, 401);
      if (ad.signCount && row.sign_count && ad.signCount <= row.sign_count) return json({ error: 'Passkey check failed (counter).' }, 401);
      await env.DB.prepare('UPDATE creds SET sign_count = ? WHERE id = ?').bind(ad.signCount, row.id).run();
      return json({ token: await newSession(env, row.user_id), user: { id: row.user_id, name: row.name } });
    }
    // Sign in with the recovery code (the phone sends a hash of it).
    if (path === '/v2/auth/code' && req.method === 'POST') {
      if (!/^[0-9a-f]{64}$/.test(body.codeHash || '')) return json({ error: 'Check the recovery code.' }, 400);
      const row = await env.DB.prepare('SELECT u.id, u.name FROM codes c JOIN users u ON u.id = c.user_id WHERE c.hash = ?').bind(hex(await sha256(body.codeHash))).first();
      if (!row) return json({ error: 'No account for that recovery code.' }, 404);
      return json({ token: await newSession(env, row.id), user: { id: row.id, name: row.name } });
    }
    if (path === '/v2/me' && req.method === 'GET') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM creds WHERE user_id = ?').bind(user.id).first();
      return json({ user, passkeys: n?.n || 0 });
    }
    if (path === '/v2/auth/logout' && req.method === 'POST') {
      const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('Authorization') || '');
      if (m) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hex(await sha256(m[1]))).run();
      return json({ ok: true });
    }
    // Sync: apply the phone's changes (newest wins), then return everything after `since`.
    if (path === '/v2/sync' && req.method === 'POST') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      const changes = Array.isArray(body.changes) ? body.changes.slice(0, 400) : [];
      const since = Math.max(0, Number(body.since) || 0);
      if (changes.length) {
        const ids = changes.map((c) => String(c.id || '').slice(0, 200));
        const existing = new Map();
        for (let i = 0; i < ids.length; i += 90) {
          const part = ids.slice(i, i + 90);
          const rows = await env.DB.prepare(`SELECT id, ts FROM docs WHERE user_id = ? AND id IN (${part.map(() => '?').join(',')})`).bind(user.id, ...part).all();
          for (const r of rows.results || []) existing.set(r.id, r.ts);
        }
        const fresh = changes.filter((c, i) => ids[i] && (!existing.has(ids[i]) || Number(c.ts) > existing.get(ids[i])));
        if (fresh.length) {
          const u = await env.DB.prepare('UPDATE users SET ver = ver + ? WHERE id = ? RETURNING ver').bind(fresh.length, user.id).first();
          let ver = u.ver - fresh.length;
          const stmts = fresh.map((c) => {
            ver += 1;
            const data = c.deleted ? null : JSON.stringify(c.data ?? null);
            if (data && data.length > 900000) throw new Error(`Record ${c.id} is too large to sync.`);
            return env.DB.prepare('INSERT INTO docs (user_id, id, ver, ts, deleted, data) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET ver = excluded.ver, ts = excluded.ts, deleted = excluded.deleted, data = excluded.data')
              .bind(user.id, String(c.id).slice(0, 200), ver, Number(c.ts) || now(), c.deleted ? 1 : 0, data);
          });
          for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
        }
      }
      const limit = 500;
      const rows = await env.DB.prepare('SELECT id, ver, ts, deleted, data FROM docs WHERE user_id = ? AND ver > ? ORDER BY ver LIMIT ?').bind(user.id, since, limit + 1).all();
      const list = (rows.results || []).slice(0, limit);
      const top = await env.DB.prepare('SELECT ver FROM users WHERE id = ?').bind(user.id).first();
      const more = (rows.results || []).length > limit;
      return json({
        ver: more ? list[list.length - 1].ver : top.ver,
        more,
        docs: list.map((r) => ({ id: r.id, ver: r.ver, ts: r.ts, deleted: !!r.deleted, data: r.deleted ? null : JSON.parse(r.data) })),
      });
    }
    // Delete the account and everything stored for it: synced data, sign-ins, passkeys, the
    // recovery code, and its friends and coaching links (with their notes, cheers and challenges).
    if (path === '/v2/account/delete' && req.method === 'POST') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      const id = user.id;
      const links = await env.DB.prepare('SELECT id FROM links WHERE a = ? OR b = ?').bind(id, id).all();
      const stmts = [
        env.DB.prepare('DELETE FROM docs WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM creds WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM codes WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM challenges WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM cards WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM cheers WHERE owner = ? OR from_user = ?').bind(id, id),
        env.DB.prepare('DELETE FROM contest_scores WHERE user_id = ? OR contest_id IN (SELECT id FROM contests WHERE a = ? OR b = ?)').bind(id, id, id),
        env.DB.prepare('DELETE FROM contests WHERE a = ? OR b = ?').bind(id, id),
        env.DB.prepare('DELETE FROM contest_members WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM together WHERE a = ? OR b = ?').bind(id, id),
        env.DB.prepare('DELETE FROM proposals WHERE coach = ? OR client = ?').bind(id, id),
        env.DB.prepare('DELETE FROM invites WHERE user_id = ?').bind(id),
        ...(links.results || []).map((l) => env.DB.prepare('DELETE FROM messages WHERE link_id = ?').bind(l.id)),
        env.DB.prepare('DELETE FROM links WHERE a = ? OR b = ?').bind(id, id),
        env.DB.prepare('DELETE FROM push_subs WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM posts WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM comments WHERE user_id = ? OR item_owner = ?').bind(id, id),
        env.DB.prepare('DELETE FROM profiles WHERE user_id = ?').bind(id),
        env.DB.prepare('DELETE FROM blocks WHERE user_id = ? OR blocked = ?').bind(id, id),
        env.DB.prepare('DELETE FROM reports WHERE reporter = ? OR target = ?').bind(id, id),
        env.DB.prepare('DELETE FROM requests WHERE from_user = ? OR to_user = ?').bind(id, id),
        env.DB.prepare('DELETE FROM calib WHERE who = ?').bind(await whoOf(id)),
        env.DB.prepare('DELETE FROM tune WHERE who = ?').bind(await whoOf(id)),
        env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
      ];
      await env.DB.batch(stmts);
      await deleteMedia(env, id);
      return json({ ok: true });
    }
    // Notifications (push.js).
    if (path.startsWith('/v2/push/') && req.method === 'POST') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      return handlePush(path, body, user, env, json);
    }
    // Accuracy checks for max estimates (calib.js).
    if (path.startsWith('/v2/calib') && req.method === 'POST') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      return handleCalib(path, body, user, env, json);
    }
    // Tuning records (tune.js), same opt-out.
    if (path.startsWith('/v2/tune') && req.method === 'POST') {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      return handleTune(path, body, user, env, json);
    }
    // Friends and coaching (social.js).
    if ((path.startsWith('/v2/social') || path.startsWith('/v2/coach/')) && (req.method === 'POST' || path === '/v2/social')) {
      const user = await authUser(req, env);
      if (!user) return json({ error: 'Signed out.' }, 401);
      return handleSocial(path, body, user, env, json);
    }
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    return json({ error: e.message || 'Something went wrong.' }, 400);
  }
}
