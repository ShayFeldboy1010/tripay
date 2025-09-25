import { parseCsv, type CsvParseOptions } from "../csv/parse"

export type CsvOptions = CsvParseOptions

export async function readCsvRows(file: File, opts: CsvOptions = {}): Promise<any[]> {
  const parsed = await parseCsv(file, opts)
  return parsed.rows
}
