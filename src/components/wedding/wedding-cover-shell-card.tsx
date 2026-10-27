'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'
import { cn } from '@/lib/utils'
import { buildCoverFrameHoleMask, measureCoverFrameContentBox, type CoverFrameHoleMask } from '@/lib/wedding/cover-frame-hole-mask'
import type { CoverFrameHolePct } from '@/lib/wedding/measure-cover-frame-hole'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'
import { getWeddingCoverPreset, type WeddingCoverPreset } from '@/lib/wedding/wedding-cover-presets'
import { getOrnamentComposition, type OrnamentComposition } from '@/lib/wedding/wedding-ornament-layouts'
import { WeddingOrnamentStage } from '@/components/wedding/wedding-ornament-stage'
import type { WeddingCoverFrameAsset } from '@/lib/wedding/wedding-cover-frame-assets'
import type { WeddingAlbumPhotoFrame, WeddingCoverFrameOpen, WeddingCoverPhotoOpen, WeddingPortraitShellFrame, WeddingStackPlace } from '@/lib/wedding/wedding-section-config'
import { WeddingStackedCouplePhotos, type WeddingStackedFrameScaleEdit, type WeddingStackedNameEdit, type WeddingStackedPhotoEdit } from '@/components/wedding/wedding-stacked-couple-photos'
import { WeddingReadableGlass } from '@/components/wedding/wedding-readable-glass'
import { WeddingCoupleNames } from '@/components/wedding/wedding-couple-names'
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
  weddingDate?: string | null
  weddingTimeText?: string
  guestName?: string
  guestInviteVenue?: WeddingGuestInviteVenue
  guestInviteVenueLabel?: string
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
  nestPhoto?: boolean
  /** Chỉ khung ảnh, không tên và không chữ Thân mời. Dùng trong nội dung thiệp. */
  frameOnly?: boolean
  /** Cỡ khung ảnh so với mặc định, 0.6–1.4. */
  frameScale?: number
  /** Editor: kéo cỡ khung. Không đổi vị trí hay zoom ảnh bên trong. */
  frameScaleEdit?: FrameScaleEdit
  /** Tên chú rể từ trái, tên cô dâu từ phải, ghép vào giữa. */
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

function frameScaleOf(value: number | undefined) {
  const num = value ?? 1
  if (!Number.isFinite(num)) return 1
  return Math.max(0.6, Math.min(1.4, num))
}

function frameWidthPercent(base: number, scale: number) {
  return Math.round(base * scale * 10) / 10
}

function useFrameScaleDrag(edit: FrameScaleEdit, sign: number) {
  const dragRef = useRef<{ pointerId: number; x: number; scale: number } | null>(null)
  const scale = frameScaleOf(edit.scale)
  const emit = (value: number) => edit.onChange(frameScaleOf(Math.round(value * 100) / 100))
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
      emit(drag.scale + (sign * (event.clientX - drag.x)) / 140)
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
  const percent = Math.round(drag.scale * 100)
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
        className="flex h-6 w-6 shrink-0 items-center justify-center text-sm leading-none"
        aria-label={props.edit.zoomOutLabel}
        onClick={() => drag.step(-0.05)}
      >
        −
      </button>
      <div
        role="slider"
        aria-label={props.edit.label}
        aria-valuemin={60}
        aria-valuemax={140}
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
            drag.step(-0.05)
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault()
            drag.step(0.05)
          }
        }}
      >
        {props.edit.label} {percent}%
      </div>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-sm leading-none"
        aria-label={props.edit.zoomInLabel}
        onClick={() => drag.step(0.05)}
      >
        +
      </button>
    </div>
  )
}

