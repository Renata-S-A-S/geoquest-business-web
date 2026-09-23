import { z } from 'zod'

/**
 * `AuthTokens` — issue #20. NO es una propuesta a diferencia de la mayoría
 * de los schemas de este repo (`business.ts`, `place.ts`, ...): es la forma
 * ya confirmada contra el backend real de Identity, porque `BusinessStaff`
 * comparte el mismo `Identity` que `Explorer` con un claim de rol distinto
 * (contratos-portal-b2b.md §4.1) — misma forma exacta que geoquest-web
 * confirmó en su propio `shared/schemas/auth.ts` contra ese backend, mismo
 * criterio que ya usa `problem-details.ts` acá.
 *
 * `POST /auth/login` queda fuera de alcance de #20 (lo consume #28) pero
 * devuelve la misma forma — una sesión iniciada por login o refrescada por
 * `/auth/refresh` son indistinguibles del lado del frontend.
 */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAtUtc: z.string().datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAtUtc: z.string().datetime(),
})
export type AuthTokens = z.infer<typeof authTokensSchema>

/**
 * Input del formulario de login — issue #28. Las credenciales en sí son de
 * Identity (ver JSDoc de `authTokensSchema` arriba, contratos-portal-b2b.md
 * §4.1): este schema NO valida la contraseña contra ninguna regla propia,
 * solo exige contenido no vacío — quien decide si el par es correcto es el
 * backend (o el mock de `POST /auth/login`, ver handlers.ts).
 */
export const loginInputSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginInputSchema>
