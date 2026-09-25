import {
  eachAnalyticsDate,
  resolvePreviousRange,
  type AnalyticsRange,
} from '@/shared/lib/analytics-range'
import type {
  AnalyticsCheckInSeries,
  AnalyticsPlaceBreakdown,
  AnalyticsSummary,
  AnalyticsTotals,
} from '@/shared/schemas/analytics'
import type { BusinessPlaceDetail } from '@/shared/schemas/business-place'
import type { BusinessRewardSummary } from '@/shared/schemas/business-reward'

/**
 * Datos de analytics del mock — ⚠️ **FICCIÓN ETIQUETADA**, endpoints
 * propuestos en `Renata-S-A-S/geoquest#205`. No hay backend de analytics.
 *
 * Dos decisiones que hacen que esta ficción sea utilizable en vez de
 * decorativa:
 *
 * 1. **Se generan FILAS, no agregados.** El mock sintetiza `MockCheckIn` y
 *    `MockRedemption` con la forma de los campos reales y después agrega
 *    exactamente como lo haría el backend. Así `uniqueVisitors` es un conteo
 *    real de `explorerId` distintos y no un porcentaje inventado sobre
 *    `checkIns` — que es la clase de relación falsa que después nadie puede
 *    desmentir.
 * 2. **Se generan RELATIVAS al rango pedido**, no desde fechas fijas. Una
 *    semilla con fechas de calendario duras se vacía sola con el paso del
 *    tiempo: la demo mostraría ceros y los tests dependerían del día en que
 *    corren. La generación es determinista para un mismo rango.
 */

/**
 * Forma de `Geo.Domain.CheckIn` (campos verificados: `ExplorerId`, `PlaceId`,
 * `ValidationStatus`). `createdAt` es el campo temporal por el que el backend
 * filtraría el período.
 */
export interface MockCheckIn {
  explorerId: string
  placeId: string
  validationStatus: 'Valid' | 'Rejected'
  createdAt: string
}

/**
 * Canje ya confirmado. Los campos salen de `userRewardSchema`: un
 * `UserReward` en `Redeemed` tiene `redeemedAt` y `experienceRating`
 * (nullable, RN-REW-07). El valor entregado NO vive acá — se joinea contra
 * `Reward.estimatedValueCop`, igual que lo haría el backend.
 */
export interface MockRedemption {
  rewardId: string
  explorerId: string
  redeemedAt: string
  experienceRating: number | null
}

/**
 * Pool fijo de exploradores. Es lo que hace que «visitantes únicos» sea un
 * conteo genuino: con repetición real de `explorerId` entre días, únicos y
 * check-ins divergen solos.
 */
const MOCK_EXPLORER_IDS = [
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-0000000000a4',
  '00000000-0000-0000-0000-0000000000a5',
  '00000000-0000-0000-0000-0000000000a6',
] as const

/**
 * Hash determinista de string a entero en `[0, max]`. No pretende ser un buen
 * PRNG: solo tiene que ser estable entre corridas y no degenerar en un valor
 * constante. `Math.random()` acá haría que la misma consulta devolviera
 * números distintos y ningún test podría afirmar nada.
 */
function seededValue(seed: string, max: number): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % (max + 1)
}

/**
 * Solo los lugares `Active` generan check-ins, y eso no es un atajo: un lugar
 * en `Draft` no es visible para los exploradores, así que cero visitas es su
 * valor correcto. El desglose por lugar muestra esa fila en cero en vez de
 * esconderla — es información útil («tu segunda sede no está publicada»).
 */
export function buildMockCheckIns(
  range: AnalyticsRange,
  places: BusinessPlaceDetail[]
): MockCheckIn[] {
  const activePlaces = places.filter((place) => place.status === 'Active')

  return eachAnalyticsDate(range).flatMap((date) =>
    activePlaces.flatMap((place) => {
      const count = seededValue(`checkins:${place.placeId}:${date}`, 5)

      return Array.from({ length: count }, (_unused, index) => {
        const seed = `explorer:${place.placeId}:${date}:${index}`
        return {
          explorerId: MOCK_EXPLORER_IDS[seededValue(seed, MOCK_EXPLORER_IDS.length - 1)],
          placeId: place.placeId,
          // Aproximadamente un check-in de cada seis queda rechazado. Existe
          // para que el filtro por `ValidationStatus` tenga algo que filtrar:
          // si todas las filas fueran válidas, el handler podría omitir el
          // filtro y ningún test lo notaría.
          //
          // ⚠️ La decisión va por hash de la fila y NO por `index % 6`: `count`
          // nunca pasa de 5, así que el índice 6 no existe y esa rama quedaría
          // muerta — cero filas rechazadas, exactamente el agujero que este
          // campo existe para cubrir. Lo detectó el test del mock.
          validationStatus:
            seededValue(`status:${seed}`, 5) === 0 ? ('Rejected' as const) : ('Valid' as const),
          createdAt: `${date}T15:00:00.000Z`,
        }
      })
    })
  )
}

