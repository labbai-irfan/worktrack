import { useEffect, useState } from 'react';

/** Reads a `--token` CSS custom property as `rgb(r g b)` for use in canvas-rendered charts (ECharts, etc.), which cannot resolve CSS variables themselves. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `rgb(${value})` : fallback;
}

export interface ChartTheme {
  text: string;
  textMuted: string;
  border: string;
  splitLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  primary: string;
}

function readChartTheme(): ChartTheme {
  return {
    text: cssVar('--text-secondary', '#64748b'),
    textMuted: cssVar('--text-tertiary', '#94a3b8'),
    border: cssVar('--border-primary', '#e2e8f0'),
    splitLine: cssVar('--border-secondary', '#f1f5f9'),
    tooltipBg: cssVar('--surface-elevated', '#ffffff'),
    tooltipBorder: cssVar('--border-primary', '#e2e8f0'),
    primary: cssVar('--text-primary', '#0f172a'),
  };
}

/** Live theme colors for canvas-rendered charts — re-reads CSS variables whenever the app theme changes. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());
  useEffect(() => {
    const onChange = () => setTheme(readChartTheme());
    window.addEventListener('worktrack:theme-change', onChange);
    return () => window.removeEventListener('worktrack:theme-change', onChange);
  }, []);
  return theme;
}
