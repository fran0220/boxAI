import { detectLang, formatPg, useI18n, type PlaygroundDict } from '@/i18n'
import { playgroundDicts } from '@/i18n/playground-dict'

/** Current playground dict for non-React modules (store / lib). */
export function getPg(): PlaygroundDict {
  return playgroundDicts[detectLang()]
}

/** Interpolate a playground dict key outside React. */
export function tPg(key: keyof PlaygroundDict, vars?: Record<string, string | number>): string {
  return formatPg(getPg()[key], vars)
}

/** Hook for image-playground UI copy (follows site language). */
export function usePg() {
  const { d, lang } = useI18n()
  const pg = d.playground

  function t(key: keyof PlaygroundDict, vars?: Record<string, string | number>): string {
    return formatPg(pg[key], vars)
  }

  return { pg, t, lang }
}
