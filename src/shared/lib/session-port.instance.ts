import type { SessionPort } from '@/shared/lib/session-port'
import { mockSessionPort } from '@/shared/lib/session-port.mock'

/**
 * Implementación activa. HOY es el mock — cambia esta línea (y solo esta
 * línea) cuando exista el mecanismo real de auth de BusinessStaff. Ni
 * `session-interceptor.ts` ni `protected-route.tsx` conocen la diferencia.
 */
export const sessionPort: SessionPort = mockSessionPort
