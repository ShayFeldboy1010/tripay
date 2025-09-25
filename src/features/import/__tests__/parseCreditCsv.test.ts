import { describe, expect, it } from "vitest"
import { parseCreditCsv, sha256Hex } from "@/src/features/import/parseCreditCsv"
import { detectDelimiter, sniffEncoding } from "@/src/lib/csv/sniff"

function toFile(contents: string, name = "statement.csv") {
  return new File([contents], name, { type: "text/csv" })
}

describe("credit csv parsing", () => {
  it("detects delimiter and encoding from hebrew statement", () => {
    const text = "\uFEFFתאריך עסקה;שם בית העסק;סכום חיוב;מטבע חיוב\n2025-08-12;LAYA;692.99;₪"
    const buffer = new TextEncoder().encode(text).buffer
    const sniffed = sniffEncoding(buffer)
    expect(sniffed.encoding).toBe("utf-8")
    const detected = detectDelimiter(sniffed.text)
    expect(detected.delimiter).toBe(";")
  })

  it("parses charges with hebrew headers", async () => {
    const csv = [
      "\uFEFF\"תאריך עסקה\";\"שם בית העסק\";\"סכום חיוב\";\"מטבע חיוב\";\"Source\"",
      "2025-08-12;\"LAYA TEL AVIV - Y  IL\";692.99;₪;\"עסקאות במועד החיוב\"",
    ].join("\n")
    const result = await parseCreditCsv(toFile(csv))
    expect(result.rowsValid).toBe(1)
    expect(result.errors).toHaveLength(0)
    const [expense] = result.expenses
    expect(expense.merchant).toBe("LAYA TEL AVIV - Y IL")
    expect(expense.amount).toBeCloseTo(692.99, 2)
    expect(expense.currency).toBe("ILS")
    expect(expense.source?.provider).toBe("עסקאות במועד החיוב")
  })

  it("marks cancellation transactions as negative", async () => {
    const csv = [
      "תאריך עסקה,שם בית העסק,סכום חיוב,מטבע חיוב,סוג עסקה",
      "2025-02-01,Gift Shop,120.00,USD,ביטול עסקה",
    ].join("\n")
    const result = await parseCreditCsv(toFile(csv, "refund.csv"))
    expect(result.rowsValid).toBe(1)
    expect(result.expenses[0].amount).toBeLessThan(0)
  })

  it("computes amount from original amount and exchange rate when needed", async () => {
    const csv = [
      "תאריך עסקה,שם בית העסק,סכום עסקה מקורי,מטבע עסקה מקורי,שער המרה ממטבע מקור/התחשבנות לש\"ח,סוג עסקה",
      "2025-03-15,Airport Duty Free,100.00,USD,3.6,רגילה",
    ].join("\n")
    const result = await parseCreditCsv(toFile(csv, "fx.csv"))
    expect(result.rowsValid).toBe(1)
    expect(result.expenses[0].amount).toBeCloseTo(360, 2)
    expect(result.expenses[0].source?.originalAmount).toBe(100)
    expect(result.expenses[0].source?.exchangeRate).toBe(3.6)
  })

  it("builds deterministic import hash", async () => {
    const csv = [
      "תאריך עסקה,שם בית העסק,סכום חיוב,מטבע חיוב,4 ספרות אחרונות של כרטיס האשראי",
      "2025-04-01,Coffee Shop,18.50,₪,1234",
    ].join("\n")
    const result = await parseCreditCsv(toFile(csv, "hash.csv"))
    const [expense] = result.expenses
    const expected = await sha256Hex(["2025-04-01", "Coffee Shop", "18.50", "ILS", "1234"].join("|"))
    expect(expense.importHash).toBe(expected)
  })

  it("skips rows without date or amount", async () => {
    const csv = [
      "תאריך עסקה,שם בית העסק,סכום חיוב,מטבע חיוב",
      ",No Date,12.00,₪",
      "2025-05-01,Missing Amount,,₪",
    ].join("\n")
    const result = await parseCreditCsv(toFile(csv, "invalid.csv"))
    expect(result.rowsValid).toBe(0)
    expect(result.errors).toHaveLength(2)
  })
})
