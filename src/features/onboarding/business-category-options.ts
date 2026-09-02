import type { SelectOption } from '@/shared/components/ui/select'

/**
 * Opciones del Select de categoría (#18) para el registro de negocio (#21).
 *
 * ⚠️ NO CONFIRMADO: no existe ninguna taxonomía de categorías de negocio en
 * Confluence ni en `contratos-portal-b2b.md` — `Business.category` es
 * `z.string()` libre a propósito (ver `business.ts`). Esta lista reutiliza
 * el único valor que sí aparece en el ERD/seeds (`gastronomia`, en
 * `seed.ts`) y propone el resto por analogía con categorías típicas de
 * comercio local. Confirmar con Derek/producto antes de considerar esto
 * definitivo — ver BL-014/nota abierta en 🗂️ Tablero SDD.
 */
export const BUSINESS_CATEGORY_OPTIONS: SelectOption[] = [
  { label: 'Gastronomía', value: 'gastronomia' },
  { label: 'Alojamiento', value: 'alojamiento' },
  { label: 'Entretenimiento', value: 'entretenimiento' },
  { label: 'Compras', value: 'compras' },
  { label: 'Servicios', value: 'servicios' },
  { label: 'Otro', value: 'otro' },
]
