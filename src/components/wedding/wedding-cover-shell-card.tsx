'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import { WeddingPhotoDownloadButton, WeddingRestylePhotoButton } from '@/components/wedding/wedding-restyle-photo-button'
import { weddingOrnamentGestureActive } from '@/lib/wedding/wedding-ornament-gesture'
import { cn } from '@/lib/utils'
import { buildCoverFrameHoleMask, clearCoverFrameHole, measureCoverFrameContentBox, type CoverFrameHoleMask } from '@/lib/wedding/cover-frame-hole-mask'
import type { CoverFrameHolePct } from '@/lib/wedding/measure-cover-frame-hole'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import { getWeddingCoverPreset, WEDDING_FAN_PHOTO_RATIO, weddingCoverGateTone, weddingCoverPhotoClip, weddingCoverPhotoHead, weddingLeafFrameFor, type WeddingCoverPhotoHead, type WeddingCoverPreset, type WeddingGateTone } from '@/lib/wedding/wedding-cover-presets'
import './wedding-cover-intro.css'
import { getOrnamentComposition, type OrnamentComposition } from '@/lib/wedding/wedding-ornament-layouts'
import { WeddingOrnamentStage } from '@/components/wedding/wedding-ornament-stage'
import type { WeddingCoverFrameAsset } from '@/lib/wedding/wedding-cover-frame-assets'
import { WEDDING_FRAME_SCALE_MAX, WEDDING_FRAME_SCALE_MIN, WEDDING_FRAME_SCALE_STEP, albumPhotoFrameStyle, centeredFrameBoxStyle, clampWeddingFrameScale, weddingCoverFrameScaleFloor, weddingFrameScalePercent, type WeddingAlbumPhotoFrame, type WeddingCoverFrameOpen, type WeddingCoverPhotoOpen, type WeddingPortraitShellFrame, type WeddingStackPlace } from '@/lib/wedding/wedding-section-config'
import { type WeddingStackedFrameScaleEdit, type WeddingStackedNameEdit, type WeddingStackedPhotoEdit } from '@/components/wedding/wedding-stacked-couple-photos'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingCoupleNames, type WeddingCoupleNameEdit } from '@/components/wedding/wedding-couple-names'
import { WeddingGuestNameFontLink } from '@/components/wedding/wedding-guest-name-font'
import { WeddingGuestInviteBlock } from '@/components/wedding/wedding-guest-invite-block'
import { WeddingSolidCtaButton } from '@/components/wedding/wedding-solid-cta-button'
import { bindWeddingButtonFill, type WeddingButtonColor } from '@/lib/wedding/wedding-button-colors'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

type WeddingCoverShellCardProps = {
  presetId: string
  /** Khung AI đã xóa nền. Có thì thay vỏ mẫu. */
  aiFrame?: WeddingCoverFrameAsset | null
  coverPhotoUrl?: string
  coverPhotoObjectPosition?: string
  coverPhotoScale?: number
  /** Hai ảnh trên đầu vỏ. Dùng khi khung là bố cục pair. */
  pairLeftUrl?: string
  pairRightUrl?: string
  /** Căn ảnh đã lưu. Thiệp công khai không có nút sửa. */
  pairLeftCrop?: { x: number; y: number; scale: number }
  pairRightCrop?: { x: number; y: number; scale: number }
  /** Editor: chọn ảnh, kéo và zoom từng ảnh. */
  pairLeftEdit?: WeddingStackedPhotoEdit
  pairRightEdit?: WeddingStackedPhotoEdit
  /** Hai khung chồng. Có thì vỏ không dùng khung một ảnh. */
  stackPair?: {
    firstUrl: string
    secondUrl: string
    firstAlt: string
    secondAlt: string
    firstFrame?: WeddingAlbumPhotoFrame
    secondFrame?: WeddingAlbumPhotoFrame
    firstEdit?: WeddingStackedPhotoEdit
    secondEdit?: WeddingStackedPhotoEdit
    firstName?: string
    secondName?: string
    firstCaption?: string
    secondCaption?: string
    firstNameEdit?: WeddingStackedNameEdit
    secondNameEdit?: WeddingStackedNameEdit
    firstNameStyle?: CSSProperties
    secondNameStyle?: CSSProperties
    onNamePress?: (side: 'first' | 'second') => void
    frameScale?: number
    frameScaleEdit?: WeddingStackedFrameScaleEdit
    frameShell?: WeddingPortraitShellFrame | null
    firstShell?: WeddingPortraitShellFrame | null
    secondShell?: WeddingPortraitShellFrame | null
    chooseFrameLabel?: string
    onChooseFrame?: () => void
    onChooseFirstFrame?: () => void
    onChooseSecondFrame?: () => void
    place?: WeddingStackPlace | null
    onPlace?: (place: WeddingStackPlace) => void
    pinLayout?: boolean
    moveLabel?: string
    moveFrameLabel?: string
    moveNameLabel?: string
    firstRotate?: number
    secondRotate?: number
    onRotate?: (side: 'first' | 'second', degrees: number) => void
    rotateLabel?: string
    rotateLeftLabel?: string
    rotateRightLabel?: string
    showEmpty?: boolean
    editTools?: boolean
  }
  groomName: string
  brideName: string
  /** primary = một người. Vỏ hai ảnh và dấu & không dùng. */
  nameLayout?: 'pair' | 'primary'
  /** Editor: bấm tên trên vỏ để sửa chữ. */
  groomNameEdit?: WeddingCoupleNameEdit
  brideNameEdit?: WeddingCoupleNameEdit
  weddingDate?: string | null
  weddingTimeText?: string
  guestName?: string
  guestInviteVenue?: WeddingGuestInviteVenue
  guestInviteVenueLabel?: string
  /** Chế độ sửa: màu dòng nhà trai / nhà gái. Khách xem không truyền. */
  editSide?: 'groom' | 'bride'
  addressText?: string
  mapUrl?: string
  viewMapLabel?: string
  theme: WeddingTheme
  invitationLabel: string
  cordiallyInvitesLabel: string
  personalInviteText?: string
  openButtonLabel: string
  /** Màu nút Mở thiệp và nút bản đồ trên vỏ. */
  buttonColor?: WeddingButtonColor
  /** Màu nút Có đi trên vỏ. Không đi giữ trắng. */
  rsvpButtonColor?: WeddingButtonColor
  dateFallback: string
  photoAlt: string
  /** Editor: kéo và zoom ảnh ngay trong khung. Thiệp công khai không truyền. */
  coverPhotoEdit?: CoverPhotoEdit
  /** Editor: bấm lỗ khung để chọn / đổi ảnh. Thiệp công khai không truyền. */
  onChoosePhoto?: () => void
  /** Editor: ngón tay chạm đúng input file, Android Chrome mới mở thư viện ảnh. */
  onPhotoFile?: (file: File) => void
  choosePhotoLabel?: string
  changePhotoLabel?: string
  /** Editor: nút chọn khung ngay trên ảnh, cùng chỗ với nút chọn ảnh. */
  onChooseFrame?: () => void
  chooseFrameLabel?: string
  compact?: boolean
  /** Một nhịp phóng nhẹ rồi dừng. Chỉ thiệp công khai khi bật hiệu ứng. */
  breathe?: boolean
  /** none = chỉ ảnh. preset = khung mẫu trên thiệp. library / ai = khung lồng trên chữ Thân mời. */
  frameMode?: 'none' | 'preset' | 'library' | 'ai'
  photoOpen?: WeddingCoverPhotoOpen
  frameOpen?: WeddingCoverFrameOpen
  /** Preview và thiệp bật hiệu ứng: chạy hiệu ứng mở. Tắt thì chỉ fade ngắn để khỏi nhảy. */
  openMotion?: boolean
  /** Đổi hiệu ứng thì gắn lại để chạy lại. */
  motionKey?: string
  plainPhoto?: boolean
  /** portrait: ảnh đứng không khung. Mặc định là ảnh tròn của lựa chọn «không khung». */
  plainShape?: 'circle' | 'portrait'
  nestPhoto?: boolean
  /** Chỉ khung ảnh, không tên và không chữ Thân mời. Dùng trong nội dung thiệp. */
  frameOnly?: boolean
  /** Cỡ khung ảnh. 1.2 hiện là 100% và là mức nhỏ nhất. */
  frameScale?: number
  /** Editor: kéo cỡ khung. Không đổi vị trí hay zoom ảnh bên trong. */
  frameScaleEdit?: FrameScaleEdit
  /** Tên hiện bằng nét sâu theo chủ đề thiệp. */
  namesFlyIn?: boolean
  onOpen?: () => void
  /** Thiệp công khai: bỏ khoảng trống căn giữa, khung thấp hơn để nút nằm dưới vỏ. */
  fitViewport?: boolean
  /** Có tên khách + RSVP bật: trả lời ngay trên vỏ, không cần mở thiệp. */
  quickRsvp?: {
    yesLabel: string
    noLabel: string
    savedYesLabel: string
    savedNoLabel: string
    busy?: boolean
    choice?: 'yes' | 'no' | null
    /** Tổng người đi, hiện trên nút khi đã chọn có đi. */
    partyCount?: number
    onYes: () => void
    onNo: () => void
  }
}

export type FrameScaleEdit = {
  scale: number
  /** Mức nhỏ nhất của thanh. Ngôi sao là 120%. */
  minScale?: number
  onChange: (scale: number) => void
  label: string
  zoomOutLabel: string
  zoomInLabel: string
}

type CoverPhotoEdit = {
  x: number
  y: number
  scale: number
  onChange: (patch: { positionX?: number; positionY?: number; scale?: number }) => void
  zoomOutLabel: string
  zoomInLabel: string
}

function clampCoverPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampCoverScale(value: number) {
  return Math.max(1, Math.min(3, Math.round(value * 100) / 100))
}

function frameScaleOf(value: number | undefined, floor = WEDDING_FRAME_SCALE_MIN) {
  const num = value ?? floor
  if (!Number.isFinite(num)) return floor
  return clampWeddingFrameScale(num, floor)
}

function frameWidthPercent(base: number, scale: number) {
  return Math.round(base * scale * 10) / 10
}

/** Cỡ đang hiện 100% giữ đúng `minPercent`. Bấm to thì lớn hơn, vẫn tính từ giữa. */
function frameWidthFromMin(minPercent: number, scale: number | undefined) {
  return frameWidthPercent(minPercent, frameScaleOf(scale) / WEDDING_FRAME_SCALE_MIN)
}

function centeredWidthStyle(style: CSSProperties | undefined): { centered: boolean; style: CSSProperties } {
  const raw = style?.width
  if (typeof raw !== 'string' || !raw.endsWith('%')) return { centered: false, style: style ?? {} }
  const widthPercent = Number.parseFloat(raw)
  if (!Number.isFinite(widthPercent)) return { centered: false, style: style ?? {} }
  return { centered: true, style: { ...style, ...centeredFrameBoxStyle(widthPercent) } }
}

function useFrameScaleDrag(edit: FrameScaleEdit, sign: number) {
  const dragRef = useRef<{ pointerId: number; x: number; scale: number } | null>(null)
  const floor = edit.minScale ?? WEDDING_FRAME_SCALE_MIN
  const scale = frameScaleOf(edit.scale, floor)
  const emit = (value: number) => edit.onChange(frameScaleOf(Math.round(value * 100) / 100, floor))
  return {
    scale,
    step: (delta: number) => emit(scale + delta),
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragRef.current = { pointerId: event.pointerId, x: event.clientX, scale }
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* kéo vẫn cập nhật khi trình duyệt không giữ pointer */
      }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      event.stopPropagation()
      emit(drag.scale + ((sign * (event.clientX - drag.x)) / 140) * WEDDING_FRAME_SCALE_MIN)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
      event.stopPropagation()
    },
  }
}

export function FrameEdgeGrips(props: { edit: FrameScaleEdit }) {
  const left = useFrameScaleDrag(props.edit, -1)
  const right = useFrameScaleDrag(props.edit, 1)
  const grip =
    'absolute top-1/2 z-[5] flex h-7 w-3.5 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-rose-300 bg-white text-rose-700 shadow'
  return (
    <>
      <button
        type="button"
        aria-label={props.edit.zoomOutLabel}
        className={cn(grip, 'left-1')}
        onPointerDown={left.onPointerDown}
        onPointerMove={left.onPointerMove}
        onPointerUp={left.onPointerUp}
        onPointerCancel={left.onPointerUp}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-[10px] leading-none" aria-hidden>
          ↔
        </span>
      </button>
      <button
        type="button"
        aria-label={props.edit.zoomInLabel}
        className={cn(grip, 'right-1')}
        onPointerDown={right.onPointerDown}
        onPointerMove={right.onPointerMove}
        onPointerUp={right.onPointerUp}
        onPointerCancel={right.onPointerUp}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-[10px] leading-none" aria-hidden>
          ↔
        </span>
      </button>
    </>
  )
}

