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
    assert.equal(pd.cost_vnd, null)
    assert.equal(pd.price, 458000)
  })

  it('keeps yuan for China and drops a stored dong conversion', () => {
    const pd: Record<string, unknown> = {
      origin: '1688',
      link_default: 'https://detail.1688.com/offer/1.html',
      pro_lower_price: '10',
      cost_vnd: 150000,
      price: 200000,
    }
    stampScrapedCostCny(pd)
    assert.equal(pd.cost_cny, 10)
    assert.equal(pd.cost_vnd, null)
    assert.equal(pd.price, 200000)
  })

  it('does not convert yuan into the Vietnam column', () => {
    assert.equal(looksLikeChinaSource('Việt Nam', 'https://shop.example/ao'), false)
    const pd: Record<string, unknown> = {
      origin: 'Việt Nam',
      pro_lower_price: '10',
      cost_vnd: 90000,
      price: 1,
    }
    stampScrapedCostCny(pd)
    assert.equal(pd.cost_cny, null)
    assert.equal(pd.cost_vnd, 90000)
  })

  it('keeps both original-price columns', () => {
    assert.deepEqual(singleImportCost(12, 34000), { costCny: 12, costVnd: 34000, both: true })
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
    assert.equal(row?.catalog?.write_cost_vnd, true)
    assert.equal(row?.catalog?.catalog_json.price, 458000)
    assert.equal(row?.catalog?.price_low_hint, '128,00')
  })
})
