import { Pool, type PoolClient, type QueryResult } from "pg";

let sharedPool: Pool | null = null;
let testPoolOverride: Pool | null = null;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for AI expenses chat");
  }
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

