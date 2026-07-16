'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crop, ImagePlus, Loader2, Sticker, Trash2, Type } from 'lucide-react'
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
  type FaceEditImageOverlay,
  type FaceEditOverlay,
  type FaceEditTextOverlay,
} from '@/lib/packaging/face-edit-export'

export type HubStudioFaceCropLabels = {
  title: string
  save: string
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
  deleteLayer: string
}

type CropRect = { x: number; y: number; width: number; height: number }
type DisplayCrop = { x: number; y: number; w: number; h: number }
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null
type OverlayDragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const MIN_OVERLAY_N = 0.04

const MIN_CROP_PX = 24
const HANDLE = 10

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function fitImageSize(nw: number, nh: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / nw, maxH / nh, 1)
  const imgW = Math.round(nw * scale)
  const imgH = Math.round(nh * scale)
  const offsetX = Math.round((maxW - imgW) / 2)
  const offsetY = Math.round((maxH - imgH) / 2)
  return { w: maxW, h: maxH, scale, imgW, imgH, offsetX, offsetY }
}

function initDisplayCrop(
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
  aspect: number
): DisplayCrop {
  let w = imgW * 0.92
  let h = w / aspect
  if (h > imgH * 0.92) {
    h = imgH * 0.92
    w = h * aspect
  }
  return { x: imgX + (imgW - w) / 2, y: imgY + (imgH - h) / 2, w, h }
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  faceSizeMm: FaceSizeMm
  locale: WebLocale
  labels: HubStudioFaceCropLabels
  busy: boolean
  onSave: (blob: Blob, printSizeMm: FaceSizeMm) => void | Promise<void>
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const stickerInputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (!open) return
    resetLayers()
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageUrl
  }, [imageUrl, open, resetLayers])

  useEffect(() => {
    if (!open || !natural.w || !viewportRef.current || !aspectValid) return
    const maxW = Math.min(viewportRef.current.clientWidth || 420, 420)
    const fitted = fitImageSize(natural.w, natural.h, maxW, 360)
    setDisplay(fitted)
    setCrop(initDisplayCrop(fitted.offsetX, fitted.offsetY, fitted.imgW, fitted.imgH, faceAspect))
  }, [natural.w, natural.h, open, faceAspect, aspectValid])

  const imgBounds = useMemo(
    () => ({ x: display.offsetX, y: display.offsetY, w: display.imgW, h: display.imgH }),
    [display.imgH, display.imgW, display.offsetX, display.offsetY]
  )

  const cropNatural = useMemo(
    () => displayCropToNatural(crop, display.scale, display.offsetX, display.offsetY),
    [crop, display.offsetX, display.offsetY, display.scale]
  )

  const printSizeMm = useMemo(
    (): FaceSizeMm =>
      natural.w > 0
        ? cropRegionToPrintSizeMm(faceSizeMm, natural.w, natural.h, cropNatural)
        : faceSizeMm,
    [cropNatural, faceSizeMm, natural.w]
  )

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

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

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
    setCrop(applyResize(dragStart.current.crop, dragMode.current, dx, dy, imgBounds, faceAspect))
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragMode.current = null
    overlayDrag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const handleSave = useCallback(async () => {
    const blob = await exportFaceEditBlob(imageUrl, cropNatural, overlays)
    await onSave(blob, printSizeMm)
  }, [cropNatural, imageUrl, onSave, overlays, printSizeMm])

  const handleClass =
    'absolute z-20 h-3 w-3 rounded-sm border-2 border-white bg-violet-600 shadow pointer-events-none'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crop className="h-4 w-4" />
            {labels.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
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
          <Input
            value={selectedText.text}
            onChange={(e) => updateSelectedText(e.target.value)}
            className="h-9 text-sm"
            placeholder={labels.textPlaceholder}
          />
        ) : null}

        <div ref={viewportRef} className="w-full">
          <div
            className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-900"
            style={{ width: display.w, height: display.h, cursor: 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none block h-full w-full object-contain"
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
              <div className={`${handleClass} -left-1.5 -top-1.5`} />
              <div className={`${handleClass} -right-1.5 -top-1.5`} />
              <div className={`${handleClass} -bottom-1.5 -left-1.5`} />
              <div className={`${handleClass} -bottom-1.5 -right-1.5`} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{labels.dragHint}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{labels.overlayHint}</p>
          <p className="mt-1 text-xs font-medium text-violet-800 dark:text-violet-200">
            {labels.ratioLocked.replace(
              '{size}',
              formatMmSize(locale, faceSizeMm.widthMm, faceSizeMm.heightMm)
            )}
          </p>
        </div>

        <div className="rounded-md border border-violet-200 bg-violet-50/60 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950/30">
          <p className="text-xs text-muted-foreground">
            {labels.targetSize.replace(
              '{size}',
              formatMmSize(locale, faceSizeMm.widthMm, faceSizeMm.heightMm)
            )}
          </p>
          <p className="mt-1 font-medium text-violet-900 dark:text-violet-100">
            {labels.cropSize.replace(
              '{size}',
              formatMmSize(locale, printSizeMm.widthMm, printSizeMm.heightMm)
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {Math.round(cropNatural.width)} × {Math.round(cropNatural.height)} px
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            className="bg-violet-600 hover:bg-violet-700"
            disabled={busy || !natural.w || !aspectValid}
            onClick={() => void handleSave()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
