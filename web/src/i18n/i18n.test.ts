import { describe, expect, it } from 'vitest'
import { zh } from './zh'
import { en } from './en'
import { vi } from './vi'

function keyPaths(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) {
    // Arrays may differ in length across locales only if empty; require same length.
    return [`${prefix}[len:${obj.length}]`, ...obj.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`))]
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      keyPaths(v, prefix ? `${prefix}.${k}` : k),
    )
  }
  return [prefix]
}

describe('i18n dictionaries', () => {
  it('en has the same structure as zh', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(zh).sort())
  })

  it('vi has the same structure as zh', () => {
    expect(keyPaths(vi).sort()).toEqual(keyPaths(zh).sort())
  })
})
