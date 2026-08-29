/**
 * Único punto de lectura de variables de entorno Vite. Compartido entre
 * `api-client.ts` (baseURL real de Axios) y `shared/mocks/handlers.ts` (para
 * que los handlers de MSW respondan exactamente al mismo origen al que
 * apunta el cliente, sin depender del matching cross-origin de MSW).
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5219'
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
