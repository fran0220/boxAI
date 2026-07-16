import { cx } from '@/lib/cx'

/** Animated gradient-border shell for CTA bands / highlighted panels. */
export function GradientRing({
  children,
  className,
  innerClassName,
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <div className={cx('bx-ring-flow', className)}>
      <div className={cx('bx-ring-inner', innerClassName)}>
        <div className="bx-ring-glow" aria-hidden />
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}
