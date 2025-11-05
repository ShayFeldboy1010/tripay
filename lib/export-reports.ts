"use client"

import Papa from "papaparse"
import type { Expense } from "@/lib/supabase/client"
import type { PDFFont } from "pdf-lib"

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

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage()
  let pageHeight = page.getHeight()
  const margin = 50
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

  const columnGap = 12
  const columns = [
    { width: 90 },
    { width: 210 },
    { width: 110 },
    { width: 110 },
    { width: 70 },
  ]

  const drawRow = (cells: string[], opts: { bold?: boolean } = {}) => {
    const font = opts.bold ? boldFont : regularFont
    const size = 10
    const rowHeight = size + 6
    ensureSpace(rowHeight)
    let x = margin
    cells.forEach((text, index) => {
      const column = columns[index]
      const maxWidth = column.width
      const truncated = truncateToWidth(text, maxWidth, font, size)
      if (index === cells.length - 1) {
        const textWidth = font.widthOfTextAtSize(truncated, size)
        page.drawText(truncated, {
          x: x + maxWidth - textWidth,
          y: cursorY,
          size,
          font,
          color: rgb(34 / 255, 41 / 255, 57 / 255),
        })
      } else {
        page.drawText(truncated, {
          x,
          y: cursorY,
          size,
          font,
          color: rgb(34 / 255, 41 / 255, 57 / 255),
        })
      }
      x += maxWidth + columnGap
    })
    cursorY -= rowHeight
  }

  drawRow(["Date", "Title", "Category", "Paid By", "Amount"], { bold: true })

  sortedExpenses.forEach((expense) => {
    const date = getExpenseDate(expense)
    const formattedDate = date ? date.toLocaleDateString() : ""
    const paidBy = expense.paid_by || (expense.is_shared_payment ? "Shared" : "-")
    drawRow([
      formattedDate,
      expense.title || "Untitled",
      expense.category || "Uncategorized",
      paidBy,
      formatCurrency(expense.amount),
    ])
  })

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

  const currency = resolveCurrency(options?.currency)

  const summary = expenses.reduce(
    (acc, expense) => {
      const date = getExpenseDate(expense)
      if (!date) {
        return acc
      }
      const key = date.toISOString().slice(0, 10)
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0 }
      }
      acc[key].total += expense.amount
      acc[key].count += 1
      return acc
    },
    {} as Record<string, { total: number; count: number }>,
  )

  const rows = Object.entries(summary)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, data]) => ({
      Date: date,
      "Total Amount": data.total.toFixed(2),
      "Expenses Count": data.count,
      "Average Amount": (data.total / data.count).toFixed(2),
      Currency: currency,
    }))

  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const fileBase = slugify(options?.tripName || "trip") || "trip"
  const fileName = `${fileBase}-expenses-by-date.csv`
  triggerDownload(blob, fileName)
}
