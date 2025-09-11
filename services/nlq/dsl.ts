import { z } from "zod";

export const intents = [
  "total_spend",
  "biggest_expense",
  "top_categories",
  "daily_spend",
  "count_transactions",
  "budget_status",
] as const;

export const timePreset = [
  "last7d",
  "last30d",
  "thisMonth",
  "lastMonth",
  "thisWeek",
  "lastWeek",
  "all",
] as const;

export const DSLSchema = z.object({
  intent: z.enum(intents),
  timeRange: z.object({
    preset: z.enum(timePreset).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  }),
  filters: z
    .object({
      category: z.array(z.string()).optional(),
      location: z.array(z.string()).optional(),
      participants: z.array(z.string()).optional(),
    })
    .optional(),
  groupBy: z.enum(["day", "category", "location"]).nullable().optional(),
  currency: z.string().nullable().optional(),
});

export type DSL = z.infer<typeof DSLSchema>;

export interface Answer {
  text: string;
  details?: any;
  warnings?: string[];
}

export function validateDSL(input: unknown): DSL | null {
  try {
    return DSLSchema.parse(input);
  } catch {
    return null;
  }
}
