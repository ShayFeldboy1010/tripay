import type { Expense, Trip } from "@/lib/supabase/client";
import { AIAnswer, AIQuery, DateRange, AIFact } from "./schema";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function getDateBounds(range: DateRange, now: Date): { start: string; end: string } | null {
  const start = new Date(now);
  const end = new Date(now);

  switch (range.kind) {
    case "between":
      return { start: range.start, end: range.end };
    case "relative":
      switch (range.preset) {
        case "today":
          return { start: format(start), end: format(end) };
        case "yesterday":
          start.setDate(start.getDate() - 1);
          end.setDate(end.getDate() - 1);
          return { start: format(start), end: format(end) };
        case "this_week":
          const day = start.getDay();
          const diff = (day + 6) % 7; // Monday as start
          start.setDate(start.getDate() - diff);
          end.setDate(start.getDate() + 6);
          return { start: format(start), end: format(end) };
        case "last_week":
          const day2 = start.getDay();
          const diff2 = (day2 + 6) % 7;
          end.setDate(start.getDate() - diff2 - 1);
          start.setDate(end.getDate() - 6);
          return { start: format(start), end: format(end) };
        case "this_month":
          start.setDate(1);
          end.setMonth(start.getMonth() + 1, 0);
          return { start: format(start), end: format(end) };
        case "last_month":
          start.setMonth(start.getMonth() - 1, 1);
          end.setMonth(start.getMonth() + 1, 0);
          return { start: format(start), end: format(end) };
      }
  }
  return null;
}

function format(date: Date) {
  return date.toISOString().slice(0, 10);
}

function filterByDate(expenses: Expense[], range?: DateRange, now = new Date()) {
  if (!range) return expenses;
  const bounds = getDateBounds(range, now);
  if (!bounds) return expenses;
  return expenses.filter((e) => e.date >= bounds.start && e.date <= bounds.end);
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  Accommodation: ["Accommodation", "Sleep"],
  Transportation: ["Transportation"],
  Food: ["Food"],
  Other: ["Other"],
};

function sumByCategory(expenses: Expense[]) {
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  }
  return totals;
}

export function executeAIQuery(q: AIQuery, data: { expenses: Expense[]; trip: Trip }): AIAnswer {
  const { expenses, trip } = data;
  const now = new Date();
  const currency = trip.base_currency || "ILS";
  const filtered = filterByDate(expenses, q.dateRange, now);

  const totals = sumByCategory(filtered);
  const fmt = (n: number) => formatCurrency(n, currency);

  const facts: AIFact[] = [];
  let text = "";

  switch (q.kind) {
    case "CompareCategories": {
      const catTotals = q.categories.map((c) => {
        const aliases = CATEGORY_ALIASES[c] || [c];
        const sum = aliases.reduce((s, a) => s + (totals[a] || 0), 0);
        facts.push({ label: c, value: fmt(sum) });
        return { c, sum };
      });
      if (catTotals.length >= 2) {
        const [a, b] = catTotals;
        text = a.sum === b.sum ? `Spent equally on ${a.c} and ${b.c}` : a.sum > b.sum ? `${a.c} is higher than ${b.c}` : `${b.c} is higher than ${a.c}`;
      }
      break;
    }
    case "TotalByCategory": {
      if (q.category) {
        const aliases = CATEGORY_ALIASES[q.category] || [q.category];
        const sum = aliases.reduce((s, a) => s + (totals[a] || 0), 0);
        facts.push({ label: q.category, value: fmt(sum) });
        text = `Spent ${fmt(sum)} on ${q.category}`;
      } else {
        const sum = filtered.reduce((s, e) => s + e.amount, 0);
        facts.push({ label: "Total", value: fmt(sum) });
        text = `Total spend ${fmt(sum)}`;
      }
      break;
    }
    case "TopCategories": {
      const entries = Object.entries(totals)
        .map(([k, v]) => ({ k, v }))
        .sort((a, b) => b.v - a.v);
      const limit = q.limit ?? 3;
      for (const { k, v } of entries.slice(0, limit)) {
        facts.push({ label: k, value: fmt(v) });
      }
      text = `Top categories`;
      break;
    }
    case "SpendByDay": {
      const byDay: Record<string, number> = {};
      for (const e of filtered) {
        byDay[e.date] = (byDay[e.date] || 0) + e.amount;
      }
      const days = Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1));
      for (const [day, v] of days) {
        facts.push({ label: day, value: fmt(v) });
      }
      text = `Daily spend`; // could include range
      break;
    }
    case "BudgetStatus": {
      if (!trip.total_budget) {
        text = "No budget configured";
        break;
      }
      const spent = filtered.reduce((s, e) => s + e.amount, 0);
      const remaining = trip.total_budget - spent;
      facts.push({ label: "Budget", value: fmt(trip.total_budget) });
      facts.push({ label: "Spent", value: fmt(spent) });
      facts.push({ label: "Remaining", value: fmt(remaining) });
      text = remaining >= 0 ? `Remaining ${fmt(remaining)}` : `Over budget by ${fmt(Math.abs(remaining))}`;
      break;
    }
  }

  return { text, facts, plan: q };
}