export function FrameScaleDragBar(props: { edit: FrameScaleEdit; className?: string }) {
  const drag = useFrameScaleDrag(props.edit, 1)
  const floor = props.edit.minScale ?? WEDDING_FRAME_SCALE_MIN
  const percent = weddingFrameScalePercent(drag.scale)
  const atMin = drag.scale <= floor
  const atMax = drag.scale >= WEDDING_FRAME_SCALE_MAX
  return (
    <div
      className={cn(
        'relative z-[5] mx-auto mt-1.5 flex w-[min(100%,12rem)] items-center gap-0.5 rounded-full border border-rose-200 bg-white/95 px-0.5 py-0.5 text-stone-800 shadow',
        props.className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-sm leading-none disabled:opacity-30"
        aria-label={props.edit.zoomOutLabel}
        disabled={atMin}
        onClick={() => drag.step(-WEDDING_FRAME_SCALE_STEP)}
      >
        −
      </button>
      <div
        role="slider"
        aria-label={props.edit.label}
        aria-valuemin={weddingFrameScalePercent(floor)}
        aria-valuemax={weddingFrameScalePercent(WEDDING_FRAME_SCALE_MAX)}
        aria-valuenow={percent}
        tabIndex={0}
        className="flex h-6 min-w-0 flex-1 cursor-ew-resize touch-none items-center justify-center text-[10px] font-medium tabular-nums"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault()
            drag.step(-WEDDING_FRAME_SCALE_STEP)
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            drag.step(WEDDING_FRAME_SCALE_STEP)
          }
        }}
      >
        {props.edit.label} {percent}%
      </div>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-sm leading-none disabled:opacity-30"
        aria-label={props.edit.zoomInLabel}
        disabled={atMax}
        onClick={() => drag.step(WEDDING_FRAME_SCALE_STEP)}
      >
        +
      </button>
    </div>
  )
}

function FrameResizeChrome(props: { edit?: FrameScaleEdit; className?: string; style?: CSSProperties; children: ReactNode }) {
  const sized = centeredWidthStyle(props.style)
  const box = (
    <div className={cn(props.className, 'relative', sized.centered && 'shrink-0', props.edit && 'pb-10')} style={sized.style}>
      {props.children}
      {props.edit ? (
        <>
          <FrameEdgeGrips edit={props.edit} />
          <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[6] flex justify-center">
            <FrameScaleDragBar edit={props.edit} className="pointer-events-auto mt-0" />
          </div>
        </>
      ) : null}
    </div>
  )
  if (!sized.centered) return box
  return <div className="relative w-full">{box}</div>
}

function coverPhotoBox(edit: CoverPhotoEdit | undefined, objectPosition?: string, scale?: number) {
  const position = edit ? `${edit.x}% ${edit.y}%` : objectPosition ?? '50% 50%'
  const zoom = Math.max(1, Math.min(3, edit?.scale ?? scale ?? 1))
  return { position, zoom }
}

function CoverPhotoZoomBar(props: { edit: CoverPhotoEdit; className?: string; style?: CSSProperties }) {
  const { edit } = props
  return (
    <div
      className={cn(
        'z-[2] flex items-center gap-0.5 rounded-full bg-black/60 px-1 py-0.5 text-white shadow',
        props.className,
      )}
      style={props.style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-sm leading-none"
        aria-label={edit.zoomOutLabel}
        onClick={() => edit.onChange({ scale: clampCoverScale(edit.scale - 0.1) })}
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums">{Math.round(edit.scale * 100)}%</span>
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-sm leading-none"
        aria-label={edit.zoomInLabel}
        onClick={() => edit.onChange({ scale: clampCoverScale(edit.scale + 0.1) })}
      >
        +
      </button>
    </div>
  )
}

function useCoverPhotoPan(edit: CoverPhotoEdit | undefined) {
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    x: number
    y: number
  } | null>(null)
  const editRef = useRef(edit)
  editRef.current = edit
  return {
    className: edit ? 'cursor-grab touch-none active:cursor-grabbing' : undefined,
    style: (edit ? { touchAction: 'none' } : undefined) as CSSProperties | undefined,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = editRef.current
      if (!current || weddingOrnamentGestureActive()) return
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
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = editRef.current
      const drag = dragRef.current
      if (!current || !drag || drag.pointerId !== event.pointerId) return
      const rect = event.currentTarget.getBoundingClientRect()
      const sensitivity = 100 / Math.max(1, current.scale)
      const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * sensitivity
      const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * sensitivity
      current.onChange({
        positionX: clampCoverPercent(drag.x - dx),
        positionY: clampCoverPercent(drag.y - dy),
      })
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }
    },
    onPointerCancel: () => {
      dragRef.current = null
    },
    onWheel: (event: WheelEvent<HTMLDivElement>) => {
      const current = editRef.current
      if (!current) return
      event.preventDefault()
      current.onChange({ scale: clampCoverScale(current.scale + (event.deltaY > 0 ? -0.08 : 0.08)) })
    },
  }
}

function CoverPhotoPan(props: {
  edit?: CoverPhotoEdit
  className?: string
  style?: CSSProperties
  hideZoom?: boolean
  children: ReactNode
}) {
  const pan = useCoverPhotoPan(props.edit)
  const { className: panClass, style: panStyle, ...events } = pan
  return (
    <div className={cn(props.className, panClass)} style={{ ...props.style, ...panStyle }} {...events}>
      {props.children}
      {props.edit && !props.hideZoom ? (
        <CoverPhotoZoomBar edit={props.edit} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      ) : null}
    </div>
  )
}

const COVER_INTRO_NODES =
  '.wedding-couple-from-left, .wedding-couple-from-right, .wedding-couple-amp, .wedding-couple-ornament, .wedding-invite-body-join, .wedding-cover-photo-open, .wedding-cover-photo-fade, .wedding-cover-photo-zoom, .wedding-cover-photo-assemble, .wedding-cover-frame-fade, .wedding-cover-frame-settle, .wedding-cover-frame-bloom, .wedding-cover-frame-assemble, .wedding-fan-spread'

function coverPhotoMotionClass(open: WeddingCoverPhotoOpen | undefined) {
  if (open === 'fade') return 'wedding-cover-photo-fade'
  if (open === 'zoom') return 'wedding-cover-photo-zoom'
  if (open === 'assemble') return 'wedding-cover-photo-assemble'
  if (open === 'none') return undefined
  return 'wedding-cover-photo-open'
}

function coverFrameMotionClass(open: WeddingCoverFrameOpen | undefined, openMotion: boolean | undefined) {
  if (!openMotion || open === 'none') return 'wedding-cover-frame-settle'
  if (open === 'fade') return 'wedding-cover-frame-fade'
  if (open === 'assemble') return 'wedding-cover-frame-assemble'
  return 'wedding-cover-frame-bloom'
}

type CoverIntroWindow = Window & { __weddingCoverIntroAt?: number }

/** Hiệu ứng vỏ chỉ chạy sau khi hydrate, và lần gắn DOM sau vẫn nối tiếp đúng thời điểm — không mở lại từ đầu. */
function useCoverIntroOnce(enabled: boolean) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [play, setPlay] = useState(() => {
    if (!enabled) return true
    if (typeof window === 'undefined') return false
    return (window as CoverIntroWindow).__weddingCoverIntroAt != null
  })

  useLayoutEffect(() => {
    if (!enabled) return
    const w = window as CoverIntroWindow
    if (w.__weddingCoverIntroAt == null) w.__weddingCoverIntroAt = performance.now()
    setPlay(true)
  }, [enabled])

  useLayoutEffect(() => {
    if (!enabled || !play) return
    const started = (window as CoverIntroWindow).__weddingCoverIntroAt
    if (started == null) return
    const elapsed = performance.now() - started
    const root = rootRef.current
    if (!root) return
    const stage = root.closest('[data-wedding-stage]')
    const nodes = [
      ...root.querySelectorAll<HTMLElement>(COVER_INTRO_NODES),
      ...(stage ? stage.querySelectorAll<HTMLElement>('.wedding-cover-ornament-open') : []),
    ]
    nodes.forEach((node) => {
      for (const anim of node.getAnimations()) anim.currentTime = elapsed
    })
  }, [enabled, play])

  return { rootRef, hold: enabled && !play }
}

function CoverActions(props: {
  themeId: string
  buttonColor?: WeddingButtonColor
  rsvpButtonColor?: WeddingButtonColor
  compact?: boolean
  className?: string
  openLabel: string
  onOpen?: () => void
  quickRsvp?: WeddingCoverShellCardProps['quickRsvp']
}) {
  const rsvp = props.quickRsvp
  const size = props.compact ? 'h-8 px-3 text-[10px]' : 'h-9 px-3 text-xs'
  const yesOn = rsvp?.choice === 'yes'
  const noOn = rsvp?.choice === 'no'
  return (
    <div className={cn('flex flex-col items-center gap-1.5', props.className)}>
      <div className="flex flex-nowrap items-center justify-center gap-1.5">
        {props.onOpen ? (
          <WeddingSolidCtaButton weddingThemeId={props.themeId} buttonColor={props.buttonColor} compact={props.compact} onClick={props.onOpen}>
            {props.openLabel}
          </WeddingSolidCtaButton>
        ) : (
          <WeddingSolidCtaButton
            weddingThemeId={props.themeId}
            buttonColor={props.buttonColor}
            compact={props.compact}
            className="pointer-events-none"
            tabIndex={-1}
            aria-hidden
          >
            {props.openLabel}
          </WeddingSolidCtaButton>
        )}
        {rsvp ? (
          <>
            <button
              type="button"
              disabled={rsvp.busy}
              aria-pressed={yesOn}
              onClick={rsvp.onYes}
              className={cn(
                'inline-flex items-center justify-center rounded-full border-2 font-bold transition-transform active:scale-[0.98] disabled:opacity-60',
                props.rsvpButtonColor
                  ? yesOn
                    ? 'shadow-[0_6px_18px_rgba(0,0,0,0.28)] ring-2 ring-white/80 ring-offset-2 ring-offset-[#fff8f0]'
                    : 'shadow-[0_6px_18px_rgba(0,0,0,0.28)]'
                  : yesOn
                    ? 'border-emerald-950 bg-emerald-800 text-white shadow-[0_6px_18px_rgba(0,0,0,0.28)] ring-2 ring-emerald-200 ring-offset-2 ring-offset-[#fff8f0]'
                    : 'border-stone-300 bg-white text-stone-900 shadow-[0_6px_18px_rgba(0,0,0,0.12)]',
                size,
              )}
              {...(props.rsvpButtonColor ? bindWeddingButtonFill(props.rsvpButtonColor) : {})}
            >
              {rsvp.yesLabel}
              {yesOn && rsvp.partyCount != null ? ` · ${rsvp.partyCount}` : ''}
            </button>
            <button
              type="button"
              disabled={rsvp.busy}
              aria-pressed={noOn}
              onClick={rsvp.onNo}
              className={cn(
                'inline-flex items-center justify-center rounded-full border-2 font-bold shadow-[0_6px_18px_rgba(0,0,0,0.18)] transition-transform active:scale-[0.98] disabled:opacity-60',
                noOn
                  ? 'border-stone-800 bg-white text-stone-900 shadow-[0_6px_18px_rgba(0,0,0,0.12)] ring-2 ring-stone-300 ring-offset-2 ring-offset-[#fff8f0]'
                  : 'border-stone-300 bg-white text-stone-900 shadow-[0_6px_18px_rgba(0,0,0,0.12)]',
                size,
              )}
            >
              {rsvp.noLabel}
            </button>
          </>
        ) : null}
      </div>
      {rsvp?.choice === 'yes' ? (
        <p className={cn('font-medium text-emerald-950', props.compact ? 'text-[9px]' : 'text-xs')} role="status">
          {rsvp.savedYesLabel}
        </p>
      ) : null}
    </div>
  )
}

function CoverPhoto(props: {
  url: string
  alt: string
  compact?: boolean
  className?: string
  objectPosition?: string
  scale?: number
  /** Phóng cả ô ảnh, khác với zoom nội dung. */
  boxScale?: number
  breathe?: boolean
  /** Ảnh vỏ hiện từ từ lúc thiệp mở, cùng nhịp tên bay vào. */
  openSlowly?: boolean
  /** standard = ảnh thường, tall = ảnh vòm, fit = vỏ rút trong một màn, fan = rẻ quạt, leaf = lá thật đục lỗ, fill = lấp lỗ khung, moon = trăng tròn, star = ngôi sao. */
  box?: 'standard' | 'tall' | 'fit' | 'compact' | 'fan' | 'leaf' | 'fill' | 'moon' | 'star'
  frameStyle?: CSSProperties
}) {
  if (!props.url.trim()) return null
  const objectPosition = props.objectPosition ?? '50% 50%'
  const scale = Math.max(1, Math.min(3, props.scale ?? 1))
  const boxScale = props.box === 'fill' && (props.boxScale ?? 1) <= 1 ? 1 : frameScaleOf(props.boxScale)
  const aspect = props.box === 'leaf' || props.box === 'moon' || props.box === 'star'
  const fill = props.box === 'fill'
  const photoBox = fill ? 'fill' : !aspect && props.compact ? 'compact' : props.box ?? (props.compact ? 'compact' : 'standard')
  const fluid = fill || photoBox === 'fit'
  const photoHeight = photoBox === 'compact' ? '6rem' : 'var(--wedding-cover-photo-h, 15rem)'
  const portrait = !fill && !aspect && !props.compact && (photoBox === 'fit' || photoBox === 'standard' || photoBox === 'tall')
  const span = fill ? 100 : 86
  return (
    <div className={cn(fill ? 'h-full w-full' : 'relative w-full')}>
    <div
      data-cover-photo={photoBox}
      className={cn(
        'relative overflow-hidden',
        fill || fluid ? 'h-full' : 'shrink-0 shadow-md ring-1 ring-black/5',
        !fill && (props.compact ? 'rounded-lg' : 'rounded-2xl'),
        props.openSlowly && 'wedding-cover-photo-open',
        props.className,
      )}
      style={{
        ...centeredFrameBoxStyle(frameWidthPercent(span, boxScale)),
        ...(portrait
          ? { height: 'auto', aspectRatio: '3 / 4' }
          : boxScale === 1 || aspect || fill || fluid
            ? {}
            : { height: `calc((${photoHeight}) * ${boxScale})` }),
        ...props.frameStyle,
      }}
    >
      <div className={cn('absolute inset-0', props.breathe && !props.compact && 'wedding-cover-breathe')}>
        <img
          src={props.url}
          alt={props.alt}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
          style={{
            objectPosition,
            transform: `scale(${scale})`,
            transformOrigin: objectPosition,
          }}
        />
      </div>
    </div>
    </div>
  )
}

