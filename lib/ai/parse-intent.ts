import { AIQuery } from "./schema";
import { resolveCategoryTokens } from "./catalog";
import { parseDateRange } from "./parse-date-range";

export function parseAIQuery(text: string): AIQuery {
  const lower = text.toLowerCase();
  const categories = resolveCategoryTokens(lower);
  const dateRange = parseDateRange(lower);
  const dateRangeOpt = dateRange.kind === "all" ? undefined : dateRange;

  const comparePattern = /(compare|higher|more|יותר).*?(?:and|or|או)/;
  const hebComparePattern = /על מה הוצאתי יותר.*?או/;
  if ((comparePattern.test(lower) || hebComparePattern.test(lower)) && categories.length >= 2) {
    return { kind: "CompareCategories", categories: categories.slice(0, 2), dateRange: dateRangeOpt };
  }

  if (/top categories|קטגוריות מובילות|קטגוריות הכי/i.test(lower)) {
    const limitMatch = lower.match(/top\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;
    return { kind: "TopCategories", limit, dateRange: dateRangeOpt };
  }

  if (/daily spend|spend by day|הוצאות יומיות|יומי/i.test(lower)) {
    return { kind: "SpendByDay", dateRange: dateRangeOpt };
  }

  if (/budget status|מצב תקציב|תקציב/i.test(lower)) {
    return { kind: "BudgetStatus", dateRange: dateRangeOpt };
  }

  if (categories.length >= 1) {
    return { kind: "TotalByCategory", category: categories[0], dateRange: dateRangeOpt };
  }

  return { kind: "TopCategories", dateRange: dateRangeOpt };
}
