import { CaretDown } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

export type LegalDisclosureProps = {
  summary: string
  body: string
  /**
   * Aviso de no-vinculante. Opcional: si se omite, el componente usa el
   * genérico de `common.legal.nonBindingWarning`. El slot NO se puede
   * apagar — esa es la garantía de #61: no existe forma de renderizar un
   * bloque legal sin aviso, ni olvidándose de la prop.
   *
   * Conviene pasar uno específico igual, porque nombra el documento
   * concreto ("no constituye un acuerdo comercial vinculante") en vez del
   * genérico. El default es una red de seguridad, no el camino esperado.
   */
  warning?: string
}

/**
 * Bloque legal reutilizable — extraído de #23 (RN-BIZ-03) al agregar un
 * segundo consumidor en #24. El texto es un placeholder; la copia legal
 * real es #61. Triple marcador de no-vinculante: (a) el sufijo
 * "[BORRADOR — PENDIENTE]"/"[DRAFT — PENDING]" en `summary`, (b) el aviso
 * de `warning`, que siempre se renderiza, (c) el cuerpo de `body`, que
 * empieza con el mismo aviso.
 */
export function LegalDisclosure({ summary, warning, body }: LegalDisclosureProps) {
  const { t } = useTranslation('common')

  return (
    <details className="group rounded-xs border border-border bg-paper p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-sans text-xs font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <CaretDown
          aria-hidden="true"
          size={14}
          weight="bold"
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="rounded-xs bg-surface-alert px-3 py-2 font-sans text-xs text-alert">
          {warning ?? t('legal.nonBindingWarning')}
        </p>
        <p className="font-sans text-xs text-ink">{body}</p>
      </div>
    </details>
  )
}
