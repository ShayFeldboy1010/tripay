import { NextRequest } from "next/server";
import { resolveTimeRange, toISODate } from "@/services/ai-expenses/timeRange";
import { generateSqlPlan, type SqlPlan } from "@/services/ai-expenses/nl2sql";
import { executePlan, type ExecutionResult } from "@/services/ai-expenses/sqlExecutor";
import { runHighestExpenseFallback, runTotalsFallback } from "@/services/ai-expenses/templates";
import { verifyAndExtractUserId } from "@/src/server/auth/jwt";
import { getGroqClient, getGroqModels } from "@/services/ai-expenses/groq";

const encoder = new TextEncoder();

interface RequestBody {
  question: string;
  since?: string | null;
  until?: string | null;
  timezone?: string | null;
  userId?: string | null;
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
}

async function resolveUserId(req: NextRequest, body: RequestBody): Promise<string> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return verifyAndExtractUserId(token);
  }
  if (body.userId) return body.userId;
  throw new Response("Unauthorized", { status: 401 });
}

async function runExecution(
  plan: SqlPlan | null,
  context: { userId: string; since: string; until: string }
): Promise<{ execution: ExecutionResult; usedFallback: boolean }> {
  if (!plan) {
    const execution = await runTotalsFallback({ ...context });
    return { execution, usedFallback: true };
  }
  try {
    const execution = await executePlan(plan, { ...context });
    return { execution, usedFallback: false };
  } catch (err) {
    const text = plan.intent?.toLowerCase() || "aggregation";
    if (text.includes("ranking") || /highest|largest|biggest/i.test(text)) {
      const execution = await runHighestExpenseFallback({ ...context });
      return { execution, usedFallback: true };
    }
    const execution = await runTotalsFallback({ ...context });
    return { execution, usedFallback: true };
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

async function streamAnswer(
  controller: ReadableStreamDefaultController<Uint8Array>,
  question: string,
  plan: SqlPlan | null,
  execution: ExecutionResult,
  timeRange: { since: string; until: string; tz: string }
): Promise<{ answer: string; model: string }> {
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
      writeEvent(controller, "token", delta);
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

async function handleRequest(req: NextRequest, body: RequestBody) {
  if (!body.question || !body.question.trim()) {
    return new Response("Question is required", { status: 400 });
  }

  let userId: string;
  try {
    userId = await resolveUserId(req, body);
  } catch (err) {
    if (err instanceof Response) return err;
    return new Response("Unauthorized", { status: 401 });
  }

  const timeRange = resolveTimeRange({ since: body.since, until: body.until, timezone: body.timezone });
  const since = toISODate(timeRange.since);
  const until = toISODate(timeRange.until);

  let plan: SqlPlan | null = null;
  try {
    plan = await generateSqlPlan(body.question, {
      since,
      until,
      timezone: timeRange.tz,
      userId,
    });
  } catch (err) {
    console.warn("nl2sql: failed to plan", err);
  }

  let execution: ExecutionResult;
  let usedFallback = false;
  try {
    const outcome = await runExecution(plan, { userId, since, until });
    execution = outcome.execution;
    usedFallback = outcome.usedFallback;
  } catch (err) {
    console.error("ai-chat: execution failed", err);
    return new Response("Failed to execute query", { status: 500 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { answer, model } = await streamAnswer(controller, body.question, plan, execution, {
          since,
          until,
          tz: timeRange.tz,
        });
        writeEvent(controller, "result", JSON.stringify({
          answer: answer.trim(),
          model,
          provider: "groq",
          plan,
          usedFallback,
          sql: execution.sql,
          timeRange: { since, until, tz: timeRange.tz },
          aggregates: execution.aggregates,
          rows: execution.rows.slice(0, 20),
        }));
      } catch (err) {
        console.error("ai-chat: streaming failed", err);
        writeEvent(controller, "error", JSON.stringify({ message: "Unable to generate answer" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    return handleRequest(req, body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const body: RequestBody = {
    question: params.get("question") ?? "",
    since: params.get("since"),
    until: params.get("until"),
    timezone: params.get("timezone"),
    userId: params.get("userId"),
  };
  return handleRequest(req, body);
}

