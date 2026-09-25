import { z } from 'zod'

/**
 * Contrato REAL de canjes del portal (B-04), copiado de los DTOs del backend
 * desplegado (`GeoQuest.Modules.Rewards`, `main`@fbec604). Reemplaza al
 * `user-reward.ts` propuesto, que se borra en este mismo PR: modelaba un
 * `UserReward` completo que el portal nunca recibe.
 *
 * ⚠️ **Este flujo está BLOQUEADO a nivel contrato y no es culpa del portal.**
 * Verificado punta a punta:
 *
 * 1. La app del explorador (`GeoQuestFront`,
 *    `src/features/rewards/qr-code-panel.tsx`) mete en el QR **solo** el
 *    token: `value={qrToken}`.
 * 2. El token es opaco — `Convert.ToBase64String(RandomNumberGenerator
 *    .GetBytes(32))`. El `userRewardId` **no** se puede derivar de él.
 * 3. Pero el endpoint de escaneo exige los dos:
 *    `ScanRedemptionQrRequest(Guid UserRewardId, string QrToken)`.
 * 4. **No existe ningún endpoint que mapee un token a su `userRewardId`.**
 *
 * Registrado en `Renata-S-A-S/geoquest#202`, que propone tres opciones. Acá
 * se construye asumiendo la **Opción A**: un lookup por token que devuelve
 * lo suficiente para previsualizar antes de confirmar. Es la única que
 * satisface los criterios de aceptación de #45.
 *
 * Agregar un campo a este archivo sin verificarlo contra `Modules.Rewards`
 * es repetir el problema que la migración de `places`/`rewards` deshizo.
 */

/**
 * `Origin` del backend: **`Purchased | Prize`**.
 *
 * ⚠️ RN-REW-10 / ADR-045, `contratos-portal-b2b.md` §2.4 y el issue #47
 * dicen los tres `Granted`. **`Granted` no existe en el backend.** El valor
 * real es `Prize`. Se usa el valor real y se deja anotada la discrepancia
 * para que nadie la "corrija" hacia la documentación: el enum manda.
 *
 * La distinción es de negocio, no cosmética: una `Prize` no descontó saldo
 * al explorador, así que un costo 0 es correcto y no un error de datos.
 */
export const redemptionOriginSchema = z.enum(['Purchased', 'Prize'])
export type RedemptionOrigin = z.infer<typeof redemptionOriginSchema>

/**
 * Token del QR: `Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))`.
 *
 * 32 bytes en base64 estándar son **exactamente 44 caracteres**, con un solo
 * `=` de relleno al final. De ahí sale el regex, y por eso no es un
 * `z.string().min(1)`: #44 pide validar el formato **antes** de llamar al
 * endpoint, y este es el formato real, no uno inventado.
 *
 * Deliberadamente **no** se acepta la variante url-safe (`-_`): el backend no
 * la produce. Normalizar en silencio formas de entrada que nadie emite es la
 * ficción sin etiquetar que este proyecto ya pagó una vez.
 */
const QR_TOKEN_PATTERN = /^[A-Za-z0-9+/]{43}=$/

/**
 * Schema del formulario de entrada manual (#44).
 *
 * Recibe `t` porque Zod congela los mensajes al construir el schema: si se
 * tomara `t` del módulo, el mensaje quedaría fijado en el idioma que
 * estuviera activo al importar.
 *
 * `.trim()` antes de validar es a propósito y es lo que hace usable la
 * pantalla: el token se **pega**, no se escribe (ver abajo), y pegar arrastra
 * espacios y saltos de línea.
 *
 * ⚠️ **La entrada manual no es usable punta a punta hoy, y el portal no lo
 * puede arreglar solo.** El panel del explorador documenta su propio prop:
 * «Encoded into the QR and never printed as text» — o sea que en la pantalla
 * del cliente no hay ningún texto que el staff pueda leer para tipear, solo
 * la imagen del QR y el contador. Igual es el mecanismo correcto del lado
 * del portal (no hay dependencia de lector de QR en este proyecto), pero
 * hasta que la app del explorador exponga el token como texto copiable, esta
 * pantalla se prueba pegando un token, no leyéndolo de un teléfono. Es un
 * hueco distinto del de `geoquest#202` y no tiene issue propia todavía.
 */
export function createQrTokenFormSchema(t: (key: string) => string) {
  return z.object({
    qrToken: z
      .string()
      .trim()
      .min(1, { message: t('entry.errors.required') })
      .regex(QR_TOKEN_PATTERN, { message: t('entry.errors.format') }),
  })
}
export type QrTokenFormValues = z.output<ReturnType<typeof createQrTokenFormSchema>>

