import { useEffect, useRef } from 'react'
import 'streamdown/styles.css'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App'
import { startAssetMirrorSubscription, injectReferenceDataUrl } from './lib/boxaiBridge'
import { installMobileViewportGuards } from './lib/viewport'
import { PlaygroundShellProvider, type PlaygroundVariant } from './shellContext'
import { cx } from '@/lib/cx'

export interface BoxaiPlaygroundRootProps {
  locationState?: unknown
  clearState?: () => void
  /** `create-shell` restyles IA to match Creator design under /create/image */
  variant?: PlaygroundVariant
}

/**
 * BoxAI shell around the vendored gpt_image_playground App.
 * - Theme follows site ThemeProvider
 * - Mirrors completed tasks into Creator assets-db
 * - Accepts cross-route reference handoff from /create/assets
 * - variant=create-shell: design toolbar / 5-col gallery / floating composer
 */
export function BoxaiPlaygroundRoot({
  locationState,
  clearState,
  variant = 'default',
}: BoxaiPlaygroundRootProps) {
  const handoffDone = useRef(false)
  const isCreateShell = variant === 'create-shell'

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
    <PlaygroundShellProvider variant={variant}>
      <div
        className={cx(
          'image-playground dark flex h-full min-h-0 flex-1 flex-col bg-[var(--bx-bg)] text-[var(--bx-text)]',
          isCreateShell
            ? 'bx-create-image-shell relative overflow-hidden'
            : 'overflow-y-auto',
        )}
      >
        <App />
      </div>
    </PlaygroundShellProvider>
  )
}
