'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  DownloadImageButton,
  type DownloadImageButtonLabels,
} from '@/components/download-image-button'
import { PackagingMockupShareMenu } from '@/components/hub-chat/packaging-mockup-share-menu'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import type { WebLocale } from '@/lib/i18n/config'
import {
  BOX_FACE_SLOT_ORDER,
  getBoxFaceSlotLabel,
  resolveMockupSlotUrl,
  type BoxFaceSlot,
  type FaceSourceMode,
} from '@/lib/packaging/box-face-slots'
import { mockupDownloadFilename } from '@/lib/packaging/mockup-share-utils'

type FaceSlots = Partial<
  Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>
>

type ViewportSize = { width: number; height: number }

const COPY: Record<
  WebLocale,
  {
    hint: string
    pause: string
    play: string
    reset: string
    viewFullscreen: string
    downloadShareHint: string
  }
> = {
  vi: {
    hint: 'Kéo để xoay và xem đủ các mặt',
    pause: 'Dừng xoay',
    play: 'Tự xoay',
    reset: 'Đặt lại góc nhìn',
    viewFullscreen: 'Xem full màn hình',
    downloadShareHint: 'Tải PNG hoặc bấm Chia sẻ để gửi link xoay 3D / file HTML.',
  },
  en: {
    hint: 'Drag to rotate and inspect every face',
    pause: 'Pause rotation',
    play: 'Auto rotate',
    reset: 'Reset view',
    viewFullscreen: 'Full screen',
    downloadShareHint: 'Download PNG or use Share to send an interactive link or HTML file.',
  },
  zh: {
    hint: '拖动旋转并查看各个面',
    pause: '暂停旋转',
    play: '自动旋转',
    reset: '重置视角',
    viewFullscreen: '全屏查看',
    downloadShareHint: '下载 PNG，或点「分享」发送可旋转链接或 HTML 文件。',
  },
  ja: {
    hint: 'ドラッグして回転し、各面を確認',
    pause: '回転を停止',
    play: '自動回転',
    reset: '視点をリセット',
    viewFullscreen: '全画面表示',
    downloadShareHint: 'PNGをダウンロードするか「共有」で回転リンクまたはHTMLを送れます。',
  },
  ko: {
    hint: '드래그하여 회전하고 모든 면 확인',
    pause: '회전 일시정지',
    play: '자동 회전',
    reset: '보기 초기화',
    viewFullscreen: '전체 화면',
    downloadShareHint: 'PNG 다운로드 또는 「공유」로 회전 링크·HTML 파일을 보내세요.',
  },
}

export { mockupDownloadFilename } from '@/lib/packaging/mockup-share-utils'

const INITIAL_ROTATION = { x: -18, y: 28 }

