import { useSyncExternalStore } from 'react'
import { AUTH_CHANGED_EVENT, getAccessToken, getUser, type AuthUser } from './storage'

function subscribe(callback: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function snapshot(): string {
  return getAccessToken() || ''
}

export function useAuth(): { authed: boolean; user: AuthUser | null } {
  const token = useSyncExternalStore(subscribe, snapshot, () => '')
  return { authed: !!token, user: token ? getUser() : null }
}
