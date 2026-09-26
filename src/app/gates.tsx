import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { Card } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { StatusBadge } from '@/shared/components/ui/status-badge'
import { SignOutSection } from '@/features/settings/sign-out-section'
import { useIdentityClaims } from '@/shared/hooks/use-identity-claims'
import { useToast } from '@/shared/hooks/use-toast'
import { useMyBusiness, useSubmitLegalDocument } from '@/features/business/queries'
import { UPLOAD_LIMITS, validateUploadFile } from '@/shared/lib/upload-limits'
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

/** Mensaje del reenvío por `title` del problem+json (spec #1547 "Resend rejected by backend state"). */
function resendErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslation<'business'>>['t']
): string {
  if (!axios.isAxiosError(error)) return t('gate.resend.errors.generic')

  const title = error.response?.data?.title as string | undefined
  if (title === 'Business.NotAwaitingVerification') return t('gate.resend.errors.notAwaiting')
  if (error.response?.status === 400) return t('gate.resend.errors.invalidFile')

  return t('gate.resend.errors.generic')
}

/**
 * Negocio `Rejected` — no es terminal (`Business.cs:26,:281`): reenviar el
 * documento (`POST /business/{id}/legal-document`, PR7b) devuelve el negocio
 * a `PendingVerification`. El `204` no trae cuerpo: invalidar `mine` alcanza,
 * `BusinessGateway` cambia de gate solo al releer el estado real.
 */
export function RejectedGate({
  business,
}: {
  business: Pick<MyBusiness, 'businessId' | 'rejectionReason' | 'rejectedAtUtc'>
}) {
  const { t } = useTranslation('business')
  const { success } = useToast()
  const mutation = useSubmitLegalDocument(business.businessId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | undefined>(undefined)
  const limit = UPLOAD_LIMITS.legalDocument
  const errorId = 'rejected-gate-resend-error'
  const errorMessage =
    localError ?? (mutation.isError ? resendErrorMessage(mutation.error, t) : undefined)

  function onFileChosen(file: File) {
    setLocalError(undefined)
    const invalid = validateUploadFile(file, 'legalDocument')
    if (invalid) {
      setLocalError(t('gate.resend.errors.invalidFile'))
      return
    }
    mutation.mutate(file, { onSuccess: () => success(t('gate.resend.success')) })
  }

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

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={limit.acceptedMimeTypes.join(',')}
        aria-label={t('gate.resend.fileInputAria')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileChosen(file)
          // Permite re-elegir el mismo archivo tras un error.
          event.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="primary"
        disabled={mutation.isPending}
        aria-describedby={errorMessage ? errorId : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {mutation.isPending ? t('gate.resend.uploading') : t('gate.resend.cta')}
      </Button>
      {errorMessage && (
        <p id={errorId} role="alert" className="font-sans text-xs text-alert">
          {errorMessage}
        </p>
      )}
    </FullPageGate>
  )
}
