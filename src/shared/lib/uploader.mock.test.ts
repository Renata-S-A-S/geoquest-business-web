import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createMockUploader } from './uploader.mock'

describe('createMockUploader', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:fake-url') })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('resuelve con una blob: URL generada a partir del archivo tras el delay simulado', async () => {
    const uploader = createMockUploader({ delayMs: 100 })
    const file = new File(['x'], 'logo.png', { type: 'image/png' })

    const promise = uploader.upload(file)
    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toEqual({ url: 'blob:fake-url' })
  })

  it('rechaza cuando shouldFail está activo, para ejercitar el estado de error de la UI', async () => {
    const uploader = createMockUploader({ delayMs: 50, shouldFail: true })
    const promise = uploader.upload(new File(['x'], 'doc.pdf', { type: 'application/pdf' }))

    const assertion = expect(promise).rejects.toThrow('mockUploader: subida simulada fallida')
    await vi.advanceTimersByTimeAsync(50)
    await assertion
  })
})
