import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { answerQuestion } from "@/services/nlq/answerQuestion";
import type { Expense } from "@/lib/supabase/client";

const baseExpense: Omit<Expense, "id" | "created_at" | "updated_at"> = {
  trip_id: "trip-1",
  title: "",
  amount: 0,
  category: "Food",
  location_id: "loc-1",
  payers: [],
  date: "2024-01-01",
  is_shared_payment: false,
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const expenses: Expense[] = [
  { id: "1", ...baseExpense, title: "Osaka Hotel", amount: 855, category: "Accommodation", date: isoDaysAgo(1) },
  { id: "2", ...baseExpense, title: "Sushi", amount: 120, category: "Food", date: isoDaysAgo(2) },
  { id: "3", ...baseExpense, title: "Metro", amount: 45, category: "Transportation", date: isoDaysAgo(2) },
  { id: "4", ...baseExpense, title: "Breakfast", amount: 35, category: "Food", date: isoDaysAgo(3) },
].map((expense) => ({ ...expense, created_at: expense.date, updated_at: expense.date }));

describe("answerQuestion", () => {
  const originalProvider = process.env.LLM_PROVIDER;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.LLM_PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }

    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  it("formats biggest expense with converted amount", async () => {
    const answer = await answerQuestion("What is my biggest expense?", {
      baseCurrency: "USD",
      expenses,
    });

    expect(answer.text).toContain("Biggest expense:");
    expect(answer.text).toContain("$855.00");
    expect(answer.text).toContain("Osaka Hotel");
  });

  it("lists top categories as separate lines", async () => {
    const answer = await answerQuestion("Show me the top categories", {
      baseCurrency: "USD",
      expenses,
    });

    const lines = answer.text.split("\n");
    expect(lines[0]).toBe("Top categories:");
    expect(lines).toContain("• Food: $155.00");
    expect(lines).toContain("• Accommodation: $855.00");
  });

  it("lists daily spend per day", async () => {
    const answer = await answerQuestion("Show my daily spend", {
      baseCurrency: "USD",
      expenses,
    });

    const lines = answer.text.split("\n");
    expect(lines[0]).toBe("Daily spend:");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.slice(1).every((line) => line.startsWith("• "))).toBe(true);
    expect(lines.some((line) => /\$\d/.test(line))).toBe(true);
  });
});
