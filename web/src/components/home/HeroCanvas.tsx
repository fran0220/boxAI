import { useEffect, useRef } from 'react'

/**
 * Interactive constellation field for the Home hero.
 * - Slow-drifting brand particles, linked by hairlines when close.
 * - Pointer gently repels particles and links to nearby ones.
 * - Perf: DPR capped at 2, particle count scales with area, rAF pauses
 *   when offscreen or the tab is hidden. Reduced motion → one static frame.
 */

type Particle = {
  x: number
  y: number
  /** base drift velocity */
  bx: number
  by: number
  /** current velocity (base + pointer perturbation) */
  vx: number
  vy: number
  r: number
  /** rgb triplet */
  c: string
  a: number
}

const COLORS = ['108,245,221', '53,214,244', '124,199,255'] // brand-bright / cyan / sky
const LINK_DIST = 112
const MOUSE_DIST = 150

export function HeroCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let visible = true
    let w = 0
    let h = 0
    let particles: Particle[] = []
    const mouse = { x: -9999, y: -9999 }

    const seed = () => {
      const count = Math.max(36, Math.min(120, Math.floor((w * h) / 15000)))
      particles = Array.from({ length: count }, () => {
        const bx = (Math.random() - 0.5) * 0.36
        const by = (Math.random() - 0.5) * 0.36
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          bx,
          by,
          vx: bx,
          vy: by,
          r: 0.7 + Math.random() * 1.2,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          a: 0.28 + Math.random() * 0.5,
        }
      })
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (particles.length === 0 && w > 0 && h > 0) seed()
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      const link2 = LINK_DIST * LINK_DIST
      const mouse2 = MOUSE_DIST * MOUSE_DIST
      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const d2 = dx * dx + dy * dy
          if (d2 < link2) {
            const t = 1 - Math.sqrt(d2) / LINK_DIST
            ctx.strokeStyle = `rgba(${p.c},${(t * 0.22).toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }
        const mdx = p.x - mouse.x
        const mdy = p.y - mouse.y
        const md2 = mdx * mdx + mdy * mdy
        if (md2 < mouse2) {
          const t = 1 - Math.sqrt(md2) / MOUSE_DIST
          ctx.strokeStyle = `rgba(${p.c},${(t * 0.45).toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
      }
      for (const p of particles) {
        ctx.fillStyle = `rgba(${p.c},${p.a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const step = () => {
      const mouse2 = MOUSE_DIST * MOUSE_DIST
      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d2 = dx * dx + dy * dy
        if (d2 < mouse2 && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = ((MOUSE_DIST - d) / MOUSE_DIST) * 0.05
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }
        p.x += p.vx
        p.y += p.vy
        // Relax back to the base drift so the field never stalls or scatters.
        p.vx = p.vx * 0.96 + p.bx * 0.04
        p.vy = p.vy * 0.96 + p.by * 0.04
        if (p.x < -24) p.x = w + 24
        else if (p.x > w + 24) p.x = -24
        if (p.y < -24) p.y = h + 24
        else if (p.y > h + 24) p.y = -24
      }
    }

    const loop = () => {
      if (visible && !document.hidden) {
        step()
        draw()
      }
      raf = requestAnimationFrame(loop)
    }

    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const onPointerLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }

    resize()
    if (reduced) {
      draw()
      return
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    io.observe(canvas)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}
