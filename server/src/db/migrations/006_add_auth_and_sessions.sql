-- 006_add_auth_and_sessions.sql
-- Production Authentication Schema: Password hashing, account status, and PostgreSQL session store.

-- 1. Extend users table with authentication and account lifecycle fields
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Create server-side session store table
-- Stores cryptographic session IDs, serialized session payload, and expiration timestamp.
-- Foreign key user_id enables immediate user-scoped session lookup and cascading deletion.
CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMPTZ NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Performance & Maintenance Indexes
-- Index on expiration timestamp for automated and periodic cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions (expire);

-- Index on user_id for rapid user session lookup and revocation (e.g. logout all devices)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
