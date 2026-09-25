import axios from 'axios'
import i18next from 'i18next'
import { installSessionInterceptors } from '@/shared/lib/session-interceptor'
import { API_BASE_URL } from '@/shared/lib/env'
import { useToastStore } from '@/shared/stores/toast-store'

/**
 * Cliente Axios único. Bearer token + reintento-tras-401 vienen de
 * `session-interceptor.ts`, contra el `SessionPort` activo (hoy: mock —
 * ver session-port.instance.ts). Cuando `VITE_USE_MOCKS=true`, las
 * respuestas las sirve MSW (ver WU5); `apiClient` no sabe ni le importa.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

/**
 * `onSessionExpired` vive ACÁ y no en `session-interceptor.ts` (spec
 * "session-expiry", #1547, decisión de diseño #1549: "keeps the interceptor
 * testable") — importa `i18next` "pelado" (no `shared/lib/i18n.ts`, que
 * llama `.init()`) porque `main.tsx` ya inicializó el singleton antes de
 * que este interceptor pueda dispararse; volver a importar el wrapper acá
 * inicializaría i18next dos veces en los tests (mismo motivo D-C que ya
 * documenta `test/i18n.ts`).
 */
installSessionInterceptors(apiClient, undefined, {
  onSessionExpired: () => {
    useToastStore.getState().show({ variant: 'info', message: i18next.t('auth:session.expired') })
  },
})
