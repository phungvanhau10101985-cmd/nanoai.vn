import * as XLSX from 'xlsx'
import type { PartnerOrderAdminRow } from '@/lib/db/messaging-partner-orders-pg'

function paymentStatusVi(s: PartnerOrderAdminRow['status']): string {
  if (s === 'awaiting_payment') return 'Chờ thanh toán'
  if (s === 'payment_checking') return 'Đang đối chiếu'
  if (s === 'paid_verified') return 'Đã xác nhận thanh toán'
  if (s === 'pending_manual_review') return 'Cần duyệt tay'
  return 'Đã hủy'
}

function shippingStatusVi(s: PartnerOrderAdminRow['shipping_status']): string {
  if (s === 'pending') return 'Chờ xác nhận'
  if (s === 'confirmed') return 'Đã xác nhận đơn'
  if (s === 'packing') return 'Đang đóng gói'
  if (s === 'shipping') return 'Đang giao hàng'
  if (s === 'delivered') return 'Đã giao'
  if (s === 'returned') return 'Hoàn/Trả hàng'
  return 'Đã hủy (GH)'
}

function proofStatusVi(s: PartnerOrderAdminRow['latest_proof_status']): string {
  if (s === 'verified') return 'Khớp'
  if (s === 'manual_review') return 'Cần duyệt tay'
  if (s === 'failed') return 'Không khớp'
  if (s === 'pending') return 'Chờ xử lý'
  return ''
}

/** Tạo buffer .xlsx — một sheet «Đơn hàng». */
export function buildPartnerOrdersXlsxBuffer(rows: PartnerOrderAdminRow[]): Buffer {
  const header: string[] = [
    'Mã đơn (id)',
    'Mã thanh toán / CK',
    'Workspace',
    'Trạng thái thanh toán',
    'Trạng thái giao hàng',
    'Tên khách',
    'Email',
    'SĐT',
    'Địa chỉ giao hàng',
    'Màu',
    'Size',
    'Số lượng',
    'Tên sản phẩm',
    'Đơn giá',
    'Tạm tính',
    '% cọc',
    'Số tiền cần thanh toán',
    'Đã ghi nhận thanh toán',
    'Tiền tệ',
    'Ghi chú khách',
    'Ghi chú xác minh (shop)',
    'Link sản phẩm',
    'URL ảnh chứng từ gần nhất',
    'Trạng thái chứng từ',
    'Lý do chứng từ',
    'Đã khóa đơn',
    'Tạo lúc',
    'Cập nhật',
    'Xác minh lúc',
  ]

  const data = rows.map((r) => [
    r.id,
    r.payment_reference,
    r.partner_display_name,
    paymentStatusVi(r.status),
    shippingStatusVi(r.shipping_status),
    r.customer_name,
    r.customer_email,
    r.customer_phone,
    r.shipping_address,
    r.variant_color,
    r.variant_size,
    r.quantity,
    r.product_name,
    r.unit_price,
    r.subtotal_amount,
    r.deposit_percent,
    r.required_amount,
    r.paid_amount,
    r.currency,
    r.note,
    r.verified_note,
    r.product_url,
    r.latest_proof_image_url ?? '',
    proofStatusVi(r.latest_proof_status),
    r.latest_proof_reason ?? '',
    r.locked_at ? 'Có' : 'Không',
    r.created_at,
    r.updated_at,
    r.verified_at ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Don hang')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
