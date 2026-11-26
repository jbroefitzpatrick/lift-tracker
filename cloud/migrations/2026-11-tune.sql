-- Tuning records (opt-out, same switch as calib): small facts from finished workouts used to tune
-- defaults (starting weights, progression, session length, RIR, skips, deloads and volume).
CREATE TABLE IF NOT EXISTS tune (
  id TEXT PRIMARY KEY,          -- who prefix + the phone's id for the record
  who TEXT NOT NULL,            -- one-way hash of the account id
  kind TEXT NOT NULL,           -- start | prog | session | rir | skip | trend
  ex TEXT,                      -- exercise id when there is one
  data TEXT NOT NULL,           -- the checked fields as JSON
  month TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tune_who ON tune (who);
CREATE INDEX IF NOT EXISTS tune_kind ON tune (kind);
