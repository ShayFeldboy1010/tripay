import { DSL, validateDSL } from "./dsl";
import { createLLM, resolveLLMConfig } from "@/src/server/llm/provider";

const SYSTEM_PROMPT = `You convert a user’s question about their expenses into a strict JSON DSL.
- Think about: intent, time range, filters (category, location, participants), grouping, and currency.
- Output ONLY JSON with keys: intent, timeRange, filters, groupBy, currency.
- Never include explanations or prose.
- If time not specified use last7d. Use device timezone semantics.
- If currency not provided, set null.`;

function hasHebrew(text: string) {
  return /[\u0590-\u05FF]/.test(text);
}

function safeJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callLLM(prompt: string): Promise<string | null> {
  const cfg = resolveLLMConfig();
  if (cfg.provider === "mock" || !cfg.apiKey) {
    return null;
  }
  try {
    const llm = createLLM(cfg);
    const res = await llm.chatCompletion({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    return res;
  } catch (err) {
    console.error("LLM error", err);
    return null;
  }
}

export async function textToDSL(text: string): Promise<DSL | null> {
  let prompt = text;
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await callLLM(prompt);
    const parsed = safeJSON(out || "");
    const valid = parsed && validateDSL(parsed);
    if (valid) return valid;
    prompt = `Please fix the JSON and respond with JSON only. Original query: ${text}`;
  }
  return fallbackParse(text);
}

function fallbackParse(text: string): DSL {
  const t = text.toLowerCase();
  let intent: DSL["intent"] = "total_spend";
  if (/(biggest|max|largest|הכי\s+גדולה|הכי\s+גדול)/.test(t)) intent = "biggest_expense";
  else if (/(top\s+categories|קטגוריות\s+עליונות|קטגוריות\s*מובילות)/.test(t)) intent = "top_categories";
  else if (/(daily\s+spend|הוצאה\s+יומית|daily)/.test(t)) intent = "daily_spend";
  else if (/(count|כמה\s+עסקאות)/.test(t)) intent = "count_transactions";
  else if (/(budget|תקציב)/.test(t)) intent = "budget_status";

  let preset: DSL["timeRange"]["preset"] = "last7d";
  if (/(last\s*30|30\s*days)/.test(t)) preset = "last30d";
  else if (/last\s*week|שבוע\s*שעבר/.test(t)) preset = "lastWeek";
  else if (/this\s*week|השבוע/.test(t)) preset = "thisWeek";
  else if (/last\s*month|חודש\s*שעבר/.test(t)) preset = "lastMonth";
  else if (/this\s*month|החודש/.test(t)) preset = "thisMonth";
  else if (/all\s*time|ever|כל\s*הזמן/.test(t)) preset = "all";

  let groupBy: DSL["groupBy"] = null;
  if (intent === "daily_spend") groupBy = "day";

  return {
    intent,
    timeRange: { preset },
    filters: {},
    groupBy,
    currency: null,
  };
}
