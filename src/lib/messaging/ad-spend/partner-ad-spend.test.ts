import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AdSpendApiError,
  aggregateMetricRows,
  combineAdSpendTotals,
  emptyPlatform,
  googleConfigured,
  normalizeAdAccountId,
  normalizeCustomerId,
  parseAdSpendDateRange,
} from './partner-ad-spend'

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
        { date: '2026-10-01', spend_micros: 1_500_000, impressions: 10, clicks: 2, campaign_id: '1', campaign_name: 'A', currency: 'VND' },
        { date: '2026-10-01', spend_micros: 500_000, impressions: 4, clicks: 1, campaign_id: '1', campaign_name: 'A', currency: 'VND' },
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
    assert.equal(sheet.daily[0]?.clicks, 3)
    assert.equal(sheet.campaigns[0]?.name, 'A')
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
      googleConfigured({
        googleDeveloperToken: 'd',
        googleClientId: 'c',
        googleClientSecret: 's',
        googleRefreshToken: 'r',
        googleCustomerId: '1',
        googleLoginCustomerId: '',
        metaAccessToken: '',
        metaAdAccountId: '',
      }),
      true,
    )
  })
})
