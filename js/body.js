// Stylised body map (front and back) for muscle recovery and target muscles.
// Shapes are drawn for one half of the body and mirrored. Each muscle region carries
// data-m="<muscle id>" so it can be coloured and tapped. Colour is never the only cue:
// every view that uses this map also lists the muscles with values in text.

// Left half (x < 100) of a 200 × 400 figure, drawn with smooth curves. A muscle can be several
// shapes (abs segments, the heads of the quads and calves); they share data-m, so they light up together.
const FRONT = {
  traps: 'M91 55 C86 59 78 63 69 67 C77 68.5 85 67.5 92 63.5 Z',
  'front-delts': 'M69 68 C61 69.5 55 74 52.5 81 C51.5 87 53 93 56 98 C58.5 90 62.5 83.5 69.5 79 C71.5 75 71.5 71 69 68 Z',
  'side-delts': 'M52 82.5 C47.5 87.5 45.5 95 46.5 104 C49.5 105 52.5 103 55 99.5 C52.5 94 51.5 88 52 82.5 Z',
  chest: 'M99 71 L99 109 C93 114.5 84 116.5 76 112.5 C68.5 108.5 64.5 99.5 66.5 90 C68.5 81.5 75 74.5 85 72 C90 70.8 95 70.6 99 71 Z',
  biceps: 'M53 106 C49.5 116 48 128 49.5 140 C50.5 146 53.5 149.5 57 147.5 C60 143 61 133 60.5 122 C60 115 58.5 109.5 56 104.5 Z',
  forearms: 'M48 152 C44 162 41.5 175 41.5 188 C42.5 193.5 46.5 195 49.5 191.5 C53 180 56 167 57.5 154 C55 150.5 51 150 48 152 Z',
  abs: [
    'M89.5 117 C89.5 115.8 90.3 115 91.5 115 L99 115 L99 131 L91.5 131 C90.3 131 89.5 130.2 89.5 129 Z',
    'M89.5 135 C89.5 133.8 90.3 133 91.5 133 L99 133 L99 149 L91.5 149 C90.3 149 89.5 148.2 89.5 147 Z',
    'M89.8 153 C89.8 151.8 90.6 151 91.8 151 L99 151 L99 167 L92 167 C90.8 167 90 166 90 164.8 Z',
    'M90.5 171 L99 171 L99 199 C96 197 92.5 191 91 184 C90.3 179.5 90.2 175 90.5 171 Z',
  ],
  obliques: 'M74.5 115 C72 129 72 147 75.5 164 C78 174 83 181 88.5 186 C87.3 175 86.8 163 87 151 C87.2 139 87.5 127 88 117 C83.5 117.3 79 116.6 74.5 115 Z',
  'hip-flexors': 'M85.5 189 C89 194 93.5 199 98 203.5 L96 211 C91 206.5 86.5 200.5 82.5 194 Z',
  abductors: 'M68.5 191 C66 200 66 211 67.5 221 C70.5 212 73.5 204 77.5 196.5 C74.5 194 71.5 192.5 68.5 191 Z',
  quads: [
    'M78 197.5 C71.5 214 69 238 70.5 260 C71.5 276 75.5 289 81.5 296 C83.5 272 83.5 246 82 222 C81.5 213 80 204.5 78 197.5 Z',
    'M83 207 C86.5 230 87 262 84.5 295.5 C90 299 95 295.5 96 285 C97.5 264 97.5 240 95.5 218 C92 210.5 87.5 207 83 207 Z',
  ],
  adductors: 'M96 210 C98.5 226 99.5 245 98.5 264 C96.5 256 94.5 238 92.5 220 C93.5 216 94.5 212.5 96 210 Z',
  calves: [
    'M76 316 C71 333 70.5 352 74.5 369 L80.5 369 C82.5 351 82.8 333 81 316 Z',
    'M90.5 318 C94 336 94 354 90.5 371 L86.5 371 C85.3 352 85.5 335 87 318 Z',
  ],
};
const BACK = {
  traps: 'M99 49 C95.5 56.5 85.5 63 70.5 68 C80 72.5 88 81.5 92.5 95 C95.5 103.5 97.8 111.5 99 119 Z',
  'rear-delts': 'M70 69.5 C61 71 55 77 52.5 85 C51.5 91 53 97 56.5 101.5 C58.5 92 63 84.5 71.5 79.5 Z',
  'side-delts': 'M52 84 C47.5 89 45.5 96.5 46.5 105 C49.5 106 52.5 104 55 100.5 C52.5 95 51.5 89.5 52 84 Z',
  'upper-back': 'M92 99 C86.5 91 79.5 84 73 81 C71 89 72.5 98 78 106 C83.5 112.5 89.5 116.5 96.5 119 C95.5 112.5 94 105.5 92 99 Z',
  lats: 'M72 85 C66.5 98 64.5 115 67.5 132 C70.5 148 79 161 90.5 170 C92.5 160 94.5 150.5 96.5 142 C91.5 131.5 84 120 78.5 110 C74.5 102 72.5 93.5 72 85 Z',
  triceps: 'M51.5 106 C47 118.5 46.5 133 49 145 C53 150 58 148 60 141 C62 128.5 61.5 116 58.5 104 Z',
  forearms: 'M48 152 C44 162 41.5 175 41.5 188 C42.5 193.5 46.5 195 49.5 191.5 C53 180 56 167 57.5 154 C55 150.5 51 150 48 152 Z',
  'lower-back': 'M91.5 130 C93.5 148 94 168 91.5 187.5 L99 189 L99 122 C96.5 124.5 94 127 91.5 130 Z',
  glutes: 'M99 190 C90 186 79 188 72.5 197.5 C66.5 209.5 68.5 223.5 76.5 231.5 C84.5 238 94 236.5 99 230.5 Z',
  abductors: 'M70.5 185.5 C66.5 191 66 198.5 68 205.5 C72 198 78 192 85 188.5 C80 186 75 185 70.5 185.5 Z',
  hamstrings: [
    'M74.5 238 C70.5 256 70 276 74 292 C77.5 298.5 83.5 299 86 294 C87.3 276 87.3 255 86 238 C82 236.5 78 236.5 74.5 238 Z',
    'M88 238 C90.3 256 91 276 90 294 C93.5 297 97.2 293.5 97.3 286 C98.2 268 98 252 96 236.5 C93.3 236.8 90.6 237.2 88 238 Z',
  ],
  calves: [
    'M74 310 C67.5 325 67.5 345 72.5 360 C76.5 365.5 82 364 84 355 C84.8 338 83.3 322 80.5 310 Z',
    'M86.5 310 C92.5 321 95 339 91.5 357 C89.5 364 85 364 84.8 355 C84.5 338 84.8 323 86.5 310 Z',
  ],
};

