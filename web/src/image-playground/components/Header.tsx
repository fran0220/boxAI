/**
 * Slim image-workbench toolbar (NOT a second site header).
 * Site chrome lives in web Layout Header; this only hosts gallery/agent mode + help.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useTooltip } from '../hooks/useTooltip'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import ViewportTooltip from './ViewportTooltip'
import HelpModal from './HelpModal'
import HistoryModal from './HistoryModal'
import { useFavoriteCollectionTitle } from './FavoriteCollections'
import { EditIcon, HelpCircleIcon, HistoryIcon } from './icons'
import { useI18n } from '@/i18n'
import { cx } from '@/lib/cx'

export default function Header() {
  const { d } = useI18n()
  const pg = d.playground
  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)
  const agentConversations = useStore((s) => s.agentConversations)
  const activeAgentConversationId = useStore((s) => s.activeAgentConversationId)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const activeConversation = agentConversations.find((item) => item.id === activeAgentConversationId)
  const favoriteCollectionTitle = useFavoriteCollectionTitle()
  const showFavoriteCollectionTitle = appMode === 'gallery' && Boolean(activeFavoriteCollectionId)
  const [showHelp, setShowHelp] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const createConversation = useStore((s) => s.createAgentConversation)
  const helpTooltip = useTooltip()
  const historyTooltip = useTooltip()
  const newChatTooltip = useTooltip()

  // Keep help modal state in sync when unmounting panels
  useEffect(() => {
    return () => dismissAllTooltips()
  }, [])

  const modeBtn = (mode: 'gallery' | 'agent', label: string) => (
    <button
      type="button"
      onClick={() => setAppMode(mode)}
      className={cx(
        'rounded-[var(--bx-radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors',
        appMode === mode
          ? 'bg-[var(--bx-active)] text-[var(--bx-teal-bright)] shadow-sm'
          : 'text-[var(--bx-text-muted)] hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]',
      )}
    >
      {label}
    </button>
  )

  return (
    <>
      <div
        data-no-drag-select
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bx-border)] bg-[var(--bx-bg)]/90 px-3 py-2 backdrop-blur-md sm:px-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-[var(--bx-radius-md)] border border-[var(--bx-border)] bg-[var(--bx-bg-muted)] p-0.5">
            {modeBtn('gallery', pg.modeGallery)}
            {modeBtn('agent', pg.modeAgent)}
          </div>

          {appMode === 'agent' && (
            <div className="hidden items-center gap-1 sm:flex">
              <div className="relative" {...historyTooltip.handlers}>
                <button
                  ref={historyButtonRef}
                  type="button"
                  onClick={() => setShowHistoryModal((v) => !v)}
                  className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                  aria-label={pg.history}
                >
                  <HistoryIcon className="h-5 w-5" />
                </button>
                <ViewportTooltip visible={historyTooltip.visible} className="whitespace-nowrap">
                  {pg.history}
                </ViewportTooltip>
              </div>
              <div className="relative" {...newChatTooltip.handlers}>
                <button
                  type="button"
                  onClick={() => createConversation()}
                  className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
                  aria-label={pg.newChat}
                >
                  <EditIcon className="h-5 w-5" />
                </button>
                <ViewportTooltip visible={newChatTooltip.visible} className="whitespace-nowrap">
                  {pg.newChat}
                </ViewportTooltip>
              </div>
              {activeConversation ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(true)
                    setTimeout(() => {
                      useStore.getState().setAgentEditingConversationId(activeConversation.id)
                    }, 0)
                  }}
                  className="max-w-[12rem] truncate rounded-[var(--bx-radius-sm)] px-2 py-1 text-sm font-medium text-[var(--bx-text-soft)] hover:bg-[var(--bx-hover)]"
                >
                  {activeConversation.title || pg.modeAgent}
                </button>
              ) : null}
            </div>
          )}

          {showFavoriteCollectionTitle ? (
            <span
              className="hidden max-w-[12rem] truncate text-sm font-medium text-[var(--bx-text-soft)] md:inline"
              title={favoriteCollectionTitle}
            >
              {favoriteCollectionTitle}
            </span>
          ) : null}
        </div>

        <div className="relative shrink-0" {...helpTooltip.handlers}>
          <button
            type="button"
            onClick={() => {
              dismissAllTooltips()
              setShowHelp(true)
            }}
            className="rounded-[var(--bx-radius-sm)] p-1.5 text-[var(--bx-text-muted)] transition-colors hover:bg-[var(--bx-hover)] hover:text-[var(--bx-text)]"
            aria-label={pg.help}
          >
            <HelpCircleIcon className="h-5 w-5" />
          </button>
          <ViewportTooltip visible={helpTooltip.visible} className="whitespace-nowrap">
            {pg.help}
          </ViewportTooltip>
        </div>
      </div>

      {showHistoryModal ? (
        <HistoryModal
          onClose={() => setShowHistoryModal(false)}
          ignoreOutsideClickRef={historyButtonRef}
        />
      ) : null}
      {showHelp ? (
        <HelpModal
          appMode={appMode}
          isFavoriteCollectionOverview={
            appMode === 'gallery' && filterFavorite && !activeFavoriteCollectionId
          }
          onClose={() => setShowHelp(false)}
        />
      ) : null}
    </>
  )
}
