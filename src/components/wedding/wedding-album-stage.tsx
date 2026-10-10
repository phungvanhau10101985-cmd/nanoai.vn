'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import {
  DEFAULT_WEDDING_ALBUM_LAYOUT_ID,
  resolveWeddingAlbumLayoutId,
  WEDDING_ALBUM_LAYOUTS,
  type WeddingAlbumLayoutId,
} from '@/lib/wedding/wedding-album-layouts'
import {
  albumPhotoFrameStyle,
  resolveAlbumPhotoFrame,
  type WeddingAlbumPhotoCrop,
  type WeddingAlbumPhotoFrame,
} from '@/lib/wedding/wedding-section-config'

const MOTION_MS = 880
const MOTION_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function wrap(index: number, count: number) {
  if (count <= 0) return 0
  return ((index % count) + count) % count
}

/** Khoảng cách ngắn nhất từ ảnh `i` tới tiêu điểm (có thể lẻ khi đang vuốt). */
function wrappedDelta(i: number, focus: number, count: number) {
  if (count <= 1) return 0
  let d = i - focus
  d -= Math.round(d / count) * count
  return d
}

function motionTransition(smooth: boolean) {
  return smooth ? `transform ${MOTION_MS}ms ${MOTION_EASE}, opacity ${MOTION_MS}ms ${MOTION_EASE}` : 'none'
}

function AlbumPhoto(props: { url: string; alt: string; className?: string; frame: WeddingAlbumPhotoFrame }) {
  const fill = props.className?.includes('absolute')
  return (
    // eslint-disable-next-line @next/next/no-img-element -- album URLs are external CDN
    <img
      src={props.url}
      alt={props.alt}
      draggable={false}
      className={cn('pointer-events-none h-full w-full object-cover', fill && 'max-w-none', props.className)}
      style={{
        ...albumPhotoFrameStyle(props.frame),
        ...(fill ? { width: '100%', height: '100%', maxWidth: 'none' } : null),
      }}
    />
  )
}

type AlbumCropPatch = { positionX?: number; positionY?: number; scale?: number }

