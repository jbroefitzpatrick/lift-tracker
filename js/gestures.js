// Swipe gestures, since a home-screen web app doesn't get iPhone's own.
//   On any screen with a back button: swipe right to go back, from the edge or anywhere else.
//   On the exercise screen: swipe left for the next exercise, right for the previous one.
// The screen follows the finger, and springs back if the swipe is short.
// Nothing starts on set rows, inputs or other swipeable things, so logging is never interrupted.

const EDGE = 24; // px from the left edge that starts a back swipe
const GO = 80; // px of travel that commits

function backButton() {
  return document.querySelector('header.top .back, .wb-back, .station-back');
}

// Things that use a sideways drag themselves.
const OWN_DRAG = '.set-row, input, textarea, select, [data-swipe], .warmup, .segmented, .set-table, .chips, .cmp, .stepper, .body-dial, canvas, .day-strip, .week-strip';
function scrollsSideways(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}

export function initGestures() {
  let g = null;
  const main = () => document.getElementById('main');
  const blocked = () => document.body.classList.contains('is-dragging') || !document.getElementById('sheet').hidden || document.getElementById('tour');

  document.addEventListener('touchstart', (e) => {
    if (g || blocked() || e.touches.length > 1) return;
    const t = e.touches[0];
    const free = !e.target.closest(OWN_DRAG) && !scrollsSideways(e.target);
    const onEx = !!document.querySelector('.ex-screen') && free;
    // The edge always means back; elsewhere a right swipe does too, except between exercises.
    const edge = !!backButton() && (t.clientX < EDGE || (free && !onEx));
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
    const can = g.edge || (dx < 0 ? !!document.querySelector('.ex-nav [data-a="ex-go"].primary') : !!document.querySelector('.ex-nav .prev-ex') || !!backButton());
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
    else if (!edge && dx > GO) target = document.querySelector('.ex-nav .prev-ex') || backButton(); // first exercise: back to the workout
    if (target) { el.style.transition = 'none'; reset(); target.click(); return; }
    el.style.transition = 'transform .28s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity .2s ease';
    el.style.transform = '';
    el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; }, 300);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
