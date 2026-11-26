// The streak panel on the calendar, and the question after a missed week.

import { todayStr } from './store.js';
import { streakInfo, syncStreak, useFreeze, declineFreeze, STREAK_GOALS, goalOf, setStreakGoal, plannedDays, targetFromPlan } from './streak.js';

export function createStreak(ctx) {
  const weeksText = (n) => `${n} ${n === 1 ? 'week' : 'weeks'}`;
  // Asked once after a missed week, while the streak can still be saved.
  function prompt() {
    const info = streakInfo(ctx.db);
    if (!info.offer) return '';
    const n = info.offer.weeks.length;
    return `<div class="notice-card streak-ask"><p><b>Keep your ${info.offer.saved}-week streak?</b> You missed ${n === 1 ? 'last week' : `the last ${n} weeks`}. ${n === 1 ? 'A freeze saves it' : `${n} freezes save it`}. You have ${info.freezesLeft} left this year.</p>
      <div class="row"><button class="btn primary" data-a="streak-freeze">${n === 1 ? 'Use a freeze' : `Use ${n} freezes`}</button><button class="btn" data-a="streak-decline">Let it end</button></div></div>`;
  }
  function panel() {
    syncStreak(ctx.db);
    const x = streakInfo(ctx.db);
    const dots = x.weeks.slice(-12);
    const blanks = Math.max(0, 12 - dots.length);
    const label = { hit: 'hit', frozen: 'frozen', missed: 'missed', current: 'in progress' };
    const row = `${'<i class="sw-dot"></i>'.repeat(blanks)}${dots.map((w) => `<i class="sw-dot ${x.states[w]}" title="Week of ${w}: ${label[x.states[w]]}"></i>`).join('')}`;
    const week = x.thisWeek;
    // The streak's goal (Easy, Steady or All in), tappable to change.
    const sub = week.hit ? 'This week is in the bank' : `Goal: ${week.target} ${week.target === 1 ? 'day' : 'days'} a week · ${week.done} so far`;
    const goalBtn = `<button class="sh-goal" data-a="streak-goal" aria-label="Streak goal: ${STREAK_GOALS[goalOf(ctx.db)].name}. Change">${sub}</button>`;
    // While the freeze question is open, show the streak that's still at stake.
    const shown = x.offer ? x.offer.saved + x.current : x.current;
    return `<div class="streak-hero ${shown ? 'on' : ''}" role="group" aria-label="${shown ? `${weeksText(shown)} streak` : 'No streak yet'}. ${sub}. ${x.hits} of the last 12 weeks hit.">
      <div class="sh-top"><b class="sh-num num">${shown}</b><span class="sh-txt"><b>${shown ? 'week streak' : 'Start a streak'}</b>${goalBtn}</span>${x.consistency ? `<span class="sh-tier">${x.consistency}</span>` : ''}</div>
      <div class="sw-row" aria-hidden="true">${row}</div>
    </div>`;
  }
  function goalSheet() {
    const cur = goalOf(ctx.db);
    const n = plannedDays(ctx.db);
    ctx.openSheet(`<h2>Streak goal</h2>
      <p class="muted small">How many days make a week count. ${n ? `Your plan has ${n} training ${n === 1 ? 'day' : 'days'}.` : 'With no plan, every goal is 1 day.'}</p>
      <div class="list-group" role="radiogroup" aria-label="Streak goal">${Object.entries(STREAK_GOALS).map(([k, g]) => { const t = targetFromPlan(n, k); return `<button class="list-row pick-row ${cur === k ? 'on' : ''}" data-a="streak-goal-set" data-v="${k}" role="radio" aria-checked="${cur === k}"><span class="grow"><b>${g.name}${k === 'steady' ? ' · suggested' : ''}</b><span class="pick-sub">${g.sub}${n && k !== 'easy' ? ` · ${t} ${t === 1 ? 'day' : 'days'} a week` : ''}</span></span></button>`; }).join('')}</div>
      <p class="muted small">Missing one session doesn't undo a habit, so Steady counts most weeks with most of your days. A change applies from this week. Freezes still cover a missed week.</p>`);
  }
  const actions = {
    'streak-goal': () => goalSheet(),
    'streak-goal-set': (d) => { setStreakGoal(ctx.db, d.v); ctx.persist(); ctx.render(); goalSheet(); ctx.toast(`Streak goal: ${STREAK_GOALS[d.v].name}.`); },
    'streak-freeze': () => {
      const o = streakInfo(ctx.db).offer; if (!o) return;
      useFreeze(ctx.db, o.weeks); ctx.persist(); ctx.render();
      ctx.toast(`Streak saved at ${o.saved} ${o.saved === 1 ? 'week' : 'weeks'}.`);
    },
    'streak-decline': () => {
      const o = streakInfo(ctx.db).offer; if (!o) return;
      declineFreeze(ctx.db, o.weeks); ctx.persist(); ctx.render();
    },
  };
  return { prompt, panel, actions, today: todayStr };
}
