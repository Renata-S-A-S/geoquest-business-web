import type { BusinessStaffRole } from '@/shared/schemas/business'

/**
 * Gate de edición del perfil del negocio (#72, decisión D4). Solo el
 * Owner edita — Manager/Staff pueden leer `/negocio` pero no ven la
 * afordancia de edición ni pueden usar `/negocio/editar`.
 *
 * Vive en el contenedor de la página (no en `src/app/routes.tsx`, no en el
 * formulario): la lectura no es privilegiada, solo la escritura, así que
 * gatear la ruta le devolvería un 403 a una pantalla que el usuario sí
 * puede ver; y `routes.tsx` está en la lista `exclude` de cobertura de
 * `vitest.config.ts` y no tiene test propio por convención del repo, así
 * que un gate ahí sería intestable contra el gate duro 80/85/75/80.
 *
 * SIN default permisivo (fail-open): `BusinessStaffRole` es un enum
 * cerrado de 3 valores (`businessStaffRoleSchema`), así que no existe un
 * caso "rol desconocido" que resolver acá. Si la lectura del rol falla
 * (`useBusinessStaffMe()` en estado de error), el contenedor toma su rama
 * `isError` existente — la lectura fallida renderiza un error, nunca
 * otorga permiso en silencio.
 *
 * Este gate SIEMPRE pasa hoy en la práctica: el registro (BA-1) crea
 * exactamente un `BusinessStaff` Owner y ningún comando asigna Manager o
 * Staff todavía (gestión de staff adicional, fuera de alcance de #72) —
 * ver "Definiciones de producto para #72". Implementarlo ya es blindaje a
 * futuro: cierra el agujero de autorización antes de que exista gestión
 * de empleados, y el caso no-Owner sigue siendo testeable de forma directa
 * (construyendo el predicado, o el contenedor, con `role: 'Staff'`).
 */
export function canEditBusinessProfile(role: BusinessStaffRole): boolean {
  return role === 'Owner'
}
