import { useCallback, useMemo, useRef, useState } from 'react'
import type { TaskRecord, FavoriteCollection } from '../../types'
import { getDisplayFavoriteCollectionName, 
  ALL_FAVORITES_COLLECTION_ID,
  deleteFavoriteCollection,
  renameFavoriteCollection,
  useStore,
} from '../../store'
import { useDragSelect } from '../../hooks/useDragSelect'
import { FavoriteIcon } from '../icons'
import { FavoriteCollectionOverviewCard } from './FavoriteCollectionOverviewCard'
import { getCollectionTasks, getLatestCoverTask, type CollectionCard } from './favoriteUtils'
import { usePg } from '../../lib/pgI18n'

export function FavoriteCollectionsView() {
  const { pg, t } = usePg()

  const tasks = useStore((s) => s.tasks)
  const collections = useStore((s) => s.favoriteCollections)
  const defaultFavoriteCollectionId = useStore((s) => s.defaultFavoriteCollectionId)
  const setDefaultFavoriteCollectionId = useStore((s) => s.setDefaultFavoriteCollectionId)
  const searchQuery = useStore((s) => s.searchQuery)
  const setActiveFavoriteCollectionId = useStore((s) => s.setActiveFavoriteCollectionId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const selectedFavoriteCollectionIds = useStore((s) => s.selectedFavoriteCollectionIds)
  const setSelectedFavoriteCollectionIds = useStore((s) => s.setSelectedFavoriteCollectionIds)
  const toggleFavoriteCollectionSelection = useStore((s) => s.toggleFavoriteCollectionSelection)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const suppressClickUntilRef = useRef(0)
  
  const cards = useMemo<CollectionCard[]>(() => {
    const allTasks = getCollectionTasks(ALL_FAVORITES_COLLECTION_ID, tasks)
    return [
      { id: ALL_FAVORITES_COLLECTION_ID, name: pg.allFavorites, tasks: allTasks },
      ...collections.map((collection) => ({
        id: collection.id,
        name: getDisplayFavoriteCollectionName(collection),
        collection,
        tasks: getCollectionTasks(collection.id, tasks),
      })),
    ]
  }, [collections, tasks, pg.allFavorites])

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards
    const lowerQuery = searchQuery.toLowerCase()
    return cards.filter(c => c.name.toLowerCase().includes(lowerQuery))
  }, [cards, searchQuery])

  const handleCollectionSelectionChange = useCallback((ids: string[]) => {
    setSelectedFavoriteCollectionIds(ids)
  }, [setSelectedFavoriteCollectionIds])

  const { selectionBox } = useDragSelect({
    containerSelector: '[data-drag-select-surface]',
    itemSelector: '.favorite-collection-card-wrapper',
    getItemId: (element) => element.getAttribute('data-favorite-collection-id'),
    onSelectionChange: handleCollectionSelectionChange,
    initialSelectedIds: selectedFavoriteCollectionIds,
    onSuppressClick: () => {
      suppressClickUntilRef.current = Date.now() + 250
    },
  })

  const startRename = (e: React.MouseEvent, collection: FavoriteCollection) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(collection.id)
    setEditingName(collection.name)
  }

  const confirmRename = () => {
    if (editingId && editingName.trim()) renameFavoriteCollection(editingId, editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditingId(null)
      setEditingName('')
    }
  }

  const handleDelete = (collection: FavoriteCollection, collectionTasks: TaskRecord[]) => {
    if (collections.length <= 1) return
    const imageCount = new Set(collectionTasks.flatMap((task) => task.outputImages || [])).size
    setConfirmDialog({
      tone: 'danger',
      title: pg.deleteFavorite,
      message: t('deleteFavoriteConfirm', { name: getDisplayFavoriteCollectionName(collection) }),
      checkbox: imageCount > 0
        ? {
            label: t('deleteFavoriteWithImages', { count: imageCount }),
            tone: 'danger',
          }
        : undefined,
      action: (deleteImages = false) => {
        void deleteFavoriteCollection(collection.id, deleteImages)
      },
    })
  }

  const handleSetDefault = (collection: FavoriteCollection) => {
    if (collection.id === defaultFavoriteCollectionId) {
      setDefaultFavoriteCollectionId(null)
      return
    }
    const current = collections.find((item) => item.id === defaultFavoriteCollectionId)
    if (!current) {
      setDefaultFavoriteCollectionId(collection.id)
      return
    }
    setConfirmDialog({
      title: pg.changeDefaultFavorite,
      message: t('changeDefaultConfirm', { from: getDisplayFavoriteCollectionName(current), to: getDisplayFavoriteCollectionName(collection) }),
      action: () => setDefaultFavoriteCollectionId(collection.id),
    })
  }

  return (
    <div data-favorite-collections-root className="relative min-h-[50vh]">
      {filteredCards.length === 0 ? (
        <div className="py-32 text-center text-gray-400 dark:text-gray-500">
          <FavoriteIcon className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">{pg.favorites}</p>
          <p className="text-sm">{cards.length === 0 ? pg.noFavoritesYet : pg.noMatchingCollections}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-10">
          {filteredCards.map((card) => {
            const coverTask = getLatestCoverTask(card.tasks)
            const isVirtualAll = card.id === ALL_FAVORITES_COLLECTION_ID
            const isDefault = card.id === defaultFavoriteCollectionId
            const canDelete = collections.length > 1
            return (
              <div
                key={card.id}
                className="favorite-collection-card-wrapper"
                data-favorite-collection-id={card.id}
              >
                <FavoriteCollectionOverviewCard
                  card={card}
                  coverTask={coverTask}
                  isVirtualAll={isVirtualAll}
                  isDefault={isDefault}
                  canDelete={canDelete}
                  isSelected={selectedFavoriteCollectionIds.includes(card.id)}
                  editingId={editingId}
                  editingName={editingName}
                  setEditingName={setEditingName}
                  confirmRename={confirmRename}
                  handleRenameKeyDown={handleRenameKeyDown}
                  startRename={startRename}
                  handleSetDefault={handleSetDefault}
                  handleDelete={handleDelete}
                  onOpen={() => setActiveFavoriteCollectionId(card.id)}
                  onToggleSelection={() => toggleFavoriteCollectionSelection(card.id)}
                  suppressClickUntilRef={suppressClickUntilRef}
                />
              </div>
            )
          })}
        </div>
      )}
      {selectionBox && (
        <div
          className="fixed bg-teal-500/20 border border-teal-500/50 pointer-events-none z-[30]"
          style={{
            left: Math.min(selectionBox.startPageX, selectionBox.currentPageX) - window.scrollX,
            top: Math.min(selectionBox.startPageY, selectionBox.currentPageY) - window.scrollY,
            width: Math.abs(selectionBox.currentPageX - selectionBox.startPageX),
            height: Math.abs(selectionBox.currentPageY - selectionBox.startPageY),
          }}
        />
      )}
    </div>
  )
}
