import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '@/shared/hooks/use-session'

/**
 * Envuelve el árbol autenticado del portal. Lee sesión vía `useSession()`
 * (SessionPort), nunca un store concreto — mismo espíritu que
 * `ProtectedRoute` de geoquest-web, pero desacoplado del mecanismo de auth.
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useSession()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