export type WeddingAlbumStageEdit = {
  onChange: (index: number, patch: AlbumCropPatch) => void
  onRemove: (index: number) => void
  removeLabel: string
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampScale(value: number) {
  return Math.max(1, Math.min(3, Math.round(value * 100) / 100))
}

const ALBUM_EDIT_COPY = {
  vi: { zoomOut: 'Thu nhỏ', zoomIn: 'Phóng to', zoom: 'Zoom ảnh album', remove: 'Xóa ảnh', drag: 'Kéo ảnh để căn góc. Lăn chuột hoặc thanh zoom để phóng. Nút mũi tên vẫn chuyển ảnh.' },
  en: { zoomOut: 'Zoom out', zoomIn: 'Zoom in', zoom: 'Album photo zoom', remove: 'Remove photo', drag: 'Drag to reframe. Scroll or use the zoom bar to enlarge. Arrow buttons still change photos.' },
  zh: { zoomOut: '缩小', zoomIn: '放大', zoom: '相册照片缩放', remove: '删除照片', drag: '拖动调整取景。滚轮或缩放条可放大。箭头按钮仍可切换照片。' },
  ja: { zoomOut: '縮小', zoomIn: '拡大', zoom: 'アルバム写真のズーム', remove: '写真を削除', drag: 'ドラッグで位置を調整。ホイールかズームバーで拡大。矢印ボタンで写真は切り替わります。' },
  ko: { zoomOut: '축소', zoomIn: '확대', zoom: '앨범 사진 확대', remove: '사진 삭제', drag: '끌어 구도를 맞추세요. 휠이나 확대 막대로 키웁니다. 화살표 버튼은 그대로 사진을 바꿉니다.' },
} as const

/** Lớp chỉnh trên khung đang xem: kéo căn góc, zoom, xóa. Không gắn vào thiệp khách mời. */
function AlbumStageEditor(props: {
  index: number
  frame: WeddingAlbumPhotoFrame
  locale?: WebLocale
  edit: WeddingAlbumStageEdit
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    positionX: number
    positionY: number
  } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const live = useRef({
    x: props.frame.x,
    y: props.frame.y,
    scale: props.frame.scale,
    index: props.index,
    onChange: props.edit.onChange,
  })
  live.current = {
    x: props.frame.x,
    y: props.frame.y,
    scale: props.frame.scale,
    index: props.index,
    onChange: props.edit.onChange,
  }
  const copy = ALBUM_EDIT_COPY[props.locale || 'vi']

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      live.current.onChange(live.current.index, {
        scale: clampScale(live.current.scale + (event.deltaY > 0 ? -0.08 : 0.08)),
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const pointerDistance = () => {
    const pts = [...pointers.current.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  const endPointer = (target: HTMLDivElement, pointerId: number) => {
    pointers.current.delete(pointerId)
    if (dragRef.current?.pointerId === pointerId) dragRef.current = null
    if (pointers.current.size < 2) pinchRef.current = null
    if (pointers.current.size === 1) {
      const [id, point] = [...pointers.current.entries()][0]
      dragRef.current = {
        pointerId: id,
        startX: point.x,
        startY: point.y,
        positionX: live.current.x,
        positionY: live.current.y,
      }
    }
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      /* pointer already released */
    }
  }

  const setScale = (value: number) => {
    props.edit.onChange(props.index, { scale: clampScale(value) })
  }

  return (
    <div
      ref={frameRef}
      data-album-edit=""
      className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      role="application"
      aria-label={copy.drag}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          /* synthetic or already released */
        }
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.current.size >= 2) {
          dragRef.current = null
          pinchRef.current = { dist: Math.max(1, pointerDistance()), scale: live.current.scale }
          return
        }
        pinchRef.current = null
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          positionX: live.current.x,
          positionY: live.current.y,
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return
        event.stopPropagation()
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pinchRef.current && pointers.current.size >= 2) {
          const dist = Math.max(1, pointerDistance())
          live.current.onChange(live.current.index, {
            scale: clampScale(pinchRef.current.scale * (dist / pinchRef.current.dist)),
          })
          return
        }
        const drag = dragRef.current
        const frame = frameRef.current
        if (!drag || drag.pointerId !== event.pointerId || !frame) return
        const rect = frame.getBoundingClientRect()
        const sensitivity = 100 / Math.max(1, live.current.scale)
        const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * sensitivity
        const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * sensitivity
        live.current.onChange(live.current.index, {
          positionX: clampPercent(drag.positionX - dx),
          positionY: clampPercent(drag.positionY - dy),
        })
      }}
      onPointerUp={(event) => endPointer(event.currentTarget, event.pointerId)}
      onPointerCancel={(event) => endPointer(event.currentTarget, event.pointerId)}
      onDoubleClick={() => props.edit.onChange(props.index, { positionX: 50, positionY: 0, scale: 1 })}
    >
      <span className="pointer-events-none absolute bottom-10 left-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {Math.round(props.frame.scale * 100)}%
      </span>
      <button
        type="button"
        data-album-chrome=""
        className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow"
        aria-label={props.edit.removeLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          props.edit.onRemove(props.index)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div
        data-album-chrome=""
        className="absolute bottom-2 left-10 right-10 z-20 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-1"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm leading-none text-white"
          aria-label={copy.zoomOut}
          onClick={() => setScale(props.frame.scale - 0.1)}
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          aria-label={copy.zoom}
          aria-valuetext={`${Math.round(props.frame.scale * 100)}%`}
          value={props.frame.scale}
          onChange={(event) => setScale(Number(event.target.value))}
          className="h-7 min-w-0 flex-1 accent-white"
        />
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm leading-none text-white"
          aria-label={copy.zoomIn}
          onClick={() => setScale(props.frame.scale + 0.1)}
        >
          +
        </button>
      </div>
    </div>
  )
}

function Arrow(props: { dir: -1 | 1; label: string; onClick: () => void; className?: string; compact?: boolean }) {
  const Icon = props.dir < 0 ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={(event) => {
        event.stopPropagation()
        props.onClick()
      }}
      data-album-chrome=""
      className={cn(
        'absolute top-1/2 z-30 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-stone-800 shadow-md transition hover:bg-white',
        props.compact ? 'h-7 w-7' : 'h-9 w-9 sm:h-10 sm:w-10',
        props.dir < 0 ? (props.compact ? 'left-1' : 'left-1.5 sm:left-3') : (props.compact ? 'right-1' : 'right-1.5 sm:right-3'),
        props.className,
      )}
    >
      <Icon className={props.compact ? 'h-4 w-4' : 'h-5 w-5'} />
    </button>
  )
}

