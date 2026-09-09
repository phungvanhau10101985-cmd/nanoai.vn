import type { PartnerEmsRecord } from '@/lib/messaging/shipping/ems-types'
import type { OpsBucketKey } from '@/lib/messaging/shipping/ems-types'

const EMS_DELIVERED_PHASES = new Set(['delivered', 'cod_collected', 'cod_settled'])
const EMS_IN_TRANSIT_PHASES = new Set(['posted', 'in_transit', 'out_for_delivery'])

export const RETURN_PENDING_SHOP_LABEL = 'Đơn hoàn chưa trả shop'
export const RETURN_SHOP_RECEIVED_LABEL = 'Đơn hoàn đã trả shop'

export function isShopReturnReceived(orderStatus: string | null | undefined): boolean {
  return (orderStatus || '').trim().toLowerCase() === 'returned'
}

export function isEmsRecordShopReturnReceived(record: Pick<PartnerEmsRecord, 'shop_return_received_at' | 'order_status'>): boolean {
  if (record.shop_return_received_at) return true
  return isShopReturnReceived(record.order_status)
}

export function isEmsReturnPendingShop(emsStatus: string | null | undefined): boolean {
  const text = (emsStatus || '').toLowerCase()
  if (!text) return false
  const markers = [
    'phát hoàn',
    'chuyển hoàn',
    'hoàn cho người gửi',
    'từ chối nhận hàng',
    'return to sender',
    'returned',
  ]
  return markers.some((m) => text.includes(m))
}

export function returnToShopLabel(input: {
  orderStatus?: string | null
  emsStatus?: string | null
  shopReturnReceivedAt?: string | null
}): string | null {
  if (input.shopReturnReceivedAt || isShopReturnReceived(input.orderStatus)) return RETURN_SHOP_RECEIVED_LABEL
  if (isEmsReturnPendingShop(input.emsStatus)) return RETURN_PENDING_SHOP_LABEL
  return null
}

export function isEmsDelivered(emsPhase: string | null | undefined, emsStatus: string | null | undefined): boolean {
  const phase = (emsPhase || '').trim().toLowerCase()
  if (EMS_DELIVERED_PHASES.has(phase)) return true
  const text = (emsStatus || '').toLowerCase()
  const compact = text.replace(/\s+/g, '')
  if (compact.includes('[cod]đãthutiền') || compact.includes('đãthutiềnbưutá')) return true
  if (compact.includes('[cod]trảtiền') || compact.includes('trảtiềnchongườigửi')) return true
  return text.includes('phát thành công') && !text.includes('phát hoàn')
}

export function isEmsInTransit(emsPhase: string | null | undefined, emsStatus: string | null | undefined): boolean {
  const phase = (emsPhase || '').trim().toLowerCase()
  if (EMS_IN_TRANSIT_PHASES.has(phase)) return true
  const text = (emsStatus || '').toLowerCase()
  return ['vận chuyển', 'giao bưu tá', 'đến bưu cục', 'chấp nhận gửi', 'out for delivery'].some((m) =>
    text.includes(m),
  )
}

export type DeliveryBucket = 'return_pending_shop' | 'return_shop_received' | 'delivered' | 'in_transit' | 'pending'

export function deliveryBucket(record: PartnerEmsRecord): DeliveryBucket {
  if (isEmsRecordShopReturnReceived(record)) return 'return_shop_received'
  if (isEmsReturnPendingShop(record.ems_status)) return 'return_pending_shop'
  if (isEmsDelivered(record.ems_phase, record.ems_status)) return 'delivered'
  if ((record.cod_settlement_status || '').trim().toLowerCase() === 'matched') return 'delivered'
  if (isEmsInTransit(record.ems_phase, record.ems_status)) return 'in_transit'
  return 'pending'
}

export function hasCod(record: Pick<PartnerEmsRecord, 'cod_amount'>): boolean {
  return record.cod_amount != null && Number(record.cod_amount) > 0
}

export function recordCodAmount(record: Pick<PartnerEmsRecord, 'cod_amount'>): number {
  return Math.max(0, Math.round(Number(record.cod_amount || 0)))
}

