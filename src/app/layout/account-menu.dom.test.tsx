import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './account-menu'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { useThemeStore } from '@/shared/stores/theme-store'
import { queryClient } from '@/shared/lib/query-client'
import type { AuthTokens } from '@/shared/schemas/auth'

const tokens: AuthTokens = {
  accessToken: 'access-1',
  accessTokenExpiresAtUtc: '2026-09-02T00:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de cuenta' }))
}

function openConfirmation() {
  openMenu()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
}

beforeEach(() => {
  queryClient.clear()
  useBusinessSessionStore.getState().login(tokens)
  queryClient.setQueryData(['probe'], 1)
})

describe('AccountMenu', () => {
  it('opens the menu on trigger click, exposing "Cerrar sesión"', () => {
    render(<AccountMenu />)

    openMenu()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('Escape closes the menu without signing out', () => {
    render(<AccountMenu />)
    openMenu()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(true)
  })

  it('closes the menu before opening the confirmation — never nested', () => {
    render(<AccountMenu />)
    openMenu()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(screen.getByText('¿Cerrar sesión?')).toBeInTheDocument()
  })

  it('confirming signs out before clearing the cache, and clears both', () => {
    render(<AccountMenu />)
    openConfirmation()

    const logoutSpy = vi.spyOn(useBusinessSessionStore.getState(), 'logout')
    const clearSpy = vi.spyOn(queryClient, 'clear')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(logoutSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(logoutSpy.mock.invocationCallOrder[0]).toBeLessThan(clearSpy.mock.invocationCallOrder[0])
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(false)
    expect(queryClient.getQueryData(['probe'])).toBeUndefined()
  })

  it('cancelling the confirmation leaves the session intact', () => {
    render(<AccountMenu />)
    openConfirmation()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(true)
    expect(queryClient.getQueryData(['probe'])).toBe(1)
  })

  it('issues no network request during sign-out', () => {
    // MSW está configurado con onUnhandledRequest: 'error' (setup-dom.ts) —
    // cualquier request perdida hace fallar este test automáticamente, así
    // que llegar al final sin lanzar ya prueba que no hubo llamada de red.
    render(<AccountMenu />)
    openConfirmation()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(false)
  })

  it('renders the theme group above the sign-out button, separated by a divider', () => {
    render(<AccountMenu />)
    openMenu()

    const dialog = screen.getByRole('dialog')
    const group = within(dialog).getByRole('group', { name: 'Tema' })
    const signOutButton = within(dialog).getByRole('button', { name: 'Cerrar sesión' })

    // DOCUMENT_POSITION_FOLLOWING: `signOutButton` aparece después de `group`
    // en el documento — prueba el orden visual exigido por la decisión de
    // diseño D-2 (grupo de tema arriba, separador, luego cerrar sesión).
    expect(
      group.compareDocumentPosition(signOutButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('initial focus on open lands on a safe control, never the destructive sign-out button', () => {
    render(<AccountMenu />)
    openMenu()

    // `Modal` enfoca el primer elemento enfocable al abrir (modal.tsx). Ese
    // elemento es el botón de cerrar (la "X" del header), que SIEMPRE
    // precede a `children` en el DOM sin importar qué contenga — por lo
    // tanto ya era seguro antes de esta restructuración. Lo que sí cambia
    // acá es el orden DE TAB inmediatamente después (siguiente prueba): sin
    // este reordenamiento, el próximo Tab caía directo en "Cerrar sesión".
    expect(document.activeElement).toHaveAccessibleName('Cerrar')
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Cerrar sesión' }))
  })

  it('places a theme option, not the destructive sign-out button, as the next Tab stop after the dismiss control', () => {
    render(<AccountMenu />)
    openMenu()

    // El orden de tabulación sigue el orden del DOM (ningún `tabIndex`
    // explícito está en juego acá). Verifica la ganancia real de D-2: el
    // segundo `Tab` desde que se abre el menú aterriza en una opción de
    // tema, no en la acción destructiva.
    const dialog = screen.getByRole('dialog')
    const focusableNames = within(dialog)
      .getAllByRole('button')
      .map((el) => el.getAttribute('aria-label') ?? el.textContent)

    expect(focusableNames).toEqual(['Cerrar', 'Claro', 'Oscuro', 'Sistema', 'Cerrar sesión'])
  })

  it('selecting a theme keeps the menu open and does not sign out', () => {
    render(<AccountMenu />)
    openMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(true)
    expect(useThemeStore.getState().mode).toBe('dark')
  })
})
