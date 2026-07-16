import { useSyncExternalStore } from 'react'
import { getSessionSnapshot, subscribeSession, type AuthUser, type SessionStatus } from './session'

export function useAuth(): { authed: boolean; user: AuthUser | null; status: SessionStatus } {
  const value = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot)
  return { authed: value.status === 'authenticated', user: value.user, status: value.status }
}
