import { CaretDown } from '@phosphor-icons/react'

/**
 * Las tres props son obligatorias a propósito: el contrato de marcado
 * "no vinculante" (#61) queda garantizado por tipos, no por convención de
 * copiar y pegar — no se puede renderizar un disclosure que omita el slot
 * de warning.
 */
export type LegalDisclosureProps = {
  summary: string
  warning: string
  body: string
}

/**
 * Bloque legal reutilizable — extraído de #23 (RN-BIZ-03) al agregar un
 * segundo consumidor en #24. El texto es un placeholder; la copia legal
 * real es #61. Triple marcador de no-vinculante por contrato de props: (a)
 * el sufijo "[BORRADOR — PENDIENTE]"/"[DRAFT — PENDING]" en `summary`, (b)
 * el aviso de `warning`, (c) el cuerpo de `body`, que empieza con el mismo
 * aviso.
 */
export function LegalDisclosure({ summary, warning, body }: LegalDisclosureProps) {
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
          {warning}
        </p>
        <p className="font-sans text-xs text-ink">{body}</p>
      </div>
    </details>
  )
}
