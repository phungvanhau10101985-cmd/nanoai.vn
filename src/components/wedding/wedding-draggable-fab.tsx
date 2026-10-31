'use client'

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer'
import { cn } from '@/lib/utils'

type Norm = { nx: number; ny: number }
type Insets = { top: number; right: number; bottom: number; left: number }
type ViewportBox = {
  width: number
  height: number
  offsetLeft: number
  offsetTop: number
  insets: Insets
  dock: number
}

const DRAG_THRESHOLD_PX = 10
const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function readSafeInsets(): Insets {
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'visibility:hidden',
    'pointer-events:none',
    'border-style:solid',
    'border-color:transparent',
    'border-top-width:env(safe-area-inset-top,0px)',
    'border-right-width:env(safe-area-inset-right,0px)',
    'border-bottom-width:env(safe-area-inset-bottom,0px)',
    'border-left-width:env(safe-area-inset-left,0px)',
  ].join(';')
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const insets = {
    top: parseFloat(style.borderTopWidth) || 0,
    right: parseFloat(style.borderRightWidth) || 0,
    bottom: parseFloat(style.borderBottomWidth) || 0,
    left: parseFloat(style.borderLeftWidth) || 0,
  }
  probe.remove()
  return insets
}

function readDockHeight() {
  const bar = document.querySelector('nav.fixed.safe-area-pb')
  if (!(bar instanceof HTMLElement)) return 0
  const height = bar.getBoundingClientRect().height
  return height > 8 ? height + 8 : 0
}

function readViewportBox(insets: Insets, dock: number): ViewportBox {
  const vv = window.visualViewport
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetLeft: vv?.offsetLeft ?? 0,
    offsetTop: vv?.offsetTop ?? 0,
    insets,
    dock,
  }
}

function buttonSize(el: HTMLElement | null) {
  return {
    width: el?.offsetWidth || 148,
    height: el?.offsetHeight || 44,
  }
}

function axisRange(box: ViewportBox, size: number, startInset: number, endInset: number) {
  const min = 8 + startInset
  const max = Math.max(min, box.width - size - 8 - endInset)
  return { min, max }
}

function yRange(box: ViewportBox, height: number) {
  const min = 8 + box.insets.top
  const bottomGap = box.dock > 0 ? box.dock : box.insets.bottom
  const max = Math.max(min, box.height - height - 8 - bottomGap)
  return { min, max }
}

function normToPixel(norm: Norm, box: ViewportBox, el: HTMLElement | null) {
  const size = buttonSize(el)
  const xAxis = axisRange(box, size.width, box.insets.left, box.insets.right)
  const yAxis = yRange(box, size.height)
  return {
    x: xAxis.min + clamp01(norm.nx) * (xAxis.max - xAxis.min),
    y: yAxis.min + clamp01(norm.ny) * (yAxis.max - yAxis.min),
  }
}

function pixelToNorm(x: number, y: number, box: ViewportBox, el: HTMLElement | null): Norm {
  const size = buttonSize(el)
  const xAxis = axisRange(box, size.width, box.insets.left, box.insets.right)
  const yAxis = yRange(box, size.height)
  const xSpan = xAxis.max - xAxis.min || 1
  const ySpan = yAxis.max - yAxis.min || 1
  return {
    nx: clamp01((x - xAxis.min) / xSpan),
    ny: clamp01((y - yAxis.min) / ySpan),
  }
}

function readStoredNorm(key: string): Norm | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Norm & { v?: number; x?: number; y?: number }>
    if (parsed.v === 2 && typeof parsed.nx === 'number' && typeof parsed.ny === 'number') {
      return { nx: clamp01(parsed.nx), ny: clamp01(parsed.ny) }
    }
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      const box = readViewportBox(readSafeInsets(), 0)
      return pixelToNorm(parsed.x, parsed.y, box, null)
    }
    return null
  } catch {
    return null
  }
}

function writeStoredNorm(key: string, norm: Norm) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: 2, nx: norm.nx, ny: norm.ny }))
  } catch {
    /* Bộ nhớ đầy thì nút vẫn kéo được trong phiên này. */
  }
}

const DESKTOP_MQ = '(min-width: 1024px)'

function cornerNorm(corner: 'bottom-left' | 'top-left' | 'top-right'): Norm {
  if (corner === 'bottom-left') return { nx: 0, ny: 1 }
  if (corner === 'top-right') return { nx: 1, ny: 0 }
  return { nx: 0, ny: 0 }
}

function isDesktopViewport() {
  return window.matchMedia(DESKTOP_MQ).matches
}

function readSiteHeaderBottom() {
  const header = document.querySelector('header[data-nanoai-chrome]')
  if (header instanceof HTMLElement) {
    const bottom = header.getBoundingClientRect().bottom
    if (bottom > 8) return bottom
  }
  return 64
}

