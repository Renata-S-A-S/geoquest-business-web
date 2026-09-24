import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { ProtectedRoute } from './protected-route'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/onboarding/register-page'
import { PendingStatusPage } from '@/features/onboarding/pending-page'
import { BusinessProfilePage } from '@/features/business/business-profile-page'
import { PlacesPage } from '@/features/places/places-page'
import { RewardsPage } from '@/features/rewards/rewards-page'
import { RedemptionsPage } from '@/features/redemptions/redemptions-page'
import { AnalyticsPage } from '@/features/analytics/analytics-page'
import { FeatureErrorBoundary } from '@/shared/components/feature-error-boundary'

/**
 * `/login` es hermana del árbol con AppShell — un staff sin sesión no debe
 * ver el sidebar, y `/login` debe ser alcanzable sin importar el estado de
 * auth (mismo criterio que geoquest-web). `/` redirige a `/analytics`
 * (B-05), el landing natural del portal — no hay pantalla de "inicio"
 * separada en los flujos B-0X de Confluence.
 *
 * Cada página va envuelta en su propio `FeatureErrorBoundary`: un error en
 * Recompensas no debería tumbar el resto del portal.
 *
 * `/registro` y `/registro/pendiente` (B-01, #21) son hermanas de `/login`
 * por el mismo motivo: un negocio registrándose no tiene sesión todavía, así
 * que no pueden vivir dentro de `ProtectedRoute`. No son lo mismo que
 * `/negocio` (`BusinessProfilePage`, más abajo) — esa es la vista
 * autenticada de "mi negocio" post-login (#72), no el alta inicial.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/registro',
    element: (
      <FeatureErrorBoundary featureName="Registro">
        <RegisterPage />
      </FeatureErrorBoundary>
    ),
  },
  {
    path: '/registro/pendiente',
    element: (
      <FeatureErrorBoundary featureName="Registro">
        <PendingStatusPage />
      </FeatureErrorBoundary>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/analytics" replace /> },
          {
            path: '/negocio',
            element: (
              <FeatureErrorBoundary featureName="Negocio">
                <BusinessProfilePage />
              </FeatureErrorBoundary>
            ),
          },
          {
            path: '/lugares',
            element: (
              <FeatureErrorBoundary featureName="Lugares">
                <PlacesPage />
              </FeatureErrorBoundary>
            ),
          },
          {
            path: '/recompensas',
            element: (
              <FeatureErrorBoundary featureName="Recompensas">
                <RewardsPage />
              </FeatureErrorBoundary>
            ),
          },
          {
            path: '/canjes',
            element: (
              <FeatureErrorBoundary featureName="Validar canje">
                <RedemptionsPage />
              </FeatureErrorBoundary>
            ),
          },
          {
            path: '/analytics',
            element: (
              <FeatureErrorBoundary featureName="Analytics">
                <AnalyticsPage />
              </FeatureErrorBoundary>
            ),
          },
        ],
      },
    ],
  },
])