export function isCodPaid(record: Pick<PartnerEmsRecord, 'cod_settlement_status'>): boolean {
  return (record.cod_settlement_status || '').trim().toLowerCase() === 'matched'
}

export function matchesOpsBucket(record: PartnerEmsRecord, bucket: OpsBucketKey): boolean {
  const d = deliveryBucket(record)
  const cod = hasCod(record)
  const paid = isCodPaid(record)
  switch (bucket) {
    case 'total':
      return true
    case 'in_transit':
      return d === 'in_transit'
    case 'delivered':
      return d === 'delivered'
    case 'returned':
      return d === 'return_pending_shop'
    case 'shop_return_received':
      return d === 'return_shop_received'
    case 'pending':
      return d === 'pending'
    case 'has_cod':
      return cod
    case 'cod_in_transit_unpaid':
      return cod && !paid && d === 'in_transit'
    case 'cod_delivered_unpaid':
      return cod && !paid && d === 'delivered'
    case 'cod_paid':
      return cod && paid
    case 'cod_returned_unpaid':
      return cod && !paid && (d === 'return_pending_shop' || d === 'return_shop_received')
    case 'cod_pending_unpaid':
      return cod && !paid && d === 'pending'
    case 'freight_unsettled':
      return record.freight_settlement_status !== 'settled' && record.freight_settlement_status !== 'already_settled'
    case 'shop_linked':
      return Boolean(record.order_id || record.order_code)
    case 'shop_shipping':
      return (record.shop_order_status || record.order_status || '').toLowerCase() === 'shipping'
    case 'cod_received_in_period':
      return paid
    default:
      return false
  }
}

/** Chip «Chưa ghép đơn» gộp unlinked + order_not_found — cùng SQL list EMS. */
export function matchesEmsSyncChip(status: string, chip: string): boolean {
  if (!chip || chip === 'all') return true
  if (chip === 'unlinked') return status === 'unlinked' || status === 'order_not_found'
  return status === chip
}

export function emptyOpsStats() {
  return {
    total_ems_records: 0,
    total_with_cod: 0,
    in_transit_count: 0,
    delivered_count: 0,
    returned_count: 0,
    return_shop_received_count: 0,
    pending_status_count: 0,
    shop_return_received_count: 0,
    shop_linked_count: 0,
    freight_unsettled_count: 0,
    shop_shipping_orders: 0,
    shop_delivered_orders: 0,
    shop_returned_orders: 0,
    shipping_orders: 0,
    delivered_success_orders: 0,
    returned_orders: 0,
    total_cod_sum: 0,
    total_cod_amount: 0,
    in_transit_cod_total: 0,
    delivered_cod_total: 0,
    returned_cod_total: 0,
    return_shop_received_cod_total: 0,
    pending_cod_total: 0,
    cod_in_transit_unpaid_count: 0,
    cod_delivered_unpaid_count: 0,
    cod_paid_count: 0,
    cod_returned_unpaid_count: 0,
    cod_pending_unpaid_count: 0,
    cod_in_transit_unpaid_total: 0,
    cod_delivered_unpaid_total: 0,
    cod_paid_total: 0,
    cod_returned_unpaid_total: 0,
    cod_pending_unpaid_total: 0,
    cod_success_unpaid_count: 0,
    cod_success_unpaid_total: 0,
    cod_success_paid_count: 0,
    cod_success_paid_total: 0,
    shipping_cod_unpaid_count: 0,
  }
}

