"use client";

import React, { useMemo, useState } from "react";
import { parseFile, toNormalized, type Mapping } from "../../lib/import/parsers";
import { dedupe } from "../../lib/import/dedupe";
import type { NormalizedExpense, SupportedCurrency } from "../../types/import";

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
  const [importing, setImporting] = useState(false);

  const [mapping, setMapping] = useState<Mapping>({});
  const [defaultCurrency, setDefaultCurrency] = useState<SupportedCurrency>("ILS");
  const { list: participants, add: addParticipant } = useParticipants();
  const [paidBy, setPaidBy] = useState<string>("");

  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);

  async function handleFile(f: File) {
    setFile(f);
    setLoading(true);
    setRows([]);
    setPreview([]);
    setStats(null);
    try {
      const parsed = await parseFile(f);
      setRows(parsed);
    } finally {
      setLoading(false);
    }
  }

  function buildPreview() {
    if (!rows.length || !paidBy) return;
    const norm = toNormalized(rows, file?.name, { mapping, defaultCurrency, paidBy });
    const { unique, dupes } = dedupe(norm, existing);
    setPreview(unique);
    setStats({ unique: unique.length, dupes: dupes.length });
  }

  async function handleImport() {
    if (!preview.length || !paidBy || importing) return;
    setImporting(true);
    try {
      await onImport(preview);
      onClose();
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="glass m-4 w-full max-h-[86vh] overflow-hidden rounded-[28px] p-4 md:w-[760px]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">ייבוא דוח אשראי</h2>
          <button onClick={onClose} className="glass-sm rounded-full px-3 py-1.5">
            סגור
          </button>
        </div>

        {/* Step 1: file */}
        <label className="glass-sm relative block cursor-pointer rounded-2xl p-4 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.ofx,.qfx"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
          />
          {file ? <p className="text-white/80">{file.name}</p> : <p className="text-white/70">בחר/י קובץ CSV/XLSX/OFX</p>}
        </label>
        {loading && <p className="mt-3 text-white/70">טוען…</p>}

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
                <div key={field.key} className="glass-sm rounded-xl p-2">
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
              <div className="glass-sm rounded-xl p-2">
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
              <div className="glass-sm col-span-2 rounded-xl p-2">
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
                className="btn-glass h-10 rounded-2xl px-4 disabled:opacity-50"
                onClick={buildPreview}
                disabled={!rows.length || !paidBy}
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
            <button onClick={onClose} className="h-10 rounded-2xl bg-transparent px-4 text-white/80 hover:bg-white/5">
              ביטול
            </button>
            <button
              onClick={handleImport}
              disabled={!preview.length || !paidBy || importing}
              className="btn-glass h-10 rounded-2xl px-4 disabled:opacity-50"
            >
              הוסף {preview.length} הוצאות
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
