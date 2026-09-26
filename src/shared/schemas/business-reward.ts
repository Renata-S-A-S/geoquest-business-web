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
 *
 * ---
 *
 * ⚠️ **EL PORTAL MEZCLA HOY DOS CONVENCIONES DE RESOLUCIÓN DE NEGOCIO, y es
 * transitorio.**
 *
 * - Las rutas VIEJAS resuelven el negocio **desde la sesión**: el cliente no
 *   manda ningún id (`GET /business/me`, `GET /business/places`, …).
 * - Las rutas NUEVAS de recompensas lo llevan **en el path**:
 *   `/portal/businesses/{businessId}/rewards…`.
 *
 * El `businessId` que viaja en el path de las rutas nuevas se resuelve con
 * `useMyBusiness()` (real-backend-readiness PR6a), que ya lee `GET
 * /business/mine` — el **array** de negocios que el backend expone, porque un
 * dueño puede tener más de uno — y usa `useMyBusiness().data?.businessId` del
 * primer elemento.
 *
 * Seguimiento: `Renata-S-A-S/geoquest#191` (auditoría del contrato) y
 * `Renata-S-A-S/geoquest#203` (bootstrap del `businessId`).
 */

/**
 * `RewardStatus` del backend: `Draft | Published | Paused | Archived |
 * Exhausted`. Verificado en `Domain/RewardStatus.cs` contra backend `main`
 * @ `ea471f4`.
 *
 * **`Exhausted` SÍ existe como estado del servidor**, al revés de lo que
 * decía este archivo. Llegó con los PRs #195–#201 junto a la máquina de
 * estados de stock: `SyncStockStatus()` mueve `Published` ⇄ `Exhausted`
 * según el stock restante, y republicar una recompensa sin stock la deja
 * `Exhausted` en vez de `Published`.
 *
 * El cálculo del cliente (`isRewardOutOfStock`) NO se retira: sigue
 * sirviendo para una recompensa `Published` cuyo stock llegó a cero sin que
 * el servidor haya sincronizado todavía. Lo que cambia es que ahora el
 * estado agotado también puede venir dicho por el servidor.
 */
export const businessRewardStatusSchema = z.enum([
  'Draft',
  'Published',
  'Paused',
  'Archived',
  'Exhausted',
])
export type BusinessRewardStatus = z.infer<typeof businessRewardStatusSchema>

/**
 * `PortalRewardResult` — la MISMA forma para el listado y para el detalle.
 *
 * ✅ **Ya no es una propuesta: el endpoint existe y está verificado.** Los
 * PRs #195–#201 del backend (24 sep 2026) agregaron el listado por negocio
 * y el detalle, y ambos devuelven este mismo DTO. Verificado leyendo
 * `Contracts/PortalRewardResult.cs` contra backend `main` @ `ea471f4`.
 *
 * Que el listado y el detalle compartan forma es del backend, no una
 * simplificación nuestra: no hay un `PortalRewardDetailResult` aparte. Por
 * eso no se declara un segundo schema de detalle — duplicarlo solo abriría
 * la puerta a que los dos se desincronicen.
 *
 * ⚠️ **Sin timestamps.** `Reward` no tiene `CreatedAtUtc` ni
 * `UpdatedAtUtc` (confirmado leyendo la clase completa; el propio
 * `Reward.cs:346-348` lo dice), así que ninguna pantalla puede mostrar
 * "creada el…" ni ordenar por fecha. El orden del servidor es por título.
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
  /**
   * `null` hasta la primera subida vía
   * `PUT /portal/businesses/{businessId}/rewards/{rewardId}/image`.
   */
  imageUrl: z.string().nullable(),
})
export type BusinessRewardSummary = z.infer<typeof businessRewardSummarySchema>

/**
 * `POST /portal/businesses/{businessId}/rewards` → body. Copia exacta de
 * `PublishRewardRequest` (verificado byte a byte en
 * `Api/Requests/PublishRewardRequest.cs` @ `ea471f4`).
 *
 * ⚠️ Ojo con el ORDEN de los campos si alguien escribe un mapper a mano: el
 * request lleva `MenuItemId` ANTES de `PlaceId`, y `PortalRewardResult` los
 * lleva al revés. Acá no importa porque viajan por nombre en JSON, pero es
 * una trampa real del contrato.
 *
 * **Publish-on-create (real-backend-readiness #204):** el backend crea la
 * recompensa directamente en `Published` — `Reward.Publish` fija el estado
 * y no existe ningún endpoint de publicación aparte (`PublishAsync` es el
 * propio handler de creación). La decisión previa de mantener un paso de
 * borrador intermedio se revirtió: no hay ningún flujo del portal que deje
 * una recompensa en `Draft`. `RewardStatus.Draft` sigue existiendo en el
 * enum del servidor —es «transición de work units futuros»— así que el
 * cliente todavía debe poder RENDERIZARLO si algún día llega, pero nunca lo
 * produce. Registrado en `Renata-S-A-S/geoquest#191` y `#204`.
 *
 * La imagen no viaja acá: se sube después con
 * `PUT /portal/businesses/{businessId}/rewards/{rewardId}/image`, mismo
 * patrón que las fotos de lugar.
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

/**
 * `POST /portal/businesses/{businessId}/rewards` → 201. Devuelve solo el id,
 * como el de lugares.
 *
 * ⚠️ La respuesta trae un header `Location: /rewards/{id}` que apunta a la
 * ruta VIEJA sin scope, que **no es un GET de una recompensa** (el browse
 * anónimo es una lista). No seguirlo: para leer la recompensa recién creada
 * va `GET /portal/businesses/{businessId}/rewards/{rewardId}`.
 */
