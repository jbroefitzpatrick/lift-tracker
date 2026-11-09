// Year planner: a sequence of nutrition/training phases laid over the calendar,
// lined up with training blocks and deload weeks.
import { todayStr, addDays, daysBetween, mondayOf } from './store.js';
import { weekInfo } from './engine.js';

export const PHASE_TYPES = {
  bulk: { label: 'Bulk', goal: 'gain', rate: [0.25, 0.5], cls: 'ph-bulk' },
  cut: { label: 'Cut', goal: 'lose', rate: [0.5, 1], cls: 'ph-cut' },
  minicut: { label: 'Mini-cut', goal: 'lose', rate: [0.75, 1], cls: 'ph-minicut' },
  maintain: { label: 'Maintain', goal: 'maintain', rate: [0, 0], cls: 'ph-maintain' },
  dietbreak: { label: 'Diet break', goal: 'maintain', rate: [0, 0], cls: 'ph-break' },
};

// What each phase means for training and recovery.
export const PHASE_GUIDE = {
  bulk: { text: 'Eat in a small surplus. Push weekly sets toward the top of your range and chase rep and load PRs.', refs: ['iraki2019', 'pelland2026'] },
  cut: { text: 'Eat in a deficit with high protein. Keep loads heavy to hold strength; trimming volume by up to a third is fine if recovery suffers. Expect fewer PRs.', refs: ['helms2014', 'helms2014protein'] },
  minicut: { text: 'A short, faster cut (2–6 weeks) to strip fat gained while bulking. Keep training heavy; resume the bulk after.', refs: ['helms2014'] },
  maintain: { text: 'Eat at maintenance. A good time for technique work, new exercises, or a strength block.', refs: [] },
  dietbreak: { text: 'Eat at maintenance for 1–2 weeks during a long cut. Can help adherence and recovery; then resume the cut.', refs: ['peos2019', 'byrne2018'] },
};

let seq = 0;
const pid = () => `ph${Date.now().toString(36)}${(seq++).toString(36)}`;

export function phaseWeeksTotal(plan) {
  return plan ? plan.phases.reduce((a, p) => a + p.weeks, 0) : 0;
}

// Which phase covers a date, and which week of it.
export function activePhase(db, date = todayStr()) {
  const plan = db.yearPlan;
  if (!plan?.phases?.length) return null;
  const week = Math.floor(daysBetween(plan.start, date) / 7);
  if (week < 0) return null;
  let acc = 0;
  for (let i = 0; i < plan.phases.length; i++) {
    const p = plan.phases[i];
    if (week < acc + p.weeks) {
      return { phase: p, index: i, weekInPhase: week - acc + 1, weeks: p.weeks, start: addDays(plan.start, acc * 7), end: addDays(plan.start, (acc + p.weeks) * 7 - 1) };
    }
    acc += p.weeks;
  }
  return null;
}

// Suggested 52-week layout from the builder profile.
export function suggestYear(profile, start = mondayOf(todayStr())) {
  const wg = profile?.rx?.weightGoal || 'maintain';
  const cls = profile?.rx?.bodyClass || 'average';
  const P = (type, weeks, note = '') => ({ id: pid(), type, weeks, note });
  let phases;
  if (wg === 'gain') {
    phases = [P('bulk', 20), P('minicut', 4, 'Trim fat gained while bulking'), P('maintain', 2), P('bulk', 18), P('maintain', 4), P('minicut', 4)];
  } else if (wg === 'lose') {
    phases = cls === 'higher'
      ? [P('cut', 12), P('dietbreak', 2), P('cut', 12), P('maintain', 8, 'Settle at the new weight'), P('cut', 8), P('maintain', 10)]
      : [P('cut', 10), P('dietbreak', 2), P('cut', 6), P('maintain', 6, 'Settle at the new weight'), P('bulk', 22), P('maintain', 6)];
  } else {
    phases = [P('maintain', 26, 'Recomposition: train hard, eat at maintenance, high protein'), P('maintain', 26)];
  }
  return { start, phases };
}

export function newPhase(type = 'maintain', weeks = 8) {
  return { id: pid(), type, weeks, note: '' };
}

// Week-by-week rows for the calendar view.
export function yearWeeks(db) {
  const plan = db.yearPlan;
  if (!plan) return [];
  const total = phaseWeeksTotal(plan);
  const rows = [];
  let acc = 0;
  plan.phases.forEach((p, i) => {
    for (let w = 0; w < p.weeks; w++) {
      const start = addDays(plan.start, (acc + w) * 7);
      rows.push({ n: acc + w + 1, start, phase: p, index: i, weekInPhase: w + 1, block: weekInfo(db, start) });
    }
    acc += p.weeks;
  });
  return rows.slice(0, Math.max(total, 0));
}

// Projected bodyweight week by week, using the middle of each phase's target rate.
export function projection(db, startWeight) {
  let w = startWeight;
  return yearWeeks(db).map((r) => {
    const t = PHASE_TYPES[r.phase.type];
    const mid = (t.rate[0] + t.rate[1]) / 2;
    const sign = t.goal === 'gain' ? 1 : t.goal === 'lose' ? -1 : 0;
    const out = { date: r.start, weight: w };
    w *= 1 + (sign * mid) / 100;
    return out;
  });
}

// Weekly cardio target: the builder's target, raised during cuts (donnelly2009).
export function cardioTargetFor(db, date = todayStr()) {
  const base = db.profile?.rx?.cardioMin || 0;
  const ph = activePhase(db, date);
  if (!ph) return base;
  if (ph.phase.type === 'cut' || ph.phase.type === 'minicut') return Math.max(base, 200);
  return base;
}
