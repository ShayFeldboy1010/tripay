import type { Aggregates, ExecutionContext, ExecutionResult, ExpenseRow } from "./sqlExecutor";
import { computeAggregatesForRows, fetchExpenseRows } from "./sqlExecutor";

function buildResult(sql: string, rows: ExpenseRow[], limit: number, aggregates?: Aggregates): ExecutionResult {
  const computed = aggregates ?? computeAggregatesForRows(rows);
  return {
    sql,
    params: [],
    rows,
    aggregates: computed,
    limit,
  };
}

export async function runHighestExpenseFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = 1;
  const { rows, sql } = await fetchExpenseRows(context, {
    order: { column: "amount", ascending: false },
    limit,
  });
  return buildResult(sql, rows, limit);
}

export async function runTotalsByCategoryFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const previewLimit = 20;
  const fetchLimit = Math.min(context.previewLimit ?? 200, 200);
  const { rows, sql } = await fetchExpenseRows(context, {
    order: { column: "amount", ascending: false },
    limit: fetchLimit,
  });
  const aggregates = computeAggregatesForRows(rows);
  const previewRows: ExpenseRow[] = aggregates.byCategory.slice(0, previewLimit).map((item) => ({
    date: context.until,
    amount: item.sum,
    currency: item.currency,
    category: item.category ?? "Uncategorized",
    merchant: null,
    notes: null,
  }));
  return buildResult(sql, previewRows, previewRows.length, aggregates);
}

export async function runTopMerchantsFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const previewLimit = 10;
  const fetchLimit = Math.min(context.previewLimit ?? 200, 200);
  const { rows, sql } = await fetchExpenseRows(context, {
    order: { column: "amount", ascending: false },
    limit: fetchLimit,
  });
  const aggregates = computeAggregatesForRows(rows);
  const previewRows: ExpenseRow[] = aggregates.byMerchant.slice(0, previewLimit).map((item) => ({
    date: context.until,
    amount: item.sum,
    currency: item.currency,
    category: null,
    merchant: item.merchant ?? "Unknown",
    notes: null,
  }));
  return buildResult(sql, previewRows, previewRows.length, aggregates);
}

export async function runTotalsFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = Math.min(context.previewLimit ?? 200, 200);
  const { rows, sql } = await fetchExpenseRows(context, {
    order: { column: "date", ascending: false },
    limit,
  });
  return buildResult(sql, rows, limit);
}
