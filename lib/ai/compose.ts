import type { AIQuery, AIAnswer, DateRange } from "./schema";

function parseCurrencyValue(value: string): number {
  const num = Number(value.replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? 0 : num;
}

function rangeText(range?: DateRange): string {
  if (!range || range.kind === "all") return "";
  if (range.kind === "between") {
    return `בין ${range.start} ל-${range.end}`;
  }
  const map: Record<DateRange["preset"], string> = {
    today: "היום",
    yesterday: "אתמול",
    this_week: "השבוע",
    last_week: "שבוע שעבר",
    this_month: "החודש",
    last_month: "חודש שעבר",
  } as const;
  return map[range.preset] || "";
}

export function composeAnswer(
  q: AIQuery,
  ans: AIAnswer,
  opts?: { currency?: string; locale?: string }
): string {
  const currency = opts?.currency ?? "ILS";
  const locale = opts?.locale ?? "he-IL";
  const fmt = (n: number) => `<span dir="ltr">${
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
  }</span>`;

  const range = rangeText((q as any).dateRange);
  const rangePart = range ? ` ${range}` : "";

  switch (q.kind) {
    case "CompareCategories": {
      const [a, b] = ans.facts;
      const aVal = parseCurrencyValue(a.value);
      const bVal = parseCurrencyValue(b.value);
      const [catA, valA, catB, valB] =
        aVal >= bVal ? [a.label, aVal, b.label, bVal] : [b.label, bVal, a.label, aVal];
      const delta = Math.abs(valA - valB);
      return `הוצאת יותר על ${catA} (${fmt(valA)}) מאשר ${catB} (${fmt(valB)})${rangePart}. הפרש: ${fmt(delta)}.`;
    }
    case "TotalByCategory": {
      const amountFact = ans.facts.find((f) => f.label !== "count");
      const count = parseInt(ans.facts.find((f) => f.label === "count")?.value || "0", 10);
      const amount = parseCurrencyValue(amountFact?.value || "0");
      const category = q.category || "הכול";
      return `בסך הכול ${fmt(amount)} על ${category}${rangePart} (${count} הוצאות).`;
    }
    case "TopCategories": {
      const list = ans.facts.map((f) => `${f.label} (${f.value})`).join(", ");
      return `הקטגוריות המובילות${rangePart}: ${list}.`;
    }
    case "SpendByDay": {
      const values = ans.facts.map((f) => parseCurrencyValue(f.value));
      const sum = values.reduce((s, n) => s + n, 0);
      const days = ans.facts.length;
      let maxIdx = 0;
      values.forEach((v, i) => {
        if (v > values[maxIdx]) maxIdx = i;
      });
      const maxDate = ans.facts[maxIdx]?.label || "";
      const maxVal = values[maxIdx] || 0;
      const avg = days ? sum / days : 0;
      return `בחודש הנוכחי הוצאת ${fmt(sum)} על פני ${days} ימים; היום הגבוה: ${maxDate} (${fmt(maxVal)}). ממוצע יומי: ${fmt(avg)}.`;
    }
    case "BudgetStatus": {
      const target = parseCurrencyValue(ans.facts.find((f) => f.label === "target")?.value || "0");
      const today = parseCurrencyValue(ans.facts.find((f) => f.label === "today")?.value || "0");
      const left = parseCurrencyValue(ans.facts.find((f) => f.label === "left")?.value || "0");
      const state = ans.facts.find((f) => f.label === "state")?.value || "";
      return `היעד היומי: ${fmt(target)}; הוצאת היום: ${fmt(today)}; נותר: ${fmt(left)}. מצב: ${state}.`;
    }
  }
  return ans.text;
}

