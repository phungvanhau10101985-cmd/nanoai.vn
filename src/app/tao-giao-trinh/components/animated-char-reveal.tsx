'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

function parseCssColor(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:(?:[,\s/]+)([\d.]+%?))?\s*\)/)
  if (!m) return null
  const alpha = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), alpha]
}

/** Màu đặc phía sau chữ, để màng che trùng nền thẻ (trắng học sinh, tối giáo viên). */
function solidBacking(start: HTMLElement | null): string {
  const layers: [number, number, number, number][] = []
  let node = start
  while (node && layers.length < 8) {
    const parsed = parseCssColor(getComputedStyle(node).backgroundColor)
    if (parsed && parsed[3] > 0.01) layers.push(parsed)
    if (parsed && parsed[3] >= 0.98) break
    node = node.parentElement
  }
  if (layers.length === 0) return 'rgb(255, 255, 255)'
  let r = layers[layers.length - 1][0]
  let g = layers[layers.length - 1][1]
  let b = layers[layers.length - 1][2]
  for (let i = layers.length - 2; i >= 0; i--) {
    const [fr, fg, fb, fa] = layers[i]
    r = fr * fa + r * (1 - fa)
    g = fg * fa + g * (1 - fa)
    b = fb * fa + b * (1 - fa)
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function caretRect(textNode: Text, index: number): DOMRect | null {
  const len = textNode.data.length
  if (len === 0) return null
  const doc = textNode.ownerDocument
  const range = doc.createRange()
  const start = Math.max(0, Math.min(len - 1, index))
  for (let i = start; i < len; i++) {
    range.setStart(textNode, i)
    range.setEnd(textNode, i + 1)
    const box = range.getClientRects()[0]
    if (box && box.height >= 1 && box.width >= 0.4) return box
  }
  range.setStart(textNode, len - 1)
  range.setEnd(textNode, len)
  return range.getClientRects()[0] ?? null
}

/**
 * Cả đoạn nằm một text node, không đổi khi gõ.
 * Phần chưa gõ bị che bằng màu nền — đổi visibility từng chữ làm thẻ học sinh nháy.
 * Bút đặt tuyệt đối, không chen vào dòng.
 */
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
  /** Giáo viên: chữ chưa gõ vẫn hiện, đúng lớp màu này. Học sinh không truyền — che kín. */
  pendingClassName?: string
  breakBefore?: readonly number[]
  showPen?: boolean
  className?: string
}) {
  const units = useMemo(() => text.length, [text])
  const [internalCount, setInternalCount] = useState(0)
  const rootRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const maskRef = useRef<HTMLSpanElement>(null)
  const sharpRef = useRef<HTMLSpanElement>(null)
  const penRef = useRef<HTMLSpanElement>(null)
  const maskTextRef = useRef('')
  const floorRef = useRef({ text: '', n: 0, low: 0 })

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
  if (floorRef.current.text !== text) floorRef.current = { text, n: 0, low: 0 }
  if (requested < floorRef.current.n) {
    floorRef.current.low += 1
    if (floorRef.current.low >= 8) floorRef.current.n = requested
  } else {
    floorRef.current.low = 0
    floorRef.current.n = requested
  }
  const dimPending = !!pendingClassName
  const shown = dimPending ? requested : floorRef.current.n
  const penOn =
    !!showCursor &&
    units > 0 &&
    shown < units &&
    (shown > 0 || (!!penWhenEmpty && controlledVisibleCount != null))

  useLayoutEffect(() => {
    const root = rootRef.current
    const textEl = textRef.current
    const mask = maskRef.current
    const sharp = sharpRef.current
    const pen = penRef.current
    if (!root || !textEl || !pen) return
    if (!dimPending && !mask) return
    if (dimPending && !sharp) return
    const place = () => {
      const node = textEl.firstChild
      const textNode = node && node.nodeType === Node.TEXT_NODE ? (node as Text) : null
      if (mask && maskTextRef.current !== text) {
        maskTextRef.current = text
        mask.dataset.bg = ''
      }
      const len = textNode?.data.length ?? 0
      const caret = Math.max(0, Math.min(shown, len))
      const done = len === 0 || caret >= len
      if (dimPending && sharp) {
        if (mask) mask.style.visibility = 'hidden'
        if (!textNode || done) {
          sharp.style.visibility = done ? 'visible' : 'hidden'
          sharp.style.clipPath = 'none'
        } else {
          const box = caretRect(textNode, caret)
          const rootBox = root.getBoundingClientRect()
          if (!box || rootBox.width < 1) {
            sharp.style.visibility = 'hidden'
          } else {
            const x = Math.max(0, box.left - rootBox.left)
            const y = Math.max(0, box.top - rootBox.top)
            const h = box.height >= 1 ? box.height : 28
            sharp.style.visibility = 'visible'
            sharp.style.clipPath = `polygon(0px 0px, 100% 0px, 100% ${y}px, ${x}px ${y}px, ${x}px ${y + h}px, 0px ${y + h}px)`
          }
        }
      } else if (mask) {
        if (!textNode || done) {
          mask.style.visibility = 'hidden'
        } else {
          const box = caretRect(textNode, caret)
          const rootBox = root.getBoundingClientRect()
          if (mask.dataset.bg !== '1') {
            mask.style.backgroundColor = solidBacking(textEl)
            mask.style.transform = 'translateZ(0)'
            mask.dataset.bg = '1'
          }
          if (!box || rootBox.width < 1) {
            mask.style.visibility = 'visible'
            mask.style.clipPath = 'polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%)'
          } else {
            const x = Math.max(0, box.left - rootBox.left)
            const y = Math.max(0, box.top - rootBox.top)
            const h = box.height >= 1 ? box.height : 28
            mask.style.visibility = 'visible'
            mask.style.clipPath = `polygon(${x}px ${y}px, 100% ${y}px, 100% 100%, 0 100%, 0 ${y + h}px, ${x}px ${y + h}px)`
          }
        }
      }
      if (!penOn || !textNode) {
        pen.style.visibility = 'hidden'
        return
      }
      const box = caretRect(textNode, Math.min(shown, Math.max(0, len - 1)))
      const rootBox = root.getBoundingClientRect()
      if (!box) {
        pen.style.visibility = 'hidden'
        return
      }
      pen.style.visibility = 'visible'
      pen.style.transform = `translate(${Math.max(0, box.left - rootBox.left)}px, ${Math.max(0, box.top - rootBox.top)}px)`
    }
    place()
    const ro = new ResizeObserver(() => place())
    ro.observe(root)
    return () => ro.disconnect()
  }, [shown, penOn, text, dimPending])

  return (
    <span
      ref={rootRef}
      className={cn(
        'relative block w-full whitespace-pre-wrap break-words [font-kerning:none] [font-variant-ligatures:none]',
        className
      )}
      data-sync-char-reveal=""
    >
      <span ref={textRef} className={pendingClassName}>{text}</span>
      {dimPending ? (
        <span ref={sharpRef} aria-hidden className="pointer-events-none absolute inset-0 z-[1] whitespace-pre-wrap break-words [font-kerning:none] [font-variant-ligatures:none]">{text}</span>
      ) : (
        <span ref={maskRef} aria-hidden className="pointer-events-none absolute inset-0 z-[1]" />
      )}
      <span ref={penRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-[2] h-0 w-0">
        <PenLine className="h-4 w-4 -translate-y-0.5 animate-write text-violet-400" strokeWidth={2.5} />
      </span>
    </span>
  )
}
