import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { StatusBadge } from '@/shared/components/ui/status-badge'
import { SignOutSection } from '@/features/settings/sign-out-section'
import { useIdentityClaims } from '@/shared/hooks/use-identity-claims'
import { useMyBusiness } from '@/features/business/queries'
import type { MyBusiness } from '@/shared/schemas/business'

/**
 * Pantallas de callejón sin salida de `BusinessGateway` (spec #1547 dominio
 * `business-gateway`) — sin negocio, en verificación, no aprobado. Un solo
 * archivo a propósito (presupuesto de revisión HARD 400 líneas de esta
 * tarea): son tres variantes chicas del mismo layout, no tres features
 * independientes.
 *
 * `FullPageGate` cubre el addendum de a11y #1548: mueve el foco al `h1` al
 * montar (`tabIndex={-1}` + `focus()`) para que un lector de pantalla
 * anuncie el contexto de inmediato, y siempre ofrece `SignOutSection` (el
 * mismo componente ya testeado de `/configuracion`) como única salida.
 */
function FullPageGate({ title, children }: { title: string; children?: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <Card className="flex w-full max-w-md flex-col gap-4">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-bold text-ink focus:outline-none"
        >
          {title}
        </h1>
        {children}
        <SignOutSection />
      </Card>
    </div>
  )
}

/**
 * Explorador autenticado sin negocio propio (`/business/mine` → `[]`). El
 * alta autogestionada ("Registrar mi negocio", capability `registration`)
 * es PR10 — acá solo se informa el estado con el email de sesión
 * (`useIdentityClaims()`, PR2) y se ofrece cerrar sesión.
 */
export function NoBusinessGate() {
  const { t } = useTranslation('business')
  const claims = useIdentityClaims()

  return (
    <FullPageGate title={t('profile.errors.noBusiness')}>
      {claims && (
        <p className="font-sans text-xs text-muted">
          {t('gate.sessionEmail', { email: claims.email })}
        </p>
      )}
    </FullPageGate>
  )
}

const PENDING_VARIANT = { PendingVerification: 'warning' } as const

/** Negocio `PendingVerification`: SLA + refresh manual, sin el branch rápido/reforzado (#25, sin campo real). */
export function PendingVerificationGate() {
  const { t } = useTranslation('business')
  const { isFetching, refetch } = useMyBusiness()

  return (
    <FullPageGate title={t('gate.pending.title')}>
      <StatusBadge
        status="PendingVerification"
        variantMap={PENDING_VARIANT}
        label={t('profile.status.PendingVerification')}
      />
      <p className="font-sans text-xs text-ink">{t('onboarding:pending.sla')}</p>
      <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
        {isFetching ? t('onboarding:pending.refreshing') : t('onboarding:pending.refresh')}
      </Button>
    </FullPageGate>
  )
}

/**
 * Negocio `Rejected` — no es terminal (`Business.cs:26,:281`): reenviar el
 * documento legal (`POST /business/{id}/legal-document`) devuelve el
 * negocio a `PendingVerification`. Ese reenvío es PR7b; acá el slot queda
 * documentado y sin ocupar, no hay ninguna acción de reenvío todavía.
 */
export function RejectedGate({
  business,
}: {
  business: Pick<MyBusiness, 'rejectionReason' | 'rejectedAtUtc'>
}) {
  const { t } = useTranslation('business')

  return (
    <FullPageGate title={t('onboarding:pending.resolved.Rejected.title')}>
      {business.rejectionReason && (
        <p className="break-words font-sans text-xs text-ink">{business.rejectionReason}</p>
      )}
      {business.rejectedAtUtc && (
        <p className="font-sans text-[11px] text-muted">
          {t('profile.rejectedAt', {
            date: new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
              new Date(business.rejectedAtUtc)
            ),
          })}
        </p>
      )}
      {/* PR7b agrega acá "Reenviar documento". */}
    </FullPageGate>
  )
}