export function WeddingAlbumStage(props: {
  urls: string[]
  alt: string
  layoutId?: string | null
  locale?: WebLocale
  className?: string
  compact?: boolean
  crops?: WeddingAlbumPhotoCrop[]
  onExpand?: (index: number) => void
  /** Chỉ bật ở màn tạo thiệp. Thiệp khách mời không truyền prop này. */
  edit?: WeddingAlbumStageEdit
}) {
  const urls = props.urls.filter(Boolean)
  const count = urls.length
  const layout = resolveWeddingAlbumLayoutId(props.layoutId)
  const [index, setIndex] = useState(0)
  /** 0 = đứng yên. Dương = kéo về ảnh trước. Âm = kéo sang ảnh sau. */
  const [glide, setGlide] = useState(0)
  const [smooth, setSmooth] = useState(true)
  const [revealed, setRevealed] = useState(true)
  const drag = useRef({ active: false, startX: 0 })
  const glideRef = useRef(0)
  const indexRef = useRef(0)
  const settling = useRef(false)
  const timer = useRef<number | null>(null)
  const swipeRootRef = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)
  const editActiveRef = useRef(Boolean(props.edit))
  editActiveRef.current = Boolean(props.edit)
  const safeIndex = wrap(index, count)

  useEffect(() => {
    glideRef.current = glide
  }, [glide])
  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    setIndex(0)
    setGlide(0)
    setSmooth(true)
    settling.current = false
  }, [layout, count])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const commitGlide = (target: number) => {
    if (count < 2 || settling.current) return
    settling.current = true
    drag.current.active = false
    setSmooth(true)
    window.requestAnimationFrame(() => setGlide(target))
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setSmooth(false)
      setIndex((current) => wrap(current - target, count))
      setGlide(0)
      settling.current = false
      window.requestAnimationFrame(() => setSmooth(true))
    }, MOTION_MS + 40)
  }

  const nudge = (dir: -1 | 1) => {
    if (layout === 'slide' || layout === 'film') {
      setGlide(0)
      glideRef.current = 0
      setIndex((current) => wrap(current + dir, count))
      return
    }
    commitGlide(dir < 0 ? 1 : -1)
  }
  const commitGlideRef = useRef(commitGlide)
  commitGlideRef.current = commitGlide

  useEffect(() => {
    const el = swipeRootRef.current
    if (!el || count < 2) return

    let active = false
    let locked: 'unset' | 'x' | 'y' = 'unset'
    let startX = 0
    let startY = 0

    const isChrome = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-album-chrome]'))

    const onStart = (event: TouchEvent) => {
      if (editActiveRef.current) return
      if (event.touches.length !== 1 || settling.current) return
      if (isChrome(event.target)) return
      if (event.target instanceof Element && event.target.closest('[data-album-film-strip], [data-album-slide-scroller]')) return
      const touch = event.touches[0]
      active = true
      locked = 'unset'
      startX = touch.clientX
      startY = touch.clientY
    }

    const onMove = (event: TouchEvent) => {
      if (!active || event.touches.length !== 1) return
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (locked === 'unset') {
        if (dx * dx + dy * dy < 64) return
        locked = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
        if (locked === 'y') {
          active = false
          return
        }
        setSmooth(false)
      }
      if (locked !== 'x') return
      if (event.cancelable) event.preventDefault()
      const next = Math.max(-1.15, Math.min(1.15, dx / 200))
      glideRef.current = next
      setGlide(next)
    }

    const onEnd = () => {
      if (!active) return
      active = false
      if (locked !== 'x') return
      const g = glideRef.current
      if (Math.abs(g) > 0.04) suppressClick.current = true
      if (g > 0.18) commitGlideRef.current(1)
      else if (g < -0.18) commitGlideRef.current(-1)
      else {
        setSmooth(true)
        window.requestAnimationFrame(() => setGlide(0))
      }
    }

    const blockClick = (event: Event) => {
      if (!suppressClick.current) return
      suppressClick.current = false
      event.preventDefault()
      event.stopPropagation()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    el.addEventListener('click', blockClick, true)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('click', blockClick, true)
    }
  }, [count])

  const jumpTo = (target: number) => {
    if (layout === 'slide') {
      setGlide(0)
      glideRef.current = 0
      setIndex(wrap(target, count))
      return
    }
    const d = wrappedDelta(target, indexRef.current, count)
    if (Math.abs(d) < 0.01) return
    if (Math.abs(Math.abs(d) - 1) < 0.05) {
      nudge(d > 0 ? 1 : -1)
      return
    }
    if (settling.current) return
    setRevealed(false)
    window.setTimeout(() => {
      setSmooth(false)
      setGlide(0)
      setIndex(wrap(target, count))
      setRevealed(true)
      window.requestAnimationFrame(() => setSmooth(true))
    }, 220)
  }

  if (count === 0) return null

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (props.edit) return
    if (event.pointerType === 'touch') return
    if (count < 2 || settling.current) return
    if ((event.target as HTMLElement).closest('[data-album-chrome], [data-album-slide-scroller], [data-album-film-strip]')) return
    drag.current = { active: true, startX: event.clientX }
    setSmooth(false)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* chuột đã nhả */
    }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !drag.current.active) return
    const dx = event.clientX - drag.current.startX
    const span = layout === 'slide' ? Math.max(1, event.currentTarget.getBoundingClientRect().width) : 200
    const next = Math.max(-1.15, Math.min(1.15, dx / span))
    glideRef.current = next
    setGlide(next)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !drag.current.active) return
    drag.current.active = false
    const g = glideRef.current
    if (Math.abs(g) > 0.04) suppressClick.current = true
    if (g > 0.18) commitGlide(1)
    else if (g < -0.18) commitGlide(-1)
    else {
      setSmooth(true)
      window.requestAnimationFrame(() => setGlide(0))
    }
  }

  const navCopy = {
    vi: { prev: 'Ảnh trước', next: 'Ảnh sau', expand: 'Xem lớn hơn' },
    en: { prev: 'Previous photo', next: 'Next photo', expand: 'View larger' },
    zh: { prev: '上一张', next: '下一张', expand: '查看大图' },
    ja: { prev: '前の写真', next: '次の写真', expand: '大きく見る' },
    ko: { prev: '이전 사진', next: '다음 사진', expand: '크게 보기' },
  }[props.locale || 'vi']
  const prevLabel = navCopy.prev
  const nextLabel = navCopy.next
  const expandLabel = navCopy.expand

  return (
    <div className={cn('relative w-full min-w-0 max-w-full overflow-hidden', props.className)}>
      <div
        ref={swipeRootRef}
        className="relative w-full min-w-0 max-w-full select-none overflow-hidden"
        style={{
          touchAction: layout === 'slide' || layout === 'film' ? 'pan-x pan-y' : 'pan-y',
          overscrollBehaviorX: 'contain',
        }}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') nudge(-1)
          if (event.key === 'ArrowRight') nudge(1)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={cn(
            'w-full min-w-0 max-w-full overflow-hidden transition-opacity duration-300 ease-out',
            props.edit && 'pointer-events-none',
          )}
          style={{ opacity: revealed ? 1 : 0 }}
        >
          <AlbumFrame
            layout={layout}
            urls={urls}
            alt={props.alt}
            index={safeIndex}
            glide={glide}
            smooth={smooth}
            compact={props.compact}
            frameOf={(photoIndex) => resolveAlbumPhotoFrame(props.crops, photoIndex)}
            onNudge={nudge}
            onJump={jumpTo}
            onExpand={props.onExpand}
            onIndex={(next) => {
              setGlide(0)
              glideRef.current = 0
              setIndex(wrap(next, count))
            }}
            locked={Boolean(props.edit)}
          />
        </div>
        {count > 1 ? (
          <>
            <Arrow dir={-1} label={prevLabel} onClick={() => nudge(-1)} compact={props.compact} />
            <Arrow dir={1} label={nextLabel} onClick={() => nudge(1)} compact={props.compact} />
          </>
        ) : null}
        {props.onExpand && !props.edit ? (
          <button
            type="button"
            aria-label={expandLabel}
            data-album-chrome=""
            onClick={() => props.onExpand?.(safeIndex)}
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        ) : null}
        {props.edit ? (
          <AlbumStageEditor
            index={safeIndex}
            frame={resolveAlbumPhotoFrame(props.crops, safeIndex)}
            locale={props.locale}
            edit={props.edit}
          />
        ) : null}
      </div>
      {count > 1 && layout !== 'film' && layout !== 'story' ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {urls.map((url, dot) => (
            <button
              key={`${url}-${dot}`}
              type="button"
              aria-label={`${dot + 1}`}
              onClick={() => jumpTo(dot)}
              className={cn('h-1.5 rounded-full transition-all duration-500', dot === safeIndex ? 'w-5 bg-stone-800' : 'w-1.5 bg-stone-400/70')}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FilmSprockets(props: { compact?: boolean }) {
  const compact = props.compact
  return (
    <div
      aria-hidden
      className={cn('mx-2 shrink-0', compact ? 'h-2' : 'h-3 sm:h-3.5')}
      style={{
        backgroundImage: compact
          ? 'radial-gradient(circle, #d6d3d1 1.5px, transparent 1.7px)'
          : 'radial-gradient(circle, #f5f5f4 2.2px, transparent 2.4px)',
        backgroundSize: compact ? '14px 8px' : '18px 12px',
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'center',
      }}
    />
  )
}

/** Dải phim: một ảnh màu lớn trong khung phim, vuốt ngang từng ảnh. */
function FilmStrip(props: {
  urls: string[]
  alt: string
  index: number
  compact?: boolean
  frameOf: (index: number) => WeddingAlbumPhotoFrame
  onIndex: (index: number) => void
  onExpand?: (index: number) => void
  locked?: boolean
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const fromScroll = useRef(false)
  const programmatic = useRef(false)
  const onIndexRef = useRef(props.onIndex)
  const indexRef = useRef(props.index)
  onIndexRef.current = props.onIndex
  indexRef.current = props.index
  const count = props.urls.length

  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false
      return
    }
    const scroller = scrollerRef.current
    if (!scroller) return
    const width = scroller.clientWidth
    if (width <= 0) return
    const left = props.index * width
    if (Math.abs(scroller.scrollLeft - left) < 2) return
    programmatic.current = true
    scroller.scrollTo({ left, behavior: 'smooth' })
  }, [props.index, count])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || props.locked || count < 2) return
    let timer: number | null = null
    const sync = () => {
      const width = scroller.clientWidth || 1
      const next = Math.max(0, Math.min(count - 1, Math.round(scroller.scrollLeft / width)))
      if (programmatic.current) {
        if (next === indexRef.current) programmatic.current = false
        return
      }
      if (next === indexRef.current) return
      fromScroll.current = true
      onIndexRef.current(next)
    }
    const onScroll = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(sync, 90)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('scrollend', sync)
    return () => {
      if (timer) window.clearTimeout(timer)
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('scrollend', sync)
    }
  }, [count, props.locked])

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-stone-950 shadow-xl',
        props.compact ? 'py-2' : 'py-2.5 sm:py-3',
      )}
    >
      <FilmSprockets compact={props.compact} />
      <div
        ref={scrollerRef}
        className={cn(
          'flex w-full min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          props.compact ? 'mt-1.5' : 'mt-2',
        )}
        data-album-film-strip=""
        style={{ touchAction: props.locked ? 'none' : 'pan-x pan-y' }}
      >
        {props.urls.map((url, i) => {
          const on = i === props.index
          return (
            <div
              key={`${url}-${i}`}
              data-album-film-index={i}
              data-album-film-on={on ? '1' : '0'}
              className={cn('shrink-0 snap-center snap-always', props.compact ? 'px-2' : 'px-3 sm:px-4')}
              style={{ flex: '0 0 100%', scrollSnapStop: 'always' }}
            >
              <button
                type="button"
                onClick={() => {
                  if (on && props.onExpand) props.onExpand(i)
                }}
                className="relative block w-full overflow-hidden rounded-md bg-stone-900"
                style={{
                  height: props.compact ? '148px' : 'min(72vw, 26rem)',
                  boxShadow: 'inset 0 0 0 2.5px #fff, 0 8px 24px rgba(0,0,0,0.45)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- album URLs are external CDN */}
                <img
                  src={url}
                  alt={i === props.index ? props.alt : ''}
                  draggable={false}
                  className="pointer-events-none object-cover"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    opacity: 1,
                    filter: 'saturate(1.12) brightness(1.05)',
                    ...albumPhotoFrameStyle(props.frameOf(i)),
                  }}
                />
              </button>
            </div>
          )
        })}
      </div>
      <div className={props.compact ? 'mt-1.5' : 'mt-2'}>
        <FilmSprockets compact={props.compact} />
      </div>
    </div>
  )
}

