import { z } from 'zod'
import { apiClient } from '@/shared/lib/api-client'
import { placeSchema, type Place } from '@/shared/schemas/place'

/**
 * `GET /business/me/places` — issue #29 (B-02). Contrato en
 * contratos-portal-b2b.md §2.2.
 *
 * Devuelve TODOS los lugares del negocio de la sesión, en cualquier estado:
 * `Draft`, `Active` y `Paused`. La pantalla de lugares necesita los
 * borradores tanto como los publicados — un `Place` en `Draft` es
 * justamente el que le falta algo al negocio, así que esconderlo sería
 * esconder el trabajo pendiente.
 *
 * Sin `skipSessionAuth`: el recurso cuelga de `/business/me`, o sea que el
 * backend real resuelve el negocio desde la sesión activa. Mismo criterio
 * que `getBusinessMe`.
 *
 * `z.array(placeSchema)` falla la lista ENTERA si una sola fila viola el
 * contrato, y eso es deliberado. Es el mismo mecanismo que se rechazó en
 * la PR anterior (#29, PR1) para expresar la regla de publicación, pero la
 * justificación se invierte: un `.refine()` de "al menos una foto" habría
 * tumbado filas legítimas —borradores válidos, regla equivocada—, mientras
 * que acá solo tumban filas que el backend no debería haber emitido nunca.
 * Ante datos corruptos preferimos un error visible antes que una lista a
 * medias que el negocio lea como completa.
 */
export async function getPlaces(): Promise<Place[]> {
  const { data } = await apiClient.get('/business/me/places')
  return z.array(placeSchema).parse(data)
}
