import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useBusinessMe } from '@/features/business/queries'
import { RedemptionEntryForm } from './redemption-entry-form'
import { RedemptionPreviewView } from './redemption-preview-view'
import { RedemptionSuccessView } from './redemption-success-view'
import { redemptionErrorMessage } from './redemption-error-message'
import { useRedemptionLookup, useScanRedemption } from './queries'
import type { RedemptionPreview } from '@/shared/schemas/business-redemption'

/**
 * B-04 — Validar canje (#44, #45, #46, #47, #48). Reemplaza el
 * `RoutePlaceholder` que ocupaba `/canjes`.
 *
 * Contenedor: acá vive el fork pendiente/error/éxito y la máquina de estados
 * del flujo; las tres vistas reciben datos ya resueltos, mismo reparto que
 * `places-page.tsx`.
 *
 * ## Por qué el flujo tiene dos pasos y no uno
 *
 * No es una preferencia de UX, es lo que el contrato pide. El QR trae **solo**
 * un token opaco (`value={qrToken}` en el panel del explorador), y aunque el
 * escaneo real ya resuelve por token (redemption-scan-by-token, PR 2) igual
 * conviene previsualizar antes: el canje es irreversible y de un solo uso, así
 * que fallar antes (código vencido, ya canjeado, de otro negocio) es mejor que
 * fallar después de que el staff ya le dijo al cliente que sí. Primero se
 * busca (`POST .../redemptions/lookup`, real, verificado contra
 * `RedemptionEndpoints.cs`, `main`@e0f0e9a, PR #210) y después se confirma
 * (`POST .../redemptions/scan`, real).
 *
 * Que además eso sea justo lo que #45 pedía —previsualizar antes de una acción
 * irreversible— es coherente con el diseño del propio backend, no una excusa
 * del portal.
 *
 * ## Cómo se resuelve el `businessId`
 *
 * Todas las rutas `/portal/...` del backend son
 * `/portal/businesses/{businessId:guid}/...` sin excepción: la sesión aporta
 * solo el `sub` del explorador, y `PortalAccess` valida el par contra el
 * `businessId` EXACTO de la ruta. Así que el portal tiene que mandarlo.
 *
 * Se toma de `useBusinessMe()`, que es lo que el portal YA tiene para resolver
 * su propio negocio (`business.id`). La alternativa alcanzable sería
 * `businessStaffMeSchema.businessId` de `GET /business-staff/me`, también mock y
 * también marcado como propuesta (`geoquest#182`); se elige `useBusinessMe()`
 * por ser el camino más corto y el que ya usan las otras pantallas. No se agrega
 * transporte nuevo para esto.
 *
 * ⚠️ **El portal quedó con dos formas de acotar el negocio conviviendo, y es
 * una inconsistencia real, no un descuido de este PR.** Las rutas existentes lo
 * resuelven de la sesión —`get-places.ts` dice textualmente que «el cliente
 * nunca manda un `businessId`»— y las nuevas de `/portal/...` lo llevan en el
 * path, porque así es el backend real. Las dos cosas son ciertas a la vez hoy.
 * Queda registrada en `Renata-S-A-S/geoquest#191` junto con el resto de las
 * divergencias de contrato; **acá solo se deja visible, no se resuelve.**
 *
 * ⚠️ Aparte: `GET /business/me` **no existe en el backend** — verificado por
 * ausencia contra `main`@fbec604. El endpoint real es `GET /business/mine`, que
 * devuelve un **arreglo** (un owner puede tener más de un negocio). Migrarlo
 * toca 5 consumidores existentes (`business-profile-page`,
 * `business-profile-edit-page`, `pending-page`, `settings-page`,
 * `patch-business-me`) y es una corrección de contrato aparte, no parte de
 * B-04. Cuando se migre, este contenedor tendrá además que elegir negocio
 * cuando haya más de uno; hoy no hay selector.
 *
 * ## Lo que NO se resuelve acá
 *
 * RN-REW-06 dice que valida el `BusinessStaff` del negocio dueño, pero el
 * portal es **solo-owner** hoy: un empleado de mostrador recibe 403 en todo
 * `/portal/...`, que es irónico justo para este flujo. No se intenta arreglar
 * (`geoquest#203`: no hay endpoint de identidad de staff). Tampoco se
 * pre-bloquea la pantalla por rol: el backend es la autoridad, y adivinar acá
 * daría un falso negativo para un owner legítimo.
 */
/**
 * Lo que devolvió el lookup **más el token que el staff pegó**.
 *
 * El token tiene que sobrevivir al paso 1: el escaneo lo vuelve a exigir (es
 * su única clave de resolución), y el servidor no lo devuelve nunca en el
 * preview (guarda solo el hash SHA-256). Si no se retuviera acá, confirmar
 * obligaría a pedirle al staff que pegue el mismo código dos veces.
 */
interface ActiveRedemption extends RedemptionPreview {
  qrToken: string
}

export function RedemptionsPage() {
  const { t } = useTranslation('redemptions')
  const businessQuery = useBusinessMe()
  const businessId = businessQuery.data?.id

  const [preview, setPreview] = useState<ActiveRedemption | null>(null)
  const [redeemedTitle, setRedeemedTitle] = useState<string | null>(null)

  const lookup = useRedemptionLookup(businessId)
  const scan = useScanRedemption(businessId)

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-4">
        <p role="status">{t('entry.submitting')}</p>
      </div>
    )
  }

  if (businessQuery.isError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(businessQuery.error, t('errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('done.again')}
        </Button>
      </div>
    )
  }

  /**
   * Volver a la entrada sin recargar (#48). Resetea las dos mutaciones además
   * del estado local: sin `reset()`, el error del intento anterior seguiría
   * pintado sobre el código del próximo cliente.
   */
  function restart() {
    setPreview(null)
    setRedeemedTitle(null)
    lookup.reset()
    scan.reset()
  }

  if (redeemedTitle !== null) {
    return (
      <div className="p-4">
        <RedemptionSuccessView rewardTitle={redeemedTitle} onRestart={restart} />
      </div>
    )
  }

  if (preview !== null) {
    return (
      <div className="p-4">
        <RedemptionPreviewView
          preview={preview}
          isConfirming={scan.isPending}
          errorMessage={scan.isError ? redemptionErrorMessage(scan.error, t) : null}
          onRestart={restart}
          onConfirm={() =>
            scan.mutate(
              { qrToken: preview.qrToken },
              {
                // El título se guarda ANTES de limpiar la previsualización: el
                // 204 no devuelve nada, así que es la única fuente que queda
                // para la pantalla de éxito.
                onSuccess: () => {
                  setRedeemedTitle(preview.rewardTitle)
                  setPreview(null)
                },
              }
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="p-4">
      <RedemptionEntryForm
        isSubmitting={lookup.isPending}
        errorMessage={lookup.isError ? redemptionErrorMessage(lookup.error, t) : null}
        onSubmit={(qrToken) =>
          lookup.mutate(qrToken, {
            onSuccess: (found) => setPreview({ ...found, qrToken }),
          })
        }
      />
    </div>
  )
}
