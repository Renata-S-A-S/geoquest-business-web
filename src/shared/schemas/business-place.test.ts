import { describe, expect, it } from 'vitest'
import { Category, Subcategory } from './taxonomy'
import {
  businessPlaceDetailSchema,
  businessPlaceStatusSchema,
  businessPlaceSummarySchema,
  createBusinessPlaceInputSchema,
  createdBusinessPlaceSchema,
  updateBusinessPlaceInputSchema,
} from './business-place'

const SUMMARY = {
  placeId: '00000000-0000-0000-0000-000000000010',
  name: 'Café de la 70 — Sede Laureles',
  category: Category.Gastronomia,
  subcategory: Subcategory.Cafe,
  status: 'Active',
  xpReward: 0,
  geoPointsReward: 12,
}

const DETAIL = {
  ...SUMMARY,
  description: 'Café de especialidad en Laureles.',
  latitude: 6.2447,
  longitude: -75.5916,
  checkInRadiusMeters: 100,
  photos: ['https://cdn.example/places/abc/def.jpg'],
}

const CREATE_INPUT = {
  name: 'Café de la 70 — Sede Estadio',
  description: 'Sede nueva sobre la 70.',
  category: Category.Gastronomia,
  subcategory: Subcategory.Cafe,
  latitude: 6.253,
  longitude: -75.588,
  checkInRadiusMeters: 150,
  xpReward: 0,
  geoPointsReward: 12,
}

describe('businessPlaceStatusSchema', () => {
  it('acepta los cuatro estados del backend, incluido Deleted', () => {
    expect(businessPlaceStatusSchema.parse('Deleted')).toBe('Deleted')
    expect(businessPlaceStatusSchema.parse('Draft')).toBe('Draft')
  })

  /**
   * `Deleted` faltaba en el schema anterior del portal, y es alcanzable: ni
   * el repositorio de lista ni el de detalle filtran por estado. Sin este
   * valor, un lugar borrado rompía el parseo de la lista ENTERA.
   */
  it('incluye Deleted, que el schema anterior omitía', () => {
    expect(businessPlaceStatusSchema.options).toContain('Deleted')
    expect(businessPlaceStatusSchema.options).toHaveLength(4)
  })
})

describe('businessPlaceSummarySchema', () => {
  it('acepta la forma de la lista', () => {
    expect(businessPlaceSummarySchema.parse(SUMMARY)).toEqual(SUMMARY)
  })

  /**
   * La lista NO trae coordenadas, descripción, radio ni fotos. Este caso
   * fija esa asimetría: modelarla con el schema de detalle haría fallar el
   * parseo de toda la pantalla de lugares.
   */
  it('NO exige los campos que solo existen en el detalle', () => {
    expect(businessPlaceSummarySchema.safeParse(SUMMARY).success).toBe(true)
    expect(businessPlaceDetailSchema.safeParse(SUMMARY).success).toBe(false)
  })

  it('rechaza la categoría como slug de texto', () => {
    expect(businessPlaceSummarySchema.safeParse({ ...SUMMARY, category: 'gastronomia' }).success).toBe(
      false
    )
  })
})

describe('businessPlaceDetailSchema', () => {
  it('acepta la forma del detalle', () => {
    expect(businessPlaceDetailSchema.parse(DETAIL)).toEqual(DETAIL)
  })

  it('acepta un borrador sin fotos — el mínimo de 1 se exige al publicar', () => {
    expect(businessPlaceDetailSchema.parse({ ...DETAIL, status: 'Draft', photos: [] })).toMatchObject(
      { photos: [] }
    )
  })

  /**
   * El portal modelaba `coordinates: { lat, lng }`. El backend serializa
   * dos dobles planos en todos sus DTOs públicos, confirmado además por el
   * Explorer contra el backend en vivo.
   */
  it('rechaza el objeto `coordinates` envolvente que asumía el portal', () => {
    const { latitude: _lat, longitude: _lng, ...rest } = DETAIL
    expect(
      businessPlaceDetailSchema.safeParse({ ...rest, coordinates: { lat: 6.24, lng: -75.59 } })
        .success
    ).toBe(false)
  })
})