/** Vỏ thiệp cao theo nội dung. Ảnh không bị cắt để nhét vừa một màn. */
const COVER_SHELL = 'flex min-h-0 w-full flex-col'
const COVER_PHOTO_SLOT = 'mx-auto grid w-full max-w-full shrink-0 place-items-center'

function fitInPhotoSlot(width: number, height: number): CSSProperties {
  return {
    aspectRatio: `${width} / ${height}`,
    width: '86%',
    maxWidth: '100%',
    height: 'auto',
    marginInline: 'auto',
  }
}

function CoverPhotoSlot(props: { children: ReactNode; className?: string }) {
  return <div className={cn(COVER_PHOTO_SLOT, props.className)}>{props.children}</div>
}

function GlassCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  return (
    <WeddingReadableGlass
      themeId={theme.id}
      className={cn(
        'w-full text-center',
        !compact && COVER_SHELL,
        compact ? 'max-w-[200px] rounded-[1.2rem] p-3' : 'rounded-[1.35rem] p-3 sm:p-3.5',
        props.namesFlyIn && !compact && 'overflow-visible',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div ref={intro.rootRef} className={cn(!compact && 'flex min-h-0 flex-1 flex-col')}>
      <p className={cn('shrink-0 uppercase tracking-[0.28em] sm:tracking-[0.35em]', compact ? 'text-[8px]' : 'text-[11px] sm:text-xs', theme.accentText, theme.textGlow)}>
        {props.invitationLabel}
      </p>
      <WeddingCoupleNames
        groomName={props.groomName}
        brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
        flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
        className={cn('shrink-0 font-serif font-semibold italic', compact ? 'mt-2 text-base leading-tight' : 'mt-1 text-[clamp(1.05rem,7cqi,2rem)] leading-none', theme.text, theme.textGlowHeading)}
      />
      <div className={cn(theme.accent, 'shrink-0', compact ? 'my-2 text-lg' : 'my-1 text-xl leading-none', props.namesFlyIn && !compact && 'wedding-couple-ornament', theme.textGlow)}>{theme.ornament}</div>
      {props.coverPhotoUrl ? (
        <CoverPhotoSlot className={compact ? 'my-2 h-auto min-h-0' : 'my-1'}>
        <FrameResizeChrome edit={props.frameScaleEdit} className="w-full">
          <CoverPhotoPan edit={props.coverPhotoEdit} className="relative w-full">
            <CoverPhoto
              url={props.coverPhotoUrl}
              alt={props.photoAlt}
              compact={compact}
              box={compact ? 'compact' : 'fit'}
              objectPosition={coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale).position}
              scale={coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale).zoom}
              boxScale={props.frameScale}
              breathe={props.breathe}
              openSlowly={props.namesFlyIn && !compact}
            />
            {props.onChoosePhoto || props.onPhotoFile ? (
              <CoverFrameActions
                hasPhoto
                onChoosePhoto={props.onChoosePhoto}
                onPhotoFile={props.onPhotoFile}
                onChooseFrame={props.onChooseFrame}
                changePhotoLabel={props.changePhotoLabel}
                chooseFrameLabel={props.chooseFrameLabel}
                restyleSlot="cover"
                photoUrl={props.coverPhotoUrl}
                className="bottom-1.5 left-1/2"
              />
            ) : null}
          </CoverPhotoPan>
        </FrameResizeChrome>
        </CoverPhotoSlot>
      ) : props.onPhotoFile || props.onChoosePhoto ? (
        <CoverPhotoSlot className={compact ? 'my-2' : 'my-1'}>
          <div className="relative aspect-[3/4] w-[86%] overflow-hidden rounded-2xl border border-dashed border-[#e8c87a]/70 bg-white/35">
            <CoverFrameActions
              hasPhoto={false}
              onChoosePhoto={props.onChoosePhoto}
              onPhotoFile={props.onPhotoFile}
              onChooseFrame={props.onChooseFrame}
              choosePhotoLabel={props.choosePhotoLabel}
              chooseFrameLabel={props.chooseFrameLabel}
              className="left-1/2 top-1/2 -translate-y-1/2"
            />
          </div>
        </CoverPhotoSlot>
      ) : null}
      {!props.guestName ? (
        <p className={cn(compact ? 'text-[10px]' : 'text-xs sm:text-sm', theme.mutedText, theme.textGlow)}>
          {props.weddingDate || props.dateFallback}
        </p>
      ) : null}
      {props.guestName ? (
        <WeddingGuestInviteBlock
          className={cn(compact ? 'mt-2' : 'mt-2 sm:mt-3 lg:mt-2', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
          guestName={props.guestName}
          inviteVenue={props.guestInviteVenue ?? ''}
          cordiallyInvitesLabel={props.cordiallyInvitesLabel}
          venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
          weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
          weddingTimeText={props.weddingTimeText}
          addressText={props.addressText}
          mapUrl={props.mapUrl}
          viewMapLabel={props.viewMapLabel ?? ''}
          panelClassName={theme.panelStrong}
          cordiallyClassName={cn(theme.mutedText, theme.textGlow)}
          nameClassName={cn(theme.text, theme.textGlowHeading)}
          venueClassName={cn(theme.accentText, theme.textGlow)}
          addressClassName={cn(theme.mutedText, theme.textGlow)}
          weddingThemeId={theme.id}
          buttonColor={props.buttonColor}
          compact={compact}
          dense={props.fitViewport}
          personalInviteText={props.personalInviteText}
          personalInviteClassName={cn(theme.mutedText, theme.textGlow)}
        />
      ) : null}
      <CoverActions
        themeId={theme.id}
        buttonColor={props.buttonColor}
        rsvpButtonColor={props.rsvpButtonColor}
        compact={compact}
        className={compact ? 'mt-3' : props.fitViewport ? 'mt-1.5' : 'mt-3 sm:mt-4 lg:mt-3'}
        openLabel={props.openButtonLabel}
        onOpen={props.onOpen}
        quickRsvp={props.quickRsvp}
      />
      </div>
    </WeddingReadableGlass>
  )
}

function RedArchCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const preset = getWeddingCoverPreset(props.presetId)
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  return (
    <div
      ref={intro.rootRef}
      data-cover-theme={theme.id}
      className={cn(
        'relative w-full text-center shadow-2xl ring-1 ring-black/10 [container-type:inline-size]',
        !compact && COVER_SHELL,
        props.namesFlyIn && !compact ? 'overflow-visible' : 'overflow-hidden',
        compact ? 'max-w-[200px] rounded-[1.2rem]' : 'max-w-md rounded-[1.5rem] sm:rounded-[2rem]',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div
        className={cn(compact ? 'px-3 pb-2 pt-3' : 'px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6')}
        style={{ background: preset.thumbnail.topBg }}
      >
        <p className={cn('uppercase tracking-[0.28em] text-white/90', compact ? 'text-[7px]' : 'text-[10px]')}>
          {props.invitationLabel}
        </p>
        <WeddingCoupleNames
          groomName={props.groomName}
          brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
          flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
          className={cn('font-serif font-semibold text-white', compact ? 'mt-1 text-sm' : 'mt-2 text-[clamp(1.05rem,8cqi,2.35rem)] leading-none sm:mt-3')}
        />
        <div className={cn('text-amber-300', compact ? 'my-1 text-base' : 'my-2 text-xl sm:my-3 sm:text-2xl', props.namesFlyIn && !compact && 'wedding-couple-ornament')}>{preset.ornament}</div>
      </div>
      <div className={cn('relative flex min-h-0 flex-1 flex-col bg-[#fff8f0]/72 px-3 pb-2 pt-2 backdrop-blur-sm sm:px-4', compact && 'block flex-none')}>
        <div
          className="pointer-events-none absolute -top-4 left-1/2 h-8 w-[108%] -translate-x-1/2 rounded-[100%] bg-[#fff8f0]/72 backdrop-blur-sm"
          aria-hidden
        />
        {props.coverPhotoUrl ? (
          <CoverPhotoSlot className={compact ? 'h-auto min-h-0' : 'my-1'}>
          <FrameResizeChrome edit={props.frameScaleEdit} className="w-full">
            <CoverPhotoPan edit={props.coverPhotoEdit} className="relative w-full">
              <CoverPhoto
                url={props.coverPhotoUrl}
                alt={props.photoAlt}
                compact={compact}
                box={compact ? undefined : 'fit'}
                objectPosition={coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale).position}
                scale={coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale).zoom}
                boxScale={props.frameScale}
                breathe={props.breathe}
                openSlowly={props.namesFlyIn && !compact}
              />
              {props.onChoosePhoto || props.onPhotoFile ? (
                <CoverFrameActions
                  hasPhoto
                  onChoosePhoto={props.onChoosePhoto}
                  onPhotoFile={props.onPhotoFile}
                  onChooseFrame={props.onChooseFrame}
                  changePhotoLabel={props.changePhotoLabel}
                  chooseFrameLabel={props.chooseFrameLabel}
                  restyleSlot="cover"
                  photoUrl={props.coverPhotoUrl}
                  className="bottom-1.5 left-1/2"
                />
              ) : null}
            </CoverPhotoPan>
          </FrameResizeChrome>
          </CoverPhotoSlot>
        ) : props.onPhotoFile || props.onChoosePhoto ? (
          <CoverPhotoSlot className={compact ? undefined : 'my-1'}>
            <div className="relative aspect-[3/4] w-[86%] overflow-hidden rounded-2xl border border-dashed border-rose-300/80 bg-white/50">
              <CoverFrameActions
                hasPhoto={false}
                onChoosePhoto={props.onChoosePhoto}
                onPhotoFile={props.onPhotoFile}
                onChooseFrame={props.onChooseFrame}
                choosePhotoLabel={props.choosePhotoLabel}
                chooseFrameLabel={props.chooseFrameLabel}
                className="left-1/2 top-1/2 -translate-y-1/2"
              />
            </div>
          </CoverPhotoSlot>
        ) : null}
        {!props.guestName ? (
          <p className={cn('mt-2 sm:mt-3', compact ? 'text-[10px]' : 'text-xs sm:text-sm', theme.mutedText)}>
            {props.weddingDate || props.dateFallback}
          </p>
        ) : null}
        {props.guestName ? (
          <WeddingGuestInviteBlock
            className={cn('mt-2 lg:mt-2', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
            guestName={props.guestName}
            inviteVenue={props.guestInviteVenue ?? ''}
            cordiallyInvitesLabel={props.cordiallyInvitesLabel}
            venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
            weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
            weddingTimeText={props.weddingTimeText}
            addressText={props.addressText}
            mapUrl={props.mapUrl}
            viewMapLabel={props.viewMapLabel ?? ''}
            panelClassName={cn('bg-white/75', theme.panelStrong)}
            cordiallyClassName={theme.mutedText}
            nameClassName={theme.text}
            venueClassName={theme.accentText}
            addressClassName={theme.mutedText}
            weddingThemeId={theme.id}
          buttonColor={props.buttonColor}
            compact={compact}
            dense={props.fitViewport}
            personalInviteText={props.personalInviteText}
            personalInviteClassName={theme.mutedText}
          />
        ) : null}
        <CoverActions
          themeId={theme.id}
          buttonColor={props.buttonColor}
          rsvpButtonColor={props.rsvpButtonColor}
          compact={compact}
          className={compact ? 'mt-2' : props.fitViewport ? 'mt-1.5' : 'mt-2 sm:mt-3 lg:mt-2'}
          openLabel={props.openButtonLabel}
          onOpen={props.onOpen}
          quickRsvp={props.quickRsvp}
        />
      </div>
    </div>
  )
}

type CoverHoleMask = { url: string; cutUrl: string; box: CoverFrameHolePct; content: CoverFrameHolePct | null; aspect: number }

const coverHoleMaskCache = new Map<string, CoverHoleMask | null>()

function rasterizeCoverHoleMask(img: HTMLImageElement, hole: CoverFrameHolePct): CoverHoleMask | null {
  const maxSide = 420
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(8, Math.round(img.naturalWidth * scale))
  const height = Math.max(8, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height)
  const source = new Uint8ClampedArray(pixels.data)
  const mask: CoverFrameHoleMask | null = buildCoverFrameHoleMask(pixels.data, width, height, {
    x: ((hole.x + hole.w / 2) / 100) * width,
    y: ((hole.y + hole.h / 2) / 100) * height,
  })
  if (!mask) return null
  const cut = ctx.createImageData(width, height)
  cut.data.set(clearCoverFrameHole(source, mask.rgba))
  ctx.putImageData(cut, 0, 0)
  const cutUrl = canvas.toDataURL('image/png')
  const out = ctx.createImageData(width, height)
  out.data.set(mask.rgba)
  ctx.putImageData(out, 0, 0)
  return {
    url: canvas.toDataURL('image/png'),
    cutUrl,
    box: mask.box,
    content: measureCoverFrameContentBox(source, width, height),
    aspect: img.naturalWidth / Math.max(1, img.naturalHeight),
  }
}

function loadCoverFrameImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('frame'))
    img.src = src
  })
}

