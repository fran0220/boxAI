import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { FolderOpen, Image as ImageIcon, Menu, Play, X } from 'lucide-react'
import { ensureCreatorKey } from '@/lib/api'
import { getProfile, getUsageDashboardTrend } from '@/lib/customer-api'
import { listAssets } from '@/lib/assets-db'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { BX_EASE } from '@/components/motion/Reveal'
import { useStore as usePlaygroundStore } from '@/image-playground/store'

export interface CreateOutletContext {
  keyReady: boolean
  keyError: string
}

const DESKTOP_MQ = '(min-width: 1024px)'

function monthRange() {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start_date: fmt(start), end_date: fmt(end) }
}

function formatUsd(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return `$${n.toFixed(2)}`
}

/**
 * Creator workspace under site Layout.
 * Left 208px rail: mono workspace label, icon+label+count nav, balance card.
 */
export function CreateLayout() {
  const { d } = useI18n()
  usePageMeta(d.create.metaTitle)
  const location = useLocation()

  const [keyReady, setKeyReady] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : true,
  )
  const [balance, setBalance] = useState<number | null>(null)
  const [monthSpend, setMonthSpend] = useState<number | null>(null)
  const [counts, setCounts] = useState<{ image: number; video: number; assets: number }>({
    image: 0,
    video: 0,
    assets: 0,
  })
  // Align image nav badge with playground gallery task count when available
  const playgroundTaskCount = usePlaygroundStore((s) => s.tasks.length)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureCreatorKey()
        if (!cancelled) setKeyReady(true)
      } catch (e) {
        if (!cancelled) {
          setKeyError(e instanceof Error ? e.message : 'ensure-key failed')
          setKeyReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Balance + month spend for sidebar card (best-effort; show — when unavailable)
  useEffect(() => {
    let cancelled = false
    const range = monthRange()
    ;(async () => {
      try {
        const [p, tr] = await Promise.all([
          getProfile().catch(() => null),
          getUsageDashboardTrend({
            start_date: range.start_date,
            end_date: range.end_date,
            granularity: 'day',
          }).catch(() => null),
        ])
        if (cancelled) return
        if (p && typeof p.balance === 'number') setBalance(p.balance)
        if (tr?.trend?.length) {
          const sum = tr.trend.reduce(
            (acc, point) => acc + Number(point.actual_cost ?? point.cost ?? 0),
            0,
          )
          setMonthSpend(sum)
        }
      } catch {
        /* optional chrome */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Local asset counts for nav mono badges
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all = await listAssets()
        if (cancelled) return
        const image = all.filter((a) => a.kind === 'image').length
        const video = all.filter((a) => a.kind === 'video').length
        setCounts({ image, video, assets: all.length })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const onChange = () => {
      setDesktop(mq.matches)
      if (mq.matches) setDrawerOpen(false)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (desktop || !drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [desktop, drawerOpen])

  const panels = useMemo(
    () => [
      {
        to: '/create/image',
        label: d.create.nav.image,
        icon: ImageIcon,
        // Prefer live playground task count (gallery) when store has items
        count: playgroundTaskCount > 0 ? playgroundTaskCount : counts.image,
      },
      {
        to: '/create/video',
        label: d.create.nav.video,
        icon: Play,
        count: counts.video,
      },
      {
        to: '/create/assets',
        label: d.create.nav.assets,
        icon: FolderOpen,
        count: counts.assets,
      },
    ],
    [d.create.nav, counts, playgroundTaskCount],
  )

  const activePanel =
    panels.find((p) => location.pathname.startsWith(p.to)) ??
    (location.pathname === '/create' ? panels[0] : undefined)

  function isActivePath(to: string) {
    if (location.pathname.startsWith(to)) return true
    if (location.pathname === '/create' && to === '/create/image') return true
    return false
  }

  // Progress: month spend vs spend+remaining balance (visual only)
  const usagePct = useMemo(() => {
    if (monthSpend == null || balance == null) return null
    const total = monthSpend + Math.max(0, balance)
    if (total <= 0) return 0
    return Math.min(100, Math.round((monthSpend / total) * 100))
  }, [monthSpend, balance])

  const sidebar = (
    <aside className="bx-create-sidebar" aria-label={d.create.title}>
      <div className="bx-create-sidebar-head">
        <p className="bx-create-workspace-label">{d.create.workspaceLabel}</p>
        {!desktop ? (
          <button
            type="button"
            className="bx-create-drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label={d.common.close}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <nav className="bx-create-sidebar-nav" role="navigation">
        {panels.map((panel) => {
          const Icon = panel.icon
          const active = isActivePath(panel.to)
          return (
            <NavLink
              key={panel.to}
              to={panel.to}
              className={cx('bx-create-side-link', active && 'is-active')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="bx-create-side-icon" aria-hidden="true">
                <Icon size={15} strokeWidth={2} />
              </span>
              <span className="bx-create-side-label">{panel.label}</span>
              <span className="bx-create-side-count">{panel.count}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="bx-create-balance-wrap">
        <div className="bx-create-balance-card">
          <div className="bx-create-balance-row">
            <span className="bx-create-balance-label">{d.create.balanceLabel}</span>
            <span className="bx-create-balance-amount">{formatUsd(balance)}</span>
          </div>
          <div className="bx-create-balance-bar" aria-hidden="true">
            <div
              className="bx-create-balance-bar-fill"
              style={{ width: usagePct != null ? `${usagePct}%` : '0%' }}
            />
          </div>
          <p className="bx-create-balance-meta">
            {d.create.monthUsed.replace(
              '{amount}',
              monthSpend != null ? formatUsd(monthSpend) : '—',
            )}
            {' · '}
            <Link to="/checkout" className="bx-create-balance-topup">
              {d.create.topUp}
            </Link>
          </p>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="bx-create-workspace">
      <div className="bx-create-mobile-bar lg:hidden">
        <button
          type="button"
          className="bx-btn bx-btn-ghost bx-btn-sm"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-controls="create-sidebar-drawer"
        >
          <Menu size={16} />
          {d.create.openPanels}
        </button>
        {activePanel ? (
          <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--bx-text-soft)]">
            <activePanel.icon size={15} className="shrink-0 text-[var(--bx-brand-bright)]" />
            <span className="truncate font-medium">{activePanel.label}</span>
          </div>
        ) : null}
      </div>

      {!keyReady ? (
        <div className="bx-create-banner">{d.create.keyPreparing}</div>
      ) : keyError ? (
        <div className="bx-create-banner bx-create-banner--warn">
          {d.create.keyFailed} {keyError}
        </div>
      ) : null}

      <div className="bx-create-shell-row">
        <div className="bx-create-sidebar-rail hidden lg:flex">{sidebar}</div>

        <AnimatePresence>
          {!desktop && drawerOpen ? (
            <>
              <motion.button
                type="button"
                aria-label={d.common.close}
                className="bx-create-drawer-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setDrawerOpen(false)}
              />
              <motion.div
                id="create-sidebar-drawer"
                className="bx-create-drawer-panel"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.28, ease: BX_EASE }}
              >
                {sidebar}
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <div className="bx-create-body">
          <Outlet context={{ keyReady, keyError } satisfies CreateOutletContext} />
        </div>
      </div>
    </div>
  )
}
