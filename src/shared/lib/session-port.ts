/**
 * Puerto de sesión — la pieza que reemplaza copiar el interceptor de
 * `geoquest-web` tal cual. Ese interceptor asume `/auth/refresh` de
 * `Explorer`; la autenticación de `BusinessStaff` es justamente la decisión
 * abierta (ver contratos-portal-b2b.md). El resto de la app (interceptor de
 * Axios, ProtectedRoute) programa CONTRA ESTA INTERFAZ, nunca contra un
 * mecanismo concreto — cuando Derek cierre el mecanismo real, cambia una
 * sola línea (`sessionPort` más abajo) y nada más se entera.
 */
import type { IdentityClaims } from '@/shared/lib/jwt-claims'

export interface SessionPort {
  getAccessToken(): string | null
  isAuthenticated(): boolean
  /**
   * Claims de identidad para MOSTRAR (username/email), nunca para
   * autorizar — spec "session-identity" (#1547). `null` si no hay sesión o
   * si el token no trae las claims esperadas; nunca lanza.
   */
  getIdentityClaims(): IdentityClaims | null
  /** Refresca el access token. Rechaza si no se puede — la llamada NO tiene que ser HTTP (el mock no lo es). */
  refresh(): Promise<string>
  signOut(): void
  /**
   * Se suscribe a cambios de sesión (login/logout/refresh) y devuelve el
   * unsubscribe. Existe para que componentes de React puedan reaccionar sin
   * conocer qué hay detrás del puerto (useSyncExternalStore en
   * shared/hooks/use-session.ts) — no asume Zustand ni ningún mecanismo
   * concreto de la implementación real futura.
   */
  subscribe(listener: () => void): () => void
}
