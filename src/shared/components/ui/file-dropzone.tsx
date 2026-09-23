import { useCallback, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { CloudArrowUp, FileText, WarningCircle, CheckCircle, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import {
  validateUploadFile,
  UPLOAD_LIMITS,
  type UploadKind,
  type FileValidationError,
} from '@/shared/lib/upload-limits'
import { resizeImageFile, type ResizeMode } from '@/shared/lib/image-processing'
import type { Uploader } from '@/shared/lib/uploader'

export interface FileDropzoneItem {
  id: string
  file: File
  status: 'uploading' | 'success' | 'error'
  url?: string
  /** Ya traducido — construido con `t()` al momento de fallar, ver `validationErrorMessage`. */
  errorMessage?: string
}

export interface FileDropzoneProps {
  /** Determina límites de tipo/tamaño (✅ ADR-048) y, si aplica, el resize de SIG-001. */
  uploadKind: UploadKind
  /** Implementación inyectada — hoy siempre `mockUploader`, ver aviso en `uploader.ts`. */
  uploader: Uploader
  /** Ausente para documento legal / video de verificación — SIG-001: "sin resize, se sube tal cual". */
  resizeMode?: ResizeMode
  value: FileDropzoneItem[]
  onChange: (items: FileDropzoneItem[]) => void
  multiple?: boolean
  /** Máximo de archivos simultáneos — ej. 5 para fotos de `Place` (B-02). Con `multiple: false` se ignora (siempre 1). */
  maxFiles?: number
  label: string
  hint?: string
  disabled?: boolean
  className?: string
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0)
}

function validationErrorMessage(
  error: FileValidationError,
  uploadKind: UploadKind,
  t: ReturnType<typeof useTranslation<'uploads'>>['t']
): string {
  const limit = UPLOAD_LIMITS[uploadKind]
  switch (error.kind) {
    case 'mov-unsupported':
      return t('errors.movUnsupported', { ns: 'uploads' })
    case 'size-exceeded':
      return t('errors.sizeExceeded', { ns: 'uploads', maxSizeMb: formatMb(error.maxSizeBytes) })
    case 'invalid-type':
      return t('errors.invalidType', {
        ns: 'uploads',
        formats: limit.acceptedExtensions.join(', '),
      })
  }
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Selector de archivo con drag&drop, validación client-side, resize
 * opcional (SIG-001) y subida contra un `Uploader` inyectable — issue #14
 * (plan Paso 2/3). Ver `uploader.ts`: mock-only en este slice, no cierra el
 * issue como "conectado a backend real".
 *
 * Estados por archivo: `uploading` (incluye el resize, si aplica) →
 * `success` | `error` (con reintento). El input real queda oculto
 * (`sr-only`) y asociado vía `<label>`, así que es navegable por teclado y
 * anunciable por lector de pantalla sin depender del área de drop (que no
 * es un control nativo).
 */
export function FileDropzone({
  uploadKind,
  uploader,
  resizeMode,
  value,
  onChange,
  multiple = false,
  maxFiles,
  label,
  hint,
  disabled,
  className,
}: FileDropzoneProps) {
  const { t } = useTranslation('uploads')
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const limit = UPLOAD_LIMITS[uploadKind]
  const effectiveMax = multiple ? maxFiles : 1
  const atLimit = effectiveMax !== undefined && value.length >= effectiveMax

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files)
      const currentCount = value.length
      const remainingSlots =
        effectiveMax !== undefined ? Math.max(effectiveMax - currentCount, 0) : incoming.length

      const accepted = incoming.slice(0, remainingSlots)
      const overflow = incoming.slice(remainingSlots)

      const newItems: FileDropzoneItem[] = accepted.map((file) => {
        const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const validationError = validateUploadFile(file, uploadKind)
        return validationError
          ? {
              id,
              file,
              status: 'error',
              errorMessage: validationErrorMessage(validationError, uploadKind, t),
            }
          : { id, file, status: 'uploading' }
      })

      const overflowItems: FileDropzoneItem[] = overflow.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'error',
        errorMessage:
          effectiveMax !== undefined
            ? t('errors.tooManyFiles', { ns: 'uploads', max: effectiveMax })
            : t('errors.uploadFailed', { ns: 'uploads' }),
      }))

      const nextValue = multiple
        ? [...value, ...newItems, ...overflowItems]
        : [...newItems, ...overflowItems]
      onChange(nextValue)

      for (const item of newItems) {
        if (item.status === 'uploading') void runUploadFor(item, nextValue)
      }

      // `runUpload` cierra sobre `value` capturado en el render anterior a este `addFiles` — se le pasa
      // explícitamente el `nextValue` ya actualizado para que el update de estado que hace al terminar
      // no pise los items recién agregados.
      function runUploadFor(item: FileDropzoneItem, latestValue: FileDropzoneItem[]) {
        const upload = resizeMode
          ? resizeImageFile(item.file, resizeMode).then((resized) => uploader.upload(resized))
          : uploader.upload(item.file)

        upload
          .then((result) => {
            onChange(
              latestValue.map((existing) =>
                existing.id === item.id
                  ? { ...existing, status: 'success' as const, url: result.url }
                  : existing
              )
            )
          })
          .catch(() => {
            onChange(
              latestValue.map((existing) =>
                existing.id === item.id
                  ? {
                      ...existing,
                      status: 'error' as const,
                      errorMessage: t('errors.uploadFailed', { ns: 'uploads' }),
                    }
                  : existing
              )
            )
          })
      }
    },
    [value, onChange, effectiveMax, multiple, uploadKind, t, resizeMode, uploader]
  )

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addFiles(event.target.files)
    event.target.value = '' // permite re-seleccionar el mismo archivo tras quitarlo/reintentar
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    if (disabled || atLimit) return
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files)
  }

  const handleRetry = (item: FileDropzoneItem) => {
    const resetItem: FileDropzoneItem = { ...item, status: 'uploading', errorMessage: undefined }
    const nextValue = value.map((existing) => (existing.id === item.id ? resetItem : existing))
    onChange(nextValue)

    const upload = resizeMode
      ? resizeImageFile(item.file, resizeMode).then((resized) => uploader.upload(resized))
      : uploader.upload(item.file)

    upload
      .then((result) => {
        onChange(
          nextValue.map((existing) =>
            existing.id === item.id
              ? { ...existing, status: 'success' as const, url: result.url }
              : existing
          )
        )
      })
      .catch(() => {
        onChange(
          nextValue.map((existing) =>
            existing.id === item.id
              ? {
                  ...existing,
                  status: 'error' as const,
                  errorMessage: t('errors.uploadFailed', { ns: 'uploads' }),
                }
              : existing
          )
        )
      })
  }

  const handleRemove = (id: string) => {
    onChange(value.filter((existing) => existing.id !== id))
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="group"
        aria-label={label}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !atLimit) setIsDraggingOver(true)
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center gap-1.5 rounded-xs border-2 border-dashed border-border bg-paper px-4 py-6 text-center transition-colors',
          isDraggingOver && 'border-teal bg-surface-teal',
          (disabled || atLimit) && 'opacity-50'
        )}
      >
        <CloudArrowUp aria-hidden="true" size={22} weight="bold" className="text-muted" />
        <label
          htmlFor={inputId}
          className={cn(
            'font-sans text-[12.5px] font-bold text-teal',
            (disabled || atLimit) && 'pointer-events-none cursor-not-allowed'
          )}
        >
          {label}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={limit.acceptedMimeTypes.join(',')}
            multiple={multiple}
            disabled={disabled || atLimit}
            className="sr-only"
            onChange={handleInputChange}
          />
        </label>
        <span className="font-sans text-[11px] text-muted">
          {atLimit
            ? t('dropzone.limitReached', { ns: 'uploads', max: effectiveMax })
            : t('dropzone.dragHint', { ns: 'uploads' })}
        </span>
        {hint && !atLimit && <span className="font-sans text-[10px] text-muted">{hint}</span>}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((item) => (
            <FileDropzoneRow
              key={item.id}
              item={item}
              onRetry={() => handleRetry(item)}
              onRemove={() => handleRemove(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function FileDropzoneRow({
  item,
  onRetry,
  onRemove,
}: {
  item: FileDropzoneItem
  onRetry: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation('uploads')
  const previewUrl = isImageFile(item.file) ? URL.createObjectURL(item.file) : null

  return (
    <li className="flex items-center gap-2.5 rounded-xs border border-border bg-surface-raised px-2.5 py-2">
      {previewUrl ? (
        <img src={previewUrl} alt="" className="h-9 w-9 shrink-0 rounded-xs object-cover" />
      ) : (
        <FileText aria-hidden="true" size={20} className="shrink-0 text-muted" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-sans text-xs text-ink">{item.file.name}</span>
        <span className="font-sans text-[10px] text-muted">
          {(item.file.size / (1024 * 1024)).toFixed(1)} MB
          {item.status === 'uploading' && ` · ${t('dropzone.uploading', { ns: 'uploads' })}`}
        </span>
        {item.status === 'error' && item.errorMessage && (
          <span role="alert" className="font-sans text-[10px] text-alert">
            {item.errorMessage}
          </span>
        )}
      </div>

      {item.status === 'success' && (
        <CheckCircle aria-hidden="true" size={18} weight="fill" className="shrink-0 text-green" />
      )}
      {item.status === 'error' && (
        <>
          <WarningCircle
            aria-hidden="true"
            size={18}
            weight="fill"
            className="shrink-0 text-alert"
          />
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 font-sans text-[11px] font-bold text-teal"
          >
            {t('dropzone.retry', { ns: 'uploads' })}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('dropzone.removeAria', { ns: 'uploads', fileName: item.file.name })}
        className="shrink-0 text-muted"
      >
        <X size={14} weight="bold" />
      </button>
    </li>
  )
}
