import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type ColumnDef } from '@/shared/components/ui/data-table'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import type { Place } from '@/shared/schemas/place'

/**
 * Mapa de estado a variante visual, a nivel de módulo igual que
 * `BUSINESS_STATUS_VARIANT` en `business-profile-view.tsx`. Tiparlo como
 * `Record<Place['status'], ...>` hace que agregar un estado al schema sin
 * decidir su color rompa la compilación, en vez de caer al 'neutral' por
 * defecto de `StatusBadge` sin que nadie se entere.
 */
const PLACE_STATUS_VARIANT: Record<Place['status'], StatusBadgeVariant> = {
  Draft: 'neutral',
  Active: 'success',
  Paused: 'warning',
}

export interface PlacesViewProps {
  places: Place[]
}

/**
 * Listado de lugares del negocio (#29, B-02). Primer consumidor real de
 * `DataTable` (#17), que hasta ahora solo tenía su propio test.
 *
 * Columnas: nombre, estado, check-ins y radio. **Sin columna de
 * categoría** a propósito: la única taxonomía existente
 * (`BUSINESS_CATEGORY_OPTIONS`) declara en su propio comentario que NO está
 * confirmada en Confluence, y traducirla acá la duplicaría en un tercer
 * lugar. #29 no la pide; tres fuentes de verdad para una taxonomía sin
 * confirmar cuesta más de lo que informa.
 *
 * El CTA del encabezado NO es redundante con el del estado vacío: sin él,
 * un negocio que ya tiene un lugar no tendría por dónde crear el segundo.
 */
export function PlacesView({ places }: PlacesViewProps) {
  const { t } = useTranslation('places')

  const columns: ColumnDef<Place>[] = [
    { key: 'name', header: t('list.columns.name') },
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
      key: 'totalCheckIns',
      header: t('list.columns.totalCheckIns'),
      render: (place) => t('list.checkInsValue', { count: place.totalCheckIns }),
    },
    {
      key: 'checkInRadiusMeters',
      header: t('list.columns.checkInRadiusMeters'),
      render: (place) => t('list.radiusValue', { meters: place.checkInRadiusMeters }),
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
        getRowId={(place) => place.id}
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
