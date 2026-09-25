import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { sessionPort as defaultSessionPort } from '@/shared/lib/session-port.instance'
import type { SessionPort } from '@/shared/lib/session-port'
import { queryClient } from '@/shared/lib/query-client'

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Opt-out explícito por request, en vez de una lista de paths hardcodeada
     * (como `/auth/login` en geoquest-web) — cada endpoint sin sesión lo
     * marca cuando existe. Primer uso real: `POST /business/register` (#21,
     * `register-business.ts`) — el futuro login de BusinessStaff (#28) lo
     * necesitará igual.
     */
    skipSessionAuth?: boolean
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export interface SessionInterceptorOptions {
  /**
   * Se dispara justo ANTES de `port.signOut()`, cuando el refresh tras un
   * 401 falla (spec "session-expiry", #1547) — el redirect a `/login` lo
   * hace `ProtectedRoute` reaccionando a `isAuthenticated`, no este módulo.
   * Callback inyectado (no un import directo del store de toasts acá) para
   * que este archivo siga probando el flujo completo con un `SessionPort`
   * falso en memoria, sin mockear el store (decisión de diseño #1549).
   */
  onSessionExpired?: () => void
}

let refreshPromise: Promise<string> | null = null

/** Seam de test: limpia el estado de refresh en vuelo entre casos. */
export function __resetRefreshState(): void {
  refreshPromise = null
}

function ensureRefresh(port: SessionPort): Promise<string> {
  refreshPromise ??= port.refresh().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/**
 * Adjunta bearer token + reintento-tras-401 a una instancia de Axios,
 * contra un `SessionPort` inyectable (default: la instancia activa real).
 * Recibir el puerto por parámetro — no importar el singleton dentro de la
 * lógica — es lo que permite testear el flujo completo con un puerto falso
 * en memoria, sin mockear HTTP para el refresh.
 */
export function installSessionInterceptors(
  client: AxiosInstance,
  port: SessionPort = defaultSessionPort,
  options: SessionInterceptorOptions = {}
): void {
  client.interceptors.request.use((config) => {
    if ((config as RetriableConfig).skipSessionAuth) return config

    const token = port.getAccessToken()
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!axios.isAxiosError(error)) throw error

      const config = error.config as RetriableConfig | undefined
      if (error.response?.status !== 401 || !config || config._retry || config.skipSessionAuth) {
        throw error
      }

      config._retry = true

      let token: string
      try {
        token = await ensureRefresh(port)
      } catch {
        // Orden: toast primero (avisa MIENTRAS la sesión todavía está viva),
        // signOut después, clear al final — mismo criterio que geoquest-web
        // para signOut/clear (evita que un observer todavía "autenticado"
        // repueble la cache antes de que el estado desautenticado surta
        // efecto), extendido para que el toast no compita con el re-render
        // del redirect que dispara `ProtectedRoute` al ver `signOut()`.
        options.onSessionExpired?.()
        port.signOut()
        queryClient.clear()
        throw error
      }

      config.headers.set('Authorization', `Bearer ${token}`)
      return client.request(config)
    }
  )
}
