import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { Select } from '@/shared/components/ui/select'
import { resolveAnalyticsDelta, type AnalyticsDelta } from '@/features/analytics/analytics-delta'
import { ANALYTICS_PERIOD_DAYS, type AnalyticsPeriodDays } from '@/shared/lib/analytics-range'
import {
  ANALYTICS_PROPOSAL_ISSUE,
  type AnalyticsCheckInSeries,
  type AnalyticsSummary,
} from '@/shared/schemas/analytics'

export interface AnalyticsViewProps {
  summary: AnalyticsSummary
  series: AnalyticsCheckInSeries
  period: AnalyticsPeriodDays
  onPeriodChange: (period: AnalyticsPeriodDays) => void
  /** `true` mientras llega el período recién elegido y la pantalla muestra el anterior. */
  isRefreshing: boolean
}

/**
 * Insignia de variación. Sin `delta` no se renderiza nada visible más que el
 * texto para lector de pantalla: cuando el período previo fue 0 no hay
 * variación que mostrar (ver `resolveAnalyticsDelta`), y un «—» al lado del
 * número se lee como un dato faltante y no como «no aplica».
 */
function DeltaBadge({ delta }: { delta: AnalyticsDelta | null }) {
  const { t } = useTranslation('analytics')

  if (!delta) return <span className="sr-only">{t('delta.none')}</span>

  const tone =
    delta.direction === 'up'
      ? 'text-teal'
      : delta.direction === 'down'
        ? 'text-alert'
        : 'text-muted'

  return (
    <span className={`font-sans text-xs font-bold ${tone}`}>
      {t(`delta.${delta.direction}`, { percent: delta.percent })}
    </span>
  )
}

function MetricCard({
  label,
  hint,
  value,
  delta,
}: {
  label: string
  hint: string
  value: string
  delta: AnalyticsDelta | null
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-display text-lg font-bold text-ink">{value}</span>
      <DeltaBadge delta={delta} />
      <span className="font-sans text-xs text-muted">{hint}</span>
    </Card>
  )
}

/**
 * Pantalla de analytics (B-05) — vista presentacional pura: recibe datos ya
 * resueltos y no sabe de react-query ni de fetching, mismo reparto que
 * `places-view.tsx`.
 *
 * ⚠️ **El aviso de propuesta se renderiza en pantalla, no solo en comentarios.**
 * Todo este contrato es una propuesta sin backend (`Renata-S-A-S/geoquest#205`),
 * y quien mire la demo tiene que saberlo sin leer el código: un dashboard con
 * números plausibles es exactamente lo que se confunde con un dashboard real.
 *
 * **Sin librería de gráficos, a propósito.** No hay ninguna en `package.json` y
 * no se agrega: la serie se dibuja como tabla más barras CSS. El precedente del
 * repo es explícito — `mapbox-gl` tuvo que terminar lazy-loaded Y excluido del
 * precache del service worker por su peso. Sumar recharts o chart.js por una
 * sola serie de una pantalla contra un endpoint que todavía no existe sería
 * pagar ese costo por adelantado. La tabla además es accesible sin trabajo
 * extra: cada día es una fila con su número, y la barra es decorativa.
 */
