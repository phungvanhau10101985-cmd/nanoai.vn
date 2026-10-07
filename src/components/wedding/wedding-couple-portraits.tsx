'use client'

import { cn } from '@/lib/utils'
import { albumPhotoFrameStyle, type WeddingAlbumPhotoFrame } from '@/lib/wedding/wedding-section-config'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'

const PORTRAIT_FRAME: WeddingAlbumPhotoFrame = { x: 50, y: 18, scale: 1 }

function initialOf(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  return Array.from(trimmed)[0] ?? '·'
}

function Portrait(props: {
  imageUrl: string
  name: string
  label: string
  theme: WeddingTheme
  frame: WeddingAlbumPhotoFrame
  compact?: boolean
}) {
  const nameText = props.name.trim() || props.label
  const frameStyle = albumPhotoFrameStyle(props.frame)
  return (
    <figure className="min-w-0">
      <div
        className={cn(
          'relative w-full overflow-hidden bg-white/35 shadow-[0_14px_32px_rgba(70,36,16,0.16)] ring-1 ring-white/75',
          props.compact ? 'aspect-[3/4] rounded-2xl' : 'aspect-[3/4] rounded-[1.65rem] sm:rounded-[1.85rem]',
        )}
      >
        {props.imageUrl ? (
          <img
            src={props.imageUrl}
            alt={`${props.label} ${nameText}`}
            className="absolute inset-0 h-full w-full object-cover"
            style={frameStyle}
          />
        ) : (
          <div className={cn('flex h-full w-full items-center justify-center font-serif', props.theme.accentText, props.theme.textGlow)}>
            <span className={props.compact ? 'text-2xl' : 'text-5xl sm:text-6xl'}>{initialOf(nameText)}</span>
          </div>
        )}
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-2 pb-2.5 pt-8 text-center text-white sm:px-3 sm:pb-3.5 sm:pt-12">
          <p className={cn('uppercase tracking-[0.18em]', props.compact ? 'text-[8px]' : 'text-[10px] sm:text-[11px]')}>
            {props.label}
          </p>
          <p className={cn('mt-0.5 truncate font-serif font-semibold leading-tight', props.compact ? 'text-[11px]' : 'text-sm sm:text-lg')}>
            {nameText}
          </p>
        </figcaption>
      </div>
    </figure>
  )
}

/** Hai chân dung chú rể / cô dâu trên trang nội dung thiệp. Ẩn khi chưa có ảnh nào. */
export function WeddingCouplePortraits(props: {
  groomName: string
  brideName: string
  groomImageUrl: string
  brideImageUrl: string
  groomLabel: string
  brideLabel: string
  groomFrame?: WeddingAlbumPhotoFrame
  brideFrame?: WeddingAlbumPhotoFrame
  theme: WeddingTheme
  compact?: boolean
  className?: string
}) {
  const groomImageUrl = props.groomImageUrl.trim()
  const brideImageUrl = props.brideImageUrl.trim()
  if (!groomImageUrl && !brideImageUrl) return null
  const showSecondary = Boolean(brideImageUrl || props.brideName.trim())
  if (!showSecondary) {
    return (
      <div className={cn('mx-auto w-full max-w-[16rem]', props.className)}>
        <Portrait
          imageUrl={groomImageUrl}
          name={props.groomName}
          label={props.groomLabel}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          theme={props.theme}
          compact={props.compact}
        />
      </div>
    )
  }

  return (
    <div className={cn('mx-auto w-full max-w-md', props.className)}>
      <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center', props.compact ? 'gap-1.5' : 'gap-2 sm:gap-4')}>
        <Portrait
          imageUrl={groomImageUrl}
          name={props.groomName}
          label={props.groomLabel}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          theme={props.theme}
          compact={props.compact}
        />
        <span
          className={cn(
            'font-serif italic leading-none',
            props.theme.accentText,
            props.theme.textGlow,
            props.compact ? 'text-lg' : 'text-2xl sm:text-3xl',
          )}
          aria-hidden
        >
          &
        </span>
        <Portrait
          imageUrl={brideImageUrl}
          name={props.brideName}
          label={props.brideLabel}
          frame={props.brideFrame ?? PORTRAIT_FRAME}
          theme={props.theme}
          compact={props.compact}
        />
      </div>
    </div>
  )
}
