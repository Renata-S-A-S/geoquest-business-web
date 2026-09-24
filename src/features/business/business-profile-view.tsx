import type { ReactNode } from 'react'
import { LockSimple } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui/card'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import type { Business } from '@/shared/schemas/business'

/** Variant visual por status — mismo criterio que `pending-page.tsx` (RN-BIZ-01/02 no definen colores, se sigue el criterio de `StatusBadge`, #19). */
const BUSINESS_STATUS_VARIANT: Record<Business['status'], StatusBadgeVariant> = {
  Pending: 'warning',
  Active: 'success',
  Suspended: 'error',
}

/** `trustStatus` (RN-REW-08) no tiene colores citados en Confluence — propuesta del frontend, mismo criterio de contraste que `StatusBadge`. */
const TRUST_STATUS_VARIANT: Record<Business['trustStatus'], StatusBadgeVariant> = {
  Premium: 'success',
  Active: 'neutral',
  UnderReview: 'warning',
  Suspended: 'error',
}

const GOOGLE_MAPS_VERIFIED_VARIANT: Record<'true' | 'false', StatusBadgeVariant> = {
  true: 'success',
  false: 'neutral',
}

export interface BusinessProfileViewProps {
  business: Business
  /**
   * Gate de Owner (issue #72, decisión D4) — decidido por el contenedor
   * (`BusinessProfilePage`, vía `canEditBusinessProfile`), nunca acá: esta
   * vista solo recibe el booleano ya resuelto y decide si renderiza el
   * link. Para un no-Owner, la afordancia simplemente NO se renderiza —
   * nunca un link/botón deshabilitado.
   */
  canEdit: boolean
}

interface ProfileFieldProps {
  label: string
  children: ReactNode
  /**
   * Presente SOLO en los tres campos congelados por la verificación legal
   * (RN-BIZ-01). Es la única señal visual que distingue "congelado por
   * política" de "todavía sin botón de editar" (issue #72) — el resto de
   * los campos de solo lectura (métricas de plataforma, `isInformalBusiness`)
   * se ven exactamente igual que uno editable, porque nunca tuvieron una
   * restricción que explicar.
   */
  frozenHint?: string
}

