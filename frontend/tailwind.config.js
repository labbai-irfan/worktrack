/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Surface & Background */
        background: 'rgb(var(--background) / <alpha-value>)',
        'background-subtle': 'rgb(var(--background-subtle) / <alpha-value>)',
        surface: {
          primary: 'rgb(var(--surface-primary) / <alpha-value>)',
          secondary: 'rgb(var(--surface-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--surface-tertiary) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          /* Backward compat */
          DEFAULT: 'rgb(var(--surface-primary) / <alpha-value>)',
          raised: 'rgb(var(--surface-primary) / <alpha-value>)',
          sunken: 'rgb(var(--surface-tertiary) / <alpha-value>)',
        },

        /* Sidebar */
        sidebar: {
          background: 'rgb(var(--sidebar-background) / <alpha-value>)',
          surface: 'rgb(var(--sidebar-surface) / <alpha-value>)',
          hover: 'rgb(var(--sidebar-hover) / <alpha-value>)',
          active: 'rgb(var(--sidebar-active) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border) / <alpha-value>)',
          text: 'rgb(var(--sidebar-text) / <alpha-value>)',
          'text-muted': 'rgb(var(--sidebar-text-muted) / <alpha-value>)',
          'text-faint': 'rgb(var(--sidebar-text-faint) / <alpha-value>)',
        },

        /* Text Colors */
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
          disabled: 'rgb(var(--text-disabled) / <alpha-value>)',
          inverse: 'rgb(var(--text-inverse) / <alpha-value>)',
          /* Backward compat */
          DEFAULT: 'rgb(var(--text-primary) / <alpha-value>)',
          muted: 'rgb(var(--text-secondary) / <alpha-value>)',
          faint: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },

        /* Borders */
        border: {
          primary: 'rgb(var(--border-primary) / <alpha-value>)',
          secondary: 'rgb(var(--border-secondary) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
          /* Backward compat */
          DEFAULT: 'rgb(var(--border-primary) / <alpha-value>)',
          line: 'rgb(var(--border-primary) / <alpha-value>)',
        },

        /* Interactive */
        interactive: {
          hover: 'rgb(var(--interactive-hover) / <alpha-value>)',
          active: 'rgb(var(--interactive-active) / <alpha-value>)',
          selected: 'rgb(var(--interactive-selected) / <alpha-value>)',
        },

        /* Form Inputs */
        input: {
          background: 'rgb(var(--input-background) / <alpha-value>)',
          border: 'rgb(var(--input-border) / <alpha-value>)',
          placeholder: 'rgb(var(--input-placeholder) / <alpha-value>)',
        },

        /* Status Colors */
        success: {
          main: 'rgb(var(--success-main) / <alpha-value>)',
          light: 'rgb(var(--success-light) / <alpha-value>)',
          dark: 'rgb(var(--success-dark) / <alpha-value>)',
        },
        warning: {
          main: 'rgb(var(--warning-main) / <alpha-value>)',
          light: 'rgb(var(--warning-light) / <alpha-value>)',
          dark: 'rgb(var(--warning-dark) / <alpha-value>)',
        },
        error: {
          main: 'rgb(var(--error-main) / <alpha-value>)',
          light: 'rgb(var(--error-light) / <alpha-value>)',
          dark: 'rgb(var(--error-dark) / <alpha-value>)',
        },
        info: {
          main: 'rgb(var(--info-main) / <alpha-value>)',
          light: 'rgb(var(--info-light) / <alpha-value>)',
          dark: 'rgb(var(--info-dark) / <alpha-value>)',
        },
        neutral: {
          main: 'rgb(var(--neutral-main) / <alpha-value>)',
          light: 'rgb(var(--neutral-light) / <alpha-value>)',
          dark: 'rgb(var(--neutral-dark) / <alpha-value>)',
        },

        /* Priority */
        priority: {
          urgent: 'rgb(var(--priority-urgent) / <alpha-value>)',
          high: 'rgb(var(--priority-high) / <alpha-value>)',
          medium: 'rgb(var(--priority-medium) / <alpha-value>)',
          low: 'rgb(var(--priority-low) / <alpha-value>)',
          none: 'rgb(var(--priority-none) / <alpha-value>)',
        },

        /* Brand Primary (Indigo) */
        primary: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
          950: '#1e1b4b',
        },

        /* Backward compat */
        ink: {
          DEFAULT: 'rgb(var(--text-primary) / <alpha-value>)',
          muted: 'rgb(var(--text-secondary) / <alpha-value>)',
          faint: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        line: 'rgb(var(--border-primary) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 var(--shadow-color), 0 1px 3px 0 var(--shadow-color)',
        overlay: '0 10px 38px -10px var(--shadow-color), 0 10px 20px -15px var(--shadow-color)',
        'sm': '0 1px 2px 0 var(--shadow-color)',
        'md': '0 4px 6px -1px var(--shadow-color)',
      },
    },
  },
  plugins: [],
};
