// Passphrase-encrypted backups using the browser's Web Crypto API (no libraries).
// AES-256-GCM, key derived with PBKDF2-HMAC-SHA256 (600,000 iterations, per current OWASP guidance),
// random 16-byte salt and 12-byte IV per file. Without the passphrase the file cannot be read or changed
// undetected — GCM authenticates the data, so a wrong passphrase or tampering fails to decrypt.

const ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export function cryptoAvailable() {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

export async function encryptText(text, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return JSON.stringify({
    app: 'lift-tracker', encrypted: true, v: 1,
    cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
    salt: toB64(salt), iv: toB64(iv), data: toB64(data),
  });
}

export function isEncrypted(obj) {
  return obj && obj.encrypted === true && obj.app === 'lift-tracker' && typeof obj.data === 'string';
}

export async function decryptText(obj, passphrase) {
  try {
    const key = await deriveKey(passphrase, fromB64(obj.salt), obj.iterations || ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(obj.iv) }, key, fromB64(obj.data));
    return dec.decode(plain);
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.');
  }
}
