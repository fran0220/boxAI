import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, ExternalLink, HardDrive, Laptop, Radio, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import {
  detectPlatform,
  fetchDesktopRelease,
  RELEASES_PAGE_URL,
  type DesktopRelease,
} from '@/lib/releases'
import { useWorkspace } from '@/components/workspace/WorkspaceContext'
import { getSessionSnapshot, subscribeSession } from '@/lib/session'

type AgentAuthRequestMessage = { type: 'boxai.agent.auth.request'; version: 1 }
type AgentAuthTokenMessage = {
  type: 'boxai.agent.auth.token'
  version: 1
  token: string | null
}

function isAgentAuthRequestMessage(value: unknown): value is AgentAuthRequestMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<AgentAuthRequestMessage>
  return (
    message.type === 'boxai.agent.auth.request' &&
    message.version === 1 &&
    Object.keys(value).length === 2
  )
}

const SELF_HOST_GUIDE_URL = 'https://github.com/fran0220/boxAI/blob/main/docs/OFFICE_MODULE.md'

export function AgentWorkspace() {
  const { d } = useI18n()
  const t = d.workspace.agentPage
  const { capabilities, remoteUrl } = useWorkspace()
  const [release, setRelease] = useState<DesktopRelease | null>(null)
  const [releaseFailed, setReleaseFailed] = useState(false)
  const remoteFrameRef = useRef<HTMLIFrameElement>(null)
  const platform = detectPlatform()

  usePageMeta(t.metaTitle, t.subtitle)

  useEffect(() => {
    let cancelled = false
    fetchDesktopRelease()
      .then((next) => {
        if (!cancelled) setRelease(next)
      })
      .catch(() => {
        if (!cancelled) setReleaseFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const recommended = release?.sections.find((section) => section.title === platform)?.items[0]
  const remoteAvailable = capabilities.agentRemote === 'available' && remoteUrl
  const remoteOrigin = useMemo(() => {
    if (!remoteAvailable) return null
    try {
      return new URL(remoteUrl).origin
    } catch {
      return null
    }
  }, [remoteAvailable, remoteUrl])

  useEffect(() => {
    if (!remoteOrigin) return

    const sendCurrentToken = () => {
      const target = remoteFrameRef.current?.contentWindow
      if (!target) return
      const snapshot = getSessionSnapshot()
      const message: AgentAuthTokenMessage = {
        type: 'boxai.agent.auth.token',
        version: 1,
        token: snapshot.accessToken,
      }
      target.postMessage(message, remoteOrigin)
    }
    const receiveRequest = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== remoteOrigin ||
        event.source !== remoteFrameRef.current?.contentWindow ||
        !isAgentAuthRequestMessage(event.data)
      ) return
      sendCurrentToken()
    }

    window.addEventListener('message', receiveRequest)
    const unsubscribe = subscribeSession(sendCurrentToken)
    return () => {
      window.removeEventListener('message', receiveRequest)
      unsubscribe()
    }
  }, [remoteOrigin])

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-[var(--bx-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 font-mono text-[10px] font-semibold text-[var(--bx-brand)]">
            {t.eyebrow}
          </p>
          <h1 className="mt-2 text-balance text-2xl font-extrabold sm:text-3xl">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-[var(--bx-text-muted)]">
            {t.subtitle}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--bx-success-border)] bg-[var(--bx-success-soft)] px-3 py-2 text-xs font-semibold text-[var(--bx-success)]">
          <ShieldCheck size={14} />
          {t.accountConnected}
        </span>
      </div>

      {remoteAvailable && remoteOrigin ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)]">
          <iframe
            ref={remoteFrameRef}
            src={remoteUrl}
            title={t.remoteTitle}
            onLoad={() => {
              const snapshot = getSessionSnapshot()
              const message: AgentAuthTokenMessage = {
                type: 'boxai.agent.auth.token',
                version: 1,
                token: snapshot.accessToken,
              }
              remoteFrameRef.current?.contentWindow?.postMessage(message, remoteOrigin)
            }}
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-[calc(100vh-12rem)] min-h-[640px] w-full border-0"
          />
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="bx-account-panel bx-account-panel-pad flex min-h-[270px] flex-col">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--bx-brand-soft)] text-[var(--bx-brand-bright)]">
              <Laptop size={19} />
            </span>
            <span className="rounded border border-[var(--bx-success-border)] px-2 py-1 font-mono text-[10px] text-[var(--bx-success)]">
              {t.desktopReady}
            </span>
          </div>
          <h2 className="mt-5 text-balance text-lg font-extrabold">{t.desktopTitle}</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-[var(--bx-text-muted)]">
            {t.desktopBody}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            {recommended ? (
              <a href={recommended.url} rel="noopener" className="bx-btn bx-btn-primary bx-btn-sm">
                <Download size={14} />
                {t.downloadFor.replace('{platform}', platform)}
              </a>
            ) : (
              <a
                href={RELEASES_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-btn bx-btn-primary bx-btn-sm"
              >
                <Download size={14} />
                {releaseFailed ? t.openReleases : d.common.loading}
              </a>
            )}
            {release ? (
              <span className="font-mono text-[10px] text-[var(--bx-text-dim)]">
                {release.version}
              </span>
            ) : null}
          </div>
        </section>

        <section className="bx-account-panel bx-account-panel-pad flex min-h-[270px] flex-col">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--bx-bg-muted)] text-[var(--bx-text-muted)]">
              <Radio size={19} />
            </span>
            <span
              className={
                remoteAvailable
                  ? 'rounded border border-[var(--bx-success-border)] px-2 py-1 font-mono text-[10px] text-[var(--bx-success)]'
                  : 'rounded border border-[var(--bx-border)] px-2 py-1 font-mono text-[10px] text-[var(--bx-text-dim)]'
              }
            >
              {remoteAvailable ? t.remoteReady : t.remoteUnavailable}
            </span>
          </div>
          <h2 className="mt-5 text-balance text-lg font-extrabold">{t.remoteTitle}</h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-[var(--bx-text-muted)]">
            {remoteAvailable ? t.remoteConfiguredBody : t.remoteUnavailableBody}
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            {remoteAvailable ? (
              <a
                href={remoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-btn bx-btn-primary bx-btn-sm"
              >
                {t.openRemote}
                <ExternalLink size={13} />
              </a>
            ) : null}
            <a
              href={SELF_HOST_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-btn bx-btn-ghost bx-btn-sm"
            >
              {t.selfHostGuide}
              <ExternalLink size={13} />
            </a>
          </div>
        </section>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-4">
          <HardDrive size={16} className="text-[var(--bx-brand)]" />
          <h3 className="mt-3 text-sm font-bold">{t.localTitle}</h3>
          <p className="mt-1 text-pretty text-xs leading-5 text-[var(--bx-text-muted)]">
            {t.localBody}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--bx-border)] bg-[var(--bx-bg-elevated)] p-4">
          <ShieldCheck size={16} className="text-[var(--bx-brand)]" />
          <h3 className="mt-3 text-sm font-bold">{t.permissionTitle}</h3>
          <p className="mt-1 text-pretty text-xs leading-5 text-[var(--bx-text-muted)]">
            {t.permissionBody}
          </p>
        </div>
      </section>
    </div>
  )
}
