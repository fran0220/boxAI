import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // streamdown ships class names used by Agent markdown renderer
    './node_modules/streamdown/dist/*.js',
  ],
  // class strategy: BoxaiPlaygroundRoot adds `dark` on documentElement
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // BoxAI marketing / Creator tokens
        primary: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          // playground hsl(var(--primary)) components also use `primary` / `primary-foreground`
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        // gpt_image_playground design tokens (HSL CSS vars on .image-playground)
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
        // playground maps gray → zinc for a cooler dark UI
        gray: colors.zinc,
      },
      fontFamily: {
        sans: [
          'var(--font-ui-sans)',
          'Noto Sans SC',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['var(--font-mono)', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        cta: '0 14px 44px -10px rgba(45, 212, 191, 0.55)',
        card: '0 8px 32px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
