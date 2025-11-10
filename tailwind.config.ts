import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--archvd-bg)',
        surface: 'var(--archvd-surface)',
        soft: 'var(--archvd-soft)',
        elev: {
          0: 'var(--archvd-bg-elev-0)',
          1: 'var(--archvd-bg-elev-1)',
          2: 'var(--archvd-bg-elev-2)',
          3: 'var(--archvd-bg-elev-3)',
        },
        surface2: 'var(--archvd-bg-elev-2)',
        border: 'var(--archvd-border)',
        borderStrong: 'var(--archvd-border-strong)',
        fg: 'var(--archvd-fg)',
        muted: 'var(--archvd-fg-muted)',
        dim: 'var(--archvd-fg-dim)',
        accent: {
          DEFAULT: 'var(--archvd-accent)',
          600: 'var(--archvd-accent-600)',
          500: 'var(--archvd-accent-500)',
          400: 'var(--archvd-accent-400)',
          300: 'var(--archvd-accent-300)',
          200: 'var(--archvd-accent-200)',
        },
        profit: {
          DEFAULT: 'var(--archvd-profit)',
          bg: 'var(--archvd-profit-bg)',
        },
        loss: {
          DEFAULT: 'var(--archvd-loss)',
          bg: 'var(--archvd-loss-bg)',
        },
        // Legacy compatibility
        success: 'var(--archvd-success)',
        warning: 'var(--archvd-warning)',
        danger: {
          DEFAULT: 'var(--archvd-danger)',
          200: 'var(--archvd-danger-200)'
        },
        series: {
          1: 'var(--archvd-series-1)',
          2: 'var(--archvd-series-2)',
          3: 'var(--archvd-series-3)',
          4: 'var(--archvd-series-4)'
        },
        focus: 'var(--archvd-focus)'
      },
      boxShadow: {
        soft: 'var(--archvd-shadow-soft)',
        medium: 'var(--archvd-shadow-medium)',
        large: 'var(--archvd-shadow-large)',
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        pill: '999px'
      },
      spacing: {
        3.5: '0.875rem'
      },
      transitionTimingFunction: {
        boutique: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '150ms',
        slow: '200ms'
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        wide: '0.08em',
      },
    },
  },
  plugins: [],
}
export default config
