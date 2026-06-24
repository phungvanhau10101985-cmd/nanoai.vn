'use client'

import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import {
  descriptionForWeddingStylePreset,
  labelForWeddingStylePreset,
  WEDDING_STYLE_PRESETS,
  type WeddingStylePreset,
} from '@/lib/wedding/wedding-style-presets'

type WeddingStylePresetPickerProps = {
  locale: WebLocale
  selectedId: string
  onSelect: (id: string, palette: string) => void
}

function StyleMotif(props: { preset: WeddingStylePreset }) {
  const { preset } = props
  const { motif, accent } = preset.thumbnail
  const { ornament } = preset

  if (motif === 'gold_foil') {
    return (
      <>
        <div className="absolute inset-x-3 top-2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <div className="absolute inset-x-5 bottom-2 h-px opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <div className="absolute left-2 top-2 h-3 w-3 rotate-45 border border-amber-400/50" />
        <div className="absolute right-2 top-2 h-3 w-3 rotate-45 border border-amber-400/50" />
        <span className="absolute inset-x-0 top-[38%] text-center font-serif text-2xl drop-shadow-sm" style={{ color: accent }}>
          {ornament}
        </span>
      </>
    )
  }

  if (motif === 'clean_lines') {
    return (
      <>
        <div className="absolute inset-x-4 top-3 h-px bg-stone-300/80" />
        <div className="absolute inset-x-4 bottom-3 h-px bg-stone-300/80" />
        <span className="absolute inset-x-0 top-[40%] text-center text-lg font-light tracking-[0.35em]" style={{ color: accent }}>
          {ornament}
        </span>
      </>
    )
  }

  if (motif === 'double_happiness') {
    return (
      <>
        <div className="absolute inset-x-0 top-0 h-[42%]" style={{ background: 'linear-gradient(180deg, #7f1d1d 0%, #b91c1c 100%)' }} />
        <span
          className="absolute inset-x-0 top-[14%] text-center font-serif text-3xl font-bold drop-shadow-md"
          style={{ color: accent }}
        >
          {ornament}
        </span>
        <div className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-300/70" />
        <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-300/70" />
      </>
    )
  }

  if (motif === 'floral_corners') {
    return (
      <>
        <span className="absolute left-1 top-1 text-sm opacity-70" style={{ color: accent }}>
          ❀
        </span>
        <span className="absolute right-1 top-1 text-sm opacity-70" style={{ color: accent }}>
          ❀
        </span>
        <span className="absolute bottom-1 left-1 text-xs opacity-60" style={{ color: accent }}>
          ✿
        </span>
        <span className="absolute bottom-1 right-1 text-xs opacity-60" style={{ color: accent }}>
          ✿
        </span>
        <span className="absolute inset-x-0 top-[38%] text-center text-xl" style={{ color: accent }}>
          {ornament}
        </span>
      </>
    )
  }

  if (motif === 'ornate_frame') {
    return (
      <>
        <div className="absolute inset-2 rounded-sm border border-orange-400/45" />
        <div className="absolute inset-3 rounded-sm border border-orange-300/30" />
        <span className="absolute inset-x-0 top-[36%] text-center font-serif text-xl" style={{ color: accent }}>
          {ornament}
        </span>
      </>
    )
  }

  return (
    <>
      <div className="absolute inset-x-4 top-[46%] h-px" style={{ background: accent }} />
      <span className="absolute inset-x-0 top-[28%] text-center text-xl" style={{ color: accent }}>
        {ornament}
      </span>
    </>
  )
}

function StylePresetThumbnail(props: { preset: WeddingStylePreset; selected: boolean }) {
  const { preset, selected } = props
  const dark = preset.id === 'modern'
  return (
    <div
      className={cn(
        'relative aspect-[4/3] overflow-hidden rounded-xl border shadow-sm transition',
        selected ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200 group-hover:border-rose-300',
      )}
      style={{ background: preset.thumbnail.bg }}
    >
      <StyleMotif preset={preset} />
      <div
        className={cn(
          'absolute inset-x-3 bottom-2.5 rounded-md border px-1 py-1.5 backdrop-blur-[2px]',
          preset.thumbnail.panelClass,
        )}
      >
        <div className={cn('mx-auto mb-1 h-1 w-[55%] rounded-full', dark ? 'bg-white/35' : 'bg-black/10')} />
        <div className={cn('mx-auto h-1 w-[72%] rounded-full', dark ? 'bg-white/25' : 'bg-black/8')} />
      </div>
    </div>
  )
}

export function WeddingStylePresetPicker(props: WeddingStylePresetPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {WEDDING_STYLE_PRESETS.map((preset) => {
        const selected = preset.id === props.selectedId
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => props.onSelect(preset.id, preset.palette)}
            className="group rounded-2xl p-1 text-left transition hover:bg-rose-50/70"
          >
            <StylePresetThumbnail preset={preset} selected={selected} />
            <p className={cn('mt-2 text-sm font-semibold leading-snug', selected ? 'text-rose-700' : 'text-slate-800')}>
              {labelForWeddingStylePreset(props.locale, preset)}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {descriptionForWeddingStylePreset(props.locale, preset)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
