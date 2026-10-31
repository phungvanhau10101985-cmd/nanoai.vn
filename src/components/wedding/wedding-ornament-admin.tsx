'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw, RotateCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { useToast } from '@/hooks/use-toast'
import { uploadWeddingOrnamentImage } from '@/app/tao-thiep-moi-cuoi-ai/actions'
import { nudgeWeddingOrnament, weddingIframeVisibleView, weddingOrnamentBlurPx, weddingOrnamentFadeAmount, weddingOrnamentFrameStyle, weddingOrnamentImageStyle, weddingOrnamentPlain, weddingOrnamentRises, weddingOrnamentSpotInView, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { isWeddingOrnamentImageSrc, WEDDING_ORNAMENT_CATALOG } from '@/lib/wedding/wedding-background-ornament-store'
import { bindWeddingOrnamentRise, useWeddingOrnamentRun, WeddingBackgroundOrnamentLayer } from '@/components/wedding/wedding-background-ornament-layer'
import { markWeddingOrnamentGesture } from '@/lib/wedding/wedding-ornament-gesture'
import { ornamentHitSlop, ornamentPointerIsCoarse, pickOrnamentHit, rememberOrnamentPixels } from '@/lib/wedding/wedding-ornament-hit'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type WeddingOrnamentSurface = 'cover' | 'letter'

let activeOrnamentKeyOwner = 0
let ornamentKeySerial = 0
let ornamentKeyboardSurface: WeddingOrnamentSurface | null = null

function isOrnamentTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select, [role="dialog"]')) return true
  return target instanceof HTMLElement && target.isContentEditable
}

const BLUR_STEPS = [0, 2, 4, 8, 12]
const FADE_STEPS = [0, 0.25, 0.5, 0.75, 1]

function stepAmount(steps: readonly number[], current: number, direction: 1 | -1) {
  let nearest = 0
  let best = Number.POSITIVE_INFINITY
  steps.forEach((step, index) => {
    const gap = Math.abs(step - current)
    if (gap < best) {
      best = gap
      nearest = index
    }
  })
  return steps[Math.min(steps.length - 1, Math.max(0, nearest + direction))]
}

function wrapRotate(value: number) {
  let next = Math.round(value) % 360
  if (next > 180) next -= 360
  if (next < -180) next += 360
  return next
}

type OrnamentView = { x: number; y: number; w: number; h: number }

type LiveOrnamentDrag = {
  node: HTMLElement
  tools: HTMLElement | null
  x: number
  y: number
  bottom: boolean
  sourceIndex: number
  sourceX: number
  sourceY: number
}

function paintLiveOrnamentDrag(drag: LiveOrnamentDrag) {
  const left = `${drag.x}%`
  const top = drag.bottom ? 'auto' : `${drag.y}%`
  const bottom = drag.bottom ? `${drag.y}%` : 'auto'
  drag.node.style.left = left
  drag.node.style.top = top
  drag.node.style.bottom = bottom
  if (!drag.tools) return
  drag.tools.style.left = left
  drag.tools.style.top = top
  drag.tools.style.bottom = bottom
}

function isOrnamentView(value: unknown): value is OrnamentView {
  if (!value || typeof value !== 'object') return false
  const box = value as OrnamentView
  return [box.x, box.y, box.w, box.h].every((part) => typeof part === 'number' && Number.isFinite(part) && part >= 0)
}

/** Hoa mới rơi vào khung đang nằm trên màn hình. Không có khung thì mé trên trang. */
export function weddingOrnamentSpotOnPage(): { x: number; y: number; w: number } {
  if (typeof document === 'undefined') return { x: 8, y: 8, w: 28 }
  const view = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
  const frames = [...document.querySelectorAll<HTMLElement>('[data-wedding-ornament-frame]')]
  let best: DOMRect | null = null
  let bestArea = 0
  for (const frame of frames) {
    const box = frame.getBoundingClientRect()
    const width = Math.max(0, Math.min(box.right, view.width) - Math.max(box.left, view.left))
    const height = Math.max(0, Math.min(box.bottom, view.height) - Math.max(box.top, view.top))
    const area = width * height
    if (area > bestArea) {
      best = box
      bestArea = area
    }
  }
  if (!best) return { x: 8, y: 8, w: 28 }
  return weddingOrnamentSpotInView({
    frame: { top: best.top, left: best.left, width: best.width, height: best.height },
    view,
  })
}

