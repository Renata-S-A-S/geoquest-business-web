import { useMyBusiness } from './queries'
import type { MyBusinessStatus } from '@/shared/schemas/business'

/**
 * Id del banner persistente Paused/Suspended (`BusinessStatusBanner`,
 * `app/layout/business-status-banner.tsx`) — todo control de escritura
 * apunta acá vía `aria-describedby` (PR8b, addendum de a11y #1548).
 */
export const BUSINESS_WRITE_BLOCK_ID = 'business-write-block'

export type BusinessAccessReason = 'paused' | 'suspended'

export interface BusinessAccess {
  canWrite: boolean
  reason: BusinessAccessReason | undefined
  bannerId: string
}

const REASON_BY_STATUS: Partial<Record<MyBusinessStatus, BusinessAccessReason>> = {
  Paused: 'paused',
  Suspended: 'suspended',
}

/**
 * Deriva el permiso de escritura del negocio a partir de `useMyBusiness()`
 * (design #1549 "Write access"). `PendingVerification`/`Rejected`/sin
 * negocio nunca llegan acá — `BusinessGateway` los intercepta antes de
 * montar `AppShell` (spec #1547 dominio `business-gateway`), así que solo
 * `Active`/`Paused`/`Suspended` son estados posibles en este hook.
 *
 * Decisión del owner #1546 punto 1: Paused Y Suspended bloquean TODA
 * acción, incluidos lookup/scan de canje — sin excepción de "algunas
 * escrituras permitidas".
 */
export function useBusinessAccess(): BusinessAccess {
  const { data } = useMyBusiness()
  const reason = data ? REASON_BY_STATUS[data.status] : undefined

  return { canWrite: reason === undefined, reason, bannerId: BUSINESS_WRITE_BLOCK_ID }
}
