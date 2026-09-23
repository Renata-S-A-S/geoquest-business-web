import { describe, expect, it, vi } from 'vitest'
import {
  computeMaxSideDimensions,
  orientationToTransform,
  readJpegExifOrientation,
  resizeImageFile,
  type ResizeImageFileDeps,
} from './image-processing'

describe('computeMaxSideDimensions', () => {
  it('no hace upscale de una imagen más chica que el límite', () => {
    expect(computeMaxSideDimensions(600, 400, 1024)).toEqual({ width: 600, height: 400 })
  })

  it('reduce el lado mayor a 1024 preservando el aspect ratio (apaisada)', () => {
    expect(computeMaxSideDimensions(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 })
  })

  it('reduce el lado mayor a 1024 preservando el aspect ratio (vertical)', () => {
    expect(computeMaxSideDimensions(1024, 2048, 1024)).toEqual({ width: 512, height: 1024 })
  })

  it('respeta un lado exactamente igual al límite sin tocarlo', () => {
    expect(computeMaxSideDimensions(1024, 768, 1024)).toEqual({ width: 1024, height: 768 })
  })
})

describe('orientationToTransform', () => {
  it('orientación 1 (normal) no transforma nada', () => {
    expect(orientationToTransform(1)).toEqual({
      rotationDeg: 0,
      flipHorizontal: false,
      swapsDimensions: false,
    })
  })

  it('orientación 3 rota 180° sin intercambiar dimensiones', () => {
    expect(orientationToTransform(3)).toEqual({
      rotationDeg: 180,
      flipHorizontal: false,
      swapsDimensions: false,
    })
  })

  it('orientación 6 (celular rotado 90° CW) rota e intercambia ancho/alto', () => {
    expect(orientationToTransform(6)).toEqual({
      rotationDeg: 90,
      flipHorizontal: false,
      swapsDimensions: true,
    })
  })

  it('orientación 8 rota 270° e intercambia dimensiones', () => {
    expect(orientationToTransform(8)).toEqual({
      rotationDeg: 270,
      flipHorizontal: false,
      swapsDimensions: true,
    })
  })

  it('un valor no reconocido cae al default sin transformación', () => {
    expect(orientationToTransform(99)).toEqual({
      rotationDeg: 0,
      flipHorizontal: false,
      swapsDimensions: false,
    })
  })
})

describe('readJpegExifOrientation', () => {
  it('devuelve 1 para un archivo que no es JPEG (sin marker SOI)', () => {
    const buffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer
    expect(readJpegExifOrientation(buffer)).toBe(1)
  })

  it('devuelve 1 para un JPEG sin segmento EXIF (APP1)', () => {
    // SOI + un segmento APP0 (JFIF) cualquiera, sin APP1.
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]).buffer
    expect(readJpegExifOrientation(buffer)).toBe(1)
  })

  it('lee orientation=6 de un segmento EXIF/TIFF little-endian construido a mano', () => {
    const buffer = buildJpegWithExifOrientation(6, true)
    expect(readJpegExifOrientation(buffer)).toBe(6)
  })

  it('lee orientation=3 de un segmento EXIF/TIFF big-endian construido a mano', () => {
    const buffer = buildJpegWithExifOrientation(3, false)
    expect(readJpegExifOrientation(buffer)).toBe(3)
  })
})

/** Construye un buffer JPEG mínimo con SOI + APP1/EXIF con un único tag Orientation, para probar el parser sin fixtures binarios reales. */
function buildJpegWithExifOrientation(orientation: number, littleEndian: boolean): ArrayBuffer {
  const tiffHeaderSize = 8
  const entryCount = 1
  const ifdSize = 2 + entryCount * 12 + 4
  const exifBodySize = 6 + tiffHeaderSize + ifdSize // "Exif\0\0" + TIFF header + IFD
  const app1Size = 2 + exifBodySize // length field + body
  const totalSize = 2 + 2 + app1Size // SOI + APP1 marker + APP1 segment

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  let o = 0
  view.setUint16(o, 0xffd8) // SOI
  o += 2
  view.setUint16(o, 0xffe1) // APP1 marker
  o += 2
  view.setUint16(o, app1Size) // segment length (incluye estos 2 bytes)
  o += 2

  // "Exif\0\0"
  view.setUint32(o, 0x45786966)
  view.setUint16(o + 4, 0x0000)
  o += 6

  const tiffStart = o
  const setU16 = (offset: number, v: number) => view.setUint16(offset, v, littleEndian)
  const setU32 = (offset: number, v: number) => view.setUint32(offset, v, littleEndian)

  setU16(tiffStart, littleEndian ? 0x4949 : 0x4d4d)
  setU16(tiffStart + 2, 0x002a) // TIFF magic
  setU32(tiffStart + 4, 8) // offset al primer IFD, relativo a tiffStart

  const ifdStart = tiffStart + 8
  setU16(ifdStart, entryCount)
  const entryOffset = ifdStart + 2
  setU16(entryOffset, 0x0112) // tag Orientation
  setU16(entryOffset + 2, 3) // type SHORT
  setU32(entryOffset + 4, 1) // count
  setU16(entryOffset + 8, orientation) // value (SHORT cabe en los primeros 2 bytes del campo de 4)

  return buffer
}

