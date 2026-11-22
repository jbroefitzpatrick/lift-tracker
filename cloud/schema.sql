-- Lift Tracker accounts and sync (Cloudflare D1). Apply with:
--   npx wrangler d1 execute lift --remote --file schema.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,          -- random, base64url
  name TEXT NOT NULL,
  created INTEGER NOT NULL,
  ver INTEGER NOT NULL DEFAULT 0 -- sync counter: every stored change gets the next number
);
CREATE TABLE IF NOT EXISTS creds (   -- passkeys
  id TEXT PRIMARY KEY,          -- credential id, base64url
  user_id TEXT NOT NULL,
  alg INTEGER NOT NULL,         -- -7 ES256, -257 RS256
  jwk TEXT NOT NULL,            -- public key
  sign_count INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS creds_user ON creds (user_id);
CREATE TABLE IF NOT EXISTS codes (   -- recovery codes (hash of the phone's hash)
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  last_used INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  user_id TEXT,
  name TEXT,
  rp_id TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS docs (    -- synced data, one row per document
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,             -- e.g. sessions/s123, plan/mon, root/settings
  ver INTEGER NOT NULL,
  ts INTEGER NOT NULL,          -- when it changed on a phone (newest wins)
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS docs_ver ON docs (user_id, ver);

-- ---------- Friends and coaching ----------
CREATE TABLE IF NOT EXISTS links (   -- a friendship, or a coach and their client
  id TEXT PRIMARY KEY,
  a TEXT NOT NULL,              -- friend: either person; coach link: the coach
  b TEXT NOT NULL,              -- friend: the other; coach link: the client
  kind TEXT NOT NULL,           -- 'friend' | 'coach'
  perms TEXT,                   -- coach links: what the client shares, JSON {plan, workouts, body, food}
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS links_a ON links (a);
CREATE INDEX IF NOT EXISTS links_b ON links (b);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,        -- e.g. K7PQ-M2XD, single use, 7 days
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,           -- 'friend' | 'coach' (be my coach) | 'client' (I'll coach you)
  perms TEXT,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (   -- what each person shares with friends: weekly effort, progress, records
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cheers (
  owner TEXT NOT NULL,          -- whose record or workout
  item TEXT NOT NULL,
  from_user TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (owner, item, from_user)
);
CREATE TABLE IF NOT EXISTS contests (-- head-to-head challenges between friends
  id TEXT PRIMARY KEY,
  a TEXT NOT NULL,              -- who challenged
  b TEXT NOT NULL,
  kind TEXT NOT NULL,           -- 'workouts' | 'lift'
  ex TEXT,                      -- lift: exercise id
  ex_name TEXT,
  days INTEGER NOT NULL,
  start TEXT,                   -- first day (the accepter's date), set on accept
  status TEXT NOT NULL,         -- 'pending' | 'active' | 'declined' | 'cancelled'
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS contests_a ON contests (a);
CREATE INDEX IF NOT EXISTS contests_b ON contests (b);
CREATE TABLE IF NOT EXISTS proposals (-- plan changes a coach suggests; the client accepts or declines
  id TEXT PRIMARY KEY,
  coach TEXT NOT NULL,
  client TEXT NOT NULL,
  data TEXT NOT NULL,           -- JSON { days: {dayKey: planDay}, exercises: {id: exercise} }
  note TEXT,
  status TEXT NOT NULL,         -- 'pending' | 'accepted' | 'declined' | 'withdrawn'
  created INTEGER NOT NULL,
  decided INTEGER
);
CREATE INDEX IF NOT EXISTS proposals_client ON proposals (client);
CREATE INDEX IF NOT EXISTS proposals_coach ON proposals (coach);
CREATE TABLE IF NOT EXISTS messages (-- notes between a coach and client, optionally about one workout
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  from_user TEXT NOT NULL,
  session_id TEXT,
  text TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_link ON messages (link_id, created);

-- New accounts per network per day (hash of the IP address), for the sign-up cap.
CREATE TABLE IF NOT EXISTS signups (
  ip TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS signups_ip ON signups (ip, created);

-- Web push: each phone that turned on notifications (its push endpoint and keys).
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs (user_id);

-- Challenges whose end has been announced (hourly check in push.js).
CREATE TABLE IF NOT EXISTS contest_done (
  id TEXT PRIMARY KEY,
  done INTEGER NOT NULL
);

-- Posts: something shared on purpose (a record with its weight, a workout, progress, a photo).
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,           -- 'record' | 'workout' | 'progress' | 'note'
  data TEXT,                    -- JSON: what's shown (exercise, weight, reps, change...)
  media TEXT,                   -- JSON [{ id, kind: 'image' | 'video' }] (files in KV, media.js)
  text TEXT,
  audience TEXT NOT NULL,       -- 'friends' | 'one'
  to_user TEXT,                 -- audience 'one': who it's for
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id, created);
CREATE INDEX IF NOT EXISTS posts_to ON posts (to_user, created);
-- Comments on posts and on feed items (records and workouts).
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  item_owner TEXT NOT NULL,
  item TEXT NOT NULL,           -- 'p:<post id>', 'r:<record>', 'w:<workout>'
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_owner ON comments (item_owner, created);

-- Uploads per account per day (UTC), for the daily cap in media.js.
CREATE TABLE IF NOT EXISTS uploads (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS profiles (   -- what a person shows friends: username, photo, bio
  user_id TEXT PRIMARY KEY,
  handle TEXT UNIQUE,           -- username, lowercase a-z 0-9 _ . (3-20); how friends find each other
  bio TEXT,
  photo TEXT,                   -- media id (media/<user>/<id>)
  gym TEXT,
  goal TEXT,                    -- strength | size | fitness | sport | ''
  findable INTEGER NOT NULL DEFAULT 1, -- 0: the username search doesn't find them
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS requests (   -- friend requests sent by username
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (from_user, to_user)
);
CREATE INDEX IF NOT EXISTS requests_to ON requests (to_user);
