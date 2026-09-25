import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS, SEED_REWARDS } from '@/shared/mocks/seed'
import { useToastStore } from '@/shared/stores/toast-store'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'
import { RewardImageUpload } from './reward-image-upload'

const businessId = SEED_BUSINESS.id
const withImage = SEED_REWARDS[0]
const withoutImage = SEED_REWARDS[1]

function imageUrl(rewardId: string) {
  return `${API_BASE_URL}/portal/businesses/${businessId}/rewards/${rewardId}/image`
}

function jpeg(name = 'foto.jpg', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })
}

/**
 * `resizeImageFile` usa `createImageBitmap` y Canvas 2D, que jsdom no
 * implementa, así que se inyecta un doble. Es el mismo criterio por el que
 * `image-processing.ts` expone `ResizeImageFileDeps`.
 */
const passthroughResize = (file: File) => Promise.resolve(file)

function renderUpload(
  reward: BusinessRewardSummary,
  resizeFile: (file: File) => Promise<File> = passthroughResize
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RewardImageUpload businessId={businessId} reward={reward} resizeFile={resizeFile} />
    </QueryClientProvider>
  )
}

function choose(file: File) {
  const input = screen.getByLabelText('Elegir la imagen de la recompensa')
  fireEvent.change(input, { target: { files: [file] } })
}

function toasts() {
  return useToastStore.getState().toasts.map((toast) => toast.message)
}

beforeEach(() => useToastStore.setState({ toasts: [] }))

