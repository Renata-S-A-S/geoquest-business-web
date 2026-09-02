import axios from 'axios'
import { problemDetailsSchema } from '@/shared/schemas/problem-details'

/**
 * Convierte el error de un `apiClient` fallido en un mensaje listo para
 * mostrar en un toast (#16) — issue #21 es el primer consumidor real, pero
 * cualquier mutación futura (B-02/B-03/B-04) puede reusarlo igual.
 *
 * Prioriza `detail` sobre `title` porque `detail` es el mensaje pensado para
 * un humano (ver `problem-details.ts`); `title` es más una categoría de
 * error. Si el body no es un problem+json parseable (error de red, cuerpo
 * vacío, forma inesperada) o el error ni siquiera vino de axios, devuelve
 * `fallback` en vez de propagar o mostrar algo críptico.
 */
export function getProblemDetailsMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback

  const parsed = problemDetailsSchema.safeParse(error.response?.data)
  if (!parsed.success) return fallback

  return parsed.data.detail ?? parsed.data.title ?? fallback
}
