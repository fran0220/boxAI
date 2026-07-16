import { lazy, Suspense } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { Image as ImageIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { useI18n } from '@/i18n'
import type { CreateOutletContext } from './CreateLayout'

const PlaygroundApp = lazy(() =>
  import('@/image-playground/BoxaiPlaygroundRoot').then((m) => ({ default: m.BoxaiPlaygroundRoot })),
)

/**
 * Image panel inside Creator workspace (site Layout + panel tabs).
 * Full gpt_image_playground embed under `@/image-playground`.
 */
export function ImageGen() {
  const { d } = useI18n()
  const { keyReady } = useOutletContext<CreateOutletContext>()
  const location = useLocation()
  const navigate = useNavigate()

  if (!keyReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
        <Spinner />
        <p className="text-sm text-[var(--bx-text-dim)]">{d.create.keyPreparing}</p>
      </div>
    )
  }

  return (
    <div className="bx-create-body-fill">
      <Suspense
        fallback={
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
            <span className="bx-icon-box">
              <ImageIcon size={18} />
            </span>
            <Spinner />
            <p className="text-sm text-[var(--bx-text-dim)]">{d.common.loading}</p>
          </div>
        }
      >
        <PlaygroundApp
          locationState={location.state}
          clearState={() => navigate(location.pathname, { replace: true })}
        />
      </Suspense>
    </div>
  )
}
