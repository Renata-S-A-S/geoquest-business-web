import axios from 'axios'
import { useForm, type FieldError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { loginInputSchema, type LoginInput } from '@/shared/schemas/auth'
import { login } from '@/features/auth/api/login'
import { useSession } from '@/shared/hooks/use-session'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'

const defaultValues: LoginInput = { email: '', password: '' }

/**
 * Traduce el `type` que deja `@hookform/resolvers/zod` en un `FieldError` de
 * este formulario — copia local intencional de la de `register-form.tsx`
 * (ese helper es module-private ahí; importarlo cruzaría el límite de
 * Vertical Slice entre `features/onboarding` y `features/auth`). Mismo
 * criterio: `invalid_string` es el único error posible de `email`
 * (formato); todo lo demás es "requerido".
 */
function fieldErrorMessage(
  error: FieldError | undefined,
  t: TFunction<'auth'>
): string | undefined {
  if (!error) return undefined
  if (error.type === 'invalid_string') return t('login.validation.email')
  return t('login.validation.required')
}

/** Pantalla de login de BusinessStaff — issue #28. */
export function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const toast = useToast()
  const { isAuthenticated } = useSession()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues,
  })

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (tokens) => {
      useBusinessSessionStore.getState().login(tokens)
      navigate('/', { replace: true })
    },
    onError: (error) => {
      // 401 → credencial rechazada; cualquier otra falla (sin `response`,
      // body no parseable) → mensaje de conectividad. Ver design decision 3:
      // ambas ramas se conservan a propósito, distinguir "contraseña
      // incorrecta" de "el servidor no responde" es lo que hace usable esta
      // pantalla.
      const rejected = axios.isAxiosError(error) && error.response?.status === 401
      toast.error(
        getProblemDetailsMessage(
          error,
          rejected ? t('login.errors.invalidCredentials') : t('login.errors.generic')
        )
      )
    },
  })

  // Visitante ya autenticado (localStorage persistido, #20) → afuera antes
  // de renderizar el formulario. Vive acá y no en `routes.tsx`: ese archivo
  // está en la lista `exclude` de cobertura y no tiene test propio, así que
  // su comportamiento no es testeable por convención del repo.
  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="flex h-dvh items-center justify-center bg-cream p-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface-raised p-6">
        <h1 className="mb-4 font-display text-lg font-bold text-ink">{t('login.title')}</h1>
        <form
          onSubmit={handleSubmit((input) => mutation.mutate(input))}
          noValidate
          className="flex flex-col gap-4"
        >
          <FormField
            htmlFor="email"
            label={t('login.fields.email.label')}
            errorId="email-error"
            error={fieldErrorMessage(errors.email, t)}
          >
            <Input
              id="email"
              type="email"
              placeholder={t('login.fields.email.placeholder')}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
          </FormField>

          <FormField
            htmlFor="password"
            label={t('login.fields.password.label')}
            errorId="password-error"
            error={fieldErrorMessage(errors.password, t)}
          >
            <Input
              id="password"
              type="password"
              placeholder={t('login.fields.password.placeholder')}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
          </FormField>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>

        {/* Sin esto `/registro` sería inalcanzable navegando: es la única
            entrada al alta de un negocio nuevo (#74). */}
        <p className="mt-4 text-center font-sans text-sm text-muted">
          {t('login.noAccount')}{' '}
          <Link to="/registro" className="font-bold text-teal hover:underline">
            {t('login.goToRegister')}
          </Link>
        </p>
      </div>
    </div>
  )
}
