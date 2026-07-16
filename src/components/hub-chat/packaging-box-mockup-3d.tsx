'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import type { WebLocale } from '@/lib/i18n/config'
import {
  BOX_FACE_SLOT_ORDER,
  getBoxFaceSlotLabel,
  resolveMockupSlotUrl,
  type BoxFaceSlot,
  type FaceSourceMode,
} from '@/lib/packaging/box-face-slots'

type FaceSlots = Partial<
  Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>
>

const COPY: Record<
  WebLocale,
  { hint: string; pause: string; play: string; reset: string }
> = {
  vi: {
    hint: 'Kéo để xoay và xem đủ các mặt',
    pause: 'Dừng xoay',
    play: 'Tự xoay',
    reset: 'Đặt lại góc nhìn',
  },
  en: {
    hint: 'Drag to rotate and inspect every face',
    pause: 'Pause rotation',
    play: 'Auto rotate',
    reset: 'Reset view',
  },
  zh: {
    hint: '拖动旋转并查看各个面',
    pause: '暂停旋转',
    play: '自动旋转',
    reset: '重置视角',
  },
  ja: {
    hint: 'ドラッグして回転し、各面を確認',
    pause: '回転を停止',
    play: '自動回転',
    reset: '視点をリセット',
  },
  ko: {
    hint: '드래그하여 회전하고 모든 면 확인',
    pause: '회전 일시정지',
    play: '자동 회전',
    reset: '보기 초기화',
  },
}

const INITIAL_ROTATION = { x: -18, y: 28 }

export function PackagingBoxMockup3D({
  dimensionsMm,
  faceSlots,
  locale,
}: {
  dimensionsMm: { length: number; width: number; height: number }
  faceSlots: FaceSlots
  locale: WebLocale
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef({ ...INITIAL_ROTATION })
  const dragRef = useRef<{
    pointerId: number
    x: number
    y: number
    rotateX: number
    rotateY: number
  } | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const text = COPY[locale]

  const geometry = useMemo(() => {
    const maxDimension = Math.max(
      dimensionsMm.length,
      dimensionsMm.width,
      dimensionsMm.height
    )
    const scale = maxDimension > 0 ? 210 / maxDimension : 1
    return {
      length: dimensionsMm.length * scale,
      width: dimensionsMm.width * scale,
      height: dimensionsMm.height * scale,
    }
  }, [dimensionsMm])

  const faceUrls = useMemo(() => {
    const urls: Partial<Record<BoxFaceSlot, string>> = {}
    for (const slot of BOX_FACE_SLOT_ORDER) {
      const url = resolveMockupSlotUrl(slot, faceSlots)
      if (url) urls[slot] = rewriteLegacyBunnyCdnUrl(url)
    }
    return urls
  }, [faceSlots])

  const applyRotation = useCallback(() => {
    if (!boxRef.current) return
    const { x, y } = rotationRef.current
    boxRef.current.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
  }, [])

  useEffect(() => {
    applyRotation()
  }, [applyRotation])

  useEffect(() => {
    if (!autoRotate) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.min(now - previous, 50)
      previous = now
      rotationRef.current.y += elapsed * 0.018
      applyRotation()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [applyRotation, autoRotate])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setAutoRotate(false)
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      rotateX: rotationRef.current.x,
      rotateY: rotationRef.current.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    rotationRef.current = {
      x: Math.max(-80, Math.min(80, drag.rotateX - (event.clientY - drag.y) * 0.35)),
      y: drag.rotateY + (event.clientX - drag.x) * 0.45,
    }
    applyRotation()
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resetView = () => {
    rotationRef.current = { ...INITIAL_ROTATION }
    applyRotation()
  }

  const { length: l, width: w, height: h } = geometry
  const faces: Array<{
    slot: BoxFaceSlot
    width: number
    height: number
    transform: string
  }> = [
    { slot: 'front', width: l, height: h, transform: `translateZ(${w / 2}px)` },
    {
      slot: 'back',
      width: l,
      height: h,
      transform: `rotateY(180deg) translateZ(${w / 2}px)`,
    },
    {
      slot: 'right',
      width: w,
      height: h,
      transform: `rotateY(90deg) translateZ(${l / 2}px)`,
    },
    {
      slot: 'left',
      width: w,
      height: h,
      transform: `rotateY(-90deg) translateZ(${l / 2}px)`,
    },
    {
      slot: 'top',
      width: l,
      height: w,
      transform: `rotateX(90deg) translateZ(${h / 2}px)`,
    },
    {
      slot: 'bottom',
      width: l,
      height: w,
      transform: `rotateX(-90deg) translateZ(${h / 2}px)`,
    },
  ]

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
      <div
        className="relative h-[300px] w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        style={{ perspective: '850px' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        aria-label={text.hint}
      >
        <div
          ref={boxRef}
          className="absolute left-1/2 top-1/2"
          style={{
            width: 0,
            height: 0,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {faces.map((face) => {
            const url = faceUrls[face.slot]
            return (
              <div
                key={face.slot}
                className="absolute overflow-hidden border border-black/10 bg-[#c9b08a] shadow-sm"
                style={{
                  width: `${face.width}px`,
                  height: `${face.height}px`,
                  marginLeft: `${-face.width / 2}px`,
                  marginTop: `${-face.height / 2}px`,
                  transform: face.transform,
                  backfaceVisibility: 'hidden',
                }}
                aria-label={getBoxFaceSlotLabel(face.slot, locale)}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={getBoxFaceSlotLabel(face.slot, locale)}
                    className="h-full w-full select-none object-fill"
                    draggable={false}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-600 dark:text-slate-300">{text.hint}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setAutoRotate((value) => !value)}
          >
            {autoRotate ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            {autoRotate ? text.pause : text.play}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-7 w-7"
            title={text.reset}
            aria-label={text.reset}
            onClick={resetView}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
