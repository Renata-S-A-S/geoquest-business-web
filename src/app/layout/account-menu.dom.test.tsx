import { fireEvent, render, screen } from '@testing-library/react'
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
})
