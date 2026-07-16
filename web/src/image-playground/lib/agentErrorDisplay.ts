/**
 * Locale-stable agent error wire format + multi-locale parsers for stored messages.
 * New errors are always written with the English wire prefix; display can re-i18n.
 * Parsers also accept legacy Chinese and any previously-localized prefixes.
 */

import { playgroundDicts } from '@/i18n/playground-dict'
import { getPg } from './pgI18n'

/** Stable storage prefix (not localized). */
export const AGENT_ERROR_WIRE_PREFIX = 'Request failed: '
/** Stable storage delimiter for network hints (not localized). */
export const AGENT_HINT_WIRE_DELIMITER = '\nHint: '

const LEGACY_ZH_ERROR_PREFIX = '\u8bf7\u6c42\u5931\u8d25\uff1a' // legacy zh "request failed:"
const LEGACY_ZH_HINT_DELIMITER = '\n\u63d0\u793a\uff1a' // legacy zh "\nHint:"

function templatePrefix(template: string, placeholder: string): string {
  const idx = template.indexOf(placeholder)
  return idx >= 0 ? template.slice(0, idx) : template
}

/** All known request-failed prefixes (wire + every locale + legacy). */
export function getAllRequestFailedPrefixes(): string[] {
  const prefixes = new Set<string>([AGENT_ERROR_WIRE_PREFIX, LEGACY_ZH_ERROR_PREFIX])
  for (const d of Object.values(playgroundDicts)) {
    const p = templatePrefix(d.requestFailed, '{error}').trimEnd()
    if (p) prefixes.add(p)
  }
  return [...prefixes]
}

export function isAgentRequestFailedContent(content: string): boolean {
  return getAllRequestFailedPrefixes().some((p) => content.startsWith(p))
}

export function stripAgentRequestFailedPrefix(content: string): string {
  const prefixes = getAllRequestFailedPrefixes().sort((a, b) => b.length - a.length)
  for (const p of prefixes) {
    if (content.startsWith(p)) return content.slice(p.length)
  }
  return content
}

function getAllHintDelimiters(): string[] {
  const dels = new Set<string>([AGENT_HINT_WIRE_DELIMITER, LEGACY_ZH_HINT_DELIMITER])
  for (const d of Object.values(playgroundDicts)) {
    const hint = d.hintPrefix?.trim()
    if (hint) {
      dels.add(`\n${hint}`)
      // also bare form if already after newline stripping
      if (!hint.startsWith('\n')) dels.add(hint.startsWith('\n') ? hint : `\n${hint}`)
    }
  }
  return [...dels]
}

/**
 * Split stored error body (after request-failed prefix) into main message + hints.
 * Accepts wire `\\nHint: `, legacy Chinese, and any locale hintPrefix.
 */
export function splitAgentErrorBody(body: string): { main: string; hints: string[] } {
  const delims = getAllHintDelimiters().sort((a, b) => b.length - a.length)
  let earliest = -1
  let usedDelim = ''
  for (const d of delims) {
    const i = body.indexOf(d)
    if (i >= 0 && (earliest < 0 || i < earliest)) {
      earliest = i
      usedDelim = d
    }
  }
  if (earliest < 0) return { main: body, hints: [] }

  const main = body.slice(0, earliest)
  let rest = body.slice(earliest + usedDelim.length)
  const hints: string[] = []

  // Further split remaining by any delimiter
  while (rest.length > 0) {
    let next = -1
    let nextDelim = ''
    for (const d of delims) {
      const i = rest.indexOf(d)
      if (i >= 0 && (next < 0 || i < next)) {
        next = i
        nextDelim = d
      }
    }
    if (next < 0) {
      hints.push(rest)
      break
    }
    hints.push(rest.slice(0, next))
    rest = rest.slice(next + nextDelim.length)
  }

  return { main, hints: hints.filter((h) => h.length > 0) }
}

/**
 * Build stable wire error content for storage.
 * Caller often appends a multi-line network hint after the main error via `\n` + full hint text.
 * Treat the first `\n` + hint-label as the start of a single hint block (all remaining lines).
 */
