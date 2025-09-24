// Hebrew-friendly CSV text loader with encoding + delimiter + header handling
import Papa from "papaparse";

const INVISIBLES = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B-\u200D\u2060\uFEFF]/g;

export type CsvOptions = {
  delimiter?: "auto" | ";" | "," | "tab";
  hasHeader?: boolean; // first row is header
};

function sanitize(text: string): string {
  // Drop Excel delimiter hint line "sep=;" if present
  const t = text.replace(/^\s*sep\s*=\s*.;?\s*$/im, "").replace(INVISIBLES, "");
  // Normalize newlines
  return t.replace(/\r\n?/g, "\n");
}

async function decodeWithFallback(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // 1) try utf-8
  let txt = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // If many replacement chars (�) -> try Windows-1255 then ISO-8859-8
  const bad = (txt.match(/\uFFFD/g) || []).length;
  if (bad > 3) {
    try {
      txt = new TextDecoder("windows-1255").decode(buf);
    } catch {
      try {
        txt = new TextDecoder("iso-8859-8").decode(buf);
      } catch {}
    }
  }
  return sanitize(txt);
}

function toDelimiter(opt: CsvOptions["delimiter"]): string | undefined {
  if (opt === ";") return ";";
  if (opt === ",") return ",";
  if (opt === "tab") return "\t";
  return undefined; // auto
}

export async function readCsvRows(file: File, opts: CsvOptions = { delimiter: "auto", hasHeader: true }): Promise<any[]> {
  const text = await decodeWithFallback(file);

  const doParse = (hasHeader: boolean) =>
    new Promise<any[]>((resolve, reject) => {
      Papa.parse(text, {
        worker: true,
        header: hasHeader,
        skipEmptyLines: "greedy",
        delimiter: toDelimiter(opts.delimiter),
        dynamicTyping: false,
        transformHeader: (h) => (h || "").replace(/^\uFEFF/, "").replace(INVISIBLES, "").trim(),
        complete: (res) => resolve((res.data as any[]) || []),
        error: reject,
      });
    });

  // 1st pass with user setting
  let rows = await doParse(!!opts.hasHeader);

  // If nothing came out, try the opposite header mode
  if (!rows || rows.length === 0) rows = await doParse(!opts.hasHeader);

  // If still none, try a different delimiter heuristic
  if (!rows || rows.length === 0) {
    const fallbacks: Array<CsvOptions["delimiter"]> = [";", ",", "tab"];
    for (const d of fallbacks) {
      rows = await new Promise<any[]>((resolve) => {
        Papa.parse(text, {
          worker: true,
          header: !!opts.hasHeader,
          skipEmptyLines: "greedy",
          delimiter: toDelimiter(d),
          transformHeader: (h) => (h || "").replace(/^\uFEFF/, "").replace(INVISIBLES, "").trim(),
          complete: (res) => resolve((res.data as any[]) || []),
        });
      });
      if (rows && rows.length) break;
    }
  }

  // If headerless arrays (Papa returns objects when header=true, arrays when false)
  if (rows && rows.length && Array.isArray(rows[0])) {
    // Convert to objects with Column_1..N keys using first row as header if it seems textual
    const arr = rows as string[][];
    const first = arr[0] || [];
    const looksLikeHeader = first.some((x) => isNaN(Number(String(x).replace(/[,\.\s]/g, ""))));
    const headers = looksLikeHeader ? first : first.map((_, i) => `Column_${i + 1}`);
    const start = looksLikeHeader ? 1 : 0;
    const objs = [];
    for (let i = start; i < arr.length; i++) {
      const o: any = {};
      headers.forEach((h, idx) => {
        o[String(h).trim()] = arr[i][idx];
      });
      objs.push(o);
    }
    return objs;
  }
  return rows || [];
}
