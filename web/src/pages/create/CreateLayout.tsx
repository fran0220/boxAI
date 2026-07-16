import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ensureCreatorKey } from '@/lib/api'

const links = [
  { to: '/create/chat', label: 'Chat' },
  { to: '/create/image', label: 'Image' },
  { to: '/create/video', label: 'Video' },
  { to: '/create/assets', label: 'Assets' },
]

export function CreateLayout() {
  const [keyReady, setKeyReady] = useState(false)
  const [keyError, setKeyError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureCreatorKey()
        if (!cancelled) setKeyReady(true)
      } catch (e) {
        if (!cancelled) {
          setKeyError(e instanceof Error ? e.message : 'Could not ensure Creator key')
          setKeyReady(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Creator</h1>
          <p className="mt-1 text-sm text-[var(--bx-text-muted)]">
            Browser playground on the BoxAI gateway (`/v1/*` with your JWT).
          </p>
        </div>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm ${
                  isActive
                    ? 'bg-[rgba(45,212,191,0.15)] text-[var(--bx-teal)]'
                    : 'text-[var(--bx-text-muted)] hover:text-[var(--bx-text)]'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {!keyReady && (
        <p className="mb-4 text-xs text-[var(--bx-text-dim)]">Preparing Creator key…</p>
      )}
      {keyError ? (
        <p className="mb-4 text-xs text-amber-400">
          {keyError} — gateway calls may fail until an API key exists.
        </p>
      ) : null}
      <Outlet />
    </div>
  )
}
