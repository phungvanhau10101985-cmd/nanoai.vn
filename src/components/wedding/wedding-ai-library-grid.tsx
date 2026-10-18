'use client'

import { useState } from 'react'
import { Eye, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import { cn } from '@/lib/utils'

export type WeddingAiLibraryTile = {
  id: string
  imageUrl: string
}

export type WeddingAiLibraryPreviewCopy = {
  openLabel: string
  title: string
  selectLabel: string
  backLabel: string
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
  /** Khi có: bấm ảnh hoặc nút chỉ mở xem lớn. Chọn nền nằm trong cửa sổ xem trước. */
  preview?: WeddingAiLibraryPreviewCopy
  onPreviewChange?: (open: boolean) => void
}) {
  const [previewItem, setPreviewItem] = useState<T | null>(null)
  const openPreview = (item: T) => {
    setPreviewItem(item)
    props.onPreviewChange?.(true)
  }
  const closePreview = () => {
    setPreviewItem(null)
    props.onPreviewChange?.(false)
  }
  if (!props.recommended.length && !props.rest.length) {
    return <p className="rounded-xl bg-muted px-3 py-4 text-center text-xs text-muted-foreground">{props.emptyLabel}</p>
  }
  if (previewItem && props.preview) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[#fffaf2]">
          <img src={previewItem.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" className="h-12 shrink-0 px-4" disabled={props.disabled} onClick={closePreview}>
            {props.preview.backLabel}
          </Button>
          <Button
            type="button"
            className="h-12 min-w-0 flex-1 text-base"
            disabled={props.disabled}
            onClick={() => {
              const item = previewItem
              closePreview()
              props.onSelect(item)
            }}
          >
            {props.busyId === previewItem.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {props.preview.selectLabel}
          </Button>
        </div>
      </div>
    )
  }
  const sectionProps = {
    selectedUrl: props.selectedUrl,
    onSelect: props.onSelect,
    disabled: props.disabled,
    busyId: props.busyId,
    preview: props.preview,
    onPreview: openPreview,
  }
  return (
    <div className="space-y-4">
      <LibrarySection label={props.recommendedLabel} items={props.recommended} {...sectionProps} />
      <LibrarySection label={props.libraryLabel} items={props.rest} {...sectionProps} />
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
  preview?: WeddingAiLibraryPreviewCopy
  onPreview: (item: T) => void
}) {
  if (!props.items.length) return null
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{props.label}</p>
      <div className="grid grid-cols-3 gap-2">
        {props.items.map((item) => {
          const active = Boolean(props.selectedUrl && props.selectedUrl === item.imageUrl)
          return (
            <div
              key={item.id}
              className={cn(
                'relative overflow-hidden rounded-xl border bg-[#fffaf2]',
                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
              )}
            >
              {props.preview ? (
                <button
                  type="button"
                  disabled={props.disabled}
                  onClick={() => props.onPreview(item)}
                  className="block w-full disabled:cursor-not-allowed"
                >
                  <img src={item.imageUrl} alt="" className="h-24 w-full object-contain" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={props.disabled}
                  onClick={() => props.onSelect(item)}
                  className="block w-full disabled:cursor-not-allowed"
                >
                  <img src={item.imageUrl} alt="" className="h-24 w-full object-contain" />
                </button>
              )}
              {props.preview ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-11 w-full flex-col gap-0.5 rounded-none px-1 py-1.5 text-xs leading-tight"
                  disabled={props.disabled}
                  onClick={() => props.onPreview(item)}
                >
                  <Eye className="h-4 w-4 shrink-0" />
                  {props.preview.openLabel}
                </Button>
              ) : null}
              {props.busyId === item.id ? (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
                </span>
              ) : null}
            </div>
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
        <WeddingDeviceFileInput
          disabled={props.disabled}
          className={cn('gap-2 rounded-xl border border-dashed px-3 py-2 text-sm hover:bg-muted', props.disabled && 'opacity-50')}
          label={
            <>
              <Upload className="h-4 w-4" />
              {props.uploadLabel}
            </>
          }
          onFiles={(files) => {
            const file = files[0]
            if (file) props.onUpload(file)
          }}
        />
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
