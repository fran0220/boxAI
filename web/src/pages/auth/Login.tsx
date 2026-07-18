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
import { Spinner } from '@/components/ui/Spinner'
import { AuthSplitLayout } from './AuthSplitLayout'

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
  const returnTo = safeReturnPath(state?.from || params.get('return_to'), '/app')

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
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bx-bg)]">
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

  const signupHref =
    returnTo && returnTo !== '/app'
      ? `/signup?return_to=${encodeURIComponent(returnTo)}`
      : '/signup'

  return (
    <AuthSplitLayout
      activeTab="login"
      title={tempToken ? t.verify2faTitle : t.welcomeBack}
      subtitle={tempToken ? t.verify2faSubtitle : t.loginSubtitle}
      returnTo={returnTo}
    >
      <form onSubmit={onSubmit} className="bx-auth-fields">
        {tempToken ? (
          <label className="bx-auth-label">
            <span className="bx-auth-label-text">{t.totp}</span>
            <input
              className="bx-auth-input tracking-widest"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="000000"
            />
          </label>
        ) : (
          <>
            <label className="bx-auth-label">
              <span className="bx-auth-label-text">{t.email}</span>
              <input
                type="email"
                className="bx-auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="bx-auth-label">
              <span className="bx-auth-label-row">
                <span>{t.password}</span>
                <Link to="/forgot-password" className="bx-auth-forgot">
                  {t.forgot}
                </Link>
              </span>
              <input
                type="password"
                className="bx-auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
          </>
        )}
        {error ? <p className="bx-auth-error">{error}</p> : null}
        <button type="submit" className="bx-auth-cta" disabled={busy}>
          {busy ? d.common.loading : tempToken ? t.verify2fa : t.login}
        </button>
      </form>

      {!tempToken && oauthReady && anyOAuthLoginEnabled(oauth) ? (
        <div className="bx-auth-oauth">
          <div className="bx-auth-oauth-sep">{t.oauthOrContinue}</div>
          <div className="bx-auth-oauth-grid">
            {oauthButtons.map((btn) => (
              <button
                key={btn.provider}
                type="button"
                className="bx-auth-oauth-btn"
                onClick={() => startOAuth(btn.provider)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!tempToken ? (
        <p className="bx-auth-switch">
          {t.switchNoAccount}{' '}
          <Link to={signupHref}>{t.switchFreeSignup}</Link>
        </p>
      ) : null}
    </AuthSplitLayout>
  )
}
