import axios from 'axios'
import type { TFunction } from 'i18next'
import { problemDetailsSchema } from '@/shared/schemas/problem-details'
import { redemptionErrorKey } from '@/shared/schemas/business-redemption'

/**
 * Traduce el error de un canje a copia para el mostrador.
 *
 * ⚠️ **No usa `getProblemDetailsMessage` a propósito, y no es un olvido.** Ese
 * helper resuelve `detail ?? title ?? fallback`, o sea que el `detail` del
 * backend le gana siempre a la copia del portal. Y el backend ignora
 * `Accept-Language` (BL-006): su `detail` viene en un solo idioma y redactado
 * para un desarrollador («The UserReward has already been redeemed»), no para
 * alguien atendiendo una fila.
 *
 * Acá el `title` es lo único que se lee, porque es un código estable, y la
 * copia sale del namespace `redemptions`. Un `title` desconocido cae al
 * mensaje genérico en vez de mostrar el texto del backend: preferimos decir
 * poco y en el idioma correcto antes que mucho en el equivocado.
 *
 * La única excepción es **429**: lookup y escaneo comparten un balde de 30
 * requests/minuto por staff (design D8), y su cuerpo NO es confiable — puede
 * ser un `ProblemDetails` genérico de título «Too Many Requests» en vez de un
 * código propio del dominio. Por eso se detecta por status HTTP, antes de
 * mirar el `title`, y no se agrega a `REDEMPTION_ERROR_KEYS`.
 */
export function redemptionErrorMessage(error: unknown, t: TFunction<'redemptions'>): string {
  if (!axios.isAxiosError(error)) return t('errors.generic')

  if (error.response?.status === 429) return t('errors.rateLimited')

  const parsed = problemDetailsSchema.safeParse(error.response?.data)
  if (!parsed.success) return t('errors.generic')

  const key = redemptionErrorKey(parsed.data.title)
  return key === null ? t('errors.generic') : t(`errors.${key}`)
}
