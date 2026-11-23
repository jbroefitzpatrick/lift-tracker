// What kind of equipment an exercise uses, its colored family plate, and a drawing of the load:
// plates on a bar, a pair of dumbbells, a pinned stack, a cable, a machine horn, a belt or a bell.

import { platesFor, weightStep } from './gym.js';
import { PLATE_PER_SIDE } from './bank.js';
import { toDisp } from './units.js';

// Machines loaded with plates by hand; every other machine has a pin stack.
const LOADED = /plate|leverage|iso-|hack|leg press|t-bar|landmine|belt squat|pendulum|v-squat/i;

export function kindOf(ex) {
  if (!ex) return 'bw';
  if (ex.category === 'conditioning') return ['mobility', 'prehab'].includes(ex.pattern) ? 'mob' : ex.metric === 'reps' && ex.type === 'bodyweight' ? 'bw' : ex.pattern === 'isometric' ? 'hold' : 'cardio';
  if (String(ex.id).startsWith('kb-') || /kettlebell/i.test(ex.name)) return 'kb';
  if (ex.type?.startsWith('barbell')) return 'bar';
  if (ex.type === 'dumbbell') return 'db';
  if (ex.type === 'cable') return 'cable';
  if (ex.type === 'machine') { const n = `${ex.id} ${ex.name}`; return /smith/i.test(n) ? 'smith' : LOADED.test(n) ? 'peg' : 'stack'; }
  return 'bw';
}

export const FAMILIES = {
  bar: { c: '#1f5fbf', ink: '#fff', name: 'Barbell', g: 'M2 12h20M6 7v10M9 5v14M18 7v10M15 5v14' },
  db: { c: '#1d8a4e', ink: '#fff', name: 'Dumbbell or kettlebell', g: 'M8 12h8M5 8v8M8 6v12M16 6v12M19 8v8' },
  mach: { c: '#f2c21b', ink: '#141518', name: 'Machine or cable', g: 'M5 5h12M5 9h12M5 13h12M5 17h12M17 13h4' },
  body: { c: '#f4f4f1', ink: '#141518', name: 'Bodyweight', g: 'M12 8v7M7 11h10M12 15l-4 6M12 15l4 6M12 3a2 2 0 1 0 .01 0' },
  cardio: { c: '#d3232e', ink: '#fff', name: 'Cardio', g: 'M2 12h5l2-6 4 12 2-6h7' },
  mob: { c: '#2b2d31', ink: '#fff', name: 'Warm-up or mobility', g: 'M3 15c4-9 6 7 10-2s4 1 8-2' },
};
const FAMILY_OF = { bar: 'bar', db: 'db', kb: 'db', stack: 'mach', cable: 'mach', peg: 'mach', smith: 'mach', bw: 'body', hold: 'body', cardio: 'cardio', mob: 'mob' };
export const familyOf = (ex) => FAMILY_OF[kindOf(ex)];

export function familyDisc(ex, size = 22) {
  const f = FAMILIES[familyOf(ex)];
  return `<svg class="fam-disc" width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="${f.name}"><circle cx="12" cy="12" r="11.2" fill="${f.c}" stroke="#141518" stroke-width="1.2"/><g transform="translate(4.2 4.2) scale(.65)" fill="none" stroke="${f.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${f.g}"/></g></svg>`;
}

