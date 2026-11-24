// Friends and coaching for Lift Tracker (step 3 onward of the trainer/friends plan).
//
// People connect with a single-use invite code (7 days). A link is either a friendship or a coach and
// a client. Friends see each other's "card": a small summary each phone publishes (this week's
// workouts and sets, strength progress as percentages, recent records and workouts) and nothing else.
// A coach can also read the parts of the client's synced data the client chose to share (plan,
// workouts, body, food), suggest plan changes the client accepts or declines, and exchange notes.
// Either side can end a link at any time; the client can change what's shared at any time.

import { pushTo } from './push.js';
import { deleteMedia } from './media.js';

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

// Profiles: username, photo, bio, gym and training goal.
const GOALS = ['strength', 'size', 'fitness', 'sport'];
const HANDLE = /^[a-z0-9_.]{3,20}$/;
const normHandle = (h) => String(h || '').trim().toLowerCase().replace(/^@/, '');
const pubProfile = (p) => (p ? { handle: p.handle || null, bio: p.bio || '', photo: p.photo || null, gym: p.gym || '', goal: p.goal || '', findable: !!p.findable } : null);
async function profilesOf(env, ids, me) {
  if (!ids.length) return {};
  const r = await env.DB.prepare(`SELECT * FROM profiles WHERE user_id IN (${inList(ids.length)})`).bind(...ids).all();
  return Object.fromEntries((r.results || []).map((p) => { const { findable, ...rest } = pubProfile(p); return [p.user_id, p.user_id === me ? { ...rest, findable } : rest]; }));
}
// Blocking works both ways: neither person can find, contact or see the other.
const CONTEST_KINDS = ['workouts', 'minutes', 'miles', 'volume', 'lift', 'sets', 'days', 'cardio'];
export const CONTEST_TEXT = { workouts: 'Most workouts', minutes: 'Most minutes', miles: 'Most miles run', volume: 'Most weight lifted', sets: 'Most hard sets', days: 'Most active days', cardio: 'Most cardio minutes' };
const REPORT_REASONS = ['harassment', 'hate', 'sexual', 'violence', 'selfharm', 'spam', 'other'];
async function blockedIds(env, me) {
  const r = await env.DB.prepare('SELECT blocked AS id FROM blocks WHERE user_id = ? UNION SELECT user_id AS id FROM blocks WHERE blocked = ?').bind(me, me).all();
  return new Set((r.results || []).map((x) => x.id));
}
const isBlocked = async (env, a, b) => !!(await env.DB.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked = ?) OR (user_id = ? AND blocked = ?)').bind(a, b, b, a).first());

async function makeFriends(env, a, b) {
  const id = rid();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO links (id, a, b, kind, perms, created) VALUES (?, ?, ?, 'friend', NULL, ?)").bind(id, a, b, now()),
    env.DB.prepare('DELETE FROM requests WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)').bind(a, b, b, a),
  ]);
  return id;
}

