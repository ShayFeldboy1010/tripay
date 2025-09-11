export type DateRange =
  | { kind: "all" }
  | { kind: "between"; start: string; end: string }
  | {
      kind: "relative";
      preset:
        | "today"
        | "yesterday"
        | "this_week"
        | "last_week"
        | "this_month"
        | "last_month";
    };

export type AIQuery =
  | { kind: "CompareCategories"; categories: string[]; dateRange?: DateRange }
  | { kind: "TotalByCategory"; category?: string; dateRange?: DateRange }
  | { kind: "TopCategories"; limit?: number; dateRange?: DateRange }
  | { kind: "SpendByDay"; dateRange?: DateRange }
  | { kind: "BudgetStatus"; dateRange?: DateRange };

export type AIFact = { label: string; value: string };
export type AIAnswer = { text: string; facts: AIFact[]; plan?: unknown };
