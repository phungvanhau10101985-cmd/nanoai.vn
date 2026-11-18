'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, Hand, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_WHITEBOARD_CAMERA,
  WHITEBOARD_BRUSH,
  WHITEBOARD_COLORS,
  WHITEBOARD_GRID,
  applyWhiteboardMessage,
  emptyWhiteboardState,
  hitTestTop,
  isWhiteboardWireType,
  appendInkPoint,
  cameraForPinchGesture,
  cameraZoomKeepingPoint,
  mathToWorld,
  newWhiteboardId,
  orthoLock,
  pathLength,
  paintWhiteboard,
  parsePlotInput,
  pickObjectsInMarquee,
  recognizeStroke,
  rotateObject,
  scaleObject,
  screenToWorld,
  snapToGrid,
  translateObject,
  type WhiteboardCamera,
  type WhiteboardDraft,
  type TriangleLineRole,
  type WhiteboardGraph,
  type WhiteboardObject,
  type WhiteboardState,
  type WhiteboardTool,
  type WhiteboardWireMessage,
  nearestTriangleVertex,
  triangleLinePoints,
  triangleVertexName,
  TRIANGLE_LINE_ROLES,
  fillTriangleSides,
  guessTriangleKind,
  parseSideLength,
  placeTriangle,
  sidesFromSketch,
  triangleSideError,
  type TriangleKind,
  type TriangleSides,
} from '../lib/teacher-whiteboard'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export type TeacherWhiteboardCanvasProps = {
  state: WhiteboardState
  onStateChange: (state: WhiteboardState) => void
  onBroadcast?: (msg: WhiteboardWireMessage) => void
  readOnly?: boolean
  tr: Tr
  className?: string
}

const BRUSH = WHITEBOARD_BRUSH

