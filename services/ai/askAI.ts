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

export interface StreamHandlers {
  onToken(token: string): void;
  onResult(result: ExpensesChatResult): void;
  onError(error: Error): void;
}

export interface StreamOptions {
  since?: string;
  until?: string;
  timezone?: string;
  userId?: string;
}

export function streamExpensesAI(question: string, options: StreamOptions, handlers: StreamHandlers) {
  const params = new URLSearchParams();
  params.set("question", question);
  if (options.since) params.set("since", options.since);
  if (options.until) params.set("until", options.until);
  if (options.timezone) params.set("timezone", options.timezone);
  if (options.userId) params.set("userId", options.userId);

  const es = new EventSource(`/api/ai/expenses/chat?${params.toString()}`);

  es.addEventListener("token", (event) => {
    handlers.onToken((event as MessageEvent<string>).data);
  });

  es.addEventListener("result", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as ExpensesChatResult;
      handlers.onResult(payload);
    } catch (err) {
      handlers.onError(err instanceof Error ? err : new Error("Failed to parse result"));
    } finally {
      es.close();
    }
  });

  es.addEventListener("error", () => {
    handlers.onError(new Error("SSE connection error"));
    es.close();
  });

  return {
    close: () => es.close(),
  };
}