/** Cắt ảnh theo lỗ alpha thật của khung (vòng hoa, oval), không theo hình chữ nhật nội tiếp. */
function useCoverFrameHoleMask(src: string, hole: CoverFrameHolePct) {
  const [mask, setMask] = useState<CoverHoleMask | null | undefined>(() => {
    if (!src) return null
    const cached = coverHoleMaskCache.get(src)
    return cached === undefined ? undefined : cached
  })
  useEffect(() => {
    if (!src) {
      setMask(null)
      return
    }
    const cached = coverHoleMaskCache.get(src)
    if (cached !== undefined) {
      setMask(cached)
      return
    }
    let cancelled = false
    const apply = (value: CoverHoleMask | null) => {
      coverHoleMaskCache.set(src, value)
      if (!cancelled) setMask(value)
    }
    void (async () => {
      const remote = /^https?:\/\//i.test(src)
      let image: HTMLImageElement
      try {
        image = await loadCoverFrameImage(src)
      } catch {
        if (!remote) {
          apply(null)
          return
        }
        try {
          image = await loadCoverFrameImage(`/api/fetch-image?url=${encodeURIComponent(src)}`)
        } catch {
          apply(null)
          return
        }
      }
      let built: CoverHoleMask | null = null
      try {
        built = rasterizeCoverHoleMask(image, hole)
      } catch {
        built = null
      }
      if (!built && remote && image.src === src) {
        try {
          const proxied = await loadCoverFrameImage(`/api/fetch-image?url=${encodeURIComponent(src)}`)
          built = rasterizeCoverHoleMask(proxied, hole)
        } catch {
          built = null
        }
      }
      apply(built)
    })()
    return () => {
      cancelled = true
    }
  }, [src, hole.x, hole.y, hole.w, hole.h])
  return mask
}

function tightFrameContent(content: CoverFrameHolePct | null | undefined): CoverFrameHolePct | null {
  if (!content || content.w < 8 || content.h < 8 || (content.w > 96 && content.h > 96)) return null
  return content
}

function CoverFrameViewport(props: {
  className?: string
  children: ReactNode
  content?: CoverFrameHolePct | null
  imageAspect?: number
  /** Trần cao khung trên vỏ công khai, để nút Mở thiệp còn dưới vỏ. */
  maxHeight?: string
  /** Phần trăm chiều ngang ô cha. Mặc định 86. */
  widthPercent?: number
  /** Vừa ô ảnh của vỏ. Không dùng % vì ô cha đang co theo nội dung thì % ra 0. */
  slotFit?: boolean
}) {
  const tight = tightFrameContent(props.content)
  const imageAspect = props.imageAspect && props.imageAspect > 0 ? props.imageAspect : 3 / 4
  const aspect = tight ? (tight.w / tight.h) * imageAspect : imageAspect
  const widthPercent = props.widthPercent && props.widthPercent > 0 ? props.widthPercent : 86
  // Chiều cao chỉ sinh từ aspect-ratio. Trần cao đi vào chiều ngang, nếu không khung bị kéo méo.
  const width = props.maxHeight
    ? `min(${widthPercent}%, calc((${props.maxHeight}) * ${aspect}))`
    : `${widthPercent}%`
  return (
    <div
      className={cn('relative z-[12] overflow-hidden', props.className)}
      style={
        props.slotFit
          ? fitInPhotoSlot(aspect, 1)
          : {
              aspectRatio: String(aspect),
              height: 'auto',
              ...(props.maxHeight
                ? { width, maxWidth: `${widthPercent}%`, marginInline: 'auto' }
                : centeredFrameBoxStyle(widthPercent)),
            }
      }
    >
      <div
        className="absolute"
        style={
          tight
            ? {
                left: `${(-tight.x / tight.w) * 100}%`,
                top: `${(-tight.y / tight.h) * 100}%`,
                width: `${10000 / tight.w}%`,
                height: `${10000 / tight.h}%`,
              }
            : { inset: 0 }
        }
      >
        {props.children}
      </div>
    </div>
  )
}

function CoverDevicePhotoControl(props: {
  label: string
  className?: string
  style?: CSSProperties
  onFile: (file: File) => void
}) {
  return (
    <WeddingDeviceFileInput
      className={props.className}
      style={props.style}
      label={props.label}
      onFiles={(files) => {
        const file = files[0]
        if (file) props.onFile(file)
      }}
    />
  )
}

function CoverFrameActions(props: {
  hasPhoto: boolean
  onChoosePhoto?: () => void
  onPhotoFile?: (file: File) => void
  onChooseFrame?: () => void
  choosePhotoLabel?: string
  changePhotoLabel?: string
  chooseFrameLabel?: string
  restyleSlot?: 'cover' | 'groom' | 'bride'
  photoUrl?: string
  className?: string
  style?: CSSProperties
}) {
  if (!props.onChoosePhoto && !props.onPhotoFile && !props.onChooseFrame && !props.restyleSlot && !props.photoUrl) return null
  const photoLabel = (props.hasPhoto ? props.changePhotoLabel : props.choosePhotoLabel) || ''
  return (
    <>
    {props.photoUrl ? <WeddingPhotoDownloadButton url={props.photoUrl} className="absolute right-1.5 top-10 z-30" /> : null}
    <div
      className={cn('pointer-events-auto absolute z-[8] flex -translate-x-1/2 flex-col items-center justify-center gap-1', props.className)}
      style={props.style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {props.onPhotoFile ? (
        <CoverDevicePhotoControl
          label={photoLabel}
          onFile={props.onPhotoFile}
          className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow"
        />
      ) : props.onChoosePhoto ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            props.onChoosePhoto?.()
          }}
          className="pointer-events-auto rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow"
        >
          {photoLabel}
        </button>
      ) : null}
      {props.restyleSlot ? <WeddingRestylePhotoButton slot={props.restyleSlot} hasPhoto={props.hasPhoto} /> : null}
    </div>
    </>
  )
}

/** Kéo ảnh trong lỗ khung bằng vị trí và cỡ, không scale quanh object-position vì cách đó nuốt cú kéo. */
function framedPortraitShift(objectPosition: string, scale: number): CSSProperties {
  const parts = objectPosition.trim().split(/\s+/)
  const x = Number.parseFloat(parts[0] ?? '')
  const y = Number.parseFloat(parts[1] ?? '')
  return albumPhotoFrameStyle({
    x: Number.isFinite(x) ? x : 50,
    y: Number.isFinite(y) ? y : 18,
    scale,
  })
}

/** Ảnh lồng trong khung có sẵn hoặc khung AI. Dùng cho chân dung cô dâu / chú rể. */
export function WeddingFramedPhoto(props: {
  frameSrc: string
  hole: CoverFrameHolePct
  photoUrl: string
  alt: string
  objectPosition?: string
  scale?: number
  frameScale?: number
  className?: string
}) {
  const holeMask = useCoverFrameHoleMask(props.frameSrc, props.hole)
  const photoFrame = holeMask?.box ?? props.hole
  const objectPosition = props.objectPosition ?? '50% 18%'
  const scale = Math.max(1, Math.min(3, props.scale ?? 1))
  const passedScale = props.frameScale
  const widthPercent = passedScale == null || passedScale <= 1 ? 100 : frameWidthFromMin(100, passedScale)
  return (
    <CoverFrameViewport
      className={cn(holeMask === undefined && 'opacity-0', props.className)}
      content={holeMask?.content}
      imageAspect={holeMask?.aspect}
      widthPercent={widthPercent}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={
          holeMask
            ? {
                WebkitMaskImage: `url("${holeMask.url}")`,
                maskImage: `url("${holeMask.url}")`,
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }
            : undefined
        }
      >
        <div
          className="absolute overflow-hidden"
          style={{ left: `${photoFrame.x}%`, top: `${photoFrame.y}%`, width: `${photoFrame.w}%`, height: `${photoFrame.h}%` }}
        >
          {props.photoUrl ? (
            <img
              src={props.photoUrl}
              alt={props.alt}
              draggable={false}
              className="absolute select-none object-cover"
              style={framedPortraitShift(objectPosition, scale)}
            />
          ) : null}
        </div>
      </div>
      <img src={holeMask?.cutUrl || props.frameSrc} alt="" crossOrigin="anonymous" draggable={false} className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none" />
    </CoverFrameViewport>
  )
}

