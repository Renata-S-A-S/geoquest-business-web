import { apiClient } from '@/shared/lib/api-client'
import {
  redemptionPreviewSchema,
  type RedemptionPreview,
} from '@/shared/schemas/business-redemption'

/**
 * `GET /portal/businesses/{businessId}/redemptions/by-qr-token/{qrToken}`
 * — paso 1 de B-04 (#44, #45).
 *
 * ⚠️ **DIVERGENCIA DELIBERADA: este endpoint NO EXISTE en el backend.** Es la
 * Opción A de `Renata-S-A-S/geoquest#202`, verificada por ausencia contra
 * `main`@fbec604: no hay ninguna ruta, query, handler ni método de
 * repositorio que busque por token. `IUserRewardRepository` solo sabe buscar
 * por id (`GetByIdAsync`), y el handler de escaneo compara hashes sobre un
 * agregado que ya cargó por id.
 *
 * Sin este lookup B-04 no se puede construir: el QR trae **solo** el token y
 * el escaneo exige `userRewardId` + token. Cuando exista, cambia este archivo
 * y nada más.
 *
 * ⚠️ **Además, la forma de la ruta que propone la Opción A es problemática, y
 * conviene arreglarla upstream antes de implementarla.** El token es base64
 * **estándar** (`Convert.ToBase64String`), así que puede contener `+`, `/` y
 * `=`. Un `/` dentro de un segmento de path lo parte en dos, y aunque lo
 * codifiquemos como `%2F` —lo que hace `encodeURIComponent` acá— ASP.NET Core
 * **rechaza `%2F` en segmentos de path por defecto**
 * (`UseRelaxedPathSegmentSeparator` / `AllowDoubleEscaping` están apagados).
 * O sea que este lookup fallaría para cualquier token que contenga `/`, que
 * es ~1 de cada 3.
 *
 * Lo correcto sería que `geoquest#202` adopte un query parameter
 * (`?qrToken=…`) o base64url en la generación. Se implementa igual la forma
 * pedida para no inventar un contrato distinto del que está registrado, pero
 * queda anotado: no es un detalle de encoding, es un bug de diseño del
 * endpoint propuesto.
 */
export async function getRedemptionByQrToken(
  businessId: string,
  qrToken: string
): Promise<RedemptionPreview> {
  const { data } = await apiClient.get(
    `/portal/businesses/${businessId}/redemptions/by-qr-token/${encodeURIComponent(qrToken)}`
  )
  return redemptionPreviewSchema.parse(data)
}
