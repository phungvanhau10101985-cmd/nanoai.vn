'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

type Props = {
  urls: string[]
  fallbackColor: string
}

/**
 * Một ảnh thì lặp ảnh đó cho kín chiều cao.
 * Một bộ ảnh thì xếp lần lượt từ trên xuống, rồi lặp cả bộ nếu trang còn dài.
 */
export function WeddingScrollingBackground({ urls, fallbackColor }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const plates = useMemo(() => urls.map((raw) => raw.trim()).filter(Boolean), [urls])
  const sequenceKey = plates.join('|')
  const [repeats, setRepeats] = useState(plates.length > 1 ? 2 : 4)

  useLayoutEffect(() => {
    const host = hostRef.current
    const parent = host?.parentElement
    if (!host || !parent || !sequenceKey) return

    const fit = () => {
      const need = parent.scrollHeight
      const sequence = host.querySelector('[data-bg-sequence]')
      const sequenceHeight = sequence instanceof HTMLElement ? sequence.clientHeight : 0
      if (sequenceHeight <= 0) return
      const next = Math.max(1, Math.ceil((need + 1) / sequenceHeight))
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
  }, [sequenceKey, repeats])

  if (!plates.length) return null

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: fallbackColor }}
    >
      <div className="flex w-full flex-col leading-none">
        {Array.from({ length: repeats }, (_, copy) => (
          <div key={`${copy}:${sequenceKey}`} data-bg-sequence={copy === 0 ? '' : undefined} className="flex w-full flex-col">
            {plates.map((url, index) => (
              <img
                key={`${copy}:${index}:${url}`}
                src={url}
                alt=""
                draggable={false}
                decoding={copy === 0 && index === 0 ? 'sync' : 'async'}
                className="block h-auto w-full max-w-none select-none"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
