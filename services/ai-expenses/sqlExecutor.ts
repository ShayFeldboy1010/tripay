import { parse } from "pgsql-ast-parser";
import type { SqlPlan } from "./nl2sql";
import { query } from "@/src/server/db/pool";
import { ALLOWED_AGG, EXPENSES_COLUMNS, EXPENSES_TABLE, MAX_LIMIT } from "./schema";
import { prepareNamedStatement, SqlPreparationError } from "./sqlGuard";

const ALLOWED_FILTER_COLUMNS = new Set(["category", "merchant", "currency", "amount", "notes"]);
const ALLOWED_FUNCTIONS = new Set(Array.from(ALLOWED_AGG).map((fn) => fn.toLowerCase()));
const ALLOWED_COLUMNS = new Set(Object.keys(EXPENSES_COLUMNS));

export interface ExecutionScope {
  column: "trip_id" | "user_id";
  id: string;
}

export interface ExecutionContext {
  scope: ExecutionScope;
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
  currencyNote: string | null;
}

export interface ExecutionResult {
  sql: string;
  params: any[];
  rows: ExpenseRow[];
  aggregates: Aggregates;
  limit: number;
}

interface ValidationOutcome {
  limit: number;
}

function ensureSafePlan(plan: SqlPlan): ValidationOutcome {
  const statements = parse(plan.sql);
  if (statements.length !== 1) throw new Error("Plan must contain a single statement");
  const statement = statements[0];
  if (statement.type !== "select") throw new Error("Only SELECT statements are allowed");
  if (!statement.from || statement.from.length !== 1) throw new Error("Single FROM source required");
  const from = statement.from[0];
  if (from.type !== "table" || from.name.name !== EXPENSES_TABLE) {
    throw new Error(`Plan can only query ${EXPENSES_TABLE}`);
  }

  const aliasNames = new Set<string>();
  let hasCurrencyColumn = false;
  let hasAggregate = false;

  const inspectExpression = (expr: any) => {
    if (!expr) return;
    switch (expr.type) {
      case "ref": {
        if (expr.name === "*") throw new Error("Wildcard selects are not permitted");
        if (!ALLOWED_COLUMNS.has(expr.name) && !aliasNames.has(expr.name)) {
          throw new Error(`Column ${expr.name} is not allowed`);
        }
        if (expr.name === "currency") {
          hasCurrencyColumn = true;
        }
        return;
      }
      case "call": {
        const fnName = expr.function?.name?.toLowerCase();
        if (!fnName || !ALLOWED_FUNCTIONS.has(fnName)) {
          throw new Error(`Function ${expr.function?.name} is not permitted`);
        }
        hasAggregate = true;
        for (const arg of expr.args || []) {
          inspectExpression(arg);
        }
        return;
      }
      case "binary": {
        inspectExpression(expr.left);
        inspectExpression(expr.right);
        return;
      }
      case "number":
      case "integer":
      case "float":
      case "string":
      case "boolean":
        return;
      case "parameter":
        throw new Error("Parameterized statements are not supported in generated SQL");
      case "select":
      case "list":
      case "exists":
        throw new Error("Subqueries are not permitted");
      default:
        throw new Error(`Unsupported expression type: ${expr.type}`);
    }
  };

  for (const column of statement.columns) {
    inspectExpression(column.expr);
    if (column.alias?.name) {
      aliasNames.add(column.alias.name);
      if (column.alias.name === "currency") {
        hasCurrencyColumn = true;
      }
    }
  }

  if (hasAggregate && !hasCurrencyColumn) {
    throw new Error("Aggregations must include currency column");
  }

  if (statement.where) inspectExpression(statement.where);
  for (const group of statement.groupBy || []) inspectExpression(group);
  for (const order of statement.orderBy || []) inspectExpression(order.by);

  let limitValue = MAX_LIMIT;
  if (statement.limit?.limit?.type === "integer") {
    limitValue = Math.min(statement.limit.limit.value, MAX_LIMIT);
  }
  if (!Number.isFinite(limitValue) || limitValue <= 0) {
    limitValue = MAX_LIMIT;
  }

  return { limit: limitValue };
}

