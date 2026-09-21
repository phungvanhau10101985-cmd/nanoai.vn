import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('EMS COD settlement lifecycle isolation', () => {
  it('reconciles carrier money without marking an order delivered', () => {
    const source = readFileSync(new URL('./ems-cod-settlement.ts', import.meta.url), 'utf8')
    assert.doesNotMatch(source, /messaging_partner_orders/)
    assert.doesNotMatch(source, /shipping_status/)
    assert.doesNotMatch(source, /runPartnerOrderDeliveredHook|runPartnerOrderLifecycleHook/)
    assert.match(source, /applyPartnerEmsCodSettlementFromPg/)
  })
})
