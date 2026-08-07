'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BadgePercent, Banknote, Loader2, ShoppingCart, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Database } from '@/types/database.types'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']

type AnalyticsResponse = {
  dateFrom: string
  dateTo: string
  summary: {
    totalRevenue: number
    completedOrderCount: number
    totalOrderCount: number
    avgOrderValue: number
    estimatedVisitors: number
    estimatedConversionRatePercent: number
  }
  byDay: Array<{ date: string; revenue: number; orderCount: number }>
  byUtmSource: Array<{ utmSource: string; utmCampaign: string; revenue: number; orderCount: number }>
  topProducts: Array<{ productKey: string; productName: string; revenue: number; quantity: number }>
}

function formatVnd(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`
}

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const toIso = (d: Date) => d.toISOString().slice(0, 10)
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  return { dateFrom: toIso(from), dateTo: toIso(now) }
}

type Props = {
  initialPartners: PartnerRow[]
  analyticsT: Dictionary['partnerMessagingAnalytics']
  locale: WebLocale
}

export function PartnerMessagingAnalyticsClient({ initialPartners, analyticsT: t }: Props) {
  const partners = useMemo(() => initialPartners.filter((p) => p.is_active !== false), [initialPartners])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(partners[0]?.id ?? '')
  const defaults = useMemo(() => defaultDateRange(), [])
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom)
  const [dateTo, setDateTo] = useState(defaults.dateTo)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!selectedPartnerId) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ dateFrom, dateTo })
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(selectedPartnerId)}/revenue-analytics?${qs.toString()}`)
      const json = (await res.json().catch(() => null)) as AnalyticsResponse | null
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [selectedPartnerId, dateFrom, dateTo])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId])

  if (partners.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.allWorkspaces}</p>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label className="text-xs font-medium">{t.allWorkspaces}</Label>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || p.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t.dateFrom}</Label>
            <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t.dateTo}</Label>
            <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {t.applyFilter}
          </Button>
        </CardContent>
      </Card>

      {!data ? (
        loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> ...
          </div>
        ) : null
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className="border-emerald-200/70 bg-emerald-50/40 dark:bg-emerald-500/5">
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" /> {t.statRevenue}
                </div>
                <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatVnd(data.summary.totalRevenue)}
                </p>
                <p className="text-[11px] text-muted-foreground">{t.statRevenueHint}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" /> {t.statOrders}
                </div>
                <p className="text-lg font-semibold">{data.summary.totalOrderCount}</p>
                <p className="text-[11px] text-muted-foreground">{t.statOrdersHint}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" /> {t.statAvgOrderValue}
                </div>
                <p className="text-lg font-semibold">{formatVnd(data.summary.avgOrderValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {t.statVisitors}
                </div>
                <p className="text-lg font-semibold">{data.summary.estimatedVisitors}</p>
                <p className="text-[11px] text-muted-foreground">{t.statVisitorsHint}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BadgePercent className="h-3.5 w-3.5" /> {t.statConversionRate}
                </div>
                <p className="text-lg font-semibold">{data.summary.estimatedConversionRatePercent}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-4">
              <h3 className="mb-3 text-sm font-semibold">{t.revenueByDayTitle}</h3>
              {data.byDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noData}</p>
              ) : (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.byDay}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))} />
                      <Tooltip formatter={(value) => formatVnd(Number(value) || 0)} labelFormatter={(d) => d} />
                      <Bar dataKey="revenue" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-4">
                <h3 className="mb-3 text-sm font-semibold">{t.revenueByUtmTitle}</h3>
                {data.byUtmSource.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noData}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.utmSourceColumn}</TableHead>
                        <TableHead>{t.utmCampaignColumn}</TableHead>
                        <TableHead className="text-right">{t.ordersColumn}</TableHead>
                        <TableHead className="text-right">{t.revenueColumn}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byUtmSource.map((row, i) => (
                        <TableRow key={`${row.utmSource}-${row.utmCampaign}-${i}`}>
                          <TableCell className="font-medium">{row.utmSource}</TableCell>
                          <TableCell className="text-muted-foreground">{row.utmCampaign || '—'}</TableCell>
                          <TableCell className="text-right">{row.orderCount}</TableCell>
                          <TableCell className="text-right font-semibold">{formatVnd(row.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <h3 className="mb-3 text-sm font-semibold">{t.topProductsTitle}</h3>
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noData}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.productColumn}</TableHead>
                        <TableHead className="text-right">{t.quantityColumn}</TableHead>
                        <TableHead className="text-right">{t.revenueColumn}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts.map((row) => (
                        <TableRow key={row.productKey}>
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right font-semibold">{formatVnd(row.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
