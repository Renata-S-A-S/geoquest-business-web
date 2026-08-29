import { z } from 'zod'

/**
 * Forma problem+json (RFC7807) que devuelve ASP.NET `Results.Problem` —
 * misma forma exacta que geoquest-web confirmó contra el backend real
 * (`shared/schemas/auth.ts` de ese repo). El backend de Business todavía no
 * existe, pero el formato de error es transversal a toda la API — no algo
 * específico de un módulo.
 */
export const problemDetailsSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
})
export type ProblemDetails = z.infer<typeof problemDetailsSchema>
