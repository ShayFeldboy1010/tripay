import crypto from "crypto";
import OpenAI from "openai";
import { getOpenAIClient, getOpenAIModels } from "./openai";
import { ALLOWED_AGG, ALLOWED_CLAUSES, EXPENSES_COLUMNS, EXPENSES_TABLE, MAX_LIMIT } from "./schema";

export type Intent = "aggregation" | "lookup" | "ranking";

export interface SqlFilter {
  column: keyof typeof EXPENSES_COLUMNS;
  op: "=" | "!=" | ">" | "<" | ">=" | "<=" | "ILIKE";
  value: string | number;
}

export interface SqlOrder {
  by: string;
  dir: "ASC" | "DESC";
}

export interface SqlPlan {
  intent: Intent;
  dimensions: string[];
  metrics: string[];
  filters: SqlFilter[];
  since: string;
  until: string;
  order: SqlOrder[];
  limit: number;
  sql: string;
}

const HEBREW_PATTERN = /[\u0590-\u05FF]/;

let cachedSystemPrompt: string | null = null;

const DIMENSIONS = ["category", "merchant", "date"] as const;
const METRICS = ["sum", "avg", "max", "min", "count"] as const;
const FILTER_COLUMNS = ["category", "merchant", "currency", "amount", "notes"] as const;
const DIMENSION_UNION = DIMENSIONS.map((item) => `"${item}"`).join(" | ");
const METRIC_UNION = METRICS.map((item) => `"${item}"`).join(" | ");
const FILTER_UNION = FILTER_COLUMNS.map((item) => `"${item}"`).join(" | ");

function buildSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const schemaLines = Object.entries(EXPENSES_COLUMNS)
    .map(([name, type]) => `${name} ${type}`)
    .join(", ");
  cachedSystemPrompt = `You are a senior SQL planner for Tripay's expenses assistant.\n` +
    `Return JSON only, matching exactly:\n` +
    `{\n  "intent": "aggregation" | "lookup" | "ranking",\n  "since": "YYYY-MM-DD",\n  "until": "YYYY-MM-DD",\n  "dimensions": (${DIMENSION_UNION})[],\n  "metrics": (${METRIC_UNION})[],\n  "filters": { "column": ${FILTER_UNION}, "op": "=" | "!=" | ">" | "<" | ">=" | "<=" | "ILIKE", "value": string | number }[],\n  "order": { "by": string, "dir": "ASC" | "DESC" }[],\n  "limit": number,\n  "sql": "SELECT ... FROM ${EXPENSES_TABLE} ... LIMIT <= ${MAX_LIMIT}"\n}\n` +
    `Schema:${EXPENSES_TABLE}(${schemaLines})\n` +
    `Rules:\n` +
    `- Only SELECT from ${EXPENSES_TABLE}.\n` +
    `- Clauses allowed: ${Array.from(ALLOWED_CLAUSES).join(", ")}.\n` +
    `- List explicit columns (no *).\n` +
    `- LIMIT must be <= ${MAX_LIMIT}.\n` +
    `- Aggregates restricted to ${Array.from(ALLOWED_AGG).join(", ")}.\n` +
    `- Always include currency columns in aggregates and groupings.\n` +
    `- Never convert or sum across currencies without grouping by currency.\n` +
    `- Respect provided date windows (default to current calendar month if omitted).\n` +
    `- Respond with valid JSON only, without commentary or markdown.\n`;
  return cachedSystemPrompt;
}

async function callOpenAI(question: string, payload: Record<string, any>): Promise<string> {
  const client = getOpenAIClient();
  const { primary, fallback } = getOpenAIModels();

  const baseRequest: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: JSON.stringify({ question, context: payload }),
      },
    ],
    model: primary,
    temperature: 0,
    response_format: { type: "json_object" },
    stream: false,
  };

  try {
    const res = await client.chat.completions.create(baseRequest);
    const out = res.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error("empty response");
    return out;
  } catch (err) {
    if ((err as any)?.status === 404 || (err as any)?.status === 400) {
      const res = await client.chat.completions.create({ ...baseRequest, model: fallback });
      const out = res.choices?.[0]?.message?.content?.trim();
      if (!out) throw new Error("empty response from fallback");
      return out;
    }
    throw err;
  }
}

