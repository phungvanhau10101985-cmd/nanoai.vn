'use client'

import { useMemo } from 'react'

type Props = {
  urls: string[]
  fallbackColor: string
}

/**
 * Xếp ảnh nền từ trên xuống, đúng tỉ lệ, nối mép nhau.
 * Mỗi ảnh một lần. Phần thiệp dài hơn thì để màu nền, không lặp lại tấm đỏ phía dưới.
 */
export function WeddingScrollingBackground({ urls, fallbackColor }: Props) {
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

  if (clean.length === 0) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: fallbackColor }}
    >
      <div className="flex w-full flex-col leading-none">
        {clean.map((url, index) => (
          <img
            key={url}
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
