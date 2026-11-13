'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import { INVITATION_OCCASION_KEYS, invitationOccasionShortLabel, normalizeInvitationOccasion, type InvitationOccasionKey } from '@/lib/wedding/invitation-occasion'
import { weddingOccasionDemos } from '@/lib/wedding/wedding-sample-cards'
import {
  findWeddingBackgroundPreset,
  labelForWeddingBackgroundPreset,
} from '@/lib/wedding/wedding-background-presets'
import { getWeddingStylePreset, labelForWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'
import { weddingSampleScrollStrip, weddingSamplesWithActiveFirst, type WeddingSampleCard } from '@/lib/wedding/wedding-sample-cards'
import { WeddingSampleScrollPreview } from '@/components/wedding/wedding-sample-scroll-preview'
import { cn } from '@/lib/utils'

function SampleFace(props: { sample: WeddingSampleCard }) {
  const scroll = weddingSampleScrollStrip(props.sample)
  const [src, setSrc] = useState(scroll)
  useEffect(() => setSrc(scroll), [scroll])
  return (
    <WeddingSampleScrollPreview
      src={src}
      onError={() => {
        if (src !== props.sample.coverPhotoUrl) setSrc(props.sample.coverPhotoUrl)
      }}
    />
  )
}

const OCCASION_BAR_LABEL: Record<WebLocale, string> = {
  vi: 'Loại thiệp',
  en: 'Card type',
  zh: '请柬类型',
  ja: '招待状の種類',
  ko: '청첩장 종류',
}

/** Nút trên đầu kho: bấm để xem 5 demo của đúng loại thiệp. */
export function WeddingOccasionDemoBar(props: {
  locale: WebLocale
  value: InvitationOccasionKey
  onChange: (key: InvitationOccasionKey) => void
  /** Trang giới thiệu: nút 44px, dính dưới header. Kho trong công cụ giữ nút nhỏ. */
  variant?: 'editor' | 'landing'
}) {
  const landing = props.variant === 'landing'
  return (
    <div
      className={
        landing
          ? 'sticky top-12 z-30 -mx-3 bg-rose-50/95 px-3 py-2 backdrop-blur-md sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none'
          : 'sticky top-0 z-10 -mx-1 bg-[#fffaf6]/95 px-1 pb-2 backdrop-blur'
      }
    >
      <p className={landing ? 'mb-2 text-[11px] font-semibold uppercase tracking-wider text-rose-700' : 'mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'}>
        {OCCASION_BAR_LABEL[props.locale]}
      </p>
      <div
        className={
          landing
            ? 'flex gap-2 overflow-x-auto overscroll-x-contain pb-1 pe-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible lg:pe-0'
            : 'flex gap-1 overflow-x-auto pb-1'
        }
        role="tablist"
        aria-label={OCCASION_BAR_LABEL[props.locale]}
      >
        {INVITATION_OCCASION_KEYS.map((key) => {
          const active = props.value === key
          const landingChip = active
            ? 'inline-flex h-11 min-h-11 shrink-0 snap-start touch-manipulation items-center rounded-full bg-rose-700 px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 active:scale-[0.98]'
            : 'inline-flex h-11 min-h-11 shrink-0 snap-start touch-manipulation items-center rounded-full border border-rose-200 bg-white px-4 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 active:scale-[0.98]'
          const editorChip = active
            ? 'h-8 shrink-0 rounded-full bg-neutral-950 px-3 text-xs font-semibold text-white'
            : 'h-8 shrink-0 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700'
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={landing ? landingChip : editorChip}
              onClick={() => props.onChange(key)}
            >
              {invitationOccasionShortLabel(key, props.locale)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Kho giao diện: nút loại thiệp, rồi các mẫu của loại đang xem. Cưới gồm cả kho nền. */
export function WeddingSampleGallery(props: {
  locale: WebLocale
  initialOccasion?: string
  /** Khi hộp thoại mở lại, tab về đúng loại của thiệp đang sửa. */
  open?: boolean
  cardOccasion?: string
  selectedId?: string
  heading: string
  aiHeading?: string
  libraryHeading?: string
  hint: string
  photoNote: string
  columns?: 2 | 4
  disabled?: boolean
  confirmLabel?: string
  confirmCloseLabel?: string
  confirmHint?: string
  onPreview: (sample: WeddingSampleCard) => void
  onConfirm?: (sample: WeddingSampleCard) => void
}) {
  const initial = normalizeInvitationOccasion(props.initialOccasion)
  const [occasion, setOccasion] = useState<InvitationOccasionKey>(initial)
  useEffect(() => {
    if (props.open === false) return
    setOccasion(initial)
  }, [initial, props.open])
  const cardOccasion = props.cardOccasion ? normalizeInvitationOccasion(props.cardOccasion) : ''
  const samples = weddingOccasionDemos(occasion)
  return (
    <div className="space-y-3">
      <WeddingOccasionDemoBar locale={props.locale} value={occasion} onChange={setOccasion} />
      <WeddingSampleCardPicker
        locale={props.locale}
        samples={samples}
        selectedId={!cardOccasion || cardOccasion === occasion ? props.selectedId : undefined}
        heading={props.heading}
        aiHeading={props.aiHeading}
        libraryHeading={props.libraryHeading}
        hint={props.hint}
        photoNote={props.photoNote}
        columns={props.columns}
        disabled={props.disabled}
        confirmLabel={props.confirmLabel}
        confirmCloseLabel={props.confirmCloseLabel}
        confirmHint={props.confirmHint}
        onPreview={(sample) => props.onPreview({ ...sample, occasionKey: occasion })}
        onConfirm={props.onConfirm ? (sample) => props.onConfirm?.({ ...sample, occasionKey: occasion }) : undefined}
      />
    </div>
  )
}

/** Demo của loại thiệp đang mở, một hàng ngang. Mẫu đang dùng đứng đầu và được đánh dấu. */
export function WeddingSampleLookStrip(props: {
  locale: WebLocale
  samples: readonly WeddingSampleCard[]
  activeId?: string
  /** Mẫu demo đang hiện. Không truyền thì vòng chọn trùng mẫu đang dùng. */
  previewId?: string
  inUseLabel: string
  disabled?: boolean
  onOpen: (sample: WeddingSampleCard) => void
}) {
  const shown = weddingSamplesWithActiveFirst(props.samples, props.previewId || props.activeId)
  const matches = (sample: WeddingSampleCard, id?: string) =>
    Boolean(id) && (id === sample.id || id === sample.backgroundPresetId)
  return (
    <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
      {shown.map((sample) => {
        const label = sampleLabel(props.locale, sample)
        const inUse = matches(sample, props.activeId)
        const preview = props.previewId ? matches(sample, props.previewId) : inUse
        return (
          <button
            key={sample.id}
            type="button"
            disabled={props.disabled}
            aria-current={preview ? 'true' : undefined}
            onClick={() => props.onOpen(sample)}
            className={cn(
              'w-[calc((100%-0.5rem)/2)] shrink-0 overflow-hidden rounded-xl border bg-[#fffaf2] text-left disabled:cursor-not-allowed sm:w-[calc((100%-1.5rem)/4)]',
              preview ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
            )}
          >
            <span className="relative block">
              <SampleFace sample={sample} />
              {inUse ? (
                <span className="absolute bottom-1 left-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  {props.inUseLabel}
                </span>
              ) : null}
            </span>
            <span className="block truncate px-1.5 py-1 text-[11px] font-medium leading-tight">{label}</span>
          </button>
        )
      })}
    </div>
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
  /** 4: mobile 2 cột, từ lg (desktop) 4 cột. Mặc định luôn 2 cột. */
  columns?: 2 | 4
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
              <SampleFace sample={pending} />
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
        columns={props.columns}
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
          columns={props.columns}
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
          columns={props.columns}
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
  columns?: 2 | 4
  disabled?: boolean
  onChoose: (sample: WeddingSampleCard) => void
}) {
  if (props.samples.length === 0) return null
  const wide = props.columns === 4
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{props.heading}</p>
      {props.hint ? <p className="text-xs leading-relaxed text-muted-foreground">{props.hint}</p> : null}
      <div className={cn('grid', wide ? 'mx-auto w-full max-w-[54rem] grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3' : 'grid-cols-2 gap-2')}>
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
                'w-full overflow-hidden rounded-xl border bg-[#fffaf2] text-left disabled:cursor-not-allowed',
                active ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-rose-200',
              )}
            >
              <SampleFace sample={sample} />
              <span className="block px-1.5 pt-1 text-[11px] font-medium leading-tight">{label}</span>
              <span className="block px-1.5 pb-1.5 text-[10px] text-muted-foreground">{props.photoNote}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
