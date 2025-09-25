"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { parseCreditCsv, type CreditImportError, type CreditImportResult } from "./parseCreditCsv"
import type { ExpenseDTO } from "@/src/types/expense"
import type { NormalizedExpense, SupportedCurrency } from "@/src/types/import"
import { dedupe } from "@/src/lib/import/dedupe"

const SUPPORTED_CURRENCIES = new Set<SupportedCurrency>(["ILS", "KRW", "USD", "EUR", "JPY", "GBP"])

type Props = {
  open: boolean
  onClose: () => void
  onImport: (items: NormalizedExpense[]) => Promise<void>
  existing?: NormalizedExpense[]
}

const MAX_FILE_MB = 12

const formatterCache = new Map<string, Intl.NumberFormat>()

function formatAmount(amount: number, currency: string): string {
  const key = `${currency}|${Intl.NumberFormat().resolvedOptions().locale}`
  if (!formatterCache.has(key)) {
    try {
      formatterCache.set(
        key,
        new Intl.NumberFormat("he-IL", {
          style: "currency",
          currency: currency || "ILS",
          currencyDisplay: "symbol",
        }),
      )
    } catch {
      formatterCache.set(key, new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2, minimumFractionDigits: 2 }))
    }
  }
  const formatter = formatterCache.get(key)!
  const formatted = formatter.format(amount)
  if (/\d/.test(formatted)) return formatted
  return `${amount.toFixed(2)} ${currency}`
}

function toSupportedCurrency(value: string): SupportedCurrency {
  if (SUPPORTED_CURRENCIES.has(value as SupportedCurrency)) {
    return value as SupportedCurrency
  }
  return "ILS"
}

function toNormalizedExpense(dto: ExpenseDTO, options: { paidBy?: string }): NormalizedExpense {
  return {
    date: dto.date.includes("T") ? dto.date : new Date(dto.date).toISOString(),
    amount: Number(dto.amount),
    currency: toSupportedCurrency(dto.currency || "ILS"),
    description: dto.merchant,
    category: dto.category,
    notes: dto.notes,
    tags: dto.tags,
    method: dto.method,
    paidBy: options.paidBy,
    participants: options.paidBy ? [options.paidBy] : [],
    location: undefined,
    source: {
      provider: dto.source?.provider,
      cardLast4: dto.cardLast4,
      fileName: dto.source?.fileName,
      hash: dto.importHash,
      originalAmount: dto.source?.originalAmount,
      originalCurrency: dto.source?.originalCurrency,
      exchangeRate: dto.source?.exchangeRate,
      transactionType: dto.source?.transactionType,
      billingDate: dto.source?.billingDate ?? undefined,
      raw: dto.source?.raw,
    },
  }
}

