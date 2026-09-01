import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterSW } from 'virtual:pwa-register/react'
import i18next from '@/test/i18n'
import { PwaUpdatePrompt, UpdatePromptBanner } from './pwa-update-prompt'

/**
 * `virtual:pwa-register/react` no tiene resolver real bajo Vitest (VitePWA
 * no corre en `vitest.config.ts`); el alias ahí lo apunta a
 * `src/test/pwa-register-stub.ts` para que este mock tenga un módulo
 * resoluble sobre el cual overridear.
 */
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }))

const mockedUseRegisterSW = vi.mocked(useRegisterSW)

function mockRegisterSW(needRefresh: boolean) {
  const setNeedRefresh = vi.fn()
  const updateServiceWorker = vi.fn().mockResolvedValue(undefined)
  mockedUseRegisterSW.mockReturnValue({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  })
  return { setNeedRefresh, updateServiceWorker }
}

describe('UpdatePromptBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza la copia en español y dispara onUpdate/onDismiss al hacer click', () => {
    const onUpdate = vi.fn()
    const onDismiss = vi.fn()
    render(<UpdatePromptBanner onUpdate={onUpdate} onDismiss={onDismiss} />)

    expect(screen.getByText('Hay una versión nueva disponible')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('PwaUpdatePrompt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no renderiza nada sin un service worker esperando', () => {
    mockRegisterSW(false)

    const { container } = render(<PwaUpdatePrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza el banner cuando hay una versión nueva esperando', () => {
    mockRegisterSW(true)

    render(<PwaUpdatePrompt />)

    expect(screen.getByText('Hay una versión nueva disponible')).toBeInTheDocument()
  })

  it('click en "Actualizar" activa y recarga a la versión nueva', () => {
    const { updateServiceWorker } = mockRegisterSW(true)
    render(<PwaUpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('click en "Cerrar" pone needRefresh en false sin recargar', () => {
    const { setNeedRefresh, updateServiceWorker } = mockRegisterSW(true)
    render(<PwaUpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })

  it('renderiza la copia en inglés tras cambiar de idioma', async () => {
    mockRegisterSW(true)

    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(<PwaUpdatePrompt />)

    expect(screen.getByText('A new version is available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('es')
    })
  })

  it('se desmonta una vez que el hook refleja needRefresh=false tras descartar', () => {
    const { setNeedRefresh } = mockRegisterSW(true)
    const { rerender, container } = render(<PwaUpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(setNeedRefresh).toHaveBeenCalledWith(false)

    mockRegisterSW(false)
    rerender(<PwaUpdatePrompt />)

    expect(container).toBeEmptyDOMElement()
  })
})
