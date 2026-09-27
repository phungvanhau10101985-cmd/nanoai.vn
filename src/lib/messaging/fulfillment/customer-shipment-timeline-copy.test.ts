import assert from 'node:assert/strict'
import test from 'node:test'
import {
  publicShipmentStepTitle,
  publicShipmentTimelineFooter,
  publicShipmentTimelineHeading,
  shipmentTimelineVariantFromSteps,
} from './customer-shipment-timeline-copy'

const CHINA_STEPS = [
  'confirmed',
  'tq_preparing',
  'tq_warehouse',
  'international_shipping',
  'at_customs',
  'domestic_shipping',
  'awaiting_confirm',
]

test('china customer timeline uses distinct 188 step titles with the shop name', () => {
  assert.equal(shipmentTimelineVariantFromSteps(CHINA_STEPS), 'china_import')
  assert.equal(publicShipmentTimelineHeading({ locale: 'vi', variant: 'china_import' }), 'Lịch trình Trung Quốc → Việt Nam')
  const titles = CHINA_STEPS.map((stepKey) =>
    publicShipmentStepTitle({
      locale: 'vi',
      shopName: 'Gudo',
      stepKey,
      variant: 'china_import',
      depositFlow: true,
    })
  )
  assert.equal(new Set(titles).size, titles.length)
  assert.deepEqual(titles, [
    'Đã đặt cọc — Gudo đã xác nhận đơn',
    'Gudo TQ đang chuẩn bị & đóng gói hàng',
    'Hàng đã về kho Gudo TQ',
    'Gudo đang vận chuyển quốc tế (TQ → VN)',
    'Gudo đang làm thủ tục tại cửa khẩu',
    'Gudo đã thông quan — hàng về shop để đóng gói',
    'Gudo đã đóng hàng & gửi shipper — chờ bạn xác nhận nhận hàng',
  ])
  assert.match(publicShipmentTimelineFooter({ locale: 'vi', shopName: 'Gudo', variant: 'china_import' }), /Gudo trực tiếp vận hành/)
  assert.doesNotMatch(titles.join('\n'), /188\.com\.vn/)
})

test('vietnam timeline does not reuse the china customs title', () => {
  assert.equal(shipmentTimelineVariantFromSteps(['confirmed', 'vn_picking', 'vn_packed', 'awaiting_confirm']), 'vn_domestic')
  assert.equal(
    publicShipmentStepTitle({
      locale: 'vi',
      shopName: 'Gudo',
      stepKey: 'awaiting_confirm',
      variant: 'vn_domestic',
      depositFlow: false,
    }),
    'Gudo đã gửi shipper — chờ bạn xác nhận nhận hàng'
  )
})
