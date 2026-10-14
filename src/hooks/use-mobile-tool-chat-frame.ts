'use client'

import { useLayoutEffect, useState } from 'react'

export type MobileToolChatFrame = {
  top: number
  /** null: thanh đáy chưa có kích thước — giữ `bottom` trong class CSS, không ghi 0. */
  bottom: number | null
}

const MIN_DOCK_PX = 64
const KEYBOARD_LIFT_MIN_PX = 80

/**
 * Mobile chat giữa header và thanh đáy.
 * Nút Quay lại nằm trong header, mép trên khung là đáy header.
 * Thanh đáy là dynamic `ssr: false`, lần đo đầu thường chưa có nav.
 * `innerHeight - navTop` lúc đó ra 0 và ghi đè CSS, khung thụt xuống đè ô nhập.
 * Chỉ khi nav cao đủ mới gắn `bottom`. Bàn phím lấy khoảng visual viewport,
 * không cộng thêm chiều cao dock (dock đã nằm dưới bàn phím).
 */
export function mobileToolChatFrameFromBox(input: {
  mobile: boolean
  backBottomPx: number
  headerBottomPx?: number
  dockHeightPx: number
  layoutHeightPx: number
  visualOffsetTopPx: number
  visualHeightPx: number
}): MobileToolChatFrame | null {
  if (!input.mobile) return null
  const top = Math.max(0, Math.round(Math.max(input.backBottomPx, input.headerBottomPx ?? 0)))
  const dock = Number.isFinite(input.dockHeightPx) ? Math.ceil(input.dockHeightPx) : 0
  if (dock < MIN_DOCK_PX) return { top, bottom: null }
  const visualBottom = Math.max(0, input.visualOffsetTopPx) + Math.max(0, input.visualHeightPx)
  const overlap = Math.round(input.layoutHeightPx - visualBottom)
  const keyboard = overlap >= KEYBOARD_LIFT_MIN_PX ? overlap : 0
  return { top, bottom: Math.max(dock, keyboard) }
}

export function useMobileToolChatFrame(): MobileToolChatFrame | null {
  const [frame, setFrame] = useState<MobileToolChatFrame | null>(null)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null
    let raf = 0
    let tries = 0

    const read = (): MobileToolChatFrame | null => {
      if (!mq.matches) return null
      const header = document.querySelector('header')
      const back = document.querySelector('[data-creation-tool-back]')
      const nav = document.querySelector('nav.safe-area-pb')
      const vv = window.visualViewport
      const active = document.activeElement
      const fieldFocused =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      return mobileToolChatFrameFromBox({
        mobile: true,
        backBottomPx: back ? back.getBoundingClientRect().bottom : 0,
        headerBottomPx: header ? header.getBoundingClientRect().bottom : 0,
        dockHeightPx: nav ? nav.getBoundingClientRect().height : 0,
        layoutHeightPx: window.innerHeight,
        visualOffsetTopPx: fieldFocused ? (vv?.offsetTop ?? 0) : 0,
        visualHeightPx: fieldFocused ? (vv?.height ?? window.innerHeight) : window.innerHeight,
      })
    }

    const lockScroll = (locked: boolean) => {
      document.documentElement.style.overflow = locked ? 'hidden' : ''
      document.body.style.overflow = locked ? 'hidden' : ''
    }

    const sync = () => {
      const next = read()
      if (!next) {
        lockScroll(false)
        setFrame((prev) => (prev == null ? prev : null))
        return
      }
      lockScroll(true)
      setFrame((prev) => (prev && prev.top === next.top && prev.bottom === next.bottom ? prev : next))
      const nav = document.querySelector('nav.safe-area-pb')
      if (nav && ro) ro.observe(nav)
      if (next.bottom == null && tries < 40) {
        tries += 1
        window.cancelAnimationFrame(raf)
        raf = window.requestAnimationFrame(sync)
        return
      }
      if (mo && next.bottom != null) {
        mo.disconnect()
        mo = null
      }
    }

    if (mq.matches) window.scrollTo(0, 0)
    sync()

    ro = new ResizeObserver(() => sync())
    for (const selector of ['header', '[data-creation-tool-back]', 'nav.safe-area-pb']) {
      const node = document.querySelector(selector)
      if (node) ro.observe(node)
    }

    if (read()?.bottom == null) {
      mo = new MutationObserver(() => {
        tries = 0
        sync()
      })
      mo.observe(document.body, { childList: true, subtree: true })
    }

    const onViewport = () => {
      tries = 0
      sync()
    }
    mq.addEventListener('change', onViewport)
    window.addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('resize', onViewport)
    window.visualViewport?.addEventListener('scroll', onViewport)
    const onFocusOut = () => {
      window.requestAnimationFrame(() => {
        tries = 0
        sync()
      })
    }
    window.addEventListener('focusin', onViewport)
    window.addEventListener('focusout', onFocusOut)

    return () => {
      window.cancelAnimationFrame(raf)
      ro?.disconnect()
      mo?.disconnect()
      mq.removeEventListener('change', onViewport)
      window.removeEventListener('resize', onViewport)
      window.visualViewport?.removeEventListener('resize', onViewport)
      window.visualViewport?.removeEventListener('scroll', onViewport)
      window.removeEventListener('focusin', onViewport)
      window.removeEventListener('focusout', onFocusOut)
      lockScroll(false)
    }
  }, [])

  return frame
}
