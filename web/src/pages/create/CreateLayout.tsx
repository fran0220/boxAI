import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Image as ImageIcon, Play, User } from 'lucide-react'
import { ensureCreatorKey } from '@/lib/api'
import { BRAND_LOGO_SVG } from '@/lib/brand'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { LangSwitcher } from '@/components/LangSwitcher'

export function CreateLayout() {
  const { d } = useI18n()
  usePageMeta(d.create.metaTitle)

  const [keyReady, setKeyReady] = useState(false)
  const [keyError, setKeyError] = useState('')

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

  const tabs = [
    { to: '/create/image', label: d.create.nav.image, icon: ImageIcon },
    { to: '/create/video', label: d.create.nav.video, icon: Play },
    { to: '/create/assets', label: d.create.nav.assets, icon: FolderOpen },
  ]

  return (
    <div className="bx-page flex h-dvh flex-col">
      <header className="bx-glass z-30 border-b border-[var(--bx-border)]">
        <div className="flex h-12 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex shrink-0 items-center gap-2" title={d.create.backHome}>
              <img src={BRAND_LOGO_SVG} alt="" className="h-7 w-7" />
              <span className="hidden text-sm font-semibold sm:inline">{d.create.title}</span>
            </Link>
            <nav className="flex items-center gap-0.5 overflow-x-auto">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cx(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-[var(--bx-active)] text-[var(--bx-teal)]'
                        : 'text-[var(--bx-text-muted)] hover:text-[var(--bx-text)]',
                    )
                  }
                >
                  <tab.icon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LangSwitcher />
            <Link
              to="/account"
              className="rounded-full p-2 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
              aria-label={d.nav.account}
            >
              <User size={16} />
            </Link>
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)] md:flex"
            >
              <ArrowLeft size={14} />
              {d.create.backHome}
            </Link>
          </div>
        </div>
      </header>

      {!keyReady ? (
        <p className="border-b border-[var(--bx-border)] px-4 py-1.5 text-xs text-[var(--bx-text-dim)]">
          {d.create.keyPreparing}
        </p>
      ) : keyError ? (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-400">
          {d.create.keyFailed} {keyError}
        </p>
      ) : null}

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
