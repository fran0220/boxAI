import { useEffect, useState } from 'react'
import {
  changePassword,
  getTotpStatus,
  revokeAllSessions,
  totpDisable,
  totpEnable,
  totpSendCode,
  totpSetup,
  totpVerificationMethod,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

export function AccountSecurity() {
  const { d } = useI18n()
  const t = d.accountSecurity
  usePageMeta(t.metaTitle)

  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null)
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loginAlert, setLoginAlert] = useState(() => {
    try {
      return localStorage.getItem('boxai_login_alert_email') !== '0'
    } catch {
      return true
    }
  })

  // Password
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // Setup flow
  const [method, setMethod] = useState<'email' | 'password' | ''>('')
  const [password, setPassword] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [secret, setSecret] = useState('')
  const [qr, setQr] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [phase, setPhase] = useState<'idle' | 'verify' | 'scan'>('idle')

  async function refreshStatus() {
    const s = await getTotpStatus()
    setTotpEnabled(!!s.enabled)
    setFeatureEnabled(s.available !== false && s.feature_enabled !== false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshStatus()
      } catch {
        if (!cancelled) setTotpEnabled(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (newPw !== confirmPw) {
        setError(t.passwordMismatch)
        setBusy(false)
        return
      }
      if (newPw.length < 8) {
        setError(t.passwordTooShort)
        setBusy(false)
        return
      }
      await changePassword(oldPw, newPw)
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
      setMessage(t.passwordChanged)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.passwordFailed)
    } finally {
      setBusy(false)
    }
  }

  async function startEnable() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const m = await totpVerificationMethod()
      setMethod((m.method as 'email' | 'password') || 'password')
      setPhase('verify')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.setupFailed)
    } finally {
      setBusy(false)
    }
  }

  async function submitVerify() {
    setBusy(true)
    setError('')
    try {
      if (method === 'email' && !emailCode) {
        await totpSendCode()
        setMessage(t.codeSent)
        setBusy(false)
        return
      }
      const setup = await totpSetup(
        method === 'email' ? { email_code: emailCode } : { password },
      )
      setSetupToken(setup.setup_token)
      setSecret(setup.secret)
      setQr(setup.qr_code_url)
      setPhase('scan')
      setMessage('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.setupFailed)
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable() {
    setBusy(true)
    setError('')
    try {
      await totpEnable({ totp_code: totpCode, setup_token: setupToken })
      setMessage(t.enabled)
      setPhase('idle')
      setPassword('')
      setEmailCode('')
      setTotpCode('')
      await refreshStatus()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.enableFailed)
    } finally {
      setBusy(false)
    }
  }

  async function onDisable() {
    if (!window.confirm(t.confirmDisable)) return
    setBusy(true)
    setError('')
    try {
      const m = await totpVerificationMethod()
      if (m.method === 'email') {
        await totpSendCode()
        const code = window.prompt(t.enterEmailCode)
        if (!code) {
          setBusy(false)
          return
        }
        await totpDisable({ email_code: code })
      } else {
        const pw = window.prompt(t.enterPassword)
        if (!pw) {
          setBusy(false)
          return
        }
        await totpDisable({ password: pw })
      }
      setMessage(t.disabled)
      await refreshStatus()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.disableFailed)
    } finally {
      setBusy(false)
    }
  }

  async function onRevoke() {
    if (!window.confirm(t.confirmRevoke)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await revokeAllSessions()
      setMessage(t.revoked)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.revokeFailed)
    } finally {
      setBusy(false)
    }
  }

  function onToggleLoginAlert() {
    const next = !loginAlert
    setLoginAlert(next)
    try {
      localStorage.setItem('boxai_login_alert_email', next ? '1' : '0')
    } catch {
      /* ignore */
    }
    // No backend flag yet — preference is local until settings API exposes it.
    setMessage(next ? t.loginAlertOn : t.loginAlertOff)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <h1 className="bx-account-page-title">{t.title}</h1>
      <p className="bx-account-page-sub">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      {/* Password + 2FA grid */}
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <form onSubmit={(e) => void onPassword(e)} className="bx-account-panel px-[22px] py-5">
          <p className="m-0 text-[13.5px] font-bold">{t.changePassword}</p>
          <div className="mt-3.5 flex flex-col gap-2.5">
            <input
              type="password"
              className="bx-account-input-muted"
              placeholder={t.oldPassword}
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              required
              autoComplete="current-password"
            />
            <input
              type="password"
              className="bx-account-input-muted"
              placeholder={t.newPassword}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <input
              type="password"
              className="bx-account-input-muted"
              placeholder={t.confirmPassword}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm mt-3.5" disabled={busy}>
            {t.updatePassword}
          </button>
        </form>

        <div className="flex flex-col gap-3">
          {/* 2FA status card */}
          <div className="bx-account-panel px-[22px] py-[18px]">
            <div className="flex items-center justify-between gap-3.5">
              <div className="min-w-0">
                <p className="m-0 text-[13.5px] font-bold">{t.twoFactor}</p>
                <p className="mt-1.5 mb-0 text-xs text-[var(--bx-text-muted)]">
                  {totpEnabled ? t.twoFactorBoundHint : t.twoFactorHint}
                </p>
              </div>
              {totpEnabled ? (
                <span className="bx-account-pill-ok shrink-0">{t.twoFactorOn}</span>
              ) : totpEnabled === false ? (
                <span className="bx-account-status bx-account-status--muted shrink-0">
                  {t.twoFactorOff}
                </span>
              ) : (
                <span className="bx-account-status bx-account-status--muted shrink-0">
                  {t.twoFactorUnknown}
                </span>
              )}
            </div>

            {!featureEnabled ? (
              <p className="mt-3 mb-0 text-xs text-[var(--bx-text-dim)]">{t.featureOff}</p>
            ) : phase === 'idle' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {!totpEnabled ? (
                  <button
                    type="button"
                    className="bx-btn bx-btn-primary bx-btn-sm"
                    disabled={busy}
                    onClick={() => void startEnable()}
                  >
                    {t.enable}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bx-btn bx-btn-ghost bx-btn-sm"
                    disabled={busy}
                    onClick={() => void onDisable()}
                  >
                    {t.disable}
                  </button>
                )}
              </div>
            ) : null}

            {phase === 'verify' ? (
              <div className="mt-3 space-y-2">
                {method === 'email' ? (
                  <label className="block">
                    <span className="bx-account-field-label">{t.emailCode}</span>
                    <input
                      className="bx-account-input-muted"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="bx-account-field-label">{t.password}</span>
                    <input
                      type="password"
                      className="bx-account-input-muted"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="bx-btn bx-btn-primary bx-btn-sm"
                    disabled={busy}
                    onClick={() => void submitVerify()}
                  >
                    {method === 'email' && !emailCode ? t.sendCode : t.continue}
                  </button>
                  <button
                    type="button"
                    className="bx-btn bx-btn-ghost bx-btn-sm"
                    onClick={() => setPhase('idle')}
                  >
                    {d.common.cancel}
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 'scan' ? (
              <div className="mt-3 space-y-2">
                <p className="m-0 text-xs text-[var(--bx-text-dim)]">{t.scanHint}</p>
                {qr ? (
                  <img src={qr} alt="TOTP QR" className="mx-auto h-40 w-40 rounded bg-white p-2" />
                ) : null}
                <p className="break-all font-mono text-xs">{secret}</p>
                <label className="block">
                  <span className="bx-account-field-label">{t.totpCode}</span>
                  <input
                    className="bx-account-input-muted tracking-widest"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    maxLength={6}
                  />
                </label>
                <button
                  type="button"
                  className="bx-btn bx-btn-primary bx-btn-sm"
                  disabled={busy}
                  onClick={() => void confirmEnable()}
                >
                  {t.confirmEnable}
                </button>
              </div>
            ) : null}
          </div>

          {/* Login alert email toggle card (design chrome) */}
          <div className="bx-account-panel flex items-center justify-between gap-3.5 px-[22px] py-[18px]">
            <div className="min-w-0">
              <p className="m-0 text-[13.5px] font-bold">{t.loginAlert}</p>
              <p className="mt-1.5 mb-0 text-xs text-[var(--bx-text-muted)]">{t.loginAlertHint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={loginAlert}
              aria-label={t.loginAlert}
              className={loginAlert ? 'bx-account-switch is-on' : 'bx-account-switch'}
              onClick={onToggleLoginAlert}
            />
          </div>
        </div>
      </div>

      {/* Sessions — no multi-device list API; simple current session + revoke-all */}
      <div className="bx-account-panel mt-3 px-[22px] py-5">
        <p className="m-0 text-[13.5px] font-bold">{t.sessions}</p>
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--bx-border)] bg-[var(--bx-bg-muted)] px-4 py-3.5">
          <div className="min-w-0">
            <p className="m-0 text-sm font-bold text-[var(--bx-text)]">
              {t.currentSession}
              <span className="bx-account-pill-brand ml-2">{t.thisDevice}</span>
            </p>
            <p className="mt-1 mb-0 font-mono text-[11px] text-[var(--bx-text-dim)]">{t.now}</p>
          </div>
        </div>
        <p className="mt-3 mb-1 text-sm text-[var(--bx-text-muted)]">{t.sessionsBody}</p>
        <p className="m-0 mb-3 text-xs text-[var(--bx-text-dim)]">{t.deviceListUnavailable}</p>
        <button
          type="button"
          className="bx-btn bx-btn-ghost bx-btn-sm"
          disabled={busy}
          onClick={() => void onRevoke()}
        >
          {t.revokeAll}
        </button>
      </div>

      {/* Danger zone — no user delete API; support contact only */}
      <div className="bx-account-danger-zone mt-3">
        <div>
          <p className="m-0 text-[13.5px] font-bold text-[var(--bx-danger)]">{t.dangerTitle}</p>
          <p className="mt-1.5 mb-0 text-xs text-[var(--bx-text-muted)]">{t.dangerBody}</p>
        </div>
        <a
          href={t.dangerSupportHref}
          className="shrink-0 rounded-[var(--bx-radius)] border border-[var(--bx-danger)] bg-transparent px-[18px] py-2 text-[13px] font-bold text-[var(--bx-danger)] transition hover:bg-[var(--bx-danger)]/10"
        >
          {t.dangerContactSupport}
        </a>
      </div>
    </div>
  )
}
