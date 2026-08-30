import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/msw-server'
import { useSessionStore } from '@/shared/stores/session-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Resetea el estado EN MEMORIA del store — limpiar localStorage (abajo)
  // no alcanza, Zustand no relee su storage entre tests del mismo archivo.
  useSessionStore.getState().signOut()
  window.localStorage.clear()
})
afterAll(() => server.close())
