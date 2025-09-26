import { query } from "@/src/server/db/pool";
import type { ExecutionContext, ExecutionResult } from "./sqlExecutor";
import { computeAggregatesForRows } from "./sqlExecutor";

function baseSql(orderClause: string, limit: number): string {
  return `SELECT date, amount, currency, category, merchant, notes\nFROM expenses\nWHERE user_id = $1 AND date >= $2 AND date <= $3\n${orderClause}\nLIMIT ${limit}`;
}

export async function runHighestExpenseFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const sql = baseSql("ORDER BY amount DESC", 1);
  const params = [context.userId, context.since, context.until];
  const result = await query(sql, params);
  const rows = result.rows.map((row: any) => ({
    ...row,
    date: new Date(row.date).toISOString().slice(0, 10),
  }));
  return {
    sql,
    params,
    rows,
    aggregates: computeAggregatesForRows(rows),
    limit: 1,
  };
}

export async function runTotalsFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const limit = Math.min(context.previewLimit ?? 200, 500);
  const sql = baseSql("ORDER BY date DESC", limit);
  const params = [context.userId, context.since, context.until];
  const result = await query(sql, params);
  const rows = result.rows.map((row: any) => ({
    ...row,
    date: new Date(row.date).toISOString().slice(0, 10),
  }));
  return {
    sql,
    params,
    rows,
    aggregates: computeAggregatesForRows(rows),
    limit,
  };
}

