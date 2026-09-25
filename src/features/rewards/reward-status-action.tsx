import axios from 'axios'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { usePauseReward, useRepublishReward } from '@/features/rewards/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import {
  canPauseReward,
  canRepublishReward,
  republishWillExhaust,
  type BusinessRewardSummary,
} from '@/shared/schemas/business-reward'

/**
 * Traduce los 409/403 de las transiciones a su motivo real.
 *
 * Directo y no vía el `fallback` de `getProblemDetailsMessage`, que resuelve
 * `detail ?? title ?? fallback` y dejaría ganar al texto en inglés del
 * backend. Mismo criterio que `publishErrorMessage` en
 * `publish-place-action.tsx`.
 */
function statusErrorMessage(error: unknown, t: TFunction<'rewards'>): string {
  const title = axios.isAxiosError(error)
    ? (error.response?.data?.title as string | undefined)
    : undefined

  if (title === 'Reward.AlreadyPaused') return t('statusActions.errors.alreadyPaused')
  if (title === 'Reward.NotPaused') return t('statusActions.errors.notPaused')
  if (title === 'Reward.InvalidStatusTransition') return t('statusActions.errors.invalidTransition')
  // El 403 del negocio tiene mensaje propio: la acción no falló por la
  // recompensa sino por el estado del negocio, y confundirlos manda al dueño a
  // revisar la recompensa cuando el problema está en otra parte.
  if (title === 'RewardPortal.BusinessNotActive') return t('statusActions.errors.businessNotActive')

  return getProblemDetailsMessage(error, t('statusActions.errors.generic'))
}

export interface RewardStatusActionProps {
  businessId: string
  reward: BusinessRewardSummary
}

/**
 * Pausar y republicar una recompensa (#111). Sigue el precedente de
 * `PublishPlaceAction` (#34) en los tres puntos que lo hacen no trivial:
 *
 * 1. **No renderiza nada cuando ninguna acción es posible por estado.** Una
 *    recompensa en `Draft` o `Archived` no se pausa ni se republica, y un
 *    control gris y mudo no explica nada: mejor no ocupar espacio.
 * 2. **Explica la precondición en vez de mostrar un botón deshabilitado**
 *    cuando la acción se puede intentar pero tiene una consecuencia que el
 *    dueño no espera.
 * 3. **Distingue el éxito parcial** — y acá es el punto central, no un detalle.
 *
 * Los predicados replican los guards del servidor EXACTO (`Reward.cs:268-300`),
 * no una versión más segura: `canPublishPlace` ya tuvo ese bug y escondía una
 * acción válida.
 */
export function RewardStatusAction({ businessId, reward }: RewardStatusActionProps) {
  const { t } = useTranslation('rewards')
  const { success, info } = useToast()
  const pause = usePauseReward(businessId, reward.rewardId)
  const republish = useRepublishReward(businessId, reward.rewardId)

  const canPause = canPauseReward(reward)
  const canRepublish = canRepublishReward(reward)

  // Ninguna transición posible: `Draft` y `Archived`. No se renderiza nada.
  if (!canPause && !canRepublish) return null

  const willExhaust = republishWillExhaust(reward)

  /**
   * Las dos transiciones son mutuamente excluyentes por estado (pausar exige
   * `Published`/`Exhausted`, republicar exige `Paused`), así que solo un botón
   * se renderiza a la vez. Igual se elige el error por cuál mutación falló y no
   * por el estado: si esa exclusividad cambiara, un error quedaría invisible en
   * silencio, y un error que no se ve es peor que un botón de más.
   */
  const failed = pause.isError ? pause : republish.isError ? republish : undefined

  function onPause() {
    pause.mutate(undefined, {
      onSuccess: () => success(t('statusActions.pause.success')),
    })
  }

  function onRepublish() {
    republish.mutate(undefined, {
      onSuccess: () => {
        /**
         * **Éxito parcial.** Republicar una recompensa sin stock la deja
         * `Exhausted`, no `Published` (`Reward.cs:298`), y el 204 sin body no
         * lo dice. Si acá dijéramos "republicada" mientras el badge muestra
         * "Agotada", el negocio pensaría que algo falló.
         *
         * Se decide con los datos PREVIOS a la acción y no releyendo, porque
         * republicar no cambia el stock: `republishWillExhaust` ya sabía el
         * resultado antes de llamar. Eso además evita depender de que el
         * refetch haya terminado para poder dar el mensaje correcto.
         */
        if (willExhaust) {
          info(t('statusActions.republish.successButExhausted'))
        } else {
          success(t('statusActions.republish.success'))
        }
      },
    })
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {canPause && (
          <Button variant="secondary" onClick={onPause} disabled={pause.isPending}>
            {pause.isPending ? t('statusActions.pause.pending') : t('statusActions.pause.action')}
          </Button>
        )}
        {canRepublish && (
          <Button variant="primary" onClick={onRepublish} disabled={republish.isPending}>
            {republish.isPending
              ? t('statusActions.republish.pending')
              : t('statusActions.republish.action')}
          </Button>
        )}
      </div>

      {/*
        El aviso ANTICIPADO, que es criterio de aceptación de #111: republicar
        sin stock deja la recompensa agotada. Decirlo antes de que el dueño
        haga clic le da la chance de reponer stock primero, en vez de
        sorprenderlo con un badge que no esperaba.
      */}
      {canRepublish && willExhaust && (
        <p className="font-sans text-xs text-muted">{t('statusActions.republish.willExhaust')}</p>
      )}

      {/*
        Pausar una agotada es válido en el servidor, pero conviene decir qué
        hace: dejar de ofrecerla en vez de "arreglar" el stock.
      */}
      {canPause && reward.status === 'Exhausted' && (
        <p className="font-sans text-xs text-muted">{t('statusActions.pause.exhaustedHint')}</p>
      )}

      {/*
        Reponer stock mientras está pausada NO la despausa sola:
        `SyncStockStatus()` nunca toca `Paused` (`Reward.cs:306-308`). Sin este
        aviso, un dueño que repone stock esperaría verla publicada de nuevo.
      */}
      {canRepublish && (
        <p className="font-sans text-xs text-muted">
          {t('statusActions.republish.pausedStaysHint')}
        </p>
      )}

      {failed && (
        <p role="alert" className="font-sans text-xs text-alert">
          {statusErrorMessage(failed.error, t)}
        </p>
      )}
    </Card>
  )
}
