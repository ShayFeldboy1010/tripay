import { z } from "zod";

export const RawRecord = z.record(z.any());

export const NormalizedExpense = z.object({
  date: z.string(),
  amount: z.number(),
  currency: z.string().default("ILS"),
  description: z.string().default(""),
  category: z.string().optional(),
  participants: z.array(z.string()).default([]),
  source: z.object({
    provider: z.string().optional(),
    cardLast4: z.string().optional(),
    fileName: z.string().optional(),
    hash: z.string(),
  })
});
export type NormalizedExpense = z.infer<typeof NormalizedExpense>;
