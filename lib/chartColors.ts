// @/lib/chartColors.ts
// 1) Named palette for high contrast (12–20 colors). Expandable fallback via HSL.
import { TRIPPAY_BLUE_DARK } from '@/theme/colors';

export const PALETTE = [
  TRIPPAY_BLUE_DARK, '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#22c55e', '#d946ef', '#0ea5e9',
  '#84cc16', '#e11d48', '#a855f7', '#14b8a6', '#ea580c',
  '#60a5fa', '#10b981', '#d97706', '#f43f5e', '#38bdf8'
];

// Simple, stable string hash → index in palette
export function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PALETTE.length;
  return PALETTE[idx];
}

// Optional HSL fallback if PALETTE is exhausted for very large sets:
export function hslFallback(i: number) {
  return `hsl(${(i * 137.508) % 360} 65% 45%)`;
}
