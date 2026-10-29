-- 005_create_budgets_table.sql
-- Budgets table: supports overall monthly limits (category_id IS NULL)
-- and category-specific limits (category_id IS NOT NULL).

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_budgets_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_budgets_month_range CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT chk_budgets_year_range CHECK (year >= 2024 AND year <= 2100)
);

-- Partial unique index 1: Exactly ONE overall monthly budget per user per (year, month)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_overall
    ON budgets (user_id, year, month)
    WHERE category_id IS NULL;

-- Partial unique index 2: Exactly ONE budget per category per user per (year, month)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category
    ON budgets (user_id, category_id, year, month)
    WHERE category_id IS NOT NULL;

-- Index for period queries
CREATE INDEX IF NOT EXISTS idx_budgets_user_period
    ON budgets (user_id, year, month);
