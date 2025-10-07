function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  currencyNote: string | null;
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
  fallbackReason: "planner_error" | "db_error" | null;
  sql: string;
  timeRange: { since: string; until: string; tz: string };
  aggregates: ExpensesAggregates;
  rows: ExpensesChatRow[];
  currencyNote?: string | null;
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

export interface ChatRequestBody {
  question: string;
  since?: string | null;
  until?: string | null;
  timezone?: string | null;
  tz?: string | null;
  tripId?: string | null;
  userId?: string | null;
  token?: string | null;
}

const STREAM_ENDPOINT = "/api/chat/stream" as const;
const CHAT_ENDPOINT = "/api/chat" as const;

function buildSearchParams(params: ExpensesChatRequestParams) {
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
  return search;
}

export function buildChatStreamUrl(params: ExpensesChatRequestParams) {
  const search = buildSearchParams(params);
  return `${STREAM_ENDPOINT}?${search.toString()}`;
}

export class ChatClientError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ChatClientError";
    this.code = code;
    this.status = status;
  }
}

function mergeAbortSignals(signal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs > 0) {
    timeout = setTimeout(() => {
      controller.abort(new DOMException("Request timed out", "AbortError"));
    }, timeoutMs);
  }

  const cleanup = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (signal) {
      signal.removeEventListener("abort", abortHandler);
    }
  };

  const abortHandler = (event: Event) => {
    const reason = (event.target as AbortSignal | null)?.reason ?? new DOMException("Aborted", "AbortError");
    controller.abort(reason);
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  controller.signal.addEventListener("abort", cleanup, { once: true });

  return { signal: controller.signal, cleanup };
}

async function parseChatResponse(response: Response) {
  let payload: any = null;
  try {
    payload = await response.clone().json();
  } catch {
    // ignore
  }
  const code = typeof payload?.code === "string" ? payload.code : `AI-${response.status}`;
  const message = typeof payload?.message === "string" ? payload.message : `Unexpected status: ${response.status}`;
  throw new ChatClientError(code, message, response.status);
}

export interface PostChatOptions {
  timeoutMs?: number;
  signal?: AbortSignal | null;
  retries?: number;
}

export async function postChat(body: ChatRequestBody, options: PostChatOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = Math.max(0, Math.min(options.retries ?? 1, 3));
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    const { signal, cleanup } = mergeAbortSignals(options.signal ?? null, timeoutMs);
    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      cleanup();
      if (!response.ok) {
        await parseChatResponse(response);
      }
      const payload = (await response.json()) as ExpensesChatResult;
      return payload;
    } catch (err) {
      cleanup();
      lastError = err;
      const retriable =
        err instanceof ChatClientError
          ? err.status === 429 || err.status >= 500
          : err instanceof DOMException && err.name === "AbortError";
      if (!retriable || attempt === retries) {
        throw err instanceof Error ? err : new Error("Chat request failed");
      }
      const delayMs = Math.min(1500, 300 * 2 ** attempt) + Math.random() * 120;
      await delay(delayMs);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Chat request failed");
}
