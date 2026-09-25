import { z } from 'zod'

/**
 * Contrato REAL de canjes del portal (B-04), verificado punta a punta contra
 * el backend (`GeoQuest.Modules.Rewards`, `main`@e0f0e9a, PR #210):
 * `RedemptionEndpoints.cs`, `Contracts/RedemptionLookupResult.cs` y
 * `Api/Requests/{Lookup,ScanRedemptionQr}Request.cs`.
 *
 * Reemplaza al lookup mockeado por `GET .../by-qr-token/{qrToken}` (Opción A
 * de `Renata-S-A-S/geoquest#202`, nunca llegó a existir así): el endpoint
 * real es `POST .../redemptions/lookup` con body `{ qrToken }`, resuelto por
 * hash igual que el escaneo (redemption-scan-by-token, PR 2/3).
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
 * `Status` EFECTIVO del lookup (`RedemptionTokenResolution.EffectiveStatus`):
 * degrada `Earned` a `Expired` cuando el QR ya venció, aunque el estado
 * persistido siga siendo `Earned` hasta que corra el sweep (GR-3). Solo
 * `Earned` es redimible — el resto siempre viene con `isRedeemable: false`.
 */
export const redemptionStatusSchema = z.enum([
  'Earned',
  'Redeemed',
  'Expired',
  'PendingReservation',
  'Failed',
])
export type RedemptionStatus = z.infer<typeof redemptionStatusSchema>

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
 * Body de `POST /portal/businesses/{businessId}/redemptions/lookup`
 * (`LookupRedemptionRequest`) — el token es el único campo, igual que el del
 * escaneo.
 */
export const lookupRedemptionInputSchema = z.object({
  qrToken: z.string().min(1),
})
export type LookupRedemptionInput = z.infer<typeof lookupRedemptionInputSchema>

/**
 * Respuesta de `POST .../redemptions/lookup` → 200 (`RedemptionLookupResult`).
 * Preview de solo lectura, nunca muta el `UserReward`. Nunca hay 409/410 en
 * este endpoint: un token ya canjeado o vencido igual devuelve 200 con
 * `isRedeemable: false` — `status` explica por qué.
 *
 * `explorerUsername` es `null` cuando el `ExplorerRef` todavía no se proyectó
 * para ese explorador (decision #1473) — la pantalla cae al `explorerId`.
 * `qrExpiresAtUtc` puede ser `null` (por ejemplo, sobre un canje ya resuelto)
 * y hay que mostrarlo sin romper.
 *
 * `estimatedValueCopSnapshot`, que este archivo llegó a declarar, **no existe
 * en `RedemptionLookupResult`** — se borra en vez de inventarlo.
 */
export const redemptionPreviewSchema = z.object({
  userRewardId: z.string().uuid(),
  rewardId: z.string().uuid(),
  rewardTitle: z.string(),
  rewardDescription: z.string(),
  status: redemptionStatusSchema,
  isRedeemable: z.boolean(),
  qrExpiresAtUtc: z.string().nullable(),
  origin: redemptionOriginSchema,
  /** Costo congelado al ganar la recompensa. `0` cuando `origin === 'Prize'` (RN-REW-10). */
  geoPointsCostSnapshot: z.number().int().nonnegative(),
  explorerId: z.string().uuid(),
  explorerUsername: z.string().nullable(),
})
export type RedemptionPreview = z.infer<typeof redemptionPreviewSchema>

/**
 * Por qué un preview con `isRedeemable: false` no se puede confirmar, para
 * elegir el copy correcto (spec "Successful preview" / decisiones de #44–48).
 * `Earned` es el único estado redimible y devuelve `null` — no debería
 * llamarse con `isRedeemable: true`.
 */
export type RedemptionNotRedeemableReason = 'redeemed' | 'expired' | 'notRedeemable'

export function redemptionNotRedeemableReason(
  status: RedemptionStatus
): RedemptionNotRedeemableReason | null {
  switch (status) {
    case 'Redeemed':
      return 'redeemed'
    case 'Expired':
      return 'expired'
    case 'PendingReservation':
    case 'Failed':
      return 'notRedeemable'
    case 'Earned':
      return null
  }
}

/**
 * Body de `POST /portal/businesses/{businessId}/redemptions/scan`
 * (`ScanRedemptionQrRequest`) → **204 No Content**. `userRewardId` ya NO es
 * parte del contrato (redemption-scan-by-token, PR 2): el token es la única
 * clave de resolución.
 *
 * Devuelve 204, no la entidad actualizada — por eso el estado post-canje
 * (#48) se arma con lo que ya tenía la previsualización más la hora local, y
 * no con una respuesta del servidor.
 */
export const scanRedemptionInputSchema = z.object({
  qrToken: z.string().min(1),
})
export type ScanRedemptionInput = z.infer<typeof scanRedemptionInputSchema>

/**
 * Códigos de error de `title` (RFC7807) que lookup y scan pueden devolver,
 * verificados contra `RedemptionEndpoints.cs` (`main`@e0f0e9a, PR #210).
 *
 * Se traducen **directo** desde el código, nunca vía
 * `getProblemDetailsMessage`: ese helper resuelve `detail ?? title ??
 * fallback`, así que el `detail` del backend le ganaría a la copia del portal
 * (BL-006: el backend ignora `Accept-Language`).
 *
 * Los códigos `ScanRedemptionQrCommand.*` (RewardNotFound / InvalidQrToken /
 * QrExpired) **ya no existen** — el comando se reemplazó por resolución por
 * token. `RedemptionToken.OtherBusiness` es nuevo: desde la decision #1473 el
 * token de 256 bits no es enumerable, así que "es de otro negocio" devuelve
 * su propio 403 en vez de esconderse detrás del 404 anti-enumeration que
 * aplicaba a `userRewardId` (amendment #1452).
 *
 * 429 (límite de 30 req/min compartido por lookup y scan, por staff) **no se
 * mapea acá**: se detecta por status HTTP, no por `title` — el cuerpo de un
 * 429 no es confiable (puede ser un `ProblemDetails` genérico "Too Many
 * Requests"). Ver `redemptionErrorMessage`.
 */
export const REDEMPTION_ERROR_KEYS = {
  'RedemptionToken.NotFound': 'notFound',
  'RewardPortal.NotBusinessOwner': 'notOwner',
  'RewardPortal.BusinessNotActive': 'businessNotActive',
  'RedemptionToken.OtherBusiness': 'otherBusiness',
  'RedemptionToken.AlreadyRedeemed': 'alreadyRedeemed',
  'RedemptionToken.NotRedeemable': 'notRedeemable',
  'RedemptionToken.Expired': 'expired',
  'UserReward.InvalidStatusTransition': 'invalidTransition',
  'UserReward.ConcurrencyConflict': 'concurrencyConflict',
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
