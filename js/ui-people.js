// People tab (signed in only): friends, a weekly board, head-to-head challenges, a feed of records,
// and coaching (a coach sees what a client shares, suggests plan changes, and they exchange notes).
// Server side: cloud/social.js. What friends see is the card from card.js, published by this phone.

import { icon } from './icons.js';
import { account, api } from './account.js';
import { buildCard, weekOf, progressOf, contestScore, contestEnd } from './card.js';
import { todayStr, addDays, mondayOf, weekOrder, safetySnapshot } from './store.js';
import { wt } from './units.js';
import { APP_URL } from './ui-train.js';

const CACHE = 'lift.social';
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const SEEN = 'lift.social.seen';
const INVITE = 'lift.invite';
const PERM_LABELS = { plan: 'Plan', workouts: 'Workouts', body: 'Body weight and measurements', food: 'Food' };
const FULL_DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export function createPeople(ctx) {
  const { esc } = ctx;
  let data = ls.get(CACHE, null);
  let loading = null;
  let lastError = '';
  let timer = null;
  const clients = {}; // client id → { perms, docs } for the coach's view
  const pv = () => (ctx.ui.people ||= { board: 'week' });
  const me = () => data?.me?.id || account()?.user?.id;
  const on = () => !!account()?.token;

  // ---------- Loading ----------
  async function refresh({ quiet = true } = {}) {
    if (!on() || !navigator.onLine) return;
    if (loading) return loading;
    loading = (async () => {
      try {
        data = await api('/v2/social', undefined, { auth: true });
        ls.set(CACHE, data);
        lastError = '';
      } catch (e) { lastError = e.message; if (!quiet) ctx.toast(e.message); }
      if (ctx.ui.tab === 'people') ctx.render();
    })();
    try { await loading; } finally { loading = null; }
  }

  // The card is published when it changes (after workouts and syncs).
  async function publish() {
    if (!on() || !navigator.onLine) return;
    const card = buildCard(ctx.db, account().user.name);
    const { today, ...rest } = card;
    const key = JSON.stringify(rest);
    if (ls.get('lift.card.sent', '') === key) return;
    try { await api('/v2/social/card', { card }, { auth: true }); ls.set('lift.card.sent', key); } catch {}
  }
  function schedule() {
    if (!on()) return;
    clearTimeout(timer);
    timer = setTimeout(() => publish().then(() => refresh()), 15000);
  }
  function start() {
    // An invite link (…?invite=CODE) opened on this phone: keep it until it can be accepted.
    const m = /[?&]invite=([A-Za-z0-9-]{8,9})/.exec(location.search);
    if (m) { ls.set(INVITE, m[1]); history.replaceState(null, '', location.pathname); }
    // On iPhone a link always opens in Safari, which doesn't share storage with the Home Screen
    // app. So the code itself carries the invite over: copy it, open Lift, paste.
    const inSafari = !!m && isIos() && !standalone();
    if (inSafari) setTimeout(() => safariInvite(m[1]), 600);
    setTimeout(async () => { await publish(); await refresh(); if (!inSafari) maybeInvite(); }, 3500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); else publish(); });
  }
  function safariInvite(code) {
    ctx.openSheet(`<h2>You're invited</h2>
      <p class="small">Your invite code:</p>
      <p class="code-big">${esc(code)}</p>
      <button class="btn primary block big" data-a="ppl-copy-code" data-v="${esc(code)}">Copy code</button>
      <h3 class="sheet-h">Have Lift on your Home Screen?</h3>
      <p class="small">Open it there, go to People and tap <b>Enter an invite code</b>, then <b>Paste</b>. iPhone always opens links in Safari, so the code is how the invite gets to the app.</p>
      <h3 class="sheet-h">New to Lift?</h3>
      <p class="small">Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>. Open Lift from there, create an account in Settings → Account and sync, then paste the code in People.</p>
      <button class="btn plain block" data-a="ppl-invite-here">Continue in Safari instead</button>`);
  }

  function maybeInvite() {
    const code = ls.get(INVITE, null);
    if (!code) return;
    // No account yet: go straight to creating one; the invite opens once signed in.
    if (!on()) { ctx.ui.prevTab = ctx.ui.tab; ctx.ui.tab = 'settings'; ctx.ui.setPage = 'account'; window.scrollTo(0, 0); ctx.render(); return; }
    ls.set(INVITE, null);
    peekInvite(code);
  }
  function reset() { data = null; ls.set(CACHE, null); ls.set('lift.card.sent', null); }

  // ---------- Helpers ----------
  const links = () => data?.links || [];
  const friends = () => links().filter((l) => l.kind === 'friend');
  const coaches = () => links().filter((l) => l.role === 'coach');
  const myClients = () => links().filter((l) => l.role === 'client');
  const nameOf = (id) => (id === me() ? 'You' : links().find((l) => l.user.id === id)?.user.name || 'Someone');
  const cardOf = (id) => data?.cards?.[id] || null;
  const fmtPct = (p) => (p == null ? '—' : `${p > 0 ? '+' : ''}${p.toFixed(1)}%`);
  const ago = (d) => { const n = Math.round((Date.parse(todayStr()) - Date.parse(d)) / 86400000); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
  const unread = (link) => {
    const seen = ls.get(SEEN, {})[link.id] || 0;
    return (data?.messages || []).filter((m) => m.link === link.id && m.from !== me() && m.created > seen).length;
  };
  const markSeen = (linkId) => { const s = ls.get(SEEN, {}); s[linkId] = Date.now(); ls.set(SEEN, s); };
  const shareText = (code) => `Join me on Lift Tracker: ${APP_URL}?invite=${code}\nOr open People → Enter a code: ${code}`;

  // ---------- Main screen ----------
  function screen() {
    const v = pv();
    if (v.client && v.edit) return planEditor(v.client);
    if (v.client) return clientScreen(v.client);
    if (!data && !lastError) { refresh(); }
    const head = `<header class="top"><div class="grow"><h1>People</h1></div><button class="icon-btn" data-a="ppl-invite" aria-label="Invite someone">${icon('plus')}</button></header>`;
    if (!data) return `${head}<p class="muted small pad">${lastError ? esc(lastError) : 'Loading…'}</p>`;
    if (!links().length) {
      return `${head}
        <div class="card ppl-empty">
          <h3>Train with friends or a coach</h3>
          <p class="small">Compare weeks and progress with friends, cheer each other's records, and run head-to-head challenges. A coach can follow what you choose to share and suggest changes to your plan.</p>
          <button class="btn primary block" data-a="ppl-new" data-v="friend">Invite a friend</button>
          <button class="btn block" data-a="ppl-new" data-v="coach">Ask someone to coach you</button>
          <button class="btn block" data-a="ppl-new" data-v="client">Coach someone</button>
        </div>
        ${openInvites()}
        <div class="list-group"><button class="list-row" data-a="ppl-code"><span class="grow"><b>Enter an invite code</b></span>${icon('right', 'chev')}</button></div>`;
    }
    return `${head}
      ${todo()}
      ${coachCards()}
      ${board()}
      ${contests()}
      ${feed()}
      ${clientsCard()}
      ${openInvites()}
      <div class="list-group"><button class="list-row" data-a="ppl-code"><span class="grow"><b>Enter an invite code</b></span>${icon('right', 'chev')}</button></div>`;
  }

  // Things waiting on me: challenges to answer, plan suggestions to review.
  function todo() {
    const out = [];
    for (const c of (data.contests || []).filter((x) => x.status === 'pending' && x.b === me())) {
      out.push(`<div class="notice-card"><b>${esc(nameOf(c.a))} challenged you</b><p class="small">${esc(contestLabel(c))} over ${c.days === 7 ? 'a week' : `${c.days / 7} weeks`}, starting when you accept.</p>
        <div class="row"><button class="btn primary" data-a="ppl-contest-answer" data-id="${c.id}" data-v="1">Accept</button><button class="btn" data-a="ppl-contest-answer" data-id="${c.id}" data-v="0">Not now</button></div></div>`);
    }
    for (const p of (data.proposals || []).filter((x) => x.status === 'pending' && x.client === me())) {
      out.push(`<div class="notice-card"><b>${esc(nameOf(p.coach))} suggested plan changes</b><p class="small">${Object.keys(p.data.days || {}).length} ${Object.keys(p.data.days || {}).length === 1 ? 'day' : 'days'}${p.note ? `: “${esc(p.note.slice(0, 120))}”` : ''}</p>
        <div class="row"><button class="btn primary" data-a="ppl-review" data-id="${p.id}">Review</button></div></div>`);
    }
    return out.join('');
  }

  function coachCards() {
    return coaches().map((l) => {
      const n = unread(l);
      const last = (data.messages || []).filter((m) => m.link === l.id).sort((a, b) => b.created - a.created)[0];
      return `<div class="list-group"><button class="list-row" data-a="ppl-thread" data-id="${l.id}"><span class="grow"><b>Coach: ${esc(l.user.name)}</b><span class="pick-sub">${last ? esc(`${last.from === me() ? 'You: ' : ''}${last.text}`.slice(0, 80)) : 'Send a note, or change what you share'}</span></span>${n ? `<span class="badge">${n}</span>` : ''}${icon('right', 'chev')}</button></div>`;
    }).join('');
  }

  function board() {
    if (!friends().length) return `<div class="card"><h3>Leaderboard</h3><p class="small muted">Invite a friend to compare weeks and progress.</p><button class="btn block" data-a="ppl-new" data-v="friend">Invite a friend</button></div>`;
    const mode = pv().board;
    const ids = [me(), ...friends().map((l) => l.user.id)];
    let rows;
    if (mode === 'progress') {
      rows = ids.map((id) => ({ id, p: progressOf(cardOf(id)) })).sort((a, b) => (b.p.pct ?? -1e9) - (a.p.pct ?? -1e9))
        .map((r, i) => row(r.id, i, fmtPct(r.p.pct), r.p.pct == null ? 'Not enough lifts logged yet' : `Median of ${r.p.lifts.length} ${r.p.lifts.length === 1 ? 'lift' : 'lifts'}${r.p.lifts.length > 1 ? ` · best ${esc(r.p.lifts[0].name)} ${fmtPct(r.p.lifts[0].pct)}` : r.p.lifts[0] ? ` · ${esc(r.p.lifts[0].name)}` : ''}`));
    } else {
      const score = (w) => (w.planned ? w.done / w.planned : w.done / 4);
      rows = ids.map((id) => ({ id, w: weekOf(cardOf(id)), c: cardOf(id) })).sort((a, b) => score(b.w) - score(a.w) || b.w.sets - a.w.sets)
        .map((r, i) => row(r.id, i, `${r.w.done}${r.w.planned ? `/${r.w.planned}` : ''}`, `${r.w.done === 1 && !r.w.planned ? 'workout' : 'workouts'} · ${r.w.sets} sets${r.c?.streak ? ` · ${r.c.streak} wk streak` : ''}`));
    }
    return `<section class="card ppl-board">
      <div class="row between"><h3>Leaderboard</h3><span>${ctx.refChips(['zhang2016', 'festinger1954'])}</span></div>
      <div class="segmented small-seg" role="tablist" aria-label="Leaderboard">
        <button class="${mode !== 'progress' ? 'on' : ''}" data-a="ppl-board" data-v="week" role="tab" aria-selected="${mode !== 'progress'}">This week</button>
        <button class="${mode === 'progress' ? 'on' : ''}" data-a="ppl-board" data-v="progress" role="tab" aria-selected="${mode === 'progress'}">Progress</button>
      </div>
      <div class="ppl-rows">${rows.join('')}</div>
      <p class="muted small">${mode === 'progress' ? 'Change in estimated strength over about four weeks, so it\'s fair at any level.' : 'Workouts done against each person\'s own plan. Resets each week.'}</p>
    </section>`;
  }
  function row(id, i, big, sub) {
    const mine = id === me();
    return `<button class="ppl-row ${mine ? 'me' : ''}" ${mine ? 'disabled' : `data-a="ppl-friend" data-id="${id}"`}><span class="rank">${i + 1}</span><span class="grow"><b>${esc(nameOf(id))}</b><span class="pick-sub">${sub}</span></span><b class="num">${big}</b></button>`;
  }

  // ---------- Challenges ----------
  const contestLabel = (c) => (c.kind === 'workouts' ? 'Most workouts' : `Biggest gain on ${c.exName || 'a lift'}`);
  function contests() {
    const today = todayStr();
    const list = (data.contests || []).filter((c) => (c.status === 'active' && addDays(contestEnd(c), 7) >= today) || (c.status === 'pending' && c.a === me()));
    if (!list.length) return '';
    return `<section class="card"><h3>Challenges</h3>${list.map((c) => {
      const other = c.a === me() ? c.b : c.a;
      if (c.status === 'pending') return `<div class="contest"><div class="row between"><b>${esc(contestLabel(c))} · ${esc(nameOf(other))}</b><button class="mini" data-a="ppl-contest-cancel" data-id="${c.id}">Cancel</button></div><p class="muted small">Waiting for ${esc(nameOf(other))} to accept.</p></div>`;
      const end = contestEnd(c);
      const done = today > end;
      const a = contestScore(cardOf(me()), c, today);
      const b = contestScore(cardOf(other), c, today);
      const av = a?.value; const bv = b?.value;
      const max = Math.max(1, Math.abs(av || 0), Math.abs(bv || 0));
      const fmt = (v) => (v == null ? '—' : c.kind === 'workouts' ? v : fmtPct(v));
      const left = Math.round((Date.parse(end) - Date.parse(today)) / 86400000) + 1;
      const verdict = done ? (av == null && bv == null ? 'No result' : (av ?? -1e9) > (bv ?? -1e9) ? 'You won' : (av ?? -1e9) < (bv ?? -1e9) ? `${esc(nameOf(other))} won` : 'A tie') : c.start > today ? 'Starts tomorrow' : `${left} ${left === 1 ? 'day' : 'days'} left`;
      const bar = (label, v, cls) => `<div class="c-bar"><span>${label}</span><span class="c-track"><span class="c-fill ${cls}" style="width:${Math.max(4, (Math.max(0, v || 0) / max) * 100)}%"></span></span><b class="num">${fmt(v)}</b></div>`;
      return `<div class="contest"><div class="row between"><b>${esc(contestLabel(c))}</b><span class="muted small">${verdict}</span></div>${bar('You', av, 'me')}${bar(esc(nameOf(other)), bv, 'them')}</div>`;
    }).join('')}</section>`;
  }

  // ---------- Feed ----------
  function feed() {
    const since = addDays(todayStr(), -14);
    const items = [];
    for (const id of [me(), ...friends().map((l) => l.user.id)]) {
      const c = cardOf(id);
      if (!c) continue;
      for (const r of c.records || []) if (r.date >= since) items.push({ id, key: `r:${r.id}`, date: r.date, text: `New best on ${r.ex}${r.pct ? `, up ${r.pct}%` : ''}` });
      for (const w of c.workouts || []) if (w.date >= since) items.push({ id, key: `w:${w.id}`, date: w.date, text: `Finished ${w.name} · ${w.sets} sets${w.prs ? ` · ${w.prs} ${w.prs === 1 ? 'record' : 'records'}` : ''}` });
    }
    if (!items.length) return '';
    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key.startsWith('r') ? -1 : 1));
    return `<section class="card"><h3>Recent</h3><div class="feed">${items.slice(0, 15).map((it) => {
      const who = data.cheers?.[`${it.id}:${it.key}`] || [];
      const mine = who.some((x) => x.id === me());
      const self = it.id === me();
      return `<div class="feed-item"><div class="grow"><b>${esc(nameOf(it.id))}</b> <span class="small">${esc(it.text)}</span><span class="pick-sub">${ago(it.date)}${who.length ? ` · ${who.length} ${who.length === 1 ? 'cheer' : 'cheers'}${self ? ` from ${esc(who.map((x) => x.name).join(', '))}` : ''}` : ''}</span></div>
        ${self ? '' : `<button class="mini ${mine ? 'on' : ''}" data-a="ppl-cheer" data-o="${it.id}" data-i="${esc(it.key)}" aria-pressed="${mine}">${mine ? 'Cheered' : 'Cheer'}</button>`}</div>`;
    }).join('')}</div></section>`;
  }

  function clientsCard() {
    if (!myClients().length) return '';
    return `<h2 class="group-title">Clients</h2><div class="list-group">${myClients().map((l) => {
      const w = weekOf(cardOf(l.user.id)); const p = progressOf(cardOf(l.user.id)); const n = unread(l);
      const pending = (data.proposals || []).some((x) => x.status === 'pending' && x.client === l.user.id);
      return `<button class="list-row" data-a="ppl-client" data-id="${l.user.id}"><span class="grow"><b>${esc(l.user.name)}</b><span class="pick-sub">${w.done}${w.planned ? `/${w.planned}` : ''} workouts this week · ${fmtPct(p.pct)} strength${pending ? ' · suggestion pending' : ''}</span></span>${n ? `<span class="badge">${n}</span>` : ''}${icon('right', 'chev')}</button>`;
    }).join('')}</div>`;
  }

  function openInvites() {
    const inv = data?.invites || [];
    if (!inv.length) return '';
    const kinds = { friend: 'Friend invite', coach: 'Coach invite (they coach you)', client: 'Client invite (you coach them)' };
    return `<h2 class="group-title">Open invites</h2><div class="list-group">${inv.map((i) => `<div class="list-row"><span class="grow"><b class="mono">${esc(i.code)}</b><span class="pick-sub">${kinds[i.kind]} · expires ${ctx.fmtDate(addDays(new Date(i.created).toISOString().slice(0, 10), 7))}</span></span><button class="mini" data-a="ppl-share" data-v="${esc(i.code)}">Share</button><button class="mini" data-a="ppl-invite-cancel" data-v="${esc(i.code)}">Cancel</button></div>`).join('')}</div>`;
  }

  // ---------- Sheets ----------
  function permToggles(perms) {
    return Object.entries(PERM_LABELS).map(([k, label]) => `<label class="toggle"><input type="checkbox" data-perm="${k}" ${perms[k] ? 'checked' : ''}><span>${label}</span></label>`).join('');
  }
  const readPerms = () => Object.fromEntries(Object.keys(PERM_LABELS).map((k) => [k, !!document.querySelector(`#sheet [data-perm="${k}"]`)?.checked]));

  function inviteSheet() {
    ctx.openSheet(`<h2>Invite</h2>
      <div class="list-group">
        <button class="list-row" data-a="ppl-new" data-v="friend"><span class="grow"><b>Invite a friend</b><span class="pick-sub">Compare weeks and progress, cheer records, challenge each other</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="ppl-new" data-v="coach"><span class="grow"><b>Ask someone to coach you</b><span class="pick-sub">You choose what they can see</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="ppl-new" data-v="client"><span class="grow"><b>Coach someone</b><span class="pick-sub">They choose what to share with you</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="ppl-code"><span class="grow"><b>Enter an invite code</b></span>${icon('right', 'chev')}</button>
      </div>
      <p class="muted small">Friends see your workouts per week, sets, streak, strength change in percent, and records without weights. Nothing else.</p>`);
  }
  async function createInvite(kind, perms) {
    try {
      const r = await api('/v2/social/invite', { kind, perms }, { auth: true });
      const what = { friend: 'Send this to your friend.', coach: 'Send this to your coach.', client: 'Send this to the person you\'ll coach. They choose what to share.' }[kind];
      ctx.openSheet(`<h2>Invite code</h2><p class="small">${what} It works once and expires in 7 days.</p>
        <p class="code-big">${esc(r.code)}</p>
        <button class="btn primary block" data-a="ppl-share" data-v="${esc(r.code)}">Share invite</button>
        <button class="btn block" data-a="close-sheet">Done</button>`);
      refresh();
    } catch (e) { ctx.toast(e.message); }
  }
  async function peekInvite(code) {
    try {
      const r = await api('/v2/social/invite/peek', { code }, { auth: true });
      const from = esc(r.from.name);
      const body = r.kind === 'friend' ? `<p class="small">${from} invited you to be friends. You'll see each other's weekly workouts, progress and records.</p>`
        : r.kind === 'coach' ? `<p class="small">${from} wants you as their coach. They share:</p><p><b>${Object.entries(r.perms || {}).filter(([, v]) => v).map(([k]) => PERM_LABELS[k]).join(', ') || 'their weekly summary only'}</b></p>`
          : `<p class="small">${from} offers to coach you. Choose what they can see. You can change this or stop at any time.</p>${permToggles({ plan: true, workouts: true, body: false, food: false })}`;
      ctx.openSheet(`<h2>${r.kind === 'friend' ? 'Friend invite' : 'Coaching invite'}</h2>${body}
        <button class="btn primary block" data-a="ppl-accept" data-v="${esc(code)}">Accept</button>
        <button class="btn block" data-a="close-sheet">Not now</button>`);
    } catch (e) { ctx.toast(e.message); }
  }

  function friendSheet(id) {
    const l = friends().find((x) => x.user.id === id);
    if (!l) return;
    const c = cardOf(id); const w = weekOf(c); const p = progressOf(c);
    ctx.openSheet(`<h2>${esc(l.user.name)}</h2>
      <div class="kv-list">
        <div class="kv"><span>This week</span><b>${w.done}${w.planned ? ` of ${w.planned}` : ''} workouts · ${w.sets} sets</b></div>
        <div class="kv"><span>Streak</span><b>${c?.streak || 0} ${c?.streak === 1 ? "week" : "weeks"}</b></div>
        <div class="kv"><span>Strength, 4 weeks</span><b>${fmtPct(p.pct)}</b></div>
        ${p.lifts.slice(0, 4).map((x) => `<div class="kv"><span>${esc(x.name)}</span><b>${fmtPct(x.pct)}</b></div>`).join('')}
      </div>
      ${c?.updated ? `<p class="muted small">Updated ${ctx.fmtDate(new Date(c.updated).toISOString().slice(0, 10))}</p>` : '<p class="muted small">Nothing shared yet.</p>'}
      <button class="btn primary block" data-a="ppl-challenge" data-id="${id}">Challenge</button>
      <button class="btn plain block danger-text" data-a="ppl-unlink" data-id="${l.id}">Remove friend</button>`);
  }

  function challengeSheet(id, kind = 'workouts', days = 7) {
    const mine = cardOf(me())?.lifts || {}; const theirs = cardOf(id)?.lifts || {};
    const both = Object.keys(mine).filter((k) => theirs[k]).map((k) => ({ id: k, name: mine[k].name }));
    ctx.openSheet(`<h2>Challenge ${esc(nameOf(id))}</h2>
      <div class="field"><span>What</span><div class="segmented small-seg">
        <button class="${kind === 'workouts' ? 'on' : ''}" data-a="ppl-challenge" data-id="${id}" data-k="workouts" data-d="${days}">Most workouts</button>
        <button class="${kind === 'lift' ? 'on' : ''}" data-a="ppl-challenge" data-id="${id}" data-k="lift" data-d="${days === 7 ? 28 : days}">Strength gain</button></div></div>
      <div class="field"><span>How long</span><div class="segmented small-seg">${[[7, '1 week'], [14, '2 weeks'], [28, '4 weeks']].map(([d, l]) => `<button class="${days === d ? 'on' : ''}" data-a="ppl-challenge" data-id="${id}" data-k="${kind}" data-d="${d}">${l}</button>`).join('')}</div></div>
      ${kind === 'lift' ? (both.length ? `<div class="field"><span>Lift you both do</span><select id="ppl-lift">${both.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>
        <p class="muted small">Change in your best estimated max during the challenge, against the four weeks before. Percentages, so size and experience don't matter.</p>` : '<p class="small">You don\'t have a logged lift in common yet. Try most workouts instead.</p>') : '<p class="muted small">Whoever finishes more workouts in the window wins. Starts when they accept.</p>'}
      <button class="btn primary block" data-a="ppl-challenge-send" data-id="${id}" data-k="${kind}" data-d="${days}" ${kind === 'lift' && !both.length ? 'disabled' : ''}>Send challenge</button>`);
  }

  function threadSheet(linkId) {
    const l = links().find((x) => x.id === linkId);
    if (!l) return;
    markSeen(linkId);
    const msgs = (data.messages || []).filter((m) => m.link === linkId).sort((a, b) => a.created - b.created).slice(-30);
    const amClient = l.role === 'coach';
    ctx.openSheet(`<h2>${amClient ? 'Coach' : 'Client'}: ${esc(l.user.name)}</h2>
      ${thread(msgs)}
      <div class="field"><textarea id="ppl-msg" rows="2" placeholder="Write a note"></textarea></div>
      <button class="btn primary block" data-a="ppl-send" data-id="${linkId}">Send</button>
      ${amClient ? `<h3>What ${esc(l.user.name)} can see</h3>${permToggles(l.perms || {})}<button class="btn block" data-a="ppl-perms" data-id="${linkId}">Save what's shared</button>
        <p class="muted small">Your weekly summary is always shared. Your coach can suggest plan changes; nothing changes until you accept.</p>` : ''}
      <button class="btn plain block danger-text" data-a="ppl-unlink" data-id="${linkId}">${amClient ? 'Stop coaching' : 'Stop coaching this client'}</button>`);
  }
  function thread(msgs, sessionNames = {}) {
    if (!msgs.length) return '<p class="muted small">No notes yet.</p>';
    return `<div class="thread">${msgs.map((m) => `<div class="msg ${m.from === me() ? 'mine' : ''}">${m.session ? `<span class="pick-sub">About ${esc(sessionNames[m.session] || 'a workout')}</span>` : ''}<p>${esc(m.text)}</p><span class="pick-sub">${ctx.fmtDate(new Date(m.created).toISOString().slice(0, 10))}</span></div>`).join('')}</div>`;
  }

  // A coach's plan suggestion, shown to the client as what changes on each day.
  function reviewSheet(id) {
    const p = (data.proposals || []).find((x) => x.id === id);
    if (!p) return;
    const db = ctx.db;
    const exName = (eid) => db.exercises[eid]?.name || p.data.exercises?.[eid]?.name || eid;
    const fmtItem = (it) => `${esc(exName(it.exerciseId))} <span class="muted">${it.sets} × ${it.repMin}${it.repMax && it.repMax !== it.repMin ? `–${it.repMax}` : ''}</span>`;
    const days = Object.entries(p.data.days || {}).sort(([a], [b]) => weekOrder().indexOf(a) - weekOrder().indexOf(b));
    const diff = days.map(([day, next]) => {
      const cur = db.plan[day];
      if (!next) return `<div class="diff-day"><b>${FULL_DAY[day]}</b><p class="small bad-text">Rest day (removes ${esc(cur?.name || 'this day')})</p></div>`;
      const before = new Map((cur?.items || []).map((it) => [it.exerciseId, it]));
      const after = new Set(next.items.map((it) => it.exerciseId));
      // Only what changes; unchanged exercises are counted, not listed.
      let same = 0;
      const lines = [];
      for (const it of next.items) {
        const b = before.get(it.exerciseId);
        if (!b) { lines.push(`<li class="add">${fmtItem(it)}</li>`); continue; }
        if (b.sets !== it.sets || b.repMin !== it.repMin || b.repMax !== it.repMax) lines.push(`<li class="chg">${fmtItem(it)} <span class="muted small">(was ${b.sets} × ${b.repMin}${b.repMax !== b.repMin ? `–${b.repMax}` : ''})</span></li>`);
        else same += 1;
      }
      for (const [eid, b] of before) if (!after.has(eid)) lines.push(`<li class="del">${fmtItem(b)}</li>`);
      return `<div class="diff-day"><b>${FULL_DAY[day]}${next.name ? ` · ${esc(next.name)}` : ''}</b><ul class="diff">${lines.join('')}</ul>${same ? `<p class="muted small">${same} other ${same === 1 ? 'exercise stays' : 'exercises stay'} the same.</p>` : ''}</div>`;
    }).join('');
    ctx.openSheet(`<h2>Plan changes from ${esc(nameOf(p.coach))}</h2>
      ${p.note ? `<p class="small">“${esc(p.note)}”</p>` : ''}
      ${diff}
      <p class="muted small">Added, <span class="chg-key">changed</span> and <span class="del-key">removed</span> exercises. Your history and progress stay as they are. A snapshot of your data is kept first.</p>
      <button class="btn primary block" data-a="ppl-decide" data-id="${id}" data-v="1">Accept changes</button>
      <button class="btn block" data-a="ppl-decide" data-id="${id}" data-v="0">Decline</button>`);
  }
  async function acceptProposal(p) {
    const db = ctx.db;
    await safetySnapshot(db, 'Before coach plan change');
    for (const [eid, ex] of Object.entries(p.data.exercises || {})) if (!db.exercises[eid] && ex?.name) db.exercises[eid] = ex;
    for (const [day, next] of Object.entries(p.data.days || {})) {
      if (!next) { delete db.plan[day]; continue; }
      // Keep this phone's per-item settings (warm-ups, rotation, goal) where the exercise stays.
      const before = new Map((db.plan[day]?.items || []).map((it) => [it.exerciseId, it]));
      db.plan[day] = { ...(db.plan[day] || {}), ...next, items: next.items.filter((it) => db.exercises[it.exerciseId]).map((it) => ({ ...(before.get(it.exerciseId) || {}), ...it })) };
    }
    ctx.persist();
  }

  // ---------- Coach: a client's page ----------
  async function loadClient(id, force = false) {
    if (clients[id] && !force) return;
    try {
      const r = await api('/v2/coach/client', { client: id }, { auth: true });
      const docs = { plan: {}, exercises: {}, sessions: [], bodyweight: [], foodLog: [], root: {} };
      for (const d of r.docs) {
        const [coll, ...rest] = d.id.split('/'); const key = decodeURIComponent(rest.join('/'));
        if (coll === 'plan') docs.plan[key] = d.data;
        else if (coll === 'exercises') docs.exercises[key] = d.data;
        else if (coll === 'sessions') docs.sessions.push(d.data);
        else if (coll === 'bodyweight') docs.bodyweight.push(d.data);
        else if (coll === 'foodLog') docs.foodLog.push(d.data);
        else if (coll === 'root') docs.root[key] = d.data;
      }
      docs.sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
      docs.bodyweight.sort((a, b) => (a.date < b.date ? -1 : 1));
      clients[id] = { perms: r.perms, ...docs };
    } catch (e) { clients[id] = { error: e.message }; }
    if (pv().client === id) ctx.render();
  }
  const exNameFor = (cl, eid) => cl?.exercises?.[eid]?.name || ctx.db.exercises[eid]?.name || eid;

  function clientScreen(id) {
    const l = myClients().find((x) => x.user.id === id);
    const head = `<header class="top"><button class="back" data-a="ppl-back" aria-label="Back">${icon('left')}</button><h1 class="grow">${esc(l?.user.name || 'Client')}</h1></header>`;
    if (!l) return `${head}<p class="muted small pad">This client is no longer connected.</p>`;
    const cl = clients[id];
    if (!cl) { loadClient(id); return `${head}<p class="muted small pad">Loading…</p>`; }
    if (cl.error) return `${head}<p class="small pad">${esc(cl.error)}</p>`;
    const c = cardOf(id); const w = weekOf(c); const p = progressOf(c);
    const perms = cl.perms || {};
    const shared = Object.entries(PERM_LABELS).filter(([k]) => perms[k]).map(([, v]) => v);
    const pending = (data.proposals || []).find((x) => x.status === 'pending' && x.client === id);
    const recent = (data.proposals || []).find((x) => x.status !== 'pending' && x.client === id);
    const msgs = (data.messages || []).filter((m) => m.link === l.id).sort((a, b) => a.created - b.created).slice(-12);
    markSeen(l.id);
    const sessionNames = Object.fromEntries(cl.sessions.map((s) => [s.id, `${ctx.fmtDate(s.date)} · ${cl.plan[s.day]?.name || 'workout'}`]));
    const order = weekOrder().filter((d) => cl.plan[d]);
    let out = `${head}
      <section class="card"><h3>This week</h3><div class="kv-list">
        <div class="kv"><span>Workouts</span><b>${w.done}${w.planned ? ` of ${w.planned}` : ''} · ${w.sets} sets</b></div>
        <div class="kv"><span>Streak</span><b>${c?.streak || 0} ${c?.streak === 1 ? "week" : "weeks"}</b></div>
        <div class="kv"><span>Strength, 4 weeks</span><b>${fmtPct(p.pct)}</b></div>
      </div><p class="muted small">Shares: ${shared.length ? shared.join(', ') : 'weekly summary only'}.</p></section>
      <section class="card"><h3>Notes</h3>${thread(msgs, sessionNames)}
        <div class="field"><textarea id="ppl-msg" rows="2" placeholder="Note to ${esc(l.user.name)}"></textarea></div>
        <button class="btn primary block" data-a="ppl-send" data-id="${l.id}">Send</button></section>`;
    if (perms.plan) {
      out += `<h2 class="group-title">Plan</h2>
        ${pending ? `<div class="notice-card"><b>Suggestion sent</b><p class="small">${Object.keys(pending.data.days).length} ${Object.keys(pending.data.days).length === 1 ? 'day' : 'days'}, waiting for ${esc(l.user.name)}.</p><div class="row"><button class="btn" data-a="ppl-withdraw" data-id="${pending.id}">Withdraw</button></div></div>` : ''}
        ${!pending && recent ? `<p class="muted small pad">Last suggestion ${recent.status} ${recent.decided ? ctx.fmtDate(new Date(recent.decided).toISOString().slice(0, 10)) : ''}.</p>` : ''}
        <div class="list-group">${order.map((d) => `<div class="list-row"><span class="grow"><b>${FULL_DAY[d]} · ${esc(cl.plan[d].name || '')}</b><span class="pick-sub">${cl.plan[d].items.map((it) => esc(exNameFor(cl, it.exerciseId))).join(', ')}</span></span></div>`).join('') || '<div class="list-row"><span class="grow muted">No plan yet</span></div>'}</div>
        <button class="btn primary block" data-a="ppl-edit">Suggest changes</button>`;
    }
    if (perms.workouts) {
      out += `<h2 class="group-title">Recent workouts</h2><div class="list-group">${cl.sessions.slice(0, 8).map((s) => `<details class="list-row sess"><summary><span class="grow"><b>${ctx.fmtDate(s.date)} · ${esc(cl.plan[s.day]?.name || (s.freestyle ? 'Freestyle' : 'Workout'))}</b><span class="pick-sub">${s.entries.length} exercises${s.prs?.length ? ` · ${s.prs.length} records` : ''}</span></span></summary>
        <ul class="sess-sets">${s.entries.map((e) => `<li><b>${esc(e.name || exNameFor(cl, e.exerciseId))}</b> <span class="muted small">${e.sets.filter((x) => x.type !== 'w').map((x) => (x.weight ? `${wt(x.weight)}×${x.reps}` : `${x.reps ?? x.value ?? ''}`)).join(', ')}</span>${e.feedback ? ` <span class="pill">${esc(e.feedback)}</span>` : ''}${e.pain ? ' <span class="pill bad">pain</span>' : ''}</li>`).join('')}</ul>
        <button class="mini" data-a="ppl-note-session" data-id="${l.id}" data-s="${esc(s.id)}">Note on this workout</button></details>`).join('') || '<div class="list-row"><span class="grow muted">No workouts yet</span></div>'}</div>`;
    }
    if (perms.body && cl.bodyweight.length) {
      const last = cl.bodyweight[cl.bodyweight.length - 1];
      const old = cl.bodyweight.filter((b) => b.date <= addDays(last.date, -28)).pop();
      out += `<h2 class="group-title">Body</h2><div class="card kv-list"><div class="kv"><span>Weight ${ctx.fmtDate(last.date)}</span><b>${wt(last.weight)}</b></div>${old ? `<div class="kv"><span>Change over 4 weeks</span><b>${last.weight - old.weight > 0 ? '+' : ''}${wt(Math.round((last.weight - old.weight) * 10) / 10)}</b></div>` : ''}</div>`;
    }
    if (perms.food && cl.foodLog.length) {
      const days = {}; const from = addDays(todayStr(), -7);
      for (const f of cl.foodLog) if (f.date >= from && f.date < todayStr()) { const d = (days[f.date] ||= { k: 0, p: 0 }); d.k += f.kcal || 0; d.p += f.p || 0; }
      const n = Object.keys(days).length;
      const avg = (k) => Math.round(Object.values(days).reduce((a, d) => a + d[k], 0) / Math.max(1, n));
      out += `<h2 class="group-title">Food</h2><div class="card kv-list"><div class="kv"><span>Days logged, last 7</span><b>${n}</b></div>${n ? `<div class="kv"><span>Average</span><b>${avg('k').toLocaleString()} kcal · ${avg('p')} g protein</b></div>` : ''}</div>`;
    }
    out += `<button class="btn plain block danger-text" data-a="ppl-unlink" data-id="${l.id}">Stop coaching ${esc(l.user.name)}</button>`;
    return out;
  }

  // ---------- Coach: plan editor ----------
  function planEditor(id) {
    const cl = clients[id]; const e = pv().edit;
    const l = myClients().find((x) => x.user.id === id);
    const days = weekOrder().filter((d) => e.days[d]);
    return `<header class="top"><button class="back" data-a="ppl-edit-cancel" aria-label="Cancel">${icon('left')}</button><h1 class="grow">Suggest changes</h1></header>
      <p class="muted small pad">${esc(l?.user.name || '')} reviews these before anything changes. Sets and the rep range per exercise.</p>
      ${templates().length ? '<button class="btn block" data-a="ppl-tpl-load">Start from a template</button>' : ''}
      ${days.map((d) => `<section class="card"><div class="row between"><h3>${FULL_DAY[d]}${e.days[d].name ? ` · ${esc(e.days[d].name)}` : ''}</h3><button class="mini" data-a="ppl-ed-rest" data-d="${d}">Make rest day</button></div>
        ${e.days[d].items.map((it, i) => `<div class="ed-item"><div class="row between"><b>${esc(exNameFor(cl, it.exerciseId))}</b><button class="icon-btn" data-a="ppl-ed-del" data-d="${d}" data-i="${i}" aria-label="Remove">${icon('trash')}</button></div>
          <div class="ed-nums">
            <label><span>Sets</span><input type="text" inputmode="numeric" data-ed="sets" data-d="${d}" data-i="${i}" value="${it.sets}"></label>
            <label><span>Reps from</span><input type="text" inputmode="numeric" data-ed="repMin" data-d="${d}" data-i="${i}" value="${it.repMin}"></label>
            <label><span>to</span><input type="text" inputmode="numeric" data-ed="repMax" data-d="${d}" data-i="${i}" value="${it.repMax}"></label>
          </div></div>`).join('')}
        <button class="btn block" data-a="ppl-ed-add" data-d="${d}">Add exercise</button></section>`).join('')}
      <div class="field"><span>Note for ${esc(l?.user.name || 'your client')}</span><textarea id="ppl-ed-note" rows="2" placeholder="Why these changes">${esc(e.note || '')}</textarea></div>
      ${others(id).length ? `<div class="field"><span>Also send to</span><div class="list-group">${others(id).map((o) => `<label class="list-row toggle"><span class="grow">${esc(o.user.name)}<span class="pick-sub">Replaces the same weekdays in their plan</span></span><input type="checkbox" data-also="${o.user.id}"></label>`).join('')}</div></div>` : ''}
      <button class="btn primary block" data-a="ppl-ed-send">Send suggestion</button>
      <button class="btn plain block" data-a="ppl-tpl-save">Save as a template</button>`;
  }
  // Coach templates (synced with the coach's own data): a week of days to start suggestions from.
  const templates = () => ctx.db.coachTemplates || [];
  // Other clients who share their plan, for sending one suggestion to several people.
  const others = (id) => myClients().filter((x) => x.user.id !== id && x.perms?.plan);

  function addExerciseSheet(day, q = '') {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = Object.values(ctx.db.exercises).filter((x) => x?.name && words.every((w) => x.name.toLowerCase().includes(w))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
    ctx.openSheet(`<h2>Add to ${FULL_DAY[day]}</h2>
      <input class="search" id="ppl-ex-q" type="search" placeholder="Search exercises" value="${esc(q)}" data-d="${day}">
      <div class="list-group" id="ppl-ex-list">${list.map((x) => `<button class="list-row" data-a="ppl-ed-pick" data-d="${day}" data-id="${esc(x.id)}"><span class="grow">${esc(x.name)}</span></button>`).join('')}</div>`);
  }

  // ---------- Actions ----------
  const actions = {
    'ppl-invite': () => inviteSheet(),
    'ppl-new': (d) => {
      if (d.v === 'coach') {
        ctx.openSheet(`<h2>Ask someone to coach you</h2><p class="small">Choose what your coach can see. You can change it or stop at any time.</p>
          ${permToggles({ plan: true, workouts: true, body: false, food: false })}
          <button class="btn primary block" data-a="ppl-new-coach">Create invite</button>`);
        return;
      }
      createInvite(d.v);
    },
    'ppl-new-coach': () => createInvite('coach', readPerms()),
    'ppl-share': async (d) => {
      try { if (navigator.share) await navigator.share({ title: 'Lift Tracker invite', text: shareText(d.v) }); else { await navigator.clipboard.writeText(shareText(d.v)); ctx.toast('Invite copied.'); } } catch {}
    },
    'ppl-invite-cancel': async (d) => { try { await api('/v2/social/invite/cancel', { code: d.v }, { auth: true }); await refresh(); } catch (e) { ctx.toast(e.message); } },
    'ppl-code': () => ctx.openSheet(`<h2>Enter an invite code</h2><div class="field"><div class="row"><input id="ppl-code" class="grow" type="text" autocapitalize="characters" autocomplete="off" placeholder="ABCD-EFGH">${navigator.clipboard?.readText ? '<button class="btn" data-a="ppl-paste">Paste</button>' : ''}</div></div><button class="btn primary block" data-a="ppl-code-go">Continue</button>`),
    // iPhone shows its own small "Paste" bubble to allow reading the clipboard.
    'ppl-paste': async () => {
      try {
        const t = await navigator.clipboard.readText();
        const m = /([A-Za-z0-9]{4})-?([A-Za-z0-9]{4})/.exec(t || '');
        const el = document.getElementById('ppl-code');
        if (m && el) { el.value = `${m[1]}-${m[2]}`.toUpperCase(); peekInvite(el.value); } else ctx.toast('No invite code on the clipboard.');
      } catch { ctx.toast('Paste it into the box instead (touch and hold, then Paste).'); }
    },
    'ppl-copy-code': async (d) => { try { await navigator.clipboard.writeText(d.v); ctx.toast('Copied. Now open Lift from your Home Screen.'); } catch { ctx.toast('Touch and hold the code to copy it.'); } },
    'ppl-invite-here': () => { ctx.closeSheet(); setTimeout(async () => { await refresh(); maybeInvite(); }, 300); },
    'ppl-code-go': () => { const c = document.getElementById('ppl-code')?.value || ''; if (c.replace(/[^A-Za-z0-9]/g, '').length !== 8) return ctx.toast('Invite codes are 8 letters and numbers.'); peekInvite(c); },
    'ppl-accept': async (d) => {
      const perms = document.querySelector('#sheet [data-perm]') ? readPerms() : undefined;
      try { const r = await api('/v2/social/accept', { code: d.v, perms }, { auth: true }); ctx.closeSheet(); await publish(); await refresh(); ctx.toast(r.link.kind === 'friend' ? `You and ${r.link.user.name} are now friends.` : `Connected with ${r.link.user.name}.`); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-board': (d) => { pv().board = d.v; ctx.render(); },
    'ppl-friend': (d) => friendSheet(d.id),
    'ppl-challenge': (d) => challengeSheet(d.id, d.k || 'workouts', +(d.d || 7)),
    'ppl-challenge-send': async (d) => {
      const ex = d.k === 'lift' ? document.getElementById('ppl-lift')?.value : null;
      const exName = ex ? cardOf(me())?.lifts?.[ex]?.name : null;
      try { await api('/v2/social/contest', { to: d.id, kind: d.k, days: +d.d, ex, exName }, { auth: true }); ctx.closeSheet(); await refresh(); ctx.toast(`Challenge sent to ${nameOf(d.id)}.`); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-contest-answer': async (d) => { try { await api('/v2/social/contest/respond', { id: d.id, accept: d.v === '1', today: todayStr() }, { auth: true }); await refresh(); ctx.toast(d.v === '1' ? 'Challenge on. It starts today.' : 'Declined.'); } catch (e) { ctx.toast(e.message); } },
    'ppl-contest-cancel': async (d) => { try { await api('/v2/social/contest/respond', { id: d.id, cancel: true }, { auth: true }); await refresh(); } catch (e) { ctx.toast(e.message); } },
    'ppl-cheer': async (d, el) => {
      const onNow = el.getAttribute('aria-pressed') !== 'true';
      const key = `${d.o}:${d.i}`;
      const list = (data.cheers[key] ||= []);
      if (onNow) list.push({ id: me(), name: 'You' }); else data.cheers[key] = list.filter((x) => x.id !== me());
      ctx.haptic(); ctx.render();
      try { await api('/v2/social/cheer', { owner: d.o, item: d.i, on: onNow }, { auth: true }); } catch (e) { ctx.toast(e.message); refresh(); }
    },
    'ppl-thread': (d) => threadSheet(d.id),
    'ppl-send': async (d) => {
      const el = document.getElementById('ppl-msg'); const text = el?.value.trim();
      if (!text) return;
      try { await api('/v2/coach/message', { link: d.id, text, session: pv().noteSession || undefined }, { auth: true }); pv().noteSession = null; el.value = ''; await refresh(); markSeen(d.id); if (!document.getElementById('sheet').hidden) threadSheet(d.id); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-note-session': (d) => { pv().noteSession = d.s; const el = document.getElementById('ppl-msg'); if (el) { el.placeholder = 'Note about this workout'; el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
    'ppl-perms': async (d) => { try { await api('/v2/social/link/perms', { id: d.id, perms: readPerms() }, { auth: true }); ctx.closeSheet(); await refresh(); ctx.toast('Saved.'); } catch (e) { ctx.toast(e.message); } },
    'ppl-unlink': async (d) => {
      const l = links().find((x) => x.id === d.id);
      if (!l || !(await ctx.ask(l.kind === 'friend' ? `Remove ${l.user.name} as a friend? You'll stop seeing each other's summaries.` : `End coaching with ${l.user.name}? Notes between you are deleted and they stop seeing ${l.role === 'coach' ? 'your data' : 'nothing changes on their phone'}.`, 'Remove', true))) return;
      try { await api('/v2/social/link/remove', { id: d.id }, { auth: true }); ctx.closeSheet(); pv().client = null; await refresh(); ctx.toast('Removed.'); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-review': (d) => reviewSheet(d.id),
    'ppl-decide': async (d) => {
      const p = (data.proposals || []).find((x) => x.id === d.id);
      try {
        await api('/v2/coach/decide', { id: d.id, accept: d.v === '1' }, { auth: true });
        if (d.v === '1' && p) { await acceptProposal(p); ctx.toast('Plan updated.'); } else ctx.toast('Declined.');
        ctx.closeSheet(); await refresh();
      } catch (e) { ctx.toast(e.message); }
    },
    'ppl-client': (d) => { pv().client = d.id; pv().edit = null; loadClient(d.id, true); window.scrollTo(0, 0); ctx.render(); },
    'ppl-back': () => { pv().client = null; window.scrollTo(0, 0); ctx.render(); },
    'ppl-withdraw': async (d) => { try { await api('/v2/coach/withdraw', { id: d.id }, { auth: true }); await refresh(); } catch (e) { ctx.toast(e.message); } },
    'ppl-edit': () => {
      const cl = clients[pv().client];
      pv().edit = { days: JSON.parse(JSON.stringify(cl.plan)), orig: JSON.stringify(cl.plan), note: '' };
      window.scrollTo(0, 0); ctx.render();
    },
    'ppl-edit-cancel': () => { pv().edit = null; window.scrollTo(0, 0); ctx.render(); },
    'ppl-ed-del': (d) => { pv().edit.days[d.d].items.splice(+d.i, 1); ctx.render(); },
    'ppl-ed-add': (d) => addExerciseSheet(d.d),
    'ppl-ed-pick': (d) => {
      const items = pv().edit.days[d.d].items;
      const g = Math.max(0, ...items.map((x) => parseInt(x.group, 10) || 0)) + 1;
      items.push({ uid: `${d.d}-c${Date.now().toString(36)}`, exerciseId: d.id, group: String(g), sets: 3, repMin: 8, repMax: 12, restSec: 90, note: '', manual: true });
      ctx.closeSheet(); ctx.render();
    },
    'ppl-ed-send': async () => {
      const e = pv().edit; const id = pv().client; const cl = clients[id];
      e.note = document.getElementById('ppl-ed-note')?.value || '';
      const orig = JSON.parse(e.orig);
      const days = Object.fromEntries(Object.entries(e.days).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(orig[k])));
      for (const k of Object.keys(orig)) if (!e.days[k]) days[k] = null; // made a rest day
      if (!Object.keys(days).length) return ctx.toast('Nothing changed yet.');
      const exercises = {};
      for (const day of Object.values(days)) for (const it of day?.items || []) if (!cl.exercises[it.exerciseId] && ctx.db.exercises[it.exerciseId]) exercises[it.exerciseId] = ctx.db.exercises[it.exerciseId];
      // Other clients get the same weekdays (the full day as written here), with every exercise it uses.
      const also = [...document.querySelectorAll('[data-also]:checked')].map((x) => x.dataset.also);
      const allEx = {};
      for (const day of Object.values(e.days)) for (const it of day.items) if (ctx.db.exercises[it.exerciseId]) allEx[it.exerciseId] = ctx.db.exercises[it.exerciseId];
      const changedDays = Object.fromEntries(Object.keys(days).map((k) => [k, e.days[k] || null]));
      try {
        await api('/v2/coach/propose', { client: id, days, exercises, note: e.note }, { auth: true });
        for (const o of also) await api('/v2/coach/propose', { client: o, days: changedDays, exercises: allEx, note: e.note }, { auth: true });
        pv().edit = null; await refresh(); window.scrollTo(0, 0); ctx.render();
        ctx.toast(also.length ? `Suggestion sent to ${also.length + 1} clients.` : 'Suggestion sent.');
      } catch (err) { ctx.toast(err.message); }
    },
    'ppl-ed-rest': (d) => { delete pv().edit.days[d.d]; ctx.render(); },
    'ppl-tpl-save': () => ctx.openSheet(`<h2>Save as a template</h2><p class="muted small">Start other clients' suggestions from this week.</p>
      <div class="field"><input id="tpl-name" type="text" maxlength="40" placeholder="e.g. Beginner full body 3 days" autocomplete="off"></div>
      <button class="btn primary block" data-a="ppl-tpl-save-go">Save template</button>`),
    'ppl-tpl-save-go': () => {
      const name = (document.getElementById('tpl-name')?.value || '').trim();
      if (!name) return ctx.toast('Give it a name.');
      const e = pv().edit;
      const exercises = {};
      for (const day of Object.values(e.days)) for (const it of day.items) if (ctx.db.exercises[it.exerciseId]) exercises[it.exerciseId] = ctx.db.exercises[it.exerciseId];
      (ctx.db.coachTemplates ||= []).push({ id: `t${Date.now().toString(36)}`, name, days: JSON.parse(JSON.stringify(e.days)), exercises, created: Date.now() });
      ctx.persist(); ctx.closeSheet(); ctx.toast('Template saved.');
    },
    'ppl-tpl-load': () => ctx.openSheet(`<h2>Start from a template</h2><p class="muted small">Replaces the week in the editor. Nothing is sent until you tap Send.</p>
      <div class="list-group">${templates().map((t) => `<div class="list-row"><button class="grow plain-pick" data-a="ppl-tpl-use" data-id="${t.id}"><b>${esc(t.name)}</b><span class="pick-sub">${Object.keys(t.days).length} days</span></button><button class="icon-btn subtle" data-a="ppl-tpl-del" data-id="${t.id}" aria-label="Delete ${esc(t.name)}">${icon('trash')}</button></div>`).join('')}</div>`),
    'ppl-tpl-use': (d) => {
      const t = templates().find((x) => x.id === d.id);
      if (!t) return;
      for (const [eid, ex] of Object.entries(t.exercises || {})) if (!ctx.db.exercises[eid]) ctx.db.exercises[eid] = ex;
      pv().edit.days = JSON.parse(JSON.stringify(t.days));
      ctx.closeSheet(); ctx.render(); ctx.toast(`${t.name} loaded.`);
    },
    'ppl-tpl-del': async (d) => {
      if (!(await ctx.ask('Delete this template? Suggestions already sent are not affected.', 'Delete', true))) return;
      ctx.db.coachTemplates = templates().filter((x) => x.id !== d.id); ctx.persist(); ctx.closeSheet();
    },
  };

  // Typing in the plan editor and the exercise search.
  function onInput(e) {
    const el = e.target;
    if (el.dataset?.ed) {
      const it = pv().edit?.days[el.dataset.d]?.items[+el.dataset.i];
      const n = parseInt(el.value, 10);
      if (it && n > 0 && n < 100) it[el.dataset.ed] = n;
      return true;
    }
    if (el.id === 'ppl-ex-q') {
      const words = el.value.toLowerCase().split(/\s+/).filter(Boolean);
      const list = Object.values(ctx.db.exercises).filter((x) => x?.name && words.every((w) => x.name.toLowerCase().includes(w))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
      document.getElementById('ppl-ex-list').innerHTML = list.map((x) => `<button class="list-row" data-a="ppl-ed-pick" data-d="${el.dataset.d}" data-id="${esc(x.id)}"><span class="grow">${esc(x.name)}</span></button>`).join('');
      return true;
    }
    return false;
  }

  // Badge for the tab: things waiting on me.
  function pendingCount() {
    if (!data) return 0;
    return (data.contests || []).filter((c) => c.status === 'pending' && c.b === me()).length
      + (data.proposals || []).filter((p) => p.status === 'pending' && p.client === me()).length
      + coaches().concat(myClients()).reduce((a, l) => a + unread(l), 0);
  }

  return { screen, actions, onInput, refresh, publish, schedule, start, reset, pendingCount, maybeInvite };
}
