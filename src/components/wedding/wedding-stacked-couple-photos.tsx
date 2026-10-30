'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react'
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildCoverFrameHoleMask, clearCoverFrameHole, measureCoverFrameContentBox } from '@/lib/wedding/cover-frame-hole-mask'
import type { CoverFrameHolePct } from '@/lib/wedding/measure-cover-frame-hole'
import { WEDDING_GUEST_NAME_CLASS, WeddingGuestNameFontLink } from '@/components/wedding/wedding-guest-name-font'
import { albumPhotoFrameStyle, STACK_BRIDE_FRAME_ROTATE, STACK_FRAME_ROTATE_MAX, STACK_FRAME_ROTATE_MIN, STACK_GROOM_FRAME_ROTATE, WEDDING_FRAME_SCALE_MAX, WEDDING_FRAME_SCALE_MIN, type WeddingAlbumPhotoFrame, type WeddingPortraitShellFrame, type WeddingStackPlace } from '@/lib/wedding/wedding-section-config'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'

const DEFAULT_FRAME: WeddingAlbumPhotoFrame = { x: 50, y: 18, scale: 1 }
const EMPTY_HOLE: CoverFrameHolePct = { x: 0, y: 0, w: 100, h: 100 }

type StackHoleMask = { url: string; cutUrl?: string; box: CoverFrameHolePct; content: CoverFrameHolePct | null; aspect: number }

const NAME_SLOT_PCT = 42

function tightFrameContent(content: CoverFrameHolePct | null | undefined) {
  if (!content || content.w < 8 || content.h < 8 || (content.w > 96 && content.h > 96)) return null
  return content
}

/** Tỷ lệ ô nhìn thấy. Cắt nền trong suốt rồi giữ tỷ lệ ảnh gốc, không kéo thành 3:4. */
function visualFrameAspect(mask: StackHoleMask | null | undefined) {
  const imageAspect = mask?.aspect && mask.aspect > 0 ? mask.aspect : 3 / 4
  const tight = tightFrameContent(mask?.content)
  if (!tight) return imageAspect
  return (tight.w / tight.h) * imageAspect
}

function paintedNameLeft(x: number, align: 'start' | 'end') {
  if (align === 'end') return Math.max(0, Math.min(100 - NAME_SLOT_PCT, x))
  return Math.max(0, Math.min(100 - 12, x))
}

const stackHoleMaskCache = new Map<string, StackHoleMask | null>()

function loadStackFrameImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('frame'))
    img.src = src
  })
}

function rasterizeStackHoleMask(img: HTMLImageElement, hole: CoverFrameHolePct): StackHoleMask | null {
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
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight)
  const content = measureCoverFrameContentBox(source, width, height)
  const mask = buildCoverFrameHoleMask(source, width, height, {
    x: ((hole.x + hole.w / 2) / 100) * width,
    y: ((hole.y + hole.h / 2) / 100) * height,
  })
  if (!mask) return { url: '', box: hole, content, aspect }
  const cut = ctx.createImageData(width, height)
  cut.data.set(clearCoverFrameHole(source, mask.rgba))
  ctx.putImageData(cut, 0, 0)
  const cutUrl = canvas.toDataURL('image/png')
  const out = ctx.createImageData(width, height)
  out.data.set(mask.rgba)
  ctx.putImageData(out, 0, 0)
  return { url: canvas.toDataURL('image/png'), cutUrl, box: mask.box, content, aspect }
}

function useStackHoleMask(src: string, hole: CoverFrameHolePct) {
  const [mask, setMask] = useState<StackHoleMask | null | undefined>(() => {
    if (!src) return null
    const cached = stackHoleMaskCache.get(src)
    return cached === undefined ? undefined : cached
  })
  useEffect(() => {
    if (!src) {
      setMask(null)
      return
    }
    const cached = stackHoleMaskCache.get(src)
    if (cached !== undefined) {
      setMask(cached)
      return
    }
    let cancelled = false
    const apply = (value: StackHoleMask | null) => {
      stackHoleMaskCache.set(src, value)
      if (!cancelled) setMask(value)
    }
    void (async () => {
      const remote = /^https?:\/\//i.test(src)
      let image: HTMLImageElement
      try {
        image = await loadStackFrameImage(src)
      } catch {
        if (!remote) {
          apply(null)
          return
        }
        try {
          image = await loadStackFrameImage(`/api/fetch-image?url=${encodeURIComponent(src)}`)
        } catch {
          apply(null)
          return
        }
      }
      apply(rasterizeStackHoleMask(image, hole))
    })()
    return () => {
      cancelled = true
    }
  }, [src, hole.x, hole.y, hole.w, hole.h])
  return mask
}

export type WeddingStackedNameEdit = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  caption?: string
}

export type WeddingStackedPhotoEdit = {
  chooseLabel: string
  changeLabel: string
  onFile: (file: File) => void
  crop: {
    x: number
    y: number
    scale: number
      onChange: (patch: { positionX?: number; positionY?: number; scale?: number }) => void
    zoomOutLabel: string
    zoomInLabel: string
  }
}

