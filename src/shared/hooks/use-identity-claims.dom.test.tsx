import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useIdentityClaims } from './use-identity-claims'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { createMockJwt } from '@/shared/mocks/mock-jwt'

/**
 * `.dom.test.tsx` y no `.test.ts` a propósito: el hook usa
 * `useSyncExternalStore`/`useMemo` de React y necesita un renderer
 * (`renderHook`), que requiere el entorno jsdom de este proyecto — el
 * archivo `session-port.real.test.ts` (env `node`) no puede montar hooks.
 */
describe('useIdentityClaims', () => {
  it('devuelve null si no hay sesión activa', () => {
    const { result } = renderHook(() => useIdentityClaims())

    expect(result.current).toBeNull()
  })

  it('devuelve username/email decodificados del access token cuando hay sesión', () => {
    const token = createMockJwt({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'maria@cafe70.co',
      username: 'maria_cafe70',
    })

    act(() => {
      useBusinessSessionStore.setState({
        isAuthenticated: true,
        accessToken: token,
        accessTokenExpiresAtUtc: null,
        refreshToken: 'a-refresh',
        refreshTokenExpiresAtUtc: null,
      })
    })

    const { result } = renderHook(() => useIdentityClaims())

    expect(result.current).toEqual({ username: 'maria_cafe70', email: 'maria@cafe70.co' })
  })

  /**
   * Triangulación: el hook debe reaccionar a un cambio de sesión posterior
   * al montaje (`useSyncExternalStore`), no solo leer el valor inicial.
   */
  it('se actualiza cuando el access token cambia después del montaje', () => {
    const { result } = renderHook(() => useIdentityClaims())
    expect(result.current).toBeNull()

    const token = createMockJwt({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'owner@otronegocio.com',
      username: 'owner_otro',
    })

    act(() => {
      useBusinessSessionStore.setState({
        isAuthenticated: true,
        accessToken: token,
        accessTokenExpiresAtUtc: null,
        refreshToken: 'a-refresh',
        refreshTokenExpiresAtUtc: null,
      })
    })

    expect(result.current).toEqual({ username: 'owner_otro', email: 'owner@otronegocio.com' })
  })

  it('vuelve a null si la sesión se cierra', () => {
    act(() => {
      useBusinessSessionStore.setState({
        isAuthenticated: true,
        accessToken: createMockJwt({
          sub: '00000000-0000-0000-0000-000000000002',
          email: 'maria@cafe70.co',
          username: 'maria_cafe70',
        }),
        accessTokenExpiresAtUtc: null,
        refreshToken: 'a-refresh',
        refreshTokenExpiresAtUtc: null,
      })
    })

    const { result } = renderHook(() => useIdentityClaims())
    expect(result.current).not.toBeNull()

    act(() => {
      useBusinessSessionStore.getState().logout()
    })

    expect(result.current).toBeNull()
  })
})
