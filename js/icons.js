// Line icons (24×24, 1.8 stroke), drawn to match iOS SF Symbols in weight and proportion.
// Usage: icon('more') → inline <svg>. Icons are decorative (aria-hidden); buttons carry the label.

const P = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  body: '<circle cx="12" cy="5" r="2.2"/><path d="M5 9.5h14M12 9.5v5.5M12 15l-3.5 6M12 15l3.5 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  copy: '<path d="M9 9h10v11H9zM5 15V4h10"/>',
  bookmark: '<path d="M7 4h10v16l-5-4-5 4z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  grip: '<path d="M5 9h14M5 15h14"/>',
  gear: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  note: '<path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  star: '<path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 16.8 7.1 19.5l.9-5.6-4-3.9 5.5-.8z"/>',
  starFill: '<path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 16.8 7.1 19.5l.9-5.6-4-3.9 5.5-.8z" fill="currentColor"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"/>',
  undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>',
  calendar: '<path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}
