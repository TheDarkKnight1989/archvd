-- OAuth Sessions Table
-- Stores OAuth state/verifier server-side instead of cookies
-- Solves cross-site cookie persistence issues

CREATE TABLE IF NOT EXISTS oauth_sessions (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  user_id TEXT,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Index for cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at);

-- Auto-cleanup function (optional)
-- DELETE FROM oauth_sessions WHERE expires_at < NOW();
