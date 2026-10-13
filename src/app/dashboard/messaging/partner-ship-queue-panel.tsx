'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchMyMessagingShipQueue } from '@/app/dashboard/messaging/actions'
import { messagingSettingsSectionHref } from '@/lib/messaging/messaging-settings-section-href'
import { fillShipQueueCopy, shipQueueCopy } from '@/lib/messaging/partner-ship-queue-copy'
import type { ShipQueueOrder, ShipQueuePeriod, ShipQueueStats } from '@/lib/messaging/partner-ship-queue'
import type { WebLocale } from '@/lib/i18n/config'

type Props = {
  partnerId: string
  locale?: WebLocale
}

function formatVnd(amount: number, locale: WebLocale | undefined): string {
  const tag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : 'vi-VN'
  return new Intl.NumberFormat(tag, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )
}

function formatDepositDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

const EMPTY_STATS: ShipQueueStats = {
  all: { orders: 0, totalVnd: 0 },
  day: { orders: 0, totalVnd: 0 },
  week: { orders: 0, totalVnd: 0 },
  month: { orders: 0, totalVnd: 0 },
}

const PERIODS: ShipQueuePeriod[] = ['all', 'day', 'week', 'month']

export function PartnerShipQueuePanel({ partnerId, locale }: Props) {
  const copy = shipQueueCopy(locale)
  const [orders, setOrders] = useState<ShipQueueOrder[]>([])
  const [stats, setStats] = useState<ShipQueueStats>(EMPTY_STATS)
  const [period, setPeriod] = useState<ShipQueuePeriod>('all')
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setOrders([])
    const res = await fetchMyMessagingShipQueue({ partnerId, period })
    setLoading(false)
    if ('error' in res) {
      setError(copy.loadError)
      setOrders([])
      setStats(EMPTY_STATS)
      setTruncated(false)
      return
    }
    setOrders(res.queue.orders)
    setStats(res.queue.stats)
    setTruncated(res.queue.truncated)
  }, [copy.loadError, partnerId, period])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900" aria-label={copy.title}>
      <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{copy.title}</h3>
        <p className="mt-1 text-xs text-slate-500">{copy.intro}</p>
      </div>
      {error ? (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={() => void load()}>
            {copy.retry}
          </button>
        </div>
      ) : null}
      {!error ? (
        <div className="space-y-4 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PERIODS.map((key) => {
              const bucket = stats[key]
              const label =
                key === 'day' ? copy.periodDay : key === 'week' ? copy.periodWeek : key === 'month' ? copy.periodMonth : copy.periodAll
              const selected = period === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPeriod(key)}
                  className={`rounded-lg border px-4 py-3 text-left ${
                    selected
                      ? 'border-[#ea580c] bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700'
                  }`}
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-zinc-50">
                    {formatVnd(bucket.totalVnd, locale)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {fillShipQueueCopy(copy.periodOrders, {
                      n: new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN').format(bucket.orders),
                    })}
                  </p>
                </button>
              )
            })}
          </div>
          {loading ? <p className="text-sm text-slate-500">{copy.loading}</p> : null}
          {!loading && truncated ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {fillShipQueueCopy(copy.truncated, { n: orders.length })}
            </div>
          ) : null}
          {!loading && orders.length === 0 ? (
            <p className="text-sm text-slate-500">{period === 'all' ? copy.empty : copy.emptyPeriod}</p>
          ) : null}
          {!loading && orders.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2 font-medium">{copy.colOrder}</th>
                    <th className="px-3 py-2 font-medium">{copy.colCustomer}</th>
                    <th className="px-3 py-2 font-medium">{copy.colTotal}</th>
                    <th className="px-3 py-2 font-medium">{copy.colDays}</th>
                    <th className="px-3 py-2 font-medium">{copy.colDepositDate}</th>
                    <th className="px-3 py-2 font-medium">{copy.viewOrder}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => (
                    <tr key={row.orderId} className="border-t border-slate-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-zinc-100">{row.orderCode}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-zinc-200">
                        <div>{row.customerName || copy.dash}</div>
                        {row.customerPhone ? <div className="text-xs text-slate-500">{row.customerPhone}</div> : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold tabular-nums text-slate-900 dark:text-zinc-50">
                        {formatVnd(row.totalVnd, locale)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-800 dark:text-zinc-100">
                        {fillShipQueueCopy(copy.days, { n: row.waitDays })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-zinc-300">
                        {row.depositedOn ? formatDepositDate(row.depositedOn) : copy.dash}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          className="whitespace-nowrap text-sm font-medium text-blue-600 hover:underline"
                          href={messagingSettingsSectionHref('hub-orders', partnerId, { q: row.orderCode, open: true })}
                        >
                          {copy.viewOrder}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
