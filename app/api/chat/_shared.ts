import { NextRequest } from "next/server";
import { resolveTimeRange, toISODate } from "@/services/ai-expenses/timeRange";
import { generateSqlPlan, type SqlPlan } from "@/services/ai-expenses/nl2sql";
import { executePlan, type ExecutionResult } from "@/services/ai-expenses/sqlExecutor";
import {
  runHighestExpenseFallback,
  runTopMerchantsFallback,
  runTotalsByCategoryFallback,
  runTotalsFallback,
} from "@/services/ai-expenses/templates";
import { getGroqClient, getGroqModels } from "@/services/ai-expenses/groq";
import { verifySseToken, type VerifiedSseToken, verifyAndExtractUserId } from "@/src/server/auth/jwt";
import {
  AI_CHAT_AUTH_MODE,
  AI_CHAT_IS_ANONYMOUS,
  resolveAllowedOrigin,
} from "@/src/server/config";

const encoder = new TextEncoder();

export type Scope = { column: "trip_id" | "user_id"; id: string };

export interface ChatQuery {
  question: string;
  since?: string | null;
  until?: string | null;
  tz?: string | null;
  timezone?: string | null;
  token?: string | null;
  tripId?: string | null;
  userId?: string | null;
}

export interface ChatMetaPayload {
  timeRange: { since: string; until: string };
  tz: string;
  userId_last4: string;
}

export interface ChatComputation {
  plan: SqlPlan | null;
  execution: ExecutionResult;
  usedFallback: boolean;
  fallbackReason: "planner_error" | "db_error" | null;
}

export interface ChatTimeWindow {
  since: string;
  until: string;
  tz: string;
}

export interface ChatResultPayload {
  answer: string;
  model: string;
  provider: "groq";
  plan: SqlPlan | null;
  usedFallback: boolean;
  fallbackReason: "planner_error" | "db_error" | null;
  sql: string;
  timeRange: ChatTimeWindow;
  aggregates: ExecutionResult["aggregates"];
  rows: ExecutionResult["rows"];
  currencyNote?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildHeaders(req: NextRequest, overrides: Record<string, string> = {}) {
  const origin = resolveAllowedOrigin(req.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Type, Cache-Control",
    Vary: "Origin",
    ...overrides,
  } as Record<string, string>;
}

export function errorResponse(headers: Record<string, string>, status: number, code: string, message: string) {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function normalizeUuid(value: string | null | undefined, headers: Record<string, string>): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw errorResponse(headers, 400, "AI-400", "Invalid id format");
  }
  return trimmed;
}

function scopeFromToken(token: VerifiedSseToken | null): Scope | null {
  if (!token) return null;
  if (token.tripId && UUID_PATTERN.test(token.tripId)) {
    return { column: "trip_id", id: token.tripId };
  }
  if (token.userId && UUID_PATTERN.test(token.userId)) {
    return { column: "user_id", id: token.userId };
  }
  if (token.subject !== "guest" && UUID_PATTERN.test(token.subject)) {
    return { column: "user_id", id: token.subject };
  }
  return null;
}

export async function resolveStreamingScope(req: NextRequest, input: ChatQuery): Promise<Scope> {
  const headers = buildHeaders(req);
  let providedToken: VerifiedSseToken | null = null;

  const tokenQuery = input.token?.trim();
  if (tokenQuery) {
    try {
      providedToken = await verifySseToken(tokenQuery);
    } catch (err) {
      console.error("[ai-chat] invalid token", err);
      throw errorResponse(headers, 401, "RLS-401", "Invalid or expired token");
    }
  }

  if (AI_CHAT_AUTH_MODE === "jwt" && !providedToken) {
    throw errorResponse(headers, 401, "RLS-401", "Authentication token required");
  }

  const paramTrip = normalizeUuid(input.tripId, headers);
  const paramUser = normalizeUuid(input.userId, headers);

  if (!AI_CHAT_IS_ANONYMOUS && !providedToken && !paramTrip && !paramUser) {
    throw errorResponse(headers, 401, "RLS-401", "Authentication token required");
  }

  const tokenScope = scopeFromToken(providedToken);
  if (paramTrip) {
    return { column: "trip_id", id: paramTrip };
  }
  if (paramUser) {
    return { column: "user_id", id: paramUser };
  }
  if (tokenScope) {
    return tokenScope;
  }

  throw errorResponse(headers, 400, "AI-400", "tripId or userId required");
}

