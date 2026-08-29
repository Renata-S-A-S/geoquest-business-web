import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import i18next from '@/test/i18n'
import { server } from '@/test/msw-server'
import { useSessionStore } from '@/shared/stores/session-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  cleanup()
  server.resetHandlers()
  useSessionStore.getState().signOut()
  window.localStorage.clear()
  await i18next.changeLanguage('es')
})
afterAll(() => server.close())
