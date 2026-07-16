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
    // Theme follows site ThemeProvider (html.dark); do not force dark here.
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
    <div className="image-playground dark flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--bx-bg)] text-[var(--bx-text)]">
      <App />
    </div>
  )
}
