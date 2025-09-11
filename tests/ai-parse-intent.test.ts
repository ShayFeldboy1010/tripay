import { describe, it, expect } from "vitest";
import { parseAIQuery } from "@/lib/ai/parse-intent";

describe("parseAIQuery", () => {
  it("handles English compare query", () => {
    const q = parseAIQuery("Which is higher: hotels or transportation this month?");
    expect(q).toEqual({
      kind: "CompareCategories",
      categories: ["Accommodation", "Transportation"],
      dateRange: { kind: "relative", preset: "this_month" },
    });
  });

  it("handles Hebrew total query", () => {
    const q = parseAIQuery("כמה הוצאתי על אוכל אתמול?");
    expect(q).toEqual({
      kind: "TotalByCategory",
      category: "Food",
      dateRange: { kind: "relative", preset: "yesterday" },
    });
  });

  it("handles top categories", () => {
    const q = parseAIQuery("Top categories last week");
    expect(q).toEqual({
      kind: "TopCategories",
      dateRange: { kind: "relative", preset: "last_week" },
    });
  });
});
