"use client"

import Papa from "papaparse"
import type { Expense } from "@/lib/supabase/client"
import type { PDFFont } from "pdf-lib"

type PdfLibModule = typeof import("pdf-lib")

const PDF_LIB_CDN_URL = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm"

let cachedPdfLib: PdfLibModule | null = null

export const PDF_LIBRARY_UNAVAILABLE_ERROR = "PDF generation library is unavailable"

function resolvePdfLibModule(module: unknown): PdfLibModule {
  if (module && typeof module === "object") {
    if ("PDFDocument" in module) {
      return module as PdfLibModule
    }

    if ("default" in module) {
      const defaultExport = (module as { default?: unknown }).default
      if (defaultExport && typeof defaultExport === "object" && "PDFDocument" in defaultExport) {
        return defaultExport as PdfLibModule
      }
    }
  }

  throw new Error(PDF_LIBRARY_UNAVAILABLE_ERROR)
}

async function loadPdfLib(): Promise<PdfLibModule> {
  if (cachedPdfLib) {
    return cachedPdfLib
  }

  try {
    const pdfLibModule = resolvePdfLibModule(await import("pdf-lib"))
    cachedPdfLib = pdfLibModule
    return pdfLibModule
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    const isModuleMissing = /Cannot find module|module not found|resolve 'pdf-lib'/i.test(message)

    if (!isModuleMissing) {
      throw error
    }

    console.warn(
      "[export-reports] Failed to load local pdf-lib module, attempting CDN fallback...",
      error,
    )

    try {
      const pdfLibModule = resolvePdfLibModule(
        await import(/* webpackIgnore: true */ PDF_LIB_CDN_URL),
      )
      cachedPdfLib = pdfLibModule
      return pdfLibModule
    } catch (fallbackError) {
      console.error(
        "[export-reports] Unable to load pdf-lib from CDN fallback.",
        fallbackError,
      )
      throw new Error(PDF_LIBRARY_UNAVAILABLE_ERROR)
    }
  }
}

const FALLBACK_CURRENCY = "ILS"

function resolveCurrency(currency?: string | null): string {
  const normalized = currency?.trim().toUpperCase()
  if (!normalized) {
    return FALLBACK_CURRENCY
  }
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: normalized }).format(1)
    return normalized
  } catch (error) {
    console.warn(`Unsupported currency '${currency}', falling back to ${FALLBACK_CURRENCY}.`, error)
    return FALLBACK_CURRENCY
  }
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
}