/**
 * `GET /portal/businesses/{businessId}/redemptions/by-qr-token/{qrToken}`
 * → 200.
 *
 * ⚠️ **DIVERGENCIA DELIBERADA: este endpoint NO EXISTE.** Es la Opción A de
 * `Renata-S-A-S/geoquest#202`, mockeada acá para que B-04 se pueda construir
 * y revisar. No es un descuido ni una suposición: es la pieza que falta,
 * registrada upstream. Cuando exista, cambia el transporte y nada más.
 *
 * La forma es conservadora: son los campos que `PortalRedemptionResult` ya
 * expone (existen en el dominio y el backend ya los sabe serializar) más
 * `qrExpiresAtUtc`, que el explorador ya recibe al generar el QR. No se
 * inventa ni un campo que el backend no tenga en algún DTO.
 *
 * `explorerId` es un Guid y **nada más**. No hay nombre ni foto del
 * explorador en ningún endpoint del backend, así que el criterio de
 * aceptación de #45 que pide «nombre/foto del explorador» **no se puede
 * cumplir** y no se finge: la pantalla dice explícitamente que el portal no
 * identifica a la persona.
 */
export const redemptionPreviewSchema = z.object({
  userRewardId: z.string().uuid(),
  rewardId: z.string().uuid(),
  rewardTitle: z.string(),
  /** Guid crudo. No hay nombre ni foto en el backend — ver el comentario de arriba. */
  explorerId: z.string().uuid(),
  origin: redemptionOriginSchema,
  /** Costo congelado al ganar la recompensa. `0` cuando `origin === 'Prize'` (RN-REW-10). */
  geoPointsCostSnapshot: z.number().int().nonnegative(),
  estimatedValueCopSnapshot: z.number().nonnegative(),
  /** Ventana de 30 min desde la generación (RN-REW-04). */
  qrExpiresAtUtc: z.string(),
})
export type RedemptionPreview = z.infer<typeof redemptionPreviewSchema>

/**
 * `POST /portal/businesses/{businessId}/redemptions/scan` → **204 No Content**.
 *
 * Copia exacta de `ScanRedemptionQrRequest`. **Existe de verdad.**
 *
 * Devuelve 204, no la entidad actualizada — por eso el estado post-canje
 * (#48) se arma con lo que ya tenía la previsualización más la hora local, y
 * no con una respuesta del servidor. El issue #48 espera un `UserReward` con
 * `status: 'Redeemed'`, `redeemedAt` y `redeemedByStaffId`; nada de eso
 * llega, y `redeemedByStaffId` tampoco sería mostrable (sería un Guid, y no
 * hay endpoint de identidad de staff — `geoquest#203`).
 */
export const scanRedemptionInputSchema = z.object({
  userRewardId: z.string().uuid(),
  qrToken: z.string().min(1),
})
export type ScanRedemptionInput = z.infer<typeof scanRedemptionInputSchema>

/**
 * Códigos de error de `title` (RFC7807) que el escaneo puede devolver, con su
 * HTTP real verificado contra `main`@fbec604.
 *
 * Se traducen **directo** desde el código, nunca vía
 * `getProblemDetailsMessage`: ese helper resuelve `detail ?? title ??
 * fallback`, así que el `detail` del backend le ganaría a la copia del portal
 * (BL-006: el backend ignora `Accept-Language`).
 *
 * ⚠️ `QrExpired` es **400**, no 409. Los comentarios del propio backend dicen
 * 409 y están equivocados — registrado en `Renata-S-A-S/geoquest#206`. Acá no
 * se discrimina por status justamente por eso: se mapea por `title`, que es
 * estable.
 *
 * `UserReward.InvalidStatusTransition` (409) es lo que devuelve un QR ya
 * escaneado o reintentado. Es el error más importante del flujo: el canje es
 * de un solo uso e irreversible, así que "ya fue canjeado" tiene que leerse
 * distinto de "el código no sirve".
 */
export const REDEMPTION_ERROR_KEYS = {
  'ScanRedemptionQrCommand.RewardNotFound': 'notFound',
  'ScanRedemptionQrCommand.InvalidQrToken': 'invalidToken',
  'ScanRedemptionQrCommand.QrExpired': 'expired',
  'UserReward.InvalidStatusTransition': 'alreadyRedeemed',
  'RewardPortal.NotBusinessOwner': 'notOwner',
  'RewardPortal.BusinessNotActive': 'businessNotActive',
} as const satisfies Record<string, string>

export type RedemptionErrorKey = (typeof REDEMPTION_ERROR_KEYS)[keyof typeof REDEMPTION_ERROR_KEYS]

/**
 * Traduce un `title` de problem+json a la clave corta de i18n, o `null` si el
 * código no es conocido (ahí el llamador usa su copia genérica).
 *
 * Las claves son cortas a propósito y no el código con puntos: i18next usa
 * `.` como separador de nivel, así que `t('errors.UserReward.Invalid…')`
 * buscaría un objeto anidado y devolvería la clave cruda al staff.
 */
export function redemptionErrorKey(title: string | undefined): RedemptionErrorKey | null {
  if (title === undefined) return null
  return REDEMPTION_ERROR_KEYS[title as keyof typeof REDEMPTION_ERROR_KEYS] ?? null
}
