'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  cropImageFile,
  DEFAULT_CROP_RECT,
  FULL_IMAGE_RECT,
  hitCropHandle,
  normRectFromDrag,
  resizeNormRect,
  type CropHandle,
  type NormRect,
} from '@/lib/image-region-crop'

type Props = {
  file: File | null
  busy?: boolean
  title: string
  hint: string
  confirmLabel: string
  cancelLabel: string
  wholeLabel: string
  failedLabel: string
  stepLabel?: string
  onConfirm: (file: File) => void | Promise<void>
  onCancel: () => void
}

type ImgBox = { x: number; y: number; w: number; h: number }

type DragState = {
  handle: CropHandle
  startNx: number
  startNy: number
  origin: NormRect
  moved: boolean
}

const HANDLE_PX = 28

function sameBox(a: ImgBox, b: ImgBox): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  )
}

function readImgBox(stage: HTMLElement): ImgBox | null {
  const img = stage.querySelector('img')
  if (!img?.naturalWidth || !img.naturalHeight) return null
  const bounds = stage.getBoundingClientRect()
  if (bounds.width < 8 || bounds.height < 8) return null
  const scale = Math.min(bounds.width / img.naturalWidth, bounds.height / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  return {
    x: (bounds.width - w) / 2,
    y: (bounds.height - h) / 2,
    w,
    h,
  }
}

/** Ghim sheet vào visual viewport. 100dvh nhảy khi thanh trình duyệt hiện/ẩn sau lúc chụp ảnh. */
function pinCropShell(node: HTMLElement) {
  const vv = window.visualViewport
  const rawH = vv?.height ?? 0
  const rawW = vv?.width ?? 0
  const height = rawH >= 240 ? rawH : window.innerHeight
  const width = rawW >= 200 ? rawW : window.innerWidth
  const top = rawH >= 240 ? (vv?.offsetTop ?? 0) : 0
  const left = rawW >= 200 ? (vv?.offsetLeft ?? 0) : 0
  const next = `${Math.round(top)}|${Math.round(left)}|${Math.round(width)}|${Math.round(height)}`
  if (node.dataset.pin === next) return
  node.dataset.pin = next
  node.style.top = `${Math.round(top)}px`
  node.style.left = `${Math.round(left)}px`
  node.style.width = `${Math.round(width)}px`
  node.style.height = `${Math.round(height)}px`
  node.style.maxHeight = 'none'
  node.style.transform = 'none'
  node.style.animation = 'none'
}

function cursorFor(handle: CropHandle | null): string {
  if (handle === 'nw' || handle === 'se') return 'nwse-resize'
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize'
  if (handle === 'n' || handle === 's') return 'ns-resize'
  if (handle === 'e' || handle === 'w') return 'ew-resize'
  if (handle === 'move') return 'move'
  return 'crosshair'
}

export function ImageRegionPicker({
  file,
  busy = false,
  title,
  hint,
  confirmLabel,
  cancelLabel,
  wholeLabel,
  failedLabel,
  stepLabel,
  onConfirm,
  onCancel,
}: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const setShell = useCallback((node: HTMLDivElement | null) => {
    shellRef.current = node
    if (node) pinCropShell(node)
  }, [])
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [url, setUrl] = useState('')
  const [rect, setRect] = useState<NormRect>(DEFAULT_CROP_RECT)
  const [imgBox, setImgBox] = useState<ImgBox>({ x: 0, y: 0, w: 0, h: 0 })
  const [ready, setReady] = useState(false)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [cursor, setCursor] = useState('crosshair')
  const locked = busy || working

  useEffect(() => {
    if (!file) {
      setUrl('')
      setReady(false)
      setRect(DEFAULT_CROP_RECT)
      setFailed(false)
      setWorking(false)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    setReady(false)
    setRect(DEFAULT_CROP_RECT)
    setFailed(false)
    setImgBox({ x: 0, y: 0, w: 0, h: 0 })
    return () => URL.revokeObjectURL(next)
  }, [file])

  useLayoutEffect(() => {
    if (!file) return
    let raf = 0
    let tries = 0
    const pin = () => {
      const node = shellRef.current
      if (!node) {
        if (tries < 8) {
          tries += 1
          raf = window.requestAnimationFrame(pin)
        }
        return
      }
      pinCropShell(node)
    }
    pin()
    window.scrollTo(0, 0)
    const vv = window.visualViewport
    vv?.addEventListener('resize', pin)
    vv?.addEventListener('scroll', pin)
    window.addEventListener('resize', pin)
    return () => {
      window.cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', pin)
      vv?.removeEventListener('scroll', pin)
      window.removeEventListener('resize', pin)
    }
  }, [file])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !file) return
    const measure = () => {
      const next = readImgBox(stage)
      if (!next) return
      setImgBox((prev) => (sameBox(prev, next) ? prev : next))
      setReady(true)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    measure()
    return () => observer.disconnect()
  }, [file, url])

  function toNorm(event: ReactPointerEvent): { nx: number; ny: number } | null {
    const stage = stageRef.current
    if (!stage || imgBox.w <= 0 || imgBox.h <= 0) return null
    const bounds = stage.getBoundingClientRect()
    return {
      nx: Math.min(1, Math.max(0, (event.clientX - bounds.left - imgBox.x) / imgBox.w)),
      ny: Math.min(1, Math.max(0, (event.clientY - bounds.top - imgBox.y) / imgBox.h)),
    }
  }

  function handleNorm(): number {
    const edge = Math.min(imgBox.w, imgBox.h)
    if (edge <= 0) return 0.08
    return Math.min(0.14, HANDLE_PX / edge)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (locked || !ready) return
    const pos = toNorm(event)
    if (!pos) return
    event.preventDefault()
    const handle = hitCropHandle(rect, pos.nx, pos.ny, handleNorm()) ?? 'draw'
    dragRef.current = {
      handle,
      startNx: pos.nx,
      startNy: pos.ny,
      origin: rect,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pos = toNorm(event)
    if (!pos) return
    const drag = dragRef.current
    if (!drag) {
      if (!locked) setCursor(cursorFor(hitCropHandle(rect, pos.nx, pos.ny, handleNorm())))
      return
    }
    const dx = pos.nx - drag.startNx
    const dy = pos.ny - drag.startNy
    if (drag.handle === 'draw') {
      if (Math.hypot(dx, dy) < 0.04) return
      drag.moved = true
      setRect(normRectFromDrag(drag.startNx, drag.startNy, pos.nx, pos.ny))
      return
    }
    if (Math.hypot(dx, dy) > 0.01) drag.moved = true
    setRect(resizeNormRect(drag.origin, drag.handle, dx, dy))
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.handle !== 'draw' || drag.moved) return
    setRect(drag.origin)
  }

  async function confirm() {
    if (!file || locked || !ready) return
    setWorking(true)
    setFailed(false)
    try {
      const cropped = await cropImageFile(file, rect)
      if (!cropped) {
        setFailed(true)
        return
      }
      await onConfirm(cropped)
    } catch {
      setFailed(true)
    } finally {
      setWorking(false)
    }
  }

  const cropStyle = ready
    ? {
        left: imgBox.x + rect.x * imgBox.w,
        top: imgBox.y + rect.y * imgBox.h,
        width: Math.max(1, rect.w * imgBox.w),
        height: Math.max(1, rect.h * imgBox.h),
      }
    : null

  return (
    <Dialog
      open={file != null}
      onOpenChange={(next) => {
        if (!next && !locked) onCancel()
      }}
    >
      <DialogContent
        ref={setShell}
        showCloseButton={false}
        className="fixed inset-x-0 left-0 right-0 top-0 z-[80] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden overscroll-none rounded-none border-0 bg-background p-0 shadow-none animate-none data-[state=closed]:animate-none data-[state=open]:animate-none sm:rounded-none"
        overlayClassName="z-[70]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (locked) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault()
        }}
      >
        <div className="flex h-full min-h-0 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <DialogHeader className="shrink-0 space-y-1 text-left">
          <DialogTitle>{title}</DialogTitle>
          {stepLabel ? <p className="text-xs font-medium text-muted-foreground">{stepLabel}</p> : null}
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>

        <div
          ref={stageRef}
          className="relative min-h-0 w-full flex-1 touch-none select-none overflow-hidden rounded-md bg-black"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url ? (
            // Ảnh local blob: next/image không dùng được object URL vừa tạo.
            // Ảnh absolute để kích thước gốc của ảnh camera không kéo giãn sheet.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              onLoad={() => {
                const stage = stageRef.current
                if (!stage) return
                const next = readImgBox(stage)
                if (!next) return
                setImgBox((prev) => (sameBox(prev, next) ? prev : next))
                setReady(true)
              }}
            />
          ) : null}
          {!ready ? (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </div>
          ) : null}
          {cropStyle ? (
            <>
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{ left: 0, top: 0, right: 0, height: cropStyle.top }}
              />
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{ left: 0, top: cropStyle.top, width: cropStyle.left, height: cropStyle.height }}
              />
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{
                  left: cropStyle.left + cropStyle.width,
                  top: cropStyle.top,
                  right: 0,
                  height: cropStyle.height,
                }}
              />
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{ left: 0, top: cropStyle.top + cropStyle.height, right: 0, bottom: 0 }}
              />
              <div className="pointer-events-none absolute border-2 border-white" style={cropStyle}>
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                  <span
                    key={corner}
                    className={`absolute h-3.5 w-3.5 rounded-sm border border-black/40 bg-white ${
                      corner.includes('n') ? '-top-1.5' : '-bottom-1.5'
                    } ${corner.includes('w') ? '-left-1.5' : '-right-1.5'}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {failed ? <p className="shrink-0 text-sm text-destructive">{failedLabel}</p> : null}

        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={locked} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !ready}
            onClick={() => {
              setRect(FULL_IMAGE_RECT)
              setFailed(false)
            }}
          >
            {wholeLabel}
          </Button>
          <Button type="button" disabled={locked || !ready} onClick={() => void confirm()}>
            {locked ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
