/**
 * Compact gallery tile for create-shell (5-col grid).
 * Hover: model + star/download. Generating: shimmer; real % only if present (never invent).
 */
import { useEffect, useState } from 'react'
import type { TaskRecord } from '../types'
import {
  useStore,
  ensureImageThumbnailCached,
  subscribeImageThumbnail,
  retryTask,
} from '../store'
import { downloadImageIds } from '../lib/downloadImages'
import { usePg } from '../lib/pgI18n'
import { cx } from '@/lib/cx'

interface Props {
  task: TaskRecord
  onClick: (e: React.MouseEvent | React.TouchEvent) => void
  isSelected?: boolean
}

export default function CreateShellTaskCard({ task, onClick, isSelected }: Props) {
  const { pg } = usePg()
  const [thumbSrc, setThumbSrc] = useState('')
  const [streamPreviewLoaded, setStreamPreviewLoaded] = useState(false)
  const openFavoritePicker = useStore((s) => s.openFavoritePicker)
  const streamPreviewSrc = useStore((s) => s.streamPreviews[task.id] || '')
  const showToast = useStore((s) => s.showToast)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    const firstId = task.outputImages?.[0]
    if (!firstId) {
      setThumbSrc('')
      return
    }
    void ensureImageThumbnailCached(firstId).then((rec) => {
      if (!cancelled && rec?.dataUrl) setThumbSrc(rec.dataUrl)
    })
    unsubscribe = subscribeImageThumbnail(firstId, (rec) => {
      if (!cancelled && rec?.dataUrl) setThumbSrc(rec.dataUrl)
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [task.outputImages])

  useEffect(() => {
    setStreamPreviewLoaded(false)
  }, [streamPreviewSrc])

  const isRunning = task.status === 'running'
  const isError = task.status === 'error'
  const isDone = task.status === 'done'
  const modelLabel = task.apiModel || task.apiProfileName || ''
  // Real progress only — playground store does not expose percent today.
  const progressRaw = (task as unknown as { progress?: unknown }).progress
  const realProgress = typeof progressRaw === 'number' ? Math.round(progressRaw) : null

  const onFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    openFavoritePicker([task.id])
  }

  const onDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task.outputImages?.length) return
    try {
      const result = await downloadImageIds(task.outputImages)
      if (result.successCount > 0) {
        showToast(
          result.failCount > 0
            ? pg.downloadPartial
                .replace('{success}', String(result.successCount))
                .replace('{fail}', String(result.failCount))
            : pg.downloadSuccess,
          result.failCount > 0 ? 'info' : 'success',
        )
      } else {
        showToast(pg.downloadFailed, 'error')
      }
    } catch {
      showToast(pg.downloadFailed, 'error')
    }
  }

  return (
    <div
      className={cx(
        'bx-create-shell-tile group',
        isSelected && 'is-selected',
        isRunning && 'is-generating',
      )}
      style={{ aspectRatio: '1' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(e as unknown as React.MouseEvent)
        }
      }}
    >
      {isSelected ? (
        <div className="bx-create-shell-tile-check" aria-hidden>
          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : null}

      {isRunning ? (
        <div className="bx-create-shell-tile-shimmer">
          {streamPreviewSrc && streamPreviewLoaded ? (
            <img src={streamPreviewSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          ) : null}
          {streamPreviewSrc ? (
            <img
              src={streamPreviewSrc}
              alt=""
              className="hidden"
              onLoad={() => setStreamPreviewLoaded(true)}
              onError={() => setStreamPreviewLoaded(false)}
            />
          ) : null}
          {realProgress != null ? (
            <span className="font-mono text-[11px] text-[var(--bx-text-dim)]">{realProgress}%</span>
          ) : (
            <span
              className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-[var(--bx-brand)] border-t-transparent"
              aria-label={pg.generatingShort}
            />
          )}
        </div>
      ) : null}

      {isError ? (
        <div className="bx-create-shell-tile-error">
          <span className="text-[11px] text-[var(--bx-danger)]">{pg.failed}</span>
          <button
            type="button"
            className="mt-1 text-[10px] text-[var(--bx-brand-bright)] underline"
            onClick={(e) => {
              e.stopPropagation()
              void retryTask(task)
            }}
          >
            {pg.retryTask}
          </button>
        </div>
      ) : null}

      {isDone && thumbSrc ? (
        <img
          src={thumbSrc}
          data-image-id={task.outputImages[0]}
          data-output-image-ids={task.outputImages.join(',')}
          className="saveable-image h-full w-full object-cover"
          loading="lazy"
          alt=""
        />
      ) : null}

      {isDone && !thumbSrc ? (
        <div className="flex h-full w-full items-center justify-center bg-[var(--bx-bg-muted)]">
          <svg className="h-8 w-8 text-[var(--bx-text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      ) : null}

      {/* Hover chrome: model + star/download */}
      <div className="bx-create-shell-tile-hover">
        <span className="min-w-0 truncate font-mono text-[9.5px] text-white/85">
          {modelLabel || pg.unknown}
        </span>
        <span className="flex gap-1 text-white/90">
          <button
            type="button"
            className={cx('rounded p-0.5', task.isFavorite && 'text-[var(--bx-brand-bright)]')}
            onClick={onFavorite}
            aria-label={task.isFavorite ? pg.editFavorites : pg.favoriteTask}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={task.isFavorite ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
            </svg>
          </button>
          {task.outputImages?.length ? (
            <button
              type="button"
              className="rounded p-0.5"
              onClick={onDownload}
              aria-label={pg.download}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
            </button>
          ) : null}
        </span>
      </div>
    </div>
  )
}
