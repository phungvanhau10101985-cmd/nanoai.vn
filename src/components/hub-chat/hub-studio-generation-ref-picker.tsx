'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STUDIO_REFERENCE_ATTACH_LIMIT } from '@/lib/hub-chat/hub-studio-reference-limits'

type RefOption = { url: string; label: string; screenKey: string }
type ProductPreview = { url: string; label: string }

export function HubStudioGenerationRefPicker({
  options,
  selectedKeys,
  productPreviews,
  attachUsed,
  attachLimit = STUDIO_REFERENCE_ATTACH_LIMIT,
  busy,
  labels,
  onToggleRef,
  onUploadProduct,
  onRemoveProduct,
}: {
  options: RefOption[]
  selectedKeys: string[]
  productPreviews: ProductPreview[]
  attachUsed?: number
  attachLimit?: number
  busy: boolean
  labels: {
    title: string
    hint: string
    productUpload: string
    attachCount: string
    removeProduct: string
  }
  onToggleRef: (screenKey: string, checked: boolean) => void
  onUploadProduct: (files: FileList) => void
  onRemoveProduct: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const used = attachUsed ?? selectedKeys.length + productPreviews.length
  const atLimit = used >= attachLimit

  return (
    <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 dark:border-sky-900 dark:bg-sky-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-sky-900 dark:text-sky-100">{labels.title}</p>
        <span className="text-[11px] text-muted-foreground">
          {labels.attachCount.replace('{n}', String(used)).replace('{max}', String(attachLimit))}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{labels.hint}</p>

      {options.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((opt) => {
            const checked = selectedKeys.includes(opt.screenKey)
            const disabled = busy || (!checked && atLimit)
            return (
              <label
                key={opt.screenKey}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] ${
                  checked
                    ? 'border-sky-400 bg-white ring-1 ring-sky-300 dark:border-sky-600 dark:bg-slate-900'
                    : 'border-slate-200 bg-white/80 opacity-90 dark:border-slate-700 dark:bg-slate-900/60'
                } ${disabled && !checked ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 accent-sky-600"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => onToggleRef(opt.screenKey, e.target.checked)}
                />
                <Image
                  src={opt.url}
                  alt={opt.label}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded object-cover"
                  unoptimized
                />
                <span className="max-w-[88px] truncate font-medium">{opt.label}</span>
              </label>
            )
          })}
        </div>
      ) : null}

      {productPreviews.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {productPreviews.map((p) => (
            <div
              key={p.url}
              className="relative flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-1.5 py-1 dark:border-emerald-900 dark:bg-slate-900"
            >
              <Image src={p.url} alt={p.label} width={40} height={40} className="h-10 w-10 rounded object-cover" unoptimized />
              <span className="max-w-[72px] truncate text-[10px] text-emerald-800 dark:text-emerald-200">{labels.productUpload}</span>
              <button
                type="button"
                disabled={busy}
                title={labels.removeProduct}
                className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-50"
                onClick={() => onRemoveProduct(p.url)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy || atLimit}
          onChange={(e) => {
            if (e.target.files?.length) onUploadProduct(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-sky-300 text-xs"
          disabled={busy || atLimit}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="mr-1 h-3.5 w-3.5" />
          {labels.productUpload}
        </Button>
      </div>
    </div>
  )
}
