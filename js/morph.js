// Update a container to match new HTML by changing only what differs, instead of replacing it.
// This keeps the scroll position, focus, open sections, images (no reload) and typed text steady,
// so tapping a button doesn't make the screen flash or jump.
//
// Matching is by position, with keys (id, data-uid, data-id, data-drag-id) deciding whether two
// elements are "the same thing". Different keys or tags: the old node is replaced.

const keyOf = (n) => (n.nodeType === 1 ? n.id || n.getAttribute('data-uid') || n.getAttribute('data-drag-id') || n.getAttribute('data-id') || '' : '');

function same(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return a.tagName === b.tagName && keyOf(a) === keyOf(b);
}

function syncAttrs(a, b) {
  for (const { name } of [...a.attributes]) {
    if (!b.hasAttribute(name)) {
      if (name === 'open' && a.tagName === 'DETAILS') continue; // a section the user opened stays open
      a.removeAttribute(name);
    }
  }
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  // Form fields: their live state is a property, not the attribute.
  if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') {
    if (document.activeElement !== a) {
      if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
      else if (a.tagName === 'SELECT') { const sel = b.querySelector('option[selected]'); if (sel) a.value = sel.value; }
      else a.value = a.tagName === 'TEXTAREA' ? b.textContent : (b.getAttribute('value') ?? '');
    }
  }
}

function patch(a, b) {
  if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  syncAttrs(a, b);
  if (a.tagName === 'TEXTAREA') return;
  morphChildren(a, b);
}

function morphChildren(from, to) {
  const a = [...from.childNodes];
  const b = [...to.childNodes];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (!y) { x.remove(); continue; }
    if (!x) { from.appendChild(y); continue; }
    if (same(x, y)) patch(x, y);
    else from.replaceChild(y, x);
  }
}

export function morph(el, html) {
  const tpl = document.createElement(el.tagName === 'svg' ? 'div' : el.tagName);
  tpl.innerHTML = html;
  morphChildren(el, tpl);
}
