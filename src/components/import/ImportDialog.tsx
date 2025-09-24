"use client";

import React, { useMemo, useRef, useState } from "react";
import { parseFile, toNormalized, type Mapping } from "../../lib/import/parsers";
import { dedupe } from "../../lib/import/dedupe";
import type { NormalizedExpense, SupportedCurrency } from "../../types/import";

const MAX_FILE_MB = 8;
const ACCEPT = ".csv,.xlsx,.xls,.ofx,.qfx";

// TODO: wire to your real participants store:
function useParticipants() {
  const [list, setList] = useState<string[]>(["ירון", "אלונה"]);
  return { list, add: (name: string) => setList((prev) => [...prev, name]) };
}

const currencyOptions: SupportedCurrency[] = ["ILS", "KRW", "USD", "EUR", "JPY", "GBP"];

export default function ImportDialog({
  open,
  onClose,
  onImport,
  existing = [],
}: {
  open: boolean;
  onClose: () => void;
  onImport: (items: NormalizedExpense[]) => Promise<void>;
  existing?: NormalizedExpense[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [preview, setPreview] = useState<NormalizedExpense[]>([]);
  const [stats, setStats] = useState<{ unique: number; dupes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState<string>("");
  const parseTokenRef = useRef(0);

  const [mapping, setMapping] = useState<Mapping>({});
  const [defaultCurrency, setDefaultCurrency] = useState<SupportedCurrency>("ILS");
  const { list: participants, add: addParticipant } = useParticipants();
  const [paidBy, setPaidBy] = useState<string>("");

  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);

  const scheduleReset = () => {
    setTimeout(() => {
      parseTokenRef.current += 1;
      setFile(null);
      setRows([]);
      setPreview([]);
      setStats(null);
      setError("");
      setLoading(false);
      setFileKey((k) => k + 1);
      setPaidBy("");
    }, 0);
  };

  const handleDialogClose = () => {
    onClose();
    scheduleReset();
  };

  function buildPreview(){
    if (!rows.length) {
      setError("לא נטענו נתונים. בחר/י קובץ קודם.");
      setStats(null);
      setPreview([]);
      return;
    }
    if (!paidBy) {
      setError("בחר/י למי לשייך את ההוצאות (paidBy).");
      return;
    }
    try {
      setError("");
      const norm = toNormalized(rows, file?.name, { mapping, defaultCurrency, paidBy });
      const { unique, dupes } = dedupe(norm, existing);
      setPreview(unique);
      setStats({ unique: unique.length, dupes: dupes.length });
    } catch (err: any) {
      setError(`שגיאת תצוגה מוקדמת: ${err?.message || err}`);
      setPreview([]);
      setStats(null);
    }
  }

  async function handleImport(){
    if (!preview.length) return;
    setLoading(true);
    setError("");
    try{
      await onImport(preview);
      handleDialogClose();
    }catch(err: any){
      setError(`ייבוא נכשל: ${err?.message || err}`);
    }finally{
      setLoading(false);
    }
  }

  return open ? (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 overlay-dim" onClick={handleDialogClose} />
      <div className="glass-strong w-full md:w-[760px] max-h-[86vh] overflow-hidden rounded-[28px] m-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">ייבוא דוח אשראי</h2>
          <button onClick={handleDialogClose} className="glass-sm rounded-full px-3 py-1.5">
            סגור
          </button>
        </div>

        {/* Step 1: file */}

        <label className="block glass-sm cursor-pointer rounded-2xl border border-white/20 bg-slate-900/75 p-4 text-center transition hover:bg-slate-900/85">
          <input
            key={fileKey}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = "";
              setError("");
              setFile(null);
              setRows([]);
              setPreview([]);
              setStats(null);
              if (!f) return;
              const mb = f.size / (1024 * 1024);
              if (mb > MAX_FILE_MB) {
                setError(`הקובץ גדול מדי (${mb.toFixed(1)}MB). המקסימום ${MAX_FILE_MB}MB.`);
                setFileKey((k) => k + 1);
                return;
              }
              if (!ACCEPT.split(",").some((ext) => f.name.toLowerCase().endsWith(ext.trim()))) {
                setError("סוג קובץ לא נתמך. יש לבחור CSV/XLSX/OFX/QFX.");
                setFileKey((k) => k + 1);
                return;
              }
              const token = ++parseTokenRef.current;
              setLoading(true);
              try {
                const parsed = await parseFile(f);
                if (token !== parseTokenRef.current) {
                  return;
                }
                if (!parsed || parsed.length === 0) {
                  setError("לא זוהו שורות בקובץ. בדקו שהכותרות בשורה הראשונה ושאין קידוד חריג.");
                  setFileKey((k) => k + 1);
                  setLoading(false);
                  return;
                }
                setFile(f);
                setRows(parsed);
              } catch (err: any) {
                if (token === parseTokenRef.current) {
                  setError(`שגיאת קריאה/פענוח: ${err?.message || err}`);
                  setFileKey((k) => k + 1);
                }
              } finally {
                if (token === parseTokenRef.current) {
                  setLoading(false);
                }
              }
            }}
          />
          {file ? (
            <p className="text-white/85">{file.name}</p>
          ) : (
            <p className="text-white/75">בחר/י קובץ דוח: CSV / XLSX / OFX</p>
          )}
        </label>

        {loading && (
          <p className="mt-3 text-white/70">
            {preview.length ? "מייבא את ההוצאות…" : "טוען ומפרש את הקובץ…"}
          </p>
        )}
        {!!error && <p className="mt-3 text-red-300">{error}</p>}

        {/* Step 2: mapping + defaults (only after file parsed) */}
        {rows.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {[
                { key: "date", label: "תאריך" },
                { key: "description", label: "תיאור" },
                { key: "amount", label: "סכום (אם אין Debit/Credit)" },
                { key: "debit", label: "Debit/חובה" },
                { key: "credit", label: "Credit/זכות" },
                { key: "currency", label: "מטבע (עמודה בטבלה)" },
                { key: "last4", label: "4 ספרות כרטיס" },
              ].map((field) => (
                <div key={field.key} className="glass-sm rounded-xl bg-slate-900/70 p-2">
                  <label className="mb-1 block text-xs text-white/60">{field.label}</label>
                  <select
                    className="w-full bg-transparent outline-none"
                    value={(mapping as Record<string, string | undefined>)[field.key] ?? ""}
                    onChange={(event) =>
                      setMapping((prev) => ({ ...prev, [field.key]: event.target.value || undefined }))
                    }
                  >
                    <option value="">— זיהוי אוטומטי —</option>
                    {columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="glass-sm rounded-xl bg-slate-900/70 p-2">
                <label className="mb-1 block text-xs text-white/60">מטבע ברירת־מחדל</label>
                <select
                  className="w-full bg-transparent"
                  value={defaultCurrency}
                  onChange={(event) => setDefaultCurrency(event.target.value as SupportedCurrency)}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-white/60">ישמש לשורות ללא עמודת מטבע / ללא סמלי מטבע.</p>
              </div>
              <div className="glass-sm col-span-2 rounded-xl bg-slate-900/70 p-2">
                <label className="mb-1 block text-xs text-white/60">שייך כל ההוצאות למי?</label>
                <div className="flex items-center gap-2">
                  <select className="bg-transparent" value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
                    <option value="" disabled>
                      בחר/י משתתף
                    </option>
                    {participants.map((participant) => (
                      <option key={participant} value={participant}>
                        {participant}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="glass-sm rounded-full px-3 py-1.5"
                    onClick={() => {
                      const name = prompt("שם משתתף חדש:");
                      if (name) {
                        addParticipant(name);
                        setPaidBy(name);
                      }
                    }}
                  >
                    הוסף משתתף
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-white/60">
                  כל השורות בקובץ יוגדרו כ־<strong>paidBy</strong> המשתתף שנבחר, וייכנסו עם <strong>participants = [המשתתף]</strong>.
                  מיקום נשאר ריק לעריכה ידנית.
                </p>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                className="btn-glass-strong h-10 rounded-2xl px-4 disabled:opacity-50"
                onClick={buildPreview}
                disabled={!rows.length || !paidBy || loading}
              >
                תצוגה מוקדמת + בדיקת כפולים
              </button>
            </div>
          </>
        )}

        {/* Step 3: preview + dedupe */}
        {stats && (
          <div className="mt-3 flex gap-2 text-sm text-white/80">
            <span className="glass-sm rounded-full px-3 py-1">חדשים: {stats.unique}</span>
            <span className="glass-sm rounded-full px-3 py-1">כפולים: {stats.dupes}</span>
          </div>
        )}
        {!!preview.length && (
          <div className="no-scrollbar mt-3 max-h-[38vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60">
                <tr className="text-right">
                  <th className="px-2 py-2">תאריך</th>
                  <th className="px-2 py-2">תיאור</th>
                  <th className="px-2 py-2">סכום</th>
                  <th className="px-2 py-2">מטבע</th>
                  <th className="px-2 py-2">משויך ל־</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((row, index) => (
                  <tr key={index} className="border-t border-white/5">
                    <td className="px-2 py-2">{new Date(row.date).toLocaleDateString("he-IL")}</td>
                    <td className="px-2 py-2 truncate">{row.description}</td>
                    <td className="px-2 py-2 font-semibold grad-text">{row.amount.toFixed(2)}</td>
                    <td className="px-2 py-2">{row.currency}</td>
                    <td className="px-2 py-2">{row.paidBy || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <p className="text-xs text-white/60">* מיקום נשאר ריק; ניתן לערוך לאחר הייבוא.</p>
          <div className="flex gap-2">
            <button onClick={handleDialogClose} className="h-10 rounded-2xl bg-transparent px-4 text-white/80 hover:bg-white/5">
              ביטול
            </button>
            <button
              onClick={handleImport}
              disabled={!preview.length || loading || !paidBy}
              className="btn-glass-strong h-10 rounded-2xl px-4 disabled:opacity-50"
            >
              הוסף {preview.length} הוצאות
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;
}
