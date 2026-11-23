// People tab (signed in only): friends, a weekly board, head-to-head challenges, a feed of records,
// and coaching (a coach sees what a client shares, suggests plan changes, and they exchange notes).
// Server side: cloud/social.js. What friends see is the card from card.js, published by this phone.

import { icon } from './icons.js';
import { account, api, setAccountName } from './account.js';
import { buildCard, weekOf, progressOf, contestScore, contestEnd, recentRecords, weekPoints, POINTS } from './card.js';
import { cloudConfig } from './cloud.js';
import { todayStr, addDays, mondayOf, weekOrder, safetySnapshot } from './store.js';
import { wt, wtEst, toDisp, wUnit } from './units.js';
import { APP_URL } from './ui-train.js';
import { CONTEST_KINDS, SCORED_KINDS, metricValue } from './big-goal.js';
import { loadArt } from './equipment.js';
import { activeGym } from './gym.js';
import { accomplishments, activities, activityItems, buildHighlight, highlightHtml, highlightPayload, modesFor, runFields } from './post-highlight.js';

const CACHE = 'lift.social';
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const SEEN = 'lift.social.seen';
const INVITE = 'lift.invite';
const GOAL_LABELS = { strength: 'Strength', size: 'Muscle size', fitness: 'General fitness', sport: 'A sport' };
const REPORT_REASONS = { harassment: 'Harassment or bullying', hate: 'Hate speech', sexual: 'Nudity or sexual content', violence: 'Violence or threats', selfharm: 'Self-harm', spam: 'Spam or scam', other: 'Something else' };
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
        publishScores();
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
    publishScores();
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
      <h3 class="sheet-h">Have ProFitz (working title) on your Home Screen?</h3>
      <p class="small">Open it there, go to People and tap <b>Enter an invite code</b>, then <b>Paste</b>. iPhone always opens links in Safari, so the code is how the invite gets to the app.</p>
      <h3 class="sheet-h">New to ProFitz (working title)?</h3>
      <p class="small">Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>. Open ProFitz (working title) from there, create an account in Settings → Account and sync, then paste the code in People.</p>
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
  const reqs = () => [...(data?.requests?.in || []), ...(data?.requests?.out || [])];
  const nameOf = (id) => (id === me() ? 'You' : links().find((l) => l.user.id === id)?.user.name || reqs().find((r) => r.user.id === id)?.user.name || 'Someone');
  const myName = () => data?.me?.name || account()?.user?.name || 'You';
  const profOf = (id) => data?.profiles?.[id] || null;
  const myHandle = () => profOf(me())?.handle || null;
  // A round photo, or initials when there's none.
  function avatarOf(owner, name, photo, size = '') {
    const ini = String(name || '?').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
    return photo ? `<span class="avatar ${size}"><img src="${mediaUrl(owner, { id: photo })}" alt="" loading="lazy"></span>` : `<span class="avatar ${size}" aria-hidden="true">${esc(ini)}</span>`;
  }
  const avatar = (id, size = '') => avatarOf(id, id === me() ? myName() : nameOf(id), profOf(id)?.photo, size);
  const cardOf = (id) => data?.cards?.[id] || null;
  const fmtPct = (p) => (p == null ? '—' : `${p > 0 ? '+' : ''}${p.toFixed(1)}%`);
  const ago = (d) => { const n = Math.round((Date.parse(todayStr()) - Date.parse(d)) / 86400000); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; };
  const unread = (link) => {
    const seen = ls.get(SEEN, {})[link.id] || 0;
    return (data?.messages || []).filter((m) => m.link === link.id && m.from !== me() && m.created > seen).length;
  };
  const markSeen = (linkId) => { const s = ls.get(SEEN, {}); s[linkId] = Date.now(); ls.set(SEEN, s); };
  const shareText = (code) => `Join me on ProFitz (working title): ${APP_URL}?invite=${code}\nOr open People → Enter a code: ${code}`;

  // ---------- Main screen ----------
  function screen() {
    const v = pv();
    if (v.profile) return profileScreen(v.profile);
    if (v.client && v.edit) return planEditor(v.client);
    if (v.client) return clientScreen(v.client);
    if (!data && !lastError) { refresh(); }
    const head = `<header class="top">${data ? `<button class="ppl-me" data-a="ppl-friend" data-id="${me()}" aria-label="Your profile">${avatar(me(), 'md')}</button>` : ''}<div class="grow"><h1>People</h1></div><button class="icon-btn" data-a="ppl-invite" aria-label="Add friends">${icon('plus')}</button></header>`;
    if (!data) return `${head}<p class="muted small pad">${lastError ? esc(lastError) : 'Loading…'}</p>`;
    if (!links().length) {
      return `${head}
        <div class="card ppl-empty">
          <h3>Train with friends or a coach</h3>
          <p class="small">Compare weeks with friends, like each other's records, and run challenges. A coach can follow what you share.</p>
          <button class="btn primary block" data-a="ppl-invite">Find a friend by username</button>
          <button class="btn block" data-a="ppl-new" data-v="friend">Invite a friend</button>
          <button class="btn block" data-a="ppl-new" data-v="coach">Ask someone to coach you</button>
          <button class="btn block" data-a="ppl-new" data-v="client">Coach someone</button>
        </div>
        ${todo()}
        ${myHandle() ? '' : '<p class="muted small center pad">Choose a username so friends can find you. <button class="text-link small-link" data-a="ppl-edit-profile">Set up your profile</button></p>'}
        ${sentRequests()}
        ${openInvites()}
        <div class="list-group"><button class="list-row" data-a="ppl-code"><span class="grow"><b>Enter an invite code</b></span>${icon('right', 'chev')}</button></div>`;
    }
    return `${head}
      ${todo()}
      ${coachCards()}
      ${friends().length ? `<div class="ppl-actions"><button class="btn" data-a="ppl-compose">${icon('plus')}Post</button><button class="btn" data-a="ppl-challenge-pick">${icon('up')}Challenge</button></div>` : '<div class="ppl-actions one"><button class="btn" data-a="ppl-compose">${icon(\'plus\')}Post</button></div>'}
      ${board()}
      ${contests()}
      ${feed()}
      ${clientsCard()}
      ${sentRequests()}
      ${openInvites()}
      <div class="list-group"><button class="list-row" data-a="ppl-code"><span class="grow"><b>Enter an invite code</b></span>${icon('right', 'chev')}</button></div>`;
  }

  // Things waiting on me: challenges to answer, plan suggestions to review.
  function todo() {
    const out = [];
    for (const r of data.requests?.in || []) {
      const p = profOf(r.user.id);
      out.push(`<div class="notice-card req-card"><div class="row">${avatar(r.user.id, 'md')}<div class="grow"><b>${esc(r.user.name)}</b><span class="pick-sub">${p?.handle ? `@${esc(p.handle)} · ` : ''}wants to be friends</span></div></div>
        <div class="row"><button class="btn primary" data-a="ppl-req-answer" data-id="${r.user.id}" data-v="1">Accept</button><button class="btn" data-a="ppl-req-answer" data-id="${r.user.id}" data-v="0">Decline</button><button class="btn plain" data-a="ppl-person-menu" data-id="${r.user.id}">More</button></div></div>`);
    }
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
      return `<div class="list-group coach-strip"><button class="list-row" data-a="ppl-thread" data-id="${l.id}"><span class="grow"><b>Coach ${esc(l.user.name)}</b><span class="pick-sub">${last ? esc(`${last.from === me() ? 'You: ' : ''}${last.text}`.slice(0, 80)) : 'Send a note, or change what you share'}</span></span>${n ? `<span class="badge">${n}</span>` : ''}${icon('right', 'chev')}</button></div>`;
    }).join('');
  }

  function board() {
    if (!friends().length) return `<div class="card"><h3>Leaderboard</h3><p class="small muted">Invite a friend to compare weeks and progress.</p><button class="btn block" data-a="ppl-new" data-v="friend">Invite a friend</button></div>`;
    const mode = pv().board;
    const ids = [me(), ...friends().map((l) => l.user.id)];
    const weekly = ids.map((id) => { const w = weekOf(cardOf(id)); return { id, pts: weekPoints(w).total, sets: w.sets }; }).sort((x, y) => y.pts - x.pts || y.sets - x.sets);
    const place = weekly.findIndex((x) => x.id === me()) + 1;
    const nth = (n) => { const t = n % 100; return `${n}${t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`; };
    const fold = `<button class="board-fold" data-a="ppl-board-open" aria-expanded="${!!pv().boardOpen}"><span>You're ${nth(place)} this week</span><small>${weekly[place - 1].pts} pts ${pv().boardOpen ? '▴' : '▾'}</small></button>`;
    if (!pv().boardOpen) return fold;
    let rows;
    if (mode === 'progress') {
      rows = ids.map((id) => ({ id, p: progressOf(cardOf(id)) })).sort((a, b) => (b.p.pct ?? -1e9) - (a.p.pct ?? -1e9))
        .map((r, i) => row(r.id, i, fmtPct(r.p.pct), r.p.pct == null ? 'Not enough lifts logged yet' : `Median of ${r.p.lifts.length} ${r.p.lifts.length === 1 ? 'lift' : 'lifts'}${r.p.lifts.length > 1 ? ` · best ${esc(r.p.lifts[0].name)} ${fmtPct(r.p.lifts[0].pct)}` : r.p.lifts[0] ? ` · ${esc(r.p.lifts[0].name)}` : ''}`));
    } else {
      rows = ids.map((id) => { const w = weekOf(cardOf(id)); return { id, w, pts: weekPoints(w), c: cardOf(id) }; }).sort((a, b) => b.pts.total - a.pts.total || b.w.sets - a.w.sets)
        .map((r, i) => row(r.id, i, `${r.pts.total}<small> pts</small>`, `${r.w.workouts ?? r.w.done} ${(r.w.workouts ?? r.w.done) === 1 ? 'workout' : 'workouts'} · ${r.w.sets} sets${r.w.cardioMin ? ` · ${r.w.cardioMin} min cardio` : ''}${r.w.planned && r.w.done >= r.w.planned ? ' · plan done' : ''}`));
    }
    return `${fold}<section class="ppl-board">
      <div class="segmented small-seg" role="tablist" aria-label="Leaderboard">
        <button class="${mode !== 'progress' ? 'on' : ''}" data-a="ppl-board" data-v="week" role="tab" aria-selected="${mode !== 'progress'}">This week</button>
        <button class="${mode === 'progress' ? 'on' : ''}" data-a="ppl-board" data-v="progress" role="tab" aria-selected="${mode === 'progress'}">Progress</button>
      </div>
      <div class="ppl-rows">${rows.join('')}</div>
      <p class="muted small">${mode === 'progress' ? 'Change in estimated strength over about four weeks, so it\'s fair at any level.' : 'Points for workouts, hard sets and cardio. Resets each week. <button class="text-link small-link" data-a="ppl-points">How points work</button>'}</p>
    </section>`;
  }
  function row(id, i, big, sub) {
    const mine = id === me();
    return `<button class="ppl-row ${mine ? 'me' : ''}" data-a="ppl-friend" data-id="${id}"><span class="rank">${i + 1}</span>${avatar(id)}<span class="grow"><b>${esc(nameOf(id))}</b><span class="pick-sub">${sub}</span></span><b class="num">${big}</b></button>`;
  }

  // ---------- Challenges ----------
  const contestLabel = (c) => (c.kind === 'lift' ? `Biggest gain on ${c.exName || 'a lift'}` : CONTEST_KINDS[c.kind]?.label || 'Most workouts');
  const scored = (c) => SCORED_KINDS.includes(c.kind);
  // Minutes, miles and weight lifted: my own total is worked out here; theirs comes from their phone.
  const myScore = (c, today) => metricValue(ctx.db, c.kind, c.start, [contestEnd(c), today].sort()[0]);
  const scoreOf = (c, id, today) => {
    if (!scored(c)) return contestScore(cardOf(id), c, today)?.value ?? null;
    return id === me() ? myScore(c, today) : (c.scores?.[id] ?? 0);
  };
  const fmtScore = (c, v) => {
    if (v == null) return '—';
    if (c.kind === 'workouts') return String(v);
    if (c.kind === 'minutes') return `${Math.round(v).toLocaleString()} min`;
    if (c.kind === 'miles') return `${(Math.round(v * 10) / 10).toLocaleString()} mi`;
    if (c.kind === 'volume') return `${Math.round(toDisp(v)).toLocaleString()} ${wUnit()}`;
    return fmtPct(v);
  };
  // Report my totals for running challenges, only when they change.
  async function publishScores() {
    if (!on() || !navigator.onLine || !data?.contests) return;
    const today = todayStr(); const scores = {};
    for (const c of data.contests) if (c.status === 'active' && c.start && scored(c) && addDays(contestEnd(c), 7) >= today) scores[c.id] = myScore(c, today);
    const key = JSON.stringify(scores);
    if (key === '{}' || ls.get('lift.contest.sent', '') === key) return;
    try { await api('/v2/social/contest/score', { scores }, { auth: true }); ls.set('lift.contest.sent', key); } catch {}
  }
  function contests() {
    const today = todayStr();
    const list = (data.contests || []).filter((c) => (c.status === 'active' && addDays(contestEnd(c), 7) >= today) || (c.status === 'pending' && c.a === me()));
    if (!list.length) return '';
    return `<section class="challenges">${list.map((c) => {
      const other = c.a === me() ? c.b : c.a;
      if (c.status === 'pending') return `<div class="contest"><div class="row between"><b>${esc(contestLabel(c))} · ${esc(nameOf(other))}</b><button class="mini" data-a="ppl-contest-cancel" data-id="${c.id}">Cancel</button></div><p class="muted small">Waiting for ${esc(nameOf(other))} to accept.</p></div>`;
      const end = contestEnd(c);
      const done = today > end;
      const av = scoreOf(c, me(), today); const bv = scoreOf(c, other, today);
            const fmt = (v) => fmtScore(c, v);
      const left = Math.round((Date.parse(end) - Date.parse(today)) / 86400000) + 1;
      const verdict = done ? (av == null && bv == null ? 'No result' : (av ?? -1e9) > (bv ?? -1e9) ? 'You won' : (av ?? -1e9) < (bv ?? -1e9) ? `${esc(nameOf(other))} won` : 'A tie') : c.start > today ? 'Starts tomorrow' : `${left} ${left === 1 ? 'day' : 'days'} left`;
      const ax = Math.max(0, av || 0); const bx = Math.max(0, bv || 0); const share = ax + bx > 0 ? Math.round((ax / (ax + bx)) * 100) : 50;
      return `<div class="contest"><div class="row between"><b>${esc(contestLabel(c))}</b><span class="muted small">${verdict}</span></div><div class="vs-names"><span>You <b class="num">${fmt(av)}</b></span><span><b class="num">${fmt(bv)}</b> ${esc(nameOf(other))}</span></div><div class="vs-bar" role="img" aria-label="You ${fmt(av)}, ${esc(nameOf(other))} ${fmt(bv)}"><i style="width:${share}%"></i></div></div>`;
    }).join('')}</section>`;
  }

  // ---------- Feed ----------
  // Posts people shared on purpose, plus each friend's records and workouts from their card.
  // Records from one person on one day are grouped. Every item can be liked and commented on.
  const mediaUrl = (owner, m) => `${cloudConfig().url.replace(/\/+$/, '')}/v2/media/${owner}/${m.id}`;
  const when = (t) => { const d = typeof t === 'number' ? todayStr(new Date(t)) : t; return ago(d); };
  // One card per workout: its new bests ride along instead of being separate posts, and a workout
  // someone chose to post isn't shown twice. Streak milestones get a small card of their own.
  const MILESTONES = [4, 8, 12, 16, 26, 39, 52, 78, 104];
  function feedItems() {
    const since = addDays(todayStr(), -14);
    const items = [];
    const posted = new Set();
    for (const p of data.posts || []) {
      items.push({ owner: p.user.id, key: `p:${p.id}`, sort: p.created, post: p });
      if (p.kind === 'workout' && !p.data?.hl) posted.add(`${p.user.id}:${p.data?.date || todayStr(new Date(p.created))}`);
    }
    for (const id of [me(), ...friends().map((l) => l.user.id)]) {
      const c = cardOf(id);
      if (!c) continue;
      const recs = (c.records || []).filter((r) => r.date >= since && !posted.has(`${id}:${r.date}`));
      const used = new Set();
      for (const w of c.workouts || []) {
        if (w.date < since || posted.has(`${id}:${w.date}`)) continue;
        const bests = recs.filter((r) => String(r.id).startsWith(`${w.id}:`));
        bests.forEach((r) => used.add(r));
        items.push({ owner: id, key: `w:${w.id}`, sort: Date.parse(`${w.date}T19:00:00`), workout: { ...w, bests } });
      }
      const byDay = {};
      for (const r of recs) if (!used.has(r)) (byDay[r.date] ||= []).push(r);
      for (const [date, rs] of Object.entries(byDay)) {
        items.push({ owner: id, key: rs.length === 1 ? `r:${rs[0].id}` : `rg:${date}`, sort: Date.parse(`${date}T20:00:00`), workout: { name: rs.length === 1 ? 'New best' : 'New bests', date, bests: rs } });
      }
      if (MILESTONES.includes(c.streak) && c.week?.start >= since) items.push({ owner: id, key: `m:${c.week.start}:${c.streak}`, sort: Date.parse(`${c.week.start}T08:00:00`), milestone: c.streak });
    }
    return items.sort((x, y) => y.sort - x.sort);
  }
  const hlHtml = (hl) => highlightHtml(hl, { esc, wt, wtEst, toDisp, fmtDate: ctx.fmtDate, art: (id, w) => (ctx.db.exercises?.[id] ? loadArt(ctx.db.exercises[id], w, activeGym(ctx.db)) : '') });
  function postBody(p) {
    const d = p.data || {};
    let metric = '';
    const art = p.kind === 'record' && d.weight && ctx.db.exercises?.[d.exId] ? loadArt(ctx.db.exercises[d.exId], d.weight, activeGym(ctx.db)) : '';
    if (p.kind === 'record') metric = `<div class="post-metric ${art ? 'has-art' : ''}">${art}<span class="pm-label">New best · ${esc(d.name || '')}</span><b class="num">${d.weight ? `${wt(d.weight)} × ${d.reps}` : d.pct ? `+${d.pct}%` : ''}</b>${d.weight && d.e1rm ? `<span class="pm-sub">Est. max ${wtEst(d.e1rm)}${d.pct ? ` · up ${d.pct}%` : ''}</span>` : ''}</div>`;
    else if (p.kind === 'progress') metric = `<div class="post-metric"><span class="pm-label">${esc(d.name || '')} · ${d.weeks || 8} weeks</span><b class="num">${d.pct > 0 ? '+' : ''}${d.pct}%</b>${d.now ? `<span class="pm-sub">Est. max now ${wtEst(d.now)}</span>` : ''}</div>`;
    else if (p.kind === 'workout' && d.hl) metric = hlHtml(d.hl);
    else if (p.kind === 'workout') metric = `<div class="post-metric"><span class="pm-label">Workout · ${esc(d.date ? ctx.fmtDate(d.date) : '')}</span><b>${esc(d.name || 'Workout')}</b><span class="pm-sub">${d.sets || 0} sets${d.minutes ? ` · ${d.minutes} min` : ''}${d.prs ? ` · ${d.prs} ${d.prs === 1 ? 'record' : 'records'}` : ''}</span></div>`;
    const media = (p.media || []).map((m) => (m.kind === 'video'
      ? `<video class="post-media" src="${mediaUrl(p.user.id, m)}" controls playsinline preload="metadata"></video>`
      : `<img class="post-media" src="${mediaUrl(p.user.id, m)}" alt="Photo from ${esc(p.user.name)}" loading="lazy">`)).join('');
    return `${p.text ? `<p class="post-text">${esc(p.text)}</p>` : ''}${metric}${media ? `<div class="post-media-wrap n${(p.media || []).length}">${media}</div>` : ''}`;
  }
  function workoutBody(w) {
    const stats = [w.sets ? [w.sets, w.sets === 1 ? 'set' : 'sets'] : null, w.minutes ? [w.minutes, 'min'] : null, w.bests?.length ? [w.bests.length, w.bests.length === 1 ? 'new best' : 'new bests'] : null].filter(Boolean);
    return `<div class="post-metric fa-work"><b>${esc(w.name || 'Workout')}</b>
      ${stats.length ? `<div class="hl-stats">${stats.map(([v, l]) => `<div><b class="num">${esc(v)}</b><span>${l}</span></div>`).join('')}</div>` : ''}
      ${w.bests?.length ? `<div class="fa-bests">${w.bests.slice(0, 3).map((r) => `<span>${esc(r.ex)}${r.pct ? ` <b>+${esc(r.pct)}%</b>` : ''}</span>`).join('')}${w.bests.length > 3 ? `<span>+${w.bests.length - 3} more</span>` : ''}</div>` : ''}
    </div>`;
  }
  const whoText = (who) => {
    const names = [...who].sort((a, b) => (b.id === me()) - (a.id === me())).map((x) => (x.id === me() ? 'You' : x.name.split(' ')[0]));
    return names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;
  };
  function feedItem(it) {
    const who = data.cheers?.[`${it.owner}:${it.key}`] || [];
    const liked = who.some((x) => x.id === me());
    const notes = (data.comments || []).filter((c) => c.owner === it.owner && c.item === it.key);
    const last = notes[notes.length - 1];
    const p = it.post;
    const to = p?.audience === 'one' ? (p.user.id === me() ? ` · to ${esc(nameOf(p.to))}` : ' · to you') : '';
    const body = p ? postBody(p) : it.workout ? workoutBody(it.workout)
      : it.milestone ? `<div class="post-metric fa-mile"><span class="pm-label">Streak</span><b class="num">${it.milestone} weeks</b><span class="pm-sub">Hit the weekly goal ${it.milestone} weeks in a row</span></div>` : '';
    const attrs = `data-o="${it.owner}" data-i="${esc(it.key)}"`;
    return `<article class="feed-post" ${attrs}>
      <div class="fp-head">${avatar(it.owner)}<div class="grow"><b>${esc(it.owner === me() ? 'You' : nameOf(it.owner))}</b><span class="pick-sub">${p ? when(p.created) : when(todayStr(new Date(it.sort)))}${to}</span></div>
        ${it.owner !== me() ? `<button class="fp-more" data-a="ppl-person-menu" data-id="${it.owner}" ${p ? `data-post="${p.id}"` : ''} aria-label="More options">${icon('more')}</button>` : p ? `<button class="fp-more" data-a="ppl-post-del" data-id="${p.id}" aria-label="Delete post">${icon('trash')}</button>` : ''}</div>
      ${body}
      ${who.length ? `<button class="fp-who" data-a="ppl-who" ${attrs}><span class="fp-faces" aria-hidden="true">${who.slice(0, 3).map((x) => avatar(x.id)).join('')}</span><span>${esc(whoText(who))} gave big ups</span></button>` : ''}
      ${last ? `<button class="fp-last" data-a="ppl-comments" ${attrs}><b>${esc(last.user.id === me() ? 'You' : last.user.name.split(' ')[0])}</b> ${esc(last.text.slice(0, 90))}${notes.length > 1 ? `<span>View all ${notes.length}</span>` : ''}</button>` : ''}
      <div class="fp-actions">
        <button class="fp-btn ${liked ? 'on' : ''}" data-a="ppl-cheer" ${attrs} aria-pressed="${liked}">${icon('up')}${liked ? 'Big ups given' : 'Big ups'}</button>
        <button class="fp-btn" data-a="ppl-comments" ${attrs}>${icon('note')}Comment${notes.length ? ` · ${notes.length}` : ''}</button>
      </div>
    </article>`;
  }
  // New big ups and comments on your own activity, rolled into one quiet line.
  const DIGEST = 'lift.feedSeen';
  function digestList() {
    const out = [];
    const titles = Object.fromEntries(feedItems().filter((i) => i.owner === me()).map((i) => [i.key, i.workout?.name || i.post?.data?.name || (i.milestone ? `${i.milestone}-week streak` : 'your post')]));
    for (const [k, list] of Object.entries(data.cheers || {})) {
      if (!k.startsWith(`${me()}:`)) continue;
      const item = k.slice(me().length + 1);
      for (const u of list) if (u.id !== me() && titles[item]) out.push({ seen: `k:${item}:${u.id}`, user: u, item, title: titles[item], text: 'gave big ups' });
    }
    for (const c of data.comments || []) if (c.owner === me() && c.user.id !== me() && titles[c.item]) out.push({ seen: `c:${c.id}`, user: c.user, item: c.item, title: titles[c.item], text: `said “${c.text.slice(0, 60)}”` });
    return out;
  }
  function digestNew() {
    const list = digestList();
    const seen = ls.get(DIGEST, null);
    if (!Array.isArray(seen)) { ls.set(DIGEST, list.map((x) => x.seen)); return []; } // first look: nothing is "new"
    const have = new Set(seen);
    return list.filter((x) => !have.has(x.seen));
  }
  function digestRow() {
    const fresh = digestNew();
    if (!fresh.length) return '';
    const people = [...new Map(fresh.map((x) => [x.user.id, x.user])).values()];
    const names = people.length === 1 ? people[0].name.split(' ')[0] : people.length === 2 ? `${people[0].name.split(' ')[0]} and ${people[1].name.split(' ')[0]}` : `${people[0].name.split(' ')[0]} and ${people.length - 1} others`;
    return `<button class="fp-digest" data-a="ppl-digest"><span class="fp-faces" aria-hidden="true">${people.slice(0, 3).map((u) => avatar(u.id)).join('')}</span><span class="grow"><b>${esc(names)}</b> cheered you on</span>${icon('right', 'chev')}</button>`;
  }
  function feed() {
    const items = feedItems();
    const n = pv().feedN || 8;
    const shown = items.slice(0, n);
    const today = todayStr();
    const label = (t) => { const d = Math.round((Date.parse(today) - Date.parse(todayStr(new Date(t)))) / 86400000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier'; };
    let last = '';
    const rows = shown.map((it) => { const l = label(it.sort); const head = l !== last ? `<h3 class="feed-day">${l}</h3>` : ''; last = l; return head + feedItem(it); }).join('');
    return `${digestRow()}<section class="feed-card flat">
      ${items.length ? rows : '<div class="feed-empty"><p class="muted small">Nothing yet. Share a lift, a run or a photo to get things going.</p><button class="btn" data-a="ppl-compose">Share something</button></div>'}
      ${items.length > n ? '<button class="btn plain block" data-a="ppl-more">Show earlier</button>' : items.length ? '<p class="feed-end">You\'re all caught up</p>' : ''}</section>`;
  }

  // ---------- A person's profile: their week, strength, records and posts ----------
  function profileScreen(id) {
    const mine = id === me();
    const l = friends().find((x) => x.user.id === id);
    const head = `<header class="top"><button class="back" data-a="ppl-profile-back" aria-label="Back">${icon('left')}</button><div class="grow"><h1>Profile</h1></div></header>`;
    if (!mine && !l) return `${head}<p class="muted small pad">Not connected any more.</p>`;
    const pr = profOf(id);
    const meta = [pr?.gym, GOAL_LABELS[pr?.goal] && `Training for ${GOAL_LABELS[pr.goal].toLowerCase()}`].filter(Boolean).map(esc).join(' · ');
    const intro = `<section class="profile-intro">${avatar(id, 'xl')}<div class="grow">
        <h2>${esc(mine ? myName() : nameOf(id))}</h2>
        ${pr?.handle ? `<p class="muted small">@${esc(pr.handle)}</p>` : ''}
        ${pr?.bio ? `<p class="small">${esc(pr.bio)}</p>` : ''}
        ${meta ? `<p class="muted small">${meta}</p>` : ''}
      </div></section>
      ${mine ? `<div class="row profile-actions"><button class="btn grow" data-a="ppl-edit-profile">Edit profile</button>${pr?.handle ? '<button class="btn grow" data-a="ppl-share-profile">Share profile</button>' : ''}</div>
        ${pr?.handle ? '' : '<p class="muted small">Add a photo and a username so friends can find you.</p>'}` : ''}`;
    const c = cardOf(id); const w = weekOf(c); const pts = weekPoints(w); const p = progressOf(c);
    const items = feedItems().filter((it) => it.owner === id);
    const records = (c?.records || []).slice(0, 6);
    return `${head}
      ${intro}
      <div class="pstats"><div><b class="num">${w.workouts ?? w.done}</b><small>This week</small></div><div><b class="num">${c?.streak || 0}</b><small>Week streak</small></div><div><b class="num">${pts.total}</b><small>Points</small></div></div>
      ${records[0] ? `<div class="post-metric"><span class="pm-label">Latest best · ${ctx.fmtDate(records[0].date)}</span><b>${esc(records[0].ex)}</b>${records[0].pct ? `<span class="pm-sub">Up ${records[0].pct}%</span>` : ''}</div>` : ''}
      ${mine ? '<button class="btn primary block" data-a="ppl-compose">Share something</button>' : `<button class="btn primary block" data-a="ppl-challenge" data-id="${id}">Challenge ${esc(nameOf(id))}</button>`}
      <details class="profile-more"><summary>Strength and records</summary>
        <div class="kv-list"><div class="kv"><span>Strength change, 4 weeks</span><b class="${(p.pct ?? 0) >= 0 ? 'up' : 'down'}">${fmtPct(p.pct)}</b></div>${w.cardioMin ? `<div class="kv"><span>Cardio this week</span><b>${w.cardioMin} min</b></div>` : ''}<div class="kv"><span>Hard sets this week</span><b>${w.sets}</b></div>${p.lifts.slice(0, 6).map((x) => `<div class="kv"><span>${esc(x.name)}</span><b>${fmtPct(x.pct)}</b></div>`).join('')}${records.map((r) => `<div class="kv"><span>${esc(r.ex)} · ${ctx.fmtDate(r.date)}</span><b>${r.pct ? `+${r.pct}%` : 'New'}</b></div>`).join('')}</div>
      </details>
      <h2 class="group-title">Posts and activity</h2><section class="feed-card flat">${items.length ? items.slice(0, 20).map(feedItem).join('') : '<p class="muted small">Nothing in the last two weeks.</p>'}</section>
      ${mine ? '' : `<button class="btn plain block" data-a="ppl-person-menu" data-id="${id}">More</button>`}
      ${mine && data.blocked?.length ? `<div class="list-group"><button class="list-row" data-a="ppl-blocked"><span class="grow"><b>Blocked people</b><span class="pick-sub">${data.blocked.length}</span></span>${icon('right', 'chev')}</button></div>` : ''}`;
  }
  function pointsSheet() {
    ctx.openSheet(`<h2>How points work</h2>
      <p class="small">Points count the work done this week, so a small plan finished doesn't outrank a bigger week.</p>
      <div class="kv-list">
        <div class="kv"><span>Each workout</span><b>${POINTS.workout} pts, up to ${POINTS.maxWorkouts} a week</b></div>
        <div class="kv"><span>Each hard set</span><b>1 pt, up to ${POINTS.maxSets}</b></div>
        <div class="kv"><span>Every ${POINTS.cardioPer} min of cardio</span><b>1 pt, up to ${POINTS.maxCardio}</b></div>
        <div class="kv"><span>Finishing your plan's week</span><b>${POINTS.planBonus} pts</b></div>
      </div>
      <p class="muted small">The caps sit where more stops helping: past about 20 sets per muscle a week, extra sets add little, and 300 minutes of cardio is the top of the WHO's range. ${ctx.refChips(['pelland2026', 'who2020'])}</p>
      <p class="muted small">For a contest that's fair across sizes and levels, use the Progress board: it compares strength gains in percent. ${ctx.refChips(['zhang2016', 'festinger1954'])}</p>`);
  }

  // Comments on one feed item.
  async function sendComment(owner, item, text) {
    try { await api('/v2/social/comment', { owner, item, text }, { auth: true }); await refresh(); commentsSheet(owner, item); } catch (e) { ctx.toast(e.message); }
  }
  async function setCheer(owner, item, on) {
    const key = `${owner}:${item}`;
    const list = (data.cheers[key] ||= []);
    if (on === list.some((x) => x.id === me())) return;
    if (on) list.push({ id: me(), name: 'You' }); else data.cheers[key] = list.filter((x) => x.id !== me());
    ctx.haptic(); ctx.render();
    try { await api('/v2/social/cheer', { owner, item, on }, { auth: true }); } catch (e) { ctx.toast(e.message); refresh(); }
  }
  // Double-tap a card to give big ups.
  let lastTap = { k: '', t: 0 };
  document.addEventListener('click', (e) => {
    const card = e.target.closest?.('.feed-post[data-o]');
    if (!card || e.target.closest('button, a, video, input, textarea')) return;
    const k = `${card.dataset.o}:${card.dataset.i}`;
    const now = Date.now();
    if (lastTap.k === k && now - lastTap.t < 350) { lastTap = { k: '', t: 0 }; setCheer(card.dataset.o, card.dataset.i, true); } else lastTap = { k, t: now };
  });
  function commentsSheet(owner, item) {
    const list = (data.comments || []).filter((c) => c.owner === owner && c.item === item);
    ctx.openSheet(`<h2>Comments</h2>
      ${list.length ? `<div class="thread">${list.map((c) => `<div class="msg ${c.user.id === me() ? 'mine' : ''}"><span class="pick-sub">${esc(c.user.id === me() ? 'You' : c.user.name)} · ${when(c.created)}</span><p>${esc(c.text)}</p>${c.user.id === me() || owner === me() ? `<button class="text-link small-link" data-a="ppl-comment-del" data-id="${c.id}" data-o="${owner}" data-i="${esc(item)}">Delete</button>` : ''}${c.user.id !== me() ? ` <button class="text-link small-link" data-a="ppl-report" data-k="comment" data-id="${c.id}" data-u="${c.user.id}" data-n="${esc(c.user.name)}">Report</button>` : ''}</div>`).join('')}</div>` : '<p class="muted small">No comments yet.</p>'}
      ${owner !== me() ? `<div class="chips wrap quick-replies">${['Strong', 'Nice work', "Let's go", 'Huge'].map((t) => `<button class="chip" data-a="ppl-quick" data-v="${esc(t)}" data-o="${owner}" data-i="${esc(item)}">${t}</button>`).join('')}</div>` : ''}
      <div class="field"><textarea id="ppl-comment" rows="2" maxlength="500" placeholder="Add a comment"></textarea></div>
      <button class="btn primary block" data-a="ppl-comment-send" data-o="${owner}" data-i="${esc(item)}">Send</button>`);
  }

  // ---------- Sharing: a record with its weight, a workout, a lift's progress, or a photo ----------
  function shareChoices() {
    const db = ctx.db;
    const records = recentRecords(db).slice(0, 8);
    const workouts = [...db.sessions].reverse().slice(0, 8).map((x) => ({ id: x.id, date: x.date, name: x.freestyle ? 'Workout' : db.plan[x.day]?.name || 'Workout', sets: x.entries.reduce((a, e) => a + e.sets.filter((y) => y.done !== false && y.type !== 'w').length, 0), minutes: x.finishedAt && x.startedAt ? Math.round((x.finishedAt - x.startedAt - (x.pausedMs || 0)) / 60000) : null, prs: x.prs?.length || 0 }));
    const card = buildCard(db, account()?.user?.name || '');
    const prog = progressOf(card).lifts.slice(0, 8).map((l) => ({ ...l, now: Math.max(...(card.lifts[l.id]?.pts || [[0, 0]]).slice(-2).map((p) => p[1])) }));
    return { records, workouts, prog };
  }
  // Choose a workout or run, the lift in it, and what to show.
  const hlItems = (c) => activityItems(ctx.db, c.hlSrc);
  const hlBuilt = (c) => buildHighlight(hlItems(c)[c.hlItem || 0], { mode: c.hlMode, set: c.hlSet || 0, show: c.hlShow || {} });
  function highlightPicker(c) {
    const acts = activities(ctx.db);
    if (!acts.length) return '<p class="muted small">Finish a workout or log a run to post it.</p>';
    if (!c.hlSrc || !acts.some((a) => a.id === c.hlSrc) && !hlItems(c).length) c.hlSrc = acts[0].id;
    const full = acts.some((a) => a.id === c.hlSrc) ? acts : [...acts, { id: c.hlSrc, name: 'This workout', date: hlItems(c)[0]?.date }];
    // The latest few, with the chosen one always showing.
    const list = c.hlAll ? full : [...full.slice(0, 3), ...full.slice(3).filter((a, i) => a.id === c.hlSrc || (i === 0 && !full.slice(3).some((b) => b.id === c.hlSrc)))];
    const items = hlItems(c);
    const item = items[Math.min(c.hlItem || 0, items.length - 1)];
    const chip = (a, v, l, on) => `<button class="chip ${on ? 'on' : ''}" data-a="${a}" data-v="${esc(v)}" aria-pressed="${!!on}">${l}</button>`;
    const group = (t, html) => `<div class="field"><span>${t}</span><div class="chips wrap">${html}</div></div>`;
    let how = '';
    if (item?.kind === 'lift') {
      const modes = modesFor(item);
      const mode = modes.some(([k]) => k === c.hlMode) ? c.hlMode : item.isNew ? 'max' : 'sets';
      how = group('What to show', modes.map(([k, l]) => chip('ppl-hl-mode', k, l, k === mode)).join(''));
      if (mode === 'set') how += group('Which set', item.sets.map((s, i) => chip('ppl-hl-set', i, s[2] ? `${s[2]} sec` : s[0] ? `${toDisp(s[0])} × ${s[1]}` : `${s[1]} reps`, i === Math.min(c.hlSet || 0, item.sets.length - 1))).join(''));
    } else if (item) {
      const f = runFields(item);
      how = f.length ? group('What to show', f.map(([k, l]) => chip('ppl-hl-show', k, l, (c.hlShow || {})[k] !== false)).join('')) : '<p class="muted small">Add a distance or time to this run to post it.</p>';
    }
    const built = hlBuilt(c);
    return `${group('Workout or run', list.map((a) => chip('ppl-hl-src', a.id, `${esc(ctx.fmtDate(a.date))} · ${esc(a.name)}`, a.id === c.hlSrc)).join('') + (full.length > 4 ? `<button class="chip" data-a="ppl-hl-more">${c.hlAll ? 'Fewer' : 'More'}</button>` : ''))}
      ${items.length > 1 ? group('Lift or run', items.map((x, i) => chip('ppl-hl-item', i, esc(x.name), i === (c.hlItem || 0))).join('')) : ''}
      ${how}
      ${built ? `<div class="hl-preview"><span class="pick-sub">Preview</span>${hlHtml(built)}</div>` : ''}`;
  }
  function composeSheet() {
    const c = pv().compose;
    const ch = shareChoices();
    const chip = (k, l, n) => `<button class="chip ${c.kind === k ? 'on' : ''}" data-a="ppl-c-kind" data-v="${k}" ${n === 0 ? 'disabled' : ''}>${l}</button>`;
    const pick = (list, label) => `<div class="list-group pick-list">${list.map((x, i) => `<button class="list-row ${c.ref === i ? 'picked' : ''}" data-a="ppl-c-ref" data-v="${i}" aria-pressed="${c.ref === i}"><span class="grow">${label(x)}</span>${c.ref === i ? icon('check', 'chev') : ''}</button>`).join('')}</div>`;
    let body = '';
    if (c.kind === 'record') body = ch.records.length ? pick(ch.records, (r) => `<b>${esc(r.name)}</b><span class="pick-sub">${wt(r.weight)} × ${r.reps} · ${ctx.fmtDate(r.date)}${r.pct ? ` · up ${r.pct}%` : ''}</span>`) : '<p class="muted small">No new bests in the last few weeks yet.</p>';
    if (c.kind === 'workout') body = pick(ch.workouts, (w) => `<b>${esc(w.name)}</b><span class="pick-sub">${ctx.fmtDate(w.date)} · ${w.sets} sets${w.prs ? ` · ${w.prs} records` : ''}</span>`);
    if (c.kind === 'progress') body = ch.prog.length ? pick(ch.prog, (l) => `<b>${esc(l.name)}</b><span class="pick-sub">${l.pct > 0 ? '+' : ''}${l.pct.toFixed(1)}% over about 8 weeks</span>`) : '<p class="muted small">Log a few weeks of a lift to share its progress.</p>';
    if (c.kind === 'highlight') body = highlightPicker(c);
    if (c.kind === 'win') {
      const wins = accomplishments(ctx.db, todayStr());
      body = wins.length ? pick(wins, (w) => `<b>${esc(w.title)}</b><span class="pick-sub">${esc(w.label)}${w.w ? ` · ${wt(w.w)}${w.r > 1 ? ` × ${w.r}` : ''}` : w.big && w.big !== w.title ? ` · ${esc(w.big)}` : ''}</span>`) + (wins[c.ref] ? `<div class="hl-preview"><span class="pick-sub">Preview</span>${hlHtml({ ...wins[c.ref], name: wins[c.ref].title })}</div>` : '') : '<p class="muted small">Keep training. Maxes, streaks, clubs and running bests show up here.</p>';
    }
    const picked = c.kind === 'record' ? ch.records[c.ref] : null;
    const pickedArt = picked && c.showWeight && ctx.db.exercises?.[picked.exId] ? loadArt(ctx.db.exercises[picked.exId], picked.weight, activeGym(ctx.db)) : '';
    if (pickedArt) body += `<div class="post-metric has-art">${pickedArt}<span class="pm-label">New best · ${esc(picked.name)}</span><b class="num">${wt(picked.weight)} × ${picked.reps}</b>${picked.pct ? `<span class="pm-sub">Up ${picked.pct}%</span>` : ''}</div>`;
    const weightToggle = c.kind === 'record' || c.kind === 'progress' ? `<label class="list-row toggle"><span class="grow">Show the weight<span class="pick-sub">Off shows only the percentage</span></span><input type="checkbox" data-a="ppl-c-weight" ${c.showWeight ? 'checked' : ''}></label>` : '';
    const files = (c.files || []).map((f, i) => `<div class="cf-thumb">${f.kind === 'video' ? `<video src="${f.url}" muted playsinline></video>` : `<img src="${f.url}" alt="">`}<button class="cf-x" data-a="ppl-c-file-del" data-v="${i}" aria-label="Remove">${icon('x')}</button></div>`).join('');
    ctx.openSheet(`<h2>Share</h2>
      <div class="chips wrap">${chip('record', 'New best', ch.records.length)}${chip('highlight', 'Lift or run', activities(ctx.db).length)}${chip('win', 'Accomplishment', accomplishments(ctx.db, todayStr()).length)}${chip('workout', 'Workout', ch.workouts.length)}${chip('progress', 'Progress', ch.prog.length)}${chip('note', 'Photo or note')}</div>
      ${body}
      ${weightToggle ? `<div class="list-group">${weightToggle}</div>` : ''}
      <div class="field"><textarea id="ppl-c-text" rows="2" maxlength="1000" placeholder="Say something (optional)">${esc(c.text || '')}</textarea></div>
      <div class="cf-files">${files}${(c.files || []).length < 4 && !(c.files || []).some((f) => f.kind === 'video') ? '<label class="btn block file-btn">Add photo or video<input id="ppl-c-file" type="file" accept="image/*,video/*" hidden></label>' : ''}</div>
      <div class="field"><span>Who sees it</span><div class="chips wrap"><button class="chip ${!c.to ? 'on' : ''}" data-a="ppl-c-to" data-v="">All friends</button>${friends().map((l) => `<button class="chip ${c.to === l.user.id ? 'on' : ''}" data-a="ppl-c-to" data-v="${l.user.id}">${esc(l.user.name)}</button>`).join('')}</div></div>
      <button class="btn primary block big" data-a="ppl-c-post">Post</button>`);
  }
  function openCompose(init = {}) {
    for (const f of pv().compose?.files || []) URL.revokeObjectURL(f.url);
    pv().compose = { kind: 'record', ref: 0, showWeight: true, to: '', text: '', files: [], ...init };
    const ch = shareChoices();
    if (pv().compose.kind === 'record' && !ch.records.length) pv().compose.kind = ch.workouts.length ? 'workout' : 'note';
    composeSheet();
  }
  // Photos are resized on the phone (longest side 1600 px, JPEG) before upload; videos go as they are.
  async function prepareFile(file) {
    if (file.type.startsWith('video/')) {
      if (file.size > 20 * 1024 * 1024) throw new Error('Videos can be up to 20 MB (about 15–30 seconds). Trim it in Photos first.');
      return { kind: 'video', blob: file, type: file.type === 'video/quicktime' ? 'video/quicktime' : 'video/mp4' };
    }
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.82));
    return { kind: 'image', blob, type: 'image/jpeg' };
  }
  async function upload(f) {
    const res = await fetch(`${cloudConfig().url.replace(/\/+$/, '')}/v2/media/upload`, { method: 'POST', headers: { 'Content-Type': f.type, Authorization: `Bearer ${account()?.token || ''}` }, body: f.blob });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Upload failed.');
    return { id: out.id, kind: out.kind };
  }

  function clientsCard() {
    if (!myClients().length) return '';
    return `<h2 class="group-title">Clients</h2><div class="list-group">${myClients().map((l) => {
      const w = weekOf(cardOf(l.user.id)); const p = progressOf(cardOf(l.user.id)); const n = unread(l);
      const pending = (data.proposals || []).some((x) => x.status === 'pending' && x.client === l.user.id);
      return `<button class="list-row" data-a="ppl-client" data-id="${l.user.id}"><span class="grow"><b>${esc(l.user.name)}</b><span class="pick-sub">${w.done}${w.planned ? `/${w.planned}` : ''} workouts this week · ${fmtPct(p.pct)} strength${pending ? ' · suggestion pending' : ''}</span></span>${n ? `<span class="badge">${n}</span>` : ''}${icon('right', 'chev')}</button>`;
    }).join('')}</div>`;
  }

  function sentRequests() {
    const out = data?.requests?.out || [];
    if (!out.length) return '';
    return `<h2 class="group-title">Requests sent</h2><div class="list-group">${out.map((r) => `<div class="list-row">${avatar(r.user.id)}<span class="grow"><b>${esc(r.user.name)}</b><span class="pick-sub">Waiting · ${ago(todayStr(new Date(r.created)))}</span></span><button class="mini" data-a="ppl-req-cancel" data-id="${r.user.id}">Cancel</button></div>`).join('')}</div>`;
  }

  function openInvites() {
    const inv = data?.invites || [];
    if (!inv.length) return '';
    const kinds = { friend: 'Friend invite', coach: 'Coach invite (they coach you)', client: 'Client invite (you coach them)' };
    return `<h2 class="group-title">Open invites</h2><div class="list-group">${inv.map((i) => `<div class="list-row"><span class="grow"><b class="mono">${esc(i.code)}</b><span class="pick-sub">${kinds[i.kind]} · expires ${ctx.fmtDate(addDays(todayStr(new Date(i.created)), 7))}</span></span><button class="mini" data-a="ppl-share" data-v="${esc(i.code)}">Share</button><button class="mini" data-a="ppl-invite-cancel" data-v="${esc(i.code)}">Cancel</button></div>`).join('')}</div>`;
  }

  // ---------- Sheets ----------
  function permToggles(perms) {
    return Object.entries(PERM_LABELS).map(([k, label]) => `<label class="toggle"><input type="checkbox" data-perm="${k}" ${perms[k] ? 'checked' : ''}><span>${label}</span></label>`).join('');
  }
  const readPerms = () => Object.fromEntries(Object.keys(PERM_LABELS).map((k) => [k, !!document.querySelector(`#sheet [data-perm="${k}"]`)?.checked]));

  function inviteSheet() {
    const f = pv().find ||= { q: '' };
    const r = f.result;
    const st = r ? (friends().some((l) => l.user.id === r.user.id) ? 'friend' : r.status) : null;
    ctx.openSheet(`<h2>Add friends</h2>
      <div class="field"><span>Find by username</span><div class="row"><div class="handle-in grow"><span>@</span><input id="ppl-find-q" type="text" autocapitalize="none" autocomplete="off" spellcheck="false" enterkeyhint="search" value="${esc(f.q)}" placeholder="username"></div><button class="btn primary" data-a="ppl-find-go">Find</button></div></div>
      ${f.err ? `<p class="muted small">${esc(f.err)}</p>` : ''}
      ${r ? `<div class="find-card">${avatarOf(r.user.id, r.user.name, r.profile.photo, 'md')}<div class="grow"><b>${esc(r.user.name)}</b><span class="pick-sub">@${esc(r.profile.handle)}${r.profile.gym ? ` · ${esc(r.profile.gym)}` : ''}</span>${r.profile.bio ? `<span class="pick-sub">${esc(r.profile.bio)}</span>` : ''}</div>
        ${st === 'friend' ? '<span class="muted small">Friends</span>' : st === 'sent' ? '<span class="muted small">Requested</span>' : `<button class="btn sm primary" data-a="ppl-request" data-id="${r.user.id}">${st === 'received' ? 'Accept' : 'Add'}</button>`}</div>` : ''}
      <p class="muted small">${myHandle() ? `You're <b>@${esc(myHandle())}</b>. <button class="text-link small-link" data-a="ppl-share-profile">Share it</button>` : 'Choose a username so friends can find you. <button class="text-link small-link" data-a="ppl-edit-profile">Set up your profile</button>'}</p>
      <h3 class="sheet-h">Or send an invite</h3>
      <div class="list-group">
        <button class="list-row" data-a="ppl-new" data-v="friend"><span class="grow"><b>Invite a friend</b><span class="pick-sub">Compare weeks and progress, cheer records, challenge each other</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="ppl-new" data-v="coach"><span class="grow"><b>Ask someone to coach you</b><span class="pick-sub">You choose what they can see</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="ppl-new" data-v="client"><span class="grow"><b>Coach someone</b><span class="pick-sub">They choose what to share with you</span></span>${icon('right', 'chev')}</button>
        <button class="list-row" data-a="ppl-code"><span class="grow"><b>Enter an invite code</b></span>${icon('right', 'chev')}</button>
      </div>
      <p class="muted small">Friends see your profile, workouts per week, sets, streak, strength change in percent, records, and what you post.</p>`);
  }

  // ---------- Block and report ----------
  function personMenu(id, post) {
    const name = nameOf(id); const l = friends().find((x) => x.user.id === id);
    ctx.openSheet(`<h2>${esc(name)}</h2><div class="list-group menu">
      ${l ? `<button class="list-row" data-a="ppl-challenge" data-id="${id}"><span class="grow">Challenge ${esc(name)}</span></button>` : ''}
      ${post ? `<button class="list-row" data-a="ppl-report" data-k="post" data-id="${esc(post)}" data-u="${id}" data-n="${esc(name)}"><span class="grow">Report this post</span></button>` : ''}
      <button class="list-row" data-a="ppl-report" data-k="user" data-u="${id}" data-n="${esc(name)}"><span class="grow">Report ${esc(name)}</span></button>
      ${l ? `<button class="list-row" data-a="ppl-unlink" data-id="${l.id}"><span class="grow">Remove friend</span></button>` : ''}
      <button class="list-row danger-row" data-a="ppl-block" data-id="${id}" data-n="${esc(name)}"><span class="grow">Block ${esc(name)}</span></button>
    </div>`);
  }
  function reportSheet(err = '') {
    const r = pv().report;
    ctx.openSheet(`<h2>Report ${r.kind === 'user' ? esc(r.name) : r.kind === 'post' ? 'post' : 'comment'}</h2>
      <p class="muted small">${esc(r.name)} won't know who reported this.</p>
      <div class="chips wrap" role="radiogroup" aria-label="Reason">${Object.entries(REPORT_REASONS).map(([k, v]) => `<button class="chip ${r.reason === k ? 'on' : ''}" data-a="ppl-report-why" data-v="${k}" role="radio" aria-checked="${r.reason === k}">${v}</button>`).join('')}</div>
      ${r.reason === 'selfharm' ? '<p class="small">If someone is in danger, call local emergency services. In the US, call or text 988 any time.</p>' : ''}
      <label class="field"><span>Anything else? (optional)</span><textarea id="ppl-report-note" rows="2" maxlength="500">${esc(r.note || '')}</textarea></label>
      <label class="toggle"><input type="checkbox" id="ppl-report-block" ${r.block ? 'checked' : ''}><span>Also block ${esc(r.name)}</span></label>
      ${err ? `<p class="notice bad">${esc(err)}</p>` : ''}
      <button class="btn primary block" data-a="ppl-report-send" ${r.reason ? '' : 'disabled'}>Send report</button>`);
  }
  const readReport = () => { const r = pv().report; const n = document.getElementById('ppl-report-note'); if (n) { r.note = n.value; r.block = document.getElementById('ppl-report-block').checked; } return r; };
  function blockedSheet() {
    const list = data?.blocked || [];
    ctx.openSheet(`<h2>Blocked people</h2>${list.length ? `<div class="list-group">${list.map((b) => `<div class="list-row"><span class="grow"><b>${esc(b.name)}</b></span><button class="mini" data-a="ppl-unblock" data-id="${b.id}">Unblock</button></div>`).join('')}</div>
      <p class="muted small">Unblocking doesn't make you friends again.</p>` : '<p class="muted small">No one is blocked.</p>'}`);
  }
  async function blockPerson(id) {
    await api('/v2/social/block', { id }, { auth: true });
    if (pv().profile === id) pv().profile = null;
    if (pv().client === id) { pv().client = null; pv().edit = null; }
    if (pv().find?.result?.user.id === id) pv().find = { q: '' };
    await refresh();
  }

  // ---------- Your profile ----------
  function editProfileSheet(err = '') {
    const e = pv().pedit;
    const pic = e.file ? `<span class="avatar xl"><img src="${e.file.url}" alt=""></span>` : avatarOf(me(), e.name, e.photo, 'xl');
    ctx.openSheet(`<h2>Edit profile</h2>
      <div class="pe-photo">${pic}<div class="row"><label class="btn sm file-btn">${e.file || e.photo ? 'Change photo' : 'Add photo'}<input id="ppl-photo-file" type="file" accept="image/*" hidden></label>${e.file || e.photo ? '<button class="btn sm plain" data-a="ppl-photo-del">Remove</button>' : ''}</div></div>
      <label class="field"><span>Name</span><input id="pp-name" type="text" maxlength="40" autocomplete="name" value="${esc(e.name)}"></label>
      <div class="field"><span>Username</span><div class="handle-in"><span>@</span><input id="pp-handle" type="text" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" value="${esc(e.handle || '')}" placeholder="yourname" aria-label="Username"></div></div>
      <label class="field"><span>Bio</span><textarea id="pp-bio" rows="2" maxlength="160" placeholder="What you train for, PRs you're chasing">${esc(e.bio)}</textarea></label>
      <label class="field"><span>Gym</span><input id="pp-gym" type="text" maxlength="40" value="${esc(e.gym)}" placeholder="Optional"></label>
      <div class="field"><span>Training for</span><div class="chips wrap">${['', ...Object.keys(GOAL_LABELS)].map((k) => `<button class="chip ${e.goal === k ? 'on' : ''}" data-a="ppl-pp-goal" data-v="${k}">${k ? GOAL_LABELS[k] : 'Not shown'}</button>`).join('')}</div></div>
      <label class="toggle"><input type="checkbox" id="pp-find" ${e.findable !== false ? 'checked' : ''}><span>Let people find me by username</span></label>
      ${err ? `<p class="notice bad">${esc(err)}</p>` : ''}
      <button class="btn primary block" data-a="ppl-pp-save">Save</button>`);
  }
  function readProfileForm() {
    const e = pv().pedit; const v = (id) => document.getElementById(id);
    if (!v('pp-name')) return e;
    Object.assign(e, { name: v('pp-name').value, handle: v('pp-handle').value.trim().replace(/^@/, '').toLowerCase(), bio: v('pp-bio').value, gym: v('pp-gym').value, findable: v('pp-find').checked });
    return e;
  }
  // Profile photos: a centered square, 512 px.
  async function prepareAvatar(file) {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.min(512, side);
    cv.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
    return { kind: 'image', blob, type: 'image/jpeg', url: URL.createObjectURL(blob) };
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

  function challengeSheet(id, kind = 'workouts', days = 7) {
    const mine = cardOf(me())?.lifts || {}; const theirs = cardOf(id)?.lifts || {};
    const both = Object.keys(mine).filter((k) => theirs[k]).map((k) => ({ id: k, name: mine[k].name }));
    ctx.openSheet(`<h2>Challenge ${esc(nameOf(id))}</h2>
      <div class="field"><span>Compete on</span><div class="chips wrap" role="radiogroup" aria-label="Compete on">${Object.entries(CONTEST_KINDS).map(([k, v]) => `<button class="chip ${kind === k ? 'on' : ''}" data-a="ppl-challenge" data-id="${id}" data-k="${k}" data-d="${k === 'lift' && days === 7 ? 28 : days}" role="radio" aria-checked="${kind === k}">${v.name}</button>`).join('')}</div></div>
      <div class="field"><span>How long</span><div class="segmented small-seg">${[[7, '1 week'], [14, '2 weeks'], [28, '4 weeks']].map(([d, l]) => `<button class="${days === d ? 'on' : ''}" data-a="ppl-challenge" data-id="${id}" data-k="${kind}" data-d="${d}">${l}</button>`).join('')}</div></div>
      ${kind === 'lift' ? (both.length ? `<div class="field"><span>Lift you both do</span><select id="ppl-lift">${both.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>
        <p class="muted small">Change in your best estimated max during the challenge, against the four weeks before. Percentages, so size and experience don't matter.</p>` : '<p class="small">You don\'t have a logged lift in common yet. Try most workouts instead.</p>') : `<p class="muted small">${CONTEST_KINDS[kind].desc} It starts only if they accept, and only you two see the score.</p>`}
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
      <button class="btn plain block danger-text" data-a="ppl-unlink" data-id="${linkId}">${amClient ? 'Stop coaching' : 'Stop coaching this client'}</button>
      <button class="btn plain block" data-a="ppl-person-menu" data-id="${l.user.id}">Report or block</button>`);
  }
  function thread(msgs, sessionNames = {}) {
    if (!msgs.length) return '<p class="muted small">No notes yet.</p>';
    return `<div class="thread">${msgs.map((m) => `<div class="msg ${m.from === me() ? 'mine' : ''}">${m.session ? `<span class="pick-sub">About ${esc(sessionNames[m.session] || 'a workout')}</span>` : ''}<p>${esc(m.text)}</p><span class="pick-sub">${ctx.fmtDate(todayStr(new Date(m.created)))}</span></div>`).join('')}</div>`;
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
        ${!pending && recent ? `<p class="muted small pad">Last suggestion ${recent.status} ${recent.decided ? ctx.fmtDate(todayStr(new Date(recent.decided))) : ''}.</p>` : ''}
        <div class="list-group">${order.map((d) => `<div class="list-row"><span class="grow"><b>${FULL_DAY[d]} · ${esc(cl.plan[d].name || '')}</b><span class="pick-sub">${cl.plan[d].items.map((it) => esc(exNameFor(cl, it.exerciseId))).join(', ')}</span></span></div>`).join('') || '<div class="list-row"><span class="grow muted">No plan yet</span></div>'}</div>
        <button class="btn primary block" data-a="ppl-edit">Suggest changes</button>`;
    }
    if (perms.workouts) {
      out += `<h2 class="group-title">Recent workouts</h2><div class="list-group">${cl.sessions.slice(0, 8).map((s) => `<details class="list-row sess"><summary><span class="grow"><b>${ctx.fmtDate(s.date)} · ${esc(cl.plan[s.day]?.name || (s.freestyle ? 'Custom workout' : 'Workout'))}</b><span class="pick-sub">${s.entries.length} exercises${s.prs?.length ? ` · ${s.prs.length} records` : ''}</span></span></summary>
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
    out += `<button class="btn plain block danger-text" data-a="ppl-unlink" data-id="${l.id}">Stop coaching ${esc(l.user.name)}</button><button class="btn plain block" data-a="ppl-person-menu" data-id="${l.user.id}">Report or block</button>`;
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
    'ppl-invite': () => { pv().find = { q: '' }; inviteSheet(); },
    'ppl-person-menu': (d) => personMenu(d.id, d.post),
    'ppl-report': (d) => { pv().report = { kind: d.k, item: d.id || null, user: d.u, name: d.n, reason: '', note: '', block: false }; reportSheet(); },
    'ppl-report-why': (d) => { readReport().reason = d.v; reportSheet(); },
    'ppl-report-send': async () => {
      const r = readReport();
      if (!r.reason) return;
      try {
        await api('/v2/social/report', { kind: r.kind, item: r.item, user: r.user, reason: r.reason, note: r.note }, { auth: true });
        if (r.block) await blockPerson(r.user);
        ctx.closeSheet(); ctx.render(); ctx.toast(r.block ? 'Reported and blocked.' : 'Report sent.');
      } catch (e) { reportSheet(e.message); }
    },
    'ppl-block': async (d) => {
      if (!(await ctx.ask(`Block ${d.n}? You won't see or find each other. They won't be told.`, 'Block', true))) return;
      try { await blockPerson(d.id); ctx.closeSheet(); ctx.render(); ctx.toast('Blocked.'); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-blocked': () => blockedSheet(),
    'ppl-unblock': async (d) => { try { await api('/v2/social/unblock', { id: d.id }, { auth: true }); await refresh(); blockedSheet(); } catch (e) { ctx.toast(e.message); } },
    'ppl-find-go': async () => {
      const f = pv().find ||= { q: '' };
      f.q = (document.getElementById('ppl-find-q')?.value || '').trim().replace(/^@/, '');
      f.result = null; f.err = '';
      if (!f.q) return inviteSheet();
      try { f.result = await api('/v2/social/find', { handle: f.q }, { auth: true }); } catch (e) { f.err = e.message; }
      inviteSheet();
    },
    'ppl-request': async (d) => {
      try {
        const r = await api('/v2/social/request', { to: d.id }, { auth: true });
        if (pv().find?.result) pv().find.result.status = r.friends ? 'friend' : 'sent';
        ctx.toast(r.friends ? 'You are now friends.' : 'Request sent.');
        await refresh(); if (document.getElementById('ppl-find-q')) inviteSheet();
      } catch (e) { ctx.toast(e.message); }
    },
    'ppl-req-answer': async (d) => {
      try { await api('/v2/social/request/respond', { from: d.id, accept: d.v === '1' }, { auth: true }); if (d.v === '1') ctx.toast(`You and ${nameOf(d.id)} are now friends.`); await refresh(); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-req-cancel': async (d) => { try { await api('/v2/social/request/cancel', { to: d.id }, { auth: true }); await refresh(); } catch (e) { ctx.toast(e.message); } },
    'ppl-edit-profile': () => {
      const p = profOf(me()) || {};
      pv().pedit = { name: myName(), handle: p.handle || '', bio: p.bio || '', gym: p.gym || '', goal: p.goal || '', findable: p.findable !== false, photo: p.photo || null, file: null };
      editProfileSheet();
    },
    'ppl-pp-goal': (d) => { readProfileForm().goal = d.v; editProfileSheet(); },
    'ppl-photo-del': () => { const e = readProfileForm(); if (e.file) URL.revokeObjectURL(e.file.url); e.file = null; e.photo = null; editProfileSheet(); },
    'ppl-pp-save': async (d, el) => {
      const e = readProfileForm();
      if (!e.name.trim()) return editProfileSheet('Add a name.');
      if (e.handle && !/^[a-z0-9_.]{3,20}$/.test(e.handle)) return editProfileSheet('Usernames are 3–20 letters, numbers, _ or .');
      if (el) { el.disabled = true; el.textContent = 'Saving…'; }
      try {
        let photo = e.photo;
        if (e.file) photo = (await upload(e.file)).id;
        const r = await api('/v2/social/profile', { name: e.name.trim(), handle: e.handle || null, bio: e.bio, gym: e.gym, goal: e.goal, findable: e.findable, photo }, { auth: true });
        if (e.file) { URL.revokeObjectURL(e.file.url); e.file = null; }
        data.me = { ...data.me, name: r.name }; (data.profiles ||= {})[me()] = r.profile; ls.set(CACHE, data);
        setAccountName(r.name);
        ctx.closeSheet(); ctx.render(); ctx.toast('Profile saved.');
        publish();
      } catch (err) { editProfileSheet(err.message); }
    },
    'ppl-share-profile': async () => {
      const h = myHandle(); if (!h) return;
      const text = `Add me on ProFitz (working title): @${h}\n${APP_URL}`;
      try { if (navigator.share) await navigator.share({ title: 'ProFitz (working title)', text }); else { await navigator.clipboard.writeText(text); ctx.toast('Copied.'); } } catch {}
    },
    'ppl-my-profile': () => { ctx.ui.prevTab = ctx.ui.tab; ctx.ui.tab = 'people'; pv().profile = me(); window.scrollTo(0, 0); ctx.render(); },
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
      try { if (navigator.share) await navigator.share({ title: 'ProFitz (working title) invite', text: shareText(d.v) }); else { await navigator.clipboard.writeText(shareText(d.v)); ctx.toast('Invite copied.'); } } catch {}
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
    'ppl-copy-code': async (d) => { try { await navigator.clipboard.writeText(d.v); ctx.toast('Copied. Now open ProFitz (working title) from your Home Screen.'); } catch { ctx.toast('Touch and hold the code to copy it.'); } },
    'ppl-invite-here': () => { ctx.closeSheet(); setTimeout(async () => { await refresh(); maybeInvite(); }, 300); },
    'ppl-code-go': () => { const c = document.getElementById('ppl-code')?.value || ''; if (c.replace(/[^A-Za-z0-9]/g, '').length !== 8) return ctx.toast('Invite codes are 8 letters and numbers.'); peekInvite(c); },
    'ppl-accept': async (d) => {
      const perms = document.querySelector('#sheet [data-perm]') ? readPerms() : undefined;
      try { const r = await api('/v2/social/accept', { code: d.v, perms }, { auth: true }); ctx.closeSheet(); await publish(); await refresh(); ctx.toast(r.link.kind === 'friend' ? `You and ${r.link.user.name} are now friends.` : `Connected with ${r.link.user.name}.`); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-board-open': () => { pv().boardOpen = !pv().boardOpen; ctx.render(); },
    'ppl-board': (d) => { pv().board = d.v; ctx.render(); },
    'ppl-friend': (d) => { pv().profile = d.id; window.scrollTo(0, 0); ctx.render(); },
    'ppl-profile-back': () => { pv().profile = null; window.scrollTo(0, 0); ctx.render(); },
    'ppl-points': () => pointsSheet(),
    'ppl-challenge-pick': () => {
      const list = friends();
      if (list.length === 1) return challengeSheet(list[0].user.id);
      ctx.openSheet(`<h2>Challenge a friend</h2><p class="muted small">Workouts, minutes, miles, weight lifted or strength gained, head to head. They accept before it starts.</p><div class="list-group">${list.map((l) => `<button class="list-row" data-a="ppl-challenge" data-id="${l.user.id}">${avatar(l.user.id, 'md')}<span class="grow"><b>${esc(l.user.name)}</b></span>${icon('right', 'chev')}</button>`).join('')}</div>`);
    },
    'ppl-challenge': (d) => challengeSheet(d.id, d.k || 'workouts', +(d.d || 7)),
    'ppl-challenge-send': async (d) => {
      const ex = d.k === 'lift' ? document.getElementById('ppl-lift')?.value : null;
      const exName = ex ? cardOf(me())?.lifts?.[ex]?.name : null;
      try { await api('/v2/social/contest', { to: d.id, kind: d.k, days: +d.d, ex, exName }, { auth: true }); ctx.closeSheet(); await refresh(); ctx.toast(`Challenge sent to ${nameOf(d.id)}.`); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-contest-answer': async (d) => { try { await api('/v2/social/contest/respond', { id: d.id, accept: d.v === '1', today: todayStr() }, { auth: true }); await refresh(); ctx.toast(d.v === '1' ? 'Challenge on. It starts today.' : 'Declined.'); } catch (e) { ctx.toast(e.message); } },
    'ppl-contest-cancel': async (d) => { try { await api('/v2/social/contest/respond', { id: d.id, cancel: true }, { auth: true }); await refresh(); } catch (e) { ctx.toast(e.message); } },
    'ppl-cheer': (d, el) => setCheer(d.o, d.i, el.getAttribute('aria-pressed') !== 'true'),
    'ppl-who': (d) => {
      const who = data.cheers?.[`${d.o}:${d.i}`] || [];
      ctx.openSheet(`<h2>Big ups</h2><div class="list-group">${who.map((u) => `<button class="list-row" data-a="ppl-friend-close" data-id="${u.id}">${avatar(u.id, 'md')}<span class="grow"><b>${esc(u.id === me() ? 'You' : u.name)}</b></span></button>`).join('')}</div>`);
    },
    'ppl-friend-close': (d) => { ctx.closeSheet(); actions['ppl-friend']?.(d); },
    'ppl-digest': () => {
      const fresh = digestNew();
      ls.set(DIGEST, digestList().map((x) => x.seen));
      ctx.openSheet(`<h2>On your activity</h2><div class="list-group">${fresh.map((x) => `<button class="list-row" data-a="ppl-comments" data-o="${me()}" data-i="${esc(x.item)}">${avatar(x.user.id, 'md')}<span class="grow"><b>${esc(x.user.name.split(' ')[0])}</b> ${esc(x.text)}<span class="pick-sub">${esc(x.title)}</span></span></button>`).join('')}</div>`);
      ctx.render();
    },
    'ppl-quick': (d) => sendComment(d.o, d.i, d.v),
    'ppl-thread': (d) => threadSheet(d.id),
    'ppl-more': () => { pv().feedN = (pv().feedN || 8) + 10; ctx.render(); },
    'ppl-comments': (d) => commentsSheet(d.o, d.i),
    'ppl-comment-send': async (d) => {
      const text = document.getElementById('ppl-comment')?.value.trim();
      if (text) await sendComment(d.o, d.i, text);
    },
    'ppl-comment-del': async (d) => { try { await api('/v2/social/comment/delete', { id: d.id }, { auth: true }); await refresh(); commentsSheet(d.o, d.i); } catch (e) { ctx.toast(e.message); } },
    'ppl-post-del': async (d) => {
      if (!(await ctx.ask('Delete this post? Its photos, likes and comments go too.', 'Delete', true))) return;
      try { await api('/v2/social/post/delete', { id: d.id }, { auth: true }); await refresh(); ctx.toast('Deleted.'); } catch (e) { ctx.toast(e.message); }
    },
    'ppl-compose': () => openCompose(),
    'ppl-share-pr': (d) => {
      const i = recentRecords(ctx.db).findIndex((r) => r.sessionId === d.sid);
      openCompose({ kind: 'record', ref: Math.max(0, i) });
    },
    'ppl-post-session': (d) => openCompose({ kind: 'highlight', hlSrc: `s:${d.id}` }),
    'ppl-hl-src': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; Object.assign(c, { hlSrc: d.v, hlItem: 0, hlMode: null, hlSet: 0, hlShow: {} }); composeSheet(); },
    'ppl-hl-more': () => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; c.hlAll = !c.hlAll; composeSheet(); },
    'ppl-hl-item': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; Object.assign(c, { hlItem: +d.v, hlMode: null, hlSet: 0, hlShow: {} }); composeSheet(); },
    'ppl-hl-mode': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; c.hlMode = d.v; composeSheet(); },
    'ppl-hl-set': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; c.hlSet = +d.v; composeSheet(); },
    'ppl-hl-show': (d) => {
      const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text;
      const show = { ...(c.hlShow || {}) }; show[d.v] = show[d.v] === false;
      const item = hlItems(c)[c.hlItem || 0];
      if (!runFields(item).some(([k]) => show[k] !== false)) return ctx.toast('Keep at least one.');
      c.hlShow = show; composeSheet();
    },
    'ppl-c-kind': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; c.kind = d.v; c.ref = 0; composeSheet(); },
    'ppl-c-ref': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; c.ref = +d.v; composeSheet(); },
    'ppl-c-weight': (d, el) => { pv().compose.showWeight = el.checked; },
    'ppl-c-to': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; c.to = d.v; composeSheet(); },
    'ppl-c-file-del': (d) => { const c = pv().compose; c.text = document.getElementById('ppl-c-text')?.value || c.text; const [f] = c.files.splice(+d.v, 1); if (f) URL.revokeObjectURL(f.url); composeSheet(); },
    'ppl-c-post': async (d, el) => {
      const c = pv().compose;
      c.text = document.getElementById('ppl-c-text')?.value || '';
      const ch = shareChoices();
      let payload = {};
      if (c.kind === 'record') { const r = ch.records[c.ref]; if (!r) return ctx.toast('Pick a record.'); payload = { exId: r.exId, name: r.name, date: r.date, pct: r.pct, ...(c.showWeight ? { weight: r.weight, reps: r.reps, e1rm: r.e1rm } : {}) }; }
      if (c.kind === 'workout') { const w = ch.workouts[c.ref]; if (!w) return ctx.toast('Pick a workout.'); payload = { name: w.name, date: w.date, sets: w.sets, minutes: w.minutes, prs: w.prs }; }
      if (c.kind === 'progress') { const p = ch.prog[c.ref]; if (!p) return ctx.toast('Pick a lift.'); payload = { exId: p.id, name: p.name, pct: Math.round(p.pct * 10) / 10, weeks: 8, ...(c.showWeight ? { now: Math.round(p.now) } : {}) }; }
      if (c.kind === 'win') { const w = accomplishments(ctx.db, todayStr())[c.ref]; if (!w) return ctx.toast('Pick something to post.'); const { key, ...hl } = w; payload = highlightPayload({ ...hl, name: w.title }); }
      if (c.kind === 'highlight') { const hl = hlBuilt(c); if (!hl) return ctx.toast('Pick something to post.'); payload = highlightPayload(hl); }
      if (c.kind === 'note' && !c.text.trim() && !c.files.length) return ctx.toast('Add a photo or a few words.');
      el.disabled = true; el.textContent = c.files.length ? 'Uploading…' : 'Posting…';
      try {
        const media = [];
        for (const f of c.files) media.push(await upload(f));
        await api('/v2/social/post', { kind: c.kind === 'highlight' || c.kind === 'win' ? 'workout' : c.kind, data: payload, text: c.text, media, to: c.to || undefined }, { auth: true });
        for (const f of c.files) URL.revokeObjectURL(f.url);
        pv().compose = null; ctx.closeSheet(); await refresh(); ctx.toast(c.to ? `Shared with ${nameOf(c.to)}.` : 'Shared with your friends.');
      } catch (e) { el.disabled = false; el.textContent = 'Post'; ctx.toast(e.message); }
    },
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
      try { await api('/v2/social/link/remove', { id: d.id }, { auth: true }); ctx.closeSheet(); pv().client = null; pv().profile = null; await refresh(); ctx.toast('Removed.'); } catch (e) { ctx.toast(e.message); }
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
  // A photo or video picked in the composer.
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'ppl-photo-file' && e.target.files?.[0] && pv().pedit) {
      const ed = readProfileForm();
      try { const f = await prepareAvatar(e.target.files[0]); if (ed.file) URL.revokeObjectURL(ed.file.url); ed.file = f; editProfileSheet(); } catch { editProfileSheet('That photo could not be used.'); }
      return;
    }
    if (e.target.id !== 'ppl-c-file' || !e.target.files?.[0]) return;
    const c = pv().compose; if (!c) return;
    c.text = document.getElementById('ppl-c-text')?.value || c.text;
    try { const f = await prepareFile(e.target.files[0]); f.url = URL.createObjectURL(f.blob); c.files.push(f); composeSheet(); } catch (err) { ctx.toast(err.message || 'That file could not be used.'); }
  });

  function onInput(e) {
    const el = e.target;
    if (el.id === 'ppl-find-q') return true;
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
    return (data.requests?.in || []).length + (data.contests || []).filter((c) => c.status === 'pending' && c.b === me()).length
      + (data.proposals || []).filter((p) => p.status === 'pending' && p.client === me()).length
      + coaches().concat(myClients()).reduce((a, l) => a + unread(l), 0);
  }

  return { screen, actions, onInput, refresh, publish, schedule, start, reset, pendingCount, maybeInvite };
}