export async function handleSocial(path, body, user, env, json) {
  const me = user.id;
  if (await env.DB.prepare('SELECT 1 FROM suspended WHERE user_id = ?').bind(me).first()) return json({ error: 'This account can no longer use People. Your training data is not affected.', suspended: true }, 403);

  // Everything the People tab shows, in one request.
  if (path === '/v2/social') {
    const hidden = await blockedIds(env, me);
    const links = await linksOf(env, me);
    const ids = [me, ...new Set(links.map((l) => l.user.id))];
    const cards = {};
    const cr = await env.DB.prepare(`SELECT user_id, data, updated FROM cards WHERE user_id IN (${inList(ids.length)})`).bind(...ids).all();
    for (const c of cr.results || []) cards[c.user_id] = { ...JSON.parse(c.data), updated: c.updated };
    const ch = await env.DB.prepare(`SELECT c.owner, c.item, c.from_user, u.name FROM cheers c JOIN users u ON u.id = c.from_user WHERE c.owner IN (${inList(ids.length)}) AND c.created > ?`).bind(...ids, now() - 60 * 86400000).all();
    const cheers = {};
    for (const c of ch.results || []) if (!hidden.has(c.from_user)) (cheers[`${c.owner}:${c.item}`] ||= []).push({ id: c.from_user, name: c.name });
    const ct = await env.DB.prepare("SELECT * FROM contests WHERE (a = ? OR b = ? OR id IN (SELECT contest_id FROM contest_members WHERE user_id = ? AND status != 'out')) AND (status IN ('pending', 'active') OR created > ?) ORDER BY created DESC LIMIT 40").bind(me, me, me, now() - 60 * 86400000).all();
    const ctIds = (ct.results || []).map((c) => c.id);
    const scoreRows = ctIds.length ? (await env.DB.prepare(`SELECT contest_id, user_id, value FROM contest_scores WHERE contest_id IN (${inList(ctIds.length)})`).bind(...ctIds).all()).results || [] : [];
    const scoresOf = (id) => Object.fromEntries(scoreRows.filter((x) => x.contest_id === id).map((x) => [x.user_id, x.value]));
    const memberRows = ctIds.length ? (await env.DB.prepare(`SELECT m.contest_id, m.user_id, m.status, u.name FROM contest_members m JOIN users u ON u.id = m.user_id WHERE m.contest_id IN (${inList(ctIds.length)})`).bind(...ctIds).all()).results || [] : [];
    const membersOf = (id) => memberRows.filter((m) => m.contest_id === id).map((m) => ({ id: m.user_id, name: m.name, status: m.status }));
    const pr = await env.DB.prepare("SELECT * FROM proposals WHERE (coach = ? OR client = ?) AND (status = 'pending' OR decided > ?) ORDER BY created DESC LIMIT 40").bind(me, me, now() - 14 * 86400000).all();
    const linkIds = links.filter((l) => l.kind === 'coach').map((l) => l.id);
    let messages = [];
    if (linkIds.length) {
      const m = await env.DB.prepare(`SELECT * FROM messages WHERE link_id IN (${inList(linkIds.length)}) ORDER BY created DESC LIMIT 200`).bind(...linkIds).all();
      messages = (m.results || []).map((x) => ({ id: x.id, link: x.link_id, from: x.from_user, session: x.session_id, text: x.text, created: x.created }));
    }
    // Posts: friends' posts to all friends, posts sent to me, and my own (last 60 days).
    const friendIds = [me, ...links.filter((l) => l.kind === 'friend').map((l) => l.user.id)];
    const ps = await env.DB.prepare(`SELECT p.*, u.name AS user_name FROM posts p JOIN users u ON u.id = p.user_id WHERE p.created > ? AND ((p.user_id IN (${inList(friendIds.length)}) AND p.audience = 'friends') OR p.to_user = ? OR p.user_id = ?) ORDER BY p.created DESC LIMIT 60`).bind(now() - 60 * 86400000, ...friendIds, me, me).all();
    const posts = (ps.results || []).filter((p) => !hidden.has(p.user_id)).map((p) => ({ id: p.id, user: { id: p.user_id, name: p.user_name }, kind: p.kind, data: JSON.parse(p.data || '{}'), media: JSON.parse(p.media || '[]'), text: p.text, audience: p.audience, to: p.to_user, created: p.created }));
    const visiblePosts = new Set(posts.map((p) => `p:${p.id}`));
    const cm = await env.DB.prepare(`SELECT c.*, u.name AS user_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.item_owner IN (${inList(ids.length)}) AND c.created > ? ORDER BY c.created ASC LIMIT 600`).bind(...ids, now() - 60 * 86400000).all();
    const comments = (cm.results || []).filter((c) => !hidden.has(c.user_id) && (!c.item.startsWith('p:') || visiblePosts.has(c.item)))
      .map((c) => ({ id: c.id, owner: c.item_owner, item: c.item, user: { id: c.user_id, name: c.user_name }, text: c.text, created: c.created }));
    const tg = await env.DB.prepare("SELECT * FROM together WHERE (a = ? OR b = ?) AND status IN ('pending', 'accepted') AND date >= ? ORDER BY date ASC LIMIT 30").bind(me, me, new Date(now() - 8 * 86400000).toISOString().slice(0, 10)).all();
    const inv = await env.DB.prepare('SELECT code, kind, created FROM invites WHERE user_id = ? AND created > ? ORDER BY created DESC').bind(me, now() - INVITE_DAYS * 86400000).all();
    const rq = await env.DB.prepare('SELECT r.from_user, r.to_user, r.created, uf.name AS from_name, ut.name AS to_name FROM requests r JOIN users uf ON uf.id = r.from_user JOIN users ut ON ut.id = r.to_user WHERE r.from_user = ? OR r.to_user = ? ORDER BY r.created DESC LIMIT 100').bind(me, me).all();
    const reqs = rq.results || [];
    const profiles = await profilesOf(env, [...new Set([...ids, ...reqs.map((x) => (x.from_user === me ? x.to_user : x.from_user))])], me);
    const mine = await env.DB.prepare('SELECT b.blocked AS id, u.name FROM blocks b JOIN users u ON u.id = b.blocked WHERE b.user_id = ? ORDER BY b.created DESC').bind(me).all();
    return json({
      blocked: mine.results || [],
      profiles,
      requests: {
        in: reqs.filter((x) => x.to_user === me).map((x) => ({ user: { id: x.from_user, name: x.from_name }, created: x.created })),
        out: reqs.filter((x) => x.from_user === me).map((x) => ({ user: { id: x.to_user, name: x.to_name }, created: x.created })),
      },
      me: { id: me, name: user.name },
      links, cards, cheers,
      contests: (ct.results || []).map((c) => ({ id: c.id, a: c.a, b: c.b, kind: c.kind, ex: c.ex, exName: c.ex_name, days: c.days, start: c.start, status: c.status, created: c.created, scores: scoresOf(c.id), ...(c.b === 'group' ? { members: membersOf(c.id) } : {}) })),
      proposals: (pr.results || []).map((p) => ({ id: p.id, coach: p.coach, client: p.client, data: JSON.parse(p.data), note: p.note, status: p.status, created: p.created, decided: p.decided })),
      messages,
      posts, comments,
      together: (tg.results || []).filter((t) => !hidden.has(t.a) && !hidden.has(t.b)).map((t) => ({ id: t.id, a: t.a, b: t.b, date: t.date, time: t.time, title: t.title, place: t.place, status: t.status })),
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
    if (await isBlocked(env, me, inv.user_id)) return json({ error: 'That invite code isn\'t valid or has expired.' }, 404);
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

  // My profile. The display name is the account name.
  if (path === '/v2/social/profile') {
    const old = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(me).first();
    const name = String(body.name ?? user.name).trim().slice(0, 40);
    if (!name) return json({ error: 'Add a name.' }, 400);
    const handle = body.handle ? normHandle(body.handle) : null;
    if (handle && !HANDLE.test(handle)) return json({ error: 'Usernames are 3–20 letters, numbers, _ or .' }, 400);
    if (handle && await env.DB.prepare('SELECT user_id FROM profiles WHERE handle = ? AND user_id != ?').bind(handle, me).first()) return json({ error: 'That username is taken.' }, 409);
    const photo = body.photo && /^[0-9a-f]{32}$/.test(body.photo) ? body.photo : null;
    const p = { handle, bio: String(body.bio || '').trim().slice(0, 160), photo, gym: String(body.gym || '').trim().slice(0, 40), goal: GOALS.includes(body.goal) ? body.goal : '', findable: body.findable === false ? 0 : 1 };
    await env.DB.batch([
      env.DB.prepare('INSERT INTO profiles (user_id, handle, bio, photo, gym, goal, findable, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET handle = excluded.handle, bio = excluded.bio, photo = excluded.photo, gym = excluded.gym, goal = excluded.goal, findable = excluded.findable, updated = excluded.updated')
        .bind(me, p.handle, p.bio, p.photo, p.gym, p.goal, p.findable, now()),
      env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, me),
    ]);
    if (old?.photo && old.photo !== photo) await deleteMedia(env, me, [old.photo]);
    return json({ ok: true, name, profile: pubProfile(p) });
  }

  // Find someone by their exact username (no browsing or partial matches).
  if (path === '/v2/social/find') {
    const handle = normHandle(body.handle);
    if (!HANDLE.test(handle)) return json({ error: 'Usernames are 3–20 letters, numbers, _ or .' }, 400);
    const p = await env.DB.prepare('SELECT p.*, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.handle = ? AND p.findable = 1').bind(handle).first();
    if (!p) return json({ error: `No one goes by @${handle}.` }, 404);
    if (p.user_id === me) return json({ error: 'That is your username.' }, 400);
    if (await isBlocked(env, me, p.user_id)) return json({ error: `No one goes by @${handle}.` }, 404);
    const friend = await linkBetween(env, me, p.user_id, 'friend');
    const rq = await env.DB.prepare('SELECT from_user FROM requests WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)').bind(me, p.user_id, p.user_id, me).first();
    const { findable: _hidden, ...shown } = pubProfile(p);
    return json({ user: { id: p.user_id, name: p.name }, profile: shown, status: friend ? 'friend' : rq ? (rq.from_user === me ? 'sent' : 'received') : null });
  }

  // Friend requests: send (or accept, if they already asked), answer, take back.
  if (path === '/v2/social/request') {
    const to = String(body.to || '');
    const target = to && to !== me && await env.DB.prepare('SELECT u.id, u.name, p.findable FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?').bind(to).first();
    if (!target || await isBlocked(env, me, to)) return json({ error: 'Not found.' }, 404);
    if (await linkBetween(env, me, to, 'friend')) return json({ error: `You and ${target.name} are already friends.` }, 400);
    if (await env.DB.prepare('SELECT 1 FROM requests WHERE from_user = ? AND to_user = ?').bind(to, me).first()) {
      const id = await makeFriends(env, to, me);
      await pushTo(env, to, { title: `${user.name} accepted your friend request`, body: '', tag: `link-${id}`, url: './?open=people' });
      return json({ ok: true, friends: true, link: { id, kind: 'friend', role: 'friend', user: { id: to, name: target.name } } });
    }
    if (!target.findable) return json({ error: 'Not found.' }, 404);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM requests WHERE from_user = ?').bind(me).first();
    if ((n?.n || 0) >= 50) return json({ error: 'Too many requests waiting. Cancel some first.' }, 400);
    await env.DB.prepare('INSERT OR IGNORE INTO requests (from_user, to_user, created) VALUES (?, ?, ?)').bind(me, to, now()).run();
    await pushTo(env, to, { title: `${user.name} sent you a friend request`, body: 'Open People to answer.', tag: `req-${me}`, url: './?open=people' });
    return json({ ok: true, sent: true });
  }
  if (path === '/v2/social/request/respond') {
    const from = String(body.from || '');
    const r = await env.DB.prepare('SELECT r.*, u.name FROM requests r JOIN users u ON u.id = r.from_user WHERE r.from_user = ? AND r.to_user = ?').bind(from, me).first();
    if (!r) return json({ error: 'That request is no longer open.' }, 404);
    if (!body.accept) { await env.DB.prepare('DELETE FROM requests WHERE from_user = ? AND to_user = ?').bind(from, me).run(); return json({ ok: true }); }
    const id = await makeFriends(env, from, me);
    await pushTo(env, from, { title: `${user.name} accepted your friend request`, body: '', tag: `link-${id}`, url: './?open=people' });
    return json({ ok: true, link: { id, kind: 'friend', role: 'friend', user: { id: from, name: r.name } } });
  }
  if (path === '/v2/social/request/cancel') {
    await env.DB.prepare('DELETE FROM requests WHERE from_user = ? AND to_user = ?').bind(me, String(body.to || '')).run();
    return json({ ok: true });
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
    else {
      await env.DB.prepare('INSERT OR IGNORE INTO cheers (owner, item, from_user, created) VALUES (?, ?, ?, ?)').bind(owner, item, me, now()).run();
      if (owner !== me) await pushTo(env, owner, { title: `${user.name} gave you big ups on your ${item.startsWith('p:') ? 'post' : item.startsWith('w:') ? 'workout' : item.startsWith('m:') ? 'streak' : 'new best'}`, body: '', tag: `like-${item}`, url: './?open=people' });
    }
    return json({ ok: true });
  }

  // ---------- Posts and comments ----------
  // A post shares something specific (a record with its weight, a workout, a lift's progress, or a
  // photo and a few words) with all friends or one friend. Comments work on posts and on the
  // automatic feed items (records and workouts from each person's card).
  async function canSee(owner, item) {
    if (owner === me) return true;
    if (await isBlocked(env, me, owner)) return false;
    if (item.startsWith('p:')) {
      const p = await env.DB.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').bind(item.slice(2), owner).first();
      if (!p) return false;
      if (p.audience === 'one') return p.to_user === me;
      return !!(await linkBetween(env, me, owner, 'friend'));
    }
    return !!(await linkBetween(env, me, owner, 'friend')) || !!(await linkBetween(env, me, owner, 'coach'));
  }
  if (path === '/v2/social/post') {
    const kind = ['record', 'workout', 'progress', 'note'].includes(body.kind) ? body.kind : null;
    if (!kind) return json({ error: 'Unknown post type.' }, 400);
    const to = body.to ? String(body.to) : null;
    if (to && !(await linkBetween(env, me, to, 'friend'))) return json({ error: 'You can share with friends only.' }, 403);
    const data = JSON.stringify(body.data || {});
    if (data.length > 4000) return json({ error: 'Too large.' }, 400);
    const media = (Array.isArray(body.media) ? body.media : []).filter((x) => /^[0-9a-f]{32}$/.test(x?.id || '') && ['image', 'video'].includes(x.kind)).slice(0, 4).map((x) => ({ id: x.id, kind: x.kind }));
    const text = String(body.text || '').trim().slice(0, 1000);
    if (kind === 'note' && !text && !media.length) return json({ error: 'Add a photo or a few words.' }, 400);
    const id = rid();
    await env.DB.prepare('INSERT INTO posts (id, user_id, kind, data, media, text, audience, to_user, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, me, kind, data, JSON.stringify(media), text, to ? 'one' : 'friends', to, now()).run();
    if (to) await pushTo(env, to, { title: `${user.name} shared ${kind === 'record' ? 'a new best' : kind === 'workout' ? 'a workout' : kind === 'progress' ? 'their progress' : 'something'} with you`, body: text.slice(0, 140), tag: `post-${id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/social/post/delete') {
    const p = await env.DB.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').bind(String(body.id || ''), me).first();
    if (!p) return json({ error: 'Not found.' }, 404);
    await deleteMedia(env, me, JSON.parse(p.media || '[]').map((m) => m.id));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM comments WHERE item = ? AND item_owner = ?').bind(`p:${p.id}`, me),
      env.DB.prepare('DELETE FROM cheers WHERE item = ? AND owner = ?').bind(`p:${p.id}`, me),
      env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(p.id),
    ]);
    return json({ ok: true });
  }
  if (path === '/v2/social/comment') {
    const owner = String(body.owner || '');
    const item = String(body.item || '').slice(0, 120);
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) return json({ error: 'Write something first.' }, 400);
    if (!(await canSee(owner, item))) return json({ error: 'Not connected.' }, 403);
    const id = rid();
    await env.DB.prepare('INSERT INTO comments (id, item_owner, item, user_id, text, created) VALUES (?, ?, ?, ?, ?, ?)').bind(id, owner, item, me, text, now()).run();
    if (owner !== me) await pushTo(env, owner, { title: `${user.name} commented`, body: text.slice(0, 140), tag: `comment-${item}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/social/comment/delete') {
    const c = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(String(body.id || '')).first();
    if (!c || (c.user_id !== me && c.item_owner !== me)) return json({ error: 'Not found.' }, 404);
    await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(c.id).run();
    return json({ ok: true });
  }

  // ---------- Block and report ----------
  if (path === '/v2/social/block') {
    const id = String(body.id || '');
    if (!id || id === me || !(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first())) return json({ error: 'Not found.' }, 404);
    const ls = await env.DB.prepare('SELECT id FROM links WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').bind(me, id, id, me).all();
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked, created) VALUES (?, ?, ?)').bind(me, id, now()),
      ...(ls.results || []).map((l) => env.DB.prepare('DELETE FROM messages WHERE link_id = ?').bind(l.id)),
      env.DB.prepare('DELETE FROM links WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').bind(me, id, id, me),
      env.DB.prepare('DELETE FROM requests WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)').bind(me, id, id, me),
      env.DB.prepare("UPDATE proposals SET status = 'withdrawn', decided = ? WHERE ((coach = ? AND client = ?) OR (coach = ? AND client = ?)) AND status = 'pending'").bind(now(), me, id, id, me),
      env.DB.prepare("UPDATE contests SET status = 'cancelled' WHERE ((a = ? AND b = ?) OR (a = ? AND b = ?)) AND status IN ('pending', 'active')").bind(me, id, id, me),
      // Their comments and likes come off my posts, so my other friends stop seeing them too.
      env.DB.prepare('DELETE FROM comments WHERE item_owner = ? AND user_id = ?').bind(me, id),
      env.DB.prepare('DELETE FROM cheers WHERE owner = ? AND from_user = ?').bind(me, id),
    ]);
    return json({ ok: true });
  }
  if (path === '/v2/social/unblock') {
    await env.DB.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked = ?').bind(me, String(body.id || '')).run();
    return json({ ok: true });
  }
  if (path === '/v2/social/report') {
    const kind = ['user', 'post', 'comment'].includes(body.kind) ? body.kind : null;
    const reason = REPORT_REASONS.includes(body.reason) ? body.reason : null;
    if (!kind || !reason) return json({ error: 'Choose a reason.' }, 400);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND created > ?').bind(me, now() - 86400000).first();
    if ((n?.n || 0) >= 20) return json({ error: 'Too many reports today. Try again tomorrow.' }, 429);
    let target = String(body.user || ''); let item = null; let content = {};
    if (kind === 'post') {
      item = String(body.item || '');
      const p = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(item).first();
      if (!p || !(await canSee(p.user_id, `p:${p.id}`))) return json({ error: 'Not found.' }, 404);
      target = p.user_id; content = { text: p.text, media: JSON.parse(p.media || '[]'), data: JSON.parse(p.data || '{}') };
    } else if (kind === 'comment') {
      item = String(body.item || '');
      const c = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(item).first();
      if (!c || !(await canSee(c.item_owner, c.item))) return json({ error: 'Not found.' }, 404);
      target = c.user_id; content = { text: c.text };
    }
    if (target === me) return json({ error: 'That is your own.' }, 400);
    const who = await env.DB.prepare('SELECT u.name, p.handle, p.bio, p.photo, p.gym FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?').bind(target).first();
    if (!who) return json({ error: 'Not found.' }, 404);
    const id = rid();
    await env.DB.prepare('INSERT INTO reports (id, reporter, target, kind, item, reason, note, snapshot, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, me, target, kind, item, reason, String(body.note || '').trim().slice(0, 500), JSON.stringify({ who, ...content }), 'open', now()).run();
    if (env.MODERATOR_ID) await pushTo(env, env.MODERATOR_ID, { title: 'New report in Lift', body: `${kind}: ${reason}`, tag: `report-${id}`, url: './' });
    return json({ ok: true });
  }

  // Training together.
  if (path === '/v2/social/together') {
    const to = String(body.to || '');
    if (!(await linkBetween(env, me, to, 'friend')) || (await isBlocked(env, me, to))) return json({ error: 'You can invite friends only.' }, 403);
    if (!isDate(body.date)) return json({ error: 'Pick a day.' }, 400);
    const time = /^\d{2}:\d{2}$/.test(String(body.time || '')) ? String(body.time) : null;
    const id = rid();
    await env.DB.prepare("INSERT INTO together (id, a, b, date, time, title, place, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
      .bind(id, me, to, body.date, time, String(body.title || '').trim().slice(0, 60) || null, String(body.place || '').trim().slice(0, 60) || null, now()).run();
    await pushTo(env, to, { title: `${user.name} wants to train together`, body: `${body.title ? `${String(body.title).slice(0, 60)}, ` : ''}${body.date}${time ? ` at ${time}` : ''}. Open People to answer.`, tag: `together-${id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/social/together/respond') {
    const t = await env.DB.prepare("SELECT * FROM together WHERE id = ? AND status IN ('pending', 'accepted')").bind(String(body.id || '')).first();
    if (!t) return json({ error: 'That plan is no longer open.' }, 404);
    if (body.cancel) {
      if (t.a !== me && t.b !== me) return json({ error: 'Not yours.' }, 403);
      await env.DB.prepare("UPDATE together SET status = 'cancelled' WHERE id = ?").bind(t.id).run();
      await pushTo(env, t.a === me ? t.b : t.a, { title: `${user.name} can't make it`, body: `Training together on ${t.date} is off.`, tag: `together-${t.id}`, url: './?open=people' });
      return json({ ok: true });
    }
    if (t.b !== me || t.status !== 'pending') return json({ error: 'Not yours.' }, 403);
    await env.DB.prepare('UPDATE together SET status = ? WHERE id = ?').bind(body.accept ? 'accepted' : 'declined', t.id).run();
    await pushTo(env, t.a, { title: body.accept ? `${user.name} is in` : `${user.name} can't make it`, body: body.accept ? `Training together on ${t.date}${t.time ? ` at ${t.time}` : ''}.` : `Maybe another day.`, tag: `together-${t.id}`, url: './?open=people' });
    return json({ ok: true });
  }

  // Head-to-head challenges.
  if (path === '/v2/social/contest' && Array.isArray(body.to)) {
    const to = [...new Set(body.to.map(String))].filter((id) => id && id !== me).slice(0, 9);
    if (to.length < 2) return json({ error: 'Pick at least two friends for a group challenge.' }, 400);
    for (const id of to) if (!(await linkBetween(env, me, id, 'friend')) || (await isBlocked(env, me, id))) return json({ error: 'You can challenge friends only.' }, 403);
    if (!isDate(body.today)) return json({ error: 'Missing date.' }, 400);
    const kind = CONTEST_KINDS.includes(body.kind) && body.kind !== 'lift' ? body.kind : 'workouts';
    const days = [7, 14, 28].includes(+body.days) ? +body.days : 7;
    const id = rid();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO contests (id, a, b, kind, ex, ex_name, days, start, status, created) VALUES (?, ?, 'group', ?, NULL, NULL, ?, ?, 'active', ?)").bind(id, me, kind, days, body.today, now()),
      env.DB.prepare("INSERT INTO contest_members (contest_id, user_id, status) VALUES (?, ?, 'in')").bind(id, me),
      ...to.map((u) => env.DB.prepare("INSERT INTO contest_members (contest_id, user_id, status) VALUES (?, ?, 'pending')").bind(id, u)),
    ]);
    for (const u of to) await pushTo(env, u, { title: `${user.name} started a group challenge`, body: `${CONTEST_TEXT[kind]} over ${days} days, with ${to.length} friends. Open People to join.`, tag: `contest-${id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/social/contest') {
    const to = String(body.to || '');
    if (!(await linkBetween(env, me, to, 'friend'))) return json({ error: 'You can challenge friends only.' }, 403);
    const kind = CONTEST_KINDS.includes(body.kind) ? body.kind : 'workouts';
    const days = [7, 14, 28].includes(+body.days) ? +body.days : 7;
    if (kind === 'lift' && !body.ex) return json({ error: 'Pick a lift.' }, 400);
    const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM contests WHERE (a = ? OR b = ?) AND status IN ('pending', 'active')").bind(me, me).first();
    if ((open?.n || 0) >= 10) return json({ error: 'You have 10 challenges going. Finish some first.' }, 400);
    const id = rid();
    if (await isBlocked(env, me, to)) return json({ error: 'You can challenge friends only.' }, 403);
    await env.DB.prepare("INSERT INTO contests (id, a, b, kind, ex, ex_name, days, start, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)")
      .bind(id, me, to, kind, kind === 'lift' ? String(body.ex).slice(0, 80) : null, kind === 'lift' ? String(body.exName || '').slice(0, 80) : null, days, now()).run();
    await pushTo(env, to, { title: `${user.name} challenged you`, body: kind === 'lift' ? `Biggest gain on ${body.exName || 'a lift'} over ${days} days. Open People to answer.` : `${CONTEST_TEXT[kind] || 'A challenge'} over ${days} days. Open People to answer.`, tag: `contest-${id}`, url: './?open=people' });
    return json({ ok: true, id });
  }
  if (path === '/v2/social/contest/respond') {
    const g = await env.DB.prepare("SELECT * FROM contests WHERE id = ? AND b = 'group' AND status = 'active'").bind(String(body.id || '')).first();
    if (g) {
      if (body.cancel) {
        if (g.a !== me) return json({ error: 'Not yours.' }, 403);
        await env.DB.prepare("UPDATE contests SET status = 'cancelled' WHERE id = ?").bind(g.id).run();
        return json({ ok: true });
      }
      const m = await env.DB.prepare('SELECT status FROM contest_members WHERE contest_id = ? AND user_id = ?').bind(g.id, me).first();
      if (!m) return json({ error: 'Not yours.' }, 403);
      await env.DB.prepare('UPDATE contest_members SET status = ? WHERE contest_id = ? AND user_id = ?').bind(body.accept ? 'in' : 'out', g.id, me).run();
      if (body.accept) await pushTo(env, g.a, { title: `${user.name} joined your challenge`, body: 'Game on.', tag: `contest-${g.id}`, url: './?open=people' });
      return json({ ok: true });
    }
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

  // Running totals for active challenges: each phone reports its own, and only the two people in
  // the challenge get them back.
  if (path === '/v2/social/contest/score') {
    const entries = Object.entries(body.scores || {}).slice(0, 20);
    for (const [id, raw] of entries) {
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || v > 1e9) continue;
      const c = await env.DB.prepare("SELECT id FROM contests WHERE id = ? AND status = 'active' AND (a = ? OR b = ? OR id IN (SELECT contest_id FROM contest_members WHERE user_id = ? AND status = 'in'))").bind(String(id), me, me, me).first();
      if (c) await env.DB.prepare('INSERT INTO contest_scores (contest_id, user_id, value, updated) VALUES (?, ?, ?, ?) ON CONFLICT(contest_id, user_id) DO UPDATE SET value = excluded.value, updated = excluded.updated').bind(c.id, me, v, now()).run();
    }
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
