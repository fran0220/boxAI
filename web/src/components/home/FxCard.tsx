import { useRef } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react'
import { cx } from '@/lib/cx'

/**
 * Card wrapper with two hover effects:
 * - spotlight: cursor-tracking radial highlight (`.bx-fxcard::after`, always on)
 * - tilt: subtle 3D rotation with spring return (default on, `tilt={false}` to disable)
 *
 * Note: when `tilt` is on, motion writes an inline `transform` every frame —
 * don't put a CSS `transition` covering `transform` on the same element
 * (use `transition-[border-color,box-shadow]` etc. instead).
 */
export function FxCard({
  children,
  className,
  tilt = true,
  max = 5,
  style,
}: {
  children: React.ReactNode
  className?: string
  tilt?: boolean
  /** max tilt angle in degrees (per axis) */
  max?: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 240, damping: 22, mass: 0.6 })
  const sry = useSpring(ry, { stiffness: 240, damping: 22, mass: 0.6 })
  const transform = useMotionTemplate`perspective(900px) rotateX(${srx}deg) rotateY(${sry}deg)`

  const active = tilt && !reduced

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(2)}%`)
    if (active) {
      ry.set((px - 0.5) * max)
      rx.set((0.5 - py) * max)
    }
  }
  const onPointerLeave = () => {
    rx.set(0)
    ry.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={active ? { ...style, transform } : style}
      className={cx('bx-fxcard', className)}
    >
      {children}
    </motion.div>
  )
}
