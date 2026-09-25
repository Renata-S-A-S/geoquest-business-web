import { useRef, useState } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/shared/components/ui/button'
import { useUploadRewardImage } from '@/features/rewards/queries'
import { useToast } from '@/shared/hooks/use-toast'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import {
  UPLOAD_LIMITS,
  validateUploadFile,
  type FileValidationError,
} from '@/shared/lib/upload-limits'
import { RESIZE_CONFIG, resizeImageFile } from '@/shared/lib/image-processing'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'

const MB = 1024 * 1024

/**
 * Traduce los errores del servidor a su motivo real.
 *
 * Directo y no vía el `fallback` de `getProblemDetailsMessage`, que resuelve
 * `detail ?? title ?? fallback`. Acá eso importa MÁS que en el resto del
 * módulo: los cuatro mensajes de validación de imagen del backend están **en
 * español** (`RewardImageValidation.cs:40,46,52`), a diferencia del resto que
 * está en inglés. Pasar por el fallback mostraría un texto en español que suena
 * bien pero no es nuestro, con otro tono y sin decirle al dueño qué hacer.
 */
function uploadErrorMessage(error: unknown, t: TFunction<'rewards'>): string {
  if (!axios.isAxiosError(error)) return t('image.errors.generic')

  const title = error.response?.data?.title as string | undefined
  const status = error.response?.status

  if (title === 'RewardImage.TooLarge') {
    return t('image.errors.tooLarge', {
      maxSizeMb: UPLOAD_LIMITS.rewardImage.maxSizeBytes / MB,
    })
  }
  if (title === 'RewardImage.UnsupportedFormat') return t('image.errors.unsupportedFormat')
  if (title === 'RewardImage.Empty') return t('image.errors.empty')
  if (title === 'RewardImageEndpoints.NoFile') return t('image.errors.noFile')
  if (title === 'RewardPortal.BusinessNotActive') return t('image.errors.businessNotActive')
  if (title === 'RewardPortal.RewardNotFound') return t('image.errors.notFound')

  /**
   * ⚠️ Un 500 acá **puede ser una carrera de concurrencia**, no necesariamente
   * un servidor roto: este endpoint usa `CommitAsync` y no `TryCommitAsync`
   * (`UploadRewardImageCommandHandler.cs:76`), al revés que editar/pausar/
   * republicar, así que un conflicto de `xmin` escapa como 500 en vez de 409.
   *
   * El portal **no puede distinguir** los dos casos, así que el mensaje no
   * afirma ninguno: dice que se puede reintentar, que es lo único cierto y lo
   * único accionable. Culpar al servidor haría que el dueño no reintente
   * cuando un reintento habría funcionado.
   */
  if (status === 500) return t('image.errors.serverOrConflict')

  return getProblemDetailsMessage(error, t('image.errors.generic'))
}

/** Los errores de validación del cliente, con el mismo criterio de mensaje. */
function validationMessage(error: FileValidationError, t: TFunction<'rewards'>): string {
  if (error.kind === 'size-exceeded') {
    return t('image.errors.tooLarge', { maxSizeMb: error.maxSizeBytes / MB })
  }

  return t('image.errors.unsupportedFormat')
}

export interface RewardImageUploadProps {
  businessId: string
  reward: BusinessRewardSummary
  /**
   * Redimensionado inyectable. `resizeImageFile` usa `createImageBitmap` y
   * Canvas 2D, que jsdom no implementa, así que los tests pasan un doble.
   * Mismo criterio que `ResizeImageFileDeps` en `image-processing.ts`.
   */
  resizeFile?: (file: File) => Promise<File>
}

/**
 * Subida de la imagen de una recompensa (#112).
 *
 * **No reusa `FileDropzone`**, y la razón es concreta: ese componente atrapa
 * cualquier fallo de subida con un `.catch(() => …)` y lo colapsa en un único
 * `errors.uploadFailed`. Acá hay **seis** códigos de error distintos que el
 * dueño necesita poder distinguir — formato, tamaño, vacío, negocio inactivo,
 * recompensa inexistente y el 500 ambiguo — así que usar `FileDropzone` sería
 * perder justo la información que este issue pide manejar.
 *
 * Lo que SÍ se reusa es la infraestructura que importa: `UPLOAD_LIMITS`,
 * `validateUploadFile` y `RESIZE_CONFIG.rewardImage`, ya configurados para
 * `rewardImage`.
 *
 * La validación del cliente es una cortesía para fallar rápido, **nunca la
 * autoridad**: el backend valida por magic bytes y renombrar un `.txt` a `.jpg`
 * no lo engaña.
 */
export function RewardImageUpload({
  businessId,
  reward,
  resizeFile = (file) => resizeImageFile(file, RESIZE_CONFIG.rewardImage),
}: RewardImageUploadProps) {
  const { t } = useTranslation('rewards')
  const { success } = useToast()
  const mutation = useUploadRewardImage(businessId, reward.rewardId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | undefined>(undefined)
  const [preparing, setPreparing] = useState(false)

  const limit = UPLOAD_LIMITS.rewardImage
  const busy = preparing || mutation.isPending

  async function onFileChosen(file: File) {
    setLocalError(undefined)

    const invalid = validateUploadFile(file, 'rewardImage')
    if (invalid) {
      setLocalError(validationMessage(invalid, t))
      return
    }

    /**
     * Se redimensiona antes de subir aunque el backend igual re-encodea a JPEG
     * maxSide 1024 (`RewardImageResizePipeline.cs:15-18`): el portal es
     * mobile-first, y mandar 5 MB desde un celular para que el servidor los
     * convierta en 200 KB gasta datos del negocio sin necesidad.
     *
     * Si el redimensionado falla se sube el original: es una optimización, no
     * un requisito, y perder la subida por no poder optimizarla sería peor.
     */
    setPreparing(true)
    let toUpload = file
    try {
      toUpload = await resizeFile(file)
    } catch {
      toUpload = file
    } finally {
      setPreparing(false)
    }

    mutation.mutate(toUpload, {
      onSuccess: () => success(t('image.success')),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {reward.imageUrl === null ? (
        <>
          <p className="font-sans text-sm text-ink">{t('detail.image.empty')}</p>
          <p className="font-sans text-xs text-muted">{t('image.emptyHint')}</p>
        </>
      ) : (
        <img
          src={reward.imageUrl}
          alt={t('detail.image.alt', { title: reward.title })}
          className="max-h-64 w-full rounded-sm border border-border object-cover"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={limit.acceptedMimeTypes.join(',')}
        aria-label={t('image.fileInputAria')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onFileChosen(file)
          // Se limpia para que elegir el MISMO archivo otra vez vuelva a
          // disparar `change` — si no, un reintento tras un error no haría nada.
          event.target.value = ''
        }}
      />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant={reward.imageUrl === null ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? t('image.uploading')
            : reward.imageUrl === null
              ? t('image.upload')
              : t('image.replace')}
        </Button>
      </div>

      <p className="font-sans text-xs text-muted">
        {t('image.limits', {
          maxSizeMb: limit.maxSizeBytes / MB,
          formats: limit.acceptedExtensions.join(', '),
        })}
      </p>

      {(localError || mutation.isError) && (
        <p role="alert" className="font-sans text-xs text-alert">
          {localError ?? uploadErrorMessage(mutation.error, t)}
        </p>
      )}
    </div>
  )
}
