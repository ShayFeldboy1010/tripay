import { query } from "@/src/server/db/pool";
import type { ExecutionContext, ExecutionResult } from "./sqlExecutor";
import { computeAggregatesForRows } from "./sqlExecutor";
import { prepareNamedStatement } from "./sqlGuard";
import { EXPENSES_TABLE } from "./schema";

async function runTemplate(
  context: ExecutionContext,
  sql: string,
  params: Record<string, any>,
  limit: number,
  mapper?: (row: any) => any
): Promise<ExecutionResult> {
  const prepared = prepareNamedStatement(sql, params);
  const result = await query(prepared.sql, prepared.values);
  const rows = (mapper ? result.rows.map(mapper) : result.rows).map((row: any) => ({
    ...row,
    date: new Date(row.date).toISOString().slice(0, 10),
  }));
  return {
    sql: prepared.sql,
    params: prepared.values,
    rows,
    aggregates: computeAggregatesForRows(rows),
    limit,
  };
}

export async function runHighestExpenseFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = 1;
  const sql = `SELECT date, amount, currency, category, merchant, notes\nFROM ${EXPENSES_TABLE}\nWHERE ${context.scope.column} = :scope\n  AND date BETWEEN :since AND :until\nORDER BY amount DESC\nLIMIT ${limit}`;
  return runTemplate(
    context,
    sql,
    { scope: context.scope.id, since: context.since, until: context.until },
    limit
  );
}

export async function runTotalsByCategoryFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = 20;
  const sql = `SELECT category, currency, SUM(amount) AS sum\nFROM ${EXPENSES_TABLE}\nWHERE ${context.scope.column} = :scope\n  AND date BETWEEN :since AND :until\nGROUP BY category, currency\nORDER BY sum DESC\nLIMIT ${limit}`;
  return runTemplate(
    context,
    sql,
    { scope: context.scope.id, since: context.since, until: context.until },
    limit,
    (row) => ({
      date: context.until,
      amount: Number(row.sum ?? 0),
      currency: row.currency,
      category: row.category ?? "Uncategorized",
      merchant: null,
      notes: null,
    })
  );
}

export async function runTopMerchantsFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = 10;
  const sql = `SELECT merchant, currency, SUM(amount) AS sum\nFROM ${EXPENSES_TABLE}\nWHERE ${context.scope.column} = :scope\n  AND date BETWEEN :since AND :until\nGROUP BY merchant, currency\nORDER BY sum DESC\nLIMIT ${limit}`;
  return runTemplate(
    context,
    sql,
    { scope: context.scope.id, since: context.since, until: context.until },
    limit,
    (row) => ({
      date: context.until,
      amount: Number(row.sum ?? 0),
      currency: row.currency,
      category: null,
      merchant: row.merchant ?? "Unknown",
      notes: null,
    })
  );
}

export async function runTotalsFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = Math.min(context.previewLimit ?? 200, 200);
  const sql = `SELECT date, amount, currency, category, merchant, notes\nFROM ${EXPENSES_TABLE}\nWHERE ${context.scope.column} = :scope\n  AND date BETWEEN :since AND :until\nORDER BY date DESC\nLIMIT ${limit}`;
  return runTemplate(
    context,
    sql,
    { scope: context.scope.id, since: context.since, until: context.until },
    limit
  );
}
