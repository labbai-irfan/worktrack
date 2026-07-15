import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

/** Determine effective theme (resolves 'system' to actual light/dark) */
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply theme to DOM and CSS variables */
function applyTheme(theme: Theme) {
  const effective = getEffectiveTheme(theme);
  const isDark = effective === 'dark';

  // Update class for Tailwind dark mode
  document.documentElement.classList.toggle('dark', isDark);

  // Update data attribute for CSS variable switching
  document.documentElement.setAttribute('data-theme', effective);

  // Update color-scheme for native elements (date pickers, inputs, etc.)
  document.documentElement.style.colorScheme = effective;

  // Optional: Update browser theme color
  if (isDark) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0B1020');
  } else {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F6F7FB');
  }

  // Canvas-rendered content (ECharts, etc.) can't read CSS variables directly —
  // components that need live-updating theme colors listen for this event.
  window.dispatchEvent(new CustomEvent('worktrack:theme-change', { detail: { theme: effective } }));
}

/**
 * Theme management hook with Light, Dark, and System modes.
 * - Persists preference to localStorage
 * - Listens to system preference changes
 * - Updates both .dark class (Tailwind) and data-theme attribute (CSS variables)
 * - Prevents theme flash on page load
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Read from localStorage or default to 'system'
    if (typeof localStorage === 'undefined') return 'system';
    return (localStorage.getItem('wt-theme') as Theme) || 'system';
  });

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);

    // If using system mode, listen for system preference changes
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    // Modern API
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [theme]);

  // Initialize theme on client-side hydration to prevent flash
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const stored = (localStorage.getItem('wt-theme') as Theme) || 'system';
    if (stored !== theme) {
      applyTheme(stored);
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      localStorage.setItem('wt-theme', newTheme);
      setThemeState(newTheme);
    } catch (e) {
      // localStorage might be unavailable in some contexts
      console.warn('Failed to save theme preference:', e);
      setThemeState(newTheme);
    }
  }, []);

  return { theme, setTheme };
}
