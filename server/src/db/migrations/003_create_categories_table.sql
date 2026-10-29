-- 003_create_categories_table.sql
-- Categories table: supports global predefined categories (user_id IS NULL)
-- and custom user-created categories (user_id IS NOT NULL).

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'tag',
    color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    is_predefined BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_categories_scope CHECK (
        (is_predefined = TRUE AND user_id IS NULL) OR
        (is_predefined = FALSE AND user_id IS NOT NULL)
    )
);

-- Case-insensitive uniqueness for global predefined categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_global_name_lower
    ON categories (LOWER(name))
    WHERE user_id IS NULL;

-- Case-insensitive uniqueness for user-defined categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name_lower
    ON categories (user_id, LOWER(name))
    WHERE user_id IS NOT NULL;
