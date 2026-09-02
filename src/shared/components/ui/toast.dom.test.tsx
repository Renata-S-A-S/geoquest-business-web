import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastViewport } from './toast'
import { useToastStore } from '@/shared/stores/toast-store'
import { useToast } from '@/shared/hooks/use-toast'

/** Harness mínimo: expone `useToast()` en botones, para probar la integración
 * store → hook → viewport de punta a punta, no solo el store por separado. */
function ToastTrigger() {
  const { toast, success, error, info } = useToast()
  return (
    <>
      <button onClick={() => success('Recompensa publicada')}>success</button>
      <button onClick={() => error('No se pudo guardar')}>error</button>
      <button onClick={() => info('Revisión pendiente')}>info</button>
      <button onClick={() => toast('info', 'Vía toast() genérico')}>generic</button>
    </>
  )
}

describe('ToastViewport', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('no renderiza nada sin toasts activos', () => {
    const { container } = render(<ToastViewport />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza un toast disparado vía useToast() con su mensaje', () => {
    render(
      <>
        <ToastTrigger />
        <ToastViewport />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'success' }))

    expect(screen.getByText('Recompensa publicada')).toBeInTheDocument()
  })

  it('el helper genérico toast(variant, message) también dispara un toast', () => {
    render(
      <>
        <ToastTrigger />
        <ToastViewport />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'generic' }))

    expect(screen.getByText('Vía toast() genérico')).toBeInTheDocument()
  })

  it('apila múltiples toasts sin reemplazar los anteriores', () => {
    render(
      <>
        <ToastTrigger />
        <ToastViewport />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'success' }))
    fireEvent.click(screen.getByRole('button', { name: 'error' }))
    fireEvent.click(screen.getByRole('button', { name: 'info' }))

    expect(screen.getAllByRole('status')).toHaveLength(3)
    expect(screen.getByText('Recompensa publicada')).toBeInTheDocument()
    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument()
    expect(screen.getByText('Revisión pendiente')).toBeInTheDocument()
  })

  it('usa aria-live="assertive" para error y "polite" para success/info', () => {
    render(
      <>
        <ToastTrigger />
        <ToastViewport />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'success' }))
    fireEvent.click(screen.getByRole('button', { name: 'error' }))
    fireEvent.click(screen.getByRole('button', { name: 'info' }))

    const [success, error, info] = screen.getAllByRole('status')
    expect(success).toHaveAttribute('aria-live', 'polite')
    expect(error).toHaveAttribute('aria-live', 'assertive')
    expect(info).toHaveAttribute('aria-live', 'polite')
  })

  it('se puede cerrar manualmente antes de que expire', () => {
    render(
      <>
        <ToastTrigger />
        <ToastViewport />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'success' }))
    expect(screen.getByText('Recompensa publicada')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText('Recompensa publicada')).not.toBeInTheDocument()
  })

  it('se auto-descarta después de `duration` (default ~4000ms)', () => {
    vi.useFakeTimers()
    try {
      render(<ToastViewport />)
      act(() => {
        useToastStore.getState().show({ variant: 'success', message: 'Efímero' })
      })
      expect(screen.getByText('Efímero')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(3999)
      })
      expect(screen.getByText('Efímero')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByText('Efímero')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('respeta una `duration` custom en vez del default', () => {
    vi.useFakeTimers()
    try {
      render(<ToastViewport />)
      act(() => {
        useToastStore.getState().show({ variant: 'info', message: 'Corto', duration: 1000 })
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.queryByText('Corto')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cada toast auto-descartado no afecta el timer de los demás', () => {
    vi.useFakeTimers()
    try {
      render(<ToastViewport />)
      act(() => {
        useToastStore.getState().show({ variant: 'success', message: 'Primero', duration: 1000 })
      })
      act(() => {
        vi.advanceTimersByTime(500)
      })
      act(() => {
        useToastStore.getState().show({ variant: 'success', message: 'Segundo', duration: 1000 })
      })

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.queryByText('Primero')).not.toBeInTheDocument()
      expect(screen.getByText('Segundo')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.queryByText('Segundo')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