function OrnamentResetControl(props: {
  show: boolean
  saving: boolean
  resetLabel: string
  confirmLabel: string
  cancelLabel: string
  className: string
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (!props.show) return null
  if (!confirming) {
    return (
      <button type="button" disabled={props.saving} className={props.className} onClick={() => setConfirming(true)}>
        {props.resetLabel}
      </button>
    )
  }
  return (
    <>
      <button
        type="button"
        disabled={props.saving}
        className={cn(props.className, 'bg-rose-700 font-semibold text-white')}
        onClick={() => {
          setConfirming(false)
          props.onReset()
        }}
      >
        {props.confirmLabel}
      </button>
      <button type="button" className={props.className} onClick={() => setConfirming(false)}>
        {props.cancelLabel}
      </button>
    </>
  )
}

export function WeddingOrnamentAdminLayer(props: {
  ornaments: readonly WeddingBackgroundOrnament[]
  editable?: boolean
  className?: string
  zoomInLabel?: string
  zoomOutLabel?: string
  rotateLeftLabel?: string
  rotateRightLabel?: string
  blurLabel?: string
  fadeLabel?: string
  stillLabel?: string
  riseLabel?: string
  deleteLabel?: string
  frameLines?: boolean
  surface?: WeddingOrnamentSurface
  onChange?: (next: WeddingBackgroundOrnament[]) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [risePreview, setRisePreview] = useState<number | null>(null)
  const [uiScale, setUiScale] = useState(1)
  const [compactFrame, setCompactFrame] = useState(() => typeof window !== 'undefined' && window.innerWidth < 800)
  const layerRef = useRef<HTMLDivElement>(null)
  const { pages, shown } = useWeddingOrnamentRun(layerRef, props.ornaments)
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const liveDragRef = useRef<LiveOrnamentDrag | null>(null)
  const shownRef = useRef(shown)
  shownRef.current = shown
  const sourceRef = useRef(props.ornaments)
  sourceRef.current = props.ornaments
  const revealSeed = useRef<number | null>(null)
  const revealView = useRef<OrnamentView | null>(null)
  const onChangeRef = useRef(props.onChange)
  const selectedRef = useRef<number | null>(null)
  const keyOwnerRef = useRef(0)
  const pendingRef = useRef<WeddingBackgroundOrnament[] | null>(null)
  const frameLinesRef = useRef(props.frameLines)
  frameLinesRef.current = props.frameLines
  onChangeRef.current = props.onChange
  const editRef = useRef<{
    read: () => WeddingBackgroundOrnament[]
    write: (next: WeddingBackgroundOrnament[]) => void
  }>({
    read: () => [],
    write: () => {},
  })
  editRef.current.read = () => pendingRef.current ?? sourceRef.current.map((item) => weddingOrnamentPlain(item))
  editRef.current.write = (next) => {
    pendingRef.current = next
    onChangeRef.current?.(next)
  }

  const choose = (index: number | null) => {
    selectedRef.current = index
    setSelected(index)
    if (index == null) return
    ornamentKeySerial += 1
    activeOrnamentKeyOwner = ornamentKeySerial
    keyOwnerRef.current = ornamentKeySerial
    const node = layerRef.current?.querySelector<HTMLElement>(`[data-ornament-hit][data-ornament-index="${index}"]`)
    node?.focus({ preventScroll: true })
  }
  const chooseRef = useRef(choose)
  chooseRef.current = choose
  const draggingRef = useRef(false)

  useLayoutEffect(() => {
    const drag = liveDragRef.current
    if (!drag?.node.isConnected) return
    paintLiveOrnamentDrag(drag)
  })

  useEffect(() => {
    const pending = pendingRef.current
    if (!pending) return
    if (pending.length !== props.ornaments.length) {
      pendingRef.current = null
      return
    }
    const committed = props.ornaments.map((item) => weddingOrnamentPlain(item))
    const sign = (items: readonly WeddingBackgroundOrnament[]) =>
      items.map((item) => `${item.src}|${item.x}|${item.y}|${item.w}|${item.anchor ?? ''}|${item.rotate ?? ''}|${item.blur ?? ''}|${item.fade ?? ''}|${item.motion ?? ''}|${item.opacity ?? ''}|${item.flipX ? 1 : 0}`).join(';')
    if (sign(pending) === sign(committed)) pendingRef.current = null
  }, [props.ornaments])

  useEffect(() => {
    if (!props.surface || !props.editable) return
    const item = selected == null ? null : shownRef.current[selected]
    window.parent.postMessage(
      {
        type: 'wedding-ornament-selection',
        surface: props.surface,
        index: selected,
        w: item?.w ?? null,
        rotate: item?.rotate ?? 0,
      },
      window.location.origin,
    )
  }, [props.editable, props.ornaments, props.surface, selected])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; scale?: number }
      if (data?.type !== 'wedding-ornament-ui-scale' || typeof data.scale !== 'number' || data.scale < 0.05) return
      setUiScale(data.scale)
    }
    const applyFrame = () => setCompactFrame(window.innerWidth < 800)
    applyFrame()
    window.parent.postMessage({ type: 'wedding-ornament-need-scale' }, window.location.origin)
    window.addEventListener('message', onMessage)
    window.addEventListener('resize', applyFrame)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('resize', applyFrame)
    }
  }, [])

  useEffect(() => {
    if (!props.surface || !props.editable) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; surface?: string; action?: string; src?: string; delta?: number; dx?: number; dy?: number; view?: OrnamentView }
      if (!data || data.type !== 'wedding-ornament-command' || data.surface !== props.surface) return
      const onChange = onChangeRef.current
      if (!onChange) return
      if (data.action === 'add' && typeof data.src === 'string') {
        const source = sourceRef.current.map((item) => weddingOrnamentPlain(item))
        const layer = layerRef.current
        const bounds = layer?.getBoundingClientRect()
        const view = isOrnamentView(data.view) ? data.view : null
        const spot = bounds
          ? weddingOrnamentSpotInView({
              frame: { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height },
              view: view
                ? { top: view.y, left: view.x, width: view.w, height: view.h }
                : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
            })
          : { x: 8, y: 8, w: 28 }
        revealSeed.current = source.length
        revealView.current = view
        pendingRef.current = null
        onChange([...source, { src: data.src, x: spot.x, y: spot.y, w: spot.w }])
        return
      }
      const index = selectedRef.current
      const items = editRef.current.read()
      if (index == null || !items[index]) return
      if (data.action === 'resize') {
        const w = Math.min(90, Math.max(8, Math.round((items[index].w + (Number(data.delta) || 0)) * 10) / 10))
        editRef.current.write(items.map((item, itemIndex) => (itemIndex === index ? { ...item, w } : item)))
      } else if (data.action === 'rotate') {
        const rotate = wrapRotate((items[index].rotate ?? 0) + (Number(data.delta) || 0))
        editRef.current.write(items.map((item, itemIndex) => (itemIndex === index ? { ...item, rotate } : item)))
      } else if (data.action === 'nudge') {
        const bounds = layerRef.current?.getBoundingClientRect()
        if (!bounds || bounds.width < 1 || bounds.height < 1) return
        const moved = nudgeWeddingOrnament(items[index], Number(data.dx) || 0, Number(data.dy) || 0, bounds.width, bounds.height)
        editRef.current.write(items.map((item, itemIndex) => (itemIndex === index ? moved : item)))
      } else if (data.action === 'delete') {
        editRef.current.write(items.filter((_, itemIndex) => itemIndex !== index))
        chooseRef.current(null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [props.editable, props.surface])

  useEffect(() => {
    const seed = revealSeed.current
    if (seed == null) return
    const layer = layerRef.current
    if (!layer) return
    const copies = [...layer.querySelectorAll<HTMLElement>('[data-ornament-seed]')].filter((node) => Number(node.dataset.ornamentSeed) === seed)
    if (copies.length === 0) return
    revealSeed.current = null
    const seen = revealView.current
    const viewTop = seen?.y ?? 0
    const viewLeft = seen?.x ?? 0
    const viewBottom = seen ? seen.y + seen.h : window.innerHeight
    const viewRight = seen ? seen.x + seen.w : window.innerWidth
    let best = copies[0]
    let bestOverlap = -1
    for (const node of copies) {
      const box = node.getBoundingClientRect()
      const overlap = Math.max(0, Math.min(box.bottom, viewBottom) - Math.max(box.top, viewTop))
        * Math.max(0, Math.min(box.right, viewRight) - Math.max(box.left, viewLeft))
      if (overlap > bestOverlap) {
        best = node
        bestOverlap = overlap
      }
    }
    const index = Number(best.dataset.ornamentIndex)
    if (Number.isFinite(index)) chooseRef.current(index)
    if (bestOverlap < 8) best.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [props.ornaments])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !props.editable) return
    const remember = (img: HTMLImageElement) => {
      if (img.complete) rememberOrnamentPixels(img)
    }
    const images = [...layer.querySelectorAll<HTMLImageElement>('img[data-ornament-index]')]
    const onLoad = (event: Event) => {
      if (event.currentTarget instanceof HTMLImageElement) remember(event.currentTarget)
    }
    images.forEach((img) => {
      remember(img)
      img.addEventListener('load', onLoad)
    })
    return () => images.forEach((img) => img.removeEventListener('load', onLoad))
  }, [props.editable, props.ornaments])

  useEffect(() => {
    if (!props.editable) return
    const layer = layerRef.current
    const marked = layer?.closest('[data-wedding-stage]')
    const stage = marked ?? layer?.parentElement
    if (!layer || !(stage instanceof HTMLElement)) return
    if (marked) marked.setAttribute('data-ornament-editing', '')
    const hitSlop = (pointerType?: string) => ornamentHitSlop(ornamentPointerIsCoarse(pointerType))
    const ignoredTouch = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          'button, input, textarea, select, a, [data-ornament-tools], [data-wedding-file-anchor], [data-stack-move], [data-wedding-frame-tools]',
        ),
      )
    const startDrag = (index: number, event: PointerEvent, node: HTMLElement) => {
      const items = editRef.current.read()
      const sourceIndex = Number(node.dataset.ornamentSeed)
      const item = items[sourceIndex]
      const bounds = layer.getBoundingClientRect()
      if (!item || !Number.isFinite(sourceIndex) || !onChangeRef.current || bounds.width < 1 || bounds.height < 1) {
        markWeddingOrnamentGesture(false)
        return
      }
      chooseRef.current(index)
      const startX = event.clientX
      const startY = event.clientY
      const originX = parseFloat(node.style.left) || item.x
      const bottom = node.style.bottom !== '' && node.style.bottom !== 'auto'
      const originY = parseFloat(bottom ? node.style.bottom : node.style.top) || item.y
      const tools = layer.parentElement?.querySelector<HTMLElement>('[data-ornament-tools]')?.parentElement ?? null
      const drag: LiveOrnamentDrag = {
        node,
        tools: tools instanceof HTMLElement ? tools : null,
        x: originX,
        y: originY,
        bottom,
        sourceIndex,
        sourceX: item.x,
        sourceY: item.y,
      }
      liveDragRef.current = drag
      draggingRef.current = true
      stage.style.cursor = 'grabbing'
      const previousUserSelect = document.body.style.userSelect
      document.body.style.userSelect = 'none'
      const move = (ev: PointerEvent) => {
        const box = layer.getBoundingClientRect()
        if (box.width < 1 || box.height < 1) return
        ev.preventDefault()
        const visualDx = ((ev.clientX - startX) / box.width) * 100
        const visualDy = ((ev.clientY - startY) / box.height) * 100
        const pageCount = Math.max(1, pagesRef.current)
        const yScale = pageCount > 1 ? pageCount : 1
        drag.x = originX + visualDx
        drag.y = originY + (bottom ? -visualDy : visualDy)
        drag.sourceX = item.x + visualDx
        drag.sourceY = item.y + (bottom ? -visualDy : visualDy) * yScale
        paintLiveOrnamentDrag(drag)
      }
      const up = () => {
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        document.removeEventListener('pointercancel', up)
        document.body.style.userSelect = previousUserSelect
        draggingRef.current = false
        stage.style.cursor = ''
        markWeddingOrnamentGesture(false)
        try {
          stage.releasePointerCapture(event.pointerId)
        } catch {
          /* pointer đã nhả */
        }
        const current = editRef.current.read()
        const source = current[drag.sourceIndex]
        liveDragRef.current = null
        if (!source) return
        const round = (value: number) => Math.round(value * 10) / 10
        editRef.current.write(
          current.map((entry, itemIndex) =>
            itemIndex === drag.sourceIndex ? { ...entry, x: round(drag.sourceX), y: round(drag.sourceY) } : entry,
          ),
        )
      }
      document.addEventListener('pointermove', move, { passive: false })
      document.addEventListener('pointerup', up)
      document.addEventListener('pointercancel', up)
      const blockTouchScroll = (ev: TouchEvent) => {
        if (ev.cancelable) ev.preventDefault()
      }
      document.addEventListener('touchmove', blockTouchScroll, { passive: false })
      const releaseTouch = () => {
        document.removeEventListener('touchmove', blockTouchScroll)
        document.removeEventListener('touchend', releaseTouch)
        document.removeEventListener('touchcancel', releaseTouch)
        markWeddingOrnamentGesture(false)
      }
      document.addEventListener('touchend', releaseTouch)
      document.addEventListener('touchcancel', releaseTouch)
      try {
        stage.setPointerCapture(event.pointerId)
      } catch {
        /* kéo vẫn theo pointer trên document */
      }
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (ignoredTouch(target)) return
      const picked = pickOrnamentHit(layer, event.clientX, event.clientY, hitSlop(event.pointerType))
      if (picked == null) return
      const nodes = [...layer.querySelectorAll<HTMLElement>(`[data-ornament-hit][data-ornament-index="${picked}"]`)]
      let node = nodes[0]
      let best = Number.POSITIVE_INFINITY
      for (const candidate of nodes) {
        const box = candidate.getBoundingClientRect()
        const cx = Math.min(Math.max(event.clientX, box.left), box.right)
        const cy = Math.min(Math.max(event.clientY, box.top), box.bottom)
        const dist = (event.clientX - cx) ** 2 + (event.clientY - cy) ** 2
        if (dist < best) {
          best = dist
          node = candidate
        }
      }
      if (!node) return
      markWeddingOrnamentGesture(true)
      event.preventDefault()
      event.stopPropagation()
      startDrag(picked, event, node)
    }
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      if (ignoredTouch(event.target)) return
      const touch = event.touches[0]
      if (!touch) return
      if (pickOrnamentHit(layer, touch.clientX, touch.clientY, hitSlop('touch')) == null) return
      markWeddingOrnamentGesture(true)
      if (event.cancelable) event.preventDefault()
    }
    const onMove = (event: PointerEvent) => {
      if (draggingRef.current) {
        stage.style.cursor = 'grabbing'
        return
      }
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('button, input, textarea, select, a, [data-ornament-tools], [data-wedding-file-anchor]')
      ) {
        stage.style.cursor = ''
        return
      }
      stage.style.cursor = pickOrnamentHit(layer, event.clientX, event.clientY) == null ? '' : 'grab'
    }
    const onTouchEnd = () => {
      if (draggingRef.current) return
      markWeddingOrnamentGesture(false)
    }
    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    stage.addEventListener('pointerdown', onDown, true)
    stage.addEventListener('pointermove', onMove)
    return () => {
      if (marked) marked.removeAttribute('data-ornament-editing')
      stage.style.cursor = ''
      markWeddingOrnamentGesture(false)
      window.removeEventListener('touchstart', onTouchStart, { capture: true })
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      stage.removeEventListener('pointerdown', onDown, true)
      stage.removeEventListener('pointermove', onMove)
    }
  }, [props.editable])

  useEffect(() => {
    if (!props.editable) return
    const onKey = (event: KeyboardEvent) => {
      if (frameLinesRef.current === false) return
      const index = selectedRef.current
      if (index == null || keyOwnerRef.current !== activeOrnamentKeyOwner) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      if (isOrnamentTypingTarget(event.target)) return
      const key = event.key
      const items = editRef.current.read()
      if (!items[index]) return
      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault()
        editRef.current.write(items.filter((_, itemIndex) => itemIndex !== index))
        chooseRef.current(null)
        return
      }
      const step = event.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (key === 'ArrowLeft') dx = -step
      else if (key === 'ArrowRight') dx = step
      else if (key === 'ArrowUp') dy = -step
      else if (key === 'ArrowDown') dy = step
      else return
      const bounds = layerRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width < 1 || bounds.height < 1) return
      event.preventDefault()
      const moved = nudgeWeddingOrnament(items[index], dx, dy, bounds.width, bounds.height)
      editRef.current.write(items.map((item, itemIndex) => (itemIndex === index ? moved : item)))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [props.editable])

  const motionKey = props.ornaments.map((item, index) => `${index}:${item.motion ?? ''}:${item.src}`).join('|')
  useLayoutEffect(() => {
    const root = layerRef.current
    if (!root || !props.editable) return
    return bindWeddingOrnamentRise(root, false)
  }, [props.editable, motionKey])

  if (!props.editable) {
    return <WeddingBackgroundOrnamentLayer ornaments={props.ornaments} className={props.className} />
  }
  const update = (index: number, patch: Partial<WeddingBackgroundOrnament>) => {
    editRef.current.write(
      editRef.current.read().map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const next = { ...item, ...patch }
        if ('motion' in patch && next.motion !== 'rise') delete next.motion
        return next
      }),
    )
  }
  const previewRise = (index: number) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setRisePreview(null)
    requestAnimationFrame(() => setRisePreview(index))
  }
  const picked = selected == null ? null : shown[selected] ?? null
  const frameWidth = typeof window === 'undefined' ? (compactFrame ? 390 : 1440) : window.innerWidth
  const shownWidth = frameWidth * uiScale
  const target = compactFrame
    ? Math.min(34, Math.max(26, shownWidth * 0.085))
    : Math.min(40, Math.max(28, shownWidth * 0.062))
  const controlScale = Math.min(6, Math.max(0.4, target / 44 / Math.max(uiScale, 0.05)))
  return (
    <>
    <div ref={layerRef} className={cn('pointer-events-none absolute inset-0 overflow-visible', props.className)} style={{ zIndex: 36 }}>
      {shown.map((item, index) => {
        const active = selected === index
        return (
          <div
            key={`${item.page}-${item.seed}-${index}-${item.src}`}
            data-ornament-hit=""
            data-ornament-index={index}
            data-ornament-seed={item.seed}
            data-ornament-page={item.page ?? 0}
            data-wedding-ornament-rise={weddingOrnamentRises(item) ? '' : undefined}
            className={cn('pointer-events-none absolute outline-none', risePreview === index && 'wedding-ornament-rise-in')}
            tabIndex={-1}
            style={{
              ...weddingOrnamentFrameStyle(item),
              zIndex: active ? 2 : 1,
            }}
            onAnimationEnd={(event) => {
              if (event.animationName !== 'wedding-ornament-rise') return
              setRisePreview((current) => (current === index ? null : current))
            }}
          >
            <img
              src={item.src}
              alt=""
              draggable={false}
              data-ornament-index={index}
              className={cn('pointer-events-none block w-full max-w-none select-none', active && 'cursor-grabbing')}
              style={{
                ...weddingOrnamentImageStyle(item),
                outline: props.frameLines === false ? 'none' : active ? '3px solid #e11d48' : '2px dashed rgba(225,29,72,0.85)',
                outlineOffset: props.frameLines === false ? 0 : 3,
              }}
            />
          </div>
        )
      })}
    </div>
    {picked && selected != null && props.frameLines !== false ? (
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 80 }}>
        <div
          className="pointer-events-none absolute"
          style={weddingOrnamentFrameStyle(picked)}
        >
          <img src={picked.src} alt="" draggable={false} className="invisible block w-full" />
          <div
            data-ornament-tools=""
            className="pointer-events-auto absolute left-1/2 top-full mt-1 flex w-max flex-col gap-1 rounded-xl border border-rose-200 bg-white/95 p-1 shadow-lg"
            style={{ transform: `translateX(-50%) scale(${controlScale})`, transformOrigin: 'top center' }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex gap-1">
              <button type="button" aria-label={props.zoomInLabel} className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-700 text-white" onClick={() => update(selected, { w: Math.min(90, Math.round((picked.w + 6) * 10) / 10) })}>
                <ZoomIn className="h-6 w-6" />
              </button>
              <button type="button" aria-label={props.zoomOutLabel} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white" onClick={() => update(selected, { w: Math.max(8, Math.round((picked.w - 6) * 10) / 10) })}>
                <ZoomOut className="h-6 w-6" />
              </button>
              <button type="button" aria-label={props.rotateLeftLabel} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white" onClick={() => update(selected, { rotate: wrapRotate((picked.rotate ?? 0) - 15) })}>
                <RotateCcw className="h-6 w-6" />
              </button>
              <button type="button" aria-label={props.rotateRightLabel} className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white" onClick={() => update(selected, { rotate: wrapRotate((picked.rotate ?? 0) + 15) })}>
                <RotateCw className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label={props.deleteLabel}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700"
                onClick={() => {
                  const items = editRef.current.read()
                  editRef.current.write(items.filter((_, itemIndex) => itemIndex !== selected))
                  choose(null)
                }}
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>
            <OrnamentEffectRow
              label={props.blurLabel || ''}
              value={`${weddingOrnamentBlurPx(picked.blur)}`}
              onDecrease={() => {
                const next = stepAmount(BLUR_STEPS, weddingOrnamentBlurPx(picked.blur), -1)
                update(selected, { blur: next || undefined })
              }}
              onIncrease={() => {
                const next = stepAmount(BLUR_STEPS, weddingOrnamentBlurPx(picked.blur), 1)
                update(selected, { blur: next || undefined })
              }}
            />
            <OrnamentEffectRow
              label={props.fadeLabel || ''}
              value={`${Math.round(weddingOrnamentFadeAmount(picked.fade) * 100)}%`}
              onDecrease={() => {
                const next = stepAmount(FADE_STEPS, weddingOrnamentFadeAmount(picked.fade), -1)
                update(selected, { fade: next || undefined })
              }}
              onIncrease={() => {
                const next = stepAmount(FADE_STEPS, weddingOrnamentFadeAmount(picked.fade), 1)
                update(selected, { fade: next || undefined })
              }}
            />
            {props.stillLabel && props.riseLabel ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-pressed={!weddingOrnamentRises(picked)}
                  className={cn(
                    'min-h-8 flex-1 rounded-md border px-1 py-1 text-[11px] font-semibold leading-tight',
                    weddingOrnamentRises(picked) ? 'bg-white' : 'border-rose-700 bg-rose-700 text-white',
                  )}
                  onClick={() => update(selected, { motion: undefined })}
                >
                  {props.stillLabel}
                </button>
                <button
                  type="button"
                  aria-pressed={weddingOrnamentRises(picked)}
                  className={cn(
                    'min-h-8 flex-1 rounded-md border px-1 py-1 text-[11px] font-semibold leading-tight',
                    weddingOrnamentRises(picked) ? 'border-rose-700 bg-rose-700 text-white' : 'bg-white',
                  )}
                  onClick={() => {
                    update(selected, { motion: 'rise' })
                    previewRise(selected)
                  }}
                >
                  {props.riseLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}

function OrnamentEffectRow(props: { label: string; value: string; onDecrease: () => void; onIncrease: () => void }) {
  return (
    <div className="flex h-9 items-center gap-1 rounded-lg bg-stone-50 px-1 text-stone-800">
      <span className="min-w-0 flex-1 truncate px-1 text-xs font-medium">{props.label}</span>
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border bg-white text-base leading-none" aria-label={props.label} onClick={props.onDecrease}>
        −
      </button>
      <span className="w-9 text-center text-xs font-semibold tabular-nums">{props.value}</span>
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border bg-white text-base leading-none" aria-label={props.label} onClick={props.onIncrease}>
        +
      </button>
    </div>
  )
}

function OrnamentPickerDialog(props: {
  locale: WebLocale
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (src: string) => void
  uploading?: boolean
  onUploadClick?: () => void
  link?: string
  onLinkChange?: (value: string) => void
  onAddLink?: () => void
}) {
  const tx = getDictionary(props.locale).weddingCardAiImage
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx.ornamentAdminAdd}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {WEDDING_ORNAMENT_CATALOG.map((piece) => (
            <button
              key={piece.src}
              type="button"
              className="rounded-xl border bg-white p-2 text-center hover:border-rose-400"
              onClick={() => {
                props.onPick(piece.src)
                props.onOpenChange(false)
              }}
            >
              <img src={piece.src} alt="" className="mx-auto h-16 w-full object-contain" />
              <span className="mt-1 block text-[11px] leading-tight">{piece.label[props.locale] ?? piece.label.en}</span>
            </button>
          ))}
        </div>
        {props.onUploadClick || props.onAddLink ? (
          <div className="space-y-2 border-t pt-3">
            {props.onUploadClick ? (
              <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs" disabled={props.uploading} onClick={props.onUploadClick}>
                {tx.ornamentAdminUpload}
              </button>
            ) : null}
            {props.onAddLink && props.onLinkChange ? (
              <div className="flex gap-2">
                <input
                  value={props.link ?? ''}
                  onChange={(event) => props.onLinkChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      props.onAddLink?.()
                    }
                  }}
                  placeholder={tx.ornamentAdminPasteLink}
                  className="h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs"
                />
                <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs disabled:opacity-40" disabled={!props.link?.trim()} onClick={props.onAddLink}>
                  {tx.ornamentAdminAddLink}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function WeddingOrnamentAdminBar(props: {
  locale: WebLocale
  hint: string
  addLabel: string
  saveLabel: string
  resetLabel: string
  dirty?: boolean
  saving: boolean
  compact?: boolean
  showReset?: boolean
  onAdd: (src: string) => void
  onSave?: () => void
  onReset: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const tx = getDictionary(props.locale).weddingCardAiImage
  return (
    <div className={props.compact ? 'flex flex-wrap items-center gap-1' : 'mt-3 space-y-2 rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-2'} title={props.compact ? props.hint : undefined}>
      <p className={props.compact ? 'sr-only' : 'text-xs leading-relaxed text-rose-950'}>{props.hint}</p>
      <div className={props.compact ? 'contents' : 'flex flex-wrap gap-2'}>
        <button type="button" className="h-8 rounded-md border bg-white px-3 text-xs" onClick={() => setPickerOpen(true)}>
          {props.addLabel}
        </button>
        <OrnamentPickerDialog locale={props.locale} open={pickerOpen} onOpenChange={setPickerOpen} onPick={props.onAdd} />
        <OrnamentResetControl
          show={props.showReset === true}
          saving={props.saving}
          resetLabel={props.resetLabel}
          confirmLabel={tx.ornamentAdminResetConfirm}
          cancelLabel={tx.ornamentAdminResetCancel}
          className="h-8 rounded-md border bg-white px-3 text-xs"
          onReset={props.onReset}
        />
      </div>
    </div>
  )
}

export function WeddingOrnamentPreviewTools(props: {
  locale: WebLocale
  surface: WeddingOrnamentSurface
  frame: HTMLIFrameElement | null
  showReset?: boolean
}) {
  const tx = getDictionary(props.locale).weddingCardAiImage
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setSaving(false)
    setSelected(null)
    if (ornamentKeyboardSurface === props.surface) ornamentKeyboardSurface = null
  }, [props.frame, props.surface])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (!props.frame || event.source !== props.frame.contentWindow) return
      const data = event.data as {
        type?: string
        surface?: string
        dirty?: boolean
        saving?: boolean
        index?: number | null
      }
      if (!data || data.surface !== props.surface) return
      if (data.type === 'wedding-ornament-state') {
        setSaving(Boolean(data.saving))
      }
      if (data.type === 'wedding-ornament-selection') {
        const index = typeof data.index === 'number' ? data.index : null
        setSelected(index)
        if (index != null) ornamentKeyboardSurface = props.surface
        else if (ornamentKeyboardSurface === props.surface) ornamentKeyboardSurface = null
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [props.frame, props.surface])

  const send = (command: { action: 'save' | 'reset' | 'delete' } | { action: 'add'; src: string; view?: OrnamentView } | { action: 'resize' | 'rotate'; delta: number } | { action: 'nudge'; dx: number; dy: number }) => {
    props.frame?.contentWindow?.postMessage(
      { type: 'wedding-ornament-command', surface: props.surface, ...command },
      window.location.origin,
    )
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (ornamentKeyboardSurface !== props.surface) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      if (isOrnamentTypingTarget(event.target)) return
      if (props.frame && document.activeElement === props.frame) return
      const key = event.key
      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault()
        send({ action: 'delete' })
        return
      }
      const step = event.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (key === 'ArrowLeft') dx = -step
      else if (key === 'ArrowRight') dx = step
      else if (key === 'ArrowUp') dy = -step
      else if (key === 'ArrowDown') dy = step
      else return
      event.preventDefault()
      send({ action: 'nudge', dx, dy })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [props.frame, props.surface])

  const visibleView = (): OrnamentView | undefined => {
    const frame = props.frame
    if (!frame) return undefined
    const rect = frame.getBoundingClientRect()
    const seen = weddingIframeVisibleView({
      frameTop: rect.top,
      frameLeft: rect.left,
      frameWidth: rect.width,
      frameHeight: rect.height,
      layoutWidth: frame.offsetWidth,
      layoutHeight: frame.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
    if (seen) return seen
    frame.scrollIntoView({ block: 'start', inline: 'nearest' })
    const scale = rect.width > 1 && frame.offsetWidth > 1 ? rect.width / frame.offsetWidth : 1
    return {
      x: 0,
      y: 0,
      w: frame.offsetWidth,
      h: Math.min(frame.offsetHeight, Math.max(240, window.innerHeight / scale)),
    }
  }

  const addSrc = (src: string) => {
    const value = src.trim()
    if (!isWeddingOrnamentImageSrc(value)) {
      toast({ title: tx.ornamentAdminFailed, description: tx.ornamentAdminPasteLink, variant: 'destructive' })
      return
    }
    send({ action: 'add', src: value, view: visibleView() })
    setLink('')
    setPickerOpen(false)
  }

  const uploadFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.set('file', file)
    const result = await uploadWeddingOrnamentImage(form)
    setUploading(false)
    if (!result || !('url' in result) || !result.url) {
      toast({ title: tx.ornamentAdminFailed, variant: 'destructive' })
      return
    }
    send({ action: 'add', src: result.url, view: visibleView() })
    setPickerOpen(false)
  }

  const noSelection = selected == null
  const toolClass = 'h-8 rounded-md border bg-white px-2.5 text-xs disabled:opacity-40'

  return (
    <div
      className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/70 p-2"
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/') && item.type !== 'image/svg+xml')
        if (file) {
          event.preventDefault()
          void uploadFile(file)
          return
        }
        const text = event.clipboardData.getData('text').trim()
        if (isWeddingOrnamentImageSrc(text)) {
          event.preventDefault()
          addSrc(text)
        }
      }}
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={toolClass} onClick={() => setPickerOpen(true)}>
          {tx.ornamentAdminAdd}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            event.target.value = ''
            void uploadFile(file)
          }}
        />
        <OrnamentPickerDialog
          locale={props.locale}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={addSrc}
          uploading={uploading}
          onUploadClick={() => fileRef.current?.click()}
          link={link}
          onLinkChange={setLink}
          onAddLink={() => addSrc(link)}
        />
        <button type="button" className={cn(toolClass, 'text-rose-700')} disabled={noSelection} onClick={() => send({ action: 'delete' })}>
          {tx.ornamentAdminDelete}
        </button>
        <OrnamentResetControl
          show={props.showReset === true}
          saving={saving}
          resetLabel={tx.ornamentAdminReset}
          confirmLabel={tx.ornamentAdminResetConfirm}
          cancelLabel={tx.ornamentAdminResetCancel}
          className={toolClass}
          onReset={() => send({ action: 'reset' })}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-rose-950">{tx.ornamentAdminSelectFirst}</p>
    </div>
  )
}
