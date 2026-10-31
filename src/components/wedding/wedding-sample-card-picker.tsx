'use client'

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
  onPreview: (sample: WeddingSampleCard) => void
  onConfirm?: (sample: WeddingSampleCard) => void
}) {
  const library = props.samples.filter((sample) => sample.libraryImageUrl)
  const ready = props.samples.filter((sample) => !sample.aiStyleId && !sample.libraryImageUrl)
  const ai = props.samples.filter((sample) => sample.aiStyleId && !sample.libraryImageUrl)
  return (
    <div className="space-y-4">
      <SampleGroup
        locale={props.locale}
        samples={ready}
        selectedId={props.selectedId}
        heading={props.heading}
        hint={props.hint}
        photoNote={props.photoNote}
        ornamentLayouts={props.ornamentLayouts}
        disabled={props.disabled}
        confirmLabel={props.confirmLabel}
        onPreview={props.onPreview}
        onConfirm={props.onConfirm}
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
          confirmLabel={props.confirmLabel}
          onPreview={props.onPreview}
          onConfirm={props.onConfirm}
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
          confirmLabel={props.confirmLabel}
          onPreview={props.onPreview}
          onConfirm={props.onConfirm}
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
  confirmLabel?: string
  onPreview: (sample: WeddingSampleCard) => void
  onConfirm?: (sample: WeddingSampleCard) => void
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
          const showOk = Boolean(active && props.confirmLabel && props.onConfirm)
          return (
            <div
              key={sample.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-[#fffaf2] text-left',
                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
              )}
            >
              <button
                type="button"
                disabled={props.disabled}
                onClick={() => props.onPreview(sample)}
                className="block w-full text-left disabled:cursor-not-allowed"
              >
                <SampleFace sample={sample} ornamentLayouts={props.ornamentLayouts} />
                <span className="block px-1.5 pt-1 text-[11px] font-medium leading-tight">{label}</span>
                {showOk ? null : <span className="block px-1.5 pb-1.5 text-[10px] text-muted-foreground">{props.photoNote}</span>}
              </button>
              {showOk ? (
                <button
                  type="button"
                  disabled={props.disabled}
                  onClick={() => props.onConfirm?.(sample)}
                  className="block w-full px-1.5 pb-1.5 text-center text-xs font-semibold text-rose-700 disabled:cursor-not-allowed"
                >
                  {props.confirmLabel}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