describe('resizeImageFile', () => {
  function makeDeps(overrides: Partial<ResizeImageFileDeps> = {}): ResizeImageFileDeps {
    return {
      loadImageBitmap: vi
        .fn()
        .mockResolvedValue({ width: 2048, height: 1024, source: {} as CanvasImageSource }),
      encodeJpeg: vi.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/jpeg' })),
      ...overrides,
    }
  }

  it('produce un File JPEG con el mismo nombre base y extensión .jpg', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    const result = await resizeImageFile(file, { kind: 'maxSide', maxSide: 1024 }, makeDeps())
    expect(result.name).toBe('foto.jpg')
    expect(result.type).toBe('image/jpeg')
  })

  it('encodeJpeg recibe las dimensiones de salida ya redimensionadas a maxSide', async () => {
    const encodeJpeg = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await resizeImageFile(file, { kind: 'maxSide', maxSide: 1024 }, makeDeps({ encodeJpeg }))

    expect(encodeJpeg).toHaveBeenCalledWith(expect.any(Function), 1024, 512)
  })

  it('encodeJpeg recibe outputSize x outputSize para el modo square (logo)', async () => {
    const encodeJpeg = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    await resizeImageFile(file, { kind: 'square', size: 512 }, makeDeps({ encodeJpeg }))

    expect(encodeJpeg).toHaveBeenCalledWith(expect.any(Function), 512, 512)
  })

  it('con EXIF orientation=6, las dimensiones "display" (ancho/alto intercambiados) determinan el resize', async () => {
    // 2048x1024 crudo + orientation=6 (rota 90°, swap) => display 1024x2048 (vertical)
    const buffer = buildJpegWithExifOrientation(6, true)
    const file = new File([buffer], 'foto.jpg', { type: 'image/jpeg' })
    const encodeJpeg = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))

    await resizeImageFile(
      file,
      { kind: 'maxSide', maxSide: 1024 },
      makeDeps({
        loadImageBitmap: vi
          .fn()
          .mockResolvedValue({ width: 2048, height: 1024, source: {} as CanvasImageSource }),
        encodeJpeg,
      })
    )

    // Vertical 1024x2048 -> lado mayor 2048 escala a 1024 -> 512x1024.
    expect(encodeJpeg).toHaveBeenCalledWith(expect.any(Function), 512, 1024)
  })

  it('el callback draw aplica translate/rotate/drawImage centrados en el canvas de salida', async () => {
    const ctx = {
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    const encodeJpeg = vi
      .fn()
      .mockImplementation((draw: (ctx: CanvasRenderingContext2D) => void) => {
        draw(ctx)
        return Promise.resolve(new Blob(['x'], { type: 'image/jpeg' }))
      })

    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' }) // sin EXIF -> orientation 1, sin rotar
    await resizeImageFile(file, { kind: 'maxSide', maxSide: 1024 }, makeDeps({ encodeJpeg }))

    expect(ctx.translate).toHaveBeenCalledWith(1024 / 2, 512 / 2)
    expect(ctx.rotate).toHaveBeenCalledWith(0)
    expect(ctx.scale).not.toHaveBeenCalled() // orientation 1: sin flip horizontal
    expect(ctx.drawImage).toHaveBeenCalledWith({}, -1024 / 2, -512 / 2, 1024, 512)
  })

  it('el callback draw aplica flip horizontal cuando la orientación EXIF lo pide (orientation=2)', async () => {
    const ctx = {
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    const encodeJpeg = vi
      .fn()
      .mockImplementation((draw: (ctx: CanvasRenderingContext2D) => void) => {
        draw(ctx)
        return Promise.resolve(new Blob(['x'], { type: 'image/jpeg' }))
      })

    const buffer = buildJpegWithExifOrientation(2, true)
    const file = new File([buffer], 'foto.jpg', { type: 'image/jpeg' })
    await resizeImageFile(file, { kind: 'maxSide', maxSide: 1024 }, makeDeps({ encodeJpeg }))

    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
  })
})