describe('RewardImageUpload', () => {
  it('invita a subir cuando no hay imagen', () => {
    renderUpload(withoutImage)

    expect(screen.getByRole('button', { name: 'Subir imagen' })).toBeInTheDocument()
    expect(screen.getByText('Esta recompensa todavía no tiene imagen.')).toBeInTheDocument()
  })

  it('ofrece reemplazar y muestra la imagen cuando ya hay una', () => {
    renderUpload(withImage)

    expect(screen.getByRole('button', { name: 'Reemplazar imagen' })).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', withImage.imageUrl)
  })

  it('declara los límites reales de tamaño y formato', () => {
    renderUpload(withoutImage)

    expect(screen.getByText('Hasta 5 MB, en .jpg, .jpeg, .png, .webp.')).toBeInTheDocument()
  })

  it('sube el archivo elegido y avisa por toast', async () => {
    renderUpload(withoutImage)

    choose(jpeg())

    await waitFor(() => expect(toasts()).toContain('Imagen actualizada'))
  })

  /**
   * Se verifica que el redimensionado reciba el archivo elegido, y NO se
   * inspeccionan los bytes que salen por el cable.
   *
   * Motivo concreto: en jsdom un `File` no es un `Blob` para undici, así que
   * `FormData` lo coacciona y del otro lado llegan un nombre `'blob'` y un
   * tamaño que no corresponde a nada. Es un artefacto del entorno, no del
   * transporte. La verificación del cable —que el campo se llame `file` y que
   * lleve el archivo— vive en `api/upload-reward-image.test.ts`, que corre en
   * entorno node, donde `File` viaja bien.
   */
  it('pasa el archivo elegido por el redimensionado antes de subirlo', async () => {
    const original = jpeg('original.jpg', 1024)
    const resize = vi.fn(() => Promise.resolve(jpeg('redimensionada.jpg', 256)))
    renderUpload(withoutImage, resize)

    choose(original)

    await waitFor(() => expect(resize).toHaveBeenCalledOnce())
    expect(resize).toHaveBeenCalledWith(original)
    await waitFor(() => expect(toasts()).toContain('Imagen actualizada'))
  })

  /**
   * El redimensionado es una optimización de datos móviles, no un requisito: el
   * backend re-encodea igual. Perder la subida por no poder optimizarla sería
   * peor que subir el original.
   */
  it('sube el original si el redimensionado falla', async () => {
    const resize = vi.fn(() => Promise.reject(new Error('sin canvas')))
    renderUpload(withoutImage, resize)

    choose(jpeg())

    await waitFor(() => expect(toasts()).toContain('Imagen actualizada'))
  })

  // ---- Validación del cliente, que falla rápido sin pegarle al servidor ----

  it('rechaza un formato inválido sin llamar al servidor', async () => {
    let called = false
    server.use(
      http.put(imageUrl(withoutImage.rewardId), () => {
        called = true
        return HttpResponse.json({ url: 'x' })
      })
    )
    renderUpload(withoutImage)

    choose(new File([new Uint8Array(8)], 'animado.gif', { type: 'image/gif' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiene que ser JPG, PNG o WebP')
    expect(called).toBe(false)
  })

  it('rechaza un archivo demasiado grande sin llamar al servidor', async () => {
    let called = false
    server.use(
      http.put(imageUrl(withoutImage.rewardId), () => {
        called = true
        return HttpResponse.json({ url: 'x' })
      })
    )
    renderUpload(withoutImage)

    choose(jpeg('enorme.jpg', 6 * 1024 * 1024))

    expect(await screen.findByRole('alert')).toHaveTextContent('pesa más de 5 MB')
    expect(called).toBe(false)
  })

  // ---- Los errores del servidor ----

  function failWith(title: string, status: number, detail?: string) {
    server.use(
      http.put(imageUrl(withoutImage.rewardId), () =>
        HttpResponse.json({ title, detail, status }, { status })
      )
    )
  }

  it('traduce el 400 UnsupportedFormat del servidor', async () => {
    failWith('RewardImage.UnsupportedFormat', 400, 'Solo se aceptan imágenes JPEG, PNG o WebP.')
    renderUpload(withoutImage)

    choose(jpeg())

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiene que ser JPG, PNG o WebP')
  })

  /**
   * Los mensajes de validación de imagen del backend están **en español**, a
   * diferencia del resto del módulo. Pasar por el `fallback` de
   * `getProblemDetailsMessage` mostraría un texto que suena bien pero no es
   * nuestro, con otro tono y sin decir qué hacer. Este test fija que gane el
   * nuestro.
   */
  it('NO muestra el detail en español del backend, sino la copia propia', async () => {
    failWith('RewardImage.UnsupportedFormat', 400, 'Solo se aceptan imágenes JPEG, PNG o WebP.')
    renderUpload(withoutImage)

    choose(jpeg())

    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent('Solo se aceptan imágenes JPEG, PNG o WebP.')
  })

  it('traduce el 400 NoFile', async () => {
    failWith('RewardImageEndpoints.NoFile', 400)
    renderUpload(withoutImage)

    choose(jpeg())

    expect(await screen.findByRole('alert')).toHaveTextContent('No llegó ningún archivo')
  })

  it('el 403 de negocio no activo culpa al negocio, no a la recompensa', async () => {
    failWith('RewardPortal.BusinessNotActive', 403)
    renderUpload(withoutImage)

    choose(jpeg())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tu negocio no está activo')
    expect(alert).toHaveTextContent('La recompensa está bien')
  })

  /**
   * El caso más delicado de #112. Un 500 acá **puede ser una carrera de
   * concurrencia** porque el handler usa `CommitAsync` en vez de
   * `TryCommitAsync`, así que el portal no puede distinguirla de una falla real.
   * El mensaje no afirma ninguna de las dos y sugiere reintentar, que es lo
   * único cierto y accionable.
   */
  it('el 500 no culpa al servidor: reconoce que pudo ser una carrera y sugiere reintentar', async () => {
    failWith('InternalServerError', 500)
    renderUpload(withoutImage)

    choose(jpeg())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('probá de nuevo')
    expect(alert).toHaveTextContent('alguien más estuviera editando')
  })

  it('deshabilita el botón mientras sube', async () => {
    server.use(http.put(imageUrl(withoutImage.rewardId), () => new Promise<never>(() => {})))
    renderUpload(withoutImage)

    choose(jpeg())

    await waitFor(() => expect(screen.getByRole('button', { name: 'Subiendo…' })).toBeDisabled())
  })

  /**
   * Volver a elegir el MISMO archivo tras un error tiene que reintentar. Si el
   * input no se limpiara, el evento `change` no volvería a disparar y el botón
   * quedaría muerto sin explicación.
   */
  it('permite reintentar con el mismo archivo después de un error', async () => {
    failWith('RewardImage.Empty', 400)
    renderUpload(withoutImage)

    choose(jpeg())
    await screen.findByRole('alert')

    let secondAttempt = false
    server.use(
      http.put(imageUrl(withoutImage.rewardId), () => {
        secondAttempt = true
        return HttpResponse.json({ url: 'https://example.test/ok.jpg' })
      })
    )
    choose(jpeg())

    await waitFor(() => expect(secondAttempt).toBe(true))
  })
})
