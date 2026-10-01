'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchMyMessagingOrderProfitSheet } from '@/app/dashboard/messaging/actions'
import type { PartnerOrderProfitRow } from '@/lib/db/messaging-partner-orders-pg'
import { orderCostVnd } from '@/lib/messaging/partner-order-profit'
import { DEFAULT_VND_PER_CNY_FOR_LISTING_ESTIMATE } from '@/lib/messaging/listing-import/taobao-cards-html-parse'

type Props = {
  partnerId: string
  dateFrom?: string
  dateTo?: string
}

function isoTodayVn(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )
}

function formatCny(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount)} ¥`
}

function numOrNull(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function PartnerOrderProfitPanel({ partnerId, dateFrom: dateFromProp, dateTo: dateToProp }: Props) {
  const today = isoTodayVn()
  const [dateFrom, setDateFrom] = useState(dateFromProp || `${today.slice(0, 8)}01`)
  const [dateTo, setDateTo] = useState(dateToProp || today)
  const storageKey = `gudo-profit:${partnerId || 'all'}`
  const [rate, setRate] = useState(String(DEFAULT_VND_PER_CNY_FOR_LISTING_ESTIMATE))
  const [shipChina, setShipChina] = useState('0')
  const [shipBorder, setShipBorder] = useState('0')
  const [shipHanoi, setShipHanoi] = useState('0')
  const [adSpend, setAdSpend] = useState('0')
  const [orders, setOrders] = useState<PartnerOrderProfitRow[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const saved = JSON.parse(raw) as Record<string, string>
      if (saved.rate) setRate(saved.rate)
      if (saved.shipChina) setShipChina(saved.shipChina)
      if (saved.shipBorder) setShipBorder(saved.shipBorder)
      if (saved.shipHanoi) setShipHanoi(saved.shipHanoi)
      if (saved.adSpend) setAdSpend(saved.adSpend)
    } catch {
      /* bỏ qua bản lưu hỏng */
    }
  }, [storageKey])

  useEffect(() => {
    const payload = JSON.stringify({ rate, shipChina, shipBorder, shipHanoi, adSpend })
    window.localStorage.setItem(storageKey, payload)
  }, [storageKey, rate, shipChina, shipBorder, shipHanoi, adSpend])

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchMyMessagingOrderProfitSheet({ partnerId, dateFrom, dateTo }).then((res) => {
      if (cancelled) return
      if ('error' in res) {
        setOrders([])
        setError(res.error)
      } else {
        setOrders(res.orders)
        setTruncated(res.truncated)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [partnerId, dateFrom, dateTo])

  const rateNumber = numOrNull(rate)
  const china = numOrNull(shipChina) ?? 0
  const border = numOrNull(shipBorder) ?? 0
  const hanoi = numOrNull(shipHanoi) ?? 0
  const ads = numOrNull(adSpend)

  const summary = useMemo(() => {
    let revenue = 0
    let cost = 0
    let missing = 0
    for (const order of orders) {
      revenue += order.collectedVnd
      if (order.goodsCny == null) {
        missing += 1
        continue
      }
      const line = orderCostVnd({
        goodsCny: order.goodsCny,
        goodsVnd: order.goodsVnd,
        usesChinaShip: order.usesChinaShip,
        shipChinaCny: china,
        shipBorderCny: border,
        shipHanoiVnd: hanoi,
        vndPerCny: rateNumber ?? 0,
      })
      if (line == null) missing += 1
      else cost += line
    }
    const ready = missing === 0
    const gross = ready ? revenue - cost : null
    const profit = ready && ads != null ? revenue - cost - ads : null
    return { revenue, cost: ready ? cost : null, missing, gross, profit }
  }, [orders, china, border, hanoi, rateNumber, ads])

  return (
    <section className="min-w-0 overflow-hidden rounded-lg bg-white shadow dark:bg-zinc-800" aria-label="Lợi nhuận đơn đã cọc">
      <div className="border-b px-4 py-3 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">Lợi nhuận</h2>
        <p className="mt-1 text-sm text-gray-500">
          Giá thu là tiền hàng sau sale. Hàng Trung Quốc lấy giá gốc tệ × tỷ giá. Hàng Việt Nam và sale thanh lý kho lấy
          giá nhập đồng (sale = 0đ, không cộng ship Trung Quốc). Quảng cáo trừ một lần cho cả kỳ đang chọn.
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Từ ngày
            <input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} type="date" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Đến ngày
            <input value={dateTo} onChange={(e) => setDateTo(e.target.value)} type="date" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Tỷ giá (₫ / 1 ¥)
            <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min="0" step="0.0001" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Ship TQ (¥ / đơn)
            <input value={shipChina} onChange={(e) => setShipChina(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Cửa khẩu (¥ / đơn)
            <input value={shipBorder} onChange={(e) => setShipBorder(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Hà Nội (₫ / đơn)
            <input value={shipHanoi} onChange={(e) => setShipHanoi(e.target.value)} type="number" min="0" step="1" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
          <label className="text-sm text-gray-700 dark:text-zinc-200">
            Quảng cáo kỳ (₫)
            <input value={adSpend} onChange={(e) => setAdSpend(e.target.value)} type="number" min="0" step="1" className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900" />
          </label>
        </div>
        <p className="text-sm text-gray-700 dark:text-zinc-200">
          {loading
            ? 'Đang tính…'
            : summary.profit == null
              ? `${summary.missing} đơn còn thiếu giá nhập`
              : `${orders.length} đơn · giá thu ${formatVnd(summary.revenue)} · giá vốn ${formatVnd(summary.cost ?? 0)} · lợi nhuận ${formatVnd(summary.profit)}`}
        </p>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {truncated ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Kỳ này nhiều hơn 400 đơn đã cọc. Rút ngắn khoảng ngày để hạch toán đủ.
          </div>
        ) : null}
        {!loading && orders.length === 0 && !error ? (
          <p className="text-sm text-gray-500">Không có đơn đã cọc trong khoảng này.</p>
        ) : null}
        {orders.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Đơn</th>
                  <th className="px-3 py-2 font-medium">Ngày</th>
                  <th className="px-3 py-2 font-medium">Giá thu</th>
                  <th className="px-3 py-2 font-medium">Giá hàng ¥</th>
                  <th className="px-3 py-2 font-medium">Nhập VN</th>
                  <th className="px-3 py-2 font-medium">Giá vốn</th>
                  <th className="px-3 py-2 font-medium">Lãi gộp</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const cost =
                    order.goodsCny == null
                      ? null
                      : orderCostVnd({
                          goodsCny: order.goodsCny,
                          goodsVnd: order.goodsVnd,
                          usesChinaShip: order.usesChinaShip,
                          shipChinaCny: china,
                          shipBorderCny: border,
                          shipHanoiVnd: hanoi,
                          vndPerCny: rateNumber ?? 0,
                        })
                  const gross = cost == null ? null : order.collectedVnd - cost
                  return (
                    <tr key={order.orderId} className="border-t dark:border-zinc-700">
                      <td className="px-3 py-2 font-medium">{order.orderCode}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{order.createdOn || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatVnd(order.collectedVnd)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{order.goodsCny == null ? '—' : formatCny(order.goodsCny)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatVnd(order.goodsVnd)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{cost == null ? '—' : formatVnd(cost)}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${gross != null && gross < 0 ? 'text-red-700' : ''}`}>
                        {gross == null ? '—' : formatVnd(gross)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  )
}
