'use client'

import { cn } from '@/lib/utils'
import { albumPhotoFrameStyle, type WeddingAlbumPhotoFrame, type WeddingPortraitShellFrame } from '@/lib/wedding/wedding-section-config'
import { WeddingFramedPhoto } from '@/components/wedding/wedding-cover-shell-card'
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
  shell?: WeddingPortraitShellFrame | null
  compact?: boolean
  choosePhotoLabel?: string
  chooseFrameLabel?: string
  onChoosePhoto?: () => void
  onChooseFrame?: () => void
}) {
  const nameText = props.name.trim() || props.label
  const frameStyle = albumPhotoFrameStyle(props.frame)
  const editable = Boolean(props.onChoosePhoto && props.onChooseFrame)
  return (
    <figure
      className="group relative min-w-0"
      onClick={editable ? () => props.onChooseFrame?.() : undefined}
    >
      {props.shell ? (
        <>
          <WeddingFramedPhoto
            frameSrc={props.shell.src}
            hole={props.shell.hole}
            photoUrl={props.imageUrl}
            alt={`${props.label} ${nameText}`}
            objectPosition={frameStyle.objectPosition}
            scale={props.frame.scale}
            className="w-full max-w-none"
          />
          <figcaption className={cn('mt-1.5 text-center', props.theme.text, props.theme.textGlow)}>
            <p className={cn('uppercase tracking-[0.18em]', props.theme.accentText, props.compact ? 'text-[8px]' : 'text-[10px] sm:text-[11px]')}>
              {props.label}
            </p>
            <p className={cn('mt-0.5 truncate font-serif font-semibold leading-tight', props.compact ? 'text-[11px]' : 'text-sm sm:text-lg')}>
              {nameText}
            </p>
          </figcaption>
        </>
      ) : (
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
      )}
      {editable ? (
        <div className="pointer-events-none absolute inset-0 z-[4] flex items-end justify-center gap-1.5 bg-gradient-to-t from-black/50 via-black/10 to-transparent p-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
            onClick={(event) => {
              event.stopPropagation()
              props.onChoosePhoto?.()
            }}
          >
            {props.choosePhotoLabel}
          </button>
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
            onClick={(event) => {
              event.stopPropagation()
              props.onChooseFrame?.()
            }}
          >
            {props.chooseFrameLabel}
          </button>
        </div>
      ) : null}
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
  groomShell?: WeddingPortraitShellFrame | null
  brideShell?: WeddingPortraitShellFrame | null
  theme: WeddingTheme
  compact?: boolean
  className?: string
  choosePhotoLabel?: string
  chooseFrameLabel?: string
  onChoosePhoto?: (side: 'groom' | 'bride') => void
  onChooseFrame?: (side: 'groom' | 'bride') => void
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
          shell={props.groomShell}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
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
          shell={props.groomShell}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
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
          shell={props.brideShell}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('bride') : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('bride') : undefined}
        />
      </div>
    </div>
  )
}
