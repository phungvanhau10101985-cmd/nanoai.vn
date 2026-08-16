'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crop, Eraser, ImagePlus, Loader2, PaintBucket, Sparkles, Sticker, Trash2, Type, Blend, Undo2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import { cropRegionToPrintSizeMm, formatMmSize, type FaceSizeMm } from '@/lib/packaging/face-crop-size'
import {
  exportFaceEditBlob,
  extractImageEdgeColors,
  mergeOutpaintWithOriginalRegion,
  type FaceEditCropRect,
  type FaceEditImageOverlay,
  type FaceEditOverlay,
  type FaceEditTextOverlay,
  type ImageEdgeColors,
} from '@/lib/packaging/face-edit-export'
import {
  cropHasGapExtensions,
  faceSizeAspectRatioLabel,
} from '@/lib/packaging/face-crop-gaps'
import {
  canvasToObjectUrl,
  clearMaskCanvas,
  cloneCanvas,
  compositeMagicErasePreview,
  createMaskCanvas,
  eraseStrokeOnCanvas,
  loadImageToCanvas,
  maskHasContent,
  paintCanvasToDisplay,
  paintRectOnMask,
  paintStrokeOnMask,
  restoreCanvasPixels,
  snapshotCanvasPixels,
} from '@/lib/packaging/face-edit-eraser'
import { magicInpaintCanvas, preloadMagicInpaintLibrary } from '@/lib/packaging/face-edit-magic-inpaint'
import { UI_MOCKUP_CREDIT } from '@/lib/hub-chat/hub-studio-types'
import {
  cssColorToHex,
  ThemeColorConfirmPicker,
} from '@/components/partner-website/partner-website-confirm-color-picker'

type CropEditTool = 'crop' | 'eraser' | 'magic'
type CropFrameMode = 'free' | 'print'
type MagicEraserMode = 'brush' | 'box'

export type HubStudioFaceCropLabels = {
  title: string
  save: string
  done: string
  cancel: string
  targetSize: string
  cropSize: string
  dragHint: string
  ratioLocked: string
  addText: string
  addImage: string
  addSticker: string
  overlayHint: string
  textPlaceholder: string
  textColor: string
  colorOk: string
  deleteLayer: string
  fillEdgeColor: string
  fillEdgeColorOff: string
  outpaintBackground: string
  outpaintBusy: string
  outpaintCredit: string
  outpaintNeedGaps: string
  blendSeams: string
  blendSeamsBusy: string
  eraser: string
  adjustCropFrame: string
  cropFrameModeFree: string
  cropFrameModePrint: string
  dragHintFree: string
  ratioFree: string
  eraserSize: string
  eraserUndo: string
  eraserUndoHint: string
  magicEraser: string
  magicEraserBusy: string
  magicEraserHint: string
  magicEraserModeBox: string
  magicEraserModeBrush: string
  magicEraserBoxHint: string
}

type CropRect = { x: number; y: number; width: number; height: number }
type DisplayCrop = { x: number; y: number; w: number; h: number }
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null
type OverlayDragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN_OVERLAY_N = 0.04

const MIN_CROP_PX = 24
const HANDLE = 10
const ERASER_UNDO_MAX = 20
const MIN_MAGIC_BOX_PX = 4

function toolClusterClass(active: boolean, tone: 'violet' | 'fuchsia'): string {
  if (!active) return 'inline-flex flex-wrap items-center gap-1 rounded-lg border border-transparent px-0.5 py-0.5'
  if (tone === 'fuchsia') {
    return 'inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-fuchsia-300 bg-fuchsia-50/70 px-1.5 py-1 dark:border-fuchsia-800 dark:bg-fuchsia-950/35'
  }
  return 'inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50/70 px-1.5 py-1 dark:border-violet-800 dark:bg-violet-950/35'
}

function subToolToggleClass(active: boolean, tone: 'violet' | 'fuchsia'): string {
  const base = 'h-7 px-2.5 text-xs shadow-sm'
  if (active) {
    return tone === 'fuchsia'
      ? `${base} border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-700`
      : `${base} border-violet-600 bg-violet-600 text-white hover:bg-violet-700`
  }
  return tone === 'fuchsia'
    ? `${base} border-fuchsia-300 bg-background text-fuchsia-900 hover:bg-fuchsia-50 dark:border-fuchsia-700 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950/40`
    : `${base} border-violet-300 bg-background text-violet-900 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950/40`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function initDisplayCropContainingImage(
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
  aspect: number
): DisplayCrop {
  let w = imgW
  let h = w / aspect
  if (h < imgH) {
    h = imgH
    w = h * aspect
  }
  const cx = imgX + imgW / 2
  const cy = imgY + imgH / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function layoutCropViewport(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
  aspect: number
): {
  w: number
  h: number
  scale: number
  imgW: number
  imgH: number
  offsetX: number
  offsetY: number
  crop: DisplayCrop
} {
  const maxScale = Math.min(maxW / naturalW, maxH / naturalH, 1)
  let lo = 0.05
  let hi = maxScale
  let best = tryLayoutCropScale(naturalW, naturalH, maxW, maxH, aspect, hi)

  if (!best.fits) {
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2
      const trial = tryLayoutCropScale(naturalW, naturalH, maxW, maxH, aspect, mid)
      if (trial.fits) {
        lo = mid
        best = trial
      } else {
        hi = mid
      }
    }
  }

  return {
    w: maxW,
    h: maxH,
    scale: best.s,
    imgW: best.imgW,
    imgH: best.imgH,
    offsetX: best.offsetX,
    offsetY: best.offsetY,
    crop: best.crop,
  }
}

function tryLayoutCropScale(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
  aspect: number,
  s: number
): {
  fits: boolean
  s: number
  imgW: number
  imgH: number
  offsetX: number
  offsetY: number
  crop: DisplayCrop
} {
  const imgW = naturalW * s
  const imgH = naturalH * s
  const offsetX = (maxW - imgW) / 2
  const offsetY = (maxH - imgH) / 2
  const crop = initDisplayCropContainingImage(offsetX, offsetY, imgW, imgH, aspect)
  const fits =
    crop.x >= -0.5 &&
    crop.y >= -0.5 &&
    crop.x + crop.w <= maxW + 0.5 &&
    crop.y + crop.h <= maxH + 0.5
  return { fits, s, imgW, imgH, offsetX, offsetY, crop }
}

function measureCropEditorViewport(el: HTMLElement): { maxW: number; maxH: number } {
  const fallbackH =
    typeof window !== 'undefined'
      ? Math.min(420, Math.max(220, Math.floor(window.innerHeight * 0.32)))
      : 320
  const measuredW = el.clientWidth
  const measuredH = el.clientHeight
  return {
    maxW: Math.max(280, measuredW > 0 ? measuredW : 320),
    maxH: Math.max(180, measuredH > 0 ? measuredH : fallbackH),
  }
}

function layoutCropInElement(
  naturalW: number,
  naturalH: number,
  viewportEl: HTMLElement,
  aspect: number
): ReturnType<typeof layoutCropViewport> {
  const { maxW, maxH } = measureCropEditorViewport(viewportEl)
  return layoutCropViewport(naturalW, naturalH, maxW, maxH, aspect)
}

function displayCropToNatural(
  crop: DisplayCrop,
  displayScale: number,
  imgOffsetX: number,
  imgOffsetY: number
): CropRect {
  return {
    x: (crop.x - imgOffsetX) / displayScale,
    y: (crop.y - imgOffsetY) / displayScale,
    width: crop.w / displayScale,
    height: crop.h / displayScale,
  }
}

function viewportToNaturalPoint(
  px: number,
  py: number,
  displayScale: number,
  imgOffsetX: number,
  imgOffsetY: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number } | null {
  const x = (px - imgOffsetX) / displayScale
  const y = (py - imgOffsetY) / displayScale
  if (x < 0 || y < 0 || x > naturalW || y > naturalH) return null
  return { x, y }
}

function viewportToNaturalClamped(
  px: number,
  py: number,
  displayScale: number,
  imgOffsetX: number,
  imgOffsetY: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number } {
  const x = clamp((px - imgOffsetX) / displayScale, 0, naturalW)
  const y = clamp((py - imgOffsetY) / displayScale, 0, naturalH)
  return { x, y }
}

function naturalToViewportBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displayScale: number,
  imgOffsetX: number,
  imgOffsetY: number
): { x: number; y: number; w: number; h: number } {
  const left = Math.min(x1, x2) * displayScale + imgOffsetX
  const top = Math.min(y1, y2) * displayScale + imgOffsetY
  const w = Math.abs(x2 - x1) * displayScale
  const h = Math.abs(y2 - y1) * displayScale
  return { x: left, y: top, w, h }
}

