'use client'

import { cn } from '@/lib/utils'
import { listWeddingButtonColors, type WeddingButtonColorId } from '@/lib/wedding/wedding-button-colors'

export function WeddingButtonColorPicker(props: {
  value: WeddingButtonColorId
  label: string
  hint: string
  names: Record<WeddingButtonColorId, string>
  onChange: (id: WeddingButtonColorId) => void
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900">{props.label}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{props.hint}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={props.label}>
        {listWeddingButtonColors().map((color) => {
          const selected = color.id === props.value
          const name = props.names[color.id]
          return (
            <button
              key={color.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              onClick={() => props.onChange(color.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border bg-white px-2.5 py-1 text-xs font-medium',
                selected ? 'border-slate-900 text-slate-950 ring-2 ring-slate-900/15' : 'border-slate-200 text-slate-600',
              )}
            >
              <span
                aria-hidden
                className="h-5 w-5 rounded-full border"
                style={{ backgroundColor: color.swatch, borderColor: color.border }}
              />
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
