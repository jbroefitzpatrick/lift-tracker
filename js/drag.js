// Drag-to-reorder for lists (today's exercises, plan days).
//
// Markup:  item:   data-drag-item data-drag-list="<list>" data-drag-id="<id>"
//          handle: <button data-drag-handle> inside the item (drag starts at once)
//          data-drag-press on the item: press and hold anywhere on it to pick it up
//          data-drag-join on the item: dropping onto its middle joins it (superset/circuit)
// Register a handler with onReorder(list, (id, toIndex, { join }) => {...}).
// join is the id of the item it was dropped onto, when it was dropped onto one; before is true
// when it was dropped on that item's top half.
//
// Accessibility: the handle is a real button. Arrow Up/Down moves the item one place and the
// new position is announced, so dragging is never the only way to reorder (WCAG 2.2, 2.5.7).
// Each item's menu also offers Move up / Move later.

const handlers = {};
export function onReorder(list, fn) { handlers[list] = fn; }

let st = null;
let announce = () => {};
export function setAnnouncer(fn) { announce = fn; }

const PRESS_MS = 450; // hold this long to pick an item up
const SLOP = 8; // moving more than this before then is a scroll, not a hold
let press = null;
let swallowClick = false;

function itemsOf(list) {
  return [...document.querySelectorAll(`[data-drag-item][data-drag-list="${list}"]`)];
}

function begin(item, clientY, pointerId, captureEl) {
  const list = item.dataset.dragList;
  const items = itemsOf(list);
  const sy = window.scrollY;
  const indicator = document.createElement('div');
  indicator.className = 'drop-line';
  document.body.appendChild(indicator);
  try { captureEl.setPointerCapture?.(pointerId); } catch {}
  st = {
    item, list, id: item.dataset.dragId, items, indicator, join: null,
    from: items.indexOf(item), to: items.indexOf(item), startY: clientY, sy,
    mids: items.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + sy, bottom: r.bottom + sy, left: r.left, width: r.width }; }),
  };
  item.classList.add('dragging');
  document.body.classList.add('is-dragging');
  navigator.vibrate?.(12);
}

function finish(commit) {
  if (!st) return;
  const { item, indicator, list, id, to, from, join, before, items } = st;
  item.classList.remove('dragging');
  item.style.transform = '';
  indicator.remove();
  items.forEach((el) => el.classList.remove('drop-join'));
  document.body.classList.remove('is-dragging');
  st = null;
  swallowClick = true; // the release shouldn't also open the item
  setTimeout(() => { swallowClick = false; }, 350);
  if (!commit || !handlers[list]) return;
  if (join && join !== id) { handlers[list](id, to, { join, before }); announce('Linked'); return; }
  if (to !== from) { handlers[list](id, to, {}); announce(`Moved to position ${to + 1}`); }
}

function cancelPress() { if (press) { clearTimeout(press.t); press.item.classList.remove('pressing'); press = null; } }

document.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  const handle = e.target.closest('[data-drag-handle]');
  if (handle) {
    const item = handle.closest('[data-drag-item]');
    if (!item) return;
    e.preventDefault();
    begin(item, e.clientY, e.pointerId, handle);
    return;
  }
  const item = e.target.closest('[data-drag-item][data-drag-press]');
  if (!item || e.target.closest('input, textarea, select, [data-drag-nopress]')) return;
  cancelPress();
  press = { item, x: e.clientX, y: e.clientY, id: e.pointerId };
  item.classList.add('pressing');
  press.t = setTimeout(() => {
    if (!press) return;
    const p = press; press = null;
    p.item.classList.remove('pressing');
    begin(p.item, p.y, p.id, p.item);
  }, PRESS_MS);
});

document.addEventListener('pointermove', (e) => {
  if (press && (Math.abs(e.clientX - press.x) > SLOP || Math.abs(e.clientY - press.y) > SLOP)) cancelPress();
  if (!st) return;
  const dy = e.clientY - st.startY + (window.scrollY - st.sy);
  st.item.style.transform = `translateY(${dy}px)`;
  const y = e.clientY + window.scrollY;
  const others = st.mids.map((m, i) => ({ ...m, i })).filter((m) => m.i !== st.from);
  // Over the middle of a joinable item: drop onto it (link). Otherwise: drop between items.
  const over = others.find((m) => { const h = m.bottom - m.top; return y > m.top + h * 0.3 && y < m.bottom - h * 0.3; });
  const joinEl = over && st.items[over.i].hasAttribute('data-drag-join') && st.item.hasAttribute('data-drag-join') ? st.items[over.i] : null;
  st.items.forEach((el) => el.classList.toggle('drop-join', el === joinEl));
  st.join = joinEl ? joinEl.dataset.dragId : null;
  st.before = !!over && y < (over.top + over.bottom) / 2; // top half: go before it
  let to = others.filter((m) => (m.top + m.bottom) / 2 < y).length;
  to = Math.max(0, Math.min(others.length, to));
  st.to = to;
  st.indicator.hidden = !!joinEl;
  // Drop line goes above the item that will follow, or below the last one.
  const anchor = others[to] ? others[to].top - 6 : (others[others.length - 1]?.bottom ?? st.mids[st.from].bottom) + 4;
  const ref = others[to] || others[others.length - 1] || st.mids[st.from];
  Object.assign(st.indicator.style, { top: `${anchor}px`, left: `${ref.left}px`, width: `${ref.width}px` });
  // Auto-scroll near the edges.
  if (e.clientY < 90) window.scrollBy(0, -14);
  else if (e.clientY > window.innerHeight - 150) window.scrollBy(0, 14);
});

document.addEventListener('pointerup', () => { cancelPress(); finish(true); });
document.addEventListener('pointercancel', () => { cancelPress(); finish(false); });
// While dragging, the finger moves the item, not the page.
document.addEventListener('touchmove', (e) => { if (st) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => { if (st || press) e.preventDefault(); });
document.addEventListener('click', (e) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; } }, true);

document.addEventListener('keydown', (e) => {
  const handle = e.target.closest?.('[data-drag-handle]');
  if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  const item = handle.closest('[data-drag-item]');
  const list = item.dataset.dragList;
  const items = itemsOf(list);
  const from = items.indexOf(item);
  const to = from + (e.key === 'ArrowUp' ? -1 : 1);
  if (to < 0 || to >= items.length || !handlers[list]) return;
  e.preventDefault();
  const id = item.dataset.dragId;
  handlers[list](id, to, {});
  announce(`Moved to position ${to + 1} of ${items.length}`);
  // Keep keyboard focus on the moved item's handle after re-render.
  requestAnimationFrame(() => document.querySelector(`[data-drag-item][data-drag-id="${CSS.escape(id)}"] [data-drag-handle]`)?.focus());
});
