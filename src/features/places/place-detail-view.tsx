import { lazy, Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '@/shared/components/ui/card'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import {
  MAX_PLACE_PHOTOS,
  type BusinessPlaceDetail,
  type BusinessPlaceStatus,
} from '@/shared/schemas/business-place'
import { hasMapboxToken } from '@/features/places/map-config'
import { PlacePhotoViewer } from '@/features/places/place-photo-viewer'

/**
 * `mapbox-gl` pesa cientos de kilobytes y solo hace falta en esta pantalla,
 * así que se carga aparte. Sin `lazy()` el login y el listado — las dos
 * pantallas que todo negocio abre primero — pagarían ese peso sin usarlo.
 */
const PlaceLocationMap = lazy(() =>
  import('@/features/places/place-location-map').then((mod) => ({
    default: mod.PlaceLocationMap,
  }))
)

const PLACE_STATUS_VARIANT: Record<BusinessPlaceStatus, StatusBadgeVariant> = {
  Draft: 'neutral',
  Active: 'success',
  Paused: 'warning',
  Deleted: 'error',
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-base font-bold text-ink">{children}</h2>
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-xs font-semibold text-muted">{label}</span>
      <span className="font-sans text-sm text-ink">{value}</span>
    </div>
  )
}

export interface PlaceDetailViewProps {
  place: BusinessPlaceDetail
  /** Acciones de estado (#34). Se inyectan para no acoplar la vista a la mutación. */
  actions?: ReactNode
}

/**
 * Detalle de un lugar (#35). Presentacional: recibe el lugar ya resuelto.
 *
 * **Sin bloque de recompensas a propósito.** Un `BusinessVenue` otorga 0 XP
 * (RN-GAM-02/03) y GeoPoints fijados por la plataforma (RN-GAM-10): el
 * negocio no elige ninguno de los dos, así que un recuadro contándoselo no
 * le habilita ninguna decisión. Se probó enunciar la regla y se retiró por
 * eso mismo — informar sobre algo incontrolable es ruido, no transparencia.
 *
 * Los valores viajan igual en el payload de creación, con los números de la
 * regla; ver `api/create-place.ts`.
 */
export function PlaceDetailView({ place, actions }: PlaceDetailViewProps) {
  const { t } = useTranslation('places')

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-lg font-bold text-ink">{place.name}</h1>
          <StatusBadge
            status={place.status}
            variantMap={PLACE_STATUS_VARIANT}
            label={t(`list.status.${place.status}`)}
          />
        </div>
        <Link to="/lugares" className="font-sans text-xs font-bold text-teal hover:underline">
          {t('detail.backToList')}
        </Link>
      </div>

      {actions}

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.identity.title')}</SectionTitle>
        <DetailField label={t('detail.fields.description.label')} value={place.description} />
        <DetailField
          label={t('detail.fields.category.label')}
          value={t(`taxonomy.categories.${place.category}`)}
        />
        <DetailField
          label={t('detail.fields.subcategory.label')}
          value={t(`taxonomy.subcategories.${place.subcategory}`)}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.location.title')}</SectionTitle>

        {/*
         * Un pin en el mapa dice dónde queda el local; un par de números
         * decimales no. Pero el token de Mapbox todavía no está
         * provisionado, así que sin él se cae a las coordenadas en texto —
         * que es exactamente lo que se mostraba antes de que el mapa
         * existiera. Degradar a lo anterior es mejor que degradar a un hueco
         * gris.
         */}
        {hasMapboxToken ? (
          <Suspense
            fallback={
              <div className="flex h-48 items-center justify-center rounded-xs border border-border">
                <p role="status" className="font-sans text-xs text-muted">
                  {t('detail.mapLoading')}
                </p>
              </div>
            }
          >
            <PlaceLocationMap
              latitude={place.latitude}
              longitude={place.longitude}
              name={place.name}
            />
          </Suspense>
        ) : (
          <>
            <DetailField
              label={t('detail.fields.coordinates.label')}
              value={t('detail.fields.coordinates.value', {
                latitude: place.latitude,
                longitude: place.longitude,
              })}
            />
            <p className="font-sans text-xs text-muted">{t('detail.mapUnavailable')}</p>
          </>
        )}

        <DetailField
          label={t('detail.fields.checkInRadiusMeters.label')}
          value={t('detail.fields.checkInRadiusMeters.value', {
            meters: place.checkInRadiusMeters,
          })}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.photos.title')}</SectionTitle>
        {place.photos.length === 0 ? (
          <>
            <p className="font-sans text-sm text-ink">{t('detail.photos.empty')}</p>
            {/*
             * No es solo informativo: sin al menos una foto el backend
             * rechaza la publicación con 409, así que decirlo acá evita que
             * el negocio intente publicar y reciba un error que no explica
             * qué le falta.
             */}
            <p className="font-sans text-xs text-muted">{t('detail.photos.publishNeedsPhoto')}</p>
          </>
        ) : (
          <>
            <p className="font-sans text-xs text-muted">
              {t('detail.photos.count', { count: place.photos.length, max: MAX_PLACE_PHOTOS })}
            </p>
            <PlacePhotoViewer photos={place.photos} placeName={place.name} />
          </>
        )}
      </Card>
    </div>
  )
}
