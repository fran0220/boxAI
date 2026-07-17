import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  bindEmailIdentity,
  buildOAuthBindingStartURL,
  changePassword,
  getMyPlatformQuotas,
  getProfile,
  getPublicSettings,
  removeNotifyEmail,
  sendEmailBindingCode,
  sendNotifyEmailCode,
  toggleNotifyEmail,
  unbindAuthIdentity,
  updateProfile,
  verifyNotifyEmail,
  type AuthProvider,
  type BindableOAuthProvider,
  type NotifyEmailEntry,
  type PlatformQuotaItem,
  type UserAuthBindingStatus,
  type UserProfile,
} from '@/lib/customer-api'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

type PublicProfileSettings = {
  contact_info: string
  balance_low_notify_enabled: boolean
  balance_low_notify_threshold: number
  linuxdo_oauth_enabled: boolean
  dingtalk_oauth_enabled: boolean
  wechat_oauth_enabled: boolean
  wechat_oauth_open_enabled?: boolean
  wechat_oauth_mp_enabled?: boolean
  oidc_oauth_enabled: boolean
  oidc_oauth_provider_name: string
}

const DEFAULT_SETTINGS: PublicProfileSettings = {
  contact_info: '',
  balance_low_notify_enabled: false,
  balance_low_notify_threshold: 0,
  linuxdo_oauth_enabled: false,
  dingtalk_oauth_enabled: false,
  wechat_oauth_enabled: false,
  oidc_oauth_enabled: false,
  oidc_oauth_provider_name: 'OIDC',
}

const MAX_EXTRA_EMAILS = 3

function asBool(v: unknown): boolean {
  return v === true
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function parsePublicSettings(raw: Record<string, unknown> | null | undefined): PublicProfileSettings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  const open = raw.wechat_oauth_open_enabled
  const mp = raw.wechat_oauth_mp_enabled
  const wechatLegacy = asBool(raw.wechat_oauth_enabled)
  const wechatEnabled =
    wechatLegacy ||
    open === true ||
    mp === true ||
    (typeof open !== 'boolean' && typeof mp !== 'boolean' && wechatLegacy)

  return {
    contact_info: asString(raw.contact_info),
    balance_low_notify_enabled: asBool(raw.balance_low_notify_enabled),
    balance_low_notify_threshold: asNumber(raw.balance_low_notify_threshold, 0),
    linuxdo_oauth_enabled: asBool(raw.linuxdo_oauth_enabled),
    dingtalk_oauth_enabled: asBool(raw.dingtalk_oauth_enabled),
    wechat_oauth_enabled: wechatEnabled,
    wechat_oauth_open_enabled: typeof open === 'boolean' ? open : undefined,
    wechat_oauth_mp_enabled: typeof mp === 'boolean' ? mp : undefined,
    oidc_oauth_enabled: asBool(raw.oidc_oauth_enabled),
    oidc_oauth_provider_name: asString(raw.oidc_oauth_provider_name, 'OIDC') || 'OIDC',
  }
}

function normalizeBindingStatus(binding: boolean | UserAuthBindingStatus | undefined): boolean | null {
  if (typeof binding === 'boolean') return binding
  if (!binding) return null
  if (typeof binding.bound === 'boolean') return binding.bound
  return Boolean(
    (binding as UserAuthBindingStatus & { provider_subject?: string; issuer?: string; provider_key?: string })
      .provider_subject ||
      (binding as { issuer?: string }).issuer ||
      (binding as { provider_key?: string }).provider_key,
  )
}

function getBindingDetails(
  profile: UserProfile | null,
  provider: AuthProvider,
): UserAuthBindingStatus | null {
  const binding = profile?.auth_bindings?.[provider] ?? profile?.identity_bindings?.[provider]
  if (!binding || typeof binding === 'boolean') return null
  return binding
}

function isProviderBound(profile: UserProfile | null, provider: AuthProvider): boolean {
  if (!profile) return false
  if (provider === 'email') {
    if (typeof profile.email_bound === 'boolean') return profile.email_bound
    return normalizeBindingStatus(profile.auth_bindings?.email ?? profile.identity_bindings?.email) ?? false
  }
  const directKey = `${provider}_bound` as keyof UserProfile
  const direct = profile[directKey]
  if (typeof direct === 'boolean') return direct
  return (
    normalizeBindingStatus(profile.auth_bindings?.[provider] ?? profile.identity_bindings?.[provider]) ??
    false
  )
}

