'use client'

import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { CoverPresetThumbnail } from '@/components/wedding/wedding-cover-preset-picker'
import { findWeddingCoverPreset, labelForWeddingCoverPreset, WEDDING_COVER_PRESETS } from '@/lib/wedding/wedding-cover-presets'
import type { WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'

export type WeddingFrameLibraryTile = {
  id: string
  imageUrl: string
  hole: { x: number; y: number; w: number; h: number }
  panel: string
  ink?: 'dark' | 'light'
}

export type WeddingFrameChoice =
  | { kind: 'kit' }
  | { kind: 'none' }
  | { kind: 'preset'; id: string }
  | { kind: 'library'; item: WeddingFrameLibraryTile }

export function weddingAiFrameTileLabel(locale: WebLocale, index: number): string {
  const name =
    locale === 'en' ? 'AI frame'
    : locale === 'zh' ? 'AI 边框'
    : locale === 'ja' ? 'AI フレーム'
    : locale === 'ko' ? 'AI 프레임'
    : 'Khung AI'
  return `${name} ${index + 1}`
}

export function weddingSharedFrameFromChoice(choice: WeddingFrameChoice): WeddingSharedFrame | null {
  if (choice.kind === 'kit') return null
  if (choice.kind === 'none') return { mode: 'none' }
  if (choice.kind === 'preset') return { mode: 'preset', presetId: choice.id }
  return {
    mode: 'library',
    imageUrl: choice.item.imageUrl,
    hole: choice.item.hole,
    panel: choice.item.panel,
    ink: choice.item.ink === 'light' ? 'light' : 'dark',
  }
}

export function weddingFrameSelectionKey(privateKey: string, shared?: WeddingSharedFrame | null): string {
  if (privateKey !== 'kit') return privateKey
  if (!shared) return 'kit'
  if (shared.mode === 'none') return 'none'
  if (shared.mode === 'preset' && shared.presetId) return shared.presetId
  if (shared.mode === 'library' && shared.imageUrl) return `library:${shared.imageUrl}`
  return 'kit'
}

function FramePhotoThumb(props: { src: string; hole?: { x: number; y: number; w: number; h: number }; selected: boolean }) {
  return (
    <div
      className={cn(
        'relative aspect-[3/4] overflow-hidden rounded-xl border bg-stone-100 shadow-sm',
        props.selected ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200',
      )}
    >
      {props.hole ? (
        <div
          className="absolute overflow-hidden"
          style={{ left: `${props.hole.x}%`, top: `${props.hole.y}%`, width: `${props.hole.w}%`, height: `${props.hole.h}%` }}
        >
          <div className="h-full w-full bg-[linear-gradient(160deg,#fecdd3_0%,#fff7ed_48%,#d1fae5_100%)]" />
        </div>
      ) : null}
      <img src={props.src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
    </div>
  )
}

export function WeddingFrameChoiceGrid(props: {
  locale: WebLocale
  followLabel: string
  noneLabel: string
  kitPresetId?: string
  library?: WeddingFrameLibraryTile[]
  selectedKey: string
  onChoose: (choice: WeddingFrameChoice) => void
}) {
  const kitPreset = findWeddingCoverPreset(props.kitPresetId)
  const frames = WEDDING_COVER_PRESETS.filter((preset) => preset.frame)
  const library = props.library ?? []
  const tileLabel = (selected: boolean) =>
    cn('mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-tight', selected ? 'text-rose-700' : 'text-stone-700')
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <button type="button" className="rounded-2xl p-1 text-left hover:bg-rose-50" onClick={() => props.onChoose({ kind: 'kit' })}>
        {kitPreset?.frame ? (
          <CoverPresetThumbnail preset={kitPreset} selected={props.selectedKey === 'kit'} />
        ) : (
          <div className={cn('relative aspect-[3/4] overflow-hidden rounded-xl border bg-[#fff7f5]', props.selectedKey === 'kit' ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200')}>
            <div className="absolute inset-[18%] rounded-md bg-[linear-gradient(160deg,#fecdd3_0%,#fff7ed_48%,#d1fae5_100%)]" />
          </div>
        )}
        <p className={tileLabel(props.selectedKey === 'kit')}>{props.followLabel}</p>
      </button>
      <button type="button" className="rounded-2xl p-1 text-left hover:bg-rose-50" onClick={() => props.onChoose({ kind: 'none' })}>
        <div className={cn('relative aspect-[3/4] overflow-hidden rounded-xl border bg-stone-100', props.selectedKey === 'none' ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-200')}>
          <div className="absolute inset-[14%] rounded-md border border-dashed border-stone-300 bg-[linear-gradient(160deg,#fecdd3_0%,#fff7ed_48%,#d1fae5_100%)]" />
        </div>
        <p className={tileLabel(props.selectedKey === 'none')}>{props.noneLabel}</p>
      </button>
      {frames.map((preset) => {
        const selected = props.selectedKey === preset.id
        return (
          <button key={preset.id} type="button" className="rounded-2xl p-1 text-left hover:bg-rose-50" onClick={() => props.onChoose({ kind: 'preset', id: preset.id })}>
            <CoverPresetThumbnail preset={preset} selected={selected} />
            <p className={tileLabel(selected)}>{labelForWeddingCoverPreset(props.locale, preset)}</p>
          </button>
        )
      })}
      {library.map((item, index) => {
        const key = `library:${item.imageUrl}`
        const selected = props.selectedKey === key
        return (
          <button key={item.id || item.imageUrl} type="button" className="rounded-2xl p-1 text-left hover:bg-rose-50" onClick={() => props.onChoose({ kind: 'library', item })}>
            <FramePhotoThumb src={item.imageUrl} hole={item.hole} selected={selected} />
            <p className={tileLabel(selected)}>{weddingAiFrameTileLabel(props.locale, index)}</p>
          </button>
        )
      })}
    </div>
  )
}
