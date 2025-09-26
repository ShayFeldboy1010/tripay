import { NextRequest } from "next/server";
import { resolveTimeRange, toISODate } from "@/services/ai-expenses/timeRange";
import { generateSqlPlan, type SqlPlan } from "@/services/ai-expenses/nl2sql";
import { executePlan, type ExecutionResult } from "@/services/ai-expenses/sqlExecutor";
import { runHighestExpenseFallback, runTotalsFallback } from "@/services/ai-expenses/templates";
import { getGroqClient, getGroqModels } from "@/services/ai-expenses/groq";
import { verifySseToken } from "@/src/server/auth/jwt";

const encoder = new TextEncoder();

interface QueryInput {
  question: string;
  since?: string | null;
  until?: string | null;
  tz?: string | null;
  token?: string | null;
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

async function runExecution(plan: SqlPlan | null, context: { userId: string; since: string; until: string }) {
  if (!plan) {
    const execution = await runTotalsFallback(context);
    return { execution, usedFallback: true };
  }
  try {
    const execution = await executePlan(plan, { ...context });
    return { execution, usedFallback: false };
  } catch (err) {
    const text = plan.intent?.toLowerCase() || "aggregation";
    if (text.includes("ranking") || /highest|largest|biggest/i.test(text)) {
      const execution = await runHighestExpenseFallback(context);
      return { execution, usedFallback: true };
    }
    const execution = await runTotalsFallback(context);
    return { execution, usedFallback: true };
  }
}

async function handle(req: NextRequest, input: QueryInput) {
  const headers = buildHeaders(req);

  if (!input.question || !input.question.trim()) {
    return new Response(JSON.stringify({ error: "question is required" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!input.token) {
    return new Response(JSON.stringify({ error: "token required" }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  let userId: string;
  try {
    userId = await verifySseToken(input.token);
  } catch (err) {
    console.error("ai-chat: invalid token", err);
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" },
    });
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

        await send("meta", { timeRange: { since, until }, tz: timeRange.tz, userId_last4: userId.slice(-4) });

        try {
          plan = await generateSqlPlan(input.question, {
            since,
            until,
            timezone: timeRange.tz,
            userId,
          });
        } catch (err) {
          console.warn("nl2sql: failed to plan", err);
        }

        try {
          const outcome = await runExecution(plan, { userId, since, until });
          execution = outcome.execution;
          usedFallback = outcome.usedFallback;
        } catch (err) {
          console.error("ai-chat: execution failed", err);
          await send("error", { message: "Failed to execute SQL" });
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
            sql: execution.sql,
            timeRange: { since, until, tz: timeRange.tz },
            aggregates: execution.aggregates,
            rows: execution.rows.slice(0, 20),
          });
        } catch (err) {
          console.error("ai-chat: streaming failed", err);
          await send("error", { message: "Unable to generate answer" });
        } finally {
          clearInterval(pingTimer);
          controller.close();
        }
      })().catch((err) => {
        console.error("ai-chat: internal failure", err);
        clearInterval(pingTimer);
        try {
          writeEvent(controller, "error", { message: "Stream aborted" });
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
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QueryInput;
    return handle(req, body);
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...buildHeaders(req), "Content-Type": "application/json" },
    });
  }
}