function assertBrowserEnvironment() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Report exporting is only available in the browser")
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  assertBrowserEnvironment()

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getExpenseDate(expense: Expense): Date | null {
  const source = expense.date || expense.created_at
  const parsed = source ? new Date(source) : null
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

function truncateToWidth(text: string, maxWidth: number, font: PDFFont, size: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text
  }
  let truncated = text
  while (truncated.length > 0 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated.length > 0 ? `${truncated}…` : text.slice(0, 1)
}

export async function downloadExpenseSummaryPDF(
  expenses: Expense[],
  options?: { tripName?: string; currency?: string | null },
) {
  assertBrowserEnvironment()

  if (!expenses.length) {
    throw new Error("No expenses to export")
  }

  const currency = resolveCurrency(options?.currency)
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)

  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib()

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage()
  let pageHeight = page.getHeight()
  const margin = 40
  let cursorY = pageHeight - margin

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded < margin) {
      page = pdfDoc.addPage()
      pageHeight = page.getHeight()
      cursorY = pageHeight - margin
    }
  }

  const drawText = (
    text: string,
    {
      font = regularFont,
      size = 12,
      color = rgb(34 / 255, 41 / 255, 57 / 255),
      lineGap = 6,
      x = margin,
    }: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; lineGap?: number; x?: number } = {},
  ) => {
    ensureSpace(size + lineGap)
    page.drawText(text, { x, y: cursorY, size, font, color })
    cursorY -= size + lineGap
  }

  const sortedExpenses = [...expenses].sort((a, b) => {
    const aDate = getExpenseDate(a)?.getTime() ?? 0
    const bDate = getExpenseDate(b)?.getTime() ?? 0
    return aDate - bDate
  })

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const averageExpense = totalAmount / expenses.length
  const uniquePayers = new Set(expenses.map((e) => e.paid_by).filter(Boolean)).size
  const uniqueCategories = new Set(expenses.map((e) => e.category).filter(Boolean)).size

  const categories = expenses.reduce(
    (acc, expense) => {
      const key = expense.category || "Uncategorized"
      acc[key] = (acc[key] || 0) + expense.amount
      return acc
    },
    {} as Record<string, number>,
  )

  const topCategories = Object.entries(categories)
    .sort(([, aTotal], [, bTotal]) => bTotal - aTotal)
    .slice(0, 3)

  const generatedAt = new Date()
  const title = options?.tripName ? `${options.tripName} — Expense Summary` : "Expense Summary"

  drawText(title, { font: boldFont, size: 20, lineGap: 12 })
  drawText(`Generated on ${generatedAt.toLocaleString()}`, { size: 11, color: rgb(120 / 255, 128 / 255, 146 / 255) })
  drawText("Summary", { font: boldFont, size: 14, lineGap: 10 })
  drawText(`Total spent: ${formatCurrency(totalAmount)}`)
  drawText(`Number of expenses: ${expenses.length}`)
  drawText(`Average per expense: ${formatCurrency(averageExpense)}`)
  drawText(`Contributors recorded: ${uniquePayers}`)
  drawText(`Categories tracked: ${uniqueCategories}`)

  if (topCategories.length > 0) {
    drawText("Top categories:", { font: boldFont, size: 12, lineGap: 8 })
    topCategories.forEach(([name, amount]) => {
      drawText(`• ${name}: ${formatCurrency(amount)}`, { size: 11, lineGap: 4 })
    })
  }

  drawText("Expenses", { font: boldFont, size: 14, lineGap: 10 })

  const tableTextColor = rgb(34 / 255, 41 / 255, 57 / 255)
  const headerBackground = rgb(34 / 255, 41 / 255, 57 / 255)
  const headerTextColor = rgb(1, 1, 1)
  const stripeBackground = rgb(245 / 255, 247 / 255, 250 / 255)

  const columnGap = 8
  const columns = [
    { width: 60 },
    { width: 135 },
    { width: 65 },
    { width: 75 },
    { width: 80 },
    { width: 60, align: "right" as const },
  ]

  const tableWidth = columns.reduce((total, column) => total + column.width, 0) + columnGap * (columns.length - 1)

  let tableCursorY = cursorY - 10

  const ensureTableSpace = (heightNeeded: number) => {
    if (tableCursorY - heightNeeded < margin) {
      page = pdfDoc.addPage()
      pageHeight = page.getHeight()
      cursorY = pageHeight - margin
      tableCursorY = cursorY
      return true
    }
    return false
  }

  type DrawRowOptions = {
    bold?: boolean
    isHeader?: boolean
    backgroundColor?: ReturnType<typeof rgb>
    textColor?: ReturnType<typeof rgb>
  }

  const drawRow = (cells: string[], opts: DrawRowOptions = {}) => {
    const font = opts.bold ? boldFont : regularFont
    const size = 10
    const paddingX = 6
    const paddingY = 4
    const rowHeight = size + paddingY * 2
    const newPageStarted = ensureTableSpace(rowHeight)
    if (newPageStarted && !opts.isHeader) {
      drawHeader()
    }

    const rowBottom = tableCursorY - rowHeight

    if (opts.backgroundColor) {
      page.drawRectangle({ x: margin, y: rowBottom, width: tableWidth, height: rowHeight, color: opts.backgroundColor })
    }

    let x = margin
    cells.forEach((text, index) => {
      const column = columns[index]
      if (!column) return

      const availableWidth = Math.max(column.width - paddingX * 2, 0)
      const truncated = truncateToWidth(text, availableWidth, font, size)

      let textX = x + paddingX
      if (column.align === "right") {
        const textWidth = font.widthOfTextAtSize(truncated, size)
        textX = x + column.width - paddingX - textWidth
      } else if (column.align === "center") {
        const textWidth = font.widthOfTextAtSize(truncated, size)
        textX = x + (column.width - textWidth) / 2
      }

      page.drawText(truncated, {
        x: textX,
        y: rowBottom + paddingY,
        size,
        font,
        color: opts.textColor ?? tableTextColor,
      })

      x += column.width + columnGap
    })

    tableCursorY = rowBottom
  }

  function drawHeader() {
    drawRow(["Date", "Title", "Category", "Location", "Payers", "Amount"], {
      bold: true,
      isHeader: true,
      backgroundColor: headerBackground,
      textColor: headerTextColor,
    })
  }

  drawHeader()

  sortedExpenses.forEach((expense, index) => {
    const date = getExpenseDate(expense)
    const formattedDate = date ? date.toLocaleDateString() : ""
    const location = expense.location?.trim() || "Unspecified"
    const payers = Array.isArray(expense.payers) && expense.payers.length > 0
      ? expense.payers.join(", ")
      : expense.paid_by || (expense.is_shared_payment ? "Shared" : "-")

    drawRow(
      [
        formattedDate,
        expense.title || "Untitled",
        expense.category || "Uncategorized",
        location,
        payers,
        formatCurrency(expense.amount),
      ],
      index % 2 === 0
        ? {
            backgroundColor: stripeBackground,
          }
        : undefined,
    )
  })

  cursorY = tableCursorY

  const fileBase = slugify(options?.tripName || "trip") || "trip"
  const fileName = `${fileBase}-expense-summary.pdf`
  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: "application/pdf" })
  triggerDownload(blob, fileName)
}

export function downloadExpensesByDateCSV(
  expenses: Expense[],
  options?: { tripName?: string; currency?: string | null },
) {
  assertBrowserEnvironment()

  if (!expenses.length) {
    throw new Error("No expenses to export")
  }

  const sortedExpenses = [...expenses].sort((a, b) => {
    const aDate = getExpenseDate(a)?.getTime() ?? 0
    const bDate = getExpenseDate(b)?.getTime() ?? 0
    return aDate - bDate
  })

  const rows = sortedExpenses.map((expense) => {
    const date = getExpenseDate(expense)
    const formattedDate = date ? date.toLocaleDateString() : ""
    const location = expense.location?.trim() || "Unspecified"
    const payers = Array.isArray(expense.payers) && expense.payers.length > 0
      ? expense.payers.join(", ")
      : expense.paid_by || (expense.is_shared_payment ? "Shared" : "-")

    return {
      Date: formattedDate,
      Title: expense.title || "Untitled",
      Amount: expense.amount.toFixed(2),
      Category: expense.category || "Uncategorized",
      Location: location,
      Payers: payers,
    }
  })

  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const fileBase = slugify(options?.tripName || "trip") || "trip"
  const fileName = `${fileBase}-expenses-by-date.csv`
  triggerDownload(blob, fileName)
}
