import { memo, useEffect, useState } from 'react'
import type { Components, MathPlugin, StreamdownTranslations } from 'streamdown'
import type { Components as ReactMarkdownComponents } from 'react-markdown'
import { getPg } from '../lib/pgI18n'

type MarkdownRendererProps = {
  content: string
  streaming?: boolean
  className?: string
}

type StreamdownComponent = typeof import('streamdown')['Streamdown']
type ReactMarkdownComponent = typeof import('react-markdown')['default']
type RemarkGfmPlugin = typeof import('remark-gfm')['default']
type LegacyMarkdownModule = {
  ReactMarkdown: ReactMarkdownComponent
  remarkGfm: RemarkGfmPlugin
}
type MathMarkdownModule = {
  math: MathPlugin
}
type MarkdownRendererState =
  | { type: 'loading' }
  | { type: 'modern'; Component: StreamdownComponent; math: MathMarkdownModule }
  | { type: 'legacy'; module: LegacyMarkdownModule }
  | { type: 'plain' }

const allowedUrlProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:'])

function safeUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin)
    return allowedUrlProtocols.has(parsed.protocol) ? url : '#blocked'
  } catch {
    return '#blocked'
  }
}

const markdownComponents: Components = {
  a({ children, href, node: _node, ...props }) {
    const shouldOpenBlank = Boolean(href && href !== '#blocked')
    return (
      <a
        {...props}
        href={href}
        rel={shouldOpenBlank ? 'noreferrer' : undefined}
        target={shouldOpenBlank ? '_blank' : undefined}
      >
        {children}
      </a>
    )
  },
}

const legacyMarkdownComponents: ReactMarkdownComponents = {
  a({ children, href, ...props }) {
    const safeHref = safeUrl(href ?? '')
    const shouldOpenBlank = safeHref !== '#blocked'
    return (
      <a
        {...props}
        href={safeHref}
        rel={shouldOpenBlank ? 'noreferrer' : undefined}
        target={shouldOpenBlank ? '_blank' : undefined}
      >
        {children}
      </a>
    )
  },
}

function getMarkdownTranslations(): Partial<StreamdownTranslations> {
  const pg = getPg()
  return {
    copied: pg.mdCopied,
    copyCode: pg.mdCopyCode,
    copyLink: pg.mdCopyLink,
    copyTable: pg.mdCopyTable,
    copyTableAsCsv: pg.mdCopyTableCsv,
    copyTableAsMarkdown: pg.mdCopyTableMd,
    copyTableAsTsv: pg.mdCopyTableTsv,
    downloadFile: pg.mdDownloadFile,
    downloadImage: pg.mdDownloadImage,
    downloadTable: pg.mdDownloadTable,
    downloadTableAsCsv: pg.mdDownloadTableCsv,
    downloadTableAsMarkdown: pg.mdDownloadTableMd,
    externalLinkWarning: pg.mdExternalLinkWarning,
    imageNotAvailable: pg.mdImageNotAvailable,
    openExternalLink: pg.mdOpenExternalLink,
    openLink: pg.mdOpenLink,
    tableFormatCsv: 'CSV',
    tableFormatMarkdown: 'Markdown',
    tableFormatTsv: 'TSV',
    viewFullscreen: pg.mdViewFullscreen,
  }
}

const canLoadStreamdown = (() => {
  try {
    new RegExp('(?<=a)b')
    return typeof (Array.prototype as { at?: unknown }).at === 'function'
  } catch {
    return false
  }
})()

let streamdownPromise: Promise<MarkdownRendererState> | null = null
let legacyMarkdownPromise: Promise<MarkdownRendererState> | null = null

function loadLegacyMarkdown() {
  legacyMarkdownPromise ??= Promise.all([import('react-markdown'), import('remark-gfm')])
    .then(([reactMarkdown, remarkGfm]) => ({
      type: 'legacy' as const,
      module: {
        ReactMarkdown: reactMarkdown.default,
        remarkGfm: remarkGfm.default,
      },
    }))
    .catch((error) => {
      console.error('Legacy markdown renderer failed to load:', error)
      return { type: 'plain' as const }
    })

  return legacyMarkdownPromise
}

function loadMarkdownRenderer() {
  if (!canLoadStreamdown) return loadLegacyMarkdown()

  streamdownPromise ??= Promise.all([
    import('streamdown'),
    import('@streamdown/math'),
  ])
    .then(([streamdown, math]) => ({
      type: 'modern' as const,
      Component: streamdown.Streamdown,
      math: {
        math: math.createMathPlugin({
          errorColor: 'var(--muted-foreground)',
          singleDollarTextMath: true,
        }),
      },
    }))
    .catch((error) => {
      console.error('Streamdown failed to load:', error)
      return loadLegacyMarkdown()
    })

  return streamdownPromise!
}

function PlainTextMarkdown({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div
      className={`markdown-renderer ${className}`.trim()}
      dir="auto"
      style={{ whiteSpace: 'pre-wrap' }}
    >
      {content}
    </div>
  )
}

const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  streaming = false,
  className = '',
}: MarkdownRendererProps) {
  const [renderer, setRenderer] = useState<MarkdownRendererState>({ type: 'loading' })

  useEffect(() => {
    let disposed = false

    loadMarkdownRenderer().then((nextRenderer) => {
      if (!disposed) setRenderer(nextRenderer)
    })

    return () => {
      disposed = true
    }
  }, [])

  if (renderer.type === 'legacy') {
    const { ReactMarkdown, remarkGfm } = renderer.module
    return (
      <div className={`markdown-renderer ${className}`.trim()} dir="auto">
        <ReactMarkdown
          components={legacyMarkdownComponents}
          remarkPlugins={[remarkGfm]}
          urlTransform={safeUrl}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  if (renderer.type !== 'modern') {
    return <PlainTextMarkdown content={content} className={className} />
  }

  const StreamdownComponent = renderer.Component

  return (
    <StreamdownComponent
      className={`markdown-renderer ${className}`.trim()}
      components={markdownComponents}
      controls={{
        code: { copy: true, download: false },
        mermaid: false,
        table: { copy: true, download: false, fullscreen: true },
      }}
      dir="auto"
      isAnimating={streaming}
      lineNumbers={false}
      mode={streaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown={streaming}
      plugins={{ math: renderer.math.math }}
      skipHtml
      translations={getMarkdownTranslations()}
      urlTransform={safeUrl}
    >
      {content}
    </StreamdownComponent>
  )
})

export default MarkdownRenderer
