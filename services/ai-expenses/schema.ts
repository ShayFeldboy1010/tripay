export const EXPENSES_TABLE = "ai_expenses";

export const EXPENSES_COLUMNS: Record<string, string> = {
  id: "uuid",
  user_id: "uuid",
  trip_id: "uuid",
  date: "date",
  amount: "numeric",
  currency: "text",
  category: "text",
  merchant: "text",
  notes: "text",
  created_at: "timestamptz",
};

export const ALLOWED_AGG = new Set(["SUM", "AVG", "MAX", "MIN", "COUNT"]);

export const ALLOWED_CLAUSES = new Set(["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "LIMIT"]);

export const MAX_LIMIT = 500;
