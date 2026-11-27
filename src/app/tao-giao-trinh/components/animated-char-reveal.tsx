'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Cả câu là một text node. Không cắt khúc — ý sau (xuống dòng) bị cắt sẽ bẻ lại mỗi ký tự.
 * Học sinh: chữ đã gõ là màu thật. Phần chưa gõ tô trong suốt, không đổi khung.
 * Giáo viên: chữ chưa gõ mờ, phần đã gõ tô màu đậm. Cùng một Highlight, chỉ kéo range.
 */

const TYPED = 'pw-typed'
const UNTYPED = 'pw-untyped'

function highlightSupported(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined' && typeof Highlight !== 'undefined'
}

function paintRegistry(name: string): Highlight | null {
  if (!highlightSupported()) return null
  const found = CSS.highlights.get(name)
  if (found) return found
  const created = new Highlight()
  CSS.highlights.set(name, created)
  return created
}

function bindRange(name: string, range: Range) {
  const registry = paintRegistry(name)
  if (registry && !registry.has(range)) registry.add(range)
}

function unbindRange(name: string, range: Range | null) {
  if (!range || !highlightSupported()) return
  CSS.highlights.get(name)?.delete(range)
}

export function AnimatedCharReveal({
  text,
  trigger,
  delayMs = 40,
  visibleCount: controlledVisibleCount,
  showCursor,
  penWhenEmpty,
  pendingClassName,
  className,
}: {
  text: string
  trigger?: string | number
  delayMs?: number
  visibleCount?: number | null
  showCursor?: boolean
  penWhenEmpty?: boolean
  /** Giáo viên: màu chữ chưa gõ. Học sinh bỏ trống — phần chưa gõ trong suốt, phần đã gõ giữ màu chữ. */
  pendingClassName?: string
  breakBefore?: readonly number[]
  showPen?: boolean
  className?: string
}) {
  const units = useMemo(() => text.length, [text])
  const [internalCount, setInternalCount] = useState(0)
  const floorRef = useRef({ text: '', n: 0, low: 0 })
  const rootRef = useRef<HTMLSpanElement>(null)
  const penRef = useRef<HTMLSpanElement>(null)
  const rangeRef = useRef<Range | null>(null)
  const boundNameRef = useRef<string | null>(null)
  const penAtRef = useRef<{ index: number; x: number; y: number } | null>(null)
  const hideRest = !pendingClassName

  useLayoutEffect(() => {
    if (controlledVisibleCount != null) return
    setInternalCount(0)
    if (units === 0) return
    const start = performance.now()
    let rafId = 0
    const tick = (now: number) => {
      const next = Math.min(Math.floor((now - start) / delayMs) + 1, units)
      setInternalCount(next)
      if (next < units) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [trigger, delayMs, units, controlledVisibleCount])

  const requested =
    controlledVisibleCount != null ? Math.max(0, Math.min(units, controlledVisibleCount)) : internalCount
  if (floorRef.current.text !== text) {
    floorRef.current = { text, n: 0, low: 0 }
    penAtRef.current = null
  }
  if (requested < floorRef.current.n) {
    floorRef.current.low += 1
    if (floorRef.current.low >= 8) floorRef.current.n = requested
  } else {
    floorRef.current.low = 0
    floorRef.current.n = requested
  }
  const shown = hideRest ? floorRef.current.n : requested
  const penOn =
    !!showCursor &&
    units > 0 &&
    shown < units &&
    (shown > 0 || (!!penWhenEmpty && controlledVisibleCount != null))

  useLayoutEffect(() => {
    return () => {
      unbindRange(TYPED, rangeRef.current)
      unbindRange(UNTYPED, rangeRef.current)
      rangeRef.current = null
      boundNameRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const textNode = Array.from(root.childNodes).find(
      (node): node is Text => node.nodeType === Node.TEXT_NODE && node.data === text
    )
    const name = hideRest ? UNTYPED : TYPED
    if (boundNameRef.current && boundNameRef.current !== name) {
      unbindRange(boundNameRef.current, rangeRef.current)
      boundNameRef.current = null
    }
    if (!textNode || !highlightSupported()) return
    const len = textNode.data.length
    const end = Math.max(0, Math.min(shown, len))
    const cover = hideRest ? end < len : end > 0
    if (!cover) {
      unbindRange(name, rangeRef.current)
      boundNameRef.current = null
      return
    }
    let range = rangeRef.current
    if (!range || range.startContainer !== textNode) {
      unbindRange(name, range)
      range = document.createRange()
      rangeRef.current = range
    }
    try {
      if (hideRest) {
        range.setStart(textNode, end)
        range.setEnd(textNode, len)
      } else {
        if (!root.style.getPropertyValue('--pw-reveal-ink')) {
          const parent = root.parentElement
          if (parent) root.style.setProperty('--pw-reveal-ink', getComputedStyle(parent).color)
        }
        range.setStart(textNode, 0)
        range.setEnd(textNode, end)
      }
    } catch {
      return
    }
    bindRange(name, range)
    boundNameRef.current = name
  }, [text, shown, hideRest])

  useLayoutEffect(() => {
    const root = rootRef.current
    const pen = penRef.current
    if (!root || !pen) return
    if (!penOn) {
      pen.style.visibility = 'hidden'
      return
    }
    let raf = 0
    const place = () => {
      const textNode = Array.from(root.childNodes).find(
        (node): node is Text => node.nodeType === Node.TEXT_NODE && node.data === text
      )
      if (!textNode) {
        pen.style.visibility = 'hidden'
        return
      }
      const at = Math.max(0, Math.min(shown, textNode.data.length))
      const caret = document.createRange()
      try {
        caret.setStart(textNode, at)
        caret.setEnd(textNode, at)
      } catch {
        return
      }
      const list = caret.getClientRects()
      const box = list.length > 0 ? list[list.length - 1] : null
      if (!box || box.height < 2) return
      const host = root.getBoundingClientRect()
      const x = Math.round(box.left - host.left)
      const y = Math.round(box.top - host.top)
      const prev = penAtRef.current
      if (prev && shown >= prev.index) {
        const sameLine = Math.abs(y - prev.y) <= 3
        if (y < prev.y - 3) return
        if (sameLine && x < prev.x - 2) return
      }
      penAtRef.current = { index: shown, x, y }
      pen.style.visibility = 'visible'
      pen.style.transform = `translate(${x}px, ${y}px)`
    }
    raf = requestAnimationFrame(place)
    return () => cancelAnimationFrame(raf)
  }, [text, shown, penOn])

  return (
    <span
      ref={rootRef}
      className={cn(
        'relative block w-full whitespace-pre-wrap break-words [overflow-anchor:none] [font-kerning:none] [font-variant-ligatures:none]',
        pendingClassName,
        className
      )}
      data-sync-char-reveal=""
    >
      {text}<span ref={penRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 z-[1] h-0 w-0"><PenLine className="h-4 w-4 text-violet-400" strokeWidth={2.5} /></span>
    </span>
  )
}
