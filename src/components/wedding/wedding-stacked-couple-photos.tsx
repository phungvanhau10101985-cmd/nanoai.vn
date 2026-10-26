'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { cn } from '@/lib/utils'
import { buildCoverFrameHoleMask } from '@/lib/wedding/cover-frame-hole-mask'
import type { CoverFrameHolePct } from '@/lib/wedding/measure-cover-frame-hole'
import { WEDDING_GUEST_NAME_CLASS, WeddingGuestNameFontLink } from '@/components/wedding/wedding-guest-name-font'
import { albumPhotoFrameStyle, WEDDING_FRAME_SCALE_MAX, WEDDING_FRAME_SCALE_MIN, type WeddingAlbumPhotoFrame, type WeddingPortraitShellFrame, type WeddingStackPlace } from '@/lib/wedding/wedding-section-config'
import { WeddingDeviceFileInput } from '@/components/wedding/wedding-device-file-input'

const DEFAULT_FRAME: WeddingAlbumPhotoFrame = { x: 50, y: 18, scale: 1 }
const EMPTY_HOLE: CoverFrameHolePct = { x: 0, y: 0, w: 100, h: 100 }

type StackHoleMask = { url: string; box: CoverFrameHolePct }

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
  const mask = buildCoverFrameHoleMask(pixels.data, width, height, {
    x: ((hole.x + hole.w / 2) / 100) * width,
    y: ((hole.y + hole.h / 2) / 100) * height,
  })
  if (!mask) return null
  const out = ctx.createImageData(width, height)
  out.data.set(mask.rgba)
  ctx.putImageData(out, 0, 0)
  return { url: canvas.toDataURL('image/png'), box: mask.box }
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
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)
  const crop = props.edit?.crop
  const holeMask = useStackHoleMask(props.shell?.src ?? '', props.shell?.hole ?? EMPTY_HOLE)
  const photoHole = props.shell ? (holeMask?.box ?? props.shell.hole) : null
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

  const toolbar = props.edit ? (
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
  ) : null

  return (
    <div className={cn(props.className)} style={{ width: `${props.widthPercent}%`, transform: `rotate(${props.tilt}deg) scale(${props.visualScale ?? 1})`, transformOrigin: props.transformOrigin }}>
      {props.controlsEdge === 'top' && toolbar ? <div className={props.shell ? 'relative z-[6] -mb-10' : 'mb-1'}>{toolbar}</div> : null}
      <div className={cn('relative', props.shell ? 'bg-transparent' : 'border-[3px] border-[#9caf8a] bg-white p-1 shadow-[0_10px_24px_rgba(70,90,50,0.16)]')}>
        <div
          ref={boxRef}
          className={cn('relative aspect-[3/4] overflow-hidden', props.shell ? 'bg-transparent' : 'bg-[#f7f6f2]', props.edit && 'cursor-grab')}
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
                <div className="h-full w-full border border-dashed border-[#c5d4b4]" />
              )}
            </div>
          </div>
          {props.shell ? (
            <img src={props.shell.src} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-[1] h-full w-full select-none" />
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
      {props.controlsEdge === 'bottom' && toolbar ? <div className={props.shell ? 'relative z-[6] -mt-12' : 'mt-1'}>{toolbar}</div> : null}
    </div>
  )
}

