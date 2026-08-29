import { afterAll, afterEach, beforeAll } from 'vitest'
import i18next from '@/test/i18n'
import { server } from '@/test/msw-server'
import { __resetRefreshState } from '@/shared/lib/session-interceptor'
import { __resetMemoryStorage } from '@/shared/mocks/storage'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  server.resetHandlers()
  __resetRefreshState()
  __resetMemoryStorage()
  // OBLIGATORIO: el singleton de i18next filtra el idioma activo entre
  // tests del mismo archivo si no se resetea (mismo criterio D-C que
  // geoquest-web) — un test que cambie a 'en' envenenaría los siguientes.
  await i18next.changeLanguage('es')
})
afterAll(() => server.close())
