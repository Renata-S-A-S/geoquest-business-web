import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './account-menu'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { queryClient } from '@/shared/lib/query-client'
import type { AuthTokens } from '@/shared/schemas/auth'

const tokens: AuthTokens = {
  accessToken: 'access-1',
  accessTokenExpiresAtUtc: '2026-09-02T00:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
}

/**
 * `AccountMenu` renderiza un `<Link to="/configuracion">` desde #72 PR6 —
 * necesita un router en el árbol o React Router lanza. Mismo criterio que
 * `business-profile-page.dom.test.tsx`/`business-profile-view.dom.test.tsx`
 * (#72 PR5): un `MemoryRouter` sin rutas declaradas alcanza porque acá
 * nunca se navega de verdad, solo se verifica el `href` renderizado.
 */
function renderAccountMenu() {
  return render(<AccountMenu />, { wrapper: MemoryRouter })
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
    renderAccountMenu()

    openMenu()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('opens the menu exposing a link to /configuracion (#72 D5)', () => {
    renderAccountMenu()

    openMenu()

    expect(screen.getByRole('link', { name: 'Configuración' })).toHaveAttribute(
      'href',
      '/configuracion'
    )
  })

  it('closes the menu when the "Configuración" link is clicked', () => {
    renderAccountMenu()
    openMenu()

    fireEvent.click(screen.getByRole('link', { name: 'Configuración' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape closes the menu without signing out', () => {
    renderAccountMenu()
    openMenu()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(true)
  })

  it('closes the menu before opening the confirmation — never nested', () => {
    renderAccountMenu()
    openMenu()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(screen.getByText('¿Cerrar sesión?')).toBeInTheDocument()
  })

  it('confirming signs out before clearing the cache, and clears both', () => {
    renderAccountMenu()
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
    renderAccountMenu()
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
    renderAccountMenu()
    openConfirmation()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(useBusinessSessionStore.getState().isAuthenticated).toBe(false)
  })

  it('renders the "Configuración" link above the sign-out button, separated by a divider (#72 PR6)', () => {
    // Reemplaza la aserción sobre el grupo "Tema", que dejó de existir en
    // este menú cuando `ThemeSwitcher` se mudó a `/configuracion` (#72
    // PR6, decisión D5) — el link a `/configuracion` ocupa ahora ese lugar
    // y protege el mismo orden.
    renderAccountMenu()
    openMenu()

    const dialog = screen.getByRole('dialog')
    const link = within(dialog).getByRole('link', { name: 'Configuración' })
    const signOutButton = within(dialog).getByRole('button', { name: 'Cerrar sesión' })

    // DOCUMENT_POSITION_FOLLOWING: `signOutButton` aparece después de `link`
    // en el documento.
    expect(
      link.compareDocumentPosition(signOutButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('initial focus on open lands on a safe control, never the destructive sign-out button', () => {
    renderAccountMenu()
    openMenu()

    // `Modal` enfoca el primer elemento enfocable al abrir (modal.tsx). Ese
    // elemento es el botón de cerrar (la "X" del header), que SIEMPRE
    // precede a `children` en el DOM sin importar qué contenga — esto es
    // así independientemente del contenido del menú, no una consecuencia
    // del orden que se eligió acá (afirmación corregida en #72 PR6: un
    // diseño anterior decía que el orden interno era la causa, y se
    // verificó falso — ver Engram #1393).
    expect(document.activeElement).toHaveAccessibleName('Cerrar')
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Cerrar sesión' }))
  })

  it('places the settings link, not the destructive sign-out button, as the next Tab stop after the dismiss control', () => {
    renderAccountMenu()
    openMenu()

    // El orden de tabulación sigue el orden del DOM (ningún `tabIndex`
    // explícito está en juego acá). Esto es lo que el reordenamiento SÍ
    // protege (a diferencia del foco inicial, ver test anterior): el
    // segundo `Tab` desde que se abre el menú aterriza en una navegación
    // reversible, no en la acción destructiva.
    const dialog = screen.getByRole('dialog')
    // `querySelectorAll` respeta el orden real del DOM (a diferencia de
    // concatenar `getAllByRole('button')` + `getAllByRole('link')`, que
    // agruparía por rol en vez de por posición).
    const focusableNames = Array.from(dialog.querySelectorAll('button, a[href]')).map(
      (el) => el.getAttribute('aria-label') ?? el.textContent
    )

    expect(focusableNames).toEqual(['Cerrar', 'Configuración', 'Cerrar sesión'])
  })
})
