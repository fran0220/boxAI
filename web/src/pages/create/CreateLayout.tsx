import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { FolderOpen, Image as ImageIcon, Menu, Play, X } from 'lucide-react'
import { ensureCreatorKey } from '@/lib/api'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { BX_EASE } from '@/components/motion/Reveal'

export interface CreateOutletContext {
  keyReady: boolean
  keyError: string
}

const DESKTOP_MQ = '(min-width: 1024px)'

/**
 * Creator workspace under site Layout.
 * Left responsive drawer switches image / video / assets — not a top tab strip.
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

  // Close mobile drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (desktop || !drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [desktop, drawerOpen])

  const panels = [
    {
      to: '/create/image',
      label: d.create.nav.image,
      desc: d.create.nav.imageDesc,
      icon: ImageIcon,
    },
    {
      to: '/create/video',
      label: d.create.nav.video,
      desc: d.create.nav.videoDesc,
      icon: Play,
    },
    {
      to: '/create/assets',
      label: d.create.nav.assets,
      desc: d.create.nav.assetsDesc,
      icon: FolderOpen,
    },
  ]

  const activePanel =
    panels.find((p) => location.pathname.startsWith(p.to)) ??
    (location.pathname === '/create' ? panels[0] : undefined)

  function isActivePath(to: string) {
    if (location.pathname.startsWith(to)) return true
    if (location.pathname === '/create' && to === '/create/image') return true
    return false
  }

  const sidebar = (
    <aside className="bx-create-sidebar" aria-label={d.create.title}>
      <div className="bx-create-sidebar-head">
        <div className="min-w-0">
          <p className="bx-display text-sm font-semibold tracking-tight">{d.create.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--bx-text-dim)]">
            {d.create.workspaceHint}
          </p>
        </div>
        {!desktop ? (
          <button
            type="button"
            className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-dim)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
            onClick={() => setDrawerOpen(false)}
            aria-label={d.common.close}
          >
            <X size={18} />
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
              <span className="bx-create-side-icon">
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium tracking-tight">{panel.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--bx-text-dim)]">
                  {panel.desc}
                </span>
              </span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )

  return (
    <div className="bx-create-workspace">
      {/* Mobile top bar: open drawer + current panel */}
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
        {/* Desktop: fixed left rail */}
        <div className="bx-create-sidebar-rail hidden lg:flex">{sidebar}</div>

        {/* Mobile: overlay drawer */}
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