describe('createBusinessPlaceInputSchema', () => {
  it('acepta un payload válido', () => {
    expect(createBusinessPlaceInputSchema.parse(CREATE_INPUT)).toEqual(CREATE_INPUT)
  })

  /**
   * Las fotos NO viajan en la creación: se suben después, una por una,
   * contra `POST /business/places/{id}/photos`. Confirma por otra vía la
   * corrección de #89 — acá directamente no hay dónde ponerlas.
   */
  it('no define un campo de fotos', () => {
    expect(Object.keys(createBusinessPlaceInputSchema.shape)).not.toContain('photos')
  })

  it('exige descripción no vacía', () => {
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, description: '' }).success).toBe(
      false
    )
  })

  it('respeta el rango de radio 50–1000 inclusive', () => {
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, checkInRadiusMeters: 50 }).success).toBe(true)
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, checkInRadiusMeters: 1000 }).success).toBe(true)
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, checkInRadiusMeters: 49 }).success).toBe(false)
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, checkInRadiusMeters: 1001 }).success).toBe(false)
  })

  it('valida el rango geográfico de latitud y longitud', () => {
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, latitude: 91 }).success).toBe(false)
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, longitude: -181 }).success).toBe(false)
  })

  /**
   * Las recompensas son LITERALES, no un rango. RN-GAM-03 dice que el XP de
   * un `BusinessVenue` es *"0 — forzado por el sistema"*, y RN-GAM-10 fija
   * sus GeoPoints en 12 desde la plataforma. Para ese tipo de lugar no hay
   * rango que validar: hay un único valor permitido.
   *
   * Que 50 —el mínimo que el backend exige hoy— sea RECHAZADO acá no es un
   * descuido: es el punto. El portal queda alineado con la regla, y el
   * desvío del backend está pedido en `Renata-S-A-S/geoquest#191`.
   */
  it('acepta exactamente 0 XP y 12 GeoPoints, los valores de la regla', () => {
    expect(createBusinessPlaceInputSchema.safeParse(CREATE_INPUT).success).toBe(true)
    expect(CREATE_INPUT.xpReward).toBe(0)
    expect(CREATE_INPUT.geoPointsReward).toBe(12)
  })

  it('rechaza cualquier otro valor de recompensa, incluido el mínimo que el backend exige hoy', () => {
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, xpReward: 50 }).success).toBe(
      false
    )
    expect(
      createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, geoPointsReward: 50 }).success
    ).toBe(false)
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, xpReward: 1 }).success).toBe(
      false
    )
  })

  it('rechaza una subcategoría fuera del enum', () => {
    expect(createBusinessPlaceInputSchema.safeParse({ ...CREATE_INPUT, subcategory: 20 }).success).toBe(false)
  })
})

describe('createdBusinessPlaceSchema', () => {
  /**
   * El `POST` devuelve SOLO el id, no el agregado completo. Quien necesite
   * el lugar recién creado tiene que pedirlo con `GET /business/places/{id}`.
   */
  it('acepta la respuesta 201 que solo trae el id', () => {
    expect(createdBusinessPlaceSchema.parse({ placeId: SUMMARY.placeId })).toEqual({
      placeId: SUMMARY.placeId,
    })
  })
})

describe('updateBusinessPlaceInputSchema', () => {
  /**
   * Pese al verbo PATCH, el backend NO acepta una actualización parcial:
   * ambos campos son obligatorios. Omitir uno responde 400.
   */
  it('exige nombre Y descripción, aunque el verbo sea PATCH', () => {
    expect(updateBusinessPlaceInputSchema.safeParse({ name: 'Solo nombre' }).success).toBe(false)
    expect(
      updateBusinessPlaceInputSchema.safeParse({ name: 'Nombre', description: 'Desc' }).success
    ).toBe(true)
  })

  it('solo permite esos dos campos — ni categoría, ni radio, ni coordenadas', () => {
    expect(Object.keys(updateBusinessPlaceInputSchema.shape)).toEqual(['name', 'description'])
  })
})
