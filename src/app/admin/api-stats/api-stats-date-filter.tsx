'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
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
}: {
  defaultFrom: string
  defaultTo: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const applyRange = useCallback(
    (from: string, to: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('from', from)
      params.set('to', to)
      router.push(`/admin/api-stats?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const from = (form.elements.namedItem('from') as HTMLInputElement)?.value
    const to = (form.elements.namedItem('to') as HTMLInputElement)?.value
    if (from) applyRange(from, to || from)
  }

  const presets = [
    { label: 'Hôm nay', getRange: () => {
      const t = new Date()
      const s = toYMD(t)
      return [s, s]
    }},
    { label: '7 ngày', getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      return [toYMD(start), toYMD(end)]
    }},
    { label: '30 ngày', getRange: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 29)
      return [toYMD(start), toYMD(end)]
    }},
    { label: '90 ngày', getRange: () => {
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
          Lọc theo khoảng ngày
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 pb-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">Từ ngày</Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={defaultFrom}
              className="h-8 w-[140px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">Đến ngày</Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={defaultTo}
              className="h-8 w-[140px]"
            />
          </div>
          <Button type="submit" size="sm" className="h-8">Xem</Button>
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
