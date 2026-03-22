'use client'

import { useEffect, useMemo, useState } from 'react'
import { PenLine } from 'lucide-react'

/** Hiệu ứng gõ từng chữ – chế độ tự chạy (trigger) hoặc điều khiển (visibleCount). showCursor: hiện bút chạy theo vị trí đang gõ */
export function AnimatedCharReveal({
  text,
  trigger,
  delayMs = 40,
  visibleCount: controlledVisibleCount,
  showCursor,
  /** Với `visibleCount` cố định: hiện bút khi chưa gõ ký tự nào (leader đầu slide). */
  penWhenEmpty,
}: {
  text: string
  trigger?: string | number
  delayMs?: number
  visibleCount?: number
  showCursor?: boolean
  penWhenEmpty?: boolean
}) {
  const segments = useMemo(() => {
    const out: Array<{ type: 'char'; value: string } | { type: 'br' }> = []
    for (const c of text) {
      if (c === '\n') out.push({ type: 'br' })
      else out.push({ type: 'char', value: c })
    }
    return out
  }, [text])
  const [internalCount, setInternalCount] = useState(0)

  useEffect(() => {
    if (controlledVisibleCount != null) return
    setInternalCount(0)
    if (segments.length === 0) return
    const start = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const elapsed = now - start
      const next = Math.min(Math.floor(elapsed / delayMs) + 1, segments.length)
      setInternalCount(next)
      if (next < segments.length) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [trigger, delayMs, segments.length, controlledVisibleCount])

  const visibleCount = controlledVisibleCount ?? internalCount
  const isTyping = visibleCount > 0 && visibleCount < segments.length
  const showPen =
    !!showCursor &&
    segments.length > 0 &&
    visibleCount < segments.length &&
    (isTyping || (!!penWhenEmpty && controlledVisibleCount != null && visibleCount === 0))

  return (
    <span>
      {segments.slice(0, visibleCount).map((seg, i) =>
        seg.type === 'br' ? (
          <br key={i} />
        ) : (
          <span
            key={i}
            className="inline align-baseline animate-in fade-in duration-75"
            style={{ animationTimingFunction: 'ease-out', animationFillMode: 'forwards' }}
          >
            {seg.value}
          </span>
        )
      )}
      {showPen && (
        <span className="inline-flex align-baseline ml-1 animate-write" aria-hidden>
          <PenLine className="h-4 w-4 text-violet-600 drop-shadow-sm" strokeWidth={2.5} />
        </span>
      )}
    </span>
  )
}
