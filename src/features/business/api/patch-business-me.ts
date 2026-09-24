import { apiClient } from '@/shared/lib/api-client'
import {
  businessSchema,
  type Business,
  type UpdateBusinessMeInput,
} from '@/shared/schemas/business'

/**
 * `PATCH /business/me` — issue #72 (PR3). Ver contratos-portal-b2b.md
 * §2.1.1 para el contrato completo.
 *
 * `email` acá es el CONTACTO PÚBLICO del negocio (ej. `contacto@cafe70.co`),
 * NO la credencial de acceso del `BusinessStaff` que inicia sesión (esa
 * vive en Identity y no tiene endpoint de edición propuesto en este PR) —
 * confundirlas sería un bug de seguridad, no una decisión de alcance.
 *
 * Devuelve el agregado `Business` completo (no un eco del patch), igual
 * que `getBusinessMe`, para que quien llame pueda reemplazar su caché con
 * la verdad del servidor en vez de adivinar el resultado del merge.
 *
 * Sin `skipSessionAuth`: a diferencia de `registerBusiness` (dispara antes
 * de que exista sesión), esta mutación la ejecuta un `BusinessStaff` ya
 * autenticado — mismo criterio que `getBusinessMe`.
 */
export async function patchBusinessMe(input: UpdateBusinessMeInput): Promise<Business> {
  const { data } = await apiClient.patch('/business/me', input)
  return businessSchema.parse(data)
}
