// Settings → Account and sync: create an account (passkey), sign in, recovery code, sync status.
// Also runs sync in the background: shortly after changes, when the app opens, and when it's left.

import { account, createAccount, signInWithPasskey, signInWithCode, addPasskey, signOut, passkeysSupported, deleteAccount } from './account.js';
import { syncNow, syncState, resetSyncState, applyDocs, hasOwnData, peekRemote } from './sync.js';
import { safetySnapshot, todayStr } from './store.js';
import { pushStatus, enablePush, disablePush, testPush } from './push.js';

export function createAccountUi(ctx) {
  const { esc } = ctx;
  let timer = null;
  let applying = false;
  let lastError = '';

  const ago = (t) => {
    if (!t) return 'not yet';
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  };

  // Server documents → this phone. Takes a safety snapshot first (once a day) so a bad sync can be undone.
  async function apply(docs, mode) {
    applying = true;
    try {
      const today = todayStr();
      let snapDay = '';
      try { snapDay = localStorage.getItem('lift.sync.snap') || ''; } catch {}
      if (snapDay !== today || mode === 'replace') {
        await safetySnapshot(ctx.db, mode === 'replace' ? 'Before using account data' : 'Before sync');
        try { localStorage.setItem('lift.sync.snap', today); } catch {}
      }
      const db = ctx.db;
      if (mode === 'replace') for (const k of ['sessions', 'pain', 'bodyweight', 'measurements', 'cardio', 'foodLog', 'customFoods', 'meals']) db[k] = [];
      applyDocs(db, docs);
      ctx.replaceDb(db);
    } finally { applying = false; }
  }

  // Set from sign-in until this phone's first sync is chosen (combine or use the account's data),
  // so background syncs can't make that choice first.
  const PENDING = 'lift.sync.pending';
  const pending = () => { try { return !!localStorage.getItem(PENDING); } catch { return false; } };
  const setPending = (on) => { try { if (on) localStorage.setItem(PENDING, '1'); else localStorage.removeItem(PENDING); } catch {} };

  async function run(opts = {}) {
    if (!account()?.token || !navigator.onLine) return null;
    if (pending() && !opts.mode) return null;
    try {
      const r = await syncNow(() => ctx.db, { onApply: (docs, mode) => apply(docs, mode), ...opts });
      lastError = '';
      if (ctx.ui.tab === 'settings' && ctx.ui.setPage === 'account') ctx.render();
      return r;
    } catch (e) {
      lastError = e.message;
      if (ctx.ui.tab === 'settings' && ctx.ui.setPage === 'account') ctx.render();
      return null;
    }
  }

  // After a change: sync about 20 seconds later (changes in a burst go together).
  function schedule() {
    if (applying || !account()?.token) return;
    clearTimeout(timer);
    timer = setTimeout(() => run(), 20000);
  }
  function start() {
    setTimeout(() => run(), 2500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); run(); } else run(); });
    window.addEventListener('online', () => run());
  }

  // First link on a phone that already has its own data: merge, or use the account's.
  async function linkThisPhone() {
    setPending(true);
    resetSyncState();
    const remote = await peekRemote().catch(() => ({ count: 0 }));
    if (remote.count && hasOwnData(ctx.db)) {
      ctx.openSheet(`<h2>This phone has data too</h2>
        <p class="small">Your account already has workouts and this phone has its own. Combine them, or replace this phone's data with the account's.</p>
        <button class="btn primary block big" data-a="acct-link" data-v="merge">Combine both</button>
        <button class="btn block" data-a="acct-link" data-v="replace">Use the account's data</button>
        <p class="muted small">Either way, a snapshot of this phone's data is kept first (Settings → Backup and data → Restore an automatic snapshot).</p>`);
      return;
    }
    await finishLink(remote.count && !hasOwnData(ctx.db) ? 'replace' : 'merge');
  }
  async function finishLink(mode) {
    ctx.closeSheet();
    setPending(false);
    ctx.toast('Syncing…');
    const r = await run({ mode });
    if (r) ctx.people?.publish().then(() => ctx.people.refresh()).then(() => ctx.people.maybeInvite());
    ctx.toast(r ? `Signed in as ${account()?.user.name}. ${r.received ? "Your account's data is on this phone." : 'Your data is in your account.'}` : `Sync didn't finish: ${lastError}`);
    ctx.render();
  }

  // Sign-up and sign-in problems stay on the page (a toast can vanish before it's read).
  let authError = null; // { where: 'create' | 'signin', text }
  const typed = { name: '', code: '' };
  function explain(e) {
    if (e.name === 'NotAllowedError') return "The passkey wasn't saved. If you didn't cancel it, check that iCloud Keychain is on: Settings → your name → iCloud → Passwords and Keychain.";
    if (e.name === 'InvalidStateError') return 'This phone already has a passkey for ProFitz (working title). Use Sign in with a passkey instead.';
    if (e.name === 'SecurityError') return 'Passkeys only work in the app opened from its own address (jbroefitzpatrick.github.io).';
    return e.message || 'Something went wrong. Try again.';
  }
  function fail(where, e) {
    typed.name = document.getElementById('acct-name')?.value ?? typed.name;
    typed.code = document.getElementById('acct-code')?.value ?? typed.code;
    authError = { where, text: explain(e) };
    ctx.render();
  }
  const errFor = (where) => (authError?.where === where ? `<p class="notice warn small" role="alert">${esc(authError.text)}</p>` : '');

  function page() {
    const a = account();
    const st = syncState();
    if (!a) {
      let invited = false;
      try { invited = !!localStorage.getItem('lift.invite'); } catch {}
      return `${invited ? '<div class="notice-card"><b>You have an invite</b><p class="small">Create an account (or sign in) and it opens right after.</p></div>' : ''}<div class="card">
        <p class="small">An account keeps your plan, workouts, food and body data in sync across your phones, and is the first step toward sharing with a trainer or friends. You sign in with a passkey (Face ID); no password.</p>
        <p class="muted small">Your synced data is stored on the ProFitz (working title) server so it can reach your other devices. Progress photos stay on this phone.</p>
      </div>
      <h2 class="group-title">New here</h2>
      <div class="card">
        <div class="field"><span>Your name</span><input id="acct-name" type="text" autocomplete="name" placeholder="Shown to people you share with later" value="${esc(typed.name)}"></div>
        <button class="btn primary block" data-a="acct-create" ${passkeysSupported() ? '' : 'disabled'}>Create account with a passkey</button>
        ${passkeysSupported() ? '' : '<p class="muted small">Passkeys need the app opened from the home screen on an up-to-date iPhone or a current browser.</p>'}
        ${errFor('create')}
      </div>
      <h2 class="group-title">Already have an account</h2>
      <div class="card">
        <button class="btn block" data-a="acct-passkey" ${passkeysSupported() ? '' : 'disabled'}>Sign in with a passkey</button>
        <div class="field"><span>Or your recovery code</span><input id="acct-code" type="text" autocapitalize="characters" autocomplete="off" placeholder="ABCDE-FGHJK-LMNPQ-RSTUV" value="${esc(typed.code)}"></div>
        <button class="btn block" data-a="acct-code">Sign in with the code</button>
        ${errFor('signin')}
      </div>`;
    }
    if (pending()) {
      return `<div class="card">
        <p><b>${esc(a.user.name)}</b></p>
        <p class="small">Choose how this phone's data joins your account before it starts syncing.</p>
        <button class="btn primary block" data-a="acct-relink">Continue</button>
      </div>
      <div class="list-group"><button class="list-row danger-row" data-a="acct-signout"><span class="grow">Sign out of this phone</span></button></div>`;
    }
    return `<div class="card">
        <div class="row between"><div><b>${esc(a.user.name)}</b><p class="muted small">${a.method === 'passkey' ? 'Signed in with a passkey' : 'Signed in with your recovery code'}</p></div></div>
        <div class="kv-list">
          <div class="kv"><span>Last synced</span><b>${ago(st.lastSync)}</b></div>
          <div class="kv"><span>Records in sync</span><b>${(st.count || 0).toLocaleString()}</b></div>
        </div>
        ${lastError ? `<p class="notice warn small">${esc(lastError)}</p>` : ''}
        <button class="btn primary block" data-a="acct-sync">Sync now</button>
      </div>
      <div class="list-group">
        ${a.method !== 'passkey' && passkeysSupported() ? '<button class="list-row" data-a="acct-add-passkey"><span class="grow"><b>Add a passkey on this phone</b><span class="pick-sub">Sign in with Face ID next time</span></span></button>' : ''}
        ${a.code ? '<button class="list-row" data-a="acct-show-code"><span class="grow"><b>Recovery code</b><span class="pick-sub">Signs in on a device without your passkey</span></span></button>' : ''}
        <button class="list-row danger-row" data-a="acct-signout"><span class="grow">Sign out of this phone</span></button>
      </div>
      ${notifRow()}
      <div class="list-group"><button class="list-row danger-row" data-a="acct-delete"><span class="grow">Delete account<span class="pick-sub">Removes your account and synced data from the server</span></span></button></div>
      <p class="muted small pad"><a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a> · Syncs by itself shortly after changes, when the app opens and when you leave it. Progress photos stay on this phone.</p>`;
  }

  // Notifications: rest timer when the phone is locked, coach notes, challenges, invites.
  function notifRow() {
    const st = pushStatus();
    if (st === 'unsupported') return '';
    if (st === 'install') return '<div class="card"><b>Notifications</b><p class="small muted">Add ProFitz (working title) to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on rest-timer alerts and coach notes.</p></div>';
    if (st === 'denied') return '<div class="card"><b>Notifications are blocked</b><p class="small muted">Allow them in the iPhone Settings app → Notifications → ProFitz.</p></div>';
    return `<div class="list-group"><label class="list-row toggle"><span class="grow"><b>Notifications</b><span class="pick-sub">Rest timer when the phone is locked, coach notes, challenges</span></span><input type="checkbox" data-a="acct-push" ${st === 'on' ? 'checked' : ''}></label>
      ${st === 'on' ? '<button class="list-row" data-a="acct-push-test"><span class="grow">Send a test notification</span></button>' : ''}</div>`;
  }

  function showCode(code, fresh) {
    ctx.openSheet(`<h2>${fresh ? 'Save your recovery code' : 'Recovery code'}</h2>
      <p class="small">It signs in to your account on any device, even without your passkey. Keep it somewhere safe, like your password manager.</p>
      <p class="code-big" id="acct-code-show">${esc(code)}</p>
      <button class="btn block" data-a="acct-copy">Copy code</button>
      <button class="btn primary block" data-a="${fresh ? 'acct-code-saved' : 'close-sheet'}">${fresh ? 'I saved it' : 'Done'}</button>`);
  }

  const actions = {
    'acct-create': async () => {
      const name = (document.getElementById('acct-name')?.value || '').trim();
      if (!name) return fail('create', new Error('Add your name first.'));
      authError = null;
      typed.name = name;
      ctx.toast('Creating your account…');
      try {
        const { code } = await createAccount(name);
        // A new account is empty: this phone's data goes up quietly while the code is on screen.
        resetSyncState();
        ctx.render();
        showCode(code, true);
        run().then(() => ctx.people?.publish()).then(() => ctx.people?.refresh());
      } catch (e) { fail('create', e); }
    },
    'acct-passkey': async () => {
      authError = null;
      try { await signInWithPasskey(); ctx.render(); await linkThisPhone(); } catch (e) { fail('signin', e); }
    },
    'acct-code': async () => {
      authError = null;
      try { await signInWithCode(document.getElementById('acct-code')?.value); typed.code = ''; ctx.render(); await linkThisPhone(); } catch (e) { fail('signin', e); }
    },
    'acct-link': (d) => finishLink(d.v),
    'acct-relink': () => linkThisPhone(),
    'acct-sync': async () => { ctx.toast('Syncing…'); const r = await run(); ctx.toast(r ? (r.received || r.sent ? `Synced: ${r.sent} sent, ${r.received} received.` : 'Everything is up to date.') : `Sync didn't finish: ${lastError}`); },
    'acct-add-passkey': async () => { try { await addPasskey(); ctx.toast('Passkey added.'); ctx.render(); } catch (e) { ctx.toast(e.name === 'NotAllowedError' ? 'Passkey was cancelled.' : e.message); } },
    'acct-code-saved': () => { ctx.closeSheet(); setTimeout(() => ctx.people?.maybeInvite(), 350); },
    'acct-delete': async () => {
      const ok = await ctx.ask('Delete your account? Your synced data, friends, coaching and challenges are removed from the server for good, and other phones are signed out. The data on this phone stays.', 'Delete account', true);
      if (!ok) return;
      try {
        await deleteAccount();
        await disablePush();
        resetSyncState(); setPending(false); ctx.people?.reset(); ctx.render();
        ctx.toast('Account deleted. Your data on this phone is kept.');
      } catch (e) { ctx.toast(e.message); }
    },
    'acct-push': async (d, el) => {
      try {
        if (el.checked) { await enablePush(); ctx.toast('Notifications are on.'); } else { await disablePush(); ctx.toast('Notifications are off.'); }
      } catch (e) { ctx.toast(e.message); }
      ctx.render();
    },
    'acct-push-test': async () => { try { const r = await testPush(); ctx.toast(r.sent ? 'Sent. It should arrive in a moment.' : 'Nothing was sent. Turn notifications off and on again.'); } catch (e) { ctx.toast(e.message); } },
    'acct-show-code': () => showCode(account()?.code, false),
    'acct-copy': async () => { try { await navigator.clipboard.writeText(account()?.code || ''); ctx.toast('Copied.'); } catch { ctx.toast('Select the code and copy it.'); } },
    'acct-signout': async () => {
      if (!(await ctx.ask('Sign out of this phone? Your data stays.', 'Sign out', true))) return;
      await disablePush(); await signOut(); resetSyncState(); setPending(false); ctx.people?.reset(); ctx.render(); ctx.toast('Signed out.');
    },
  };

  const summary = () => { const a = account(); if (!a) return 'Not signed in'; const t = syncState().lastSync; return `${a.user.name} · ${t ? `synced ${ago(t)}` : 'not synced yet'}`; };
  return { page, actions, schedule, start, summary };
}
