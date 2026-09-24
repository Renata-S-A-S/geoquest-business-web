import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '@/shared/components/ui/card'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { MAX_PLACE_PHOTOS, type BusinessPlaceDetail, type BusinessPlaceStatus } from '@/shared/schemas/business-place'

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

/**
 * Valor fijado por la plataforma — issue #35.
 *
 * El criterio de aceptación es explícito: los puntos tienen que verse
 * **visiblemente distintos a un campo editable, no solo `disabled`**. Un
 * input deshabilitado sigue pareciendo un input: comunica "esto se edita,
 * pero no ahora", que es lo contrario de lo que pasa acá. Nunca se va a
 * poder editar.
 *
 * Por eso se renderiza como un dato con su unidad, sobre fondo `bg-cream`,
 * sin borde de campo ni cursor de texto. No hay `<input disabled>` en
 * ninguna parte de esta pantalla.
 */
function PlatformFixedValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xs bg-cream px-3 py-2">
      <span className="font-sans text-xs font-semibold text-muted">{label}</span>
      <span className="font-display text-base font-bold text-ink">{value}</span>
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
 * ⚠️ **Nota sobre los números de recompensa.** #35 espera `xpReward: 0` y
 * `geoPointsReward: 12` según ADR-041/043. El backend desplegado guarda lo
 * que el portal manda, y el portal manda el mínimo que ese backend exige
 * (50/50) porque crea el lugar como `TouristSite` — ver el comentario largo
 * en `api/create-place.ts`.
 *
 * Así que esta pantalla muestra los valores REALES, no los del ADR. Lo que
 * sí se cumple es lo que el criterio de aceptación protege de verdad: que
 * el negocio entienda que **no los eligió él**. Eso es cierto hoy y va a
 * seguir siendo cierto cuando el backend los fije. La discrepancia numérica
 * está pedida en `Renata-S-A-S/geoquest#191`.
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
        <DetailField
          label={t('detail.fields.coordinates.label')}
          value={t('detail.fields.coordinates.value', {
            latitude: place.latitude,
            longitude: place.longitude,
          })}
        />
        <DetailField
          label={t('detail.fields.checkInRadiusMeters.label')}
          value={t('detail.fields.checkInRadiusMeters.value', {
            meters: place.checkInRadiusMeters,
          })}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('detail.sections.platform.title')}</SectionTitle>
        <PlatformFixedValue label={t('detail.fields.xpReward.label')} value={place.xpReward} />
        <PlatformFixedValue
          label={t('detail.fields.geoPointsReward.label')}
          value={place.geoPointsReward}
        />
        <p className="font-sans text-xs text-muted">{t('detail.platformFixedNote')}</p>
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
            <div className="flex flex-wrap gap-2">
              {place.photos.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="size-20 rounded-xs border border-border object-cover"
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
