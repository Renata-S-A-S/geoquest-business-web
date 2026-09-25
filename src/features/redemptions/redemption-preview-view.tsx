import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Modal } from '@/shared/components/ui/modal'
import { RedemptionOriginCallout } from './redemption-origin-callout'
import type { RedemptionPreview } from '@/shared/schemas/business-redemption'

/**
 * Previsualización antes de confirmar (#45) + confirmación con modal (#46).
 *
 * ⚠️ **El criterio de aceptación de #45 pide «nombre/foto del explorador» y eso
 * NO SE PUEDE CUMPLIR.** El backend no expone nombre ni foto en ningún
 * endpoint de canje: `PortalRedemptionResult` trae un `ExplorerId` crudo y nada
 * más, y no hay endpoint de identidad de explorador para el portal. Antes que
 * inventar un nombre o dejar un hueco sin explicar, la pantalla dice en voz
 * alta que no identifica a la persona y por qué eso no rompe el flujo: lo que
 * autoriza el canje es tener un token válido de un solo uso y 30 minutos de
 * vida (RN-REW-04), no el parecido de una cara.
 *
 * Lo que sí se muestra es todo lo que el staff necesita para decidir: qué
 * entregar, si se pagó con saldo o fue premio (#47), cuánto costó y hasta
 * cuándo vale el código.
 */

export interface RedemptionPreviewViewProps {
  preview: RedemptionPreview
  onConfirm: () => void
  onRestart: () => void
  isConfirming: boolean
  /** Error ya traducido del escaneo, o `null`. */
  errorMessage: string | null
}

export function RedemptionPreviewView({
  preview,
  onConfirm,
  onRestart,
  isConfirming,
  errorMessage,
}: RedemptionPreviewViewProps) {
  const { t } = useTranslation('redemptions')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const expiresAt = new Date(preview.qrExpiresAtUtc)
  const isExpired = expiresAt.getTime() < Date.now()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-lg font-bold text-ink">{t('preview.title')}</h1>
        <p className="font-sans text-xs text-muted">{t('preview.irreversible')}</p>
      </div>

      <RedemptionOriginCallout origin={preview.origin} />

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs text-muted">{t('preview.reward')}</span>
          <span className="font-display text-base font-bold text-ink">{preview.rewardTitle}</span>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs text-muted">{t('preview.cost')}</span>
            <span className="font-sans text-sm font-bold text-ink">
              {t('preview.costPoints', { points: preview.geoPointsCostSnapshot })}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs text-muted">{t('preview.value')}</span>
            <span className="font-sans text-sm font-bold text-ink">
              {t('preview.valueCop', { value: preview.estimatedValueCopSnapshot })}
            </span>
          </div>
        </div>

        {/*
          El explorador se muestra como lo que es —un identificador— con la
          advertencia al lado. `font-mono` para que quede claro que es un dato
          técnico y no el nombre de nadie.
        */}
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs text-muted">{t('preview.explorer.label')}</span>
          <span className="font-mono text-xs text-ink">{preview.explorerId}</span>
          <p className="font-sans text-xs text-muted">{t('preview.explorer.note')}</p>
        </div>
      </Card>

      {isExpired ? (
        <p role="alert" className="font-sans text-xs text-alert">
          {t('preview.expired')}
        </p>
      ) : (
        <p className="font-sans text-xs text-muted">
          {t('preview.expires', { time: expiresAt.toLocaleTimeString() })}
        </p>
      )}

      {errorMessage !== null && (
        <p role="alert" className="font-sans text-xs text-alert">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/*
          Deshabilitado si el código ya venció: el backend lo rechazaría con
          400 igual, y hacer que el staff descubra eso recién después de
          apretar "confirmar" delante del cliente es peor que no ofrecerlo.
        */}
        <Button
          variant="primary"
          disabled={isConfirming || isExpired}
          onClick={() => setIsModalOpen(true)}
        >
          {t('preview.confirm')}
        </Button>
        <Button variant="secondary" disabled={isConfirming} onClick={onRestart}>
          {t('preview.restart')}
        </Button>
      </div>

      {/*
        `closeOnBackdropClick={false}`: es una acción destructiva e
        irreversible, y un click al costado no debería descartarla ni
        dispararla. Esc sigue cerrando, que es lo que el primitivo garantiza.
      */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('confirm.title')}
        closeOnBackdropClick={false}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={isConfirming}
              onClick={() => setIsModalOpen(false)}
            >
              {t('confirm.cancel')}
            </Button>
            {/*
              `disabled={isConfirming}` es el guardia real contra el doble
              canje (#46): un segundo click manda un segundo escaneo del mismo
              token, y el backend responde 409. Deshabilitar es la prevención;
              el 409 traducido es solo la red de contención.
            */}
            <Button variant="primary" disabled={isConfirming} onClick={onConfirm}>
              {isConfirming ? t('confirm.accepting') : t('confirm.accept')}
            </Button>
          </div>
        }
      >
        <p className="font-sans text-sm text-ink">
          {t('confirm.description', { reward: preview.rewardTitle })}
        </p>
      </Modal>
    </div>
  )
}
