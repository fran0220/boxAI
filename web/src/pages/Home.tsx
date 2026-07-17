import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  Image as ImageIcon,
  LayoutDashboard,
  Monitor,
} from 'lucide-react'
import { BRAND_LOGO_SVG, BRAND_NAME } from '@/lib/brand'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { MODEL_MARQUEE } from '@/content/models'
import { Reveal } from '@/components/motion/Reveal'
import { CtaBand, FaqList } from '@/components/marketing'
import {
  fetchPublicStatus,
  formatAvailability,
  hslForPct,
  providerLabel,
  type OverallStatus,
  type PublicStatusItem,
} from '@/lib/public-status'
import { useAuth } from '@/lib/use-auth'
import { cx } from '@/lib/cx'

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 130% 95% at 82% 115%, rgba(31,213,185,0.38), rgba(12,159,140,0.13) 42%, transparent 68%)',
        }}
      />
      <div
        className="absolute top-[4%] left-[-30%] h-[320px] w-[160%] blur-[48px]"
        style={{
          background:
            'linear-gradient(100deg, transparent, rgba(31,213,185,0.22) 30%, rgba(53,214,244,0.28) 50%, rgba(124,199,255,0.16) 70%, transparent)',
          animation: 'bx-ribbon-a 14s var(--bx-ease-inout) infinite alternate',
        }}
      />
      <div
        className="absolute top-[34%] left-[-30%] h-[240px] w-[160%] opacity-85 blur-[62px]"
        style={{
          background:
            'linear-gradient(80deg, transparent, rgba(124,199,255,0.16) 30%, rgba(31,213,185,0.24) 55%, rgba(53,214,244,0.14) 75%, transparent)',
          animation: 'bx-ribbon-b 19s var(--bx-ease-inout) infinite alternate',
        }}
      />
      <div
        className="absolute bottom-[-66vw] left-1/2 h-[132vw] w-[132vw] -translate-x-1/2 rounded-full blur-[22px]"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(31,213,185,0.22) 16deg, transparent 42deg, transparent 128deg, rgba(53,214,244,0.16) 152deg, transparent 182deg, transparent 258deg, rgba(124,199,255,0.14) 288deg, transparent 320deg)',
          animation: 'bx-spin 42s linear infinite',
        }}
      />
      <div
        className="absolute bottom-[-66vw] left-1/2 h-[132vw] w-[132vw] -translate-x-1/2 rounded-full opacity-75 blur-[36px]"
        style={{
          background:
            'conic-gradient(from 90deg, transparent 0deg, rgba(31,213,185,0.16) 24deg, transparent 60deg, transparent 200deg, rgba(53,214,244,0.13) 230deg, transparent 268deg)',
          animation: 'bx-spin 66s linear infinite reverse',
        }}
      />
      <div
        className="absolute bottom-[-14vw] left-1/2 h-[30vw] w-[92vw] -translate-x-1/2 rounded-full border border-[rgba(108,245,221,0.4)]"
        style={{ animation: 'bx-hpulse 6s var(--bx-ease) infinite' }}
      />
      <div
        className="absolute bottom-[-14vw] left-1/2 h-[30vw] w-[92vw] -translate-x-1/2 rounded-full border border-[rgba(53,214,244,0.35)]"
        style={{ animation: 'bx-hpulse 6s var(--bx-ease) infinite 3s' }}
      />
      <span
        className="absolute top-[12%] right-[6%] h-[2px] w-[220px] rounded-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, #6cf5dd, transparent)',
          animation: 'bx-streak 7.5s linear infinite',
        }}
      />
      <span
        className="absolute top-[30%] right-[22%] h-[1.5px] w-[170px] rounded-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(124,199,255,0.9), transparent)',
          animation: 'bx-streak 9s linear infinite 2.8s',
        }}
      />
      <span
        className="absolute top-[6%] right-[40%] h-[1.5px] w-[140px] rounded-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(53,214,244,0.9), transparent)',
          animation: 'bx-streak 11s linear infinite 5.4s',
        }}
      />
      {/* Design: inset -560px 0 0 — particles extend above hero */}
      <div
        className="absolute inset-x-0 bottom-0 opacity-50"
        style={{
          top: '-560px',
          backgroundImage: 'radial-gradient(rgba(108,245,221,0.4) 1px, transparent 1.6px)',
          backgroundSize: '96px 96px',
          animation: 'bx-pan 46s linear infinite',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 opacity-45"
        style={{
          top: '-560px',
          backgroundImage: 'radial-gradient(rgba(124,199,255,0.32) 1px, transparent 1.6px)',
          backgroundSize: '150px 150px',
          backgroundPosition: '40px 60px',
          animation: 'bx-pan 90s linear infinite',
        }}
      />
      <div
        className="absolute left-[8%] right-[8%] h-px"
        style={{
          top: '92%',
          background:
            'linear-gradient(90deg, transparent, rgba(108,245,221,0.45) 30%, rgba(53,214,244,0.45) 70%, transparent)',
          animation: 'bx-scan 10s var(--bx-ease-inout) infinite',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(151,173,185,0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(151,173,185,0.075) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          WebkitMaskImage: 'radial-gradient(ellipse 110% 85% at 50% 105%, #000 20%, transparent 78%)',
          maskImage: 'radial-gradient(ellipse 110% 85% at 50% 105%, #000 20%, transparent 78%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[140px] bg-gradient-to-t from-[rgba(5,7,10,0.92)] to-transparent" />
    </div>
  )
}

const UPSTREAMS = ['anthropic', 'openai', 'gemini', 'grok / xai', 'antigravity', 'open-source'] as const

/** Count from 0 to `target` with the design's ease-out-quart ramp. */
function useCountUp(target: number | null, duration = 1600) {
  const [value, setValue] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (target == null) return
    if (reduced) {
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      setValue(target * (1 - Math.pow(1 - p, 4)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduced])
  return target == null ? null : value
}

const CODE_TABS = [
  { key: 'curl', label: 'curl' },
  { key: 'python', label: 'Python · OpenAI SDK' },
  { key: 'claude', label: 'Claude Code' },
] as const

type CodeTabKey = (typeof CODE_TABS)[number]['key']

const MINI_BARS = [42, 58, 35, 70, 52, 88, 64, 45, 76, 58, 92, 68, 50, 80, 62, 95, 74, 100]

const CONNECTORS_LEFT = [21, 75, 129, 184, 238, 292].map(
  (y) => `M0 ${y} C 60 ${y}, 60 157, 110 157`,
)
const CONNECTORS_RIGHT = [40, 118, 196, 274].map((y) => `M0 157 C 50 157, 50 ${y}, 110 ${y}`)
/** Narrower, fewer paths for md — full set stays on lg. */
const CONNECTORS_LEFT_MD = [40, 110, 180].map((y) => `M0 ${y} C 28 ${y}, 28 110, 48 110`)
const CONNECTORS_RIGHT_MD = [55, 165].map((y) => `M0 110 C 20 110, 20 ${y}, 48 ${y}`)

const VALUE_GRADS = [
  'linear-gradient(145deg, rgba(31,213,185,0.55), rgba(12,159,140,0.28) 55%, rgba(5,40,36,0.9))',
  'linear-gradient(215deg, rgba(53,214,244,0.5), rgba(31,213,185,0.2) 55%, rgba(4,32,40,0.92))',
  'linear-gradient(135deg, rgba(124,199,255,0.45), rgba(53,214,244,0.18) 50%, rgba(6,25,44,0.92))',
  'linear-gradient(160deg, rgba(31,213,185,0.4), rgba(124,199,255,0.22) 45%, rgba(3,20,26,0.94))',
] as const

const VALUE_KEYS = ['creator', 'studio', 'gateway', 'account'] as const

const PRODUCT_ICONS = [ImageIcon, Monitor, LayoutDashboard, Code2] as const

/** Design marketing targets for the stats band (parity with 新版-首页). */
const STAT_TARGETS = { models: 100, modes: 3, availability: 99.9, accounts: 1 } as const

function buildCodeSamples(hello: string, claudeComment: string, claudeFooter: string): Record<CodeTabKey, string> {
  return {
    curl: `curl https://api.you-box.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-box-****" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "stream": true,
    "messages": [{"role": "user", "content": "${hello}"}]
  }'`,
    python: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.you-box.com/v1",
    api_key="sk-box-****",
)

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "${hello}"}],
)`,
    claude: `${claudeComment}
export ANTHROPIC_BASE_URL="https://api.you-box.com"
export ANTHROPIC_AUTH_TOKEN="sk-box-****"

claude
${claudeFooter}`,
  }
}

function StatusSkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-1 items-center gap-3 border-t border-[var(--bx-line)] px-5 py-3.5 md:grid-cols-[220px_110px_1fr_130px_110px] md:gap-4"
        >
          <span className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-[2px] bg-[var(--bx-border)]" />
            <span className="h-3.5 w-28 animate-pulse rounded bg-[var(--bx-bg-muted)]" />
          </span>
          <span className="h-3 w-16 animate-pulse rounded bg-[var(--bx-bg-muted)]" />
          <span className="flex h-[18px] items-end gap-0.5">
            {Array.from({ length: 30 }, (_, j) => (
              <span
                key={j}
                className="max-w-2 flex-1 rounded-[1.5px] bg-[var(--bx-bg-muted)]"
                style={{ height: `${40 + ((j * 17) % 60)}%` }}
              />
            ))}
          </span>
          <span className="ml-auto h-3 w-14 animate-pulse rounded bg-[var(--bx-bg-muted)] md:ml-0" />
          <span className="ml-auto h-3 w-12 animate-pulse rounded bg-[var(--bx-bg-muted)] md:ml-0" />
        </div>
      ))}
    </>
  )
}

export function Home() {
  const { d } = useI18n()
  usePageMeta(d.home.metaTitle)
  const { authed } = useAuth()
  const [overall, setOverall] = useState<OverallStatus | null>(null)
  const [statusItems, setStatusItems] = useState<PublicStatusItem[]>([])
  const [statusReady, setStatusReady] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchPublicStatus('7d', ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return
        setOverall(data.overall === 'degraded' ? 'degraded' : 'operational')
        setStatusItems((data.items || []).slice(0, 4))
        setStatusReady(true)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setOverall(null)
          setStatusItems([])
          setStatusReady(true)
        }
      })
    return () => ctrl.abort()
  }, [])

  const marquee = useMemo(() => [...MODEL_MARQUEE, ...MODEL_MARQUEE], [])

  // Design parity: always count up to marketing targets (100 / 3 / 99.9 / 1)
  const statModels = useCountUp(STAT_TARGETS.models)
  const statModes = useCountUp(STAT_TARGETS.modes)
  const statAvail = useCountUp(STAT_TARGETS.availability)

  const codeSamples = useMemo(
    () =>
      buildCodeSamples(d.home.dev.codeHello, d.home.dev.codeClaudeComment, d.home.dev.codeClaudeFooter),
    [d.home.dev.codeHello, d.home.dev.codeClaudeComment, d.home.dev.codeClaudeFooter],
  )

  const [codeTab, setCodeTab] = useState<CodeTabKey>('curl')
  const [copied, setCopied] = useState(false)
  const copyCode = () => {
    navigator.clipboard
      ?.writeText(codeSamples[codeTab])
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  const createHref = authed ? '/create' : '/signup?return_to=/create'
  const keysHref = authed ? '/account/keys' : '/login?return_to=/account/keys'
  const accountHref = authed ? '/account' : '/login?return_to=/account'

  const valueCards = d.home.value.cards.map((card, i) => ({
    key: VALUE_KEYS[i] ?? `v-${i}`,
    title: card.title,
    body: card.body,
    grad: VALUE_GRADS[i] ?? VALUE_GRADS[0],
  }))

  const products = d.home.gateway.products.map((p, i) => ({
    title: p.title,
    desc: p.desc,
    icon: PRODUCT_ICONS[i] ?? Code2,
  }))

  const teaserPlans = d.home.pricingTeaser.plans

  function teaserHref(ctaKind: 'signup' | 'subscribe' | 'contact') {
    if (ctaKind === 'contact') return d.pricing.contactHref
    if (ctaKind === 'signup') return authed ? '/create' : '/signup'
    return '/pricing'
  }

  return (
    <div className="relative isolate overflow-x-hidden">
      {/* Hero — always dark cinema look per design */}
      <section data-screen-label="Hero" className="relative overflow-hidden bg-[#05070a] text-[#f2f5f6]">
        <HeroBackdrop />
        <div className="relative mx-auto flex min-h-[max(76vh,560px)] max-w-[1200px] flex-col justify-end px-6 pt-[104px] pb-[76px]">
          <p
            className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.2em] text-[#6cf5dd] uppercase"
            style={{ animation: 'bx-rise 0.8s var(--bx-ease) both' }}
          >
            <span className="h-px w-[22px] bg-[#6cf5dd]" />
            Unified AI Platform
          </p>
          <h1
            className="mt-[18px] max-w-[980px] text-[clamp(52px,6.6vw,92px)] font-extrabold leading-[1.02] tracking-[-0.04em]"
            style={{ animation: 'bx-rise 0.8s var(--bx-ease) 0.08s both' }}
          >
            {d.home.hero.title1}
            {d.home.hero.titleSep}
            <span className="bg-[var(--bx-grad-hero)] bg-clip-text text-transparent">
              {d.home.hero.title2}
            </span>
          </h1>
          <p
            className="mt-[22px] max-w-[560px] text-[17px] leading-[1.75] text-[rgba(238,244,245,0.68)]"
            style={{ animation: 'bx-rise 0.8s var(--bx-ease) 0.16s both' }}
          >
            {d.home.hero.subtitle}
          </p>
          <div
            className="mt-[34px] flex flex-wrap items-center gap-3"
            style={{ animation: 'bx-rise 0.8s var(--bx-ease) 0.24s both' }}
          >
            <Link
              to={createHref}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[linear-gradient(120deg,#1fd5b9,#22c9e0)] px-7 py-[13px] text-[15px] font-bold tracking-tight text-[#03261f] shadow-[0_10px_30px_-8px_rgba(31,213,185,0.6)] transition hover:-translate-y-0.5"
            >
              {d.home.hero.ctaPrimary}
              <ArrowRight size={15} strokeWidth={2.5} />
            </Link>
            <Link
              to={keysHref}
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/25 bg-white/[0.04] px-7 py-[13px] text-[15px] font-bold tracking-tight text-[#f2f5f6] backdrop-blur-[6px] transition hover:border-[#6cf5dd] hover:bg-[rgba(31,213,185,0.08)] hover:text-[#6cf5dd]"
            >
              <Code2 size={14} />
              {d.home.hero.ctaApi}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats — design marketing targets 100 / 3 / 99.9 / 1 */}
      <section data-screen-label="Stats" className="border-b border-[var(--bx-border)] bg-[var(--bx-bg)]">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 px-6 md:grid-cols-4">
          <div className="py-9 pr-6">
            <p className="m-0 font-mono text-[clamp(30px,3vw,42px)] font-semibold tracking-tight tabular-nums text-[var(--bx-text)]">
              {statModels != null ? Math.round(statModels) : STAT_TARGETS.models}+
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">
              {d.home.stats[0].label}
            </p>
          </div>
          <div className="border-l border-[var(--bx-border)] px-6 py-9">
            <p className="m-0 font-mono text-[clamp(30px,3vw,42px)] font-semibold tracking-tight tabular-nums text-[var(--bx-text)]">
              {statModes != null ? Math.round(statModes) : STAT_TARGETS.modes}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">
              {d.home.stats[1].label}
            </p>
          </div>
          <div className="border-l border-[var(--bx-border)] px-6 py-9">
            <p className="m-0 font-mono text-[clamp(30px,3vw,42px)] font-semibold tracking-tight tabular-nums text-[var(--bx-text)]">
              {statAvail != null ? `${statAvail.toFixed(1)}%` : `${STAT_TARGETS.availability}%`}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">
              {d.home.stats[2].label}
            </p>
          </div>
          <div className="border-l border-[var(--bx-border)] py-9 pl-6">
            <p className="m-0 font-mono text-[clamp(30px,3vw,42px)] font-semibold tracking-tight tabular-nums text-[var(--bx-brand)]">
              {STAT_TARGETS.accounts}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">
              {d.home.stats[3].label}
            </p>
          </div>
        </div>
      </section>

      {/* Value cards */}
      <section data-screen-label="Value" className="mx-auto max-w-[1200px] px-6 pt-[88px] pb-10">
        <Reveal>
          <h2 className="m-0 max-w-[680px] text-[clamp(32px,3.6vw,46px)] font-extrabold leading-tight tracking-tight text-pretty">
            {d.home.value.title}
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {valueCards.map((card) => (
            <Reveal key={card.key}>
              <div className="flex h-full flex-col overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)] transition hover:-translate-y-1 hover:border-[var(--bx-brand-ring)] hover:shadow-[var(--bx-shadow-pop)]">
                <div
                  className="relative flex aspect-[16/10] items-end p-3.5"
                  style={{ background: card.grad }}
                >
                  <span className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-white/85 uppercase">
                    {card.key}
                  </span>
                </div>
                <div className="px-5 pt-[18px] pb-[22px]">
                  <h3 className="m-0 text-base font-extrabold tracking-tight">{card.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--bx-text-muted)]">{card.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Models marquee */}
      <section
        data-screen-label="Models"
        className="mt-12 border-y border-[var(--bx-border)] bg-[color-mix(in_srgb,var(--bx-bg-elevated)_55%,transparent)]"
      >
        <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3.5">
          <span className="shrink-0 font-mono text-[10.5px] font-semibold tracking-[0.16em] text-[var(--bx-text-dim)] uppercase">
            {d.home.marqueeTitle}
          </span>
          <div className="bx-marquee min-w-0 flex-1">
            <div className="bx-marquee-track gap-2">
              {marquee.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="whitespace-nowrap rounded-[6px] border border-[var(--bx-border)] px-3.5 py-1 font-mono text-xs font-medium text-[var(--bx-text-soft)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gateway */}
      <section data-screen-label="Gateway" className="mx-auto max-w-[1200px] px-6 py-[88px]">
        <Reveal>
          <div className="mb-11 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
                <span className="h-px w-5 bg-[var(--bx-brand)]" />
                Gateway
              </p>
              <h2 className="mt-3.5 text-[34px] font-extrabold tracking-tight">
                {d.home.gateway.title}
              </h2>
            </div>
            <p className="m-0 max-w-[380px] text-sm leading-relaxed text-[var(--bx-text-muted)] text-pretty">
              {d.home.gateway.desc}
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid items-center gap-4 rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-6 shadow-[var(--bx-shadow-card)] md:grid-cols-[minmax(0,1fr)_48px_auto_48px_minmax(0,1.15fr)] md:gap-0 md:px-5 md:py-7 lg:grid-cols-[200px_110px_auto_110px_1fr] lg:px-8 lg:py-9">
            <div className="flex flex-col gap-2.5">
              {UPSTREAMS.map((u) => (
                <div
                  key={u}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg-card)] px-3 py-2"
                >
                  <span className="h-1.5 w-1.5 rounded-[2px] bg-[var(--bx-brand)] opacity-85" />
                  <span className="font-mono text-xs font-medium text-[var(--bx-text-soft)]">{u}</span>
                </div>
              ))}
            </div>
            {/* Simplified connectors (md); full multi-path set on lg */}
            <div aria-hidden className="relative hidden h-[220px] w-12 md:block lg:hidden">
              <svg viewBox="0 0 48 220" className="absolute inset-0 block h-[220px] w-12">
                {CONNECTORS_LEFT_MD.map((p) => (
                  <path
                    key={p}
                    d={p}
                    fill="none"
                    stroke="var(--bx-brand)"
                    strokeOpacity="0.18"
                    strokeWidth="1"
                  />
                ))}
              </svg>
              {CONNECTORS_LEFT_MD.map((p, i) => (
                <span
                  key={p}
                  className="absolute top-0 left-0 -mt-[2px] -ml-[2px] h-1 w-1 rounded-full bg-[var(--bx-brand-bright)] shadow-[0_0_8px_2px_var(--bx-brand-ring)]"
                  style={{
                    offsetPath: `path('${p}')`,
                    animation: `bx-travel 2.6s linear infinite ${(i * 0.5).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
            <div aria-hidden className="relative hidden h-[314px] w-[110px] lg:block">
              <svg viewBox="0 0 110 314" className="absolute inset-0 block h-[314px] w-[110px]">
                {CONNECTORS_LEFT.map((p) => (
                  <path
                    key={p}
                    d={p}
                    fill="none"
                    stroke="var(--bx-brand)"
                    strokeOpacity="0.15"
                    strokeWidth="1"
                  />
                ))}
              </svg>
              {CONNECTORS_LEFT.map((p, i) => (
                <span
                  key={p}
                  className="absolute top-0 left-0 -mt-[2.5px] -ml-[2.5px] h-[5px] w-[5px] rounded-full bg-[var(--bx-brand-bright)] shadow-[0_0_10px_2px_var(--bx-brand-ring)]"
                  style={{
                    offsetPath: `path('${p}')`,
                    animation: `bx-travel 2.6s linear infinite ${(i * 0.45).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col items-center gap-2.5 px-2 py-4">
              <div className="relative flex items-center justify-center">
                <div
                  aria-hidden
                  className="absolute h-[150px] w-[150px] rounded-full"
                  style={{
                    background: 'radial-gradient(circle, var(--bx-brand-soft), transparent 65%)',
                    animation: 'bx-glow 4s var(--bx-ease-inout) infinite',
                  }}
                />
                <div
                  aria-hidden
                  className="absolute h-[118px] w-[118px] rounded-full border border-[var(--bx-brand-ring)]"
                  style={{ animation: 'bx-ring 3.2s var(--bx-ease) infinite' }}
                />
                <div
                  aria-hidden
                  className="absolute h-[118px] w-[118px] rounded-full border border-[var(--bx-brand-ring)]"
                  style={{ animation: 'bx-ring 3.2s var(--bx-ease) infinite 1.6s' }}
                />
                <img src={BRAND_LOGO_SVG} alt={BRAND_NAME} className="relative h-[108px] w-[108px]" />
              </div>
              <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-[var(--bx-text-muted)] uppercase">
                BoxAI Gateway
              </span>
              <span className="inline-flex gap-1.5">
                {d.home.gateway.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded bg-[var(--bx-brand-soft)] px-2 py-0.5 font-mono text-[10px] text-[var(--bx-brand)]"
                  >
                    {chip}
                  </span>
                ))}
              </span>
            </div>
            <div aria-hidden className="relative hidden h-[220px] w-12 md:block lg:hidden">
              <svg viewBox="0 0 48 220" className="absolute inset-0 block h-[220px] w-12">
                {CONNECTORS_RIGHT_MD.map((p) => (
                  <path
                    key={p}
                    d={p}
                    fill="none"
                    stroke="var(--bx-cyan)"
                    strokeOpacity="0.2"
                    strokeWidth="1"
                  />
                ))}
              </svg>
              {CONNECTORS_RIGHT_MD.map((p, i) => (
                <span
                  key={p}
                  className="absolute top-0 left-0 -mt-[2px] -ml-[2px] h-1 w-1 rounded-full bg-[var(--bx-cyan)] shadow-[0_0_8px_2px_var(--bx-info-soft)]"
                  style={{
                    offsetPath: `path('${p}')`,
                    animation: `bx-travel 2.2s linear infinite ${(0.2 + i * 0.55).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
            <div aria-hidden className="relative hidden h-[314px] w-[110px] lg:block">
              <svg viewBox="0 0 110 314" className="absolute inset-0 block h-[314px] w-[110px]">
                {CONNECTORS_RIGHT.map((p) => (
                  <path
                    key={p}
                    d={p}
                    fill="none"
                    stroke="var(--bx-cyan)"
                    strokeOpacity="0.18"
                    strokeWidth="1"
                  />
                ))}
              </svg>
              {CONNECTORS_RIGHT.map((p, i) => (
                <span
                  key={p}
                  className="absolute top-0 left-0 -mt-[2.5px] -ml-[2.5px] h-[5px] w-[5px] rounded-full bg-[var(--bx-cyan)] shadow-[0_0_10px_2px_var(--bx-info-soft)]"
                  style={{
                    offsetPath: `path('${p}')`,
                    animation: `bx-travel 2.2s linear infinite ${(0.2 + i * 0.55).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3.5">
              {products.map((p) => {
                const Icon = p.icon
                return (
                  <div
                    key={p.title}
                    className="flex items-center gap-3 rounded-[10px] border border-[var(--bx-border)] bg-[var(--bx-bg-card)] px-3.5 py-3 transition hover:translate-x-1 hover:border-[var(--bx-brand-ring)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold tracking-tight">{p.title}</span>
                      <span className="mt-0.5 block text-[11.5px] text-[var(--bx-text-dim)]">{p.desc}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Products bento */}
      <section data-screen-label="Products" className="mx-auto max-w-[1200px] px-6 pb-[88px]">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
          <Reveal className="md:col-span-7">
            <div className="flex h-full flex-col overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--bx-brand-ring)]">
              <div className="flex items-center gap-2.5 px-5 pt-[18px]">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                  <ImageIcon size={15} />
                </span>
                <h3 className="m-0 text-[17px] font-extrabold tracking-tight">
                  {d.home.bento.creator.title}
                </h3>
                <span className="rounded border border-[var(--bx-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--bx-text-dim)]">
                  {d.home.bento.creator.path}
                </span>
                <Link
                  to={createHref}
                  className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
                >
                  {d.home.bento.creator.cta} <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
              <p className="mx-5 mt-2 text-[13.5px] leading-relaxed text-[var(--bx-text-muted)]">
                {d.home.bento.creator.body}
              </p>
              <div aria-hidden className="mx-5 mt-4 mb-5 grid grid-cols-4 gap-2">
                {[
                  'linear-gradient(120deg, rgba(31,213,185,0.55), rgba(53,214,244,0.2))',
                  'linear-gradient(200deg, rgba(53,214,244,0.4), rgba(124,199,255,0.3))',
                  'linear-gradient(160deg, rgba(12,159,140,0.5), rgba(31,213,185,0.15))',
                ].map((bg, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg border border-[var(--bx-border)]"
                    style={{ background: bg }}
                  />
                ))}
                <div
                  className="flex aspect-square items-center justify-center rounded-lg border border-[var(--bx-border)]"
                  style={{
                    background:
                      'linear-gradient(90deg, var(--bx-bg-muted) 25%, var(--bx-hover) 50%, var(--bx-bg-muted) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'bx-shimmer 1.6s linear infinite',
                  }}
                >
                  <span className="font-mono text-[10px] text-[var(--bx-text-dim)]">gen…</span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-5" delay={0.04}>
            <div className="flex h-full flex-col overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--bx-brand-ring)]">
              <div className="flex items-center gap-2.5 px-5 pt-[18px]">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                  <Monitor size={15} />
                </span>
                <h3 className="m-0 text-[17px] font-extrabold tracking-tight">
                  {d.home.bento.studio.title}
                </h3>
                <Link
                  to="/studio"
                  className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
                >
                  {d.home.bento.studio.cta} <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
              <p className="mx-5 mt-2 text-[13.5px] leading-relaxed text-[var(--bx-text-muted)]">
                {d.home.bento.studio.body}
              </p>
              <div
                aria-hidden
                className="mx-5 mt-4 mb-5 flex-1 rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg-deep)] px-3.5 py-3 font-mono text-[11.5px] leading-[1.8]"
              >
                <span className="text-[var(--bx-text-dim)]">$</span>{' '}
                <span className="text-[var(--bx-text-soft)]">boxai agent run</span>
                <br />
                <span className="text-[var(--bx-success)]">✓</span>{' '}
                <span className="text-[var(--bx-text-muted)]">signed in · gateway ready</span>
                <br />
                <span className="text-[var(--bx-brand)]">→</span>{' '}
                <span className="text-[var(--bx-text-muted)]">skills: 12 · mcp: 3 · memory: on</span>
                <span
                  className="ml-1 inline-block h-[1em] w-1.5 align-text-bottom bg-[var(--bx-brand)]"
                  style={{ animation: 'bx-blink 1s ease infinite' }}
                />
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-5" delay={0.06}>
            <div className="flex h-full flex-col overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--bx-brand-ring)]">
              <div className="flex items-center gap-2.5 px-5 pt-[18px]">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                  <LayoutDashboard size={15} />
                </span>
                <h3 className="m-0 text-[17px] font-extrabold tracking-tight">
                  {d.home.bento.account.title}
                </h3>
                <Link
                  to={accountHref}
                  className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
                >
                  {d.home.bento.account.cta} <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
              <p className="mx-5 mt-2 text-[13.5px] leading-relaxed text-[var(--bx-text-muted)]">
                {d.home.bento.account.body}
              </p>
              <div className="mx-5 mt-4 mb-5 flex-1 rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg-card)] p-3.5">
                <div className="flex justify-between font-mono text-[10.5px] text-[var(--bx-text-dim)]">
                  <span>{d.home.bento.account.todayTokens}</span>
                  {/* Decorative design sample — not live usage money */}
                  <span className="text-[var(--bx-brand)]">{d.home.bento.account.tokenSample}</span>
                </div>
                <div aria-hidden className="mt-2.5 flex h-[52px] items-end gap-[3px]">
                  {MINI_BARS.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 origin-bottom rounded-t-[2px]"
                      style={{
                        height: `${h}%`,
                        background:
                          i === MINI_BARS.length - 1
                            ? 'var(--bx-brand)'
                            : 'color-mix(in srgb, var(--bx-brand) 45%, transparent)',
                        animation: `bx-bar-grow 0.8s var(--bx-ease) both ${(i * 0.04).toFixed(2)}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="md:col-span-7" delay={0.08}>
            <div className="flex h-full flex-col overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--bx-brand-ring)]">
              <div className="flex flex-wrap items-center gap-2.5 px-5 pt-[18px]">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                  <Code2 size={15} />
                </span>
                <h3 className="m-0 text-[17px] font-extrabold tracking-tight">{d.home.bento.api.title}</h3>
                <span className="rounded border border-[color-mix(in_srgb,var(--bx-success)_35%,transparent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--bx-success)]">
                  {d.home.apiBadge}
                </span>
                <Link
                  to={keysHref}
                  className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
                >
                  {d.home.bento.api.cta} <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
              <p className="mx-5 mt-2 text-[13.5px] leading-relaxed text-[var(--bx-text-muted)]">
                {d.home.bento.api.body}
              </p>
              <pre className="mx-5 mt-4 mb-5 overflow-x-auto rounded-lg border border-[var(--bx-border)] bg-[var(--bx-bg-deep)] px-4 py-3 font-mono text-xs leading-[1.85]">
                <span className="text-[var(--bx-text-dim)]">curl</span>{' '}
                <span className="text-[var(--bx-cyan)]">https://api.you-box.com/v1/chat/completions</span>
                {' \\\n  '}
                <span className="text-[var(--bx-text-dim)]">-H</span>{' '}
                <span className="text-[var(--bx-brand-bright)]">"Authorization: Bearer sk-box-****"</span>
                {' \\\n  '}
                <span className="text-[var(--bx-text-dim)]">-d</span>{' '}
                <span className="text-[var(--bx-text-soft)]">
                  {`'{"model": "claude-sonnet-4-5", "messages": [...]}'`}
                </span>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Developers */}
      <section
        data-screen-label="Developers"
        className="border-t border-[var(--bx-border)] bg-[color-mix(in_srgb,var(--bx-bg-elevated)_55%,transparent)]"
      >
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-6 py-[88px] lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
              <span className="h-px w-5 bg-[var(--bx-brand)]" />
              For Developers
            </p>
            <h2 className="mt-3.5 text-[34px] font-extrabold tracking-tight">
              {d.home.dev.titleLine1}
              <br />
              {d.home.dev.titleLine2}
            </h2>
            <p className="mt-4 max-w-[400px] text-[14.5px] leading-relaxed text-[var(--bx-text-muted)]">
              {d.home.dev.subtitle}
            </p>
            <ul className="mt-6 flex list-none flex-col gap-3 p-0">
              {d.home.dev.bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-2.5 text-sm text-[var(--bx-text-soft)]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[var(--bx-brand-soft)] text-[var(--bx-brand)]">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-1.5 font-mono text-xs">
              {['/v1/chat/completions', '/v1/images/generations', '/v1/videos/generations', '/v1/messages'].map(
                (ep) => (
                  <div key={ep} className="flex gap-2.5">
                    <span className="w-10 text-[var(--bx-success)]">POST</span>
                    <span className="text-[var(--bx-text-muted)]">{ep}</span>
                  </div>
                ),
              )}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border-strong)] bg-[var(--bx-bg-deep)] shadow-[var(--bx-shadow-pop)]">
              <div className="flex items-center gap-1 border-b border-[var(--bx-border)] px-2.5 py-2">
                {CODE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCodeTab(tab.key)}
                    className={cx(
                      'cursor-pointer rounded-[6px] border-none bg-transparent px-3 py-1 font-mono text-[11.5px] transition-colors',
                      codeTab === tab.key
                        ? 'bg-[var(--bx-active)] font-semibold text-[var(--bx-brand-bright)]'
                        : 'font-medium text-[var(--bx-text-dim)] hover:text-[var(--bx-text-soft)]',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={copyCode}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent font-mono text-[10.5px] text-[var(--bx-text-dim)] transition-colors hover:text-[var(--bx-text-soft)]"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? d.common.copied : 'copy'}
                </button>
              </div>
              <pre className="m-0 min-h-[220px] overflow-x-auto px-[22px] py-5 font-mono text-[12.5px] leading-[1.9] whitespace-pre-wrap">
                {codeSamples[codeTab]}
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Live status — always visible shell; real API rows when available */}
      <section data-screen-label="Status" className="mx-auto max-w-[1200px] px-6 py-[88px]">
        <Reveal>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
                <span className="h-px w-5 bg-[var(--bx-brand)]" />
                Live Status
              </p>
              <h2 className="mt-3.5 text-[34px] font-extrabold tracking-tight">{d.status.homeTitle}</h2>
            </div>
            <div className="flex items-center gap-3.5">
              <span
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1 font-mono text-[11px] font-semibold tracking-wider',
                  !statusReady
                    ? 'border-[var(--bx-border)] text-[var(--bx-text-dim)]'
                    : overall === 'degraded'
                      ? 'border-[color-mix(in_srgb,var(--bx-warning)_35%,transparent)] text-[var(--bx-warning)]'
                      : 'border-[color-mix(in_srgb,var(--bx-success)_35%,transparent)] text-[var(--bx-success)]',
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-current"
                  style={{ animation: 'bx-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
                />
                {!statusReady
                  ? '…'
                  : overall === 'degraded'
                    ? d.status.overall.degraded
                    : d.status.overall.operational}
              </span>
              <Link
                to="/status"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
              >
                {d.status.viewAll} <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="overflow-hidden rounded-[var(--bx-radius-xl)] border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] shadow-[var(--bx-shadow-card)]">
            <div className="hidden grid-cols-[220px_110px_1fr_130px_110px] gap-4 border-b border-[var(--bx-border)] px-5 py-2.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[var(--bx-text-dim)] uppercase md:grid">
              <span>{d.home.statusTable.channel}</span>
              <span>{d.home.statusTable.provider}</span>
              <span>{d.home.statusTable.probes}</span>
              <span className="text-right">{d.home.statusTable.latency}</span>
              <span className="text-right">{d.home.statusTable.availability}</span>
            </div>
            {!statusReady ? (
              <StatusSkeletonRows />
            ) : statusItems.length > 0 ? (
              statusItems.map((row) => {
                const color = hslForPct(row.availability)
                const timeline = (row.timeline || []).slice(-30)
                return (
                  <Link
                    key={row.id}
                    to="/status"
                    className="grid grid-cols-1 items-center gap-3 border-t border-[var(--bx-line)] px-5 py-3.5 transition-colors hover:bg-[var(--bx-hover)] md:grid-cols-[220px_110px_1fr_130px_110px] md:gap-4"
                  >
                    <span className="flex items-center gap-2.5 text-[13.5px] font-semibold">
                      <span
                        className="h-1.5 w-1.5 rounded-[2px]"
                        style={{
                          background:
                            row.status === 'operational'
                              ? 'var(--bx-success)'
                              : row.status === 'degraded'
                                ? 'var(--bx-warning)'
                                : 'var(--bx-danger)',
                        }}
                      />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="font-mono text-[11.5px] text-[var(--bx-text-dim)]">
                      {providerLabel(row.provider)}
                    </span>
                    <span className="flex h-[18px] items-end gap-0.5">
                      {timeline.length
                        ? timeline.map((seg, i) => {
                            const ok = seg.status === 'operational'
                            const deg = seg.status === 'degraded'
                            return (
                              <span
                                key={i}
                                className="max-w-2 flex-1 origin-bottom rounded-[1.5px]"
                                style={{
                                  height: ok ? '100%' : deg ? '62%' : '35%',
                                  background: ok
                                    ? 'var(--bx-success)'
                                    : deg
                                      ? 'var(--bx-warning)'
                                      : 'var(--bx-danger)',
                                  animation: `bx-bar-grow 0.7s var(--bx-ease) both ${(i * 0.02).toFixed(2)}s`,
                                }}
                              />
                            )
                          })
                        : Array.from({ length: 30 }, (_, i) => (
                            <span
                              key={i}
                              className="max-w-2 flex-1 rounded-[1.5px] bg-[var(--bx-bg-muted)]"
                              style={{ height: '50%' }}
                            />
                          ))}
                    </span>
                    <span className="text-right font-mono text-[12.5px] tabular-nums text-[var(--bx-text-soft)]">
                      {row.latency_ms != null ? `${Math.round(row.latency_ms)} ms` : '—'}
                    </span>
                    <span
                      className="text-right font-mono text-[13px] font-semibold tabular-nums"
                      style={color ? { color } : undefined}
                    >
                      {formatAvailability(row.availability)}%
                    </span>
                  </Link>
                )
              })
            ) : (
              <div className="border-t border-[var(--bx-line)] px-5 py-10 text-center">
                <p className="m-0 text-sm font-semibold text-[var(--bx-text-soft)]">{d.status.emptyTitle}</p>
                <p className="mt-2 text-[13px] text-[var(--bx-text-muted)]">{d.status.emptyBody}</p>
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* Pricing teaser — 入门 / 专业 / 企业 from dedicated teaser plans */}
      <section data-screen-label="Pricing" className="mx-auto max-w-[1200px] px-6 pb-[88px]">
        <Reveal>
          <div className="grid gap-3.5 md:grid-cols-[0.8fr_1fr_1fr_1fr]">
            <div className="flex flex-col justify-center pr-4">
              <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
                <span className="h-px w-5 bg-[var(--bx-brand)]" />
                Pricing
              </p>
              <h2 className="mt-3.5 text-[30px] font-extrabold tracking-tight">
                {d.home.pricingTeaser.title}
              </h2>
              <Link
                to="/pricing"
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]"
              >
                {d.home.pricingTeaser.cta} <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
            {teaserPlans.map((plan) => {
              const href = teaserHref(plan.ctaKind)
              const isExternal = plan.ctaKind === 'contact'
              const linkCls = cx(
                'mt-4 text-[13px] font-bold',
                plan.highlighted ? 'text-[var(--bx-brand)]' : 'text-[var(--bx-text-soft)]',
              )
              return (
                <div
                  key={plan.name}
                  className={cx(
                    'relative flex flex-col rounded-[var(--bx-radius-lg)] p-[22px] transition hover:-translate-y-0.5',
                    plan.highlighted
                      ? 'border border-transparent'
                      : 'border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] hover:border-[var(--bx-brand-ring)]',
                  )}
                  style={
                    plan.highlighted
                      ? {
                          background:
                            'linear-gradient(var(--bx-bg-elevated), var(--bx-bg-elevated)) padding-box, var(--bx-grad-border) border-box',
                          border: '1px solid transparent',
                        }
                      : undefined
                  }
                >
                  {plan.highlighted ? (
                    <span className="absolute -top-2.5 right-3.5 rounded bg-[var(--bx-grad-cta)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--bx-ink)]">
                      {d.pricing.highlight}
                    </span>
                  ) : null}
                  <span
                    className={cx(
                      'font-mono text-[11px] tracking-[0.12em] uppercase',
                      plan.highlighted ? 'text-[var(--bx-brand)]' : 'text-[var(--bx-text-dim)]',
                    )}
                  >
                    {plan.name}
                  </span>
                  <p className="mt-2.5 font-mono text-[30px] font-semibold tracking-tight">
                    {plan.price}
                    {plan.period ? (
                      <span className="text-[13px] text-[var(--bx-text-dim)]">{plan.period}</span>
                    ) : null}
                  </p>
                  <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-[var(--bx-text-muted)]">
                    {plan.desc}
                  </p>
                  {isExternal ? (
                    <a href={href} className={linkCls}>
                      {plan.cta} →
                    </a>
                  ) : (
                    <Link to={href} className={linkCls}>
                      {plan.cta} →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section data-screen-label="FAQ" id="faq" className="mx-auto max-w-[1200px] px-6 pb-[88px]">
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_2.2fr]">
            <div>
              <p className="m-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase">
                <span className="h-px w-5 bg-[var(--bx-brand)]" />
                {d.home.faq.eyebrow}
              </p>
              <h2 className="mt-3.5 text-[30px] font-extrabold tracking-tight">{d.home.faq.title}</h2>
            </div>
            <FaqList items={d.home.faq.items} idPrefix="home-faq" />
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section data-screen-label="CTA" className="mx-auto max-w-[1200px] px-6 pb-24">
        <Reveal>
          <CtaBand
            title={d.home.cta.title1}
            titleAccent={d.home.cta.title2}
            subtitle={d.home.cta.subtitle}
            actions={[
              {
                kind: 'link',
                to: authed ? '/create' : '/signup',
                label: d.home.cta.primary,
                primary: true,
              },
              { kind: 'link', to: '/pricing', label: d.home.cta.secondary, primary: false },
            ]}
          />
        </Reveal>
      </section>
    </div>
  )
}
