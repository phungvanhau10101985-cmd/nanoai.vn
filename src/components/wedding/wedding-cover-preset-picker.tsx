'use client'

import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import {
  DEFAULT_WEDDING_COVER_PRESET_ID,
  labelForWeddingCoverPreset,
  WEDDING_COVER_PRESETS,
  type WeddingCoverPresetTag,
} from '@/lib/wedding/wedding-cover-presets'

type WeddingCoverPresetPickerProps = {
  locale: WebLocale
  selectedId: string
  onSelect: (id: string) => void
  tagNewLabel: string
  tagHotLabel: string
}

function CoverPresetThumbnail(props: { preset: (typeof WEDDING_COVER_PRESETS)[number]; selected: boolean }) {
  const { preset, selected } = props
  return (
    <div
      className={cn(
        'relative aspect-[3/4] overflow-hidden rounded-xl border shadow-sm transition',
        selected ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200 hover:border-rose-300',
      )}
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="relative h-[38%]" style={{ background: preset.thumbnail.topBg }}>
          <div className="absolute inset-x-2 top-2 text-[7px] font-medium uppercase tracking-[0.18em] opacity-80">
            <span className={preset.thumbnail.textClass}>Wedding</span>
          </div>
          <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1 px-1">
            <span className={cn('truncate text-[8px] font-semibold', preset.thumbnail.textClass)}>Groom</span>
            <span className="text-[10px]" style={{ color: preset.thumbnail.accent }}>
              {preset.ornament}
            </span>
            <span className={cn('truncate text-[8px] font-semibold', preset.thumbnail.textClass)}>Bride</span>
          </div>
          <div
            className="absolute -bottom-3 left-1/2 h-6 w-[108%] -translate-x-1/2 rounded-[100%]"
            style={{ background: preset.thumbnail.bottomBg }}
          />
        </div>
        <div className="relative flex-1" style={{ background: preset.thumbnail.bottomBg }}>
          <div className="mx-auto mt-3 h-[58%] w-[72%] rounded-md border border-black/5 bg-white/70 shadow-inner" />
          <div className="absolute inset-x-3 bottom-2 h-2 rounded-full bg-black/5" />
        </div>
      </div>
    </div>
  )
}

function TagBadge(props: { tag: WeddingCoverPresetTag; label: string }) {
  const cls =
    props.tag === 'new'
      ? 'bg-pink-500 text-white'
      : 'bg-red-600 text-white'
  return (
    <span className={cn('absolute right-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shadow', cls)}>
      {props.label}
    </span>
  )
}

export function WeddingCoverPresetPicker(props: WeddingCoverPresetPickerProps) {
  const selectedId = props.selectedId || DEFAULT_WEDDING_COVER_PRESET_ID
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {WEDDING_COVER_PRESETS.map((preset) => {
        const selected = preset.id === selectedId
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => props.onSelect(preset.id)}
            className="group rounded-2xl p-1 text-left transition hover:bg-rose-50/70"
          >
            <div className="relative">
              {preset.tags?.includes('new') ? <TagBadge tag="new" label={props.tagNewLabel} /> : null}
              {preset.tags?.includes('hot') ? <TagBadge tag="hot" label={props.tagHotLabel} /> : null}
              <CoverPresetThumbnail preset={preset} selected={selected} />
            </div>
            <p className={cn('mt-2 line-clamp-2 text-xs font-medium', selected ? 'text-rose-700' : 'text-slate-700')}>
              {labelForWeddingCoverPreset(props.locale, preset)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