/** Approximate 2D bounds after CSS rotateX + rotateY (Y applied first). */
function mockupProjectedBounds(
  lengthPx: number,
  widthPx: number,
  heightPx: number,
  rotateXDeg: number,
  rotateYDeg: number
): { width: number; height: number } {
  const l = lengthPx / 2
  const w = widthPx / 2
  const h = heightPx / 2
  const corners: [number, number, number][] = [
    [-l, -h, -w],
    [l, -h, -w],
    [l, -h, w],
    [-l, -h, w],
    [-l, h, -w],
    [l, h, -w],
    [l, h, w],
    [-l, h, w],
  ]
  const ry = (rotateYDeg * Math.PI) / 180
  const rx = (rotateXDeg * Math.PI) / 180
  const cosRy = Math.cos(ry)
  const sinRy = Math.sin(ry)
  const cosRx = Math.cos(rx)
  const sinRx = Math.sin(rx)
  const projected = corners.map(([x, y, z]) => {
    const x1 = x * cosRy + z * sinRy
    const z1 = -x * sinRy + z * cosRy
    const y1 = y * cosRx - z1 * sinRx
    return { x: x1, y: y1 }
  })
  const xs = projected.map((p) => p.x)
  const ys = projected.map((p) => p.y)
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function fitScaleForContainer(
  containerW: number,
  containerH: number,
  lengthPx: number,
  widthPx: number,
  heightPx: number,
  margin = 0.9
): number {
  if (containerW <= 0 || containerH <= 0) return 1
  const bounds = mockupProjectedBounds(
    lengthPx,
    widthPx,
    heightPx,
    INITIAL_ROTATION.x,
    INITIAL_ROTATION.y
  )
  if (bounds.width <= 0 || bounds.height <= 0) return 1
  return Math.min((containerW * margin) / bounds.width, (containerH * margin) / bounds.height)
}

function geometryPxForViewport(
  dimensionsMm: { length: number; width: number; height: number },
  viewport: ViewportSize | null
): { length: number; width: number; height: number } {
  const maxDimension = Math.max(
    dimensionsMm.length,
    dimensionsMm.width,
    dimensionsMm.height
  )
  let pxPerMm = maxDimension > 0 ? 210 / maxDimension : 1
  let length = dimensionsMm.length * pxPerMm
  let width = dimensionsMm.width * pxPerMm
  let height = dimensionsMm.height * pxPerMm

  if (viewport && viewport.width > 0 && viewport.height > 0) {
    const fit = fitScaleForContainer(viewport.width, viewport.height, length, width, height)
    pxPerMm *= fit
    length = dimensionsMm.length * pxPerMm
    width = dimensionsMm.width * pxPerMm
    height = dimensionsMm.height * pxPerMm
  }

  return { length, width, height }
}

type MockupController = {
  boxRef: RefObject<HTMLDivElement>
  sceneRef: RefObject<HTMLDivElement>
  faces: Array<{
    slot: BoxFaceSlot
    width: number
    height: number
    transform: string
  }>
  faceUrls: Partial<Record<BoxFaceSlot, string>>
  autoRotate: boolean
  setAutoRotate: React.Dispatch<React.SetStateAction<boolean>>
  resetView: () => void
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  stopDragging: (event: PointerEvent<HTMLDivElement>) => void
}

function usePackagingBoxMockup3D(
  dimensionsMm: { length: number; width: number; height: number },
  faceSlots: FaceSlots,
  viewport: ViewportSize | null
): MockupController {
  const boxRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef({ ...INITIAL_ROTATION })
  const dragRef = useRef<{
    pointerId: number
    x: number
    y: number
    rotateX: number
    rotateY: number
  } | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  const geometry = useMemo(
    () => geometryPxForViewport(dimensionsMm, viewport),
    [dimensionsMm, viewport]
  )

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
  const faces = useMemo(
    () =>
      [
        { slot: 'front' as const, width: l, height: h, transform: `translateZ(${w / 2}px)` },
        {
          slot: 'back' as const,
          width: l,
          height: h,
          transform: `rotateY(180deg) translateZ(${w / 2}px)`,
        },
        {
          slot: 'right' as const,
          width: w,
          height: h,
          transform: `rotateY(90deg) translateZ(${l / 2}px)`,
        },
        {
          slot: 'left' as const,
          width: w,
          height: h,
          transform: `rotateY(-90deg) translateZ(${l / 2}px)`,
        },
        {
          slot: 'top' as const,
          width: l,
          height: w,
          transform: `rotateX(90deg) translateZ(${h / 2}px)`,
        },
        {
          slot: 'bottom' as const,
          width: l,
          height: w,
          transform: `rotateX(-90deg) translateZ(${h / 2}px)`,
        },
      ] satisfies MockupController['faces'],
    [h, l, w]
  )

  return {
    boxRef,
    sceneRef,
    faces,
    faceUrls,
    autoRotate,
    setAutoRotate,
    resetView,
    onPointerDown,
    onPointerMove,
    stopDragging,
  }
}

function useViewportSize(ref: RefObject<HTMLElement | null>): ViewportSize | null {
  const [size, setSize] = useState<ViewportSize | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height })
      }
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

