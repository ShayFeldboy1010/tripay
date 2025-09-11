export const BRAND_BLUE = "#2563EB";

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const parsed = hex.replace('#', '');
  const bigint = parseInt(parsed, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((x) => clamp(x).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function shade(hex: string, percent: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - percent / 100), g * (1 - percent / 100), b * (1 - percent / 100));
}

export function tint(hex: string, percent: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * (percent / 100),
    g + (255 - g) * (percent / 100),
    b + (255 - b) * (percent / 100)
  );
}

export function alpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const colors = {
  primary: BRAND_BLUE,
  primary600: BRAND_BLUE,
  primary700: shade(BRAND_BLUE, 8),
  primary500: tint(BRAND_BLUE, 8),
  primary50: alpha(BRAND_BLUE, 0.06),
  bg: "#FFFFFF",
  surface: "#F7F8FA",
  text: "#0F172A",
  onPrimary: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

export const darkColors = {
  ...colors,
  bg: "#0B1220",
  surface: "#111827",
  text: "#E5E7EB",
  primary50: alpha(BRAND_BLUE, 0.12),
};

export type ThemeColors = typeof colors;
