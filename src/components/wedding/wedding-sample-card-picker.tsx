'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import {
  findWeddingBackgroundPreset,
  labelForWeddingBackgroundPreset,
  weddingAiBackgroundKit,
  type WeddingBackgroundOrnament,
} from '@/lib/wedding/wedding-background-presets'
import { getWeddingStylePreset, labelForWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'
import { weddingSampleSharedLayoutKey, type WeddingSampleCard } from '@/lib/wedding/wedding-sample-cards'
import { WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { weddingOrnamentsForDevice } from '@/lib/wedding/wedding-background-ornament-store'
import { cn } from '@/lib/utils'

function SampleFace(props: {
  sample: WeddingSampleCard
  ornamentLayouts?: Record<string, WeddingBackgroundOrnament[]>
}) {
  const preset = props.sample.libraryImageUrl
    ? undefined
    : props.sample.aiStyleId
      ? weddingAiBackgroundKit(props.sample.aiStyleId)
      : findWeddingBackgroundPreset(props.sample.backgroundPresetId)
  const layoutKey = weddingSampleSharedLayoutKey(props.sample)
  const plate = props.sample.libraryImageUrl || preset?.plates[0] || ''
  const [albumA, albumB] = props.sample.albumImageUrls
  return (
    <span className="relative block h-40 overflow-hidden bg-[#fffaf2]">
      {plate ? <img src={plate} alt="" className="absolute inset-0 h-full w-full object-cover object-top" /> : null}
      {props.sample.libraryImageUrl ? null : (
        <WeddingBackgroundOrnamentLayer
          animateRise={false}
          ornaments={weddingOrnamentsForDevice(preset?.ornaments ?? [], props.ornamentLayouts ?? {}, layoutKey, 'mobile')}
        />
      )}
      <span className="relative flex h-full flex-col justify-end gap-1 p-2">
        <img src={props.sample.coverPhotoUrl} alt="" className="mx-auto aspect-[3/4] w-14 rounded-lg object-cover shadow-md" />
        <span className="mx-auto grid w-[4.5rem] grid-cols-2 gap-1">
          <img src={props.sample.groomImageUrl} alt="" className="aspect-[3/4] w-full rounded object-cover" />
          <img src={props.sample.brideImageUrl} alt="" className="aspect-[3/4] w-full rounded object-cover" />
        </span>
        <span className="grid grid-cols-2 gap-1">
          <img src={albumA} alt="" className="aspect-[4/3] w-full rounded object-cover" />
          <img src={albumB} alt="" className="aspect-[4/3] w-full rounded object-cover" />
        </span>
      </span>
    </span>
  )
}

export function WeddingSampleCardPicker(props: {
  locale: WebLocale
  samples: readonly WeddingSampleCard[]
  selectedId?: string
  heading: string
  aiHeading?: string
  libraryHeading?: string
  hint: string
  photoNote: string
  ornamentLayouts?: Record<string, WeddingBackgroundOrnament[]>
  disabled?: boolean
  confirmLabel?: string
  confirmCloseLabel?: string
  confirmHint?: string
  onPreview: (sample: WeddingSampleCard) => void
  onConfirm?: (sample: WeddingSampleCard) => void
}) {
  const [pending, setPending] = useState<WeddingSampleCard | null>(null)
  const library = props.samples.filter((sample) => sample.libraryImageUrl)
  const ready = props.samples.filter((sample) => !sample.aiStyleId && !sample.libraryImageUrl)
  const ai = props.samples.filter((sample) => sample.aiStyleId && !sample.libraryImageUrl)
  const choose = (sample: WeddingSampleCard) => {
    props.onPreview(sample)
    if (props.confirmLabel && props.onConfirm) setPending(sample)
  }
  const pendingLabel = pending ? sampleLabel(props.locale, pending) : ''
  return (
    <div className="space-y-4">
      <Dialog open={pending != null} onOpenChange={(open) => { if (!open && !props.disabled) setPending(null) }}>
        <DialogContent overlayClassName="z-[240]" className="z-[240] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pendingLabel}</DialogTitle>
            <DialogDescription>{props.confirmHint || props.hint}</DialogDescription>
          </DialogHeader>
          {pending ? (
            <span className="block overflow-hidden rounded-xl border">
              <SampleFace sample={pending} ornamentLayouts={props.ornamentLayouts} />
            </span>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={props.disabled}
              className="h-11 rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setPending(null)}
            >
              {props.confirmCloseLabel}
            </button>
            <button
              type="button"
              disabled={props.disabled || !pending}
              className="h-11 rounded-full bg-neutral-950 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (pending) props.onConfirm?.(pending)
              }}
            >
              {props.confirmLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <SampleGroup
        locale={props.locale}
        samples={ready}
        selectedId={props.selectedId}
        heading={props.heading}
        hint={props.hint}
        photoNote={props.photoNote}
        ornamentLayouts={props.ornamentLayouts}
        disabled={props.disabled}
        onChoose={choose}
      />
      {ai.length > 0 && props.aiHeading ? (
        <SampleGroup
          locale={props.locale}
          samples={ai}
          selectedId={props.selectedId}
          heading={props.aiHeading}
          hint=""
          photoNote={props.photoNote}
          ornamentLayouts={props.ornamentLayouts}
          disabled={props.disabled}
          onChoose={choose}
        />
      ) : null}
      {library.length > 0 && props.libraryHeading ? (
        <SampleGroup
          locale={props.locale}
          samples={library}
          selectedId={props.selectedId}
          heading={props.libraryHeading}
          hint=""
          photoNote={props.photoNote}
          ornamentLayouts={props.ornamentLayouts}
          disabled={props.disabled}
          onChoose={choose}
        />
      ) : null}
    </div>
  )
}

function sampleLabel(locale: WebLocale, sample: WeddingSampleCard) {
  if (sample.titles) return sample.titles[locale] || sample.titles.vi
  if (sample.aiStyleId) return labelForWeddingStylePreset(locale, getWeddingStylePreset(sample.aiStyleId))
  const preset = findWeddingBackgroundPreset(sample.backgroundPresetId)
  return preset ? labelForWeddingBackgroundPreset(locale, preset) : ''
}

function SampleGroup(props: {
  locale: WebLocale
  samples: readonly WeddingSampleCard[]
  selectedId?: string
  heading: string
  hint: string
  photoNote: string
  ornamentLayouts?: Record<string, WeddingBackgroundOrnament[]>
  disabled?: boolean
  onChoose: (sample: WeddingSampleCard) => void
}) {
  if (props.samples.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{props.heading}</p>
      {props.hint ? <p className="text-xs leading-relaxed text-muted-foreground">{props.hint}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {props.samples.map((sample) => {
          const label = sampleLabel(props.locale, sample)
          if (!label) return null
          const active = props.selectedId === sample.id || props.selectedId === sample.backgroundPresetId
          return (
            <button
              key={sample.id}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onChoose(sample)}
              className={cn(
                'overflow-hidden rounded-xl border bg-[#fffaf2] text-left disabled:cursor-not-allowed',
                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
              )}
            >
              <SampleFace sample={sample} ornamentLayouts={props.ornamentLayouts} />
              <span className="block px-1.5 pt-1 text-[11px] font-medium leading-tight">{label}</span>
              <span className="block px-1.5 pb-1.5 text-[10px] text-muted-foreground">{props.photoNote}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
