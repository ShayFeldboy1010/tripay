export interface ExpensesChatRow {
  date: string;
  amount: number;
  currency: string;
  category: string | null;
  merchant: string | null;
  notes: string | null;
}

export interface ExpensesAggregates {
  total: number | null;
  avg: number | null;
  max: { amount: number; merchant: string | null; date: string; currency: string } | null;
  byCategory: Array<{ category: string; sum: number; currency: string }>;
  byMerchant: Array<{ merchant: string; sum: number; currency: string }>;
  totalsByCurrency: Array<{ currency: string; total: number; avg: number; count: number }>;
}

export interface ExpensesChatMetaEvent {
  timeRange: { since: string; until: string };
  tz: string;
  userId_last4: string;
}

export interface ExpensesChatResult {
  answer: string;
  model: string;
  provider: string;
  plan: unknown;
  usedFallback: boolean;
  sql: string;
  timeRange: { since: string; until: string; tz: string };
  aggregates: ExpensesAggregates;
  rows: ExpensesChatRow[];
}

export type ExpensesStreamEvent =
  | { type: "meta"; data: ExpensesChatMetaEvent }
  | { type: "token"; data: string }
  | { type: "result"; data: ExpensesChatResult }
  | { type: "ping"; data: Record<string, never> }
  | { type: "error"; data: { message: string } };

export interface ExpensesChatRequestParams {
  question: string;
  since?: string;
  until?: string;
  timezone?: string;
  tz?: string;
  token?: string | null;
  tripId?: string | null;
  userId?: string | null;
}

export function buildExpensesStreamUrl(params: ExpensesChatRequestParams) {
  const search = new URLSearchParams();
  search.set("q", params.question);
  if (params.tripId) {
    search.set("tripId", params.tripId);
  } else if (params.userId) {
    search.set("userId", params.userId);
  }
  if (params.token) {
    search.set("token", params.token);
  }
  if (params.since) search.set("since", params.since);
  if (params.until) search.set("until", params.until);
  const tz = params.timezone ?? params.tz;
  if (tz) search.set("tz", tz);
  return `/api/ai/expenses/chat/stream?${search.toString()}`;
}

