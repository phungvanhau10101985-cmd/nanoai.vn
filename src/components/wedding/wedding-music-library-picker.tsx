'use client'

import { cn } from '@/lib/utils'
import type { WeddingMusicLibraryRow } from '@/lib/db/wedding-cards-pg'

export function WeddingMusicLibraryPicker(props: {
  items: WeddingMusicLibraryRow[]
  selectedUrl: string
  credit: string
  onSelect: (audioUrl: string) => void
}) {
  if (!props.items.length) return null
  const showCredit = props.items.some((item) => item.credit)
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {props.items.map((item) => {
          const selected = props.selectedUrl === item.audioUrl
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onSelect(item.audioUrl)}
              className={cn(
                'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                selected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
              )}
              aria-pressed={selected}
            >
              {item.title}
            </button>
          )
        })}
      </div>
      {showCredit ? <p className="text-xs text-muted-foreground">{props.credit}</p> : null}
    </div>
  )
}
