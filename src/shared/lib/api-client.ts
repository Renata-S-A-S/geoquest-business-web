import axios from 'axios'
import { installSessionInterceptors } from '@/shared/lib/session-interceptor'
import { API_BASE_URL } from '@/shared/lib/env'

/**
 * Cliente Axios único. Bearer token + reintento-tras-401 vienen de
 * `session-interceptor.ts`, contra el `SessionPort` activo (hoy: mock —
 * ver session-port.instance.ts). Cuando `VITE_USE_MOCKS=true`, las
 * respuestas las sirve MSW (ver WU5); `apiClient` no sabe ni le importa.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

installSessionInterceptors(apiClient)
