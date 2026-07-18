import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Code2, Image as ImageIcon, Monitor } from 'lucide-react'
import { BRAND_LOGO_SVG, BRAND_NAME, BRAND_PLATFORM_BADGE } from '@/lib/brand'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'
import { fetchPublicStatus } from '@/lib/public-status'

export type AuthTab = 'login' | 'signup'

export interface AuthSplitLayoutProps {
  /** When set, shows segmented 登录/注册 tabs. Omit for forgot/reset/oauth. */
  activeTab?: AuthTab
  title: string
  subtitle?: string
  /** Preserved across login ↔ signup tab navigation. */
  returnTo?: string
  children: ReactNode
}

function tabTo(path: string, returnTo?: string) {
  if (!returnTo || returnTo === '/app') return path
  return `${path}?return_to=${encodeURIComponent(returnTo)}`
}

type LiveStatus = 'checking' | 'operational' | 'degraded' | 'unknown'

export function AuthSplitLayout({
  activeTab,
  title,
  subtitle,
  returnTo,
  children,
}: AuthSplitLayoutProps) {
  const { d } = useI18n()
  const t = d.authForms
  const side = d.authSplit
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('checking')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    fetchPublicStatus('7d', controller.signal)
      .then((res) => {
        if (cancelled) return
        setLiveStatus(res.overall === 'degraded' ? 'degraded' : 'operational')
      })
      .catch(() => {
        if (!cancelled) setLiveStatus('unknown')
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const statusLabel =
    liveStatus === 'operational'
      ? side.statusOk
      : liveStatus === 'degraded'
        ? side.statusDegraded
        : liveStatus === 'checking'
          ? side.statusChecking
          : side.statusUnknown

  const features = [
    {
      icon: ImageIcon,
      title: side.featureCreator,
      desc: side.featureCreatorDesc,
    },
    {
      icon: Monitor,
      title: side.featureStudio,
      desc: side.featureStudioDesc,
    },
    {
      icon: Code2,
      title: side.featureApi,
      desc: side.featureApiDesc,
    },
  ] as const

  return (
    <div className="bx-auth-split">
      <aside className="bx-auth-brand" data-screen-label="品牌侧栏" aria-label={BRAND_NAME}>
        <div className="bx-auth-brand-grid" aria-hidden="true" />
        <div className="bx-auth-brand-aurora" aria-hidden="true" />

        <Link to="/" className="bx-auth-brand-logo">
          <img src={BRAND_LOGO_SVG} alt="" width={28} height={28} />
          <span>{BRAND_NAME}</span>
        </Link>

        <div className="bx-auth-brand-body">
          <p className="bx-auth-brand-eyebrow">{side.platformEyebrow || BRAND_PLATFORM_BADGE}</p>
          <h1 className="bx-auth-brand-headline">
            {side.headline}
            <br />
            <span className="bx-auth-brand-headline-grad">{side.headlineGradient}</span>
          </h1>

          <div className="bx-auth-feature-list">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="bx-auth-feature-chip">
                  <span className="bx-auth-feature-icon">
                    <Icon size={14} strokeWidth={2} />
                  </span>
                  <span>
                    <span className="bx-auth-feature-title">{f.title}</span>
                    <span className="bx-auth-feature-desc">{f.desc}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bx-auth-brand-foot">
          <Link
            to="/status"
            className={cx(
              'bx-auth-status no-underline',
              liveStatus === 'degraded' && 'text-[var(--bx-warning)]',
              liveStatus === 'unknown' && 'opacity-80',
            )}
          >
            <span
              className={cx(
                'bx-auth-status-dot',
                liveStatus === 'degraded' && 'bg-[var(--bx-warning)]',
                liveStatus === 'unknown' && 'bg-[var(--bx-text-dim)]',
                liveStatus === 'checking' && 'opacity-50',
              )}
              aria-hidden="true"
            />
            {statusLabel}
          </Link>
          <span className="bx-auth-domain">{side.domain}</span>
        </div>
      </aside>

      <main className="bx-auth-form-panel" data-screen-label="登录表单">
        <div className="bx-auth-form">
          {/* Mobile brand strip (sidebar hidden below md) */}
          <Link to="/" className="bx-auth-mobile-logo">
            <img src={BRAND_LOGO_SVG} alt="" width={28} height={28} />
            <span>{BRAND_NAME}</span>
          </Link>

          <div className="bx-auth-form-head">
            <div className="bx-auth-form-titles">
              <h2 className="bx-auth-form-title">{title}</h2>
              {subtitle ? <p className="bx-auth-form-sub">{subtitle}</p> : null}
            </div>

            {activeTab ? (
              <div className="bx-auth-tabs" role="tablist" aria-label={t.tabLogin + ' / ' + t.tabSignup}>
                <Link
                  to={tabTo('/login', returnTo)}
                  role="tab"
                  aria-selected={activeTab === 'login'}
                  className={cx('bx-auth-tab', activeTab === 'login' && 'is-active')}
                >
                  {t.tabLogin}
                </Link>
                <Link
                  to={tabTo('/signup', returnTo)}
                  role="tab"
                  aria-selected={activeTab === 'signup'}
                  className={cx('bx-auth-tab', activeTab === 'signup' && 'is-active')}
                >
                  {t.tabSignup}
                </Link>
              </div>
            ) : null}
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
