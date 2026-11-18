// First-run tour: a spotlight on one thing at a time, a short note, and an arrow pointing at it.
//
// Two tours, each shown once:
//   home — the first time Train shows a workout: the week, the day line, exercises, Start, the tabs.
//   log  — the first time an exercise is opened during a workout: entering and checking off sets.
// Steps whose element isn't on screen are skipped. "Show the tour again" in Settings resets both.

const TOURS = {
  home: [
    { sel: '.day-strip', text: 'Your week. Tap a day to see its workout.' },
    { sel: '.day-line', text: 'About how long it takes, and where. Tap Edit to fit it to your time, change gym or add a warm-up.' },
    { sel: '.ex-list .ex-item', text: 'Your exercises. Tap one for how to do it. Hold and drag to reorder, or drop it on another to pair them.' },
    { sel: '.cta[data-a="start-workout"]', text: 'At the gym, start here. The app keeps time, starts your rest timer and shows what\'s next.' },
    { sel: '#tabs [data-tab="plan"]', text: 'Plan: your week and program. After each week it suggests what to change.' },
    { sel: '#tabs [data-tab="food"]', text: 'Food: log meals against your calorie and protein targets.' },
    { sel: '#tabs [data-tab="progress"]', text: 'Progress: your history, records and how each muscle is doing.' },
    { sel: 'header.top [data-a="day-options"]', text: 'More: recovery, pain log and settings.' },
  ],
  log: [
    { sel: '.set-row.lift .cell', text: 'Weight and reps come from your plan. Change them if you did something different.' },
    { sel: '.set-row.lift .check', text: 'Tap the check when a set is done. Rest starts by itself.' },
    { sel: '.set-row.lift .prev:not(.none)', text: 'What you did last time. Tap to copy it.' },
    { sel: '.ex-nav', text: 'On to the next exercise, or Prev to go back one.' },
    { sel: '.wb-back', text: 'Back to the whole workout at any time.' },
  ],
};

export function createTour(ctx) {
  let st = null; // { name, steps, i, el }
  let pending = null;

  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  function build() {
    const root = document.createElement('div');
    root.id = 'tour';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'tour-text');
    root.innerHTML = `<div class="tour-spot"></div>
      <div class="tour-tip"><span class="tour-arrow" aria-hidden="true"></span>
        <p id="tour-text"></p>
        <div class="tour-foot"><span class="tour-count"></span><button class="tour-skip" type="button">Skip</button><button class="tour-next" type="button">Next</button></div>
      </div>`;
    root.querySelector('.tour-next').addEventListener('click', (e) => { e.stopPropagation(); next(); });
    root.querySelector('.tour-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    root.addEventListener('click', (e) => { if (e.target === root || e.target.classList.contains('tour-spot')) next(); });
    document.body.appendChild(root);
    window.addEventListener('resize', place);
    return root;
  }

  function place() {
    if (!st?.el) return;
    const root = document.getElementById('tour');
    if (!root) return;
    const r = st.el.getBoundingClientRect();
    const pad = 6;
    Object.assign(root.querySelector('.tour-spot').style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const tip = root.querySelector('.tour-tip');
    const arrow = root.querySelector('.tour-arrow');
    const below = r.top + r.height / 2 < window.innerHeight / 2;
    const tipW = Math.min(320, window.innerWidth - 32);
    const left = Math.max(16, Math.min(window.innerWidth - tipW - 16, r.left + r.width / 2 - tipW / 2));
    tip.style.width = `${tipW}px`;
    tip.style.left = `${left}px`;
    tip.classList.toggle('below', below);
    if (below) { tip.style.top = `${r.bottom + pad + 14}px`; tip.style.bottom = ''; } else { tip.style.top = ''; tip.style.bottom = `${window.innerHeight - r.top + pad + 14}px`; }
    arrow.style.left = `${Math.max(16, Math.min(tipW - 16, r.left + r.width / 2 - left))}px`;
  }

  function show() {
    const root = document.getElementById('tour') || build();
    while (st.i < st.steps.length) {
      const el = [...document.querySelectorAll(st.steps[st.i].sel)].find(visible);
      if (el) { st.el = el; break; }
      st.i += 1;
    }
    if (st.i >= st.steps.length) return finish();
    const step = st.steps[st.i];
    root.querySelector('#tour-text').textContent = step.text;
    const shown = st.steps.length;
    root.querySelector('.tour-count').textContent = `${st.i + 1} of ${shown}`;
    root.querySelector('.tour-next').textContent = st.i === shown - 1 ? 'Done' : 'Next';
    // Bring it into view unless it's pinned to the screen (tabs, buttons at the bottom).
    const fixed = getComputedStyle(st.el).position === 'fixed' || st.el.closest('#tabs');
    if (!fixed) {
      const r = st.el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 140) window.scrollBy({ top: r.top - window.innerHeight * 0.35, behavior: 'instant' });
    }
    requestAnimationFrame(place);
    root.querySelector('.tour-next').focus({ preventScroll: true });
  }

  function next() { if (!st) return; st.i += 1; show(); }

  function finish() {
    if (st) { (ctx.db.settings.tours ||= {})[st.name] = true; ctx.persist(); }
    st = null;
    document.getElementById('tour')?.remove();
    window.removeEventListener('resize', place);
  }

  function start(name) {
    if (st || !TOURS[name]) return;
    st = { name, steps: TOURS[name], i: 0, el: null };
    show();
  }

  // Called after each render: start a tour when its moment comes.
  function maybe() {
    const db = ctx.db;
    const ui = ctx.ui;
    const seen = db.settings.tours || {};
    if (st || pending || !db.settings.welcomed || !document.getElementById('sheet').hidden || location.search.includes('notour')) return;
    let name = null;
    if (!seen.home && ui.tab === 'today' && !db.activeSession && document.querySelector('.ex-list .ex-item')) name = 'home';
    else if (!seen.log && ui.tab === 'exercise' && db.activeSession && document.querySelector('.set-row.lift')) name = 'log';
    if (!name) return;
    pending = setTimeout(() => { pending = null; if (document.getElementById('sheet').hidden) start(name); }, 700);
  }

  function replay() {
    ctx.db.settings.tours = {};
    ctx.persist();
  }

  return { maybe, replay, start, finish, active: () => !!st };
}
