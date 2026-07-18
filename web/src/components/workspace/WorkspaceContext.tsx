import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getProfile, getPublicSettings, type UserProfile } from '@/lib/customer-api'
import { useAuth } from '@/lib/use-auth'
import {
  deriveWorkspaceCapabilities,
  isUsableRemoteUrl,
  type WorkspaceCapabilities,
} from '@/lib/workspace-navigation'

export interface WorkspaceCustomMenuItem {
  id: string
  label: string
  url: string
  page_slug?: string
  visibility?: string
  sort_order?: number
}

interface WorkspaceContextValue {
  capabilities: WorkspaceCapabilities
  customMenuItems: WorkspaceCustomMenuItem[]
  profile: UserProfile | null
  publicSettings: Record<string, unknown> | null
  remoteUrl: string | null
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function configuredRemoteUrl(): string | null {
  const value = (import.meta.env.VITE_AGENT_REMOTE_URL as string | undefined)?.trim()
  return isUsableRemoteUrl(value) ? value!.replace(/\/+$/, '') : null
}

function parseCustomMenuItems(settings: Record<string, unknown> | null): WorkspaceCustomMenuItem[] {
  const raw = settings?.custom_menu_items
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is WorkspaceCustomMenuItem => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Partial<WorkspaceCustomMenuItem>
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.label === 'string' &&
        typeof candidate.url === 'string' &&
        (!candidate.visibility || candidate.visibility === 'user')
      )
    })
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth()
  const [publicSettings, setPublicSettings] = useState<Record<string, unknown> | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const remoteUrl = configuredRemoteUrl()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [settingsResult, profileResult] = await Promise.allSettled([
        getPublicSettings(),
        getProfile(),
      ])
      if (cancelled) return
      if (settingsResult.status === 'fulfilled') setPublicSettings(settingsResult.value)
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const capabilities = useMemo(
    () => deriveWorkspaceCapabilities({ authenticated: authed, publicSettings, remoteUrl }),
    [authed, publicSettings, remoteUrl],
  )
  const customMenuItems = useMemo(
    () => parseCustomMenuItems(publicSettings),
    [publicSettings],
  )
  const value = useMemo<WorkspaceContextValue>(
    () => ({ capabilities, customMenuItems, profile, publicSettings, remoteUrl, loading }),
    [capabilities, customMenuItems, profile, publicSettings, remoteUrl, loading],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return context
}
