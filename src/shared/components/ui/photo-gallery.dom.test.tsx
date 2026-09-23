import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhotoGallery, type GalleryPhoto } from './photo-gallery'

const PHOTOS: GalleryPhoto[] = [
  { id: 'a', url: 'blob:a' },
  { id: 'b', url: 'blob:b' },
  { id: 'c', url: 'blob:c' },
]

function ControlledGallery({ initial = PHOTOS }: { initial?: GalleryPhoto[] }) {
  const [photos, setPhotos] = useState(initial)
  return <PhotoGallery photos={photos} onChange={setPhotos} />
}

describe('PhotoGallery', () => {
  it('no renderiza nada sin fotos', () => {
    const { container } = render(<PhotoGallery photos={[]} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza una fila por foto en orden', () => {
    render(<ControlledGallery />)
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(3)
    expect(images[0]).toHaveAttribute('src', 'blob:a')
    expect(images[2]).toHaveAttribute('src', 'blob:c')
  })

  it('mover la primera foto hacia adelante está deshabilitado', () => {
    render(<ControlledGallery />)
    expect(screen.getByRole('button', { name: 'Mover foto 1 hacia adelante' })).toBeDisabled()
  })

  it('mover la última foto hacia atrás está deshabilitado', () => {
    render(<ControlledGallery />)
    expect(screen.getByRole('button', { name: 'Mover foto 3 hacia atrás' })).toBeDisabled()
  })

  it('mover una foto hacia adelante la reordena', () => {
    render(<ControlledGallery />)
    fireEvent.click(screen.getByRole('button', { name: 'Mover foto 2 hacia adelante' }))

    const images = screen.getAllByRole('img')
    expect(images[0]).toHaveAttribute('src', 'blob:b')
    expect(images[1]).toHaveAttribute('src', 'blob:a')
  })

  it('mover una foto hacia atrás la reordena', () => {
    render(<ControlledGallery />)
    fireEvent.click(screen.getByRole('button', { name: 'Mover foto 1 hacia atrás' }))

    const images = screen.getAllByRole('img')
    expect(images[0]).toHaveAttribute('src', 'blob:b')
    expect(images[1]).toHaveAttribute('src', 'blob:a')
  })

  it('quitar una foto la saca de la lista y renumera el resto', () => {
    render(<ControlledGallery />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 2' }))

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', 'blob:a')
    expect(images[1]).toHaveAttribute('src', 'blob:c')
  })
})
