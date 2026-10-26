'use client'

import { cn } from '@/lib/utils'
import type { WeddingHeroPhotoLayout } from '@/lib/wedding/wedding-section-config'

function LayoutSketch(props: { layout: WeddingHeroPhotoLayout }) {
  if (props.layout === 'stack') {
    return (
      <span className="relative block h-14 w-16 shrink-0" aria-hidden>
        <span className="absolute left-0 top-1 h-9 w-7 -rotate-6 border-2 border-[#9caf8a] bg-white" />
        <span className="absolute bottom-1 right-0 h-9 w-7 rotate-3 border-2 border-[#9caf8a] bg-[#f7f6f2]" />
      </span>
    )
  }
  return (
    <span className="relative block h-14 w-16 shrink-0" aria-hidden>
      <span className="absolute left-1/2 top-1 h-12 w-9 -translate-x-1/2 rounded-full border-2 border-rose-300 bg-white" />
    </span>
  )
}

export function WeddingHeroLayoutPicker(props: {
  value: WeddingHeroPhotoLayout
  label: string
  hint: string
  singleLabel: string
  singleHint: string
  stackLabel: string
  stackHint: string
  onChange: (layout: WeddingHeroPhotoLayout) => void
}) {
  const options: { id: WeddingHeroPhotoLayout; title: string; hint: string }[] = [
    { id: 'single', title: props.singleLabel, hint: props.singleHint },
    { id: 'stack', title: props.stackLabel, hint: props.stackHint },
  ]
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-950">{props.label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{props.hint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = props.value === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => props.onChange(option.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2 text-left',
                selected ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200' : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <LayoutSketch layout={option.id} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-950">{option.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