// ---------- Drawings ----------
// Plate colors follow competition plates, in pounds or kilograms (stored in pounds).
function plateLook(lb) {
  if (lb >= 50) return { c: '#d3232e', ink: '#fff', h: 104, w: 21 };
  if (lb >= 40) return { c: '#1f5fbf', ink: '#fff', h: 98, w: 20 };
  if (lb >= 30) return { c: '#f2c21b', ink: '#141518', h: 85, w: 18 };
  if (lb >= 20) return { c: '#1d8a4e', ink: '#fff', h: 72, w: 16 };
  if (lb >= 9) return { c: '#f4f4f1', ink: '#141518', h: 52, w: 11 };
  if (lb >= 4) return { c: '#2b2d31', ink: '#fff', h: 41, w: 9 };
  return { c: '#c3c7cc', ink: '#141518', h: 32, w: 6 };
}
const svg = (inner, label) => `<svg class="load-art" viewBox="0 0 320 112" role="img" aria-label="${label}">${inner}</svg>`;
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" fill="${o.f || 'var(--text)'}" font-size="${o.z || 12}" font-weight="${o.w || 700}"${o.tr ? ` transform="${o.tr}"` : ''}>${s}</text>`;
function plate(x, lb, cy = 56) {
  const { c, ink, h, w } = plateLook(lb); const top = cy - h / 2;
  return `<g><rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${c}" stroke="var(--edge)" stroke-width="1.3"/><rect x="${x + 2}" y="${top + 4}" width="2.2" height="${h - 8}" rx="1" fill="#fff" opacity=".28"/><rect x="${x}" y="${cy - 10}" width="${w}" height="20" fill="#000" opacity=".16"/>${w >= 9 ? T(x + w / 2 + 3.6, top + 15, toDisp(lb), { z: w >= 14 ? 10.5 : 8.5, f: ink, w: 800, tr: `rotate(-90 ${x + w / 2} ${top + 13})` }) : ''}</g>`;
}
function run(x, list) { let out = ''; for (const p of list) { out += plate(x, p); x += plateLook(p).w + 1; } return { out, x }; }
const sleeve = (x) => `<rect x="${x}" y="49" width="${316 - x}" height="14" rx="2" fill="var(--steel)" stroke="var(--edge)"/><rect x="${x}" y="51" width="${316 - x}" height="2" fill="#fff" opacity=".35"/>`;
const eachSide = T(316, 104, 'each side', { a: 'end' });

