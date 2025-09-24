import type { NormalizedExpense } from "../../types/import";

export function dedupe(records: NormalizedExpense[], existing: NormalizedExpense[]){
  const seen = new Set(existing.map(r => r.source.hash));
  const unique: NormalizedExpense[] = [];
  const dupes: NormalizedExpense[] = [];
  for (const r of records){
    (seen.has(r.source.hash) ? dupes : unique).push(r);
  }
  return { unique, dupes };
}
