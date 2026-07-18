import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { apiBase } from '@/lib/brand'
import { getAccessToken, sessionRequestHeaders } from '@/lib/session'
import { getPublicSettings } from '@/lib/customer-api'
import { useI18n } from '@/i18n'
import { usePageMeta } from '@/lib/meta'
import { Spinner } from '@/components/ui/Spinner'

type CustomMenuItem = {
  id: string
  label: string
  url: string
  page_slug?: string
  visibility?: string
  sort_order?: number
}

/**
 * Admin-configured markdown page (Vue CustomPageView parity).
 * Content: GET /api/v1/pages/:slug (raw markdown, not envelope).
 */
export function AccountCustomPage() {
  const { d } = useI18n()
  const t = d.accountCustomPage
  const { slug = '' } = useParams<{ slug: string }>()
  const [label, setLabel] = useState(slug)
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  usePageMeta(label || t.metaTitle)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      setMarkdown('')
      try {
        const settings = await getPublicSettings()
        const items = (settings.custom_menu_items as CustomMenuItem[] | undefined) || []
        const match = items.find(
          (it) => it.page_slug === slug || it.id === slug || it.url?.includes(`/pages/${slug}`),
        )
        if (match?.label) setLabel(match.label)
        else setLabel(slug)

        if (match?.url && !match.page_slug && /^https?:\/\//i.test(match.url)) {
          window.location.href = match.url
          return
        }

        const headers: Record<string, string> = { ...sessionRequestHeaders() }
        const token = getAccessToken()
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await fetch(`${apiBase()}/api/v1/pages/${encodeURIComponent(slug)}`, {
          credentials: 'include',
          headers,
        })
        if (!res.ok) {
          if (!cancelled) setError(t.notFound)
          return
        }
        const text = await res.text()
        if (!cancelled) setMarkdown(text)
      } catch {
        if (!cancelled) setError(t.loadFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, t.loadFailed, t.notFound])

  const rewritten = useMemo(() => {
    if (!markdown || !slug) return markdown
    // Rewrite relative image paths to page image API
    return markdown.replace(/!\[([^\]]*)\]\((?!https?:|data:|\/)([^)]+)\)/g, (_m, alt, src) => {
      const clean = String(src).replace(/^\.\//, '')
      const url = `${apiBase()}/api/v1/pages/${encodeURIComponent(slug)}/images/${clean
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`
      return `![${alt}](${url})`
    })
  }, [markdown, slug])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="bx-account-page-title">{t.title}</h1>
        <div className="bx-account-panel bx-account-panel-pad mt-4">
          <p className="bx-text-danger m-0 text-sm">{error}</p>
          <Link to="/app" className="bx-btn bx-btn-ghost bx-btn-sm mt-4">
            {t.back}
          </Link>
        </div>
      </div>
    )
  }

  if (!rewritten.trim()) {
    return (
      <div>
        <h1 className="bx-account-page-title">{label || t.title}</h1>
        <p className="bx-account-empty mt-6">{t.notFound}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="bx-account-page-title">{label}</h1>
      <article className="bx-account-panel bx-account-panel-pad bx-prose mt-5 text-sm leading-relaxed text-[var(--bx-text-soft)] [&_a]:text-[var(--bx-brand-bright)] [&_code]:rounded [&_code]:bg-[var(--bx-bg-muted)] [&_code]:px-1 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--bx-bg-muted)] [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown>{rewritten}</ReactMarkdown>
      </article>
    </div>
  )
}
