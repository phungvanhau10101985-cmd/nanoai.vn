import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  AdSpendApiError,
  aggregateMetricRows,
  buildServiceAccountAssertion,
  combineAdSpendTotals,
  emptyPlatform,
  googleConfigured,
  metaPurchaseAmount,
  normalizeAdAccountId,
  normalizeCustomerId,
  parseAdSpendDateRange,
  parseGoogleServiceAccountJson,
  type AdSpendCredentials,
} from './partner-ad-spend'

const blank: AdSpendCredentials = {
  googleDeveloperToken: '',
  googleClientId: '',
  googleClientSecret: '',
  googleRefreshToken: '',
  googleCustomerId: '',
  googleLoginCustomerId: '',
  googleServiceAccountJson: '',
  metaAccessToken: '',
  metaAdAccountId: '',
}

describe('partner ad spend', () => {
  it('keeps only digits on Google and Meta account ids', () => {
    assert.equal(normalizeCustomerId('123-456-7890'), '1234567890')
    assert.equal(normalizeAdAccountId('act_998877'), '998877')
  })

  it('rejects an inverted or oversized date range', () => {
    assert.throws(() => parseAdSpendDateRange('2026-02-02', '2026-02-01'), AdSpendApiError)
    assert.throws(() => parseAdSpendDateRange('2024-01-01', '2026-01-01'), AdSpendApiError)
    assert.deepEqual(parseAdSpendDateRange('2026-10-01', '2026-10-01'), { start: '2026-10-01', end: '2026-10-01' })
  })

  it('sums micros into daily spend and campaigns', () => {
    const sheet = aggregateMetricRows(
      [
        { date: '2026-10-02', spend_micros: 1_500_000, impressions: 10, clicks: 2, conversions: '1.5', conversion_value: 40_000, campaign_id: '1', campaign_name: 'A', currency: 'VND' },
        { date: '2026-10-01', spend_micros: 500_000, impressions: 4, clicks: 1, conversions: 1, conversion_value: '10000', campaign_id: '1', campaign_name: 'A', currency: 'VND' },
      ],
      {
        dateKey: 'date',
        spendKey: 'spend_micros',
        impressionsKey: 'impressions',
        clicksKey: 'clicks',
        campaignIdKey: 'campaign_id',
        campaignNameKey: 'campaign_name',
        currencyKey: 'currency',
        spendIsMicros: true,
      },
    )
    assert.equal(sheet.spend, 2)
    assert.equal(sheet.currency, 'VND')
    assert.equal(sheet.clicks, 3)
    assert.equal(sheet.conversions, 2.5)
    assert.equal(sheet.conversionValue, 50_000)
    assert.equal(sheet.daily[0]?.date, '2026-10-02')
    assert.equal(sheet.daily[0]?.conversions, 1.5)
    assert.equal(sheet.campaigns[0]?.name, 'A')
    assert.equal(sheet.campaigns[0]?.conversionValue, 50_000)
  })

  it('counts one Meta purchase even when several action types repeat it', () => {
    const actions = [
      { action_type: 'link_click', value: '80' },
      { action_type: 'omni_purchase', value: '4' },
      { action_type: 'purchase', value: '4' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '3' },
    ]
    assert.equal(metaPurchaseAmount(actions), 4)
    assert.equal(
      metaPurchaseAmount([
        { action_type: 'omni_purchase', value: '900000' },
        { action_type: 'purchase', value: '900000' },
      ]),
      900_000,
    )
    assert.equal(metaPurchaseAmount([{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' }]), 2)
    assert.equal(metaPurchaseAmount(null), 0)
  })

  it('adds Google and Facebook only when both succeed in one currency', () => {
    const google = { ...emptyPlatform(true), ok: true, currency: 'VND', spend: 100 }
    const facebook = { ...emptyPlatform(true), ok: true, currency: 'VND', spend: 40 }
    assert.equal(combineAdSpendTotals({ google, facebook, googleConfigured: true, facebookConfigured: true }).totalSpend, 140)
    const usd = { ...facebook, currency: 'USD' }
    assert.equal(
      combineAdSpendTotals({ google, facebook: usd, googleConfigured: true, facebookConfigured: true }).totalStatus,
      'mixed_currency',
    )
  })

  it('treats a single configured platform as the whole total', () => {
    const google = { ...emptyPlatform(true), ok: true, currency: 'VND', spend: 80 }
    const facebook = emptyPlatform(false)
    const total = combineAdSpendTotals({ google, facebook, googleConfigured: true, facebookConfigured: false })
    assert.equal(total.totalStatus, 'ok')
    assert.equal(total.totalSpend, 80)
    assert.equal(
      googleConfigured({ ...blank, googleClientId: 'c', googleClientSecret: 's', googleRefreshToken: 'r', googleCustomerId: '1' }),
      true,
    )
  })

  it('accepts a service account without developer token or OAuth client', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const json = JSON.stringify({
      type: 'service_account',
      client_email: 'reader@demo.iam.gserviceaccount.com',
      private_key_id: 'kid1',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    })
    assert.equal(googleConfigured({ ...blank, googleCustomerId: '1', googleServiceAccountJson: json }), true)
    assert.equal(googleConfigured({ ...blank, googleServiceAccountJson: json }), false)
    assert.equal(parseGoogleServiceAccountJson('{"client_email":"x@y"}'), null)
    assert.equal(parseGoogleServiceAccountJson('not json'), null)
  })

  it('signs a JWT assertion Google can verify with the public key', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const key = parseGoogleServiceAccountJson(
      JSON.stringify({
        client_email: 'reader@demo.iam.gserviceaccount.com',
        private_key_id: 'kid1',
        private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      }),
    )
    assert.ok(key)
    const jwt = buildServiceAccountAssertion(key, 1_000)
    const [head, body, sig] = jwt.split('.')
    assert.equal(JSON.parse(Buffer.from(head!, 'base64url').toString()).kid, 'kid1')
    const claims = JSON.parse(Buffer.from(body!, 'base64url').toString())
    assert.equal(claims.iss, 'reader@demo.iam.gserviceaccount.com')
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/adwords')
    assert.equal(claims.exp, 4_600)
    assert.equal(verify('RSA-SHA256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(sig!, 'base64url')), true)
  })
})
