import Papa from "papaparse"
import { detectDelimiter, sniffEncoding, normalizeHeader, type SupportedEncoding } from "./sniff"

export interface CsvParseOptions {
  delimiter?: "auto" | "," | ";" | "tab"
  hasHeader?: boolean
}

export interface ParsedCsv {
  encoding: SupportedEncoding
  delimiter: "," | ";" | "\t"
  headers: string[]
  rows: Record<string, string>[]
  rawText: string
}

function resolveDelimiter(text: string, requested: CsvParseOptions["delimiter"]): "," | ";" | "\t" {
  if (!requested || requested === "auto") {
    return detectDelimiter(text).delimiter
  }
  if (requested === "tab") return "\t"
  return requested
}

function toHeaderArray(rows: Record<string, string>[]): string[] {
  if (!rows.length) return []
  const keys = Object.keys(rows[0])
  return keys.map((key) => key.trim())
}

export async function parseCsv(blob: Blob, options: CsvParseOptions = {}): Promise<ParsedCsv> {
  const arrayBuffer = await blob.arrayBuffer()
  const sniffed = sniffEncoding(arrayBuffer)
  if (process.env.NODE_ENV !== "production") {
    console.debug("csv: encoding detected", sniffed.encoding, { bom: sniffed.bom })
  }
  const delimiter = resolveDelimiter(sniffed.text, options.delimiter)
  if (process.env.NODE_ENV !== "production") {
    console.debug("csv: delimiter detected", JSON.stringify(delimiter))
  }

  const hasHeader = options.hasHeader ?? true

  return await new Promise<ParsedCsv>((resolve, reject) => {
    Papa.parse<any>(sniffed.text, {
      delimiter,
      header: hasHeader,
      skipEmptyLines: "greedy",
      transformHeader: (value) => normalizeHeader(value),
      dynamicTyping: false,
      complete: (result) => {
        let data: Record<string, string>[] = []
        if (hasHeader) {
          data = (result.data as Record<string, string>[]) || []
        } else {
          const rows = (result.data as string[][]) || []
          if (rows.length) {
            const first = rows[0]
            const looksLikeHeader = first.some((value) => /[A-Za-z\u0590-\u05FF]/.test(String(value)))
            const headers = looksLikeHeader ? first : first.map((_, index) => `Column ${index + 1}`)
            const startIndex = looksLikeHeader ? 1 : 0
            for (let index = startIndex; index < rows.length; index += 1) {
              const row = rows[index]
              const obj: Record<string, string> = {}
              headers.forEach((header, headerIndex) => {
                obj[normalizeHeader(String(header)) || `Column ${headerIndex + 1}`] = row?.[headerIndex] ?? ""
              })
              data.push(obj)
            }
          }
        }
        const headers = toHeaderArray(data)
        resolve({
          encoding: sniffed.encoding,
          delimiter,
          headers,
          rows: data,
          rawText: sniffed.text,
        })
      },
      error: (error) => reject(error),
    })
  })
}
