import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { UserRole } from '@/types'
import { ROUTES } from '@/app/routes'

interface RequireAuthProps {
  children: React.ReactNode
  roles?: UserRole[]
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <p role="status" className="p-8 text-center text-text-secondary">Loading account...</p>
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} state={{ from: location }} replace />
  }

  if (user?.mustChangePassword && location.pathname !== ROUTES.changePassword) return <Navigate to={ROUTES.changePassword} replace />

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={ROUTES.liveMonitoring} replace />
  }

  return <>{children}</>
}
