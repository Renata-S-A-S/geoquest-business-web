import type { SessionPort } from '@/shared/lib/session-port'
import { realSessionPort } from '@/shared/lib/session-port.real'

/**
 * Implementación activa. Real desde #20 — antes era el mock
 * (`session-port.mock.ts`, conservado sin cambios para tests/storybook).
 * Cambia esta línea (y solo esta línea) si hiciera falta volver al mock. Ni
 * `session-interceptor.ts` ni `protected-route.tsx` conocen la diferencia.
 */
export const sessionPort: SessionPort = realSessionPort
