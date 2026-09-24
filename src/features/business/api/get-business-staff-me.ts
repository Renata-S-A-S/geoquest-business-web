import { apiClient } from '@/shared/lib/api-client'
import { businessStaffMeSchema, type BusinessStaffMe } from '@/shared/schemas/business'

/**
 * `GET /business-staff/me` — issue #72 (PR4). Ver contratos-portal-b2b.md
 * §2.1.2 para el contrato completo. Resuelve la identidad del
 * `BusinessStaff` autenticado (incluyendo `username`, proyectado desde
 * Identity — ver JSDoc de `businessStaffMeSchema`): es la fuente tanto del
 * gate de edición Owner-only (`canEditBusinessProfile`, D4) como del
 * bloque de usuario en `/configuracion` (PR6).
 *
 * Mirror de `get-business-me.ts` en cuanto a forma: sin `skipSessionAuth`,
 * porque esta llamada la dispara un `BusinessStaff` ya autenticado, no un
 * flujo previo a la sesión.
 */
export async function getBusinessStaffMe(): Promise<BusinessStaffMe> {
  const { data } = await apiClient.get('/business-staff/me')
  return businessStaffMeSchema.parse(data)
}
