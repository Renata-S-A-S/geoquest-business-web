import { beforeEach, describe, expect, it } from 'vitest'
import { useToastStore } from './toast-store'

describe('toast-store', () => {
  beforeEach(() => {
    // El store es un singleton — sin esto, un toast de un test contamina el
    // siguiente (mismo motivo por el que `setup.ts` resetea i18n y MSW).
    useToastStore.setState({ toasts: [] })
  })

  it('starts with an empty toast list', () => {
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('show() adds a toast with the default duration (~4000ms) when none is given', () => {
    useToastStore.getState().show({ variant: 'success', message: 'Guardado' })

    const [toast] = useToastStore.getState().toasts
    expect(toast).toMatchObject({ variant: 'success', message: 'Guardado', duration: 4000 })
    expect(toast.id).toEqual(expect.any(String))
  })

  it('show() respects a custom duration', () => {
    useToastStore.getState().show({ variant: 'error', message: 'Falló', duration: 8000 })

    expect(useToastStore.getState().toasts[0]).toMatchObject({ duration: 8000 })
  })

  it('show() assigns a unique id to each toast and stacks them without dropping earlier ones', () => {
    const { show } = useToastStore.getState()
    const id1 = show({ variant: 'info', message: 'Uno' })
    const id2 = show({ variant: 'info', message: 'Dos' })

    expect(id1).not.toEqual(id2)
    expect(useToastStore.getState().toasts).toHaveLength(2)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['Uno', 'Dos'])
  })

  it('dismiss() removes only the toast with the matching id', () => {
    const { show, dismiss } = useToastStore.getState()
    const id1 = show({ variant: 'success', message: 'Uno' })
    const id2 = show({ variant: 'success', message: 'Dos' })

    dismiss(id1)

    const remaining = useToastStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(id2)
  })

  it('dismiss() with an unknown id is a no-op', () => {
    useToastStore.getState().show({ variant: 'success', message: 'Uno' })

    useToastStore.getState().dismiss('no-existe')

    expect(useToastStore.getState().toasts).toHaveLength(1)
  })
})
