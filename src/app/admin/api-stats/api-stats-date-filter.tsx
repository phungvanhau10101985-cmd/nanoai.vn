'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ApiStatsDateFilter({
  defaultFrom,
  defaultTo,
  basePath = '/admin/api-stats',
}: {
  defaultFrom: string
  defaultTo: string
  /** Trang admin áp dụng query `from`/`to` (mặc định thống kê tổng). */
  basePath?: string
}) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const router = useRouter()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = readWebLocaleFromDocumentCookie()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const applyRange = useCallback(
    (from: string, to: string) => {
      const params = new URLSearchParams()
      params.set('from', from)
      params.set('to', to)
      router.push(`${basePath}?${params.toString()}`)
    },
    [router, basePath]
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const from = (form.elements.namedItem('from') as HTMLInputElement)?.value
    const to = (form.elements.namedItem('to') as HTMLInputElement)?.value
    if (from) applyRange(from, to || from)
  }

  const presets = [
    { label: tr('Hôm nay', 'Today', '今天', '今日', '오늘'), getRange: () => {
      const t = new Date()
      const s = toYMD(t)
      return [s, s]
    }},
    { label: tr('7 ngày', '7 days', '7天', '7日', '7일'), getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      return [toYMD(start), toYMD(end)]
    }},
    { label: tr('30 ngày', '30 days', '30天', '30日', '30일'), getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 29)
      return [toYMD(start), toYMD(end)]
    }},
    { label: tr('90 ngày', '90 days', '90天', '90日', '90일'), getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 89)
      return [toYMD(start), toYMD(end)]
    }},
  ]

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {tr('Lọc theo khoảng ngày', 'Filter by date range', '按日期范围筛选', '日付範囲で絞り込み', '날짜 범위로 필터')}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 pb-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">{tr('Từ ngày', 'From', '开始日期', '開始日', '시작일')}</Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={defaultFrom}
              className="h-8 w-[140px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">{tr('Đến ngày', 'To', '结束日期', '終了日', '종료일')}</Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={defaultTo}
              className="h-8 w-[140px]"
            />
          </div>
          <Button type="submit" size="sm" className="h-8">{tr('Xem', 'Apply', '应用', '適用', '적용')}</Button>
        </form>
        <div className="flex flex-wrap gap-2 mt-3">
          {presets.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const [from, to] = p.getRange()
                applyRange(from, to)
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
