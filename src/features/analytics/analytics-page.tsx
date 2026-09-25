import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useBusinessMe } from '@/features/business/queries'
import { useAnalyticsCheckIns, useAnalyticsSummary } from '@/features/analytics/queries'
import { AnalyticsView } from '@/features/analytics/analytics-view'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import {
  DEFAULT_ANALYTICS_PERIOD_DAYS,
  resolveAnalyticsRange,
  type AnalyticsPeriodDays,
} from '@/shared/lib/analytics-range'

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
 * ⚠️ **Dependencia encadenada, declarada y no escondida.** Los dos endpoints
 * propuestos llevan `{businessId}` en el path, y el portal no tiene ese id a
 * mano: lo resuelve leyendo `GET /business/me` vía `useBusinessMe()`, que
 * devuelve UN `Business` y del que se toma `business.id`. Eso hace que esta
 * pantalla tenga tres estados de carga en cascada en vez de uno, y es una razón
 * concreta para que la propuesta de `#205` se alinee con la convención del resto
 * del portal (el backend resuelve el negocio desde la sesión vía
 * `BusinessMembershipRef` y el cliente nunca manda un id — ver
 * `get-places.ts`). Mientras el path lo exija, la cascada se hace explícita acá.
 *
 * El error del negocio se distingue del error de las métricas a propósito: «no
 * pudimos identificar tu negocio» y «no pudimos cargar tus métricas» mandan a
 * revisar cosas distintas, y colapsarlos en un genérico haría que el negocio
 * reintentara lo que no falló.
 */
export function AnalyticsPage() {
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
