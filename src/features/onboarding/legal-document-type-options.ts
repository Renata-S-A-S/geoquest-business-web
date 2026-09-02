import type { SelectOption } from '@/shared/components/ui/select'
import { legalDocumentTypeSchema } from '@/shared/schemas/business'

/**
 * Opciones del Select de tipo de documento legal (RN-BIZ-01, ya confirmado
 * — a diferencia de `business-category-options.ts`). Derivadas del propio
 * enum de `business.ts` para no duplicar la lista de valores válidos.
 */
export const LEGAL_DOCUMENT_TYPE_OPTIONS: SelectOption[] = legalDocumentTypeSchema.options.map(
  (value) => ({ label: value, value })
)
