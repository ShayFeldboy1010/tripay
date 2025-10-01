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
import { verifySseToken, type VerifiedSseToken } from "@/src/server/auth/jwt";
import { AI_CHAT_AUTH_MODE, AI_CHAT_IS_ANONYMOUS } from "@/src/server/config";

const encoder = new TextEncoder();

type ErrorPayload = { code: string; message: string };

interface QueryInput {
  question: string;
  since?: string | null;
  until?: string | null;
  tz?: string | null;
  token?: string | null;
  tripId?: string | null;
  userId?: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Scope = { column: "trip_id" | "user_id"; id: string };

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

function buildHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Type, Cache-Control",
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Content-Encoding": "identity",
    Vary: "Origin",
  } as Record<string, string>;
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function streamAnswer({
  question,
  plan,
  execution,
  timeRange,
  send,
}: {
  question: string;
  plan: SqlPlan | null;
  execution: ExecutionResult;
  timeRange: { since: string; until: string; tz: string };
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
      messages: buildAnswerMessages({ question, plan, execution, timeRange }),
    });

    for await (const chunk of completion as AsyncIterable<any>) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (!delta) continue;
      answer += delta;
      await send("token", delta);
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

function buildAnswerMessages(args: {
  question: string;
  plan: SqlPlan | null;
  execution: ExecutionResult;
  timeRange: { since: string; until: string; tz: string };
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

async function runExecution(
  plan: SqlPlan | null,
  context: { scope: Scope; since: string; until: string },
  question: string
) {
  const baseContext = { scope: context.scope, since: context.since, until: context.until };
  const template = guessFallbackTemplate(question, plan);
  if (!plan) {
    const execution = await runTemplateByName(template, baseContext);
    return { execution, usedFallback: true, fallbackReason: "planner_error" as const };
  }
  try {
    const execution = await executePlan(plan, baseContext);
    return { execution, usedFallback: false, fallbackReason: null as const };
  } catch (err) {
    const execution = await runTemplateByName(template, baseContext);
    const error = err as Error & { executedSql?: string; executedParams?: any[] };
    const params = Array.isArray(error.executedParams)
      ? error.executedParams.map((value, index) => (index === 0 ? "***" : value))
      : [];
    console.error("[ai-sql] db_error", {
      message: error.message,
      sql: error.executedSql,
      params,
    });
    return { execution, usedFallback: true, fallbackReason: "db_error" as const };
  }
}

async function runTemplateByName(
  name: "highest" | "category" | "merchant" | "totals",
  context: { scope: Scope; since: string; until: string }
) {
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

async function resolveScope(req: NextRequest, input: QueryInput): Promise<Scope> {
  const headers = buildHeaders(req);
  let providedToken: VerifiedSseToken | null = null;

  const tokenQuery = input.token?.trim();
  if (tokenQuery) {
    try {
      providedToken = await verifySseToken(tokenQuery);
    } catch (err) {
      console.error("ai-chat: invalid token", err);
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

async function handle(req: NextRequest, input: QueryInput) {
  const headers = buildHeaders(req);

  if (!input.question || !input.question.trim()) {
    return errorResponse(headers, 400, "AI-400", "Question is required");
  }

  let scope: Scope;
  try {
    scope = await resolveScope(req, input);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const timeRange = resolveTimeRange({ since: input.since, until: input.until, timezone: input.tz });
  const since = toISODate(timeRange.since);
  const until = toISODate(timeRange.until);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = async (event: string, data: unknown) => {
        writeEvent(controller, event, data);
        await flush();
      };

      const pingTimer = setInterval(() => {
        try {
          writeEvent(controller, "ping", {});
        } catch (err) {
          console.warn("ai-chat: ping failed", err);
        }
      }, 15_000);

      (async () => {
        let plan: SqlPlan | null = null;
        let execution: ExecutionResult;
        let usedFallback = false;
        let fallbackReason: "planner_error" | "db_error" | null = null;

        await send("meta", { timeRange: { since, until }, tz: timeRange.tz, userId_last4: scope.id.slice(-4) });

        try {
          plan = await generateSqlPlan(input.question, {
            since,
            until,
            timezone: timeRange.tz,
            tripId: scope.column === "trip_id" ? scope.id : undefined,
            userId: scope.column === "user_id" ? scope.id : undefined,
          });
        } catch (err) {
          console.warn("nl2sql: failed to plan", err);
          await sendError(send, "AI-422", "Couldn’t understand the question. Showing best guess results.");
        }

        try {
          const outcome = await runExecution(plan, {
            since,
            until,
            scope,
          }, input.question);
          execution = outcome.execution;
          usedFallback = outcome.usedFallback;
          fallbackReason = outcome.fallbackReason;
        } catch (err) {
          console.error("ai-chat: execution failed", err);
          await sendError(send, "SQL-500", "There was a database error. We applied a safe fallback query.");
          clearInterval(pingTimer);
          controller.close();
          return;
        }

        try {
          const { answer, model } = await streamAnswer({
            question: input.question,
            plan,
            execution,
            timeRange: { since, until, tz: timeRange.tz },
            send,
          });
          await send("result", {
            answer: answer.trim(),
            model,
            provider: "groq",
            plan,
            usedFallback,
            fallbackReason,
            sql: execution.sql,
            timeRange: { since, until, tz: timeRange.tz },
            aggregates: execution.aggregates,
            rows: execution.rows.slice(0, 20),
            currencyNote: execution.aggregates.currencyNote,
          });
        } catch (err) {
          console.error("ai-chat: streaming failed", err);
          await sendError(send, "AI-502", "Unable to generate answer");
        } finally {
          clearInterval(pingTimer);
          controller.close();
        }
      })().catch((err) => {
        console.error("ai-chat: internal failure", err);
        clearInterval(pingTimer);
        try {
          writeEvent(controller, "error", { code: "AI-500", message: "Stream aborted" });
        } finally {
          controller.close();
        }
      });
    },
    cancel(reason) {
      console.warn("ai-chat: stream cancelled", reason);
    },
  });

  return new Response(stream, { status: 200, headers });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: buildHeaders(req) });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  return handle(req, {
    question: params.get("q") ?? "",
    since: params.get("since"),
    until: params.get("until"),
    tz: params.get("tz"),
    token: params.get("token"),
    tripId: params.get("tripId"),
    userId: params.get("userId"),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QueryInput;
    return handle(req, body);
  } catch {
    return errorResponse(buildHeaders(req), 400, "AI-400", "Invalid JSON body");
  }
}

function errorResponse(headers: Record<string, string>, status: number, code: string, message: string) {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function sendError(send: (event: string, data: unknown) => Promise<void> | void, code: string, message: string) {
  await send("error", { code, message } satisfies ErrorPayload);
}

