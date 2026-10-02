'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  fetchMyMessagingOrderProfitSheet,
  saveMyMessagingOrderProfitInputs,
} from '@/app/dashboard/messaging/actions'
import type { PartnerOrderProfitSheet } from '@/lib/db/messaging-partner-order-profit-pg'
import { adSpendPageCopy, fillCopy } from '@/lib/messaging/ad-spend/partner-ad-spend-copy'
import type { WebLocale } from '@/lib/i18n/config'
import type { ProfitSheetOrder } from '@/lib/messaging/partner-order-profit'
import { listingVndToCny } from '@/lib/messaging/listing-import/taobao-cards-html-parse'

type AdSpendState = 'loading' | 'ready' | 'unavailable'

export type AdSpendProfitSummary = {
  dateFrom: string
  dateTo: string
  loading: boolean
  orderCount: number
  revenue: number
  revenueCny: number | null
  returnedCount: number
  uncollected: number
  cost: number | null
  missing: number
  gross: number | null
  profit: number | null
}

type ProfitLine = {
  quantity: number
  unitPriceVnd: number
  lineTotalVnd: number
  catalogCny: number | null
}

type ProfitRow = {
  orderId: string
  orderCode: string
  depositedOn: string
  revenueVnd: number
  merchandiseVnd: number
  returned: boolean
  uncollectedVnd: number
  lines: ProfitLine[]
  catalogGoodsCny: number | null
  goodsVnd: number
  usesChinaShip: boolean
  importStored: boolean
  goodsTouched: boolean
  goods: string
  shipChina: string
  shipBorder: string
  shipHanoi: string
  hadGoodsOverride: boolean
  hadShipChina: boolean
  hadShipBorder: boolean
  hadShipHanoi: boolean
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )
}

