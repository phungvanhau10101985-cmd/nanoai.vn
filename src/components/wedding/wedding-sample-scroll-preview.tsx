'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  WEDDING_SAMPLE_SCROLL_RETURN_MS,
  weddingSampleScrollDuration,
  weddingSampleScrollTravel,
} from '@/lib/wedding/wedding-sample-scroll-motion'

function translateY(el: HTMLElement) {
  const raw = getComputedStyle(el).transform
  if (!raw || raw === 'none') return 0
  return new DOMMatrixReadOnly(raw).m42
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Ô mẫu: thấy phần trên thiệp. Rê chuột thì trượt hết thiệp đã mở, rời chuột thì về đầu.
 * Dùng pixel trên lớp GPU. Transition CSS với % và cqh trên ảnh ~7000px bị vẽ lại từng khung nên giật.
 */
export function WeddingSampleScrollPreview(props: {
  src: string
  eager?: boolean
  className?: string
  onError?: () => void
}) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<Animation | null>(null)
  const hoveringRef = useRef(false)

  useEffect(() => () => animRef.current?.cancel(), [])

  const image = () => boxRef.current?.querySelector('img') ?? null

  const glide = (img: HTMLImageElement, from: number, to: number, duration: number, easing: string) => {
    animRef.current?.cancel()
    img.style.transform = `translate3d(0, ${from}px, 0)`
    const anim = img.animate(
      [
        { transform: `translate3d(0, ${from}px, 0)` },
        { transform: `translate3d(0, ${to}px, 0)` },
      ],
      { duration, easing, fill: 'forwards' },
    )
    animRef.current = anim
    return anim
  }

  const play = () => {
    hoveringRef.current = true
    const box = boxRef.current
    const img = image()
    if (!box || !img || reducedMotion()) return
    const start = () => {
      if (!hoveringRef.current || !boxRef.current) return
      const travel = weddingSampleScrollTravel(img.offsetHeight, box.clientHeight)
      if (travel < 2) return
      const from = Math.max(-travel, Math.min(0, translateY(img)))
      const remain = travel + from
      if (remain < 2) return
      img.style.willChange = 'transform'
      glide(img, from, -travel, weddingSampleScrollDuration(remain, travel), 'linear')
    }
    if (img.complete && img.naturalHeight > 0) {
      const decode = img.decode?.()
      if (decode) void decode.then(start, start)
      else start()
      return
    }
    img.addEventListener('load', start, { once: true })
  }

  const stop = () => {
    hoveringRef.current = false
    const img = image()
    if (!img) return
    const from = translateY(img)
    if (from >= -0.5 || reducedMotion()) {
      animRef.current?.cancel()
      img.style.transform = ''
      img.style.willChange = ''
      return
    }
    const anim = glide(img, from, 0, WEDDING_SAMPLE_SCROLL_RETURN_MS, 'ease-out')
    anim.onfinish = () => {
      if (hoveringRef.current) return
      img.style.transform = ''
      img.style.willChange = ''
    }
  }

  return (
    <span
      ref={boxRef}
      className={cn('relative block aspect-[3/5] overflow-hidden bg-[#fffaf2] [transform:translateZ(0)]', props.className)}
      onMouseEnter={play}
      onMouseLeave={stop}
    >
      <img
        src={props.src}
        alt=""
        loading={props.eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute inset-x-0 top-0 block w-full max-w-none"
        onError={props.onError}
      />
    </span>
  )
}
