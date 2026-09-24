import axios from 'axios'
import { Controller, useForm, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { Select } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { BUSINESS_CATEGORY_OPTIONS } from '@/features/onboarding/business-category-options'
import { useUpdateBusinessMe } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import type { Business } from '@/shared/schemas/business'

/**
 * Fábrica de schema, no un schema estático (issue #72, mismo criterio que
 * `createEditUsernameSchema` en el `edit-profile-page.tsx` del Explorer):
 * zod fija sus strings de mensaje en el momento de la construcción, así que
 * un schema creado una sola vez a nivel de módulo congelaría su copia de
 * validación en el idioma que estuviera activo en el primer import.
 * `BusinessProfileForm` lo reconstruye desde el `t` actual en cada render.
 *
 * A diferencia de `updateBusinessMeInputSchema` (el contrato de `PATCH
 * /business/me`, con las tres claves opcionales porque un PATCH puede
 * omitir cualquiera), este schema de formulario las exige todas: el form
 * siempre las precarga y las reenvía completas, nunca un subconjunto.
 */
function createUpdateBusinessSchema(t: TFunction<'business'>) {
  return z.object({
    displayName: z
      .string()
      .min(1, t('editForm.validation.required'))
      .max(120, t('editForm.validation.required')),
    category: z.string().min(1, t('editForm.validation.required')),
    email: z
      .string()
      .min(1, t('editForm.validation.required'))
      .email(t('editForm.validation.email')),
  })
}
type BusinessProfileFormValues = z.infer<ReturnType<typeof createUpdateBusinessSchema>>

/**
 * Traduce el `type` que deja `@hookform/resolvers/zod` en un `FieldError` de
 * este formulario — copia local intencional (mismo criterio que
 * `login-page.tsx`/`register-form.tsx`: el helper es module-private en cada
 * uno para no cruzar el límite de Vertical Slice). `email` es el único
 * campo con un formato propio (`invalid_string`); el resto cae al genérico
 * "requerido".
 */
function fieldErrorMessage(
  error: FieldError | undefined,
  t: TFunction<'business'>
): string | undefined {
  if (!error) return undefined
  if (error.type === 'invalid_string') return t('editForm.validation.email')
  return t('editForm.validation.required')
}

/**
 * Mensaje de error de la mutación — issue #72. El 409 `ReadOnlyField`
 * (contratos-portal-b2b.md §2.1.1) es, en teoría, irreproducible desde este
 * formulario porque nunca envía un campo congelado — pero si de todas
 * formas llega (backend real más estricto, drift futuro del contrato), el
 * usuario debe enterarse de POR QUÉ se rechazó el cambio, no ver el mismo
 * mensaje genérico que una falla de conectividad.
 */
function editErrorMessage(error: unknown, t: TFunction<'business'>): string {
  const isReadOnlyConflict = axios.isAxiosError(error) && error.response?.status === 409
  return getProblemDetailsMessage(
    error,
    isReadOnlyConflict ? t('editForm.errors.readOnlyField') : t('editForm.errors.generic')
  )
}

export interface BusinessProfileFormProps {
  business: Business
}

/**
 * Formulario de `/negocio/editar` (issue #72, PR5) — recibe el `Business`
 * ya resuelto por el contenedor (`BusinessProfileEditPage`, que hace el
 * fork pending/error/no-Owner/form, decisión D4) y precarga exactamente el
 * subconjunto editable confirmado por el Product Owner: `displayName`,
 * `category`, `email`. Ningún campo de solo lectura se renderiza, ni
 * siquiera deshabilitado — ver `updateBusinessMeInputSchema`/
 * `BUSINESS_READONLY_FIELDS` en `shared/schemas/business.ts`.
 *
 * `email` acá es el CONTACTO PÚBLICO del negocio, NO la credencial de
 * acceso del `BusinessStaff` que inicia sesión — mismo aclarado que
 * `patch-business-me.ts` y `business-profile-view.tsx`.
 *
 * Guardado NO optimista (regla verificada del Explorer, portable point 6):
 * en éxito, `useUpdateBusinessMe()` ya dejó la cache de `businessKeys.me`
 * con la respuesta completa del servidor (ver `queries.ts`) y acá solo
 * queda navegar de vuelta a `/negocio`. El error se muestra vía toast
 * (`useToast().error`), igual que `login-page.tsx`/`register-form.tsx` —
 * los errores de QUERY (lectura) van inline con `role="alert"`
 * (`business-profile-page.tsx`), los de MUTACIÓN (escritura) van a toast:
 * mismo criterio ya establecido en este repo para cada tipo.
 */
export function BusinessProfileForm({ business }: BusinessProfileFormProps) {
  const { t } = useTranslation('business')
  const navigate = useNavigate()
  const toast = useToast()
  const updateBusinessMe = useUpdateBusinessMe()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(createUpdateBusinessSchema(t)),
    defaultValues: {
      displayName: business.displayName,
      category: business.category,
      email: business.email,
    },
  })

  const onSubmit = (values: BusinessProfileFormValues) => {
    updateBusinessMe.mutate(values, {
      onSuccess: () => navigate('/negocio'),
      onError: (error) => toast.error(editErrorMessage(error, t)),
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-lg font-bold text-ink">{t('editForm.title')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField
          htmlFor="displayName"
          label={t('editForm.fields.displayName.label')}
          errorId="displayName-error"
          error={fieldErrorMessage(errors.displayName, t)}
        >
          <Input
            id="displayName"
            aria-invalid={!!errors.displayName}
            aria-describedby={errors.displayName ? 'displayName-error' : undefined}
            {...register('displayName')}
          />
        </FormField>

        <FormField
          htmlFor="category"
          label={t('editForm.fields.category.label')}
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
                placeholder={t('editForm.fields.category.placeholder')}
                aria-labelledby="category-label"
              />
            )}
          />
        </FormField>

        <FormField
          htmlFor="email"
          label={t('editForm.fields.email.label')}
          errorId="email-error"
          error={fieldErrorMessage(errors.email, t)}
        >
          <Input
            id="email"
            type="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          <p className="mt-0.5 font-sans text-[11px] text-muted">
            {t('editForm.fields.email.hint')}
          </p>
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={updateBusinessMe.isPending}>
            {updateBusinessMe.isPending ? t('editForm.submitting') : t('editForm.submit')}
          </Button>
          <Link to="/negocio" className="font-sans text-xs font-bold text-teal hover:underline">
            {t('editForm.cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}