export async function resolveBodyScope(req: NextRequest, input: ChatQuery): Promise<Scope> {
  const headers = buildHeaders(req);

  if (input.token) {
    try {
      const verified = await verifySseToken(input.token.trim());
      const scope = scopeFromToken(verified);
      if (scope) return scope;
    } catch (err) {
      console.warn("[ai-chat] body token invalid", err);
      throw errorResponse(headers, 401, "RLS-401", "Invalid or expired token");
    }
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const userId = await verifyAndExtractUserId(token);
      if (UUID_PATTERN.test(userId)) {
        return { column: "user_id", id: userId };
      }
      throw new Error("User id format invalid");
    } catch (err) {
      console.error("[ai-chat] auth header invalid", err);
      throw errorResponse(headers, 401, "RLS-401", "Invalid authorization token");
    }
  }

  const paramTrip = normalizeUuid(input.tripId, headers);
  if (paramTrip) {
    return { column: "trip_id", id: paramTrip };
  }

  const paramUser = normalizeUuid(input.userId, headers);
  if (paramUser) {
    return { column: "user_id", id: paramUser };
  }

  throw errorResponse(headers, 401, "RLS-401", "Authentication token required");
}

export function resolveWindow(params: ChatQuery) {
  const window = resolveTimeRange({ since: params.since, until: params.until, timezone: params.tz ?? params.timezone });
  return {
    since: toISODate(window.since),
    until: toISODate(window.until),
    tz: window.tz,
  } satisfies ChatTimeWindow;
}

function guessFallbackTemplate(question: string, plan: SqlPlan | null): "highest" | "category" | "merchant" | "totals" {
  const text = `${plan?.intent ?? ""} ${question}`.toLowerCase();
  const rankingRegex = /(highest|largest|biggest|max|יקר|הכי)/i;
  const categoryRegex = /(category|categories|type|קטגור)/i;
  const merchantRegex = /(merchant|vendor|store|shop|ספק|חנות)/i;
  if (plan?.intent === "ranking" || rankingRegex.test(text)) return "highest";
  if (categoryRegex.test(text)) return "category";
  if (merchantRegex.test(text)) return "merchant";
  return "totals";
}

async function runTemplateByName(name: "highest" | "category" | "merchant" | "totals", context: { scope: Scope; since: string; until: string }) {
  switch (name) {
    case "highest":
      return runHighestExpenseFallback(context);
    case "category":
      return runTotalsByCategoryFallback(context);
    case "merchant":
      return runTopMerchantsFallback(context);
    default:
      return runTotalsFallback(context);
  }
}

async function runExecution(
  plan: SqlPlan | null,
  context: { scope: Scope; since: string; until: string },
  question: string,
): Promise<{ execution: ExecutionResult; usedFallback: boolean; fallbackReason: "planner_error" | "db_error" | null }> {
  const baseContext = { scope: context.scope, since: context.since, until: context.until };
  const template = guessFallbackTemplate(question, plan);
  if (!plan) {
    const execution = await runTemplateByName(template, baseContext);
    return { execution, usedFallback: true, fallbackReason: "planner_error" };
  }
  try {
    const execution = await executePlan(plan, baseContext);
    return { execution, usedFallback: false, fallbackReason: null };
  } catch (err) {
    const execution = await runTemplateByName(template, baseContext);
    const error = err as Error & { executedSql?: string; executedParams?: any[] };
    const params = Array.isArray(error.executedParams)
      ? error.executedParams.map((value, index) => (index === 0 ? "***" : value))
      : [];
    console.error("[ai-chat] db_error", {
      message: error.message,
      sql: error.executedSql,
      params,
    });
    return { execution, usedFallback: true, fallbackReason: "db_error" };
  }
}

