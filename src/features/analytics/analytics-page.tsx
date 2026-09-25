import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { ActionLink } from '@/shared/components/ui/action-link'
import { StatusBadge } from '@/shared/components/ui/status-badge'
import { useBusinessMe } from '@/features/business/queries'
import { useAnalyticsCheckIns, useAnalyticsSummary } from '@/features/analytics/queries'
import { AnalyticsView } from '@/features/analytics/analytics-view'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useBackendCapabilities } from '@/shared/lib/backend-capabilities'
import {
  DEFAULT_ANALYTICS_PERIOD_DAYS,
  resolveAnalyticsRange,
  type AnalyticsPeriodDays,
} from '@/shared/lib/analytics-range'

/**
 * Landing "Próximamente" — real-backend-readiness, design-amendments (engram
 * #1550, punto 1): analytics NO se borra (a diferencia del design original,
 * que sacaba el dashboard entero, ~2300 líneas). El dashboard, su API, sus
 * mocks y sus tests quedan intactos para cuando `Renata-S-A-S/geoquest#205`
 * exista — acá solo se lo oculta detrás de `capabilities.analytics`.
 *
 * Presentational y sin queries propias a propósito: el gate de
 * `AnalyticsPage` corta ANTES de montar `useBusinessMe()`/`useAnalyticsSummary()`/
 * `useAnalyticsCheckIns()`, así que ningún fetch de analytics ni de negocio
 * se dispara en modo real (spec `analytics-landing`, escenario "Visit
 * landing" — "no analytics fetch occurs").
 */
function AnalyticsComingSoon() {
  const { t } = useTranslation('analytics')

  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-6 text-center">
      <StatusBadge
        status="comingSoon"
        variantMap={{ comingSoon: 'neutral' }}
        label={t('comingSoon.badge')}
      />
      <h1 className="font-display text-lg font-bold text-ink">{t('comingSoon.title')}</h1>
      <p className="max-w-sm font-sans text-sm text-muted">{t('comingSoon.description')}</p>
      <div className="flex items-center gap-4">
        <ActionLink to="/lugares">{t('comingSoon.links.places')}</ActionLink>
        <ActionLink to="/recompensas">{t('comingSoon.links.rewards')}</ActionLink>
      </div>
    </div>
  )
}

/**
 * B-05 — Dashboard de analytics del negocio. Reemplaza el `RoutePlaceholder`
 * que ocupaba esta ruta, que además es el destino del redirect de `/`.
 *
 * ⚠️ **Toda la pantalla corre contra endpoints PROPUESTOS que no existen** —
 * `Renata-S-A-S/geoquest#205`. Los sirve MSW; el aviso también se renderiza en
 * pantalla (ver `AnalyticsView`).
 *
 * Contenedor: el fork pendiente/error/éxito vive acá y `AnalyticsView` recibe
 * solo datos ya resueltos, mismo reparto que `places-page.tsx`.
 *
 * ⚠️ **Cascada de tres etapas, declarada y no escondida — es el costo real de
 * una transición en curso, no un descuido de diseño.** Registrado en
 * `Renata-S-A-S/geoquest#191`.
 *
 * Los dos endpoints propuestos llevan `{businessId}` en el path, que es la
 * convención del backend real y hacia donde va el portal. Pero el portal todavía
 * convive con la convención vieja, donde el negocio se resuelve desde la sesión
 * y el cliente nunca manda un id (`GET /business/places`, `GET /portal/rewards`
 * — ver `get-places.ts` y `api/get-analytics-summary.ts`). Mientras dure esa
 * mezcla, una pantalla de la convención nueva no tiene el id a mano y tiene que
 * ir a buscarlo: `useBusinessMe()` lee `GET /business/me`, que devuelve UN
 * `Business`, y de ahí sale `business.id`.
 *
 * Resultado: negocio → resumen + serie, tres estados de carga en cascada en vez
 * de uno. No se disimula con un spinner único ni se adivina el id; se hace
 * explícita acá, con su propio fork de error, porque es un costo medible de la
 * transición y desaparece sola cuando el portal termine de migrar.
 *
 * El error del negocio se distingue del error de las métricas a propósito: «no
 * pudimos identificar tu negocio» y «no pudimos cargar tus métricas» mandan a
 * revisar cosas distintas, y colapsarlos en un genérico haría que el negocio
 * reintentara lo que no falló.
 *
 * Extraído a un componente separado (`AnalyticsDashboard`) en vez de un
 * `if` temprano dentro de `AnalyticsPage` (real-backend-readiness PR5): un
 * early return ANTES de `useState`/`useBusinessMe`/etc. violaría las reglas
 * de hooks (cantidad de hooks distinta entre el render "Próximamente" y el
 * render del dashboard). Montar un componente hijo distinto según la
 * capacidad sí es válido — React nunca intenta reconciliar los hooks de un
 * componente con los del otro.
 */
function AnalyticsDashboard() {
  const { t } = useTranslation('analytics')
  const [period, setPeriod] = useState<AnalyticsPeriodDays>(DEFAULT_ANALYTICS_PERIOD_DAYS)

  // `useMemo` sobre el período y NO sobre cada render: `resolveAnalyticsRange`
  // llama a `new Date()`, así que sin memo devolvería un objeto nuevo en cada
  // render y las queryKeys de react-query cambiarían de identidad sin que la
  // pregunta haya cambiado.
  const range = useMemo(() => resolveAnalyticsRange(period), [period])

  const businessQuery = useBusinessMe()
  const businessId = businessQuery.data?.id
  const summaryQuery = useAnalyticsSummary(businessId, range)
  const checkInsQuery = useAnalyticsCheckIns(businessId, range)

  if (businessQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(businessQuery.error, t('errors.business'))}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  if (summaryQuery.isError || checkInsQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(summaryQuery.error ?? checkInsQuery.error, t('errors.generic'))}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            void summaryQuery.refetch()
            void checkInsQuery.refetch()
          }}
        >
          {t('retry')}
        </Button>
      </div>
    )
  }

  // Una sola rama de carga para las tres consultas: mostrar la pantalla con
  // tarjetas resueltas y la serie todavía vacía haría parecer que no hubo
  // check-ins en el período, que es un dato falso y no un estado intermedio.
  if (!summaryQuery.data || !checkInsQuery.data) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('loading')}</p>
      </div>
    )
  }

  return (
    <AnalyticsView
      summary={summaryQuery.data}
      series={checkInsQuery.data}
      period={period}
      onPeriodChange={setPeriod}
      // `isPlaceholderData` y no `isFetching`: solo es «actualizando» cuando lo
      // que se está viendo pertenece al período anterior. Un refetch en
      // background del mismo período no cambia nada en pantalla, así que
      // anunciarlo sería ruido.
      isRefreshing={summaryQuery.isPlaceholderData || checkInsQuery.isPlaceholderData}
    />
  )
}

/**
 * Punto de entrada de la ruta `/analytics` — gatea entre el "Próximamente"
 * (real-backend-readiness PR5, `capabilities.analytics === false`) y el
 * dashboard mock existente, que queda intacto (design-amendments #1550: la
 * analítica NO se borra, solo se oculta detrás de la capacidad).
 */
export function AnalyticsPage() {
  const capabilities = useBackendCapabilities()

  if (!capabilities.analytics) {
    return <AnalyticsComingSoon />
  }

  return <AnalyticsDashboard />
}
