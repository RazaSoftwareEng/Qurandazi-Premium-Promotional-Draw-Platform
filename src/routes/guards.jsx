import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

/**
 * Client-side route protection (UX only). Real authorization is enforced
 * in the database via RLS and SECURITY DEFINER functions.
 */
export function ProtectedRoute({ roles }) {
  const { loading, isAuthenticated, role } = useAuth()
  const location = useLocation()
  if (loading || (isAuthenticated && role === null)) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(role)) return <Navigate to={role === 'user' ? '/dashboard' : '/'} replace />
  return <Outlet />
}

/** Users only (staff are redirected to the admin console). */
export function UserRoute() {
  const { loading, isAuthenticated, isAdmin, role } = useAuth()
  const location = useLocation()
  if (loading || (isAuthenticated && role === null)) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (isAdmin) return <Navigate to="/admin" replace />
  return <Outlet />
}

export function GuestRoute() {
  const { loading, isAuthenticated, isAdmin, role, recovery } = useAuth()
  if (loading) return <Spinner />
  if (isAuthenticated && !recovery && role !== null) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />
  return <Outlet />
}
