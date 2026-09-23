import { describe, expect, it } from 'vitest'
import { resolveGoogleMapsVerification } from './google-maps-verification.mock'

/**
 * Pin ambos brazos de la heurística contra los 6 valores reales de
 * `BUSINESS_CATEGORY_OPTIONS` (`business-category-options.ts`), más un
 * valor desconocido — el gate de 85% de branches exige cubrir ambos lados
 * del `Set.has()`. El objeto de retorno se pin-ea completo en cada caso
 * (no solo `isGoogleMapsVerified`) para probar que el par nunca puede
 * quedar incoherente.
 */
describe('resolveGoogleMapsVerification', () => {
  it.each([
    ['gastronomia', 'ChIJ_mock_gastronomia'],
    ['alojamiento', 'ChIJ_mock_alojamiento'],
    ['entretenimiento', 'ChIJ_mock_entretenimiento'],
    ['compras', 'ChIJ_mock_compras'],
  ])('categoría listada "%s" ⇒ verificado con place id "%s"', (category, expectedPlaceId) => {
    expect(resolveGoogleMapsVerification(category)).toEqual({
      isGoogleMapsVerified: true,
      googleMapsPlaceId: expectedPlaceId,
    })
  })

  it.each([['servicios'], ['otro'], ['categoria-inexistente']])(
    'categoría no listada "%s" ⇒ no verificado, sin place id',
    (category) => {
      expect(resolveGoogleMapsVerification(category)).toEqual({
        isGoogleMapsVerified: false,
        googleMapsPlaceId: null,
      })
    }
  )
})
