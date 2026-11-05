'use client'

import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { cn } from '@/lib/utils'
import { albumPhotoFrameStyle, type WeddingAlbumPhotoFrame, type WeddingPortraitShellFrame } from '@/lib/wedding/wedding-section-config'
import { FrameEdgeGrips, FrameScaleDragBar, WeddingFramedPhoto, type FrameScaleEdit } from '@/components/wedding/wedding-cover-shell-card'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import { centeredFrameBoxStyle } from '@/lib/wedding/wedding-section-config'
import { weddingOrnamentGestureActive } from '@/lib/wedding/wedding-ornament-gesture'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import { WEDDING_EDIT_SIDE, type WeddingEditSide } from '@/lib/wedding/wedding-side-edit-color'

const PORTRAIT_FRAME: WeddingAlbumPhotoFrame = { x: 50, y: 18, scale: 1 }

export type PortraitPhotoEdit = {
  x: number
  y: number
  scale: number
  onChange: (patch: { positionX?: number; positionY?: number; scale?: number }) => void
  zoomOutLabel: string
  zoomInLabel: string
}

function clampPhotoPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampPhotoScale(value: number) {
  return Math.max(1, Math.min(3, Math.round(value * 100) / 100))
}

function PortraitPhotoPan(props: { edit: PortraitPhotoEdit }) {
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)
  const editRef = useRef(props.edit)
  editRef.current = props.edit
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = editRef.current
    if (weddingOrnamentGestureActive()) return
    if ((event.target as HTMLElement).closest('button, label, input, a, [data-wedding-file-anchor]')) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: current.x,
      y: current.y,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* kéo vẫn cập nhật khi trình duyệt không giữ pointer */
    }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = editRef.current
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const sensitivity = 100 / Math.max(1, current.scale)
    const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * sensitivity
    const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * sensitivity
    current.onChange({
      positionX: clampPhotoPercent(drag.x - dx),
      positionY: clampPhotoPercent(drag.y - dy),
    })
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }
  return (
    <div
      className="absolute inset-0 z-[4] cursor-grab touch-none active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(event: WheelEvent<HTMLDivElement>) => {
        const current = editRef.current
        event.preventDefault()
        current.onChange({ scale: clampPhotoScale(current.scale + (event.deltaY > 0 ? -0.08 : 0.08)) })
      }}
    />
  )
}