function formatCny(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount)} ¥`
}

function amountOrNull(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function sameAmount(raw: string, expected: number): boolean {
  const n = amountOrNull(raw)
  return n != null && Math.abs(n - expected) < 0.0001
}

function goodsOverridden(raw: string, catalog: number | null): boolean {
  const n = amountOrNull(raw)
  if (catalog == null) return n != null
  if (n == null) return false
  return Math.abs(n - catalog) > 0.0001
}

function numText(value: number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

function goodsFromLines(lines: ProfitLine[], rate: number | null, merchandiseVnd: number): number | null {
  if (rate == null || rate <= 0) return null
  const fromMerchandise = () => {
    if (!(merchandiseVnd > 0)) return null
    const cny = listingVndToCny(merchandiseVnd, rate)
    return cny == null ? null : Math.round(cny * 100) / 100
  }
  if (!lines.length) return fromMerchandise()
  let total = 0
  for (const line of lines) {
    if (line.catalogCny != null && line.quantity > 0) {
      total += line.catalogCny * line.quantity
      continue
    }
    if (line.unitPriceVnd > 0 && line.quantity > 0) {
      const cny = listingVndToCny(line.unitPriceVnd, rate)
      if (cny == null) return fromMerchandise()
      total += cny * line.quantity
      continue
    }
    if (line.lineTotalVnd > 0) {
      const cny = listingVndToCny(line.lineTotalVnd, rate)
      if (cny == null) return fromMerchandise()
      total += cny
      continue
    }
    return fromMerchandise()
  }
  return Math.round(total * 100) / 100
}

function rowsFromSheet(sheet: PartnerOrderProfitSheet): ProfitRow[] {
  return sheet.orders.map((order: ProfitSheetOrder) => ({
    orderId: order.orderId,
    orderCode: order.orderCode,
    depositedOn: order.depositedOn,
    revenueVnd: order.revenueVnd,
    merchandiseVnd: order.merchandiseVnd,
    returned: order.returned,
    uncollectedVnd: order.uncollectedVnd,
    lines: order.lines.map((line) => ({
      quantity: line.quantity,
      unitPriceVnd: line.unitPriceVnd,
      lineTotalVnd: line.lineTotalVnd,
      catalogCny: line.catalogCny,
    })),
    catalogGoodsCny: order.catalogGoodsCny,
    goodsVnd: order.goodsVnd,
    usesChinaShip: order.usesChinaShip,
    importStored: order.importStored,
    goodsTouched: false,
    goods: numText(order.goodsCnyOverride ?? order.catalogGoodsCny),
    shipChina: numText(order.shipChinaOverride ?? (order.usesChinaShip ? sheet.shipChinaDomesticCny : 0)),
    shipBorder: numText(order.shipBorderOverride ?? (order.usesChinaShip ? sheet.shipBorderToHanoiCny : 0)),
    shipHanoi: numText(order.shipHanoiOverride ?? sheet.shipHanoiToCustomerVnd),
    hadGoodsOverride: order.goodsCnyOverride != null,
    hadShipChina: order.shipChinaOverride != null,
    hadShipBorder: order.shipBorderOverride != null,
    hadShipHanoi: order.shipHanoiOverride != null,
  }))
}

function chinaShipCny(row: ProfitRow): number | null {
  const china = amountOrNull(row.shipChina)
  const border = amountOrNull(row.shipBorder)
  if (china == null || border == null) return null
  return china + border
}

function lineCny(row: ProfitRow, rate: number | null): number | null {
  const goods = amountOrNull(row.goods)
  const hanoi = amountOrNull(row.shipHanoi)
  const ship = chinaShipCny(row)
  if (ship == null || hanoi == null) return null
  if (row.usesChinaShip && (goods == null || rate == null || rate <= 0)) return null
  const cnyGoods = goods ?? 0
  const hanoiCny = row.usesChinaShip && rate != null && rate > 0 ? hanoi / rate : 0
  return cnyGoods + ship + hanoiCny
}

function lineCost(row: ProfitRow, rate: number | null): number | null {
  const goods = amountOrNull(row.goods)
  const hanoi = amountOrNull(row.shipHanoi)
  const ship = chinaShipCny(row)
  if (ship == null || hanoi == null) return null
  if (row.usesChinaShip && goods == null) return null
  const cnyGoods = goods ?? 0
  const needsRate = row.usesChinaShip || cnyGoods > 0 || ship > 0
  if (needsRate && (rate == null || rate <= 0)) return null
  return row.goodsVnd + (cnyGoods + ship) * (rate ?? 0) + hanoi
}

function rowNeedsSave(row: ProfitRow, china: number, border: number, hanoi: number): boolean {
  return (
    goodsOverridden(row.goods, row.catalogGoodsCny) ||
    !sameAmount(row.shipChina, china) ||
    !sameAmount(row.shipBorder, border) ||
    !sameAmount(row.shipHanoi, hanoi) ||
    row.hadGoodsOverride ||
    row.hadShipChina ||
    row.hadShipBorder ||
    row.hadShipHanoi
  )
}

export function PartnerOrderProfitSection({
  partnerId,
  locale = 'vi',
  dateFrom,
  dateTo,
  refreshKey,
  adSpend,
  adSpendState,
  onSummaryChange,
}: {
  partnerId: string
  locale?: WebLocale
  dateFrom: string
  dateTo: string
  refreshKey: number
  adSpend: number | null
  adSpendState: AdSpendState
  onSummaryChange?: (summary: AdSpendProfitSummary) => void
}) {
  const copy = adSpendPageCopy(locale)
  const [rate, setRate] = useState('')
  const [shipChina, setShipChina] = useState('0')
  const [shipBorder, setShipBorder] = useState('0')
  const [shipHanoi, setShipHanoi] = useState('0')
  const [rows, setRows] = useState<ProfitRow[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const applySheet = (sheet: PartnerOrderProfitSheet) => {
    setRate(numText(sheet.vndPerCny))
    setShipChina(numText(sheet.shipChinaDomesticCny))
    setShipBorder(numText(sheet.shipBorderToHanoiCny))
    setShipHanoi(numText(sheet.shipHanoiToCustomerVnd))
    setRows(rowsFromSheet(sheet))
    setTruncated(sheet.truncated)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    const res = await fetchMyMessagingOrderProfitSheet({ partnerId, dateFrom, dateTo })
    if ('error' in res) setError(res.error)
    else applySheet(res.sheet)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchMyMessagingOrderProfitSheet({ partnerId, dateFrom, dateTo }).then((res) => {
      if (cancelled) return
      if ('error' in res) setError(res.error)
      else applySheet(res.sheet)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [partnerId, dateFrom, dateTo, refreshKey])

  const rateNumber = amountOrNull(rate)
  const chinaDefault = amountOrNull(shipChina)
  const borderDefault = amountOrNull(shipBorder)
  const hanoiDefault = amountOrNull(shipHanoi)

  useEffect(() => {
    if (rateNumber == null || rateNumber <= 0) return
    setRows((prev) =>
      prev.map((row) => {
        if (row.importStored || row.hadGoodsOverride || row.goodsTouched) return row
        const next = goodsFromLines(row.lines, rateNumber, row.merchandiseVnd)
        if (next == null) {
          if (!row.goods && row.catalogGoodsCny == null) return row
          return { ...row, catalogGoodsCny: null, goods: '' }
        }
        if (row.catalogGoodsCny === next && sameAmount(row.goods, next)) return row
        return { ...row, catalogGoodsCny: next, goods: numText(next) }
      }),
    )
  }, [rateNumber])

  const summary = useMemo(() => {
    const revenue = rows.reduce((sum, row) => sum + row.revenueVnd, 0)
    const returnedCount = rows.reduce((sum, row) => sum + (row.returned ? 1 : 0), 0)
    const uncollected = rows.reduce((sum, row) => sum + (row.returned ? row.uncollectedVnd : 0), 0)
    let goodsSum = 0
    let goodsMissing = 0
    for (const row of rows) {
      const goods = amountOrNull(row.goods)
      if (goods == null) goodsMissing += 1
      else goodsSum += goods
    }
    const revenueCny = goodsMissing === 0 ? goodsSum : null
    let cost = 0
    let missing = 0
    for (const row of rows) {
      const line = lineCost(row, rateNumber)
      if (line == null) missing += 1
      else cost += line
    }
    const costReady = missing === 0
    const gross = costReady ? revenue - cost : null
    const profit = costReady && adSpendState === 'ready' && adSpend != null ? revenue - cost - adSpend : null
    return { revenue, revenueCny, returnedCount, uncollected, cost: costReady ? cost : null, missing, gross, profit }
  }, [rows, rateNumber, adSpend, adSpendState])

  useEffect(() => {
    onSummaryChange?.({
      dateFrom,
      dateTo,
      loading,
      orderCount: rows.length,
      revenue: summary.revenue,
      revenueCny: summary.revenueCny,
      returnedCount: summary.returnedCount,
      uncollected: summary.uncollected,
      cost: summary.cost,
      missing: summary.missing,
      gross: summary.gross,
      profit: summary.profit,
    })
  }, [dateFrom, dateTo, loading, rows.length, summary, onSummaryChange])

  const patchRow = (orderId: string, patch: Partial<ProfitRow>) => {
    setRows((prev) => prev.map((row) => (row.orderId === orderId ? { ...row, ...patch } : row)))
  }

  const onDefault = (field: 'shipChina' | 'shipBorder' | 'shipHanoi', value: string) => {
    const previous = field === 'shipChina' ? shipChina : field === 'shipBorder' ? shipBorder : shipHanoi
    if (field === 'shipChina') setShipChina(value)
    if (field === 'shipBorder') setShipBorder(value)
    if (field === 'shipHanoi') setShipHanoi(value)
    setRows((prev) =>
      prev.map((row) => {
        if ((field === 'shipChina' || field === 'shipBorder') && !row.usesChinaShip && !row.hadShipChina && !row.hadShipBorder) {
          return row
        }
        return row[field] === previous ? { ...row, [field]: value } : row
      }),
    )
  }

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (rateNumber == null || rateNumber <= 0 || chinaDefault == null || borderDefault == null || hanoiDefault == null) {
      setError(copy.badMoney)
      return
    }
    const invalid = rows.some((row) => {
      if (row.goods.trim() && amountOrNull(row.goods) == null) return true
      return amountOrNull(row.shipChina) == null || amountOrNull(row.shipBorder) == null || amountOrNull(row.shipHanoi) == null
    })
    if (invalid) {
      setError(copy.badCell)
      return
    }
    const orders = rows
      .filter((row) => rowNeedsSave(row, chinaDefault, borderDefault, hanoiDefault))
      .map((row) => ({
        orderId: row.orderId,
        goodsCny: goodsOverridden(row.goods, row.catalogGoodsCny) ? amountOrNull(row.goods) : null,
        shipChinaDomesticCny: sameAmount(row.shipChina, chinaDefault) ? null : amountOrNull(row.shipChina),
        shipBorderToHanoiCny: sameAmount(row.shipBorder, borderDefault) ? null : amountOrNull(row.shipBorder),
        shipHanoiToCustomerVnd: sameAmount(row.shipHanoi, hanoiDefault) ? null : amountOrNull(row.shipHanoi),
      }))
    setSaving(true)
    setError(null)
    const saved = await saveMyMessagingOrderProfitInputs({
      partnerId,
      dateFrom,
      dateTo,
      vndPerCny: rateNumber,
      shipChinaDomesticCny: chinaDefault,
      shipBorderToHanoiCny: borderDefault,
      shipHanoiToCustomerVnd: hanoiDefault,
      orders,
    })
    setSaving(false)
    if ('error' in saved) {
      setError(saved.error)
      return
    }
    applySheet(saved.sheet)
    setNotice(copy.savedRates)
    window.setTimeout(() => setNotice(null), 4000)
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900" aria-label={copy.profitTitle}>
      <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{copy.profitTitle}</h3>
        <p className="mt-1 text-xs text-slate-500">{copy.profitBody}</p>
      </div>
      {error ? (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={() => void load()}>
            {copy.retry}
          </button>
        </div>
      ) : null}
      {notice ? <div className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
      {loading ? <p className="px-4 py-6 text-sm text-slate-500">{copy.loadingOrders}</p> : null}
      {!loading ? (
        <form onSubmit={onSave} className="space-y-4 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RateField label={copy.rate} value={rate} step="0.0001" onChange={setRate} />
            <RateField label={copy.shipChina} value={shipChina} step="0.01" onChange={(value) => onDefault('shipChina', value)} />
            <RateField label={copy.shipBorder} value={shipBorder} step="0.01" onChange={(value) => onDefault('shipBorder', value)} />
            <RateField label={copy.shipHanoi} value={shipHanoi} step="1" onChange={(value) => onDefault('shipHanoi', value)} />
          </div>
          <p className="text-xs text-slate-500">{copy.shipNote}</p>
          {summary.missing > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {fillCopy(copy.missingGoods, { n: summary.missing })}
            </div>
          ) : null}
          {truncated ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{copy.truncated}</div> : null}
          {rows.length === 0 ? <p className="text-sm text-slate-500">{copy.noOrders}</p> : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2 font-medium">{copy.colOrder}</th>
                    <th className="px-3 py-2 font-medium">{copy.colDate}</th>
                    <th className="px-3 py-2 font-medium">{copy.colRevenue}</th>
                    <th className="px-3 py-2 font-medium">{copy.colGoods}</th>
                    <th className="px-3 py-2 font-medium">{copy.colImport}</th>
                    <th className="px-3 py-2 font-medium">{copy.colShipChina}</th>
                    <th className="px-3 py-2 font-medium">{copy.colShipBorder}</th>
                    <th className="px-3 py-2 font-medium">{copy.colShipHanoi}</th>
                    <th className="px-3 py-2 font-medium">{copy.colCny}</th>
                    <th className="px-3 py-2 font-medium">{copy.colCost}</th>
                    <th className="px-3 py-2 font-medium">{copy.colGross}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cny = lineCny(row, rateNumber)
                    const cost = lineCost(row, rateNumber)
                    const gross = cost == null ? null : row.revenueVnd - cost
                    return (
                      <tr key={row.orderId} className="border-t border-slate-100 dark:border-zinc-800">
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-zinc-100">{row.orderCode}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-zinc-300">{row.depositedOn || copy.dash}</td>
                        <td className="px-3 py-2 whitespace-nowrap" title={row.returned ? copy.returnedTitle : copy.revenueTitle}>
                          {formatVnd(row.revenueVnd)}
                          {row.returned ? (
                            <p className="mt-0.5 text-[11px] font-normal text-amber-700">
                              {fillCopy(copy.returnedLine, { amount: formatVnd(row.uncollectedVnd) })}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={fillCopy(copy.goodsAria, { code: row.orderCode })}
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.goods}
                            placeholder={row.catalogGoodsCny == null ? copy.goodsPlaceholder : undefined}
                            onChange={(event) => patchRow(row.orderId, { goods: event.target.value, goodsTouched: true })}
                            className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatVnd(row.goodsVnd)}</td>
                        <td className="px-3 py-2">
                          <input aria-label={fillCopy(copy.shipChinaAria, { code: row.orderCode })} type="number" min="0" step="0.01" value={row.shipChina} onChange={(event) => patchRow(row.orderId, { shipChina: event.target.value })} className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950" />
                        </td>
                        <td className="px-3 py-2">
                          <input aria-label={fillCopy(copy.shipBorderAria, { code: row.orderCode })} type="number" min="0" step="0.01" value={row.shipBorder} onChange={(event) => patchRow(row.orderId, { shipBorder: event.target.value })} className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950" />
                        </td>
                        <td className="px-3 py-2">
                          <input aria-label={fillCopy(copy.shipHanoiAria, { code: row.orderCode })} type="number" min="0" step="1" value={row.shipHanoi} onChange={(event) => patchRow(row.orderId, { shipHanoi: event.target.value })} className="w-28 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950" />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{cny == null ? copy.dash : formatCny(cny)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{cost == null ? copy.dash : formatVnd(cost)}</td>
                        <td className={`px-3 py-2 whitespace-nowrap ${gross != null && gross < 0 ? 'text-red-700' : ''}`}>{gross == null ? copy.dash : formatVnd(gross)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button type="submit" disabled={saving} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {saving ? copy.savingRates : copy.saveRates}
          </button>
        </form>
      ) : null}
    </section>
  )
}

function RateField({
  label,
  value,
  step,
  onChange,
}: {
  label: string
  value: string
  step: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm text-slate-700 dark:text-zinc-200">
      {label}
      <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" />
    </label>
  )
}
