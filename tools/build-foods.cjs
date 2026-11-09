// Usage: node usda-find.cjs <srDir> <queries.json> [--build out.json]
// Prints the USDA match for each query; with --build, writes a compact food list.
const fs = require('fs');
const dir = process.argv[2];
function csv(file) {
  const txt = fs.readFileSync(dir + '/' + file, 'utf8'); const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  const [h, ...rest] = rows; return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const foods = csv('food.csv');
const queries = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const picked = {};
for (const [key, spec] of Object.entries(queries)) {
  const [pattern, label, cat] = spec;
  const re = new RegExp(pattern, 'i');
  const m = foods.filter((f) => re.test(f.description));
  if (!process.argv.includes('--build')) console.log(key, '=>', m.length ? m.slice(0, 3).map((f) => `${f.fdc_id}: ${f.description}`).join(' || ') : 'NONE');
  if (m.length) picked[key] = { fdc: m[0].fdc_id, desc: m[0].description, label, cat };
}
if (process.argv.includes('--build')) {
  const ids = new Set(Object.values(picked).map((p) => p.fdc));
  const NUT = { 1008: 'kcal', 1003: 'p', 1004: 'f', 1005: 'c', 1079: 'fiber' };
  const fn = csv('food_nutrient.csv');
  const vals = {};
  for (const r of fn) if (ids.has(r.fdc_id) && NUT[r.nutrient_id]) (vals[r.fdc_id] ||= {})[NUT[r.nutrient_id]] = +r.amount;
  const units = Object.fromEntries(csv('measure_unit.csv').map((u) => [u.id, u.name]));
  const portions = {};
  for (const r of csv('food_portion.csv')) {
    if (!ids.has(r.fdc_id)) continue;
    const amt = +r.amount || 1;
    const unit = units[r.measure_unit_id] && units[r.measure_unit_id] !== 'undetermined' ? units[r.measure_unit_id] : '';
    const name = [amt !== 1 || unit ? amt : '', unit, r.modifier || r.portion_description].filter(Boolean).join(' ').trim();
    (portions[r.fdc_id] ||= []).push([name || 'serving', Math.round(+r.gram_weight * 10) / 10]);
  }
  const out = Object.entries(picked).map(([id, p]) => {
    const v = vals[p.fdc] || {};
    const r1 = (x) => Math.round((x || 0) * 10) / 10;
    return { id, name: p.label, cat: p.cat, fdc: +p.fdc, per100: { kcal: Math.round(v.kcal || 0), p: r1(v.p), c: r1(v.c), f: r1(v.f), fiber: r1(v.fiber) }, portions: (portions[p.fdc] || []).slice(0, 4) };
  });
  fs.writeFileSync(process.argv[process.argv.indexOf('--build') + 1], JSON.stringify(out));
  console.log('built', out.length, 'missing nutrients:', out.filter((o) => !o.per100.kcal).map((o) => o.id).join(','));
}
