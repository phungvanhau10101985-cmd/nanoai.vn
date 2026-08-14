'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { Loader2, Users } from 'lucide-react'

/**
 * M2.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — CRM nhẹ: khách đã đăng ký tài khoản shop.
 * Khác `PartnerWebsiteLeadsPanel` (lead form, chưa chắc đã tạo tài khoản).
 */

type CustomerRow = {
  emailNormalized: string
  customerName: string
  customerPhone: string
  orderCount: number
  completedOrderCount: number
  totalSpent: number
  firstOrderAt: string
  lastOrderAt: string
}

function formatVnd(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
}

export function PartnerWebsiteCustomersPanel({ locale, t, partnerId, sectionId }: Props) {
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const basePath = `/api/messaging/partners/${encodeURIComponent(partnerId)}/customers`

  const load = useCallback(
    async (pageArg: number, searchArg: string, append: boolean) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({ page: String(pageArg), pageSize: '20' })
        if (searchArg.trim()) qs.set('search', searchArg.trim())
        const res = await fetch(`${basePath}?${qs.toString()}`)
        const json = (await res.json().catch(() => null)) as { customers?: CustomerRow[]; total?: number } | null
        setTotal(json?.total ?? 0)
        setRows((prev) => (append ? [...prev, ...(json?.customers ?? [])] : json?.customers ?? []))
      } finally {
        setLoading(false)
      }
    },
    [basePath]
  )

  useEffect(() => {
    void load(1, '', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])

  return (
    <Card id={sectionId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t.customersTitle} {total > 0 ? `(${total})` : ''}
        </CardTitle>
        <CardDescription>{t.customersHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1)
              void load(1, search, false)
            }
          }}
          placeholder={t.customersSearchPlaceholder}
        />

        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> ...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">{t.customersEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">{t.customersName}</th>
                  <th className="py-2 pr-3">{t.customersPhone}</th>
                  <th className="py-2 pr-3">{t.customersEmail}</th>
                  <th className="py-2 pr-3 text-right">{t.customersOrderCount}</th>
                  <th className="py-2 pr-3 text-right">{t.customersCompletedCount}</th>
                  <th className="py-2 pr-3 text-right">{t.customersTotalSpent}</th>
                  <th className="py-2 pr-3">{t.customersLastOrder}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.emailNormalized} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium">{row.customerName || '—'}</td>
                    <td className="py-2 pr-3">{row.customerPhone || '—'}</td>
                    <td className="py-2 pr-3 text-gray-500">{row.emailNormalized}</td>
                    <td className="py-2 pr-3 text-right">{row.orderCount}</td>
                    <td className="py-2 pr-3 text-right">{row.completedOrderCount}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatVnd(row.totalSpent)}</td>
                    <td className="py-2 pr-3 text-gray-500">
                      {row.lastOrderAt ? new Date(row.lastOrderAt).toLocaleDateString(locale) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length < total ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              const next = page + 1
              setPage(next)
              void load(next, search, true)
            }}
          >
            {t.customersLoadMore}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
