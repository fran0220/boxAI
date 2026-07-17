/** Public system status API client — no auth, no secrets. */

import { apiBase } from './brand'

export type StatusPeriod = '7d' | '15d' | '30d'
export type MonitorStatus = 'operational' | 'degraded' | 'failed' | 'error' | 'unknown' | string
export type OverallStatus = 'operational' | 'degraded'

export interface PublicTimelinePoint {
  status: MonitorStatus
  latency_ms: number | null
  ping_latency_ms: number | null
  checked_at: string
}

export interface PublicExtraModel {
  model: string
  status: MonitorStatus
  latency_ms: number | null
}

export interface PublicStatusItem {
  id: number
  name: string
  provider: string
  group_name: string
  primary_model: string
  status: MonitorStatus
  latency_ms: number | null
  ping_latency_ms: number | null
  availability: number
  availability_7d: number
  availability_15d?: number
  availability_30d?: number
  extra_models: PublicExtraModel[]
  timeline: PublicTimelinePoint[]
}

export interface PublicStatusGroup {
  name: string
  count: number
}

export interface PublicStatusResponse {
  period: StatusPeriod
  overall: OverallStatus
  updated_at: string
  items: PublicStatusItem[]
  groups?: PublicStatusGroup[]
}

interface Envelope<T> {
  code: number
  message: string
  data?: T
}

export async function fetchPublicStatus(
  period: StatusPeriod = '7d',
  signal?: AbortSignal,
): Promise<PublicStatusResponse> {
  const base = apiBase()
  const url = `${base}/api/v1/public/status?period=${encodeURIComponent(period)}`
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    signal,
    headers: { Accept: 'application/json' },
  })
  const body = (await res.json().catch(() => null)) as Envelope<PublicStatusResponse> | null
  if (!res.ok || !body || body.code !== 0 || !body.data) {
    throw new Error(body?.message || res.statusText || 'Failed to load status')
  }
  return body.data
}

export function statusBadgeClass(status: MonitorStatus): string {
  switch (status) {
    case 'operational':
      return 'bg-emerald-500/15 text-emerald-300'
    case 'degraded':
      return 'bg-amber-500/15 text-amber-300'
    case 'failed':
    case 'error':
      return 'bg-rose-500/15 text-rose-300'
    default:
      return 'bg-white/5 text-[var(--bx-text-dim)]'
  }
}

export function timelineSegClass(status: MonitorStatus): string {
  switch (status) {
    case 'operational':
      return 'bx-status-timeline__seg--operational'
    case 'degraded':
      return 'bx-status-timeline__seg--degraded'
    case 'failed':
    case 'error':
      return 'bx-status-timeline__seg--failed'
    default:
      return 'bx-status-timeline__seg--empty'
  }
}

export function timelineHeight(status: MonitorStatus): number {
  switch (status) {
    case 'operational':
      return 100
    case 'degraded':
      return 65
    case 'failed':
    case 'error':
      return 35
    default:
      return 15
  }
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—'
  return String(Math.round(ms))
}

export function formatAvailability(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toFixed(2)
}

export function hslForPct(pct: number | null | undefined): string | undefined {
  if (pct == null || Number.isNaN(pct)) return undefined
  const clamped = Math.max(0, Math.min(100, pct))
  return `hsl(${clamped * 1.2} 72% 42%)`
}

export function providerLabel(p: string): string {
  switch (p) {
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'gemini':
      return 'Gemini'
    case 'grok':
      return 'Grok'
    default:
      return p || '—'
  }
}
