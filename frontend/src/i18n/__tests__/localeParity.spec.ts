import { describe, expect, it } from 'vitest'
import en from '../locales/en'
import zh from '../locales/zh'
import vi from '../locales/vi'

function flatten(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v, full))
    } else {
      keys.push(full)
    }
  }
  return keys
}

describe('locale key parity', () => {
  const enKeys = new Set(flatten(en))
  const zhKeys = new Set(flatten(zh))
  const viKeys = new Set(flatten(vi))

  it('en and zh share the same leaf keys', () => {
    const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k)).sort()
    const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k)).sort()
    expect(onlyEn, `only en: ${onlyEn.slice(0, 20).join(', ')}`).toEqual([])
    expect(onlyZh, `only zh: ${onlyZh.slice(0, 20).join(', ')}`).toEqual([])
  })

  it('vi has the same leaf keys as en', () => {
    const onlyEn = [...enKeys].filter((k) => !viKeys.has(k)).sort()
    const onlyVi = [...viKeys].filter((k) => !enKeys.has(k)).sort()
    expect(onlyEn, `missing in vi: ${onlyEn.slice(0, 20).join(', ')}`).toEqual([])
    expect(onlyVi, `extra in vi: ${onlyVi.slice(0, 20).join(', ')}`).toEqual([])
  })

  it('reports approximate sizes', () => {
    expect(enKeys.size).toBeGreaterThan(1000)
    expect(viKeys.size).toBe(enKeys.size)
  })
})
