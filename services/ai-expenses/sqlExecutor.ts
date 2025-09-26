import { parse } from "pgsql-ast-parser";
import type { SqlPlan } from "./nl2sql";
import { query } from "@/src/server/db/pool";

const ALLOWED_COLUMNS = new Set([
  "id",
  "user_id",
  "date",
  "amount",
  "currency",
  "category",
  "merchant",
  "notes",
  "created_at",
]);

const ALLOWED_FILTER_COLUMNS = new Set(["category", "merchant", "currency", "amount", "notes"]);
const ALLOWED_FUNCTIONS = new Set(["sum", "avg", "min", "max", "count"]);

export interface ExecutionContext {
  userId: string;
  since: string;
  until: string;
  previewLimit?: number;
}

export interface ExpenseRow {
  date: string;
  amount: number;
  currency: string;
  category: string | null;
  merchant: string | null;
  notes: string | null;
}

export interface Aggregates {
  total: number | null;
  avg: number | null;
  max: { amount: number; merchant: string | null; date: string; currency: string } | null;
  byCategory: Array<{ category: string; sum: number; currency: string }>;
  byMerchant: Array<{ merchant: string; sum: number; currency: string }>;
  totalsByCurrency: Array<{ currency: string; total: number; avg: number; count: number }>;
}

export interface ExecutionResult {
  sql: string;
  params: any[];
  rows: ExpenseRow[];
  aggregates: Aggregates;
  limit: number;
}

function ensureSafePlan(plan: SqlPlan): { limit: number } {
  const statements = parse(plan.sql);
  if (statements.length !== 1) throw new Error("Plan must contain a single statement");
  const statement = statements[0];
  if (statement.type !== "select") throw new Error("Only SELECT statements are allowed");
  if (!statement.from || statement.from.length !== 1) throw new Error("Single FROM source required");
  const from = statement.from[0];
  if (from.type !== "table" || from.name.name !== "expenses") {
    throw new Error("Plan can only query expenses table");
  }

  const aliasNames = new Set<string>();

  const checkExpression = (expr: any) => {
    if (!expr) return;
    switch (expr.type) {
      case "ref": {
        if (expr.name === "*") {
          throw new Error("Wildcard selects are not permitted");
        }
        if (!ALLOWED_COLUMNS.has(expr.name) && !aliasNames.has(expr.name)) {
          throw new Error(`Column ${expr.name} is not allowed`);
        }
        return;
      }
      case "call": {
        const fnName = expr.function?.name?.toLowerCase();
        if (!fnName || !ALLOWED_FUNCTIONS.has(fnName)) {
          throw new Error(`Function ${expr.function?.name} is not permitted`);
        }
        for (const arg of expr.args || []) {
          checkExpression(arg);
        }
        return;
      }
      case "number":
      case "integer":
      case "float":
      case "string":
      case "boolean":
        return;
      case "binary": {
        checkExpression(expr.left);
        checkExpression(expr.right);
        return;
      }
      case "cast": {
        checkExpression(expr.operand);
        return;
      }
      case "parameter": {
        throw new Error("Parameterized statements are not supported in generated SQL");
      }
      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }
  };

  for (const col of statement.columns) {
    checkExpression(col.expr);
    if (col.alias?.name) aliasNames.add(col.alias.name);
  }

  const validateExpression = (expr: any) => {
    if (!expr) return;
    checkExpression(expr);
  };

  if (statement.where) {
    validateExpression(statement.where);
  }

  for (const group of statement.groupBy || []) {
    validateExpression(group);
  }

  for (const order of statement.orderBy || []) {
    validateExpression(order.by);
  }

  let limitValue = 200;
  if (statement.limit?.limit?.type === "integer") {
    limitValue = statement.limit.limit.value;
  }
  if (!Number.isFinite(limitValue) || limitValue <= 0) {
    limitValue = 200;
  }
  limitValue = Math.min(limitValue, 500);

  return { limit: limitValue };
}

