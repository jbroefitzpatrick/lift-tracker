// Drag-to-reorder for lists (today's exercises, plan days).
//
// Markup:  item:   data-drag-item data-drag-list="<list>" data-drag-id="<id>"
//          handle: <button data-drag-handle> inside the item
// Register a handler with onReorder(list, (id, toIndex) => {...}).
//
// Accessibility: the handle is a real button. Arrow Up/Down moves the item one place and the
// new position is announced, so dragging is never the only way to reorder (WCAG 2.2, 2.5.7).
// Each item's menu also offers Move up / Move later.

const handlers = {};
export function onReorder(list, fn) { handlers[list] = fn; }

let st = null;
let announce = () => {};
export function setAnnouncer(fn) { announce = fn; }

function itemsOf(list) {
  return [...document.querySelectorAll(`[data-drag-item][data-drag-list="${list}"]`)];
}

function finish(commit) {
  if (!st) return;
  const { item, indicator, list, id, to, from } = st;
  item.classList.remove('dragging');
  item.style.transform = '';
  indicator.remove();
  document.body.classList.remove('is-dragging');
  st = null;
  if (commit && to !== from && handlers[list]) {
    handlers[list](id, to);
    announce(`Moved to position ${to + 1}`);
  }
}

document.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('[data-drag-handle]');
  if (!handle || e.button > 0) return;
  const item = handle.closest('[data-drag-item]');
  if (!item) return;
  e.preventDefault();
  const list = item.dataset.dragList;
  const items = itemsOf(list);
  const sy = window.scrollY;
  const indicator = document.createElement('div');
  indicator.className = 'drop-line';
  document.body.appendChild(indicator);
  handle.setPointerCapture?.(e.pointerId);
  st = {
    handle, item, list, id: item.dataset.dragId, items, indicator,
    from: items.indexOf(item), to: items.indexOf(item), startY: e.clientY, sy,
    mids: items.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + sy, bottom: r.bottom + sy, left: r.left, width: r.width }; }),
  };
  item.classList.add('dragging');
  document.body.classList.add('is-dragging');
});

document.addEventListener('pointermove', (e) => {
  if (!st) return;
  const dy = e.clientY - st.startY + (window.scrollY - st.sy);
  st.item.style.transform = `translateY(${dy}px)`;
  const y = e.clientY + window.scrollY;
  const others = st.mids.map((m, i) => ({ ...m, i })).filter((m) => m.i !== st.from);
  let to = others.filter((m) => (m.top + m.bottom) / 2 < y).length;
  to = Math.max(0, Math.min(others.length, to));
  st.to = to;
  // Drop line goes above the item that will follow, or below the last one.
  const anchor = others[to] ? others[to].top - 6 : (others[others.length - 1]?.bottom ?? st.mids[st.from].bottom) + 4;
  const ref = others[to] || others[others.length - 1] || st.mids[st.from];
  Object.assign(st.indicator.style, { top: `${anchor}px`, left: `${ref.left}px`, width: `${ref.width}px` });
  // Auto-scroll near the edges.
  if (e.clientY < 90) window.scrollBy(0, -14);
  else if (e.clientY > window.innerHeight - 150) window.scrollBy(0, 14);
});

document.addEventListener('pointerup', () => finish(true));
document.addEventListener('pointercancel', () => finish(false));

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
  handlers[list](id, to);
  announce(`Moved to position ${to + 1} of ${items.length}`);
  // Keep keyboard focus on the moved item's handle after re-render.
  requestAnimationFrame(() => document.querySelector(`[data-drag-item][data-drag-id="${CSS.escape(id)}"] [data-drag-handle]`)?.focus());
});
