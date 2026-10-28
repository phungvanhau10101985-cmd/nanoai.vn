'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import './wedding-cover-intro.css'

/** Cỡ chữ tạm để tên dài không tràn trước khi đo. Tên ngắn vẫn chạm trần của class. */
function coupleNameFallbackSize(groomName: string, brideName: string): string {
  const chars = Math.max(groomName.length + (brideName ? brideName.length + 4 : 0), 1)
  const cqi = (100 / (chars * 0.66)).toFixed(2)
  return `clamp(1.05rem, min(8cqi, ${cqi}cqi), 4.25rem)`
}

/** Thu nhỏ từ cỡ class cho đến khi cả dòng nằm trong khung. */
function tightenCoupleName(el: HTMLHeadingElement) {
  if (el.clientWidth < 8) return
  const previous = el.style.fontSize
  el.style.fontSize = ''
  const cap = parseFloat(getComputedStyle(el).fontSize)
  if (!Number.isFinite(cap) || cap <= 0) {
    el.style.fontSize = previous
    return
  }
  let size = cap
  el.style.fontSize = `${size}px`
  for (let step = 0; step < 10 && el.scrollWidth > el.clientWidth + 2 && size > 15; step += 1) {
    const next = Math.max(15, Math.floor((size * el.clientWidth) / Math.max(el.scrollWidth, 1)))
    if (next === size) break
    size = next
    el.style.fontSize = `${size}px`
  }
}

/** Tên chú rể từ trái, cô dâu từ phải, gặp nhau ở dấu &. */
export function WeddingCoupleNames(props: {
  groomName: string
  brideName: string
  flyIn?: boolean
  /** reveal = chạy vào lúc cửa thiệp chính mở. opened = tên bay vào rồi từng câu hiện tiếp. */
  pace?: 'cover' | 'reveal' | 'opened'
  className?: string
}) {
  const groomName = props.groomName.trim()
  const brideName = props.brideName.trim()
  const ref = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) tightenCoupleName(el)
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (el.scrollWidth > el.clientWidth + 2) tightenCoupleName(el)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [groomName, brideName])

  const frame = cn(
    'w-full min-w-0 max-w-full',
    props.flyIn && props.pace === 'reveal' && 'wedding-couple-pace-reveal',
    props.flyIn && props.pace === 'opened' && 'wedding-couple-pace-opened',
    props.className,
  )
  const fitStyle = { fontSize: coupleNameFallbackSize(groomName, brideName) }

  if (!brideName) {
    return (
      <h1 ref={ref} className={cn('flex items-baseline justify-center', frame)} style={fitStyle}>
        <span className={cn('inline-block max-w-full', props.flyIn ? 'whitespace-nowrap' : 'break-words', props.flyIn && 'wedding-couple-from-left')}>{groomName}</span>
      </h1>
    )
  }
  return (
    <h1
      ref={ref}
      className={cn('flex items-baseline justify-center gap-x-[0.35em]', props.flyIn ? 'flex-nowrap' : 'flex-wrap', frame)}
      style={fitStyle}
    >
      <span className={cn('inline-block max-w-full', props.flyIn ? 'whitespace-nowrap' : 'break-words', props.flyIn && 'wedding-couple-from-left')}>{groomName}</span>
      <span className={cn('shrink-0', props.flyIn && 'wedding-couple-amp')}>&</span>
      <span className={cn('inline-block max-w-full', props.flyIn ? 'whitespace-nowrap' : 'break-words', props.flyIn && 'wedding-couple-from-right')}>{brideName}</span>
    </h1>
  )
}
