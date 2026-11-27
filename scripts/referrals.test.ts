import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const referrals = await server.ssrLoadModule('/src/lib/referrals.ts')
const badges = await server.ssrLoadModule('/src/lib/badges.ts')

test.after(async () => {
  await server.close()
})

const NOW = Date.parse('2026-06-01T00:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

test('invite codes ignore spaces and dashes', () => {
  assert.equal(referrals.normalizeReferralCode('k7h2-m9qx'), 'K7H2M9QX')
  assert.equal(referrals.normalizeReferralCode('  ab12cd  '), 'AB12CD')
  assert.equal(referrals.normalizeReferralCode('no'), null)
  assert.equal(referrals.normalizeReferralCode(''), null)
})

test('invite links carry the code on the site origin', () => {
  assert.equal(
    referrals.referralInviteUrl('k7h2m9qx', 'https://decantiwine.com/'),
    'https://decantiwine.com/?ref=K7H2M9QX',
  )
})

test('app and web links both yield the invite code', () => {
  assert.equal(
    referrals.referralCodeFromUrl('com.northline.decanti://invite?ref=k7h2-m9qx'),
    'K7H2M9QX',
  )
  assert.equal(
    referrals.referralCodeFromUrl('https://decantiwine.com/share.html?wine=Barolo&ref=ab12cd'),
    'AB12CD',
  )
  assert.equal(referrals.referralCodeFromUrl('https://decantiwine.com/'), null)
})

test('invite Pro lasts until pro_until, and a paid flag still wins', () => {
  assert.equal(referrals.hasProAccess(false, new Date(NOW + DAY).toISOString(), NOW), true)
  assert.equal(referrals.hasProAccess(false, new Date(NOW - DAY).toISOString(), NOW), false)
  assert.equal(referrals.hasProAccess(true, new Date(NOW - DAY).toISOString(), NOW), true)
  assert.equal(referrals.hasProAccess(false, null, NOW), false)
})

test('free months stack with no cap', () => {
  let clock = { isPro: false, proUntil: null, bonusProDays: 0 }
  for (let i = 0; i < 50; i += 1) {
    clock = referrals.grantReferralMonth(clock, NOW)
  }
  assert.equal(Date.parse(clock.proUntil), NOW + 50 * referrals.REFERRAL_PRO_MS)
  assert.equal(clock.bonusProDays, 0)
})

test('paid subscribers bank invite days until the subscription ends', () => {
  const remaining = new Date(NOW + 10 * DAY).toISOString()
  let clock = { isPro: true, proUntil: remaining, bonusProDays: 0 }
  clock = referrals.grantReferralMonth(clock, NOW)
  clock = referrals.grantReferralMonth(clock, NOW)
  assert.equal(clock.proUntil, remaining)
  assert.equal(clock.bonusProDays, 60)

  const ended = referrals.endPaidSubscription(clock, NOW)
  assert.equal(ended.isPro, false)
  assert.equal(ended.bonusProDays, 0)
  assert.equal(Date.parse(ended.proUntil), Date.parse(remaining) + 60 * DAY)
})

test('a second account on a known device does not qualify', () => {
  assert.equal(referrals.signupDeviceBlocksReferral('device-a', ['device-a']), true)
  assert.equal(referrals.signupDeviceBlocksReferral('device-b', ['device-a']), false)
  assert.equal(referrals.signupDeviceBlocksReferral(null, ['device-a']), false)
})

test('the host badge starts at one qualified invite', () => {
  const tiers = (count: number) =>
    badges
      .computeBadgeProgress({ wines: [], friendCount: 0, referralCount: count })
      .find((badge: { id: string }) => badge.id === 'host').tier

  assert.equal(tiers(0), 'locked')
  assert.equal(tiers(1), 'bronze')
  assert.equal(tiers(3), 'silver')
  assert.equal(tiers(10), 'gold')
  assert.equal(tiers(25), 'diamond')
})
