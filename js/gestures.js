// Swipe gestures, since a home-screen web app doesn't get iPhone's own.
//   From the left edge, on any screen with a back button: drag right to go back.
//   On the exercise screen: swipe left for the next exercise, right for the previous one.
// The screen follows the finger, and springs back if the swipe is short.
// Nothing starts on set rows, inputs or other swipeable things, so logging is never interrupted.

const EDGE = 24; // px from the left edge that starts a back swipe
const GO = 80; // px of travel that commits

function backButton() {
  return document.querySelector('header.top .back, .wb-back, .hero-btn[data-a="ex-close"]');
}

export function initGestures() {
  let g = null;
  const main = () => document.getElementById('main');
  const blocked = () => document.body.classList.contains('is-dragging') || !document.getElementById('sheet').hidden || document.getElementById('tour');

  document.addEventListener('touchstart', (e) => {
    if (g || blocked() || e.touches.length > 1) return;
    const t = e.touches[0];
    const edge = t.clientX < EDGE && !!backButton();
    const onEx = !edge && !!document.querySelector('.ex-screen') && !e.target.closest('.set-row, input, textarea, select, [data-swipe], .warmup, .segmented, .set-table');
    if (!edge && !onEx) return;
    g = { x0: t.clientX, y0: t.clientY, edge, onEx, active: false, dx: 0 };
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { g = null; return; } // a scroll
      if (Math.abs(dx) < 14) return;
      if (g.edge && dx < 0) { g = null; return; }
      g.active = true;
      main().style.transition = 'none';
    }
    // Resistance when there's nowhere to go in that direction.
    const can = g.edge || (dx < 0 ? !!document.querySelector('.ex-nav [data-a="ex-go"].primary') : !!document.querySelector('.ex-nav .prev-ex'));
    g.dx = can ? dx : dx * 0.25;
    main().style.transform = `translateX(${g.dx}px)`;
    main().style.opacity = String(1 - Math.min(0.35, Math.abs(g.dx) / 900));
  }, { passive: true });

  const end = () => {
    if (!g) return;
    const { active, dx, edge } = g;
    g = null;
    const el = main();
    if (!active) return;
    const reset = () => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; };
    let target = null;
    if (edge && dx > GO) target = backButton();
    else if (!edge && dx < -GO) target = document.querySelector('.ex-nav [data-a="ex-go"].primary');
    else if (!edge && dx > GO) target = document.querySelector('.ex-nav .prev-ex');
    if (target) { el.style.transition = 'none'; reset(); target.click(); return; }
    el.style.transition = 'transform .28s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity .2s ease';
    el.style.transform = '';
    el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; }, 300);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
