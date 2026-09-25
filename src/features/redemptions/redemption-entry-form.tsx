import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import {
  createQrTokenFormSchema,
  type QrTokenFormValues,
} from '@/shared/schemas/business-redemption'

/**
 * Entrada manual del código QR (#44).
 *
 * El criterio de aceptación pide validar el formato **antes** de llamar al
 * endpoint, y eso es lo que hace el schema: 44 caracteres base64 terminados en
 * `=`, que es exactamente lo que produce
 * `Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))`.
 *
 * ⚠️ **Está pensado para pegar, no para tipear, y eso no es una preferencia de
 * diseño: es una limitación del sistema.** El panel del explorador documenta su
 * propio prop como «Encoded into the QR and never printed as text», así que en
 * la pantalla del cliente no hay ningún texto legible que el staff pueda
 * transcribir — solo la imagen del QR y el contador. Hasta que la app del
 * explorador exponga el token como texto copiable, esta pantalla no se puede
 * usar contra un cliente real, y no hay issue abierta que cubra ese hueco (es
 * distinto del de `geoquest#202`).
 *
 * `autoComplete="off"` y `spellCheck={false}`: es un secreto de un solo uso,
 * no un dato del usuario, y el corrector cambiaría mayúsculas de un valor que
 * las distingue.
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
  const fieldId = useId()
  const errorId = useId()
  const hintId = useId()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QrTokenFormValues>({
    resolver: zodResolver(createQrTokenFormSchema(t)),
    defaultValues: { qrToken: '' },
  })

  const fieldError = errors.qrToken?.message

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(values.qrToken))}
      className="flex flex-col gap-4"
    >
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

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? t('entry.submitting') : t('entry.submit')}
      </Button>
    </form>
  )
}
