'use client'

import type { WebLocale } from '@/lib/i18n/config'
import {
  labelForWeddingBackgroundPreset,
  WEDDING_BACKGROUND_PRESETS,
  type WeddingBackgroundOrnament,
  type WeddingBackgroundPreset,
} from '@/lib/wedding/wedding-background-presets'
import { WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { weddingOrnamentsForKey } from '@/lib/wedding/wedding-background-ornament-store'
import { cn } from '@/lib/utils'

export function WeddingBackgroundPresetPicker(props: {
  locale: WebLocale
  selectedId?: string
  heading: string
  hint: string
  oneLabel: string
  setLabel: string
  layeredLabel: string
  ornamentLayouts?: Record<string, WeddingBackgroundOrnament[]>
  disabled?: boolean
  onSelect: (preset: WeddingBackgroundPreset) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{props.heading}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{props.hint}</p>
      <div className="grid grid-cols-3 gap-2">
        {WEDDING_BACKGROUND_PRESETS.map((preset) => {
          const active = props.selectedId === preset.id
          const countLabel = preset.ornaments.length
            ? props.layeredLabel
            : preset.plates.length === 1
              ? props.oneLabel
              : props.setLabel.replaceAll('{n}', String(preset.plates.length))
          return (
            <button
              key={preset.id}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onSelect(preset)}
              className={cn(
                'overflow-hidden rounded-xl border bg-[#fffaf2] text-left disabled:cursor-not-allowed',
                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
              )}
            >
              <span className="relative block h-28 overflow-hidden">
                <img src={preset.plates[0]} alt="" className="h-full w-full object-cover object-top" />
                <WeddingBackgroundOrnamentLayer ornaments={weddingOrnamentsForKey(preset.ornaments, props.ornamentLayouts ?? {}, `preset:${preset.id}`)} />
              </span>
              <span className="block px-1.5 pt-1 text-[11px] font-medium leading-tight">
                {labelForWeddingBackgroundPreset(props.locale, preset)}
              </span>
              <span className="block px-1.5 pb-1.5 text-[10px] text-muted-foreground">{countLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
