import React, { useEffect, useState, useRef } from 'react'
import { useStore, addImageFromUrl, ensureImageCached } from '../store'
import { canCopyImageToClipboard, copyImageSourceToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { downloadImageEntriesAsZip, downloadImageIds, formatExportFileTime, getImageZipEntries } from '../lib/downloadImages'
import { suppressGlobalClicks } from '../lib/clickSuppression'
import { CopyIcon, DownloadIcon, EditIcon } from './icons'
import { usePg } from '../lib/pgI18n'

export default function ImageContextMenu() {
  const { pg, t } = usePg()

  const [menuInfo, setMenuInfo] = useState<{ src: string; imageId?: string; outputImageIds: string[]; canCopyImage: boolean; x: number; y: number } | null>(null)
  const showToast = useStore((s) => s.showToast)
  const inputImages = useStore((s) => s.inputImages)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const setMaskEditorImageId = useStore((s) => s.setMaskEditorImageId)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEmbeddedPage()) return

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target && target.tagName === 'IMG') {
        const imgTarget = target as HTMLImageElement
        // Ignore img without src
        if (!imgTarget.src) return

        // On iOS touch, allow native long-press menu (native save image)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const isTouch = window.matchMedia('(pointer: coarse)').matches
        if (isIOS && isTouch) return

        const canCopyImage = canCopyImageToClipboard()
        // Insecure context lacks image clipboard API; allow native menu on originals, keep download/edit on thumbs.
        if (!canCopyImage && imgTarget.classList.contains('object-contain')) return

        e.preventDefault()
        setMenuInfo({
          src: imgTarget.src,
          imageId: imgTarget.dataset.imageId,
          outputImageIds: imgTarget.dataset.outputImageIds?.split(',').filter(Boolean) ?? [],
          canCopyImage,
          x: e.clientX,
          y: e.clientY,
        })
      }
    }

    // Listen for global contextmenu (desktop right-click + most mobile long-press)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  // Close menu on outside click, scroll, or zoom
  useEffect(() => {
    if (!menuInfo) return
    const close = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return
      }
      if (e.target instanceof Element && e.target.closest('[data-lightbox-root]')) {
        window.dispatchEvent(new Event('image-context-menu-dismiss-lightbox-click'))
      }
      if (e.type === 'mousedown' || e.type === 'touchstart') suppressGlobalClicks()
      setMenuInfo(null)
    }
    window.addEventListener('mousedown', close, { capture: true })
    window.addEventListener('touchstart', close, { capture: true })
    window.addEventListener('wheel', close, { capture: true })
    window.addEventListener('scroll', close, { capture: true })
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close, { capture: true })
      window.removeEventListener('touchstart', close, { capture: true })
      window.removeEventListener('wheel', close, { capture: true })
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [menuInfo])

  if (!menuInfo) return null

  const getOriginalImageSrc = async () => {
    if (!menuInfo.imageId) return menuInfo.src
    return await ensureImageCached(menuInfo.imageId) ?? menuInfo.src
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuInfo(null)
    try {
      await copyImageSourceToClipboard(getOriginalImageSrc())
      showToast(pg.imageCopied, 'success')
    } catch (err) {
      console.error(err)
      showToast(getClipboardFailureMessage(pg.copyFailed, err), 'error')
    }
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const imageId = menuInfo.imageId
    const src = menuInfo.src
    setMenuInfo(null)

    try {
      let fileNameBase = ''
      if (imageId) {
        const tasks = useStore.getState().tasks
        const matchedTask = tasks.find(t => t.outputImages?.includes(imageId))
        if (matchedTask) {
          fileNameBase = `task-${matchedTask.id}`
        } else {
          fileNameBase = `image-${imageId}`
        }
      } else {
        const timeStr = formatExportFileTime(new Date())
        fileNameBase = `image-${timeStr}`
      }

      const result = await downloadImageIds([imageId || src], fileNameBase)
      if (result.successCount === 0) {
        showToast(pg.downloadFailed, 'error')
      } else {
        showToast(pg.downloadSuccess, 'success')
      }
    } catch (err) {
      console.error(err)
      showToast(pg.downloadFailed, 'error')
    }
  }

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const outputImageIds = menuInfo.outputImageIds
    setMenuInfo(null)
    if (outputImageIds.length <= 1) return

    try {
      let fileNameBase = ''
      if (outputImageIds[0]) {
        const tasks = useStore.getState().tasks
        const matchedTask = tasks.find(t => t.outputImages?.includes(outputImageIds[0]))
        if (matchedTask) {
          fileNameBase = `task-${matchedTask.id}`
        }
      }
      if (!fileNameBase) {
        const timeStr = formatExportFileTime(new Date())
        fileNameBase = `batch-${timeStr}`
      }

      const settings = useStore.getState().settings
      const result = settings.zipDownloadRoutes.includes('image-context-menu-all')
        ? await downloadImageEntriesAsZip(getImageZipEntries(outputImageIds, fileNameBase), fileNameBase)
        : await downloadImageIds(outputImageIds, fileNameBase)
      if (result.successCount === 0) {
        showToast(pg.downloadFailed, 'error')
      } else if (result.failCount > 0) {
        showToast(t('downloadPartial', { success: result.successCount, fail: result.failCount }), 'error')
      } else {
        showToast(result.successCount > 1 ? t('downloadSuccessCount', { count: result.successCount }) : pg.downloadSuccess, 'success')
      }
    } catch (err) {
      console.error(err)
      showToast(pg.downloadFailed, 'error')
    }
  }

  const handleEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuInfo(null)
    if (inputImages.length >= 16) {
      showToast(t('refLimit', { max: 16 }), 'error')
      return
    }

    try {
      const src = await getOriginalImageSrc()
      await addImageFromUrl(src)
      setDetailTaskId(null)
      setLightboxImageId(null)
      setMaskEditorImageId(null)
      showToast(pg.addedToRef, 'success')
    } catch (err) {
      console.error(err)
      showToast(t('addToRefFailed', { error: err instanceof Error ? err.message : String(err) }), 'error')
    }
  }

  // Keep menu inside viewport
  let left = menuInfo.x
  let top = menuInfo.y
  const MENU_WIDTH = 120
  const showDownloadAll = menuInfo.outputImageIds.length > 1
  const menuItemCount = (menuInfo.canCopyImage ? 1 : 0) + 1 + (showDownloadAll ? 1 : 0) + 1
  const MENU_HEIGHT = menuItemCount * 32 + 32

  if (left + MENU_WIDTH > window.innerWidth) {
    left -= MENU_WIDTH
  }
  if (top + MENU_HEIGHT > window.innerHeight) {
    top -= MENU_HEIGHT
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-[var(--bx-bg-elevated)] rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 w-[120px] overflow-hidden animate-fade-in"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menuInfo.canCopyImage && (
        <button
          onClick={handleCopy}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
        >
          <CopyIcon className="w-4 h-4 flex-shrink-0" />
          {pg.copy}
        </button>
      )}
      <button
        onClick={handleDownload}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
      >
        <DownloadIcon className="w-4 h-4 flex-shrink-0" />
        {pg.download}
      </button>
      {showDownloadAll && (
        <button
          onClick={handleDownloadAll}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
        >
          <DownloadIcon className="w-4 h-4 flex-shrink-0" />
          {pg.downloadAll}
        </button>
      )}
      <button
        onClick={handleEdit}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
      >
        <EditIcon className="w-4 h-4 flex-shrink-0" />
        {pg.edit}
      </button>
    </div>
  )
}

function isEmbeddedPage() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}