function SlideScroller(props: {
  urls: string[]
  alt: string
  index: number
  className: string
  frameOf: (index: number) => WeddingAlbumPhotoFrame
  onIndex: (index: number) => void
  /** Màn sửa: chỉ nút mũi tên đổi ảnh, không vuốt ngang. */
  locked?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, pointerId: -1, startX: 0, startY: 0, startLeft: 0, delta: 0, axis: 'unset' as 'unset' | 'x' | 'y' })
  const indexRef = useRef(props.index)
  const onIndexRef = useRef(props.onIndex)
  indexRef.current = props.index
  onIndexRef.current = props.onIndex

  useEffect(() => {
    if (drag.current.active) return
    const el = ref.current
    if (!el) return
    const slide = el.firstElementChild
    const width = slide instanceof HTMLElement && slide.offsetWidth > 0 ? slide.offsetWidth : el.clientWidth
    if (width <= 0) return
    const left = props.index * width
    if (Math.abs(el.scrollLeft - left) < 2) return
    el.scrollTo({ left, behavior: 'auto' })
  }, [props.index, props.urls.length])

  useEffect(() => {
    const el = ref.current
    if (!el || props.locked || props.urls.length < 2) return

    const finish = (event: PointerEvent) => {
      const d = drag.current
      if (!d.active || event.pointerId !== d.pointerId) return
      d.active = false
      if (d.axis !== 'x') return
      const width = (el.firstElementChild instanceof HTMLElement && el.firstElementChild.offsetWidth) || el.clientWidth || 1
      const step = d.delta > 0.18 ? 1 : d.delta < -0.18 ? -1 : 0
      const next = wrap(indexRef.current + step, props.urls.length)
      el.scrollLeft = next * width
      if (next !== indexRef.current) onIndexRef.current(next)
    }

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      drag.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: el.scrollLeft,
        delta: 0,
        axis: 'unset',
      }
      event.stopPropagation()
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        /* pointer đã nhả */
      }
    }
    const onMove = (event: PointerEvent) => {
      const d = drag.current
      if (!d.active || event.pointerId !== d.pointerId) return
      const dx = event.clientX - d.startX
      const dy = event.clientY - d.startY
      if (d.axis === 'unset') {
        if (dx * dx + dy * dy < 64) return
        d.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
        if (d.axis === 'y') {
          d.active = false
          try {
            el.releasePointerCapture(event.pointerId)
          } catch {
            /* pointer đã nhả */
          }
          return
        }
      }
      if (d.axis !== 'x') return
      const width = (el.firstElementChild instanceof HTMLElement && el.firstElementChild.offsetWidth) || el.clientWidth || 1
      d.delta = -dx / width
      el.scrollLeft = d.startLeft - dx
      if (event.cancelable) event.preventDefault()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove, { passive: false })
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
    }
  }, [props.locked, props.urls.length])

  return (
    <div className={props.className}>
      <div
        ref={ref}
        data-album-slide-scroller=""
        className="flex h-full w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: props.locked ? 'none' : 'pan-y' }}
      >
        {props.urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative h-full w-full shrink-0 overflow-hidden"
            style={{ flex: '0 0 100%', minWidth: 0 }}
          >
            <AlbumPhoto url={url} alt={props.alt} frame={props.frameOf(i)} className="absolute inset-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AlbumFrame(props: {
  layout: WeddingAlbumLayoutId
  urls: string[]
  alt: string
  index: number
  glide: number
  smooth: boolean
  compact?: boolean
  frameOf: (index: number) => WeddingAlbumPhotoFrame
  onNudge: (dir: -1 | 1) => void
  onJump: (index: number) => void
  onExpand?: (index: number) => void
  onIndex: (index: number) => void
  locked?: boolean
}) {
  const { urls, alt, index, glide, smooth } = props
  const count = urls.length
  const focus = index - glide
  const transition = motionTransition(smooth)
  const frame = props.compact
    ? 'relative mx-auto h-64 w-full sm:h-80'
    : 'relative mx-auto h-[min(68vh,34rem)] w-full'

  if (props.layout === 'coverflow') {
    return (
      <div className={cn(frame, 'overflow-hidden')} style={{ perspective: '1400px' }}>
        {urls.map((url, i) => {
          const d = wrappedDelta(i, focus, count)
          const ad = Math.abs(d)
          if (ad > 2.6) return null
          return (
            <div
              key={`${url}-${i}`}
              role="button"
              tabIndex={0}
              aria-label={alt}
              data-album-photo=""
              className="absolute left-1/2 top-0 h-full w-[72%] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10"
              style={{
                touchAction: 'pan-y',
                zIndex: 24 - Math.round(ad * 8),
                opacity: ad > 1.2 ? Math.max(0, (1.8 - ad) / 0.6) : 1,
                transform: `translateX(calc(-50% + ${d * 46}%)) rotateY(${d * -28}deg) scale(${1 - Math.min(ad, 1.15) * 0.12})`,
                transition,
              }}
              onClick={() => {
                if (ad < 0.35) return
                props.onNudge(d > 0 ? 1 : -1)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                if (ad < 0.35) return
                props.onNudge(d > 0 ? 1 : -1)
              }}
            >
              <AlbumPhoto url={url} alt={i === index ? alt : ''} frame={props.frameOf(i)} />
              <span className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: Math.min(0.38, ad * 0.32), transition }} />
            </div>
          )
        })}
      </div>
    )
  }

  if (props.layout === 'slide') {
    return (
      <SlideScroller
        urls={urls}
        alt={alt}
        index={index}
        className={cn(frame, 'overflow-hidden rounded-2xl shadow-xl')}
        frameOf={props.frameOf}
        onIndex={props.onIndex}
        locked={props.locked}
      />
    )
  }

  if (props.layout === 'story') {
    const offset = (glide - index) * 100
    const track = (
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          transform: `translateY(${offset}%)`,
          transition,
        }}
      >
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative h-full w-full shrink-0 overflow-hidden"
            style={{ flex: '0 0 100%', minWidth: 0, minHeight: 0, touchAction: 'pan-y' }}
          >
            <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} className="absolute inset-0" />
          </div>
        ))}
      </div>
    )
    return (
      <div className="mx-auto w-full max-w-[20rem]">
        <div className="mb-2 flex gap-1">
          {urls.map((url, i) => (
            <span
              key={`${url}-bar-${i}`}
              className="h-1 flex-1 rounded-full bg-stone-300"
            >
              <span
                className="block h-full rounded-full bg-stone-800"
                style={{
                  opacity: Math.max(0, 1 - Math.abs(wrappedDelta(i, focus, count))),
                  transition,
                }}
              />
            </span>
          ))}
        </div>
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-xl">{track}</div>
      </div>
    )
  }

  if (props.layout === 'film') {
    return (
      <FilmStrip
        urls={urls}
        alt={alt}
        index={index}
        compact={props.compact}
        frameOf={props.frameOf}
        onIndex={props.onIndex}
        onExpand={props.onExpand}
        locked={props.locked}
      />
    )
  }

  if (props.layout === 'fade') {
    return (
      <div className={cn(frame, 'overflow-hidden rounded-2xl shadow-xl')}>
        {urls.map((url, i) => {
          const ad = Math.abs(wrappedDelta(i, focus, count))
          return (
            <div
              key={`${url}-${i}`}
              className="absolute inset-0 overflow-hidden touch-pan-y"
              style={{
                touchAction: 'pan-y',
                opacity: Math.max(0, 1 - ad),
                transform: `scale(${1 + Math.min(ad, 1) * 0.045})`,
                transition,
              }}
            >
              <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} className="absolute inset-0" />
            </div>
          )
        })}
      </div>
    )
  }

  if (props.layout === 'stack') {
    return (
      <div className={cn(frame, 'overflow-hidden')}>
        {urls.map((url, i) => {
          const d = wrappedDelta(i, focus, count)
          if (d < -1.25 || d > 2.4) return null
          const away = d < 0
          const lift = Math.max(0, d)
          return (
            <div
              key={`${url}-${i}`}
              className="absolute left-1/2 top-0 h-[92%] w-[82%] max-w-[26rem] touch-pan-y overflow-hidden rounded-2xl shadow-2xl"
              style={{
                touchAction: 'pan-y',
                zIndex: away ? 30 : 16 - Math.round(lift * 5),
                opacity: d > 1.7 ? Math.max(0, (2.4 - d) / 0.7) : 1,
                transform: `translateX(calc(-50% + ${Math.min(0, d) * 86}%)) translateY(${lift * 16}px) rotate(${Math.min(0, d) * 9}deg) scale(${1 - lift * 0.055})`,
                transition,
              }}
            >
              <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} />
            </div>
          )
        })}
      </div>
    )
  }

  if (props.layout === 'polaroid') {
    return (
      <div className={cn(frame, 'overflow-hidden')}>
        {urls.map((url, i) => {
          const d = wrappedDelta(i, focus, count)
          if (Math.abs(d) > 1.35) return null
          return (
            <div
              key={`${url}-${i}`}
              className="absolute left-1/2 top-1/2 w-[min(78%,20rem)] -translate-x-1/2 -translate-y-1/2 touch-pan-y bg-white p-3 pb-10 shadow-2xl"
              style={{
                touchAction: 'pan-y',
                zIndex: 20 - Math.round(Math.abs(d) * 6),
                opacity: Math.max(0, 1 - Math.max(0, Math.abs(d) - 0.08) * 1.05),
                transform: `translateX(calc(-50% + ${d * 108}%)) translateY(-50%) rotate(${d * 6 - 1.2}deg)`,
                transition,
              }}
            >
              <div className="aspect-[3/4] overflow-hidden bg-stone-100">
                <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} />
              </div>
              <p className="mt-3 text-center font-serif text-sm text-stone-500">
                {String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </p>
            </div>
          )
        })}
      </div>
    )
  }

  const under = wrap(index + (glide >= 0 ? -1 : 1), count)
  return (
    <div className={cn(frame, 'overflow-hidden')} style={{ perspective: '1600px' }}>
      <div className="absolute left-1/2 top-0 h-full w-[70%] max-w-[24rem] -translate-x-1/2 overflow-hidden rounded-2xl shadow-md" style={{ touchAction: 'pan-y' }}>
        <AlbumPhoto url={urls[under] ?? ''} alt={alt} frame={props.frameOf(under)} />
      </div>
      <div
        className="absolute left-1/2 top-0 h-full w-[70%] max-w-[24rem] overflow-hidden rounded-2xl shadow-2xl"
        style={{
          touchAction: 'pan-y',
          opacity: Math.max(0, 1 - Math.abs(glide) * 1.05),
          transform: `translateX(calc(-50% + ${glide * -36}%)) rotateY(${glide * 46}deg)`,
          transformOrigin: 'center center',
          transition,
        }}
      >
        <AlbumPhoto url={urls[index] ?? ''} alt={alt} frame={props.frameOf(index)} />
      </div>
    </div>
  )
}

