import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import i18next from '@/test/i18n'
import { server } from '@/test/msw-server'
import { useSessionStore } from '@/shared/stores/session-store'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  cleanup()
  server.resetHandlers()
  useSessionStore.getState().signOut()
  // El reset de arriba NO alcanza: el puerto activo es `realSessionPort`,
  // respaldado por `useBusinessSessionStore` (no por el store mock), y ese
  // store está `persist`ido a `localStorage` (#20). Sin este reset, la
  // sesión que abre un test sobrevive al siguiente y produce falsos
  // positivos — un test podría pasar solo porque el anterior dejó una
  // sesión abierta. Detectado en #28 y en #70 de forma independiente.
  useBusinessSessionStore.getState().logout()
  window.localStorage.clear()
  await i18next.changeLanguage('es')
})
afterAll(() => server.close())
