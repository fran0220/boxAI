import { cx } from '@/lib/cx'

/** Vue-home ambient: three aurora blobs + faint grid. */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cx('bx-ambient', className)} aria-hidden>
      <div className="bx-aurora bx-aurora-1" />
      <div className="bx-aurora bx-aurora-2" />
      <div className="bx-aurora bx-aurora-3" />
      <div className="bx-grid" />
    </div>
  )
}