/**
 * Solo las recompensas `Published` se canjean — una en `Draft` no está
 * disponible para ningún explorador, así que no puede tener canjes.
 *
 * La frecuencia es baja a propósito (≈1 de cada 4 días por recompensa): los
 * canjes son órdenes de magnitud menos frecuentes que los check-ins, y una
 * semilla que los empareje daría una lectura falsa de la tasa de conversión.
 */
export function buildMockRedemptions(
  range: AnalyticsRange,
  rewards: BusinessRewardSummary[]
): MockRedemption[] {
  const publishedRewards = rewards.filter((reward) => reward.status === 'Published')

  return eachAnalyticsDate(range).flatMap((date) =>
    publishedRewards.flatMap((reward) => {
      const count = seededValue(`redemptions:${reward.rewardId}:${date}`, 3) === 0 ? 1 : 0
      if (count === 0) return []

      const ratingSeed = seededValue(`rating:${reward.rewardId}:${date}`, 4)

      return [
        {
          rewardId: reward.rewardId,
          explorerId: MOCK_EXPLORER_IDS[seededValue(`buyer:${reward.rewardId}:${date}`, 5)],
          redeemedAt: `${date}T18:00:00.000Z`,
          // `null` cuando el explorador no calificó — RN-REW-07 hace la
          // calificación opcional, así que un canje sin rating es legítimo y
          // el promedio tiene que saber ignorarlo.
          experienceRating: ratingSeed === 0 ? null : Math.min(5, 2 + ratingSeed),
        },
      ]
    })
  )
}

/** Agrega las filas de un período tal como lo haría el backend. */
function aggregateTotals(
  checkIns: MockCheckIn[],
  redemptions: MockRedemption[],
  rewards: BusinessRewardSummary[]
): AnalyticsTotals {
  const validCheckIns = checkIns.filter((checkIn) => checkIn.validationStatus === 'Valid')
  const ratings = redemptions
    .map((redemption) => redemption.experienceRating)
    .filter((rating): rating is number => rating !== null)

  const estimatedValueDeliveredCop = redemptions.reduce((total, redemption) => {
    const reward = rewards.find((candidate) => candidate.rewardId === redemption.rewardId)
    return total + (reward?.estimatedValueCop ?? 0)
  }, 0)

  return {
    checkIns: validCheckIns.length,
    uniqueVisitors: new Set(validCheckIns.map((checkIn) => checkIn.explorerId)).size,
    redemptions: redemptions.length,
    estimatedValueDeliveredCop,
    averageExperienceRating:
      ratings.length === 0
        ? null
        : Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10,
  }
}

function aggregatePlaces(
  checkIns: MockCheckIn[],
  places: BusinessPlaceDetail[]
): AnalyticsPlaceBreakdown[] {
  return places.map((place) => {
    const placeCheckIns = checkIns.filter(
      (checkIn) => checkIn.placeId === place.placeId && checkIn.validationStatus === 'Valid'
    )

    return {
      placeId: place.placeId,
      name: place.name,
      checkIns: placeCheckIns.length,
      uniqueVisitors: new Set(placeCheckIns.map((checkIn) => checkIn.explorerId)).size,
    }
  })
}

export function buildMockAnalyticsSummary(
  range: AnalyticsRange,
  places: BusinessPlaceDetail[],
  rewards: BusinessRewardSummary[]
): AnalyticsSummary {
  const previousRange = resolvePreviousRange(range)
  const currentCheckIns = buildMockCheckIns(range, places)

  return {
    from: range.from,
    to: range.to,
    current: aggregateTotals(currentCheckIns, buildMockRedemptions(range, rewards), rewards),
    previous: aggregateTotals(
      buildMockCheckIns(previousRange, places),
      buildMockRedemptions(previousRange, rewards),
      rewards
    ),
    places: aggregatePlaces(currentCheckIns, places),
  }
}

export function buildMockCheckInSeries(
  range: AnalyticsRange,
  places: BusinessPlaceDetail[]
): AnalyticsCheckInSeries {
  const checkIns = buildMockCheckIns(range, places)

  return {
    granularity: 'day',
    points: eachAnalyticsDate(range).map((date) => ({
      date,
      checkIns: checkIns.filter(
        (checkIn) => checkIn.validationStatus === 'Valid' && checkIn.createdAt.startsWith(date)
      ).length,
    })),
  }
}
