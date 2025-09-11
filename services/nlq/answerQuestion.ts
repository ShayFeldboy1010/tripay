import type { Expense } from "@/lib/supabase/client";
import { textToDSL } from "./llm";
import type { DSL, Answer } from "./dsl";
import { executeStructuredQuery } from "../expenses/query";
import { format } from "date-fns";
import { enUS, he } from "date-fns/locale";

function detectLang(text: string) {
  return /[\u0590-\u05FF]/.test(text) ? "he" : "en";
}

function fmtCurrency(n: number, currency: string, lang: string) {
  const locale = lang === "he" ? "he-IL" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
}

export async function answerQuestion(
  text: string,
  opts: { baseCurrency?: string; expenses?: Expense[]; useGroq?: boolean } = {}
): Promise<Answer> {
  const normalized = text.trim();
  const lang = detectLang(normalized);
  let dsl: DSL | null = await textToDSL(normalized, { useGroq: opts.useGroq });
  if (!dsl) {
    dsl = {
      intent: "total_spend",
      timeRange: { preset: "last7d" },
      filters: {},
      groupBy: null,
      currency: opts.baseCurrency ?? null,
    };
  }
  if (!dsl.currency) dsl.currency = opts.baseCurrency ?? null;

  const { result, warnings } = executeStructuredQuery(dsl, opts.expenses || []);
  const currency = dsl.currency || opts.baseCurrency || "ILS";

  function fmtDate(str: string) {
    const d = new Date(str);
    const locale = lang === "he" ? he : enUS;
    return format(d, lang === "he" ? "d MMM" : "MMM d", { locale });
  }

  let textOut = "";
  const details: any = result;
  switch (result.intent) {
    case "total_spend":
      if (result.total === 0) {
        textOut = lang === "he" ? "לא נמצאו נתונים בטווח המבוקש." : "No data in range.";
      } else {
        textOut =
          lang === "he"
            ? `סה\"כ הוצאות: ${fmtCurrency(result.total, currency, lang)}`
            : `Total spend: ${fmtCurrency(result.total, currency, lang)}`;
      }
      break;
    case "biggest_expense":
      if (!result.item) {
        textOut = lang === "he" ? "לא נמצאו נתונים בטווח המבוקש." : "No data in range.";
      } else {
        textOut =
          lang === "he"
            ? `ההוצאה הכי גדולה: ${fmtCurrency(result.item.amount, currency, lang)} — '${result.item.title}' (${fmtDate(result.item.date || result.item.created_at)})`
            : `Biggest expense: ${fmtCurrency(result.item.amount, currency, lang)} — '${result.item.title}' (${fmtDate(result.item.date || result.item.created_at)})`;
      }
      break;
    case "top_categories":
      if (!result.categories || result.categories.length === 0) {
        textOut = lang === "he" ? "לא נמצאו נתונים בטווח המבוקש." : "No data in range.";
      } else {
        textOut =
          lang === "he"
            ? "קטגוריות מובילות:"
            : "Top categories:";
      }
      break;
    case "daily_spend":
      if (!result.days || result.days.length === 0) {
        textOut = lang === "he" ? "לא נמצאו נתונים בטווח המבוקש." : "No data in range.";
      } else {
        textOut = lang === "he" ? "הוצאה יומית:" : "Daily spend:";
      }
      break;
    case "count_transactions":
      textOut =
        lang === "he"
          ? `מספר עסקאות: ${result.count}`
          : `Transactions count: ${result.count}`;
      break;
    case "budget_status":
      textOut = lang === "he" ? "אין תקציב מוגדר." : "No budget set.";
      break;
    default:
      textOut = lang === "he" ? "לא הבנתי." : "Could not understand.";
  }

  return { text: textOut, details, warnings };
}