function PortraitZoomBar(props: { edit: PortraitPhotoEdit }) {
  const { edit } = props
  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-1.5 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/60 px-1 py-0.5 text-white shadow"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-sm leading-none"
        aria-label={edit.zoomOutLabel}
        onClick={() => edit.onChange({ scale: clampPhotoScale(edit.scale - 0.1) })}
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums">{Math.round(edit.scale * 100)}%</span>
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-sm leading-none"
        aria-label={edit.zoomInLabel}
        onClick={() => edit.onChange({ scale: clampPhotoScale(edit.scale + 0.1) })}
      >
        +
      </button>
    </div>
  )
}

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
  photoEdit?: PortraitPhotoEdit
  editSide?: WeddingEditSide
}) {
  const nameText = props.name.trim() || props.label
  const frameStyle = albumPhotoFrameStyle(props.frame)
  const frameScale = props.frameScale && props.frameScale > 0 ? props.frameScale : 1
  const photoButton = props.onPhotoFile || props.onChoosePhoto ? (
    <div className="pointer-events-none absolute inset-x-2 bottom-[18%] z-20 flex justify-center">
      {props.onPhotoFile ? (
        <WeddingDeviceFileInput
          className="pointer-events-auto rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
          label={props.choosePhotoLabel ?? ''}
          onFiles={(files) => {
            const file = files[0]
            if (file) props.onPhotoFile?.(file)
          }}
        />
      ) : (
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow sm:text-[11px]"
          onClick={(event) => {
            event.stopPropagation()
            props.onChoosePhoto?.()
          }}
        >
          {props.choosePhotoLabel}
        </button>
      )}
    </div>
  ) : null
  return (
    <div className="relative w-full min-w-0">
    <figure
      className="group relative"
      style={centeredFrameBoxStyle(Math.round(frameScale * 1000) / 10)}
    >
      <div className="relative">
      <div data-wedding-portrait-photo="" className="relative">
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
            <div className={cn('flex h-full w-full items-center justify-center border border-dashed border-[#e8c87a]/80 font-serif', props.theme.accentText, props.theme.textGlow)}>
              <span className={props.compact ? 'text-2xl' : 'text-5xl sm:text-6xl'}>{initialOf(nameText)}</span>
            </div>
          )}
        </div>
      )}
      {props.photoEdit && props.imageUrl ? <PortraitPhotoPan edit={props.photoEdit} /> : null}
      </div>
      {props.photoEdit && props.imageUrl ? <PortraitZoomBar edit={props.photoEdit} /> : null}
      {photoButton}
      {props.frameScaleEdit ? <FrameEdgeGrips edit={props.frameScaleEdit} /> : null}
      {props.frameScaleEdit ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[6] flex justify-center">
          <FrameScaleDragBar edit={props.frameScaleEdit} className="pointer-events-auto mt-0" />
        </div>
      ) : null}
      </div>
      <figcaption
        className={cn('mt-2 text-center', props.editSide ? undefined : props.theme.text, props.editSide ? undefined : props.theme.textGlow)}
        style={props.editSide ? { color: WEDDING_EDIT_SIDE[props.editSide].ink } : undefined}
      >
        <p className={cn('uppercase tracking-[0.18em]', props.editSide ? undefined : props.theme.accentText, props.compact ? 'text-[8px]' : 'text-[10px] sm:text-[11px]')}>
          {props.label}
        </p>
        <p className={cn('mt-0.5 font-serif font-semibold leading-tight', props.compact ? 'text-[11px]' : 'text-sm sm:text-lg')}>
          {nameText}
        </p>
      </figcaption>
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
  groomChoosePhotoLabel?: string
  brideChoosePhotoLabel?: string
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
  groomPhotoEdit?: PortraitPhotoEdit
  bridePhotoEdit?: PortraitPhotoEdit
}) {
  const groomImageUrl = props.groomImageUrl.trim()
  const brideImageUrl = props.brideImageUrl.trim()
  const groomChoose = props.groomChoosePhotoLabel || props.choosePhotoLabel
  const brideChoose = props.brideChoosePhotoLabel || props.choosePhotoLabel
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
          editSide={props.showEmpty ? 'groom' : undefined}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          shell={props.groomShell}
          frameScale={props.groomFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={groomChoose}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('groom', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
          frameScaleEdit={props.groomFrameScaleEdit}
          photoEdit={props.groomPhotoEdit}
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
          editSide={props.showEmpty ? 'groom' : undefined}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          shell={props.groomShell}
          frameScale={props.groomFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={groomChoose}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('groom', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
          frameScaleEdit={props.groomFrameScaleEdit ?? props.pairFrameScaleEdit}
          photoEdit={props.groomPhotoEdit}
        />
        <Portrait
          imageUrl={brideImageUrl}
          name={props.brideName}
          label={props.brideLabel}
          editSide={props.showEmpty ? 'bride' : undefined}
          frame={props.brideFrame ?? PORTRAIT_FRAME}
          shell={props.brideShell}
          frameScale={props.brideFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={brideChoose}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('bride') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('bride', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('bride') : undefined}
          frameScaleEdit={props.brideFrameScaleEdit}
          photoEdit={props.bridePhotoEdit}
        />
      </div>
    )
  }

  return (
    <div className={cn('relative mx-auto w-full max-w-md', props.className)}>
      <div className={cn('grid grid-cols-[1fr_auto_1fr] items-start', props.compact ? 'gap-1.5' : 'gap-2 sm:gap-4')}>
        <Portrait
          imageUrl={groomImageUrl}
          name={props.groomName}
          label={props.groomLabel}
          editSide={props.showEmpty ? 'groom' : undefined}
          frame={props.groomFrame ?? PORTRAIT_FRAME}
          shell={props.groomShell}
          frameScale={props.groomFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={groomChoose}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('groom') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('groom', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('groom') : undefined}
          photoEdit={props.groomPhotoEdit}
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
          editSide={props.showEmpty ? 'bride' : undefined}
          frame={props.brideFrame ?? PORTRAIT_FRAME}
          shell={props.brideShell}
          frameScale={props.pairFrameScaleEdit ? props.groomFrameScale : props.brideFrameScale}
          theme={props.theme}
          compact={props.compact}
          choosePhotoLabel={brideChoose}
          chooseFrameLabel={props.chooseFrameLabel}
          onChoosePhoto={props.onChoosePhoto ? () => props.onChoosePhoto?.('bride') : undefined}
          onPhotoFile={props.onPhotoFile ? (file) => props.onPhotoFile?.('bride', file) : undefined}
          onChooseFrame={props.onChooseFrame ? () => props.onChooseFrame?.('bride') : undefined}
          frameScaleEdit={props.pairFrameScaleEdit ? undefined : props.brideFrameScaleEdit}
          photoEdit={props.bridePhotoEdit}
        />
      </div>
      {props.pairFrameScaleEdit ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[6] flex justify-center">
          <FrameScaleDragBar edit={props.pairFrameScaleEdit} className="pointer-events-auto mt-0" />
        </div>
      ) : null}
    </div>
  )
}
