// Photos and short videos attached to posts (People tab).
//
// Stored in the BACKUPS KV namespace under media/<userId>/<id> (a separate prefix from backups).
// The id is 128 random bits and only appears in posts shown to the people the post is shared with,
// so the file URL itself is the permission (images and videos load in <img>/<video>, which can't
// send a sign-in header). Deleting a post, or the account, deletes its files.
// Limits: photos 3 MB (the phone resizes them first), videos 20 MB (about 15–30 seconds), and per
// account 30 files or 150 MB a day (the free storage is shared by everyone).
// Videos support Range requests, which Safari needs to play them.

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
const MAX = { image: 3 * 1024 * 1024, video: 20 * 1024 * 1024 };
const hexId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function handleMedia(req, env, path, json, authUser) {
  if (!env.BACKUPS) return json({ error: 'Media storage is not set up.' }, 503);
  if (path === '/v2/media/upload' && req.method === 'POST') {
    const user = await authUser(req, env);
    if (!user) return json({ error: 'Signed out.' }, 401);
    const type = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES.includes(type)) return json({ error: 'Photos (JPEG, PNG) and videos (MP4, MOV) only.' }, 400);
    const buf = await req.arrayBuffer();
    const kind = type.startsWith('video/') ? 'video' : 'image';
    if (!buf.byteLength) return json({ error: 'Empty file.' }, 400);
    if (buf.byteLength > MAX[kind]) return json({ error: kind === 'video' ? 'Videos can be up to 20 MB (about 15–30 seconds). Trim it in Photos first.' : 'That photo is too large.' }, 413);
    // Daily cap per account (table uploads).
    if (env.DB) {
      const day = new Date().toISOString().slice(0, 10);
      const u = await env.DB.prepare('SELECT n, bytes FROM uploads WHERE user_id = ? AND day = ?').bind(user.id, day).first();
      if (u && (u.n >= 30 || u.bytes + buf.byteLength > 150 * 1024 * 1024)) return json({ error: 'You reached the upload limit for today. Try again tomorrow.' }, 429);
      await env.DB.prepare('INSERT INTO uploads (user_id, day, n, bytes) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1, bytes = bytes + excluded.bytes').bind(user.id, day, buf.byteLength).run();
    }
    const id = hexId();
    await env.BACKUPS.put(`media/${user.id}/${id}`, buf, { metadata: { type, size: buf.byteLength, created: Date.now() } });
    return json({ id, type, kind });
  }
  const m = /^\/v2\/media\/([A-Za-z0-9_-]{10,40})\/([0-9a-f]{32})$/.exec(path);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    const { value, metadata } = await env.BACKUPS.getWithMetadata(`media/${m[1]}/${m[2]}`, { type: 'arrayBuffer' });
    if (!value) return new Response('Not found', { status: 404 });
    const size = value.byteLength;
    const headers = { 'Content-Type': metadata?.type || 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('Range') || '');
    if (range) {
      let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
      let end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
      if (start < 0) start = 0;
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
      return new Response(req.method === 'HEAD' ? null : value.slice(start, end + 1), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
    }
    return new Response(req.method === 'HEAD' ? null : value, { headers: { ...headers, 'Content-Length': String(size) } });
  }
  return json({ error: 'Not found.' }, 404);
}

// Remove files (a post's, or every file of an account).
export async function deleteMedia(env, userId, ids = null) {
  if (!env.BACKUPS) return;
  if (ids) { for (const id of ids) if (/^[0-9a-f]{32}$/.test(id)) await env.BACKUPS.delete(`media/${userId}/${id}`); return; }
  let cursor;
  do {
    const r = await env.BACKUPS.list({ prefix: `media/${userId}/`, cursor });
    for (const k of r.keys) await env.BACKUPS.delete(k.name);
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
}
