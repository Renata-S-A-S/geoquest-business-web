import { apiClient } from '@/shared/lib/api-client'
import {
  createdBusinessRewardSchema,
  type CreateBusinessRewardInput,
  type CreatedBusinessReward,
} from '@/shared/schemas/business-reward'

/**
 * Subconjunto que el FORMULARIO recoge del usuario.
 *
 * Omite `menuItemId` porque ese campo apunta a una entidad `MenuItem` que
 * **no existe en ninguna parte del backend** — ni clase, ni tabla, ni FK, ni
 * endpoint. Reportado en `Renata-S-A-S/geoquest#191`. Ofrecer un selector de
 * ítem de menú sería pedirle al negocio que elija de una lista que no puede
 * existir.
 */
export type CreateRewardFormInput = Omit<CreateBusinessRewardInput, 'menuItemId'>

/**
 * `POST /portal/rewards` — issues #38, #40 y #41 (B-03).
 *
 * ⚠️ **El path es una propuesta; la forma no.** Hoy el backend crea la
 * recompensa directamente en `Published`. La decisión de producto (Derek,
 * 24 sep 2026) es mantener el flujo B-03 con borrador previo, así que el
 * mock la crea en `Draft` y la publicación es aparte. Divergencia
 * deliberada, registrada en `geoquest#191` — ahí está también el argumento
 * de por qué es barata: `RewardStatus.Draft` ya existe y ya se persiste.
 *
 * `menuItemId` se envía siempre `null`, que el backend acepta
 * explícitamente ("publish w/o menuItemId succeeds").
 *
 * La imagen no viaja acá: se sube después con
 * `PUT /portal/rewards/{id}/image`, mismo patrón que las fotos de lugar.
 */
export async function createReward(input: CreateRewardFormInput): Promise<CreatedBusinessReward> {
  const { data } = await apiClient.post('/portal/rewards', { ...input, menuItemId: null })
  return createdBusinessRewardSchema.parse(data)
}
