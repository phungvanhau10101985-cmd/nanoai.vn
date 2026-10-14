'use client'

import type { ReactNode } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type HomeworkComparePieSlice = {
  name: string
  value: number
  fill: string
}

export type HomeworkComparePieSpec = {
  title: string
  empty: string
  slices: HomeworkComparePieSlice[]
}

function countTip(value: unknown, name: unknown, item: unknown): [string, string] {
  const n = typeof value === 'number' ? value : Number(value)
  const row = item as { payload?: { value?: number } } | undefined
  const sliceValue = typeof row?.payload?.value === 'number' ? row.payload.value : n
  const text = Number.isFinite(sliceValue) ? sliceValue.toLocaleString() : ''
  return [text, String(name ?? '')]
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">{children}</CardContent>
    </Card>
  )
}

function slicePercentLabel(entry: { percent?: number }): string {
  const pct = (entry.percent ?? 0) * 100
  if (pct < 4) return ''
  return `${pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

function OnePie({ spec }: { spec: HomeworkComparePieSpec }) {
  const slices = spec.slices.filter((slice) => slice.value > 0)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <ChartFrame title={spec.title}>
      {total <= 0 ? (
        <p className="flex h-full items-center text-sm text-muted-foreground">{spec.empty}</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="46%"
              outerRadius={104}
              label={slicePercentLabel}
              labelLine
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip formatter={countTip} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  )
}

export function HomeworkCompareCharts({ charts }: { charts: HomeworkComparePieSpec[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map((spec) => (
        <OnePie key={spec.title} spec={spec} />
      ))}
    </div>
  )
}
