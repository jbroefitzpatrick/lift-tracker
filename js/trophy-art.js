// Trophy artwork: plates for strength, medals for runs and races, laurel wreaths for streaks.
// One set of gradients lives in the page (added once); each trophy is a small SVG that refers to it.
// Light comes from the top left: a gradient face, a raised ring, a chrome hub, a highlight.

const PLATE = { 1: ['#ffffff', '#ecebe6', '#b9b8b0', '#3a3a36'], 2: ['#4fd18a', '#1d8a4e', '#0b4527', '#fff'], 3: ['#ffe98f', '#f2c21b', '#9c7600', '#3a2c00'], 4: ['#6fa6f5', '#1f5fbf', '#0b2f66', '#fff'], 5: ['#ff7a82', '#d3232e', '#7a0f16', '#fff'] };
// Metal by tier: bronze, silver, gold, platinum, and the champion's gold (with red).
const METAL = { 1: ['#ffd2a6', '#b8733a', '#5a3012', '#3b1f0a'], 2: ['#ffffff', '#c3c8ce', '#6b727a', '#2a2e33'], 3: ['#fff6c4', '#e3b341', '#7d5a08', '#4a3504'], 4: ['#ffffff', '#cfe0ea', '#6d8796', '#24343d'], 5: ['#fff3b0', '#e8b21e', '#6b4a00', '#3d2a00'] };
const RIBBON = { 1: '#1f3f73', 2: '#1f3f73', 3: '#1f3f73', 4: '#1f3f73', 5: '#c21e29' };

export function ensureTrophyDefs() {
  if (typeof document === 'undefined' || document.getElementById('trophy-defs')) return;
  const stops = (c) => `<stop offset="0" stop-color="${c[0]}"/><stop offset="0.55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/>`;
  const svg = `<svg id="trophy-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    ${Object.entries(PLATE).map(([k, c]) => `<radialGradient id="tp${k}" cx="0.38" cy="0.32" r="0.75">${stops(c)}</radialGradient>`).join('')}
    ${Object.entries(METAL).map(([k, c]) => `<radialGradient id="tm${k}" cx="0.35" cy="0.3" r="0.8">${stops(c)}</radialGradient><linearGradient id="tl${k}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="0.5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>`).join('')}
    <linearGradient id="tchrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#9aa0a7"/><stop offset="0.6" stop-color="#e6e9ec"/><stop offset="1" stop-color="#5d636a"/></linearGradient>
    <linearGradient id="tspec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs></svg>`;
  document.body.insertAdjacentHTML('afterbegin', svg);
}

const plate = (t, s) => { const c = PLATE[t.tier] || PLATE[1]; const big = t.label.length > 4; return `<svg class="tro-art" viewBox="0 0 56 56" width="${s}" height="${s}" aria-hidden="true">
  <circle cx="28.6" cy="29.2" r="26.5" fill="#000" opacity="0.3"/>
  <circle cx="28" cy="28" r="26.5" fill="url(#tp${t.tier})" stroke="#06080a" stroke-width="0.8"/>
  <circle cx="28" cy="28" r="19.6" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="1.4"/>
  <circle cx="28" cy="28" r="18.4" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="0.6"/>
  <text x="28" y="${t.unit ? 46 : 47.5}" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="900" font-size="${big ? 5 : 5.6}" fill="${c[3]}" fill-opacity="0.88">${t.label}</text>
  ${t.unit ? `<text x="28" y="12.4" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="3.4" letter-spacing="0.5" fill="${c[3]}" fill-opacity="0.7">${t.unit}</text>` : ''}
  <circle cx="28" cy="28" r="7.6" fill="url(#tchrome)" stroke="#2a2d31" stroke-width="0.6"/>
  <circle cx="28" cy="28" r="3.2" fill="#111215"/>
  <path d="M9 21 A20 20 0 0 1 30 6.5 A22 14 0 0 0 9 21 Z" fill="url(#tspec)" opacity="0.9"/></svg>`; };

