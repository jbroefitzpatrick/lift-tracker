// Notifications on this phone (web push through the Lift server, cloud/push.js).
// Needs an account. On iPhone, only for the app added to the Home Screen (iOS 16.4+).
// While a rest timer runs and the app goes to the background, the server sends "Rest is over" at
// the right time; coming back to the app cancels it (the app's own timer takes over again).

import { account, api } from './account.js';

const KEY = 'lift.push';
const b64ToBytes = (s) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export function pushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !standalone() ? 'install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  let on = false;
  try { on = !!localStorage.getItem(KEY); } catch {}
  return on && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  if (!account()?.token) throw new Error('Sign in first.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked. Turn them on in Settings → Notifications → Lift.' : 'Notifications were not allowed.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/v2/push/key', {}, { auth: true });
  if (!key) throw new Error('Notifications are not set up on the server yet.');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api('/v2/push/subscribe', { subscription: sub.toJSON() }, { auth: true });
  try { localStorage.setItem(KEY, sub.endpoint); } catch {}
}

export async function disablePush() {
  let endpoint = null;
  try { endpoint = localStorage.getItem(KEY); localStorage.removeItem(KEY); } catch {}
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    endpoint = sub?.endpoint || endpoint;
    await sub?.unsubscribe();
  } catch {}
  if (endpoint && account()?.token) await api('/v2/push/unsubscribe', { endpoint }, { auth: true }).catch(() => {});
}

export const testPush = () => api('/v2/push/test', {}, { auth: true });

// Rest alert while the app is in the background.
let scheduled = false;
export function scheduleRest(at, body) {
  if (pushStatus() !== 'on' || at - Date.now() < 3000) return;
  scheduled = true;
  api('/v2/push/schedule', { at, title: 'Rest is over', body }, { auth: true }).catch(() => { scheduled = false; });
}
export function cancelRest() {
  if (!scheduled) return;
  scheduled = false;
  api('/v2/push/cancel', {}, { auth: true }).catch(() => {});
}
