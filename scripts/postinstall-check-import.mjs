#!/usr/bin/env node
import { createRequire } from "module";

const requireModule = createRequire(import.meta.url);
const required = ["papaparse", "xlsx", "ofx-parse", "dayjs", "zod"];
const missing = [];

for (const name of required) {
  try {
    requireModule.resolve(name);
  } catch {
    missing.push(name);
  }
}

if (missing.length) {
  const manager = process.env.npm_execpath && process.env.npm_execpath.includes("pnpm") ? "pnpm" : "npm";
  const installCmd = manager === "pnpm" ? `pnpm add ${missing.join(" ")}` : `npm install ${missing.join(" ")}`;
  console.warn(`\n[tripay] Missing optional import dependencies: ${missing.join(", ")}\nRun \"${installCmd}\" to install them.\n`);
}
