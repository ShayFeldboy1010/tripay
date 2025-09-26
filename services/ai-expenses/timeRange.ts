import * as chrono from "chrono-node";
import { DateTime } from "luxon";

export interface TimeRangeInput {
  since?: string | null;
  until?: string | null;
  timezone?: string | null;
}

export interface ResolvedTimeRange {
  since: DateTime;
  until: DateTime;
  tz: string;
}

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Seoul";

function parseNaturalDate(text: string, zone: string, ref: DateTime): DateTime | null {
  const parsed = chrono.parse(text, ref.toJSDate(), { forwardDate: true });
  if (!parsed.length) return null;
  const match = parsed[0].start;
  if (!match) return null;
  const dt = DateTime.fromJSDate(match.date()).setZone(zone);
  return dt.isValid ? dt : null;
}

function normalizeInput(value: string, zone: string, ref: DateTime): DateTime | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const dt = DateTime.fromISO(trimmed, { zone });
    return dt.isValid ? dt : null;
  }
  return parseNaturalDate(trimmed, zone, ref);
}

export function resolveTimeRange(input: TimeRangeInput, now: DateTime = DateTime.now()): ResolvedTimeRange {
  const zone = input.timezone || DEFAULT_TIMEZONE;
  const zonedNow = now.setZone(zone);
  const startOfMonth = zonedNow.startOf("month");
  const defaultRange: ResolvedTimeRange = {
    since: startOfMonth,
    until: zonedNow,
    tz: zone,
  };

  const sinceRaw = input.since?.trim();
  const untilRaw = input.until?.trim();

  if (!sinceRaw && !untilRaw) {
    return defaultRange;
  }

  let since = sinceRaw ? normalizeInput(sinceRaw, zone, zonedNow) : null;
  let until = untilRaw ? normalizeInput(untilRaw, zone, zonedNow) : null;

  if (!since && sinceRaw) {
    throw new Error(`Unable to parse 'since': ${sinceRaw}`);
  }
  if (!until && untilRaw) {
    throw new Error(`Unable to parse 'until': ${untilRaw}`);
  }

  if (!since && until) {
    since = until.minus({ days: 30 });
  }
  if (!until && since) {
    until = since.plus({ days: 30 });
  }

  const resolvedSince = since || defaultRange.since;
  const resolvedUntil = until || defaultRange.until;

  if (resolvedSince > resolvedUntil) {
    throw new Error("since must be before until");
  }

  return { since: resolvedSince.startOf("day"), until: resolvedUntil.endOf("day"), tz: zone };
}

export function toISODate(dt: DateTime): string {
  return dt.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).toISODate()!;
}

