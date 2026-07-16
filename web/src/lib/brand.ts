/** BoxAI brand constants — mirrors frontend/src/constants/brand.ts */

export const BRAND_NAME = 'BoxAI'
export const BRAND_TAGLINE = 'AI Service Platform'
export const BRAND_DOCUMENT_TITLE = `${BRAND_NAME} - ${BRAND_TAGLINE}`
export const BRAND_DEFAULT_SUBTITLE = 'All models · All modalities · One box'
export const BRAND_PLATFORM_BADGE = 'Unified AI Platform'
export const BRAND_HERO_LINE1 = 'One box.'
export const BRAND_HERO_LINE2 = 'All AI inside.'
export const BRAND_LOGO_SVG = '/logo.svg'
export const BRAND_LOGO_PNG = '/logo.png'
export const BRAND_LOGO_MONO_SVG = '/logo-mono.svg'

/** Console origin for SSO / billing deep-links */
export function consoleOrigin(): string {
  const fromEnv = (import.meta.env.VITE_CONSOLE_ORIGIN as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'you-box.com' || host === 'www.you-box.com') {
      return 'https://console.you-box.com'
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000'
    }
  }
  return 'https://console.you-box.com'
}

export function apiBase(): string {
  const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  return base ? base.replace(/\/+$/, '') : ''
}
