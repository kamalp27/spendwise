-- 004_create_expenses_table.sql
-- Expenses table: core financial transaction records.
-- user_id uses ON DELETE RESTRICT to protect financial records from accidental cascading deletion.
-- category_id uses ON DELETE SET NULL to preserve financial history if a category is deleted.

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_expenses_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_expenses_payment_method CHECK (
        payment_method IN ('Cash', 'Debit Card', 'Credit Card', 'UPI', 'Net Banking', 'Other')
    )
);

-- Performance indexes for frequent query access patterns
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses (user_id, category_id);
