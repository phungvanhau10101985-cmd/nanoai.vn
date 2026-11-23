'use client'

import { formatScanClock } from '@/lib/lop/scan-wait'

export function ScanWaitClock({
  remainingMs,
  label,
  dark = false,
}: {
  remainingMs: number
  label: string
  dark?: boolean
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <p className={`font-mono text-3xl tabular-nums ${dark ? 'text-slate-100' : 'text-slate-900'}`}>
        {formatScanClock(remainingMs)}
      </p>
      <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
    </div>
  )
}
