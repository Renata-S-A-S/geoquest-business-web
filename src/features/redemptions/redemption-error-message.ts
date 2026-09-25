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
 * Tampoco se discrimina por status HTTP: `QrExpired` y `InvalidQrToken`
 * comparten el 400 y significan cosas distintas para el staff, así que el
 * status no alcanza para elegir el mensaje.
 */
export function redemptionErrorMessage(error: unknown, t: TFunction<'redemptions'>): string {
  if (!axios.isAxiosError(error)) return t('errors.generic')

  const parsed = problemDetailsSchema.safeParse(error.response?.data)
  if (!parsed.success) return t('errors.generic')

  const key = redemptionErrorKey(parsed.data.title)
  return key === null ? t('errors.generic') : t(`errors.${key}`)
}