function DragGrip(props: { label: string; className?: string }) {
  return (
    <button
      type="button"
      data-stack-move=""
      aria-label={props.label}
      className={cn(
        'absolute z-20 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-white bg-stone-900/85 text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] active:cursor-grabbing',
        props.className,
      )}
    >
      <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3">
        <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M6 1.2 4.4 2.8M6 1.2 7.6 2.8M6 10.8 4.4 9.2M6 10.8 7.6 9.2M1.2 6 2.8 4.4M1.2 6 2.8 7.6M10.8 6 9.2 4.4M10.8 6 9.2 7.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
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
}) {
  const text = (props.edit?.value ?? props.name ?? '').trim()
  const caption = (props.edit?.caption ?? props.caption ?? '').trim()
  const end = props.align === 'end'
  if (!props.edit && !text) return null
  return (
    <div className={cn('bg-transparent', end ? 'text-right' : 'text-left')} onPointerDown={(event) => event.stopPropagation()}>
      {caption ? (
        <p className={cn(WEDDING_GUEST_NAME_CLASS, 'leading-none opacity-80', props.compact ? 'text-[11px]' : 'text-[13px] sm:text-sm')}>{caption}</p>
      ) : null}
      {props.edit ? (
        <input
          aria-label={props.edit.label}
          value={props.edit.value}
          placeholder={props.edit.placeholder}
          onChange={(event) => props.edit?.onChange(event.target.value)}
          className={cn(
            WEDDING_GUEST_NAME_CLASS,
            'bg-transparent leading-none outline-none placeholder:text-current/35',
            end ? 'text-right' : 'text-left',
            props.compact ? 'w-[6.2rem] text-[17px]' : 'w-[8rem] text-xl sm:text-2xl',
            props.className,
          )}
        />
      ) : (
        <p className={cn(WEDDING_GUEST_NAME_CLASS, 'whitespace-nowrap leading-none', props.compact ? 'text-[17px]' : 'text-xl sm:text-2xl', props.className)}>
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
  /** Một cỡ cho cả hai khung. Không truyền thì cả hai là 100%. */
  frameScale?: number
  frameScaleEdit?: WeddingStackedFrameScaleEdit
  /** Một khung trang trí cho cả hai ảnh. */
  frameShell?: WeddingPortraitShellFrame | null
  chooseFrameLabel?: string
  onChooseFrame?: () => void
  /** Vị trí đã lưu. Thiếu thì dùng bố cục mặc định. */
  place?: WeddingStackPlace | null
  /** Có thì kéo khung và tên. Thiệp khách không truyền. */
  onPlace?: (place: WeddingStackPlace) => void
  /** Nhãn nút chỗ bấm để kéo. */
  moveLabel?: string
  nameClassName?: string
  compact?: boolean
  /** Editor: hiện khung trống trước khi có ảnh. */
  showEmpty?: boolean
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
  ].filter((slot): slot is { side: 'first' | 'second'; url: string; alt: string; frame: WeddingAlbumPhotoFrame; edit?: WeddingStackedPhotoEdit } => Boolean(slot))
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
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageWidth, setStageWidth] = useState(240)
  const [lifted, setLifted] = useState<StackPlaceKey | null>(null)
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
  const framePx = stageWidth * (photoShare / 100) * (4 / 3)
  const stageHeight = Math.round(framePx * 1.7 + (props.compact ? 52 : 64))
  const displayBleedTop = props.onPlace ? 0 : Math.round(stageHeight * (place.stackGroomFrameY / 100) + framePx * 0.18)
  const lowerFrameY = Math.max(place.stackGroomFrameY, place.stackBrideFrameY)
  const lowerFrameTop = (stageHeight * lowerFrameY) / 100
  const lowerFrameBottom = lowerFrameTop + framePx * (props.onPlace ? 1 : 0.8) + (props.onPlace && place.stackBrideFrameY >= place.stackGroomFrameY ? 44 : 0)
  const nameHeight = props.compact ? 36 : 48
  const namesBottom = Math.max((stageHeight * place.stackGroomNameY) / 100 + nameHeight, (stageHeight * place.stackBrideNameY) / 100 + nameHeight)
  const contentBottom = Math.max(lowerFrameBottom, namesBottom)
  const displayBleedBottom = Math.max(0, Math.round(stageHeight - contentBottom - (props.onPlace ? 6 : 18)))
  const startPlaceDrag = (key: StackPlaceKey, event: ReactPointerEvent<HTMLElement>) => {
    if (!props.onPlace) return
    const target = event.target
    const moveHandle = target instanceof Element && Boolean(target.closest('[data-stack-move]'))
    if (moveHandle) event.preventDefault()
    if (!moveHandle && target instanceof Element && target.closest('button, label, a, [data-wedding-file-anchor], [data-stack-photo]')) return
    const fromInput = !moveHandle && target instanceof Element && Boolean(target.closest('input, textarea'))
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const field = PLACE_FIELD[key]
    const originX = placeRef.current[field.x]
    const originY = placeRef.current[field.y]
    const startX = event.clientX
    const startY = event.clientY
    let dragging = !fromInput
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
      const next: WeddingStackPlace = {
        ...placeRef.current,
        [field.x]: clampPlace(originX + (dx / Math.max(1, rect.width)) * 100),
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
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', end)
    document.addEventListener('pointercancel', end)
  }
  const card = (slot: (typeof visible)[number], edge: 'top' | 'bottom') => {
    const tilt = both && slot.side === 'first' ? -6 : both && slot.side === 'second' ? 3 : -2
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
        shell={props.frameShell}
      />
    )
  }
  const frameSizeBar = props.frameScaleEdit ? (
    <div
      className="relative z-[5] mx-auto mt-2 flex w-full max-w-[9rem] items-center justify-center gap-0.5 rounded-full border border-rose-200 bg-white/95 px-0.5 py-0.5 text-stone-800 shadow"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-sm leading-none"
        aria-label={props.frameScaleEdit.zoomOutLabel}
        onClick={() => props.frameScaleEdit?.onChange(clampFrameScale(sharedFrameScale - 0.05))}
      >
        −
      </button>
      <span className="min-w-0 flex-1 text-center text-[9px] font-medium tabular-nums">
        {props.frameScaleEdit.label} {Math.round(sharedFrameScale * 100)}%
      </span>
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center text-sm leading-none"
        aria-label={props.frameScaleEdit.zoomInLabel}
        onClick={() => props.frameScaleEdit?.onChange(clampFrameScale(sharedFrameScale + 0.05))}
      >
        +
      </button>
    </div>
  ) : null
  if (visible.length === 0) return null
  return (
    <div className={cn('relative mx-auto w-full', named ? (props.compact ? 'max-w-full' : 'max-w-[26rem]') : props.compact ? 'max-w-[13rem]' : 'max-w-[20rem]', props.className)}>
      {named ? <WeddingGuestNameFontLink /> : null}
      {both && named && firstSlot && secondSlot ? (
        <div className="relative z-[1]">
          <div ref={stageRef} className="relative w-full" style={{ height: stageHeight, marginTop: displayBleedTop ? -displayBleedTop : undefined, marginBottom: displayBleedBottom ? -displayBleedBottom : undefined }}>
            <div
              className={cn('absolute', props.onPlace && 'touch-none')}
              style={{ left: `${place.stackGroomFrameX}%`, top: `${place.stackGroomFrameY}%`, width: `${photoShare}%`, zIndex: lifted === 'groomFrame' ? 8 : 2, cursor: props.onPlace ? 'grab' : undefined }}
              onPointerDown={(event) => startPlaceDrag('groomFrame', event)}
            >
              {props.onPlace ? <DragGrip label={props.moveLabel ?? ''} className="left-1 top-1" /> : null}
              {card(firstSlot, 'top')}
            </div>
            <div
              className={cn('absolute', props.onPlace && 'touch-none')}
              style={{ left: `${place.stackBrideFrameX}%`, top: `${place.stackBrideFrameY}%`, width: `${photoShare}%`, zIndex: lifted === 'brideFrame' ? 8 : 3, cursor: props.onPlace ? 'grab' : undefined }}
              onPointerDown={(event) => startPlaceDrag('brideFrame', event)}
            >
              {props.onPlace ? <DragGrip label={props.moveLabel ?? ''} className="right-1 top-1" /> : null}
              {card(secondSlot, 'bottom')}
            </div>
            <div
              className={cn('absolute', props.onPlace && 'cursor-grab touch-none')}
              style={{ left: `${place.stackGroomNameX}%`, top: `${place.stackGroomNameY}%`, zIndex: lifted === 'groomName' ? 9 : 5 }}
              onPointerDown={(event) => startPlaceDrag('groomName', event)}
            >
              {props.onPlace ? <DragGrip label={props.moveLabel ?? ''} className="left-0 -top-3" /> : null}
              {showFirst ? (
                <StackSideName
                  name={props.firstName}
                  edit={props.firstNameEdit}
                  caption={props.firstCaption}
                  compact={props.compact}
                  className={props.nameClassName}
                />
              ) : null}
            </div>
            <div
              className={cn('absolute', props.onPlace && 'cursor-grab touch-none')}
              style={{ left: `${place.stackBrideNameX}%`, top: `${place.stackBrideNameY}%`, zIndex: lifted === 'brideName' ? 9 : 5 }}
              onPointerDown={(event) => startPlaceDrag('brideName', event)}
            >
              {props.onPlace ? <DragGrip label={props.moveLabel ?? ''} className="right-0 -top-3" /> : null}
              {showSecond ? (
                <StackSideName
                  name={props.secondName}
                  edit={props.secondNameEdit}
                  caption={props.secondCaption}
                  compact={props.compact}
                  align="end"
                  className={props.nameClassName}
                />
              ) : null}
            </div>
          </div>
          {frameSizeBar}
          {props.onChooseFrame ? (
            <div className="mt-1 flex justify-center">
              <button
                type="button"
                className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow"
                onClick={props.onChooseFrame}
              >
                {props.chooseFrameLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
      <div className="relative z-[1]">
        {visible.map((slot) => {
          const tilt = both && slot.side === 'first' ? -6 : both && slot.side === 'second' ? 3 : -2
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
              shell={props.frameShell}
              className={cn(
                both && slot.side === 'first' && 'origin-bottom-left',
                both && slot.side === 'second' && cn('relative z-[1] ml-auto origin-top-right', props.compact ? '-mt-6' : '-mt-10 sm:-mt-12'),
                !both && 'mx-auto',
              )}
            />
          )
        })}
        {frameSizeBar}
        {props.onChooseFrame ? (
          <div className="mt-1 flex justify-center">
            <button
              type="button"
              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-stone-800 shadow"
              onClick={props.onChooseFrame}
            >
              {props.chooseFrameLabel}
            </button>
          </div>
        ) : null}
      </div>
      )}
    </div>
  )
}