const medal = (t, s) => { const c = METAL[t.tier] || METAL[1]; const r = RIBBON[t.tier] || RIBBON[1]; const unit = t.unit === 'RACES' && t.label === '1' ? 'RACE' : t.unit; return `<svg class="tro-art" viewBox="0 0 60 82" width="${Math.round(s * 0.8)}" height="${Math.round(s * 1.1)}" aria-hidden="true">
  <path d="M14 0 H27 L33 30 H22 Z" fill="${r}"/><path d="M46 0 H33 L27 30 H38 Z" fill="${r}"/><path d="M46 0 H33 L27 30 H38 Z" fill="#000" opacity="0.25"/>
  <path d="M19 0 H22 L27.4 26 H24.6 Z" fill="#fff" opacity="${t.tier === 5 ? 0.85 : 0.5}"/><path d="M41 0 H38 L32.6 26 H35.4 Z" fill="#fff" opacity="${t.tier === 5 ? 0.6 : 0.35}"/>
  <rect x="22" y="26" width="16" height="6" rx="1.5" fill="url(#tm${t.tier})" stroke="#000" stroke-opacity="0.4" stroke-width="0.5"/>
  <circle cx="30.7" cy="55.7" r="22" fill="#000" opacity="0.3"/>
  <circle cx="30" cy="55" r="22" fill="url(#tm${t.tier})" stroke="#000" stroke-opacity="0.45" stroke-width="0.8"/>
  <circle cx="30" cy="55" r="17" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1.2"/>
  <circle cx="30" cy="55" r="16" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="0.6"/>
  <text x="30" y="58.5" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="900" font-size="${t.label.length > 4 ? 8.5 : 10}" fill="${c[3]}" fill-opacity="0.8">${t.label}</text>
  <text x="30" y="66" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="4" letter-spacing="0.5" fill="${c[3]}" fill-opacity="0.7">${unit}</text>
  <path d="M12 47 A19 19 0 0 1 34 34 A22 13 0 0 0 12 47 Z" fill="url(#tspec)" opacity="0.9"/></svg>`; };

// Laurel: two branches of leaves around the number, open at the top; a red bow on the rarest.
const LEAVES = (() => { let out = ''; for (let i = 0; i < 8; i++) { const a = 200 + i * 18.5; out += `<g transform="rotate(${a} 30 30)"><ellipse cx="30" cy="5.5" rx="2.3" ry="4.6" transform="rotate(28 30 5.5)"/></g><g transform="rotate(${360 - a} 30 30)"><ellipse cx="30" cy="5.5" rx="2.3" ry="4.6" transform="rotate(-28 30 5.5)"/></g>`; } return out; })();
const laurel = (t, s) => { const c = METAL[t.tier] || METAL[1]; return `<svg class="tro-art" viewBox="0 0 60 60" width="${s}" height="${s}" aria-hidden="true">
  <g fill="#000" opacity="0.3" transform="translate(0.6 1)">${LEAVES}</g>
  <g fill="url(#tl${t.tier})" stroke="${c[2]}" stroke-width="0.3">${LEAVES}</g>
  ${t.tier === 5 ? '<path d="M24 54 L30 50 L36 54 L35 58 L30 55 L25 58 Z" fill="#c21e29" stroke="#6e0d13" stroke-width="0.4"/>' : ''}
  <text x="30" y="${t.label.length > 2 ? 34 : 35}" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="900" font-size="${t.label.length > 2 ? 13 : 16}" fill="currentColor">${t.label}</text>
  <text x="30" y="41.5" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="3.8" letter-spacing="0.6" fill="currentColor" opacity="0.65">WEEKS</text></svg>`; };

export function trophySvg(t, size = 56) {
  ensureTrophyDefs();
  return t.shape === 'medal' ? medal(t, size) : t.shape === 'laurel' ? laurel(t, size) : plate(t, size);
}