export default function CreditImportDialog({ open, onClose, onImport, existing = [] }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreditImportResult | null>(null)
  const [rawExpenses, setRawExpenses] = useState<ExpenseDTO[]>([])
  const [errors, setErrors] = useState<CreditImportError[]>([])
  const [paidBy, setPaidBy] = useState<string>("")

  const [unique, duplicates] = useMemo(() => {
    if (!rawExpenses.length) return [[], []] as [NormalizedExpense[], NormalizedExpense[]]
    const normalized = rawExpenses.map((expense) => toNormalizedExpense(expense, { paidBy }))
    const { unique, dupes } = dedupe(normalized, existing)
    return [unique, dupes]
  }, [rawExpenses, paidBy, existing])

  const preview = useMemo(() => rawExpenses.slice(0, 10), [rawExpenses])

  const reset = useCallback(() => {
    setFile(null)
    setFileKey((key) => key + 1)
    setParsing(false)
    setImporting(false)
    setError(null)
    setResult(null)
    setRawExpenses([])
    setErrors([])
    setPaidBy("")
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const handleFileSelection = async (incoming: File | null) => {
    if (!incoming) return
    if (incoming.size / (1024 * 1024) > MAX_FILE_MB) {
      setError(`הקובץ גדול מדי (${(incoming.size / (1024 * 1024)).toFixed(1)}MB). המקסימום ${MAX_FILE_MB}MB.`)
      return
    }
    setParsing(true)
    setError(null)
    try {
      const parsed = await parseCreditCsv(incoming, { delimiter: "auto", hasHeader: true })
      setResult(parsed)
      setRawExpenses(parsed.expenses)
      setErrors(parsed.errors)
      setFile(incoming)
    } catch (err: any) {
      setError(err?.message || "שגיאת פענוח הקובץ")
      setResult(null)
      setRawExpenses([])
      setErrors([])
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!unique.length) return
    setImporting(true)
    setError(null)
    try {
      await onImport(unique)
      reset()
      onClose()
    } catch (err: any) {
      setError(err?.message || "ייבוא נכשל")
    } finally {
      setImporting(false)
    }
  }

  const rowsValid = result?.rowsValid ?? 0
  const rowsSkipped = result?.rowsSkipped ?? 0

  return !open ? null : (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative m-4 w-full max-h-[90vh] overflow-hidden rounded-[28px] border border-white/20 bg-white/80 p-4 text-neutral-900 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/70 dark:text-white md:w-[880px]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">ייבוא דוח אשראי</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">CSV בלבד · זיהוי אוטומטי של קידוד ו-Delimiter</p>
          </div>
          <button
            onClick={() => {
              onClose()
              reset()
            }}
            className="rounded-full bg-neutral-900/10 px-3 py-1 text-sm text-neutral-700 transition hover:bg-neutral-900/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            סגור
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-400/60 bg-white/70 p-5 text-center text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-900 dark:border-white/20 dark:bg-neutral-800/70 dark:text-neutral-200 dark:hover:border-white/40">
            <input
              key={fileKey}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                event.currentTarget.value = ""
                setResult(null)
                setRawExpenses([])
                setErrors([])
                handleFileSelection(selected)
              }}
            />
            {file ? (
              <>
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-300">{(file.size / 1024).toFixed(0)} KB</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">בחר/י קובץ CSV לייבוא</span>
                <span className="text-xs text-neutral-500">הקובץ ינותח לבד לזיהוי תווים והפרדה</span>
              </>
            )}
          </label>

          {result ? (
            <div className="grid gap-3 rounded-2xl border border-neutral-200/70 bg-white/80 p-4 text-sm text-neutral-700 shadow-inner dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-100 md:grid-cols-2">
              <div>
                <p>
                  <span className="font-medium">שורות תקינות:</span> {rowsValid}
                </p>
                <p>
                  <span className="font-medium">שורות שנדחו:</span> {rowsSkipped}
                </p>
                <p>
                  <span className="font-medium">שורות כפולות:</span> {duplicates.length}
                </p>
              </div>
              <div>
                <p>
                  <span className="font-medium">קידוד:</span> {result.encoding.toUpperCase()}
                </p>
                <p>
                  <span className="font-medium">Delimiter:</span> {result.delimiter === "\t" ? "TAB" : result.delimiter}
                </p>
                <p>
                  <span className="font-medium">ייבאו בפועל:</span> {unique.length}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-neutral-200/70 bg-white/80 p-4 text-sm text-neutral-700 shadow-inner dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-100 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                שיוך הוצאה למי שילם
              </label>
              <select
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-neutral-500 focus:outline-none dark:border-white/20 dark:bg-neutral-900 dark:text-white"
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
              >
                <option value="">בחר/י משתתף</option>
                <option value="ירון">ירון</option>
                <option value="אלונה">אלונה</option>
              </select>
            </div>
            <div className="flex flex-col justify-end text-xs text-neutral-600 dark:text-neutral-300">
              <p>ניתן לשנות שיוך לאחר הייבוא. במקרה של החזר, הסכום ישמר עם סימן מינוס.</p>
            </div>
          </div>

          {preview.length ? (
            <div className="rounded-2xl border border-neutral-200/70 bg-white/90 shadow-sm dark:border-white/10 dark:bg-neutral-800/70">
              <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-100">תצוגה מקדימה ({preview.length} מתוך {rawExpenses.length})</h3>
                <span className="text-xs text-neutral-500 dark:text-neutral-300">הסכומים כוללים זיהוי החזרים</span>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="min-w-full text-left text-xs text-neutral-600 dark:text-neutral-200">
                  <thead className="sticky top-0 bg-white/90 text-neutral-500 backdrop-blur dark:bg-neutral-900/80 dark:text-neutral-300">
                    <tr>
                      <th className="px-4 py-2">תאריך</th>
                      <th className="px-4 py-2">בית עסק</th>
                      <th className="px-4 py-2 text-right">סכום</th>
                      <th className="px-4 py-2">קטגוריה</th>
                      <th className="px-4 py-2">הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={`${row.importHash}-${index}`} className="border-t border-neutral-200/60 last:border-b dark:border-white/10">
                        <td className="px-4 py-2 text-neutral-700 dark:text-neutral-200">{row.date}</td>
                        <td className="px-4 py-2 text-neutral-800 dark:text-neutral-50">{row.merchant}</td>
                        <td className={`px-4 py-2 text-right font-medium ${row.amount < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-emerald-300"}`}>
                          {formatAmount(row.amount, row.currency)}
                        </td>
                        <td className="px-4 py-2 text-neutral-600 dark:text-neutral-300">{row.category || "—"}</td>
                        <td className="px-4 py-2 text-neutral-600 dark:text-neutral-300">{row.notes || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {errors.length ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
              <h3 className="mb-2 text-sm font-semibold">שורות שדולגו ({errors.length})</h3>
              <ul className="space-y-1 text-xs">
                {errors.map((err) => (
                  <li key={`${err.rowIndex}-${err.message}`} className="flex justify-between gap-2">
                    <span>שורה {err.rowIndex}</span>
                    <span className="text-right">{err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-300 bg-red-100/70 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-neutral-200/70 pt-3 text-sm dark:border-white/10 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-neutral-500 dark:text-neutral-300">
            {parsing ? "מנתח את הקובץ..." : `מוכנים לייבוא ${unique.length} רשומות ייחודיות מתוך ${rowsValid} תקינות.`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={parsing || importing}
              className="rounded-full border border-neutral-300 bg-white/80 px-4 py-2 text-sm text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-white/40"
            >
              אפס
            </button>
            <button
              onClick={handleImport}
              disabled={!unique.length || parsing || importing}
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500/60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {importing ? "מייבא..." : `ייבוא (${unique.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