function drawBar(list) {
  const r = run(70, list);
  let knurl = ''; for (let i = 4; i < 54; i += 3) knurl += `<path d="M${i} 52l3 8M${i + 3} 52l-3 8" stroke="var(--text)" stroke-width=".5" opacity=".55"/>`;
  return svg(`<rect x="0" y="52.5" width="58" height="7" fill="var(--bar)"/>${knurl}<rect x="56" y="43" width="12" height="26" rx="2" fill="var(--steel)" stroke="var(--edge)"/>${sleeve(68)}${r.out}${list.length ? `<rect x="${r.x}" y="47" width="7" height="18" rx="2" fill="var(--steel)" stroke="var(--edge)"/>` : ''}${eachSide}`, `One side of a barbell${list.length ? ` with ${list.map(toDisp).join(', ')} on it` : ', empty'}`);
}
function drawSmith(list) {
  const r = run(70, list);
  return svg(`<rect x="22" y="0" width="7" height="112" fill="var(--steel)" stroke="var(--edge)"/><rect x="14" y="44" width="24" height="24" rx="3" fill="var(--iron)" stroke="var(--edge)"/><rect x="0" y="52.5" width="60" height="7" fill="var(--bar)"/><rect x="56" y="43" width="12" height="26" rx="2" fill="var(--steel)" stroke="var(--edge)"/>${sleeve(68)}${r.out}${eachSide}`, `Smith machine${list.length ? ` with ${list.map(toDisp).join(', ')} each side` : ', empty'}`);
}
function drawPeg(list) {
  const r = run(72, list);
  return svg(`<path d="M2 106L44 18h16L24 106z" fill="var(--surface-3)" stroke="var(--edge)"/><rect x="28" y="34" width="38" height="44" rx="3" fill="var(--iron)" stroke="var(--edge)"/><circle cx="47" cy="56" r="6" fill="var(--steel)" stroke="var(--edge)"/>${sleeve(66)}${r.out}${eachSide}`, `Machine horn${list.length ? ` with ${list.map(toDisp).join(', ')} each side` : ', empty'}`);
}
function drawDumbbell(lb) {
  const v = toDisp(lb); const hh = Math.min(100, 50 + lb * 0.46); const hw = Math.min(62, 30 + lb * 0.3); const cx = 160; const g = 44;
  const head = (x, d) => { const c = hh * .24; const n = x + d * hw; return `<polygon points="${x},${56 - hh / 2 + c} ${x + d * 5},${56 - hh / 2} ${n - d * 5},${56 - hh / 2} ${n},${56 - hh / 2 + c} ${n},${56 + hh / 2 - c} ${n - d * 5},${56 + hh / 2} ${x + d * 5},${56 + hh / 2} ${x},${56 + hh / 2 - c}" fill="var(--iron)" stroke="var(--edge)" stroke-width="1.3"/><path d="M${x + d * 5} ${56 - hh / 2 + c}H${n - d * 5}M${x + d * 5} ${56 + hh / 2 - c}H${n - d * 5}" stroke="var(--iron2)" stroke-width="1.6"/>`; };
  let k = ''; for (let i = cx - 28; i < cx + 28; i += 3.4) k += `<path d="M${i} 50l3.4 12M${i + 3.4} 50l-3.4 12" stroke="var(--edge)" stroke-width=".5" opacity=".6"/>`;
  return svg(`<rect x="${cx - g}" y="50" width="${g * 2}" height="12" fill="var(--steel)" stroke="var(--edge)"/>${k}${head(cx - g, -1)}${head(cx + g, 1)}${T(cx - g - hw / 2, 62, v, { z: 17, f: '#f4f4f1', w: 900 })}${T(cx + g + hw / 2, 62, v, { z: 17, f: '#f4f4f1', w: 900 })}`, `A pair of ${v} dumbbells`);
}
function drawBell(lb) {
  const v = toDisp(lb); const r = Math.min(40, 27 + lb * 0.15); const cy = 110 - r;
  const h = `M${160 - r * .62} ${cy - r * .68}C${160 - r * .95} 6 ${160 + r * .95} 6 ${160 + r * .62} ${cy - r * .68}`;
  return svg(`<path d="${h}" fill="none" stroke="var(--edge)" stroke-width="11"/><path d="${h}" fill="none" stroke="var(--steel)" stroke-width="7.5"/><path d="M${160 - r} ${cy}a${r} ${r} 0 1 1 ${r * 2} 0c0 ${r * .62} -${r * .42} ${r} -${r * .62} ${r}h-${r * .76}c-${r * .2} 0 -${r * .62} -${r * .38} -${r * .62} -${r}z" fill="var(--iron)" stroke="var(--edge)" stroke-width="1.3"/>${T(160, cy + 7, v, { z: 20, f: '#f4f4f1', w: 900 })}`, `A ${v} kettlebell`);
}
function drawStack(lb, step, cable) {
  const stepD = step || 10; const n = Math.max(1, Math.round(lb / stepD)); const first = Math.max(1, n - 5); const x = cable ? 34 : 86; const W = 126; let out = '';
  for (let i = 0; i < 9; i++) {
    const k = first + i; const y = 7 + i * 11; const on = k <= n;
    out += `<rect x="${x}" y="${y}" width="${W}" height="10" rx="1" fill="${on ? '#1f5fbf' : 'var(--surface-3)'}" stroke="var(--edge)" stroke-width=".9"/><circle cx="${x + W / 2}" cy="${y + 5}" r="2" fill="var(--edge)"/>${T(x + W - 7, y + 8.3, Math.round(toDisp(k * stepD)), { a: 'end', z: 8.5, f: on ? '#fff' : 'var(--text)' })}`;
    if (k === n) out += `<rect x="${x + W}" y="${y + 3.4}" width="16" height="3.2" fill="#d3232e"/><circle cx="${x + W + 21}" cy="${y + 5}" r="7" fill="#d3232e" stroke="var(--edge)"/><circle cx="${x + W + 21}" cy="${y + 5}" r="2.4" fill="#fff"/>`;
  }
  const rods = `<rect x="${x + 14}" y="1" width="3" height="110" fill="var(--steel)"/><rect x="${x + W - 17}" y="1" width="3" height="110" fill="var(--steel)"/>`;
  const c = cable ? `<path d="M${x + W / 2} 7V6H284V48" fill="none" stroke="var(--bar)" stroke-width="2"/><circle cx="284" cy="15" r="10" fill="var(--surface-3)" stroke="var(--bar)" stroke-width="3"/><circle cx="284" cy="15" r="2.5" fill="var(--bar)"/><path d="M284 48l-22 30h44z" fill="none" stroke="var(--iron)" stroke-width="5" stroke-linejoin="round"/>` : '';
  return svg(rods + out + c, `Weight stack pinned at ${toDisp(lb)}`);
}
function drawBelt(lb) {
  const list = beltPlates(lb).slice(0, 3); const big = plateLook(list[0] || 25);
  let chain = ''; for (let i = 0; i < 4; i++) chain += `<rect x="156" y="${27 + i * 5}" width="8" height="7" rx="3.5" fill="none" stroke="var(--steel)" stroke-width="1.8"/>`;
  const discs = list.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => { const l = plateLook(p); return `<circle cx="${160 + i * 8}" cy="74" r="${l.h / 2.75}" fill="${l.c}" stroke="var(--edge)" stroke-width="1.3"/>`; }).join('');
  return svg(`<path d="M92 6c14 28 122 28 136 0" fill="none" stroke="var(--iron)" stroke-width="11" stroke-linecap="round"/><rect x="149" y="18" width="22" height="10" rx="2" fill="var(--steel)" stroke="var(--edge)"/>${chain}${discs}<circle cx="160" cy="74" r="4" fill="var(--steel)" stroke="var(--edge)"/>${T(160, 74 - big.h / 2.75 + 13, toDisp(lb), { z: 11, f: big.ink, w: 800 })}`, `Belt with ${toDisp(lb)} added`);
}
function beltPlates(lb) { const out = []; let left = lb; for (const p of [45, 35, 25, 10, 5, 2.5]) while (left >= p - 1e-9 && out.length < 6) { out.push(p); left -= p; } return out; }

