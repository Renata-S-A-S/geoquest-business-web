import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { sessionPort as defaultSessionPort } from '@/shared/lib/session-port.instance'
import type { SessionPort } from '@/shared/lib/session-port'
import { queryClient } from '@/shared/lib/query-client'

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
  /**
   * Opt-out explícito por request, en vez de una lista de paths hardcodeada
   * (como `/auth/login` en geoquest-web) — todavía no sabemos el path real
   * de login de BusinessStaff (pregunta abierta, ver contratos-portal-b2b.md).
   * El futuro endpoint de login lo marca cuando exista.
   */
  skipSessionAuth?: boolean
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
  port: SessionPort = defaultSessionPort
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
        // Orden: signOut primero, clear después — mismo criterio que
        // geoquest-web (evita que un observer todavía "autenticado" repueble
        // la cache antes de que el estado desautenticado surta efecto).
        port.signOut()
        queryClient.clear()
        throw error
      }

      config.headers.set('Authorization', `Bearer ${token}`)
      return client.request(config)
    }
  )
}