export function accumulateOpsStats(records: PartnerEmsRecord[]) {
  const stats = emptyOpsStats()
  stats.total_ems_records = records.length
  for (const record of records) {
    const d = deliveryBucket(record)
    const amount = recordCodAmount(record)
    const cod = hasCod(record)
    const paid = isCodPaid(record)
    if (cod) {
      stats.total_with_cod += 1
      stats.total_cod_sum += amount
      stats.total_cod_amount += amount
    }
    if (d === 'in_transit') {
      stats.in_transit_count += 1
      stats.in_transit_cod_total += amount
      stats.shipping_orders += 1
    } else if (d === 'delivered') {
      stats.delivered_count += 1
      stats.delivered_cod_total += amount
      stats.delivered_success_orders += 1
    } else if (d === 'return_pending_shop') {
      stats.returned_count += 1
      stats.returned_cod_total += amount
      stats.returned_orders += 1
    } else if (d === 'return_shop_received') {
      stats.return_shop_received_count += 1
      stats.shop_return_received_count += 1
      stats.return_shop_received_cod_total += amount
    } else {
      stats.pending_status_count += 1
      stats.pending_cod_total += amount
    }
    if (record.order_id || record.order_code) stats.shop_linked_count += 1
    if (record.freight_settlement_status !== 'settled' && record.freight_settlement_status !== 'already_settled') {
      stats.freight_unsettled_count += 1
    }
    const shopStatus = (record.shop_order_status || record.order_status || '').toLowerCase()
    if (shopStatus === 'shipping') stats.shop_shipping_orders += 1
    if (shopStatus === 'delivered') stats.shop_delivered_orders += 1
    if (shopStatus === 'returned') stats.shop_returned_orders += 1
    if (cod && !paid && d === 'in_transit') {
      stats.cod_in_transit_unpaid_count += 1
      stats.cod_in_transit_unpaid_total += amount
      stats.shipping_cod_unpaid_count += 1
    }
    if (cod && !paid && d === 'delivered') {
      stats.cod_delivered_unpaid_count += 1
      stats.cod_delivered_unpaid_total += amount
      stats.cod_success_unpaid_count += 1
      stats.cod_success_unpaid_total += amount
    }
    if (cod && paid) {
      stats.cod_paid_count += 1
      stats.cod_paid_total += amount
      stats.cod_success_paid_count += 1
      stats.cod_success_paid_total += amount
    }
    if (cod && !paid && (d === 'return_pending_shop' || d === 'return_shop_received')) {
      stats.cod_returned_unpaid_count += 1
      stats.cod_returned_unpaid_total += amount
    }
    if (cod && !paid && d === 'pending') {
      stats.cod_pending_unpaid_count += 1
      stats.cod_pending_unpaid_total += amount
    }
  }
  return stats
}

function vnDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** Lịch VN (UTC+7) từ instant — không phụ thuộc TZ process. */
export function vnCalendarParts(date: Date): { y: number; m: number; d: number; weekday: number } {
  const vn = new Date(date.getTime() + 7 * 3600_000)
  return {
    y: vn.getUTCFullYear(),
    m: vn.getUTCMonth() + 1,
    d: vn.getUTCDate(),
    weekday: vn.getUTCDay() || 7,
  }
}

export function periodKey(date: Date, granularity: 'year' | 'month' | 'week' | 'day'): string {
  const { y, m, d, weekday } = vnCalendarParts(date)
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  if (granularity === 'year') return String(y)
  if (granularity === 'month') return `${y}-${mm}`
  if (granularity === 'day') return `${y}-${mm}-${dd}`
  const monday = new Date(Date.UTC(y, m - 1, d) - (weekday - 1) * 86400_000)
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`
}

export function periodLabel(key: string, granularity: 'year' | 'month' | 'week' | 'day'): string {
  if (granularity === 'year') return `Năm ${key}`
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    return `Tháng ${Number(m)}/${y}`
  }
  if (granularity === 'week') return `Tuần ${key}`
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

export function recordPeriodDate(record: PartnerEmsRecord): Date | null {
  return vnDate(record.created_at)
}

export function recordCodPaidDate(record: PartnerEmsRecord): Date | null {
  if (!record.cod_paid_date) return null
  const d = new Date(`${record.cod_paid_date}T00:00:00+07:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function recordShopReturnReceivedDate(record: PartnerEmsRecord): Date | null {
  return vnDate(record.shop_return_received_at)
}

export type TimelineGranularity = 'year' | 'month' | 'week' | 'day'
export type TimelinePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month'

const TIMELINE_DEFAULT_LIMITS: Record<TimelineGranularity, number> = {
  year: 12,
  month: 24,
  week: 16,
  day: 31,
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function vnTodayParts(): { y: number; m: number; d: number; weekday: number } {
  return vnCalendarParts(new Date())
}

function dateFromVnParts(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d) - 7 * 3600_000)
}

