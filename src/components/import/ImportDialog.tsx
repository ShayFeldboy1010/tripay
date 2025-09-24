"use client";

import React, { useState } from "react";
import { parseFile, toNormalized } from "../../lib/import/parsers";
import { dedupe } from "../../lib/import/dedupe";
import type { NormalizedExpense } from "../../types/import";

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
  const [preview, setPreview] = useState<NormalizedExpense[]>([]);
  const [stats, setStats] = useState<{ unique: number; dupes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleFile(f: File) {
    setFile(f);
    setLoading(true);
    const rows = await parseFile(f);
    const norm = toNormalized(rows, f.name);
    const { unique, dupes } = dedupe(norm, existing);
    setPreview(unique);
    setStats({ unique: unique.length, dupes: dupes.length });
    setLoading(false);
  }

  async function handleImport() {
    if (!preview.length || importing) return;
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
      <div className="glass w-full md:w-[720px] max-h-[80vh] overflow-hidden rounded-[28px] m-4 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">ייבוא דוח אשראי</h2>
          <button onClick={onClose} className="glass-sm px-3 py-1.5 rounded-full">סגור</button>
        </div>

        <label className="block cursor-pointer rounded-2xl p-4 text-center glass-sm">
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.ofx,.qfx"
            className="hidden"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
          />
          {file ? (
            <p className="text-white/80">{file.name}</p>
          ) : (
            <p className="text-white/70">בחר/י קובץ CSV/XLSX/OFX לייבוא</p>
          )}
        </label>

        {loading && <p className="mt-3 text-white/70">טוען…</p>}

        {stats && (
          <div className="mt-3 flex gap-2 text-sm text-white/80">
            <span className="glass-sm px-3 py-1 rounded-full">חדשים: {stats.unique}</span>
            <span className="glass-sm px-3 py-1 rounded-full">כפולים: {stats.dupes}</span>
          </div>
        )}

        {!!preview.length && (
          <div className="mt-3 overflow-auto no-scrollbar max-h-[40vh]">
            <table className="w-full text-sm">
              <thead className="text-white/60">
                <tr className="text-right">
                  <th className="px-2 py-2">תאריך</th>
                  <th className="px-2 py-2">תיאור</th>
                  <th className="px-2 py-2">סכום</th>
                  <th className="px-2 py-2">מטבע</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((row, index) => (
                  <tr key={index} className="border-t border-white/5">
                    <td className="px-2 py-2">{new Date(row.date).toLocaleDateString("he-IL")}</td>
                    <td className="px-2 py-2 truncate">{row.description}</td>
                    <td className="px-2 py-2 font-semibold grad-text">₪{row.amount.toFixed(2)}</td>
                    <td className="px-2 py-2">{row.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <p className="text-xs text-white/60">* ניתן להוסיף תמיכה ב-PDF בצד שרת בהמשך.</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-10 rounded-2xl bg-transparent px-4 text-white/80 hover:bg-white/5"
            >
              ביטול
            </button>
            <button
              onClick={handleImport}
              disabled={!preview.length || importing}
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
