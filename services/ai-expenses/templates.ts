import { query } from "@/src/server/db/pool";
import type { ExecutionContext, ExecutionResult } from "./sqlExecutor";
import { computeAggregatesForRows } from "./sqlExecutor";

function baseSql(
  context: ExecutionContext,
  orderClause: string,
  limit: number
): { sql: string; params: any[] } {
  const column = context.scope.column;
  const sql = `SELECT date, amount, currency, category, merchant, notes\nFROM expenses\nWHERE ${column} = $1 AND date >= $2 AND date <= $3\n${orderClause}\nLIMIT ${limit}`;
  const params = [context.scope.id, context.since, context.until];
  return { sql, params };
}

export async function runHighestExpenseFallback(context: ExecutionContext): Promise<ExecutionResult> {
  const { sql, params } = baseSql(context, "ORDER BY amount DESC", 1);
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
  const { sql, params } = baseSql(context, "ORDER BY date DESC", limit);
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

