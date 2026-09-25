import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { uploadRewardImage } from './upload-reward-image'
import { getReward } from './get-reward'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'

const businessId = SEED_BUSINESS.id
const draft = SEED_REWARDS[1]
const IMAGE_URL = `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${draft.rewardId}/image`

function jpeg(name = 'foto.jpg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

describe('uploadRewardImage', () => {
  it('devuelve la url de la imagen subida', async () => {
    const result = await uploadRewardImage(businessId, draft.rewardId, jpeg())

    expect(result.url).toMatch(/^https?:\/\//)
  })

  /**
   * El nombre del campo es parte del contrato: el backend lee
   * `form.Files["file"]` (`RewardImageEndpoints.cs:79`). Mandarlo con otro
   * nombre no da un error de validación, da 400 `NoFile` — como si no se
   * hubiera mandado nada. Por eso se verifica explícitamente.
   */
  it('manda el archivo en el campo "file", como exige el backend', async () => {
    const captured: { names?: string[]; fileName?: string } = {}
    server.use(
      http.put(IMAGE_URL, async ({ request }) => {
        const form = await request.formData()
        captured.names = [...form.keys()]
        const file = form.get('file')
        // Cross-realm: el `File` de undici no es `instanceof` el de jsdom.
        captured.fileName = typeof file === 'string' ? undefined : (file?.name ?? undefined)
        return HttpResponse.json({ url: 'https://example.test/x.jpg' })
      })
    )

    await uploadRewardImage(businessId, draft.rewardId, jpeg('mi-foto.jpg'))

    expect(captured.names).toEqual(['file'])
    expect(captured.fileName).toBe('mi-foto.jpg')
  })

  /**
   * `multipart/form-data` necesita un `boundary` que solo el navegador conoce.
   * Fijar el header a mano lo rompería, así que se verifica que el
   * `Content-Type` que sale sea multipart CON boundary.
   */
  it('deja que el navegador ponga el Content-Type con su boundary', async () => {
    const captured: { contentType?: string | null } = {}
    server.use(
      http.put(IMAGE_URL, ({ request }) => {
        captured.contentType = request.headers.get('content-type')
        return HttpResponse.json({ url: 'https://example.test/x.jpg' })
      })
    )

    await uploadRewardImage(businessId, draft.rewardId, jpeg())

    expect(captured.contentType).toMatch(/^multipart\/form-data; boundary=/)
  })

  it('persiste la imagen: releer el detalle la devuelve', async () => {
    expect(draft.imageUrl).toBeNull()

    await uploadRewardImage(businessId, draft.rewardId, jpeg())

    const after = await getReward(businessId, draft.rewardId)
    expect(after.imageUrl).not.toBeNull()
  })

  it('rechaza un archivo vacío con 400 RewardImage.Empty', async () => {
    await expect(
      uploadRewardImage(businessId, draft.rewardId, jpeg('vacio.jpg', 0))
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'RewardImage.Empty' } },
    })
  })

  it('rechaza un formato no soportado con 400 UnsupportedFormat', async () => {
    const gif = new File([new Uint8Array(16)], 'animado.gif', { type: 'image/gif' })

    await expect(uploadRewardImage(businessId, draft.rewardId, gif)).rejects.toMatchObject({
      response: { status: 400, data: { title: 'RewardImage.UnsupportedFormat' } },
    })
  })

  it('rechaza un archivo demasiado grande con 400 TooLarge', async () => {
    const huge = jpeg('enorme.jpg', 6 * 1024 * 1024)

    await expect(uploadRewardImage(businessId, draft.rewardId, huge)).rejects.toMatchObject({
      response: { status: 400, data: { title: 'RewardImage.TooLarge' } },
    })
  })

  it('propaga el 403 de un businessId ajeno', async () => {
    await expect(
      uploadRewardImage('00000000-0000-0000-0000-0000000000aa', draft.rewardId, jpeg())
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RewardPortal.NotBusinessOwner' } },
    })
  })

  it('propaga el 404 de un rewardId desconocido', async () => {
    await expect(
      uploadRewardImage(businessId, '00000000-0000-0000-0000-0000000000ff', jpeg())
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'RewardPortal.RewardNotFound' } },
    })
  })

  it('rechaza una respuesta sin url', async () => {
    server.use(http.put(IMAGE_URL, () => HttpResponse.json({})))

    await expect(uploadRewardImage(businessId, draft.rewardId, jpeg())).rejects.toBeTruthy()
  })

  /**
   * ⚠️ Este endpoint usa `CommitAsync` y no `TryCommitAsync`
   * (`UploadRewardImageCommandHandler.cs:76`), así que una carrera de
   * concurrencia escapa como **500** en vez de 409. El transporte no puede
   * distinguirla de una falla real, y este test fija esa ambigüedad para que
   * quede documentada en vez de descubrirse en producción.
   */
  it('un conflicto de concurrencia llega como 500, indistinguible de una falla real', async () => {
    server.use(
      http.put(IMAGE_URL, () =>
        HttpResponse.json({ title: 'InternalServerError', status: 500 }, { status: 500 })
      )
    )

    await expect(uploadRewardImage(businessId, draft.rewardId, jpeg())).rejects.toMatchObject({
      response: { status: 500 },
    })
  })
})