export function AnalyticsView({
  summary,
  series,
  period,
  onPeriodChange,
  isRefreshing,
}: AnalyticsViewProps) {
  const { t } = useTranslation('analytics')
  const { current, previous } = summary

  const periodOptions = ANALYTICS_PERIOD_DAYS.map((days) => ({
    value: String(days),
    label: t(`period.options.${days}`),
  }))

  // Escala de las barras. El `|| 1` evita dividir por cero cuando el período no
  // tuvo ningún check-in — sin él, todas las barras saldrían `NaN%`.
  const maxCheckIns = Math.max(...series.points.map((point) => point.checkIns), 0) || 1
  const hasCheckIns = series.points.some((point) => point.checkIns > 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-lg font-bold text-ink">{t('title')}</h1>
          <p className="font-sans text-xs text-muted">
            {t('period.range', { from: summary.from, to: summary.to })}
          </p>
        </div>
        <div className="flex items-end gap-3">
          {isRefreshing && (
            <span role="status" className="font-sans text-xs text-muted">
              {t('refreshing')}
            </span>
          )}
          <Select
            className="w-52"
            label={t('period.label')}
            options={periodOptions}
            value={String(period)}
            onChange={(value) => onPeriodChange(Number(value) as AnalyticsPeriodDays)}
          />
        </div>
      </div>

      <p
        role="note"
        className="rounded-md border border-border bg-surface-mint px-3 py-2 font-sans text-xs text-ink"
      >
        {t('proposal.notice', { issue: ANALYTICS_PROPOSAL_ISSUE })}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('metrics.checkIns.label')}
          hint={t('metrics.checkIns.hint')}
          value={String(current.checkIns)}
          delta={resolveAnalyticsDelta(current.checkIns, previous.checkIns)}
        />
        <MetricCard
          label={t('metrics.uniqueVisitors.label')}
          hint={t('metrics.uniqueVisitors.hint')}
          value={String(current.uniqueVisitors)}
          delta={resolveAnalyticsDelta(current.uniqueVisitors, previous.uniqueVisitors)}
        />
        <MetricCard
          label={t('metrics.redemptions.label')}
          hint={t('metrics.redemptions.hint')}
          value={String(current.redemptions)}
          delta={resolveAnalyticsDelta(current.redemptions, previous.redemptions)}
        />
        <MetricCard
          label={t('metrics.estimatedValue.label')}
          hint={t('metrics.estimatedValue.hint')}
          value={t('metrics.estimatedValue.value', { value: current.estimatedValueDeliveredCop })}
          delta={resolveAnalyticsDelta(
            current.estimatedValueDeliveredCop,
            previous.estimatedValueDeliveredCop
          )}
        />
        <MetricCard
          label={t('metrics.rating.label')}
          hint={t('metrics.rating.hint')}
          // `null` no se dibuja como 0: RN-REW-07 hace la calificación
          // opcional, así que «sin calificaciones» y «calificaron con 0» son
          // estados distintos y 0 ni siquiera existe en la escala 1–5.
          value={
            current.averageExperienceRating === null
              ? t('metrics.rating.empty')
              : t('metrics.rating.value', {
                  rating: current.averageExperienceRating.toFixed(1),
                })
          }
          delta={
            current.averageExperienceRating === null || previous.averageExperienceRating === null
              ? null
              : resolveAnalyticsDelta(
                  current.averageExperienceRating,
                  previous.averageExperienceRating
                )
          }
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-bold text-ink">{t('series.title')}</h2>
        {hasCheckIns ? (
          <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-surface-raised">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                    {t('series.columns.date')}
                  </th>
                  <th className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                    {t('series.columns.checkIns')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.points.map((point) => (
                  <tr key={point.date} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2 font-sans text-xs font-normal text-muted">
                      {point.date}
                    </th>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {/*
                         * Barra decorativa: `aria-hidden` porque el número de al
                         * lado ya dice lo mismo, y un `div` con ancho porcentual
                         * no aporta nada a un lector de pantalla.
                         */}
                        <div
                          aria-hidden="true"
                          className="h-2 w-32 shrink-0 overflow-hidden rounded-xs bg-paper"
                        >
                          <div
                            className="h-full rounded-xs bg-teal"
                            style={{ width: `${(point.checkIns / maxCheckIns) * 100}%` }}
                          />
                        </div>
                        <span className="font-sans text-sm text-ink">{point.checkIns}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-sans text-xs text-muted">{t('series.empty')}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-bold text-ink">{t('places.title')}</h2>
        {summary.places.length > 0 ? (
          <div className="rounded-md border border-border bg-surface-raised">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                    {t('places.columns.name')}
                  </th>
                  <th className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                    {t('places.columns.checkIns')}
                  </th>
                  <th className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                    {t('places.columns.uniqueVisitors')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.places.map((place) => (
                  <tr key={place.placeId} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2 font-sans text-sm font-normal text-ink">
                      {place.name}
                    </th>
                    <td className="px-4 py-2 font-sans text-sm text-ink">{place.checkIns}</td>
                    <td className="px-4 py-2 font-sans text-sm text-ink">{place.uniqueVisitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-sans text-xs text-muted">{t('places.empty')}</p>
        )}
      </section>
    </div>
  )
}
