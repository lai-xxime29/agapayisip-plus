import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Wrap routes that need a signed-in user. Pass allowedRoles to restrict by role.
export default function ProtectedRoute({ allowedRoles }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="p-6">Loading…</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
