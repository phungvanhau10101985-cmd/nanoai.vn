import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  looksLikeChinaSource,
  scrapedCnyAmount,
  singleImportCost,
  stampScrapedCostCny,
} from './import-cost'
import { productDataToInventoryExcelInsert } from './product-data-to-inventory'

describe('import cost', () => {
  it('reads a scraped yuan amount and rejects labels', () => {
    assert.equal(scrapedCnyAmount('128,00'), 128)
    assert.equal(scrapedCnyAmount('giày tây nam g05'), null)
    assert.equal(scrapedCnyAmount(-1), null)
  })

  it('stamps China yuan without changing the selling price', () => {
    const pd: Record<string, unknown> = {
      origin: '1688',
      link_default: 'https://detail.1688.com/offer/1.html',
      pro_lower_price: '128,00',
      price: 458000,
    }
    stampScrapedCostCny(pd)
    assert.equal(pd.cost_cny, 128)
    assert.equal(pd.price, 458000)
    assert.equal('cost_vnd' in pd, false)
  })

  it('skips the stamp when a Vietnam cost is already set', () => {
    const pd: Record<string, unknown> = {
      origin: '1688',
      pro_lower_price: '10',
      cost_vnd: 150000,
      price: 200000,
    }
    stampScrapedCostCny(pd)
    assert.equal('cost_cny' in pd, false)
    assert.equal(pd.cost_vnd, 150000)
    assert.equal(pd.price, 200000)
  })

  it('does not stamp a non-China source', () => {
    assert.equal(looksLikeChinaSource('Việt Nam', 'https://shop.example/ao'), false)
    const pd: Record<string, unknown> = { origin: 'Việt Nam', pro_lower_price: '10', price: 1 }
    stampScrapedCostCny(pd)
    assert.equal('cost_cny' in pd, false)
  })

  it('refuses both import costs', () => {
    assert.deepEqual(singleImportCost(12, 34000), { costCny: null, costVnd: null, both: true })
    assert.deepEqual(singleImportCost('9,5', ''), { costCny: 9.5, costVnd: null, both: false })
  })

  it('publishes the stamped yuan onto the inventory catalog without touching price', () => {
    const row = productDataToInventoryExcelInsert({
      product_id: 'A953136552117',
      name: 'Áo',
      origin: '1688',
      link_default: 'https://detail.1688.com/offer/1.html',
      pro_lower_price: '128,00',
      price: 458000,
    })
    assert.ok(row)
    assert.equal(row?.catalog?.cost_cny, 128)
    assert.equal(row?.catalog?.write_cost_cny, true)
    assert.equal(row?.catalog?.cost_vnd, null)
    assert.equal(row?.catalog?.catalog_json.price, 458000)
    assert.equal(row?.catalog?.price_low_hint, '128,00')
  })
})
