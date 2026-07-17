/** Theme provider — shares `localStorage.theme` with Vue console (`dark` | `light`). */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'theme'

function readStoredTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    // Match Vue: only light when user explicitly chose light; default dark
    if (saved === 'light') return 'light'
  } catch {
    // storage unavailable
  }
  return 'dark'
}

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
  // theme-color for mobile chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', mode === 'dark' ? '#06080a' : '#f5f7f8')
  }
}

interface ThemeContextValue {
  theme: ThemeMode
  isDark: boolean
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Call once before React mount to avoid FOUC (also used by main.tsx). */
export function initThemeClass(): ThemeMode {
  const mode = readStoredTheme()
  applyThemeClass(mode)
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => initThemeClass())

  useEffect(() => {
    applyThemeClass(theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // storage unavailable
    }
  }, [theme])

  // Cross-tab / console sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return
      const next = e.newValue === 'light' ? 'light' : 'dark'
      setThemeState(next)
      applyThemeClass(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
