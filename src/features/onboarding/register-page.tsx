import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { RegisterForm } from '@/features/onboarding/register-form'

/** `/registro` — B-01, issue #21. Fuera de `ProtectedRoute`: un negocio sin cuenta todavía no puede tener sesión. */
export function RegisterPage() {
  const { t } = useTranslation('onboarding')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-4 font-display text-lg font-bold text-ink">{t('register.title')}</h1>
        <RegisterForm />

        {/* Camino de vuelta para un negocio que ya tiene cuenta (#74). */}
        <p className="mt-4 text-center font-sans text-sm text-muted">
          {t('register.haveAccount')}{' '}
          <Link to="/login" className="font-bold text-teal hover:underline">
            {t('register.goToLogin')}
          </Link>
        </p>
      </Card>
    </div>
  )
}
