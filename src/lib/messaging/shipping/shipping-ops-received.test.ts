import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PartnerEmsRecord } from './ems-types'
import {
  buildReceivedTimeline,
  filterRecordsForReceivedPeriod,
  receivedPeriodCalendar,
  receivedPeriodKey,
} from './shipping-ops'

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

describe('received timeline matches 188 actual-receipt axis', () => {
  it('groups COD by EMS payout date and prefers the paid amount', () => {
    const importedSeptemberPaidOctober = sampleRecord({
      id: 'cod',
      created_at: '2026-09-15T03:00:00.000Z',
      cod_amount: 1000,
      cod_paid_amount: 120276000,
      cod_paid_date: '2026-10-02',
      cod_settlement_status: 'matched',
      ems_phase: 'delivered',
      ems_status: 'Phát thành công',
    })
    const stats = buildReceivedTimeline([importedSeptemberPaidOctober], { granularity: 'month' })
    assert.equal(stats.items.length, 1)
    assert.equal(stats.items[0].period_key, '2026-10')
    assert.equal(stats.items[0].period_label, '10/2026')
    assert.equal(stats.items[0].period_start, '2026-10-01')
    assert.equal(stats.items[0].period_end, '2026-10-31')
    assert.equal(stats.items[0].cod_received_count, 1)
    assert.equal(stats.items[0].cod_received_total, 120276000)
    assert.equal(stats.items[0].return_received_count, 0)
    assert.equal(stats.totals.cod_received_count, 1)
    assert.equal(stats.date_field, 'received')
  })

  it('counts an admin-confirmed EMS return on the confirmation date', () => {
    const returned = sampleRecord({
      id: 'ret',
      created_at: '2026-05-01T03:00:00.000Z',
      order_status: 'shipping',
      ems_status: 'Phát hoàn',
      ems_phase: 'in_transit',
      cod_amount: 13807000,
      shop_return_received_at: '2026-06-15T04:00:00.000Z',
    })
    const stats = buildReceivedTimeline([returned], { granularity: 'month' })
    assert.equal(stats.items[0].period_label, '06/2026')
    assert.equal(stats.items[0].period_start, '2026-06-01')
    assert.equal(stats.items[0].period_end, '2026-06-30')
    assert.equal(stats.items[0].return_received_count, 1)
    assert.equal(stats.items[0].return_received_cod_total, 13807000)
    assert.equal(stats.items[0].cod_received_count, 0)
  })

  it('drops delivered waybills, COD already paid to the shop, and shop-order status alone', () => {
    const deliveredStamp = sampleRecord({
      id: 'delivered',
      ems_status: 'Phát hoàn',
      ems_phase: 'delivered',
      shop_return_received_at: '2026-08-02T03:00:00.000Z',
    })
    const codPaid = sampleRecord({
      id: 'paid',
      ems_status: 'Chuyển hoàn',
      ems_phase: 'in_transit',
      cod_settlement_status: 'matched',
      cod_paid_date: '2026-08-03',
      cod_paid_amount: 5000,
      shop_return_received_at: '2026-08-04T03:00:00.000Z',
    })
    const orderStatusOnly = sampleRecord({
      id: 'order',
      order_status: 'returned',
      ems_status: 'Phát hoàn',
      shop_return_received_at: null,
    })
    const codCollected = sampleRecord({
      id: 'collected',
      ems_phase: 'cod_collected',
      ems_status: '[COD] Đã thu tiền',
      shop_return_received_at: '2026-08-05T03:00:00.000Z',
    })
    const notReturnText = sampleRecord({
      id: 'transit',
      ems_status: 'Đang vận chuyển',
      shop_return_received_at: '2026-08-06T03:00:00.000Z',
    })
    const stats = buildReceivedTimeline([deliveredStamp, codPaid, orderStatusOnly, codCollected, notReturnText], {
      granularity: 'month',
    })
    const august = stats.items.find((item) => item.period_key === '2026-08')
    assert.equal(august?.return_received_count || 0, 0)
    assert.equal(stats.totals.return_received_count, 0)
    assert.equal(stats.totals.cod_received_count, 1)
    assert.equal(stats.totals.cod_received_total, 5000)
  })

  it('lists one period and the displayed span the same way the total row does', () => {
    const june = sampleRecord({
      id: 'june',
      cod_settlement_status: 'matched',
      cod_paid_date: '2026-06-02',
      cod_paid_amount: 10,
      ems_status: 'Phát thành công',
      ems_phase: 'delivered',
    })
    const october = sampleRecord({
      id: 'oct',
      cod_settlement_status: 'matched',
      cod_paid_date: '2026-10-20',
      cod_paid_amount: 20,
      ems_status: 'Phát thành công',
      ems_phase: 'delivered',
    })
    const rows = [june, october]
    const octoberOnly = filterRecordsForReceivedPeriod(rows, 'cod_received_in_period', {
      granularity: 'month',
      periodKey: '2026-10',
    })
    assert.deepEqual(octoberOnly.map((row) => row.id), ['oct'])
    const span = filterRecordsForReceivedPeriod(rows, 'cod_received_in_period', {
      granularity: 'month',
      dateFrom: '2026-06-01',
      dateTo: '2026-10-31',
    })
    assert.deepEqual(span.map((row) => row.id).sort(), ['june', 'oct'])
    const weekKey = receivedPeriodKey(new Date('2026-10-01T00:00:00+07:00'), 'week')
    const week = receivedPeriodCalendar(weekKey, 'week')
    assert.equal(weekKey, '2026-W40')
    assert.equal(week.label, 'Tuần 40/2026')
    assert.equal(week.startYmd, '2026-09-28')
    assert.equal(week.endYmd, '2026-10-04')
  })
})