/** Desktop: mép trái, ngay dưới header — không chìm ở đáy màn hình. */
function belowHeaderNorm(box: ViewportBox, el: HTMLElement | null): Norm {
  const clearBox = { ...box, dock: 0 }
  return pixelToNorm(8 + box.insets.left, readSiteHeaderBottom() + 12, clearBox, el)
}

/** Desktop: ngay dưới header, sát phải cột menu — đầu vùng làm việc, không đáy màn hình. */
function workColumnNorm(box: ViewportBox, el: HTMLElement | null): Norm {
  const clearBox = { ...box, dock: 0 }
  const size = buttonSize(el)
  const y = readSiteHeaderBottom() + 16
  const sidebar = document.querySelector('[data-creation-sidebar]')
  let x = 16 + box.insets.left
  if (sidebar instanceof HTMLElement) {
    const right = sidebar.getBoundingClientRect().right
    if (right > 48) x = right + 16
  }
  const maxX = Math.max(8 + box.insets.left, box.width - size.width - 16 - box.insets.right)
  return pixelToNorm(Math.min(x, maxX), y, clearBox, el)
}

/** Thanh sửa nổi. Kéo cả thanh; cú bấm ngắn trên nút vẫn là bấm. */
export function WeddingDraggableChrome(props: {
  storageKey: string
  defaultCorner: 'bottom-left' | 'top-left' | 'top-right'
  hidden?: boolean
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const suppressClickRef = useRef(false)
  const hiddenRef = useRef(props.hidden)
  hiddenRef.current = props.hidden
  const posRef = useRef<Norm>(cornerNorm(props.defaultCorner))
  const metricsRef = useRef<{ insets: Insets; dock: number }>({ insets: ZERO_INSETS, dock: 0 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  const refreshMetrics = () => {
    metricsRef.current = { insets: readSafeInsets(), dock: 0 }
  }
  const currentBox = () => readViewportBox(metricsRef.current.insets, metricsRef.current.dock)
  const place = (norm: Norm) => {
    const el = panelRef.current
    if (!el) return
    const box = currentBox()
    const pixel = normToPixel(norm, box, el)
    el.style.transform = `translate3d(${box.offsetLeft + pixel.x}px, ${box.offsetTop + pixel.y}px, 0)`
  }
  const paintHidden = () => {
    const el = panelRef.current
    if (!el) return
    el.style.visibility = hiddenRef.current ? 'hidden' : 'visible'
    el.style.pointerEvents = hiddenRef.current ? 'none' : 'auto'
  }

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    refreshMetrics()
    const stored = readStoredNorm(props.storageKey)
    const initial = stored ?? cornerNorm(props.defaultCorner)
    posRef.current = initial
    place(initial)
    paintHidden()
    const onResize = () => {
      refreshMetrics()
      place(posRef.current)
    }
    const vv = window.visualViewport
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onResize)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    const blockScroll = (event: TouchEvent) => {
      if (dragRef.current?.moved && event.cancelable) event.preventDefault()
    }
    const el = panelRef.current
    el?.addEventListener('touchmove', blockScroll, { passive: false })
    return () => {
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onResize)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      el?.removeEventListener('touchmove', blockScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, props.defaultCorner, props.storageKey])

  useLayoutEffect(() => {
    paintHidden()
  }, [props.hidden])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (props.hidden || event.button !== 0) return
    const origin = normToPixel(posRef.current, currentBox(), panelRef.current)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    }
    const move = (next: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== next.pointerId) return
      const dx = next.clientX - drag.startX
      const dy = next.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      drag.moved = true
      posRef.current = pixelToNorm(drag.originX + dx, drag.originY + dy, currentBox(), panelRef.current)
      place(posRef.current)
    }
    const up = (next: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const drag = dragRef.current
      if (!drag || drag.pointerId !== next.pointerId) return
      dragRef.current = null
      if (!drag.moved) return
      suppressClickRef.current = true
      writeStoredNorm(props.storageKey, posRef.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  if (!mounted) return null

  return createPortal(
    <div
      ref={panelRef}
      data-wedding-host-chrome=""
      aria-hidden={props.hidden || undefined}
      className={cn('fixed left-0 top-0 cursor-grab touch-none select-none active:cursor-grabbing', props.className)}
      style={{ zIndex: 94, visibility: 'hidden', transform: 'translate3d(0,0,0)' }}
      onPointerDown={onPointerDown}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return
        suppressClickRef.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {props.children}
    </div>,
    document.body,
  )
}

export function WeddingDraggableFab(props: {
  label: string
  storageKey: string
  defaultCorner: 'bottom-left' | 'top-left'
  /** Màn rộng: neo dưới header, mép trái. Điện thoại giữ `defaultCorner`. Kéo thả vẫn ghi nhớ. */
  desktopBelowHeader?: boolean
  /** Màn rộng: neo dưới header, sát phải cột menu. Điện thoại giữ `defaultCorner`. */
  desktopWorkColumn?: boolean
  onClick: () => void
  disabled?: boolean
  hidden?: boolean
  icon?: ReactNode
  className?: string
  zIndex?: number
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const suppressClickRef = useRef(false)
  const hiddenRef = useRef(props.hidden)
  hiddenRef.current = props.hidden
  const posRef = useRef<Norm>({ nx: 0, ny: props.defaultCorner === 'bottom-left' ? 1 : 0 })
  const userPlacedRef = useRef(false)
  const metricsRef = useRef<{ insets: Insets; dock: number }>({ insets: ZERO_INSETS, dock: 0 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const [mounted, setMounted] = useState(false)

  const refreshMetrics = () => {
    metricsRef.current = {
      insets: readSafeInsets(),
      dock: props.defaultCorner === 'bottom-left' ? readDockHeight() : 0,
    }
  }

  const currentBox = () => readViewportBox(metricsRef.current.insets, metricsRef.current.dock)

  const place = (norm: Norm) => {
    const el = buttonRef.current
    if (!el) return
    const box = currentBox()
    const pixel = normToPixel(norm, box, el)
    el.style.transform = `translate3d(${box.offsetLeft + pixel.x}px, ${box.offsetTop + pixel.y}px, 0)`
  }

  const desktopDocked = () =>
    isDesktopViewport() && (props.desktopWorkColumn || props.desktopBelowHeader)

  const fallbackNorm = () => {
    const box = currentBox()
    if (props.desktopWorkColumn && isDesktopViewport()) return workColumnNorm(box, buttonRef.current)
    if (props.desktopBelowHeader && isDesktopViewport()) return belowHeaderNorm(box, buttonRef.current)
    return { nx: 0, ny: props.defaultCorner === 'bottom-left' ? 1 : 0 }
  }

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    refreshMetrics()
    const stored = readStoredNorm(props.storageKey)
    userPlacedRef.current = stored != null
    const initial = stored ?? fallbackNorm()
    posRef.current = initial
    place(initial)
    const el = buttonRef.current
    if (el) el.style.visibility = hiddenRef.current ? 'hidden' : 'visible'

    const onResize = () => {
      refreshMetrics()
      if (!userPlacedRef.current) posRef.current = fallbackNorm()
      place(posRef.current)
    }
    const onScroll = () => {
      if (dragRef.current) {
        place(posRef.current)
        return
      }
      if (!userPlacedRef.current && desktopDocked()) {
        posRef.current = fallbackNorm()
      }
      place(posRef.current)
    }
    const vv = window.visualViewport
    const desktopMq = window.matchMedia(DESKTOP_MQ)
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    desktopMq.addEventListener('change', onResize)

    const blockScroll = (event: TouchEvent) => {
      if (dragRef.current?.moved) event.preventDefault()
    }
    el?.addEventListener('touchmove', blockScroll, { passive: false })

    return () => {
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      desktopMq.removeEventListener('change', onResize)
      el?.removeEventListener('touchmove', blockScroll)
    }
    // place đọc ref và DOM, không cần đưa vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, props.defaultCorner, props.desktopBelowHeader, props.desktopWorkColumn, props.storageKey])

  useLayoutEffect(() => {
    const el = buttonRef.current
    if (!el || !mounted) return
    el.style.visibility = props.hidden ? 'hidden' : 'visible'
  }, [mounted, props.hidden])

  const endDrag = (event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const el = buttonRef.current
    if (el) el.style.willChange = ''
    if (!drag.moved) return
    suppressClickRef.current = true
    userPlacedRef.current = true
    writeStoredNorm(props.storageKey, posRef.current)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (props.hidden || props.disabled || event.button !== 0) return
    const origin = normToPixel(posRef.current, currentBox(), buttonRef.current)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    }
    const move = (next: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== next.pointerId) return
      const dx = next.clientX - drag.startX
      const dy = next.clientY - drag.startY
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      if (!drag.moved && buttonRef.current) buttonRef.current.style.willChange = 'transform'
      drag.moved = true
      posRef.current = pixelToNorm(drag.originX + dx, drag.originY + dy, currentBox(), buttonRef.current)
      place(posRef.current)
    }
    const up = (next: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      endDrag(next)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  if (!mounted) return null

  return createPortal(
    <DismissableLayerBranch asChild>
      <button
        ref={buttonRef}
        type="button"
        disabled={props.disabled}
        data-wedding-host-chrome=""
        aria-hidden={props.hidden || undefined}
        aria-label={props.label}
        className={cn(
          'pointer-events-auto fixed left-0 top-0 flex min-h-11 items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-900 shadow-lg select-none',
          'cursor-grab active:cursor-grabbing',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2',
          props.disabled && 'cursor-default opacity-70',
          props.className,
        )}
        style={{
          zIndex: props.zIndex ?? 96,
          visibility: 'hidden',
          pointerEvents: props.hidden ? 'none' : 'auto',
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transform: 'translate3d(0,0,0)',
        }}
        onPointerDown={onPointerDown}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          if (props.disabled) return
          props.onClick()
        }}
      >
        {props.icon}
        <span>{props.label}</span>
      </button>
    </DismissableLayerBranch>,
    document.body,
  )
}
