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
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  DownloadImageButton,
  type DownloadImageButtonLabels,
} from '@/components/download-image-button'
import { PackagingBagMockupShareMenu } from '@/components/hub-chat/packaging-bag-mockup-share-menu'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import {
  getBagFaceSlotLabel,
  resolveBagFacePreviewUrl,
  type BagFaceSlot,
} from '@/lib/hub-chat/bag-kit-shared'
import type { WebLocale } from '@/lib/i18n/config'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'

type BagFaceSlots = Partial<
  Record<BagFaceSlot, { sourceMode: string; url?: string }>
>

type ViewportSize = { width: number; height: number }

const KRAFT = '#c9b08a'

const COPY: Record<
  WebLocale,
  {
    hint: string
    pause: string
    play: string
    reset: string
    viewFullscreen: string
    downloadHint: string
    downloadShareHint: string
    preview2d: string
    preview3d: string
    gussetLabel: string
    bottomLabel: string
  }
> = {
  vi: {
    hint: 'Kéo để xoay và xem mặt trước, mặt sau và hông túi',
    pause: 'Dừng xoay',
    play: 'Tự xoay',
    reset: 'Đặt lại góc nhìn',
    viewFullscreen: 'Xem full màn hình',
    downloadHint: 'Tải PNG góc nhìn cố định hoặc xoay trực tiếp trên màn hình.',
    downloadShareHint: 'Tải PNG hoặc bấm Chia sẻ để gửi link xoay 3D / file HTML.',
    preview2d: 'Preview 2D',
    preview3d: 'Xoay 3D',
    gussetLabel: 'Hông túi (kraft)',
    bottomLabel: 'Đáy túi (kraft)',
  },
  en: {
    hint: 'Drag to rotate and inspect front, back, and gussets',
    pause: 'Pause rotation',
    play: 'Auto rotate',
    reset: 'Reset view',
    viewFullscreen: 'Full screen',
    downloadHint: 'Download a fixed-angle PNG or rotate live on screen.',
    downloadShareHint: 'Download PNG or use Share to send an interactive link or HTML file.',
    preview2d: '2D preview',
    preview3d: 'Rotate 3D',
    gussetLabel: 'Gusset (kraft)',
    bottomLabel: 'Bag bottom (kraft)',
  },
  zh: {
    hint: '拖动旋转查看正面、背面与侧褶',
    pause: '暂停旋转',
    play: '自动旋转',
    reset: '重置视角',
    viewFullscreen: '全屏查看',
    downloadHint: '下载固定角度 PNG，或在屏幕上直接旋转查看。',
    downloadShareHint: '下载 PNG，或点「分享」发送可旋转链接或 HTML 文件。',
    preview2d: '2D 预览',
    preview3d: '3D 旋转',
    gussetLabel: '侧褶（牛皮纸）',
    bottomLabel: '袋底（牛皮纸）',
  },
  ja: {
    hint: 'ドラッグして前面・背面・マチを確認',
    pause: '回転を停止',
    play: '自動回転',
    reset: '視点をリセット',
    viewFullscreen: '全画面表示',
    downloadHint: '固定角度のPNGをダウンロードするか、画面上で回転してください。',
    downloadShareHint: 'PNGをダウンロードするか「共有」で回転リンクまたはHTMLを送れます。',
    preview2d: '2Dプレビュー',
    preview3d: '3D回転',
    gussetLabel: 'マチ（クラフト）',
    bottomLabel: '底（クラフト）',
  },
  ko: {
    hint: '드래그하여 앞·뒷면과 옆 주름 확인',
    pause: '회전 일시정지',
    play: '자동 회전',
    reset: '보기 초기화',
    viewFullscreen: '전체 화면',
    downloadHint: '고정 각도 PNG를 받거나 화면에서 직접 회전하세요.',
    downloadShareHint: 'PNG 다운로드 또는 「공유」로 회전 링크·HTML 파일을 보내세요.',
    preview2d: '2D 미리보기',
    preview3d: '3D 회전',
    gussetLabel: '옆 주름(크래프트)',
    bottomLabel: '바닥(크래프트)',
  },
}

const FULLSCREEN_NESTED_OVERLAY_CLASS = 'z-[2147483648]'
const FULLSCREEN_NESTED_CONTENT_CLASS = 'z-[2147483649]'

const INITIAL_ROTATION = { x: -18, y: 28 }

function bagMockupFilename(dims: BagDimensionsMm): string {
  return `bag-mockup-${dims.width}x${dims.height}x${dims.gusset}mm.png`
}

