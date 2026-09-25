import { SEED_BUSINESS_SCENARIOS, type MyBusinessScenario } from '@/shared/mocks/seed'

/**
 * Parsea `?mockBusiness=` (real-backend-readiness PR6a, design "Mock status
 * demo") de un query string crudo (`location.search`). Función PURA a
 * propósito — separada de `shared/mocks/browser.ts` para poder testearla
 * sin `window`/`location` ni arrancar `setupWorker`. Devuelve `undefined`
 * cuando el parámetro falta o no coincide con ningún escenario conocido, en
 * vez de lanzar: un valor inválido en la URL de una demo pública no debe
 * romper el arranque de la app, solo dejar el negocio sembrado por defecto
 * (`Active`, ver `db.ts:seedDb`).
 */
export function resolveMockBusinessScenario(search: string): MyBusinessScenario | undefined {
  const value = new URLSearchParams(search).get('mockBusiness')
  if (value === null) return undefined

  return value in SEED_BUSINESS_SCENARIOS ? (value as MyBusinessScenario) : undefined
}