function FrameResizeChrome(props: { edit?: FrameScaleEdit; className?: string; style?: CSSProperties; children: ReactNode }) {
  const box = props.edit ? (
    <div className={cn(props.className, props.style?.width != null && 'shrink-0')} style={props.style}>
      <div className="relative">
        {props.children}
        <FrameEdgeGrips edit={props.edit} />
      </div>
      <FrameScaleDragBar edit={props.edit} />
    </div>
  ) : (
    <div className={cn(props.className, props.style?.width != null && 'shrink-0')} style={props.style}>
      {props.children}
    </div>
  )
  if (props.style?.width == null) return box
  return <div className="flex w-full justify-center">{box}</div>
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
      if (!current || (event.target as HTMLElement).closest('button, label, input, a, [data-wedding-file-anchor]')) return
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
        <CoverPhotoZoomBar edit={props.edit} className="absolute left-1/2 top-1 -translate-x-1/2" />
      ) : null}
    </div>
  )
}

const COVER_INTRO_NODES =
  '.wedding-couple-from-left, .wedding-couple-from-right, .wedding-couple-amp, .wedding-couple-ornament, .wedding-invite-body-join, .wedding-cover-photo-open, .wedding-cover-photo-fade, .wedding-cover-photo-zoom, .wedding-cover-photo-assemble, .wedding-cover-frame-fade, .wedding-cover-frame-settle, .wedding-cover-frame-bloom, .wedding-cover-frame-assemble'

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
    root.querySelectorAll<HTMLElement>(COVER_INTRO_NODES).forEach((node) => {
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
  const size = props.compact ? 'h-8 px-3 text-[10px]' : 'h-11 px-4 text-sm'
  const yesOn = rsvp?.choice === 'yes'
  const noOn = rsvp?.choice === 'no'
  return (
    <div className={cn('flex flex-col items-center gap-2', props.className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
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
}) {
  if (!props.url.trim()) return null
  const objectPosition = props.objectPosition ?? '50% 50%'
  const scale = Math.max(1, Math.min(3, props.scale ?? 1))
  const boxScale = frameScaleOf(props.boxScale)
  const photoHeight = props.compact ? '6rem' : 'clamp(11rem, 32dvh, 15rem)'
  return (
    <div className="flex w-full justify-center">
    <div
      className={cn(
        'w-full shrink-0 overflow-hidden shadow-md ring-1 ring-black/5',
        props.compact ? 'h-24 rounded-lg' : 'h-[clamp(11rem,32dvh,15rem)] rounded-2xl lg:h-[clamp(13rem,38dvh,17rem)]',
        props.openSlowly && 'wedding-cover-photo-open',
        props.className,
      )}
      style={{
        width: `${frameWidthPercent(100, boxScale)}%`,
        ...(boxScale === 1 ? {} : { height: `calc((${photoHeight}) * ${boxScale})` }),
      }}
    >
      <div className={cn('h-full w-full', props.breathe && !props.compact && 'wedding-cover-breathe')}>
        <img
          src={props.url}
          alt={props.alt}
          draggable={false}
          className="h-full w-full select-none object-cover"
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

function GlassCoverCard(props: WeddingCoverShellCardProps) {
  const { compact, theme } = props
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  return (
    <WeddingReadableGlass
      className={cn(
        'w-full text-center',
        compact ? 'max-w-[200px] rounded-[1.2rem] p-3' : props.fitViewport ? 'rounded-[1.35rem] p-3 sm:p-4' : 'rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6 lg:p-5',
        props.namesFlyIn && !compact && 'overflow-visible',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div ref={intro.rootRef}>
      <p className={cn('uppercase tracking-[0.28em] sm:tracking-[0.35em]', compact ? 'text-[8px]' : 'text-[11px] sm:text-xs', theme.accentText, theme.textGlow)}>
        {props.invitationLabel}
      </p>
      <WeddingCoupleNames
        groomName={props.groomName}
        brideName={props.brideName}
        flyIn={props.namesFlyIn && !compact}
        className={cn('font-serif font-semibold italic', compact ? 'mt-2 text-base leading-tight' : 'mt-2 text-[clamp(1.05rem,8cqi,2.65rem)] leading-none sm:mt-3', theme.text, theme.textGlowHeading)}
      />
      <div className={cn(theme.accent, compact ? 'my-2 text-lg' : 'my-2 text-2xl sm:my-3 sm:text-3xl lg:my-2', props.namesFlyIn && !compact && 'wedding-couple-ornament', theme.textGlow)}>{theme.ornament}</div>
      {props.coverPhotoUrl ? (
        <FrameResizeChrome edit={props.frameScaleEdit} className={cn(compact ? 'my-2' : 'my-2 sm:my-3 lg:my-2')}>
          <CoverPhotoPan edit={props.coverPhotoEdit} className="relative">
            <CoverPhoto
              url={props.coverPhotoUrl}
              alt={props.photoAlt}
              compact={compact}
              className={props.fitViewport ? 'h-[clamp(7.5rem,24svh,12rem)]' : undefined}
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
                className="bottom-1.5 left-1/2"
              />
            ) : null}
          </CoverPhotoPan>
        </FrameResizeChrome>
      ) : props.onPhotoFile ? (
        <CoverDevicePhotoControl
          label={props.choosePhotoLabel || ''}
          onFile={props.onPhotoFile}
          className={cn(
            'mx-auto flex w-full rounded-xl border border-dashed border-white/50 bg-white/20 font-medium',
            compact ? 'my-2 h-24 text-[11px]' : 'my-2 h-[clamp(11rem,32dvh,15rem)] text-sm sm:my-3',
            theme.text,
          )}
        />
      ) : props.onChoosePhoto ? (
        <button
          type="button"
          onClick={props.onChoosePhoto}
          className={cn(
            'mx-auto flex w-full items-center justify-center rounded-xl border border-dashed border-white/50 bg-white/20 font-medium',
            compact ? 'my-2 h-24 text-[11px]' : 'my-2 h-[clamp(11rem,32dvh,15rem)] text-sm sm:my-3',
            theme.text,
          )}
        >
          {props.choosePhotoLabel}
        </button>
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
      className={cn(
        'w-full text-center shadow-2xl ring-1 ring-black/10 [container-type:inline-size]',
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
          brideName={props.brideName}
          flyIn={props.namesFlyIn && !compact}
          className={cn('font-serif font-semibold text-white', compact ? 'mt-1 text-sm' : 'mt-2 text-[clamp(1.05rem,8cqi,2.35rem)] leading-none sm:mt-3')}
        />
        <div className={cn('text-amber-300', compact ? 'my-1 text-base' : 'my-2 text-xl sm:my-3 sm:text-2xl', props.namesFlyIn && !compact && 'wedding-couple-ornament')}>{preset.ornament}</div>
      </div>
      <div className="relative bg-[#fff8f0]/72 px-3 pb-3 pt-4 backdrop-blur-sm sm:px-5 sm:pb-5 sm:pt-5">
        <div
          className="pointer-events-none absolute -top-4 left-1/2 h-8 w-[108%] -translate-x-1/2 rounded-[100%] bg-[#fff8f0]/72 backdrop-blur-sm"
          aria-hidden
        />
        {props.coverPhotoUrl ? (
          <FrameResizeChrome edit={props.frameScaleEdit}>
            <CoverPhotoPan edit={props.coverPhotoEdit} className="relative">
              <CoverPhoto
                url={props.coverPhotoUrl}
                alt={props.photoAlt}
                compact={compact}
                className={compact ? 'h-28' : props.fitViewport ? 'h-[clamp(7.5rem,24svh,12rem)]' : 'h-[clamp(12rem,34dvh,16rem)] lg:h-[clamp(14rem,40dvh,18rem)]'}
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
                  className="bottom-1.5 left-1/2"
                />
              ) : null}
            </CoverPhotoPan>
          </FrameResizeChrome>
        ) : props.onPhotoFile ? (
          <CoverDevicePhotoControl
            label={props.choosePhotoLabel || ''}
            onFile={props.onPhotoFile}
            className={cn(
              'mx-auto flex w-full rounded-2xl border border-dashed border-rose-300 bg-white/80 font-medium text-rose-700',
              compact ? 'h-20 text-[11px]' : 'h-48 text-sm',
            )}
          />
        ) : props.onChoosePhoto ? (
          <button
            type="button"
            onClick={props.onChoosePhoto}
            className={cn(
              'mx-auto flex w-full items-center justify-center rounded-2xl border border-dashed border-rose-300 bg-white/80 font-medium text-rose-700',
              compact ? 'h-20 text-[11px]' : 'h-48 text-sm',
            )}
          >
            {props.choosePhotoLabel}
          </button>
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

type CoverHoleMask = { url: string; box: CoverFrameHolePct; content: CoverFrameHolePct | null; aspect: number }

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
  const mask: CoverFrameHoleMask | null = buildCoverFrameHoleMask(pixels.data, width, height, {
    x: ((hole.x + hole.w / 2) / 100) * width,
    y: ((hole.y + hole.h / 2) / 100) * height,
  })
  if (!mask) return null
  const out = ctx.createImageData(width, height)
  out.data.set(mask.rgba)
  ctx.putImageData(out, 0, 0)
  return {
    url: canvas.toDataURL('image/png'),
    box: mask.box,
    content: measureCoverFrameContentBox(pixels.data, width, height),
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
      className={cn('relative mx-auto overflow-hidden', props.className)}
      style={{
        aspectRatio: String(aspect),
        width,
        maxWidth: `${widthPercent}%`,
        height: 'auto',
      }}
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
  onFile: (file: File) => void
}) {
  return (
    <WeddingDeviceFileInput
      className={props.className}
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
  className?: string
  style?: CSSProperties
}) {
  if (!props.onChoosePhoto && !props.onPhotoFile && !props.onChooseFrame) return null
  const photoLabel = (props.hasPhoto ? props.changePhotoLabel : props.choosePhotoLabel) || ''
  return (
    <div
      className={cn('pointer-events-auto absolute z-[8] flex -translate-x-1/2 items-center justify-center gap-1', props.className)}
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
      {props.onChooseFrame ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            props.onChooseFrame?.()
          }}
          className="pointer-events-auto rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow"
        >
          {props.chooseFrameLabel}
        </button>
      ) : null}
    </div>
  )
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
  return (
    <CoverFrameViewport
      className={cn(holeMask === undefined && 'opacity-0', props.className)}
      content={holeMask?.content}
      imageAspect={holeMask?.aspect}
      widthPercent={frameWidthPercent(100, frameScaleOf(props.frameScale))}
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
              className="h-full w-full select-none object-cover"
              style={{ objectPosition, transform: `scale(${scale})`, transformOrigin: objectPosition }}
            />
          ) : null}
        </div>
      </div>
      <img src={props.frameSrc} alt="" crossOrigin="anonymous" draggable={false} className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none" />
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
  const panel = frame?.panel ?? '#fffaf2'
  const light = frame?.ink === 'light'
  const textCls = light ? 'text-white' : 'text-stone-900'
  const mutedCls = light ? 'text-white/80' : 'text-stone-600'
  const accentCls = light ? 'text-amber-200' : 'text-rose-800'
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
            <div className={cn('h-full w-full', photoMotion, props.breathe && !compact && 'wedding-cover-breathe')}>
              <img
                src={props.coverPhotoUrl}
                alt={props.photoAlt}
                draggable={false}
                className="h-full w-full select-none object-cover"
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
          src={frame.src}
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
            top: `calc(${hole.y}% + 4px)`,
            transform: 'translateX(-50%)',
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
        style={{ width: `${plain ? frameWidthPercent(78, frameScale) : frameWidth}%` }}
      >
        {plain ? (
          <div key={props.motionKey} className={cn('relative', photoMotion || 'wedding-cover-frame-settle')}>
            <CoverPhotoPan
              edit={props.coverPhotoUrl ? props.coverPhotoEdit : undefined}
              className="relative aspect-square w-full overflow-hidden rounded-full"
              style={{ backgroundColor: panel }}
            >
              {props.coverPhotoUrl ? (
                <img
                  src={props.coverPhotoUrl}
                  alt={props.photoAlt}
                  draggable={false}
                  className="h-full w-full select-none object-cover"
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
      className={cn(
        'mx-auto w-full',
        compact ? 'max-w-[210px]' : 'max-w-[22rem] sm:max-w-[26rem]',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      {plain || nestFrame ? null : (
        <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidthPercent(100, frameScale)}%` }}>
          <div key={props.motionKey} ref={intro.rootRef} className={cn('relative aspect-[3/4] w-full', frameMotion)}>
            {frameArt}
          </div>
        </FrameResizeChrome>
      )}
      <div
        className={cn(
          'relative text-center [container-type:inline-size]',
          compact ? 'px-2 pb-2 pt-1.5' : props.fitViewport ? 'px-2 pb-1 pt-0.5 sm:px-3' : 'px-3 pb-3 pt-2 sm:px-4',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 38% 78% at 50% 42%, color-mix(in srgb, ${panel} 88%, transparent) 0%, color-mix(in srgb, ${panel} 42%, transparent) 62%, transparent 100%)`,
          }}
        />
        <div className="relative">
        <p className={cn('uppercase tracking-[0.22em]', compact ? 'text-[8px]' : 'text-[11px]', mutedCls)}>
          {props.invitationLabel}
        </p>
        <WeddingCoupleNames
          groomName={props.groomName}
          brideName={props.brideName}
          flyIn={props.namesFlyIn && !compact}
          className={cn(
            'font-serif font-semibold',
            compact ? 'mt-1 text-sm leading-tight' : props.fitViewport ? 'mt-0.5 text-[clamp(1rem,7cqi,1.85rem)] leading-none' : 'mt-1 text-[clamp(1.05rem,8cqi,2.2rem)] leading-none',
            textCls,
          )}
        />
        <div className={cn(accentCls, compact ? 'my-0.5 text-base' : props.fitViewport ? 'my-0 text-xl leading-none' : 'mt-0.5 mb-0 text-2xl', props.namesFlyIn && !compact && 'wedding-couple-ornament')}>
          {props.preset.ornament}
        </div>
        {plain ? (
          <FrameResizeChrome
            edit={props.frameScaleEdit}
            className="mx-auto my-1"
            style={{
              width: props.fitViewport
                ? `min(${frameWidthPercent(68, frameScale)}%, ${frameWidthPercent(16, frameScale)}rem)`
                : `${frameWidthPercent(78, frameScale)}%`,
            }}
          >
            <div key={props.motionKey} className={cn('relative', photoMotion || 'wedding-cover-frame-settle')}>
              <CoverPhotoPan
                edit={props.coverPhotoUrl ? props.coverPhotoEdit : undefined}
                className="relative aspect-square w-full overflow-hidden rounded-full"
              >
                {props.coverPhotoUrl ? (
                  <img
                    src={props.coverPhotoUrl}
                    alt={props.photoAlt}
                    draggable={false}
                    className="h-full w-full select-none object-cover"
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
                className={props.coverPhotoUrl ? 'bottom-2 left-1/2' : 'left-1/2 top-1/2 -translate-y-1/2'}
              />
            </div>
          </FrameResizeChrome>
        ) : null}
        {nestFrame ? (
          <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
            <CoverFrameViewport
              key={props.motionKey}
              className={cn(holeMask === undefined ? 'opacity-0' : frameMotion)}
              content={holeMask?.content}
              imageAspect={holeMask?.aspect}
              widthPercent={100}
              maxHeight={props.fitViewport ? `min(${frameWidthPercent(32, frameScale)}svh, ${frameWidthPercent(16, frameScale)}rem)` : undefined}
            >
              {frameArt}
            </CoverFrameViewport>
          </FrameResizeChrome>
        ) : null}
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
            weddingDateLabel={props.weddingDate || props.dateFallback || undefined}
            weddingTimeText={props.weddingTimeText}
            addressText={props.addressText}
            mapUrl={props.mapUrl}
            viewMapLabel={props.viewMapLabel ?? ''}
            panelClassName={light ? 'bg-white/10' : 'bg-white/70'}
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
          className={compact ? 'mt-2' : props.fitViewport ? 'mt-1.5' : 'mt-3'}
          openLabel={props.openButtonLabel}
          onOpen={props.onOpen}
          quickRsvp={props.quickRsvp}
        />
        </div>
      </div>
    </div>
  )
}

function StackCoverCard(props: WeddingCoverShellCardProps) {
  const pair = props.stackPair
  const { compact, theme } = props
  const intro = useCoverIntroOnce(Boolean(props.namesFlyIn && !compact))
  if (!pair) return null
  const editing = Boolean(pair.onPlace || pair.pinLayout)
  return (
    <WeddingReadableGlass
      className={cn(
        'w-full text-center',
        editing ? 'max-w-none rounded-none px-0 py-2' : compact ? 'max-w-[248px] rounded-[1.2rem] px-1.5 py-3' : props.fitViewport ? 'rounded-[1.35rem] p-3 sm:p-4' : 'rounded-[1.5rem] px-3 py-4 sm:rounded-[2rem] sm:px-4 sm:py-6 lg:px-4 lg:py-5',
        props.namesFlyIn && !compact && 'overflow-visible',
        intro.hold && 'wedding-cover-hold',
      )}
    >
      <div ref={intro.rootRef}>
        <p className={cn('uppercase tracking-[0.28em] sm:tracking-[0.35em]', editing && 'px-3', compact ? 'text-[8px]' : 'text-[11px] sm:text-xs', theme.accentText, theme.textGlow)}>
          {props.invitationLabel}
        </p>
        <WeddingStackedCouplePhotos
          firstUrl={pair.firstUrl}
          secondUrl={pair.secondUrl}
          firstAlt={pair.firstAlt}
          secondAlt={pair.secondAlt}
          firstFrame={pair.firstFrame}
          secondFrame={pair.secondFrame}
          firstEdit={pair.firstEdit}
          secondEdit={pair.secondEdit}
          firstName={pair.firstName ?? props.groomName}
          secondName={pair.secondName ?? props.brideName}
          firstCaption={pair.firstCaption}
          secondCaption={pair.secondCaption}
          firstNameEdit={pair.firstNameEdit}
          secondNameEdit={pair.secondNameEdit}
          firstNameStyle={pair.firstNameStyle}
          secondNameStyle={pair.secondNameStyle}
          onNamePress={pair.onNamePress}
          frameScale={pair.frameScale}
          frameScaleEdit={pair.frameScaleEdit}
          frameShell={pair.frameShell}
          firstShell={pair.firstShell}
          secondShell={pair.secondShell}
          chooseFrameLabel={pair.chooseFrameLabel}
          onChooseFrame={pair.onChooseFrame}
          onChooseFirstFrame={pair.onChooseFirstFrame}
          onChooseSecondFrame={pair.onChooseSecondFrame}
          place={pair.place}
          onPlace={pair.onPlace}
          pinLayout={pair.pinLayout}
          moveLabel={pair.moveLabel}
          moveFrameLabel={pair.moveFrameLabel}
          moveNameLabel={pair.moveNameLabel}
          firstRotate={pair.firstRotate}
          secondRotate={pair.secondRotate}
          onRotate={pair.onRotate}
          rotateLabel={pair.rotateLabel}
          rotateLeftLabel={pair.rotateLeftLabel}
          rotateRightLabel={pair.rotateRightLabel}
          editTools={pair.editTools}
          nameClassName={cn(theme.text, theme.textGlowHeading)}
          showEmpty={pair.showEmpty}
          compact={compact}
          className={compact ? 'mt-2' : 'mt-3'}
        />
        <div className={editing ? 'px-3' : undefined}>
        <div className={cn(theme.accent, compact ? 'my-2 text-lg' : 'my-2 text-2xl sm:my-3 sm:text-3xl lg:my-2', props.namesFlyIn && !compact && 'wedding-couple-ornament', theme.textGlow)}>{theme.ornament}</div>
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
      </div>
    </WeddingReadableGlass>
  )
}

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
      className="h-full w-full select-none object-cover"
      style={{ objectPosition: photoBox.position, transform: `scale(${photoBox.zoom})`, transformOrigin: photoBox.position }}
    />
  ) : null

  if (props.frameOnly) {
    const slot = layout.photo
    return (
      <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
        <div key={props.motionKey} className={cn('relative aspect-[3/4] w-full overflow-hidden rounded-[1.25rem] ring-1 ring-stone-900/10', frameMotion)} style={{ background: kit.panel }}>
          {photo ? (
            <div className="absolute z-[1] overflow-hidden" style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%`, borderRadius: slot.radius }}>
              <div className={cn('h-full w-full', photoMotion)}>{photo}</div>
            </div>
          ) : null}
          <WeddingOrnamentStage kit={kit} layout={layout} />
        </div>
      </FrameResizeChrome>
    )
  }

  return (
    <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto" style={{ width: `${frameWidth}%` }}>
      <div key={props.motionKey} ref={intro.rootRef} className={cn('w-full [container-type:inline-size]', intro.hold && 'wedding-cover-hold')}>
      <div
        className={cn(
          'relative flex min-h-[133cqw] w-full flex-col justify-center overflow-hidden rounded-[1.35rem] text-center shadow-[0_18px_44px_rgba(40,32,24,0.16)] ring-1 ring-stone-900/10',
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
          <p className={cn('uppercase tracking-[0.22em]', compact ? 'text-[8px]' : 'text-[11px]')} style={{ color: kit.metal }}>
            {props.invitationLabel}
          </p>
          {photo ? (
            <CoverPhotoPan
              edit={props.coverPhotoEdit}
              hideZoom
              className={cn('relative mx-auto mt-2 overflow-hidden shadow-md', compact ? 'w-[68%]' : 'w-[58%]')}
              style={{ borderRadius: Math.min(layout.photo.radius, 22), aspectRatio: '3 / 4' }}
            >
              <div className={cn('h-full w-full', photoMotion, props.breathe && !compact && 'wedding-cover-breathe')}>{photo}</div>
            </CoverPhotoPan>
          ) : null}
          <WeddingCoupleNames
            groomName={props.groomName}
            brideName={props.brideName}
            flyIn={props.namesFlyIn && !compact}
            className={cn(
              'font-serif font-semibold text-stone-900',
              compact ? 'mt-1 text-sm leading-tight' : props.fitViewport ? 'mt-1 text-[clamp(1.05rem,7cqi,1.85rem)] leading-none' : 'mt-1.5 text-[clamp(1.15rem,8cqi,2.15rem)] leading-none',
            )}
          />
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

export function WeddingCoverShellCard(props: WeddingCoverShellCardProps) {
  if (props.stackPair) return <StackCoverCard {...props} />
  const preset = getWeddingCoverPreset(props.presetId)
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
  if (composition && mode !== 'library' && mode !== 'ai') {
    return <ComposedCoverCard {...props} preset={preset} composition={composition} />
  }
  if (preset.layout === 'frame' && preset.frame) {
    return <FrameCoverCard {...props} nestPhoto preset={preset} />
  }
  if (preset.layout === 'red_arch' && !props.frameOnly) return <RedArchCoverCard {...props} />
  if (props.frameOnly) {
    if (!props.coverPhotoUrl) return null
    const photo = coverPhotoBox(props.coverPhotoEdit, props.coverPhotoObjectPosition, props.coverPhotoScale)
    return (
      <FrameResizeChrome edit={props.frameScaleEdit} className="mx-auto w-full">
        <CoverPhoto
          url={props.coverPhotoUrl}
          alt={props.photoAlt}
          objectPosition={photo.position}
          scale={photo.zoom}
          boxScale={props.frameScale}
          className="rounded-2xl"
        />
      </FrameResizeChrome>
    )
  }
  return <GlassCoverCard {...props} />
}
