/**
 * Límites de subida de archivos del módulo Business — ✅ ADR-048 (Decisión 3),
 * confirmado por Derek el 2 sep 2026. Sin precedente numérico previo en
 * Confluence (SIG-001 solo fija el _target_ de compresión server-side a
 * 1024px, no un tope de subida): estas cifras son producto, no inferencia.
 *
 * Estos límites se validan client-side ANTES de intentar subir (issue #14),
 * con el mismo criterio de tipo/tamaño que va a usar el backend real — pero
 * la fuente de verdad sigue siendo el backend: esta tabla es UX (feedback
 * inmediato), nunca el único guardarraíl.
 */
export type UploadKind =
  'legalDocument' | 'logo' | 'placePhoto' | 'rewardImage' | 'verificationVideo'

export interface UploadLimit {
  /** Mime types aceptados. */
  acceptedMimeTypes: readonly string[]
  /** Extensiones equivalentes, para el atributo `accept` del `<input>`. */
  acceptedExtensions: readonly string[]
  /** Tamaño máximo en bytes. */
  maxSizeBytes: number
}

const MB = 1024 * 1024

/** MOV explícitamente afuera (ADR-048, Decisión 4) — ver `MOV_MIME_TYPES` abajo, mensaje específico, no "formato no soportado" genérico. */
export const UPLOAD_LIMITS: Record<UploadKind, UploadLimit> = {
  legalDocument: {
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    acceptedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    maxSizeBytes: 5 * MB,
  },
  logo: {
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxSizeBytes: 2 * MB,
  },
  placePhoto: {
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxSizeBytes: 5 * MB,
  },
  rewardImage: {
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    maxSizeBytes: 5 * MB,
  },
  verificationVideo: {
    acceptedMimeTypes: ['video/mp4', 'video/webm'],
    acceptedExtensions: ['.mp4', '.webm'],
    maxSizeBytes: 50 * MB,
  },
}

/**
 * Mime types con los que un navegador identifica un `.mov` — Safari/iOS
 * reporta `video/quicktime`; algunos navegadores dejan `type` vacío para
 * contenedores que no reconocen, así que también se detecta por extensión.
 */
const MOV_MIME_TYPES = new Set(['video/quicktime'])

export function isMovFile(file: File): boolean {
  if (MOV_MIME_TYPES.has(file.type)) return true
  return file.name.toLowerCase().endsWith('.mov')
}

export type FileValidationError =
  | { kind: 'mov-unsupported' }
  | { kind: 'invalid-type' }
  | { kind: 'size-exceeded'; maxSizeBytes: number }

/**
 * Valida un archivo contra los límites de `uploadKind`. Devuelve `null` si
 * es válido. El caso `.mov` se distingue del resto de "formato inválido" a
 * propósito (ADR-048, Decisión 4): el mensaje debe explicar POR QUÉ no se
 * soporta (no hay transcoding en cliente/servidor), no un genérico
 * "formato no soportado" que no le dice al dueño del negocio qué hacer.
 */
export function validateUploadFile(file: File, uploadKind: UploadKind): FileValidationError | null {
  const limit = UPLOAD_LIMITS[uploadKind]

  if (uploadKind === 'verificationVideo' && isMovFile(file)) {
    return { kind: 'mov-unsupported' }
  }

  if (!limit.acceptedMimeTypes.includes(file.type)) {
    return { kind: 'invalid-type' }
  }

  if (file.size > limit.maxSizeBytes) {
    return { kind: 'size-exceeded', maxSizeBytes: limit.maxSizeBytes }
  }

  return null
}