export function TeacherWhiteboardCanvas({
  state,
  onStateChange,
  onBroadcast,
  readOnly = false,
  tr,
  className,
}: TeacherWhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const [tool, setTool] = useState<WhiteboardTool>('pen')
  const [color, setColor] = useState<string>(WHITEBOARD_COLORS[0])
  const [brush, setBrush] = useState<(typeof BRUSH)[number]>(5)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; additive: boolean } | null>(null)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; crossing: boolean } | null>(null)
  const toolRef = useRef(tool)
  toolRef.current = tool
  const spaceToolRef = useRef<WhiteboardTool | null>(null)
  const [expr, setExpr] = useState('y=x^2')
  const [exprError, setExprError] = useState('')
  const [axisChoice, setAxisChoice] = useState('solo')
  const [axisMenu, setAxisMenu] = useState(false)
  const vertexAnchorRef = useRef<{ triangleId: string; vertex: 0 | 1 | 2; point: { x: number; y: number } } | null>(null)
  const [lineAsk, setLineAsk] = useState<{
    id: string
    color: string
    size: number
    triangleId: string
    vertex: 0 | 1 | 2
    fallbackPoints: { x: number; y: number }[]
  } | null>(null)
  const [triangleAsk, setTriangleAsk] = useState<{
    id: string
    color: string
    size: number
    corners: { x: number; y: number }[]
  } | null>(null)
  const [triKind, setTriKind] = useState<TriangleKind>('scalene')
  const [triSides, setTriSides] = useState<TriangleSides>({ ab: '', bc: '', ca: '' })
  const [triError, setTriError] = useState('')
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const drawRef = useRef<{ id: string; points: { x: number; y: number }[] } | null>(null)
  const panRef = useRef<{ x: number; y: number; cam: WhiteboardCamera } | null>(null)
  const pinchRef = useRef<{ dist: number; cam: WhiteboardCamera; mid: { x: number; y: number } } | null>(null)
  const cornerZoomRef = useRef<{
    oppSx: number
    oppSy: number
    startDist: number
    startScale: number
    cam: WhiteboardCamera
  } | null>(null)
  const dragRef = useRef<{ id: string; last: { x: number; y: number }; mode: 'move' | 'scale' | 'rotate'; frameId?: string } | null>(null)
  const draftTimerRef = useRef<number | null>(null)
  const camTimerRef = useRef<number | null>(null)

  const emit = useCallback((msg: WhiteboardWireMessage) => {
    onBroadcast?.(msg)
  }, [onBroadcast])

  const setState = useCallback((next: WhiteboardState, msg?: WhiteboardWireMessage) => {
    onStateChange(next)
    if (msg) emit(msg)
  }, [emit, onStateChange])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const rect = wrap.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    paintWhiteboard(ctx, {
      objects: state.objects,
      camera: state.camera,
      draft: state.draft,
      grid: state.grid,
      selectedIds,
      width: w,
      height: h,
      dpr,
    })
  }, [selectedIds, state.camera, state.draft, state.grid, state.objects])

  useEffect(() => {
    paint()
  }, [paint])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [paint])

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const wrap = wrapRef.current
    if (!wrap) return { sx: 0, sy: 0, world: { x: 0, y: 0 } }
    const rect = wrap.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy, stateRef.current.camera, rect.width, rect.height)
    return { sx, sy, world }
  }

  const flushDraft = (draft: WhiteboardDraft | null) => {
    const next = { ...stateRef.current, draft }
    onStateChange(next)
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current)
    draftTimerRef.current = window.setTimeout(() => emit({ type: 'whiteboard-draft', draft }), 40)
  }

  const flushCamera = (camera: WhiteboardCamera) => {
    const next = { ...stateRef.current, camera, draft: stateRef.current.draft }
    onStateChange(next)
    if (camTimerRef.current) window.clearTimeout(camTimerRef.current)
    camTimerRef.current = window.setTimeout(() => emit({ type: 'whiteboard-camera', camera }), 80)
  }

  const cancelInk = () => {
    if (!drawRef.current && !stateRef.current.draft) return
    drawRef.current = null
    flushDraft(null)
  }

  const applyPinchFromClient = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (!pinchRef.current) {
      pinchRef.current = { dist, cam: { ...stateRef.current.camera }, mid }
      return
    }
    const rect = wrap.getBoundingClientRect()
    const start = pinchRef.current
    flushCamera(cameraForPinchGesture(
      start.cam,
      { x: start.mid.x - rect.left, y: start.mid.y - rect.top },
      start.dist,
      { x: mid.x - rect.left, y: mid.y - rect.top },
      dist,
      rect.width,
      rect.height,
    ))
  }

  const zoomAround = (screen: { x: number; y: number }, nextScale: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    flushCamera(cameraZoomKeepingPoint(stateRef.current.camera, screen, nextScale, rect.width, rect.height))
  }

  const zoomBy = (factor: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    zoomAround({ x: rect.width / 2, y: rect.height / 2 }, stateRef.current.camera.scale * factor)
  }

  const pinchApiRef = useRef({ readOnly, cancelInk, applyPinchFromClient })
  pinchApiRef.current = { readOnly, cancelInk, applyPinchFromClient }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const opts: AddEventListenerOptions = { passive: false, capture: true }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      const api = pinchApiRef.current
      if (api.readOnly) return
      api.cancelInk()
      panRef.current = null
      dragRef.current = null
      if (!pinchRef.current) {
        api.applyPinchFromClient(
          { x: e.touches[0].clientX, y: e.touches[0].clientY },
          { x: e.touches[1].clientX, y: e.touches[1].clientY },
        )
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      if (pinchApiRef.current.readOnly) return
      pinchApiRef.current.applyPinchFromClient(
        { x: e.touches[0].clientX, y: e.touches[0].clientY },
        { x: e.touches[1].clientX, y: e.touches[1].clientY },
      )
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
    }
    const blockPageZoom = (e: Event) => {
      e.preventDefault()
    }
    wrap.addEventListener('touchstart', onTouchStart, opts)
    wrap.addEventListener('touchmove', onTouchMove, opts)
    wrap.addEventListener('touchend', onTouchEnd, opts)
    wrap.addEventListener('touchcancel', onTouchEnd, opts)
    wrap.addEventListener('gesturestart', blockPageZoom, opts)
    wrap.addEventListener('gesturechange', blockPageZoom, opts)
    wrap.addEventListener('gestureend', blockPageZoom, opts)
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart, opts)
      wrap.removeEventListener('touchmove', onTouchMove, opts)
      wrap.removeEventListener('touchend', onTouchEnd, opts)
      wrap.removeEventListener('touchcancel', onTouchEnd, opts)
      wrap.removeEventListener('gesturestart', blockPageZoom, opts)
      wrap.removeEventListener('gesturechange', blockPageZoom, opts)
      wrap.removeEventListener('gestureend', blockPageZoom, opts)
    }
  }, [])

  const commitObject = (object: WhiteboardObject) => {
    if (draftTimerRef.current) {
      window.clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
    const objects = [...stateRef.current.objects.filter((item) => item.id !== object.id), object]
    const next = { ...stateRef.current, objects, draft: null }
    stateRef.current = next
    setState(next, { type: 'whiteboard-upsert', object })
    emit({ type: 'whiteboard-draft', draft: null })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    setAxisMenu(false)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      cancelInk()
      panRef.current = null
      dragRef.current = null
      if (!pinchRef.current) {
        const pts = Array.from(pointersRef.current.values())
        applyPinchFromClient(pts[0], pts[1])
      }
      return
    }
    if (e.button === 1 || e.altKey || tool === 'pan') {
      panRef.current = { x: e.clientX, y: e.clientY, cam: stateRef.current.camera }
      return
    }
    const { sx, sy, world } = localPoint(e)
    if (tool === 'select') {
      const hit = hitTestTop(stateRef.current.objects, world, 10 / (stateRef.current.camera.scale || 1))
      if (hit) {
        const prev = selectedIdsRef.current
        const nextIds = e.shiftKey
          ? prev.includes(hit.id) ? prev.filter((id) => id !== hit.id) : [...prev, hit.id]
          : prev.includes(hit.id) ? prev : [hit.id]
        setSelectedIds(nextIds)
        selectedIdsRef.current = nextIds
        if (nextIds.includes(hit.id) && !e.shiftKey) {
          dragRef.current = { id: hit.id, last: world, mode: e.ctrlKey ? 'rotate' : 'move', frameId: hit.kind === 'graph' ? hit.frameId : undefined }
        }
      } else {
        marqueeRef.current = { x0: sx, y0: sy, x1: sx, y1: sy, additive: e.shiftKey }
      }
      return
    }
    const anchor = tool === 'pen'
      ? nearestTriangleVertex(stateRef.current.objects, world, 18 / (stateRef.current.camera.scale || 1))
      : null
    vertexAnchorRef.current = anchor
    const snapped = anchor?.point ?? world
    const start = tool === 'pen' && stateRef.current.ortho && !anchor ? snapToGrid(snapped, WHITEBOARD_GRID) : snapped
    const id = newWhiteboardId()
    drawRef.current = { id, points: [start] }
    flushDraft({ id, tool: tool === 'eraser' ? 'eraser' : 'pen', color, size: brush, points: [start] })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinchRef.current) {
      if (pointersRef.current.size >= 2) {
        const pts = Array.from(pointersRef.current.values())
        applyPinchFromClient(pts[0], pts[1])
      }
      return
    }
    if (cornerZoomRef.current) {
      const wrap = wrapRef.current
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const z = cornerZoomRef.current
      const dist = Math.hypot(e.clientX - rect.left - z.oppSx, e.clientY - rect.top - z.oppSy)
      const nextScale = z.startScale * (dist / Math.max(12, z.startDist))
      flushCamera(cameraZoomKeepingPoint(z.cam, { x: z.oppSx, y: z.oppSy }, nextScale, rect.width, rect.height))
      return
    }
    if (marqueeRef.current) {
      const m = marqueeRef.current
      m.x1 = e.clientX - (wrapRef.current?.getBoundingClientRect().left ?? 0)
      m.y1 = e.clientY - (wrapRef.current?.getBoundingClientRect().top ?? 0)
      if (Math.hypot(m.x1 - m.x0, m.y1 - m.y0) >= 4) {
        setMarquee({ x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, crossing: m.x1 < m.x0 })
      }
      return
    }
    if (panRef.current) {
      const cam0 = panRef.current.cam
      const scale = cam0.scale || 1
      flushCamera({
        ...cam0,
        x: cam0.x - (e.clientX - panRef.current.x) / scale,
        y: cam0.y - (e.clientY - panRef.current.y) / scale,
      })
      return
    }
    const { world } = localPoint(e)
    if (dragRef.current) {
      const cur = stateRef.current.objects.find((item) => item.id === dragRef.current?.id)
      if (!cur) return
      let target = world
      if (stateRef.current.grid && dragRef.current.mode === 'move') target = snapToGrid(world, WHITEBOARD_GRID)
      const dx = target.x - dragRef.current.last.x
      const dy = target.y - dragRef.current.last.y
      let next = cur
      if (dragRef.current.mode === 'move') next = translateObject(cur, dx, dy)
      else if (dragRef.current.mode === 'scale') {
        const origin = { x: cur.kind === 'graph' ? cur.origin.x : world.x - dx, y: cur.kind === 'graph' ? cur.origin.y : world.y - dy }
        const factor = 1 + (dx + dy) / 220
        next = scaleObject(cur, origin, factor)
      } else {
        next = rotateObject(cur, { x: world.x - dx, y: world.y - dy }, dx / 80)
      }
      dragRef.current.last = target
      const frameId = dragRef.current.frameId
      const movingMany = dragRef.current.mode === 'move'
      const selected = new Set(movingMany && selectedIdsRef.current.includes(cur.id) ? selectedIdsRef.current : [cur.id])
      if (frameId && (dragRef.current.mode === 'move' || dragRef.current.mode === 'scale')) {
        for (const item of stateRef.current.objects) {
          if (item.kind === 'graph' && item.frameId === frameId) selected.add(item.id)
        }
      }
      const objects = stateRef.current.objects.map((item) => {
        if (item.id === next.id) return next
        if (!selected.has(item.id)) return item
        if (dragRef.current?.mode === 'move') return translateObject(item, dx, dy)
        if (dragRef.current?.mode !== 'scale') return item
        const origin = { x: cur.kind === 'graph' ? cur.origin.x : world.x - dx, y: cur.kind === 'graph' ? cur.origin.y : world.y - dy }
        return scaleObject(item, origin, 1 + (dx + dy) / 220)
      })
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      return
    }
    const drawing = drawRef.current
    if (!drawing) return
    let p = world
    if (stateRef.current.ortho && drawing.points[0]) p = orthoLock(drawing.points[0], p)
    const before = drawing.points.length
    appendInkPoint(drawing.points, p)
    if (drawing.points.length === before) return
    flushDraft({ id: drawing.id, tool: tool === 'eraser' ? 'eraser' : 'pen', color, size: brush, points: drawing.points.slice() })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    panRef.current = null
    cornerZoomRef.current = null
    if (marqueeRef.current) {
      const m = marqueeRef.current
      marqueeRef.current = null
      setMarquee(null)
      const moved = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) >= 4
      if (!moved) {
        if (!m.additive) setSelectedIds([])
        return
      }
      const end = localPoint(e).world
      const start = screenToWorld(m.x0, m.y0, stateRef.current.camera, wrapRef.current?.getBoundingClientRect().width ?? 1, wrapRef.current?.getBoundingClientRect().height ?? 1)
      const ids = pickObjectsInMarquee(stateRef.current.objects, start, end, m.x1 < m.x0)
      const nextIds = m.additive ? Array.from(new Set([...selectedIdsRef.current, ...ids])) : ids
      setSelectedIds(nextIds)
      return
    }
    if (dragRef.current) {
      const frameId = dragRef.current.frameId
      const id = dragRef.current.id
      const mode = dragRef.current.mode
      dragRef.current = null
      const selected = new Set(mode === 'move' && selectedIdsRef.current.includes(id) ? selectedIdsRef.current : [id])
      if (frameId) {
        for (const item of stateRef.current.objects) {
          if (item.kind === 'graph' && item.frameId === frameId) selected.add(item.id)
        }
      }
      for (const obj of stateRef.current.objects) {
        if (selected.has(obj.id)) emit({ type: 'whiteboard-upsert', object: obj })
      }
      return
    }
    const drawing = drawRef.current
    drawRef.current = null
    if (!drawing || drawing.points.length < 2) {
      vertexAnchorRef.current = null
      flushDraft(null)
      return
    }
    const anchor = vertexAnchorRef.current
      ?? nearestTriangleVertex(stateRef.current.objects, drawing.points[0], 18 / (stateRef.current.camera.scale || 1))
      ?? nearestTriangleVertex(stateRef.current.objects, drawing.points[drawing.points.length - 1], 18 / (stateRef.current.camera.scale || 1))
    vertexAnchorRef.current = null
    const chord = drawing.points.length >= 2 ? Math.hypot(drawing.points[0].x - drawing.points[drawing.points.length - 1].x, drawing.points[0].y - drawing.points[drawing.points.length - 1].y) : 0
    const straight = chord >= 24 && pathLength(drawing.points) < chord * 1.35
    if (anchor && tool === 'pen' && straight) {
      flushDraft(null)
      setLineAsk({
        id: drawing.id,
        color,
        size: brush,
        triangleId: anchor.triangleId,
        vertex: anchor.vertex,
        fallbackPoints: drawing.points.slice(),
      })
      return
    }
    const recognized = tool === 'pen' ? recognizeStroke(drawing.points) : null
    if (recognized?.shape === 'triangle' && recognized.points.length >= 3) {
      const corners = recognized.points.slice(0, 3)
      const measured = sidesFromSketch(corners)
      const ab = parseSideLength(measured.ab) ?? 1
      const bc = parseSideLength(measured.bc) ?? 1
      const ca = parseSideLength(measured.ca) ?? 1
      const kind = guessTriangleKind(ab, bc, ca)
      flushDraft(null)
      setTriKind(kind)
      setTriSides(fillTriangleSides(kind, measured, 'ab'))
      setTriError('')
      setTriangleAsk({ id: drawing.id, color, size: brush, corners })
      return
    }
    const object: WhiteboardObject = recognized
      ? { ...recognized, id: drawing.id, color, size: brush }
      : { kind: 'stroke', id: drawing.id, tool: tool === 'eraser' ? 'eraser' : 'pen', color, size: brush, points: drawing.points }
    commitObject(object)
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const { sx, sy } = localPoint(e)
    zoomAround({ x: sx, y: sy }, stateRef.current.camera.scale * factor)
  }

  const onCornerPointerDown = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap = wrapRef.current
    if (!wrap) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = wrap.getBoundingClientRect()
    const opp =
      corner === 'nw' ? { x: rect.width, y: rect.height }
      : corner === 'ne' ? { x: 0, y: rect.height }
      : corner === 'sw' ? { x: rect.width, y: 0 }
      : { x: 0, y: 0 }
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    cornerZoomRef.current = {
      oppSx: opp.x,
      oppSy: opp.y,
      startDist: Math.hypot(sx - opp.x, sy - opp.y),
      startScale: stateRef.current.camera.scale,
      cam: { ...stateRef.current.camera },
    }
  }

  const onCornerPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!cornerZoomRef.current) return
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const z = cornerZoomRef.current
    const dist = Math.hypot(e.clientX - rect.left - z.oppSx, e.clientY - rect.top - z.oppSy)
    flushCamera(cameraZoomKeepingPoint(z.cam, { x: z.oppSx, y: z.oppSy }, z.startScale * (dist / Math.max(12, z.startDist)), rect.width, rect.height))
  }

  const onCornerPointerUp = () => {
    cornerZoomRef.current = null
  }

  const addGraph = () => {
    const parsed = parsePlotInput(expr)
    if (!parsed) {
      setExprError(tr('Công thức không đọc được', 'Could not parse the formula', '无法解析公式', '式を解析できません', '수식을 읽지 못했습니다'))
      return
    }
    setExprError('')
    const graphs = stateRef.current.objects.filter((item): item is WhiteboardGraph => item.kind === 'graph')
    const host = graphs.find((item) => item.id === axisChoice)
    let frameId = newWhiteboardId()
    let origin = mathToWorld({ x: 0, y: 0 }, { x: state.camera.x, y: state.camera.y }, 1)
    let unit = 40
    if (host) {
      frameId = host.frameId || newWhiteboardId()
      origin = { ...host.origin }
      unit = host.unit
      if (!host.frameId) commitObject({ ...host, frameId })
    }
    const object: WhiteboardObject = {
      kind: 'graph',
      id: newWhiteboardId(),
      color,
      axis: parsed.axis,
      expr: parsed.source,
      origin,
      unit,
      frameId,
    }
    commitObject(object)
    setSelectedIds([object.id])
    setAxisMenu(false)
  }

  const undo = () => {
    const last = stateRef.current.objects[stateRef.current.objects.length - 1]
    if (!last) return
    const objects = stateRef.current.objects.slice(0, -1)
    setState({ ...stateRef.current, objects, draft: null }, { type: 'whiteboard-remove', ids: [last.id] })
    setSelectedIds((ids) => ids.filter((id) => id !== last.id))
  }

  const clearAll = () => {
    setSelectedIds([])
    setState({ ...stateRef.current, objects: [], draft: null }, { type: 'whiteboard-clear' })
  }

  const removeSelected = () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    const drop = new Set(ids)
    const objects = stateRef.current.objects.filter((item) => !drop.has(item.id))
    setState({ ...stateRef.current, objects, draft: null }, { type: 'whiteboard-remove', ids })
    setSelectedIds([])
  }

  const toggleGrid = () => {
    const grid = !stateRef.current.grid
    setState({ ...stateRef.current, grid }, { type: 'whiteboard-grid', grid })
  }

  const toggleOrtho = () => {
    onStateChange({ ...stateRef.current, ortho: !stateRef.current.ortho })
  }

  const keysRef = useRef({
    undo,
    clearAll,
    removeSelected,
    toggleGrid,
    toggleOrtho,
    zoomBy,
    flushCamera,
    setTool,
    setBrush,
    setSelectedIds,
  })
  keysRef.current = {
    undo,
    clearAll,
    removeSelected,
    toggleGrid,
    toggleOrtho,
    zoomBy,
    flushCamera,
    setTool,
    setBrush,
    setSelectedIds,
  }

  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableKeyTarget(e.target)) return
      const api = keysRef.current
      const key = e.key
      const lower = key.toLowerCase()
      const cmd = e.ctrlKey || e.metaKey

      if (cmd && lower === 'z' && !e.shiftKey) {
        e.preventDefault()
        api.undo()
        return
      }
      if (cmd && e.shiftKey && (key === 'Delete' || key === 'Backspace')) {
        e.preventDefault()
        api.clearAll()
        return
      }
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault()
        api.removeSelected()
        return
      }
      if (cmd && (key === '+' || key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        api.zoomBy(1.18)
        return
      }
      if (cmd && (key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        api.zoomBy(0.85)
        return
      }
      if (cmd && (key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        api.flushCamera({ ...DEFAULT_WHITEBOARD_CAMERA })
        return
      }
      if (cmd) return

      if (key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat && toolRef.current !== 'pan') {
          spaceToolRef.current = toolRef.current
          api.setTool('pan')
        }
        return
      }
      if (lower === 'b' || lower === 'p') {
        api.setTool('pen')
        return
      }
      if (lower === 'e') {
        api.setTool('eraser')
        return
      }
      if (lower === 'v') {
        api.setTool('select')
        return
      }
      if (lower === 'h') {
        api.setTool('pan')
        return
      }
      if (lower === 'g') {
        api.toggleGrid()
        return
      }
      if (lower === 'o') {
        api.toggleOrtho()
        return
      }
      if (key === '1') {
        api.setBrush(3)
        return
      }
      if (key === '2') {
        api.setBrush(5)
        return
      }
      if (key === '3') {
        api.setBrush(7)
        return
      }
      if (key === '-' || key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault()
        api.zoomBy(0.85)
        return
      }
      if (key === '+' || key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault()
        api.zoomBy(1.18)
        return
      }
      if (key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault()
        api.flushCamera({ ...DEFAULT_WHITEBOARD_CAMERA })
        return
      }
      if (key === 'Escape') {
        api.setSelectedIds([])
        api.setTool('select')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const prev = spaceToolRef.current
      spaceToolRef.current = null
      if (prev) keysRef.current.setTool(prev)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [readOnly])

  const confirmTriangle = () => {
    if (!triangleAsk) return
    const err = triangleSideError(triKind, triSides)
    if (err === 'missing') {
      setTriError(tr('Nhập đủ độ dài AB, BC, CA', 'Enter all of AB, BC, CA', '请填写 AB、BC、CA', 'AB・BC・CA を入力', 'AB, BC, CA를 입력'))
      return
    }
    if (err === 'inequality') {
      setTriError(tr('Ba cạnh không dựng được tam giác', 'These sides do not form a triangle', '三边不能构成三角形', '三角形になりません', '삼각형이 되지 않습니다'))
      return
    }
    if (err === 'equilateral') {
      setTriError(tr('Tam giác đều cần ba cạnh bằng nhau', 'An equilateral triangle needs three equal sides', '等边三角形三边相等', '正三角形は三辺が等しい', '정삼각형은 세 변이 같습니다'))
      return
    }
    if (err === 'isosceles') {
      setTriError(tr('Tam giác cân cần AB = AC', 'An isosceles triangle needs AB = AC', '等腰三角形需要 AB = AC', '二等辺三角形は AB = AC', '이등변삼각형은 AB = AC'))
      return
    }
    if (err === 'right' || err === 'right-isosceles') {
      setTriError(tr('Góc vuông tại C: AB² = BC² + CA²', 'Right angle at C: AB² = BC² + CA²', '直角在 C：AB² = BC² + CA²', '直角は C：AB² = BC² + CA²', '직각은 C: AB² = BC² + CA²'))
      return
    }
    const points = placeTriangle({ kind: triKind, ...triSides }, triangleAsk.corners)
    if (!points) {
      setTriError(tr('Ba cạnh không dựng được tam giác', 'These sides do not form a triangle', '三边不能构成三角形', '三角形になりません', '삼각형이 되지 않습니다'))
      return
    }
    commitObject({
      kind: 'shape',
      id: triangleAsk.id,
      shape: 'triangle',
      color: triangleAsk.color,
      size: triangleAsk.size,
      points,
      triangle: { kind: triKind, ...triSides },
    })
    setTriangleAsk(null)
  }

  const triangleKindLabel = (kind: TriangleKind) => {
    if (kind === 'equilateral') return tr('Tam giác đều', 'Equilateral', '等边三角形', '正三角形', '정삼각형')
    if (kind === 'isosceles') return tr('Tam giác cân', 'Isosceles', '等腰三角形', '二等辺三角形', '이등변삼각형')
    if (kind === 'right') return tr('Tam giác vuông', 'Right', '直角三角形', '直角三角形', '직각삼각형')
    if (kind === 'right-isosceles') return tr('Tam giác vuông cân', 'Isosceles right', '等腰直角三角形', '直角二等辺三角形', '직각이등변삼각형')
    return tr('Tam giác thường', 'Scalene', '一般三角形', '不等辺三角形', '부등변삼각형')
  }

  const triangleLineLabel = (role: TriangleLineRole) => {
    if (role === 'altitude') return tr('Đường cao', 'Altitude', '高线', '高さ', '높이')
    if (role === 'bisector') return tr('Đường phân giác', 'Angle bisector', '角平分线', '角の二等分線', '각의 이등분선')
    if (role === 'median') return tr('Đường trung tuyến', 'Median', '中线', '中線', '중선')
    if (role === 'perp-bisector') return tr('Đường trung trực', 'Perpendicular bisector', '垂直平分线', '垂直二等分線', '수직이등분선')
    return tr('Đường trung bình', 'Midsegment', '中位线', '中点連結', '중선분')
  }

  const keepArbitraryLine = () => {
    if (!lineAsk) return
    const points = lineAsk.fallbackPoints
    const a = points[0]
    const b = points[points.length - 1]
    if (!a || !b) {
      setLineAsk(null)
      return
    }
    commitObject({
      kind: 'shape',
      id: lineAsk.id,
      shape: 'line',
      color: lineAsk.color,
      size: lineAsk.size,
      points: [a, b],
    })
    setLineAsk(null)
  }

  const chooseTriangleLine = (role: TriangleLineRole) => {
    if (!lineAsk) return
    const tri = stateRef.current.objects.find((item) => item.kind === 'shape' && item.shape === 'triangle' && item.id === lineAsk.triangleId)
    const pts = tri && tri.kind === 'shape' ? triangleLinePoints(role, lineAsk.vertex, tri.points) : null
    if (!pts) {
      setLineAsk(null)
      return
    }
    commitObject({
      kind: 'shape',
      id: lineAsk.id,
      shape: 'line',
      color: lineAsk.color,
      size: lineAsk.size,
      points: pts,
      triangleLine: { role, vertex: lineAsk.vertex, triangleId: lineAsk.triangleId },
    })
    setLineAsk(null)
  }

  const btn = (on: boolean) => cn('rounded px-2 py-1 text-[11px]', on ? 'bg-white/30' : 'hover:bg-white/15')

  const dock = 'flex flex-wrap items-center justify-center gap-1 rounded-xl border border-white/25 bg-black/70 px-2 py-1 text-white shadow-lg backdrop-blur-sm'
  const cornerCls = 'absolute z-30 h-8 w-8 touch-none rounded-sm border-2 border-sky-400/90 bg-white/85 shadow'
  const zoomPct = `${Math.round(state.camera.scale * 100)}%`
  return (
    <div className={cn('relative flex h-full min-h-0 w-full flex-col bg-slate-200 touch-none', className)} data-teacher-whiteboard>
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden overscroll-none touch-none"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'absolute inset-0 h-full w-full touch-none',
            tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        {marquee ? (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              border: marquee.crossing ? '1px dashed #16a34a' : '1px solid #2563eb',
              background: marquee.crossing ? 'rgba(34,197,94,0.15)' : 'rgba(37,99,235,0.14)',
            }}
          />
        ) : null}
        {readOnly ? null : (
          <>
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'left-1.5 top-1.5 cursor-nwse-resize')} onPointerDown={onCornerPointerDown('nw')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'right-1.5 top-1.5 cursor-nesw-resize')} onPointerDown={onCornerPointerDown('ne')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'bottom-24 left-1.5 cursor-nesw-resize')} onPointerDown={onCornerPointerDown('sw')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'bottom-24 right-1.5 cursor-nwse-resize')} onPointerDown={onCornerPointerDown('se')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <div
              className="absolute bottom-2 left-1/2 z-20 flex w-[min(96%,720px)] -translate-x-1/2 flex-col gap-1"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={dock}>
                <button type="button" className={btn(tool === 'pen')} title="B" onClick={() => setTool('pen')}>{tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}</button>
                <button type="button" className={btn(tool === 'eraser')} title="E" onClick={() => setTool('eraser')}>{tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}</button>
                <button type="button" className={btn(brush === 3)} title="1" onClick={() => setBrush(3)}>{tr('S', 'S', '细', '細', '얇게')}</button>
                <button type="button" className={btn(brush === 5)} title="2" onClick={() => setBrush(5)}>{tr('M', 'M', '中', '中', '중간')}</button>
                <button type="button" className={btn(brush === 7)} title="3" onClick={() => setBrush(7)}>{tr('L', 'L', '粗', '太', '굵게')}</button>
                {WHITEBOARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn('h-3.5 w-3.5 rounded-full border', color === c ? 'border-white' : 'border-white/40')}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <button type="button" className={btn(false)} title="Ctrl+Z" onClick={undo}>{tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}</button>
                <button type="button" className={btn(false)} title="Ctrl+Shift+Delete" onClick={clearAll}>{tr('Clear', 'Clear', '清除', 'クリア', '지우기')}</button>
              </div>
              <div className={dock}>
                <button type="button" className={btn(tool === 'select')} title="V" onClick={() => setTool('select')}>{tr('Chọn', 'Select', '选择', '選択', '선택')}</button>
                <button
                  type="button"
                  className={cn(btn(tool === 'pan'), 'inline-flex items-center justify-center')}
                  onClick={() => setTool('pan')}
                  title={`${tr('Pan', 'Pan', '平移', 'パン', '이동')} (H)`}
                  aria-label={tr('Pan', 'Pan', '平移', 'パン', '이동')}
                >
                  <Hand className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={cn(btn(false), 'inline-flex items-center justify-center')}
                  onClick={() => zoomBy(0.85)}
                  title={`${tr('Thu nhỏ', 'Zoom out', '缩小', '縮小', '축소')} (-)`}
                  aria-label={tr('Thu nhỏ', 'Zoom out', '缩小', '縮小', '축소')}
                >
                  <ZoomOut className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" className={btn(Math.abs(state.camera.scale - 1) < 0.02)} title="0" onClick={() => flushCamera({ ...DEFAULT_WHITEBOARD_CAMERA })}>{zoomPct}</button>
                <button
                  type="button"
                  className={cn(btn(false), 'inline-flex items-center justify-center')}
                  onClick={() => zoomBy(1.18)}
                  title={`${tr('Phóng to', 'Zoom in', '放大', '拡大', '확대')} (+)`}
                  aria-label={tr('Phóng to', 'Zoom in', '放大', '拡大', '확대')}
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" className={btn(state.grid)} title="G" onClick={toggleGrid}>{tr('Lưới', 'Grid', '网格', '格子', '격자')}</button>
                <button type="button" className={btn(state.ortho)} title="O" onClick={toggleOrtho}>{tr('Vuông', 'Ortho', '正交', '直角', '직교')}</button>
                {selectedIds.length > 0 ? (
                  <button type="button" className={btn(false)} title="Delete" onClick={removeSelected}>{tr('Xóa hình', 'Delete', '删除', '削除', '삭제')}</button>
                ) : null}
                <form
                  className="flex min-w-0 flex-1 items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addGraph()
                  }}
                >
                  <input
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                    className="h-7 min-w-0 flex-1 rounded border border-white/25 bg-black/30 px-2 text-[11px] text-white outline-none"
                    placeholder={tr('y=x^2  hoặc  y=sin(x)', 'y=x^2  or  y=sin(x)', 'y=x^2 或 y=sin(x)', 'y=x^2 または y=sin(x)', 'y=x^2 또는 y=sin(x)')}
                    aria-label={tr('Công thức đồ thị', 'Graph formula', '图像公式', 'グラフ式', '그래프 식')}
                  />
                  {(() => {
                    const graphs = state.objects.filter((item): item is WhiteboardGraph => item.kind === 'graph')
                    const host = graphs.find((item) => item.id === axisChoice)
                    const axisLabel = host
                      ? `${host.axis}=${host.expr}`
                      : tr('Độc lập', 'Separate', '独立', '独立', '독립')
                    return (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          className="inline-flex h-7 max-w-[7.5rem] items-center gap-0.5 rounded bg-white/15 px-1.5 text-[11px]"
                          aria-expanded={axisMenu}
                          aria-label={tr('Hệ trục', 'Axes', '坐标系', '座標', '좌표')}
                          title={tr('Chọn hệ trục', 'Choose axes', '选择坐标系', '座標を選ぶ', '좌표 선택')}
                          onClick={() => setAxisMenu((open) => !open)}
                        >
                          <span className="truncate">{axisLabel}</span>
                          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
                        </button>
                        {axisMenu ? (
                          <div className="absolute bottom-full right-0 z-30 mb-1 max-h-52 w-56 overflow-auto rounded-lg border border-white/20 bg-slate-900 py-1 text-left shadow-lg">
                            <button
                              type="button"
                              className={cn('block w-full px-2 py-1 text-left text-[11px] hover:bg-white/10', !host && 'bg-white/15')}
                              onClick={() => {
                                setAxisChoice('solo')
                                setAxisMenu(false)
                              }}
                            >
                              {tr('Độc lập', 'Separate', '独立', '独立', '독립')}
                            </button>
                            {graphs.map((graph) => (
                              <button
                                key={graph.id}
                                type="button"
                                className={cn('block w-full truncate px-2 py-1 text-left text-[11px] hover:bg-white/10', host?.id === graph.id && 'bg-white/15')}
                                onClick={() => {
                                  setAxisChoice(graph.id)
                                  setAxisMenu(false)
                                }}
                              >
                                {`${graph.axis}=${graph.expr}`}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                  <button type="submit" className="h-7 shrink-0 rounded bg-sky-500/90 px-2 text-[11px] font-medium text-slate-950">
                    {tr('Vẽ hàm', 'Plot', '绘图', '描画', '그리기')}
                  </button>
                </form>
              </div>
              {exprError ? <p className="px-1 text-center text-[11px] font-medium text-red-600">{exprError}</p> : null}
            </div>
          </>
        )}
        {triangleAsk ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-slate-900 shadow-2xl" role="dialog" aria-modal="true">
                  <p className="text-sm font-semibold">
                    {tr('Đây là tam giác gì?', 'What kind of triangle?', '这是哪种三角形？', 'どの三角形？', '어떤 삼각형?')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(['equilateral', 'isosceles', 'right', 'right-isosceles', 'scalene'] as TriangleKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        className={cn('rounded-full border px-2 py-1 text-[11px]', triKind === kind ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200')}
                        onClick={() => {
                          setTriKind(kind)
                          setTriSides((sides) => fillTriangleSides(kind, sides, 'ab'))
                          setTriError('')
                        }}
                      >
                        {triangleKindLabel(kind)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {tr('Đủ ba cạnh. Góc vuông tại C. Tam giác cân có AB = AC.', 'All three sides. Right angle at C. Isosceles means AB = AC.', '填满三边。直角在 C。等腰为 AB = AC。', '三辺を入力。直角は C。二等辺は AB = AC。', '세 변 모두. 직각은 C. 이등변은 AB = AC.')}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {(['ab', 'bc', 'ca'] as (keyof TriangleSides)[]).map((key) => (
                      <label key={key} className="text-[11px] font-medium">
                        {key.toUpperCase()}
                        <input
                          value={triSides[key]}
                          onChange={(e) => {
                            const next = fillTriangleSides(triKind, { ...triSides, [key]: e.target.value }, key)
                            setTriSides(next)
                            setTriError('')
                          }}
                          className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                          inputMode="decimal"
                        />
                      </label>
                    ))}
                  </div>
                  {triError ? <p className="mt-1 text-[11px] font-medium text-red-600">{triError}</p> : null}
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-slate-500"
                      onClick={() => {
                        commitObject({
                          kind: 'shape',
                          id: triangleAsk.id,
                          shape: 'triangle',
                          color: triangleAsk.color,
                          size: triangleAsk.size,
                          points: triangleAsk.corners,
                        })
                        setTriangleAsk(null)
                      }}
                    >
                      {tr('Giữ nét', 'Keep sketch', '保留草图', '下絵のまま', '스케치 유지')}
                    </button>
                    <button type="button" className="rounded bg-sky-600 px-3 py-1 text-[12px] font-medium text-white" onClick={confirmTriangle}>
                      {tr('Vẽ tam giác', 'Draw triangle', '画三角形', '三角形を描く', '삼각형 그리기')}
                    </button>
                  </div>
            </div>
          </div>
        ) : null}
        {lineAsk ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onPointerDown={(e) => e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-slate-900 shadow-2xl" role="dialog" aria-modal="true">
                  <p className="text-sm font-semibold">
                    {tr(
                      `Đường từ đỉnh ${triangleVertexName(lineAsk.vertex)} là đường gì?`,
                      `Which triangle line from ${triangleVertexName(lineAsk.vertex)}?`,
                      `从顶点 ${triangleVertexName(lineAsk.vertex)} 画哪条线？`,
                      `頂点 ${triangleVertexName(lineAsk.vertex)} からどの線？`,
                      `${triangleVertexName(lineAsk.vertex)}에서 어떤 선?`,
                    )}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-left text-[12px] font-medium hover:bg-slate-100"
                      onClick={keepArbitraryLine}
                    >
                      {tr('Đường bất kỳ', 'Arbitrary line', '任意直线', '任意の直線', '임의 직선')}
                    </button>
                    {TRIANGLE_LINE_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-[12px] hover:bg-slate-50"
                        onClick={() => chooseTriangleLine(role)}
                      >
                        {triangleLineLabel(role)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-[11px] text-slate-500"
                    onClick={() => setLineAsk(null)}
                  >
                    {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
                  </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function applyRemoteWhiteboard(
  state: WhiteboardState,
  msg: Record<string, unknown>,
): WhiteboardState {
  const type = typeof msg.type === 'string' ? msg.type : ''
  if (!isWhiteboardWireType(type)) return state
  return applyWhiteboardMessage(state, msg as WhiteboardWireMessage)
}

export { emptyWhiteboardState, DEFAULT_WHITEBOARD_CAMERA }
