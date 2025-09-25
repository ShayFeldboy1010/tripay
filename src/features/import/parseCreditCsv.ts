import dayjs from "dayjs"
import { parseCsv, type CsvParseOptions } from "@/src/lib/csv/parse"
import { normalizeHeader } from "@/src/lib/csv/sniff"
import type { ExpenseDTO } from "@/src/types/expense"

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "D/M/YYYY",
  "DD.MM.YYYY",
  "D.M.YYYY",
  "DD-MM-YYYY",
  "D-M-YYYY",
  "YYYY/MM/DD",
  "YYYY.M.DD",
]

const REFUND_TOKENS = [
  "credit",
  "refund",
  "return",
  "זיכוי",
  "החזר",
  "ביטול",
  "זכות",
  "קרדיט",
  "ביטול עסקה",
  "credit memo",
]

const HEADER_DICTIONARY: Record<string, string[]> = {
  transactionDate: [
    "transaction date",
    "תאריך עסקה",
    "תאריך",
    "מועד עסקה",
    "תאריך חיוב",
    "billing date",
  ],
  merchant: [
    "merchant",
    "שם בית העסק",
    "שם סוחר",
    "description",
    "details",
    "פירוט",
    "שם ספק",
  ],
  category: ["category", "קטגוריה", "סיווג"],
  cardLast4: [
    "card last4",
    "4 ספרות אחרונות של כרטיס האשראי",
    "4 ספרות",
    "card",
    "last4",
    "ארבע ספרות",
  ],
  transactionType: ["transaction type", "סוג עסקה", "אופי עסקה", "סוג תנועה"],
  chargeAmount: [
    "charge amount",
    "סכום חיוב",
    "debit",
    "חיוב",
    "amount",
    "local amount",
  ],
  chargeCurrency: [
    "charge currency",
    "מטבע חיוב",
    "מטבע",
    "local currency",
    "iso",
  ],
  originalAmount: ["original amount", "סכום עסקה מקורי", "סכום עסקה", "סכום במקור"],
  originalCurrency: [
    "original currency",
    "מטבע עסקה מקורי",
    "מטבע עסקה",
    "מטבע מקור",
  ],
  notes: ["notes", "הערות", "description details"],
  tags: ["tags", "תיוגים"],
  method: ["method", "אופן ביצוע ההעסקה", "channel"],
  source: ["source", "מקור", "חשבונית", "ריכוז"],
  billingDate: ["billing date", "תאריך חיוב"],
  exchangeRate: [
    "exchange rate",
    "שער המרה",
    "שער",
    'שער המרה ממטבע מקור/התחשבנות לש"ח',
  ],
  provider: ["provider", "issuer", "מועדון", "מועדון הנחות", "מועדון אשראי"],
}

const headerLookup = new Map<string, keyof typeof HEADER_DICTIONARY>()
for (const [canonical, variants] of Object.entries(HEADER_DICTIONARY)) {
  variants.forEach((variant) => {
    headerLookup.set(normalizeKey(variant), canonical as keyof typeof HEADER_DICTIONARY)
  })
}

const currencyLookup = new Map<string, string>([
  ["₪", "ILS"],
  ['ש"ח', "ILS"],
  ["שח", "ILS"],
  ["nis", "ILS"],
  ["ils", "ILS"],
  ["שקל", "ILS"],
  ["שקלים", "ILS"],
  ["$", "USD"],
  ["usd", "USD"],
  ["דולר", "USD"],
  ["eur", "EUR"],
  ["€", "EUR"],
  ["euro", "EUR"],
  ['ליש"ט', "GBP"],
  ["£", "GBP"],
  ["gbp", "GBP"],
  ["yen", "JPY"],
  ["¥", "JPY"],
  ["jpy", "JPY"],
  ["₩", "KRW"],
  ["krw", "KRW"],
])

function normalizeKey(value: string): string {
  return normalizeHeader(value).toLowerCase()
}

function mapHeaders(headers: string[]): Partial<Record<keyof typeof HEADER_DICTIONARY, string>> {
  const mapping: Partial<Record<keyof typeof HEADER_DICTIONARY, string>> = {}
  headers.forEach((header) => {
    const key = headerLookup.get(normalizeKey(header))
    if (key && !mapping[key]) {
      mapping[key] = header
    }
  })
  return mapping
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const direct = dayjs(trimmed)
  if (direct.isValid()) {
    return direct.format("YYYY-MM-DD")
  }

  const parsed = dayjs(trimmed, DATE_FORMATS, true)
  if (parsed.isValid()) {
    return parsed.format("YYYY-MM-DD")
  }

  return null
}

