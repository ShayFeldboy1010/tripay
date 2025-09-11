'use client';

import { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes';
import { colors as lightColors, darkColors, ThemeColors } from './colors';

interface ThemeContextValue {
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: lightColors });

function ThemeValuesProvider({ children }: { children: ReactNode }) {
  const { theme } = useNextTheme();
  const palette = theme === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'theme-colors';
    const lightVars = Object.entries(lightColors)
      .map(([k, v]) => `--color-${k}: ${v};`)
      .join(' ');
    const darkVars = Object.entries(darkColors)
      .map(([k, v]) => `--color-${k}: ${v};`)
      .join(' ');
    style.innerHTML = `:root { ${lightVars} } [data-theme="dark"] { ${darkVars} }`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <ThemeContext.Provider value={{ colors: palette }}>{children}</ThemeContext.Provider>;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <ThemeValuesProvider>{children}</ThemeValuesProvider>
    </NextThemeProvider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
