import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type ColumnDef } from '@/shared/components/ui/data-table'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import type { BusinessPlaceSummary, BusinessPlaceStatus } from '@/shared/schemas/business-place'

/**
 * Mapa de estado a variante visual, a nivel de módulo igual que
 * `BUSINESS_STATUS_VARIANT` en `business-profile-view.tsx`. Tiparlo como
 * `Record<BusinessPlaceStatus, ...>` hace que agregar un estado al schema
 * sin decidir su color rompa la compilación, en vez de caer al 'neutral'
 * por defecto de `StatusBadge` sin que nadie se entere.
 *
 * `Deleted` está acá porque el backend puede devolverlo: ningún
 * repositorio filtra por estado.
 */
const PLACE_STATUS_VARIANT: Record<BusinessPlaceStatus, StatusBadgeVariant> = {
  Draft: 'neutral',
  Active: 'success',
  Paused: 'warning',
  Deleted: 'error',
}

export interface PlacesViewProps {
  places: BusinessPlaceSummary[]
}

/**
 * Listado de lugares del negocio (#29, B-02). Primer consumidor real de
 * `DataTable` (#17), que hasta ahora solo tenía su propio test.
 *
 * Columnas: nombre, categoría, estado y GeoPoints. Todas salen del
 * **resumen** que devuelve `GET /business/places` — la lista trae 7 campos,
 * no el detalle.
 *
 * ⚠️ Las columnas anteriores de check-ins y radio se retiraron: `totalCheckIns`
 * **no existe en ningún DTO del backend** (era invención del portal) y
 * `checkInRadiusMeters` solo viene en el detalle. Ver
 * `Renata-S-A-S/geoquest#191`.
 *
 * La categoría sí se muestra ahora: la taxonomía está confirmada
 * (`taxonomy.ts`, RN-TAX-01) y viaja como entero, así que se traduce por
 * su valor numérico.
 *
 * El CTA del encabezado NO es redundante con el del estado vacío: sin él,
 * un negocio que ya tiene un lugar no tendría por dónde crear el segundo.
 */
export function PlacesView({ places }: PlacesViewProps) {
  const { t } = useTranslation('places')

  const columns: ColumnDef<BusinessPlaceSummary>[] = [
    {
      key: 'name',
      header: t('list.columns.name'),
      // El nombre es la entrada al detalle (#35). Sin esto el listado sería
      // un cul-de-sac: se ve el estado pero no hay cómo actuar sobre él.
      render: (place) => (
        <Link
          to={`/lugares/${place.placeId}`}
          className="font-sans font-bold text-teal hover:underline"
        >
          {place.name}
        </Link>
      ),
    },
    {
      key: 'category',
      header: t('list.columns.category'),
      render: (place) => t(`taxonomy.categories.${place.category}`),
    },
    {
      key: 'status',
      header: t('list.columns.status'),
      // `DataTable` auto-renderiza la columna de `statusField` como
      // `StatusBadge` SIN `label`, o sea que mostraría el literal del enum
      // (`Draft`) en una interfaz en español. Este `render` es lo que lo
      // traduce.
      render: (place) => (
        <StatusBadge
          status={place.status}
          variantMap={PLACE_STATUS_VARIANT}
          label={t(`list.status.${place.status}`)}
        />
      ),
    },
    {
      key: 'geoPointsReward',
      header: t('list.columns.geoPointsReward'),
      render: (place) => t('list.geoPointsValue', { points: place.geoPointsReward }),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-ink">{t('list.title')}</h1>
        <Link
          to="/lugares/nuevo"
          className="font-sans text-xs font-bold text-teal hover:underline"
        >
          {t('list.createCta')}
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={places}
        statusField="status"
        statusVariantMap={PLACE_STATUS_VARIANT}
        getRowId={(place) => place.placeId}
        emptyState={
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
            <span className="font-sans text-sm font-bold text-ink">{t('list.empty.title')}</span>
            <p className="font-sans text-xs text-muted">{t('list.empty.description')}</p>
            <Link
              to="/lugares/nuevo"
              className="font-sans text-xs font-bold text-teal hover:underline"
            >
              {t('list.createCta')}
            </Link>
          </div>
        }
      />
    </div>
  )
}
