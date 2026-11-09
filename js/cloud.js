// Cloud backup client. Talks to the small Cloudflare Worker in cloud/worker.js.
//
// Each person gets a random recovery code (about 100 bits). From it the app derives:
//   - a storage id: SHA-256 of the code, so the server never sees the code itself
//   - the encryption key: the code is the passphrase for the same AES-256-GCM format as file backups
// The server stores only encrypted blobs. Lose the recovery code and the cloud copies can't be read.
//
// Settings live in localStorage ("lift.cloud"), outside the data record, so they're never part of a
// backup and survive restoring one.

import { encryptText, decryptText, isEncrypted } from './crypto.js';

// Filled in after deploying the worker (docs/CLOUD-BACKUP.md). Testers can also set it from a setup link.
export const DEFAULT_URL = 'https://lift-backup.jbroefitzpatrick.workers.dev';

const KEY = 'lift.cloud';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, to avoid misreading

export function cloudConfig() {
  try { return { url: DEFAULT_URL, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { url: DEFAULT_URL }; }
}

export function setCloudConfig(patch) {
  const next = { ...cloudConfig(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export const cloudReady = (c = cloudConfig()) => !!(c.enabled && c.url && c.key && c.code);

// XXXXX-XXXXX-XXXXX-XXXXX: 20 characters from a 32-letter alphabet = 100 bits.
export function newRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = [...bytes].map((b) => ALPHABET[b % 32]).join('');
  return chars.match(/.{5}/g).join('-');
}

export function normalizeCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 20 ? c.match(/.{5}/g).join('-') : null;
}

async function storageId(code) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lift-backup-id:${normalizeCode(code)}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Setup links carry the server address and access key: …/#cloud=<base64url JSON>.
export function setupLink(appUrl, c = cloudConfig()) {
  const payload = btoa(JSON.stringify({ u: c.url, k: c.key })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${appUrl.split('#')[0]}#cloud=${payload}`;
}

export function readSetupLink(hash) {
  const m = /^#cloud=([A-Za-z0-9_-]+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const { u, k } = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof u === 'string' && /^(https:\/\/|http:\/\/localhost[:/])/.test(u) && typeof k === 'string' && k) return { url: u.replace(/\/+$/, ''), key: k };
  } catch {}
  return null;
}

async function call(c, path, opts = {}) {
  let res;
  try {
    res = await fetch(`${c.url.replace(/\/+$/, '')}${path}`, { ...opts, headers: { ...(opts.headers || {}), 'X-Access-Key': c.key } });
  } catch {
    throw new Error('Could not reach the backup server. Check your connection.');
  }
  if (!res.ok) {
    let msg = `Server error ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res;
}

// Encrypts on the phone, then uploads. Returns { savedAt }.
export async function uploadBackup(c, jsonText) {
  const id = await storageId(c.code);
  const body = await encryptText(jsonText, normalizeCode(c.code));
  const res = await call(c, `/v1/backups/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
  return res.json();
}

export async function listBackups(c) {
  const id = await storageId(c.code);
  return (await (await call(c, `/v1/backups/${id}`)).json()).versions || [];
}

// Downloads one version and decrypts it. Returns the backup's JSON text.
export async function downloadBackup(c, version = 'latest') {
  const id = await storageId(c.code);
  const obj = await (await call(c, `/v1/backups/${id}/${version}`)).json();
  if (!isEncrypted(obj)) throw new Error('The server returned something that isn\'t a backup.');
  try { return await decryptText(obj, normalizeCode(c.code)); } catch { throw new Error('That recovery code doesn\'t open this backup.'); }
}