function PackagingBoxMockup3DScene({
  controller,
  locale,
  sceneClassName,
  perspective,
}: {
  controller: MockupController
  locale: WebLocale
  sceneClassName: string
  perspective?: number
}) {
  const text = COPY[locale]
  const { boxRef, sceneRef, faces, faceUrls, onPointerDown, onPointerMove, stopDragging } = controller
  const lengthPx = faces.find((f) => f.slot === 'front')?.width ?? 0
  const resolvedPerspective =
    perspective ?? Math.max(520, Math.min(lengthPx * 2.8, 1400))

  return (
    <div
      ref={sceneRef}
      className={`relative w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing ${sceneClassName}`}
      style={{ perspective: `${resolvedPerspective}px` }}
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
              className="absolute overflow-hidden border border-black/10 bg-[#c9b08a] shadow-sm [backface-visibility:hidden] [transform:translateZ(0)]"
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
                  className="h-full w-full select-none object-cover object-center"
                  draggable={false}
                  decoding="async"
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PackagingBoxMockup3DToolbar({
  locale,
  controller,
  extra,
}: {
  locale: WebLocale
  controller: MockupController
  extra?: ReactNode
}) {
  const text = COPY[locale]
  const { autoRotate, setAutoRotate, resetView } = controller

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-slate-600 dark:text-slate-300">{text.hint}</p>
      <div className="flex flex-wrap gap-1">
        {extra}
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
  )
}

function PackagingBoxMockup3DViewport({
  dimensionsMm,
  faceSlots,
  locale,
  sceneClassName,
  toolbarExtra,
  downloadHint,
  wrapperClassName,
}: {
  dimensionsMm: { length: number; width: number; height: number }
  faceSlots: FaceSlots
  locale: WebLocale
  sceneClassName: string
  toolbarExtra?: ReactNode
  downloadHint?: string | null
  wrapperClassName?: string
}) {
  const sceneWrapRef = useRef<HTMLDivElement>(null)
  const viewport = useViewportSize(sceneWrapRef)
  const controller = usePackagingBoxMockup3D(dimensionsMm, faceSlots, viewport)

  return (
    <div className={wrapperClassName}>
      <div ref={sceneWrapRef} className={sceneClassName}>
        <PackagingBoxMockup3DScene
          controller={controller}
          locale={locale}
          sceneClassName="h-full w-full"
        />
      </div>
      <div className="mt-2 space-y-2">
        <PackagingBoxMockup3DToolbar locale={locale} controller={controller} extra={toolbarExtra} />
        {downloadHint ? (
          <p className="text-[11px] text-slate-600 dark:text-slate-300">{downloadHint}</p>
        ) : null}
      </div>
    </div>
  )
}

export function PackagingBoxMockup3D({
  dimensionsMm,
  faceSlots,
  locale,
  downloadUrl,
  downloadFilename,
  downloadLabels,
  showShareMenu = true,
}: {
  dimensionsMm: { length: number; width: number; height: number }
  faceSlots: FaceSlots
  locale: WebLocale
  downloadUrl?: string | null
  downloadFilename?: string
  downloadLabels?: DownloadImageButtonLabels
  showShareMenu?: boolean
}) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const text = COPY[locale]
  const resolvedDownloadFilename = downloadFilename ?? mockupDownloadFilename(dimensionsMm)

  const shareButton =
    showShareMenu ? (
      <PackagingMockupShareMenu
        dimensionsMm={dimensionsMm}
        faceSlots={faceSlots}
        locale={locale}
      />
    ) : null

  const downloadButton =
    downloadUrl && downloadLabels ? (
      <DownloadImageButton
        imageUrl={downloadUrl}
        filename={resolvedDownloadFilename}
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        labels={downloadLabels}
      />
    ) : null

  const fullscreenButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      onClick={() => setFullscreenOpen(true)}
    >
      <Maximize2 className="mr-1 h-3.5 w-3.5" />
      {text.viewFullscreen}
    </Button>
  )

  return (
    <>
      <div className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
        <PackagingBoxMockup3DViewport
          dimensionsMm={dimensionsMm}
          faceSlots={faceSlots}
          locale={locale}
          sceneClassName="h-[300px]"
          toolbarExtra={
            <>
              {shareButton}
              {downloadButton}
              {fullscreenButton}
            </>
          }
          downloadHint={downloadUrl || showShareMenu ? text.downloadShareHint : null}
        />
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[2147483646] bg-black/90"
          className="!fixed !inset-0 !left-0 !top-0 z-[2147483647] !flex !h-[100dvh] !max-h-[100dvh] !min-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col rounded-none border-0 bg-gradient-to-b from-slate-900 to-slate-950 p-3 shadow-none sm:rounded-none sm:p-4"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 h-11 w-11 rounded-full border border-white/20 bg-white/20 text-white hover:bg-white/30"
            onClick={() => setFullscreenOpen(false)}
            aria-label={text.viewFullscreen}
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="flex min-h-0 flex-1 flex-col pt-10">
            <PackagingBoxMockup3DViewport
              dimensionsMm={dimensionsMm}
              faceSlots={faceSlots}
              locale={locale}
              sceneClassName="min-h-0 w-full flex-1"
              toolbarExtra={
                <>
                  {shareButton}
                  {downloadButton}
                </>
              }
              downloadHint={downloadUrl || showShareMenu ? text.downloadShareHint : null}
              wrapperClassName="flex min-h-0 flex-1 flex-col"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
