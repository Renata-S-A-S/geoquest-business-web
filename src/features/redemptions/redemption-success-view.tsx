import { CheckCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'

/**
 * Estado post-canje (#48).
 *
 * ⚠️ Se arma con el título que ya traía la previsualización, **no** con la
 * respuesta del escaneo: `POST .../redemptions/scan` devuelve **204 sin
 * cuerpo**. El issue #48 espera un `UserReward` con `status: 'Redeemed'`,
 * `redeemedAt` y `redeemedByStaffId`, y nada de eso llega. Tampoco sería
 * mostrable `redeemedByStaffId`: es un Guid y no hay endpoint de identidad de
 * staff (`geoquest#203`).
 *
 * Por eso no se muestra ni la hora ni quién validó: serían datos que el portal
 * se estaría inventando. Lo que el staff necesita saber es que quedó
 * registrado, y que puede seguir con el próximo cliente.
 *
 * `onRestart` vuelve a la entrada de código sin recargar la página, que es el
 * criterio de aceptación explícito de #48.
 */
export interface RedemptionSuccessViewProps {
  rewardTitle: string
  onRestart: () => void
}

export function RedemptionSuccessView({ rewardTitle, onRestart }: RedemptionSuccessViewProps) {
  const { t } = useTranslation('redemptions')

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle aria-hidden="true" size={40} weight="fill" className="text-green" />

      {/*
        `role="status"`: el canje se confirma sin cambiar de ruta, así que un
        lector de pantalla no tiene otra señal de que algo pasó.
      */}
      <h1 role="status" className="font-display text-lg font-bold text-ink">
        {t('done.title')}
      </h1>

      <p className="font-sans text-sm text-muted">
        {t('done.description', { reward: rewardTitle })}
      </p>

      <Button variant="primary" onClick={onRestart}>
        {t('done.again')}
      </Button>
    </div>
  )
}
