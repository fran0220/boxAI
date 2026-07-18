import { lazy, Suspense, useEffect } from 'react'
import { initStore } from './store'
import { useStore } from './store'
import { activateFirstImportedProfile, buildSettingsFromUrlParams, clearUrlSettingParams, hasUrlSettingParams } from './lib/urlSettings'
import { isDefaultConfigOnlyEnabled, mergeImportedSettings } from './lib/apiProfiles'
import { getCustomProviderConfigUrl, loadCustomProviderSettingsFromUrl } from './lib/customProviderConfigUrl'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import type { AppSettings } from './types'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import ImageContextMenu from './components/ImageContextMenu'
import CreateShellToolbar from './components/CreateShellToolbar'
import { FavoriteCollectionsView } from './components/favorites/FavoriteCollectionsView'
import { useGlobalClickSuppression } from './lib/clickSuppression'
import { useIsCreateShell } from './shellContext'

const AgentWorkspace = lazy(() => import('./components/AgentWorkspace'))
const DetailModal = lazy(() => import('./components/DetailModal'))
const Lightbox = lazy(() => import('./components/Lightbox'))
const MaskEditorModal = lazy(() => import('./components/MaskEditorModal'))
const SupportPromptModal = lazy(() => import('./components/SupportPromptModal'))
const FavoriteCollectionPickerModal = lazy(() =>
  import('./components/favorites/FavoriteCollectionPickerModal').then((m) => ({
    default: m.FavoriteCollectionPickerModal,
  })),
)
const ManageCollectionsModal = lazy(() =>
  import('./components/favorites/ManageCollectionsModal').then((m) => ({
    default: m.ManageCollectionsModal,
  })),
)

let customProviderConfigUrlImportStarted = false

export default function App() {
  const setSettings = useStore((s) => s.setSettings)
  const appMode = useStore((s) => s.appMode)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeFavoriteCollectionId)
  const detailTaskId = useStore((s) => s.detailTaskId)
  const lightboxImageId = useStore((s) => s.lightboxImageId)
  const maskEditorImageId = useStore((s) => s.maskEditorImageId)
  const supportPromptOpen = useStore((s) => s.supportPromptOpen)
  const favoritePickerTaskIds = useStore((s) => s.favoritePickerTaskIds)
  const isManageCollectionsModalOpen = useStore((s) => s.isManageCollectionsModalOpen)
  const isCreateShell = useIsCreateShell()
  useDockerApiUrlMigrationNotice()
  useGlobalClickSuppression()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const customProviderConfigUrl = getCustomProviderConfigUrl()
    const defaultConfigOnly = isDefaultConfigOnlyEnabled()

    const applyUrlSettings = (baseSettings: Partial<AppSettings>) => {
      const nextSettings = buildSettingsFromUrlParams(baseSettings, searchParams)
      return Object.keys(nextSettings).length ? nextSettings : baseSettings
    }

    const clearAppliedUrlSettings = () => {
      if (!hasUrlSettingParams(searchParams)) return

      clearUrlSettingParams(searchParams)

      const nextSearch = searchParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }

    if (customProviderConfigUrl && defaultConfigOnly && !customProviderConfigUrlImportStarted) {
      customProviderConfigUrlImportStarted = true
      void loadCustomProviderSettingsFromUrl(customProviderConfigUrl)
        .then((importedSettings) => {
          const state = useStore.getState()
          const baseSettings = importedSettings
            ? activateFirstImportedProfile(mergeImportedSettings(state.settings, importedSettings), importedSettings)
            : state.settings
          state.setSettings(applyUrlSettings(baseSettings))
          clearAppliedUrlSettings()
        })
        .catch((error) => {
          console.warn('Failed to import custom provider config URL:', error)
          const state = useStore.getState()
          state.setSettings(applyUrlSettings(state.settings))
          clearAppliedUrlSettings()
        })

      initStore()
      return
    }

    const nextSettings = buildSettingsFromUrlParams(useStore.getState().settings, searchParams)

    setSettings(nextSettings)

    clearAppliedUrlSettings()

    if (customProviderConfigUrl && !customProviderConfigUrlImportStarted) {
      customProviderConfigUrlImportStarted = true
      void loadCustomProviderSettingsFromUrl(customProviderConfigUrl)
        .then((importedSettings) => {
          if (!importedSettings) return
          const state = useStore.getState()
          state.setSettings(mergeImportedSettings(state.settings, importedSettings))
        })
        .catch((error) => {
          console.warn('Failed to import custom provider config URL:', error)
        })
    }

    initStore()
  }, [setSettings])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  const modals = (
    <>
      <Suspense fallback={null}>
        {detailTaskId ? <DetailModal /> : null}
        {lightboxImageId ? <Lightbox /> : null}
        {maskEditorImageId ? <MaskEditorModal /> : null}
        {supportPromptOpen ? <SupportPromptModal /> : null}
        {favoritePickerTaskIds?.length ? <FavoriteCollectionPickerModal /> : null}
        {isManageCollectionsModalOpen ? <ManageCollectionsModal /> : null}
      </Suspense>
      <ConfirmDialog />
      <Toast />
      <ImageContextMenu />
    </>
  )

  // Create workspace shell: design toolbar + 5-col gallery + floating composer
  if (isCreateShell) {
    return (
      <>
        <CreateShellToolbar />
        {appMode === 'agent' ? (
          <Suspense fallback={null}>
            <AgentWorkspace />
          </Suspense>
        ) : (
          <main
            data-home-main
            data-drag-select-surface
            className="bx-create-image-gallery"
          >
            {filterFavorite && !activeFavoriteCollectionId ? (
              <FavoriteCollectionsView />
            ) : (
              <TaskGrid />
            )}
          </main>
        )}
        <InputBar />
        {modals}
      </>
    )
  }

  return (
    <>
      <Header />
      {appMode === 'agent' ? (
        <Suspense fallback={null}>
          <AgentWorkspace />
        </Suspense>
      ) : (
        <main data-home-main data-drag-select-surface className="pb-48">
          <div className="safe-area-x max-w-7xl mx-auto">
            <SearchBar />
            {filterFavorite && !activeFavoriteCollectionId ? <FavoriteCollectionsView /> : <TaskGrid />}
          </div>
        </main>
      )}
      <InputBar />
      {modals}
    </>
  )
}
