'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { albumPhotoFrameStyle } from '@/lib/wedding/wedding-section-config'

type CropPatch = { positionX?: number; positionY?: number; scale?: number }

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampScale(value: number) {
  return Math.max(1, Math.min(3, Math.round(value * 100) / 100))
}

/** Khung 3:4 trên từng ảnh album: kéo để đổi góc, zoom để phóng phần muốn hiện trên thiệp. */
export function WeddingAlbumPhotoCropThumb(props: {
  imageUrl: string
  positionX: number
  positionY: number
  scale: number
  onChange: (patch: CropPatch) => void
  onRemove: () => void
  removeLabel: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    positionX: number
    positionY: number
  } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const live = useRef({
    x: props.positionX,
    y: props.positionY,
    scale: props.scale,
    onChange: props.onChange,
  })
  live.current = {
    x: props.positionX,
    y: props.positionY,
    scale: props.scale,
    onChange: props.onChange,
  }

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      live.current.onChange({
        scale: clampScale(live.current.scale + (event.deltaY > 0 ? -0.08 : 0.08)),
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const pointerDistance = () => {
    const pts = [...pointers.current.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  }

  const endPointer = (target: HTMLDivElement, pointerId: number) => {
    pointers.current.delete(pointerId)
    if (dragRef.current?.pointerId === pointerId) dragRef.current = null
    if (pointers.current.size < 2) pinchRef.current = null
    if (pointers.current.size === 1) {
      const [id, point] = [...pointers.current.entries()][0]
      dragRef.current = {
        pointerId: id,
        startX: point.x,
        startY: point.y,
        positionX: live.current.x,
        positionY: live.current.y,
      }
    }
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      /* pointer already released */
    }
  }

  const setScale = (value: number) => props.onChange({ scale: clampScale(value) })

  return (
    <div className="w-full min-w-0 max-w-full space-y-1">
      <div className="relative w-full min-w-0 max-w-full">
        <div
          ref={frameRef}
          className="relative aspect-[3/4] w-full min-w-0 max-w-full cursor-grab touch-none overflow-hidden rounded-xl bg-black/5 ring-1 ring-black/10 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          tabIndex={0}
          role="application"
          aria-label="Kéo ảnh để căn góc. Lăn chuột hoặc dùng thanh zoom để phóng."
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (pointers.current.size >= 2) {
              dragRef.current = null
              pinchRef.current = { dist: Math.max(1, pointerDistance()), scale: live.current.scale }
              return
            }
            pinchRef.current = null
            dragRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              positionX: live.current.x,
              positionY: live.current.y,
            }
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
            if (pinchRef.current && pointers.current.size >= 2) {
              const dist = Math.max(1, pointerDistance())
              live.current.onChange({
                scale: clampScale(pinchRef.current.scale * (dist / pinchRef.current.dist)),
              })
              return
            }
            const drag = dragRef.current
            const frame = frameRef.current
            if (!drag || drag.pointerId !== event.pointerId || !frame) return
            const rect = frame.getBoundingClientRect()
            const sensitivity = 100 / Math.max(1, live.current.scale)
            const dx = ((event.clientX - drag.startX) / Math.max(1, rect.width)) * sensitivity
            const dy = ((event.clientY - drag.startY) / Math.max(1, rect.height)) * sensitivity
            live.current.onChange({
              positionX: clampPercent(drag.positionX - dx),
              positionY: clampPercent(drag.positionY - dy),
            })
          }}
          onPointerUp={(event) => endPointer(event.currentTarget, event.pointerId)}
          onPointerCancel={(event) => endPointer(event.currentTarget, event.pointerId)}
          onDoubleClick={() => props.onChange({ positionX: 50, positionY: 0, scale: 1 })}
        >
          <img
            src={props.imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-cover"
            style={albumPhotoFrameStyle({ x: props.positionX, y: props.positionY, scale: props.scale })}
          />
          <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {Math.round(props.scale * 100)}%
          </span>
        </div>
        <button
          type="button"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
          aria-label={props.removeLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={props.onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm leading-none"
          aria-label="Thu nhỏ"
          onClick={() => setScale(props.scale - 0.1)}
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          aria-label="Zoom ảnh album"
          aria-valuetext={`${Math.round(props.scale * 100)}%`}
          value={props.scale}
          onChange={(event) => setScale(Number(event.target.value))}
          className="h-7 min-w-0 flex-1 accent-stone-900"
        />
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm leading-none"
          aria-label="Phóng to"
          onClick={() => setScale(props.scale + 0.1)}
        >
          +
        </button>
      </div>
    </div>
  )
}