export type WeddingStackedFrameScaleEdit = {
  scale: number
  onChange: (scale: number) => void
  label: string
  zoomOutLabel: string
  zoomInLabel: string
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampPhotoScale(value: number) {
  return Math.max(1, Math.min(3, Math.round(value * 100) / 100))
}

function clampFrameScale(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(WEDDING_FRAME_SCALE_MIN, Math.min(WEDDING_FRAME_SCALE_MAX, Math.round(value * 100) / 100))
}

function clampFrameRotate(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(STACK_FRAME_ROTATE_MIN, Math.min(STACK_FRAME_ROTATE_MAX, Math.round(value)))
}

function clampPlace(value: number) {
  return Math.max(-20, Math.min(100, Math.round(value * 10) / 10))
}

type StackPlaceKey = 'groomFrame' | 'brideFrame' | 'groomName' | 'brideName'

function defaultStackPlace(frameWidth: number): WeddingStackPlace {
  const right = Math.max(0, 100 - frameWidth)
  return {
    stackGroomFrameX: 0,
    stackGroomFrameY: 2,
    stackBrideFrameX: right,
    stackBrideFrameY: 42,
    stackGroomNameX: Math.min(72, Math.max(28, frameWidth - 10)),
    stackGroomNameY: 14,
    stackBrideNameX: 0,
    stackBrideNameY: 56,
  }
}

const PLACE_FIELD: Record<StackPlaceKey, { x: keyof WeddingStackPlace; y: keyof WeddingStackPlace }> = {
  groomFrame: { x: 'stackGroomFrameX', y: 'stackGroomFrameY' },
  brideFrame: { x: 'stackBrideFrameX', y: 'stackBrideFrameY' },
  groomName: { x: 'stackGroomNameX', y: 'stackGroomNameY' },
  brideName: { x: 'stackBrideNameX', y: 'stackBrideNameY' },
}

function PhotoCard(props: {
  url: string
  alt: string
  frame: WeddingAlbumPhotoFrame
  shell?: WeddingPortraitShellFrame | null
  edit?: WeddingStackedPhotoEdit
  tilt: number
  controlsEdge: 'top' | 'bottom'
  className?: string
  widthPercent: number
  /** Phóng khung bằng scale, không nới ô bố cục nên tên bên cạnh không bị đè. */
  visualScale?: number
  /** Giữ cạnh sát tên đứng yên khi khung xoay. */
  transformOrigin?: string
  /** Editor hai ảnh: thanh nút nằm dưới sân khấu, không đè khung. */
  showToolbar?: boolean
  /** Nút quay và phóng, hiện dưới khung khi khung đang được chọn. */
  frameMove?: ReactNode
  /** start: mép trái khung. end: mép phải khung. */
  toolsSide?: 'start' | 'end'
  frameId?: string
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)
  const [toolScale, setToolScale] = useState(1)
  const [toolsAbove, setToolsAbove] = useState(false)
  useEffect(() => {
    const node = toolsRef.current
    if (!node || !props.frameMove) return
    const host = node.parentElement
    let zoom = 1
    let current: HTMLElement | null = host
    while (current) {
      const value = Number.parseFloat(String((getComputedStyle(current) as CSSStyleDeclaration & { zoom?: string }).zoom ?? ''))
      if (Number.isFinite(value) && value > 0) zoom *= value
      current = current.parentElement
    }
    const next = zoom > 0.05 && zoom < 0.98 ? 1 / zoom : 1
    setToolScale((currentScale) => (Math.abs(currentScale - next) < 0.02 ? currentScale : next))
    if (host) {
      const rect = host.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom
      const above = rect.top
      setToolsAbove(below < 240 && above > below)
    }
  }, [props.frameMove, props.tilt])
  const crop = props.edit?.crop
  const holeMask = useStackHoleMask(props.shell?.src ?? '', props.shell?.hole ?? EMPTY_HOLE)
  const photoHole = props.shell ? (holeMask?.box ?? props.shell.hole) : null
  const frameAspect = visualFrameAspect(holeMask)
  const tight = tightFrameContent(holeMask?.content)
  const artShift = tight
    ? {
        left: `${(-tight.x / tight.w) * 100}%`,
        top: `${(-tight.y / tight.h) * 100}%`,
        width: `${10000 / tight.w}%`,
        height: `${10000 / tight.h}%`,
      }
    : { inset: 0 }
  const photo = crop
    ? { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${clampPhotoScale(crop.scale)})`, transformOrigin: `${crop.x}% ${crop.y}%` }
    : albumPhotoFrameStyle(props.frame)

  const onPhotoPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!crop) return
    const target = event.target
    if (target instanceof Element && target.closest('button, label, input, a, [data-wedding-file-anchor]')) return
    event.stopPropagation()
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: crop.x, y: crop.y }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* kéo vẫn cập nhật khi trình duyệt không giữ pointer */
    }
  }

  const onPhotoPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const box = boxRef.current
    if (!crop || !drag || drag.pointerId !== event.pointerId || !box) return
    const rect = box.getBoundingClientRect()
    const sensitivity = 100 / Math.max(1, crop.scale)
    const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * sensitivity
    const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * sensitivity
    crop.onChange({ positionX: clampPercent(drag.x - dx), positionY: clampPercent(drag.y - dy) })
  }

  const onPhotoPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!crop) return
    event.preventDefault()
    crop.onChange({ scale: clampPhotoScale(crop.scale + (event.deltaY > 0 ? -0.08 : 0.08)) })
  }

  const toolbar = props.showToolbar === false || !props.edit ? null : (
    <div
      className="relative z-[6] flex flex-col items-center gap-1"
      style={{ transform: `rotate(${-props.tilt}deg)` }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {crop && props.url ? (
        <div className="flex items-center gap-0.5 rounded-full bg-black/60 px-0.5 py-0.5 text-white shadow">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center text-sm leading-none"
            aria-label={crop.zoomOutLabel}
            onClick={() => crop.onChange({ scale: clampPhotoScale(crop.scale - 0.1) })}
          >
            −
          </button>
          <span className="min-w-[2.2rem] text-center text-[10px] tabular-nums">{Math.round(crop.scale * 100)}%</span>
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center text-sm leading-none"
            aria-label={crop.zoomInLabel}
            onClick={() => crop.onChange({ scale: clampPhotoScale(crop.scale + 0.1) })}
          >
            +
          </button>
        </div>
      ) : null}
      <WeddingDeviceFileInput
        className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-stone-800 shadow"
        label={props.url ? props.edit.changeLabel : props.edit.chooseLabel}
        onFiles={(files) => {
          const file = files[0]
          if (file) props.edit?.onFile(file)
        }}
      />
    </div>
  )

  return (
    <div data-wedding-frame={props.frameId} className={cn(props.className)} style={{ width: `${props.widthPercent}%`, transform: `rotate(${props.tilt}deg) scale(${props.visualScale ?? 1})`, transformOrigin: props.transformOrigin }} onPointerDown={props.onPointerDown}>
      {props.controlsEdge === 'top' && toolbar ? <div className="relative z-[6] mb-1">{toolbar}</div> : null}
      <div className={cn('relative', props.shell ? 'bg-transparent' : 'overflow-hidden rounded-2xl shadow-[0_16px_36px_rgba(20,4,8,0.32)]')}>
        <div
          ref={boxRef}
          className={cn('relative w-full overflow-hidden', props.shell && 'bg-transparent', props.shell && holeMask === undefined && 'opacity-0', props.edit && 'cursor-grab')}
          style={{ aspectRatio: String(frameAspect) }}
        >
          <div className="absolute" style={artShift}>
            <div
              className="pointer-events-none absolute inset-0"
              style={
                holeMask?.url
                  ? {
                      WebkitMaskImage: `url("${holeMask.url}")`,
                      maskImage: `url("${holeMask.url}")`,
                      WebkitMaskSize: '100% 100%',
                      maskSize: '100% 100%',
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                    }
                  : undefined
              }
            >
              <div
                className="pointer-events-none absolute overflow-hidden"
                style={
                  photoHole
                    ? { left: `${photoHole.x}%`, top: `${photoHole.y}%`, width: `${photoHole.w}%`, height: `${photoHole.h}%` }
                    : { inset: 0 }
                }
              >
                {props.url ? (
                  <img src={props.url} alt={props.alt} draggable={false} className="h-full w-full select-none object-cover" style={photo} />
                ) : (
                  <div className="h-full w-full border border-dashed border-white/40" />
                )}
              </div>
            </div>
            {props.shell ? (
              <img src={holeMask?.cutUrl || props.shell.src} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none object-fill" />
            ) : null}
            <div
              data-stack-photo=""
              className={cn('absolute z-[3]', crop && props.url && 'cursor-grab touch-none active:cursor-grabbing')}
              style={
                photoHole
                  ? { left: `${photoHole.x}%`, top: `${photoHole.y}%`, width: `${photoHole.w}%`, height: `${photoHole.h}%`, touchAction: crop ? 'none' : undefined }
                  : { inset: 0, touchAction: crop ? 'none' : undefined }
              }
              onPointerDown={onPhotoPointerDown}
              onPointerMove={onPhotoPointerMove}
              onPointerUp={onPhotoPointerUp}
              onPointerCancel={onPhotoPointerUp}
              onWheel={onWheel}
            />
          </div>
        </div>
        {props.frameMove ? (
          <div
            ref={toolsRef}
            data-wedding-frame-tools=""
            className={cn(
              'pointer-events-none absolute left-1/2 z-[8] flex w-max justify-center',
              toolsAbove ? 'bottom-full pb-1' : 'top-full pt-1',
            )}
            style={{
              translate: '-50% 0',
              rotate: `${-props.tilt}deg`,
              scale: String(toolScale),
              transformOrigin: toolsAbove ? 'center bottom' : 'center top',
            }}
          >
            <div className="pointer-events-auto">{props.frameMove}</div>
          </div>
        ) : null}
      </div>
      {props.controlsEdge === 'bottom' && toolbar ? <div className="relative z-[6] mt-1">{toolbar}</div> : null}
    </div>
  )
}

function MoveCrossIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0">
      <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 1.2 4.4 2.8M6 1.2 7.6 2.8M6 10.8 4.4 9.2M6 10.8 7.6 9.2M1.2 6 2.8 4.4M1.2 6 2.8 7.6M10.8 6 9.2 4.4M10.8 6 9.2 7.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

const PERSON_DOCK_TONE = {
  ink: {
    wash: 'bg-slate-50',
    label: 'text-slate-700',
    solid: 'bg-slate-900',
    moveName: 'bg-slate-600',
    dial: 'bg-slate-800',
  },
  rose: {
    wash: 'bg-rose-50',
    label: 'text-rose-700',
    solid: 'bg-rose-800',
    moveName: 'bg-rose-500',
    dial: 'bg-rose-700',
  },
} as const

function StackMoveChip(props: { label: string; who: string; tone: keyof typeof PERSON_DOCK_TONE; kind: 'frame' | 'name' }) {
  const tone = PERSON_DOCK_TONE[props.tone]
  const label = props.label.trim()
  return (
    <button
      type="button"
      data-stack-move=""
      aria-label={props.who ? `${props.who} ${label}` : label}
      title={label}
      className={cn(
        'flex h-7 max-w-full cursor-grab items-center justify-center gap-1 rounded-full px-2 text-[11px] font-semibold leading-none text-white shadow-md touch-none active:cursor-grabbing',
        props.kind === 'frame' ? tone.solid : tone.moveName,
      )}
    >
      <MoveCrossIcon />
      {label ? <span className="truncate">{label}</span> : null}
    </button>
  )
}

function StackSideName(props: {
  name?: string
  edit?: WeddingStackedNameEdit
  caption?: string
  className?: string
  compact?: boolean
  /** Cô dâu nằm trái khung: chữ căn phải để sát mép khung. */
  align?: 'start' | 'end'
  style?: CSSProperties
}) {
  const text = (props.edit?.value ?? props.name ?? '').trim()
  const caption = (props.edit?.caption ?? props.caption ?? '').trim()
  const end = props.align === 'end'
  if (!props.edit && !text) return null
  return (
    <div className={cn('bg-transparent', end ? 'text-right' : 'text-left', props.edit && 'cursor-grab')}>
      {caption ? (
        <p className={cn(WEDDING_GUEST_NAME_CLASS, 'leading-none opacity-80', props.compact ? 'text-[11px]' : 'text-[13px] sm:text-sm')}>{caption}</p>
      ) : null}
      {props.edit ? (
        <input
          aria-label={props.edit.label}
          value={props.edit.value}
          placeholder={props.edit.placeholder}
          onChange={(event) => props.edit?.onChange(event.target.value)}
          style={props.style}
          className={cn(
            WEDDING_GUEST_NAME_CLASS,
            'bg-transparent leading-none outline-none placeholder:text-current/35',
            end ? 'text-right' : 'text-left',
            'w-full text-[clamp(13px,12cqi,1.35rem)]',
            props.className,
          )}
        />
      ) : (
        <p className={cn(WEDDING_GUEST_NAME_CLASS, 'w-full whitespace-nowrap leading-none text-[clamp(13px,12cqi,1.35rem)]', props.className)} style={props.style}>
          {text}
        </p>
      )}
    </div>
  )
}

/** Hai ảnh chồng nhẹ, hơi nghiêng. Một ảnh thì chỉ một khung. Có edit thì mỗi khung chọn, kéo và zoom được. */
export function WeddingStackedCouplePhotos(props: {
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
  /** Bấm tên, không kéo. */
  onNamePress?: (side: 'first' | 'second') => void
  /** Một cỡ cho cả hai khung. Không truyền thì cả hai là 100%. */
  frameScale?: number
  frameScaleEdit?: WeddingStackedFrameScaleEdit
  /** Một khung trang trí cho cả hai ảnh. */
  frameShell?: WeddingPortraitShellFrame | null
  firstShell?: WeddingPortraitShellFrame | null
  secondShell?: WeddingPortraitShellFrame | null
  chooseFrameLabel?: string
  onChooseFrame?: () => void
  onChooseFirstFrame?: () => void
  onChooseSecondFrame?: () => void
  /** Vị trí đã lưu. Thiếu thì dùng bố cục mặc định. */
  place?: WeddingStackPlace | null
  /** Có thì kéo khung và tên. Thiệp khách không truyền. */
  onPlace?: (place: WeddingStackPlace) => void
  /** Giữ bề rộng và chỗ đã kéo khi ẩn nút sửa. */
  pinLayout?: boolean
  /** Nhãn nút chỗ bấm để kéo. */
  moveLabel?: string
  nameClassName?: string
  compact?: boolean
  /** Editor: hiện khung trống trước khi có ảnh. */
  showEmpty?: boolean
  /** Nút kéo khung, cạnh nút kéo tên. */
  moveFrameLabel?: string
  /** Nút kéo tên, cạnh nút kéo khung. */
  moveNameLabel?: string
  /** Góc quay từng khung, độ. Trống thì chú rể −6, cô dâu 3. */
  firstRotate?: number
  secondRotate?: number
  /** Có thì hiện nút chỉnh góc. Thiệp khách không truyền. */
  onRotate?: (side: 'first' | 'second', degrees: number) => void
  rotateLabel?: string
  rotateLeftLabel?: string
  rotateRightLabel?: string
  /** false thì ẩn nút xoay, phóng và nhãn kéo. Vị trí khung vẫn giữ. */
  editTools?: boolean
  className?: string
}) {
  const firstUrl = props.firstUrl.trim()
  const secondUrl = props.secondUrl.trim()
  const editing = Boolean(props.firstEdit || props.secondEdit)
  const slots = [
    firstUrl || editing || props.showEmpty
      ? { side: 'first' as const, url: firstUrl, alt: props.firstAlt, frame: props.firstFrame ?? DEFAULT_FRAME, edit: props.firstEdit }
      : null,
    secondUrl || editing || props.showEmpty
      ? { side: 'second' as const, url: secondUrl, alt: props.secondAlt, frame: props.secondFrame ?? DEFAULT_FRAME, edit: props.secondEdit }
      : null,
  ].flatMap((slot) => (slot ? [slot] : []))
  const visible = slots.filter((slot) => slot.url || slot.edit || props.showEmpty)
  const showFirst = visible.some((slot) => slot.side === 'first')
  const showSecond = visible.some((slot) => slot.side === 'second')
  const both = visible.length === 2
  const named = Boolean(props.firstNameEdit || props.secondNameEdit || props.firstName?.trim() || props.secondName?.trim())
  const base = props.compact ? 72 : 74
  const firstSlot = visible.find((slot) => slot.side === 'first')
  const secondSlot = visible.find((slot) => slot.side === 'second')
  const sharedFrameScale = clampFrameScale(props.frameScaleEdit?.scale ?? props.frameScale ?? 1)
  const photoShare = Math.min(74, Math.round(48 * sharedFrameScale))
  const shellMask = useStackHoleMask(props.frameShell?.src ?? '', props.frameShell?.hole ?? EMPTY_HOLE)
  const frameAspect = visualFrameAspect(shellMask)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState(240)
  const [lifted, setLifted] = useState<StackPlaceKey | null>(null)
  const [pickedFrame, setPickedFrame] = useState<'first' | 'second' | null>(null)
  useEffect(() => {
    if (!pickedFrame) return
    const close = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        setPickedFrame(null)
        return
      }
      if (target.closest('[data-wedding-frame], [data-wedding-frame-tools]')) return
      setPickedFrame(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [pickedFrame])
  const place = props.place ?? defaultStackPlace(photoShare)
  const placeRef = useRef(place)
  placeRef.current = place
  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const apply = () => setStageWidth(node.clientWidth || 240)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    return () => observer.disconnect()
  }, [both, named])
  const framePx = stageWidth * (photoShare / 100) * (1 / frameAspect)
  const nameHeight = Math.max(24, Math.round(stageWidth * (props.compact ? 0.18 : 52 / 416)))
  const fitPad = Math.max(6, Math.round(stageWidth * (12 / 416)))
  const fitBlock = (yPct: number, block: number) => {
    const y = Math.min(88, Math.max(0, yPct)) / 100
    return (block + fitPad) / Math.max(0.12, 1 - y)
  }
  const stageHeight = Math.ceil(
    Math.max(
      framePx + nameHeight,
      fitBlock(place.stackGroomFrameY, framePx),
      fitBlock(place.stackBrideFrameY, framePx),
      fitBlock(place.stackGroomNameY, nameHeight),
      fitBlock(place.stackBrideNameY, nameHeight),
    ),
  )
  const blockTop = (yPct: number) => (stageHeight * Math.max(0, yPct)) / 100
  const contentTop = Math.min(
    blockTop(place.stackGroomFrameY),
    blockTop(place.stackBrideFrameY),
    blockTop(place.stackGroomNameY),
    blockTop(place.stackBrideNameY),
  )
  const contentBottom = Math.max(
    blockTop(place.stackGroomFrameY) + framePx,
    blockTop(place.stackBrideFrameY) + framePx,
    blockTop(place.stackGroomNameY) + nameHeight,
    blockTop(place.stackBrideNameY) + nameHeight,
  )
  const cropPad = Math.max(8, Math.round(stageWidth * (16 / 416)))
  const displayBleedTop = Math.max(0, Math.round(contentTop - cropPad))
  const displayBleedBottom = Math.max(0, Math.round(stageHeight - contentBottom - cropPad))
  const startPlaceDrag = (key: StackPlaceKey, event: ReactPointerEvent<HTMLElement>) => {
    if (!props.onPlace) return
    const target = event.target
    const moveHandle = target instanceof Element && Boolean(target.closest('[data-stack-move]'))
    if (moveHandle) {
      event.preventDefault()
      const handle = event.currentTarget
      if (handle instanceof Element) {
        try {
          handle.setPointerCapture(event.pointerId)
        } catch {
          /* kéo vẫn theo pointer trên document */
        }
      }
    }
    if (!moveHandle && target instanceof Element && target.closest('button, label, a, [data-wedding-file-anchor]')) return
    const fromInput = !moveHandle && target instanceof Element && Boolean(target.closest('input, textarea'))
    const nameKey = key === 'groomName' || key === 'brideName'
    const frameKey = key === 'groomFrame' || key === 'brideFrame'
    const stage = stageRef.current
    if (!stage) {
      if (frameKey) setPickedFrame(key === 'groomFrame' ? 'first' : 'second')
      return
    }
    const rect = stage.getBoundingClientRect()
    const field = PLACE_FIELD[key]
    const originX = placeRef.current[field.x]
    const originY = placeRef.current[field.y]
    const startX = event.clientX
    const startY = event.clientY
    let dragging = !fromInput && !nameKey && !frameKey
    if (dragging) setLifted(key)
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!dragging) {
        if (dx * dx + dy * dy < 36) return
        dragging = true
        setLifted(key)
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      }
      if (nameKey) ev.preventDefault()
      const rawX = clampPlace(originX + (dx / Math.max(1, rect.width)) * 100)
      const next: WeddingStackPlace = {
        ...placeRef.current,
        [field.x]: rawX,
        [field.y]: clampPlace(originY + (dy / Math.max(1, rect.height)) * 100),
      }
      placeRef.current = next
      props.onPlace?.(next)
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', end)
      document.removeEventListener('pointercancel', end)
      setLifted(null)
      if (!dragging && (key === 'groomName' || key === 'brideName')) props.onNamePress?.(key === 'groomName' ? 'first' : 'second')
      if (frameKey) setPickedFrame(key === 'groomFrame' ? 'first' : 'second')
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
  }
  const tiltOf = (side: 'first' | 'second') =>
    clampFrameRotate(side === 'first' ? (props.firstRotate ?? STACK_GROOM_FRAME_ROTATE) : (props.secondRotate ?? STACK_BRIDE_FRAME_ROTATE))
  const rotateEdit = (side: 'first' | 'second') =>
    props.onRotate
      ? {
          label: props.rotateLabel || '',
          degrees: tiltOf(side),
          leftLabel: props.rotateLeftLabel || '',
          rightLabel: props.rotateRightLabel || '',
          onChange: (degrees: number) => props.onRotate?.(side, degrees),
        }
      : undefined
  const personCaption = (side: 'first' | 'second') =>
    (side === 'first' ? props.firstNameEdit?.caption || props.firstCaption || '' : props.secondNameEdit?.caption || props.secondCaption || '').trim()
  const tools = props.editTools !== false
  const moveChip = (side: 'first' | 'second', kind: 'frame' | 'name') => {
    if (!tools || !props.onPlace) return null
    const label = kind === 'frame' ? props.moveFrameLabel || props.moveLabel || '' : props.moveNameLabel || props.moveLabel || ''
    return <StackMoveChip label={label} who={personCaption(side)} tone={side === 'first' ? 'ink' : 'rose'} kind={kind} />
  }
  const attachedTools = (side: 'first' | 'second', edit?: WeddingStackedPhotoEdit, hasPhoto?: boolean) => {
    if (!tools || pickedFrame !== side) return null
    const rotate = rotateEdit(side)
    const choose = side === 'first' ? (props.onChooseFirstFrame ?? props.onChooseFrame) : (props.onChooseSecondFrame ?? props.onChooseFrame)
    const tone = side === 'first' ? PERSON_DOCK_TONE.ink : PERSON_DOCK_TONE.rose
    const crop = edit?.crop
    if (!props.onPlace && !rotate && !choose && !props.frameScaleEdit && !edit) return null
    const hold = (event: React.PointerEvent<HTMLElement>) => event.stopPropagation()
    const iconButton = 'flex h-11 w-11 items-center justify-center rounded-lg border bg-white'
    return (
      <div
        className="flex w-max flex-col gap-1 rounded-xl border border-rose-200 bg-white/95 p-1 shadow-lg"
        onPointerDown={(event) => {
          const target = event.target
          if (!(target instanceof Element) || !target.closest('[data-stack-move]')) event.stopPropagation()
        }}
      >
        <div className="flex gap-1">
          {props.onPlace ? (
            <button
              type="button"
              data-stack-move=""
              aria-label={props.moveFrameLabel || personCaption(side)}
              className={cn('flex h-11 w-11 cursor-grab items-center justify-center rounded-lg text-white touch-none active:cursor-grabbing', tone.solid)}
            >
              <MoveCrossIcon />
            </button>
          ) : null}
          {props.frameScaleEdit ? (
            <button
              type="button"
              aria-label={props.frameScaleEdit.zoomInLabel}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-700 text-white"
              onPointerDown={hold}
              onClick={() => props.frameScaleEdit?.onChange(clampFrameScale(sharedFrameScale + 0.05))}
            >
              <ZoomIn className="h-6 w-6" />
            </button>
          ) : null}
          {props.frameScaleEdit ? (
            <button
              type="button"
              aria-label={props.frameScaleEdit.zoomOutLabel}
              className={iconButton}
              onPointerDown={hold}
              onClick={() => props.frameScaleEdit?.onChange(clampFrameScale(sharedFrameScale - 0.05))}
            >
              <ZoomOut className="h-6 w-6" />
            </button>
          ) : null}
          {rotate ? (
            <button
              type="button"
              aria-label={rotate.leftLabel}
              className={iconButton}
              onPointerDown={hold}
              onClick={() => rotate.onChange(clampFrameRotate(rotate.degrees - 1))}
            >
              <RotateCcw className="h-6 w-6" />
            </button>
          ) : null}
          {rotate ? (
            <button
              type="button"
              aria-label={rotate.rightLabel}
              className={iconButton}
              onPointerDown={hold}
              onClick={() => rotate.onChange(clampFrameRotate(rotate.degrees + 1))}
            >
              <RotateCw className="h-6 w-6" />
            </button>
          ) : null}
        </div>
        {rotate || props.frameScaleEdit ? (
          <div className="flex items-center justify-center gap-3 px-1 text-xs font-semibold tabular-nums text-stone-700">
            {rotate ? <span>{rotate.degrees}°</span> : null}
            {props.frameScaleEdit ? <span>{Math.round(sharedFrameScale * 100)}%</span> : null}
          </div>
        ) : null}
        {choose ? (
          <button
            type="button"
            className="h-9 rounded-lg bg-white px-2 text-xs font-medium text-stone-800 ring-1 ring-stone-200"
            onPointerDown={hold}
            onClick={choose}
          >
            {props.chooseFrameLabel}
          </button>
        ) : null}
        {crop && hasPhoto ? (
          <div className="flex h-7 items-center rounded-full bg-black/70 px-0.5 text-white shadow" onPointerDown={hold}>
            <button
              type="button"
              className="flex h-7 w-6 items-center justify-center text-sm leading-none"
              aria-label={crop.zoomOutLabel}
              onClick={() => crop.onChange({ scale: clampPhotoScale(crop.scale - 0.1) })}
            >
              −
            </button>
            <span className="min-w-[2.2rem] text-center text-[11px] font-semibold tabular-nums">{Math.round(crop.scale * 100)}%</span>
            <button
              type="button"
              className="flex h-7 w-6 items-center justify-center text-sm leading-none"
              aria-label={crop.zoomInLabel}
              onClick={() => crop.onChange({ scale: clampPhotoScale(crop.scale + 0.1) })}
            >
              +
            </button>
          </div>
        ) : null}
        {edit ? (
          <span onPointerDown={hold}>
            <WeddingDeviceFileInput
              className="flex h-7 items-center rounded-full bg-white px-2 text-[11px] font-medium text-stone-800 shadow"
              label={hasPhoto ? edit.changeLabel : edit.chooseLabel}
              onFiles={(files) => {
                const file = files[0]
                if (file) edit.onFile(file)
              }}
            />
          </span>
        ) : null}
      </div>
    )
  }
  const card = (slot: (typeof visible)[number], edge: 'top' | 'bottom') => {
    const tilt = tiltOf(slot.side)
    const toolsNode = attachedTools(slot.side, slot.edit, Boolean(slot.url))
    return (
      <PhotoCard
        url={slot.url}
        alt={slot.alt}
        frame={slot.frame}
        edit={slot.edit}
        tilt={tilt}
        controlsEdge={edge}
        widthPercent={100}
        visualScale={1}
        transformOrigin={slot.side === 'first' ? 'right center' : 'left center'}
        shell={slot.side === 'first' ? (props.firstShell ?? props.frameShell) : (props.secondShell ?? props.frameShell)}
        showToolbar={!toolsNode && tools && !props.onPlace && !props.onRotate && !props.frameScaleEdit}
        frameMove={toolsNode}
        frameId={slot.side}
        toolsSide={slot.side === 'second' ? 'end' : 'start'}
      />
    )
  }
  if (visible.length === 0) return null
  return (
    <div className={cn('relative mx-auto w-full', named ? (props.compact ? 'max-w-full' : 'max-w-[26rem]') : props.compact ? 'max-w-[13rem]' : 'max-w-[20rem]', props.className)}>
      {named ? <WeddingGuestNameFontLink /> : null}
      {both && named && firstSlot && secondSlot ? (
        <div>
          <div>
          <div ref={stageRef} className="relative w-full" style={{ height: stageHeight, marginTop: displayBleedTop ? -displayBleedTop : undefined, marginBottom: displayBleedBottom ? -displayBleedBottom : undefined }}>
            <div
              className={cn('absolute', props.onPlace && 'touch-none')}
              style={{ left: `${place.stackGroomFrameX}%`, top: `${place.stackGroomFrameY}%`, width: `${photoShare}%`, zIndex: lifted === 'groomFrame' || pickedFrame === 'first' ? 50 : 2, cursor: props.onPlace ? 'grab' : undefined }}
              onPointerDown={(event) => startPlaceDrag('groomFrame', event)}
            >
              {card(firstSlot, 'top')}
            </div>
            <div
              className={cn('absolute', props.onPlace && 'touch-none')}
              style={{ left: `${place.stackBrideFrameX}%`, top: `${place.stackBrideFrameY}%`, width: `${photoShare}%`, zIndex: lifted === 'brideFrame' || pickedFrame === 'second' ? 50 : 3, cursor: props.onPlace ? 'grab' : undefined }}
              onPointerDown={(event) => startPlaceDrag('brideFrame', event)}
            >
              {card(secondSlot, 'bottom')}
            </div>
            <div
              className={cn('absolute [container-type:inline-size]', props.onPlace && 'cursor-grab touch-none')}
              data-wedding-text="groomName"
              style={{ left: `${paintedNameLeft(place.stackGroomNameX, 'start')}%`, top: `${place.stackGroomNameY}%`, width: `${NAME_SLOT_PCT}%`, zIndex: lifted === 'groomName' ? 42 : 40 }}
              onPointerDown={(event) => startPlaceDrag('groomName', event)}
            >
              {props.onPlace ? <div className="absolute left-0 top-0 z-30 max-w-full">{moveChip('first', 'name')}</div> : null}
              {showFirst ? (
                <StackSideName
                  name={props.firstName}
                  edit={tools ? props.firstNameEdit : undefined}
                  caption={props.firstCaption}
                  compact={props.compact}
                  className={props.nameClassName}
                  style={props.firstNameStyle}
                />
              ) : null}
            </div>
            <div
              className={cn('absolute [container-type:inline-size]', props.onPlace && 'cursor-grab touch-none')}
              data-wedding-text="brideName"
              style={{ left: `${paintedNameLeft(place.stackBrideNameX, 'end')}%`, top: `${place.stackBrideNameY}%`, width: `${NAME_SLOT_PCT}%`, zIndex: lifted === 'brideName' ? 42 : 40 }}
              onPointerDown={(event) => startPlaceDrag('brideName', event)}
            >
              {props.onPlace ? <div className="absolute right-0 top-0 z-30 max-w-full">{moveChip('second', 'name')}</div> : null}
              {showSecond ? (
                <StackSideName
                  name={props.secondName}
                  edit={tools ? props.secondNameEdit : undefined}
                  caption={props.secondCaption}
                  compact={props.compact}
                  align="end"
                  className={props.nameClassName}
                  style={props.secondNameStyle}
                />
              ) : null}
            </div>
          </div>
          </div>
        </div>
      ) : (
      <div className="relative">
        {visible.map((slot) => {
          const tilt = tiltOf(slot.side)
          const toolsNode = attachedTools(slot.side, slot.edit, Boolean(slot.url))
          return (
            <PhotoCard
              key={slot.side}
              url={slot.url}
              alt={slot.alt}
              frame={slot.frame}
              edit={slot.edit}
              tilt={tilt}
              controlsEdge={both && slot.side === 'first' ? 'top' : 'bottom'}
              widthPercent={Math.round(base * sharedFrameScale)}
              shell={slot.side === 'first' ? (props.firstShell ?? props.frameShell) : (props.secondShell ?? props.frameShell)}
              showToolbar={!toolsNode && tools && !props.onPlace && !props.onRotate && !props.frameScaleEdit}
              frameMove={toolsNode}
              frameId={slot.side}
              toolsSide={slot.side === 'second' ? 'end' : 'start'}
              onPointerDown={(event) => startPlaceDrag(slot.side === 'first' ? 'groomFrame' : 'brideFrame', event)}
              className={cn(
                both && slot.side === 'first' && 'origin-bottom-left',
                both && slot.side === 'second' && cn('relative z-[1] ml-auto origin-top-right', props.compact ? '-mt-6' : '-mt-10 sm:-mt-12'),
                !both && 'mx-auto',
              )}
            />
          )
        })}
      </div>
      )}
    </div>
  )
}
