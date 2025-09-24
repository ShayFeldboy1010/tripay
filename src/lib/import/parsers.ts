import Papa from "papaparse";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import type { SupportedCurrency, NormalizedExpense } from "../../types/import";

const he = {
  date: ["תאריך", "תאריך עסקה", "מועד עסקה", "מועד חיוב"],
  amount: ["סכום", "סכום עסקה", "סכום חיוב", "סכום בשקלים", "יתרה"],
  debit: ["חובה", "דביט", "חיוב"],
  credit: ["זכות", "קרדיט", "זיכוי"],
  desc: ["תיאור", "שם בית עסק", "בית עסק", "פירוט"],
  currency: ["מטבע", "מטבע עסקה", "ISO", "קוד מטבע"],
  last4: ["4 ספרות", "ארבע ספרות", "מספר כרטיס", "כרטיס"],
  type: ["חייב/זכות", "סוג תנועה", "דביט/קרדיט"],
};
const en = {
  date: ["Date", "Transaction Date", "Posting Date"],
  amount: ["Amount", "Transaction Amount", "Debit", "Credit", "Local Amount"],
  debit: ["Debit"],
  credit: ["Credit"],
  desc: ["Description", "Merchant", "Details", "Memo"],
  currency: ["Currency", "ISO", "CCY"],
  last4: ["Card Last4", "Card", "Last4", "Account"],
  type: ["Type", "Dr/Cr"],
};

const pick = (row: any, keys: string[]) => (keys.find((k) => k in row) ? row[keys.find((k) => k in row)!] : undefined);

export function parseAmount(v: any): number {
  if (v == null) return 0;
  let s = String(v);
  // remove currency symbols and formatting
  s = s.replace(/[\s,]/g, "").replace(/[₪₩$€£¥]/g, "");
  s = s.replace(/[()]/g, ""); // banks use (123.45) for negative
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function parseDateGuess(v: any): string {
  if (!v) return new Date().toISOString();
  const guess = dayjs(String(v).trim(), ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD", "YYYY/M/D", "MM/DD/YYYY", "M/D/YYYY"], true);
  return (guess.isValid() ? guess.toDate() : new Date()).toISOString();
}

export async function parseCSV(file: File) {
  return new Promise<any[]>((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "utf-8",
      complete: (res) => resolve(res.data as any[]),
      error: reject,
    });
  });
}
export async function parseXLSX(file: File) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
}
export async function parseOFX(file: File) {
  const text = await file.text();
  const { parse } = await import("ofx-parse");
  const data: any = parse(text);
  const tx = (data?.transactions || []).map((t: any) => ({
    Date: t.date,
    Amount: t.amount,
    Description: t.name || t.memo,
    Currency: t.currency || "",
  }));
  return tx;
}
export async function parseFile(file: File) {
  const ext = file.name.toLowerCase().split(".").pop()!;
  if (ext === "csv") return parseCSV(file);
  if (ext === "xlsx" || ext === "xls") return parseXLSX(file);
  if (ext === "ofx" || ext === "qfx") return parseOFX(file);
  return [];
}

/** Heuristic: detect currency from a row/strings/symbols; fallback to defaultCurrency */
export function detectCurrency(row: any, currencyField?: string, defaultCurrency: SupportedCurrency = "ILS"): SupportedCurrency {
  const raw = currencyField ? row[currencyField] : pick(row, [...he.currency, ...en.currency]) || "";
  const s = String(raw || "").toUpperCase();

  if (/KRW|₩|원/.test(s)) return "KRW";
  if (/ILS|₪/.test(s)) return "ILS";
  if (/USD|\$/.test(s)) return "USD";
  if (/EUR|€/.test(s)) return "EUR";
  if (/JPY|¥/.test(s)) return "JPY";
  if (/GBP|£/.test(s)) return "GBP";

  // Try infer from amount & locale tokens inside description:
  const desc = (pick(row, [...he.desc, ...en.desc]) || "").toString();
  if (/[₩]/.test(desc)) return "KRW";
  if (/[₪]/.test(desc)) return "ILS";
  if (/\$/.test(desc)) return "USD";
  if (/[€]/.test(desc)) return "EUR";
  if (/[¥]/.test(desc)) return "JPY";
  if (/[£]/.test(desc)) return "GBP";

  return defaultCurrency;
}

export type Mapping = {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  currency?: string;
  last4?: string;
};

export function toNormalized(
  rows: any[],
  fileName?: string,
  opts?: { mapping?: Mapping; defaultCurrency?: SupportedCurrency; paidBy?: string },
): NormalizedExpense[] {
  const out: NormalizedExpense[] = [];
  for (const r of rows) {
    const m = opts?.mapping || {};
    const v = (keys: string[]) => pick(r, keys);

    const rawDate = m.date ? r[m.date] : v([...he.date, ...en.date]);
    const rawDesc = m.description ? r[m.description] : v([...he.desc, ...en.desc]);
    const rawCurrency = detectCurrency(r, m.currency, opts?.defaultCurrency ?? "ILS");
    const rawDebit = m.debit ? r[m.debit] : v([...he.debit, ...en.debit]);
    const rawCredit = m.credit ? r[m.credit] : v([...he.credit, ...en.credit]);
    const rawAmount = m.amount ? r[m.amount] : v([...he.amount, ...en.amount]);

    // Prefer signed using debit/credit when present
    let signed = parseAmount(rawAmount);
    if (rawDebit != null && String(rawDebit).trim() !== "") signed = parseAmount(rawDebit);
    if (rawCredit != null && String(rawCredit).trim() !== "") signed = -parseAmount(rawCredit);

    const description = (rawDesc || "").toString().trim();
    const date = parseDateGuess(rawDate);
    const currency = rawCurrency as SupportedCurrency;
    const last4 = (m.last4 ? r[m.last4] : v([...he.last4, ...en.last4]) || "")
      .toString()
      .replace(/\D/g, "")
      .slice(-4);

    const src = JSON.stringify({ date, signed, description, currency, last4 }).toLowerCase();
    const hash = cryptoHash(src);

    out.push({
      date,
      amount: Math.abs(signed),
      currency,
      description,
      category: undefined,
      paidBy: opts?.paidBy,
      participants: opts?.paidBy ? [opts.paidBy] : [],
      location: undefined, // left empty intentionally
      source: { provider: "", cardLast4: last4, fileName, hash },
    });
  }
  return out;
}

export function cryptoHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(16);
}
