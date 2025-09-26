"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from "react"
import { parseCreditCsv, type CreditImportError, type CreditImportResult } from "./parseCreditCsv"
import type { ExpenseDTO } from "@/src/types/expense"
import type { NormalizedExpense, SupportedCurrency } from "@/src/types/import"
import { dedupe } from "@/src/lib/import/dedupe"
import { Modal } from "@/components/Modal"

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
  const titleId = useId()
  const descriptionId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const bottomInsetClass = "pb-[calc(var(--bottom-ui)+var(--safe-bottom))]" // TODO(shay): verify nav height

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose()
        reset()
      }}
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={titleRef}
      contentClassName="w-full max-w-[900px] rounded-[32px] border border-[color:var(--chat-border-soft)]/70 bg-[color:var(--chat-bg-card)]/95"
    >
      <div className="flex min-100dvh min-vh flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-card)]/92 px-6 py-5 backdrop-blur">
          <div>
            <h2
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
              className="text-xl font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              ייבוא דוח אשראי
            </h2>
            <p id={descriptionId} className="text-sm text-[color:var(--chat-text-muted)]">
              CSV בלבד · זיהוי אוטומטי של קידוד ו-Delimiter
            </p>
          </div>
          <button
            onClick={() => {
              onClose()
              reset()
            }}
            className="rounded-full border border-[color:var(--chat-border-soft)]/70 bg-black/30 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            סגור
          </button>
        </header>
        <div
          className={`flex-1 overflow-y-auto [overscroll-behavior:contain] ${bottomInsetClass}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="space-y-4 px-6 py-5">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--chat-border-soft)]/70 bg-[color:var(--chat-bg-card)]/80 px-6 py-6 text-center text-white/90 shadow-[0_18px_44px_rgba(4,7,18,0.45)] transition hover:border-[color:var(--chat-primary)]/60 hover:shadow-[0_22px_52px_rgba(14,24,48,0.65)] focus-within:outline-none focus-within:ring-2 focus-within:ring-brand">
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
                  <span className="text-sm font-medium text-white">{file.name}</span>
                  <span className="text-xs text-[color:var(--chat-text-muted)]">{(file.size / 1024).toFixed(0)} KB</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-white">בחר/י קובץ CSV לייבוא</span>
                  <span className="text-xs text-[color:var(--chat-text-muted)]">הקובץ ינותח לבד לזיהוי תווים והפרדה</span>
                </>
              )}
            </label>

            {result ? (
              <div className="grid gap-4 rounded-2xl border border-[color:var(--chat-border-soft)]/60 bg-black/35 p-4 text-sm text-white/90 shadow-[0_16px_40px_rgba(6,10,22,0.5)] md:grid-cols-2">
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold text-white">שורות תקינות:</span> {rowsValid}
                  </p>
                  <p>
                    <span className="font-semibold text-white">שורות שנדחו:</span> {rowsSkipped}
                  </p>
                  <p>
                    <span className="font-semibold text-white">שורות כפולות:</span> {duplicates.length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold text-white">קידוד:</span> {result.encoding.toUpperCase()}
                  </p>
                  <p>
                    <span className="font-semibold text-white">Delimiter:</span> {result.delimiter === "\t" ? "TAB" : result.delimiter}
                  </p>
                  <p>
                    <span className="font-semibold text-white">ייבאו בפועל:</span> {unique.length}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 rounded-2xl border border-[color:var(--chat-border-soft)]/60 bg-black/35 p-4 text-sm text-white/80 shadow-[0_16px_40px_rgba(6,10,22,0.5)] md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--chat-text-muted)]">
                  שיוך הוצאה למי שילם
                </label>
                <select
                  className="w-full rounded-xl border border-[color:var(--chat-border-soft)]/70 bg-[color:var(--chat-bg-card)]/70 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand"
                  value={paidBy}
                  onChange={(event) => setPaidBy(event.target.value)}
                >
                  <option value="">בחר/י משתתף</option>
                  <option value="ירון">ירון</option>
                  <option value="אלונה">אלונה</option>
                </select>
              </div>
              <div className="flex flex-col justify-end text-xs text-[color:var(--chat-text-muted)]">
                <p>ניתן לשנות שיוך לאחר הייבוא. במקרה של החזר, הסכום ישמר עם סימן מינוס.</p>
              </div>
            </div>

            {preview.length ? (
              <div className="rounded-2xl border border-[color:var(--chat-border-soft)]/60 bg-black/35 shadow-[0_16px_40px_rgba(6,10,22,0.5)]">
                <div className="flex items-center justify-between border-b border-[color:var(--chat-border-soft)]/60 px-4 py-3">
                  <h3 className="text-sm font-semibold text-white">תצוגה מקדימה ({preview.length} מתוך {rawExpenses.length})</h3>
                  <span className="text-xs text-[color:var(--chat-text-muted)]">הסכומים כוללים זיהוי החזרים</span>
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-full text-left text-xs text-[color:var(--chat-text-muted)]">
                    <thead className="sticky top-0 bg-[color:var(--chat-bg-card)]/95 text-white">
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
                        <tr key={`${row.importHash}-${index}`} className="border-t border-[color:var(--chat-border-soft)]/60 text-white last:border-b">
                          <td className="px-4 py-2 text-[color:var(--chat-text-muted)]">{row.date}</td>
                          <td className="px-4 py-2 text-white">{row.merchant}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${row.amount < 0 ? "text-red-400" : "text-emerald-300"}`}>
                            {formatAmount(row.amount, row.currency)}
                          </td>
                          <td className="px-4 py-2 text-[color:var(--chat-text-muted)]">{row.category || "—"}</td>
                          <td className="px-4 py-2 text-[color:var(--chat-text-muted)]">{row.notes || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {errors.length ? (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
                <h3 className="mb-2 text-sm font-semibold text-red-200">שורות שדולגו ({errors.length})</h3>
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
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-[color:var(--chat-border-soft)]/60 bg-[color:var(--chat-bg-card)]/92 px-6 pb-[calc(24px+var(--safe-bottom))] pt-4 backdrop-blur">
          <div className="flex flex-col gap-3 text-sm text-[color:var(--chat-text-muted)] md:flex-row md:items-center md:justify-between">
            <div>
              {parsing ? "מנתח את הקובץ..." : `מוכנים לייבוא ${unique.length} רשומות ייחודיות מתוך ${rowsValid} תקינות.`}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={reset}
                disabled={parsing || importing}
                className="min-h-[48px] rounded-full border border-[color:var(--chat-border-soft)]/70 bg-transparent px-5 text-sm font-semibold text-white transition hover:border-[color:var(--chat-primary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                אפס
              </button>
              <button
                onClick={handleImport}
                disabled={!unique.length || parsing || importing}
                className="min-h-[48px] w-full rounded-full bg-[color:var(--chat-primary)] px-6 text-sm font-semibold text-black transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:bg-white/30 sm:w-auto"
              >
                {importing ? "מייבא..." : `ייבוא (${unique.length})`}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </Modal>
  )
}
