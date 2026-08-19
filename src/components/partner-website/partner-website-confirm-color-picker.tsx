'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { isHexColor, normalizeHexColor } from '@/lib/partner-website/template/partner-website-theme-tokens'

type Hsv = { h: number; s: number; v: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHexColor(hex, '#000000')
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = (((h % 360) + 360) % 360) / 60
  const c = v * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hh < 1) {
    rp = c
    gp = x
  } else if (hh < 2) {
    rp = x
    gp = c
  } else if (hh < 3) {
    gp = c
    bp = x
  } else if (hh < 4) {
    gp = x
    bp = c
  } else if (hh < 5) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 }
}

function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsv(r, g, b)
}

function hsvToHex(hsv: Hsv): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(r, g, b)
}

/** White/gray/black lose hue in hex; keep the last hue (and sat for black). */
function hsvFromHexPreserving(hex: string, prev: Hsv): Hsv {
  const next = hexToHsv(hex)
  if (next.s < 1e-3) next.h = prev.h
  if (next.v < 1e-3) {
    next.h = prev.h
    next.s = prev.s
  }
  return next
}

/** Dragging hue on white/black must still produce a visible color. */
function hsvAfterHueDrag(prev: Hsv, h: number): Hsv {
  return {
    h,
    s: prev.s < 1e-3 ? 1 : prev.s,
    v: prev.v < 1e-3 ? 1 : prev.v,
  }
}

export function cssColorToHex(color: string, fallback = '#111827'): string {
  const raw = String(color || '').trim()
  if (isHexColor(raw)) return normalizeHexColor(raw, fallback)
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]))
  return normalizeHexColor(fallback, '#111827')
}

