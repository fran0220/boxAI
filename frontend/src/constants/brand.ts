/**
 * BoxAI brand constants — single source of truth for product naming.
 * Do not hard-code "BoxAI" / tagline elsewhere when a fallback default is needed.
 */

/** Product display name (one word, capital B + AI). */
export const BRAND_NAME = 'BoxAI'

/** Short product descriptor used in titles and defaults. */
export const BRAND_TAGLINE = '综合 AI 服务平台'

/** Full default document title. */
export const BRAND_DOCUMENT_TITLE = `${BRAND_NAME} - ${BRAND_TAGLINE}`

/** Default marketing subtitle on the landing page when admin has not set one. */
export const BRAND_DEFAULT_SUBTITLE = '所有模型 · 所有模态 · 一个盒子'

/** North-star homepage badge (platform vision). */
export const BRAND_PLATFORM_BADGE = '综合 AI 平台'

/** Hero lines for the platform homepage (zh primary; i18n may override). */
export const BRAND_HERO_LINE1 = '一个盒子，'
export const BRAND_HERO_LINE2 = '装下所有 AI'

/** Primary brand teal (matches Tailwind primary-500). */
export const BRAND_COLOR_PRIMARY = '#14b8a6'

/** Accent cyan used in logo gradients. */
export const BRAND_COLOR_ACCENT = '#06b6d4'

/** Public logo paths (served from /public). */
export const BRAND_LOGO_SVG = '/logo.svg'
export const BRAND_LOGO_PNG = '/logo.png'
export const BRAND_LOGO_MONO_SVG = '/logo-mono.svg'