function FrameCoverCard(props: WeddingCoverShellCardProps & { preset: WeddingCoverPreset }) {
  const frame = props.preset.frame
  const plain = Boolean(props.plainPhoto)
  const { compact, theme } = props
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  const hole = frame?.hole ?? { x: 18, y: 18, w: 64, h: 64 }
  const holeMask = useCoverFrameHoleMask(!plain && frame ? frame.src : '', hole)
  if (!frame && !plain) return <GlassCoverCard {...props} />
  const panel = plain ? 'transparent' : (frame?.panel ?? '#fffaf2')
  const light = frame?.ink === 'light'
  const skyGarden = props.preset.id === 'vuon_hong_troi'
  const textCls = plain || skyGarden ? cn(theme.text, theme.textGlowHeading) : light ? 'text-white' : 'text-stone-900'
  const mutedCls = plain || skyGarden ? cn(theme.mutedText, theme.textGlow) : light ? 'text-white/80' : 'text-stone-600'
  const accentCls = plain
    ? cn(theme.accent, theme.textGlow)
    : skyGarden
      ? cn(theme.accentText, theme.textGlow)
      : light
        ? 'text-amber-200'
        : 'text-rose-800'
  const photoFrame = holeMask?.box ?? hole
  const photoBox = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
  const frameScale = frameScaleOf(props.frameScale)
  const frameWidth = frameWidthPercent(86, frameScale)
  const nestFrame = !plain && Boolean(frame) && (Boolean(props.nestPhoto) || Boolean(props.frameOnly))
  const photoMotion = props.openMotion
    ? coverPhotoMotionClass(props.photoOpen)
    : props.namesFlyIn && !compact
      ? 'wedding-cover-photo-open'
      : undefined
  const frameMotion = coverFrameMotionClass(props.frameOpen, props.openMotion)
  const frameArt = (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={
          holeMask
            ? {
                WebkitMaskImage: `url("${holeMask.url}")`,
                maskImage: `url("${holeMask.url}")`,
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }
            : undefined
        }
      >
        <div className="absolute inset-0" style={{ backgroundColor: panel }} aria-hidden />
        <CoverPhotoPan
          edit={props.coverPhotoUrl ? props.coverPhotoEdit : undefined}
          hideZoom
          className="pointer-events-auto absolute overflow-hidden"
          style={{ left: `${photoFrame.x}%`, top: `${photoFrame.y}%`, width: `${photoFrame.w}%`, height: `${photoFrame.h}%`, backgroundColor: panel }}
        >
          {props.coverPhotoUrl && holeMask !== undefined ? (
            <div className={cn('absolute inset-0', photoMotion, props.breathe && !compact && 'wedding-cover-breathe')}>
              <img
                src={props.coverPhotoUrl}
                alt={props.photoAlt}
                draggable={false}
                className="absolute inset-0 h-full w-full select-none object-cover"
                style={{
                  objectPosition: photoBox.position,
                  transform: `scale(${photoBox.zoom})`,
                  transformOrigin: photoBox.position,
                }}
              />
            </div>
          ) : null}
        </CoverPhotoPan>
      </div>
      {frame ? (
        <img
          src={holeMask?.cutUrl || frame.src}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none"
        />
      ) : null}
      {props.coverPhotoEdit && props.coverPhotoUrl ? (
        <CoverPhotoZoomBar
          edit={props.coverPhotoEdit}
          className="absolute z-[2]"
          style={{
            left: `${hole.x + hole.w / 2}%`,
            top: `${hole.y + hole.h / 2}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ) : null}
      <CoverFrameActions
        hasPhoto={Boolean(props.coverPhotoUrl)}
        onChoosePhoto={props.onChoosePhoto}
        onPhotoFile={props.onPhotoFile}
        onChooseFrame={props.onChooseFrame}
        choosePhotoLabel={props.choosePhotoLabel}
        changePhotoLabel={props.changePhotoLabel}
        chooseFrameLabel={props.chooseFrameLabel}
        restyleSlot="cover"
        photoUrl={props.coverPhotoUrl}
        className={props.coverPhotoUrl ? undefined : '-translate-y-1/2'}
        style={{
          left: `${hole.x + hole.w / 2}%`,
          top: props.coverPhotoUrl ? `calc(${hole.y + hole.h}% - 1.75rem)` : `${hole.y + hole.h / 2}%`,
        }}
      />
    </>
  )
  if (props.frameOnly) {
    return (
      <FrameResizeChrome
        edit={props.frameScaleEdit}
        className="mx-auto"
        style={{ width: `${plain ? frameWidthPercent(86, frameScale) : frameWidth}%` }}
      >
        {plain ? (
          <div key={props.motionKey} className={cn('relative w-full', photoMotion || 'wedding-cover-frame-settle')} style={{ aspectRatio: props.plainShape === 'portrait' ? '3 / 4' : '1 / 1' }}>
            <CoverPhotoPan
              edit={props.coverPhotoUrl ? props.coverPhotoEdit : undefined}
              className={cn('absolute inset-0 overflow-hidden', props.plainShape === 'portrait' ? 'rounded-2xl shadow-[0_18px_40px_rgba(20,4,8,0.38)]' : 'rounded-full', props.plainShape === 'portrait' && !props.coverPhotoUrl && 'border border-dashed border-[#e8c87a]/70')}
              style={{ backgroundColor: panel }}
            >
              {props.coverPhotoUrl ? (
                <img
                  src={props.coverPhotoUrl}
                  alt={props.photoAlt}
                  draggable={false}
                  className="absolute inset-0 h-full w-full select-none object-cover"
                  style={{
                    objectPosition: photoBox.position,
                    transform: `scale(${photoBox.zoom})`,
                    transformOrigin: photoBox.position,
                  }}
                />
              ) : null}
            </CoverPhotoPan>
          </div>
        ) : (
          <CoverFrameViewport
            key={props.motionKey}
            className={cn(holeMask === undefined ? 'opacity-0' : frameMotion)}
            content={holeMask?.content}
            imageAspect={holeMask?.aspect}
            widthPercent={100}
          >
            {frameArt}
          </CoverFrameViewport>
        )}
      </FrameResizeChrome>
    )
  }
  return (
    <div
      ref={plain || nestFrame ? intro.rootRef : undefined}
      data-cover-theme={theme.id}
      className={cn(
        'mx-auto w-full',
        !compact && COVER_SHELL,
        compact ? 'max-w-[210px]' : 'max-w-[22rem] sm:max-w-[26rem]',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div
        className={cn(
          'relative shrink-0 text-center [container-type:inline-size]',
          compact ? 'px-2 pb-1 pt-1.5' : 'px-3 pb-1 pt-1',
        )}
      >
        <p className={cn('uppercase tracking-[0.22em]', compact ? 'text-[8px]' : 'text-[11px]', mutedCls)}>
          {props.invitationLabel}
        </p>
        <WeddingCoupleNames
          groomName={props.groomName}
          brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
          flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
          className={cn(
            'font-serif font-semibold',
            compact ? 'mt-1 text-sm leading-tight' : 'mt-0.5 text-[clamp(1rem,7cqi,1.85rem)] leading-none',
            textCls,
          )}
        />
        <div className={cn(accentCls, compact ? 'my-0.5 text-base' : 'my-0 text-xl leading-none', props.namesFlyIn && !compact && 'wedding-couple-ornament')}>
          {props.preset.ornament}
        </div>
      </div>
      {plain || nestFrame ? null : (
        <CoverPhotoSlot>
        <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidthFromMin(86, frameScale)}%` }}>
          <div key={props.motionKey} ref={intro.rootRef} className={cn('relative w-full', frameMotion)} style={{ aspectRatio: '3 / 4' }}>
            {frameArt}
          </div>
        </FrameResizeChrome>
        </CoverPhotoSlot>
      )}
      {plain ? (
        <CoverPhotoSlot>
          <FrameResizeChrome
            edit={props.frameScaleEdit}
            className="mx-auto"
            style={{ width: `${frameWidthFromMin(86, frameScale)}%` }}
          >
            <div key={props.motionKey} className={cn('relative w-full', photoMotion || 'wedding-cover-frame-settle')} style={{ aspectRatio: props.plainShape === 'portrait' ? '3 / 4' : '1 / 1' }}>
              <CoverPhotoPan
                edit={props.coverPhotoUrl ? props.coverPhotoEdit : undefined}
                className={cn('absolute inset-0 overflow-hidden', props.plainShape === 'portrait' ? 'rounded-2xl' : 'rounded-full', props.plainShape === 'portrait' && !props.coverPhotoUrl && 'border border-dashed border-[#e8c87a]/70')}
              >
                {props.coverPhotoUrl ? (
                  <img
                    src={props.coverPhotoUrl}
                    alt={props.photoAlt}
                    draggable={false}
                    className="absolute inset-0 h-full w-full select-none object-cover"
                    style={{
                      objectPosition: photoBox.position,
                      transform: `scale(${photoBox.zoom})`,
                      transformOrigin: photoBox.position,
                    }}
                  />
                ) : null}
              </CoverPhotoPan>
              <CoverFrameActions
                hasPhoto={Boolean(props.coverPhotoUrl)}
                onChoosePhoto={props.onChoosePhoto}
                onPhotoFile={props.onPhotoFile}
                onChooseFrame={props.onChooseFrame}
                choosePhotoLabel={props.choosePhotoLabel}
                changePhotoLabel={props.changePhotoLabel}
                chooseFrameLabel={props.chooseFrameLabel}
                restyleSlot="cover"
                photoUrl={props.coverPhotoUrl}
                className={props.coverPhotoUrl ? 'bottom-2 left-1/2' : 'left-1/2 top-1/2 -translate-y-1/2'}
              />
            </div>
          </FrameResizeChrome>
        </CoverPhotoSlot>
      ) : null}
      {nestFrame ? (
        <CoverPhotoSlot>
          <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidthFromMin(86, frameScale)}%` }}>
            <CoverFrameViewport
              key={props.motionKey}
              className={cn('w-full', holeMask === undefined ? 'opacity-0' : frameMotion)}
              content={holeMask?.content}
              imageAspect={holeMask?.aspect}
              widthPercent={100}
            >
              {frameArt}
            </CoverFrameViewport>
          </FrameResizeChrome>
        </CoverPhotoSlot>
      ) : null}
      <div className={cn('relative shrink-0 text-center', compact ? 'px-2 pb-2' : 'px-3 pb-2')}>
        {!props.guestName ? (
          <p className={cn(compact ? 'text-[10px]' : 'text-xs sm:text-sm', mutedCls)}>{props.weddingDate || props.dateFallback}</p>
        ) : null}
        {props.guestName ? (
          <WeddingGuestInviteBlock
            className={cn('mt-0.5', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
            guestName={props.guestName}
            inviteVenue={props.guestInviteVenue ?? ''}
            cordiallyInvitesLabel={props.cordiallyInvitesLabel}
            venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
            weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
            weddingTimeText={props.weddingTimeText}
            addressText={props.addressText}
            mapUrl={props.mapUrl}
            viewMapLabel={props.viewMapLabel ?? ''}
            panelClassName={plain ? 'bg-black/25' : light ? 'bg-white/10' : 'bg-white/70'}
            cordiallyClassName={mutedCls}
            nameClassName={textCls}
            venueClassName={accentCls}
            addressClassName={mutedCls}
            weddingThemeId={theme.id}
          buttonColor={props.buttonColor}
            compact={compact}
            dense={props.fitViewport}
            personalInviteText={props.personalInviteText}
            personalInviteClassName={mutedCls}
          />
        ) : null}
        <CoverActions
          themeId={theme.id}
          buttonColor={props.buttonColor}
          rsvpButtonColor={props.rsvpButtonColor}
          compact={compact}
          className={compact ? 'mt-2' : 'mt-1.5'}
          openLabel={props.openButtonLabel}
          onOpen={props.onOpen}
          quickRsvp={props.quickRsvp}
        />
      </div>
    </div>
  )
}

function PolaroidPhotoStack(props: {
  composition: OrnamentComposition
  photo: ReactNode
  photoMotion?: string
  frameMotion?: string
  edit?: CoverPhotoEdit
  breathe?: boolean
  onChoosePhoto?: () => void
  onPhotoFile?: (file: File) => void
  choosePhotoLabel?: string
  changePhotoLabel?: string
  photoUrl?: string
}) {
  const slot = props.composition.layout.photo
  const holeStyle = { left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }
  const hasPhoto = Boolean(props.photo)
  return (
    <div className={cn('relative aspect-[3/4] w-full', props.frameMotion)} style={{ transform: 'rotate(-3.5deg)' }}>
      {props.edit ? (
        <CoverPhotoPan
          edit={props.edit}
          hideZoom
          className={cn('absolute z-[1] overflow-hidden bg-[#f3ebe1]', props.photoMotion)}
          style={holeStyle}
        >
          <div className={cn('absolute inset-0', props.breathe && 'wedding-cover-breathe')}>{props.photo}</div>
        </CoverPhotoPan>
      ) : (
        <div className={cn('absolute z-[1] overflow-hidden bg-[#f3ebe1]', props.photoMotion)} style={holeStyle}>
          <div className={cn('absolute inset-0', props.breathe && 'wedding-cover-breathe')}>{props.photo}</div>
        </div>
      )}
      <WeddingOrnamentStage kit={props.composition.kit} layout={props.composition.layout} />
      {props.edit && hasPhoto ? (
        <CoverPhotoZoomBar
          edit={props.edit}
          className="pointer-events-auto absolute z-[12]"
          style={{
            left: `${slot.x + slot.w / 2}%`,
            top: `${slot.y + slot.h / 2}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ) : null}
      <CoverFrameActions
        hasPhoto={hasPhoto}
        onChoosePhoto={props.onChoosePhoto}
        onPhotoFile={props.onPhotoFile}
        choosePhotoLabel={props.choosePhotoLabel}
        changePhotoLabel={props.changePhotoLabel}
        restyleSlot="cover"
        photoUrl={props.photoUrl}
        className={cn('z-[12]', hasPhoto ? undefined : '-translate-y-1/2')}
        style={{
          left: `${slot.x + slot.w / 2}%`,
          top: hasPhoto ? `calc(${slot.y + slot.h}% - 1.75rem)` : `${slot.y + slot.h / 2}%`,
        }}
      />
    </div>
  )
}

const WOOD_MAT_SHADOW = 'inset 0 0 0 1px rgba(31,61,43,0.28), 0 0 0 1px #1f3d2b, 0 0 0 5px #fbf8f3, 0 0 0 6px rgba(31,61,43,0.5)'

