import { cx } from '@/lib/cx'

/** Mono eyebrow + title block used across marketing pages (Home language). */
export function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div className={cx(align === 'center' && 'text-center', className)}>
      {eyebrow ? (
        <p
          className={cx(
            'm-0 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-[var(--bx-brand)] uppercase',
            align === 'center' && 'justify-center',
          )}
        >
          <span className="h-px w-5 bg-[var(--bx-brand)]" />
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cx(
          'font-extrabold tracking-tight',
          eyebrow ? 'mt-3.5 text-[28px] sm:text-[30px]' : 'text-[28px] sm:text-[30px]',
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cx(
            'mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--bx-text-muted)]',
            align === 'center' && 'mx-auto',
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
