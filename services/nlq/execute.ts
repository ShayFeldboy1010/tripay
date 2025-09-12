import type { Expense } from "@/lib/supabase/client";
import type { DSL } from "./dsl";
import { executeStructuredQuery } from "../expenses/query";

export function execute(dsl: DSL, expenses: Expense[]) {
  return executeStructuredQuery(dsl, expenses);
}
