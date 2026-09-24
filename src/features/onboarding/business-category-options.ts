import type { SelectOption } from '@/shared/components/ui/select'

/**
 * Opciones del Select de categoría (#18) para el registro de negocio (#21).
 *
 * 🛑 **OBSOLETO — NO USAR EN CÓDIGO NUEVO.** La taxonomía real existe y
 * está confirmada: vive en `src/shared/schemas/taxonomy.ts`, copiada del
 * enum del backend ya desplegado (`SharedKernel/Domain/Taxonomy/`,
 * RN-TAX-01). Son **6 categorías y 20 subcategorías, y viajan como
 * ENTEROS**, no como slugs de texto.
 *
 * De los valores de esta lista, `entretenimiento`, `compras`, `servicios` y
 * `otro` **no existen** en el backend. Mandar cualquiera de ellos hace que
 * el servidor rechace con 400.
 *
 * Sigue acá solo porque `RegisterForm` (#21) lo consume y ese flujo entero
 * está en revisión: `POST /business/register` tampoco existe — el alta de
 * negocio es `POST /admin/businesses`, operación de admin. Ver
 * `Renata-S-A-S/geoquest#191`. Se borra cuando ese flujo se resuelva.
 *
 * ⚠️ El comentario anterior decía que la taxonomía "no estaba confirmada en
 * Confluence". Era cierto y a la vez engañoso: no estaba en el wiki, pero
 * sí en código. Nadie fue a mirar el backend.
 */
export const BUSINESS_CATEGORY_OPTIONS: SelectOption[] = [
  { label: 'Gastronomía', value: 'gastronomia' },
  { label: 'Alojamiento', value: 'alojamiento' },
  { label: 'Entretenimiento', value: 'entretenimiento' },
  { label: 'Compras', value: 'compras' },
  { label: 'Servicios', value: 'servicios' },
  { label: 'Otro', value: 'otro' },
]
