import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ActionLink } from '@/shared/components/ui/action-link'
import { DataTable, type ColumnDef } from '@/shared/components/ui/data-table'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { useWriteGuard } from '@/features/business/use-write-guard'
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
 * Columnas: nombre, categoría, subcategoría y estado. Todas salen del
 * **resumen** que devuelve `GET /business/places` — la lista trae 7 campos,
 * no el detalle.
 *
 * ⚠️ **Sin columna de GeoPoints**, por dos razones que apuntan al mismo
 * lado. La primera es de regla: RN-GAM-10 fija ese valor desde la
 * plataforma, igual para todos los `BusinessVenue`, así que la columna
 * mostraría **el mismo número en cada fila** — cero información por mucho
 * ancho. La segunda es de datos: el backend guarda hoy lo que el portal
 * manda (50) y no el 12 que la regla dicta, así que la columna además
 * mentiría. Ver `Renata-S-A-S/geoquest#191`.
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
  const writeGuard = useWriteGuard()

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
      key: 'subcategory',
      header: t('list.columns.subcategory'),
      render: (place) => t(`taxonomy.subcategories.${place.subcategory}`),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-ink">{t('list.title')}</h1>
        <ActionLink
          to="/lugares/nuevo"
          disabled={writeGuard.disabled}
          describedById={writeGuard.describedBy}
        >
          {t('list.createCta')}
        </ActionLink>
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
            <ActionLink
              to="/lugares/nuevo"
              disabled={writeGuard.disabled}
              describedById={writeGuard.describedBy}
            >
              {t('list.createCta')}
            </ActionLink>
          </div>
        }
      />
    </div>
  )
}