function parseAmount(value: unknown): number | null {
  if (value == null) return null
  const raw = String(value)
  if (!raw.trim()) return null
  let cleaned = raw.replace(/[₪₩$€£¥]/g, "").replace(/[\u200E\u200F]/g, "").replace(/'/g, "").trim()
  const commaCount = (cleaned.match(/,/g) || []).length
  const dotCount = (cleaned.match(/\./g) || []).length
  if (commaCount === 1 && dotCount === 0) {
    cleaned = cleaned.replace(/,/g, ".")
  } else if (commaCount > 0) {
    cleaned = cleaned.replace(/,/g, "")
  }
  const negative = /\(|\)|-/.test(cleaned) || /זיכוי|החזר|credit/i.test(raw)
  const numeric = parseFloat(cleaned.replace(/[^0-9.\-]/g, ""))
  if (Number.isNaN(numeric)) return null
  const absolute = Math.abs(numeric)
  return negative ? -absolute : absolute
}

function normalizeCurrency(value: unknown): string | undefined {
  if (!value) return undefined
  const str = String(value).trim()
  if (!str) return undefined
  const normalized = str.toLowerCase().replace(/[^a-zא-ת₪€£¥₩$]/g, "")
  if (!normalized) return undefined
  for (const [token, currency] of currencyLookup.entries()) {
    if (normalized.includes(token)) return currency
  }
  if (/nis|ils/.test(normalized)) return "ILS"
  if (/usd|dollar/.test(normalized)) return "USD"
  if (/eur/.test(normalized)) return "EUR"
  if (/gbp/.test(normalized)) return "GBP"
  if (/jpy|yen/.test(normalized)) return "JPY"
  if (/krw|won/.test(normalized)) return "KRW"
  return undefined
}

function splitTags(value: unknown): string[] | undefined {
  if (typeof value !== "string") return undefined
  const tokens = value
    .split(/[;,|]/)
    .map((token) => token.trim())
    .filter(Boolean)
  return tokens.length ? tokens : undefined
}

function cleanText(value: unknown): string {
  if (value == null) return ""
  const str = String(value)
  if (!str.trim()) return ""
  return normalizeHeader(str)
}

function detectRefund(...values: Array<unknown>): boolean {
  for (const value of values) {
    if (typeof value !== "string") continue
    const lower = value.toLowerCase()
    if (REFUND_TOKENS.some((token) => lower.includes(token))) {
      return true
    }
  }
  return false
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis !== "undefined" && globalThis.crypto && "subtle" in globalThis.crypto) {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }
  const { createHash } = await import("crypto")
  return createHash("sha256").update(input).digest("hex")
}

export interface CreditImportError {
  rowIndex: number
  message: string
  raw: Record<string, string>
}

export interface CreditImportResult {
  encoding: string
  delimiter: string
  rowsValid: number
  rowsSkipped: number
  expenses: ExpenseDTO[]
  preview: ExpenseDTO[]
  errors: CreditImportError[]
}

