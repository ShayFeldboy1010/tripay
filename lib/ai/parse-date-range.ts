import { DateRange } from "./schema";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseDateRange(text: string, now = new Date()): DateRange {
  const lower = text.toLowerCase();

  if (/(today|היום)/i.test(lower)) {
    return { kind: "relative", preset: "today" };
  }
  if (/(yesterday|אתמול)/i.test(lower)) {
    return { kind: "relative", preset: "yesterday" };
  }
  if (/(this week|השבוע)/i.test(lower)) {
    return { kind: "relative", preset: "this_week" };
  }
  if (/(last week|שבוע שעבר)/i.test(lower)) {
    return { kind: "relative", preset: "last_week" };
  }
  if (/(this month|החודש)/i.test(lower)) {
    return { kind: "relative", preset: "this_month" };
  }
  if (/(last month|חודש שעבר)/i.test(lower)) {
    return { kind: "relative", preset: "last_month" };
  }

  const sinceMatch = lower.match(/(?:since|מאז)\s+(\d{4}-\d{2}-\d{2})/);
  if (sinceMatch) {
    return { kind: "between", start: sinceMatch[1], end: formatDate(now) };
  }

  const betweenMatch = lower.match(/(?:from|מ)\s*(\d{4}-\d{2}-\d{2})\s*(?:to|עד)\s*(\d{4}-\d{2}-\d{2})/);
  if (betweenMatch) {
    return { kind: "between", start: betweenMatch[1], end: betweenMatch[2] };
  }

  return { kind: "all" };
}
