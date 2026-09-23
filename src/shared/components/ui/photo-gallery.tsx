import { ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

export interface GalleryPhoto {
  id: string
  url: string
}

export interface PhotoGalleryProps {
  photos: GalleryPhoto[]
  onChange: (photos: GalleryPhoto[]) => void
  className?: string
}

function swap<T>(items: T[], indexA: number, indexB: number): T[] {
  const next = [...items]
  ;[next[indexA], next[indexB]] = [next[indexB], next[indexA]]
  return next
}

/**
 * Galería de fotos de `Place` con reordenar/eliminar (B-02, máx. 5,
 * `place.ts`) — UI de la sección adelantable del plan, sin conectar
 * todavía a ningún form real (#31 sigue bloqueado, ver `uploader.ts`).
 * Recibe `photos` ya subidas (URL final); no sabe nada de `FileDropzone`
 * ni de `Uploader` — compone con lo que sea que las produzca.
 *
 * Reordenar con flechas ←/→ en vez de drag&drop: mismo criterio de
 * accesibilidad que `Select`/`Toast` — cada control es operable por
 * teclado sin depender de un gesto de mouse/touch, y no hace falta una
 * librería de DnD nueva para 5 items como máximo.
 */
export function PhotoGallery({ photos, onChange, className }: PhotoGalleryProps) {
  const { t } = useTranslation('uploads')

  // Sin guarda por índice a propósito: el botón ya queda `disabled` en el
  // extremo correspondiente (abajo), que es lo que de verdad impide el
  // click — un guard acá sería código muerto, nunca alcanzable desde la UI.
  const moveEarlier = (index: number) => onChange(swap(photos, index, index - 1))
  const moveLater = (index: number) => onChange(swap(photos, index, index + 1))

  const remove = (index: number) => {
    onChange(photos.filter((_, i) => i !== index))
  }

  if (photos.length === 0) return null

  return (
    <ul className={cn('grid grid-cols-3 gap-2 sm:grid-cols-5', className)}>
      {photos.map((photo, index) => {
        const position = index + 1
        return (
          <li key={photo.id} className="relative">
            <img
              src={photo.url}
              alt={t('gallery.positionLabel', { ns: 'uploads', position, total: photos.length })}
              className="aspect-square w-full rounded-xs object-cover"
            />
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveEarlier(index)}
                disabled={index === 0}
                aria-label={t('gallery.moveUpAria', { ns: 'uploads', position })}
                className="text-muted disabled:opacity-30"
              >
                <ArrowLeft size={14} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t('gallery.removeAria', { ns: 'uploads', position })}
                className="text-alert"
              >
                <X size={14} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => moveLater(index)}
                disabled={index === photos.length - 1}
                aria-label={t('gallery.moveDownAria', { ns: 'uploads', position })}
                className="text-muted disabled:opacity-30"
              >
                <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
