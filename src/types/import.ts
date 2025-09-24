import { z } from "zod";

export const RawRecord = z.record(z.any());

export const SupportedCurrency = z.enum(["ILS", "KRW", "USD", "EUR", "JPY", "GBP"]);
export type SupportedCurrency = z.infer<typeof SupportedCurrency>;

export const NormalizedExpense = z.object({
  date: z.string(), // ISO
  amount: z.number(), // positive
  currency: SupportedCurrency, // required
  description: z.string().default(""),
  category: z.string().optional(),
  paidBy: z.string().optional(),
  participants: z.array(z.string()).default([]),
  location: z
    .object({
      country: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  source: z.object({
    provider: z.string().optional(),
    cardLast4: z.string().optional(),
    fileName: z.string().optional(),
    hash: z.string(),
  }),
});
export type NormalizedExpense = z.infer<typeof NormalizedExpense>;
