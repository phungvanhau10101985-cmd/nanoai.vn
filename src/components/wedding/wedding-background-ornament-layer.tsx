'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { repeatWeddingOrnamentsDown, weddingOrnamentFrameStyle, weddingOrnamentImageStyle, weddingOrnamentPageCount, weddingOrnamentRises, weddingOrnamentsAreOneSheet, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import './wedding-layer.css'

/** Nội dung thiệp (`flow`) lặp hoa văn theo từng khổ. Vỏ thiệp giữ một khổ. */
export function useWeddingOrnamentRun(rootRef: RefObject<HTMLElement | null>, ornaments: readonly WeddingBackgroundOrnament[]) {
  const [pages, setPages] = useState(1)
  const key = ornaments.map((item) => `${item.src}:${item.x}:${item.y}:${item.w}:${item.anchor ?? ''}`).join('|')

  useLayoutEffect(() => {
    const el = rootRef.current
    const flow = el?.parentElement?.getAttribute('data-wedding-ornament-frame') === 'flow'
    if (!el || !flow) {
      setPages(1)
      return
    }
    const fit = () => {
      const next = weddingOrnamentPageCount(el.clientWidth, el.clientHeight)
      setPages((prev) => (prev === next ? prev : next))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    fit()
    return () => observer.disconnect()
  }, [rootRef, key])

  const tilePages = weddingOrnamentsAreOneSheet(ornaments) ? pages : 1
  return { pages: tilePages, shown: repeatWeddingOrnamentsDown(ornaments, tilePages) }
}

function ornamentMotionKey(items: readonly WeddingBackgroundOrnament[]) {
  return items.map((item, index) => `${index}:${item.motion ?? ''}:${item.src}`).join('|')
}

/** Hoa đang ở tầm mắt thì trượt lên ngay. Hoa phía dưới chờ lúc lướt tới. `playVisible` tắt thì hoa đang thấy giữ nguyên chỗ, để kéo sửa. */
export function bindWeddingOrnamentRise(root: HTMLElement, playVisible: boolean) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const nodes = [...root.querySelectorAll<HTMLElement>('[data-wedding-ornament-rise]')]
  for (const node of nodes) delete node.dataset.weddingOrnamentShown
  delete root.dataset.ornamentMotion
  if (reduce || nodes.length === 0) return () => {}
  const limit = window.innerHeight * 0.9
  const visible: HTMLElement[] = []
  const wait: HTMLElement[] = []
  for (const node of nodes) {
    const box = node.getBoundingClientRect()
    if (box.bottom > 0 && box.top < limit) visible.push(node)
    else wait.push(node)
  }
  if (!playVisible) {
    for (const node of visible) node.dataset.weddingOrnamentShown = '1'
  }
  root.dataset.ornamentMotion = '1'
  const frame = requestAnimationFrame(() => {
    if (!playVisible) return
    for (const node of visible) node.dataset.weddingOrnamentShown = '1'
  })
  let io: IntersectionObserver | null = null
  if (wait.length && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.weddingOrnamentShown = '1'
          io?.unobserve(entry.target)
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
    )
    for (const node of wait) io.observe(node)
  }
  return () => {
    cancelAnimationFrame(frame)
    io?.disconnect()
  }
}

/** Hoa văn thêm, cùng chỗ trên bản sửa, bản xem thử và bản khách. Hoa «lên khi lướt» trượt lên một đoạn khi vào tầm mắt. */
export function WeddingBackgroundOrnamentLayer(props: {
  ornaments: readonly WeddingBackgroundOrnament[]
  className?: string
  /** Tắt trên ô mẫu nhỏ, kẻo hoa nhảy lúc chọn nền. */
  animateRise?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { shown } = useWeddingOrnamentRun(rootRef, props.ornaments)
  const motionKey = ornamentMotionKey(props.ornaments)
  const animate = props.animateRise !== false

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !animate) return
    return bindWeddingOrnamentRise(root, true)
  }, [animate, motionKey])

  if (!props.ornaments.length) return null
  return (
    <div
      ref={rootRef}
      data-wedding-ornaments=""
      className={cn('pointer-events-none absolute inset-0 overflow-visible', props.className)}
      style={{ zIndex: 36 }}
      aria-hidden
    >
      {shown.map((item) => (
        <div
          key={`${item.page}-${item.seed}-${item.src}`}
          data-ornament-index={item.seed}
          data-wedding-ornament-rise={weddingOrnamentRises(item) ? '' : undefined}
          className="absolute max-w-none"
          style={weddingOrnamentFrameStyle(item)}
        >
          <img
            src={item.src}
            alt=""
            draggable={false}
            className="block w-full max-w-none select-none"
            style={weddingOrnamentImageStyle(item)}
          />
        </div>
      ))}
    </div>
  )
}
