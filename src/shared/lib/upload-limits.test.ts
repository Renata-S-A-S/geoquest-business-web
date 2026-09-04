import { describe, expect, it } from 'vitest'
import { isMovFile, validateUploadFile, UPLOAD_LIMITS } from './upload-limits'

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type })
  return file
}

describe('isMovFile', () => {
  it('detecta .mov por mime type de Safari/iOS', () => {
    expect(isMovFile(makeFile('video.mov', 'video/quicktime', 100))).toBe(true)
  })

  it('detecta .mov por extensión cuando el navegador no reporta type', () => {
    expect(isMovFile(makeFile('video.MOV', '', 100))).toBe(true)
  })

  it('no marca un mp4 como mov', () => {
    expect(isMovFile(makeFile('video.mp4', 'video/mp4', 100))).toBe(false)
  })
})

describe('validateUploadFile', () => {
  it('acepta un logo JPG dentro del límite de 2MB', () => {
    const file = makeFile('logo.jpg', 'image/jpeg', 1 * 1024 * 1024)
    expect(validateUploadFile(file, 'logo')).toBeNull()
  })

  it('rechaza un logo que excede 2MB con el tamaño máximo permitido', () => {
    const file = makeFile('logo.png', 'image/png', 3 * 1024 * 1024)
    expect(validateUploadFile(file, 'logo')).toEqual({
      kind: 'size-exceeded',
      maxSizeBytes: UPLOAD_LIMITS.logo.maxSizeBytes,
    })
  })

  it('rechaza un formato no aceptado como "invalid-type", no como mov', () => {
    const file = makeFile('logo.gif', 'image/gif', 100)
    expect(validateUploadFile(file, 'logo')).toEqual({ kind: 'invalid-type' })
  })

  it('acepta PDF o imagen para el documento legal', () => {
    expect(
      validateUploadFile(makeFile('doc.pdf', 'application/pdf', 100), 'legalDocument')
    ).toBeNull()
    expect(validateUploadFile(makeFile('doc.jpg', 'image/jpeg', 100), 'legalDocument')).toBeNull()
  })

  it('rechaza un .mov de video de verificación con mensaje específico, no genérico', () => {
    const file = makeFile('negocio.mov', 'video/quicktime', 1024)
    expect(validateUploadFile(file, 'verificationVideo')).toEqual({ kind: 'mov-unsupported' })
  })

  it('acepta mp4/webm de video de verificación dentro de 50MB', () => {
    expect(
      validateUploadFile(makeFile('v.mp4', 'video/mp4', 40 * 1024 * 1024), 'verificationVideo')
    ).toBeNull()
    expect(
      validateUploadFile(makeFile('v.webm', 'video/webm', 40 * 1024 * 1024), 'verificationVideo')
    ).toBeNull()
  })

  it('rechaza un video que excede 50MB', () => {
    const file = makeFile('v.mp4', 'video/mp4', 51 * 1024 * 1024)
    expect(validateUploadFile(file, 'verificationVideo')).toEqual({
      kind: 'size-exceeded',
      maxSizeBytes: UPLOAD_LIMITS.verificationVideo.maxSizeBytes,
    })
  })

  it('acepta foto de lugar / imagen de recompensa hasta 5MB en JPG/PNG/WebP', () => {
    expect(
      validateUploadFile(makeFile('p.webp', 'image/webp', 4 * 1024 * 1024), 'placePhoto')
    ).toBeNull()
    expect(
      validateUploadFile(makeFile('r.png', 'image/png', 4 * 1024 * 1024), 'rewardImage')
    ).toBeNull()
  })
})