export function periodBounds(key: string, granularity: TimelineGranularity): { start: Date; end: Date } {
  if (granularity === 'year') {
    const y = Number(key)
    return { start: dateFromVnParts(y, 1, 1), end: dateFromVnParts(y + 1, 1, 1) }
  }
  if (granularity === 'month') {
    const [ys, ms] = key.split('-')
    const y = Number(ys)
    const m = Number(ms)
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    return { start: dateFromVnParts(y, m, 1), end: dateFromVnParts(nextY, nextM, 1) }
  }
  if (granularity === 'day') {
    const [ys, ms, ds] = key.split('-')
    const start = dateFromVnParts(Number(ys), Number(ms), Number(ds))
    return { start, end: new Date(start.getTime() + 86400_000) }
  }
  const [ys, ms, ds] = key.split('-')
  const start = dateFromVnParts(Number(ys), Number(ms), Number(ds))
  return { start, end: new Date(start.getTime() + 7 * 86400_000) }
}

export function resolveTimelineFilter(input: {
  preset?: string | null
  year?: number | null
  dateFrom?: string | null
  dateTo?: string | null
}): { start: Date | null; end: Date | null; label: string | null } {
  const preset = (input.preset || '').trim().toLowerCase()
  const today = vnTodayParts()
  if (preset === 'this_week') {
    const mondayKey = periodKey(new Date(), 'week')
    const { start, end } = periodBounds(mondayKey, 'week')
    return { start, end, label: 'Tuần này' }
  }
  if (preset === 'last_week') {
    const thisMonday = periodBounds(periodKey(new Date(), 'week'), 'week').start
    const lastMonday = new Date(thisMonday.getTime() - 7 * 86400_000)
    const { start, end } = periodBounds(periodKey(lastMonday, 'week'), 'week')
    return { start, end, label: 'Tuần trước' }
  }
  if (preset === 'this_month') {
    const key = `${today.y}-${pad2(today.m)}`
    const { start, end } = periodBounds(key, 'month')
    return { start, end, label: `Tháng ${today.m}/${today.y}` }
  }
  if (preset === 'last_month') {
    const m = today.m === 1 ? 12 : today.m - 1
    const y = today.m === 1 ? today.y - 1 : today.y
    const { start, end } = periodBounds(`${y}-${pad2(m)}`, 'month')
    return { start, end, label: `Tháng ${m}/${y}` }
  }
  if (input.year && Number.isFinite(input.year)) {
    const y = Math.floor(Number(input.year))
    const { start, end } = periodBounds(String(y), 'year')
    return { start, end, label: `Năm ${y}` }
  }
  const from = input.dateFrom ? vnDate(`${input.dateFrom}T00:00:00+07:00`) : null
  const toRaw = input.dateTo ? vnDate(`${input.dateTo}T00:00:00+07:00`) : null
  const to = toRaw ? new Date(toRaw.getTime() + 86400_000) : null
  if (from || to) {
    return {
      start: from,
      end: to,
      label: [input.dateFrom, input.dateTo].filter(Boolean).join(' → ') || null,
    }
  }
  return { start: null, end: null, label: null }
}

function inRange(d: Date | null, start: Date | null, end: Date | null): boolean {
  if (!d) return false
  if (start && d < start) return false
  if (end && d >= end) return false
  return true
}

function emptyTimelineBucket() {
  return {
    total: 0,
    in_transit_count: 0,
    delivered_count: 0,
    returned_count: 0,
    return_shop_received_count: 0,
    pending_status_count: 0,
    total_cod_sum: 0,
    in_transit_cod_total: 0,
    delivered_cod_total: 0,
    returned_cod_total: 0,
    return_shop_received_cod_total: 0,
    pending_cod_total: 0,
    total_with_cod: 0,
    cod_in_transit_unpaid_count: 0,
    cod_in_transit_unpaid_total: 0,
    cod_delivered_unpaid_count: 0,
    cod_delivered_unpaid_total: 0,
    cod_returned_unpaid_count: 0,
    cod_returned_unpaid_total: 0,
    cod_paid_count: 0,
    total_cod_amount: 0,
    cod_paid_total: 0,
  }
}

