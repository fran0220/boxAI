import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/use-auth'
import { Spinner } from '@/components/ui/Spinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { status } = useAuth()
  if (status === 'bootstrapping') {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>
  }
  if (status !== 'authenticated') {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    )
  }
  return <>{children}</>
}
