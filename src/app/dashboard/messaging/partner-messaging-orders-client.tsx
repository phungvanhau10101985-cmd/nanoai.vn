'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { resolveExternalImageDisplayUrl } from '@/lib/fetch-image-1688'
import { parsePartnerOrderVariantImageUrls } from '@/lib/messaging/partner-order-variant-images'
import {
  PARTNER_ADMIN_LIFECYCLE_TABS,
  PARTNER_ADMIN_ORDERS_DEFAULT_PAGE_SIZE,
  monthInputToDateRange,
  partnerAdminAmountDueOnDelivery,
  partnerAdminExpectsDeposit,
  partnerAdminNeedsDepositStage,
  partnerAdminOrderIsCancelled,
  partnerAdminPayBadgeKey,
  partnerAdminStageBadgeKey,
  todayIsoVn,
  weekRangeIsoVn,
  yearRangeIso,
  type PartnerAdminLifecycleTab,
  type PartnerAdminPaymentFilter,
} from '@/lib/messaging/partner-admin-orders-lifecycle'
import type { Database } from '@/types/database.types'
import {
  confirmMyMessagingOrderDeposit,
  exportMyMessagingOrdersExcel,
  fetchMyMessagingOrderRevenueReport,
  listMyMessagingOrderEvents,
  listMyMessagingOrderLines,
  listMyMessagingOrdersAdminPage,
  updateMyMessagingOrderRefund,
  updateMyMessagingOrderShipping,
  updateMyMessagingOrderStatus,
  type PartnerOrderAdminKpi,
  type PartnerOrderAdminRevenueReport,
  type PartnerOrderAdminTabCounts,
  type PartnerOrderLineRow,
} from '@/app/dashboard/messaging/actions'

const LS_CONSULT_FLAG = 'nano_messaging_orders_consult_v1'
const ACCENT = 'bg-[#ea580c] text-white hover:bg-[#c2410c]'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']
type OrderStatus = 'awaiting_payment' | 'payment_checking' | 'paid_verified' | 'pending_manual_review' | 'cancelled'
type OrdersT = Dictionary['partnerMessagingOrders']
type RevenueReportMode = 'day' | 'week' | 'month' | 'year' | 'range'

type OrderRow = {
  id: string
  partner_id: string
  conversation_id: string
  partner_display_name: string
  status: OrderStatus
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  product_name: string
  order_item_count?: number
  order_items_summary?: string
  product_image_url: string
  product_url: string
  quantity: number
  subtotal_amount: number
  amount_after_discount?: number
  required_amount: number
  paid_amount: number
  variant_color: string
  variant_size: string
  variant_image_urls?: string
  product_inventory_id: string | null
  note: string
  payment_reference: string
  verified_note: string
  shipping_status: 'pending' | 'confirmed' | 'packing' | 'shipping' | 'delivered' | 'returned' | 'cancelled'
  created_at: string
  latest_proof_image_url: string | null
  latest_proof_status: 'pending' | 'verified' | 'failed' | 'manual_review' | null
  has_customer_review?: boolean
  refund_status?: 'none' | 'requested' | 'refunded'
  refund_amount?: number
  refund_note?: string
}

type OrderEventRow = {
  id: string
  order_id: string
  event_type: string
  title: string
  detail: string
  source: string
  created_at: string
}

type RevenueFilterState = {
  date: string
  dateFrom: string
  dateTo: string
  year: string
  month: string
  preset: string | null
}

const EMPTY_REVENUE_FILTER: RevenueFilterState = {
  date: '',
  dateFrom: '',
  dateTo: '',
  year: String(new Date().getFullYear()),
  month: '',
  preset: null,
}

function loadBoolMap(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== 'object') return {}
    return p as Record<string, boolean>
  } catch {
    return {}
  }
}

function saveBoolMap(key: string, m: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

function intlLocaleTag(locale: WebLocale): string {
  if (locale === 'en') return 'en-US'
  if (locale === 'zh') return 'zh-CN'
  if (locale === 'ja') return 'ja-JP'
  if (locale === 'ko') return 'ko-KR'
  return 'vi-VN'
}

function formatVnd(v: number, locale: WebLocale): string {
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(v || 0)))
}

function formatDate(s: string, locale: WebLocale): string {
  const d = new Date(s)
  const tag = intlLocaleTag(locale)
  return `${d.toLocaleDateString(tag)} ${d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' })}`
}

