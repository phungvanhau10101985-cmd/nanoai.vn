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
  /** Chữ chưa gõ: giữ chỗ, không animate. Mặc định ẩn nhưng vẫn chiếm chỗ. */
  pendingClassName = 'invisible',
  /** Chỉ số ký tự (trong `text`) phải xuống dòng — khớp hàng với bên kia. */
  breakBefore,
}: {
  text: string
  trigger?: string | number
  delayMs?: number
  visibleCount?: number
  showCursor?: boolean
  penWhenEmpty?: boolean
  pendingClassName?: string
  breakBefore?: readonly number[]
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
  const breakAt = useMemo(() => new Set(breakBefore ?? []), [breakBefore])
  const isTyping = visibleCount > 0 && visibleCount < segments.length
  const showPen =
    !!showCursor &&
    segments.length > 0 &&
    visibleCount < segments.length &&
    (isTyping || (!!penWhenEmpty && controlledVisibleCount != null && visibleCount === 0))

  return (
    <span className="whitespace-pre-wrap" data-sync-char-reveal="">
      {segments.map((seg, i) => (
        <span key={i}>
          {showPen && i === visibleCount ? (
            <span className="relative inline-block w-0 align-baseline" aria-hidden>
              <PenLine className="absolute left-0 top-0 h-4 w-4 -translate-y-0.5 text-violet-400" strokeWidth={2.5} />
            </span>
          ) : null}
          {seg.type === 'br' || breakAt.has(i) ? <br /> : null}
          {seg.type === 'br' ? null : (
            <span className={i < visibleCount ? 'inline align-baseline' : `inline align-baseline ${pendingClassName}`}>
              {seg.value}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
