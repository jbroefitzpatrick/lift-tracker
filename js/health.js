// Apple Health, without a native app: the app opens an iOS Shortcut named "Lift to Health" and
// passes it a number (the workout's active calories). The Shortcut uses the built-in
// "Log Health Sample" action to save it to Health as Active Energy.
// A web page can't tell whether that Shortcut exists, so the setup steps show the first time you
// send, with a "Don't show again" box, and are always available from Settings.
import { icon } from './icons.js';
import { workoutBurn } from './energy.js';

export const SHORTCUT_NAME = 'Lift to Health';
export const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

export function createHealth(ctx) {
  const { esc } = ctx;

  function runShortcut(kcal) {
    const url = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(String(kcal))}`;
    window.lastShortcutUrl = url; // handy when checking what was sent
    window.location.href = url;
  }

  function steps() {
    return `<ol class="steps">
      <li>Open the <b>Shortcuts</b> app and tap <b>+</b> at the top right.</li>
      <li>Tap the name at the top, choose <b>Rename</b>, and type <b>${SHORTCUT_NAME}</b> exactly.</li>
      <li>Tap <b>Add Action</b> (or the search bar at the bottom), search for <b>Log Health Sample</b>, and tap it.</li>
      <li>In the action, tap the type and choose <b>Active Energy</b>.</li>
      <li>Tap the value field, then choose <b>Shortcut Input</b> from the bar above the keyboard (or <b>Select Variable</b> → <b>Shortcut Input</b>). If it asks for a unit, choose <b>kcal</b> (Cal).</li>
      <li>Tap <b>Done</b>. The first time it runs, iPhone asks to let it write to Health: tap <b>Allow</b>.</li>
    </ol>
    <p class="muted small">After that, tapping "Send to Apple Health" opens Shortcuts for a second, saves the calories, and you can swipe back to Lift. If nothing is saved, check the shortcut's name matches exactly.</p>`;
  }

  // The first time: setup steps, with the option to send now and to stop showing them.
  function openSetup(sessionId) {
    const s = ctx.db.sessions.find((x) => x.id === sessionId);
    const kcal = s ? Math.round(workoutBurn(ctx.db, s).active) : null;
    ctx.openSheet(`<h2>Send to Apple Health</h2>
      <p class="small">This uses a one-time Shortcut, which takes about two minutes to make. Each workout's active calories then go to Health with one tap.</p>
      <h3 class="sheet-h">Set up the shortcut</h3>
      ${steps()}
      ${sessionId ? `<label class="toggle"><input type="checkbox" id="hs-hide"><span>Don't show this again</span></label>
      <button class="btn primary block big" data-a="health-send-now" data-id="${esc(sessionId)}">I've set it up — send ${kcal} kcal</button>` : ''}
      <button class="btn plain block" data-a="close-sheet">${sessionId ? 'Not now' : 'Done'}</button>`);
  }

  function send(sessionId) {
    const db = ctx.db;
    const s = db.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    const kcal = Math.round(workoutBurn(db, s).active);
    if (!(kcal > 0)) return ctx.toast('No calories to send for this workout.');
    s.healthSent = Date.now();
    ctx.persist();
    ctx.render();
    runShortcut(kcal);
  }

  // The button on a workout summary.
  function button(s) {
    if (!isApple()) return '';
    return `<button class="btn block health-btn ${s.healthSent ? 'sent' : ''}" data-a="health-send" data-id="${esc(s.id)}">${icon(s.healthSent ? 'check' : 'up')} ${s.healthSent ? 'Sent to Apple Health · send again' : 'Send to Apple Health'}</button>`;
  }

  const actions = {
    'health-send': (d) => {
      if (!ctx.db.settings.healthSetupHidden) return openSetup(d.id);
      send(d.id);
    },
    'health-send-now': (d, el) => {
      if (el.closest('#sheet-body')?.querySelector('#hs-hide')?.checked) ctx.db.settings.healthSetupHidden = true;
      ctx.closeSheet();
      send(d.id);
    },
    'health-setup': () => openSetup(null),
    'health-reset': () => { ctx.db.settings.healthSetupHidden = false; ctx.persist(); ctx.render(); ctx.toast('Setup steps will show next time you send.'); },
  };

  return { button, actions };
}
