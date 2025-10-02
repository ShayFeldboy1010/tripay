import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { __internal, CONNECTION_ENV_KEYS, SSL_ENV_KEYS } from "@/src/server/db/pool";

const { buildPoolConfig } = __internal;

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  for (const key of [...CONNECTION_ENV_KEYS, ...SSL_ENV_KEYS]) {
    delete process.env[key];
  }
}

describe("db pool", () => {
  beforeEach(() => {
    resetEnv();
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/app";
  });

  afterAll(() => {
    resetEnv();
  });

  it("returns basic pool config without ssl by default", () => {
    const config = buildPoolConfig();
    expect(config.connectionString).toBe(process.env.DATABASE_URL);
    expect(config.ssl).toBeUndefined();
  });

  it("disables certificate verification when PGSSLMODE=require", () => {
    process.env.PGSSLMODE = "require";
    const config = buildPoolConfig();
    expect(config.ssl).toMatchObject({ rejectUnauthorized: false });
  });

  it("disables TLS when PGSSLMODE=disable", () => {
    process.env.PGSSLMODE = "disable";
    const config = buildPoolConfig();
    expect(config.ssl).toBe(false);
  });

  it("enables verification when a CA certificate is supplied", () => {
    const dir = mkdtempSync(join(tmpdir(), "db-pool-test-"));
    const caPath = join(dir, "root.crt");
    writeFileSync(caPath, "CERTIFICATE");
    process.env.PGSSLROOTCERT = caPath;

    const config = buildPoolConfig();
    expect(config.ssl).toMatchObject({ ca: "CERTIFICATE", rejectUnauthorized: true });
  });

  it("parses sslmode from the connection string when env is absent", () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/app?sslmode=require";
    const config = buildPoolConfig();
    expect(config.ssl).toMatchObject({ rejectUnauthorized: false });
  });
});
