// @/lib/date.ts

// For <input type="date"> values: 'YYYY-MM-DD' → safe UTC ISO for timestamptz
export function dateOnlyToUTC(dateStr: string): string {
  // Store at noon UTC to avoid timezone rollovers
  const [y, m, d] = dateStr.split('-').map(Number);
  const iso = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
  return iso;
}

// If DB column is 'date', just keep the 'YYYY-MM-DD' string:
export function clampToDateString(dateStr: string): string {
  return dateStr; // validate format if needed
}
