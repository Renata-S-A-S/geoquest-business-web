/**
 * Resize + validación de imágenes en cliente — 🖼️ SIG-001 (spec técnico) +
 * plan Paso 3. El backend (`ImageResizer.cs`, `SharedKernel/Imaging/`) hace
 * el mismo trabajo como respaldo server-side; este módulo replica su
 * configuración de salida para que el cliente compatible (con soporte
 * Canvas API) llegue ya redimensionado — SIG-001: "cliente primero, servidor
 * como respaldo".
 *
 * Las funciones puras (cálculo de dimensiones, orientación EXIF) están
 * separadas de la orquestación con Canvas/Image (`resizeImageFile`) a
 * propósito: jsdom no implementa un 2D context real, así que la lógica que
 * SÍ se puede probar sin navegador vive en funciones sin IO, y
 * `resizeImageFile` recibe sus dependencias de browser por parámetro
 * (default a las reales) para poder inyectar fakes en tests.
 */

export type ResizeMode = { kind: 'maxSide'; maxSide: number } | { kind: 'square'; size: number }

/** Config de salida por tipo de imagen — tabla de SIG-001, sección "Configuración de salida". */
export const RESIZE_CONFIG = {
  logo: { kind: 'square', size: 512 } satisfies ResizeMode,
  placePhoto: { kind: 'maxSide', maxSide: 1024 } satisfies ResizeMode,
  rewardImage: { kind: 'maxSide', maxSide: 1024 } satisfies ResizeMode,
} as const

export const JPEG_QUALITY = 0.8

/** Dimensiones de salida para `ResizeToMaxSide` — nunca hace upscale de una imagen ya más chica que el límite. */
export function computeMaxSideDimensions(
  width: number,
  height: number,
  maxSide: number
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Tag EXIF `Orientation` (1-8) → cuántos grados rotar y si hay que
 * reflejar horizontalmente, además de si el ancho/alto final quedan
 * intercambiados (rotaciones de 90°/270°) — para saber si el resultado es
 * "apaisado" o "vertical" antes de dibujar. SkiaSharp del lado servidor
 * resuelve esto leyendo `SKCodec.EncodedOrigin` (SIG-001, "gotcha real");
 * acá es el equivalente de cliente, mismo criterio: nunca depender de que
 * el visor final interprete el tag.
 */
export function orientationToTransform(orientation: number): {
  rotationDeg: 0 | 90 | 180 | 270
  flipHorizontal: boolean
  swapsDimensions: boolean
} {
  switch (orientation) {
    case 2:
      return { rotationDeg: 0, flipHorizontal: true, swapsDimensions: false }
    case 3:
      return { rotationDeg: 180, flipHorizontal: false, swapsDimensions: false }
    case 4:
      return { rotationDeg: 180, flipHorizontal: true, swapsDimensions: false }
    case 5:
      return { rotationDeg: 90, flipHorizontal: true, swapsDimensions: true }
    case 6:
      return { rotationDeg: 90, flipHorizontal: false, swapsDimensions: true }
    case 7:
      return { rotationDeg: 270, flipHorizontal: true, swapsDimensions: true }
    case 8:
      return { rotationDeg: 270, flipHorizontal: false, swapsDimensions: true }
    default:
      // 1 (normal) o cualquier valor no reconocido: sin transformación.
      return { rotationDeg: 0, flipHorizontal: false, swapsDimensions: false }
  }
}

/**
 * Lee el tag EXIF `Orientation` de un JPEG a mano (sin dependencias nuevas,
 * mismo criterio que SIG-001 "Canvas API nativa, sin dependencias nuevas").
 * Devuelve 1 (normal) si el archivo no es JPEG, no trae segmento EXIF, o el
 * tag no está presente — nunca lanza.
 */
export function readJpegExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1 // no es JPEG (SOI marker)

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === 0xffe1) return readOrientationFromApp1(view, offset + 4) // APP1 — donde vive EXIF
    if ((marker & 0xff00) !== 0xff00) break // dejó de haber markers válidos
    const segmentLength = view.getUint16(offset + 2)
    offset += 2 + segmentLength
  }
  return 1
}

