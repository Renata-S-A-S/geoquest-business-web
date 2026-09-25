import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { ProtectedRoute } from './protected-route'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/onboarding/register-page'
import { PendingStatusPage } from '@/features/onboarding/pending-page'
import { BusinessProfilePage } from '@/features/business/business-profile-page'
import { BusinessProfileEditPage } from '@/features/business/business-profile-edit-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { PlacesPage } from '@/features/places/places-page'
import { CreatePlacePage } from '@/features/places/create-place-page'
import { PlaceDetailPage } from '@/features/places/place-detail-page'
import { RoutePlaceholder } from '@/app/route-placeholder'
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
            /*
             * `/negocio/editar` (#72, PR5) — hermana de `/negocio`, no un
             * modo dentro de la misma página (mismo criterio que
             * `/registro`/`/registro/pendiente`): le da a `navigate` un
             * destino real tras guardar y mantiene el fork
             * pending/error/no-Owner/form de `BusinessProfileEditPage`
             * simple, en un solo lugar (decisión D4).
             */
            path: '/negocio/editar',
            element: (
              <FeatureErrorBoundary featureName="Negocio">
                <BusinessProfileEditPage />
              </FeatureErrorBoundary>
            ),
          },
          {
            /*
             * `/configuracion` (#72, PR6) — pantalla de cuenta a nivel de
             * sesión (username, correo de acceso, tema), no un flujo de
             * negocio B-0X. Por eso NO está en `NAV_ITEMS` (mismo criterio
             * que el logout, issue #70): ya es alcanzable en cualquier
             * viewport desde el link que `AccountMenu` agrega, sin sumar
             * un sexto ítem a `BottomNav`/`SidebarNav`.
             */
            path: '/configuracion',
            element: (
              <FeatureErrorBoundary featureName="Configuración">
                <SettingsPage />
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
            /*
             * `/lugares/nuevo` (#29) — hermana de `/lugares`, mismo criterio
             * que `/negocio/editar`. Se registra acá contra el placeholder
             * y no junto al formulario (#30/#33) por una razón concreta: el
             * CTA «Crear lugar» es criterio de aceptación de #29, así que
             * sin esta ruta el listado mergearía con un link muerto. El
             * formulario reemplaza este placeholder, no agrega la ruta.
             */
            path: '/lugares/nuevo',
            element: (
              <FeatureErrorBoundary featureName="Lugares">
                <CreatePlacePage />
              </FeatureErrorBoundary>
            ),
          },
          {
            /*
             * `/lugares/:placeId` (#35) — va DESPUÉS de `/lugares/nuevo` a
             * propósito. React Router v6 ordena por especificidad y no por
             * declaración, así que el orden no cambia el resultado, pero
             * leerlo en este orden evita que alguien lo mueva creyendo que
             * `nuevo` cae en el parámetro.
             */
            path: '/lugares/:placeId',
            element: (
              <FeatureErrorBoundary featureName="Lugares">
                <PlaceDetailPage />
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
            /*
             * `/recompensas/nueva` (#36) — hermana de `/recompensas`, mismo
             * criterio que `/lugares/nuevo`. Se registra acá contra el
             * placeholder porque el CTA «Crear recompensa» es criterio de
             * aceptación de #36: sin esta ruta el listado mergearía con un
             * link muerto. El formulario reemplaza el placeholder.
             *
             * ⚠️ Ese formulario está parcialmente bloqueado: #37 (tipo), #39
             * (General/Special) y #42 (Términos propios) son campos que NO
             * existen en el backend. Ver `Renata-S-A-S/geoquest#191`.
             */
            path: '/recompensas/nueva',
            element: (
              <FeatureErrorBoundary featureName="Recompensas">
                <RoutePlaceholder label="crear recompensa — pendiente (#37-#42)" />
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
