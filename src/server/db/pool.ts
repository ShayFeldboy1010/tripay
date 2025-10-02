import { Pool, type PoolClient, type QueryResult } from "pg";

let sharedPool: Pool | null = null;
let testPoolOverride: Pool | null = null;

export const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DB_CONNECTION_STRING",
  "POSTGRES_URL",
];

function resolveConnectionString(): string {
  for (const key of CONNECTION_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      if (key !== "DATABASE_URL") {
        console.warn(
          `AI expenses chat is using ${key} for the Postgres connection; set DATABASE_URL to silence this warning.`
        );
      }
      return value;
    }
  }

  throw new Error(
    `Database connection string missing. Define one of ${CONNECTION_ENV_KEYS.join(", ")}.`
  );
}

function createPool(): Pool {
  const connectionString = resolveConnectionString();
  const pool = new Pool({ connectionString, max: 10 });
  pool.on("error", (err) => {
    console.error("pg: unexpected error on idle client", err);
  });
  return pool;
}

export function getPool(): Pool {
  if (testPoolOverride) return testPoolOverride;
  if (!sharedPool) {
    sharedPool = createPool();
  }
  return sharedPool;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function query<T>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export function setTestPool(pool: Pool | null) {
  testPoolOverride = pool;
}

