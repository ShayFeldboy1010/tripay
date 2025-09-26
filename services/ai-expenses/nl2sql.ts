import crypto from "crypto";
import Groq from "groq-sdk";
import { getGroqClient, getGroqModels } from "./groq";

export type Intent = "aggregation" | "lookup" | "ranking";

export interface SqlFilter {
  column: string;
  op: "=" | "!=" | ">" | "<" | ">=" | "<=" | "ILIKE";
  value: string | number;
}

export interface SqlPlan {
  intent: Intent;
  dimensions: string[];
  metrics: string[];
  filters: SqlFilter[];
  since: string;
  until: string;
  sql: string;
}

let cachedSystemPrompt: string | null = null;

function buildSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = `You are a senior SQL planner for Tripay's expenses assistant.\n\
Return JSON only, matching exactly:\n\
{\n  "intent": "aggregation" | "lookup" | "ranking",\n  "since": "YYYY-MM-DD",\n  "until": "YYYY-MM-DD",\n  "dimensions": ("category" | "merchant" | "date")[],\n  "metrics": ("sum" | "avg" | "max" | "min" | "count")[],\n  "filters": { "column": "category" | "merchant" | "currency" | "amount" | "notes", "op": "=" | "!=" | ">" | "<" | ">=" | "<=" | "ILIKE", "value": string | number }[],\n  "sql": "SELECT ... LIMIT 200"\n}\n\
Schema:\n\
expenses(id uuid, user_id uuid, date date, amount numeric(12,2), currency text, category text, merchant text, notes text, created_at timestamptz)\n\
Rules:\n- Only SELECT from expenses.\n- No joins, subqueries, CTEs, DDL, or DML.\n- Clauses allowed: SELECT, WHERE, GROUP BY, ORDER BY, LIMIT.\n- List explicit columns (no *).\n- LIMIT must be <= 500.\n- Aggregates restricted to SUM, AVG, MIN, MAX, COUNT.\n- Always include currency columns in aggregates.\n- Respect provided date windows (default to current calendar month if omitted).\n- Never convert currencies.\n- Rankings should sort descending by metric with LIMIT <= 50.\n- Respond with valid JSON only, without commentary or markdown.\n`;
  return cachedSystemPrompt;
}

async function callGroq(question: string, payload: Record<string, any>): Promise<string> {
  const client = getGroqClient();
  const { primary, fallback } = getGroqModels();

  const body = {
    messages: [
      { role: "system" as const, content: buildSystemPrompt() },
      {
        role: "user" as const,
        content: JSON.stringify({
          question,
          context: payload,
        }),
      },
    ],
    model: primary,
    temperature: 0,
    response_format: { type: "json_object" as const },
    stream: false,
  } as Groq.Chat.Completions.ChatCompletionCreateParams;

  try {
    const res = await client.chat.completions.create(body);
    const out = res.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error("empty response");
    return out;
  } catch (err) {
    if ((err as any)?.status === 404 || (err as any)?.status === 400) {
      const res = await client.chat.completions.create({ ...body, model: fallback });
      const out = res.choices?.[0]?.message?.content?.trim();
      if (!out) throw new Error("empty response from fallback");
      return out;
    }
    throw err;
  }
}

function parsePlan(raw: string): SqlPlan {
  try {
    const parsed = JSON.parse(raw) as SqlPlan;
    if (!parsed || typeof parsed !== "object") throw new Error("not object");
    if (!parsed.sql || typeof parsed.sql !== "string") throw new Error("sql missing");
    if (!parsed.since || !parsed.until) throw new Error("range missing");
    parsed.filters = Array.isArray(parsed.filters) ? parsed.filters : [];
    parsed.dimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
    parsed.metrics = Array.isArray(parsed.metrics) ? parsed.metrics : [];
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse planner output: ${(err as Error).message}`);
  }
}

export async function generateSqlPlan(
  question: string,
  payload: { since: string; until: string; timezone: string; userId: string }
): Promise<SqlPlan> {
  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < 2) {
    try {
      const reminder = attempt === 0 ? "" : "\nRemember: return valid JSON only.";
      const raw = await callGroq(question + reminder, payload);
      return parsePlan(raw);
    } catch (err) {
      lastError = err as Error;
      attempt += 1;
    }
  }
  throw lastError ?? new Error("Failed to generate SQL plan");
}

export function cacheKeyForPlan(input: { question: string; userId: string; since: string; until: string }): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export const __test__parsePlan = parsePlan;

