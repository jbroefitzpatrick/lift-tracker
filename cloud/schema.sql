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
