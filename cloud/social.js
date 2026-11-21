// Friends and coaching for Lift Tracker (step 3 onward of the trainer/friends plan).
//
// People connect with a single-use invite code (7 days). A link is either a friendship or a coach and
// a client. Friends see each other's "card": a small summary each phone publishes (this week's
// workouts and sets, strength progress as percentages, recent records and workouts) and nothing else.
// A coach can also read the parts of the client's synced data the client chose to share (plan,
// workouts, body, food), suggest plan changes the client accepts or declines, and exchange notes.
// Either side can end a link at any time; the client can change what's shared at any time.

import { pushTo } from './push.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const now = () => Date.now();
const rid = (n = 12) => { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const c = [...b].map((x) => ALPHABET[x % ALPHABET.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
const normCode = (c) => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : null; };
const PERM_KEYS = ['plan', 'workouts', 'body', 'food'];
const cleanPerms = (p) => Object.fromEntries(PERM_KEYS.map((k) => [k, !!p?.[k]]));
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const INVITE_DAYS = 7;

// Which synced documents each permission opens to the coach.
const PREFIXES = {
  plan: ['plan/', 'exercises/', 'state/', 'root/profile', 'root/settings', 'root/blocks', 'root/week'],
  workouts: ['sessions/', 'cardio/', 'pain/'],
  body: ['bodyweight/', 'measurements/'],
  food: ['foodLog/', 'root/nutrition'],
};

async function linksOf(env, userId) {
  const r = await env.DB.prepare('SELECT l.*, ua.name AS a_name, ub.name AS b_name FROM links l JOIN users ua ON ua.id = l.a JOIN users ub ON ub.id = l.b WHERE l.a = ? OR l.b = ?').bind(userId, userId).all();
  return (r.results || []).map((l) => {
    const other = l.a === userId ? { id: l.b, name: l.b_name } : { id: l.a, name: l.a_name };
    // role: what the other person is to me
    const role = l.kind === 'friend' ? 'friend' : l.a === userId ? 'client' : 'coach';
    return { id: l.id, kind: l.kind, role, user: other, perms: l.perms ? JSON.parse(l.perms) : null, created: l.created };
  });
}
async function linkBetween(env, a, b, kind) {
  return env.DB.prepare('SELECT * FROM links WHERE kind = ? AND ((a = ? AND b = ?) OR (a = ? AND b = ?))').bind(kind, a, b, b, a).first();
}
const inList = (n) => Array.from({ length: n }, () => '?').join(',');

export async function handleSocial(path, body, user, env, json) {
  const me = user.id;

  // Everything the People tab shows, in one request.
  if (path === '/v2/social') {
    const links = await linksOf(env, me);
    const ids = [me, ...new Set(links.map((l) => l.user.id))];
    const cards = {};
    const cr = await env.DB.prepare(`SELECT user_id, data, updated FROM cards WHERE user_id IN (${inList(ids.length)})`).bind(...ids).all();
    for (const c of cr.results || []) cards[c.user_id] = { ...JSON.parse(c.data), updated: c.updated };
    const ch = await env.DB.prepare(`SELECT c.owner, c.item, c.from_user, u.name FROM cheers c JOIN users u ON u.id = c.from_user WHERE c.owner IN (${inList(ids.length)}) AND c.created > ?`).bind(...ids, now() - 60 * 86400000).all();
    const cheers = {};
    for (const c of ch.results || []) (cheers[`${c.owner}:${c.item}`] ||= []).push({ id: c.from_user, name: c.name });
    const ct = await env.DB.prepare("SELECT * FROM contests WHERE (a = ? OR b = ?) AND (status IN ('pending', 'active') OR created > ?) ORDER BY created DESC LIMIT 40").bind(me, me, now() - 60 * 86400000).all();
    const pr = await env.DB.prepare("SELECT * FROM proposals WHERE (coach = ? OR client = ?) AND (status = 'pending' OR decided > ?) ORDER BY created DESC LIMIT 40").bind(me, me, now() - 14 * 86400000).all();
    const linkIds = links.filter((l) => l.kind === 'coach').map((l) => l.id);
    let messages = [];
    if (linkIds.length) {
      const m = await env.DB.prepare(`SELECT * FROM messages WHERE link_id IN (${inList(linkIds.length)}) ORDER BY created DESC LIMIT 200`).bind(...linkIds).all();
      messages = (m.results || []).map((x) => ({ id: x.id, link: x.link_id, from: x.from_user, session: x.session_id, text: x.text, created: x.created }));
    }
    const inv = await env.DB.prepare('SELECT code, kind, created FROM invites WHERE user_id = ? AND created > ? ORDER BY created DESC').bind(me, now() - INVITE_DAYS * 86400000).all();
    return json({
      me: { id: me, name: user.name },
      links, cards, cheers,
      contests: (ct.results || []).map((c) => ({ id: c.id, a: c.a, b: c.b, kind: c.kind, ex: c.ex, exName: c.ex_name, days: c.days, start: c.start, status: c.status, created: c.created })),
      proposals: (pr.results || []).map((p) => ({ id: p.id, coach: p.coach, client: p.client, data: JSON.parse(p.data), note: p.note, status: p.status, created: p.created, decided: p.decided })),
      messages,
      invites: (inv.results || []).map((i) => ({ code: i.code, kind: i.kind, created: i.created })),
    });
  }

  // My card (computed on the phone).
  if (path === '/v2/social/card') {
    const data = JSON.stringify(body.card || {});
    if (data.length > 60000) return json({ error: 'Summary too large.' }, 400);
    await env.DB.prepare('INSERT INTO cards (user_id, data, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(me, data, now()).run();
    return json({ ok: true });
  }

  // Invites.
  if (path === '/v2/social/invite') {
    const kind = ['friend', 'coach', 'client'].includes(body.kind) ? body.kind : null;
    if (!kind) return json({ error: 'Unknown invite type.' }, 400);
    await env.DB.prepare('DELETE FROM invites WHERE created < ?').bind(now() - INVITE_DAYS * 86400000).run();
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM invites WHERE user_id = ?').bind(me).first();
    if ((n?.n || 0) >= 20) return json({ error: 'Too many open invites. Cancel some first.' }, 400);
    const code = newCode();
    await env.DB.prepare('INSERT INTO invites (code, user_id, kind, perms, created) VALUES (?, ?, ?, ?, ?)')
      .bind(code, me, kind, kind === 'coach' ? JSON.stringify(cleanPerms(body.perms)) : null, now()).run();
    return json({ code, kind });
  }
  if (path === '/v2/social/invite/cancel') {
    await env.DB.prepare('DELETE FROM invites WHERE code = ? AND user_id = ?').bind(normCode(body.code), me).run();
    return json({ ok: true });
  }
  // What an invite is, before accepting it.
  if (path === '/v2/social/invite/peek' || path === '/v2/social/accept') {
    const code = normCode(body.code);
    const inv = code && await env.DB.prepare('SELECT i.*, u.name FROM invites i JOIN users u ON u.id = i.user_id WHERE i.code = ? AND i.created > ?').bind(code, now() - INVITE_DAYS * 86400000).first();
    if (!inv) return json({ error: 'That invite code isn\'t valid or has expired.' }, 404);
    if (inv.user_id === me) return json({ error: 'That\'s your own invite. Send it to someone else.' }, 400);
    if (path === '/v2/social/invite/peek') return json({ kind: inv.kind, from: { id: inv.user_id, name: inv.name }, perms: inv.perms ? JSON.parse(inv.perms) : null });
    // friend: either way round. coach: the inviter wants me as their coach. client: the inviter will coach me.
    const kind = inv.kind === 'friend' ? 'friend' : 'coach';
    const coach = inv.kind === 'coach' ? me : inv.user_id;
    const client = inv.kind === 'coach' ? inv.user_id : me;
    const a = kind === 'friend' ? inv.user_id : coach;
    const b = kind === 'friend' ? me : client;
    if (await linkBetween(env, a, b, kind)) {
      await env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(code).run();
      return json({ error: kind === 'friend' ? `You and ${inv.name} are already friends.` : `You're already connected with ${inv.name} for coaching.` }, 400);
    }
    const perms = inv.kind === 'coach' ? JSON.parse(inv.perms || '{}') : inv.kind === 'client' ? cleanPerms(body.perms) : null;
    const id = rid();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO links (id, a, b, kind, perms, created) VALUES (?, ?, ?, ?, ?, ?)').bind(id, a, b, kind, perms ? JSON.stringify(perms) : null, now()),
      env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(code),
    ]);
    await pushTo(env, inv.user_id, { title: kind === 'friend' ? `${user.name} accepted your invite` : `${user.name} is connected for coaching`, body: kind === 'friend' ? 'You can now compare weeks and cheer each other on.' : 'Open People to get started.', tag: `link-${id}`, url: './?open=people' });
    return json({ ok: true, link: { id, kind, role: kind === 'friend' ? 'friend' : inv.kind === 'coach' ? 'client' : 'coach', user: { id: inv.user_id, name: inv.name } } });
  }

  // Change what a client shares (client only), or end a link (either side).
  if (path === '/v2/social/link/perms') {
    const l = await env.DB.prepare("SELECT * FROM links WHERE id = ? AND kind = 'coach' AND b = ?").bind(String(body.id || ''), me).first();
    if (!l) return json({ error: 'Not found.' }, 404);
    await env.DB.prepare('UPDATE links SET perms = ? WHERE id = ?').bind(JSON.stringify(cleanPerms(body.perms)), l.id).run();
    return json({ ok: true });
  }
  if (path === '/v2/social/link/remove') {
    const l = await env.DB.prepare('SELECT * FROM links WHERE id = ? AND (a = ? OR b = ?)').bind(String(body.id || ''), me, me).first();
    if (!l) return json({ error: 'Not found.' }, 404);
    const stmts = [env.DB.prepare('DELETE FROM links WHERE id = ?').bind(l.id), env.DB.prepare('DELETE FROM messages WHERE link_id = ?').bind(l.id)];
    if (l.kind === 'coach') stmts.push(env.DB.prepare("UPDATE proposals SET status = 'withdrawn', decided = ? WHERE coach = ? AND client = ? AND status = 'pending'").bind(now(), l.a, l.b));
    else stmts.push(env.DB.prepare("UPDATE contests SET status = 'cancelled' WHERE ((a = ? AND b = ?) OR (a = ? AND b = ?)) AND status IN ('pending', 'active')").bind(l.a, l.b, l.b, l.a));
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  // Cheer a friend's record or workout (or take it back).
  if (path === '/v2/social/cheer') {
    const owner = String(body.owner || '');
    const item = String(body.item || '').slice(0, 120);
    if (owner !== me && !(await linkBetween(env, me, owner, 'friend')) && !(await linkBetween(env, me, owner, 'coach'))) return json({ error: 'Not connected.' }, 403);
    if (body.on === false) await env.DB.prepare('DELETE FROM cheers WHERE owner = ? AND item = ? AND from_user = ?').bind(owner, item, me).run();
    else await env.DB.prepare('INSERT OR IGNORE INTO cheers (owner, item, from_user, created) VALUES (?, ?, ?, ?)').bind(owner, item, me, now()).run();
    return json({ ok: true });
  }

  // Head-to-head challenges.
  if (path === '/v2/social/contest') {
    const to = String(body.to || '');
    if (!(await linkBetween(env, me, to, 'friend'))) return json({ error: 'You can challenge friends only.' }, 403);
    const kind = body.kind === 'lift' ? 'lift' : 'workouts';
    const days = [7, 14, 28].includes(+body.days) ? +body.days : 7;
    if (kind === 'lift' && !body.ex) return json({ error: 'Pick a lift.' }, 400);
    const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM contests WHERE (a = ? OR b = ?) AND status IN ('pending', 'active')").bind(me, me).first();
    if ((open?.n || 0) >= 10) return json({ error: 'You have 10 challenges going. Finish some first.' }, 400);
    const id = rid();
    await env.DB.prepare("INSERT INTO contests (id, a, b, kind, ex, ex_name, days, start, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)")
      .bind(id, me, to, kind, kind === 'lift' ? String(body.ex).slice(0, 80) : null, kind === 'lift' ? String(body.exName || '').slice(0, 80) : null, days, now()).run();
    await pushTo(env, to, { title: `${user.name} challenged you`, body: kind === 'workouts' ? `Most workouts over ${days} days.` : `Biggest gain on ${body.exName || 'a lift'} over ${days} days.`, tag: `contest-${id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/social/contest/respond') {
    const c = await env.DB.prepare("SELECT * FROM contests WHERE id = ? AND status = 'pending'").bind(String(body.id || '')).first();
    if (!c) return json({ error: 'That challenge is no longer open.' }, 404);
    if (body.cancel) {
      if (c.a !== me) return json({ error: 'Not yours.' }, 403);
      await env.DB.prepare("UPDATE contests SET status = 'cancelled' WHERE id = ?").bind(c.id).run();
      return json({ ok: true });
    }
    if (c.b !== me) return json({ error: 'Not yours.' }, 403);
    if (body.accept && !isDate(body.today)) return json({ error: 'Missing date.' }, 400);
    await env.DB.prepare('UPDATE contests SET status = ?, start = ? WHERE id = ?').bind(body.accept ? 'active' : 'declined', body.accept ? body.today : null, c.id).run();
    if (body.accept) await pushTo(env, c.a, { title: `${user.name} accepted your challenge`, body: 'It starts today. Good luck.', tag: `contest-${c.id}`, url: './?open=people' });
    return json({ ok: true });
  }

  // ---------- Coaching ----------
  const coachLink = async (clientId) => env.DB.prepare("SELECT * FROM links WHERE kind = 'coach' AND a = ? AND b = ?").bind(me, String(clientId || '')).first();

  // A client's shared data, for their coach.
  if (path === '/v2/coach/client') {
    const l = await coachLink(body.client);
    if (!l) return json({ error: 'Not your client.' }, 403);
    const perms = JSON.parse(l.perms || '{}');
    const prefixes = PERM_KEYS.filter((k) => perms[k]).flatMap((k) => PREFIXES[k]);
    const docs = [];
    if (prefixes.length) {
      // Recent workouts and food are plenty for coaching; plan and body data come in full.
      const recent = ['sessions/', 'cardio/', 'foodLog/'];
      const full = prefixes.filter((p) => !recent.includes(p));
      const part = prefixes.filter((p) => recent.includes(p));
      if (full.length) {
        const q = full.map((p) => (p.endsWith('/') ? 'id LIKE ?' : 'id = ?')).join(' OR ');
        const r = await env.DB.prepare(`SELECT id, data FROM docs WHERE user_id = ? AND deleted = 0 AND (${q})`).bind(l.b, ...full.map((p) => (p.endsWith('/') ? `${p}%` : p))).all();
        docs.push(...(r.results || []));
      }
      for (const p of part) {
        const r = await env.DB.prepare('SELECT id, data FROM docs WHERE user_id = ? AND deleted = 0 AND id LIKE ? ORDER BY ts DESC, ver DESC LIMIT ?').bind(l.b, `${p}%`, p === 'foodLog/' ? 400 : 150).all();
        docs.push(...(r.results || []));
      }
    }
    return json({ perms, docs: docs.map((d) => ({ id: d.id, data: JSON.parse(d.data) })) });
  }
  if (path === '/v2/coach/propose') {
    const l = await coachLink(body.client);
    if (!l) return json({ error: 'Not your client.' }, 403);
    if (!JSON.parse(l.perms || '{}').plan) return json({ error: 'Your client hasn\'t shared their plan.' }, 403);
    const data = JSON.stringify({ days: body.days || {}, exercises: body.exercises || {} });
    if (data.length > 200000) return json({ error: 'Too large.' }, 400);
    if (!Object.keys(body.days || {}).length) return json({ error: 'No changes.' }, 400);
    // One open proposal per client: a new one replaces the last.
    await env.DB.prepare("UPDATE proposals SET status = 'withdrawn', decided = ? WHERE coach = ? AND client = ? AND status = 'pending'").bind(now(), me, l.b).run();
    const id = rid();
    await env.DB.prepare("INSERT INTO proposals (id, coach, client, data, note, status, created) VALUES (?, ?, ?, ?, ?, 'pending', ?)").bind(id, me, l.b, data, String(body.note || '').slice(0, 1000), now()).run();
    await pushTo(env, l.b, { title: `${user.name} suggested plan changes`, body: String(body.note || 'Open People to review them.').slice(0, 140), tag: `proposal-${id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/coach/withdraw') {
    await env.DB.prepare("UPDATE proposals SET status = 'withdrawn', decided = ? WHERE id = ? AND coach = ? AND status = 'pending'").bind(now(), String(body.id || ''), me).run();
    return json({ ok: true });
  }
  if (path === '/v2/coach/decide') {
    const p = await env.DB.prepare("SELECT * FROM proposals WHERE id = ? AND client = ? AND status = 'pending'").bind(String(body.id || ''), me).first();
    if (!p) return json({ error: 'That suggestion is no longer open.' }, 404);
    await env.DB.prepare('UPDATE proposals SET status = ?, decided = ? WHERE id = ?').bind(body.accept ? 'accepted' : 'declined', now(), p.id).run();
    return json({ ok: true });
  }
  if (path === '/v2/coach/message') {
    const l = await env.DB.prepare("SELECT * FROM links WHERE id = ? AND kind = 'coach' AND (a = ? OR b = ?)").bind(String(body.link || ''), me, me).first();
    if (!l) return json({ error: 'Not found.' }, 404);
    const text = String(body.text || '').trim().slice(0, 2000);
    if (!text) return json({ error: 'Write something first.' }, 400);
    const id = rid();
    await env.DB.prepare('INSERT INTO messages (id, link_id, from_user, session_id, text, created) VALUES (?, ?, ?, ?, ?, ?)').bind(id, l.id, me, body.session ? String(body.session).slice(0, 80) : null, text, now()).run();
    await pushTo(env, l.a === me ? l.b : l.a, { title: user.name, body: text.slice(0, 140), tag: `note-${l.id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  return json({ error: 'Not found.' }, 404);
}
