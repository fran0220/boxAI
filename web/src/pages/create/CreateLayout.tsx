import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ensureCreatorKey } from '@/lib/api'
import { usePageMeta } from '@/lib/meta'
import { useI18n } from '@/i18n'

export interface CreateOutletContext {
  keyReady: boolean
  keyError: string
}

/** Creator runtime shell; product navigation is owned by WorkspaceLayout. */
export function CreateLayout() {
  const { d } = useI18n()
  const [keyReady, setKeyReady] = useState(false)
  const [keyError, setKeyError] = useState('')
  // Keep generic fallback current without re-running ensure on locale change.
  const keyFailedGenericRef = useRef(d.create.keyFailedGeneric)
  keyFailedGenericRef.current = d.create.keyFailedGeneric

  usePageMeta(d.create.metaTitle)

  useEffect(() => {
    let cancelled = false
    ensureCreatorKey()
      .then(() => {
        if (cancelled) return
        setKeyError('')
        setKeyReady(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setKeyError(error instanceof Error ? error.message : keyFailedGenericRef.current)
        setKeyReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="bx-create-workspace">
      {!keyReady ? (
        <div className="bx-create-banner">{d.create.keyPreparing}</div>
      ) : keyError ? (
        <div className="bx-create-banner bx-create-banner--warn">
          {d.create.keyFailed} {keyError}
        </div>
      ) : null}

      <div className="bx-create-shell-row">
        <div className="bx-create-body">
          <Outlet context={{ keyReady, keyError } satisfies CreateOutletContext} />
        </div>
      </div>
    </div>
  )
}
