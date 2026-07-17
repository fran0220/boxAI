/**
 * Create-shell one-row toolbar matching design `新版-创作台.dc.html`:
 * Segmented 画廊|Agent · search · filter chips 全部|收藏|生成中 · mono count
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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

type Chip = 'all' | 'favorites' | 'running'

export default function CreateShellToolbar() {
  const { d } = useI18n()
  const pg = d.playground
  const create = d.create.image

  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const setFilterStatus = useStore((s) => s.setFilterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const setFilterFavorite = useStore((s) => s.setFilterFavorite)
  const clearSelection = useStore((s) => s.clearSelection)
  const tasks = useStore((s) => s.tasks)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const agentConversations = useStore((s) => s.agentConversations)
  const activeAgentConversationId = useStore((s) => s.activeAgentConversationId)
  const createConversation = useStore((s) => s.createAgentConversation)

  const activeConversation = agentConversations.find((item) => item.id === activeAgentConversationId)
  const favoriteCollectionTitle = useFavoriteCollectionTitle()
  const showFavoriteCollectionTitle = appMode === 'gallery' && Boolean(activeFavoriteCollectionId)

  const [showHelp, setShowHelp] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const helpTooltip = useTooltip()
  const historyTooltip = useTooltip()
  const newChatTooltip = useTooltip()

  useEffect(() => () => dismissAllTooltips(), [])

  const activeChip: Chip = useMemo(() => {
    if (filterFavorite) return 'favorites'
    if (filterStatus === 'running') return 'running'
    return 'all'
  }, [filterFavorite, filterStatus])

  const setChip = (chip: Chip) => {
    clearSelection()
    if (chip === 'all') {
      setFilterFavorite(false)
      setFilterStatus('all')
      return
    }
    if (chip === 'favorites') {
      setFilterFavorite(true)
      setFilterStatus('all')
      return
    }
    setFilterFavorite(false)
    setFilterStatus('running')
  }

  const itemCount = tasks.length
  const itemsLabel = (create.itemsLocal || '{n} items · Local').replace('{n}', String(itemCount))

  const modeBtn = (mode: 'gallery' | 'agent', label: string) => (
    <button
      type="button"
      onClick={() => setAppMode(mode)}
      className={cx(
        'bx-create-image-mode-btn',
        appMode === mode && 'is-active',
      )}
    >
      {label}
    </button>
  )

  const chipBtn = (chip: Chip, label: string) => (
    <button
      type="button"
      onClick={() => setChip(chip)}
      data-active={activeChip === chip}
      className="bx-create-filter-chip"
    >
      {label}
    </button>
  )

  return (
    <>
      <div data-no-drag-select className="bx-create-image-toolbar">
        <div className="bx-create-image-mode-seg">
          {modeBtn('gallery', pg.modeGallery)}
          {modeBtn('agent', pg.modeAgent)}
        </div>

        {appMode === 'gallery' ? (
          <>
            <div className="bx-create-image-search">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="bx-create-image-search-icon"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={create.searchPlaceholder || pg.searchPlaceholder}
                className="bx-create-image-search-input"
              />
            </div>

            {showFavoriteCollectionTitle ? (
              <span
                className="hidden max-w-[10rem] truncate text-xs font-medium text-[var(--bx-text-soft)] md:inline"
                title={favoriteCollectionTitle}
              >
                {favoriteCollectionTitle}
              </span>
            ) : null}

            <div className="bx-create-filter-row ml-auto">
              {chipBtn('all', create.filterAll || pg.filterAll)}
              {chipBtn('favorites', create.filterFavorites || pg.favorites)}
              {chipBtn('running', create.filterRunning || pg.statusRunning)}
            </div>

            <span className="bx-create-image-count">{itemsLabel}</span>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1">
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
            <span className="ml-auto" />
          </div>
        )}

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
