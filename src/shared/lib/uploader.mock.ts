import type { Uploader } from '@/shared/lib/uploader'

/**
 * Implementación mock de `Uploader` — SOLO para tests unitarios/Storybook y
 * para desarrollar `file-dropzone.tsx` en aislamiento. Ver el aviso en
 * `uploader.ts`: nunca usar esto como sustituto de la integración real.
 *
 * No hace ninguna llamada HTTP. Genera un `blob:` URL local a partir del
 * propio archivo (visible en el navegador, se revoca solo al recargar) y
 * simula latencia de red para poder ejercitar el estado `uploading` en la
 * UI sin depender de un backend.
 */
export function createMockUploader(
  options: { delayMs?: number; shouldFail?: boolean } = {}
): Uploader {
  const { delayMs = 400, shouldFail = false } = options
  return {
    upload: (file: File) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (shouldFail) {
            reject(new Error('mockUploader: subida simulada fallida'))
            return
          }
          resolve({ url: URL.createObjectURL(file) })
        }, delayMs)
      }),
  }
}

export const mockUploader: Uploader = createMockUploader()
