import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { BX_EASE } from './Reveal'

export function AnimatedNumber({
  value,
  decimals,
  className,
}: {
  value: number
  decimals?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const places = decimals ?? (Number.isInteger(value) ? 0 : 1)
  const [display, setDisplay] = useState(reduced ? value.toFixed(places) : (0).toFixed(places))

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setDisplay(value.toFixed(places))
      return
    }
    const controls = animate(0, value, {
      duration: 1.55,
      ease: BX_EASE,
      onUpdate: (v) => setDisplay(v.toFixed(places)),
    })
    return () => controls.stop()
  }, [inView, value, places, reduced])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}
