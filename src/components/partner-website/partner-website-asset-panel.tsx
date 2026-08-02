'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'

export async function uploadPartnerImageFile(partnerId: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.set('partnerId', partnerId)
  fd.set('file', file)
  const res = await fetch('/api/messaging/partner/image', {
    method: 'POST',
    credentials: 'same-origin',
    body: fd,
  })
  const data = (await res.json().catch(() => null)) as { publicUrl?: string; error?: string } | null
  if (!res.ok || !data?.publicUrl) {
    throw new Error(data?.error || 'Upload failed')
  }
  return data.publicUrl
}

function parseUrlLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\//i.test(l))
}

export function PartnerWebsiteAssetPanel({
  locale,
  partnerId,
  logoUrl,
  onLogoUrlChange,
  refUrlsText,
  onRefUrlsTextChange,
  uploadedRefUrls,
  onUploadedRefUrlsChange,
  disabled,
  onError,
}: {
  locale: WebLocale
  partnerId: string
  logoUrl: string
  onLogoUrlChange: (url: string) => void
  refUrlsText: string
  onRefUrlsTextChange: (text: string) => void
  uploadedRefUrls: string[]
  onUploadedRefUrlsChange: (urls: string[]) => void
  disabled?: boolean
  onError: (message: string) => void
}) {
  const t = getPartnerWebsiteCopy(locale)
  const logoFileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)
  const busy = Boolean(disabled)

  async function handleLogoUpload(files: FileList | null) {
    if (!partnerId || !files?.length) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      onLogoUrlChange(url)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    }
  }

  async function handleRefUpload(files: FileList | null) {
    if (!partnerId || !files?.length) return
    const list = Array.from(files).filter((f) => f.size > 0).slice(0, 8 - uploadedRefUrls.length)
    if (!list.length) return
    const next = [...uploadedRefUrls]
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        onError(t.imageInvalidType)
        continue
      }
      try {
        const url = await uploadPartnerImageFile(partnerId, file)
        if (!next.includes(url)) next.push(url)
      } catch (e) {
        onError(e instanceof Error ? e.message : t.uploadFailed)
      }
    }
    onUploadedRefUrlsChange(next.slice(0, 8))
  }

  const linkedRefs = parseUrlLines(refUrlsText)
  const allRefPreviews = [...uploadedRefUrls, ...linkedRefs.filter((u) => !uploadedRefUrls.includes(u))].slice(
    0,
    8
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <label className="text-sm font-medium">{t.logoLabel}</label>
        <p className="text-xs text-muted-foreground">{t.logoHint}</p>
        {logoUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              className="h-12 max-w-[160px] rounded border bg-white object-contain p-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onLogoUrlChange('')}
            >
              {t.logoRemove}
            </Button>
          </div>
        ) : null}
        <Input
          value={logoUrl}
          onChange={(e) => onLogoUrlChange(e.target.value.trim())}
          placeholder={t.logoUrlPlaceholder}
          disabled={busy}
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={logoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy || !partnerId}
            onChange={(e) => {
              void handleLogoUpload(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !partnerId}
            onClick={() => logoFileRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1 h-3.5 w-3.5" />}
            {t.logoUpload}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
        <label className="text-sm font-medium">{t.refImagesLabel}</label>
        <p className="text-xs text-muted-foreground">{t.refImagesHint}</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={refFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy || !partnerId || uploadedRefUrls.length >= 8}
            onChange={(e) => {
              void handleRefUpload(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !partnerId || uploadedRefUrls.length >= 8}
            onClick={() => refFileRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1 h-3.5 w-3.5" />}
            {t.refImagesUpload}
          </Button>
        </div>
        {allRefPreviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {allRefPreviews.map((url) => (
              <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {uploadedRefUrls.includes(url) ? (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-90 hover:bg-black"
                    disabled={busy}
                    aria-label={t.refImageRemove}
                    onClick={() => onUploadedRefUrlsChange(uploadedRefUrls.filter((u) => u !== url))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <Textarea
          value={refUrlsText}
          onChange={(e) => onRefUrlsTextChange(e.target.value)}
          placeholder={t.refImagesPlaceholder}
          rows={3}
          disabled={busy}
        />
      </div>
    </div>
  )
}

export function collectPartnerWebsiteReferenceUrls(input: {
  refUrlsText: string
  uploadedRefUrls: string[]
}): string[] {
  const fromText = parseUrlLines(input.refUrlsText)
  return [...new Set([...input.uploadedRefUrls, ...fromText])].slice(0, 8)
}

/** Compact image attach strip for the edit composer (upload + previews). */
export function PartnerWebsiteEditRefStrip({
  locale,
  partnerId,
  uploadedRefUrls,
  onUploadedRefUrlsChange,
  disabled,
  onError,
}: {
  locale: WebLocale
  partnerId: string
  uploadedRefUrls: string[]
  onUploadedRefUrlsChange: (urls: string[]) => void
  disabled?: boolean
  onError: (message: string) => void
}) {
  const t = getPartnerWebsiteCopy(locale)
  const refFileRef = useRef<HTMLInputElement>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const busy = Boolean(disabled) || uploadBusy

  async function handleRefUpload(files: FileList | null) {
    if (!partnerId || !files?.length) return
    const list = Array.from(files).filter((f) => f.size > 0).slice(0, 8 - uploadedRefUrls.length)
    if (!list.length) return
    setUploadBusy(true)
    const next = [...uploadedRefUrls]
    try {
      for (const file of list) {
        if (!file.type.startsWith('image/')) {
          onError(t.imageInvalidType)
          continue
        }
        try {
          const url = await uploadPartnerImageFile(partnerId, file)
          if (!next.includes(url)) next.push(url)
        } catch (e) {
          onError(e instanceof Error ? e.message : t.uploadFailed)
        }
      }
      onUploadedRefUrlsChange(next.slice(0, 8))
    } finally {
      setUploadBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/15 p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{t.editRefInlineLabel}</p>
          <p className="text-[11px] text-muted-foreground">{t.editRefInlineHint}</p>
        </div>
        <input
          ref={refFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy || !partnerId || uploadedRefUrls.length >= 8}
          onChange={(e) => {
            void handleRefUpload(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 text-xs"
          disabled={busy || !partnerId || uploadedRefUrls.length >= 8}
          onClick={() => refFileRef.current?.click()}
        >
          {uploadBusy ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="mr-1 h-3.5 w-3.5" />
          )}
          {t.refImagesUpload}
        </Button>
      </div>
      {uploadedRefUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {uploadedRefUrls.map((url) => (
            <div
              key={url}
              className="group relative h-16 w-20 overflow-hidden rounded-md border bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded-full bg-black/65 p-0.5 text-white opacity-90 hover:bg-black"
                disabled={busy}
                aria-label={t.refImageRemove}
                onClick={() => onUploadedRefUrlsChange(uploadedRefUrls.filter((u) => u !== url))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
