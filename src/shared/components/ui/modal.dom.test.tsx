import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './modal'

/** Harness con un trigger real afuera del modal — necesario para probar que
 * el foco vuelve a él al cerrar (criterio de aceptación del issue). */
function ModalHarness({ closeOnBackdropClick }: { closeOnBackdropClick?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>abrir</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmar canje"
        closeOnBackdropClick={closeOnBackdropClick}
        footer={<button onClick={() => setOpen(false)}>Confirmar</button>}
      >
        <p>Contenido del modal</p>
        <input aria-label="nota" />
      </Modal>
    </div>
  )
}

describe('Modal', () => {
  it('no renderiza nada cuando open=false', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Título" children="Contenido" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renderiza role="dialog" + aria-modal="true" + título + contenido + footer cuando open=true', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar canje" footer={<button>Confirmar</button>}>
        <p>Contenido del modal</p>
      </Modal>
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Confirmar canje')).toBeInTheDocument()
    expect(screen.getByText('Contenido del modal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('aria-labelledby del diálogo apunta al id del título', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirmar canje">
        Contenido
      </Modal>
    )

    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Confirmar canje')
  })

  it('mueve el foco al primer elemento enfocable al abrir', () => {
    render(<ModalHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'abrir' }))

    // El primer enfocable en el orden del DOM es el botón de cerrar (X),
    // antes que el contenido — mismo elemento que valida el test del
    // focus trap más abajo.
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('Tab desde el último elemento enfocable vuelve al primero (focus trap)', () => {
    render(<ModalHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }))

    const confirmButton = screen.getByRole('button', { name: 'Confirmar' })
    confirmButton.focus()
    fireEvent.keyDown(confirmButton, { key: 'Tab' })

    // El primer enfocable dentro del diálogo es el botón de cerrar (X).
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('Shift+Tab desde el primer elemento enfocable va al último (focus trap)', () => {
    render(<ModalHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }))

    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    closeButton.focus()
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })

    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()
  })

  it('Escape llama a onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título">
        Contenido
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignora teclas que no son Esc/Tab', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título">
        Contenido
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'a' })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('click en el backdrop llama a onClose por default', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título">
        Contenido
      </Modal>
    )

    fireEvent.click(screen.getByRole('dialog').parentElement!)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click en el backdrop NO llama a onClose cuando closeOnBackdropClick=false', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título" closeOnBackdropClick={false}>
        Contenido
      </Modal>
    )

    fireEvent.click(screen.getByRole('dialog').parentElement!)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('click dentro del contenido del diálogo no propaga al backdrop', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título">
        <p>Contenido del modal</p>
      </Modal>
    )

    fireEvent.click(screen.getByText('Contenido del modal'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('el botón de cerrar (X) llama a onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Título">
        Contenido
      </Modal>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('al cerrar, el foco vuelve al elemento que abrió el modal', () => {
    render(<ModalHarness />)
    const trigger = screen.getByRole('button', { name: 'abrir' })

    // Un click real de mouse enfoca el botón antes de disparar el evento —
    // `fireEvent.click` de jsdom no lo hace por sí solo, así que se enfoca
    // explícito para que `previouslyFocusedRef` capture lo mismo que en un
    // navegador real.
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('bloquea el scroll del body mientras está abierto y lo restaura al cerrar', () => {
    render(<ModalHarness />)
    expect(document.body.style.overflow).not.toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'abrir' }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
