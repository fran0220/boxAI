import { cx } from '@/lib/cx'

/** Isometric open-cube mark — teal/cyan brand (console-aligned). */
export function CubeMark({
  className,
  maxWidth = 460,
}: {
  className?: string
  maxWidth?: number
}) {
  const uid = 'bxcm'

  return (
    <div className={cx('relative flex items-center justify-center', className)}>
      <div className="bx-logo-glow absolute" />
      <svg
        viewBox="0 0 128 128"
        className="relative h-auto w-full"
        style={{ maxWidth }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`${uid}-face`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id={`${uid}-top`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id={`${uid}-spark`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#67e8f9" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="bx-face-l"
          d="M36 52 L64 68 L64 100 L36 84 Z"
          fill={`url(#${uid}-face)`}
          opacity="0.94"
        />
        <path
          className="bx-face-r"
          d="M64 68 L92 52 L92 84 L64 100 Z"
          fill="#0d9488"
          opacity="0.96"
        />
        <path
          className="bx-face-top"
          d="M36 52 L64 36 L92 52 L64 68 Z"
          fill={`url(#${uid}-top)`}
          opacity="0.9"
        />
        <path
          className="bx-face-top"
          d="M44 54 L64 42 L84 54 L64 66 Z"
          fill="#042f2e"
          opacity="0.4"
        />

        <g filter={`url(#${uid}-glow)`}>
          <path
            className="bx-line"
            d="M64 50 L48 30"
            stroke="#14b8a6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            className="bx-line bx-line-d1"
            d="M64 50 L64 22"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            className="bx-line bx-line-d2"
            d="M64 50 L80 30"
            stroke="#14b8a6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle className="bx-node" cx="48" cy="30" r="3.5" fill="#14b8a6" />
          <circle className="bx-node bx-node-d1" cx="64" cy="22" r="3.5" fill="#06b6d4" />
          <circle className="bx-node bx-node-d2" cx="80" cy="30" r="3.5" fill="#14b8a6" />
          <circle className="bx-spark-dot" cx="64" cy="50" r="5" fill={`url(#${uid}-spark)`} />
        </g>
      </svg>
    </div>
  )
}
