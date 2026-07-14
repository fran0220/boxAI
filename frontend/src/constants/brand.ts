/**
 * BoxAI brand constants — single source of truth for product naming.
 * Do not hard-code "BoxAI" / tagline elsewhere when a fallback default is needed.
 *
 * Display marketing copy must go through i18n (`home.*`). Constants here are
 * language-neutral English defaults for title fallbacks before i18n loads.
 */

/** Product display name (one word, capital B + AI). */
export const BRAND_NAME = 'BoxAI'

/** Short product descriptor used in titles and defaults (English neutral). */
export const BRAND_TAGLINE = 'AI Service Platform'

/** Full default document title. */
export const BRAND_DOCUMENT_TITLE = `${BRAND_NAME} - ${BRAND_TAGLINE}`

/** Default marketing subtitle when admin has not set one (English neutral; prefer t('home.heroDescription')). */
export const BRAND_DEFAULT_SUBTITLE = 'All models · All modalities · One box'

/** North-star homepage badge (English neutral; prefer t('home.heroSubtitle')). */
export const BRAND_PLATFORM_BADGE = 'Unified AI Platform'

/** Hero lines (English neutral; prefer t('home.heroLine1/2')). */
export const BRAND_HERO_LINE1 = 'One box.'
export const BRAND_HERO_LINE2 = 'All AI inside.'

/** Primary brand teal (matches Tailwind primary-500). */
export const BRAND_COLOR_PRIMARY = '#14b8a6'

/** Accent cyan used in logo gradients. */
export const BRAND_COLOR_ACCENT = '#06b6d4'

/** Public logo paths (served from /public). */
export const BRAND_LOGO_SVG = '/logo.svg'
export const BRAND_LOGO_PNG = '/logo.png'
export const BRAND_LOGO_MONO_SVG = '/logo-mono.svg'
