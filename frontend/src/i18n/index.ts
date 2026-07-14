import { createI18n } from 'vue-i18n'
import {
  type LocaleCode,
  isLocaleCode,
  localeToHtmlLang,
  LOCALE_METAS,
  LOCALE_CODES
} from './localeMeta'

export type { LocaleCode } from './localeMeta'
export {
  isLocaleCode,
  getLocaleMeta,
  localeToBcp47,
  localeToHtmlLang,
  localeToAirwallex,
  listSeparator,
  LOCALE_METAS,
  LOCALE_CODES
} from './localeMeta'

type LocaleMessages = Record<string, any>

/** Current product storage key; legacy key is still read for migration. */
const LOCALE_KEY = 'boxai_locale'
const LEGACY_LOCALE_KEY = 'sub2api_locale'
const DEFAULT_LOCALE: LocaleCode = 'en'

const localeLoaders: Record<LocaleCode, () => Promise<{ default: LocaleMessages }>> = {
  en: () => import('./locales/en'),
  zh: () => import('./locales/zh'),
  vi: () => import('./locales/vi')
}

function getDefaultLocale(): LocaleCode {
  const saved = localStorage.getItem(LOCALE_KEY) || localStorage.getItem(LEGACY_LOCALE_KEY)
  if (saved && isLocaleCode(saved)) {
    return saved
  }

  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('vi')) {
    return 'vi'
  }
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }

  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {},
  // Onboarding steps use trusted internal HTML for driver.js.
  warnHtmlMessage: false
})

const loadedLocales = new Set<LocaleCode>()

export async function loadLocaleMessages(locale: LocaleCode): Promise<void> {
  if (loadedLocales.has(locale)) {
    return
  }

  const loader = localeLoaders[locale]
  const module = await loader()
  i18n.global.setLocaleMessage(locale, module.default)
  loadedLocales.add(locale)
}

export async function initI18n(): Promise<void> {
  const current = getLocale()
  await loadLocaleMessages(current)
  document.documentElement.setAttribute('lang', localeToHtmlLang(current))
}

export async function setLocale(locale: string): Promise<void> {
  if (!isLocaleCode(locale)) {
    return
  }

  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_KEY, locale)
  // Keep legacy key in sync so older tabs still read the same preference once.
  localStorage.setItem(LEGACY_LOCALE_KEY, locale)
  document.documentElement.setAttribute('lang', localeToHtmlLang(locale))

  const { resolveRouteDocumentTitle } = await import('@/router/title')
  const { default: router } = await import('@/router')
  const { useAppStore } = await import('@/stores/app')
  const { useAuthStore } = await import('@/stores/auth')
  const { useAdminSettingsStore } = await import('@/stores/adminSettings')
  const route = router.currentRoute.value
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const adminSettingsStore = useAdminSettingsStore()
  const customMenuItems = [
    ...(appStore.cachedPublicSettings?.custom_menu_items ?? []),
    ...(authStore.isAdmin ? adminSettingsStore.customMenuItems : [])
  ]
  document.title = resolveRouteDocumentTitle(route, appStore.siteName, customMenuItems)
}

export function getLocale(): LocaleCode {
  const current = i18n.global.locale.value
  return isLocaleCode(current) ? current : DEFAULT_LOCALE
}

export const availableLocales = LOCALE_CODES.map((code) => ({
  code,
  name: LOCALE_METAS[code].name,
  flag: LOCALE_METAS[code].flag
})) as readonly { code: LocaleCode; name: string; flag: string }[]

export default i18n
