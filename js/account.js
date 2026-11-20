// Account: sign in with a passkey (Face ID) or a recovery code, against the Lift server
// (cloud/accounts.js). Only a session token and the account's name are kept on the phone
// (localStorage "lift.account"), plus the recovery code if this phone created the account.

import { cloudConfig, newRecoveryCode, normalizeCode } from './cloud.js';

const KEY = 'lift.account';
export function account() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function saveAccount(a) { try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch {} }

const b64u = {
  encode(buf) { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};
async function codeHash(code) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lift-account:${normalizeCode(code)}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function api(path, body, { auth = false, accessKey = false } = {}) {
  const c = cloudConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${account()?.token || ''}`;
  if (accessKey && c.key) headers['X-Access-Key'] = c.key;
  const text = body === undefined ? undefined : JSON.stringify(body);
  let res;
  try {
    // keepalive lets a sync started as the app closes finish, but browsers cap it at 64 KB.
    res = await fetch(`${c.url.replace(/\/+$/, '')}${path}`, { method: text === undefined ? 'GET' : 'POST', headers, body: text, keepalive: !!text && text.length < 60000 });
  } catch {
    throw new Error('Could not reach the Lift server. Check your connection.');
  }
  const out = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) { saveAccount(null); throw new Error('Signed out. Sign in again to keep syncing.'); }
  if (!res.ok) throw new Error(out.error || `Server error ${res.status}`);
  return out;
}

export const passkeysSupported = () => !!(window.PublicKeyCredential && navigator.credentials?.create);

async function createPasskey(start) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: b64u.decode(start.challenge),
      rp: { id: start.rpId, name: 'Lift' },
      user: { id: b64u.decode(start.userId), name: start.name, displayName: start.name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
      attestation: 'none',
      timeout: 60000,
    },
  });
  if (!cred) throw new Error('No passkey was created.');
  return { id: b64u.encode(cred.rawId), clientDataJSON: b64u.encode(cred.response.clientDataJSON), attestationObject: b64u.encode(cred.response.attestationObject) };
}

// New account: a passkey on this phone, plus a recovery code shown once.
export async function createAccount(name) {
  if (!passkeysSupported()) throw new Error('This browser can\'t make passkeys. Open the app from the home screen on an up-to-date iPhone.');
  const code = newRecoveryCode();
  const start = await api('/v2/auth/register/start', { name }, { accessKey: true });
  const credential = await createPasskey(start);
  const res = await api('/v2/auth/register/finish', { challengeId: start.challengeId, credential, codeHash: await codeHash(code) });
  saveAccount({ token: res.token, user: res.user, code, method: 'passkey' });
  return { user: res.user, code };
}

export async function signInWithPasskey() {
  if (!passkeysSupported()) throw new Error('This browser can\'t use passkeys. Use your recovery code instead.');
  const start = await api('/v2/auth/login/start', {});
  const a = await navigator.credentials.get({ publicKey: { challenge: b64u.decode(start.challenge), rpId: start.rpId, userVerification: 'preferred', timeout: 60000 } });
  if (!a) throw new Error('No passkey was chosen.');
  const res = await api('/v2/auth/login/finish', {
    challengeId: start.challengeId,
    credential: { id: b64u.encode(a.rawId), clientDataJSON: b64u.encode(a.response.clientDataJSON), authenticatorData: b64u.encode(a.response.authenticatorData), signature: b64u.encode(a.response.signature), userHandle: a.response.userHandle ? b64u.encode(a.response.userHandle) : null },
  });
  saveAccount({ token: res.token, user: res.user, method: 'passkey' });
  return res.user;
}

export async function signInWithCode(code) {
  if (!normalizeCode(code)) throw new Error('Recovery codes are 20 letters and numbers, like ABCDE-FGHJK-LMNPQ-RSTUV.');
  const res = await api('/v2/auth/code', { codeHash: await codeHash(code) });
  saveAccount({ token: res.token, user: res.user, code: normalizeCode(code), method: 'code' });
  return res.user;
}

// A passkey on this phone for an account signed in with the recovery code.
export async function addPasskey() {
  const start = await api('/v2/auth/passkey/start', {}, { auth: true });
  const credential = await createPasskey(start);
  await api('/v2/auth/passkey/finish', { challengeId: start.challengeId, credential }, { auth: true });
  saveAccount({ ...account(), method: 'passkey' });
}

export async function signOut() {
  try { await api('/v2/auth/logout', {}, { auth: true }); } catch {}
  saveAccount(null);
}
