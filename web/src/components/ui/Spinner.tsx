import { cx } from '@/lib/cx'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'h-8 w-8 animate-spin rounded-full border-2 border-[var(--bx-teal)] border-t-transparent',
        className,
      )}
      aria-hidden
    />
  )
}