export function ThemeColorConfirmPicker({
  value,
  disabled,
  compact = false,
  okLabel,
  onConfirm,
  onOpenChange,
}: {
  value: string
  disabled?: boolean
  compact?: boolean
  okLabel: string
  onConfirm: (hex: string) => void
  onOpenChange?: (open: boolean) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const rgbFocusRef = useRef<'r' | 'g' | 'b' | null>(null)
  const draggingRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const [draft, setDraft] = useState(value)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const hsvRef = useRef(hsv)
  hsvRef.current = hsv
  const validDraft = isHexColor(draft) ? normalizeHexColor(draft, value) : normalizeHexColor(value, '#000000')
  const rgb = hexToRgb(validDraft)
  const [rgbText, setRgbText] = useState({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) })

  function syncRgbText(hex: string) {
    const next = hexToRgb(hex)
    setRgbText({ r: String(next.r), g: String(next.g), b: String(next.b) })
  }

  function setOpenState(next: boolean) {
    setOpen(next)
    onOpenChange?.(next)
  }

  function placePanel() {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    const width = 264
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8))
    const top = Math.min(r.bottom + 4, window.innerHeight - 220)
    setPanelPos({ top: Math.max(8, top), left })
  }

  function openPicker() {
    if (disabled) return
    const hex = normalizeHexColor(value, value)
    const nextHsv = hexToHsv(hex)
    hsvRef.current = nextHsv
    setHsv(nextHsv)
    setDraft(hex)
    syncRgbText(hex)
    placePanel()
    setOpenState(true)
  }

  function closeWithoutSave() {
    setOpenState(false)
    const hex = normalizeHexColor(value, value)
    const nextHsv = hexToHsv(hex)
    hsvRef.current = nextHsv
    setHsv(nextHsv)
    setDraft(hex)
    rgbFocusRef.current = null
  }

  function confirm() {
    const next = normalizeHexColor(draft, value)
    onConfirm(next)
    setOpenState(false)
    rgbFocusRef.current = null
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeWithoutSave()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const frames = Array.from(document.querySelectorAll('iframe'))
    const prev = frames.map((frame) => frame.style.pointerEvents)
    frames.forEach((frame) => {
      frame.style.pointerEvents = 'none'
    })
    const onReposition = () => placePanel()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      frames.forEach((frame, i) => {
        frame.style.pointerEvents = prev[i] || ''
      })
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  function applyHsv(next: Hsv) {
    hsvRef.current = next
    setHsv(next)
    const hex = hsvToHex(next)
    setDraft(hex)
    if (!rgbFocusRef.current) syncRgbText(hex)
  }

  function applyHexDraft(hex: string) {
    const nextHsv = hsvFromHexPreserving(hex, hsvRef.current)
    hsvRef.current = nextHsv
    setHsv(nextHsv)
    setDraft(hex)
    if (!rgbFocusRef.current) syncRgbText(hex)
  }

  function startSurfaceDrag(
    e: ReactPointerEvent<HTMLDivElement>,
    read: (rect: DOMRect, x: number, y: number) => void
  ) {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    draggingRef.current = true
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort; iframe is already pointer-events:none */
    }
    const apply = (clientX: number, clientY: number) => {
      read(el.getBoundingClientRect(), clientX, clientY)
    }
    apply(e.clientX, e.clientY)
    const move = (ev: PointerEvent) => {
      ev.preventDefault()
      apply(ev.clientX, ev.clientY)
    }
    const up = (ev: PointerEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
      try {
        el.releasePointerCapture(ev.pointerId)
      } catch {
        /* already released */
      }
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.setTimeout(() => {
        draggingRef.current = false
      }, 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  function commitRgbChannel(ch: 'r' | 'g' | 'b', raw: string) {
    setRgbText((prev) => ({ ...prev, [ch]: raw }))
    if (raw === '') return
    const next = clamp(Number(raw) || 0, 0, 255)
    const cur = hexToRgb(validDraft)
    const rgbNext = { ...cur, [ch]: next }
    applyHexDraft(rgbToHex(rgbNext.r, rgbNext.g, rgbNext.b))
  }

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label={value}
        aria-expanded={open}
        onClick={() => {
          if (draggingRef.current) return
          if (open) closeWithoutSave()
          else openPicker()
        }}
        className={cn(
          'cursor-pointer rounded border border-border shadow-sm',
          compact ? 'h-5 w-6' : 'h-7 w-8',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        style={{ background: value }}
      />
      {open
        ? createPortal(
        <div
          data-pw-color-picker="1"
          className="fixed z-[9999] w-[16.5rem] rounded-md border bg-background p-2 shadow-lg"
          style={{ top: panelPos.top, left: panelPos.left }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            ref={svRef}
            className="relative h-28 w-full cursor-crosshair touch-none overflow-hidden rounded-sm border"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
            }}
            onPointerDown={(e) => {
              startSurfaceDrag(e, (rect, x, y) => {
                applyHsv({
                  h: hsvRef.current.h,
                  s: clamp((x - rect.left) / rect.width, 0, 1),
                  v: clamp(1 - (y - rect.top) / rect.height, 0, 1),
                })
              })
            }}
          >
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: draft }}
            />
          </div>
          <div
            ref={hueRef}
            className="relative mt-2 h-3 w-full cursor-pointer touch-none rounded-sm border"
            style={{
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            onPointerDown={(e) => {
              startSurfaceDrag(e, (rect, x) => {
                applyHsv(
                  hsvAfterHueDrag(
                    hsvRef.current,
                    clamp(((x - rect.left) / rect.width) * 360, 0, 359.9)
                  )
                )
              })
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
            />
          </div>
          <div className="mt-2 flex items-end gap-1">
            <label className="min-w-0 flex-1">
              <span className="block text-[9px] text-muted-foreground">HEX</span>
              <input
                value={draft}
                maxLength={7}
                onChange={(e) => {
                  const raw = e.target.value
                  setDraft(raw)
                  if (isHexColor(raw)) {
                    applyHexDraft(normalizeHexColor(raw, draft))
                  }
                }}
                className="h-7 w-full rounded border border-border/70 bg-muted/30 px-1 font-mono text-[10px] uppercase"
              />
            </label>
            {(['r', 'g', 'b'] as const).map((ch) => (
              <label key={ch} className="w-9">
                <span className="block text-[9px] text-muted-foreground">{ch.toUpperCase()}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={rgbText[ch]}
                  onFocus={() => {
                    rgbFocusRef.current = ch
                  }}
                  onBlur={() => {
                    rgbFocusRef.current = null
                    syncRgbText(validDraft)
                  }}
                  onChange={(e) => commitRgbChannel(ch, e.target.value.replace(/\D/g, '').slice(0, 3))}
                  className="h-7 w-full rounded border border-border/70 bg-muted/30 px-0.5 text-center font-mono text-[10px]"
                />
              </label>
            ))}
            <button
              type="button"
              className="h-7 shrink-0 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
              onClick={confirm}
            >
              {okLabel}
            </button>
          </div>
        </div>,
        document.body
      )
        : null}
    </div>
  )
}
