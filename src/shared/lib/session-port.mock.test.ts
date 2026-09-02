import { beforeEach, describe, expect, it } from 'vitest'
import { mockSessionPort } from './session-port.mock'
import { useSessionStore } from '@/shared/stores/session-store'

/**
 * `session-port.mock.ts` dejó de ser la implementación activa desde #20
 * (ver `session-port.instance.ts`), pero el issue pide conservarlo intacto
 * para tests/storybook — este archivo prueba que sigue funcionando de
 * forma standalone, sin depender de que algo más lo ejercite indirecto.
 */
describe('mockSessionPort', () => {
  beforeEach(() => {
    useSessionStore.getState().signOut()
  })

  it('getAccessToken()/isAuthenticated() reflejan el store del mock', () => {
    expect(mockSessionPort.getAccessToken()).toBeNull()
    expect(mockSessionPort.isAuthenticated()).toBe(false)

    useSessionStore.getState().signIn('mock-token')

    expect(mockSessionPort.getAccessToken()).toBe('mock-token')
    expect(mockSessionPort.isAuthenticated()).toBe(true)
  })

  it('refresh() devuelve el token actual si hay sesión activa', async () => {
    useSessionStore.getState().signIn('mock-token')

    await expect(mockSessionPort.refresh()).resolves.toBe('mock-token')
  })

  it('refresh() rechaza si no hay sesión mock activa', async () => {
    await expect(mockSessionPort.refresh()).rejects.toThrow('no hay sesión mock activa')
  })

  it('signOut() limpia el store del mock', () => {
    useSessionStore.getState().signIn('mock-token')

    mockSessionPort.signOut()

    expect(mockSessionPort.isAuthenticated()).toBe(false)
    expect(mockSessionPort.getAccessToken()).toBeNull()
  })

  it('subscribe() se suscribe al store del mock y el unsubscribe funciona', () => {
    let calls = 0
    const unsubscribe = mockSessionPort.subscribe(() => {
      calls += 1
    })

    useSessionStore.getState().signIn('mock-token')
    expect(calls).toBeGreaterThan(0)

    const callsAfterFirstChange = calls
    unsubscribe()
    useSessionStore.getState().signOut()
    expect(calls).toBe(callsAfterFirstChange)
  })
})
