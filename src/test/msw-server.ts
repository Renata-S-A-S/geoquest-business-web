import { setupServer } from 'msw/node'
import { handlers } from '@/shared/mocks/handlers'

/**
 * Servidor MSW compartido para la suite de Vitest — arranca con los MISMOS
 * handlers que el navegador (`shared/mocks/browser.ts`), no una lista
 * vacía: son las rutas reales del portal, y probar contra ellas es lo que
 * `handlers.test.ts` (WU5) verifica. Un test que necesite un caso distinto
 * lo agrega con `server.use(...)` — que tiene prioridad sobre estos.
 */
export const server = setupServer(...handlers)
