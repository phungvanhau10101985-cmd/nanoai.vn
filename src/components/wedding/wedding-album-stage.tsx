'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
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

function Arrow(props: { dir: -1 | 1; label: string; onClick: () => void; className?: string }) {
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
        'absolute top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-stone-800 shadow-md transition hover:bg-white',
        props.dir < 0 ? 'left-1 sm:left-2' : 'right-1 sm:right-2',
        props.className,
      )}
    >
      <Icon className="h-5 w-5" />
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
    if (layout === 'slide') {
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
    if (event.pointerType === 'touch') return
    if (count < 2 || settling.current) return
    if ((event.target as HTMLElement).closest('[data-album-chrome], [data-album-slide-scroller]')) return
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
    <div className={cn('relative w-full min-w-0 max-w-full', layout === 'film' && 'overflow-x-clip', props.className)}>
      <div
        ref={swipeRootRef}
        className="relative select-none"
        style={{
          touchAction: layout === 'slide' ? 'pan-x pan-y' : 'pan-y',
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
        <div className="transition-opacity duration-300 ease-out" style={{ opacity: revealed ? 1 : 0 }}>
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
            onIndex={(next) => {
              setGlide(0)
              glideRef.current = 0
              setIndex(wrap(next, count))
            }}
          />
        </div>
        {count > 1 ? (
          <>
            <Arrow dir={-1} label={prevLabel} onClick={() => nudge(-1)} />
            <Arrow dir={1} label={nextLabel} onClick={() => nudge(1)} />
          </>
        ) : null}
        {props.onExpand ? (
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

function filmCellSize(compact: boolean | undefined) {
  if (compact) return { width: '72px', height: '96px' }
  return { width: 'clamp(64px, 18vw, 96px)', height: 'clamp(88px, 22vw, 120px)' }
}

function FilmSprockets() {
  return (
    <div
      aria-hidden
      className="mx-2 h-2 shrink-0"
      style={{
        backgroundImage: 'radial-gradient(circle, #d6d3d1 1.5px, transparent 1.7px)',
        backgroundSize: '14px 8px',
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'center',
      }}
    />
  )
}

/** Dải phim: chỉ một hàng khung nhỏ, không ảnh hero full khung. */
function FilmStrip(props: {
  urls: string[]
  alt: string
  index: number
  focus: number
  count: number
  transition: string
  compact?: boolean
  frameOf: (index: number) => WeddingAlbumPhotoFrame
  onJump: (index: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const cell = filmCellSize(props.compact)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const active = scroller.querySelector<HTMLElement>('[data-album-film-on="1"]')
    if (!active) return
    const scrollerRect = scroller.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const delta = activeRect.left - scrollerRect.left - (scrollerRect.width - activeRect.width) / 2
    scroller.scrollBy({ left: delta, behavior: 'auto' })
  }, [props.index, props.urls.length])

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl bg-stone-950 py-2">
      <FilmSprockets />
      <div
        ref={scrollerRef}
        className="mt-1.5 flex w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
        style={{ justifyContent: 'safe center' }}
        data-album-film-strip=""
      >
        <div className="flex w-max max-w-none gap-2 px-2">
          {props.urls.map((url, i) => {
            const ad = Math.abs(wrappedDelta(i, props.focus, props.count))
            const on = ad < 0.45
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                data-album-film-on={on ? '1' : '0'}
                onClick={() => props.onJump(i)}
                className="relative shrink-0 overflow-hidden rounded-sm bg-black"
                style={{
                  width: cell.width,
                  height: cell.height,
                  minWidth: cell.width,
                  maxWidth: cell.width,
                  minHeight: cell.height,
                  maxHeight: cell.height,
                  opacity: on ? 1 : 0.72,
                  boxShadow: on ? 'inset 0 0 0 2px #fff' : undefined,
                  transition: props.transition,
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
                    ...albumPhotoFrameStyle(props.frameOf(i)),
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5">
        <FilmSprockets />
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
    if (!el || props.urls.length < 2) return

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
  }, [props.urls.length])

  return (
    <div className={props.className}>
      <div
        ref={ref}
        data-album-slide-scroller=""
        className="flex h-full w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-y' }}
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
  onIndex: (index: number) => void
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
        focus={focus}
        count={count}
        transition={transition}
        compact={props.compact}
        frameOf={props.frameOf}
        onJump={props.onJump}
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
}) {
  const selected = resolveWeddingAlbumLayoutId(props.selectedId || DEFAULT_WEDDING_ALBUM_LAYOUT_ID)
  const urls = (props.previewUrls ?? []).filter(Boolean)
  return (
    <div className="w-full min-w-0 max-w-full space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WEDDING_ALBUM_LAYOUTS.map((layout) => {
          const on = layout.id === selected
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => props.onSelect(layout.id)}
              className={cn(
                'rounded-xl border px-2 py-2 text-left text-xs font-medium transition',
                on ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
              )}
            >
              {layout.label[props.locale] || layout.label.vi}
            </button>
          )
        })}
      </div>
      {urls.length > 0 ? (
        <WeddingAlbumStage urls={urls} alt="" layoutId={selected} locale={props.locale} crops={props.crops} compact />
      ) : null}
    </div>
  )
}
