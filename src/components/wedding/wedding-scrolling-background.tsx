'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

type Props = {
  urls: string[]
  fallbackColor: string
}

/** Phần đỉnh tấm sau chồng lên đáy tấm trước, để vạch nối không thành một đường cắt. */
const SEAM_RATIO = 0.3

function seamMask(ratio: number): string {
  const end = Math.round(ratio * 1000) / 10
  const soft = (end * 0.32).toFixed(1)
  const mid = (end * 0.66).toFixed(1)
  return `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.16) ${soft}%, rgba(0,0,0,0.58) ${mid}%, #000 ${end}%, #000 100%)`
}

/** Mờ mạnh ở giữa dải chồng, tan về hai phía, để họa tiết hai tấm không còn đọc được là một đường ghép. */
const SEAM_BLUR_MASK = 'linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)'

/**
 * Nền thiệp chỉ một ảnh đã chọn.
 * Các bản sao chồng mép và tan dần, không chèn ảnh khác.
 */
export function WeddingScrollingBackground({ urls, fallbackColor }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const url = useMemo(() => urls.map((raw) => raw.trim()).find(Boolean) || '', [urls])
  const [repeats, setRepeats] = useState(4)
  const [tileHeight, setTileHeight] = useState(0)
  const overlap = tileHeight > 0 ? Math.round(tileHeight * SEAM_RATIO) : 0
  const mask = overlap > 0 ? seamMask(SEAM_RATIO) : undefined

  useLayoutEffect(() => {
    const host = hostRef.current
    const parent = host?.parentElement
    if (!host || !parent || !url) return

    const fit = () => {
      const need = parent.scrollHeight
      const tile = host.querySelector('img')
      const height = tile?.clientHeight ?? 0
      if (height <= 0) return
      const seam = Math.round(height * SEAM_RATIO)
      const step = Math.max(1, height - seam)
      const next = Math.max(1, Math.ceil(Math.max(0, need - seam) / step))
      setRepeats((prev) => (prev === next ? prev : next))
      setTileHeight((prev) => (prev === height ? prev : height))
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
  }, [url, repeats, tileHeight])

  if (!url) return null

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: fallbackColor }}
    >
      <div className="flex w-full flex-col leading-none">
        {Array.from({ length: repeats }, (_, index) => {
          const joined = index > 0 && overlap > 0
          return (
            <div
              key={`${index}:${url}`}
              className="relative w-full"
              style={{ zIndex: index + 1, marginTop: joined ? -(overlap + 1) : 0 }}
            >
              <img
                src={url}
                alt=""
                draggable={false}
                decoding={index === 0 ? 'sync' : 'async'}
                className="block h-auto w-full max-w-none select-none"
                style={
                  joined
                    ? { WebkitMaskImage: mask, maskImage: mask, maskMode: 'alpha' }
                    : undefined
                }
              />
              {joined ? (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0"
                  style={{
                    height: overlap,
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    WebkitMaskImage: SEAM_BLUR_MASK,
                    maskImage: SEAM_BLUR_MASK,
                    maskMode: 'alpha',
                  }}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
