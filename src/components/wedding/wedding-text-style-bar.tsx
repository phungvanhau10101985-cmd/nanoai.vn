'use client'

import { WEDDING_TEXT_COLORS, WEDDING_TEXT_SIZES } from '@/lib/wedding/wedding-text-style'
import type { WeddingTextFont, WeddingTextStyle } from '@/lib/wedding/wedding-section-config'

export function WeddingTextStyleBar(props: {
  title: string
  style: WeddingTextStyle
  sizeLabel: string
  fontLabel: string
  colorLabel: string
  fonts: { id: WeddingTextFont; label: string }[]
  onChange: (patch: Partial<WeddingTextStyle>) => void
  onClose: () => void
}) {
  return (
    <div
      data-wedding-text-bar=""
      className="fixed inset-x-3 bottom-4 z-[130] mx-auto flex max-w-xl flex-col gap-2 rounded-2xl border border-rose-200 bg-white/95 p-3 text-stone-800 shadow-lg"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{props.title}</p>
        <button type="button" className="h-8 rounded-full px-3 text-sm text-stone-500" onClick={props.onClose}>
          ×
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="w-16 shrink-0 text-xs font-medium">{props.sizeLabel}</span>
        {WEDDING_TEXT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={props.style.size === size}
            className={props.style.size === size ? 'h-8 rounded-full bg-neutral-900 px-2.5 text-xs font-semibold text-white' : 'h-8 rounded-full bg-stone-100 px-2.5 text-xs'}
            onClick={() => props.onChange({ size })}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="w-16 shrink-0 text-xs font-medium">{props.fontLabel}</span>
        {props.fonts.map((font) => (
          <button
            key={font.id}
            type="button"
            aria-pressed={props.style.font === font.id}
            className={props.style.font === font.id ? 'h-8 rounded-full bg-neutral-900 px-2.5 text-xs font-semibold text-white' : 'h-8 rounded-full bg-stone-100 px-2.5 text-xs'}
            onClick={() => props.onChange({ font: font.id })}
          >
            {font.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="w-16 shrink-0 text-xs font-medium">{props.colorLabel}</span>
        {WEDDING_TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={props.style.color === color}
            className="h-8 w-8 rounded-full border border-stone-300"
            style={{ background: color, outline: props.style.color === color ? '2px solid #111' : undefined, outlineOffset: 2 }}
            onClick={() => props.onChange({ color })}
          />
        ))}
      </div>
    </div>
  )
}
