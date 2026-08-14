'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type LandingPickerProduct = {
  id: string
  name: string
  sku: string | null
  priceHint: string
  imageUrl: string
}

type Props = {
  partnerId: string
  selected: LandingPickerProduct[]
  onChange: (next: LandingPickerProduct[]) => void
  mode: 'single' | 'multi'
  searchPlaceholder: string
  maxProducts: number
}

export function LandingProductPicker({
  partnerId,
  selected,
  onChange,
  mode,
  searchPlaceholder,
  maxProducts,
}: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LandingPickerProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const qs = new URLSearchParams({ page: '0', pageSize: '20' })
          if (q.trim()) qs.set('q', q.trim())
          const res = await fetch(
            `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/inventory?${qs}`
          )
          const json = (await res.json()) as { rows?: LandingPickerProduct[] }
          setResults(json.rows ?? [])
        } finally {
          setLoading(false)
        }
      })()
    }, 350)
    return () => window.clearTimeout(t)
  }, [partnerId, q])

  const selectedIds = new Set(selected.map((p) => p.id))

  const toggle = (row: LandingPickerProduct) => {
    if (selectedIds.has(row.id)) {
      onChange(selected.filter((p) => p.id !== row.id))
      return
    }
    if (mode === 'single') {
      onChange([row])
      return
    }
    if (selected.length >= maxProducts) return
    onChange([...selected, row])
  }

  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} />
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs"
              onClick={() => onChange(selected.filter((x) => x.id !== p.id))}
            >
              {p.name} ×
            </button>
          ))}
        </div>
      ) : null}
      <div className="max-h-56 overflow-y-auto rounded-md border border-border/70">
        {loading && results.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">…</p>
        ) : (
          results.map((row) => {
            const on = selectedIds.has(row.id)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => toggle(row)}
                className={cn(
                  'flex w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left text-sm last:border-0',
                  on ? 'bg-[color-mix(in_srgb,var(--pw-primary)_10%,transparent)]' : 'hover:bg-muted/50'
                )}
              >
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.imageUrl} alt="" className="h-9 w-9 rounded object-cover" />
                ) : (
                  <span className="h-9 w-9 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.sku || row.priceHint}
                  </span>
                </span>
                <span className="text-xs font-semibold">{on ? '✓' : '+'}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