export const createdBusinessRewardSchema = z.object({ rewardId: z.string().uuid() })
export type CreatedBusinessReward = z.infer<typeof createdBusinessRewardSchema>

/**
 * `PUT /portal/businesses/{businessId}/rewards/{rewardId}` → body.
 *
 * `EditRewardRequest` es **byte-idéntico** a `PublishRewardRequest`:
 * mismos 7 campos, mismos tipos, mismo orden (verificado leyendo los dos
 * records @ `ea471f4`). Por eso se define como el mismo objeto y no como una
 * copia que pueda divergir.
 *
 * ⚠️⚠️ **ES UN REEMPLAZO TOTAL, Y `null` SIGNIFICA BORRAR.**
 *
 * `Reward.Edit` asigna sin ninguna condición (`Reward.cs:245-252`):
 *
 * ```csharp
 * PlaceId = placeId;
 * MenuItemId = menuItemId;
 * StockTotal = stockTotal;
 * ```
 *
 * O sea que **omitir `placeId` del body no lo deja como estaba: lo pone en
 * `null` y desvincula el lugar.** El verbo `PUT` es correcto para esa
 * semántica, pero el riesgo es silencioso: un cliente que mande un patch
 * parcial creyendo que es `PATCH` desvincula el lugar y el ítem de menú sin
 * avisar, y nadie se entera hasta que un explorador no encuentra la
 * recompensa donde debería.
 *
 * **Consecuencia de diseño, obligatoria para cualquier consumidor:** el
 * formulario precarga TODOS los campos y los reenvía COMPLETOS, siempre.
 * Nunca un body parcial.
 */
export const updateBusinessRewardInputSchema = createBusinessRewardInputSchema
export type UpdateBusinessRewardInput = z.infer<typeof updateBusinessRewardInputSchema>

/**
 * Estados desde los que el backend acepta editar (`Reward.cs:205`):
 * `Published`, `Exhausted` o `Paused`. Cualquier otro → 409
 * `Reward.NotEditable`.
 *
 * Se replica EXACTO, no una versión "más segura". `canPublishPlace` ya tuvo
 * ese bug: era más estricto que el servidor y escondía una acción válida.
 */
export function canEditReward(reward: BusinessRewardSummary): boolean {
  return (
    reward.status === 'Published' || reward.status === 'Exhausted' || reward.status === 'Paused'
  )
}

/**
 * Estados desde los que el backend acepta PAUSAR (`Reward.cs:268-282`):
 * `Published` o `Exhausted` → `Paused`.
 *
 * Una `Exhausted` **sí** se puede pausar, y no es un detalle menor: es el caso
 * en que el negocio quiere dejar de mostrar una recompensa que ya no puede
 * entregar. Excluirla sería más estricto que el servidor.
 */
export function canPauseReward(reward: BusinessRewardSummary): boolean {
  return reward.status === 'Published' || reward.status === 'Exhausted'
}

/**
 * Estados desde los que el backend acepta REPUBLICAR (`Reward.cs:291-300`):
 * solo `Paused`. Cualquier otro → 409 `Reward.NotPaused`.
 */
export function canRepublishReward(reward: BusinessRewardSummary): boolean {
  return reward.status === 'Paused'
}

/**
 * Si republicar esta recompensa la va a dejar **agotada** en vez de publicada.
 *
 * `Reward.Republish` (`Reward.cs:298`) decide así:
 *
 * ```csharp
 * Status = StockTotal is not null && StockRemaining <= 0
 *     ? RewardStatus.Exhausted
 *     : RewardStatus.Published;
 * ```
 *
 * O sea que republicar una recompensa sin stock **no la deja publicada**. Si
 * la interfaz dijera "republicada" y el badge mostrara "Agotada", el negocio
 * pensaría que algo falló. Este predicado existe para poder anticiparlo ANTES
 * de la acción y para elegir el mensaje correcto DESPUÉS.
 *
 * Ojo con el `StockTotal is not null`: una recompensa **sin tope** nunca cae
 * en `Exhausted`, aunque `stockRemaining` sea `null`. Tratar `null` como cero
 * acá haría prometer un agotamiento imposible.
 */
export function republishWillExhaust(reward: BusinessRewardSummary): boolean {
  return reward.stockTotal !== null && (reward.stockRemaining ?? 0) <= 0
}

/**
 * Unidades ya comprometidas, derivadas del cliente.
 *
 * ⚠️ **El backend NO expone este número.** `Reward.StockBelowCommitted` es un
 * `Error(Code, Message)` de dos strings y `ProblemResults.ToProblem` no manda
 * `extensions`, así que el 409 llega con un texto fijo en inglés y sin el
 * dato. El `committed` que el dominio calcula en `Reward.cs:238` nunca se
 * interpola en el mensaje.
 *
 * Para una recompensa CON tope se puede derivar del propio DTO, que es lo que
 * hace esta función: `stockTotal - stockRemaining`.
 *
 * Para una recompensa SIN tope (`stockTotal === null`) que recién ahora le
 * pone uno, el número sale de `IUserRewardRepository.CountCommittedByRewardIdAsync`
 * del lado del servidor y **ningún endpoint lo expone**. Ahí devuelve `null` y
 * el mensaje al usuario tiene que ser honesto en vez de inventar una cifra.
 */
export function committedUnits(reward: BusinessRewardSummary): number | null {
  if (reward.stockTotal === null) return null

  return reward.stockTotal - (reward.stockRemaining ?? 0)
}

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
