import { setupWorker } from 'msw/browser'
import { handlers } from '@/shared/mocks/handlers'

/**
 * Worker de navegador — usado en `npm run dev` y en el deploy de Vercel
 * mientras `VITE_USE_MOCKS=true` (default). A diferencia de geoquest-web,
 * que solo usa MSW dentro de Vitest: acá el backend de Business no existe
 * todavía, así que el portal necesita poder demostrarse sin él, incluido
 * un preview público. Ver "Diferencias deliberadas" en el plan.
 */
export const worker = setupWorker(...handlers)
