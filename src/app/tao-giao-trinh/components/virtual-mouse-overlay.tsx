'use client'

import { useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'

export type VirtualMouseController = {
  moveTo: (x: number, y: number, opts?: { snap?: boolean }) => void
  hide: () => void
  clearTrail: () => void
  pulseClick: (x: number, y: number) => void
}

type OverlayVariant = 'student' | 'teacher' | 'remote-student'

const VARIANT = {
  student: {
    zCursor: 220,
    zTrail: 218,
    zClick: 219,
    hotspotX: -4,
    hotspotY: -3,
    size: 28,
    fill: '#f97316',
    stroke: '#ffffff',
    strokeWidth: 2.4,
    innerStroke: '#111827',
    trail: 'rgba(249,115,22,0.55)',
    clickBorder: 'border-orange-400/90',
    showTrail: true,
    showInnerStroke: true,
    shadow: 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]',
  },
  teacher: {
    zCursor: 200,
    zTrail: 198,
    zClick: 199,
    hotspotX: -3.33,
    hotspotY: -3.33,
    size: 20,
    fill: 'white',
    stroke: 'rgba(0,0,0,0.6)',
    strokeWidth: 1.2,
    innerStroke: '',
    trail: 'rgba(255,200,100,0.55)',
    clickBorder: 'border-amber-300/90',
    showTrail: true,
    showInnerStroke: false,
    shadow: 'drop-shadow-lg',
  },
  'remote-student': {
    zCursor: 115,
    zTrail: 114,
    zClick: 116,
    hotspotX: -2,
    hotspotY: -2,
    size: 20,
    fill: 'rgba(34,197,94,0.9)',
    stroke: 'rgba(0,0,0,0.5)',
    strokeWidth: 1.2,
    innerStroke: '',
    trail: 'rgba(34,197,94,0.45)',
    clickBorder: 'border-emerald-400/90',
    showTrail: false,
    showInnerStroke: false,
    shadow: 'drop-shadow-lg',
  },
} as const

const TRAIL_MIN_STEP_PX = 1.2
const TRAIL_MAX = 96
const TRAIL_SNAP_PX = 80

function buildSmoothMouseTrailPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length < 2) return ''
  if (points.length === 2) {
    const [a, b] = points
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]
    const pn = points[i + 1]
    const xc = (p.x + pn.x) / 2
    const yc = (p.y + pn.y) / 2
    d += ` Q ${p.x} ${p.y} ${xc} ${yc}`
  }
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  d += ` Q ${prev.x} ${prev.y} ${last.x} ${last.y}`
  return d
}

