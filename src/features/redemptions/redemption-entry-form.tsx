import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera } from '@phosphor-icons/react'
import { Button } from '@/shared/components/ui/button'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { useWriteGuard } from '@/features/business/use-write-guard'
import { QrScannerModal } from './qr-scanner-modal'
import {
  createQrTokenFormSchema,
  type QrTokenFormValues,
} from '@/shared/schemas/business-redemption'

/**
 * Entrada del código QR (#44) — pegado a mano o escaneado con la cámara,
 * las dos vías conviven acá.
 *
 * El criterio de aceptación pide validar el formato **antes** de llamar al
 * endpoint, y eso es lo que hace el schema: 44 caracteres base64 terminados en
 * `=`, que es exactamente lo que produce
 * `Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))`.
 *
 * ⚠️ **El pegado a mano está pensado para eso, pegar, no para tipear, y no es
 * una preferencia de diseño: es una limitación del sistema.** El panel del
 * explorador documenta su propio prop como «Encoded into the QR and never
 * printed as text», así que en la pantalla del cliente no hay ningún texto
 * legible que el staff pueda transcribir — solo la imagen del QR y el
 * contador. El escaneo con cámara (`QrScannerModal`) es justo lo que resuelve
 * ese hueco: lee el mismo `qrToken` que la app del explorador codifica en el
 * QR (`QRCodeSVG value={qrToken}`), sin depender de que haya texto copiable.
 *
 * `autoComplete="off"` y `spellCheck={false}`: es un secreto de un solo uso,
 * no un dato del usuario, y el corrector cambiaría mayúsculas de un valor que
 * las distingue.
 *
 * ## Por qué hay un solo `submitToken` y no una llamada a `onSubmit` por vía
 *
 * Lookup y escaneo comparten un balde de 30 requests/minuto por staff
 * (design D8, ver `redemption-error-message.ts`), así que una segunda función
 * que dispare `onSubmit` en paralelo sería una segunda forma de agotarlo. El
 * submit del `<form>` y `handleScanned` (cámara) llaman **la misma**
 * `submitToken = handleSubmit(...)`: cuando la cámara decodifica un token
 * válido, lo carga con `setValue` y dispara ese mismo handler, así que pasa
 * otra vez por la validación de Zod y termina en el idéntico `onSubmit`
 * que usa el pegado manual — no hay un segundo camino al backend.
 */
export interface RedemptionEntryFormProps {
  onSubmit: (qrToken: string) => void
  isSubmitting: boolean
  /** Error ya traducido del lookup, o `null`. Lo resuelve el contenedor. */
  errorMessage: string | null
}

export function RedemptionEntryForm({
  onSubmit,
  isSubmitting,
  errorMessage,
}: RedemptionEntryFormProps) {
  const { t } = useTranslation('redemptions')
  const writeGuard = useWriteGuard()
  const fieldId = useId()
  const errorId = useId()
  const hintId = useId()

  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<QrTokenFormValues>({
    resolver: zodResolver(createQrTokenFormSchema(t)),
    defaultValues: { qrToken: '' },
  })

  const fieldError = errors.qrToken?.message

  // Único punto de entrada al lookup — ver el docstring del componente.
  const submitToken = handleSubmit((values) => onSubmit(values.qrToken))

  function handleScanned(token: string) {
    setValue('qrToken', token, { shouldValidate: true })
    setIsScannerOpen(false)
    void submitToken()
  }

  return (
    <>
      <form noValidate onSubmit={submitToken} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-lg font-bold text-ink">{t('entry.title')}</h1>
          <p className="font-sans text-xs text-muted">{t('entry.description')}</p>
        </div>

        <FormField
          htmlFor={fieldId}
          label={t('entry.field.label')}
          error={fieldError}
          errorId={errorId}
        >
          <Input
            id={fieldId}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('entry.field.placeholder')}
            aria-invalid={fieldError !== undefined}
            aria-describedby={fieldError !== undefined ? errorId : hintId}
            className="font-mono"
            {...register('qrToken')}
          />
          <p id={hintId} className="font-sans text-xs text-muted">
            {t('entry.field.hint')}
          </p>
        </FormField>

        {errorMessage !== null && (
          <p role="alert" className="font-sans text-xs text-alert">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || writeGuard.disabled}
          aria-describedby={writeGuard.describedBy}
        >
          {isSubmitting ? t('entry.submitting') : t('entry.submit')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting || writeGuard.disabled}
          aria-describedby={writeGuard.describedBy}
          onClick={() => setIsScannerOpen(true)}
        >
          <Camera size={16} weight="bold" aria-hidden="true" />
          {t('entry.scan.button')}
        </Button>
      </form>

      <QrScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={handleScanned}
      />
    </>
  )
}
