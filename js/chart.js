// Minimal SVG line chart: one y-axis, up to 2 series, crosshair + tooltip on touch/hover.
// points: [{ x: 'YYYY-MM-DD', values: [v1, v2] }]; series: [{ name, cls }]

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 5; max += 5; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(2));
  return ticks;
}

const fmtDate = (s) => {
  const [, m, d] = s.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export function lineChart(el, { points, series, unit = 'lb', height = 200 }) {
  if (!points.length) {
    el.innerHTML = '<p class="muted small">No data yet.</p>';
    return;
  }
  const W = 360;
  const H = height;
  const pad = { l: 40, r: 16, t: 12, b: 24 };
  const all = points.flatMap((p) => p.values).filter((v) => v != null);
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const n = points.length;
  const x = (i) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

  const grid = ticks.map((t) => `
    <line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/>
    <text class="axis" x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');

  const labelIdx = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
  const xLabels = [...new Set(labelIdx)].map((i) =>
    `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}">${fmtDate(points[i].x)}</text>`).join('');

  const lines = series.map((s, si) => {
    const pts = points.map((p, i) => (p.values[si] == null ? null : [x(i), y(p.values[si])])).filter(Boolean);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const dots = n <= 30 ? pts.map((p) => `<circle class="dot ${s.cls}" cx="${p[0]}" cy="${p[1]}" r="4"/>`).join('') : '';
    return `<path class="line ${s.cls}" d="${d}"/>${dots}`;
  }).join('');

  const legend = series.length > 1
    ? `<div class="legend">${series.map((s) => `<span><i class="swatch ${s.cls}"></i>${esc(s.name)}</span>`).join('')}</div>`
    : '';

  el.innerHTML = `${legend}
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(series.map((s) => s.name).join(' and '))} over time">
        ${grid}${xLabels}${lines}
        <line class="crosshair" y1="${pad.t}" y2="${H - pad.b}" x1="0" x2="0" style="display:none"/>
        <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>
      </svg>
      <div class="tooltip" hidden></div>
    </div>`;

  const svg = el.querySelector('svg');
  const cross = el.querySelector('.crosshair');
  const tip = el.querySelector('.tooltip');
  const show = (evt) => {
    const r = svg.getBoundingClientRect();
    const sx = ((evt.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i;
    const p = points[best];
    cross.setAttribute('x1', x(best));
    cross.setAttribute('x2', x(best));
    cross.style.display = '';
    tip.hidden = false;
    tip.innerHTML = `<b>${fmtDate(p.x)}</b>${series.map((s, si) => p.values[si] == null ? '' :
      `<div><i class="swatch ${s.cls}"></i>${esc(s.name)}: ${Math.round(p.values[si] * 10) / 10}${unit ? ' ' + unit : ''}</div>`).join('')}`;
    const px = (x(best) / W) * r.width;
    tip.style.left = `${Math.min(Math.max(px - 70, 0), r.width - 140)}px`;
  };
  const hide = () => { cross.style.display = 'none'; tip.hidden = true; };
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerleave', hide);
}
