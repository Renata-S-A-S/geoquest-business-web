import { Controller, useForm, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  return t('register.validation.required')
}

/** Formulario de registro de negocio — B-01, issue #21. */
export function RegisterForm() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const toast = useToast()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterBusinessInput>({
    resolver: zodResolver(registerBusinessInputSchema),
    defaultValues,
  })

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

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('register.submitting') : t('register.submit')}
      </Button>
    </form>
  )
}
