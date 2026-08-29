import axios from 'axios'
import { installSessionInterceptors } from '@/shared/lib/session-interceptor'

/**
 * Cliente Axios único. Bearer token + reintento-tras-401 vienen de
 * `session-interceptor.ts`, contra el `SessionPort` activo (hoy: mock —
 * ver session-port.instance.ts). Cuando `VITE_USE_MOCKS=true`, las
 * respuestas las sirve MSW (ver WU5); `apiClient` no sabe ni le importa.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5219',
})

installSessionInterceptors(apiClient)
