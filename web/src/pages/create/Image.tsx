import { lazy, Suspense } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import type { CreateOutletContext } from './CreateLayout'

const PlaygroundApp = lazy(() =>
  import('@/image-playground/BoxaiPlaygroundRoot').then((m) => ({ default: m.BoxaiPlaygroundRoot })),
)

/**
 * Creator image workbench — full gpt_image_playground embed
 * (vendored under `@/image-playground`, MIT CookSleep).
 */
export function ImageGen() {
  const { keyReady } = useOutletContext<CreateOutletContext>()
  const location = useLocation()
  const navigate = useNavigate()

  // Defer mounting until ensureCreatorKey finishes so first API calls succeed.
  if (!keyReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <PlaygroundApp
        locationState={location.state}
        clearState={() => navigate(location.pathname, { replace: true })}
      />
    </Suspense>
  )
}
