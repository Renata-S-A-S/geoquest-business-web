import { z } from 'zod'
import { apiClient } from '@/shared/lib/api-client'

/**
 * `PUT .../rewards/{rewardId}/image` → `{ url }` (200).
 *
 * El backend devuelve `Results.Ok(new { url = result.Value.Url })`
 * (`RewardImageEndpoints.cs:94`), así que solo trae la URL: no devuelve la
 * recompensa entera. Por eso después de subir hay que invalidar y releer si se
 * quiere el resto del objeto actualizado.
 */
export const uploadedRewardImageSchema = z.object({ url: z.string() })
export type UploadedRewardImage = z.infer<typeof uploadedRewardImageSchema>

/**
 * `PUT /portal/businesses/{businessId}/rewards/{rewardId}/image` — issue #112.
 *
 * ✅ Ruta REAL, verificada en `Api/RewardImageEndpoints.cs:38` contra backend
 * `main` @ `ea471f4`. Ojo con el verbo: es **`PUT`**, no `POST` — al revés que
 * las fotos de lugar (`POST /business/places/{id}/photos`).
 *
 * **Primera llamada multipart real del repo.** Tres detalles del transporte que
 * no son obvios:
 *
 * 1. El campo del form se llama **`file`**, literal
 *    (`form.Files["file"]`, `RewardImageEndpoints.cs:79`). Un nombre distinto
 *    no da un error de validación: da 400
 *    `RewardImageEndpoints.NoFile`, como si no se hubiera mandado nada.
 * 2. **No se fija `Content-Type` a mano.** Hay que dejar que el navegador lo
 *    ponga, porque `multipart/form-data` necesita un `boundary` que solo él
 *    conoce. Escribir el header sin boundary hace que el servidor no encuentre
 *    ninguna parte. Axios lo detecta solo cuando el body es un `FormData`.
 * 3. El interceptor de sesión usa `config.headers.set('Authorization', …)`, que
 *    no pisa el `Content-Type`, así que la autenticación sigue funcionando sin
 *    hacer nada especial.
 *
 * ⚠️ El backend valida el formato por **magic bytes**, no por el
 * `Content-Type` declarado (`RewardImageValidation.cs:22-25`: JPEG, PNG,
 * WebP). Renombrar un `.txt` a `.jpg` no lo engaña. La validación del cliente
 * (`validateUploadFile`) es una cortesía para fallar rápido, nunca la
 * autoridad.
 *
 * ⚠️⚠️ **Una carrera de concurrencia acá escapa como 500, no como 409.** El
 * handler usa `CommitAsync` y no `TryCommitAsync`
 * (`UploadRewardImageCommandHandler.cs:76`), al revés que editar, pausar y
 * republicar. Así que el portal **no puede distinguir** un conflicto de
 * concurrencia de una falla real del servidor, y el mensaje de 500 tiene que
 * sugerir reintentar en vez de afirmar que el servidor está roto. El objeto
 * subido sí se borra en ese camino, así que no quedan huérfanos.
 */
export async function uploadRewardImage(
  businessId: string,
  rewardId: string,
  file: File
): Promise<UploadedRewardImage> {
  const form = new FormData()
  // El nombre del campo es parte del contrato, no una convención nuestra.
  form.append('file', file)

  const { data } = await apiClient.put(
    `/portal/businesses/${businessId}/rewards/${rewardId}/image`,
    form
  )
  return uploadedRewardImageSchema.parse(data)
}
