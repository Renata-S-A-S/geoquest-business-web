import { describe, expect, it } from 'vitest'
import {
  canEditReward,
  canPauseReward,
  canRepublishReward,
  committedUnits,
  republishWillExhaust,
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
  it('usa los cinco estados reales del backend', () => {
    expect(businessRewardStatusSchema.options).toEqual([
      'Draft',
      'Published',
      'Paused',
      'Archived',
      'Exhausted',
    ])
  })

  /**
   * `Exhausted` SÍ es un estado del servidor, y este test decía lo contrario.
   *
   * Llegó con los PRs #195–#201 junto a la máquina de estados de stock
   * (`Domain/RewardStatus.cs:26` @ `ea471f4`): `SyncStockStatus()` mueve
   * `Published` ⇄ `Exhausted`, y republicar sin stock deja `Exhausted`. Con
   * el enum de cuatro valores, parsear una recompensa agotada real fallaba
   * la lista entera — el mismo tipo de bug que esta familia de tests fue
   * escrita para evitar, solo que al revés.
   */
  it('acepta Exhausted, que es un estado real desde los PRs #195–#201', () => {
    expect(businessRewardStatusSchema.safeParse('Exhausted').success).toBe(true)
  })

  /**
   * `Active` sigue siendo inventado: el portal lo usaba donde el backend dice
   * `Published`.
   */
  it('rechaza Active, que el portal inventó en lugar de Published', () => {
    expect(businessRewardStatusSchema.safeParse('Active').success).toBe(false)
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
    expect(canPublishReward({ ...SUMMARY, status: 'Draft', imageUrl: 'https://cdn/x.jpg' })).toBe(
      true
    )
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

describe('canEditReward', () => {
  /**
   * Replica el guard del servidor EXACTO (`Reward.cs:205`). Ser más estricto
   * que el servidor esconde acciones válidas: es el bug que ya tuvo
   * `canPublishPlace`, así que estos tres casos positivos importan tanto como
   * los negativos.
   */
  it.each(['Published', 'Exhausted', 'Paused'] as const)('permite editar en %s', (status) => {
    expect(canEditReward({ ...SUMMARY, status })).toBe(true)
  })

  it.each(['Draft', 'Archived'] as const)('no permite editar en %s', (status) => {
    expect(canEditReward({ ...SUMMARY, status })).toBe(false)
  })
})

describe('committedUnits', () => {
  it('deriva lo comprometido como total menos restante', () => {
    expect(committedUnits({ ...SUMMARY, stockTotal: 50, stockRemaining: 42 })).toBe(8)
  })

  it('devuelve cero cuando no se comprometió nada', () => {
    expect(committedUnits({ ...SUMMARY, stockTotal: 10, stockRemaining: 10 })).toBe(0)
  })

  it('devuelve el total cuando ya no queda stock', () => {
    expect(committedUnits({ ...SUMMARY, stockTotal: 10, stockRemaining: 0 })).toBe(10)
  })

  /**
   * Sin tope, lo comprometido solo existe del lado del servidor
   * (`CountCommittedByRewardIdAsync`) y ningún endpoint lo expone. Devolver
   * `null` en vez de `0` es lo que permite que la interfaz sea honesta en vez
   * de afirmar que no hay nada comprometido.
   */
  it('devuelve null sin tope, porque el dato NO es derivable del cliente', () => {
    expect(committedUnits({ ...SUMMARY, stockTotal: null, stockRemaining: null })).toBeNull()
  })
})

describe('canPauseReward', () => {
  it.each(['Published', 'Exhausted'] as const)('permite pausar en %s', (status) => {
    expect(canPauseReward({ ...SUMMARY, status })).toBe(true)
  })

  it.each(['Draft', 'Paused', 'Archived'] as const)('no permite pausar en %s', (status) => {
    expect(canPauseReward({ ...SUMMARY, status })).toBe(false)
  })
})

describe('canRepublishReward', () => {
  it('permite republicar solo en Paused', () => {
    expect(canRepublishReward({ ...SUMMARY, status: 'Paused' })).toBe(true)
  })

  it.each(['Draft', 'Published', 'Archived', 'Exhausted'] as const)(
    'no permite republicar en %s',
    (status) => {
      expect(canRepublishReward({ ...SUMMARY, status })).toBe(false)
    }
  )
})

describe('republishWillExhaust', () => {
  it('anticipa el agotamiento cuando hay tope y no queda stock', () => {
    expect(republishWillExhaust({ ...SUMMARY, stockTotal: 50, stockRemaining: 0 })).toBe(true)
  })

  it('no lo anticipa cuando queda stock', () => {
    expect(republishWillExhaust({ ...SUMMARY, stockTotal: 50, stockRemaining: 1 })).toBe(false)
  })

  /**
   * El guard del dominio es `StockTotal is not null && StockRemaining <= 0`, así
   * que una recompensa SIN TOPE nunca cae en `Exhausted`. Tratar `null` como
   * cero acá prometería un agotamiento imposible.
   */
  it('NUNCA lo anticipa sin tope, aunque stockRemaining sea null', () => {
    expect(republishWillExhaust({ ...SUMMARY, stockTotal: null, stockRemaining: null })).toBe(false)
  })
})