function ComposedCoverCard(props: WeddingCoverShellCardProps & { preset: WeddingCoverPreset; composition: OrnamentComposition }) {
  const { compact, theme, composition } = props
  const { kit, layout } = composition
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact && !props.frameOnly))
  const frameScale = frameScaleOf(props.frameScale)
  const frameWidth = frameWidthPercent(props.frameOnly ? 100 : 92, frameScale)
  const photoBox = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
  const photoMotion = props.openMotion
    ? coverPhotoMotionClass(props.photoOpen)
    : props.namesFlyIn && !compact
      ? 'wedding-cover-photo-open'
      : undefined
  const frameMotion = coverFrameMotionClass(props.frameOpen, props.openMotion)
  const photo = props.coverPhotoUrl ? (
    <img
      src={props.coverPhotoUrl}
      alt={props.photoAlt}
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-cover"
      style={{ objectPosition: photoBox.position, transform: `scale(${photoBox.zoom})`, transformOrigin: photoBox.position }}
    />
  ) : null

  if (layout.id === 'polaroid') {
    const stack = (
      <PolaroidPhotoStack
        composition={composition}
        photo={photo}
        photoMotion={photoMotion}
        frameMotion={frameMotion}
        edit={props.coverPhotoEdit}
        breathe={Boolean(props.breathe && !compact)}
        onChoosePhoto={props.frameOnly ? undefined : props.onChoosePhoto}
        onPhotoFile={props.frameOnly ? undefined : props.onPhotoFile}
        choosePhotoLabel={props.choosePhotoLabel}
        changePhotoLabel={props.changePhotoLabel}
        photoUrl={props.coverPhotoUrl}
      />
    )
    if (props.frameOnly) {
      return (
        <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
          <div key={props.motionKey} className="relative w-full py-4">{stack}</div>
        </FrameResizeChrome>
      )
    }
    return (
      <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
        <div key={props.motionKey} ref={intro.rootRef} data-cover-theme={theme.id} className={cn('w-full [container-type:inline-size]', intro.hold && 'wedding-cover-hold')}>
          <div className="relative w-full py-2 text-center">
            <p className={cn('uppercase tracking-[0.28em]', compact ? 'text-[8px]' : 'text-[11px]')} style={{ color: kit.metal }}>
              {props.invitationLabel}
            </p>
            <WeddingCoupleNames
              groomName={props.groomName}
              brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
              flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
              className={cn(
                'font-serif font-medium italic text-[#4a433c]',
                compact ? 'mt-1 text-sm leading-tight' : props.fitViewport ? 'mt-1 text-[clamp(1.15rem,7cqi,1.9rem)] leading-none' : 'mt-1.5 text-[clamp(1.25rem,8cqi,2.2rem)] leading-none',
              )}
            />
            <div className={cn('mx-auto my-1 w-[86%]', compact && 'mt-2')}>{stack}</div>
            {!props.guestName ? (
              <p className={cn('text-[#8a7e72]', compact ? 'mt-2 text-[10px]' : 'mt-3 text-xs sm:text-sm')}>{props.weddingDate || props.dateFallback}</p>
            ) : null}
            {props.guestName ? (
              <WeddingGuestInviteBlock
                className={cn(compact ? 'mt-2' : 'mt-3', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
                guestName={props.guestName}
                inviteVenue={props.guestInviteVenue ?? ''}
                cordiallyInvitesLabel={props.cordiallyInvitesLabel}
                venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
                weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
                weddingTimeText={props.weddingTimeText}
                addressText={props.addressText}
                mapUrl={props.mapUrl}
                viewMapLabel={props.viewMapLabel ?? ''}
                panelClassName="bg-white/70"
                cordiallyClassName="text-[#8a7e72]"
                nameClassName="text-[#4a433c]"
                venueClassName="text-[#5c5348]"
                addressClassName="text-[#8a7e72]"
                weddingThemeId={theme.id}
                buttonColor={props.buttonColor}
                compact={compact}
                dense={props.fitViewport}
                personalInviteText={props.personalInviteText}
                personalInviteClassName="text-[#8a7e72]"
              />
            ) : null}
            <CoverActions
              themeId={theme.id}
              buttonColor={props.buttonColor}
              rsvpButtonColor={props.rsvpButtonColor}
              compact={compact}
              className={compact ? 'mt-2' : props.fitViewport ? 'mt-2' : 'mt-3'}
              openLabel={props.openButtonLabel}
              onOpen={props.onOpen}
              quickRsvp={props.quickRsvp}
            />
          </div>
        </div>
      </FrameResizeChrome>
    )
  }

  const mat = layout.photoChrome === 'mat'
  if (props.frameOnly) {
    const slot = layout.photo
    return (
      <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
        <div
          key={props.motionKey}
          className={cn(
            'relative aspect-[3/4] w-full overflow-hidden',
            mat ? 'rounded-[1.15rem] shadow-[0_16px_40px_rgba(31,61,43,0.12)] ring-1 ring-[#1f3d2b]/10' : 'rounded-[1.25rem] ring-1 ring-stone-900/10',
            frameMotion,
          )}
          style={{ background: kit.panel }}
        >
          {photo ? (
            <CoverPhotoPan
              edit={props.coverPhotoEdit}
              className="absolute z-[1] overflow-hidden"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.w}%`,
                height: `${slot.h}%`,
                borderRadius: slot.radius,
                boxShadow: mat ? WOOD_MAT_SHADOW : undefined,
              }}
            >
              <div className={cn('absolute inset-0', photoMotion)}>{photo}</div>
            </CoverPhotoPan>
          ) : null}
          <WeddingOrnamentStage kit={kit} layout={layout} />
        </div>
      </FrameResizeChrome>
    )
  }

  return (
    <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
      <div key={props.motionKey} ref={intro.rootRef} data-cover-theme={theme.id} className={cn('w-full [container-type:inline-size]', intro.hold && 'wedding-cover-hold')}>
      <div
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-[1.35rem] text-center shadow-[0_18px_44px_rgba(40,32,24,0.16)] ring-1 ring-stone-900/10',
          !compact && COVER_SHELL,
          frameMotion,
        )}
        style={{ background: kit.panel }}
      >
        <WeddingOrnamentStage kit={kit} layout={layout} />
        <div
          className="relative z-40"
          style={{
            paddingTop: `${layout.pad.top}%`,
            paddingRight: `${layout.pad.right}%`,
            paddingBottom: `${layout.pad.bottom}%`,
            paddingLeft: `${layout.pad.left}%`,
          }}
        >
          <p className={cn('shrink-0 uppercase tracking-[0.22em]', compact ? 'text-[8px]' : 'text-[11px]')} style={{ color: kit.metal }}>
            {props.invitationLabel}
          </p>
          <WeddingCoupleNames
            groomName={props.groomName}
            brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
            flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
            className={cn(
              'shrink-0 font-serif font-semibold text-stone-900',
              compact ? 'mt-1 text-sm leading-tight' : 'mt-0.5 text-[clamp(1.05rem,7cqi,1.85rem)] leading-none',
            )}
          />
          {photo ? (
            compact ? (
            <CoverPhotoPan
              edit={props.coverPhotoEdit}
              className={cn('relative mx-auto mt-2 w-full overflow-hidden', !mat && 'shadow-md')}
              style={{ borderRadius: Math.min(layout.photo.radius, 22), aspectRatio: '3 / 4', boxShadow: mat ? WOOD_MAT_SHADOW : undefined }}
            >
              <div className={cn('absolute inset-0', photoMotion)}>{photo}</div>
            </CoverPhotoPan>
            ) : (
            <CoverPhotoSlot className="my-1">
            <CoverPhotoPan
              edit={props.coverPhotoEdit}
              className={cn('relative mx-auto w-full overflow-hidden', !mat && 'shadow-md')}
              style={{ borderRadius: Math.min(layout.photo.radius, 22), aspectRatio: '3 / 4', height: 'auto', boxShadow: mat ? WOOD_MAT_SHADOW : undefined }}
            >
              <div className={cn('absolute inset-0', photoMotion, props.breathe && 'wedding-cover-breathe')}>{photo}</div>
            </CoverPhotoPan>
            </CoverPhotoSlot>
            )
          ) : null}
          <div className={cn(compact ? 'my-0.5 text-base' : 'my-1 text-2xl leading-none', props.namesFlyIn && !compact && 'wedding-couple-ornament')} style={{ color: kit.metal }}>
            {props.preset.ornament}
          </div>
          {!props.guestName ? (
            <p className={cn('text-stone-600', compact ? 'text-[10px]' : 'text-xs sm:text-sm')}>{props.weddingDate || props.dateFallback}</p>
          ) : null}
          {props.guestName ? (
            <WeddingGuestInviteBlock
              className={cn(compact ? 'mt-1' : 'mt-1.5', props.namesFlyIn && !compact && 'wedding-invite-body-join')}
              guestName={props.guestName}
              inviteVenue={props.guestInviteVenue ?? ''}
              cordiallyInvitesLabel={props.cordiallyInvitesLabel}
              venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
              weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
              weddingTimeText={props.weddingTimeText}
              addressText={props.addressText}
              mapUrl={props.mapUrl}
              viewMapLabel={props.viewMapLabel ?? ''}
              panelClassName="bg-white/75"
              cordiallyClassName="text-stone-600"
              nameClassName="text-stone-900"
              venueClassName="text-stone-800"
              addressClassName="text-stone-600"
              weddingThemeId={theme.id}
              buttonColor={props.buttonColor}
              compact={compact}
              dense={props.fitViewport}
              personalInviteText={props.personalInviteText}
              personalInviteClassName="text-stone-600"
            />
          ) : null}
          <CoverActions
            themeId={theme.id}
            buttonColor={props.buttonColor}
            rsvpButtonColor={props.rsvpButtonColor}
            compact={compact}
            className={compact ? 'mt-2' : props.fitViewport ? 'mt-2' : 'mt-3'}
            openLabel={props.openButtonLabel}
            onOpen={props.onOpen}
            quickRsvp={props.quickRsvp}
          />
        </div>
      </div>
      </div>
    </FrameResizeChrome>
  )
}

function leafFramePixels(aspect: string): [number, number] {
  const [width, height] = aspect.split('/').map((part) => Number(part.trim()))
  if (!width || !height) return [3, 2]
  return [width, height]
}

function songHyFrameClass(head: WeddingCoverPhotoHead, compact?: boolean): string {
  if (!compact) return 'grid w-full place-items-center'
  const width =
    head === 'fan' ? 'w-[9.5rem]'
    : head === 'leaf' ? 'w-[min(100%,13.5rem)]'
    : head === 'star' ? 'w-full'
    : head === 'moon' ? 'w-[6.75rem]'
    : 'w-[6.25rem]'
  return cn('mx-auto mt-2', width)
}

function songHyPhotoBox(head: WeddingCoverPhotoHead, compact: boolean | undefined, place: 'cover' | 'inside'): 'compact' | 'fan' | 'fit' | 'tall' | 'leaf' | 'moon' | 'star' {
  if (head === 'leaf' || head === 'moon' || head === 'star') return head
  if (head === 'fan') return compact ? 'compact' : 'fan'
  if (compact) return 'compact'
  return place === 'inside' ? 'tall' : 'fit'
}

function SongHyLeafMount(props: { children: ReactNode; presetId?: string; fit?: boolean; frameScale?: number; fillParent?: boolean }) {
  const frame = weddingLeafFrameFor(props.presetId)
  const [frameWidth, frameHeight] = leafFramePixels(frame.aspect)
  const width = props.fillParent ? 100 : frameWidthFromMin(props.fit ? 86 : 100, props.frameScale)
  return (
    <div className="relative" style={{ ...centeredFrameBoxStyle(width), aspectRatio: `${frameWidth} / ${frameHeight}`, filter: 'drop-shadow(0 10px 18px rgba(40, 22, 8, 0.32))' }}>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          WebkitMaskImage: `url("${frame.mask}")`,
          maskImage: `url("${frame.mask}")`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      >
        {props.children}
      </div>
      <img
        src={frame.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none object-contain"
      />
    </div>
  )
}

function SongHyPhotoMount(props: { head: WeddingCoverPhotoHead; tone: WeddingGateTone; children: ReactNode; presetId?: string; fit?: boolean; spread?: boolean; frameScale?: number; fillParent?: boolean }) {
  if (props.head === 'leaf') return <SongHyLeafMount presetId={props.presetId} fit={props.fit} frameScale={props.frameScale} fillParent={props.fillParent}>{props.children}</SongHyLeafMount>
  const clip = weddingCoverPhotoClip(props.head)
  if (clip && (props.head === 'star' || props.head === 'moon')) {
    const width = props.fillParent ? 100 : frameWidthFromMin(100, props.frameScale)
    return (
      <div className="relative mx-auto" style={{ width: `${width}%`, aspectRatio: '1 / 1' }}>
        <div className="absolute inset-0" style={{ filter: `drop-shadow(${props.tone.photoShadow})` }}>
          <div className="h-full w-full p-[5px]" style={{ background: props.tone.frame, clipPath: clip }}>
            <div className="relative h-full w-full overflow-hidden" style={{ clipPath: clip }}>
              {props.children}
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (clip) {
    const fan = props.head === 'fan'
    const spread = fan && props.spread
    const fanBox = fan
      ? {
          aspectRatio: WEDDING_FAN_PHOTO_RATIO,
          height: 'auto' as const,
          ...centeredFrameBoxStyle(props.fillParent ? 100 : frameWidthFromMin(100, props.frameScale)),
        }
      : undefined
    const frame = (
      <div className={fan ? 'absolute inset-0' : undefined} style={{ filter: `drop-shadow(${props.tone.photoShadow})` }}>
        <div className={cn(fan ? 'h-full' : undefined, 'p-[5px]', spread && 'wedding-fan-spread')} style={{ background: props.tone.frame, clipPath: clip }}>
          <div className={cn('relative overflow-hidden', fan && 'h-full', spread && 'wedding-fan-spread')} style={{ clipPath: clip }}>
            {props.children}
          </div>
        </div>
      </div>
    )
    if (!fan) return frame
    return (
      <div className="relative" style={fanBox}>
        {frame}
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-t-[999px] rounded-b-md border-[5px] border-solid" style={{ borderColor: props.tone.frame, background: props.tone.frame, boxShadow: props.tone.photoShadow }}>
      {props.children}
    </div>
  )
}

/** Ảnh cặp đôi trên vỏ song hỷ: vòm, rẻ quạt, lá thật đục lỗ, trăng tròn hoặc ngôi sao, nằm dưới ấn. */
function SongHyCoverPhoto(props: WeddingCoverShellCardProps) {
  const compact = props.compact
  const head = weddingCoverPhotoHead(props.presetId)
  const tone = weddingCoverGateTone(props.presetId)
  const photo = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
  const frame = songHyFrameClass(head, compact)
  const square = head === 'star' || head === 'moon'
  const frameOwned = head === 'fan' || head === 'leaf' || square
  const shapedScale = frameScaleOf(props.frameScale, weddingCoverFrameScaleFloor(props.presetId))
  const ownedWidth = head === 'fan' || square
    ? frameWidthFromMin(100, shapedScale)
    : head === 'leaf'
      ? frameWidthFromMin(compact ? 100 : 86, props.frameScale)
      : null
  if (!props.coverPhotoUrl && !props.onPhotoFile && !props.onChoosePhoto) return null
  const emptyShape = head === 'moon' || head === 'star' ? '1 / 1' : '3 / 4'
  return (
    <div className={frame}>
      <FrameResizeChrome edit={props.frameScaleEdit} className={cn(!compact && 'mx-auto', ownedWidth == null && !compact && 'w-full')} style={ownedWidth != null ? { width: `${ownedWidth}%` } : undefined}>
        <CoverPhotoPan edit={props.coverPhotoUrl ? props.coverPhotoEdit : undefined} className={compact ? 'relative' : 'relative w-full'}>
          <SongHyPhotoMount head={head} tone={tone} presetId={props.presetId} fit={!compact} spread={!compact && !props.frameScaleEdit && Boolean(props.coverPhotoUrl)} frameScale={frameOwned ? WEDDING_FRAME_SCALE_MIN : props.frameScale} fillParent={frameOwned}>
            {props.coverPhotoUrl ? (
              <CoverPhoto
                url={props.coverPhotoUrl}
                alt={props.photoAlt}
                compact={compact}
                box={head === 'leaf' || head === 'fan' || square ? 'fill' : compact ? songHyPhotoBox(head, compact, 'cover') : 'fit'}
                objectPosition={photo.position}
                scale={photo.zoom}
                boxScale={frameOwned ? 1 : props.frameScale}
                breathe={props.breathe}
                openSlowly={props.namesFlyIn && !compact}
                className="rounded-none shadow-none ring-0"
              />
            ) : head === 'fan' || head === 'leaf' ? (
              <div className="h-full w-full" />
            ) : (
              <div className="w-full" style={{ aspectRatio: emptyShape }} />
            )}
          </SongHyPhotoMount>
          {props.onChoosePhoto || props.onPhotoFile ? (
            <CoverFrameActions
              hasPhoto={Boolean(props.coverPhotoUrl)}
              onChoosePhoto={props.onChoosePhoto}
              onPhotoFile={props.onPhotoFile}
              onChooseFrame={props.onChooseFrame}
              choosePhotoLabel={props.choosePhotoLabel}
              changePhotoLabel={props.changePhotoLabel}
              chooseFrameLabel={props.chooseFrameLabel}
              restyleSlot="cover"
              photoUrl={props.coverPhotoUrl}
              className={props.coverPhotoUrl ? 'bottom-2 left-1/2' : 'left-1/2 top-1/2 -translate-y-1/2'}
            />
          ) : null}
        </CoverPhotoPan>
      </FrameResizeChrome>
    </div>
  )
}

/** Bìa cổng vòm: ấn, ảnh cặp đôi, tên thư pháp. Màu theo chủ đề. */
function SongHyCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const tone = weddingCoverGateTone(props.presetId)
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  const gateStyle = {
    background: tone.card,
    color: tone.ink,
    boxShadow: tone.glow,
    '--gate-ink': tone.ink,
    '--gate-accent': tone.accent,
    '--gate-muted': tone.muted,
  } as CSSProperties
  return (
    <div
      ref={intro.rootRef}
      data-cover-theme={theme.id}
      className={cn(
        'relative mx-auto w-full overflow-visible text-center',
        !compact && COVER_SHELL,
        compact ? 'max-w-[200px] rounded-[1rem] px-3 py-4' : 'max-w-md rounded-[1.35rem] px-4 py-2 sm:px-5',
        intro.hold && 'wedding-cover-hold',
      )}
      style={gateStyle}
    >
      <WeddingGuestNameFontLink />
      <span aria-hidden className={cn('pointer-events-none absolute font-serif leading-none', compact ? '-left-2 top-2 text-5xl' : '-left-3 top-6 text-[7.5rem]')} style={{ color: tone.watermark }}>{tone.mark}</span>
      <span aria-hidden className={cn('pointer-events-none absolute font-serif leading-none', compact ? '-right-2 bottom-2 text-4xl' : '-right-4 bottom-6 text-[6.5rem]')} style={{ color: tone.watermarkSoft }}>{tone.mark}</span>
      <div className={cn('relative', !compact && 'flex min-h-0 flex-1 flex-col')}>
        <div className={cn('mx-auto flex shrink-0 items-center justify-center rounded-full border', compact ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-base')} style={{ borderColor: tone.accent, color: tone.ink, boxShadow: tone.sealGlow }}>{tone.mark}</div>
        <WeddingCoupleNames
          groomName={props.groomName}
          brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
          flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
          className={cn(
            'wedding-guest-name shrink-0 text-[var(--gate-ink)]',
            compact ? 'mt-2 text-lg leading-tight' : 'mt-0.5 text-[clamp(1.05rem,5.2cqi,1.65rem)] leading-none',
          )}
        />
        {compact ? <SongHyCoverPhoto {...props} /> : (
          <CoverPhotoSlot className={cn('my-0.5', weddingCoverPhotoHead(props.presetId) === 'leaf' && '-mx-4 w-[calc(100%+2rem)] max-w-none flex-1 shrink basis-[18rem] !h-auto min-h-[8.5rem] sm:-mx-5 sm:w-[calc(100%+2.5rem)]')}>
            <SongHyCoverPhoto {...props} />
          </CoverPhotoSlot>
        )}
        <div className={cn('mx-auto flex shrink-0 items-center justify-center', compact ? 'mt-2 gap-2' : 'mt-1 gap-3')} aria-hidden>
          <span className="h-px w-8 sm:w-12" style={{ background: tone.ink, opacity: 0.55 }} />
          <span className="text-[9px]" style={{ color: tone.accent }}>◆</span>
          <span className="h-px w-8 sm:w-12" style={{ background: tone.ink, opacity: 0.55 }} />
        </div>
        {!props.guestName ? (
          <p className={cn('tracking-wide text-[var(--gate-ink)]', compact ? 'mt-1 text-[10px]' : 'mt-3 text-sm')}>
            {props.weddingDate || props.dateFallback}
          </p>
        ) : null}
        <p className={cn('shrink-0 text-[var(--gate-accent)]', compact ? 'mt-1 text-[10px]' : 'mt-1 text-xs')}>{props.invitationLabel}</p>
        {props.guestName ? (
          <WeddingGuestInviteBlock
            className={cn('shrink-0', compact ? 'mt-2' : 'mt-1')}
            guestName={props.guestName}
            inviteVenue={props.guestInviteVenue ?? ''}
            cordiallyInvitesLabel={props.cordiallyInvitesLabel}
            venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
            weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
            weddingTimeText={props.weddingTimeText}
            addressText={props.addressText}
            mapUrl={props.mapUrl}
            viewMapLabel={props.viewMapLabel ?? ''}
            panelClassName="bg-transparent"
            cordiallyClassName="text-[var(--gate-muted)]"
            nameClassName="text-[var(--gate-ink)]"
            venueClassName="text-[var(--gate-accent)]"
            addressClassName="text-[var(--gate-muted)]"
            weddingThemeId={theme.id}
            buttonColor={props.buttonColor}
            compact={compact}
            dense={props.fitViewport || !compact}
            personalInviteText={props.personalInviteText}
            personalInviteClassName="text-[var(--gate-muted)]"
          />
        ) : null}
        <CoverActions
          themeId={theme.id}
          buttonColor={props.buttonColor}
          rsvpButtonColor={props.rsvpButtonColor}
          compact={compact}
          className={compact ? 'mt-2' : 'mt-2 shrink-0'}
          openLabel={props.openButtonLabel}
          onOpen={props.onOpen}
          quickRsvp={props.quickRsvp}
        />
      </div>
    </div>
  )
}

function SongHyArchPhoto(props: WeddingCoverShellCardProps) {
  if (!props.coverPhotoUrl) return null
  const head = weddingCoverPhotoHead(props.presetId)
  const tone = weddingCoverGateTone(props.presetId)
  const photo = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
  const shot = (
    <CoverPhotoPan edit={props.coverPhotoEdit} className="relative h-full w-full">
      <CoverPhoto
        url={props.coverPhotoUrl}
        alt={props.photoAlt}
        objectPosition={photo.position}
        scale={photo.zoom}
        boxScale={head === 'fan' || head === 'leaf' || head === 'star' || head === 'moon' ? 1 : props.frameScale}
        box={head === 'leaf' || head === 'fan' || head === 'star' || head === 'moon' ? 'fill' : songHyPhotoBox(head, false, 'inside')}
        className={weddingCoverPhotoClip(head) ? 'rounded-none shadow-none ring-0' : 'rounded-t-[999px] rounded-b-md border-8 border-solid'}
        frameStyle={weddingCoverPhotoClip(head) ? undefined : { borderColor: tone.frame, boxShadow: tone.archShadow }}
      />
    </CoverPhotoPan>
  )
  if (head === 'fan' || head === 'leaf' || head === 'star' || head === 'moon') {
    return (
      <CoverPhotoSlot>
        <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidthFromMin(head === 'leaf' ? 86 : 100, frameScaleOf(props.frameScale, weddingCoverFrameScaleFloor(props.presetId)))}%` }}>
          <SongHyPhotoMount head={head} tone={tone} presetId={props.presetId} fillParent frameScale={WEDDING_FRAME_SCALE_MIN}>
            {shot}
          </SongHyPhotoMount>
        </FrameResizeChrome>
      </CoverPhotoSlot>
    )
  }
  return (
    <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto w-full">
      {weddingCoverPhotoClip(head) ? <SongHyPhotoMount head={head} tone={tone} presetId={props.presetId} frameScale={props.frameScale}>{shot}</SongHyPhotoMount> : shot}
    </FrameResizeChrome>
  )
}

