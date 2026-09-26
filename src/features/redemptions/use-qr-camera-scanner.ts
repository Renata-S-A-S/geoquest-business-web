import { useEffect, useRef, useState, type RefObject } from 'react'
import { isQrToken } from '@/shared/schemas/business-redemption'
import {
  startQrCameraScanner,
  type QrCameraScannerErrorReason,
  type QrCameraScannerHandle,
} from './qr-camera-scanner'

export interface UseQrCameraScannerOptions {
  /** La cámara solo se pide mientras el modal está abierto. */
  isOpen: boolean
  /** Se dispara UNA sola vez, con el primer valor que pasa el formato del token (#44). */
  onScanned: (token: string) => void
}

export interface UseQrCameraScannerResult {
  videoRef: RefObject<HTMLVideoElement>
  error: QrCameraScannerErrorReason | null
  /** Un decode llegó pero no tiene forma de token de GeoQuest — el modal sigue escaneando. */
  showInvalidTokenHint: boolean
}

/**
 * Orquesta el ciclo de vida de la cámara detrás del modal de escaneo (#44,
 * cámara como alternativa al pegado manual, prevista en el mismo issue).
 *
 * ## Por qué el primer decode válido es el único que importa
 *
 * Lookup y escaneo comparten un balde de 30 requests/minuto por staff
 * (design D8) — ver `redemption-error-message.ts`. Un scanner que siguiera
 * decodificando el mismo QR frame tras frame y disparara `onScanned` en
 * cada uno convertiría ESTE hook en la forma más rápida de agotar ese
 * límite antes de que el staff termine de leer la previsualización. Por
 * eso `decodedRef` se chequea como lo PRIMERO que hace `onDecode`, antes de
 * validar formato o de nada más: ni siquiera una carrera contra el propio
 * `stop()` (que no es instantáneo — todavía puede haber un frame en vuelo)
 * puede colarse.
 *
 * `onScannedRef`/`stop` se resuelven contra refs, no contra el callback
 * pasado por props, para que un `onScanned` no memoizado por el caller no
 * reinicie nada acá — el efecto de arranque solo depende de `isOpen`.
 */
export function useQrCameraScanner({
  isOpen,
  onScanned,
}: UseQrCameraScannerOptions): UseQrCameraScannerResult {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<QrCameraScannerHandle | null>(null)
  const decodedRef = useRef(false)
  const onScannedRef = useRef(onScanned)
  const [error, setError] = useState<QrCameraScannerErrorReason | null>(null)
  const [showInvalidTokenHint, setShowInvalidTokenHint] = useState(false)

  useEffect(() => {
    onScannedRef.current = onScanned
  }, [onScanned])

  useEffect(() => {
    if (!isOpen) return

    decodedRef.current = false
    setError(null)
    setShowInvalidTokenHint(false)

    let cancelled = false

    void (async () => {
      const videoElement = videoRef.current
      if (!videoElement) return

      const handle = await startQrCameraScanner({
        videoElement,
        onDecode: (value) => {
          // Chequeo #1, antes que cualquier otra cosa: ver el docstring de
          // arriba sobre por qué esto es lo único que de verdad protege el
          // límite de requests compartido.
          if (decodedRef.current) return

          if (!isQrToken(value)) {
            setShowInvalidTokenHint(true)
            return
          }

          decodedRef.current = true
          setShowInvalidTokenHint(false)
          handleRef.current?.stop()
          handleRef.current = null
          onScannedRef.current(value.trim())
        },
        onError: (reason) => {
          if (decodedRef.current) return
          setError(reason)
        },
      })

      if (cancelled) {
        handle?.stop()
        return
      }

      handleRef.current = handle
    })()

    // Se corre siempre al cerrar/desmontar, tanto si hubo un handle real
    // como si `startQrCameraScanner` todavía está en vuelo (`cancelled`
    // cubre ese caso arriba).
    return () => {
      cancelled = true
      handleRef.current?.stop()
      handleRef.current = null
    }
  }, [isOpen])

  return { videoRef, error, showInvalidTokenHint }
}
