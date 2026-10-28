'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

type Props = {
  urls: string[]
  fallbackColor: string
}

/** Số lần lặp bộ nền để kín phần nội dung, không kéo trang dài hơn nội dung. */
export function weddingBackgroundRepeatCount(contentHeight: number, sequenceHeight: number) {
  if (sequenceHeight <= 0 || contentHeight <= 0) return 1
  return Math.max(1, Math.ceil(contentHeight / sequenceHeight))
}

/** Chiều cao các khối chữ. Bỏ nền và hoa văn (absolute) kẻo ảnh nền tự kéo trang. */
export function weddingFlowBottom(parent: HTMLElement, host: HTMLElement) {
  let bottom = 0
  for (const node of parent.children) {
    if (!(node instanceof HTMLElement) || node === host) continue
    const pos = getComputedStyle(node).position
    if (pos === 'absolute' || pos === 'fixed') continue
    const margin = Number.parseFloat(getComputedStyle(node).marginBottom) || 0
    bottom = Math.max(bottom, node.offsetTop + node.offsetHeight + margin)
  }
  return Math.ceil(bottom)
}

/**
 * Một ảnh thì lặp ảnh đó cho kín phần chữ.
 * Một bộ ảnh thì xếp lần lượt, rồi lặp cả bộ nếu nội dung còn dài.
 * Hết chữ thì hết nền — ảnh không được kéo trang xuống thêm.
 */
export function WeddingScrollingBackground({ urls, fallbackColor }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const plates = useMemo(() => urls.map((raw) => raw.trim()).filter(Boolean), [urls])
  const sequenceKey = plates.join('|')
  const [repeats, setRepeats] = useState(1)

  useLayoutEffect(() => {
    const host = hostRef.current
    const parent = host?.parentElement
    if (!host || !parent || !sequenceKey) return

    const fit = () => {
      const need = weddingFlowBottom(parent, host)
      if (need < 1) return
      // Ảnh nền absolute không được kéo khối chữ. Khóa đúng chiều cao chữ rồi cắt phần dư.
      if (getComputedStyle(parent).overflow === 'visible') parent.style.overflow = 'clip'
      if (parent.style.height !== `${need}px`) parent.style.height = `${need}px`
      host.style.top = '0px'
      host.style.right = '0px'
      host.style.bottom = 'auto'
      host.style.left = '0px'
      host.style.height = `${need}px`
      host.style.maxHeight = `${need}px`
      const sequence = host.querySelector('[data-bg-sequence]')
      const sequenceHeight = sequence instanceof HTMLElement ? sequence.offsetHeight : 0
      const next = weddingBackgroundRepeatCount(need, sequenceHeight)
      setRepeats((prev) => (prev === next ? prev : next))
    }

    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    for (const node of parent.children) {
      if (node instanceof HTMLElement && node !== host) observer.observe(node)
    }
    host.addEventListener('load', fit, true)
    fit()
    const frame = requestAnimationFrame(fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      host.removeEventListener('load', fit, true)
      parent.style.height = ''
      parent.style.overflow = ''
      host.style.height = ''
      host.style.maxHeight = ''
      host.style.bottom = ''
    }
  }, [sequenceKey, repeats])

  if (!plates.length) return null

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
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
