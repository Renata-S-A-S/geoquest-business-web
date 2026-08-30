import { z } from 'zod'

/**
 * `Place`, forma B2B (creado desde el portal) — ERD completo en Confluence.
 *
 * ⚠️ Un `Place` creado por un negocio es SIEMPRE `placeType: 'BusinessVenue'`
 * (ADR-041) — el portal nunca crea `TouristSite`. Por eso `xpReward` y
 * `geoPointsReward` van marcados `readonly`/no-input: ADR-043 fija que un
 * `BusinessVenue` otorga 0 XP y GeoPoints reducidos al 25% del baseline de
 * PLATAFORMA, no un valor que el negocio defina. Esto CORRIGE al flujo
 * B-02 de Confluence (🏢 Flujos del Negocio), que todavía describe un
 * `pointsReward` mínimo 50 definido por el negocio — ese campo ya no
 * existe en el modelo (ver nota de desfase en contratos-portal-b2b.md).
 */
export const placeTypeSchema = z.literal('BusinessVenue')

export const placeSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string(),
  placeType: placeTypeSchema,
  category: z.string(),
  subcategory: z.string(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }), // shape del JSON no confirmada contra el backend real
  timeZoneId: z.string(), // resuelto server-side por GeoTimeZoneResolver — el portal no lo setea
  checkInRadiusMeters: z.number().int().min(50).max(1000), // B-02: default 100
  photos: z.array(z.string().url()).min(1).max(5), // B-02: mínimo 1, máximo 5
  xpReward: z.number().int().nonnegative(), // fijado por la plataforma (ADR-043) — solo lectura desde el portal
  geoPointsReward: z.number().int().nonnegative(), // fijado por la plataforma, 25% del baseline (ADR-041) — solo lectura
  isVerified: z.boolean(),
  status: z.enum(['Draft', 'Active', 'Paused']), // 'Paused' confirmado (RN-BIZ-04); 'Draft' propuesto desde B-02 ("guarda como borrador")
  totalCheckIns: z.number().int().nonnegative(),
  allowedInDiscoveryRoutes: z.boolean(),
  createdAt: z.string().datetime(),
})
export type Place = z.infer<typeof placeSchema>

/** Input del formulario B-02 (crear lugar) — subconjunto editable por el negocio. */
export const createPlaceInputSchema = placeSchema.pick({
  name: true,
  category: true,
  subcategory: true,
  coordinates: true,
  checkInRadiusMeters: true,
  photos: true,
})
export type CreatePlaceInput = z.infer<typeof createPlaceInputSchema>
