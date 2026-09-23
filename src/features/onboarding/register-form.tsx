import { useState } from 'react'
import { Controller, useForm, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CaretDown } from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import { registerBusinessInputSchema, type RegisterBusinessInput } from '@/shared/schemas/business'
import { registerBusiness } from '@/features/onboarding/api/register-business'
import { BUSINESS_CATEGORY_OPTIONS } from '@/features/onboarding/business-category-options'
import { LEGAL_DOCUMENT_TYPE_OPTIONS } from '@/features/onboarding/legal-document-type-options'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { Select } from '@/shared/components/ui/select'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Button } from '@/shared/components/ui/button'

/**
 * Sentinel de "nada elegido todavía" para los dos campos Select del
 * formulario. Zod los rechaza igual que un campo de texto vacío
 * (`invalid_enum_value`, ver `fieldErrorMessage`) — no hay una opción real
 * con este value en ninguna de las dos listas.
 */
const UNSELECTED = ''

const defaultValues: RegisterBusinessInput = {
  legalName: '',
  displayName: '',
  email: '',
  category: UNSELECTED,
  legalDocumentType: UNSELECTED as RegisterBusinessInput['legalDocumentType'],
  legalDocumentNumber: '',
  commercialAgreementAccepted: false,
}

/**
 * Traduce el `type` que deja `@hookform/resolvers/zod` en cada `FieldError`
 * (el código del issue de Zod: `too_small`, `invalid_string`,
 * `invalid_enum_value`) a un mensaje localizado — en vez de mostrar el
 * mensaje en inglés que trae Zod por default. `category`/`legalDocumentType`
 * nunca aceptan texto libre (van por Select), así que su único error posible
 * es "no se eligió nada" — se muestra como "requerido", no como un mensaje
 * de opción inválida que el usuario nunca podría producir a mano.
 */
function fieldErrorMessage(
  error: FieldError | undefined,
  t: TFunction<'onboarding'>
): string | undefined {
  if (!error) return undefined
  if (error.type === 'invalid_string') return t('register.validation.email')
  // `commercialAgreementAccepted`'s field-level `.refine()` (RN-BIZ-03)
  // reports `type: 'custom'` — no dedicated message: falls through to the
  // generic "required" copy below (size-budget cut, see design decision 1;
  // the spec only requires *a* localized error, not a distinct one).
  return t('register.validation.required')
}

