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
 * **Decisión de producto (Derek, 24 sep 2026): la recompensa se crea como
 * `Draft` y se publica en un paso aparte**, manteniendo el flujo B-03.
 *
 * Hoy el backend la crea directamente en `Published` — `Reward.Publish`
 * fija el estado y no hay endpoint de publicación. Pero eso estaba
 * diferido, no descartado: el docstring de `RewardStatus` dice que `Draft`
 * es «transición de work units futuros» y el valor **ya se persiste**.
 *
 * Así que el mock modela el borrador a propósito, siguiendo el precedente
 * de `Place` en el mismo backend (`POST /business/places` crea en `Draft`,
 * `POST /business/places/{id}/publish` transiciona). Es una divergencia
 * DELIBERADA y registrada en `Renata-S-A-S/geoquest#191`, no un descuido:
 * cuando el endpoint exista, solo cambia el transporte.
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

/**
 * `POST /portal/rewards/{id}/publish` → 200.
 *
 * Espejo de `PublishBusinessPlaceResult`: el backend de lugares ya devuelve
 * `{ status, visibleToExplorers }` en su publicación, y no hay motivo para
 * que recompensas invente otra forma.
 */
export const publishBusinessRewardResultSchema = z.object({
  status: businessRewardStatusSchema,
  visibleToExplorers: z.boolean(),
})
export type PublishBusinessRewardResult = z.infer<typeof publishBusinessRewardResultSchema>

/**
 * Precondiciones de publicación, replicadas del precedente de `Place`.
 *
 * Un lugar no se publica sin al menos una foto (409
 * `Place.ActiveRequiresAtLeastOnePhoto`). El paralelo para una recompensa
 * es la imagen: se sube DESPUÉS de crear, así que una recién creada nunca
 * la tiene — publicarla sin imagen la dejaría visible sin nada que
 * mostrar.
 *
 * ⚠️ Es una regla PROPUESTA, no confirmada: está planteada en
 * `geoquest#191` junto con el endpoint. Se modela acá para que la pantalla
 * exista; si el backend decide otra precondición, cambia esta función y
 * nada más.
 */
export function canPublishReward(reward: BusinessRewardSummary): boolean {
  return reward.status === 'Draft' && reward.imageUrl !== null
}