function hitHandle(crop: DisplayCrop, px: number, py: number): DragMode {
  const { x, y, w, h } = crop
  const r = HANDLE
  const near = (cx: number, cy: number) => Math.abs(px - cx) <= r && Math.abs(py - cy) <= r
  if (near(x, y)) return 'nw'
  if (near(x + w, y)) return 'ne'
  if (near(x, y + h)) return 'sw'
  if (near(x + w, y + h)) return 'se'
  if (px >= x && px <= x + w && py >= y && py <= y + h) return 'move'
  return null
}

function applyResize(
  start: DisplayCrop,
  mode: DragMode,
  dx: number,
  dy: number,
  bounds: { x: number; y: number; w: number; h: number },
  aspect: number
): DisplayCrop {
  if (mode === 'move') {
    const x = clamp(start.x + dx, bounds.x, bounds.x + bounds.w - start.w)
    const y = clamp(start.y + dy, bounds.y, bounds.y + bounds.h - start.h)
    return { x, y, w: start.w, h: start.h }
  }

  let anchorX = start.x
  let anchorY = start.y
  if (mode === 'sw') {
    anchorX = start.x + start.w
    anchorY = start.y
  } else if (mode === 'ne') {
    anchorX = start.x
    anchorY = start.y + start.h
  } else if (mode === 'nw') {
    anchorX = start.x + start.w
    anchorY = start.y + start.h
  }

  const growX = mode === 'se' || mode === 'ne' ? dx : -dx
  const growY = mode === 'se' || mode === 'sw' ? dy : -dy
  const delta = Math.abs(growX) >= Math.abs(growY) ? growX : growY / aspect

  let w = start.w + delta
  let h = w / aspect

  if (w < MIN_CROP_PX) {
    w = MIN_CROP_PX
    h = w / aspect
  }
  if (h < MIN_CROP_PX) {
    h = MIN_CROP_PX
    w = h * aspect
  }
  if (w > bounds.w) {
    w = bounds.w
    h = w / aspect
  }
  if (h > bounds.h) {
    h = bounds.h
    w = h * aspect
  }

  let x = anchorX
  let y = anchorY
  if (mode === 'sw' || mode === 'nw') x = anchorX - w
  if (mode === 'ne' || mode === 'nw') y = anchorY - h

  x = clamp(x, bounds.x, bounds.x + bounds.w - w)
  y = clamp(y, bounds.y, bounds.y + bounds.h - h)

  return { x, y, w, h }
}

function applyResizeFree(
  start: DisplayCrop,
  mode: DragMode,
  dx: number,
  dy: number,
  bounds: { x: number; y: number; w: number; h: number }
): DisplayCrop {
  if (mode === 'move') {
    const x = clamp(start.x + dx, bounds.x, bounds.x + bounds.w - start.w)
    const y = clamp(start.y + dy, bounds.y, bounds.y + bounds.h - start.h)
    return { x, y, w: start.w, h: start.h }
  }
  if (!mode) return start

  let { x, y, w, h } = start
  if (mode === 'se') {
    w = start.w + dx
    h = start.h + dy
  } else if (mode === 'ne') {
    y = start.y + dy
    w = start.w + dx
    h = start.h - dy
  } else if (mode === 'sw') {
    x = start.x + dx
    w = start.w - dx
    h = start.h + dy
  } else if (mode === 'nw') {
    x = start.x + dx
    y = start.y + dy
    w = start.w - dx
    h = start.h - dy
  }

  if (w < MIN_CROP_PX) {
    if (mode === 'nw' || mode === 'sw') x += w - MIN_CROP_PX
    w = MIN_CROP_PX
  }
  if (h < MIN_CROP_PX) {
    if (mode === 'nw' || mode === 'ne') y += h - MIN_CROP_PX
    h = MIN_CROP_PX
  }

  if (x < bounds.x) {
    w -= bounds.x - x
    x = bounds.x
  }
  if (y < bounds.y) {
    h -= bounds.y - y
    y = bounds.y
  }
  if (x + w > bounds.x + bounds.w) w = bounds.x + bounds.w - x
  if (y + h > bounds.y + bounds.h) h = bounds.y + bounds.h - y

  w = Math.max(MIN_CROP_PX, w)
  h = Math.max(MIN_CROP_PX, h)
  x = clamp(x, bounds.x, bounds.x + bounds.w - w)
  y = clamp(y, bounds.y, bounds.y + bounds.h - h)

  return { x, y, w, h }
}

function snapDisplayCropToAspect(
  crop: DisplayCrop,
  aspect: number,
  bounds: { x: number; y: number; w: number; h: number }
): DisplayCrop {
  const cx = crop.x + crop.w / 2
  const cy = crop.y + crop.h / 2
  let w = crop.w
  let h = crop.h
  const current = w / h
  if (current > aspect) w = h * aspect
  else h = w / aspect

  if (w > bounds.w) {
    w = bounds.w
    h = w / aspect
  }
  if (h > bounds.h) {
    h = bounds.h
    w = h * aspect
  }
  if (w < MIN_CROP_PX) {
    w = MIN_CROP_PX
    h = w / aspect
  }
  if (h < MIN_CROP_PX) {
    h = MIN_CROP_PX
    w = h * aspect
  }

  let x = cx - w / 2
  let y = cy - h / 2
  x = clamp(x, bounds.x, bounds.x + bounds.w - w)
  y = clamp(y, bounds.y, bounds.y + bounds.h - h)
  return { x, y, w, h }
}

