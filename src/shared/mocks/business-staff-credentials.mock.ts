import { SEED_BUSINESS_STAFF } from '@/shared/mocks/seed'

/**
 * ⚠️ SOLO MOCK — CÓDIGO DESECHABLE. Borrar cuando exista el backend real.
 *
 * La autenticación real es server-side contra Identity: `BusinessStaff`
 * comparte el mismo `Identity` que `Explorer` con un claim de rol distinto
 * (contratos-portal-b2b.md §4.1). El frontend NUNCA valida una contraseña —
 * `businessStaffSchema` no tiene campo de contraseña, y no debe tenerlo: las
 * credenciales viven en ASP.NET Identity, no en este repo.
 *
 * Esta comprobación existe por una sola razón: que el portal pueda demostrar
 * las dos ramas del login (éxito e inválido, #28) sin backend y sin una
 * palanca oculta de QA. La contraseña está en claro acá y en el README a
 * propósito — no es un secreto, es un dato de demo.
 *
 * Es determinista a propósito (sin `Math.random`): los tests dependen de que
 * el mismo par dé siempre el mismo resultado.
 *
 * Vida útil de los tokens y política de contraseña son preguntas sin regla
 * documentada todavía — no se cita ninguna RN o ADR para ellas porque no
 * existe: son decisiones que le corresponden al backend real de Identity.
 */
export const MOCK_BUSINESS_STAFF_PASSWORD = 'geoquest-demo'

export function isValidMockCredential(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === SEED_BUSINESS_STAFF.email.toLowerCase() &&
    password === MOCK_BUSINESS_STAFF_PASSWORD
  )
}
