'use client'

import { cn } from '@/lib/utils'
import { albumPhotoFrameStyle, type WeddingAlbumPhotoFrame, type WeddingPortraitShellFrame } from '@/lib/wedding/wedding-section-config'
import { FrameEdgeGrips, FrameScaleDragBar, WeddingFramedPhoto, type FrameScaleEdit } from '@/components/wedding/wedding-cover-shell-card'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import { centeredFrameBoxStyle } from '@/lib/wedding/wedding-section-config'
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
  frameScale?: number
  compact?: boolean
  choosePhotoLabel?: string
  chooseFrameLabel?: string
  onChoosePhoto?: () => void
  onPhotoFile?: (file: File) => void
  onChooseFrame?: () => void
  frameScaleEdit?: FrameScaleEdit
}) {
  const nameText = props.name.trim() || props.label
  const frameStyle = albumPhotoFrameStyle(props.frame)
  const editable = Boolean(props.onChoosePhoto || props.onPhotoFile || props.onChooseFrame)
  const frameScale = props.frameScale && props.frameScale > 0 ? props.frameScale : 1
  return (
    <div className="relative w-full min-w-0">
    <figure
      className="group relative"
      style={centeredFrameBoxStyle(Math.round(frameScale * 1000) / 10)}
      onClick={editable ? () => props.onChooseFrame?.() : undefined}
    >
      <div className="relative">
      {props.shell ? (
          <WeddingFramedPhoto
            frameSrc={props.shell.src}
            hole={props.shell.hole}
            photoUrl={props.imageUrl}
            alt={`${props.label} ${nameText}`}
            objectPosition={frameStyle.objectPosition}
            scale={props.frame.scale}
            frameScale={1}
            className="w-full max-w-none"
          />
      ) : (
        <div
          className={cn(
            'relative w-full overflow-hidden shadow-[0_16px_36px_rgba(20,4,8,0.32)]',
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
        </div>
      )}
      {props.frameScaleEdit ? <FrameEdgeGrips edit={props.frameScaleEdit} /> : null}
      </div>
      {props.frameScaleEdit ? <FrameScaleDragBar edit={props.frameScaleEdit} /> : null}
      <figcaption className={cn('mt-2 text-center', props.theme.text, props.theme.textGlow)}>
        <p className={cn('uppercase tracking-[0.18em]', props.theme.accentText, props.compact ? 'text-[8px]' : 'text-[10px] sm:text-[11px]')}>
          {props.label}
        </p>
        <p className={cn('mt-0.5 font-serif font-semibold leading-tight', props.compact ? 'text-[11px]' : 'text-sm sm:text-lg')}>
          {nameText}
        </p>
      </figcaption>
      {editable ? (
        <div className="absolute inset-x-0 bottom-2 z-[4] flex justify-center gap-1.5 px-2">
          {props.onPhotoFile ? (
            <WeddingDeviceFileInput
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
              label={props.choosePhotoLabel ?? ''}
              onFiles={(files) => {
                const file = files[0]
                if (file) props.onPhotoFile?.(file)
              }}
            />
          ) : props.onChoosePhoto ? (
          <button
            type="button"
            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
            onClick={(event) => {
              event.stopPropagation()
              props.onChoosePhoto?.()
            }}
          >
            {props.choosePhotoLabel}
          </button>
          ) : null}
          {props.onChooseFrame ? (
          <button
            type="button"
            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
            onClick={(event) => {
              event.stopPropagation()
              props.onChooseFrame?.()
            }}
          >
            {props.chooseFrameLabel}
          </button>
          ) : null}
        </div>
      ) : null}
    </figure>
    </div>
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
  groomFrameScale?: number
  brideFrameScale?: number
  theme: WeddingTheme
  /** primary = một ảnh chính. Ảnh phụ nằm dưới, không có dấu &. */
  layout?: 'pair' | 'primary'
  compact?: boolean
  className?: string
  choosePhotoLabel?: string
  chooseFrameLabel?: string
  onChoosePhoto?: (side: 'groom' | 'bride') => void
  onPhotoFile?: (side: 'groom' | 'bride', file: File) => void
  onChooseFrame?: (side: 'groom' | 'bride') => void
  /** Editor: hiện khung trống để chọn ảnh. */
  showEmpty?: boolean
  /** Một thanh cỡ khung cho cả hai ảnh. */
  pairFrameScaleEdit?: FrameScaleEdit
  groomFrameScaleEdit?: FrameScaleEdit
  brideFrameScaleEdit?: FrameScaleEdit
}) {
  const groomImageUrl = props.groomImageUrl.trim()
  const brideImageUrl = props.brideImageUrl.trim()
  if (!groomImageUrl && !brideImageUrl && !props.showEmpty) return null
  const showSecondary = props.layout === 'primary'
    ? Boolean(brideImageUrl || props.showEmpty)
    : Boolean(brideImageUrl || props.brideName.trim() || props.showEmpty)
  if (!showSecondary) {
    return (
      <div className={cn('mx-auto w-full max-w-[16rem]', props.className)}>
        <Portrait
          imageUrl={groomImageUrl}
          name={props.groomName}
          label={props.groomLabel}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          shell={props.groomShell}
          frameScale={props.groomFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('groom', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
          frameScaleEdit={props.groomFrameScaleEdit}
        />
      </div>
    )
  }

  if (props.layout === 'primary') {
    return (
      <div className={cn('mx-auto w-full max-w-[16rem] space-y-4', props.className)}>
        <Portrait
          imageUrl={groomImageUrl}
          name={props.groomName}
          label={props.groomLabel}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          shell={props.groomShell}
          frameScale={props.groomFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('groom', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
          frameScaleEdit={props.groomFrameScaleEdit ?? props.pairFrameScaleEdit}
        />
        <Portrait
          imageUrl={brideImageUrl}
          name={props.brideName}
          label={props.brideLabel}
          frame={props.brideFrame ?? PORTRAIT_FRAME}
          shell={props.brideShell}
          frameScale={props.brideFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('bride') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('bride', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('bride') : undefined}
          frameScaleEdit={props.brideFrameScaleEdit}
        />
      </div>
    )
  }

  return (
    <div className={cn('mx-auto w-full max-w-md', props.className)}>
      <div className={cn('grid grid-cols-[1fr_auto_1fr] items-start', props.compact ? 'gap-1.5' : 'gap-2 sm:gap-4')}>
        <Portrait
          imageUrl={groomImageUrl}
          name={props.groomName}
          label={props.groomLabel}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          shell={props.groomShell}
          frameScale={props.groomFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('groom', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
        />
        <span
          className={cn(
            'font-serif italic leading-none',
            props.theme.accentText,
            props.theme.textGlow,
            props.compact ? 'mt-[22%] text-lg' : 'mt-[30%] text-2xl sm:text-3xl',
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
          frameScale={props.pairFrameScaleEdit ? props.groomFrameScale : props.brideFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={props.choosePhotoLabel}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('bride') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('bride', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('bride') : undefined}
          frameScaleEdit={props.pairFrameScaleEdit ? undefined : props.brideFrameScaleEdit}
        />
      </div>
      {props.pairFrameScaleEdit ? (
        <div className="mt-2 flex justify-center">
          <FrameScaleDragBar edit={props.pairFrameScaleEdit} />
        </div>
      ) : null}
    </div>
  )
}
