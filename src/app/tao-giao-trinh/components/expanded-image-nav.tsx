'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

type NavProps = {
  index: number
  count: number
  onPrev: () => void
  onNext: () => void
  tr: Tr
}

const sideButtonClass =
  'absolute top-1/2 z-40 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:flex sm:h-14 sm:w-14'

function stopControlEvent(event: { stopPropagation: () => void; preventDefault?: () => void }) {
  event.stopPropagation()
}

/** Nút ảnh trước / ảnh sau. Máy nhỏ dùng thanh dưới; máy lớn dùng nút hai bên. */
export function ExpandedImageNav({ index, count, onPrev, onNext, tr }: NavProps) {
  const atStart = index <= 0
  const atEnd = count <= 0 || index >= count - 1
  const prevLabel = tr('Ảnh trước', 'Previous image', '上一张', '前の画像', '이전 이미지')
  const nextLabel = tr('Ảnh sau', 'Next image', '下一张', '次の画像', '다음 이미지')
  const position = `${Math.min(count, index + 1)}/${Math.max(count, 1)}`
  return (
    <>
      <button
        type="button"
        data-expanded-image-nav
        disabled={atStart}
        onPointerDown={stopControlEvent}
        onClick={(event) => {
          stopControlEvent(event)
          onPrev()
        }}
        className={cn(sideButtonClass, 'left-2 sm:left-4')}
        aria-label={prevLabel}
        title={prevLabel}
      >
        <ChevronLeft className="h-7 w-7" aria-hidden />
      </button>
      <button
        type="button"
        data-expanded-image-nav
        disabled={atEnd}
        onPointerDown={stopControlEvent}
        onClick={(event) => {
          stopControlEvent(event)
          onNext()
        }}
        className={cn(sideButtonClass, 'right-2 sm:right-4')}
        aria-label={nextLabel}
        title={nextLabel}
      >
        <ChevronRight className="h-7 w-7" aria-hidden />
      </button>
      <div
        data-expanded-image-nav
        className="z-40 flex shrink-0 items-center gap-2 border-t border-white/15 bg-black/80 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden"
        onPointerDown={stopControlEvent}
        onClick={stopControlEvent}
      >
        <button
          type="button"
          disabled={atStart}
          onClick={onPrev}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-white/15 text-sm font-semibold text-white active:bg-white/25 disabled:opacity-35"
        >
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
          {tr('Trước', 'Back', '上一张', '前へ', '이전')}
        </button>
        <span className="w-14 shrink-0 text-center text-sm font-semibold tabular-nums text-white" aria-live="polite">
          {position}
        </span>
        <button
          type="button"
          disabled={atEnd}
          onClick={onNext}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-white/15 text-sm font-semibold text-white active:bg-white/25 disabled:opacity-35"
        >
          {tr('Sau', 'Next', '下一张', '次へ', '다음')}
          <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
    </>
  )
}

/** Vuốt ngang trên điện thoại, giống xem ảnh. Không bắt chuột máy tính và không cướp nét vẽ. */
export function useExpandedImageSwipe(onPrev: () => void, onNext: () => void) {
  const prevRef = useRef(onPrev)
  const nextRef = useRef(onNext)
  prevRef.current = onPrev
  nextRef.current = onNext
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null)
  return useMemo(() => ({
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse') return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('button, a, input, textarea, [data-expanded-image-nav], [data-expanded-image-draw], [data-infographic-draw-pane-stage]')) return
      startRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const start = startRef.current
      startRef.current = null
      if (!start || start.id !== event.pointerId) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.3) return
      if (dx < 0) nextRef.current()
      else prevRef.current()
    },
    onPointerCancel() {
      startRef.current = null
    },
  }), [])
}

type StageProps = {
  urls: string[]
  index: number
  emptyLabel: string
}

/** Ảnh một ô để trượt. Embed không phải ảnh thì để trống, khung cũ giữ nguyên. */
export function expandedGalleryImageUrl(
  layout: number,
  cell: { imageUrl?: string; visualEmbed?: string } | undefined,
): string {
  if (layout !== 1 || !cell) return ''
  const embed = String(cell.visualEmbed ?? '').trim()
  if (embed && !/^\[image:/i.test(embed)) return ''
  const direct = String(cell.imageUrl ?? '').trim()
  if (direct) return direct
  const matched = embed.match(/^\[image:\s*([^\]]+)\]$/i)
  return String(matched?.[1] ?? '').trim()
}

const SLIDE_MS = 320
const SLIDE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function StageLayerBody({ url, emptyLabel }: { url: string; emptyLabel: string }) {
  if (!url) return <p className="px-6 text-center text-sm text-white/70">{emptyLabel}</p>
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- remote slide image in the photo strip */
    <img
      src={url}
      alt=""
      draggable={false}
      decoding="async"
      className="pointer-events-none max-h-full max-w-full select-none object-contain"
      referrerPolicy="no-referrer"
    />
  )
}

/**
 * Hai lớp ảnh cố định. Lớp đang xem giữ nguyên thẻ img;
 * ảnh kế tiếp trượt vào như xem ảnh, không dựng lại khung slide.
 */