function buildFilters(plan: SqlPlan, baseParams: any[]): { clauses: string[]; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  for (const filter of plan.filters || []) {
    const column = filter.column;
    if (!ALLOWED_FILTER_COLUMNS.has(column)) continue;
    const op = filter.op;
    const placeholder = `$${baseParams.length + params.length + 1}`;
    if (typeof filter.value === "string") {
      params.push(filter.value);
    } else if (typeof filter.value === "number") {
      params.push(filter.value);
    } else {
      continue;
    }
    if (op === "ILIKE") {
      clauses.push(`${column} ILIKE ${placeholder}`);
    } else if (["=", "!=", ">", "<", ">=", "<="].includes(op)) {
      clauses.push(`${column} ${op} ${placeholder}`);
    }
  }
  return { clauses, params };
}

export function computeAggregatesForRows(rows: ExpenseRow[]): Aggregates {
  const totals = new Map<string, { total: number; count: number; max: ExpenseRow | null }>();
  const byCategoryMap = new Map<string, number>();
  const byMerchantMap = new Map<string, number>();
  let globalMax: { row: ExpenseRow; amount: number } | null = null;

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    const currency = row.currency || "";
    if (!totals.has(currency)) {
      totals.set(currency, { total: 0, count: 0, max: null });
    }
    const bucket = totals.get(currency)!;
    bucket.total += amount;
    bucket.count += 1;
    if (!bucket.max || amount > Number(bucket.max.amount)) {
      bucket.max = row;
    }
    if (!globalMax || amount > globalMax.amount) {
      globalMax = { row, amount };
    }

    const category = row.category || "Uncategorized";
    const categoryKey = `${currency}::${category}`;
    byCategoryMap.set(categoryKey, (byCategoryMap.get(categoryKey) || 0) + amount);

    if (row.merchant) {
      const merchantKey = `${currency}::${row.merchant}`;
      byMerchantMap.set(merchantKey, (byMerchantMap.get(merchantKey) || 0) + amount);
    }
  }

  const totalsByCurrency = Array.from(totals.entries()).map(([currency, info]) => ({
    currency,
    total: Number(info.total.toFixed(2)),
    avg: info.count ? Number((info.total / info.count).toFixed(2)) : 0,
    count: info.count,
  }));

  const singleCurrency = totalsByCurrency.length === 1 ? totalsByCurrency[0] : null;

  const max = globalMax
    ? {
        amount: Number(globalMax.amount.toFixed(2)),
        merchant: globalMax.row.merchant,
        date: globalMax.row.date,
        currency: globalMax.row.currency,
      }
    : null;

  const byCategory = Array.from(byCategoryMap.entries())
    .map(([key, sum]) => {
      const [currency, category] = key.split("::");
      return { category, sum: Number(sum.toFixed(2)), currency };
    })
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 20);

  const byMerchant = Array.from(byMerchantMap.entries())
    .map(([key, sum]) => {
      const [currency, merchant] = key.split("::");
      return { merchant, sum: Number(sum.toFixed(2)), currency };
    })
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 20);

  return {
    total: singleCurrency ? singleCurrency.total : null,
    avg: singleCurrency ? singleCurrency.avg : null,
    max,
    byCategory,
    byMerchant,
    totalsByCurrency,
  };
}

export async function executePlan(
  plan: SqlPlan,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const { limit } = ensureSafePlan(plan);
  const baseParams = [context.userId, context.since, context.until];
  const { clauses, params } = buildFilters(plan, baseParams);
  const limitValue = Math.min(limit, context.previewLimit ?? 200, 500);

  const whereLines = [
    "user_id = $1",
    "date >= $2",
    "date <= $3",
    ...clauses.map((clause) => clause.replace(/\s+/g, " ")),
  ];

  const sql = `SELECT date, amount, currency, category, merchant, notes\nFROM expenses\nWHERE ${whereLines.join(" AND ")}\nORDER BY date DESC\nLIMIT ${limitValue}`;

  const result = await query<ExpenseRow>(sql, [...baseParams, ...params]);
  const rows = result.rows.slice(0, context.previewLimit ?? 100).map((row) => ({
    ...row,
    date: new Date(row.date).toISOString().slice(0, 10),
  }));

  return {
    sql,
    params: [...baseParams, ...params],
    rows,
    aggregates: computeAggregatesForRows(result.rows.map((row) => ({
      ...row,
      date: new Date(row.date).toISOString().slice(0, 10),
    }))),
    limit: limitValue,
  };
}

