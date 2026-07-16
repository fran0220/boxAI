import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/streamdown/dist/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Align with console primary (teal)
        primary: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'var(--bx-teal)',
          bright: 'var(--bx-teal-bright)',
          deep: 'var(--bx-teal-deep)',
          ink: 'var(--bx-teal-ink)',
        },
        spark: {
          DEFAULT: 'var(--bx-spark)',
          soft: 'var(--bx-spark-soft)',
        },
        background: 'hsl(var(--background) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
        },
        gray: colors.zinc,
      },
      fontFamily: {
        sans: [
          'var(--bx-font)',
          'Noto Sans SC',
          'Space Grotesk',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        display: [
          'var(--bx-font-display)',
          'Space Grotesk',
          'Noto Sans SC',
          'system-ui',
          'sans-serif',
        ],
        mono: ['var(--bx-font-mono)', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        bx: 'var(--bx-radius)',
        'bx-sm': 'var(--bx-radius-sm)',
        'bx-md': 'var(--bx-radius-md)',
        'bx-lg': 'var(--bx-radius-lg)',
        'bx-xl': 'var(--bx-radius-xl)',
        'bx-btn': 'var(--bx-radius-btn)',
      },
      boxShadow: {
        cta: 'var(--bx-shadow-cta)',
        card: 'var(--bx-shadow-card)',
        spark: 'var(--bx-shadow-spark)',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        bx: '280ms',
        'bx-fast': '140ms',
        'bx-slow': '650ms',
      },
    },
  },
  plugins: [],
}
