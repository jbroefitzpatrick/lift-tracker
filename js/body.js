// Stylised body map (front and back) for muscle recovery and target muscles.
// Shapes are drawn for one half of the body and mirrored. Each muscle region carries
// data-m="<muscle id>" so it can be coloured and tapped. Colour is never the only cue:
// every view that uses this map also lists the muscles with values in text.

// Left half (x < 100) of a 200 × 430 figure. Regions per view.
const FRONT = {
  traps: 'M91 57 Q84 61 72 68 L86 70 Q91 64 92 58 Z',
  'front-delts': 'M72 69 Q60 70 53 81 Q53 91 58 96 Q62 84 75 77 Z',
  'side-delts': 'M53 81 Q46 89 46 101 Q51 103 55 99 Q53 90 57 84 Z',
  chest: 'M99 73 L99 111 Q86 117 73 109 Q63 100 65 88 Q70 76 87 73 Z',
  biceps: 'M50 105 Q44 121 46 141 Q53 147 59 140 Q62 122 58 105 Z',
  forearms: 'M46 147 Q38 168 39 192 Q45 197 51 193 Q58 172 60 148 Z',
  abs: 'M89 115 L99 115 L99 184 L91 182 Q87 150 89 115 Z',
  obliques: 'M72 113 Q70 143 76 176 L88 181 Q84 149 87 115 Z',
  'hip-flexors': 'M82 186 L97 197 L94 207 Q85 201 79 192 Z',
  abductors: 'M71 183 Q64 202 68 228 Q73 207 78 193 Z',
  quads: 'M78 194 Q67 230 71 286 Q81 296 92 289 Q97 252 95 208 Z',
  adductors: 'M96 209 Q99 241 95 277 L99 277 L99 206 Z',
  calves: 'M74 305 Q68 340 74 377 L84 377 Q90 340 88 305 Z',
};
const BACK = {
  traps: 'M99 50 L85 62 L71 70 L99 94 Z',
  'rear-delts': 'M70 71 Q57 72 51 85 Q51 95 57 99 Q61 86 74 79 Z',
  'side-delts': 'M51 85 Q45 92 46 103 Q51 104 55 100 Q53 92 56 87 Z',
  'upper-back': 'M99 95 L76 77 L81 117 L99 128 Z',
  lats: 'M75 82 Q64 97 68 125 Q74 153 92 170 L96 150 L82 119 Z',
  triceps: 'M50 104 Q44 121 47 143 Q55 146 60 138 Q62 120 58 104 Z',
  forearms: 'M46 148 Q38 169 39 192 Q45 197 51 193 Q58 172 60 149 Z',
  'lower-back': 'M86 152 L99 154 L99 187 L85 183 Z',
  glutes: 'M99 188 Q80 182 72 197 Q70 223 86 229 Q98 227 99 215 Z',
  abductors: 'M71 186 Q65 198 68 214 Q70 200 76 192 Z',
  hamstrings: 'M74 233 Q68 263 74 293 L94 293 Q98 261 96 233 Z',
  calves: 'M72 305 Q64 335 74 363 Q82 369 88 361 Q94 335 88 305 Z',
};

// Silhouette pieces (neutral) that fill the gaps between muscles.
const SIL = `
  <ellipse cx="100" cy="30" rx="16" ry="20"/>
  <path d="M91 46 L109 46 L111 62 L89 62 Z"/>
  <path d="M100 56 Q74 58 58 70 Q44 82 44 104 Q42 128 44 146 Q36 170 37 196 Q40 214 47 214 Q54 212 52 196 Q60 170 62 148 Q64 126 66 112 Q68 150 70 182 Q62 220 68 290 Q66 300 70 306 Q64 340 70 380 Q66 392 74 396 L88 396 Q92 388 89 380 Q94 340 90 306 Q96 296 95 288 Q99 250 99 214 L100 210 Z"/>`;

const NAMES = {
  chest: 'Chest', 'front-delts': 'Front delts', 'side-delts': 'Side delts', 'rear-delts': 'Rear delts', lats: 'Lats',
  'upper-back': 'Upper back', traps: 'Traps', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs',
  obliques: 'Obliques', 'lower-back': 'Lower back', glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings',
  adductors: 'Adductors', abductors: 'Abductors', calves: 'Calves', 'hip-flexors': 'Hip flexors',
};

// Joint markers for the pain picker, in left-half coordinates (neck sits on the midline).
const JOINT_POS = {
  neck: [100, 53], shoulder: [64, 72], elbow: [53, 145], wrist: [45, 196], hip: [75, 190], knee: [83, 297], ankle: [80, 387],
};
const JOINT_NAMES = { neck: 'Neck', shoulder: 'Shoulder', elbow: 'Elbow', wrist: 'Wrist', hip: 'Hip', knee: 'Knee', ankle: 'Ankle' };

// Which side of the person a half of the drawing is. Half "a" is the left of the drawing:
// on the front view that's the person's right side (they face you); on the back view, their left.
export const sideOf = (view, half) => (view === 'back' ? (half === 'a' ? 'left' : 'right') : (half === 'a' ? 'right' : 'left'));

// values: muscle → 0..1 (how strongly to colour it).
// Options for the pain picker: sel (Set of "area:side" to mark), joints (draw joint markers),
// hint (muscles to outline, e.g. the current exercise's).
export function bodySvg(view, values = {}, { cls = '', label = '', viewBox = '0 0 200 400', sel = null, joints = false, hint = [] } = {}) {
  const regions = view === 'back' ? BACK : FRONT;
  const half = (h) => {
    const side = sideOf(view, h);
    const shapes = Object.entries(regions).map(([m, d]) => {
      const v = Math.max(0, Math.min(1, values[m] || 0));
      const fill = v > 0.02 ? `style="--v:${v.toFixed(2)}"` : '';
      const on = sel?.has(`${m}:${side}`);
      return `<path d="${d}" data-m="${m}" class="mus ${v > 0.02 ? 'on' : ''} ${on ? 'sel' : ''} ${hint.includes(m) ? 'hint' : ''}" ${fill}><title>${NAMES[m]}</title></path>`;
    }).join('');
    const js = joints ? Object.entries(JOINT_POS).filter(([j]) => j !== 'neck' || h === 'a').map(([j, [x, y]]) => {
      const s = j === 'neck' ? 'center' : side;
      return `<circle cx="${x}" cy="${y}" r="7" data-j="${j}" class="joint ${sel?.has(`${j}:${s}`) ? 'sel' : ''}"><title>${JOINT_NAMES[j]}</title></circle>`;
    }).join('') : '';
    return shapes + js;
  };
  return `<svg class="body-map ${cls}" viewBox="${viewBox}" role="img" aria-label="${label || `Body, ${view} view`}">
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
  upper: '36 44 128 150', core: '50 96 100 110', hips: '46 172 108 130', lower: '50 286 100 116',
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
