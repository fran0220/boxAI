import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { consoleOrigin } from '@/lib/brand'
import { safeReturnPath } from '@/lib/safe-return'
import { useI18n } from '@/i18n'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Legacy outbound handoff: /sso?target=console&return_to=<console path>.
 * The console is the identity host, so this simply forwards to the console's
 * own SSO start page (which handles both warm and cold console sessions).
 */
export function SsoStart() {
  const [params] = useSearchParams()
  const { d } = useI18n()

  useEffect(() => {
    const returnTo = safeReturnPath(params.get('return_to'), '/')
    const url = new URL(`${consoleOrigin()}/boxai/sso/start`)
    if (returnTo && returnTo !== '/') url.searchParams.set('return_to', returnTo)
    window.location.replace(url.toString())
  }, [params])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <Spinner />
      <p className="mt-4 text-sm text-[var(--bx-text-muted)]">{d.auth.ssoWorking}</p>
    </div>
  )
}
