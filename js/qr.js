// QR codes for invite links (ISO/IEC 18004): byte mode, error correction level M, versions 1–10
// (up to 213 bytes, plenty for a link). Returns the module matrix; qrSvg draws it.

// Error correction for level M: [codewords per block, blocks in group 1, data per block, blocks in group 2, data per block].
const EC_M = [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// GF(256) arithmetic with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1.
const EXP = new Uint8Array(512); const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function rsEncode(data, n) {
  const g = rsGenerator(n);
  const res = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = res[i];
    if (c) for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], c);
  }
  return res.slice(data.length);
}

function dataCodewords(bytes, v) {
  const [ec, b1, d1, b2, d2] = EC_M[v];
  const cap = b1 * d1 + b2 * d2;
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(0b0100, 4); put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0; words.length < cap; pad++) words.push(pad % 2 ? 0x11 : 0xec);
  // Split into blocks, add error correction, interleave.
  const blocks = []; let k = 0;
  for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d2; blocks.push(words.slice(k, k + n)); k += n; }
  const ecs = blocks.map((b) => rsEncode(b, ec));
  const out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

// Format bits: 5 data bits + 10 BCH bits, masked. Version bits: 6 data bits + 12 BCH bits.
const formatBits = (mask) => { const data = (0 << 3) | mask; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); return ((data << 10) | rem) ^ 0x5412; };
const versionBits = (v) => { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); return (v << 12) | rem; };

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v <= 10 && (EC_M[v][1] * EC_M[v][2] + EC_M[v][3] * EC_M[v][4]) < bytes.length + (v < 10 ? 2 : 3)) v++;
  if (v > 10) throw new Error('Too long for a QR code here.');
  const size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null)); // null = free
  const set = (r, c, val) => { m[r][c] = val ? 1 : 0; };
  const finder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const rr = r + i; const cc = c + j; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue; const on = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)); set(rr, cc, on); } };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[v];
  const lastA = al.length - 1;
  al.forEach((r, i) => al.forEach((c, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === lastA) || (i === lastA && j === 0)) return; // under a finder
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) set(r + a, c + b, Math.max(Math.abs(a), Math.abs(b)) !== 1);
  }));
  set(size - 8, 8, 1); // dark module
  // Reserve format and version areas.
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) m[8][i] = 2; if (m[i][8] === null) m[i][8] = 2; }
  for (let i = 0; i < 8; i++) { if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 2; if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 2; }
  if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { m[i][size - 11 + j] = 2; m[size - 11 + j][i] = 2; }
  const reserved = m.map((row) => row.map((x) => x !== null));
  // Data, in the zigzag order.
  const cw = dataCodewords(bytes, v);
  const bits = cw.flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (b >> i) & 1));
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let n = 0; n < size; n++) {
      const r = upward ? size - 1 - n : n;
      for (const c of [right, right - 1]) if (!reserved[r][c]) m[r][c] = bi < bits.length ? bits[bi++] : 0;
    }
  }
  // Try the eight masks; keep the one with the lowest penalty.
  const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  let best = null;
  for (let k = 0; k < 8; k++) {
    const t = m.map((row, r) => row.map((x, c) => (reserved[r][c] ? x : x ^ (MASKS[k](r, c) ? 1 : 0))));
    // Format bits: level M (00) and the mask.
    const f = formatBits(k);
    const bit = (i) => (f >> i) & 1;
    for (let i = 0; i <= 5; i++) t[i][8] = bit(i);
    t[7][8] = bit(6); t[8][8] = bit(7); t[8][7] = bit(8);
    for (let i = 9; i < 15; i++) t[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) t[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) t[size - 15 + i][8] = bit(i);
    t[size - 8][8] = 1;
    if (v >= 7) {
      const vi = versionBits(v);
      for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1; t[Math.floor(i / 3)][size - 11 + (i % 3)] = b; t[size - 11 + (i % 3)][Math.floor(i / 3)] = b; }
    }
    const p = penalty(t);
    if (!best || p < best.p) best = { p, t };
  }
  return best.t.map((row) => row.map((x) => x === 1));
}

function penalty(t) {
  const n = t.length; let p = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    let run = 1;
    for (let j = 1; j < n; j++) {
      const a = pass ? t[j][i] : t[i][j]; const b = pass ? t[j - 1][i] : t[i][j - 1];
      if (a === b) { run++; if (j === n - 1 && run >= 5) p += run - 2; } else { if (run >= 5) p += run - 2; run = 1; }
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) if (t[i][j] === t[i + 1][j] && t[i][j] === t[i][j + 1] && t[i][j] === t[i + 1][j + 1]) p += 3;
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]; const rev = [...pat].reverse();
  for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) for (const pt of [pat, rev]) {
    if (pt.every((b, k) => t[i][j + k] === b)) p += 40;
    if (pt.every((b, k) => t[j + k][i] === b)) p += 40;
  }
  const dark = t.flat().filter((x) => x === 1).length;
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

// An SVG for the code, with a quiet zone of four modules.
export function qrSvg(text, { dark = '#141518', light = '#ffffff' } = {}) {
  const m = qrMatrix(text);
  const n = m.length; const q = 4; const s = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${s} ${s}" role="img" aria-label="QR code for the invite link" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
