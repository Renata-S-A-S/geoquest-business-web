import { z } from 'zod'

/**
 * Contrato REAL de recompensas, copiado del dominio y los DTOs del backend
 * desplegado (`GeoQuest.Modules.Rewards`). Convive con el `rewardSchema`
 * propuesto en `reward.ts`, que se retira en el PR siguiente junto con sus
 * consumidores.
 *
 * ⚠️ **Nueve campos del schema propuesto no existen en el backend**:
 * `type`, `rewardCategory`, `minLevelRequired`, `linkedTouristPlaceId`,
 * `linkedPlaceWindowDays`, `stockRedeemed`, `validFrom`, `validUntil` y
 * `ownTerms`. Y faltaba `description`, que el backend exige.
 *
 * Eso deja varias tareas del backlog sin sustento: #37 (selector de tipo),
 * #39 (General/Special y sus subcampos), la mitad de #41 (vigencia) y #42
 * (T&C propios) son formularios sobre campos inexistentes. Están
 * registradas en `Renata-S-A-S/geoquest#191`.
 *
 * Acá se modela SOLO lo que el backend tiene. Agregar un campo a este
 * archivo sin verificarlo contra `Modules.Rewards` es repetir el problema
 * que esta migración está deshaciendo.
 */

/**
 * `RewardStatus` del backend. Son `Draft | Published | Paused | Archived`.
 *
 * El portal usaba `['Draft','Active','Paused','Exhausted']`: `Active` es en
 * realidad `Published`, `Archived` no estaba contemplado, y **`Exhausted`
 * no existe como estado** — el agotamiento se lee de `stockRemaining`, no
 * de una transición. Mostrar "agotada" sigue siendo válido en la interfaz,
 * pero es un cálculo del cliente, no un valor del servidor.
 */
export const businessRewardStatusSchema = z.enum(['Draft', 'Published', 'Paused', 'Archived'])
export type BusinessRewardStatus = z.infer<typeof businessRewardStatusSchema>

/**
 * Fila del listado de recompensas del negocio.
 *
 * ⚠️ **El path es una propuesta; la forma no.** Los campos salen del
 * dominio real (`Reward.cs`), pero hoy **no existe ningún endpoint que
 * liste las recompensas de un negocio**: el único listado es
 * `GET /rewards`, que es anónimo y **global** — devolvería el catálogo de
 * la competencia. La propuesta registrada en `geoquest#191` es
 * `GET /portal/rewards` autenticado y filtrado por el negocio del
 * llamador.
 *
 * `status`, `stockTotal` y `stockRemaining` existen en el dominio pero no
 * en `RewardSummaryResult` (que es el DTO del browse del explorador). Un
 * listado del portal los necesita, igual que `BusinessPlaceSummaryResult`
 * incluye `status`.
 */
export const businessRewardSummarySchema = z.object({
  rewardId: z.string().uuid(),
  businessId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  geoPointsCost: z.number().int().nonnegative(),
  estimatedValueCop: z.number().nonnegative(),
  status: businessRewardStatusSchema,
  /** `null` = sin límite de stock. */
  stockTotal: z.number().int().nonnegative().nullable(),
  stockRemaining: z.number().int().nonnegative().nullable(),
  /** Opcional en el backend: una recompensa puede no estar atada a un lugar. */
  placeId: z.string().uuid().nullable(),
  menuItemId: z.string().uuid().nullable(),
  /** `null` hasta la primera subida vía `PUT /portal/rewards/{id}/image`. */
  imageUrl: z.string().nullable(),
})
export type BusinessRewardSummary = z.infer<typeof businessRewardSummarySchema>

/**
 * `POST /portal/rewards` → body. Copia exacta de `PublishRewardRequest`.
 *
 * ⚠️ **Nace `Published`, no `Draft`.** El nombre del comando es
 * `PublishRewardCommand` y no hay endpoint de publicación aparte: crear y
 * publicar son el mismo acto. Eso contradice el paso "publica la
 * recompensa" del flujo B-03, que implica un borrador previo, y deja sin
 * sustento a un futuro "guardar como borrador" del lado de recompensas.
 *
 * La imagen no viaja acá: se sube después con
 * `PUT /portal/rewards/{id}/image`, mismo patrón que las fotos de lugar.
 */
export const createBusinessRewardInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  geoPointsCost: z.number().int().positive(),
  estimatedValueCop: z.number().nonnegative(),
  menuItemId: z.string().uuid().nullable(),
  placeId: z.string().uuid().nullable(),
  stockTotal: z.number().int().positive().nullable(),
})
export type CreateBusinessRewardInput = z.infer<typeof createBusinessRewardInputSchema>

/** `POST /portal/rewards` → 201. Devuelve solo el id, como el de lugares. */
export const createdBusinessRewardSchema = z.object({ rewardId: z.string().uuid() })
export type CreatedBusinessReward = z.infer<typeof createdBusinessRewardSchema>

/**
 * Agotamiento como cálculo del cliente, no como estado del servidor.
 *
 * `stockRemaining === null` significa stock ilimitado, no agotado — por eso
 * la comparación no puede ser un simple `!stockRemaining`, que trataría
 * `null` y `0` igual y marcaría como agotada una recompensa sin límite.
 */
export function isRewardOutOfStock(reward: BusinessRewardSummary): boolean {
  return reward.stockRemaining !== null && reward.stockRemaining <= 0
}
