import { describe, expect, it } from 'vitest'
import { userRewardSchema } from './user-reward'

const baseUserReward = {
  id: '11111111-1111-1111-1111-111111111111',
  explorerId: '22222222-2222-2222-2222-222222222222',
  rewardId: '33333333-3333-3333-3333-333333333333',
  status: 'Redeemed',
  origin: 'Purchased',
  reservationId: null,
  geoPointsSpent: 100,
  qrCode: 'ABC123',
  qrToken: 'signed-token',
  qrExpiresAt: '2026-08-29T00:30:00Z',
  earnedAt: '2026-08-29T00:00:00Z',
  redeemedAt: '2026-08-29T00:10:00Z',
  redeemedByStaffId: '44444444-4444-4444-4444-444444444444',
  experienceRating: null,
  rewardHonored: true,
  isReported: false,
  reportReason: null,
  reportStatus: null,
  adminNote: null,
}

describe('userRewardSchema', () => {
  it('parses a Purchased + Redeemed reward', () => {
    expect(userRewardSchema.parse(baseUserReward)).toMatchObject({ origin: 'Purchased' })
  })

  it('parses a Granted reward with geoPointsSpent 0 (ADR-045/RN-REW-10)', () => {
    const granted = { ...baseUserReward, origin: 'Granted', geoPointsSpent: 0 }
    expect(userRewardSchema.parse(granted)).toMatchObject({ origin: 'Granted', geoPointsSpent: 0 })
  })

  it('rejects an origin value outside Purchased/Granted', () => {
    expect(() => userRewardSchema.parse({ ...baseUserReward, origin: 'Bonus' })).toThrow()
  })

  it('rejects experienceRating outside 1–5 (RN-REW-07)', () => {
    expect(() => userRewardSchema.parse({ ...baseUserReward, experienceRating: 6 })).toThrow()
  })
})