const ENVELOPE_SEAL_SRC = '/wedding/covers/phong-bi-seal.webp'

type EnvelopeTone = {
  paper: string
  spray: string
  ink: string
  muted: string
  accent: string
  soft: string
  label: string
  glow: string
  plate: string
  panel: string
}

const ENVELOPE_TONES: Record<string, EnvelopeTone> = {
  phong_bi: {
    paper: '/wedding/covers/phong-bi-envelope.webp',
    spray: '/wedding/backgrounds/ornaments/phong-bi-cluster.webp',
    ink: '#4a1c28',
    muted: '#8d5a68',
    accent: '#6b2136',
    soft: '#6e4452',
    label: '#7a3a48',
    glow: '0 0 10px #f7f1ea, 0 0 4px #f7f1ea, 0 1px 0 #fffaf6, 0 0 1px #fffaf6',
    plate: 'rgba(247,241,234,0.8)',
    panel: 'bg-white/55',
  },
  phong_bi_hong: {
    paper: '/wedding/covers/phong-bi-hong.webp',
    spray: '/wedding/backgrounds/ornaments/phong-bi-hong.webp',
    ink: '#5c2a38',
    muted: '#8a5362',
    accent: '#a34762',
    soft: '#7a3148',
    label: '#8a5362',
    glow: '0 0 10px #fff6f4, 0 0 4px #fff6f4, 0 1px 0 #fffaf6',
    plate: 'rgba(255,246,244,0.82)',
    panel: 'bg-white/55',
  },
  phong_bi_reu: {
    paper: '/wedding/covers/phong-bi-reu.webp',
    spray: '/wedding/backgrounds/ornaments/phong-bi-reu.webp',
    ink: '#3e4f34',
    muted: '#5c6b40',
    accent: '#4d6244',
    soft: '#3e4f34',
    label: '#5c6b40',
    glow: '0 0 10px #f7faf4, 0 0 4px #f7faf4, 0 1px 0 #fffaf6',
    plate: 'rgba(247,250,244,0.84)',
    panel: 'bg-white/55',
  },
  phong_bi_dem: {
    paper: '/wedding/covers/phong-bi-dem.webp',
    spray: '/wedding/backgrounds/ornaments/phong-bi-dem.webp',
    ink: '#f3e6c8',
    muted: '#d9c7a2',
    accent: '#e6d3b3',
    soft: '#e6d3b3',
    label: '#d9c7a2',
    glow: '0 1px 2px rgba(6,10,24,0.85)',
    plate: 'rgba(12,24,48,0.55)',
    panel: 'bg-black/30',
  },
  phong_bi_nga: {
    paper: '/wedding/covers/phong-bi-nga.webp',
    spray: '/wedding/backgrounds/ornaments/phong-bi-nga.webp',
    ink: '#3b2a22',
    muted: '#6e584c',
    accent: '#8a5727',
    soft: '#6b4318',
    label: '#6e584c',
    glow: '0 0 10px #fffaf3, 0 0 4px #fffaf3, 0 1px 0 #fffaf6',
    plate: 'rgba(255,250,244,0.84)',
    panel: 'bg-white/55',
  },
}

function envelopeTone(presetId: string): EnvelopeTone {
  return ENVELOPE_TONES[presetId] ?? ENVELOPE_TONES.phong_bi!
}