async function translateToEnglish(question: string): Promise<string | null> {
  try {
    const client = getOpenAIClient();
    const { primary, fallback } = getOpenAIModels();
    const baseRequest: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      messages: [
        { role: "system", content: "Translate to English for SQL planning. Respond with English text only." },
        { role: "user", content: question },
      ],
      model: primary,
      temperature: 0,
      stream: false,
      response_format: { type: "text" },
    };
    try {
      const res = await client.chat.completions.create(baseRequest);
      return res.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      if ((err as any)?.status === 404 || (err as any)?.status === 400) {
        const res = await client.chat.completions.create({ ...baseRequest, model: fallback });
        return res.choices?.[0]?.message?.content?.trim() || null;
      }
      throw err;
    }
  } catch (err) {
    console.warn("nl2sql: translation failed", err);
    return null;
  }
}

function normalizeArray<T>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => allowed.includes(item as T));
}

function parsePlan(raw: string): SqlPlan {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse planner output: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Planner response must be an object");
  }
  if (typeof parsed.intent !== "string") throw new Error("intent missing");
  if (typeof parsed.since !== "string" || typeof parsed.until !== "string") {
    throw new Error("date range missing");
  }
  if (typeof parsed.sql !== "string" || !parsed.sql.trim().toLowerCase().startsWith("select")) {
    throw new Error("sql missing or invalid");
  }
  const dimensions = normalizeArray(parsed.dimensions, DIMENSIONS as readonly string[]);
  const metrics = normalizeArray(parsed.metrics, METRICS as readonly string[]);
  const filters = Array.isArray(parsed.filters)
    ? parsed.filters
        .map((filter: any) => {
          if (!filter || typeof filter !== "object") return null;
          if (!FILTER_COLUMNS.includes(filter.column)) return null;
          if (!["=", "!=", ">", "<", ">=", "<=", "ILIKE"].includes(filter.op)) return null;
          if (typeof filter.value !== "string" && typeof filter.value !== "number") return null;
          return filter as SqlFilter;
        })
        .filter(Boolean)
    : [];
  const order = Array.isArray(parsed.order)
    ? parsed.order
        .map((item: any) => {
          if (!item || typeof item !== "object") return null;
          const dir = typeof item.dir === "string" ? item.dir.toUpperCase() : "";
          if (dir !== "ASC" && dir !== "DESC") return null;
          if (typeof item.by !== "string" || !item.by.trim()) return null;
          return { by: item.by, dir: dir as "ASC" | "DESC" };
        })
        .filter(Boolean)
    : [];
  let limit = Number.isFinite(parsed.limit) ? Number(parsed.limit) : 200;
  if (!Number.isFinite(limit) || limit <= 0) limit = 200;
  limit = Math.min(limit, MAX_LIMIT);

  return {
    intent: parsed.intent as Intent,
    dimensions,
    metrics,
    filters: filters as SqlFilter[],
    since: parsed.since,
    until: parsed.until,
    order: order as SqlOrder[],
    limit,
    sql: parsed.sql,
  };
}

export async function generateSqlPlan(
  question: string,
  payload: { since: string; until: string; timezone: string; userId?: string; tripId?: string }
): Promise<SqlPlan> {
  const shouldTranslate = HEBREW_PATTERN.test(question);
  const translated = shouldTranslate ? await translateToEnglish(question) : null;
  const planningQuestion = translated?.length ? translated : question;

  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < 2) {
    try {
      const reminder = attempt === 0 ? "" : "\nRemember: return valid JSON only.";
      const raw = await callOpenAI(planningQuestion + reminder, {
        ...payload,
        originalQuestion: question,
        translated: translated ?? null,
      });
      const plan = parsePlan(raw);
      return plan;
    } catch (err) {
      lastError = err as Error;
      attempt += 1;
    }
  }
  throw lastError ?? new Error("Failed to generate SQL plan");
}

export function cacheKeyForPlan(input: {
  question: string;
  since: string;
  until: string;
  userId?: string;
  tripId?: string;
}): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export const __test__parsePlan = parsePlan;
