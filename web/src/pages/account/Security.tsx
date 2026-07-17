import { useEffect, useState } from 'react'
import {
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
      <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      {error ? <p className="bx-text-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      <div className="bx-card mt-6 space-y-3 p-5">
        <h3 className="font-semibold">{t.twoFactor}</h3>
        <p className="text-sm text-[var(--bx-text-muted)]">
          {totpEnabled === null ? t.twoFactorUnknown : totpEnabled ? t.twoFactorOn : t.twoFactorOff}
        </p>
        {!featureEnabled ? (
          <p className="text-xs text-[var(--bx-text-dim)]">{t.featureOff}</p>
        ) : phase === 'idle' ? (
          <div className="flex gap-2">
            {!totpEnabled ? (
              <button type="button" className="bx-btn bx-btn-primary bx-btn-sm" disabled={busy} onClick={() => void startEnable()}>
                {t.enable}
              </button>
            ) : (
              <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" disabled={busy} onClick={() => void onDisable()}>
                {t.disable}
              </button>
            )}
          </div>
        ) : null}

        {phase === 'verify' ? (
          <div className="space-y-2 border-t border-[var(--bx-border)] pt-3">
            {method === 'email' ? (
              <label className="block text-sm">
                <span className="text-[var(--bx-text-muted)]">{t.emailCode}</span>
                <input className="bx-input mt-1 w-full" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="text-[var(--bx-text-muted)]">{t.password}</span>
                <input
                  type="password"
                  className="bx-input mt-1 w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <button type="button" className="bx-btn bx-btn-primary bx-btn-sm" disabled={busy} onClick={() => void submitVerify()}>
              {method === 'email' && !emailCode ? t.sendCode : t.continue}
            </button>
          </div>
        ) : null}

        {phase === 'scan' ? (
          <div className="space-y-2 border-t border-[var(--bx-border)] pt-3">
            <p className="text-xs text-[var(--bx-text-dim)]">{t.scanHint}</p>
            {qr ? <img src={qr} alt="TOTP QR" className="mx-auto h-40 w-40 rounded bg-white p-2" /> : null}
            <p className="break-all font-mono text-xs">{secret}</p>
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.totpCode}</span>
              <input
                className="bx-input mt-1 w-full tracking-widest"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                maxLength={6}
              />
            </label>
            <button type="button" className="bx-btn bx-btn-primary bx-btn-sm" disabled={busy} onClick={() => void confirmEnable()}>
              {t.confirmEnable}
            </button>
          </div>
        ) : null}
      </div>

      <div className="bx-card mt-4 space-y-3 p-5">
        <h3 className="font-semibold">{t.sessions}</h3>
        <p className="text-sm text-[var(--bx-text-muted)]">{t.sessionsBody}</p>
        <button type="button" className="bx-btn bx-btn-ghost bx-btn-sm" disabled={busy} onClick={() => void onRevoke()}>
          {t.revokeAll}
        </button>
      </div>
    </div>
  )
}
