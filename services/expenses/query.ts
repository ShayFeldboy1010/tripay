import { parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import type { Expense } from "@/lib/supabase/client";
import type { DSL } from "../nlq/dsl";

export function filterByTimeRange(store: Expense[], start: Date, end: Date): Expense[] {
  return store.filter((e) => {
    const d = parseISO(e.date || e.created_at);
    return d >= start && d <= end;
  });
}

export function applyFilters(
  store: Expense[],
  filters: { category?: string[]; location?: string[]; participants?: string[] }
): Expense[] {
  return store.filter((e) => {
    if (filters.category && filters.category.length && !filters.category.includes(e.category)) return false;
    if (filters.location && filters.location.length && e.location && !filters.location.includes(e.location)) return false;
    if (
      filters.participants &&
      filters.participants.length &&
      (!e.payers || !filters.participants.some((p) => e.payers.includes(p)))
    )
      return false;
    return true;
  });
}

function resolveRange(tr: DSL["timeRange"], now = new Date()): { start: Date; end: Date } {
  if (tr.start && tr.end) return { start: parseISO(tr.start), end: parseISO(tr.end) };
  switch (tr.preset) {
    case "last30d":
      return { start: subDays(now, 30), end: now };
    case "thisMonth":
      return { start: startOfMonth(now), end: now };
    case "lastMonth":
      const lastM = subMonths(now, 1);
      return { start: startOfMonth(lastM), end: endOfMonth(lastM) };
    case "thisWeek":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
    case "lastWeek":
      const lastW = subWeeks(now, 1);
      return { start: startOfWeek(lastW, { weekStartsOn: 1 }), end: endOfWeek(lastW, { weekStartsOn: 1 }) };
    case "all":
      return { start: new Date(0), end: now };
    case "last7d":
    default:
      return { start: subDays(now, 7), end: now };
  }
}

function convert(amount: number, from: string | undefined, to: string | undefined, warnings: string[]): number {
  if (!from || !to || from === to) return amount;
  warnings.push(`No FX rates for ${from}->${to}; assuming 1:1`);
  return amount;
}

export function executeStructuredQuery(q: DSL, store: Expense[]): { result: any; warnings: string[] } {
  const warnings: string[] = [];
  const { start, end } = resolveRange(q.timeRange);
  let data = filterByTimeRange(store, start, end);
  if (q.filters) data = applyFilters(data, q.filters);
  const currency = q.currency || "ILS";

  switch (q.intent) {
    case "total_spend": {
      const total = data.reduce((sum, e) => sum + convert(e.amount, (e as any).currency, currency, warnings), 0);
      return { result: { intent: q.intent, total }, warnings };
    }
    case "biggest_expense": {
      if (data.length === 0) return { result: { intent: q.intent, item: null }, warnings };
      const item = data.reduce((max, e) =>
        convert(e.amount, (e as any).currency, currency, warnings) >
        convert(max.amount, (max as any).currency, currency, warnings)
          ? e
          : max
      );
      return { result: { intent: q.intent, item }, warnings };
    }
    case "top_categories": {
      const map: Record<string, number> = {};
      data.forEach((e) => {
        const key = e.category || "Unknown";
        map[key] = (map[key] || 0) + convert(e.amount, (e as any).currency, currency, warnings);
      });
      const categories = Object.entries(map)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      return { result: { intent: q.intent, categories }, warnings };
    }
    case "daily_spend": {
      const map: Record<string, number> = {};
      data.forEach((e) => {
        const day = (e.date || e.created_at).slice(0, 10);
        map[day] = (map[day] || 0) + convert(e.amount, (e as any).currency, currency, warnings);
      });
      const days = Object.entries(map)
        .map(([day, total]) => ({ day, total }))
        .sort((a, b) => (a.day < b.day ? -1 : 1));
      return { result: { intent: q.intent, days }, warnings };
    }
    case "count_transactions": {
      return { result: { intent: q.intent, count: data.length }, warnings };
    }
    case "budget_status": {
      return { result: { intent: q.intent, status: "no_budget" }, warnings };
    }
    default:
      return { result: { intent: q.intent }, warnings };
  }
}
