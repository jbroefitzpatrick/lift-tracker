// Swipe a row left to reveal one action (e.g. delete a set), the way iOS lists work.
// A row opts in with data-swipe="<action>" and data-swipe-label; its other data-* attributes are
// passed to the action. Everything a swipe does is also available from a menu, so nothing depends on it.

const OPEN = 84; // px the row slides
let active = null; // { el, x0, y0, swiping }
let opened = null;

function close(el = opened) {
  if (!el) return;
  el.style.transform = '';
  el.classList.remove('swiped');
  if (opened === el) opened = null;
}

function ensureButton(el) {
  if (el.querySelector(':scope > .swipe-act')) return;
  const b = document.createElement('button');
  b.className = 'swipe-act';
  b.textContent = el.dataset.swipeLabel || 'Delete';
  b.dataset.a = el.dataset.swipe;
  for (const [k, v] of Object.entries(el.dataset)) if (!k.startsWith('swipe') && !k.startsWith('drag')) b.dataset[k] = v;
  el.appendChild(b);
}

// Pull a bottom sheet (or the rest timer) down to dismiss it, the way iOS sheets work.
// Only starts when the sheet is scrolled to the top, so normal scrolling inside it still works.
export function initPullDown(target, onDismiss, { canStart = () => true } = {}) {
  let start = null;
  target.addEventListener('touchstart', (e) => {
    if (!canStart(e) || e.target.closest('input, textarea, select, [data-swipe]')) { start = null; return; }
    start = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: Date.now(), dy: 0, on: false };
  }, { passive: true });
  target.addEventListener('touchmove', (e) => {
    if (!start) return;
    const dy = e.touches[0].clientY - start.y;
    const dx = e.touches[0].clientX - start.x;
    if (!start.on) {
      if (dy < 8 || Math.abs(dx) > Math.abs(dy)) { if (dy < -8 || Math.abs(dx) > 12) start = null; return; }
      start.on = true;
      target.style.transition = 'none';
    }
    start.dy = Math.max(0, dy);
    target.style.transform = `translateY(${start.dy}px)`;
  }, { passive: true });
  const end = () => {
    if (!start?.on) { start = null; return; }
    const fast = start.dy / Math.max(1, Date.now() - start.t) > 0.6;
    target.style.transition = '';
    if (start.dy > 110 || (fast && start.dy > 40)) {
      target.style.transform = 'translateY(100%)';
      setTimeout(() => { target.style.transform = ''; }, 260);
      onDismiss();
    } else target.style.transform = '';
    start = null;
  };
  target.addEventListener('touchend', end, { passive: true });
  target.addEventListener('touchcancel', end, { passive: true });
}

// Swipe left or right across an area (e.g. the exercise photo) to move between items.
export function initSideSwipe(selector, onSwipe) {
  let s = null;
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest(selector);
    s = el ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    s = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
}

export function initSwipe() {
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest('[data-swipe]');
    if (opened && opened !== el) close();
    if (!el || e.target.closest('.swipe-act, [data-drag-handle]')) return;
    const t = e.touches[0];
    active = { el, x0: t.clientX, y0: t.clientY, swiping: false, base: el === opened ? -OPEN : 0 };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - active.x0;
    const dy = t.clientY - active.y0;
    if (!active.swiping) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { active = null; return; } // scrolling
      if (Math.abs(dx) < 12) return;
      active.swiping = true;
      ensureButton(active.el);
      active.el.style.transition = 'none';
    }
    const x = Math.max(-OPEN - 24, Math.min(0, active.base + dx));
    active.el.style.transform = `translateX(${x}px)`;
  }, { passive: true });

  const end = (e) => {
    if (!active) return;
    const { el, swiping, x0, base } = active;
    active = null;
    if (!swiping) return;
    el.style.transition = '';
    const dx = (e.changedTouches?.[0]?.clientX ?? x0) - x0;
    if (base + dx < -OPEN / 2) { el.style.transform = `translateX(${-OPEN}px)`; el.classList.add('swiped'); opened = el; } else close(el);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
