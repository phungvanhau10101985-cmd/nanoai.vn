'use client'

import { Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LocalTextFn } from './types'

/** Cùng dải tốc độ trên trình phát YouTube. 1 là «Bình thường». */
const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

function rateText(rate: number): string {
  return String(rate)
}

export function PlaybackSpeedButton({
  speed,
  onChange,
  localText,
}: {
  speed: number
  onChange: (next: number) => void
  localText: LocalTextFn
}) {
  const current = PLAYBACK_SPEEDS.find((rate) => Math.abs(rate - speed) < 0.001) ?? 1
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold tabular-nums text-slate-900"
          aria-label={localText('Tốc độ phát', 'Playback speed')}
          title={localText('Tốc độ phát', 'Playback speed')}
        >
          {rateText(current)}×
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="z-[120] min-w-[12.5rem] rounded-xl p-1.5 shadow-lg">
        <p className="px-3 pb-1 pt-1.5 text-xs font-semibold text-slate-500">
          {localText('Tốc độ phát', 'Playback speed')}
        </p>
        {PLAYBACK_SPEEDS.map((rate) => {
          const selected = rate === current
          return (
            <DropdownMenuItem
              key={rate}
              className="min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-base"
              onSelect={() => onChange(rate)}
            >
              <Check className={`h-4 w-4 shrink-0 ${selected ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
              <span className={selected ? 'font-semibold' : undefined}>
                {rate === 1 ? localText('Bình thường', 'Normal') : rateText(rate)}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
