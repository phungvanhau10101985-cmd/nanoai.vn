'use client'

import { cn } from '@/lib/utils'

const MAX_PARTY = 20

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_PARTY, Math.round(value)))
}

function CountStepper(props: {
  label: string
  value: number
  compact?: boolean
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const size = props.compact ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base'
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <span className={cn('font-semibold text-stone-800', props.compact ? 'text-[9px] leading-tight' : 'text-xs')}>
        {props.label}
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={props.disabled || props.value <= 0}
          onClick={() => props.onChange(clampCount(props.value - 1))}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white font-bold text-stone-800 disabled:opacity-40',
            size,
          )}
          aria-label={`-${props.label}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_PARTY}
          disabled={props.disabled}
          value={props.value}
          onChange={(event) => props.onChange(clampCount(Number(event.target.value)))}
          className={cn(
            'w-full min-w-0 rounded-full border border-stone-300 bg-white text-center font-semibold text-stone-900',
            props.compact ? 'h-7 text-xs' : 'h-9 text-sm',
          )}
        />
        <button
          type="button"
          disabled={props.disabled || props.value >= MAX_PARTY}
          onClick={() => props.onChange(clampCount(props.value + 1))}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white font-bold text-stone-800 disabled:opacity-40',
            size,
          )}
          aria-label={`+${props.label}`}
        >
          +
        </button>
      </span>
    </label>
  )
}

export function WeddingPartyCountFields(props: {
  adultCount: number
  childCount: number
  adultLabel: string
  childLabel: string
  compact?: boolean
  disabled?: boolean
  onChange: (adultCount: number, childCount: number) => void
}) {
  return (
    <div className={cn('w-full', props.compact ? 'max-w-[180px]' : 'max-w-sm')}>
      <div className="flex gap-2">
        <CountStepper
          label={props.adultLabel}
          value={props.adultCount}
          compact={props.compact}
          disabled={props.disabled}
          onChange={(adultCount) => props.onChange(adultCount, props.childCount)}
        />
        <CountStepper
          label={props.childLabel}
          value={props.childCount}
          compact={props.compact}
          disabled={props.disabled}
          onChange={(childCount) => props.onChange(props.adultCount, childCount)}
        />
      </div>
    </div>
  )
}