function ProfileField({ label, children, frozenHint }: ProfileFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-[11px] font-semibold text-muted">{label}</span>
      <div className="font-sans text-sm text-ink">{children}</div>
      {frozenHint && (
        <p className="flex items-center gap-1 font-sans text-[11px] text-muted">
          <LockSimple aria-hidden="true" size={12} weight="fill" className="shrink-0" />
          {frozenHint}
        </p>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-base font-bold text-ink">{children}</h2>
}

/**
 * Presentational — `/negocio` (issue #72). Recibe el `Business` ya resuelto
 * (el contenedor `BusinessProfilePage` hace el fork pending/error/success)
 * y lo agrupa en tres bloques:
 *
 * - **Identidad** (`displayName`, `category`, `email`): editables desde
 *   `/negocio/editar` (#72 PR5) para el Owner. El link de edición (`canEdit`)
 *   vive junto al título de la pantalla, no adentro de esta card — no es un
 *   campo más, es la acción que lleva a editar los tres.
 * - **Legal** (`legalName`, `legalDocumentType`, `legalDocumentNumber`,
 *   `isInformalBusiness`): solo lectura. Los primeros tres quedan
 *   congelados por RN-BIZ-01 (se verificaron contra el documento legal
 *   antes de activar el negocio) y llevan el hint con candado —
 *   `isInformalBusiness` es solo lectura por otra razón (hoy no hay ningún
 *   comando que lo cambie, ver `handlers.ts`) y por eso NO lleva ese hint:
 *   mezclar los dos motivos bajo el mismo candado inventaría una
 *   restricción de RN-BIZ-01 que no existe para este campo.
 * - **Plataforma** (`status`, `trustStatus`, `trustScore`,
 *   `totalRedemptions`, `totalReports`, `isGoogleMapsVerified`,
 *   `commercialAgreementSignedAt`, `createdAt`): datos calculados o
 *   registrados por el servidor. `totalReports` se muestra porque es tan
 *   dato propio del negocio como `trustScore` (que ya se muestra al lado) —
 *   ocultarlo sería menos transparente que mostrar la métrica derivada.
 *   `isGoogleMapsVerified` se muestra acá (y no solo en
 *   `/registro/pendiente`) porque esta pantalla sigue existiendo después de
 *   que el negocio se activa, momento en el que `/registro/pendiente` deja
 *   de visitarse — acá es el único lugar donde ese dato sigue siendo
 *   visible. `googleMapsPlaceId` NO se muestra: es un identificador interno
 *   de Google (como `id`), no contenido para el usuario.
 *
 * `id` e `isPlatformOwned` nunca se renderizan (issue #72 constraints):
 * `id` es un UUID interno sin valor para el usuario, e
 * `isPlatformOwned` solo es `true` para el negocio semilla de la
 * plataforma — nunca aplica a un usuario real del portal.
 */
export function BusinessProfileView({ business, canEdit }: BusinessProfileViewProps) {
  const { t } = useTranslation('business')

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-ink">{t('profile.title')}</h1>
        {canEdit && (
          <Link
            to="/negocio/editar"
            className="font-sans text-xs font-bold text-teal hover:underline"
          >
            {t('profile.editLink')}
          </Link>
        )}
      </div>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('profile.sections.identity.title')}</SectionTitle>
        <ProfileField label={t('profile.fields.displayName.label')}>
          {business.displayName}
        </ProfileField>
        <ProfileField label={t('profile.fields.category.label')}>{business.category}</ProfileField>
        <ProfileField label={t('profile.fields.email.label')}>
          <span>{business.email}</span>
          <p className="mt-0.5 font-sans text-[11px] font-normal text-muted">
            {t('profile.fields.email.hint')}
          </p>
        </ProfileField>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('profile.sections.legal.title')}</SectionTitle>
        <ProfileField
          label={t('profile.fields.legalName.label')}
          frozenHint={t('profile.legalFrozenHint')}
        >
          {business.legalName}
        </ProfileField>
        <ProfileField
          label={t('profile.fields.legalDocumentType.label')}
          frozenHint={t('profile.legalFrozenHint')}
        >
          {business.legalDocumentType}
        </ProfileField>
        <ProfileField
          label={t('profile.fields.legalDocumentNumber.label')}
          frozenHint={t('profile.legalFrozenHint')}
        >
          {business.legalDocumentNumber}
        </ProfileField>
        <ProfileField label={t('profile.fields.isInformalBusiness.label')}>
          {t(`profile.boolean.${String(business.isInformalBusiness)}` as 'profile.boolean.true')}
        </ProfileField>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>{t('profile.sections.platform.title')}</SectionTitle>
        <ProfileField label={t('profile.fields.status.label')}>
          <StatusBadge
            status={business.status}
            variantMap={BUSINESS_STATUS_VARIANT}
            label={t(`profile.status.${business.status}`)}
          />
        </ProfileField>
        <ProfileField label={t('profile.fields.trustStatus.label')}>
          <StatusBadge
            status={business.trustStatus}
            variantMap={TRUST_STATUS_VARIANT}
            label={t(`profile.trustStatusValues.${business.trustStatus}`)}
          />
        </ProfileField>
        <ProfileField label={t('profile.fields.trustScore.label')}>
          {t('profile.fields.trustScore.value', { score: business.trustScore })}
        </ProfileField>
        <ProfileField label={t('profile.fields.totalRedemptions.label')}>
          {business.totalRedemptions}
        </ProfileField>
        <ProfileField label={t('profile.fields.totalReports.label')}>
          {business.totalReports}
        </ProfileField>
        <ProfileField label={t('profile.fields.isGoogleMapsVerified.label')}>
          <StatusBadge
            status={String(business.isGoogleMapsVerified)}
            variantMap={GOOGLE_MAPS_VERIFIED_VARIANT}
            label={t(`profile.googleMapsVerified.${String(business.isGoogleMapsVerified)}`)}
          />
        </ProfileField>
        <ProfileField label={t('profile.fields.commercialAgreementSignedAt.label')}>
          {business.commercialAgreementSignedAt ? (
            <time dateTime={business.commercialAgreementSignedAt} className="font-mono">
              {t('profile.dateFormatted', {
                date: new Date(business.commercialAgreementSignedAt),
                formatParams: { date: { dateStyle: 'long' } },
              })}
            </time>
          ) : (
            t('profile.fields.commercialAgreementSignedAt.empty')
          )}
        </ProfileField>
        <ProfileField label={t('profile.fields.createdAt.label')}>
          <time dateTime={business.createdAt} className="font-mono">
            {t('profile.dateFormatted', {
              date: new Date(business.createdAt),
              formatParams: { date: { dateStyle: 'long' } },
            })}
          </time>
        </ProfileField>
      </Card>
    </div>
  )
}