function addTimelineRecord(bucket: ReturnType<typeof emptyTimelineBucket>, record: PartnerEmsRecord) {
  const stats = accumulateOpsStats([record])
  bucket.total += 1
  bucket.in_transit_count += stats.in_transit_count
  bucket.delivered_count += stats.delivered_count
  bucket.returned_count += stats.returned_count
  bucket.return_shop_received_count += stats.return_shop_received_count
  bucket.pending_status_count += stats.pending_status_count
  bucket.total_cod_sum += stats.total_cod_sum
  bucket.in_transit_cod_total += stats.in_transit_cod_total
  bucket.delivered_cod_total += stats.delivered_cod_total
  bucket.returned_cod_total += stats.returned_cod_total
  bucket.return_shop_received_cod_total += stats.return_shop_received_cod_total
  bucket.pending_cod_total += stats.pending_cod_total
  bucket.total_with_cod += stats.total_with_cod
  bucket.cod_in_transit_unpaid_count += stats.cod_in_transit_unpaid_count
  bucket.cod_in_transit_unpaid_total += stats.cod_in_transit_unpaid_total
  bucket.cod_delivered_unpaid_count += stats.cod_delivered_unpaid_count
  bucket.cod_delivered_unpaid_total += stats.cod_delivered_unpaid_total
  bucket.cod_returned_unpaid_count += stats.cod_returned_unpaid_count
  bucket.cod_returned_unpaid_total += stats.cod_returned_unpaid_total
  bucket.cod_paid_count += stats.cod_paid_count
  bucket.total_cod_amount += stats.total_cod_amount
  bucket.cod_paid_total += stats.cod_paid_total
}

export function buildImportTimeline(records: PartnerEmsRecord[], input: {
  granularity?: string
  limit?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  preset?: string | null
  year?: number | null
}) {
  const granularity = ((input.granularity || 'month').trim().toLowerCase() || 'month') as TimelineGranularity
  if (!['year', 'month', 'week', 'day'].includes(granularity)) {
    throw new Error('granularity phải là year, month, week hoặc day.')
  }
  const filter = resolveTimelineFilter(input)
  const maxItems = Math.max(1, Math.min(200, Math.floor(input.limit ?? TIMELINE_DEFAULT_LIMITS[granularity])))
  const grouped = new Map<string, ReturnType<typeof emptyTimelineBucket>>()
  const years = new Set<number>()
  for (const record of records) {
    const recDate = recordPeriodDate(record)
    if (!recDate) continue
    years.add(vnCalendarParts(recDate).y)
    if (!inRange(recDate, filter.start, filter.end)) continue
    const key = periodKey(recDate, granularity)
    if (!grouped.has(key)) grouped.set(key, emptyTimelineBucket())
    addTimelineRecord(grouped.get(key)!, record)
  }
  const keys = [...grouped.keys()].sort().reverse().slice(0, maxItems)
  const totals = emptyTimelineBucket()
  const items = keys.map((key) => {
    const bucket = grouped.get(key)!
    for (const field of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[field] += bucket[field]
    }
    const { start, end } = periodBounds(key, granularity)
    return {
      period_key: key,
      period_label: periodLabel(key, granularity),
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      ...bucket,
    }
  })
  return {
    granularity,
    timezone: 'Asia/Ho_Chi_Minh',
    date_field: 'created_at',
    limit: maxItems,
    filter_from: filter.start?.toISOString() ?? null,
    filter_to: filter.end?.toISOString() ?? null,
    filter_label: filter.label,
    preset: (input.preset || '').trim().toLowerCase() || null,
    year: input.year != null ? Number(input.year) : null,
    available_years: [...years].sort((a, b) => b - a),
    items,
    totals,
  }
}

