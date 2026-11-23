// The streak panel on the calendar, and the question after a missed week.

import { todayStr } from './store.js';
import { streakInfo, syncStreak, useFreeze, declineFreeze } from './streak.js';

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
    const sub = week.hit ? 'This week is in the bank' : `${week.done} of ${week.target} ${week.target === 1 ? 'day' : 'days'} this week`;
    // While the freeze question is open, show the streak that's still at stake.
    const shown = x.offer ? x.offer.saved + x.current : x.current;
    return `<div class="streak-hero ${shown ? 'on' : ''}" role="group" aria-label="${shown ? `${weeksText(shown)} streak` : 'No streak yet'}. ${sub}. ${x.hits} of the last 12 weeks hit.">
      <div class="sh-top"><b class="sh-num num">${shown}</b><span class="sh-txt"><b>${shown ? 'week streak' : 'Start a streak'}</b><span>${sub}</span></span>${x.consistency ? `<span class="sh-tier">${x.consistency}</span>` : ''}</div>
      <div class="sw-row" aria-hidden="true">${row}</div>
    </div>`;
  }
  const actions = {
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
