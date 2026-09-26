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
 * `POST /portal/businesses/{businessId}/rewards` — issues #38, #40 y #41.
 *
 * ✅ **Ruta REAL, verificada** en `Api/PortalRewardsEndpoints.cs:26,29`
 * contra backend `main` @ `ea471f4`. Antes llamaba a `POST /portal/rewards`,
 * **eliminada** por los PRs #195–#201 sin alias: la creación estaba rota
 * contra el backend real.
 *
 * ✅ Publish-on-create (#204): este endpoint crea la recompensa directamente
 * en `Published` (su handler se llama `PublishAsync`), y el mock hace lo
 * mismo. La decisión previa de mantener un borrador intermedio se revirtió;
 * no hay ningún endpoint de publicación aparte.
 *
 * `menuItemId` se envía siempre `null`, que el backend acepta
 * explícitamente ("publish w/o menuItemId succeeds").
 *
 * La imagen no viaja acá: se sube después con
 * `PUT /portal/businesses/{businessId}/rewards/{rewardId}/image`, mismo
 * patrón que las fotos de lugar.
 */
export async function createReward(
  businessId: string,
  input: CreateRewardFormInput
): Promise<CreatedBusinessReward> {
  const { data } = await apiClient.post(`/portal/businesses/${businessId}/rewards`, {
    ...input,
    menuItemId: null,
  })
  return createdBusinessRewardSchema.parse(data)
}
