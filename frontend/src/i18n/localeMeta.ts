/**
 * Locale metadata — single place for BCP-47 tags, labels, and compliance language.
 */

export type LocaleCode = 'en' | 'zh' | 'vi'

export interface LocaleMeta {
  code: LocaleCode
  /** document.documentElement lang */
  htmlLang: string
  /** Intl / DateTimeFormat locale */
  bcp47: string
  name: string
  flag: string
  /**
   * Language for frozen Sub2API compliance documents/phrases.
   * Vietnamese product UI falls back to English legal copy.
   */
  complianceLang: 'en' | 'zh'
}

export const LOCALE_METAS: Record<LocaleCode, LocaleMeta> = {
  en: {
    code: 'en',
    htmlLang: 'en',
    bcp47: 'en-US',
    name: 'English',
    flag: '🇺🇸',
    complianceLang: 'en'
  },
  zh: {
    code: 'zh',
    htmlLang: 'zh-CN',
    bcp47: 'zh-CN',
    name: '中文',
    flag: '🇨🇳',
    complianceLang: 'zh'
  },
  vi: {
    code: 'vi',
    htmlLang: 'vi',
    bcp47: 'vi-VN',
    name: 'Tiếng Việt',
    flag: '🇻🇳',
    complianceLang: 'en'
  }
}

export const LOCALE_CODES: LocaleCode[] = ['en', 'zh', 'vi']

export function isLocaleCode(value: string): value is LocaleCode {
  return value === 'en' || value === 'zh' || value === 'vi'
}

export function getLocaleMeta(code: string): LocaleMeta {
  if (isLocaleCode(code)) {
    return LOCALE_METAS[code]
  }
  return LOCALE_METAS.en
}

export function localeToBcp47(code: string): string {
  return getLocaleMeta(code).bcp47
}

export function localeToHtmlLang(code: string): string {
  return getLocaleMeta(code).htmlLang
}

/** Airwallex Checkout locale; falls back to en when unsupported. */
export function localeToAirwallex(code: string): string {
  if (code === 'zh' || String(code).startsWith('zh')) return 'zh'
  // Airwallex supports a limited set; use en for vi
  return 'en'
}

export function listSeparator(code: string): string {
  return code === 'zh' || String(code).startsWith('zh') ? '、' : ', '
}