export function formatAgentRequestFailedContent(errorMessage: string): string {
  const lines = errorMessage.split('\n')
  const first = lines[0] ?? ''
  if (lines.length <= 1) return AGENT_ERROR_WIRE_PREFIX + first

  // Find the first line that starts a network-hint block (locale Hint: / legacy / wire).
  let hintStart = -1
  for (let i = 1; i < lines.length; i++) {
    if (isLikelyNetworkHint(lines[i])) {
      hintStart = i
      break
    }
  }

  if (hintStart < 0) {
    // No recognized hint block — keep entire multi-line message as main error body.
    return AGENT_ERROR_WIRE_PREFIX + errorMessage
  }

  const mainLines = lines.slice(0, hintStart)
  const hintBlockLines = lines.slice(hintStart)
  // Strip only the leading hint label on the first hint line; keep bullets / rest intact.
  hintBlockLines[0] = stripLeadingHintLabel(hintBlockLines[0] ?? '')
  const main = mainLines.join('\n')
  const hintBody = hintBlockLines.join('\n')
  return AGENT_ERROR_WIRE_PREFIX + main + AGENT_HINT_WIRE_DELIMITER + hintBody
}

function stripLeadingHintLabel(line: string): string {
  for (const d of Object.values(playgroundDicts)) {
    const p = d.hintPrefix
    if (p && line.startsWith(p)) return line.slice(p.length)
  }
  if (line.startsWith('\u63d0\u793a\uff1a')) return line.slice('\u63d0\u793a\uff1a'.length)
  if (line.startsWith('Hint: ')) return line.slice('Hint: '.length)
  return line
}

function isLikelyNetworkHint(line: string): boolean {
  if (!line.trim()) return false
  for (const d of Object.values(playgroundDicts)) {
    if (d.hintPrefix && line.startsWith(d.hintPrefix)) return true
  }
  return (
    line.startsWith('\u63d0\u793a') ||
    line.startsWith('Hint:') ||
    line.startsWith('G\u1ee3i \u00fd:') ||
    line.startsWith('Gợi ý:')
  )
}

/** Display-ready parse: strip wire/locale prefix, split hints, re-label with current locale. */
export function parseAgentRequestFailedForDisplay(content: string): {
  main: string
  hints: string[]
  hintPrefix: string
} | null {
  if (!isAgentRequestFailedContent(content)) return null
  const body = stripAgentRequestFailedPrefix(content)
  const { main, hints } = splitAgentErrorBody(body)
  return { main, hints, hintPrefix: getPg().hintPrefix }
}

/** Running-status prefixes across locales (for stop rewrite). */
export function getAllRunningPrefixes(): string[] {
  const set = new Set<string>()
  for (const d of Object.values(playgroundDicts)) {
    const p = d.runningPrefix?.trim()
    // skip placeholder ellipsis used when English has no shared prefix
    if (p && p !== '\u2026' && p !== '...') set.add(p)
  }
  // legacy Chinese
  set.add('\u6b63\u5728')
  return [...set]
}

export function rewriteToolStatusAsStopped(text: string): string {
  const pg = getPg()
  for (const prefix of getAllRunningPrefixes().sort((a, b) => b.length - a.length)) {
    if (text.startsWith(prefix)) {
      return pg.stoppedPrefix + text.slice(prefix.length)
    }
  }
  // Full-string running labels (en has no shared prefix)
  const runningLabels = new Set<string>()
  for (const d of Object.values(playgroundDicts)) {
    runningLabels.add(d.searchingWeb)
    runningLabels.add(d.findingContent)
    runningLabels.add(d.readingWeb)
    runningLabels.add(d.concurrentParams)
  }
  if (runningLabels.has(text) && !text.startsWith(pg.stoppedPrefix)) {
    return `${pg.stoppedPrefix} ${text}`
  }
  if (!text.startsWith(pg.stoppedPrefix)) {
    return `${pg.stoppedPrefix} ${text}`
  }
  return text
}
