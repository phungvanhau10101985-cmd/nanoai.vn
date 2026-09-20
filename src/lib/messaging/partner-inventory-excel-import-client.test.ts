import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parsePartnerInventoryExcelImportResponse } from '@/lib/messaging/partner-inventory-excel-import-client'

describe('parsePartnerInventoryExcelImportResponse', () => {
  it('reads 188-style upsert counts from inventory import JSON', () => {
    const data = parsePartnerInventoryExcelImportResponse(
      JSON.stringify({ ok: true, count: 5, inserted: 3, updated: 1, deleted: 1, warnings: [] })
    )
    assert.equal(data.ok, true)
    assert.equal(data.inserted, 3)
    assert.equal(data.updated, 1)
    assert.equal(data.deleted, 1)
  })

  it('returns empty object on invalid JSON', () => {
    const data = parsePartnerInventoryExcelImportResponse('<html>oops</html>')
    assert.deepEqual(data, {})
  })
})