// Silhouette (neutral) behind the muscles: head, neck and one half of the body outline.
const SIL = `
  <ellipse cx="100" cy="27" rx="15" ry="19"/>
  <path d="M91 41 C91.5 50 90 56 85 61.5 L100 61.5 L100 41 Z"/>
  <path d="M100 56 C90 58.5 75 63 64.5 68 C54 72.5 47.5 82 46.5 96 C45 112 43 128 43 144 C41 160 38.5 178 38.5 196
    C37.5 204 39.5 213 43.5 216 C47.5 218.5 51 212.5 50.5 204 C51.5 188 54.5 170 56.5 152 C58.5 136 60.5 121 63 107
    C64.5 120 66.5 141 70.5 162 C72.5 172 69.5 181 67.5 190 C64 200 64 214 66 226 C68 250 70 272 74 292
    C75 300 74.5 308 75.5 316 C71 334 71 352 75 372 C76 380 76 386 75 392 C72.5 398 80 400.5 89.5 398.5
    C92 394.5 91 388 90 382 C92 360 94 338 92 318 C92 308 94 300 95 292 C98 260 99 232 99.5 214 L100 214 Z"/>`;

const NAMES = {
  chest: 'Chest', 'front-delts': 'Front delts', 'side-delts': 'Side delts', 'rear-delts': 'Rear delts', lats: 'Lats',
  'upper-back': 'Mid back', traps: 'Traps', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs',
  obliques: 'Obliques', 'lower-back': 'Lower back', glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings',
  adductors: 'Adductors', abductors: 'Abductors', calves: 'Calves', 'hip-flexors': 'Hip flexors',
};

