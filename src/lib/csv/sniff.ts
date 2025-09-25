const INVISIBLE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B-\u200D\u2060\uFEFF]/g
const SEPARATOR_HINT = /^\s*sep\s*=\s*([^\n]+)$/im

export type SupportedEncoding = "utf-8" | "windows-1255" | "iso-8859-8"

export interface SniffedText {
  encoding: SupportedEncoding
  bom: boolean
  text: string
}

export interface DetectedDelimiter {
  delimiter: "," | ";" | "\t"
  confidence: number
}

function stripBom(input: Uint8Array): Uint8Array {
  if (input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
    return input.subarray(3)
  }
  return input
}

function decode(buffer: ArrayBuffer, encoding: SupportedEncoding): string {
  return new TextDecoder(encoding, { fatal: false }).decode(buffer)
}

function countReplacement(text: string): number {
  return (text.match(/\uFFFD/g) || []).length
}

export function sanitize(text: string): string {
  const withoutHint = text.replace(SEPARATOR_HINT, "").replace(/^[\ufeff]+/, "")
  const normalized = withoutHint.replace(/\r\n?/g, "\n")
  return normalized.replace(INVISIBLE, "")
}

export function sniffEncoding(buffer: ArrayBuffer): SniffedText {
  const bytes = new Uint8Array(buffer)
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const withoutBom = bom ? stripBom(bytes) : bytes

  let encoding: SupportedEncoding = "utf-8"
  let text = decode(withoutBom, "utf-8")
  let replacements = countReplacement(text)

  if (replacements > 3) {
    for (const candidate of ["windows-1255", "iso-8859-8"] as const) {
      try {
        const attempt = decode(buffer, candidate)
        const penalty = countReplacement(attempt)
        if (penalty < replacements || replacements > 100) {
          encoding = candidate
          text = attempt
          replacements = penalty
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("csv: failed decoding with", candidate, err)
        }
      }
    }
  }

  return {
    encoding,
    bom,
    text: sanitize(text),
  }
}

function scoreDelimiter(line: string, delimiter: string): number {
  if (!line) return 0
  let count = 0
  for (const ch of line) {
    if (ch === delimiter) count += 1
  }
  return count
}

export function detectDelimiter(text: string): DetectedDelimiter {
  const candidates: Array<"," | ";" | "\t"> = [",", ";", "\t"]
  const lines = text.split(/\n+/).filter((line) => line.trim().length > 0).slice(0, 25)
  if (!lines.length) {
    return { delimiter: ",", confidence: 0 }
  }

  const totals = new Map<string, { score: number; hits: number }>()
  for (const candidate of candidates) {
    totals.set(candidate, { score: 0, hits: 0 })
  }

  for (const line of lines) {
    for (const candidate of candidates) {
      const lineScore = scoreDelimiter(line, candidate)
      if (lineScore > 0) {
        const entry = totals.get(candidate)!
        entry.score += lineScore
        entry.hits += 1
      }
    }
  }

  let best: DetectedDelimiter = { delimiter: ",", confidence: 0 }
  for (const candidate of candidates) {
    const entry = totals.get(candidate)!
    if (!entry.hits) continue
    const confidence = entry.score / entry.hits
    if (confidence > best.confidence) {
      best = { delimiter: candidate, confidence }
    }
  }

  if (best.confidence === 0) {
    const fallback = candidates.find((candidate) => totals.get(candidate)?.hits) || ","
    return { delimiter: fallback, confidence: 0 }
  }

  return best
}

export function normalizeHeader(header: string): string {
  return header.replace(INVISIBLE, "").replace(/["'`]/g, "").replace(/\s+/g, " ").trim()
}
