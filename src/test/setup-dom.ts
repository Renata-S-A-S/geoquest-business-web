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
  // `useBusinessSessionStore` está `persist`ido a `localStorage` (#20) — sin
  // este reset, la sesión de un test de login (#28) sobrevive al siguiente
  // test y produce falsos positivos (un test podría pasar solo porque un
  // test anterior dejó una sesión abierta).
  useBusinessSessionStore.getState().logout()
  window.localStorage.clear()
  await i18next.changeLanguage('es')
})
afterAll(() => server.close())
