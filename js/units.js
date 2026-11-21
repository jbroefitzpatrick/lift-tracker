// Weight units. Everything is stored in pounds; in kilogram mode weights are converted for display
// and converted back when typed. A gym switched to kilograms stores its kilogram bar and plates as
// exact pound equivalents, so rounding to what the gym can load lands on whole kilogram loads.

export const KG = 0.45359237; // kg per lb
let unit = 'lb';

export function setUnit(u) { unit = u === 'kg' ? 'kg' : 'lb'; }
export const wUnit = () => unit;

// Pounds → the number shown: kilograms to the nearest 0.25, pounds to two decimals (trimmed).
export function toDisp(lb) {
  if (lb == null || lb === '' || !Number.isFinite(+lb)) return lb;
  if (unit === 'kg') return Math.round(+lb * KG * 4) / 4;
  return Math.round(+lb * 100) / 100;
}
// A number typed in the current unit → pounds.
export function fromDisp(v) {
  if (v == null || v === '' || !Number.isFinite(+v)) return v;
  return unit === 'kg' ? +v / KG : +v;
}
// "135 lb" / "61.25 kg"
export const wt = (lb) => `${toDisp(lb)} ${unit}`;
// Estimates (estimated max): whole pounds or kilograms, since more precision would be false.
export const wtEst = (lb) => `${Math.round(toDisp(lb))} ${unit}`;
// A kilogram amount as stored pounds (fixed precision so stored plates compare equal).
export const lbOfKg = (kg) => +(kg / KG).toFixed(4);

// Standard kilogram equipment, as stored pounds.
export const KG_GYM = {
  barWeight: lbOfKg(20),
  plates: [25, 20, 15, 10, 5, 2.5, 1.25].map(lbOfKg),
  dbStep: lbOfKg(2.5),
  machineStep: lbOfKg(2.5),
  dbMax: lbOfKg(60),
};
export const LB_GYM = { barWeight: 45, plates: [45, 35, 25, 10, 5, 2.5], dbStep: 5, machineStep: 5, dbMax: 150 };
// Choices offered in the gym editor, per unit (stored as pounds).
export const BAR_CHOICES = () => (unit === 'kg' ? [20, 15, 10].map(lbOfKg) : [45, 35, 33, 25, 20, 15]);
export const PLATE_CHOICES = () => (unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 2, 1.25, 0.5].map(lbOfKg) : [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25]);
export const DB_STEP_CHOICES = () => (unit === 'kg' ? [1, 2, 2.5, 5].map(lbOfKg) : [2.5, 5, 10]);
export const MACHINE_STEP_CHOICES = () => (unit === 'kg' ? [1.25, 2.5, 5, 10].map(lbOfKg) : [2.5, 5, 10, 15, 20]);
// A sensible step for typing weights in the current unit.
export const weightStepper = () => (unit === 'kg' ? 2.5 : 5);
