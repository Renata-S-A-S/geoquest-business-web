import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { ThemeSwitcher } from '@/shared/components/theme-switcher'
import { useBusinessStaffMe } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-base font-bold text-ink">{children}</h2>
}

/**
 * Bloque de cuenta — username y correo de acceso, ambos de solo lectura:
 * no existe contrato para editarlos (issue #72). Reusa `useBusinessStaffMe()`
 * (#72, PR4), la misma lectura que ya alimenta el gate de edición de
 * `/negocio`, así que no agrega ningún endpoint nuevo.
 *
 * El fork pending/error/success es independiente del resto de la pantalla
 * (el selector de tema no depende de esta query) — mismo criterio que
 * `BusinessProfileEditPage` (#72 D4): una falla acá nunca debe tumbar una
 * sección que no depende de ella.
 */
function AccountBlock() {
  const { t } = useTranslation('settings')
  const staffQuery = useBusinessStaffMe()

  if (staffQuery.isPending) {
    return (
      <div className="flex min-h-[80px] items-center justify-center">
        <p role="status">{t('user.loading')}</p>
      </div>
    )
  }

  if (staffQuery.isError) {
    return (
      <div className="flex min-h-[80px] flex-col items-center justify-center gap-3 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(staffQuery.error, t('user.errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => staffQuery.refetch()}>
          {t('user.retry')}
        </Button>
      </div>
    )
  }

  const { username, email } = staffQuery.data

  return (
    <>
      {/*
        `username` es una PROPUESTA sin confirmar (issue #72, PR6): viene de
        `GET /business-staff/me` (#72 PR4), que a su vez lo proyecta desde el
        mismo Identity del Explorer — si esa proyección es alcanzable para
        una cuenta que es SOLO BusinessStaff (sin ExplorerProfile) sigue
        siendo la pregunta abierta de `Renata-S-A-S/geoquest#182`. Si la
        respuesta llega negativa, esta fila se elimina y solo queda el
        correo — ver `businessStaffMeSchema` en `schemas/business.ts` para
        la misma advertencia en el origen del dato.
      */}
      <div className="flex flex-col gap-0.5">
        <span className="font-sans text-[11px] font-semibold text-muted">
          {t('user.fields.username.label')}
        </span>
        <p className="font-sans text-sm text-ink">{username}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-sans text-[11px] font-semibold text-muted">
          {t('user.fields.email.label')}
        </span>
        <p className="font-sans text-sm text-ink">{email}</p>
        <p className="font-sans text-[11px] text-muted">{t('user.fields.email.hint')}</p>
      </div>
    </>
  )
}

/**
 * `/configuracion` (issue #72, PR6 — cierra #72). Dos bloques: la
 * identidad de la cuenta (solo lectura) y el selector de tema, que se muda
 * acá completo desde `AccountMenu` (decisión de diseño D5) — un solo
 * componente, un solo call site, sin cambios internos.
 *
 * El logout NO vive acá: la decisión de #70 fue explícita ("el menú puede
 * sumar 'Mi negocio' y 'Configuración' sin mover el logout") y esta
 * pantalla no reabre esa decisión — sigue existiendo una única superficie
 * de cierre de sesión, en `AccountMenu`.
 */
export function SettingsPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-lg font-bold text-ink">{t('title')}</h1>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('user.title')}</SectionTitle>
        <AccountBlock />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('appearance.title')}</SectionTitle>
        <ThemeSwitcher />
      </Card>
    </div>
  )
}
