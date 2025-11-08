import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="matrix"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--archvd-bg)',
        elev: {
          0: 'var(--archvd-bg-elev-0)',
          1: 'var(--archvd-bg-elev-1)',
          2: 'var(--archvd-bg-elev-2)',
          3: 'var(--archvd-bg-elev-3)',
        },
        surface: 'var(--archvd-bg-elev-1)',
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
        glow: 'var(--archvd-glow-accent)'
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        pill: '999px'
      },
      spacing: {
        3.5: '0.875rem'
      },
      transitionTimingFunction: {
        terminal: 'cubic-bezier(.22,.61,.36,1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms'
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetmono)', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
    },
  },
  plugins: [],
}
export default config
