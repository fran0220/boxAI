import { useRef, useSyncExternalStore } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/use-auth'
import { getLogoutEpoch, subscribeLogout } from '@/lib/session'
import { Spinner } from '@/components/ui/Spinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { status } = useAuth()
  const initialLogoutEpoch = useRef(getLogoutEpoch()).current
  const currentLogoutEpoch = useSyncExternalStore(subscribeLogout, getLogoutEpoch, getLogoutEpoch)
  if (status === 'bootstrapping') {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>
  }
  if (status !== 'authenticated') {
    if (currentLogoutEpoch !== initialLogoutEpoch) return <Navigate to="/" replace />
    return (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    )
  }
  return <>{children}</>
}
