/**
 * ⚠️ SOLO MOCK — CÓDIGO DESECHABLE. Borrar cuando exista el backend real.
 *
 * El cruce real con Google Maps (RN-BIZ-01/02) es server-side: lo resuelve
 * el backend después del registro, el cliente NUNCA decide esto. Esta regla
 * existe por una sola razón: que el portal pueda demostrar las dos ramas de
 * verificación (#25) sin backend y sin una palanca oculta de QA — la
 * categoría que elige el usuario en el formulario es lo que decide la rama.
 *
 * Es determinista a propósito (sin `Math.random`): los tests dependen de que
 * la misma categoría dé siempre la misma rama.
 *
 * Criterio: las categorías con local físico visitable (gastronomía,
 * alojamiento, entretenimiento, compras) suelen estar listadas en Google
 * Maps; servicios a domicilio y "otro" muchas veces no. Es una analogía
 * plausible, NO una regla de negocio confirmada en Confluence.
 */
const GOOGLE_MAPS_LISTED_CATEGORIES = new Set([
  'gastronomia',
  'alojamiento',
  'entretenimiento',
  'compras',
])
// 'servicios' y 'otro' quedan fuera → rama reforzada

/**
 * Deriva el par `{ isGoogleMapsVerified, googleMapsPlaceId }` a partir de la
 * categoría del negocio. Se devuelve como un único objeto a propósito: los
 * dos campos nunca deben poder asignarse por separado y quedar incoherentes
 * entre sí.
 */
export function resolveGoogleMapsVerification(category: string): {
  isGoogleMapsVerified: boolean
  googleMapsPlaceId: string | null
} {
  if (GOOGLE_MAPS_LISTED_CATEGORIES.has(category)) {
    return { isGoogleMapsVerified: true, googleMapsPlaceId: `ChIJ_mock_${category}` }
  }
  return { isGoogleMapsVerified: false, googleMapsPlaceId: null }
}