function applyCursorTransform(
  el: HTMLElement | null,
  x: number,
  y: number,
  hotspotX: number,
  hotspotY: number,
) {
  if (!el) return
  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(${hotspotX}px, ${hotspotY}px)`
}

/**
 * Tối đa 1 lần map / frame, dùng đúng PointerEvent gốc (clientX/Y + target).
 * Không dựng lại event bằng elementFromPoint — tránh lệch neo chỉ.
 */
export function bindLatestPointerFrame(onMove: (e: PointerEvent) => void): (e: PointerEvent) => void {
  let locked = false
  return (e: PointerEvent) => {
    if (locked) return
    locked = true
    onMove(e)
    requestAnimationFrame(() => {
      locked = false
    })
  }
}

export function VirtualMouseOverlay({
  variant,
  controllerRef,
}: {
  variant: OverlayVariant
  controllerRef: MutableRefObject<VirtualMouseController | null>
}) {
  const theme = VARIANT[variant]
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const trailPathRef = useRef<SVGPathElement | null>(null)
  const trailSvgRef = useRef<SVGSVGElement | null>(null)
  const displayRef = useRef<{ x: number; y: number } | null>(null)
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const visibleRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  const [clicks, setClicks] = useState<Array<{ id: number; x: number; y: number }>>([])

  const setVisible = (on: boolean) => {
    visibleRef.current = on
    const opacity = on ? '1' : '0'
    if (cursorRef.current) cursorRef.current.style.opacity = opacity
    if (trailSvgRef.current) trailSvgRef.current.style.opacity = on && trailRef.current.length > 1 ? '1' : '0'
  }

  const paintTrail = () => {
    const path = trailPathRef.current
    const svg = trailSvgRef.current
    if (!path || !svg) return
    const pts = trailRef.current
    if (!theme.showTrail || pts.length < 2) {
      path.setAttribute('d', '')
      svg.style.opacity = '0'
      return
    }
    path.setAttribute('d', buildSmoothMouseTrailPath(pts))
    svg.style.opacity = visibleRef.current ? '1' : '0'
  }

  const paintCursor = (x: number, y: number) => {
    applyCursorTransform(cursorRef.current, x, y, theme.hotspotX, theme.hotspotY)
  }

  const pushTrail = (x: number, y: number, reset: boolean) => {
    if (!theme.showTrail) return
    if (reset) {
      trailRef.current = [{ x, y }]
      paintTrail()
      return
    }
    const last = trailRef.current[trailRef.current.length - 1]
    if (last && Math.hypot(x - last.x, y - last.y) < TRAIL_MIN_STEP_PX) return
    trailRef.current = [...trailRef.current, { x, y }].slice(-TRAIL_MAX)
    paintTrail()
  }

  useLayoutEffect(() => {
    const api: VirtualMouseController = {
      moveTo(x, y, opts) {
        const prev = displayRef.current
        const jumpPx = prev ? Math.hypot(x - prev.x, y - prev.y) : 0
        const snap = Boolean(opts?.snap) || !prev || jumpPx > TRAIL_SNAP_PX
        displayRef.current = { x, y }
        paintCursor(x, y)
        setVisible(true)
        pushTrail(x, y, snap)
      },
      hide() {
        displayRef.current = null
        trailRef.current = []
        paintTrail()
        setVisible(false)
      },
      clearTrail() {
        trailRef.current = displayRef.current ? [{ ...displayRef.current }] : []
        paintTrail()
      },
      pulseClick(x, y) {
        const id = Date.now() + Math.floor(Math.random() * 1000)
        setClicks((prev) => [...prev, { id, x, y }].slice(-5))
        window.setTimeout(() => {
          setClicks((prev) => prev.filter((p) => p.id !== id))
        }, 450)
      },
    }
    controllerRef.current = api
    return () => {
      if (controllerRef.current === api) controllerRef.current = null
    }
    // controllerRef ổn định theo đời overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerRef, theme.hotspotX, theme.hotspotY, theme.showTrail])

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    const d = displayRef.current
    if (!d) return
    applyCursorTransform(cursorRef.current, d.x, d.y, theme.hotspotX, theme.hotspotY)
    if (cursorRef.current) cursorRef.current.style.opacity = '1'
    visibleRef.current = true
    const path = trailPathRef.current
    const svg = trailSvgRef.current
    if (path && svg && theme.showTrail && trailRef.current.length > 1) {
      path.setAttribute('d', buildSmoothMouseTrailPath(trailRef.current))
      svg.style.opacity = '1'
    }
  }, [mounted, theme.hotspotX, theme.hotspotY, theme.showTrail])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <>
      {theme.showTrail && (
        <svg
          ref={trailSvgRef}
          className="pointer-events-none fixed inset-0"
          style={{
            width: '100%',
            height: '100%',
            zIndex: theme.zTrail,
            opacity: 0,
            willChange: 'opacity',
          }}
        >
          <path
            ref={trailPathRef}
            d=""
            fill="none"
            stroke={theme.trail}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div
        ref={cursorRef}
        className={`pointer-events-none fixed left-0 top-0 ${theme.shadow}`}
        style={{
          zIndex: theme.zCursor,
          opacity: 0,
          willChange: 'transform',
          transform: 'translate3d(-64px, -64px, 0)',
        }}
      >
        <svg width={theme.size} height={theme.size} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4l7 16 2.5-6 5.5-2.5L4 4z"
            fill={theme.fill}
            stroke={theme.stroke}
            strokeWidth={theme.strokeWidth}
            strokeLinejoin="round"
          />
          {theme.showInnerStroke ? (
            <path
              d="M4 4l7 16 2.5-6 5.5-2.5L4 4z"
              fill="none"
              stroke={theme.innerStroke}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>
      {clicks.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed"
          style={{
            left: p.x,
            top: p.y,
            transform: 'translate(-50%, -50%)',
            zIndex: theme.zClick,
          }}
        >
          <span className={`block h-12 w-12 rounded-full border-2 ${theme.clickBorder} animate-ping`} />
        </div>
      ))}
    </>,
    document.body,
  )
}
