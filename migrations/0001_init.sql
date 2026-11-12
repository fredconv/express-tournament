-- Tournaments are stored as one validated JSON document each (ARCHITECTURE.md §6).
CREATE TABLE tournaments (
  id               TEXT PRIMARY KEY,   -- public id, 10 random base32 chars
  owner_token_hash TEXT NOT NULL,      -- SHA-256 hex of the management code
  doc              TEXT NOT NULL,      -- TournamentDoc JSON
  version          INTEGER NOT NULL,   -- optimistic lock, +1 on each write
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL       -- tournament date + 90 days (D6)
);

CREATE INDEX idx_tournaments_expires ON tournaments (expires_at);
