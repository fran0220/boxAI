import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  anyOAuthLoginEnabled,
  buildOAuthLoginStartURL,
  getPublicSettings,
  loginWith2FA,
  loginWithPassword,
  parseOAuthLoginFlags,
  type BindableOAuthProvider,
  type OAuthLoginFlags,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { safeReturnPath } from '@/lib/safe-return'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { useAuth } from '@/lib/use-auth'
import { BRAND_LOGO_SVG } from '@/lib/brand'
import { Spinner } from '@/components/ui/Spinner'

const EMPTY_OAUTH: OAuthLoginFlags = {
  linuxdo: false,
  dingtalk: false,
  wechat: false,
  oidc: false,
  oidcName: 'OIDC',
  github: false,
  google: false,
}

export function Login() {
  const { d } = useI18n()
  const t = d.authForms
  usePageMeta(d.auth.loginTitle)
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { status } = useAuth()

  const state = location.state as { from?: string } | null
  const returnTo = safeReturnPath(state?.from || params.get('return_to'), '/account')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [oauth, setOauth] = useState<OAuthLoginFlags>(EMPTY_OAUTH)
  const [oauthReady, setOauthReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await getPublicSettings()
        if (!cancelled) setOauth(parseOAuthLoginFlags(settings))
      } catch {
        if (!cancelled) setOauth(EMPTY_OAUTH)
      } finally {
        if (!cancelled) setOauthReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(returnTo, { replace: true })
    }
  }, [status, returnTo, navigate])

  const oauthButtons = useMemo(() => {
    const rows: { provider: BindableOAuthProvider; label: string }[] = []
    if (oauth.linuxdo) rows.push({ provider: 'linuxdo', label: t.oauthLinuxDo })
    if (oauth.github) rows.push({ provider: 'github', label: t.oauthGitHub })
    if (oauth.google) rows.push({ provider: 'google', label: t.oauthGoogle })
    if (oauth.wechat) rows.push({ provider: 'wechat', label: t.oauthWeChat })
    if (oauth.dingtalk) rows.push({ provider: 'dingtalk', label: t.oauthDingTalk })
    if (oauth.oidc) rows.push({ provider: 'oidc', label: oauth.oidcName || t.oauthOidc })
    return rows
  }, [oauth, t])

  if (status === 'bootstrapping' || status === 'authenticated') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (tempToken) {
        await loginWith2FA(tempToken, totp)
        navigate(returnTo, { replace: true })
        return
      }
      const res = await loginWithPassword(email.trim(), password)
      if (res.requires_2fa && res.temp_token) {
        setTempToken(res.temp_token)
        return
      }
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loginFailed)
    } finally {
      setBusy(false)
    }
  }

  function startOAuth(provider: BindableOAuthProvider) {
    window.location.href = buildOAuthLoginStartURL(provider, returnTo)
  }

  return (
    <div className="bx-account-auth-shell px-4 sm:px-6">
      <div className="mb-8 text-center">
        <img src={BRAND_LOGO_SVG} alt="" className="mx-auto h-10 w-10" />
        <h1 className="bx-account-page-title mt-4 text-center">{d.auth.loginTitle}</h1>
        <p className="bx-account-page-sub text-center">{t.loginSubtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="bx-account-auth-card space-y-4">
        {tempToken ? (
          <label className="block text-sm">
            <span className="text-[var(--bx-text-muted)]">{t.totp}</span>
            <input
              className="bx-input mt-1 w-full tracking-widest"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </label>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.email}</span>
              <input
                type="email"
                className="bx-input mt-1 w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.password}</span>
              <input
                type="password"
                className="bx-input mt-1 w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          </>
        )}
        {error ? <p className="bx-text-danger text-sm">{error}</p> : null}
        <button type="submit" className="bx-btn bx-btn-primary w-full" disabled={busy}>
          {busy ? d.common.loading : tempToken ? t.verify2fa : t.login}
        </button>
      </form>

      {!tempToken && oauthReady && anyOAuthLoginEnabled(oauth) ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs text-[var(--bx-text-dim)]">
            <div className="h-px flex-1 bg-[var(--bx-border)]" />
            <span>{t.oauthOrContinue}</span>
            <div className="h-px flex-1 bg-[var(--bx-border)]" />
          </div>
          <div className="space-y-2">
            {oauthButtons.map((btn) => (
              <button
                key={btn.provider}
                type="button"
                className="bx-btn bx-btn-ghost w-full"
                onClick={() => startOAuth(btn.provider)}
              >
                {t.oauthContinueWith.replace('{provider}', btn.label)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-[var(--bx-text-muted)]">
        <Link to={`/signup?return_to=${encodeURIComponent(returnTo)}`} className="hover:text-[var(--bx-text)]">
          {t.toSignup}
        </Link>
        <Link to="/forgot-password" className="hover:text-[var(--bx-text)]">
          {t.forgot}
        </Link>
      </div>
    </div>
  )
}