export function buildReceivedTimeline(records: PartnerEmsRecord[], input: {
  granularity?: string
  limit?: number | null
  dateFrom?: string | null
  dateTo?: string | null
  preset?: string | null
  year?: number | null
}) {
  const granularity = ((input.granularity || 'month').trim().toLowerCase() || 'month') as TimelineGranularity
  if (!['year', 'month', 'week', 'day'].includes(granularity)) {
    throw new Error('granularity phải là year, month, week hoặc day.')
  }
  const filter = resolveTimelineFilter(input)
  const maxItems = Math.max(1, Math.min(200, Math.floor(input.limit ?? TIMELINE_DEFAULT_LIMITS[granularity])))
  const grouped = new Map<string, { cod_received_count: number; cod_received_total: number; return_received_count: number; return_received_cod_total: number }>()
  const years = new Set<number>()
  const ensure = (key: string) => {
    if (!grouped.has(key)) {
      grouped.set(key, { cod_received_count: 0, cod_received_total: 0, return_received_count: 0, return_received_cod_total: 0 })
    }
    return grouped.get(key)!
  }
  for (const record of records) {
    if (isCodPaid(record)) {
      const paid = recordCodPaidDate(record)
      if (paid) {
        years.add(vnCalendarParts(paid).y)
        if (inRange(paid, filter.start, filter.end)) {
          const b = ensure(periodKey(paid, granularity))
          b.cod_received_count += 1
          b.cod_received_total += Math.max(0, Math.round(Number(record.cod_paid_amount || record.cod_amount || 0)))
        }
      }
    }
    const recv = recordShopReturnReceivedDate(record)
    if (recv) {
      years.add(vnCalendarParts(recv).y)
      if (inRange(recv, filter.start, filter.end)) {
        const b = ensure(periodKey(recv, granularity))
        b.return_received_count += 1
        b.return_received_cod_total += recordCodAmount(record)
      }
    }
  }
  const keys = [...grouped.keys()].sort().reverse().slice(0, maxItems)
  const totals = { cod_received_count: 0, cod_received_total: 0, return_received_count: 0, return_received_cod_total: 0 }
  const items = keys.map((key) => {
    const bucket = grouped.get(key)!
    totals.cod_received_count += bucket.cod_received_count
    totals.cod_received_total += bucket.cod_received_total
    totals.return_received_count += bucket.return_received_count
    totals.return_received_cod_total += bucket.return_received_cod_total
    const { start, end } = periodBounds(key, granularity)
    return {
      period_key: key,
      period_label: periodLabel(key, granularity),
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      ...bucket,
    }
  })
  return {
    granularity,
    timezone: 'Asia/Ho_Chi_Minh',
    date_field: 'cod_paid_date|shop_return_received_at',
    limit: maxItems,
    filter_from: filter.start?.toISOString() ?? null,
    filter_to: filter.end?.toISOString() ?? null,
    filter_label: filter.label,
    preset: (input.preset || '').trim().toLowerCase() || null,
    year: input.year != null ? Number(input.year) : null,
    available_years: [...years].sort((a, b) => b - a),
    items,
    totals,
  }
}

export function filterRecordsForImportPeriod(
  records: PartnerEmsRecord[],
  input: {
    granularity?: string
    periodKey?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    preset?: string | null
    year?: number | null
  },
): PartnerEmsRecord[] {
  const granularity = ((input.granularity || 'month').trim().toLowerCase() || 'month') as TimelineGranularity
  if (input.periodKey) {
    const { start, end } = periodBounds(input.periodKey, granularity)
    return records.filter((r) => inRange(recordPeriodDate(r), start, end))
  }
  const filter = resolveTimelineFilter(input)
  if (!filter.start && !filter.end) return records
  return records.filter((r) => inRange(recordPeriodDate(r), filter.start, filter.end))
}

export function filterRecordsForReceivedPeriod(
  records: PartnerEmsRecord[],
  bucket: string,
  input: {
    granularity?: string
    periodKey?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    preset?: string | null
    year?: number | null
  },
): PartnerEmsRecord[] {
  const granularity = ((input.granularity || 'month').trim().toLowerCase() || 'month') as TimelineGranularity
  const axisDate = (r: PartnerEmsRecord) =>
    bucket === 'shop_return_received' ? recordShopReturnReceivedDate(r) : recordCodPaidDate(r)
  if (input.periodKey) {
    const { start, end } = periodBounds(input.periodKey, granularity)
    return records.filter((r) => inRange(axisDate(r), start, end))
  }
  const filter = resolveTimelineFilter(input)
  if (!filter.start && !filter.end) return records.filter((r) => axisDate(r) != null)
  return records.filter((r) => inRange(axisDate(r), filter.start, filter.end))
}
