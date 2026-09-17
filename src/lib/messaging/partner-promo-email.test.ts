import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidPartnerEmail, normalizeImportedEmail } from '@/lib/messaging/partner-email-normalize'
import { cartItemSummaryLines } from '@/lib/messaging/partner-promo-email'
import { formatPromoCopy, partnerPromoEmailCopy } from '@/lib/messaging/partner-promo-email-i18n'
import { birthdayCampaignKey, birthdayDayCampaignKey } from '@/lib/messaging/birthday-promo-interest-inventory-ids'
import {
  EMAIL_WARMUP_UNLIMITED,
  partnerEmailWarmupDailyLimit,
} from '@/lib/db/messaging-partner-email-management-pg'

test('normalizeImportedEmail fixes common domain typos', () => {
  const gmail = normalizeImportedEmail('  User@gmial.con  ')
  assert.equal(gmail.email, 'user@gmail.com')
  assert.equal(gmail.corrected, true)
  assert.ok(gmail.fixes.length > 0)
  const empty = normalizeImportedEmail('nan')
  assert.equal(empty.email, null)
  assert.equal(isValidPartnerEmail('ok@shop.vn'), true)
  assert.equal(isValidPartnerEmail('not-an-email'), false)
})

test('cartItemSummaryLines reads card.name and quantity', () => {
  const lines = cartItemSummaryLines([
    { card: { name: 'Túi mini' }, quantity: 2 },
    { name: 'Giày', quantity: 1 },
    { title: 'Áo' },
  ])
  assert.deepEqual(lines, ['Túi mini × 2', 'Giày × 1', 'Áo × 1'])
})

test('promo copy fills shop name and keeps CTA structure', () => {
  const copy = partnerPromoEmailCopy('vi')
  assert.match(formatPromoCopy(copy.birthdaySubject, { shop: 'Demo', percent: 10, name: 'An' }), /Demo/)
  assert.match(copy.cartCta, /giỏ/i)
  assert.ok(copy.regards.length > 0)
  assert.match(formatPromoCopy(copy.birthdayDay.subject, { shop: 'Demo', name: 'An' }), /chúc mừng sinh nhật/)
  assert.match(formatPromoCopy(copy.birthdayDay.offerLine, { percent: 10 }), /10%/)
})

test('birthday T-7 and T0 campaign keys are distinct', () => {
  assert.notEqual(birthdayCampaignKey('2026-09-17'), birthdayDayCampaignKey('2026-09-17'))
  assert.match(birthdayDayCampaignKey('2026-09-17'), /^bday_day_/)
})

test('warmup daily limit ramps from start by day then caps', () => {
  assert.equal(
    partnerEmailWarmupDailyLimit({
      warmup_enabled: false,
      start_limit: 5,
      daily_increment: 5,
      max_limit: 20,
      warmup_day: 3,
    }),
    EMAIL_WARMUP_UNLIMITED
  )
  assert.equal(
    partnerEmailWarmupDailyLimit({
      warmup_enabled: true,
      start_limit: 5,
      daily_increment: 5,
      max_limit: null,
      warmup_day: 1,
    }),
    5
  )
  assert.equal(
    partnerEmailWarmupDailyLimit({
      warmup_enabled: true,
      start_limit: 5,
      daily_increment: 5,
      max_limit: 12,
      warmup_day: 4,
    }),
    12
  )
})
