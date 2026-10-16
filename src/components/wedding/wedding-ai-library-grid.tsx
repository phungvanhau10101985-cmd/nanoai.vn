'use client'

import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type WeddingAiLibraryTile = {
  id: string
  imageUrl: string
}

export function WeddingAiLibraryGrid<T extends WeddingAiLibraryTile>(props: {
  recommended: T[]
  rest: T[]
  selectedUrl?: string
  onSelect: (item: T) => void
  recommendedLabel: string
  libraryLabel: string
  emptyLabel: string
  disabled?: boolean
  busyId?: string | null
}) {
  if (!props.recommended.length && !props.rest.length) {
    return <p className="rounded-xl bg-muted px-3 py-4 text-center text-xs text-muted-foreground">{props.emptyLabel}</p>
  }
  return (
    <div className="space-y-4">
      <LibrarySection
        label={props.recommendedLabel}
        items={props.recommended}
        selectedUrl={props.selectedUrl}
        onSelect={props.onSelect}
        disabled={props.disabled}
        busyId={props.busyId}
      />
      <LibrarySection
        label={props.libraryLabel}
        items={props.rest}
        selectedUrl={props.selectedUrl}
        onSelect={props.onSelect}
        disabled={props.disabled}
        busyId={props.busyId}
      />
    </div>
  )
}

function LibrarySection<T extends WeddingAiLibraryTile>(props: {
  label: string
  items: T[]
  selectedUrl?: string
  onSelect: (item: T) => void
  disabled?: boolean
  busyId?: string | null
}) {
  if (!props.items.length) return null
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <div className="grid grid-cols-3 gap-2">
        {props.items.map((item) => {
          const active = Boolean(props.selectedUrl && props.selectedUrl === item.imageUrl)
          return (
            <button
              key={item.id}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onSelect(item)}
              className={cn(
                'relative overflow-hidden rounded-xl border bg-[#fffaf2]',
                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
              )}
            >
              <img src={item.imageUrl} alt="" className="h-24 w-full object-contain" />
              {props.busyId === item.id ? (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function WeddingReferenceChoice(props: {
  label: string
  hint: string
  emptyLabel: string
  uploadLabel: string
  libraryLabel: string
  removeLabel: string
  previewUrl: string
  disabled?: boolean
  onUpload: (file: File) => void
  onOpenLibrary: () => void
  onClear: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed p-4">
      <Label>{props.label}</Label>
      <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>
      {props.previewUrl ? (
        <img src={props.previewUrl} alt="" className="mt-3 max-h-40 w-full rounded-xl bg-[#fffaf2] object-contain" />
      ) : (
        <div className="mt-3 flex min-h-24 items-center justify-center rounded-xl bg-muted px-3 text-center text-sm text-muted-foreground">
          {props.emptyLabel}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted', props.disabled && 'pointer-events-none opacity-50')}>
          <Upload className="h-4 w-4" />
          {props.uploadLabel}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={props.disabled}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) props.onUpload(file)
            }}
          />
        </label>
        <Button type="button" variant="outline" size="sm" disabled={props.disabled} onClick={props.onOpenLibrary}>
          {props.libraryLabel}
        </Button>
        {props.previewUrl ? (
          <Button type="button" variant="outline" size="sm" disabled={props.disabled} onClick={props.onClear}>
            {props.removeLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
