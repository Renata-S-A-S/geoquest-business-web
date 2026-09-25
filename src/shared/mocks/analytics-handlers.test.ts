import { beforeEach, describe, expect, it } from 'vitest'
import { apiClient } from '@/shared/lib/api-client'
import { resetDb } from '@/shared/mocks/db'
import { SEED_BUSINESS } from '@/shared/mocks/seed'
import { analyticsCheckInSeriesSchema, analyticsSummarySchema } from '@/shared/schemas/analytics'

/**
 * Handlers de los endpoints PROPUESTOS de analytics (`Renata-S-A-S/geoquest#205`).
 *
 * Va en su propio archivo y no dentro de `handlers.test.ts` porque ese test
 * documenta el round-trip de persistencia del mock (lee, escribe, vuelve a
 * leer) y analytics no escribe nada: es solo lectura agregada. Mezclarlos
 * confundiría dos contratos distintos en una misma suite.
 */
const ANALYTICS_BASE = `/portal/businesses/${SEED_BUSINESS.id}/analytics`
const RANGE = { from: '2026-08-26', to: '2026-09-24' }

describe('handlers propuestos de analytics', () => {
  beforeEach(() => resetDb())

  it('GET summary devuelve un resumen que cumple el contrato propuesto', async () => {
    const { data, status } = await apiClient.get(`${ANALYTICS_BASE}/summary`, { params: RANGE })

    expect(status).toBe(200)
    expect(() => analyticsSummarySchema.parse(data)).not.toThrow()
  })

  it('GET check-ins devuelve una serie diaria con un punto por día del rango', async () => {
    const { data } = await apiClient.get(`${ANALYTICS_BASE}/check-ins`, {
      params: { ...RANGE, granularity: 'day' },
    })

    const series = analyticsCheckInSeriesSchema.parse(data)
    expect(series.points).toHaveLength(30)
  })

  it('el desglose por lugar del resumen cubre los lugares que devuelve GET /business/places', async () => {
    const { data: places } = await apiClient.get('/business/places')
    const { data: summary } = await apiClient.get(`${ANALYTICS_BASE}/summary`, { params: RANGE })

    // Consistencia entre handlers: analytics agrega sobre el MISMO `MockDb` que
    // sirve el listado, así que los ids tienen que coincidir. Números sueltos
    // que no cuadran con `/business/places` es justo lo que este mock evita.
    expect(analyticsSummarySchema.parse(summary).places.map((place) => place.placeId)).toEqual(
      (places as { placeId: string }[]).map((place) => place.placeId)
    )
  })

  it('responde 404 para el businessId de otro negocio', async () => {
    await expect(
      apiClient.get('/portal/businesses/00000000-0000-0000-0000-0000000000ff/analytics/summary', {
        params: RANGE,
      })
    ).rejects.toMatchObject({
      response: { status: 404, data: { title: 'Analytics.BusinessNotFound' } },
    })
  })

  it('responde 400 cuando falta el rango', async () => {
    await expect(apiClient.get(`${ANALYTICS_BASE}/summary`)).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Analytics.InvalidRange' } },
    })
  })

  it('responde 400 cuando la fecha no es YYYY-MM-DD', async () => {
    await expect(
      apiClient.get(`${ANALYTICS_BASE}/summary`, {
        params: { from: '2026-08-26T00:00:00Z', to: RANGE.to },
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  /**
   * Un rango invertido produciría una serie vacía y el negocio la leería como
   * «no hubo visitas». Rechazarlo es la única respuesta honesta.
   */
  it('responde 400 cuando `to` es anterior a `from`', async () => {
    await expect(
      apiClient.get(`${ANALYTICS_BASE}/summary`, {
        params: { from: RANGE.to, to: RANGE.from },
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('rechaza una granularidad que no sirve en vez de degradar al día en silencio', async () => {
    await expect(
      apiClient.get(`${ANALYTICS_BASE}/check-ins`, {
        params: { ...RANGE, granularity: 'week' },
      })
    ).rejects.toMatchObject({
      response: { status: 400, data: { title: 'Analytics.UnsupportedGranularity' } },
    })
  })

  it('sin `granularity` asume día: el parámetro es opcional para el servidor', async () => {
    const { data } = await apiClient.get(`${ANALYTICS_BASE}/check-ins`, { params: RANGE })

    expect(analyticsCheckInSeriesSchema.parse(data).granularity).toBe('day')
  })
})
