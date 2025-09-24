import Papa from "papaparse";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

const he = {
  date: ["תאריך", "תאריך עסקה", "מועד עסקה", "מועד חיוב"],
  amount: ["סכום", "סכום עסקה", "סכום חיוב", "סכום בשקלים", "יתרה"],
  desc: ["תיאור", "שם בית עסק", "בית עסק", "פירוט"],
  currency: ["מטבע", "מטבע עסקה"],
  last4: ["4 ספרות", "ארבע ספרות", "מספר כרטיס", "כרטיס"],
  type: ["חייב/זכות", "סוג תנועה", "דביט/קרדיט"]
};

const en = {
  date: ["Date","Transaction Date","Posting Date"],
  amount: ["Amount","Transaction Amount","Debit","Credit"],
  desc: ["Description","Merchant","Details","Memo"],
  currency: ["Currency"],
  last4: ["Card Last4","Card","Last4","Account"],
  type: ["Type","Dr/Cr"]
};

const pick = (row:any, keys:string[]) =>
  keys.find(k => k in row) ? row[keys.find(k => k in row)!] : undefined;

export function parseAmount(v:any): number {
  if (v == null) return 0;
  const s = String(v).replace(/[\,\s₪$€£₩¥]/g,"").replace(/[()]/g,"");
  const n = Number(s.replace(/[^\d.-]/g,""));
  return isNaN(n) ? 0 : n;
}
export function parseDateGuess(v:any): string {
  if (!v) return new Date().toISOString();
  // support dd/mm/yyyy, yyyy-mm-dd etc.
  const s = String(v).trim().replace(/\./g,"/").replace(/-/g,"/");
  const parts = s.match(/\d{1,4}/g) || [];
  const guess = dayjs(s, ["DD/MM/YYYY","D/M/YYYY","YYYY/MM/DD","YYYY/M/D","MM/DD/YYYY","M/D/YYYY"], true);
  return (guess.isValid() ? guess.toDate() : new Date()).toISOString();
}

export async function parseCSV(file:File){
  return new Promise<any[]>((resolve, reject)=>{
    Papa.parse(file, {
      header:true, skipEmptyLines:true, encoding:"utf-8",
      complete:(res)=>resolve(res.data as any[]),
      error:reject
    });
  });
}

export async function parseXLSX(file:File){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:"array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval:"" }) as any[];
}

export async function parseOFX(file:File){
  const text = await file.text();
  const { parse } = await import("ofx-parse");
  const data:any = parse(text);
  const tx = (data?.transactions || []).map((t:any)=>({
    Date: t.date, Amount: t.amount, Description: t.name || t.memo, Currency: t.currency || ""
  }));
  return tx;
}

export async function parseFile(file:File){
  const ext = file.name.toLowerCase().split(".").pop()!;
  if (ext === "csv") return parseCSV(file);
  if (ext === "xlsx" || ext === "xls") return parseXLSX(file);
  if (ext === "ofx" || ext === "qfx") return parseOFX(file);
  // future: pdf -> server parsing
  return [];
}

export function toNormalized(rows:any[], fileName?:string){
  const out = [];
  for (const r of rows){
    const v = (k:string[]) => pick(r, k);
    const rawAmt = v([...he.amount, ...en.amount]);
    let amount = parseAmount(rawAmt);
    // If CSV splits debit/credit, prefer signed:
    if ("Debit" in r && r["Debit"]) amount = parseAmount(r["Debit"]);
    if ("Credit" in r && r["Credit"]) amount = -parseAmount(r["Credit"]);
    // Hebrew חייב/זכות:
    const typ = (v([...he.type, ...en.type]) || "").toString();
    if (/זכות|Credit/i.test(typ) && amount > 0) amount = -amount;

    const description = (v([...he.desc, ...en.desc]) || "").toString().trim();
    const date = parseDateGuess(v([...he.date, ...en.date]));
    const currency = (v([...he.currency, ...en.currency]) || "").toString().trim() || "ILS";
    const last4 = (v([...he.last4, ...en.last4]) || "").toString().replace(/\D/g,"").slice(-4);

    const src = JSON.stringify({date, amount, description, currency, last4}).toLowerCase();
    const hash = cryptoHash(src);

    out.push({
      date, amount: Math.abs(amount), // store positive; app decides “Paid by…”
      currency, description,
      category: undefined, participants: [],
      source: { provider: "", cardLast4: last4, fileName, hash }
    });
  }
  return out;
}

export function cryptoHash(s:string){
  let h = 0, i = 0, len = s.length;
  while (i < len) { h = ((h<<5)-h) + s.charCodeAt(i++) | 0; }
  return Math.abs(h).toString(16);
}
