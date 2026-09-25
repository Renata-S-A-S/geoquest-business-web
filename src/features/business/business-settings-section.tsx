import { useState, type ReactNode } from 'react'
import { CaretDown, CaretUp, LockSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { useBusinessMe } from '@/features/business/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import type { Business } from '@/shared/schemas/business'

const BUSINESS_STATUS_VARIANT: Record<Business['status'], StatusBadgeVariant> = {
  Pending: 'warning',
  Active: 'success',
  Suspended: 'error',
}

interface ReadOnlyFieldProps {
  label: string
  children: ReactNode
  /**
   * Leyenda de campo congelado. **Solo para los tres campos que RN-BIZ-01
   * congela** (`legalName`, `legalDocumentType`, `legalDocumentNumber`).
   *
   * No se le pone a `isInformalBusiness`, que también es no editable pero por
   * otro motivo: nada lo escribe. El candado es una promesa concreta —«esto
   * nunca va a cambiar, y este es el motivo legal»— y ponerlo donde el motivo
   * es distinto le miente al usuario. Un solo lenguaje visual, un solo
   * significado.
   */
  frozenHint?: string
}

function ReadOnlyField({ label, children, frozenHint }: ReadOnlyFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-[11px] font-semibold text-muted">{label}</span>
      <div className="font-sans text-sm text-ink">{children}</div>
      {frozenHint && (
        <p className="flex items-start gap-1 font-sans text-[11px] text-muted">
          <LockSimple size={12} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
          {frozenHint}
        </p>
      )}
    </div>
  )
}

/**
 * Bloque «Mi negocio» dentro de `/configuracion` — fusión de la pantalla
 * `/negocio`, que dejó de tener pestaña propia (decisión de Derek, 24 sep
 * 2026, con análisis de UX).
 *
 * El motivo: de los 18 campos que mostraba, 3 eran editables —y su `PATCH`
 * no existe en el backend—, 4 son identidad legal congelada, y el resto eran
 * métricas. Una pantalla de datos de referencia con un formulario roto
 * encima no gana una pestaña; las pestañas son para bucles operativos
 * (lugares, recompensas, canjes, analítica).
 *
 * **Sin acción de editar.** `PATCH /business/me` es una propuesta del
 * frontend sin contraparte en el backend, y los tres campos que editaba
 * tampoco existen en la entidad real. El link funcionaba solo porque está
 * mockeado, que es justo la trampa: se ve bien en desarrollo y da 404 en
 * cualquier entorno real. Un botón roto y alcanzable es peor que ningún
 * botón.
 *
 * `business-profile-form.tsx` y `business-profile-edit-page.tsx` se dejan en
 * el árbol, sin ruta: están completos y correctos. El día que el `PATCH`
 * exista, se vuelve a enlazar el formulario y esta decisión se revierte sin
 * rediseñar nada. Ver `Renata-S-A-S/geoquest#191`.
 *
 * ⚠️ **Falta el banner de estado de verificación**, que es lo que le daría
 * sentido a haber quitado la pestaña: un negocio suspendido o rechazado
 * tiene algo urgente que leer, y lo urgente no se pone detrás de una
 * pestaña que hay que acordarse de visitar. No se puede construir todavía:
 * el `Business` del portal no tiene `rejectionReason`, `hasLegalDocument`,
 * `legalDocumentWaived` ni `hasVerificationVideo`, y su enum de estado no
 * tiene `Rejected`. El backend real sí los tiene.
 *
 * Y cuando exista, hace falta además un token de superficie de advertencia:
 * hoy la variante `warning` cae a `bg-surface-skeleton`, así que un banner
 * de «falta algo» se leería como un cargando.
 */
export function BusinessSettingsSection() {
  const { t } = useTranslation('business')
  const [legalOpen, setLegalOpen] = useState(false)
  const businessQuery = useBusinessMe()

  if (businessQuery.isPending) {
    return (
      <div className="flex min-h-[80px] items-center justify-center">
        <p role="status">{t('profile.loading')}</p>
      </div>
    )
  }

  if (businessQuery.isError) {
    return (
      <div className="flex min-h-[80px] flex-col items-center justify-center gap-3 text-center">
        <p role="alert" className="font-sans text-xs text-alert">
          {getProblemDetailsMessage(businessQuery.error, t('profile.errors.generic'))}
        </p>
        <Button variant="primary" onClick={() => businessQuery.refetch()}>
          {t('profile.retry')}
        </Button>
      </div>
    )
  }

  const business = businessQuery.data

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <ReadOnlyField label={t('profile.fields.displayName.label')}>
          {business.displayName}
        </ReadOnlyField>
        <StatusBadge
          status={business.status}
          variantMap={BUSINESS_STATUS_VARIANT}
          label={t(`profile.status.${business.status}`)}
        />
      </div>

      <ReadOnlyField label={t('profile.fields.category.label')}>{business.category}</ReadOnlyField>

      <ReadOnlyField label={t('profile.fields.email.label')}>
        <span>{business.email}</span>
        <p className="mt-0.5 font-sans text-[11px] text-muted">{t('profile.fields.email.hint')}</p>
      </ReadOnlyField>

      {/*
        Los datos legales arrancan colapsados. Es el mismo criterio que
        justificó quitar la pestaña, aplicado un nivel más abajo: son datos de
        referencia que casi nadie consulta en el día a día, y expandidos suman
        unos 200px de scroll en un teléfono por delante de nada accionable.

        El costo es un toque extra para quien vino justamente a verificar su
        NIT. Es aceptable para datos que no son el motivo del 95% de las
        visitas, y es reversible si resulta que la gente los expande siempre.
      */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setLegalOpen((open) => !open)}
          aria-expanded={legalOpen}
          className="flex items-center gap-1 font-sans text-xs font-bold text-teal hover:underline"
        >
          {legalOpen ? t('profile.legalToggle.hide') : t('profile.legalToggle.show')}
          {legalOpen ? (
            <CaretUp size={14} aria-hidden="true" />
          ) : (
            <CaretDown size={14} aria-hidden="true" />
          )}
        </button>

        {legalOpen && (
          <div className="mt-3 flex flex-col gap-3">
            <ReadOnlyField
              label={t('profile.fields.legalName.label')}
              frozenHint={t('profile.legalFrozenHint')}
            >
              {business.legalName}
            </ReadOnlyField>
            <ReadOnlyField
              label={t('profile.fields.legalDocumentType.label')}
              frozenHint={t('profile.legalFrozenHint')}
            >
              {business.legalDocumentType}
            </ReadOnlyField>
            <ReadOnlyField
              label={t('profile.fields.legalDocumentNumber.label')}
              frozenHint={t('profile.legalFrozenHint')}
            >
              {business.legalDocumentNumber}
            </ReadOnlyField>
            {/* Sin candado: no editable por otro motivo, ver `ReadOnlyField`. */}
            <ReadOnlyField label={t('profile.fields.isInformalBusiness.label')}>
              {t(
                `profile.boolean.${String(business.isInformalBusiness)}` as 'profile.boolean.true'
              )}
            </ReadOnlyField>
          </div>
        )}
      </div>
    </>
  )
}
