import { describe, expect, it } from "vitest";
import {
  prepareNamedStatement,
  SqlPreparationError,
  sanitizeParamArray,
  sanitizeParamRecord,
} from "@/services/ai-expenses/sqlGuard";

describe("sqlGuard", () => {
  it("converts named parameters to positional placeholders", () => {
    const { sql, values } = prepareNamedStatement(
      "SELECT * FROM table WHERE user_id = :user AND date BETWEEN :since AND :until AND user_id = :user",
      { user: "abc", since: "2024-01-01", until: "2024-01-31" },
    );

    expect(sql).toBe(
      "SELECT * FROM table WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND user_id = $1",
    );
    expect(values).toEqual(["abc", "2024-01-01", "2024-01-31"]);
  });

  it("throws when a parameter is missing", () => {
    expect(() => prepareNamedStatement("SELECT * FROM t WHERE id = :id", {})).toThrow(SqlPreparationError);
  });

  it("throws when a parameter is undefined", () => {
    expect(() =>
      prepareNamedStatement("SELECT * FROM t WHERE id = :id", { id: undefined }),
    ).toThrow(/undefined/);
  });

  it("rejects unsupported question mark placeholders", () => {
    expect(() =>
      prepareNamedStatement("SELECT * FROM t WHERE id = ?", { id: "1" }),
    ).toThrow(/placeholder/i);
  });

  it("sanitizes sensitive keys in records", () => {
    const sanitized = sanitizeParamRecord({ userId: "secret", since: "2024-01-01" });
    expect(sanitized).toEqual({ userId: "***", since: "2024-01-01" });
  });

  it("redacts the first positional value", () => {
    const sanitized = sanitizeParamArray(["sensitive", 10, "note"]);
    expect(sanitized[0]).toBe("***");
    expect(sanitized.slice(1)).toEqual([10, "note"]);
  });
});

