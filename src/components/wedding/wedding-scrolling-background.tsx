'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

type Props = {
  urls: string[]
  fallbackColor: string
}

/**
 * Nền thiệp chỉ một ảnh đã chọn.
 * Nối các bản sao mép nhau cho kín chiều cao, không chèn ảnh khác và không làm mờ vạch nối.
 */
export function WeddingScrollingBackground({ urls, fallbackColor }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const url = useMemo(() => urls.map((raw) => raw.trim()).find(Boolean) || '', [urls])
  const [repeats, setRepeats] = useState(4)

  useLayoutEffect(() => {
    const host = hostRef.current
    const parent = host?.parentElement
    if (!host || !parent || !url) return

    const fit = () => {
      const need = parent.scrollHeight
      const tile = host.querySelector('img')
      const tileHeight = tile?.clientHeight ?? 0
      if (tileHeight <= 0) return
      const next = Math.max(1, Math.ceil((need + 1) / tileHeight))
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
  }, [url, repeats])

  if (!url) return null

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: fallbackColor }}
    >
      <div className="flex w-full flex-col leading-none">
        {Array.from({ length: repeats }, (_, index) => (
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