// Joint markers for the pain picker, in left-half coordinates (neck sits on the midline).
const JOINT_POS = {
  neck: [100, 52], shoulder: [61, 74], elbow: [50, 149], wrist: [44, 196], hip: [74, 193], knee: [84, 303], ankle: [82, 384],
};
const JOINT_NAMES = { neck: 'Neck', shoulder: 'Shoulder', elbow: 'Elbow', wrist: 'Wrist', hip: 'Hip', knee: 'Knee', ankle: 'Ankle' };

// Which side of the person a half of the drawing is. Half "a" is the left of the drawing:
// on the front view that's the person's right side (they face you); on the back view, their left.
export const sideOf = (view, half) => (view === 'back' ? (half === 'a' ? 'left' : 'right') : (half === 'a' ? 'right' : 'left'));

// values: muscle → 0..1 (how strongly to colour it).
// Options for the pain picker: sel (Set of "area:side" to mark), joints (draw joint markers),
// hint (muscles to outline, e.g. the current exercise's).
export function bodySvg(view, values = {}, { cls = '', label = '', viewBox = '0 0 200 400', sel = null, joints = false, hint = [], mark = null } = {}) {
  const regions = view === 'back' ? BACK : FRONT;
  const half = (h) => {
    const side = sideOf(view, h);
    const shapes = Object.entries(regions).flatMap(([m, ds]) => (Array.isArray(ds) ? ds : [ds]).map((d) => [m, d])).map(([m, d]) => {
      const v = Math.max(0, Math.min(1, values[m] || 0));
      const fill = v > 0.02 ? `style="--v:${v.toFixed(2)}"` : '';
      const on = sel?.has(`${m}:${side}`);
      return `<path d="${d}" data-m="${m}" class="mus ${v > 0.02 ? 'on' : ''} ${on ? 'sel' : ''} ${hint.includes(m) ? 'hint' : ''} ${mark?.has(`${m}:${side}`) ? 'hurt' : ''}" ${fill}><title>${NAMES[m]}</title></path>`;
    }).join('');
    const js = joints ? Object.entries(JOINT_POS).filter(([j]) => j !== 'neck' || h === 'a').map(([j, [x, y]]) => {
      const s = j === 'neck' ? 'center' : side;
      return `<circle cx="${x}" cy="${y}" r="7" data-j="${j}" class="joint ${sel?.has(`${j}:${s}`) ? 'sel' : ''} ${mark?.has(`${j}:${s}`) ? 'hurt' : ''}"><title>${JOINT_NAMES[j]}</title></circle>`;
    }).join('') : '';
    return shapes + js;
  };
  return `<svg class="body-map ${cls}" data-view="${view}" viewBox="${viewBox}" role="img" aria-label="${label || `Body, ${view} view`}">
    <g class="sil">${SIL}<g transform="translate(200 0) scale(-1 1)">${SIL}</g></g>
    <g class="muscles"><g data-half="a">${half('a')}</g><g data-half="b" transform="translate(200 0) scale(-1 1)">${half('b')}</g></g>
  </svg>`;
}

export const JOINT_LABELS = JOINT_NAMES;

// A front + back pair, side by side.
export function bodyPair(values, opts = {}) {
  return `<div class="body-pair">${bodySvg('front', values, { ...opts, label: opts.label ? `${opts.label}, front` : '' })}${bodySvg('back', values, { ...opts, label: opts.label ? `${opts.label}, back` : '' })}</div>`;
}

// Small single-muscle icon: the view where that muscle shows best, with only it highlighted.
const BACK_FIRST = ['lats', 'upper-back', 'traps', 'rear-delts', 'triceps', 'lower-back', 'glutes', 'hamstrings', 'calves'];
// Each icon is cropped to the part of the body where the muscle sits, so it reads at thumbnail size.
const CROP = {
  upper: '34 44 132 150', core: '50 96 100 110', hips: '46 176 108 130', lower: '52 290 96 112',
};
const AREA = {
  abs: 'core', obliques: 'core', 'lower-back': 'core', 'hip-flexors': 'hips', glutes: 'hips', quads: 'hips',
  hamstrings: 'hips', adductors: 'hips', abductors: 'hips', calves: 'lower',
};
export function muscleIcon(m, v = 1) {
  const view = BACK_FIRST.includes(m) ? 'back' : 'front';
  return bodySvg(view, { [m]: v }, { cls: 'mini-body', label: NAMES[m], viewBox: CROP[AREA[m] || 'upper'] });
}

export const MUSCLE_NAMES = NAMES;
