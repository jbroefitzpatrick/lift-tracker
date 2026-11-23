#!/usr/bin/env node
// Review reports from the People tab. Run from cloud/ with wrangler signed in:
//   node moderate.cjs list             open reports
//   node moderate.cjs done <report>    close a report, no action
//   node moderate.cjs remove <report>  delete the reported post or comment, close the report
//   node moderate.cjs suspend <report> remove the person from People: their posts, comments, links,
//                                      requests and profile go; their own training data stays
const { execSync } = require('child_process');

const where = process.env.LIFT_LOCAL ? `--local --persist-to "${process.env.LIFT_LOCAL}"` : '--remote';
const safe = (v) => { if (!/^[A-Za-z0-9_-]{4,64}$/.test(v || '')) { console.error('Expected a report id.'); process.exit(1); } return v; };
const sql = (q) => {
  const out = execSync(`npx --yes wrangler@3 d1 execute lift ${where} --json --command "${q}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out.slice(out.indexOf('['))).flatMap((r) => r.results || []);
};
const kvDelete = (key) => {
  if (process.env.LIFT_LOCAL) return;
  try { execSync(`npx --yes wrangler@3 kv key delete --binding BACKUPS "${key}"`, { stdio: 'ignore' }); } catch { console.error(`Could not delete ${key}`); }
};
const report = (id) => {
  const r = sql(`SELECT * FROM reports WHERE id = '${safe(id)}'`)[0];
  if (!r) { console.error('No such report.'); process.exit(1); }
  return r;
};
const close = (id) => sql(`UPDATE reports SET status = 'done' WHERE id = '${id}'`);
const mediaOf = (p) => { try { return JSON.parse(p.media || '[]').map((m) => m.id).filter((m) => /^[0-9a-f]{32}$/.test(m)); } catch { return []; } };

const [cmd, id] = process.argv.slice(2);
if (cmd === 'list') {
  const open = sql("SELECT * FROM reports WHERE status = 'open' ORDER BY created");
  if (!open.length) console.log('No open reports.');
  for (const r of open) {
    const s = JSON.parse(r.snapshot);
    console.log(`\n${r.id}  ${new Date(r.created).toISOString().slice(0, 16)}  ${r.kind}: ${r.reason}`);
    console.log(`  Person: ${s.who?.name}${s.who?.handle ? ` (@${s.who.handle})` : ''}  ${r.target}`);
    if (s.who?.bio) console.log(`  Bio: ${s.who.bio}`);
    if (s.text) console.log(`  Content: ${s.text}`);
    for (const m of s.media || []) console.log(`  Media: https://lift-backup.jbroefitzpatrick.workers.dev/v2/media/${r.target}/${m.id}`);
    if (s.who?.photo) console.log(`  Photo: https://lift-backup.jbroefitzpatrick.workers.dev/v2/media/${r.target}/${s.who.photo}`);
    if (r.note) console.log(`  Reporter's note: ${r.note}`);
  }
} else if (cmd === 'done') {
  close(report(id).id); console.log('Closed.');
} else if (cmd === 'remove') {
  const r = report(id);
  if (r.kind === 'post') {
    const p = sql(`SELECT media FROM posts WHERE id = '${safe(r.item)}'`)[0];
    sql(`DELETE FROM comments WHERE item = 'p:${r.item}' AND item_owner = '${safe(r.target)}'; DELETE FROM cheers WHERE item = 'p:${r.item}' AND owner = '${r.target}'; DELETE FROM posts WHERE id = '${r.item}'`);
    for (const m of p ? mediaOf(p) : []) kvDelete(`media/${r.target}/${m}`);
  } else if (r.kind === 'comment') {
    sql(`DELETE FROM comments WHERE id = '${safe(r.item)}'`);
  } else { console.error('This report is about a person. Use suspend, or done.'); process.exit(1); }
  close(r.id); console.log('Removed and closed.');
} else if (cmd === 'suspend') {
  const r = report(id); const u = safe(r.target);
  const posts = sql(`SELECT media FROM posts WHERE user_id = '${u}'`);
  const prof = sql(`SELECT photo FROM profiles WHERE user_id = '${u}'`)[0];
  const links = sql(`SELECT id FROM links WHERE a = '${u}' OR b = '${u}'`);
  sql([
    `INSERT OR IGNORE INTO suspended (user_id, reason, created) VALUES ('${u}', '${safe(r.id)}', ${Date.now()})`,
    ...links.map((l) => `DELETE FROM messages WHERE link_id = '${safe(l.id)}'`),
    `DELETE FROM links WHERE a = '${u}' OR b = '${u}'`, `DELETE FROM requests WHERE from_user = '${u}' OR to_user = '${u}'`,
    `DELETE FROM comments WHERE user_id = '${u}' OR item_owner = '${u}'`, `DELETE FROM cheers WHERE owner = '${u}' OR from_user = '${u}'`,
    `DELETE FROM posts WHERE user_id = '${u}'`, `DELETE FROM cards WHERE user_id = '${u}'`, `DELETE FROM profiles WHERE user_id = '${u}'`,
    `UPDATE contests SET status = 'cancelled' WHERE (a = '${u}' OR b = '${u}') AND status IN ('pending', 'active')`,
    `UPDATE proposals SET status = 'withdrawn', decided = ${Date.now()} WHERE (coach = '${u}' OR client = '${u}') AND status = 'pending'`,
    `UPDATE reports SET status = 'done' WHERE target = '${u}'`,
  ].join('; '));
  for (const m of posts.flatMap(mediaOf)) kvDelete(`media/${u}/${m}`);
  if (prof?.photo && /^[0-9a-f]{32}$/.test(prof.photo)) kvDelete(`media/${u}/${prof.photo}`);
  console.log('Suspended and removed from People.');
} else {
  console.log('Usage: node moderate.cjs list | done <report> | remove <report> | suspend <report>');
}
