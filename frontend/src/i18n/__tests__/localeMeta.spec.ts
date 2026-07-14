import { describe, expect, it } from 'vitest'
import {
  isLocaleCode,
  getLocaleMeta,
  localeToBcp47,
  localeToAirwallex,
  listSeparator,
  LOCALE_CODES
} from '../localeMeta'

describe('localeMeta', () => {
  it('supports en, zh, vi', () => {
    expect(LOCALE_CODES).toEqual(['en', 'zh', 'vi'])
    expect(isLocaleCode('vi')).toBe(true)
    expect(isLocaleCode('ja')).toBe(false)
  })

  it('maps BCP-47 tags', () => {
    expect(localeToBcp47('en')).toBe('en-US')
    expect(localeToBcp47('zh')).toBe('zh-CN')
    expect(localeToBcp47('vi')).toBe('vi-VN')
  })

  it('falls compliance for vi back to English', () => {
    expect(getLocaleMeta('vi').complianceLang).toBe('en')
    expect(getLocaleMeta('zh').complianceLang).toBe('zh')
  })

  it('maps Airwallex locales with en fallback for vi', () => {
    expect(localeToAirwallex('zh')).toBe('zh')
    expect(localeToAirwallex('vi')).toBe('en')
    expect(localeToAirwallex('en')).toBe('en')
  })

  it('uses Chinese list separator only for zh', () => {
    expect(listSeparator('zh')).toBe('、')
    expect(listSeparator('vi')).toBe(', ')
    expect(listSeparator('en')).toBe(', ')
  })
})