/** Phong bì, ảnh lồng miệng thư, hoa chụp và dấu sáp. Màu giấy theo vỏ. */
function EnvelopeCoverCard(props: WeddingCoverShellCardProps) {
  const compact = props.compact
  const tone = envelopeTone(props.presetId)
  const photoBox = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
  // Ảnh mẫu phong bì ngà chừa tường phía trên đầu. Chỉ kéo ảnh demo, ảnh khách giữ 22%.
  const ngaDemoPhoto = props.presetId === 'phong_bi_nga' && (props.coverPhotoUrl || '').startsWith('/wedding/samples/')
  // Khung hạ thấp hơn miệng thư. Cắt bớt trần phía trên để trán tới cằm vẫn nằm trên nắp.
  const restAnchor = ngaDemoPhoto ? '50% 54%' : '50% 28%'
  const photo = props.coverPhotoUrl ? (
    <img
      src={props.coverPhotoUrl}
      alt={props.photoAlt}
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-cover"
      style={{ objectPosition: props.coverPhotoEdit ? photoBox.position : restAnchor, transform: `scale(${photoBox.zoom})`, transformOrigin: restAnchor }}
    />
  ) : (
    <div className="absolute inset-0" style={{ backgroundColor: tone.plate }} />
  )
  const stage = (
    <div className="relative mx-auto w-full">
      <div
        className="absolute z-[1] bg-white p-[4px] shadow-[0_14px_28px_rgba(70,20,32,0.28)]"
        style={{ left: '11%', top: '-40%', width: '78%', height: '74%' }}
      >
        <CoverPhotoPan edit={props.coverPhotoEdit} hideZoom className="relative h-full overflow-hidden">
          {photo}
        </CoverPhotoPan>
      </div>
      {props.coverPhotoEdit && props.coverPhotoUrl ? (
        <CoverPhotoZoomBar
          edit={props.coverPhotoEdit}
          className="absolute z-[6]"
          style={{ left: '50%', top: 'calc(-40% + 37%)', transform: 'translate(-50%, -50%)' }}
        />
      ) : null}
      <img src={tone.paper} alt="" draggable={false} width={1000} height={962} className="relative z-[2] block w-full select-none" style={{ aspectRatio: '1000 / 962' }} />
      <img
        src={tone.spray}
        alt=""
        draggable={false}
        className="pointer-events-none absolute z-[3] w-[56%] select-none"
        style={{ left: '-10%', top: '-6%' }}
      />
      <img
        src={ENVELOPE_SEAL_SRC}
        alt=""
        draggable={false}
        className="pointer-events-none absolute z-[4] w-[15%] select-none"
        style={{ left: '51%', top: '49%', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
  const names = (
    <div className="relative mt-1" style={{ color: tone.ink, textShadow: tone.glow }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-[6%] -inset-y-1 rounded-full" style={{ background: `radial-gradient(closest-side, ${tone.plate}, transparent 72%)` }} />
      <WeddingCoupleNames
        groomName={props.groomName}
        brideName={props.brideName}
        layout={props.nameLayout}
        flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
        className={cn('relative !flex-nowrap font-serif font-medium leading-none', compact ? 'text-sm' : 'text-[clamp(1.2rem,6.4cqi,1.85rem)]')}
      />
    </div>
  )
  return (
    <div className={cn('w-full text-center [container-type:inline-size]', !props.frameOnly && !compact && COVER_SHELL, props.frameOnly && 'py-2')} style={{ color: tone.ink }}>
      <p className={cn('shrink-0 uppercase tracking-[0.42em]', compact ? 'text-[8px]' : 'text-[11px]')} style={{ color: tone.label }}>{props.invitationLabel}</p>
      {names}
      {props.frameOnly || compact ? (
        <div className="mt-1" style={{ paddingTop: compact ? '22%' : '35%' }}>{stage}</div>
      ) : (
        <CoverPhotoSlot className="mt-1">
          <div className="relative" style={fitInPhotoSlot(1000, 1347)}>
            <div className="absolute inset-x-[2%] bottom-0 h-[71.4%]">{stage}</div>
          </div>
        </CoverPhotoSlot>
      )}
      {!props.frameOnly && !props.guestName ? (
        <p className={cn(compact ? 'mt-2 text-[10px]' : 'mt-3 text-sm')} style={{ color: tone.muted }}>{props.weddingDate || props.dateFallback}</p>
      ) : null}
      {!props.frameOnly && props.guestName ? (
        <WeddingGuestInviteBlock
          className={compact ? 'mt-2' : 'mt-3'}
          guestName={props.guestName}
          inviteVenue={props.guestInviteVenue ?? ''}
          cordiallyInvitesLabel={props.cordiallyInvitesLabel}
          venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
          weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
          weddingTimeText={props.weddingTimeText}
          addressText={props.addressText}
          mapUrl={props.mapUrl}
          viewMapLabel={props.viewMapLabel ?? ''}
          panelClassName={tone.panel}
          cordiallyClassName="text-inherit"
          nameClassName="text-inherit"
          venueClassName="text-inherit"
          addressClassName="text-inherit"
          weddingThemeId={props.theme.id}
          buttonColor={props.buttonColor}
          compact={compact}
          dense={props.fitViewport}
          personalInviteText={props.personalInviteText}
          personalInviteClassName="text-inherit"
        />
      ) : null}
      {!props.frameOnly ? (
        <CoverActions
          themeId={props.theme.id}
          buttonColor={props.buttonColor}
          rsvpButtonColor={props.rsvpButtonColor}
          compact={compact}
          className={compact ? 'mt-2' : 'mt-4'}
          openLabel={props.openButtonLabel}
          onOpen={props.onOpen}
          quickRsvp={props.quickRsvp}
        />
      ) : null}
    </div>
  )
}

function pairPhotoStyle(crop?: { x: number; y: number; scale: number }): CSSProperties | undefined {
  if (!crop) return undefined
  const scale = Math.max(1, Math.min(3, crop.scale))
  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${scale})`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  }
}

function PairShot(props: {
  url: string
  className: string
  crop?: { x: number; y: number; scale: number }
  edit?: WeddingStackedPhotoEdit
}) {
  const crop = props.edit?.crop ?? props.crop
  const photo = props.url ? (
    <img src={props.url} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" style={pairPhotoStyle(crop)} />
  ) : (
    <span className="absolute inset-0 block min-h-[4rem] bg-black/10" />
  )
  if (!props.edit) return <div className={cn('relative overflow-hidden', props.className)}>{photo}</div>
  return (
    <CoverPhotoPan edit={props.edit.crop} className={cn('pointer-events-auto relative overflow-hidden', props.className)}>
      {photo}
      <CoverFrameActions
        hasPhoto={Boolean(props.url)}
        onPhotoFile={props.edit.onFile}
        choosePhotoLabel={props.edit.chooseLabel}
        changePhotoLabel={props.edit.changeLabel}
        restyleSlot={props.edit.restyleSlot}
        photoUrl={props.url}
        className="bottom-1 left-1/2"
      />
    </CoverPhotoPan>
  )
}

function PairCoverCard(props: WeddingCoverShellCardProps & { preset: WeddingCoverPreset }) {
  const { compact, theme, preset } = props
  const thin = preset.pairFrame !== 'none'
  const left = props.pairLeftUrl || props.coverPhotoUrl || ''
  const right = props.nameLayout === 'primary' ? '' : props.pairRightUrl || props.coverPhotoUrl || ''
  const edge = thin ? 'border border-white/90 shadow-[0_0_0_1px_rgba(40,20,10,0.45)]' : ''
  const lift = 'shadow-[0_10px_18px_rgba(40,20,10,0.22)]'
  const arrange = preset.pairArrange
  const leftShot = (className: string) => (
    <PairShot url={left} crop={props.pairLeftCrop} edit={props.pairLeftEdit} className={className} />
  )
  const rightShot = (className: string) => (
    <PairShot url={right} crop={props.pairRightCrop} edit={props.pairRightEdit} className={className} />
  )
  const photos = props.nameLayout === 'primary' ? (
    <div className="mx-auto w-full">
      {leftShot(cn('aspect-[3/4] w-full', edge))}
    </div>
  ) : arrange === 'offset' ? (
    <div className="relative aspect-[5/4] w-full">
      {leftShot(cn('absolute left-0 top-0 h-[78%] w-[58%]', edge))}
      {rightShot(cn('absolute bottom-0 right-0 z-[1] h-[78%] w-[58%]', edge, lift))}
    </div>
  ) : arrange === 'tilt' ? (
    <div className="relative aspect-[5/4] w-full">
      {leftShot(cn('absolute left-[6%] top-[10%] h-[72%] w-[44%] -rotate-[9deg]', edge, lift))}
      {rightShot(cn('absolute bottom-[8%] right-[6%] h-[72%] w-[44%] rotate-[8deg]', edge, lift))}
    </div>
  ) : arrange === 'locket' ? (
    <div className="relative aspect-[6/5] w-full">
      {leftShot(cn('absolute left-[1%] top-[10%] h-[78%] w-[56%] rounded-full', edge))}
      {rightShot(cn('absolute right-[1%] top-[14%] z-[1] h-[78%] w-[56%] rounded-full', edge, lift))}
    </div>
  ) : arrange === 'print' ? (
    <div className="relative aspect-[5/4] w-full">
      <span className={cn('absolute left-[1%] top-[1%] w-[52%] -rotate-[8deg] bg-white p-[2.5%] pb-[13%]', lift)}>
        {leftShot('aspect-[3/4] w-full')}
      </span>
      <span className={cn('absolute bottom-[1%] right-[1%] z-[1] w-[52%] rotate-[7deg] bg-white p-[2.5%] pb-[13%]', lift)}>
        {rightShot('aspect-[3/4] w-full')}
      </span>
    </div>
  ) : (
    <div className={cn('grid grid-cols-2', thin ? 'gap-2' : 'gap-1')}>
      {leftShot(cn('aspect-[3/4] w-full', edge))}
      {rightShot(cn('aspect-[3/4] w-full', edge))}
    </div>
  )
  const frameScale = frameScaleOf(props.frameScale)
  const lacquer = theme.contentCard === 'scallop'
  const coverInk = lacquer ? 'text-[#fff6e4]' : theme.text
  const coverMuted = lacquer ? 'text-[#f6e4b8]' : theme.mutedText
  const coverAccent = lacquer ? 'text-[#f3d27a]' : theme.accent
  const coverGlow = lacquer ? '[text-shadow:0_1px_2px_rgba(32,4,8,0.9)]' : theme.textGlow
  const coverGlowHead = lacquer ? '[text-shadow:0_1px_3px_rgba(32,4,8,0.92)]' : theme.textGlowHeading
  const collage = (
    <FrameResizeChrome
      edit={props.frameScaleEdit}
      className={cn('mx-auto', props.frameScaleEdit && 'pointer-events-auto')}
      style={{ width: `${frameWidthPercent(86, frameScale)}%` }}
    >
      {photos}
    </FrameResizeChrome>
  )
  if (props.frameOnly) return <div className="mx-auto w-full max-w-[22rem]">{collage}</div>
  return (
    <div className={cn('mx-auto w-full text-center', !compact && COVER_SHELL, compact ? 'max-w-[210px]' : 'max-w-[22rem] sm:max-w-[26rem]')}>
      <p className={cn('shrink-0 uppercase tracking-[0.16em]', lacquer ? 'font-semibold' : '', compact ? 'mt-1 text-[10px]' : 'text-xs sm:text-sm', coverMuted, coverGlow)}>
        {props.invitationLabel}
      </p>
      <WeddingCoupleNames
        groomName={props.groomName}
        brideName={props.nameLayout === 'primary' ? '' : props.brideName}
        layout={props.nameLayout}
        flyIn={props.namesFlyIn && !compact}
        groomEdit={props.groomNameEdit}
        brideEdit={props.nameLayout === 'primary' ? undefined : props.brideNameEdit}
        className={cn('shrink-0 font-serif font-semibold', compact ? 'mt-1 text-sm leading-tight' : 'mt-0.5 text-[clamp(1.05rem,7cqi,1.85rem)] leading-none', coverInk, coverGlowHead)}
      />
      <div className={cn('shrink-0', coverAccent, coverGlow, compact ? 'my-0.5 text-base' : 'text-xl leading-none')}>{preset.ornament}</div>
      {compact ? collage : <CoverPhotoSlot className="my-1">{collage}</CoverPhotoSlot>}
      {!props.guestName ? (
        <p className={cn(compact ? 'text-[11px]' : 'text-sm', coverMuted, coverGlow)}>{props.weddingDate || props.dateFallback}</p>
      ) : (
        <WeddingGuestInviteBlock
          className="mt-0.5"
          guestName={props.guestName}
          inviteVenue={props.guestInviteVenue ?? ''}
          cordiallyInvitesLabel={props.cordiallyInvitesLabel}
          venueLabel={props.guestInviteVenueLabel ?? ''}
          editSide={props.editSide}
          weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
          weddingTimeText={props.weddingTimeText}
          addressText={props.addressText}
          mapUrl={props.mapUrl}
          viewMapLabel={props.viewMapLabel ?? ''}
          panelClassName="bg-black/25"
          cordiallyClassName={cn(lacquer && 'text-sm font-semibold', coverMuted, coverGlow)}
          nameClassName={cn(coverInk, coverGlowHead)}
          venueClassName={cn(coverAccent, coverGlow)}
          addressClassName={cn(coverMuted, coverGlow)}
          weddingThemeId={theme.id}
          buttonColor={props.buttonColor}
          compact={compact}
          dense={props.fitViewport}
          personalInviteText={props.personalInviteText}
          personalInviteClassName={cn(lacquer ? 'text-sm font-medium leading-6' : '', coverMuted, coverGlow)}
        />
      )}
      <CoverActions
        themeId={theme.id}
        buttonColor={props.buttonColor}
        rsvpButtonColor={props.rsvpButtonColor}
        compact={compact}
        className={compact ? 'mt-2' : 'mt-3'}
        openLabel={props.openButtonLabel}
        onOpen={props.onOpen}
        quickRsvp={props.quickRsvp}
      />
    </div>
  )
}

export function WeddingCoverShellCard(props: WeddingCoverShellCardProps) {
  const preset = getWeddingCoverPreset(props.presetId)
  if (preset.layout === 'pair' && props.frameMode !== 'library' && props.frameMode !== 'ai') {
    return <PairCoverCard {...props} preset={preset} />
  }
  const mode = props.frameMode
  const composition = preset.layout === 'composed' ? getOrnamentComposition(preset.compositionId) : undefined
  if (mode === 'none') {
    return <FrameCoverCard {...props} plainPhoto preset={{ ...preset, layout: 'frame', ornament: preset.ornament }} />
  }
  if ((mode === 'library' || mode === 'ai' || mode === undefined) && props.aiFrame?.src) {
    return (
      <FrameCoverCard
        {...props}
        nestPhoto
        preset={{ ...preset, layout: 'frame', frame: props.aiFrame, ornament: preset.ornament }}
      />
    )
  }
  if (preset.layout === 'envelope' && mode !== 'library' && mode !== 'ai') {
    const frameScale = frameScaleOf(props.frameScale)
    const frameWidth = frameWidthPercent(props.frameOnly ? 100 : 92, frameScale)
    return (
      <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
        <EnvelopeCoverCard {...props} />
      </FrameResizeChrome>
    )
  }
  if (preset.layout === 'plain' && mode !== 'library' && mode !== 'ai') {
    return <FrameCoverCard {...props} plainPhoto plainShape="portrait" preset={{ ...preset, layout: 'frame', ornament: preset.ornament }} />
  }
  if (composition && mode !== 'library' && mode !== 'ai') {
    return <ComposedCoverCard {...props} preset={preset} composition={composition} />
  }
  if (preset.layout === 'frame' && preset.frame) {
    return <FrameCoverCard {...props} nestPhoto preset={preset} />
  }
  if (preset.layout === 'song_hy' && props.frameOnly) return <SongHyArchPhoto {...props} />
  if (preset.layout === 'song_hy') return <SongHyCoverCard {...props} />
  if (preset.layout === 'red_arch' && !props.frameOnly) return <RedArchCoverCard {...props} />
  if (props.frameOnly) {
    if (!props.coverPhotoUrl) return null
    const photo = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
    return (
      <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto w-full">
        <CoverPhotoPan edit={props.coverPhotoEdit} className="relative w-full">
          <CoverPhoto
            url={props.coverPhotoUrl}
            alt={props.photoAlt}
            objectPosition={photo.position}
            scale={photo.zoom}
            boxScale={props.frameScale}
            className="rounded-2xl"
          />
        </CoverPhotoPan>
      </FrameResizeChrome>
    )
  }
  return <GlassCoverCard {...props} />
}
