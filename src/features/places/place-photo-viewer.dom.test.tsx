import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlacePhotoViewer } from './place-photo-viewer'

const PHOTOS = [
  'https://cdn.example/uno.jpg',
  'https://cdn.example/dos.jpg',
  'https://cdn.example/tres.jpg',
]

function renderViewer(photos: string[] = PHOTOS) {
  return render(<PlacePhotoViewer photos={photos} placeName="Café de la 70" />)
}

describe('PlacePhotoViewer', () => {
  /**
   * Antes las miniaturas eran `<img>` sueltas: se veían pero no hacían nada,
   * lo que invita a hacer click sin obtener respuesta. Ser botones —y no
   * `<img>` con `onClick`— es lo que las hace alcanzables por teclado y las
   * anuncia como accionables a un lector de pantalla.
   */
  it('renderiza cada miniatura como un botón accionable, no como una imagen muda', () => {
    renderViewer()

    expect(screen.getAllByRole('button')).toHaveLength(PHOTOS.length)
    expect(screen.getByRole('button', { name: 'Ver la foto 1 más grande' })).toBeInTheDocument()
  })

  it('no abre nada hasta que se hace click', () => {
    renderViewer()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre la foto en grande al hacer click en su miniatura', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 2 más grande' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Foto 2 de 3')).toBeInTheDocument()
  })

  it('muestra la foto que se eligió, no siempre la primera', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 3 más grande' }))

    expect(screen.getByAltText('Café de la 70')).toHaveAttribute('src', PHOTOS[2])
  })

  it('navega a la siguiente foto', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 1 más grande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }))

    expect(screen.getByText('Foto 2 de 3')).toBeInTheDocument()
  })

  /**
   * Navegación circular a propósito: con hasta 5 fotos, llegar al final y no
   * poder seguir obliga a retroceder clickeando una por una.
   */
  it('da la vuelta al pasar de la última a la primera', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 3 más grande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }))

    expect(screen.getByText('Foto 1 de 3')).toBeInTheDocument()
  })

  it('da la vuelta al retroceder desde la primera', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 1 más grande' }))
    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }))

    expect(screen.getByText('Foto 3 de 3')).toBeInTheDocument()
  })

  /**
   * Las flechas del teclado son lo natural en un visor de galería: obligar a
   * apuntar con el mouse a un botón chico es justo lo que molesta cuando lo
   * único que se está haciendo es mirar.
   */
  it('navega con las flechas del teclado', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 1 más grande' }))
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('Foto 2 de 3')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(screen.getByText('Foto 1 de 3')).toBeInTheDocument()
  })

  it('no ofrece navegación con una sola foto, porque no hay a dónde ir', () => {
    renderViewer([PHOTOS[0]])

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 1 más grande' }))

    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Foto anterior' })).not.toBeInTheDocument()
  })

  it('cierra el visor con Escape', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 1 más grande' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('no deja escuchando las flechas después de cerrar', () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto 1 más grande' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