function buildAnswerMessages(args: {
  question: string;
  plan: SqlPlan | null;
  execution: ExecutionResult;
  timeRange: ChatTimeWindow;
}) {
  const { question, plan, execution, timeRange } = args;
  const preview = execution.rows.slice(0, 20);
  return [
    {
      role: "system" as const,
      content:
        "You are Tripay's financial analyst. Answer using only the provided data. Mention currencies with each amount. " +
        "If totals include multiple currencies, list each separately. Keep the tone concise and professional.",
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        question,
        plan,
        timeRange,
        aggregates: execution.aggregates,
        topMerchants: execution.aggregates.byMerchant.slice(0, 5),
        topCategories: execution.aggregates.byCategory.slice(0, 5),
        totalsByCurrency: execution.aggregates.totalsByCurrency,
        preview,
      }),
    },
  ];
}

export async function prepareChat(question: string, scope: Scope, window: ChatTimeWindow): Promise<ChatComputation> {
  let plan: SqlPlan | null = null;
  try {
    plan = await generateSqlPlan(question, {
      since: window.since,
      until: window.until,
      timezone: window.tz,
      tripId: scope.column === "trip_id" ? scope.id : undefined,
      userId: scope.column === "user_id" ? scope.id : undefined,
    });
  } catch (err) {
    console.warn("[ai-chat] planner_failed", err);
  }

  const outcome = await runExecution(plan, { scope, since: window.since, until: window.until }, question);
  return {
    plan,
    execution: outcome.execution,
    usedFallback: outcome.usedFallback,
    fallbackReason: outcome.fallbackReason,
  } satisfies ChatComputation;
}

export async function streamGroqAnswer(args: {
  question: string;
  plan: SqlPlan | null;
  execution: ExecutionResult;
  timeRange: ChatTimeWindow;
  send: (event: string, data: unknown) => Promise<void> | void;
}) {
  const client = getGroqClient();
  const { primary, fallback } = getGroqModels();
  let answer = "";

  async function run(model: string) {
    const completion = await client.chat.completions.create({
      model,
      stream: true,
      temperature: 0.2,
      response_format: { type: "text" },
      messages: buildAnswerMessages(args),
    });

    for await (const chunk of completion as AsyncIterable<any>) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (!delta) continue;
      answer += delta;
      await args.send("token", delta);
    }
    return model;
  }

  try {
    const model = await run(primary);
    return { answer, model };
  } catch (err) {
    if ((err as any)?.status === 404 || (err as any)?.status === 400) {
      const model = await run(fallback);
      return { answer, model };
    }
    throw err;
  }
}

export async function collectGroqAnswer(args: {
  question: string;
  plan: SqlPlan | null;
  execution: ExecutionResult;
  timeRange: ChatTimeWindow;
}) {
  let finalAnswer = "";
  const { answer, model } = await streamGroqAnswer({
    ...args,
    send: async (_event, data) => {
      if (typeof data === "string") {
        finalAnswer += data;
      }
    },
  });
  return { answer: finalAnswer || answer, model };
}

export function buildMeta(scope: Scope, window: ChatTimeWindow): ChatMetaPayload {
  return {
    timeRange: { since: window.since, until: window.until },
    tz: window.tz,
    userId_last4: scope.id.slice(-4),
  } satisfies ChatMetaPayload;
}

export function buildResultPayload(args: {
  answer: string;
  model: string;
  plan: SqlPlan | null;
  computation: ChatComputation;
  window: ChatTimeWindow;
}) {
  return {
    answer: args.answer.trim(),
    model: args.model,
    provider: "groq" as const,
    plan: args.plan,
    usedFallback: args.computation.usedFallback,
    fallbackReason: args.computation.fallbackReason,
    sql: args.computation.execution.sql,
    timeRange: args.window,
    aggregates: args.computation.execution.aggregates,
    rows: args.computation.execution.rows.slice(0, 20),
    currencyNote: args.computation.execution.aggregates.currencyNote,
  } satisfies ChatResultPayload;
}

export async function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
}

export async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