function displayableEmail(profile: UserProfile | null): string {
  const email = profile?.email?.trim() || ''
  if (!email) return ''
  if (email.endsWith('.invalid') && !isProviderBound(profile, 'email')) return ''
  return email
}

function providerLabel(
  provider: BindableOAuthProvider | 'email',
  oidcName: string,
  emailLabel: string,
): string {
  switch (provider) {
    case 'email':
      return emailLabel
    case 'linuxdo':
      return 'LinuxDo'
    case 'dingtalk':
      return 'DingTalk'
    case 'wechat':
      return 'WeChat'
    case 'oidc':
      return oidcName || 'OIDC'
    case 'github':
      return 'GitHub'
    case 'google':
      return 'Google'
    default:
      return provider
  }
}

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

export function AccountProfile() {
  const { d } = useI18n()
  const t = d.accountProfile
  usePageMeta(t.metaTitle)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<PublicProfileSettings>(DEFAULT_SETTINGS)
  const [quotas, setQuotas] = useState<PlatformQuotaItem[] | null>(null)

  const [username, setUsername] = useState('')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const [bindEmail, setBindEmail] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [bindPassword, setBindPassword] = useState('')
  const [sendingBindCode, setSendingBindCode] = useState(false)
  const [bindingEmail, setBindingEmail] = useState(false)
  const [unbinding, setUnbinding] = useState<BindableOAuthProvider | null>(null)

  const [notifyEnabled, setNotifyEnabled] = useState(true)
  const [threshold, setThreshold] = useState<number | ''>('')
  const [extraEmails, setExtraEmails] = useState<NotifyEmailEntry[]>([])
  const [newNotifyEmail, setNewNotifyEmail] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingCode, setPendingCode] = useState('')
  const [pendingCodeSent, setPendingCodeSent] = useState(false)
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState('')
  const [verifyCodeSaved, setVerifyCodeSaved] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const applyProfile = useCallback((p: UserProfile) => {
    setProfile(p)
    setUsername(p.username || '')
    setNotifyEnabled(p.balance_notify_enabled ?? true)
    setThreshold(
      typeof p.balance_notify_threshold === 'number' ? p.balance_notify_threshold : '',
    )
    setExtraEmails(p.balance_notify_extra_emails ?? [])
    const email = displayableEmail(p)
    if (email) setBindEmail(email)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, s, q] = await Promise.all([
          getProfile(),
          getPublicSettings().catch(() => null),
          getMyPlatformQuotas().catch(() => null),
        ])
        if (cancelled) return
        applyProfile(p)
        setSettings(parsePublicSettings(s ?? undefined))
        if (q) {
          const items = Array.isArray(q.items)
            ? q.items
            : Array.isArray((q as { platform_quotas?: PlatformQuotaItem[] }).platform_quotas)
              ? (q as { platform_quotas: PlatformQuotaItem[] }).platform_quotas
              : Array.isArray(q)
                ? (q as PlatformQuotaItem[])
                : []
          setQuotas(items.length > 0 ? items : null)
        }
        if ((p.balance_notify_extra_emails?.length ?? 0) === 0 && p.email) {
          const em = displayableEmail(p)
          if (em) setNewNotifyEmail(em)
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, t.loadFailed))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyProfile, t.loadFailed])

  const emailBound = isProviderBound(profile, 'email')
  const primaryEmail = displayableEmail(profile)

  const bindingProviders = useMemo(() => {
    type Row = {
      provider: BindableOAuthProvider
      label: string
      bound: boolean
      canBind: boolean
      canUnbind: boolean
      details: UserAuthBindingStatus | null
    }
    const oidcName = settings.oidc_oauth_provider_name
    const enabled: Record<BindableOAuthProvider, boolean> = {
      linuxdo: settings.linuxdo_oauth_enabled,
      dingtalk: settings.dingtalk_oauth_enabled,
      wechat: settings.wechat_oauth_enabled,
      oidc: settings.oidc_oauth_enabled,
      github: false,
      google: false,
    }

    const candidates: BindableOAuthProvider[] = ['linuxdo', 'dingtalk', 'wechat', 'oidc', 'github', 'google']
    const rows: Row[] = []

    for (const provider of candidates) {
      const bound = isProviderBound(profile, provider)
      const details = getBindingDetails(profile, provider)
      const isEnabled = enabled[provider]
      // Show if OAuth is enabled, or already bound (e.g. github/google legacy)
      if (!isEnabled && !bound) continue
      const canBind = !bound && isEnabled && (details?.can_bind ?? true)
      const canUnbind = bound && (details ? details.can_unbind !== false : true)
      rows.push({
        provider,
        label: providerLabel(provider, oidcName, t.email),
        bound,
        canBind,
        canUnbind,
        details,
      })
    }
    return rows
  }, [profile, settings, t.email])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const p = await updateProfile({ username: username.trim() })
      applyProfile(p)
      setMessage(t.saved)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setSaving(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (newPw !== confirmPw) {
        setError(t.passwordFailed)
        setSaving(false)
        return
      }
      if (newPw.length < 8) {
        setError(t.passwordFailed)
        setSaving(false)
        return
      }
      await changePassword(oldPw, newPw)
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
      setMessage(t.passwordChanged)
    } catch (err) {
      setError(errMsg(err, t.passwordFailed))
    } finally {
      setSaving(false)
    }
  }

  function startOAuthBind(provider: BindableOAuthProvider) {
    window.location.href = buildOAuthBindingStartURL(provider, '/account/profile')
  }

  async function onUnbind(provider: BindableOAuthProvider, label: string) {
    const ok = window.confirm(t.confirmUnbind.replace('{provider}', label))
    if (!ok) return
    setUnbinding(provider)
    setError('')
    setMessage('')
    try {
      const p = await unbindAuthIdentity(provider)
      applyProfile(p)
      setMessage(t.saved)
    } catch (err) {
      setError(errMsg(err, t.unbindFailed))
    } finally {
      setUnbinding(null)
    }
  }

  async function onSendBindCode() {
    if (!bindEmail.trim()) return
    setSendingBindCode(true)
    setError('')
    setMessage('')
    try {
      await sendEmailBindingCode(bindEmail.trim())
      setMessage(t.codeSent)
    } catch (err) {
      setError(errMsg(err, t.bindEmailFailed))
    } finally {
      setSendingBindCode(false)
    }
  }

  async function onBindEmail(e: React.FormEvent) {
    e.preventDefault()
    setBindingEmail(true)
    setError('')
    setMessage('')
    try {
      const p = await bindEmailIdentity({
        email: bindEmail.trim(),
        verify_code: bindCode.trim(),
        password: bindPassword,
      })
      applyProfile(p)
      setBindCode('')
      setBindPassword('')
      setMessage(t.saved)
    } catch (err) {
      setError(errMsg(err, t.bindEmailFailed))
    } finally {
      setBindingEmail(false)
    }
  }

  async function onToggleNotify() {
    const next = !notifyEnabled
    setNotifyEnabled(next)
    setNotifyBusy(true)
    setError('')
    try {
      const p = await updateProfile({ balance_notify_enabled: next })
      applyProfile(p)
    } catch (err) {
      setNotifyEnabled(!next)
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function onSaveThreshold() {
    setNotifyBusy(true)
    setError('')
    setMessage('')
    try {
      const value = typeof threshold === 'number' && threshold > 0 ? threshold : 0
      const p = await updateProfile({ balance_notify_threshold: value })
      applyProfile(p)
      setMessage(t.notifySaved)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function onToggleExtraEmail(entry: NotifyEmailEntry) {
    setNotifyBusy(true)
    setError('')
    try {
      const p = await toggleNotifyEmail(entry.email, !entry.disabled)
      applyProfile(p)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function onRemoveExtraEmail(email: string) {
    setNotifyBusy(true)
    setError('')
    setMessage('')
    try {
      await removeNotifyEmail(email)
      const p = await getProfile()
      applyProfile(p)
      setMessage(t.notifySaved)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  function startPendingEmail() {
    const email = newNotifyEmail.trim()
    if (!email) return
    const dup =
      extraEmails.some((e) => e.email.toLowerCase() === email.toLowerCase()) ||
      pendingEmail.toLowerCase() === email.toLowerCase()
    if (dup) return
    if (extraEmails.length + (pendingEmail ? 1 : 0) >= MAX_EXTRA_EMAILS) return
    setPendingEmail(email)
    setPendingCode('')
    setPendingCodeSent(false)
    setNewNotifyEmail('')
  }

  async function sendPendingCode() {
    if (!pendingEmail) return
    setNotifyBusy(true)
    setError('')
    try {
      await sendNotifyEmailCode(pendingEmail)
      setPendingCodeSent(true)
      setMessage(t.codeSent)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function verifyPending() {
    if (!pendingEmail || pendingCode.trim().length !== 6) return
    setNotifyBusy(true)
    setError('')
    try {
      await verifyNotifyEmail(pendingEmail, pendingCode.trim())
      setPendingEmail('')
      setPendingCode('')
      setPendingCodeSent(false)
      const p = await getProfile()
      applyProfile(p)
      setMessage(t.notifySaved)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function sendCodeForSaved(email: string) {
    setNotifyBusy(true)
    setError('')
    try {
      await sendNotifyEmailCode(email)
      setVerifyingEmail(email)
      setVerifyCodeSaved('')
      setMessage(t.codeSent)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  async function verifySaved(email: string) {
    if (verifyCodeSaved.trim().length !== 6) return
    setNotifyBusy(true)
    setError('')
    try {
      await verifyNotifyEmail(email, verifyCodeSaved.trim())
      setVerifyingEmail('')
      setVerifyCodeSaved('')
      const p = await getProfile()
      applyProfile(p)
      setMessage(t.notifySaved)
    } catch (err) {
      setError(errMsg(err, t.saveFailed))
    } finally {
      setNotifyBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const canAddNotifyEmail =
    extraEmails.length + (pendingEmail ? 1 : 0) < MAX_EXTRA_EMAILS

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="bx-display text-2xl font-bold tracking-tight">{t.title}</h2>
        <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{t.subtitle}</p>
      </div>

      {error ? <p className="bx-text-danger text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--bx-brand-bright)]">{message}</p> : null}

      {/* Basic profile */}
      <form onSubmit={saveProfile} className="bx-card space-y-3 p-5">
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.email}</span>
          <input
            className="bx-input mt-1 w-full opacity-70"
            value={primaryEmail || profile?.email || ''}
            disabled
            readOnly
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.username}</span>
          <input
            className="bx-input mt-1 w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--bx-text-dim)] sm:grid-cols-3">
          <p>
            {t.balance}: ${profile?.balance?.toFixed(2) ?? '—'}
          </p>
          <p>
            {t.frozenBalance}: ${profile?.frozen_balance?.toFixed(2) ?? '0.00'}
          </p>
          <p>
            {t.concurrency}: {profile?.concurrency ?? '—'}
          </p>
        </div>
        <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={saving}>
          {d.common.save}
        </button>
      </form>

      {/* Contact support */}
      {settings.contact_info ? (
        <div className="bx-card border border-[var(--bx-brand)]/30 bg-[var(--bx-brand)]/5 p-5">
          <h3 className="font-semibold text-[var(--bx-brand-bright)]">{t.contactSupport}</h3>
          <p className="mt-1 text-sm font-medium whitespace-pre-wrap">{settings.contact_info}</p>
        </div>
      ) : null}

      {/* Change password */}
      <form onSubmit={savePassword} className="bx-card space-y-3 p-5">
        <h3 className="font-semibold">{t.changePassword}</h3>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.oldPassword}</span>
          <input
            type="password"
            className="bx-input mt-1 w-full"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.newPassword}</span>
          <input
            type="password"
            className="bx-input mt-1 w-full"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--bx-text-muted)]">{t.newPassword}</span>
          <input
            type="password"
            className="bx-input mt-1 w-full"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={saving}>
          {t.updatePassword}
        </button>
      </form>

      {/* Account bindings */}
      <section className="bx-card space-y-4 p-5">
        <div>
          <h3 className="font-semibold">{t.bindings}</h3>
          <p className="mt-1 text-sm text-[var(--bx-text-dim)]">{t.bindingsHint}</p>
        </div>

        <ul className="space-y-3">
          {bindingProviders.map((item) => (
            <li
              key={item.provider}
              className="flex flex-col gap-3 rounded-xl border border-[var(--bx-border)] bg-[var(--bx-bg-muted)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  <span
                    className={
                      item.bound
                        ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400'
                        : 'rounded-full bg-[var(--bx-bg-elevated)] px-2 py-0.5 text-xs text-[var(--bx-text-dim)]'
                    }
                  >
                    {item.bound ? t.bound : t.unbound}
                  </span>
                </div>
                {item.details?.display_name ? (
                  <p className="mt-1 text-sm text-[var(--bx-text-muted)]">{item.details.display_name}</p>
                ) : null}
                {item.details?.note ? (
                  <p className="mt-0.5 text-xs text-[var(--bx-text-dim)]">{item.details.note}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {item.canBind ? (
                  <button
                    type="button"
                    className="bx-btn bx-btn-primary bx-btn-sm"
                    onClick={() => startOAuthBind(item.provider)}
                  >
                    {t.bind}
                  </button>
                ) : null}
                {item.canUnbind ? (
                  <button
                    type="button"
                    className="bx-btn bx-btn-secondary bx-btn-sm"
                    disabled={unbinding === item.provider}
                    onClick={() => void onUnbind(item.provider, item.label)}
                  >
                    {t.unbind}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {/* Email bind when not bound */}
        {!emailBound ? (
          <form onSubmit={onBindEmail} className="space-y-3 rounded-xl border border-[var(--bx-border)] p-4">
            <h4 className="text-sm font-semibold">{t.bindEmail}</h4>
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.email}</span>
              <input
                type="email"
                className="bx-input mt-1 w-full"
                value={bindEmail}
                onChange={(e) => setBindEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm">
                <span className="text-[var(--bx-text-muted)]">{t.emailCode}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="bx-input mt-1 w-full"
                  value={bindCode}
                  onChange={(e) => setBindCode(e.target.value)}
                  required
                />
              </label>
              <button
                type="button"
                className="bx-btn bx-btn-secondary bx-btn-sm"
                disabled={sendingBindCode || !bindEmail.trim()}
                onClick={() => void onSendBindCode()}
              >
                {sendingBindCode ? d.common.loading : t.sendCode}
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-[var(--bx-text-muted)]">{t.oldPassword}</span>
              <input
                type="password"
                className="bx-input mt-1 w-full"
                value={bindPassword}
                onChange={(e) => setBindPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="bx-btn bx-btn-primary bx-btn-sm" disabled={bindingEmail}>
              {bindingEmail ? d.common.loading : t.bindEmailSubmit}
            </button>
          </form>
        ) : null}
      </section>

      {/* Balance notify */}
      {settings.balance_low_notify_enabled ? (
        <section className="bx-card space-y-4 p-5">
          <div>
            <h3 className="font-semibold">{t.balanceNotify}</h3>
            <p className="mt-1 text-sm text-[var(--bx-text-dim)]">{t.balanceNotifyHint}</p>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>{t.balanceNotifyEnabled}</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--bx-brand)]"
              checked={notifyEnabled}
              disabled={notifyBusy}
              onChange={() => void onToggleNotify()}
            />
          </label>

          {notifyEnabled ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block flex-1 text-sm">
                  <span className="text-[var(--bx-text-muted)]">{t.threshold}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="bx-input mt-1 w-full"
                    value={threshold}
                    placeholder={
                      settings.balance_low_notify_threshold > 0
                        ? String(settings.balance_low_notify_threshold)
                        : undefined
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      setThreshold(v === '' ? '' : Number(v))
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="bx-btn bx-btn-primary bx-btn-sm"
                  disabled={notifyBusy}
                  onClick={() => void onSaveThreshold()}
                >
                  {d.common.save}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-[var(--bx-text-muted)]">{t.extraEmails}</p>
                {extraEmails.map((entry) => (
                  <div
                    key={entry.email}
                    className="flex flex-col gap-2 rounded-lg bg-[var(--bx-bg-muted)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[var(--bx-brand)]"
                        checked={!entry.disabled}
                        disabled={notifyBusy}
                        onChange={() => void onToggleExtraEmail(entry)}
                        title={t.balanceNotifyEnabled}
                      />
                      <span className="truncate">{entry.email}</span>
                      {entry.disabled ? (
                        <span className="text-xs text-[var(--bx-text-dim)]">{t.disabled}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {!entry.verified ? (
                        verifyingEmail === entry.email ? (
                          <>
                            <input
                              type="text"
                              maxLength={6}
                              className="bx-input w-20 py-1 text-xs"
                              value={verifyCodeSaved}
                              onChange={(e) => setVerifyCodeSaved(e.target.value)}
                              placeholder={t.emailCode}
                            />
                            <button
                              type="button"
                              className="text-[var(--bx-brand-bright)]"
                              disabled={notifyBusy || verifyCodeSaved.trim().length !== 6}
                              onClick={() => void verifySaved(entry.email)}
                            >
                              {t.verify}
                            </button>
                            <button
                              type="button"
                              className="text-[var(--bx-text-dim)]"
                              onClick={() => {
                                setVerifyingEmail('')
                                setVerifyCodeSaved('')
                              }}
                            >
                              {d.common.cancel}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="text-[var(--bx-brand-bright)]"
                            disabled={notifyBusy}
                            onClick={() => void sendCodeForSaved(entry.email)}
                          >
                            {t.verify}
                          </button>
                        )
                      ) : null}
                      <button
                        type="button"
                        className="bx-text-danger"
                        disabled={notifyBusy}
                        onClick={() => void onRemoveExtraEmail(entry.email)}
                      >
                        {t.remove}
                      </button>
                    </div>
                  </div>
                ))}

                {pendingEmail ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">{pendingEmail}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {!pendingCodeSent ? (
                        <button
                          type="button"
                          className="text-[var(--bx-brand-bright)]"
                          disabled={notifyBusy}
                          onClick={() => void sendPendingCode()}
                        >
                          {t.sendCode}
                        </button>
                      ) : (
                        <>
                          <input
                            type="text"
                            maxLength={6}
                            className="bx-input w-20 py-1 text-xs"
                            value={pendingCode}
                            onChange={(e) => setPendingCode(e.target.value)}
                            placeholder={t.emailCode}
                          />
                          <button
                            type="button"
                            className="text-[var(--bx-brand-bright)]"
                            disabled={notifyBusy || pendingCode.trim().length !== 6}
                            onClick={() => void verifyPending()}
                          >
                            {t.verify}
                          </button>
                          <button
                            type="button"
                            className="text-[var(--bx-text-dim)]"
                            disabled={notifyBusy}
                            onClick={() => void sendPendingCode()}
                          >
                            {t.sendCode}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="bx-text-danger"
                        onClick={() => {
                          setPendingEmail('')
                          setPendingCode('')
                          setPendingCodeSent(false)
                        }}
                      >
                        {t.remove}
                      </button>
                    </div>
                  </div>
                ) : null}

                {canAddNotifyEmail ? (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      className="bx-input flex-1"
                      value={newNotifyEmail}
                      onChange={(e) => setNewNotifyEmail(e.target.value)}
                      placeholder={t.addEmail}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          startPendingEmail()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="bx-btn bx-btn-secondary bx-btn-sm"
                      disabled={!newNotifyEmail.trim()}
                      onClick={startPendingEmail}
                    >
                      {t.addEmail}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {/* Platform quotas */}
      {quotas && quotas.length > 0 ? (
        <section className="bx-card space-y-3 p-5">
          <h3 className="font-semibold">{t.platformQuotas}</h3>
          <ul className="space-y-2 text-sm">
            {quotas.map((q, i) => {
              const name = q.name || q.platform || `quota-${i}`
              const limit = typeof q.limit === 'number' ? q.limit : null
              const used = typeof q.used === 'number' ? q.used : null
              const remaining = typeof q.remaining === 'number' ? q.remaining : null
              return (
                <li
                  key={`${name}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bx-bg-muted)] px-3 py-2"
                >
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-[var(--bx-text-dim)]">
                    {used != null && limit != null
                      ? `${used} / ${limit}`
                      : remaining != null
                        ? `${remaining}`
                        : limit != null
                          ? String(limit)
                          : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
