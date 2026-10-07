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
  return (
    // eslint-disable-next-line @next/next/no-img-element -- album URLs are external CDN
    <img
      src={props.url}
      alt={props.alt}
      draggable={false}
      className={cn('h-full w-full object-cover', props.className)}
      style={albumPhotoFrameStyle(props.frame)}
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

  const nudge = (dir: -1 | 1) => commitGlide(dir < 0 ? 1 : -1)

  const jumpTo = (target: number) => {
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
    if (count < 2 || settling.current) return
    if ((event.target as HTMLElement).closest('button')) return
    drag.current = { active: true, startX: event.clientX }
    setSmooth(false)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const dx = event.clientX - drag.current.startX
    const next = Math.max(-1.15, Math.min(1.15, dx / 200))
    glideRef.current = next
    setGlide(next)
  }
  const onPointerUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    const g = glideRef.current
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
    <div className={cn('relative', props.className)}>
      <div
        className="relative touch-pan-y select-none"
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
            <button
              key={`${url}-${i}`}
              type="button"
              aria-label={alt}
              className="absolute left-1/2 top-0 h-full w-[72%] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10"
              style={{
                zIndex: 24 - Math.round(ad * 8),
                opacity: ad > 1.2 ? Math.max(0, (1.8 - ad) / 0.6) : 1,
                transform: `translateX(calc(-50% + ${d * 46}%)) rotateY(${d * -28}deg) scale(${1 - Math.min(ad, 1.15) * 0.12})`,
                transition,
              }}
              onClick={() => {
                if (ad < 0.35) return
                props.onNudge(d > 0 ? 1 : -1)
              }}
            >
              <AlbumPhoto url={url} alt={i === index ? alt : ''} frame={props.frameOf(i)} />
              <span className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: Math.min(0.38, ad * 0.32), transition }} />
            </button>
          )
        })}
      </div>
    )
  }

  if (props.layout === 'slide' || props.layout === 'story') {
    const vertical = props.layout === 'story'
    const track = (
      <div
        className={vertical ? 'w-full' : 'flex h-full'}
        style={{
          [vertical ? 'height' : 'width']: `${count * 100}%`,
          transform: vertical
            ? `translateY(${(-(index - glide) * 100) / count}%)`
            : `translateX(${(-(index - glide) * 100) / count}%)`,
          transition,
        }}
      >
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className={vertical ? 'w-full' : 'h-full'}
            style={vertical ? { height: `${100 / count}%` } : { width: `${100 / count}%` }}
          >
            <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} />
          </div>
        ))}
      </div>
    )
    if (vertical) {
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
    return <div className={cn(frame, 'overflow-hidden rounded-2xl shadow-xl')}>{track}</div>
  }

  if (props.layout === 'fade' || props.layout === 'film') {
    const hero = (
      <div className={cn(props.layout === 'film' ? frame : frame, 'overflow-hidden rounded-2xl shadow-xl')}>
        {urls.map((url, i) => {
          const ad = Math.abs(wrappedDelta(i, focus, count))
          return (
            <div
              key={`${url}-${i}`}
              className="absolute inset-0"
              style={{
                opacity: Math.max(0, 1 - ad),
                transform: `scale(${1 + Math.min(ad, 1) * 0.045})`,
                transition,
              }}
            >
              <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} />
            </div>
          )
        })}
      </div>
    )
    if (props.layout === 'film') {
      return (
        <div className="space-y-3">
          {hero}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {urls.map((url, i) => {
              const ad = Math.abs(wrappedDelta(i, focus, count))
              const on = ad < 0.45
              return (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => props.onJump(i)}
                  className={cn('h-16 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ring-offset-1', on ? 'ring-stone-800' : 'ring-transparent')}
                  style={{
                    opacity: on ? 1 : 0.7,
                    transition,
                  }}
                >
                  <AlbumPhoto url={url} alt={alt} frame={props.frameOf(i)} />
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    return hero
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
              className="absolute left-1/2 top-0 h-[92%] w-[82%] max-w-[26rem] overflow-hidden rounded-2xl shadow-2xl"
              style={{
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
              className="absolute left-1/2 top-1/2 w-[min(78%,20rem)] -translate-x-1/2 -translate-y-1/2 bg-white p-3 pb-10 shadow-2xl"
              style={{
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
      <div className="absolute left-1/2 top-0 h-full w-[70%] max-w-[24rem] -translate-x-1/2 overflow-hidden rounded-2xl shadow-md">
        <AlbumPhoto url={urls[under] ?? ''} alt={alt} frame={props.frameOf(under)} />
      </div>
      <div
        className="absolute left-1/2 top-0 h-full w-[70%] max-w-[24rem] overflow-hidden rounded-2xl shadow-2xl"
        style={{
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
    <div className="space-y-3">
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