// Plates per side for anything loaded by hand. Machines carry no bar in the count.
function sides(kind, lb, gym, perSide = false) {
  if (kind === 'peg') return platesFor((perSide ? lb * 2 : lb) + gym.barWeight, gym).perSide;
  return lb > gym.barWeight ? platesFor(lb, gym).perSide : [];
}

// The drawing and, when it adds something the number doesn't, a line about how to load it.
export function loadSetup(ex, lb, gym) {
  if (lb == null) return null;
  const k = kindOf(ex);
  if (k === 'bar' || k === 'smith' || k === 'peg') {
    const list = sides(k, lb, gym, PLATE_PER_SIDE.has(ex.id));
    return { art: k === 'bar' ? drawBar(list) : k === 'smith' ? drawSmith(list) : drawPeg(list), line: list.length ? list.map(toDisp).join(' + ') : (k === 'peg' ? 'Empty machine' : 'Empty bar'), sub: list.length ? 'on each side' : '' };
  }
  if (k === 'db') return { art: drawDumbbell(lb) };
  if (k === 'kb') return { art: drawBell(lb) };
  if (k === 'stack' || k === 'cable') return { art: drawStack(lb, weightStep(ex, gym) >= 5 ? Math.max(weightStep(ex, gym), 5) : 10, k === 'cable') };
  if (k === 'bw' && lb > 0) return { art: drawBelt(lb), line: `+ ${toDisp(lb)} on a belt` };
  return null;
}
// For the friends feed: a record's weight, drawn the same way.
export const loadArt = (ex, lb, gym) => loadSetup(ex, lb, gym)?.art || '';
