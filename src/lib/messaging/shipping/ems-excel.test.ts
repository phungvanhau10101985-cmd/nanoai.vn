import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildEmsShipmentSampleXlsx,
  buildCodSettlementSampleXlsx,
  extractOrderCodeFromRecipient,
  isShopOrderCode,
  looksLikeEmsTrackingCode,
  parseEmsExportRows,
} from './ems-excel'
import { parseCodSettlementRows } from './ems-cod-settlement'
import type { PartnerEmsRecord } from './ems-types'
import { accumulateOpsStats, deliveryBucket, hasCod, matchesEmsSyncChip, matchesOpsBucket, periodKey, vnCalendarParts } from './shipping-ops'

function sampleRecord(partial: Partial<PartnerEmsRecord>): PartnerEmsRecord {
  return {
    id: '1',
    partner_id: 'p',
    reference_code: 'EE123456789VN',
    product_code: 'H9441/1/xl',
    recipient_label: 'Nguyen',
    order_code: 'DH131',
    order_id: 'o1',
    excel_row_number: 2,
    order_status: 'shipping',
    shop_return_received_at: null,
    current_step_key: null,
    tracking_number_saved: 'EE123456789VN',
    ems_tracking_code: 'EE123456789VN',
    ems_reference_code: null,
    ems_status: 'Đang vận chuyển',
    ems_phase: 'in_transit',
    sync_status: 'in_progress',
    sync_message: null,
    ems_error: null,
    cod_amount: 150000,
    cod_paid_amount: null,
    cod_paid_date: null,
    cod_settlement_status: null,
    cod_settlement_message: null,
    freight_amount: null,
    freight_settled_at: null,
    freight_settlement_status: null,
    freight_settlement_message: null,
    freight_high_fee_warning: null,
    import_source_filename: 'gui ems.xlsx',
    created_at: '2026-09-01T03:00:00.000Z',
    updated_at: '2026-09-01T03:00:00.000Z',
    ...partial,
  }
}

describe('partner EMS shipping excel/ops', () => {
  it('parses sample gui ems.xlsx rows', () => {
    const sample = buildEmsShipmentSampleXlsx()
    const parsed = parseEmsExportRows(sample.bytes)
    assert.ok(parsed.rows.length >= 2)
    assert.equal(parsed.rows[0].reference_code, 'EE123456789VN')
    assert.equal(parsed.rows[0].order_code, 'DH131')
    assert.equal(parsed.rows[0].cod_amount, 150000)
    assert.equal(parsed.rows[0].product_code.includes('H9441'), true)
  })

  it('extracts DH/DC order codes and EMS tracking', () => {
    assert.equal(extractOrderCodeFromRecipient('Nguyen Van A DH033'), 'DH033')
    assert.equal(isShopOrderCode('DC42'), true)
    assert.equal(looksLikeEmsTrackingCode('EE123456789VN'), true)
    assert.equal(looksLikeEmsTrackingCode('not-a-code'), false)
  })

  it('parses COD settlement sample', () => {
    const sample = buildCodSettlementSampleXlsx()
    const parsed = parseCodSettlementRows(sample.bytes)
    assert.ok(parsed.paymentDate)
    assert.ok(parsed.rows.length >= 1)
    assert.equal(parsed.rows[0].ems_tracking_code, 'EE123456789VN')
    assert.equal(parsed.rows[0].paid_amount, 5200000)
  })

  it('classifies ops buckets and COD unpaid in transit', () => {
    const rec = sampleRecord({})
    assert.equal(deliveryBucket(rec), 'in_transit')
    assert.equal(hasCod(rec), true)
    assert.equal(matchesOpsBucket(rec, 'cod_in_transit_unpaid'), true)
    const stats = accumulateOpsStats([rec])
    assert.equal(stats.total_ems_records, 1)
    assert.equal(stats.in_transit_count, 1)
    assert.equal(stats.cod_in_transit_unpaid_count, 1)
    assert.equal(stats.total_cod_sum, 150000)
  })

  it('uses Vietnam calendar for period keys', () => {
    const d = new Date('2026-09-01T17:00:00.000Z')
    const parts = vnCalendarParts(d)
    assert.equal(parts.y, 2026)
    assert.equal(parts.m, 9)
    assert.equal(parts.d, 2)
    assert.equal(periodKey(d, 'day'), '2026-09-02')
  })

  it('groups unlinked + order_not_found on the unlinked chip', () => {
    assert.equal(matchesEmsSyncChip('unlinked', 'unlinked'), true)
    assert.equal(matchesEmsSyncChip('order_not_found', 'unlinked'), true)
    assert.equal(matchesEmsSyncChip('matched', 'unlinked'), false)
    assert.equal(matchesEmsSyncChip('matched', ''), true)
  })

  it('treats COD matched as received-in-period', () => {
    const rec = sampleRecord({ cod_settlement_status: 'matched', ems_phase: 'delivered', ems_status: 'Phát thành công' })
    assert.equal(matchesOpsBucket(rec, 'cod_received_in_period'), true)
    assert.equal(matchesOpsBucket(rec, 'cod_paid'), true)
  })
})
