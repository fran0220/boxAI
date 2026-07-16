import { Reveal } from '@/components/motion/Reveal'
import { cx } from '@/lib/cx'

export function Section({
  eyebrow,
  title,
  subtitle,
  children,
  className,
  align = 'center',
}: {
  eyebrow?: string
  title?: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
  align?: 'center' | 'left'
}) {
  return (
    <section className={cx('mx-auto max-w-6xl px-4 py-16 sm:py-24', className)}>
      {(eyebrow || title || subtitle) && (
        <Reveal className={cx('mb-10 sm:mb-14', align === 'center' && 'text-center')}>
          {eyebrow ? <p className="bx-eyebrow mb-3">{eyebrow}</p> : null}
          {title ? (
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          ) : null}
          {subtitle ? (
            <p
              className={cx(
                'mt-4 max-w-2xl text-base text-[var(--bx-text-muted)] sm:text-lg',
                align === 'center' && 'mx-auto',
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </Reveal>
      )}
      {children}
    </section>
  )
}
