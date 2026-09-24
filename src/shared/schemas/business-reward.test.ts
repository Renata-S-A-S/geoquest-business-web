import { describe, expect, it } from 'vitest'
import {
  businessRewardStatusSchema,
  businessRewardSummarySchema,
  createBusinessRewardInputSchema,
  createdBusinessRewardSchema,
  isRewardOutOfStock,
  canPublishReward,
  publishBusinessRewardResultSchema,
  type BusinessRewardSummary,
} from './business-reward'

const SUMMARY: BusinessRewardSummary = {
  rewardId: '00000000-0000-0000-0000-000000000020',
  businessId: '00000000-0000-0000-0000-000000000001',
  title: '2x1 en café de especialidad',
  description: 'Llevá dos cafés pagando uno, de lunes a jueves.',
  geoPointsCost: 100,
  estimatedValueCop: 15000,
  status: 'Published',
  stockTotal: 50,
  stockRemaining: 42,
  placeId: '00000000-0000-0000-0000-000000000010',
  menuItemId: null,
  imageUrl: null,
}

describe('businessRewardStatusSchema', () => {
  it('usa los cuatro estados reales del backend', () => {
    expect(businessRewardStatusSchema.options).toEqual([
      'Draft',
      'Published',
      'Paused',
      'Archived',
    ])
  })

  /**
   * El portal usaba `Active` y `Exhausted`. `Active` es en realidad
   * `Published`, y `Exhausted` NO es un estado: el agotamiento se lee de
   * `stockRemaining`. Parsear una respuesta real con el enum viejo fallaba.
   */
  it('rechaza los valores inventados por el portal', () => {
    expect(businessRewardStatusSchema.safeParse('Active').success).toBe(false)
    expect(businessRewardStatusSchema.safeParse('Exhausted').success).toBe(false)
  })
})

describe('businessRewardSummarySchema', () => {
  it('acepta la forma del listado', () => {
    expect(businessRewardSummarySchema.parse(SUMMARY)).toEqual(SUMMARY)
  })

  it('exige descripción, que el schema anterior ni siquiera tenía', () => {
    const { description: _d, ...withoutDescription } = SUMMARY
    expect(businessRewardSummarySchema.safeParse(withoutDescription).success).toBe(false)
  })

  it('acepta una recompensa sin lugar asociado — `placeId` es opcional en el backend', () => {
    expect(businessRewardSummarySchema.parse({ ...SUMMARY, placeId: null }).placeId).toBeNull()
  })

  it('acepta stock ilimitado como null', () => {
    const unlimited = { ...SUMMARY, stockTotal: null, stockRemaining: null }
    expect(businessRewardSummarySchema.parse(unlimited)).toEqual(unlimited)
  })

  it('rechaza los campos inventados si alguien intenta reintroducirlos con un valor inválido', () => {
    expect(businessRewardSummarySchema.safeParse({ ...SUMMARY, status: 'Active' }).success).toBe(
      false
    )
  })
})

describe('createBusinessRewardInputSchema', () => {
  const INPUT = {
    title: 'Postre gratis',
    description: 'Un postre de la vitrina con cualquier bebida caliente.',
    geoPointsCost: 80,
    estimatedValueCop: 12000,
    menuItemId: null,
    placeId: null,
    stockTotal: 20,
  }

  it('acepta un payload válido', () => {
    expect(createBusinessRewardInputSchema.parse(INPUT)).toEqual(INPUT)
  })

  it('exige descripción no vacía', () => {
    expect(createBusinessRewardInputSchema.safeParse({ ...INPUT, description: '' }).success).toBe(
      false
    )
  })

  it('exige un costo en GeoPoints positivo', () => {
    expect(createBusinessRewardInputSchema.safeParse({ ...INPUT, geoPointsCost: 0 }).success).toBe(
      false
    )
  })

  /**
   * Los nueve campos que el portal inventaba no tienen lugar acá. Este caso
   * fija la forma exacta para que nadie los reintroduzca sin verificarlos
   * contra `Modules.Rewards` primero.
   */
  it('expone exactamente los 7 campos de `PublishRewardRequest`', () => {
    expect(Object.keys(createBusinessRewardInputSchema.shape).sort()).toEqual([
      'description',
      'estimatedValueCop',
      'geoPointsCost',
      'menuItemId',
      'placeId',
      'stockTotal',
      'title',
    ])
  })

  it('no define tipo, categoría, vigencia ni términos propios', () => {
    const shape = Object.keys(createBusinessRewardInputSchema.shape)
    expect(shape).not.toContain('type')
    expect(shape).not.toContain('rewardCategory')
    expect(shape).not.toContain('validUntil')
    expect(shape).not.toContain('ownTerms')
  })
})

describe('createdBusinessRewardSchema', () => {
  it('acepta la respuesta 201 que solo trae el id', () => {
    expect(createdBusinessRewardSchema.parse({ rewardId: SUMMARY.rewardId })).toEqual({
      rewardId: SUMMARY.rewardId,
    })
  })
})

/**
 * `null` es stock ILIMITADO, no agotado. Un `!stockRemaining` trataría
 * `null` y `0` igual y marcaría como agotada una recompensa sin límite —
 * justo al revés de lo que el negocio espera.
 */
describe('isRewardOutOfStock', () => {
  it('marca agotada solo cuando el restante llegó a cero', () => {
    expect(isRewardOutOfStock({ ...SUMMARY, stockRemaining: 0 })).toBe(true)
  })

  it('NO marca agotada una recompensa con stock ilimitado', () => {
    expect(isRewardOutOfStock({ ...SUMMARY, stockTotal: null, stockRemaining: null })).toBe(false)
  })

  it('no marca agotada una recompensa con unidades disponibles', () => {
    expect(isRewardOutOfStock(SUMMARY)).toBe(false)
  })
})

/**
 * Precondición espejo del precedente de `Place`: así como un lugar no se
 * publica sin al menos una foto, una recompensa no se publica sin imagen.
 * Una recién creada NUNCA la tiene — se sube después —, así que sin esta
 * guarda el botón de publicar dejaría visible una recompensa sin nada que
 * mostrar.
 */
describe('canPublishReward', () => {
  it('permite publicar un borrador que ya tiene imagen', () => {
    expect(
      canPublishReward({ ...SUMMARY, status: 'Draft', imageUrl: 'https://cdn/x.jpg' })
    ).toBe(true)
  })

  it('NO permite publicar un borrador sin imagen', () => {
    expect(canPublishReward({ ...SUMMARY, status: 'Draft', imageUrl: null })).toBe(false)
  })

  it('NO permite republicar una ya publicada', () => {
    expect(canPublishReward({ ...SUMMARY, status: 'Published' })).toBe(false)
  })

  it('NO permite publicar desde Paused ni Archived', () => {
    expect(canPublishReward({ ...SUMMARY, status: 'Paused' })).toBe(false)
    expect(canPublishReward({ ...SUMMARY, status: 'Archived' })).toBe(false)
  })
})

describe('publishBusinessRewardResultSchema', () => {
  it('replica la forma que ya devuelve la publicación de lugares', () => {
    expect(
      publishBusinessRewardResultSchema.parse({ status: 'Published', visibleToExplorers: true })
    ).toEqual({ status: 'Published', visibleToExplorers: true })
  })
})
