import { describe, expect, it } from 'vitest'
import {
  createQrTokenFormSchema,
  lookupRedemptionInputSchema,
  redemptionErrorKey,
  redemptionNotRedeemableReason,
  redemptionOriginSchema,
  redemptionPreviewSchema,
  redemptionStatusSchema,
  scanRedemptionInputSchema,
} from './business-redemption'

/** Token con la forma real: 43 caracteres base64 + '=' de relleno. */
const VALID_TOKEN = `${'A'.repeat(43)}=`

const t = (key: string) => key

const BASE_PREVIEW = {
  userRewardId: '00000000-0000-0000-0000-000000000010',
  rewardId: '00000000-0000-0000-0000-000000000020',
  rewardTitle: 'Postre gratis',
  rewardDescription: 'Un postre de la vitrina llevando cualquier bebida caliente.',
  status: 'Earned',
  isRedeemable: true,
  qrExpiresAtUtc: '2026-09-24T18:30:00Z',
  origin: 'Purchased',
  geoPointsCostSnapshot: 80,
  explorerId: '00000000-0000-0000-0000-000000000030',
  explorerUsername: 'ana_explorer',
}

describe('redemptionOriginSchema', () => {
  it('acepta los dos valores reales del backend', () => {
    expect(redemptionOriginSchema.parse('Purchased')).toBe('Purchased')
    expect(redemptionOriginSchema.parse('Prize')).toBe('Prize')
  })

  /**
   * Este test es el que protege la discrepancia documentada: RN-REW-10,
   * ADR-045 y el issue #47 dicen `Granted`, y el backend no lo tiene. Si
   * alguien "corrige" el enum hacia la documentación, esto se pone rojo.
   */
  it('rechaza `Granted`, que es el valor que dice la documentación y no existe', () => {
    expect(() => redemptionOriginSchema.parse('Granted')).toThrow()
  })
})

describe('redemptionStatusSchema', () => {
  it.each(['Earned', 'Redeemed', 'Expired', 'PendingReservation', 'Failed'])(
    'acepta %s',
    (status) => {
      expect(redemptionStatusSchema.parse(status)).toBe(status)
    }
  )

  it('rechaza un estado que el backend no reporta', () => {
    expect(() => redemptionStatusSchema.parse('Cancelled')).toThrow()
  })
})