export function ExpandedImageStage({ urls, index, emptyLabel }: StageProps) {
  const count = urls.length
  const safe = count <= 0 ? 0 : Math.max(0, Math.min(count - 1, index))
  const urlsRef = useRef(urls)
  urlsRef.current = urls
  const [layerUrls, setLayerUrls] = useState<[string, string]>(() => [urls[safe] ?? '', ''])
  const layerUrlsRef = useRef(layerUrls)
  layerUrlsRef.current = layerUrls
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const shownRef = useRef(safe)
  const [run, setRun] = useState<{ to: number; dir: 1 | -1 } | null>(null)
  const layerRefs = useRef<[HTMLDivElement | null, HTMLDivElement | null]>([null, null])
  const preloadKey = urls.join('\n')

  useEffect(() => {
    for (const url of preloadKey.split('\n')) {
      if (!url) continue
      const img = new Image()
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.src = url
    }
  }, [preloadKey])

  useLayoutEffect(() => {
    const idleNode = layerRefs.current[1]
    if (!idleNode || idleNode.style.transform) return
    idleNode.style.transform = 'translate3d(100%,0,0)'
  }, [])

  useLayoutEffect(() => {
    if (run) return
    const liveUrl = urlsRef.current[safe] ?? ''
    if (safe === shownRef.current) {
      const current = activeRef.current
      if (layerUrlsRef.current[current] === liveUrl) return
      setLayerUrls((prev) => {
        const copy: [string, string] = [prev[0], prev[1]]
        copy[current] = liveUrl
        return copy
      })
      return
    }
    const nextUrl = liveUrl
    if (nextUrl && nextUrl === layerUrlsRef.current[activeRef.current]) {
      shownRef.current = safe
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const distance = Math.abs(safe - shownRef.current)
    if (reduce || distance === 0) {
      const current = activeRef.current
      shownRef.current = safe
      const node = layerRefs.current[current]
      const other = layerRefs.current[current === 0 ? 1 : 0]
      if (node) {
        node.style.transition = 'none'
        node.style.transform = 'translate3d(0,0,0)'
      }
      if (other) {
        other.style.transition = 'none'
        other.style.transform = 'translate3d(100%,0,0)'
      }
      setLayerUrls((prev) => {
        const copy: [string, string] = [prev[0], prev[1]]
        copy[current] = nextUrl
        return copy
      })
      return
    }
    const idle = activeRef.current === 0 ? 1 : 0
    setLayerUrls((prev) => {
      const copy: [string, string] = [prev[0], prev[1]]
      copy[idle] = nextUrl
      return copy
    })
    setRun({ to: safe, dir: safe > shownRef.current ? 1 : -1 })
  }, [safe, urls, run])

  useLayoutEffect(() => {
    if (!run) return
    const current = activeRef.current
    const idle = current === 0 ? 1 : 0
    const activeNode = layerRefs.current[current]
    const idleNode = layerRefs.current[idle]
    if (!activeNode || !idleNode) return
    const idleFrom = run.dir > 0 ? 'translate3d(100%,0,0)' : 'translate3d(-100%,0,0)'
    const activeTo = run.dir > 0 ? 'translate3d(-100%,0,0)' : 'translate3d(100%,0,0)'
    idleNode.style.transition = 'none'
    activeNode.style.transition = 'none'
    idleNode.style.transform = idleFrom
    activeNode.style.transform = 'translate3d(0,0,0)'
    let settled = false
    let started = false
    let timer = 0
    let frame1 = 0
    let frame2 = 0
    const finish = () => {
      if (settled) return
      settled = true
      shownRef.current = run.to
      activeRef.current = idle
      activeNode.style.transition = 'none'
      activeNode.style.transform = 'translate3d(100%,0,0)'
      setActive(idle)
      setRun(null)
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== idleNode || event.propertyName !== 'transform') return
      finish()
    }
    const start = () => {
      if (settled || started) return
      started = true
      frame1 = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          if (settled) return
          const transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE}`
          idleNode.style.transition = transition
          activeNode.style.transition = transition
          idleNode.style.transform = 'translate3d(0,0,0)'
          activeNode.style.transform = activeTo
          idleNode.addEventListener('transitionend', onEnd)
          timer = window.setTimeout(finish, SLIDE_MS + 80)
        })
      })
    }
    start()
    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
      window.clearTimeout(timer)
      idleNode.removeEventListener('transitionend', onEnd)
    }
  }, [run])

  return (
    <div className="relative h-full min-h-0 w-full flex-1 basis-0 overflow-hidden bg-black">
      {([0, 1] as const).map((slot) => (
        <div
          key={slot}
          ref={(node) => {
            layerRefs.current[slot] = node
          }}
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black',
            run && slot !== active ? 'z-[2]' : slot === active ? 'z-[1]' : 'z-0',
          )}
        >
          <StageLayerBody url={layerUrls[slot] ?? ''} emptyLabel={emptyLabel} />
        </div>
      ))}
    </div>
  )
}