function buildFilters(plan: SqlPlan, params: Record<string, any>): string[] {
  const clauses: string[] = [];
  plan.filters.forEach((filter, index) => {
    if (!ALLOWED_FILTER_COLUMNS.has(filter.column)) return;
    const paramKey = `filter_${index}`;
    params[paramKey] = filter.value;
    if (filter.op === "ILIKE") {
      clauses.push(`${filter.column} ILIKE :${paramKey}`);
    } else {
      clauses.push(`${filter.column} ${filter.op} :${paramKey}`);
    }
  });
  return clauses;
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

  const currencyNote =
    totalsByCurrency.length > 1
      ? `Found ${totalsByCurrency.length} currencies (${totalsByCurrency
          .map((item) => item.currency)
          .join(", ")}). Totals are reported per currency.`
      : null;

  return {
    total: singleCurrency ? singleCurrency.total : null,
    avg: singleCurrency ? singleCurrency.avg : null,
    max,
    byCategory,
    byMerchant,
    totalsByCurrency,
    currencyNote,
  };
}

function deriveOrderClause(plan: SqlPlan): string {
  if (plan.order.length > 0) {
    const primary = plan.order[0];
    const by = primary.by.toLowerCase();
    const direction = primary.dir.toUpperCase();
    if (by.includes("amount") || by === "sum" || by === "max" || by === "total") {
      return `ORDER BY amount ${direction}`;
    }
    if (by.includes("date")) {
      return `ORDER BY date ${direction}`;
    }
  }
  if (plan.intent === "ranking") {
    return "ORDER BY amount DESC";
  }
  return "ORDER BY date DESC";
}

export class SqlExecutionFatalError extends Error {
  readonly original: Error;
  readonly fallback?: Error;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: { original: Error; fallback?: Error; details?: Record<string, unknown> }) {
    super(message);
    this.name = "SqlExecutionFatalError";
    this.original = options.original;
    this.fallback = options.fallback;
    this.details = options.details;
  }
}

export async function executePlan(plan: SqlPlan, context: ExecutionContext): Promise<ExecutionResult> {
  const { limit: planLimit } = ensureSafePlan(plan);
  const params: Record<string, any> = {
    scope_id: context.scope.id,
    since: context.since,
    until: context.until,
  };

  const filters = buildFilters(plan, params);
  const whereLines = [
    `${context.scope.column} = :scope_id`,
    "date BETWEEN :since AND :until",
    ...filters,
  ];

  const limitValue = Math.min(plan.limit ?? planLimit, planLimit, context.previewLimit ?? MAX_LIMIT, MAX_LIMIT);
  const orderClause = deriveOrderClause(plan);

  const sql = `SELECT date, amount, currency, category, merchant, notes\nFROM ${EXPENSES_TABLE}\nWHERE ${whereLines.join(
    " AND "
  )}\n${orderClause}\nLIMIT ${limitValue}`;

  let prepared;
  try {
    prepared = prepareNamedStatement(sql, params);
  } catch (err) {
    if (err instanceof SqlPreparationError) {
      throw err;
    }
    throw new SqlPreparationError((err as Error).message || "Failed to prepare query", sql, params);
  }
  let result;
  try {
    result = await query<ExpenseRow>(prepared.sql, prepared.values);
  } catch (err) {
    const error = err as Error & { executedSql?: string; executedParams?: any[] };
    error.executedSql = prepared.sql;
    error.executedParams = prepared.values;
    throw error;
  }

  const rows = result.rows.map((row) => ({
    ...row,
    date: new Date(row.date).toISOString().slice(0, 10),
  }));

  return {
    sql: prepared.sql,
    params: prepared.values,
    rows,
    aggregates: computeAggregatesForRows(rows),
    limit: limitValue,
  };
}

export const __test__ensureSafePlan = ensureSafePlan;
