import axios from 'axios'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { useWriteGuard } from '@/features/business/use-write-guard'
import { usePublishPlace } from '@/features/places/queries'
import { canPublishPlace } from '@/features/places/api/publish-place'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'

/**
 * Traduce los 409 del backend a su motivo real.
 *
 * Los tres se devuelven **directo**, sin pasar por el `fallback` de
 * `getProblemDetailsMessage`: ese helper resuelve `detail ?? title ??
 * fallback`, así que el `detail` en inglés del backend ("An active Place
 * requires at least one photo.") le ganaría al texto traducido. Es el mismo
 * problema que corregí en el formulario de alta.
 */
function publishErrorMessage(error: unknown, t: TFunction<'places'>): string {
  const title = axios.isAxiosError(error)
    ? (error.response?.data?.title as string | undefined)
    : undefined

  if (title === 'Place.ActiveRequiresAtLeastOnePhoto') return t('publish.errors.needsPhoto')
  if (title === 'Place.AlreadyActive') return t('publish.errors.alreadyActive')
  if (title === 'Place.Deleted') return t('publish.errors.deleted')

  return getProblemDetailsMessage(error, t('publish.errors.generic'))
}

/** Motivo por el que el botón está bloqueado, o `undefined` si se puede publicar. */
function blockedReason(place: BusinessPlaceDetail, t: TFunction<'places'>): string | undefined {
  if (place.status === 'Deleted') return t('publish.deleted')
  if (place.status === 'Active') return t('publish.alreadyActive')
  if (place.photos.length === 0) return t('publish.needsPhoto')

  return undefined
}

export interface PublishPlaceActionProps {
  place: BusinessPlaceDetail
}

/**
 * Acción de publicar un lugar (#34).
 *
 * ⚠️ **Vive en el detalle, no en el formulario de alta.** #34 pide un botón
 * "Publicar" junto a "Guardar borrador" en el alta, pero eso **fallaría
 * siempre**: publicar exige al menos una foto (409
 * `Place.ActiveRequiresAtLeastOnePhoto`) y las fotos solo se pueden subir
 * DESPUÉS de que el lugar existe, contra
 * `POST /business/places/{id}/photos`. Un botón que no puede funcionar nunca
 * es peor que no tenerlo.
 *
 * Lo que sí se cumple de #34: el alta guarda un borrador y lo dice
 * ("Guardar borrador"), y la publicación es una llamada aparte.
 *
 * Cuando el botón está bloqueado se explica POR QUÉ en vez de dejarlo gris
 * y mudo: un `disabled` sin motivo obliga al usuario a adivinar qué le
 * falta.
 */
export function PublishPlaceAction({ place }: PublishPlaceActionProps) {
  const { t } = useTranslation('places')
  const { success, info } = useToast()
  const writeGuard = useWriteGuard()
  const mutation = usePublishPlace()

  const reason = blockedReason(place, t)
  const canPublish = canPublishPlace(place)

  if (place.status === 'Active' || place.status === 'Deleted') return null

  function onPublish() {
    mutation.mutate(place.placeId, {
      onSuccess: (result) => {
        // Un 200 con `visibleToExplorers: false` es un éxito PARCIAL: el
        // lugar quedó activo pero nadie lo ve todavía porque el negocio no
        // está verificado. Avisarlo como éxito liso dejaría al negocio
        // esperando check-ins que no van a llegar.
        if (result.visibleToExplorers) {
          success(t('publish.success'))
        } else {
          info(t('publish.successNotVisible'))
        }
      },
    })
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="primary"
          onClick={onPublish}
          disabled={!canPublish || mutation.isPending || writeGuard.disabled}
          aria-describedby={writeGuard.describedBy}
        >
          {mutation.isPending ? t('publish.publishing') : t('publish.action')}
        </Button>
      </div>

      {reason && <p className="font-sans text-xs text-muted">{reason}</p>}

      {mutation.isError && (
        <p role="alert" className="font-sans text-xs text-alert">
          {publishErrorMessage(mutation.error, t)}
        </p>
      )}
    </Card>
  )
}