function readOrientationFromApp1(view: DataView, exifStart: number): number {
  if (exifStart + 6 > view.byteLength || view.getUint32(exifStart) !== 0x45786966) return 1 // "Exif\0\0"
  const tiffStart = exifStart + 6
  const little = view.getUint16(tiffStart) === 0x4949
  const getUint16 = (o: number) => view.getUint16(o, little)
  const getUint32 = (o: number) => view.getUint32(o, little)

  const firstIfdOffset = getUint32(tiffStart + 4)
  const ifdStart = tiffStart + firstIfdOffset
  if (ifdStart + 2 > view.byteLength) return 1

  const entryCount = getUint16(ifdStart)
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12
    if (entryOffset + 12 > view.byteLength) break
    if (getUint16(entryOffset) === 0x0112) return getUint16(entryOffset + 8) // tag 0x0112 = Orientation
  }
  return 1
}

/** Dependencias de browser que orquesta `resizeImageFile` — inyectables para test. */
export interface ResizeImageFileDeps {
  loadImageBitmap: (
    file: File
  ) => Promise<{ width: number; height: number; source: CanvasImageSource }>
  encodeJpeg: (
    draw: (ctx: CanvasRenderingContext2D) => void,
    width: number,
    height: number
  ) => Promise<Blob>
}

/* v8 ignore start -- adaptador de browser APIs puro (createImageBitmap +
 * Canvas 2D), sin lógica propia — la lógica de verdad (dimensiones,
 * orientación, orquestación) ya está cubierta arriba con deps inyectadas.
 * jsdom no implementa un 2D context real (`getContext('2d')` devuelve
 * `null` sin el paquete nativo `canvas`, no instalado a propósito — mismo
 * criterio del README para "configuración, sin test unitario"), así que
 * esto se verifica en Paso 6 del plan (prueba manual de los 5 flujos
 * contra backend real), no acá. */
const defaultDeps: ResizeImageFileDeps = {
  loadImageBitmap: (file) =>
    createImageBitmap(file).then((bitmap) => ({
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
    })),
  encodeJpeg: (draw, width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('resizeImageFile: Canvas 2D no disponible en este cliente')
    draw(ctx)
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('resizeImageFile: toBlob devolvió null')),
        'image/jpeg',
        JPEG_QUALITY
      )
    })
  },
}
/* v8 ignore stop */

/**
 * Redimensiona un archivo de imagen según `mode` (`ResizeToMaxSide` /
 * `ResizeToSquare`), corrigiendo orientación EXIF antes, y devuelve un
 * nuevo `File` JPEG a calidad 0.8 — mismo pipeline conceptual que
 * `ImageResizer.cs` del backend (SIG-001), del lado del cliente.
 *
 * El recorte central de `ResizeToSquare` no recorta el rect fuente a mano:
 * dibuja la imagen completa (ya orientada y escalada) centrada sobre un
 * canvas cuadrado de `outputSize`, y deja que el propio canvas recorte lo
 * que sobra fuera de sus bordes — evita tener que remapear un rect de
 * recorte al espacio rotado cuando la foto viene con EXIF 90°/270°.
 */
export async function resizeImageFile(
  file: File,
  mode: ResizeMode,
  deps: ResizeImageFileDeps = defaultDeps
): Promise<File> {
  const buffer = await file.arrayBuffer()
  const transform = orientationToTransform(readJpegExifOrientation(buffer))

  const { width: rawWidth, height: rawHeight, source } = await deps.loadImageBitmap(file)
  const displayWidth = transform.swapsDimensions ? rawHeight : rawWidth
  const displayHeight = transform.swapsDimensions ? rawWidth : rawHeight

  const { outputWidth, outputHeight, scale } =
    mode.kind === 'maxSide'
      ? (() => {
          const target = computeMaxSideDimensions(displayWidth, displayHeight, mode.maxSide)
          return {
            outputWidth: target.width,
            outputHeight: target.height,
            scale: target.width / displayWidth,
          }
        })()
      : {
          outputWidth: mode.size,
          outputHeight: mode.size,
          scale: mode.size / Math.min(displayWidth, displayHeight),
        }

  const drawnWidth = rawWidth * scale
  const drawnHeight = rawHeight * scale

  const blob = await deps.encodeJpeg(
    (ctx) => {
      ctx.translate(outputWidth / 2, outputHeight / 2)
      ctx.rotate((transform.rotationDeg * Math.PI) / 180)
      if (transform.flipHorizontal) ctx.scale(-1, 1)
      ctx.drawImage(source, -drawnWidth / 2, -drawnHeight / 2, drawnWidth, drawnHeight)
    },
    outputWidth,
    outputHeight
  )

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}
