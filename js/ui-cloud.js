// Cloud backup settings, recovery kit, restore, and automatic uploads.
import {
  cloudConfig, setCloudConfig, cloudReady, newRecoveryCode, normalizeCode, setupLink, readSetupLink,
  uploadBackup, listBackups, downloadBackup,
} from './cloud.js';
import { exportJson, importData, parseBackup, safetySnapshot, guardProblem, historyCounts } from './store.js';

const HOUR = 3600000;

export function createCloud(ctx) {
  const { $, esc } = ctx;
  let busy = false;
  let found = null; // { cfg, versions } while choosing a version to restore

  const when = (ts) => {
    if (!ts) return 'never';
    const d = new Date(ts);
    const today = new Date().toDateString() === d.toDateString();
    return today ? `today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  // Uploads in the background. `reason`: 'workout' and 'now' always try; 'open' and 'hide' are throttled.
  async function auto(reason = 'now') {
    const c = cloudConfig();
    if (!cloudReady(c) || busy || !ctx.db) return false;
    const since = Date.now() - (c.lastUploadAt || 0);
    if (reason === 'open' && since < 12 * HOUR) return false;
    if (reason === 'hide' && (since < 2 * HOUR || (ctx.db.savedAt || 0) <= (c.lastUploadAt || 0))) return false;
    // Never replace a good cloud copy with one that has lost most of its history.
    const problem = guardProblem(ctx.db, c.lastCounts || null);
    if (problem) { setCloudConfig({ lastError: `Skipped: ${problem}` }); refresh(); return false; }
    busy = true;
    refresh();
    try {
      const r = await uploadBackup(c, exportJson(ctx.db));
      setCloudConfig({ lastUploadAt: r.savedAt, lastError: undefined, lastCounts: historyCounts(ctx.db) });
      ctx.db.settings.lastBackupAt = r.savedAt; // an off-phone copy exists, so no need to nag about file backups
      ctx.persist();
      return true;
    } catch (e) {
      setCloudConfig({ lastError: e.message });
      return false;
    } finally {
      busy = false;
      refresh();
    }
  }

  function refresh() {
    if ($('#cloud-card')) ctx.render(); // Settings is open: refresh it (the last-backup date changes too)
  }

  function card() {
    const c = cloudConfig();
    if (!cloudReady(c)) {
      return `<div class="card" id="cloud-card">
        <p class="small">Automatic, encrypted copies on a private server: after every workout and once a day. Data is encrypted on this phone first, so the server can't read it.</p>
        ${c.url && c.key ? `<p class="muted small">Server added${c.fromLink ? ' from your setup link' : ''}.</p>` : `
        <div class="field"><span>Server address</span><input id="cl-url" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(c.url || '')}" placeholder="https://lift-backup.example.workers.dev"></div>
        <div class="field"><span>Access key</span><input id="cl-key" type="password" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(c.key || '')}"></div>`}
        <div class="row"><button class="btn primary grow" data-a="cloud-on">Turn on</button><button class="btn grow" data-a="cloud-restore">Restore from cloud</button></div>
      </div>`;
    }
    const status = busy ? 'Backing up…'
      : c.lastError ? `<span class="bad-text">Last attempt failed: ${esc(c.lastError)}</span>`
      : `Last cloud backup ${when(c.lastUploadAt)}.`;
    return `<div class="card" id="cloud-card">
      <div class="row between"><b>Cloud backup is on</b><button class="btn sm" data-a="cloud-now" ${busy ? 'disabled' : ''}>Back up now</button></div>
      <p class="muted small">${status} A copy is kept for each of the last 60 days.</p>
      <div class="list-group flush">
        <button class="list-row" data-a="cloud-code"><span class="grow">Recovery code</span></button>
        <button class="list-row" data-a="cloud-restore"><span class="grow">Restore from cloud</span></button>
        <button class="list-row" data-a="cloud-link"><span class="grow">Invite a tester</span></button>
        <button class="list-row" data-a="cloud-off"><span class="grow">Turn off</span></button>
      </div>
    </div>`;
  }

  function readServerFields() {
    const c = cloudConfig();
    const url = ($('#cl-url')?.value ?? c.url ?? '').trim().replace(/\/+$/, '');
    const key = ($('#cl-key')?.value ?? c.key ?? '').trim();
    if (!/^https:\/\/\S+$/.test(url) && !/^http:\/\/localhost(:\d+)?$/.test(url)) { ctx.toast('Enter the server address (starts with https://).'); return null; }
    if (!key) { ctx.toast('Enter the access key.'); return null; }
    return { url, key };
  }

  function recoveryKit(code, first) {
    ctx.openSheet(`<h2>${first ? 'Save your recovery code' : 'Recovery code'}</h2>
      <p class="muted small">This code unlocks your cloud backups. You need it to restore on a new or reset phone. Nobody else has it — not even the server — so if it's lost, the cloud copies can't be opened.</p>
      <p class="code-box" aria-label="Recovery code">${esc(code)}</p>
      <button class="btn block" data-a="cloud-copy" data-v="${esc(code)}">Copy code</button>
      <p class="muted small">Keep it in your password manager or Notes, or take a screenshot.</p>
      <button class="btn primary block big" data-a="close-sheet">${first ? 'I\'ve saved it' : 'Done'}</button>`);
  }

  async function restoreVersion(cfg, version) {
    ctx.toast('Downloading and decrypting…');
    const text = await downloadBackup(cfg, version);
    const { db: next } = importData(parseBackup(text));
    if (!confirm(`Replace the data on this phone with this backup (${next.sessions.length} workouts, ${next.foodLog.length} food entries)? A snapshot of the current data is kept.`)) return;
    if (ctx.db) await safetySnapshot(ctx.db, 'Before cloud restore');
    setCloudConfig({ ...cfg, enabled: true, lastCounts: historyCounts(next), lastError: undefined });
    ctx.closeSheet();
    ctx.replaceDb(next);
    ctx.toast('Restored from cloud backup.');
  }

  const actions = {
    'cloud-on': async () => {
      const server = readServerFields();
      if (!server) return;
      const code = newRecoveryCode();
      const cfg = { ...server, code };
      try { await listBackups(cfg); } catch (e) { return ctx.toast(e.message); } // checks address and key
      setCloudConfig({ ...cfg, enabled: true, lastUploadAt: undefined, lastError: undefined, lastCounts: undefined });
      recoveryKit(code, true);
      refresh();
      auto('now');
    },
    'cloud-now': async () => {
      const ok = await auto('now');
      ctx.toast(ok ? 'Backed up to the cloud.' : cloudConfig().lastError || 'Backup didn\'t run.');
    },
    'cloud-code': () => recoveryKit(cloudConfig().code, false),
    'cloud-copy': async (d) => {
      try { await navigator.clipboard.writeText(d.v); ctx.toast('Copied.'); } catch { ctx.toast('Copy failed — select the code and copy it instead.'); }
    },
    'cloud-link': async () => {
      const c = cloudConfig();
      const link = setupLink(location.href, c);
      ctx.openSheet(`<h2>Share with a tester</h2>
        <p class="muted small">Each tester gets their own recovery code and private, encrypted backups. Anyone with these details can use your server's free quota, so share them only with people you trust.</p>
        <h3 class="sheet-h">Not installed yet</h3>
        <p class="muted small">Send this link. They open it in Safari, then add the app to their Home Screen.</p>
        <p class="code-box small-code">${esc(link)}</p>
        <button class="btn block" data-a="cloud-copy" data-v="${esc(link)}">Copy link</button>
        <h3 class="sheet-h">Already on their Home Screen</h3>
        <p class="muted small">Links open in Safari, which keeps separate data from the Home Screen app. Have them paste these in Settings → Data & security instead.</p>
        <div class="kv-list"><div class="kv"><span>Server address</span><b class="wrap-any">${esc(c.url)}</b></div></div>
        <button class="btn block" data-a="cloud-copy" data-v="${esc(c.url)}">Copy address</button>
        <button class="btn block" data-a="cloud-copy" data-v="${esc(c.key)}">Copy access key</button>
        <button class="btn primary block" data-a="close-sheet">Done</button>`);
    },
    'cloud-off': () => {
      if (!confirm('Turn off cloud backup on this phone? Backups already on the server are kept, and your recovery code still opens them.')) return;
      setCloudConfig({ enabled: false });
      ctx.render();
    },
    'cloud-restore': () => {
      const c = cloudConfig();
      const needServer = !(c.url && c.key);
      ctx.openSheet(`<h2>Restore from cloud</h2>
        ${needServer ? `<div class="field"><span>Server address</span><input id="cl-url" type="url" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(c.url || '')}"></div>
        <div class="field"><span>Access key</span><input id="cl-key" type="password" autocapitalize="off" autocorrect="off" spellcheck="false"></div>` : ''}
        <div class="field"><span>Recovery code</span><input id="cl-code" type="text" autocapitalize="characters" autocorrect="off" spellcheck="false" value="${esc(c.code || '')}" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></div>
        <button class="btn primary block big" data-a="cloud-find">Find backups</button>
        <div id="cl-versions"></div>
        <button class="btn block" data-a="close-sheet">Cancel</button>`);
    },
    'cloud-find': async () => {
      const server = readServerFields();
      if (!server) return;
      const code = normalizeCode($('#cl-code').value);
      if (!code) return ctx.toast('A recovery code has 20 letters and numbers.');
      const cfg = { ...server, code };
      try {
        const versions = await listBackups(cfg);
        found = { cfg, versions };
        $('#cl-versions').innerHTML = versions.length
          ? `<div class="list-group">${versions.map((v) => `<div class="list-row"><span class="grow"><b>${v.version === 'latest' ? 'Latest' : esc(v.version)}</b><span class="pick-sub">${when(v.savedAt)} · ${Math.round((v.size || 0) / 1024)} KB</span></span><button class="mini" data-a="cloud-pick" data-v="${esc(v.version)}">Restore</button></div>`).join('')}</div>`
          : '<p class="muted small">No backups found for that recovery code.</p>';
      } catch (e) { ctx.toast(e.message); }
    },
    'cloud-pick': async (d) => {
      if (!found) return;
      try { await restoreVersion(found.cfg, d.v); } catch (e) { ctx.toast(e.message); }
    },
  };

  // A setup link (…/#cloud=…) adds the server and access key, then clears itself from the address bar.
  function onBoot() {
    const link = readSetupLink(location.hash);
    if (link) {
      setCloudConfig({ ...link, fromLink: true });
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => ctx.toast('Backup server added. Turn on cloud backup in Settings → Data & security.'), 600);
    }
    auto('open');
    document.addEventListener('visibilitychange', () => { if (document.hidden) auto('hide'); });
  }

  return { card, actions, auto, onBoot };
}
