'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

function computeBottomOverlapPx(vv: VisualViewport): number {
  const visualBottom = vv.offsetTop + vv.height
  const ih = window.innerHeight
  const doc = document.documentElement
  const clientH = typeof doc?.clientHeight === 'number' && doc.clientHeight > 0 ? doc.clientHeight : ih

  /** Khoảng từ đáy layout viewport tới đáy visual viewport (bàn phím / thanh hệ thống). */
  const fromInner = Math.max(0, ih - visualBottom)
  /** Fallback khi `innerHeight` lệch so với `clientHeight` (một số WebView / Facebook in-app). */
  const fromClient = Math.max(0, clientH - visualBottom)

  return Math.round(Math.max(fromInner, fromClient))
}

/**
 * Khoảng bị che giữa đáy layout viewport và đáy visual viewport (thường do bàn phím ảo).
 * Dùng cho `position: fixed; bottom: N` hoặc `translateY(-N)` để đẩy thanh nhập lên trên bàn phím.
 */
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = computeBottomOverlapPx(vv)
        setInset((prev) => (prev === next ? prev : next))
      })
    }

    const stopPoll = () => {
      if (pollRef.current != null) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    const startPoll = () => {
      stopPoll()
      let ticks = 0
      pollRef.current = setInterval(() => {
        update()
        ticks += 1
        if (ticks >= 45) stopPoll()
      }, 120)
    }

    const onFocusIn = (ev: Event) => {
      const t = ev.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        update()
        startPoll()
      }
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.addEventListener('focusin', onFocusIn)
    /** Một số WebView chỉ cập nhật visualViewport sau cảm ứng / focus. */
    window.addEventListener('touchstart', update, { passive: true, capture: true })

    return () => {
      stopPoll()
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('touchstart', update, { capture: true })
    }
  }, [])

  return inset
}

/**
 * Chiều cao visual viewport — ép khung chat (layout hẹp) khớp vùng còn nhìn thấy khi bàn phím mở.
 * Kết hợp thanh nhập **trong luồng flex** (không `fixed`) để ô nhập luôn nằm trên bàn phím, không phụ thuộc `bottom: N` (WebView hay sai).
 */
export function useVisualViewportShellHeightPx(): number | null {
  const [h, setH] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useLayoutEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      setH(Math.round(window.innerHeight))
      return
    }

    let raf = 0
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = Math.round(vv.height)
        setH((prev) => (prev === next ? prev : next))
      })
    }

    const stopPoll = () => {
      if (pollRef.current != null) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    const startPoll = () => {
      stopPoll()
      let ticks = 0
      pollRef.current = setInterval(() => {
        sync()
        ticks += 1
        if (ticks >= 50) stopPoll()
      }, 100)
    }

    const onFocusIn = (ev: Event) => {
      const t = ev.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        sync()
        startPoll()
      }
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('touchstart', sync, { passive: true, capture: true })

    return () => {
      stopPoll()
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('touchstart', sync, { capture: true })
    }
  }, [])

  return h
}
