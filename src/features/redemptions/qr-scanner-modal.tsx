import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Modal } from '@/shared/components/ui/modal'
import { useQrCameraScanner } from './use-qr-camera-scanner'
import type { QrCameraScannerErrorReason } from './qr-camera-scanner'

export interface QrScannerModalProps {
  open: boolean
  onClose: () => void
  /** Se llama UNA vez con el primer valor que pasa el formato del token — el caller dispara el mismo lookup que el pegado manual. */
  onScanned: (token: string) => void
}

const ERROR_COPY_KEY: Record<QrCameraScannerErrorReason, string> = {
  'permission-denied': 'entry.scan.errors.permissionDenied',
  'no-camera': 'entry.scan.errors.noCamera',
  'insecure-context': 'entry.scan.errors.insecureContext',
  unknown: 'entry.scan.errors.generic',
}

/**
 * Modal de escaneo por cámara (#44-#48) — presentacional: toda la
 * orquestación de la cámara vive en `useQrCameraScanner`, acá solo se
 * traduce su estado a la interfaz. Reutiliza el primitivo `Modal` en vez de
 * uno propio, igual que `redemption-preview-view.tsx` para el de
 * confirmación.
 *
 * `closeOnBackdropClick` queda en su default (`true`): a diferencia de
 * confirmar un canje, cerrar el escaneo por accidente no tiene ninguna
 * consecuencia — la entrada manual sigue ahí atrás.
 */
export function QrScannerModal({ open, onClose, onScanned }: QrScannerModalProps) {
  const { t } = useTranslation('redemptions')
  const { videoRef, error, showInvalidTokenHint } = useQrCameraScanner({
    isOpen: open,
    onScanned,
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('entry.scan.modalTitle')}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('entry.scan.cancel')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {error === null && (
          <>
            <p className="font-sans text-xs text-muted">{t('entry.scan.instructions')}</p>
            {/*
              `muted`/`playsInline` ya los pone `qr-scanner` en runtime, pero
              se declaran acá también: evita un frame sin ellos entre que
              React monta el nodo y el adaptador termina de configurarlo, y
              documenta la intención sin depender de un detalle interno de
              la librería.
            */}
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label={t('entry.scan.modalTitle')}
              className="w-full rounded-sm bg-ink"
            />
            {showInvalidTokenHint && (
              <p role="alert" className="font-sans text-xs text-alert">
                {t('entry.scan.invalidQr')}
              </p>
            )}
          </>
        )}

        {error !== null && (
          <p role="alert" className="font-sans text-xs text-alert">
            {t(ERROR_COPY_KEY[error])}
          </p>
        )}
      </div>
    </Modal>
  )
}