/** Formulario de registro de negocio — B-01, issue #21. */
export function RegisterForm() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const toast = useToast()
  // Check-time feedback only, never sent to the server — the authoritative
  // value is the server-stamped `commercialAgreementSignedAt` in the
  // registration response (see `handlers.ts`).
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterBusinessInput>({
    resolver: zodResolver(registerBusinessInputSchema),
    defaultValues,
  })

  const agreement = register('commercialAgreementAccepted')

  const mutation = useMutation({
    mutationFn: registerBusiness,
    onSuccess: () => navigate('/registro/pendiente'),
    onError: (error) => toast.error(getProblemDetailsMessage(error, t('register.errors.generic'))),
  })

  return (
    <form
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormField
        htmlFor="legalName"
        label={t('register.fields.legalName.label')}
        errorId="legalName-error"
        error={fieldErrorMessage(errors.legalName, t)}
      >
        <Input
          id="legalName"
          placeholder={t('register.fields.legalName.placeholder')}
          aria-invalid={!!errors.legalName}
          aria-describedby={errors.legalName ? 'legalName-error' : undefined}
          {...register('legalName')}
        />
      </FormField>

      <FormField
        htmlFor="displayName"
        label={t('register.fields.displayName.label')}
        errorId="displayName-error"
        error={fieldErrorMessage(errors.displayName, t)}
      >
        <Input
          id="displayName"
          placeholder={t('register.fields.displayName.placeholder')}
          aria-invalid={!!errors.displayName}
          aria-describedby={errors.displayName ? 'displayName-error' : undefined}
          {...register('displayName')}
        />
      </FormField>

      <FormField
        htmlFor="email"
        label={t('register.fields.email.label')}
        errorId="email-error"
        error={fieldErrorMessage(errors.email, t)}
      >
        <Input
          id="email"
          type="email"
          placeholder={t('register.fields.email.placeholder')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </FormField>

      <FormField
        htmlFor="category"
        label={t('register.fields.category.label')}
        errorId="category-error"
        error={fieldErrorMessage(errors.category, t)}
      >
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              id="category"
              options={BUSINESS_CATEGORY_OPTIONS}
              value={field.value || null}
              onChange={field.onChange}
              placeholder={t('register.fields.category.placeholder')}
              aria-labelledby="category-label"
            />
          )}
        />
      </FormField>

      <FormField
        htmlFor="legalDocumentType"
        label={t('register.fields.legalDocumentType.label')}
        errorId="legalDocumentType-error"
        error={fieldErrorMessage(errors.legalDocumentType, t)}
      >
        <Controller
          name="legalDocumentType"
          control={control}
          render={({ field }) => (
            <Select
              id="legalDocumentType"
              options={LEGAL_DOCUMENT_TYPE_OPTIONS}
              value={field.value || null}
              onChange={field.onChange}
              placeholder={t('register.fields.legalDocumentType.placeholder')}
              aria-labelledby="legalDocumentType-label"
            />
          )}
        />
      </FormField>

      <FormField
        htmlFor="legalDocumentNumber"
        label={t('register.fields.legalDocumentNumber.label')}
        errorId="legalDocumentNumber-error"
        error={fieldErrorMessage(errors.legalDocumentNumber, t)}
      >
        <Input
          id="legalDocumentNumber"
          placeholder={t('register.fields.legalDocumentNumber.placeholder')}
          aria-invalid={!!errors.legalDocumentNumber}
          aria-describedby={errors.legalDocumentNumber ? 'legalDocumentNumber-error' : undefined}
          {...register('legalDocumentNumber')}
        />
      </FormField>

      {/*
        #23 (RN-BIZ-03) — placeholder text only, real legal copy is #61.
        Triple non-binding marker per the locked contract: (a) the
        "[BORRADOR — PENDIENTE]"/"[DRAFT — PENDING]" summary suffix, (b) the
        warning notice below, (c) the body opening with the same statement.
      */}
      <details className="group rounded-xs border border-border bg-paper p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-sans text-xs font-semibold text-ink [&::-webkit-details-marker]:hidden">
          {t('register.agreement.summary')}
          <CaretDown
            aria-hidden="true"
            size={14}
            weight="bold"
            className="shrink-0 text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <p className="rounded-xs bg-surface-alert px-3 py-2 font-sans text-xs text-alert">
            {t('register.agreement.warning')}
          </p>
          <p className="font-sans text-xs text-ink">{t('register.agreement.body')}</p>
        </div>
      </details>

      <FormField
        htmlFor="commercialAgreementAccepted"
        label={t('register.fields.commercialAgreement.label')}
        errorId="commercialAgreementAccepted-error"
        error={fieldErrorMessage(errors.commercialAgreementAccepted, t)}
      >
        <Checkbox
          id="commercialAgreementAccepted"
          aria-invalid={!!errors.commercialAgreementAccepted}
          aria-describedby={
            errors.commercialAgreementAccepted ? 'commercialAgreementAccepted-error' : undefined
          }
          name={agreement.name}
          onBlur={agreement.onBlur}
          ref={agreement.ref}
          onChange={(event) => {
            void agreement.onChange(event)
            setAcceptedAt(event.target.checked ? new Date().toISOString() : null)
          }}
        />
      </FormField>

      {acceptedAt && (
        <p className="font-sans text-xs text-muted">
          <time dateTime={acceptedAt} className="font-mono">
            {t('register.agreement.acceptedAt', {
              date: new Date(acceptedAt),
              formatParams: { date: { dateStyle: 'long', timeStyle: 'short' } },
            })}
          </time>
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('register.submitting') : t('register.submit')}
      </Button>
    </form>
  )
}
