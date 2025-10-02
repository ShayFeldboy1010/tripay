import fs from "node:fs";
import { Pool, type PoolClient, type PoolConfig, type QueryResult } from "pg";

const SSL_MODE_ENV_KEYS = ["AI_CHAT_PGSSLMODE", "PGSSLMODE"] as const;
const SSL_FILE_ENV_KEYS = {
  rootCert: "PGSSLROOTCERT",
  clientCert: "PGSSLCERT",
  clientKey: "PGSSLKEY",
} as const;

let sharedPool: Pool | null = null;
let testPoolOverride: Pool | null = null;

export const CONNECTION_ENV_KEYS = [
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_DB_CONNECTION_STRING",
  "POSTGRES_URL",
];


export const SSL_ENV_KEYS = [
  ...SSL_MODE_ENV_KEYS,
  SSL_FILE_ENV_KEYS.rootCert,
  SSL_FILE_ENV_KEYS.clientCert,
  SSL_FILE_ENV_KEYS.clientKey,
] as const;

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

function readOptionalFile(envKey: string): string | undefined {
  const filePath = process.env[envKey];
  if (!filePath) return undefined;
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${envKey} at ${filePath}: ${message}`);
  }
}

function resolveSslMode(connectionString: string): string | null {
  for (const key of SSL_MODE_ENV_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }

  try {
    const url = new URL(connectionString);
    return url.searchParams.get("sslmode");
  } catch {
    return null;
  }
}

function resolveSslConfig(connectionString: string): PoolConfig["ssl"] | undefined {
  const mode = resolveSslMode(connectionString)?.toLowerCase() ?? null;
  const ca = readOptionalFile(SSL_FILE_ENV_KEYS.rootCert);
  const cert = readOptionalFile(SSL_FILE_ENV_KEYS.clientCert);
  const key = readOptionalFile(SSL_FILE_ENV_KEYS.clientKey);

  if (!mode && !ca && !cert && !key) {
    return undefined;
  }

  if (mode && !["disable", "require", "verify-ca", "verify-full"].includes(mode)) {
    throw new Error(
      `Unsupported PGSSLMODE value: ${mode}. Supported modes: disable, require, verify-ca, verify-full.`
    );
  }

  if (mode === "disable") {
    return false;
  }

  let ssl: NonNullable<PoolConfig["ssl"]> | undefined;

  if (mode === "require") {
    ssl = { rejectUnauthorized: false };
  }

  if (mode === "verify-ca" || mode === "verify-full") {
    ssl = { rejectUnauthorized: true };
  }

  if (ca || cert || key) {
    if (!ssl || typeof ssl === "boolean") {
      ssl = {};
    }
    if (ca) ssl.ca = ca;
    if (cert) ssl.cert = cert;
    if (key) ssl.key = key;
    if (ssl.rejectUnauthorized === undefined) {
      ssl.rejectUnauthorized = true;
    }
  }

  return ssl ?? { rejectUnauthorized: false };
}

function buildPoolConfig(): PoolConfig {
  const connectionString = resolveConnectionString();
  const config: PoolConfig = { connectionString, max: 10 };
  const ssl = resolveSslConfig(connectionString);
  if (ssl !== undefined) {
    config.ssl = ssl;
  }
  return config;
}

function createPool(): Pool {
  const config = buildPoolConfig();
  const pool = new Pool(config);

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

export const __internal = {
  buildPoolConfig,
  resolveSslConfig,
};

