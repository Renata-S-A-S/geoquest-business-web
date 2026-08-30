import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { ProtectedRoute } from './protected-route'
import { LoginPage } from '@/features/auth/login-page'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
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
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
                <OnboardingPage />
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
