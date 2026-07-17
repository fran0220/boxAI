import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'

export type CtaAction =
  | { kind: 'link'; to: string; label: string; primary?: boolean }
  | { kind: 'href'; href: string; label: string; primary?: boolean; external?: boolean }
  | { kind: 'button'; onClick: () => void; label: string; primary?: boolean }

/**
 * Masked-grid CTA band matching Home: animated border, radial brand glow, grid mask.
 */
export function CtaBand({
  title,
  titleAccent,
  subtitle,
  actions,
  className,
}: {
  title: string
  titleAccent?: string
  subtitle?: string
  actions: CtaAction[]
  className?: string
}) {
  return (
    <div
      className={cx('rounded-[var(--bx-radius-xl)] p-[1.5px]', className)}
      style={{
        background: 'var(--bx-grad-border)',
        backgroundSize: '300% auto',
        animation: 'bx-borderflow 8s linear infinite',
      }}
    >
      <div className="relative overflow-hidden rounded-[15px] bg-[var(--bx-bg-deep)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 130% at 50% 0%, var(--bx-brand-soft), transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(var(--bx-line) 1px, transparent 1px), linear-gradient(90deg, var(--bx-line) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 90% at 50% 50%, #000 20%, transparent 80%)',
            maskImage: 'radial-gradient(ellipse 70% 90% at 50% 50%, #000 20%, transparent 80%)',
          }}
        />
        <div className="relative flex flex-col items-start justify-between gap-8 px-8 py-12 sm:flex-row sm:items-center sm:px-14 sm:py-[52px]">
          <div>
            <h2 className="m-0 text-[28px] font-extrabold tracking-tight sm:text-[34px]">
              {title}
              {titleAccent ? (
                <span className="bg-[var(--bx-grad-hero)] bg-clip-text text-transparent">
                  {titleAccent}
                </span>
              ) : null}
            </h2>
            {subtitle ? (
              <p className="mt-2.5 text-[14.5px] text-[var(--bx-text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {actions.map((action, i) => {
              const primary = action.primary ?? i === 0
              const cls = primary
                ? 'inline-flex items-center gap-2 rounded-[var(--bx-radius-btn)] bg-[var(--bx-grad-cta)] px-6 py-3 text-[15px] font-bold text-[var(--bx-ink)] shadow-[var(--bx-shadow-cta)] transition hover:-translate-y-0.5'
                : 'inline-flex items-center gap-2 rounded-[var(--bx-radius-btn)] border border-[var(--bx-border-strong)] px-6 py-3 text-[15px] font-bold text-[var(--bx-text)] transition hover:border-[var(--bx-brand)] hover:text-[var(--bx-brand-bright)]'
              if (action.kind === 'link') {
                return (
                  <Link key={`${action.label}-${i}`} to={action.to} className={cls}>
                    {action.label}
                  </Link>
                )
              }
              if (action.kind === 'href') {
                return (
                  <a
                    key={`${action.label}-${i}`}
                    href={action.href}
                    className={cls}
                    target={action.external ? '_blank' : undefined}
                    rel={action.external ? 'noopener' : undefined}
                  >
                    {action.label}
                  </a>
                )
              }
              return (
                <button
                  key={`${action.label}-${i}`}
                  type="button"
                  onClick={action.onClick}
                  className={cls}
                >
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
