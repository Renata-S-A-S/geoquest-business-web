import { setupServer } from 'msw/node'

/**
 * Shared MSW node server para la suite de Vitest. Cada archivo de test
 * agrega sus propios handlers con `server.use(...)`; arranca con lista
 * vacía para que un test no filtre rutas mockeadas a otro. Los handlers
 * reales del portal (derivados del ERD) llegan en WU5.
 */
export const server = setupServer()