function newId(): string {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function hitOverlay(
  overlays: FaceEditOverlay[],
  crop: DisplayCrop,
  px: number,
  py: number
): FaceEditOverlay | null {
  for (let i = overlays.length - 1; i >= 0; i--) {
    const o = overlays[i]!
    const box = overlayDisplayBox(o, crop)
    if (px >= box.lx && px <= box.lx + box.lw && py >= box.ly && py <= box.ly + box.lh) return o
  }
  return null
}

function overlayDisplayBox(
  o: FaceEditOverlay,
  crop: DisplayCrop
): { lx: number; ly: number; lw: number; lh: number } {
  const lx = crop.x + o.nx * crop.w
  const ly = crop.y + o.ny * crop.h
  if (o.kind === 'text') {
    const lh = o.fontSizeRatio * crop.h * 2.5
    const lw = Math.min(crop.w * 0.85, Math.max(40, o.text.length * o.fontSizeRatio * crop.h * 0.55))
    return { lx, ly, lw, lh }
  }
  return { lx, ly, lw: o.nw * crop.w, lh: o.nh * crop.h }
}

function hitImageOverlayHandle(
  layer: FaceEditImageOverlay,
  crop: DisplayCrop,
  px: number,
  py: number
): OverlayDragMode | null {
  const { lx, ly, lw, lh } = overlayDisplayBox(layer, crop)
  const r = HANDLE
  const near = (cx: number, cy: number) => Math.abs(px - cx) <= r && Math.abs(py - cy) <= r
  if (near(lx, ly)) return 'nw'
  if (near(lx + lw, ly)) return 'ne'
  if (near(lx, ly + lh)) return 'sw'
  if (near(lx + lw, ly + lh)) return 'se'
  if (px >= lx && px <= lx + lw && py >= ly && py <= ly + lh) return 'move'
  return null
}

/** Resize image/sticker overlay; keeps layer aspect (nw/nh ratio). */
function applyImageOverlayResize(
  start: { nx: number; ny: number; nw: number; nh: number },
  mode: OverlayDragMode,
  dxPx: number,
  dyPx: number,
  cropW: number,
  cropH: number
): { nx: number; ny: number; nw: number; nh: number } {
  if (mode === 'move') {
    return {
      nx: clamp(start.nx + dxPx / cropW, 0, 1 - start.nw),
      ny: clamp(start.ny + dyPx / cropH, 0, 1 - start.nh),
      nw: start.nw,
      nh: start.nh,
    }
  }

  const growX = mode === 'se' || mode === 'ne' ? dxPx / cropW : -dxPx / cropW
  const growY = mode === 'se' || mode === 'sw' ? dyPx / cropH : -dyPx / cropH
  const ratio = start.nw / start.nh
  const delta =
    Math.abs(growX * cropW) >= Math.abs(growY * cropH) ? growX : (growY * cropH) / cropW / ratio

  let nw = mode === 'sw' || mode === 'nw' ? start.nw - delta : start.nw + delta
  nw = Math.max(MIN_OVERLAY_N, nw)
  let nh = nw / ratio
  if (nh < MIN_OVERLAY_N) {
    nh = MIN_OVERLAY_N
    nw = nh * ratio
  }
  if (nw > 1) {
    nw = 1
    nh = nw / ratio
  }
  if (nh > 1) {
    nh = 1
    nw = nh * ratio
  }

  let nx = start.nx
  let ny = start.ny
  if (mode === 'sw' || mode === 'nw') nx = start.nx + (start.nw - nw)
  if (mode === 'ne' || mode === 'nw') ny = start.ny + (start.nh - nh)

  nx = clamp(nx, 0, 1 - nw)
  ny = clamp(ny, 0, 1 - nh)

  return { nx, ny, nw, nh }
}

export function HubStudioFaceCropDialog({
  open,
  onOpenChange,
  imageUrl,
  faceSizeMm,
  locale,
  labels,
  busy,
  onSave,
  onDone,
  onOutpaintGaps,
  foldGuideRatios,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  faceSizeMm: FaceSizeMm
  locale: WebLocale
  labels: HubStudioFaceCropLabels
  busy: boolean
  onSave: (blob: Blob, printSizeMm: FaceSizeMm) => void | Promise<void>
  onDone?: () => void
  onOutpaintGaps?: (blob: Blob, aspectRatio: string) => Promise<string | null>
  foldGuideRatios?: number[]
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const stickerInputRef = useRef<HTMLInputElement>(null)
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const displayImageCanvasRef = useRef<HTMLCanvasElement>(null)
  const magicMaskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const magicStrokeSourceRef = useRef<HTMLCanvasElement | null>(null)
  const eraserDragRef = useRef<{
    tool: 'eraser' | 'magic'
    mode?: MagicEraserMode
    last?: { x: number; y: number } | null
    start?: { x: number; y: number }
    dirty: boolean
  } | null>(null)
  const eraserUndoStackRef = useRef<ImageData[]>([])
  const mergedBlobUrlRef = useRef<string | null>(null)
  const outpaintMergeCacheRef = useRef<{
    aiUrl: string
    originalUrl: string
    crop: FaceEditCropRect
    featherPx: number
  } | null>(null)
  const [baseImageUrl, setBaseImageUrl] = useState(imageUrl)
  const [outpaintMergeReady, setOutpaintMergeReady] = useState(false)
  const [outpaintBusy, setOutpaintBusy] = useState(false)
  const [blendBusy, setBlendBusy] = useState(false)
  const [magicBusy, setMagicBusy] = useState(false)
  const [magicEraserMode, setMagicEraserMode] = useState<MagicEraserMode>('box')
  const [magicBoxPreview, setMagicBoxPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  )
  const [editTool, setEditTool] = useState<CropEditTool>('crop')
  const [cropFrameMode, setCropFrameMode] = useState<CropFrameMode>('print')
  const [eraserSize, setEraserSize] = useState(8)
  const [eraserUndoCount, setEraserUndoCount] = useState(0)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [display, setDisplay] = useState({
    w: 320,
    h: 180,
    scale: 1,
    imgW: 320,
    imgH: 180,
    offsetX: 0,
    offsetY: 0,
  })
  const [crop, setCrop] = useState<DisplayCrop>({ x: 0, y: 0, w: 100, h: 100 })
  const [overlays, setOverlays] = useState<FaceEditOverlay[]>([])
  const [fillGapsWithEdgeColor, setFillGapsWithEdgeColor] = useState(true)
  const [edgeColors, setEdgeColors] = useState<ImageEdgeColors | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragMode = useRef<DragMode>(null)
  const overlayDrag = useRef<{
    id: string
    mode: OverlayDragMode
    px: number
    py: number
    start: { nx: number; ny: number; nw: number; nh: number }
    /** Text-only move */
    nx?: number
    ny?: number
  } | null>(null)
  const dragStart = useRef({ x: 0, y: 0, crop: crop })

  const faceAspect = faceSizeMm.widthMm / faceSizeMm.heightMm
  const aspectValid = Number.isFinite(faceAspect) && faceAspect > 0

  const resetLayers = useCallback(() => {
    setOverlays([])
    setSelectedId(null)
  }, [])

  const clearEraserUndoStack = useCallback(() => {
    eraserUndoStackRef.current = []
    setEraserUndoCount(0)
  }, [])

  useEffect(() => {
    if (open) preloadMagicInpaintLibrary()
  }, [open])

  useEffect(() => {
    if (!open) {
      if (mergedBlobUrlRef.current) {
        URL.revokeObjectURL(mergedBlobUrlRef.current)
        mergedBlobUrlRef.current = null
      }
      return
    }
    resetLayers()
    setFillGapsWithEdgeColor(true)
    setEdgeColors(null)
    if (mergedBlobUrlRef.current) {
      URL.revokeObjectURL(mergedBlobUrlRef.current)
      mergedBlobUrlRef.current = null
    }
    outpaintMergeCacheRef.current = null
    setOutpaintMergeReady(false)
    setEditTool('crop')
    setCropFrameMode('print')
    setMagicEraserMode('box')
    setMagicBoxPreview(null)
    magicStrokeSourceRef.current = null
    magicMaskCanvasRef.current = null
    clearEraserUndoStack()
    editCanvasRef.current = null
    setBaseImageUrl(imageUrl)
  }, [imageUrl, open, resetLayers, clearEraserUndoStack])

  const repaintDisplayCanvas = useCallback(() => {
    const source = editCanvasRef.current
    const target = displayImageCanvasRef.current
    if (!source || !target) return
    if (
      editTool === 'magic' &&
      magicMaskCanvasRef.current &&
      eraserDragRef.current?.tool === 'magic'
    ) {
      compositeMagicErasePreview(
        source,
        magicMaskCanvasRef.current,
        target,
        display.imgW,
        display.imgH
      )
      return
    }
    paintCanvasToDisplay(source, target, display.imgW, display.imgH)
  }, [display.imgH, display.imgW, editTool])

  useEffect(() => {
    if (!open || !baseImageUrl) return
    let cancelled = false
    void loadImageToCanvas(baseImageUrl)
      .then((canvas) => {
        if (cancelled) return
        editCanvasRef.current = canvas
        if (
          !magicMaskCanvasRef.current ||
          magicMaskCanvasRef.current.width !== canvas.width ||
          magicMaskCanvasRef.current.height !== canvas.height
        ) {
          magicMaskCanvasRef.current = createMaskCanvas(canvas.width, canvas.height)
        } else {
          clearMaskCanvas(magicMaskCanvasRef.current)
        }
        repaintDisplayCanvas()
      })
      .catch(() => {
        editCanvasRef.current = null
      })
    return () => {
      cancelled = true
    }
  }, [baseImageUrl, open, repaintDisplayCanvas])

  useEffect(() => {
    if (!open || !baseImageUrl) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
      setEdgeColors(extractImageEdgeColors(img))
    }
    img.src = baseImageUrl
  }, [baseImageUrl, open])

  const applyViewportLayout = useCallback(
    (naturalW: number, naturalH: number) => {
      if (!viewportRef.current || !aspectValid) return
      const laid = layoutCropInElement(naturalW, naturalH, viewportRef.current, faceAspect)
      setDisplay({
        w: laid.w,
        h: laid.h,
        scale: laid.scale,
        imgW: laid.imgW,
        imgH: laid.imgH,
        offsetX: laid.offsetX,
        offsetY: laid.offsetY,
      })
      setCrop(laid.crop)
    },
    [aspectValid, faceAspect]
  )

  useEffect(() => {
    if (!open || !natural.w || !viewportRef.current || !aspectValid) return
    applyViewportLayout(natural.w, natural.h)
    const el = viewportRef.current
    const ro = new ResizeObserver(() => {
      applyViewportLayout(natural.w, natural.h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [applyViewportLayout, aspectValid, natural.h, natural.w, open])

  const viewportBounds = useMemo(() => ({ x: 0, y: 0, w: display.w, h: display.h }), [display.h, display.w])

  const activeToolHint = useMemo(() => {
    if (editTool === 'crop') {
      if (cropFrameMode === 'free') return `${labels.dragHintFree} ${labels.ratioFree}`
      return `${labels.dragHint} ${labels.ratioLocked.replace(
        '{size}',
        formatMmSize(locale, faceSizeMm.widthMm, faceSizeMm.heightMm)
      )}`
    }
    if (editTool === 'eraser') return labels.eraserUndoHint
    if (editTool === 'magic') {
      return magicEraserMode === 'box' ? labels.magicEraserBoxHint : labels.magicEraserHint
    }
    return null
  }, [
    cropFrameMode,
    editTool,
    faceSizeMm.heightMm,
    faceSizeMm.widthMm,
    labels.dragHint,
    labels.dragHintFree,
    labels.eraserUndoHint,
    labels.magicEraserBoxHint,
    labels.magicEraserHint,
    labels.ratioFree,
    labels.ratioLocked,
    locale,
    magicEraserMode,
  ])

  const handleCropFrameModeChange = useCallback(
    (mode: CropFrameMode) => {
      if (mode === cropFrameMode) return
      if (mode === 'print') {
        setCrop((prev) => snapDisplayCropToAspect(prev, faceAspect, viewportBounds))
      }
      setCropFrameMode(mode)
    },
    [cropFrameMode, faceAspect, viewportBounds]
  )

  const cropGapPreview = useMemo(() => {
    if (!fillGapsWithEdgeColor || !edgeColors) return []
    const imgL = display.offsetX
    const imgT = display.offsetY
    const imgR = imgL + display.imgW
    const imgB = imgT + display.imgH
    const gaps: { x: number; y: number; w: number; h: number; color: string }[] = []
    if (crop.x < imgL - 0.5) {
      gaps.push({ x: crop.x, y: crop.y, w: imgL - crop.x, h: crop.h, color: edgeColors.left })
    }
    if (crop.x + crop.w > imgR + 0.5) {
      gaps.push({ x: imgR, y: crop.y, w: crop.x + crop.w - imgR, h: crop.h, color: edgeColors.right })
    }
    const midL = Math.max(crop.x, imgL)
    const midR = Math.min(crop.x + crop.w, imgR)
    const midW = Math.max(0, midR - midL)
    if (midW > 0 && crop.y < imgT - 0.5) {
      gaps.push({ x: midL, y: crop.y, w: midW, h: imgT - crop.y, color: edgeColors.top })
    }
    if (midW > 0 && crop.y + crop.h > imgB + 0.5) {
      gaps.push({ x: midL, y: imgB, w: midW, h: crop.y + crop.h - imgB, color: edgeColors.bottom })
    }
    return gaps
  }, [crop, display.imgH, display.imgW, display.offsetX, display.offsetY, edgeColors, fillGapsWithEdgeColor])

  const cropNatural = useMemo(
    () => displayCropToNatural(crop, display.scale, display.offsetX, display.offsetY),
    [crop, display.offsetX, display.offsetY, display.scale]
  )

  const printSizeMm = useMemo(
    (): FaceSizeMm =>
      natural.w > 0
        ? cropRegionToPrintSizeMm(faceSizeMm, natural.w, natural.h, cropNatural)
        : faceSizeMm,
    [cropNatural, faceSizeMm, natural.h, natural.w]
  )

  const hasCropGaps = useMemo(
    () => cropHasGapExtensions(cropNatural, natural.w, natural.h),
    [cropNatural, natural.h, natural.w]
  )

  const applyMergedPreview = useCallback(
    async (mergedUrl: string) => {
      if (mergedBlobUrlRef.current) URL.revokeObjectURL(mergedBlobUrlRef.current)
      mergedBlobUrlRef.current = mergedUrl
      setBaseImageUrl(mergedUrl)

      const mergedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('load merged failed'))
        img.src = mergedUrl
      })
      const nw = mergedImg.naturalWidth
      const nh = mergedImg.naturalHeight
      setNatural({ w: nw, h: nh })
      setEdgeColors(extractImageEdgeColors(mergedImg))
      applyViewportLayout(nw, nh)
    },
    [applyViewportLayout, aspectValid]
  )

  const handleOutpaint = useCallback(async () => {
    if (!onOutpaintGaps || !hasCropGaps || outpaintBusy || busy) return
    setOutpaintBusy(true)
    const originalUrl = baseImageUrl
    const cropSnapshot = cropNatural
    const featherPx = 40
    try {
      const blob = await exportFaceEditBlob(originalUrl, cropSnapshot, [], {
        fillGapsWithEdgeColor: true,
      })
      const aiUrl = await onOutpaintGaps(blob, faceSizeAspectRatioLabel(faceSizeMm))
      if (!aiUrl) return
      outpaintMergeCacheRef.current = { aiUrl, originalUrl, crop: cropSnapshot, featherPx }
      const mergedUrl = await mergeOutpaintWithOriginalRegion(aiUrl, originalUrl, cropSnapshot, {
        featherPx,
        seamHealPx: 24,
      })
      await applyMergedPreview(mergedUrl)
      setOutpaintMergeReady(true)
      clearEraserUndoStack()
    } finally {
      setOutpaintBusy(false)
    }
  }, [
    applyMergedPreview,
    baseImageUrl,
    busy,
    cropNatural,
    faceSizeMm,
    hasCropGaps,
    onOutpaintGaps,
    outpaintBusy,
    clearEraserUndoStack,
  ])

  const handleBlendSeams = useCallback(async () => {
    const cache = outpaintMergeCacheRef.current
    if (!cache || blendBusy || busy || outpaintBusy) return
    setBlendBusy(true)
    try {
      cache.featherPx = Math.min(96, cache.featherPx + 16)
      const seamHealPx = Math.min(56, 16 + cache.featherPx)
      const mergedUrl = await mergeOutpaintWithOriginalRegion(
        cache.aiUrl,
        cache.originalUrl,
        cache.crop,
        { featherPx: cache.featherPx, seamHealPx }
      )
      await applyMergedPreview(mergedUrl)
      clearEraserUndoStack()
    } finally {
      setBlendBusy(false)
    }
  }, [applyMergedPreview, blendBusy, busy, clearEraserUndoStack, outpaintBusy])

  const commitEraserEdit = useCallback(async () => {
    const canvas = editCanvasRef.current
    if (!canvas) return
    try {
      const url = await canvasToObjectUrl(canvas)
      if (mergedBlobUrlRef.current) URL.revokeObjectURL(mergedBlobUrlRef.current)
      mergedBlobUrlRef.current = url
      outpaintMergeCacheRef.current = null
      setOutpaintMergeReady(false)
      setBaseImageUrl(url)
    } catch {
      /* ignore export failure */
    }
  }, [])

  const eraserRadiusNatural = useMemo(() => Math.max(2, eraserSize), [eraserSize])

  const enterCropFrameMode = useCallback(() => {
    if (eraserDragRef.current?.dirty && eraserDragRef.current.tool === 'eraser') void commitEraserEdit()
    eraserDragRef.current = null
    magicStrokeSourceRef.current = null
    if (magicMaskCanvasRef.current) clearMaskCanvas(magicMaskCanvasRef.current)
    setMagicBoxPreview(null)
    setEditTool('crop')
    repaintDisplayCanvas()
  }, [commitEraserEdit, repaintDisplayCanvas])

  const handleEraserUndo = useCallback(() => {
    const canvas = editCanvasRef.current
    const stack = eraserUndoStackRef.current
    if (!canvas || stack.length === 0) return
    eraserDragRef.current = null
    magicStrokeSourceRef.current = null
    if (magicMaskCanvasRef.current) clearMaskCanvas(magicMaskCanvasRef.current)
    setMagicBoxPreview(null)
    const snapshot = stack.pop()!
    restoreCanvasPixels(canvas, snapshot)
    repaintDisplayCanvas()
    setEraserUndoCount(stack.length)
    void commitEraserEdit()
  }, [commitEraserEdit, repaintDisplayCanvas])

  const ensureMagicMaskCanvas = useCallback((): HTMLCanvasElement | null => {
    const edit = editCanvasRef.current
    if (!edit) return null
    if (
      !magicMaskCanvasRef.current ||
      magicMaskCanvasRef.current.width !== edit.width ||
      magicMaskCanvasRef.current.height !== edit.height
    ) {
      magicMaskCanvasRef.current = createMaskCanvas(edit.width, edit.height)
    }
    return magicMaskCanvasRef.current
  }, [])

  const finishMagicStroke = useCallback(
    (inpaintRadius = eraserRadiusNatural) => {
      const mask = magicMaskCanvasRef.current
      const source = magicStrokeSourceRef.current
      if (!mask || !source || !maskHasContent(mask)) {
        magicStrokeSourceRef.current = null
        if (mask) clearMaskCanvas(mask)
        setMagicBoxPreview(null)
        repaintDisplayCanvas()
        return
      }
      setMagicBusy(true)
      requestAnimationFrame(() => {
        try {
          const resultCanvas = magicInpaintCanvas(source, mask, inpaintRadius)
          const target = editCanvasRef.current
          if (target) {
            const ctx = target.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, target.width, target.height)
              ctx.drawImage(resultCanvas, 0, 0)
            }
          } else {
            editCanvasRef.current = resultCanvas
          }
          outpaintMergeCacheRef.current = null
          setOutpaintMergeReady(false)
          void commitEraserEdit()
        } catch {
          handleEraserUndo()
        } finally {
          magicStrokeSourceRef.current = null
          clearMaskCanvas(mask)
          setMagicBoxPreview(null)
          setMagicBusy(false)
          repaintDisplayCanvas()
        }
      })
    },
    [commitEraserEdit, eraserRadiusNatural, handleEraserUndo, repaintDisplayCanvas]
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (eraserUndoStackRef.current.length === 0) return
        e.preventDefault()
        handleEraserUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleEraserUndo, open])

  const selectedText = overlays.find(
    (o): o is FaceEditTextOverlay => o.id === selectedId && o.kind === 'text'
  )

  const addTextLayer = () => {
    const layer: FaceEditTextOverlay = {
      id: newId(),
      kind: 'text',
      nx: 0.08,
      ny: 0.08,
      text: labels.textPlaceholder,
      fontSizeRatio: 0.06,
      color: '#1e1b4b',
    }
    setOverlays((prev) => [...prev, layer])
    setSelectedId(layer.id)
  }

  const addImageLayer = (file: File, kind: 'image' | 'sticker') => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const imgAspect = img.naturalWidth / img.naturalHeight || 1
      const baseW = kind === 'sticker' ? 0.18 : 0.28
      const nw = baseW
      const nh = (baseW * crop.w) / (imgAspect * crop.h)
      const layer: FaceEditImageOverlay = {
        id: newId(),
        kind,
        nx: 0.1,
        ny: 0.1,
        nw: Math.min(nw, 0.9),
        nh: Math.min(Math.max(nh, MIN_OVERLAY_N), 0.9),
        src: url,
      }
      setOverlays((prev) => [...prev, layer])
      setSelectedId(layer.id)
    }
    img.src = url
  }

  const removeSelected = () => {
    if (!selectedId) return
    setOverlays((prev) => {
      const removed = prev.find((o) => o.id === selectedId)
      if (removed && (removed.kind === 'image' || removed.kind === 'sticker')) {
        URL.revokeObjectURL(removed.src)
      }
      return prev.filter((o) => o.id !== selectedId)
    })
    setSelectedId(null)
  }

  const updateSelectedText = (text: string) => {
    if (!selectedId) return
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedId && o.kind === 'text' ? { ...o, text } : o))
    )
  }

  const updateSelectedTextColor = (color: string) => {
    if (!selectedId) return
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedId && o.kind === 'text' ? { ...o, color } : o))
    )
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    if (
      (editTool === 'eraser' || editTool === 'magic') &&
      !magicBusy &&
      !busy &&
      editCanvasRef.current &&
      natural.w > 0
    ) {
      const useBox = editTool === 'magic' && magicEraserMode === 'box'
      const nat = useBox
        ? viewportToNaturalClamped(
            px,
            py,
            display.scale,
            display.offsetX,
            display.offsetY,
            natural.w,
            natural.h
          )
        : viewportToNaturalPoint(
            px,
            py,
            display.scale,
            display.offsetX,
            display.offsetY,
            natural.w,
            natural.h
          )
      if (!nat) return
      e.preventDefault()
      const snapshot = snapshotCanvasPixels(editCanvasRef.current)
      if (snapshot) {
        eraserUndoStackRef.current.push(snapshot)
        if (eraserUndoStackRef.current.length > ERASER_UNDO_MAX) {
          eraserUndoStackRef.current.shift()
        }
        setEraserUndoCount(eraserUndoStackRef.current.length)
      }
      if (editTool === 'magic') {
        magicStrokeSourceRef.current = cloneCanvas(editCanvasRef.current)
        const maskCanvas = ensureMagicMaskCanvas()
        if (maskCanvas) clearMaskCanvas(maskCanvas)
        if (useBox) {
          eraserDragRef.current = { tool: 'magic', mode: 'box', start: nat, dirty: false }
          setMagicBoxPreview(
            naturalToViewportBox(nat.x, nat.y, nat.x, nat.y, display.scale, display.offsetX, display.offsetY)
          )
        } else if (maskCanvas) {
          paintStrokeOnMask(maskCanvas, null, nat, eraserRadiusNatural)
          eraserDragRef.current = { tool: 'magic', mode: 'brush', last: nat, dirty: true }
        }
        repaintDisplayCanvas()
      } else {
        eraseStrokeOnCanvas(editCanvasRef.current, null, nat, eraserRadiusNatural)
        eraserDragRef.current = { last: nat, dirty: true, tool: 'eraser' }
        repaintDisplayCanvas()
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    const selectedImage = overlays.find(
      (o): o is FaceEditImageOverlay =>
        o.id === selectedId && (o.kind === 'image' || o.kind === 'sticker')
    )
    if (selectedImage) {
      const handle = hitImageOverlayHandle(selectedImage, crop, px, py)
      if (handle) {
        e.preventDefault()
        overlayDrag.current = {
          id: selectedImage.id,
          mode: handle,
          px,
          py,
          start: {
            nx: selectedImage.nx,
            ny: selectedImage.ny,
            nw: selectedImage.nw,
            nh: selectedImage.nh,
          },
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }

    const hit = hitOverlay(overlays, crop, px, py)
    if (hit) {
      e.preventDefault()
      setSelectedId(hit.id)
      if (hit.kind === 'text') {
        overlayDrag.current = {
          id: hit.id,
          mode: 'move',
          px,
          py,
          start: { nx: hit.nx, ny: hit.ny, nw: 0, nh: 0 },
          nx: hit.nx,
          ny: hit.ny,
        }
      } else {
        overlayDrag.current = {
          id: hit.id,
          mode: 'move',
          px,
          py,
          start: { nx: hit.nx, ny: hit.ny, nw: hit.nw, nh: hit.nh },
        }
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    setSelectedId(null)
    if (editTool !== 'crop') return
    const mode = hitHandle(crop, px, py)
    if (!mode) return
    e.preventDefault()
    dragMode.current = mode
    dragStart.current = { x: e.clientX, y: e.clientY, crop: { ...crop } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    if (eraserDragRef.current && editCanvasRef.current && natural.w > 0) {
      const drag = eraserDragRef.current
      const useBox = drag.tool === 'magic' && drag.mode === 'box'
      const nat = useBox
        ? viewportToNaturalClamped(
            px,
            py,
            display.scale,
            display.offsetX,
            display.offsetY,
            natural.w,
            natural.h
          )
        : viewportToNaturalPoint(
            px,
            py,
            display.scale,
            display.offsetX,
            display.offsetY,
            natural.w,
            natural.h
          )
      if (!nat) return
      if (drag.tool === 'magic') {
        const maskCanvas = ensureMagicMaskCanvas()
        if (!maskCanvas) return
        if (useBox && drag.start) {
          clearMaskCanvas(maskCanvas)
          paintRectOnMask(maskCanvas, drag.start.x, drag.start.y, nat.x, nat.y)
          const boxW = Math.abs(nat.x - drag.start.x)
          const boxH = Math.abs(nat.y - drag.start.y)
          drag.dirty = boxW >= MIN_MAGIC_BOX_PX && boxH >= MIN_MAGIC_BOX_PX
          setMagicBoxPreview(
            naturalToViewportBox(
              drag.start.x,
              drag.start.y,
              nat.x,
              nat.y,
              display.scale,
              display.offsetX,
              display.offsetY
            )
          )
        } else if (drag.last) {
          paintStrokeOnMask(maskCanvas, drag.last, nat, eraserRadiusNatural)
          drag.dirty = true
        }
      } else if (drag.last) {
        eraseStrokeOnCanvas(editCanvasRef.current, drag.last, nat, eraserRadiusNatural)
        drag.dirty = true
      }
      if (!useBox) drag.last = nat
      repaintDisplayCanvas()
      return
    }

    if (overlayDrag.current) {
      const d = overlayDrag.current
      const layer = overlays.find((o) => o.id === d.id)
      if (layer?.kind === 'text' && d.mode === 'move') {
        const dx = (px - d.px) / crop.w
        const dy = (py - d.py) / crop.h
        const nx = clamp((d.nx ?? layer.nx) + dx, 0, 0.95)
        const ny = clamp((d.ny ?? layer.ny) + dy, 0, 0.95)
        setOverlays((prev) => prev.map((o) => (o.id === d.id ? { ...o, nx, ny } : o)))
        return
      }
      if (layer && (layer.kind === 'image' || layer.kind === 'sticker')) {
        const dxPx = px - d.px
        const dyPx = py - d.py
        const next = applyImageOverlayResize(d.start, d.mode, dxPx, dyPx, crop.w, crop.h)
        setOverlays((prev) =>
          prev.map((o) =>
            o.id === d.id && (o.kind === 'image' || o.kind === 'sticker') ? { ...o, ...next } : o
          )
        )
      }
      return
    }

    if (!dragMode.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setCrop(
      cropFrameMode === 'print'
        ? applyResize(dragStart.current.crop, dragMode.current, dx, dy, viewportBounds, faceAspect)
        : applyResizeFree(dragStart.current.crop, dragMode.current, dx, dy, viewportBounds)
    )
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const eraserDrag = eraserDragRef.current
    const eraserDirty = eraserDrag?.dirty
    const eraserTool = eraserDrag?.tool
    const eraserMagicMode = eraserDrag?.mode
    eraserDragRef.current = null
    if (eraserDirty && eraserTool === 'magic') {
      const boxNaturalW = (magicBoxPreview?.w ?? 0) / display.scale
      const boxNaturalH = (magicBoxPreview?.h ?? 0) / display.scale
      const inpaintRadius =
        eraserMagicMode === 'box'
          ? Math.max(
              eraserRadiusNatural,
              Math.min(48, Math.round(Math.min(boxNaturalW, boxNaturalH) / 4))
            )
          : eraserRadiusNatural
      finishMagicStroke(inpaintRadius)
    } else if (eraserTool === 'magic' && eraserMagicMode === 'box') {
      magicStrokeSourceRef.current = null
      if (magicMaskCanvasRef.current) clearMaskCanvas(magicMaskCanvasRef.current)
      setMagicBoxPreview(null)
      if (eraserUndoStackRef.current.length > 0) {
        eraserUndoStackRef.current.pop()
        setEraserUndoCount(eraserUndoStackRef.current.length)
      }
      repaintDisplayCanvas()
    } else if (eraserDirty && eraserTool === 'eraser') void commitEraserEdit()

    dragMode.current = null
    overlayDrag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const applyFaceEdit = useCallback(async () => {
    if (eraserDragRef.current?.dirty && eraserDragRef.current.tool === 'eraser') {
      await commitEraserEdit()
    }
    eraserDragRef.current = null
    const blob = await exportFaceEditBlob(baseImageUrl, cropNatural, overlays, {
      fillGapsWithEdgeColor: fillGapsWithEdgeColor,
    })
    await onSave(blob, printSizeMm)
  }, [baseImageUrl, commitEraserEdit, cropNatural, fillGapsWithEdgeColor, onSave, overlays, printSizeMm])

  const handleApply = useCallback(async () => {
    await applyFaceEdit()
  }, [applyFaceEdit])

  const handleDone = useCallback(async () => {
    await applyFaceEdit()
    if (onDone) onDone()
    else onOpenChange(false)
  }, [applyFaceEdit, onDone, onOpenChange])

  const handleClass =
    'absolute z-20 h-3 w-3 rounded-sm border-2 border-white bg-violet-600 shadow pointer-events-none'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92dvh,900px)] max-h-[92dvh] w-[min(98vw,1440px)] max-w-[98vw] flex-col gap-2 overflow-hidden p-3 sm:gap-3 sm:p-4">
        <DialogHeader className="shrink-0 space-y-0">
          <DialogTitle className="flex items-center gap-2 pr-8 text-base">
            <Crop className="h-4 w-4 shrink-0" />
            {labels.title}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[min(28vh,240px)] shrink-0 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={addTextLayer}>
              <Type className="mr-1 h-3.5 w-3.5" />
              {labels.addText}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" />
              {labels.addImage}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => stickerInputRef.current?.click()}
            >
              <Sticker className="mr-1 h-3.5 w-3.5" />
              {labels.addSticker}
            </Button>
            {selectedId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs text-red-700"
                onClick={removeSelected}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {labels.deleteLayer}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={fillGapsWithEdgeColor ? 'default' : 'outline'}
              className={`h-8 text-xs ${fillGapsWithEdgeColor ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
              onClick={() => setFillGapsWithEdgeColor((v) => !v)}
            >
              <PaintBucket className="mr-1 h-3.5 w-3.5" />
              {fillGapsWithEdgeColor ? labels.fillEdgeColor : labels.fillEdgeColorOff}
            </Button>
            {onOutpaintGaps ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-violet-300 text-xs text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
                disabled={busy || outpaintBusy || !hasCropGaps}
                title={!hasCropGaps ? labels.outpaintNeedGaps : labels.outpaintCredit.replace('{n}', String(UI_MOCKUP_CREDIT))}
                onClick={() => void handleOutpaint()}
              >
                {outpaintBusy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                )}
                {outpaintBusy ? labels.outpaintBusy : labels.outpaintBackground}
              </Button>
            ) : null}
            {outpaintMergeReady ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                disabled={busy || outpaintBusy || blendBusy}
                onClick={() => void handleBlendSeams()}
              >
                {blendBusy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Blend className="mr-1 h-3.5 w-3.5" />
                )}
                {blendBusy ? labels.blendSeamsBusy : labels.blendSeams}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={toolClusterClass(editTool === 'crop', 'violet')}>
              <Button
                type="button"
                size="sm"
                variant={editTool === 'crop' ? 'default' : 'outline'}
                className={`h-8 text-xs ${editTool === 'crop' ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                disabled={busy || outpaintBusy || blendBusy || magicBusy || !natural.w}
                onClick={enterCropFrameMode}
              >
                <Crop className="mr-1 h-3.5 w-3.5" />
                {labels.adjustCropFrame}
              </Button>
              {editTool === 'crop' ? (
                <div className="inline-flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={subToolToggleClass(cropFrameMode === 'print', 'violet')}
                    disabled={busy || outpaintBusy || blendBusy || magicBusy || !natural.w}
                    onClick={() => handleCropFrameModeChange('print')}
                  >
                    {labels.cropFrameModePrint}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={subToolToggleClass(cropFrameMode === 'free', 'violet')}
                    disabled={busy || outpaintBusy || blendBusy || magicBusy || !natural.w}
                    onClick={() => handleCropFrameModeChange('free')}
                  >
                    {labels.cropFrameModeFree}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className={toolClusterClass(editTool === 'eraser', 'violet')}>
              <Button
                type="button"
                size="sm"
                variant={editTool === 'eraser' ? 'default' : 'outline'}
                className={`h-8 text-xs ${editTool === 'eraser' ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                disabled={busy || outpaintBusy || blendBusy || magicBusy || !natural.w}
                onClick={() => setEditTool('eraser')}
              >
                <Eraser className="mr-1 h-3.5 w-3.5" />
                {labels.eraser}
              </Button>
              {editTool === 'eraser' ? (
                <div className="flex min-w-[140px] items-center gap-1.5">
                  <input
                    type="range"
                    min={2}
                    max={36}
                    step={1}
                    value={eraserSize}
                    onChange={(e) => setEraserSize(Number(e.target.value))}
                    className="h-2 w-24 flex-1 accent-violet-600 sm:w-28"
                    aria-label={labels.eraserSize}
                    disabled={magicBusy}
                  />
                  <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {eraserSize}px
                  </span>
                </div>
              ) : null}
            </div>

            <div className={toolClusterClass(editTool === 'magic', 'fuchsia')}>
              <Button
                type="button"
                size="sm"
                variant={editTool === 'magic' ? 'default' : 'outline'}
                className={`h-8 border-fuchsia-300 text-xs ${editTool === 'magic' ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : 'text-fuchsia-800 hover:bg-fuchsia-50 dark:border-fuchsia-800 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950/40'}`}
                disabled={busy || outpaintBusy || blendBusy || magicBusy || !natural.w}
                onClick={() => {
                  preloadMagicInpaintLibrary()
                  setEditTool('magic')
                }}
              >
                {magicBusy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 h-3.5 w-3.5" />
                )}
                {magicBusy ? labels.magicEraserBusy : labels.magicEraser}
              </Button>
              {editTool === 'magic' ? (
                <>
                  <div className="inline-flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={subToolToggleClass(magicEraserMode === 'box', 'fuchsia')}
                      disabled={magicBusy}
                      onClick={() => setMagicEraserMode('box')}
                    >
                      {labels.magicEraserModeBox}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={subToolToggleClass(magicEraserMode === 'brush', 'fuchsia')}
                      disabled={magicBusy}
                      onClick={() => setMagicEraserMode('brush')}
                    >
                      {labels.magicEraserModeBrush}
                    </Button>
                  </div>
                  {magicEraserMode === 'brush' ? (
                    <div className="flex min-w-[120px] items-center gap-1.5">
                      <input
                        type="range"
                        min={2}
                        max={36}
                        step={1}
                        value={eraserSize}
                        onChange={(e) => setEraserSize(Number(e.target.value))}
                        className="h-2 w-20 flex-1 accent-fuchsia-600 sm:w-24"
                        aria-label={labels.eraserSize}
                        disabled={magicBusy}
                      />
                      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {eraserSize}px
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={busy || outpaintBusy || blendBusy || magicBusy || eraserUndoCount === 0}
              title={labels.eraserUndoHint}
              onClick={() => handleEraserUndo()}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              {labels.eraserUndo}
            </Button>
          </div>

          {activeToolHint ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground dark:border-slate-700 dark:bg-slate-900/50">
              {activeToolHint}
            </p>
          ) : null}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) addImageLayer(f, 'image')
              e.target.value = ''
            }}
          />
          <input
            ref={stickerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) addImageLayer(f, 'sticker')
              e.target.value = ''
            }}
          />
        </div>

        {selectedText ? (
          <div className="flex shrink-0 items-center gap-2">
            <Input
              value={selectedText.text}
              onChange={(e) => updateSelectedText(e.target.value)}
              className="h-9 text-sm"
              placeholder={labels.textPlaceholder}
            />
            <ThemeColorConfirmPicker
              value={cssColorToHex(selectedText.color, '#111827')}
              okLabel={labels.colorOk}
              onConfirm={(color) => updateSelectedTextColor(color)}
            />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <div
            ref={viewportRef}
            className="flex min-h-0 w-full flex-1 items-center justify-center overflow-auto"
          >
            <div
              className="relative touch-none select-none overflow-hidden rounded-lg border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-900"
              style={{
                width: display.w,
                height: display.h,
                cursor: editTool === 'eraser' || editTool === 'magic' ? 'crosshair' : 'default',
                pointerEvents: magicBusy ? 'none' : 'auto',
                opacity: magicBusy ? 0.72 : 1,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
            {cropGapPreview.map((gap, i) => (
              <div
                key={`gap-${i}`}
                className="pointer-events-none absolute z-[5]"
                style={{ left: gap.x, top: gap.y, width: gap.w, height: gap.h, backgroundColor: gap.color }}
              />
            ))}
            <canvas
              ref={displayImageCanvasRef}
              className="pointer-events-none absolute z-[6] block"
              style={{
                left: display.offsetX,
                top: display.offsetY,
                width: display.imgW,
                height: display.imgH,
              }}
            />

            {overlays.map((layer) => {
              const left = crop.x + layer.nx * crop.w
              const top = crop.y + layer.ny * crop.h
              const selected = layer.id === selectedId
              if (layer.kind === 'text') {
                const fontPx = Math.max(10, layer.fontSizeRatio * crop.h)
                return (
                  <div
                    key={layer.id}
                    className={`absolute z-[15] cursor-move whitespace-pre-wrap px-0.5 ${selected ? 'ring-2 ring-violet-500' : ''}`}
                    style={{
                      left,
                      top,
                      maxWidth: crop.w * 0.9,
                      fontSize: fontPx,
                      color: layer.color,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      pointerEvents: 'none',
                    }}
                  >
                    {layer.text}
                  </div>
                )
              }
              return (
                <div key={layer.id} className="absolute z-[15]" style={{ left, top, width: layer.nw * crop.w, height: layer.nh * crop.h }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={layer.src}
                    alt=""
                    draggable={false}
                    className={`h-full w-full object-contain ${selected ? 'ring-2 ring-violet-500' : ''}`}
                    style={{ pointerEvents: 'none' }}
                  />
                  {selected ? (
                    <>
                      <div className={`${handleClass} -left-1.5 -top-1.5`} />
                      <div className={`${handleClass} -right-1.5 -top-1.5`} />
                      <div className={`${handleClass} -bottom-1.5 -left-1.5`} />
                      <div className={`${handleClass} -bottom-1.5 -right-1.5`} />
                    </>
                  ) : null}
                </div>
              )
            })}

            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-0 top-0 bg-black/45" style={{ width: display.w, height: crop.y }} />
              <div
                className="absolute left-0 bg-black/45"
                style={{ top: crop.y + crop.h, width: display.w, height: display.h - crop.y - crop.h }}
              />
              <div
                className="absolute left-0 bg-black/45"
                style={{ top: crop.y, width: crop.x, height: crop.h }}
              />
              <div
                className="absolute bg-black/45"
                style={{ left: crop.x + crop.w, top: crop.y, width: display.w - crop.x - crop.w, height: crop.h }}
              />
            </div>

            <div
              className="pointer-events-none absolute z-10 box-border border-2 border-red-500 ring-1 ring-white/80"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
            >
              {foldGuideRatios?.map((ratio) => (
                <span
                  key={ratio}
                  className="absolute inset-y-0 border-l border-dashed border-cyan-300"
                  style={{ left: `${ratio * 100}%` }}
                />
              ))}
              <div className={`${handleClass} -left-1.5 -top-1.5`} />
              <div className={`${handleClass} -right-1.5 -top-1.5`} />
              <div className={`${handleClass} -bottom-1.5 -left-1.5`} />
              <div className={`${handleClass} -bottom-1.5 -right-1.5`} />
            </div>
            {magicBusy ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/35 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="px-3 text-center text-xs font-medium">{labels.magicEraserBusy}</p>
              </div>
            ) : null}
            {magicBoxPreview && magicBoxPreview.w > 0 && magicBoxPreview.h > 0 ? (
              <div
                className="pointer-events-none absolute z-[25] box-border border-2 border-dashed border-fuchsia-400 bg-fuchsia-400/10"
                style={{
                  left: magicBoxPreview.x,
                  top: magicBoxPreview.y,
                  width: magicBoxPreview.w,
                  height: magicBoxPreview.h,
                }}
              />
            ) : null}
          </div>
          </div>
          <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">{labels.overlayHint}</p>
        </div>

        <div className="shrink-0 space-y-2 border-t bg-background pt-2">
          <div className="rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/30 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <p className="text-xs text-muted-foreground">
              {labels.targetSize.replace(
                '{size}',
                formatMmSize(locale, faceSizeMm.widthMm, faceSizeMm.heightMm)
              )}
            </p>
            <p className="mt-1 font-medium text-violet-900 dark:text-violet-100 sm:mt-0">
              {labels.cropSize.replace(
                '{size}',
                formatMmSize(locale, printSizeMm.widthMm, printSizeMm.heightMm)
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:mt-0">
              {Math.round(cropNatural.width)} × {Math.round(cropNatural.height)} px
            </p>
          </div>

          <DialogFooter className="gap-2 pb-[max(0px,env(safe-area-inset-bottom))] sm:gap-0">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              {labels.cancel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-violet-300 text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
              disabled={busy || !natural.w || !aspectValid}
              onClick={() => void handleApply()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {labels.save}
            </Button>
            <Button
              type="button"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={busy || !natural.w || !aspectValid}
              onClick={() => void handleDone()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {labels.done}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