export async function parseCreditCsv(file: File, options: CsvParseOptions = {}): Promise<CreditImportResult> {
  const parsed = await parseCsv(file, options)
  if (!parsed.rows.length) {
    return {
      encoding: parsed.encoding,
      delimiter: parsed.delimiter,
      rowsValid: 0,
      rowsSkipped: 0,
      expenses: [],
      preview: [],
      errors: [
        {
          rowIndex: 0,
          message: "No rows detected. Ensure headers are present in the first row.",
          raw: {},
        },
      ],
    }
  }

  const mapping = mapHeaders(parsed.headers)
  if (process.env.NODE_ENV !== "production") {
    console.debug("credit-import: header mapping", mapping)
  }
  const expenses: ExpenseDTO[] = []
  const errors: CreditImportError[] = []

  for (let index = 0; index < parsed.rows.length; index += 1) {
    const row = parsed.rows[index]
    const rowNumber = index + 2 // account for header row

    const read = (key: keyof typeof HEADER_DICTIONARY) => {
      const column = mapping[key]
      if (!column) return ""
      return row[column] ?? ""
    }

    const rawDate = read("transactionDate") || read("billingDate")
    const rawMerchant = read("merchant")
    const rawCategory = read("category")
    const rawType = read("transactionType")
    const rawChargeAmount = read("chargeAmount")
    const rawOriginalAmount = read("originalAmount")
    const rawNotes = read("notes")
    const rawTags = read("tags")
    const rawMethod = read("method")
    const rawSource = read("source")
    const rawProvider = read("provider")
    const rawLast4 = read("cardLast4")
    const rawChargeCurrency = read("chargeCurrency")
    const rawOriginalCurrency = read("originalCurrency")
    const rawExchangeRate = read("exchangeRate")
    const billingDateRaw = read("billingDate")

    const date = parseDate(rawDate)
    if (!date) {
      errors.push({ rowIndex: rowNumber, message: "Missing or invalid transaction date", raw: row })
      continue
    }

    const merchant = cleanText(rawMerchant) || "Unknown Merchant"

    const chargeAmount = parseAmount(rawChargeAmount)
    const originalAmount = parseAmount(rawOriginalAmount)
    const exchangeRate = parseAmount(rawExchangeRate)

    let amount = chargeAmount
    let derivedCurrency = normalizeCurrency(rawChargeCurrency)

    if (amount == null || amount === 0) {
      if (originalAmount != null && exchangeRate != null && exchangeRate !== 0) {
        amount = originalAmount * exchangeRate
        derivedCurrency = normalizeCurrency(rawChargeCurrency) || "ILS"
      } else if (originalAmount != null) {
        amount = originalAmount
        derivedCurrency = normalizeCurrency(rawOriginalCurrency) || derivedCurrency
      }
    }

    if (amount == null || amount === 0) {
      errors.push({ rowIndex: rowNumber, message: "Missing amount for transaction", raw: row })
      continue
    }

    const refund = detectRefund(rawType, rawNotes, rawSource) || amount < 0
    const signedAmount = refund ? -Math.abs(amount) : Math.sign(amount) < 0 ? amount : Math.abs(amount)

    const currency = derivedCurrency || normalizeCurrency(rawOriginalCurrency) || inferCurrencyFromAmount(rawChargeAmount) || "ILS"

    const tags = splitTags(rawTags)
    const notes = rawNotes?.toString().trim() ? rawNotes.toString().trim() : undefined
    const method = rawMethod?.toString().trim() ? rawMethod.toString().trim() : undefined
    const category = rawCategory?.toString().trim() ? rawCategory.toString().trim() : undefined
    const cardLast4 = rawLast4 ? rawLast4.replace(/\D/g, "").slice(-4) : undefined

    const importHash = await sha256Hex(
      [date, merchant, signedAmount.toFixed(2), currency, cardLast4 ?? ""].join("|")
    )

    const expense: ExpenseDTO = {
      date,
      merchant,
      amount: Number(Number.isFinite(signedAmount) ? signedAmount.toFixed(2) : signedAmount),
      currency,
      category,
      notes,
      tags,
      method,
      cardLast4,
      importHash,
      source: {
        provider: cleanText(rawProvider) || cleanText(rawSource) || undefined,
        fileName: file.name,
        rowIndex: rowNumber,
        originalAmount: originalAmount ?? undefined,
        originalCurrency: normalizeCurrency(rawOriginalCurrency) || undefined,
        exchangeRate: exchangeRate ?? undefined,
        transactionType: rawType?.toString().trim() || undefined,
        billingDate: parseDate(billingDateRaw) ?? undefined,
        raw: row,
      },
    }

    expenses.push(expense)
  }

  return {
    encoding: parsed.encoding,
    delimiter: parsed.delimiter,
    rowsValid: expenses.length,
    rowsSkipped: errors.length,
    expenses,
    preview: expenses.slice(0, 10),
    errors,
  }
}

function inferCurrencyFromAmount(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  if (value.includes("₪")) return "ILS"
  if (value.includes("$")) return "USD"
  if (value.includes("€")) return "EUR"
  if (value.includes("£")) return "GBP"
  if (value.includes("¥")) return "JPY"
  if (value.includes("₩")) return "KRW"
  return undefined
}
