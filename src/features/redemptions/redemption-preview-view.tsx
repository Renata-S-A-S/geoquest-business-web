import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { Modal } from '@/shared/components/ui/modal'
import { RedemptionOriginCallout } from './redemption-origin-callout'
import {
  redemptionNotRedeemableReason,
  type RedemptionPreview,
} from '@/shared/schemas/business-redemption'

/**
 * Previsualización antes de confirmar (#45) + confirmación con modal (#46).
 *
 * ⚠️ **El criterio de aceptación de #45 pide «nombre/foto del explorador» y eso
 * NO SE PUEDE CUMPLIR del todo.** El backend expone `explorerUsername`, pero
 * puede venir `null` cuando el `ExplorerRef` todavía no se proyectó para ese
 * explorador (decision #1473) — ahí se cae al `explorerId` crudo. Nunca hay
 * foto en ningún endpoint de canje.
 *
 * Lo que sí se muestra es todo lo que el staff necesita para decidir: qué
 * entregar, si se pagó con saldo o fue premio (#47), cuánto costó y hasta
 * cuándo vale el código.
 *
 * ⚠️ **El backend, no la fecha del cliente, decide si el código sigue vigente.**
 * `status`/`isRedeemable` ya vienen resueltos por `RedemptionTokenResolution`
 * (degrada `Earned` a `Expired` cuando el QR venció, GR-3) — la vista no
 * recalcula nada comparando `qrExpiresAtUtc` contra `Date.now()`, porque el
 * reloj del navegador del staff no es la autoridad.
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

  const notRedeemableReason = redemptionNotRedeemableReason(preview.status)
  const explorerDisplay = preview.explorerUsername ?? preview.explorerId

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
          <p className="font-sans text-xs text-muted">{preview.rewardDescription}</p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-xs text-muted">{t('preview.cost')}</span>
            <span className="font-sans text-sm font-bold text-ink">
              {t('preview.costPoints', { points: preview.geoPointsCostSnapshot })}
            </span>
          </div>
        </div>

        {/*
          El explorador se muestra por `explorerUsername` cuando el backend lo
          proyectó; si no, cae al identificador crudo con la advertencia al
          lado. `font-mono` en el fallback para que quede claro que ahí es un
          dato técnico y no un nombre de usuario.
        */}
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs text-muted">{t('preview.explorer.label')}</span>
          <span
            className={
              preview.explorerUsername === null
                ? 'font-mono text-xs text-ink'
                : 'font-sans text-sm font-bold text-ink'
            }
          >
            {explorerDisplay}
          </span>
          {preview.explorerUsername === null && (
            <p className="font-sans text-xs text-muted">{t('preview.explorer.note')}</p>
          )}
        </div>
      </Card>

      {notRedeemableReason !== null ? (
        <p role="alert" className="font-sans text-xs text-alert">
          {t(`preview.status.${notRedeemableReason}`)}
        </p>
      ) : preview.qrExpiresAtUtc !== null ? (
        <p className="font-sans text-xs text-muted">
          {t('preview.expires', { time: new Date(preview.qrExpiresAtUtc).toLocaleTimeString() })}
        </p>
      ) : null}

      {errorMessage !== null && (
        <p role="alert" className="font-sans text-xs text-alert">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/*
          El backend ya decidió si el código es redimible (`isRedeemable`):
          si no lo es, no se ofrece el botón — no tiene sentido dejar que el
          staff dispare un escaneo que el servidor va a rechazar seguro.
        */}
        {preview.isRedeemable && (
          <Button variant="primary" disabled={isConfirming} onClick={() => setIsModalOpen(true)}>
            {t('preview.confirm')}
          </Button>
        )}
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