function orderCodeDisplay(r: OrderRow): string {
  const ref = (r.payment_reference ?? '').trim()
  if (ref) return ref
  return `#${r.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

function tabTitle(t: OrdersT, key: PartnerAdminLifecycleTab): string {
  if (key === 'all') return t.tabAll
  if (key === 'waiting_deposit') return t.tabAwaitDeposit
  if (key === 'waiting_ship') return t.tabAwaitShip
  if (key === 'shipping') return t.tabAwaitReceive
  if (key === 'delivered') return t.tabReceived
  if (key === 'completed') return t.tabReviewed
  if (key === 'returned') return t.tabReturned
  return t.tabCancelled
}

function stageLabel(t: OrdersT, r: OrderRow): string {
  const key = partnerAdminStageBadgeKey({
    status: r.status,
    shipping_status: r.shipping_status,
    required_amount: r.required_amount,
    paid_amount: r.paid_amount,
    has_customer_review: r.has_customer_review,
  })
  if (key === 'cancelled') return t.statusCancelled
  return tabTitle(t, key)
}

function payLabel(t: OrdersT, r: OrderRow): string {
  const key = partnerAdminPayBadgeKey(r)
  if (key === 'cancelled') return t.statusCancelled
  if (key === 'deposit_paid') return t.badgePayPartial
  if (key === 'paid') return t.badgePayDone
  return t.badgePayAwaiting
}

function tabCount(counts: PartnerOrderAdminTabCounts | null, key: PartnerAdminLifecycleTab): number | null {
  if (!counts) return null
  if (key === 'all') return counts.totalOrders
  if (key === 'waiting_deposit') return counts.waitingDepositOrders
  if (key === 'waiting_ship') return counts.waitingShipOrders
  if (key === 'shipping') return counts.shippingOrders
  if (key === 'delivered') return counts.deliveredOrders
  if (key === 'completed') return counts.completedOrders
  if (key === 'returned') return counts.returnedOrders
  return counts.cancelledOrders
}

function lineImage(line: PartnerOrderLineRow, fallback: string): string {
  const fromVariant = parsePartnerOrderVariantImageUrls(line.variant_image_urls)[0]
  return (fromVariant || line.product_image_url || fallback || '').trim()
}

/** Thanh cuộn ngang trên đỉnh bảng + khung bảng khít viewport (không phải cuối 100 dòng). */
function OrdersAdminTablePane({
  children,
  syncKey,
  ariaLabel,
}: {
  children: ReactNode
  syncKey: string
  ariaLabel: string
}) {
  const topRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const [hasHOverflow, setHasHOverflow] = useState(false)

  const measure = useCallback(() => {
    const body = bodyRef.current
    const spacer = spacerRef.current
    if (!body || !spacer) return
    spacer.style.width = `${body.scrollWidth}px`
    setHasHOverflow(body.scrollWidth > body.clientWidth + 1)
  }, [])

  useLayoutEffect(() => {
    measure()
    const body = bodyRef.current
    if (!body) return
    const ro = new ResizeObserver(measure)
    ro.observe(body)
    const table = body.querySelector('table')
    if (table) ro.observe(table)
    return () => ro.disconnect()
  }, [measure, syncKey])

  return (
    <div className="min-w-0">
      <div
        ref={topRef}
        className={`overflow-x-auto overflow-y-hidden bg-gray-100 [scrollbar-color:#9ca3af_#e5e7eb] [scrollbar-width:auto] dark:bg-zinc-900 dark:[scrollbar-color:#71717a_#27272a] [&::-webkit-scrollbar]:h-3.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-400 ${
          hasHOverflow ? 'h-5' : 'hidden'
        }`}
        onScroll={() => {
          const top = topRef.current
          const body = bodyRef.current
          if (top && body && body.scrollLeft !== top.scrollLeft) body.scrollLeft = top.scrollLeft
        }}
        aria-label={ariaLabel}
      >
        <div ref={spacerRef} className="h-px" />
      </div>
      <div
        ref={bodyRef}
        className="max-h-[min(62vh,calc(100dvh-12rem))] overflow-auto overscroll-contain"
        onScroll={() => {
          const top = topRef.current
          const body = bodyRef.current
          if (top && body && top.scrollLeft !== body.scrollLeft) top.scrollLeft = body.scrollLeft
        }}
      >
        {children}
      </div>
    </div>
  )
}

function OrdersAdminMobileList({
  rows,
  t,
  locale,
  consultedMap,
  onToggleConsulted,
  onOpenDetail,
  onOpenPayment,
}: {
  rows: OrderRow[]
  t: OrdersT
  locale: WebLocale
  consultedMap: Record<string, boolean>
  onToggleConsulted: (orderId: string, next: boolean) => void
  onOpenDetail: (order: OrderRow) => void
  onOpenPayment: (order: OrderRow) => void
}) {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-zinc-700">
      {rows.map((order) => {
        const expects = partnerAdminExpectsDeposit(order)
        const needDeposit = partnerAdminNeedsDepositStage(order)
        const payKey = partnerAdminPayBadgeKey(order)
        return (
          <li key={order.id} className="px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-semibold leading-snug text-gray-900 dark:text-zinc-50">
                  {orderCodeDisplay(order)}
                </p>
                <p className="mt-1 truncate font-medium text-gray-900 dark:text-zinc-50">{order.customer_name || '—'}</p>
                <p className="text-xs text-gray-500">{order.customer_phone || '—'}</p>
              </div>
              <label className="flex shrink-0 flex-col items-center gap-1 pt-0.5 text-[11px] leading-none text-gray-500">
                <input
                  type="checkbox"
                  checked={Boolean(consultedMap[order.id])}
                  onChange={(e) => onToggleConsulted(order.id, e.target.checked)}
                  className="h-5 w-5 cursor-pointer rounded border-gray-300 text-[#ea580c] focus:ring-[#ea580c]"
                  aria-label={t.consultedAria}
                />
                {t.tableColConsultedShort}
              </label>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">{t.tableColSubtotal}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatVnd(order.amount_after_discount || order.subtotal_amount, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">{t.tableColDueOnDeliveryShort}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatVnd(partnerAdminAmountDueOnDelivery(order), locale)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-gray-500">{t.tableColDeposit}</dt>
                <dd className="text-xs leading-snug">
                  {expects ? (
                    <>
                      {t.depositNeed}: {formatVnd(order.required_amount, locale)}
                      {' · '}
                      {t.depositPaid}: {formatVnd(order.paid_amount, locale)}
                    </>
                  ) : (
                    <span className="text-green-600">{t.depositNotRequired}</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">{stageLabel(t, order)}</span>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                  payKey === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}
              >
                {payLabel(t, order)}
              </span>
              <span className="text-xs text-gray-500">{formatDate(order.created_at, locale)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                onClick={() => onOpenDetail(order)}
              >
                {t.tableDetails}
              </button>
              {needDeposit && !partnerAdminOrderIsCancelled(order) ? (
                <button
                  type="button"
                  onClick={() => onOpenPayment(order)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white bg-[#ea580c] hover:bg-[#c2410c]"
                >
                  {t.btnConfirmDeposit}
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function PartnerMessagingOrdersClient({
  initialPartners,
  ordersT,
  locale,
  lockedPartnerId,
  hidePartnerPicker,
}: {
  initialPartners: PartnerRow[]
  ordersT: OrdersT
  locale: WebLocale
  lockedPartnerId?: string
  hidePartnerPicker?: boolean
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const t = ordersT
  const tag = intlLocaleTag(locale)

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(lockedPartnerId?.trim() || 'all')
  const [rows, setRows] = useState<OrderRow[]>([])
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [kpi, setKpi] = useState<PartnerOrderAdminKpi | null>(null)
  const [tabCounts, setTabCounts] = useState<PartnerOrderAdminTabCounts | null>(null)
  const [listPage, setListPage] = useState(1)
  const [listPageSize, setListPageSize] = useState(PARTNER_ADMIN_ORDERS_DEFAULT_PAGE_SIZE)
  const [activeTab, setActiveTab] = useState<PartnerAdminLifecycleTab>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PartnerAdminLifecycleTab | ''>('')
  const [paymentFilter, setPaymentFilter] = useState<PartnerAdminPaymentFilter>('')
  const [consultedMap, setConsultedMap] = useState<Record<string, boolean>>({})
  const [pageToast, setPageToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentNote, setPaymentNote] = useState('')
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({})
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, OrderEventRow[]>>({})
  const [linesByOrder, setLinesByOrder] = useState<Record<string, PartnerOrderLineRow[]>>({})

  const [revenueMode, setRevenueMode] = useState<RevenueReportMode>('day')
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilterState>(() => ({
    ...EMPTY_REVENUE_FILTER,
    date: todayIsoVn(),
    preset: 'today',
  }))
  const [revenueReport, setRevenueReport] = useState<PartnerOrderAdminRevenueReport | null>(null)
  const [revenueLoading, setRevenueLoading] = useState(false)
  const [revenueError, setRevenueError] = useState<string | null>(null)
  const [revenueExpanded, setRevenueExpanded] = useState(false)

  const partnerIdArg = selectedPartnerId === 'all' ? '' : selectedPartnerId
  const lifecycleForQuery: PartnerAdminLifecycleTab = statusFilter || activeTab

  const showPageToast = (type: 'ok' | 'err', msg: string) => {
    setPageToast({ type, msg })
    window.setTimeout(() => setPageToast(null), 3000)
  }

  useEffect(() => {
    setConsultedMap(loadBoolMap(LS_CONSULT_FLAG))
    const params = new URLSearchParams(window.location.search)
    const q = (params.get('q') || params.get('highlight') || '').trim()
    if (q) {
      setSearch(q)
      setAppliedSearch(q)
    }
  }, [])

  useEffect(() => {
    const locked = lockedPartnerId?.trim() || ''
    if (locked && locked !== selectedPartnerId) setSelectedPartnerId(locked)
  }, [lockedPartnerId, selectedPartnerId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim())
      setListPage(1)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setListPage(1)
  }, [activeTab, statusFilter, paymentFilter, listPageSize, selectedPartnerId])

  const loadOrders = useCallback(() => {
    startTransition(async () => {
      const skip = (listPage - 1) * listPageSize
      const res = await listMyMessagingOrdersAdminPage({
        partnerId: partnerIdArg,
        q: appliedSearch,
        lifecycleTab: lifecycleForQuery,
        paymentFilter,
        skip,
        limit: listPageSize,
      })
      if ('error' in res && res.error) {
        showPageToast('err', res.error)
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('rows' in res) {
        const maxPage = Math.max(1, Math.ceil(res.filteredTotal / listPageSize))
        if (res.filteredTotal > 0 && listPage > maxPage) {
          setListPage(maxPage)
          return
        }
        setRows(res.rows as unknown as OrderRow[])
        setFilteredTotal(res.filteredTotal)
        setKpi(res.kpi)
        setTabCounts(res.tabCounts)
      }
    })
  }, [appliedSearch, lifecycleForQuery, listPage, listPageSize, partnerIdArg, paymentFilter, toast])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const loadRevenue = useCallback(
    async (mode: RevenueReportMode, filter: RevenueFilterState) => {
      setRevenueLoading(true)
      setRevenueError(null)
      let from = ''
      let to = ''
      let label = ''
      if (mode === 'day') {
        if (!filter.date) {
          setRevenueError(t.revenueNeedDay)
          setRevenueLoading(false)
          return
        }
        from = to = filter.date
        label = filter.preset === 'today' ? t.revenueToday : filter.date
      } else if (mode === 'week') {
        if (filter.preset !== 'this_week' && filter.preset !== 'last_week') {
          setRevenueError(t.revenueNeedWeek)
          setRevenueLoading(false)
          return
        }
        const range = weekRangeIsoVn(filter.preset)
        from = range.from
        to = range.to
        label = filter.preset === 'this_week' ? t.revenueThisWeek : t.revenueLastWeek
      } else if (mode === 'month') {
        if (filter.preset === 'this_month' || filter.preset === 'last_month') {
          const now = todayIsoVn()
          const [y, m] = now.split('-').map(Number)
          const month = filter.preset === 'this_month' ? m : m === 1 ? 12 : m - 1
          const year = filter.preset === 'this_month' ? y : m === 1 ? y - 1 : y
          const packed = `${year}-${String(month).padStart(2, '0')}`
          const range = monthInputToDateRange(packed)
          if (!range) {
            setRevenueError(t.revenueInvalidMonth)
            setRevenueLoading(false)
            return
          }
          from = range.from
          to = range.to
          label = filter.preset === 'this_month' ? t.revenueThisMonth : t.revenueLastMonth
        } else if (filter.month) {
          const range = monthInputToDateRange(filter.month)
          if (!range) {
            setRevenueError(t.revenueInvalidMonth)
            setRevenueLoading(false)
            return
          }
          from = range.from
          to = range.to
          label = filter.month
        } else {
          setRevenueError(t.revenueNeedMonth)
          setRevenueLoading(false)
          return
        }
      } else if (mode === 'year') {
        const y = Number(filter.year)
        if (!Number.isFinite(y) || y < 1970 || y > 2100) {
          setRevenueError(t.revenueNeedYear)
          setRevenueLoading(false)
          return
        }
        const range = yearRangeIso(y)
        from = range.from
        to = range.to
        label = String(y)
      } else {
        from = filter.dateFrom.trim()
        to = (filter.dateTo || filter.dateFrom).trim()
        if (!from) {
          setRevenueError(t.revenueNeedRange)
          setRevenueLoading(false)
          return
        }
        label = to && to !== from ? `${from} → ${to}` : from
      }
      const res = await fetchMyMessagingOrderRevenueReport({
        partnerId: partnerIdArg,
        dateFrom: from,
        dateTo: to || from,
        periodLabel: label,
      })
      if ('error' in res && res.error) {
        setRevenueReport(null)
        setRevenueError(res.error)
      } else if ('report' in res) {
        setRevenueReport(res.report)
      }
      setRevenueLoading(false)
    },
    [partnerIdArg, t]
  )

  useEffect(() => {
    void loadRevenue('day', { ...EMPTY_REVENUE_FILTER, date: todayIsoVn(), preset: 'today' })
  }, [loadRevenue])

  const toggleConsulted = (orderId: string, next: boolean) => {
    setConsultedMap((prev) => {
      const n = { ...prev, [orderId]: next }
      saveBoolMap(LS_CONSULT_FLAG, n)
      return n
    })
  }

  const copyCustomerAddress = async (address: string | undefined | null) => {
    const text = address?.trim()
    if (!text) {
      showPageToast('err', t.noAddress)
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      showPageToast('ok', t.toastAddressCopied)
    } catch {
      showPageToast('err', t.toastAddressCopyFailed)
    }
  }

  const openDetail = (order: OrderRow) => {
    setSelectedOrder(order)
    setDetailOpen(true)
    if (eventsByOrder[order.id] === undefined) {
      startTransition(async () => {
        const res = await listMyMessagingOrderEvents({ orderId: order.id, limit: 60 })
        if ('rows' in res) {
          setEventsByOrder((prev) => ({ ...prev, [order.id]: (res.rows ?? []) as unknown as OrderEventRow[] }))
        } else {
          setEventsByOrder((prev) => ({ ...prev, [order.id]: [] }))
        }
      })
    }
    if (linesByOrder[order.id] === undefined) {
      startTransition(async () => {
        const res = await listMyMessagingOrderLines({ orderId: order.id })
        if ('rows' in res) setLinesByOrder((prev) => ({ ...prev, [order.id]: res.rows }))
        else setLinesByOrder((prev) => ({ ...prev, [order.id]: [] }))
      })
    }
  }

  const openPaymentModal = (order: OrderRow) => {
    setSelectedOrder(order)
    setPaymentNote(noteByOrder[order.id] ?? '')
    setPaymentOpen(true)
  }

  const confirmDepositManual = (orderId: string) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? paymentNote).trim()
      const res = await confirmMyMessagingOrderDeposit({ orderId, verifiedNote: note })
      if ('error' in res && res.error) {
        showPageToast('err', res.error)
        return
      }
      showPageToast('ok', t.toastStatusUpdated)
      setPaymentOpen(false)
      setDetailOpen(false)
      loadOrders()
    })
  }

  const setStatus = (orderId: string, status: OrderStatus) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderStatus({ orderId, status, verifiedNote: note })
      if ('error' in res && res.error) {
        showPageToast('err', res.error)
        return
      }
      showPageToast('ok', t.toastStatusUpdated)
      loadOrders()
    })
  }

  const setShipping = (orderId: string, shippingStatus: OrderRow['shipping_status']) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderShipping({ orderId, shippingStatus, note })
      if ('error' in res && res.error) {
        showPageToast('err', res.error)
        return
      }
      showPageToast('ok', t.toastShippingUpdated)
      loadOrders()
    })
  }

  const markRefunded = (orderId: string, amount: number) => {
    startTransition(async () => {
      const res = await updateMyMessagingOrderRefund({
        orderId,
        refundStatus: 'refunded',
        refundAmount: Math.max(0, Math.round(amount || 0)),
        refundNote: t.btnRefundDeposit,
      })
      if ('error' in res && res.error) {
        showPageToast('err', res.error)
        return
      }
      showPageToast('ok', t.toastRefundUpdated)
      setDetailOpen(false)
      loadOrders()
    })
  }

  const exportExcel = () => {
    startTransition(async () => {
      const res = await exportMyMessagingOrdersExcel({ partnerId: partnerIdArg })
      if ('error' in res && res.error) {
        showPageToast('err', res.error)
        return
      }
      if (!('ok' in res) || !res.ok) return
      const bin = atob(res.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      showPageToast(
        'ok',
        t.toastExportDone.replace('{count}', res.count.toLocaleString(tag)).replace('{filename}', res.filename)
      )
    })
  }

  const totalPages = Math.max(1, Math.ceil(filteredTotal / listPageSize))
  const displayFrom = filteredTotal === 0 ? 0 : (listPage - 1) * listPageSize + 1
  const displayTo = Math.min(listPage * listPageSize, filteredTotal)
  const loading = pending && rows.length === 0

  const detailLines = selectedOrder ? linesByOrder[selectedOrder.id] : undefined
  const productLines: PartnerOrderLineRow[] = useMemo(() => {
    if (!selectedOrder) return []
    if (detailLines && detailLines.length > 0) return detailLines
    return [
      {
        id: selectedOrder.id,
        order_id: selectedOrder.id,
        product_inventory_id: selectedOrder.product_inventory_id,
        product_name: selectedOrder.product_name,
        product_image_url: selectedOrder.product_image_url,
        product_url: selectedOrder.product_url,
        unit_price: Math.round(
          (selectedOrder.amount_after_discount || selectedOrder.subtotal_amount || 0) / Math.max(1, selectedOrder.quantity)
        ),
        quantity: selectedOrder.quantity,
        line_subtotal: Math.round(selectedOrder.amount_after_discount || selectedOrder.subtotal_amount || 0),
        variant_color: selectedOrder.variant_color,
        variant_size: selectedOrder.variant_size,
        variant_image_urls: selectedOrder.variant_image_urls || '',
        note: selectedOrder.note,
        sort_order: 0,
        created_at: selectedOrder.created_at,
        updated_at: selectedOrder.created_at,
      },
    ]
  }, [detailLines, selectedOrder])

  return (
    <div className="-m-3 bg-slate-100 p-4 sm:-m-4 sm:p-6 lg:-m-5 dark:bg-zinc-900">
      {pageToast ? (
        <div
          className={`fixed top-24 right-4 z-[100] max-w-[min(20rem,calc(100vw-2rem))] px-4 py-2 rounded-lg shadow-lg sm:right-6 ${
            pageToast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
          role="status"
          aria-live="polite"
        >
          {pageToast.msg}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl dark:text-zinc-50">{t.pageTitle}</h1>
          <p className="text-sm text-gray-600 lg:text-base dark:text-zinc-400">{t.pageDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hidePartnerPicker ? null : (
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="all">{t.allWorkspaces}</option>
              {initialPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => exportExcel()}
            disabled={pending}
            title={t.exportExcelTitle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t.exportExcel}
          </button>
          <button type="button" onClick={() => loadOrders()} className={`rounded-lg px-4 py-2 ${ACCENT}`}>
            {t.reload}
          </button>
        </div>
      </div>

      {kpi ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:mb-6 lg:grid-cols-4 lg:gap-4">
          <div className="rounded-lg bg-white p-3 shadow lg:p-4 dark:bg-zinc-800">
            <p className="text-xs text-gray-500 lg:text-sm">{t.statOrders}</p>
            <p className="text-xl font-bold lg:text-2xl">{kpi.totalOrders}</p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow lg:p-4 dark:bg-zinc-800">
            <p className="text-xs text-gray-500 lg:text-sm">{t.kpiTodayRevenue}</p>
            <p className="text-xl font-bold text-green-600 lg:text-2xl">{formatVnd(kpi.todayRevenue, locale)}</p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow lg:p-4 dark:bg-zinc-800">
            <p className="text-xs text-gray-500 lg:text-sm">{t.kpiWaitingDeposit}</p>
            <p className="text-xl font-bold text-orange-600 lg:text-2xl">{kpi.waitingDepositOrders}</p>
          </div>
          <div className="rounded-lg bg-white p-3 shadow lg:p-4 dark:bg-zinc-800">
            <p className="text-xs text-gray-500 lg:text-sm">{t.kpiShippingNow}</p>
            <p className="text-xl font-bold lg:text-2xl">{kpi.shippingOrders}</p>
          </div>
        </div>
      ) : null}

      <section className="mb-4 overflow-hidden rounded-lg bg-white shadow lg:mb-6 dark:bg-zinc-800" aria-label={t.revenueReportTitle}>
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3 dark:border-zinc-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">{t.revenueReportTitle}</h2>
            <p className="mt-0.5 hidden text-sm text-gray-500 lg:block">{t.revenueReportDesc}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm lg:hidden dark:border-zinc-600"
            aria-expanded={revenueExpanded}
            onClick={() => setRevenueExpanded((open) => !open)}
          >
            {revenueExpanded ? t.collapseRow : t.expandRow}
          </button>
        </div>
        <div className={revenueExpanded ? 'block' : 'hidden lg:block'}>
        <div className="flex flex-wrap gap-2 border-b px-4 py-3 dark:border-zinc-700">
          {(
            [
              ['day', t.revenueModeDay],
              ['week', t.revenueModeWeek],
              ['month', t.revenueModeMonth],
              ['year', t.revenueModeYear],
              ['range', t.revenueModeRange],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setRevenueMode(key)
                setRevenueError(null)
                if (key === 'day') {
                  const next = { ...EMPTY_REVENUE_FILTER, date: todayIsoVn(), preset: 'today' }
                  setRevenueFilter(next)
                  void loadRevenue('day', next)
                  return
                }
                setRevenueFilter(EMPTY_REVENUE_FILTER)
                setRevenueReport(null)
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                revenueMode === key
                  ? 'border-[#ea580c] bg-[#ea580c] text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-b bg-gray-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          {revenueMode === 'day' ? (
            <>
              <label className="text-sm text-gray-700 dark:text-zinc-300">
                {t.revenuePickDay}
                <input
                  type="date"
                  value={revenueFilter.date}
                  onChange={(e) => {
                    const next = { ...EMPTY_REVENUE_FILTER, date: e.target.value, preset: null }
                    setRevenueFilter(next)
                    if (e.target.value) void loadRevenue('day', next)
                  }}
                  className="mt-1 block rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = { ...EMPTY_REVENUE_FILTER, date: todayIsoVn(), preset: 'today' }
                  setRevenueFilter(next)
                  void loadRevenue('day', next)
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {t.revenueToday}
              </button>
            </>
          ) : null}
          {revenueMode === 'week' ? (
            <>
              {(['this_week', 'last_week'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const next = { ...EMPTY_REVENUE_FILTER, preset }
                    setRevenueFilter(next)
                    void loadRevenue('week', next)
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    revenueFilter.preset === preset
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800'
                  }`}
                >
                  {preset === 'this_week' ? t.revenueThisWeek : t.revenueLastWeek}
                </button>
              ))}
            </>
          ) : null}
          {revenueMode === 'month' ? (
            <>
              {(['this_month', 'last_month'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const next = { ...EMPTY_REVENUE_FILTER, preset }
                    setRevenueFilter(next)
                    void loadRevenue('month', next)
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    revenueFilter.preset === preset
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-800'
                  }`}
                >
                  {preset === 'this_month' ? t.revenueThisMonth : t.revenueLastMonth}
                </button>
              ))}
              <label className="text-sm text-gray-700 dark:text-zinc-300">
                {t.revenuePickMonth}
                <input
                  type="month"
                  value={revenueFilter.month}
                  onChange={(e) => setRevenueFilter({ ...EMPTY_REVENUE_FILTER, month: e.target.value, preset: null })}
                  className="mt-1 block rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <button
                type="button"
                disabled={!revenueFilter.month}
                onClick={() => void loadRevenue('month', revenueFilter)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {t.revenueViewMonth}
              </button>
            </>
          ) : null}
          {revenueMode === 'year' ? (
            <>
              <label className="text-sm text-gray-700 dark:text-zinc-300">
                {t.revenueYear}
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  value={revenueFilter.year}
                  onChange={(e) => setRevenueFilter({ ...EMPTY_REVENUE_FILTER, year: e.target.value, preset: null })}
                  className="mt-1 block w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <button
                type="button"
                onClick={() => void loadRevenue('year', revenueFilter)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {t.revenueViewYear}
              </button>
            </>
          ) : null}
          {revenueMode === 'range' ? (
            <>
              <label className="text-sm text-gray-700 dark:text-zinc-300">
                {t.filterCreatedFrom}
                <input
                  type="date"
                  value={revenueFilter.dateFrom}
                  onChange={(e) => setRevenueFilter((prev) => ({ ...prev, dateFrom: e.target.value, preset: null }))}
                  className="mt-1 block rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-zinc-300">
                {t.filterCreatedTo}
                <input
                  type="date"
                  value={revenueFilter.dateTo}
                  onChange={(e) => setRevenueFilter((prev) => ({ ...prev, dateTo: e.target.value, preset: null }))}
                  className="mt-1 block rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <button
                type="button"
                disabled={!revenueFilter.dateFrom}
                onClick={() => void loadRevenue('range', revenueFilter)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {t.revenueViewRange}
              </button>
            </>
          ) : null}
        </div>
        <div className="p-4">
          {revenueError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{revenueError}</div>
          ) : null}
          {revenueLoading ? <p className="text-sm text-gray-500">{t.revenueLoading}</p> : null}
          {!revenueLoading && revenueReport ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 sm:col-span-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                <p className="text-sm text-gray-500">{t.revenuePeriod}</p>
                <p className="text-base font-semibold text-gray-900 dark:text-zinc-50">
                  {revenueReport.periodLabel || '—'}
                  {revenueReport.dateFrom && revenueReport.dateTo && revenueReport.dateFrom !== revenueReport.dateTo ? (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({revenueReport.dateFrom} → {revenueReport.dateTo})
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/40">
                <p className="text-sm text-gray-600">{t.revenueAmount}</p>
                <p className="text-2xl font-bold text-emerald-700">{formatVnd(revenueReport.totalRevenue, locale)}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-4 dark:border-zinc-700">
                <p className="text-sm text-gray-600">{t.revenueOrderCount}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-zinc-50">{revenueReport.totalOrders}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-4 dark:border-zinc-700">
                <p className="text-sm text-gray-600">{t.statusCancelled}</p>
                <p className="text-lg font-semibold text-gray-800 dark:text-zinc-200">
                  {t.revenueCancelledReturned
                    .replace('{cancelled}', String(revenueReport.cancelledOrders))
                    .replace('{returned}', String(revenueReport.returnedOrders))}
                </p>
              </div>
            </div>
          ) : !revenueError && !revenueLoading ? (
            <p className="text-sm text-gray-500">{t.revenuePickPeriod}</p>
          ) : null}
        </div>
        </div>
      </section>

      <div className="min-w-0 overflow-hidden rounded-lg bg-white shadow dark:bg-zinc-800">
        <div className="flex gap-2 overflow-x-auto border-b p-2 lg:flex-wrap lg:overflow-visible dark:border-zinc-700">
          {PARTNER_ADMIN_LIFECYCLE_TABS.map(({ key }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveTab(key)
                setStatusFilter('')
              }}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                activeTab === key && !statusFilter
                  ? 'bg-[#ea580c] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-200'
              }`}
            >
              {tabTitle(t, key)} ({tabCount(tabCounts, key) ?? '—'})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 p-3 lg:gap-3 lg:p-4">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 lg:w-64 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value || '') as PartnerAdminLifecycleTab | '')}
            className="min-w-[9.5rem] flex-1 rounded-lg border px-3 py-2 lg:w-40 lg:flex-none dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">{t.filterShippingLabel}</option>
            {PARTNER_ADMIN_LIFECYCLE_TABS.slice(1).map(({ key }) => (
              <option key={key} value={key}>
                {tabTitle(t, key)}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter((e.target.value || '') as PartnerAdminPaymentFilter)}
            className="min-w-[9.5rem] flex-1 rounded-lg border px-3 py-2 lg:w-40 lg:flex-none dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">{t.filterPaymentShort}</option>
            <option value="pending">{t.badgePayAwaiting}</option>
            <option value="deposit_paid">{t.badgePayPartial}</option>
            <option value="paid">{t.badgePayDone}</option>
            <option value="failed">{t.filterPayFailed}</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setAppliedSearch('')
              setStatusFilter('')
              setPaymentFilter('')
              setActiveTab('all')
              setListPage(1)
            }}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          >
            {t.clearTableFilters}
          </button>
          <select
            value={listPageSize}
            onChange={(e) => setListPageSize(Number(e.target.value))}
            className="w-36 rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            aria-label={t.pageSizeAria}
          >
            <option value={25}>{t.pageSize25}</option>
            <option value={50}>{t.pageSize50}</option>
            <option value={100}>{t.pageSize100}</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">{t.loadingOrders}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t.emptyList}</div>
        ) : (
          <>
          <div className="lg:hidden">
            <OrdersAdminMobileList
              rows={rows}
              t={t}
              locale={locale}
              consultedMap={consultedMap}
              onToggleConsulted={toggleConsulted}
              onOpenDetail={openDetail}
              onOpenPayment={openPaymentModal}
            />
          </div>
          <div className="hidden lg:block">
          <OrdersAdminTablePane
            syncKey={`${rows.length}:${listPage}:${listPageSize}:${activeTab}:${statusFilter}:${paymentFilter}:${appliedSearch}`}
            ariaLabel={t.tableHScrollAria}
          >
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 whitespace-nowrap border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColOrderCode}
                  </th>
                  <th
                    className="sticky top-0 z-20 w-16 border-b bg-gray-50 px-2 py-2 text-center text-xs font-medium leading-tight dark:border-zinc-700 dark:bg-zinc-900"
                    title={t.tableColConsulted}
                  >
                    {t.tableColConsultedShort}
                  </th>
                  <th className="sticky top-0 z-20 min-w-[8rem] border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColCustomer}
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColSubtotal}
                  </th>
                  <th className="sticky top-0 z-20 min-w-[7.5rem] border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColDeposit}
                  </th>
                  <th
                    className="sticky top-0 z-20 min-w-[6.5rem] max-w-[8rem] border-b bg-gray-50 px-2 py-2 text-xs font-medium leading-tight dark:border-zinc-700 dark:bg-zinc-900"
                    title={t.tableColDueOnDelivery}
                  >
                    {t.tableColDueOnDeliveryShort}
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColStatus}
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColPayment}
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b bg-gray-50 px-2 py-2 font-medium dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColOrderDate}
                  </th>
                  <th className="sticky right-0 top-0 z-30 whitespace-nowrap border-b bg-gray-50 px-2 py-2 font-medium shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.18)] dark:border-zinc-700 dark:bg-zinc-900">
                    {t.tableColActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const needDeposit = partnerAdminNeedsDepositStage(order)
                  const expects = partnerAdminExpectsDeposit(order)
                  const payKey = partnerAdminPayBadgeKey(order)
                  return (
                    <tr key={order.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="sticky left-0 z-10 whitespace-nowrap border-b bg-white px-2 py-2 font-mono text-xs shadow-[4px_0_8px_-6px_rgba(0,0,0,0.12)] group-hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:group-hover:bg-zinc-900/80">
                        {orderCodeDisplay(order)}
                      </td>
                      <td className="border-b px-2 py-2 text-center dark:border-zinc-700">
                        <input
                          type="checkbox"
                          checked={Boolean(consultedMap[order.id])}
                          onChange={(e) => toggleConsulted(order.id, e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#ea580c] focus:ring-[#ea580c]"
                          aria-label={t.consultedAria}
                        />
                      </td>
                      <td className="border-b px-2 py-2 dark:border-zinc-700">
                        <div className="max-w-[10rem] truncate font-medium" title={order.customer_name || undefined}>
                          {order.customer_name || '—'}
                        </div>
                        <div className="text-xs text-gray-500">{order.customer_phone || '—'}</div>
                      </td>
                      <td className="whitespace-nowrap border-b px-2 py-2 font-semibold tabular-nums dark:border-zinc-700">
                        {formatVnd(order.amount_after_discount || order.subtotal_amount, locale)}
                      </td>
                      <td className="border-b px-2 py-2 text-xs leading-snug dark:border-zinc-700">
                        {expects ? (
                          <>
                            {t.depositNeed}: {formatVnd(order.required_amount, locale)}
                            <br />
                            {t.depositPaid}: {formatVnd(order.paid_amount, locale)}
                          </>
                        ) : (
                          <span className="text-green-600">{t.depositNotRequired}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b px-2 py-2 text-sm font-semibold tabular-nums text-gray-900 dark:border-zinc-700 dark:text-zinc-50">
                        {formatVnd(partnerAdminAmountDueOnDelivery(order), locale)}
                      </td>
                      <td className="border-b px-2 py-2 dark:border-zinc-700">
                        <span className="inline-block whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">
                          {stageLabel(t, order)}
                        </span>
                      </td>
                      <td className="border-b px-2 py-2 dark:border-zinc-700">
                        <span
                          className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
                            payKey === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {payLabel(t, order)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap border-b px-2 py-2 text-xs text-gray-600 dark:border-zinc-700">
                        {formatDate(order.created_at, locale)}
                      </td>
                      <td className="sticky right-0 z-10 border-b bg-white px-2 py-2 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.18)] group-hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:group-hover:bg-zinc-900/80">
                        <div className="flex flex-nowrap items-center gap-1.5">
                          <button
                            type="button"
                            className="whitespace-nowrap text-xs text-blue-600 hover:underline"
                            onClick={() => openDetail(order)}
                          >
                            {t.tableDetails}
                          </button>
                          {needDeposit && !partnerAdminOrderIsCancelled(order) ? (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(order)}
                              className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white bg-[#ea580c] hover:bg-[#c2410c]"
                            >
                              {t.btnConfirmDeposit}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </OrdersAdminTablePane>
          </div>
          </>
        )}
        {!loading && filteredTotal > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-3 py-3 text-sm text-gray-600 lg:px-4 dark:border-zinc-700">
            <span>
              {t.paginationSummary
                .replace('{from}', String(displayFrom))
                .replace('{to}', String(displayTo))
                .replace('{total}', String(filteredTotal))
                .replace('{page}', String(listPage))
                .replace('{pages}', String(totalPages))}
              {appliedSearch ? t.paginationSearchHint.replace('{q}', appliedSearch) : ''}
            </span>
            <div className="grid w-full grid-cols-4 gap-2 lg:flex lg:w-auto lg:items-center">
              <button
                type="button"
                onClick={() => setListPage(1)}
                disabled={listPage <= 1 || pending}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-center hover:bg-gray-50 disabled:opacity-40 lg:py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              >
                {t.paginationFirst}
              </button>
              <button
                type="button"
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                disabled={listPage <= 1 || pending}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-center hover:bg-gray-50 disabled:opacity-40 lg:py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              >
                {t.paginationPrev}
              </button>
              <button
                type="button"
                onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                disabled={listPage >= totalPages || pending}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-center hover:bg-gray-50 disabled:opacity-40 lg:py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              >
                {t.paginationNext}
              </button>
              <button
                type="button"
                onClick={() => setListPage(totalPages)}
                disabled={listPage >= totalPages || pending}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-center hover:bg-gray-50 disabled:opacity-40 lg:py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
              >
                {t.paginationLast}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {detailOpen && selectedOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 lg:items-center lg:p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none bg-white shadow-xl lg:h-auto lg:max-h-[90vh] lg:rounded-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 lg:px-6 lg:py-4 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="min-w-0 flex-1 pr-2 text-lg font-bold leading-tight text-gray-900 lg:text-xl dark:text-zinc-50">{t.modalTitle}</h2>
              <button
                type="button"
                aria-label={t.btnClose}
                onClick={() => setDetailOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">{t.customerCodeLabel}</p>
                  <p className="text-lg font-semibold tracking-wide">{orderCodeDisplay(selectedOrder)}</p>
                  <p className="mt-1 text-xs text-gray-500">{t.internalIdLabel.replace('{id}', selectedOrder.id)}</p>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={Boolean(consultedMap[selectedOrder.id])}
                      onChange={(e) => toggleConsulted(selectedOrder.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#ea580c] focus:ring-[#ea580c]"
                    />
                    <span>{t.modalConsultedCustomer}</span>
                  </label>
                  <p className="mt-2 text-sm text-gray-600">{formatDate(selectedOrder.created_at, locale)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">{t.labelCustomer}</p>
                  <p className="font-medium">{selectedOrder.customer_name || '—'}</p>
                  <p className="text-sm">{selectedOrder.customer_phone || '—'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-gray-500">{t.modalShippingAddressHeading}</p>
                    <button
                      type="button"
                      onClick={() => void copyCustomerAddress(selectedOrder.shipping_address)}
                      disabled={!selectedOrder.shipping_address?.trim()}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-45"
                    >
                      {t.modalCopyAddress}
                    </button>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-zinc-200">
                    {selectedOrder.shipping_address?.trim() || <span className="italic text-gray-400">{t.noAddress}</span>}
                  </p>
                  <p className="mt-2 text-sm">
                    {stageLabel(t, selectedOrder)} / {payLabel(t, selectedOrder)}
                  </p>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <p className="mb-3 text-sm font-semibold text-amber-900">{t.modalPaymentHeading}</p>
                <dl className="grid gap-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                    <dt className="text-gray-600">{t.modalOrderTotal}</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">
                      {formatVnd(selectedOrder.amount_after_discount || selectedOrder.subtotal_amount, locale)}
                    </dd>
                  </div>
                  {partnerAdminExpectsDeposit(selectedOrder) ? (
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <dt className="shrink-0 text-gray-600">{t.tableColDeposit}</dt>
                      <dd className="text-right font-medium tabular-nums text-gray-900">
                        <span>
                          {t.depositNeed}: {formatVnd(selectedOrder.required_amount, locale)}
                        </span>
                        <span className="mx-1.5 font-normal text-gray-400">·</span>
                        <span>
                          {t.depositPaid}: {formatVnd(selectedOrder.paid_amount, locale)}
                        </span>
                      </dd>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <dt className="text-gray-600">{t.tableColDeposit}</dt>
                      <dd className="font-medium text-green-700">{t.depositNotRequired}</dd>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-amber-200/80 pt-2">
                    <dt className="shrink-0 font-medium text-gray-800">
                      {t.paymentWhenReceive}
                      {partnerAdminExpectsDeposit(selectedOrder) ? (
                        <span className="hidden font-normal text-gray-500 sm:inline"> ({t.modalCodAfterDeposit})</span>
                      ) : null}
                    </dt>
                    <dd className="font-semibold tabular-nums text-red-700">
                      {formatVnd(partnerAdminAmountDueOnDelivery(selectedOrder), locale)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mb-4 overflow-x-auto">
                <h3 className="mb-2 font-semibold">{t.modalProductsHeading}</h3>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="w-[140px] min-w-[140px] py-2 text-left font-medium text-gray-600">{t.modalColImage}</th>
                      <th className="py-2 text-left font-medium text-gray-600">{t.modalColProduct}</th>
                      <th className="whitespace-nowrap py-2 text-right font-medium text-gray-600">{t.colQty}</th>
                      <th className="whitespace-nowrap py-2 text-right font-medium text-gray-600">{t.colUnitPrice}</th>
                      <th className="whitespace-nowrap py-2 text-right font-medium text-gray-600">{t.colLineTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productLines.map((item) => {
                      const img = lineImage(item, selectedOrder.product_image_url)
                      const href = item.product_url?.trim() || ''
                      return (
                        <tr key={item.id} className="border-b align-top">
                          <td className="py-2 pr-2 align-middle">
                            {img ? (
                              <a href={img} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={resolveExternalImageDisplayUrl(img)}
                                  alt=""
                                  className="block h-32 w-32 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover"
                                  width={128}
                                  height={128}
                                />
                              </a>
                            ) : (
                              <div className="h-32 w-32 rounded-lg border border-dashed border-gray-200 bg-gray-50" />
                            )}
                          </td>
                          <td className="min-w-0 py-2 pr-2">
                            <div className="font-medium leading-snug text-gray-900">
                              {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#ea580c] hover:underline">
                                  {item.product_name}
                                </a>
                              ) : (
                                item.product_name
                              )}
                            </div>
                            <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                              {item.product_inventory_id ? <p>{t.skuLabel.replace('{sku}', item.product_inventory_id)}</p> : null}
                              {item.variant_color?.trim() ? (
                                <p>
                                  {t.modalColor}: {item.variant_color}
                                </p>
                              ) : null}
                              {item.variant_size?.trim() ? (
                                <p>
                                  {t.modalSize}: {item.variant_size}
                                </p>
                              ) : null}
                              {href ? (
                                <p className="break-all">
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                                    {href.replace(/^https?:\/\//, '')}
                                  </a>
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-2 text-right">{item.quantity}</td>
                          <td className="whitespace-nowrap py-2 text-right">{formatVnd(item.unit_price, locale)}</td>
                          <td className="whitespace-nowrap py-2 text-right font-medium">{formatVnd(item.line_subtotal, locale)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">{t.timelineHeading}</h3>
                {eventsByOrder[selectedOrder.id] === undefined ? (
                  <p className="text-sm text-gray-500">{t.timelineLoading}</p>
                ) : (eventsByOrder[selectedOrder.id] ?? []).length ? (
                  <ul className="mb-4 space-y-2">
                    {(eventsByOrder[selectedOrder.id] ?? []).map((ev, idx, arr) => {
                      const isLatest = idx === 0
                      return (
                        <li key={ev.id} className="flex items-start gap-2 text-sm">
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              isLatest ? 'bg-[#ea580c]' : idx < arr.length ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          />
                          <span className={isLatest ? 'font-medium text-[#ea580c]' : 'text-gray-700'}>
                            {ev.title}
                            {ev.detail ? <span className="block text-xs font-normal text-gray-500">{ev.detail}</span> : null}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mb-4 text-sm text-gray-500">{t.timelineEmpty}</p>
                )}
                {isSepayStyleOrderPayment(selectedOrder) ? (
                  <p className="text-xs text-gray-600">{t.sepayAutoHint.replace(/\{shop\}/g, selectedOrder.partner_display_name || 'Shop')}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {partnerAdminNeedsDepositStage(selectedOrder) && !partnerAdminOrderIsCancelled(selectedOrder) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailOpen(false)
                      openPaymentModal(selectedOrder)
                    }}
                    className={`rounded-lg px-4 py-2 ${ACCENT}`}
                  >
                    {t.btnConfirmDeposit}
                  </button>
                ) : null}
                {!partnerAdminNeedsDepositStage(selectedOrder) &&
                selectedOrder.shipping_status !== 'shipping' &&
                selectedOrder.shipping_status !== 'delivered' &&
                !partnerAdminOrderIsCancelled(selectedOrder) ? (
                  <button
                    type="button"
                    onClick={() => setShipping(selectedOrder.id, 'shipping')}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
                  >
                    {t.btnMarkShipping}
                  </button>
                ) : null}
                {selectedOrder.shipping_status === 'delivered' && !selectedOrder.has_customer_review ? (
                  <button
                    type="button"
                    onClick={() => {
                      showPageToast('ok', t.toastStatusUpdated)
                      setDetailOpen(false)
                    }}
                    className={`rounded-lg px-4 py-2 ${ACCENT}`}
                  >
                    {t.btnComplete}
                  </button>
                ) : null}
                {!partnerAdminOrderIsCancelled(selectedOrder) && selectedOrder.shipping_status !== 'returned' ? (
                  <button
                    type="button"
                    onClick={() => setStatus(selectedOrder.id, 'cancelled')}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  >
                    {t.btnCancelOrder}
                  </button>
                ) : null}
                {selectedOrder.paid_amount > 0 &&
                !partnerAdminOrderIsCancelled(selectedOrder) &&
                selectedOrder.refund_status !== 'refunded' ? (
                  <button
                    type="button"
                    onClick={() => markRefunded(selectedOrder.id, selectedOrder.paid_amount || 0)}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100"
                  >
                    {t.btnRefundDeposit}
                  </button>
                ) : null}
                {['shipping', 'delivered'].includes(selectedOrder.shipping_status) ? (
                  <button
                    type="button"
                    onClick={() => setShipping(selectedOrder.id, 'returned')}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
                  >
                    {t.btnApproveReturn}
                  </button>
                ) : null}
                <Link
                  href={`/dashboard/messaging/inbox?partner=${encodeURIComponent(selectedOrder.partner_id)}&conversation=${encodeURIComponent(selectedOrder.conversation_id)}`}
                  className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  {t.openInbox}
                </Link>
                {selectedOrder.latest_proof_image_url ? (
                  <a
                    href={selectedOrder.latest_proof_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                  >
                    {t.openProofImage}
                  </a>
                ) : null}
                <button type="button" onClick={() => setDetailOpen(false)} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
                  {t.btnClose}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {paymentOpen && selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 lg:items-center lg:p-4" onClick={() => setPaymentOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl lg:rounded-xl lg:p-6 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-bold">{t.confirmDepositTitle}</h2>
            <p className="mb-2">
              {t.confirmDepositBody
                .replace('{code}', orderCodeDisplay(selectedOrder))
                .replace('{amount}', formatVnd(selectedOrder.required_amount, locale))}
            </p>
            <p className="mb-2 text-sm text-amber-600">{t.confirmDepositNoTxn}</p>
            <p className="mb-3 text-sm text-gray-600">{t.confirmDepositManualHint}</p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">{t.confirmDepositNoteLabel}</label>
              <textarea
                rows={3}
                placeholder={t.confirmDepositNotePlaceholder}
                value={paymentNote}
                onChange={(e) => {
                  setPaymentNote(e.target.value)
                  setNoteByOrder((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))
                }}
                className="w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => setPaymentOpen(false)} className="rounded-lg border px-4 py-2 hover:bg-gray-50">
                {t.btnCancelModal}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentOpen(false)
                  setStatus(selectedOrder.id, 'cancelled')
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                {t.btnRejectDeposit}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirmDepositManual(selectedOrder.id)}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t.btnConfirmDeposit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
