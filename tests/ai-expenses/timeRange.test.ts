import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { resolveTimeRange, toISODate } from "@/services/ai-expenses/timeRange";

describe("timeRange", () => {
  it("defaults to current calendar month", () => {
    const now = DateTime.fromISO("2025-05-20T10:00:00", { zone: "Asia/Seoul" });
    const range = resolveTimeRange({}, now);
    expect(toISODate(range.since)).toBe("2025-05-01");
    expect(toISODate(range.until)).toBe("2025-05-20");
    expect(range.tz).toBe("Asia/Seoul");
  });

  it("parses explicit dates", () => {
    const now = DateTime.fromISO("2025-01-15T12:00:00", { zone: "UTC" });
    const range = resolveTimeRange({ since: "2024-12-01", until: "2024-12-31", timezone: "UTC" }, now);
    expect(toISODate(range.since)).toBe("2024-12-01");
    expect(toISODate(range.until)).toBe("2024-12-31");
    expect(range.tz).toBe("UTC");
  });

  it("infers missing boundary", () => {
    const now = DateTime.fromISO("2025-03-10T09:00:00", { zone: "UTC" });
    const range = resolveTimeRange({ since: "2025-03-01", timezone: "UTC" }, now);
    expect(toISODate(range.until)).toBe("2025-03-31");
  });
});

