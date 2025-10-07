const NAMED_PARAM_PATTERN = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
const STRING_LITERAL_PATTERN = /'(?:''|[^'])*'/g;

function stripStringLiterals(sql: string): string {
  return sql.replace(STRING_LITERAL_PATTERN, "'");
}

function shouldMaskKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("id") || normalized.includes("token") || normalized.includes("secret");
}

function sanitizeValue(value: unknown, mask: boolean): unknown {
  if (mask) return "***";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 160) {
      return `${trimmed.slice(0, 157)}...`;
    }
    return trimmed;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "NaN";
    }
    return Number(value.toFixed(6));
  }
  if (value === null || value === undefined) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function sanitizeParamRecord(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(params)) {
    sanitized[key] = sanitizeValue(raw, shouldMaskKey(key));
  }
  return sanitized;
}

export function sanitizeParamArray(values: unknown[]): unknown[] {
  return values.map((value, index) => sanitizeValue(value, index === 0));
}

export class SqlPreparationError extends Error {
  readonly query: string;
  readonly params: Record<string, unknown>;

  constructor(message: string, query: string, params: Record<string, unknown>) {
    super(message);
    this.name = "SqlPreparationError";
    this.query = query;
    this.params = params;
  }

  get sanitizedParams(): Record<string, unknown> {
    return sanitizeParamRecord(this.params);
  }
}

function assertNoQuestionPlaceholders(sql: string, original: string, params: Record<string, unknown>) {
  const stripped = stripStringLiterals(sql);
  if (stripped.includes("?")) {
    throw new SqlPreparationError(
      "Unsupported placeholder detected. Use named parameters like :param for SQL generation.",
      original,
      params,
    );
  }
}

function assertAllParamsResolved(sql: string, params: Record<string, unknown>) {
  const unresolved = stripStringLiterals(sql).match(NAMED_PARAM_PATTERN);
  if (!unresolved) return;
  const message = `Unresolved parameters detected: ${unresolved.map((match) => match.slice(1)).join(", ")}`;
  throw new SqlPreparationError(message, sql, params);
}

export function prepareNamedStatement(
  sql: string,
  params: Record<string, unknown>,
): { sql: string; values: unknown[] } {
  assertNoQuestionPlaceholders(sql, sql, params);

  const order: string[] = [];
  const values: unknown[] = [];

  const transformed = sql.replace(NAMED_PARAM_PATTERN, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new SqlPreparationError(`Missing parameter value for :${key}`, sql, params);
    }
    const value = params[key];
    if (value === undefined) {
      throw new SqlPreparationError(`Parameter :${key} is undefined`, sql, params);
    }
    if (!order.includes(key)) {
      order.push(key);
      values.push(value);
    }
    return `$${order.indexOf(key) + 1}`;
  });

  assertAllParamsResolved(transformed, params);

  return { sql: transformed, values };
}

export function logSqlPreparationError(context: string, error: SqlPreparationError) {
  console.warn(`[ai-sql] ${context}`, {
    message: error.message,
    sql: error.query,
    params: error.sanitizedParams,
  });
}

