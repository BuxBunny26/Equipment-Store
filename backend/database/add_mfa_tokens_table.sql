-- MFA tokens table for email-based second-factor authentication.
-- Run once in the Supabase SQL editor.
-- After running, also set SUPABASE_SERVICE_KEY in Netlify environment variables.

CREATE TABLE IF NOT EXISTS mfa_tokens (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id  INTEGER     NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    token_hash    TEXT        NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    used          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_tokens_personnel_id ON mfa_tokens(personnel_id);

-- Deny all direct access from frontend (anon/authenticated roles).
-- Only the Netlify serverless function (using the service role key) can read/write.
ALTER TABLE mfa_tokens ENABLE ROW LEVEL SECURITY;
-- No policies added intentionally = complete denial for non-service roles.