describe('createQrTokenFormSchema', () => {
  it('acepta un token con la forma que produce el backend', () => {
    const parsed = createQrTokenFormSchema(t).parse({ qrToken: VALID_TOKEN })

    expect(parsed.qrToken).toBe(VALID_TOKEN)
  })

  /**
   * El token se pega, y pegar arrastra espacios y saltos de línea. Sin el
   * `.trim()` el staff vería un error de formato por algo que no hizo.
   */
  it('recorta los espacios y saltos que arrastra el pegado', () => {
    const parsed = createQrTokenFormSchema(t).parse({ qrToken: `  ${VALID_TOKEN}\n` })

    expect(parsed.qrToken).toBe(VALID_TOKEN)
  })

  it('pide el campo cuando viene vacío, en vez de hablar de formato', () => {
    const result = createQrTokenFormSchema(t).safeParse({ qrToken: '   ' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('entry.errors.required')
  })

  it.each([
    ['muy corto', 'AAAA='],
    ['sin el relleno final', 'A'.repeat(44)],
    ['un caracter de más', `${'A'.repeat(44)}=`],
    ['con un caracter fuera del alfabeto base64', `${'A'.repeat(42)}$=`],
    ['en la variante url-safe que el backend no produce', `${'-'.repeat(43)}=`],
  ])('rechaza un token %s', (_caso, token) => {
    const result = createQrTokenFormSchema(t).safeParse({ qrToken: token })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('entry.errors.format')
  })

  /**
   * Zod congela los mensajes al construir el schema: si el schema fuera un
   * singleton de módulo, el mensaje quedaría en el idioma del primer import.
   */
  it('usa el `t` que recibe, no uno congelado al importar', () => {
    const result = createQrTokenFormSchema((key) => `es:${key}`).safeParse({ qrToken: 'x' })

    expect(result.error?.issues[0]?.message).toBe('es:entry.errors.format')
  })
})

describe('redemptionPreviewSchema', () => {
  it('parsea la respuesta real del lookup', () => {
    expect(redemptionPreviewSchema.parse(BASE_PREVIEW)).toMatchObject({
      userRewardId: BASE_PREVIEW.userRewardId,
      origin: 'Purchased',
      status: 'Earned',
      isRedeemable: true,
    })
  })

  /** RN-REW-10: un premio no descontó saldo, así que 0 es un costo válido. */
  it('acepta costo 0 para un premio', () => {
    const prize = { ...BASE_PREVIEW, origin: 'Prize', geoPointsCostSnapshot: 0 }

    expect(redemptionPreviewSchema.parse(prize)).toMatchObject({
      origin: 'Prize',
      geoPointsCostSnapshot: 0,
    })
  })

  it('rechaza un costo negativo', () => {
    expect(() =>
      redemptionPreviewSchema.parse({ ...BASE_PREVIEW, geoPointsCostSnapshot: -1 })
    ).toThrow()
  })

  it('exige el userRewardId, que es la única razón por la que este lookup existe', () => {
    const { userRewardId: _omitido, ...sinId } = BASE_PREVIEW

    expect(() => redemptionPreviewSchema.parse(sinId)).toThrow()
  })

  it('ya no expone estimatedValueCopSnapshot: el backend no lo manda', () => {
    const withStaleField = { ...BASE_PREVIEW, estimatedValueCopSnapshot: 12000 }

    expect(redemptionPreviewSchema.parse(withStaleField)).not.toHaveProperty(
      'estimatedValueCopSnapshot'
    )
  })

  it('acepta qrExpiresAtUtc nulo', () => {
    const parsed = redemptionPreviewSchema.parse({ ...BASE_PREVIEW, qrExpiresAtUtc: null })

    expect(parsed.qrExpiresAtUtc).toBeNull()
  })

  it('acepta explorerUsername nulo, cuando el ExplorerRef todavía no se proyectó', () => {
    const parsed = redemptionPreviewSchema.parse({ ...BASE_PREVIEW, explorerUsername: null })

    expect(parsed.explorerUsername).toBeNull()
  })

  it('exige rewardDescription', () => {
    const { rewardDescription: _omitido, ...sinDescripcion } = BASE_PREVIEW

    expect(() => redemptionPreviewSchema.parse(sinDescripcion)).toThrow()
  })

  it('exige isRedeemable', () => {
    const { isRedeemable: _omitido, ...sinIsRedeemable } = BASE_PREVIEW

    expect(() => redemptionPreviewSchema.parse(sinIsRedeemable)).toThrow()
  })
})

describe('redemptionNotRedeemableReason', () => {
  it('devuelve null para Earned: es el único estado redimible', () => {
    expect(redemptionNotRedeemableReason('Earned')).toBeNull()
  })

  it('mapea Redeemed a "redeemed"', () => {
    expect(redemptionNotRedeemableReason('Redeemed')).toBe('redeemed')
  })

  it('mapea Expired a "expired"', () => {
    expect(redemptionNotRedeemableReason('Expired')).toBe('expired')
  })

  it.each(['PendingReservation', 'Failed'] as const)('mapea %s a "notRedeemable"', (status) => {
    expect(redemptionNotRedeemableReason(status)).toBe('notRedeemable')
  })
})

describe('lookupRedemptionInputSchema', () => {
  it('exige solo qrToken en el body del lookup', () => {
    const parsed = lookupRedemptionInputSchema.parse({ qrToken: VALID_TOKEN })

    expect(Object.keys(parsed)).toEqual(['qrToken'])
  })

  it('rechaza un body sin qrToken', () => {
    expect(() => lookupRedemptionInputSchema.parse({})).toThrow()
  })
})

describe('scanRedemptionInputSchema', () => {
  it('exige solo qrToken: userRewardId ya no es parte del contrato', () => {
    const parsed = scanRedemptionInputSchema.parse({ qrToken: VALID_TOKEN })

    expect(Object.keys(parsed)).toEqual(['qrToken'])
  })

  it('rechaza un body sin qrToken', () => {
    expect(() => scanRedemptionInputSchema.parse({})).toThrow()
  })

  it('ignora un userRewardId colado: el backend ya no lo lee', () => {
    const parsed = scanRedemptionInputSchema.parse({
      qrToken: VALID_TOKEN,
      userRewardId: BASE_PREVIEW.userRewardId,
    })

    expect(Object.keys(parsed)).toEqual(['qrToken'])
  })
})

describe('redemptionErrorKey', () => {
  it.each([
    ['RedemptionToken.NotFound', 'notFound'],
    ['RewardPortal.NotBusinessOwner', 'notOwner'],
    ['RewardPortal.BusinessNotActive', 'businessNotActive'],
    ['RedemptionToken.OtherBusiness', 'otherBusiness'],
    ['RedemptionToken.AlreadyRedeemed', 'alreadyRedeemed'],
    ['RedemptionToken.NotRedeemable', 'notRedeemable'],
    ['RedemptionToken.Expired', 'expired'],
    ['UserReward.InvalidStatusTransition', 'invalidTransition'],
    ['UserReward.ConcurrencyConflict', 'concurrencyConflict'],
  ])('mapea %s a la clave %s', (title, expected) => {
    expect(redemptionErrorKey(title)).toBe(expected)
  })

  it('devuelve null para un código que no conoce', () => {
    expect(redemptionErrorKey('Algo.Inesperado')).toBeNull()
  })

  it('devuelve null cuando no vino ningún title', () => {
    expect(redemptionErrorKey(undefined)).toBeNull()
  })

  /**
   * Los códigos de `ScanRedemptionQrCommand` ya no existen: el comando se
   * reemplazó por resolución por token (`RedemptionToken.*`). Si alguien los
   * reintroduce por error de copy-paste, este test lo agarra.
   */
  it.each([
    'ScanRedemptionQrCommand.RewardNotFound',
    'ScanRedemptionQrCommand.InvalidQrToken',
    'ScanRedemptionQrCommand.QrExpired',
  ])('ya no reconoce el código muerto %s', (deadCode) => {
    expect(redemptionErrorKey(deadCode)).toBeNull()
  })

  /**
   * Las claves son cortas a propósito: i18next usa `.` como separador, así
   * que devolver el código con puntos haría que `t()` buscara un objeto
   * anidado y le mostrara la clave cruda al staff.
   */
  it('no devuelve claves con puntos', () => {
    expect(redemptionErrorKey('UserReward.InvalidStatusTransition')).not.toContain('.')
  })
})
