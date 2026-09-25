import { describe, expect, it } from 'vitest'
import {
  createQrTokenFormSchema,
  redemptionErrorKey,
  redemptionOriginSchema,
  redemptionPreviewSchema,
  scanRedemptionInputSchema,
} from './business-redemption'

/** Token con la forma real: 43 caracteres base64 + '=' de relleno. */
const VALID_TOKEN = `${'A'.repeat(43)}=`

const t = (key: string) => key

const BASE_PREVIEW = {
  userRewardId: '00000000-0000-0000-0000-000000000010',
  rewardId: '00000000-0000-0000-0000-000000000020',
  rewardTitle: 'Postre gratis',
  explorerId: '00000000-0000-0000-0000-000000000030',
  origin: 'Purchased',
  geoPointsCostSnapshot: 80,
  estimatedValueCopSnapshot: 12000,
  qrExpiresAtUtc: '2026-09-24T18:30:00Z',
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
  it('parsea la respuesta del lookup por token', () => {
    expect(redemptionPreviewSchema.parse(BASE_PREVIEW)).toMatchObject({
      userRewardId: BASE_PREVIEW.userRewardId,
      origin: 'Purchased',
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
})

describe('scanRedemptionInputSchema', () => {
  it('exige los dos campos que pide `ScanRedemptionQrRequest`', () => {
    const parsed = scanRedemptionInputSchema.parse({
      userRewardId: BASE_PREVIEW.userRewardId,
      qrToken: VALID_TOKEN,
    })

    expect(Object.keys(parsed).sort()).toEqual(['qrToken', 'userRewardId'])
  })

  it('rechaza un escaneo sin userRewardId: es justo lo que el QR no trae', () => {
    expect(() => scanRedemptionInputSchema.parse({ qrToken: VALID_TOKEN })).toThrow()
  })
})

describe('redemptionErrorKey', () => {
  it.each([
    ['ScanRedemptionQrCommand.RewardNotFound', 'notFound'],
    ['ScanRedemptionQrCommand.InvalidQrToken', 'invalidToken'],
    ['ScanRedemptionQrCommand.QrExpired', 'expired'],
    ['UserReward.InvalidStatusTransition', 'alreadyRedeemed'],
    ['RewardPortal.NotBusinessOwner', 'notOwner'],
    ['RewardPortal.BusinessNotActive', 'businessNotActive'],
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
   * Las claves son cortas a propósito: i18next usa `.` como separador, así
   * que devolver el código con puntos haría que `t()` buscara un objeto
   * anidado y le mostrara la clave cruda al staff.
   */
  it('no devuelve claves con puntos', () => {
    expect(redemptionErrorKey('UserReward.InvalidStatusTransition')).not.toContain('.')
  })
})
