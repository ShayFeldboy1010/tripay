-- Ensure optimized lookups for the AI expenses chat feature
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses (user_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_user_merchant ON expenses (user_id, merchant);

