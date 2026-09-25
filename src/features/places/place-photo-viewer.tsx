import { useCallback, useEffect, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/shared/components/ui/modal'

export interface PlacePhotoViewerProps {
  photos: string[]
  /** Nombre del lugar, para el texto alternativo de cada foto. */
  placeName: string
}

/**
 * Visor de fotos del lugar. Las miniaturas abren la foto en grande.
 *
 * Antes las miniaturas eran `<img>` sueltas: se veían pero no hacían nada,
 * lo que invita a hacer click y no obtener respuesta. Ahora son botones —no
 * `<img>` con un `onClick`— así que llegan por teclado y se anuncian como
 * accionables.
 *
 * No se reutiliza `PhotoGallery` del kit porque ese componente es para
 * EDITAR (recibe `onChange` y administra una lista mutable). Acá el negocio
 * solo mira; mezclar los dos casos obligaría a pasar un `onChange` falso.
 *
 * El `Modal` compartido ya trae focus trap, cierre con Esc y portal fuera
 * del árbol con `overflow-hidden` del shell, así que el visor solo aporta la
 * navegación entre fotos.
 */
export function PlacePhotoViewer({ photos, placeName }: PlacePhotoViewerProps) {
  const { t } = useTranslation('places')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const showPrevious = useCallback(() => {
    // Circular a propósito: con hasta 5 fotos, llegar al final y no poder
    // seguir obliga a volver clickeando hacia atrás una por una.
    setOpenIndex((current) =>
      current === null ? null : (current - 1 + photos.length) % photos.length
    )
  }, [photos.length])

  const showNext = useCallback(() => {
    setOpenIndex((current) => (current === null ? null : (current + 1) % photos.length))
  }, [photos.length])

  /**
   * Las flechas del teclado navegan mientras el visor está abierto. Un visor
   * de galería sin flechas obliga a apuntar con el mouse a un botón chico,
   * que es justo lo que no se quiere cuando lo que se está haciendo es mirar.
   */
  useEffect(() => {
    if (openIndex === null) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') showPrevious()
      if (event.key === 'ArrowRight') showNext()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openIndex, showPrevious, showNext])

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={t('detail.photos.open', { index: index + 1 })}
            className="size-20 overflow-hidden rounded-xs border border-border focus:border-teal focus:outline-none"
          >
            <img src={url} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Modal
          open
          onClose={() => setOpenIndex(null)}
          title={t('detail.photos.viewerTitle', {
            index: openIndex + 1,
            total: photos.length,
          })}
        >
          <div className="flex flex-col gap-3">
            <img
              src={photos[openIndex]}
              alt={placeName}
              className="max-h-[60vh] w-full rounded-xs object-contain"
            />

            {/* Con una sola foto no hay a dónde navegar. */}
            {photos.length > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label={t('detail.photos.previous')}
                  className="rounded-xs border border-border p-2 text-ink focus:border-teal focus:outline-none"
                >
                  <CaretLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label={t('detail.photos.next')}
                  className="rounded-xs border border-border p-2 text-ink focus:border-teal focus:outline-none"
                >
                  <CaretRight size={20} />
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
