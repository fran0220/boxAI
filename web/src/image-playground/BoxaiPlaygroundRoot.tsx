import { useEffect, useRef } from 'react'
import 'streamdown/styles.css'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App'
import { startAssetMirrorSubscription, injectReferenceDataUrl } from './lib/boxaiBridge'
import { installMobileViewportGuards } from './lib/viewport'

export interface BoxaiPlaygroundRootProps {
  locationState?: unknown
  clearState?: () => void
}

/**
 * BoxAI shell around the vendored gpt_image_playground App.
 * - Forces dark theme class for Tailwind dark: variants
 * - Mirrors completed tasks into Creator assets-db
 * - Accepts cross-route reference handoff from /create/assets
 */
export function BoxaiPlaygroundRoot({ locationState, clearState }: BoxaiPlaygroundRootProps) {
  const handoffDone = useRef(false)

  useEffect(() => {
    document.documentElement.classList.add('dark')
    installMobileViewportGuards()
    const stopMirror = startAssetMirrorSubscription()
    return () => {
      stopMirror()
    }
  }, [])

  useEffect(() => {
    if (handoffDone.current) return
    const state = locationState as { reference?: string } | null
    if (!state?.reference) return
    handoffDone.current = true
    void injectReferenceDataUrl(state.reference).finally(() => {
      clearState?.()
    })
  }, [locationState, clearState])

  return (
    <div className="image-playground dark h-full min-h-0 overflow-y-auto bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <App />
    </div>
  )
}
