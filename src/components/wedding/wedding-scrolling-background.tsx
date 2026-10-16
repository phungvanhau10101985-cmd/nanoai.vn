'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

type Props = {
  urls: string[]
  fallbackColor: string
}

/**
 * Xếp ảnh nền từ trên xuống, đúng tỉ lệ, nối mép nhau.
 * Lớp này nằm trong trang (không khóa khung nhìn) nên cuộn cùng nội dung.
 * Lặp lại dãy ảnh cho kín chiều cao thiệp.
 */
export function WeddingScrollingBackground({ urls, fallbackColor }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const clean = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of urls) {
      const url = raw.trim()
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push(url)
    }
    return out
  }, [urls])
  const [repeats, setRepeats] = useState(8)

  useLayoutEffect(() => {
    const host = hostRef.current
    const parent = host?.parentElement
    if (!host || !parent || clean.length === 0) return

    const fit = () => {
      const need = parent.scrollHeight
      const cycleImages = Array.from(host.querySelectorAll('img')).slice(0, clean.length)
      const cycle = cycleImages.reduce((sum, img) => sum + img.clientHeight, 0)
      if (cycle <= 0) return
      const next = Math.max(1, Math.ceil((need + 1) / cycle))
      setRepeats((prev) => (prev === next ? prev : next))
    }

    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    host.addEventListener('load', fit, true)
    fit()
    const frame = requestAnimationFrame(fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      host.removeEventListener('load', fit, true)
    }
  }, [clean, repeats])

  if (clean.length === 0) return null

  const tiles: string[] = []
  for (let repeat = 0; repeat < repeats; repeat += 1) tiles.push(...clean)

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: fallbackColor }}
    >
      <div className="flex w-full flex-col leading-none">
        {tiles.map((url, index) => (
          <img
            key={`${index}:${url}`}
            src={url}
            alt=""
            draggable={false}
            decoding={index === 0 ? 'sync' : 'async'}
            className="block h-auto w-full max-w-none select-none"
          />
        ))}
      </div>
    </div>
  )
}