export function WeddingAlbumLayoutPicker(props: {
  locale: WebLocale
  selectedId?: string | null
  previewUrls?: string[]
  crops?: WeddingAlbumPhotoCrop[]
  onSelect: (id: WeddingAlbumLayoutId) => void
  onCropChange?: WeddingAlbumStageEdit['onChange']
  onRemove?: WeddingAlbumStageEdit['onRemove']
  removeLabel?: string
}) {
  const selected = resolveWeddingAlbumLayoutId(props.selectedId || DEFAULT_WEDDING_ALBUM_LAYOUT_ID)
  const urls = (props.previewUrls ?? []).filter(Boolean)
  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-hidden">
      <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {WEDDING_ALBUM_LAYOUTS.map((layout) => {
          const on = layout.id === selected
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => props.onSelect(layout.id)}
              className={cn(
                'min-w-0 truncate rounded-xl border px-2 py-2 text-left text-xs font-medium transition',
                on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
              )}
            >
              {layout.label[props.locale] || layout.label.vi}
            </button>
          )
        })}
      </div>
      {urls.length > 0 ? (
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-stone-200/80 bg-stone-50/50 p-2 sm:p-2.5">
          <WeddingAlbumStage
            urls={urls}
            alt=""
            layoutId={selected}
            locale={props.locale}
            crops={props.crops}
            compact
            edit={
              props.onCropChange && props.onRemove
                ? {
                    onChange: props.onCropChange,
                    onRemove: props.onRemove,
                    removeLabel: props.removeLabel || ALBUM_EDIT_COPY[props.locale].remove,
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  )
}