function mockupProjectedBounds(
  panelPx: number,
  gussetPx: number,
  heightPx: number,
  rotateXDeg: number,
  rotateYDeg: number
): { width: number; height: number } {
  const w = panelPx / 2
  const g = gussetPx / 2
  const h = heightPx / 2
  const corners: [number, number, number][] = [
    [-w, -h, -g],
    [w, -h, -g],
    [w, -h, g],
    [-w, -h, g],
    [-w, h, -g],
    [w, h, -g],
    [w, h, g],
    [-w, h, g],
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
  panelPx: number,
  gussetPx: number,
  heightPx: number,
  margin = 0.9
): number {
  if (containerW <= 0 || containerH <= 0) return 1
  const bounds = mockupProjectedBounds(
    panelPx,
    gussetPx,
    heightPx,
    INITIAL_ROTATION.x,
    INITIAL_ROTATION.y
  )
  if (bounds.width <= 0 || bounds.height <= 0) return 1
  return Math.min((containerW * margin) / bounds.width, (containerH * margin) / bounds.height)
}

function geometryPxForViewport(
  dimensionsMm: BagDimensionsMm,
  viewport: ViewportSize | null
): { panel: number; gusset: number; height: number } {
  const maxDimension = Math.max(dimensionsMm.width, dimensionsMm.gusset, dimensionsMm.height)
  let pxPerMm = maxDimension > 0 ? 210 / maxDimension : 1
  let panel = dimensionsMm.width * pxPerMm
  let gusset = dimensionsMm.gusset * pxPerMm
  let height = dimensionsMm.height * pxPerMm

  if (viewport && viewport.width > 0 && viewport.height > 0) {
    const fit = fitScaleForContainer(viewport.width, viewport.height, panel, gusset, height)
    pxPerMm *= fit
    panel = dimensionsMm.width * pxPerMm
    gusset = dimensionsMm.gusset * pxPerMm
    height = dimensionsMm.height * pxPerMm
  }

  return { panel, gusset, height }
}

type MockupController = {
  bagRef: RefObject<HTMLDivElement>
  sceneRef: RefObject<HTMLDivElement>
  faces: Array<{
    id: string
    label: string
    width: number
    height: number
    transform: string
    url?: string
    fill?: string
  }>
  autoRotate: boolean
  setAutoRotate: React.Dispatch<React.SetStateAction<boolean>>
  resetView: () => void
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  stopDragging: (event: PointerEvent<HTMLDivElement>) => void
}

function BagMockup2DPreview({
  src,
  alt,
  viewLargeLabel,
}: {
  src: string
  alt: string
  viewLargeLabel: string
}) {
  const [open, setOpen] = useState(false)
  const resolvedSrc = rewriteLegacyBunnyCdnUrl(src)

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm dark:border-violet-800">
        <Image
          src={resolvedSrc}
          alt={alt}
          width={420}
          height={420}
          className="h-auto w-full cursor-zoom-in object-contain"
          unoptimized
          onClick={() => setOpen(true)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <Maximize2 className="mr-1 h-3.5 w-3.5" />
        {viewLargeLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[2147483646] bg-black/90"
          className="!fixed !inset-0 !left-0 !top-0 z-[2147483647] !flex !h-[100dvh] !max-h-[100dvh] !min-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 items-center justify-center rounded-none border-0 bg-black/95 p-2 shadow-none sm:rounded-none"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 h-11 w-11 rounded-full border border-white/20 bg-white/20 text-white hover:bg-white/30"
            onClick={() => setOpen(false)}
            aria-label={viewLargeLabel}
          >
            <X className="h-6 w-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element -- full CDN preview */}
          <img
            src={resolvedSrc}
            alt={alt}
            className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function usePackagingBagMockup3D(
  dimensionsMm: BagDimensionsMm,
  faceSlots: BagFaceSlots,
  locale: WebLocale,
  viewport: ViewportSize | null
): MockupController {
  const bagRef = useRef<HTMLDivElement>(null)
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

  const applyRotation = useCallback(() => {
    if (!bagRef.current) return
    const { x, y } = rotationRef.current
    bagRef.current.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
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

  const text = COPY[locale]
  const bagKit = useMemo(() => ({ faceSlots }), [faceSlots])
  const frontUrl = resolveBagFacePreviewUrl(bagKit, 'front')
  const backUrl = resolveBagFacePreviewUrl(bagKit, 'back')

  const { panel: w, gusset: g, height: h } = geometry
  const faces = useMemo(
    () =>
      [
        {
          id: 'front',
          label: getBagFaceSlotLabel('front', locale),
          width: w,
          height: h,
          transform: `translateZ(${g / 2}px)`,
          url: frontUrl ? rewriteLegacyBunnyCdnUrl(frontUrl) : undefined,
        },
        {
          id: 'back',
          label: getBagFaceSlotLabel('back', locale),
          width: w,
          height: h,
          transform: `rotateY(180deg) translateZ(${g / 2}px)`,
          url: backUrl ? rewriteLegacyBunnyCdnUrl(backUrl) : undefined,
        },
        {
          id: 'left-gusset',
          label: text.gussetLabel,
          width: g,
          height: h,
          transform: `rotateY(-90deg) translateZ(${w / 2}px)`,
          fill: KRAFT,
        },
        {
          id: 'right-gusset',
          label: text.gussetLabel,
          width: g,
          height: h,
          transform: `rotateY(90deg) translateZ(${w / 2}px)`,
          fill: KRAFT,
        },
        {
          id: 'bottom',
          label: text.bottomLabel,
          width: w,
          height: g,
          transform: `rotateX(-90deg) translateZ(${h / 2}px)`,
          fill: KRAFT,
        },
      ] satisfies MockupController['faces'],
    [backUrl, frontUrl, g, h, locale, text.bottomLabel, text.gussetLabel, w]
  )

  return {
    bagRef,
    sceneRef,
    faces,
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

function PackagingBagMockup3DScene({
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
  const { bagRef, sceneRef, faces, onPointerDown, onPointerMove, stopDragging } = controller
  const panelPx = faces.find((f) => f.id === 'front')?.width ?? 0
  const resolvedPerspective =
    perspective ?? Math.max(520, Math.min(panelPx * 2.8, 1400))

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
        ref={bagRef}
        className="absolute left-1/2 top-1/2"
        style={{
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {faces.map((face) => (
          <div
            key={face.id}
            className="absolute overflow-hidden border border-black/10 shadow-sm [backface-visibility:hidden] [transform:translateZ(0)]"
            style={{
              width: `${face.width}px`,
              height: `${face.height}px`,
              marginLeft: `${-face.width / 2}px`,
              marginTop: `${-face.height / 2}px`,
              transform: face.transform,
              backfaceVisibility: 'hidden',
              backgroundColor: face.fill ?? KRAFT,
            }}
            aria-label={face.label}
          >
            {face.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={face.url}
                alt={face.label}
                className="h-full w-full select-none object-cover object-center"
                draggable={false}
                decoding="async"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function PackagingBagMockup3DToolbar({
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

function PackagingBagMockup3DViewport({
  dimensionsMm,
  faceSlots,
  locale,
  sceneClassName,
  toolbarExtra,
  downloadHint,
  wrapperClassName,
}: {
  dimensionsMm: BagDimensionsMm
  faceSlots: BagFaceSlots
  locale: WebLocale
  sceneClassName: string
  toolbarExtra?: ReactNode
  downloadHint?: string | null
  wrapperClassName?: string
}) {
  const sceneWrapRef = useRef<HTMLDivElement>(null)
  const viewport = useViewportSize(sceneWrapRef)
  const controller = usePackagingBagMockup3D(dimensionsMm, faceSlots, locale, viewport)

  return (
    <div className={wrapperClassName}>
      <div ref={sceneWrapRef} className={sceneClassName}>
        <PackagingBagMockup3DScene
          controller={controller}
          locale={locale}
          sceneClassName="h-full w-full"
        />
      </div>
      <div className="mt-2 space-y-2">
        <PackagingBagMockup3DToolbar locale={locale} controller={controller} extra={toolbarExtra} />
        {downloadHint ? (
          <p className="text-[11px] text-slate-600 dark:text-slate-300">{downloadHint}</p>
        ) : null}
      </div>
    </div>
  )
}

export function PackagingBagMockup3D({
  dimensionsMm,
  faceSlots,
  locale,
  photoUrl,
  downloadUrl,
  downloadLabels,
  viewLargeLabel,
  showShareMenu = true,
}: {
  dimensionsMm: BagDimensionsMm
  faceSlots: BagFaceSlots
  locale: WebLocale
  /** Mockup 2D photoreal (AI). Falls back to downloadUrl when absent. */
  photoUrl?: string | null
  downloadUrl?: string | null
  downloadLabels?: DownloadImageButtonLabels
  viewLargeLabel?: string
  showShareMenu?: boolean
}) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const text = COPY[locale]
  const resolvedDownloadFilename = bagMockupFilename(dimensionsMm)
  const flat2dUrl = photoUrl ?? downloadUrl
  const resolvedViewLargeLabel = viewLargeLabel ?? text.preview2d

  const shareButton = showShareMenu ? (
    <PackagingBagMockupShareMenu dimensionsMm={dimensionsMm} faceSlots={faceSlots} locale={locale} />
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

  const fullscreenShareButton = showShareMenu ? (
    <PackagingBagMockupShareMenu
      dimensionsMm={dimensionsMm}
      faceSlots={faceSlots}
      locale={locale}
      overlayClassName={FULLSCREEN_NESTED_OVERLAY_CLASS}
      contentClassName={`${FULLSCREEN_NESTED_CONTENT_CLASS} max-w-md`}
    />
  ) : null

  const fullscreenDownloadButton =
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
      <div className="w-full max-w-[420px] space-y-4">
        {flat2dUrl ? (
          <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
            <p className="mb-2 text-xs font-medium text-violet-800 dark:text-violet-200">{text.preview2d}</p>
            <BagMockup2DPreview
              src={flat2dUrl}
              alt={text.preview2d}
              viewLargeLabel={resolvedViewLargeLabel}
            />
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
          <p className="mb-2 text-xs font-medium text-violet-800 dark:text-violet-200">{text.preview3d}</p>
          <PackagingBagMockup3DViewport
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
            <PackagingBagMockup3DViewport
              dimensionsMm={dimensionsMm}
              faceSlots={faceSlots}
              locale={locale}
              sceneClassName="min-h-0 w-full flex-1"
              toolbarExtra={
                <>
                  {fullscreenShareButton}
                  {fullscreenDownloadButton}
                </>
              }
              wrapperClassName="flex min-h-0 flex-1 flex-col"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
