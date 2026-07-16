/** Lightweight trilingual i18n (zh / en / vi) — aligned with console locale codes. */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { zh, type Dict } from './zh'
import { en } from './en'
import { vi } from './vi'

export type Lang = 'zh' | 'en' | 'vi'

const LANG_KEY = 'boxai_web_lang'

export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'zh', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
]

const dictionaries: Record<Lang, Dict> = { zh, en, vi }

const htmlLang: Record<Lang, string> = { zh: 'zh-CN', en: 'en', vi: 'vi' }

export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY)
    if (stored === 'zh' || stored === 'en' || stored === 'vi') return stored
  } catch {
    // storage unavailable
  }
  const candidates =
    typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []
  for (const raw of candidates) {
    const tag = (raw || '').toLowerCase()
    if (tag.startsWith('zh')) return 'zh'
    if (tag.startsWith('vi')) return 'vi'
    if (tag.startsWith('en')) return 'en'
  }
  return 'zh'
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  d: Dict
}

const I18nContext = createContext<I18nContextValue | null>(null)

function applyHtmlLang(lang: Lang): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = htmlLang[lang]
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = detectLang()
    applyHtmlLang(initial)
    return initial
  })

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    applyHtmlLang(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // storage unavailable
    }
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, d: dictionaries[lang] }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
