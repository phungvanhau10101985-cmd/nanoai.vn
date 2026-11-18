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
import type { BoxDielineStructure } from '@/lib/packaging/dieline-structure'
import { dielineArtworkRotation, foldTurnDegrees } from '@/lib/packaging/dieline-orientation'

const FOLD_CAPTION: Record<WebLocale, string> = {
  vi: 'Chân chữ trên nắp hướng về bản lề. Mockup đọc cùng chiều với file in sau khi gấp.',
  en: 'Lid lettering points its feet at the hinge. This mockup matches the print after folding.',
  zh: '盖面文字的字脚朝向折线。此样机与折叠后的印刷文件同向。',
  ja: '蓋の文字の下端は折り目を向きます。このモックアップは折った後の印刷と同じ向きです。',
  ko: '뚜껑 글자의 아랫부분이 접는 선을 향합니다. 이 목업은 접은 뒤의 인쇄와 같은 방향입니다.',
}

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

const FULLSCREEN_NESTED_OVERLAY_CLASS = 'z-[2147483648]'
const FULLSCREEN_NESTED_CONTENT_CLASS = 'z-[2147483649]'

const INITIAL_ROTATION = { x: -18, y: 28 }

type Quat = { x: number; y: number; z: number; w: number }

function axisAngle(x: number, y: number, z: number, deg: number): Quat {
  const half = (deg * Math.PI) / 360
  const s = Math.sin(half)
  return { x: x * s, y: y * s, z: z * s, w: Math.cos(half) }
}

function mulQuat(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  }
}

function normalizeQuat(q: Quat): Quat {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n }
}

/** CSS rotateX(x) rotateY(y): Y áp trước, rồi X. */
function quatFromView(xDeg: number, yDeg: number): Quat {
  return mulQuat(axisAngle(1, 0, 0, xDeg), axisAngle(0, 1, 0, yDeg))
}

/** Kéo ngang/dọc xoay quanh trục màn hình, không kẹt cực. */
function tumbleQuat(q: Quat, dx: number, dy: number): Quat {
  const yaw = axisAngle(0, 1, 0, dx * 0.45)
  const pitch = axisAngle(1, 0, 0, -dy * 0.45)
  return normalizeQuat(mulQuat(mulQuat(pitch, yaw), q))
}

function quatToMatrix3d(q: Quat): string {
  const { x, y, z, w } = normalizeQuat(q)
  const xx = x * x
  const yy = y * y
  const zz = z * z
  const xy = x * y
  const xz = x * z
  const yz = y * z
  const wx = w * x
  const wy = w * y
  const wz = w * z
  const m00 = 1 - 2 * (yy + zz)
  const m01 = 2 * (xy - wz)
  const m02 = 2 * (xz + wy)
  const m10 = 2 * (xy + wz)
  const m11 = 1 - 2 * (xx + zz)
  const m12 = 2 * (yz - wx)
  const m20 = 2 * (xz - wy)
  const m21 = 2 * (yz + wx)
  const m22 = 1 - 2 * (xx + yy)
  return `matrix3d(${m00},${m10},${m20},0,${m01},${m11},${m21},0,${m02},${m12},${m22},0,0,0,0,1)`
}

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
    clip?: string
    radius?: string
  }>
  faceUrls: Partial<Record<BoxFaceSlot, string>>
  autoRotate: boolean
  setAutoRotate: React.Dispatch<React.SetStateAction<boolean>>
  resetView: () => void
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  stopDragging: (event: PointerEvent<HTMLDivElement>) => void
}

function rectFaces(length: number, width: number, height: number, lift = 0) {
  const rise = lift ? `translateY(${-lift}px) ` : ''
  return [
    { slot: 'front' as const, width: length, height, transform: `${rise}translateZ(${width / 2}px)` },
    { slot: 'back' as const, width: length, height, transform: `${rise}rotateY(180deg) translateZ(${width / 2}px)` },
    { slot: 'right' as const, width, height, transform: `${rise}rotateY(90deg) translateZ(${length / 2}px)` },
    { slot: 'left' as const, width, height, transform: `${rise}rotateY(-90deg) translateZ(${length / 2}px)` },
    { slot: 'top' as const, width: length, height: width, transform: `${rise}rotateX(90deg) translateZ(${height / 2}px)` },
    { slot: 'bottom' as const, width: length, height: width, transform: `${rise}rotateX(-90deg) translateZ(${height / 2}px)` },
  ]
}

function facesForStructure(
  structure: BoxDielineStructure | undefined,
  length: number,
  width: number,
  height: number
): MockupController['faces'] {
  const box = () => rectFaces(length, width, height)
  if (structure === 'hexagon' || structure === 'octagon') {
    const sides = structure === 'hexagon' ? 6 : 8
    const across = Math.max(length, width)
    const side = structure === 'hexagon' ? across / Math.sqrt(3) : across / (1 + Math.SQRT2)
    const slots: BoxFaceSlot[] = ['front', 'right', 'back', 'left']
    const clip =
      structure === 'hexagon'
        ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
        : 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
    const faces: MockupController['faces'] = []
    for (let index = 0; index < sides; index += 1) {
      faces.push({
        slot: slots[index % slots.length]!,
        width: side,
        height,
        transform: `rotateY(${(360 / sides) * index}deg) translateZ(${across / 2}px)`,
      })
    }
    faces.push(
      {
        slot: 'top',
        width: across,
        height: across,
        transform: `rotateX(90deg) translateZ(${height / 2}px)`,
        clip,
      },
      {
        slot: 'bottom',
        width: across,
        height: across,
        transform: `rotateX(-90deg) translateZ(${height / 2}px)`,
        clip,
      }
    )
    return faces
  }
  if (structure === 'tube') {
    const diameter = Math.min(length, width)
    const count = 16
    const slots: BoxFaceSlot[] = ['front', 'right', 'back', 'left']
    const faces: MockupController['faces'] = []
    for (let index = 0; index < count; index += 1) {
      faces.push({
        slot: slots[index % slots.length]!,
        width: (Math.PI * diameter) / count + 0.8,
        height,
        transform: `rotateY(${(360 / count) * index}deg) translateZ(${diameter / 2}px)`,
      })
    }
    faces.push(
      {
        slot: 'top',
        width: diameter,
        height: diameter,
        transform: `rotateX(90deg) translateZ(${height / 2}px)`,
        radius: '50%',
      },
      {
        slot: 'bottom',
        width: diameter,
        height: diameter,
        transform: `rotateX(-90deg) translateZ(${height / 2}px)`,
        radius: '50%',
      }
    )
    return faces
  }
  if (structure === 'tray') return box().filter((face) => face.slot !== 'top')
  if (structure === 'pillow') {
    return box().map((face) => ({
      ...face,
      radius: face.slot === 'front' || face.slot === 'back' ? '22%' : '10%',
    }))
  }
  if (structure === 'telescope') {
    const lidH = Math.max(18, height * 0.42)
    const lift = (height - lidH) / 2
    return [
      ...box(),
      ...rectFaces(length * 1.08, width * 1.08, lidH, lift).filter((face) => face.slot !== 'bottom'),
    ]
  }
  if (structure === 'sleeve_tray') return box().filter((face) => face.slot !== 'top')
  return box()
}

function usePackagingBoxMockup3D(
  dimensionsMm: { length: number; width: number; height: number },
  faceSlots: FaceSlots,
  viewport: ViewportSize | null,
  viewPreset?: 'outside' | 'inside',
  structure?: BoxDielineStructure
): MockupController {
  const boxRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const quatRef = useRef<Quat>(quatFromView(INITIAL_ROTATION.x, INITIAL_ROTATION.y))
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
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
    boxRef.current.style.transform = quatToMatrix3d(quatRef.current)
  }, [])

  useEffect(() => {
    applyRotation()
  }, [applyRotation])

  useEffect(() => {
    if (!viewPreset) return
    quatRef.current = viewPreset === 'inside' ? quatFromView(58, 24) : quatFromView(INITIAL_ROTATION.x, INITIAL_ROTATION.y)
    if (viewPreset === 'inside') setAutoRotate(false)
    applyRotation()
  }, [applyRotation, viewPreset])

  useEffect(() => {
    if (!autoRotate) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const elapsed = Math.min(now - previous, 50)
      previous = now
      quatRef.current = normalizeQuat(mulQuat(axisAngle(0, 1, 0, elapsed * 0.018), quatRef.current))
      applyRotation()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [applyRotation, autoRotate])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      if (event.buttons === 0) {
        dragRef.current = null
        return
      }
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      if (!dx && !dy) return
      quatRef.current = tumbleQuat(quatRef.current, dx, dy)
      applyRotation()
    }
    const onUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId !== event.pointerId) return
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [applyRotation])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    setAutoRotate(false)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* kéo vẫn chạy qua sự kiện trên window */
    }
  }

  const onPointerMove = (_event: PointerEvent<HTMLDivElement>) => {
    /* Xoay xử lý trên window để không mất kéo khi con trỏ ra khỏi hộp. */
  }

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resetView = () => {
    quatRef.current = quatFromView(INITIAL_ROTATION.x, INITIAL_ROTATION.y)
    applyRotation()
  }

  const { length: l, width: w, height: h } = geometry
  const faces = useMemo(() => facesForStructure(structure, l, w, h), [h, l, structure, w])

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
  structure,
  lidOpen = 0,
  boardColor,
}: {
  controller: MockupController
  locale: WebLocale
  sceneClassName: string
  perspective?: number
  structure?: BoxDielineStructure
  lidOpen?: number
  boardColor?: string
}) {
  const text = COPY[locale]
  const { boxRef, sceneRef, faces, faceUrls, onPointerDown, onPointerMove, stopDragging } = controller
  const lengthPx = faces.find((f) => f.slot === 'front')?.width ?? 0
  const boxHeight = faces.find((f) => f.slot === 'front')?.height ?? 0
  const open = Math.max(0, Math.min(1, lidOpen))
  const resolvedPerspective =
    perspective ?? Math.max(520, Math.min(lengthPx * 2.8, 1400))

  return (
    <div
      ref={sceneRef}
      className={`relative w-full cursor-grab touch-none select-none overflow-visible active:cursor-grabbing ${sceneClassName}`}
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
        {faces.map((face, index) => {
          const url = faceUrls[face.slot]
          const transform =
            face.slot === 'top' && open > 0
              ? `rotateX(${90 - open * 110}deg) translateZ(${boxHeight / 2}px)`
              : face.transform
          return (
            <div
              key={`${face.slot}-${index}`}
              className="pointer-events-none absolute overflow-hidden border border-black/10 bg-[#c9b08a] shadow-sm [backface-visibility:hidden]"
              style={{
                width: `${face.width}px`,
                height: `${face.height}px`,
                marginLeft: `${-face.width / 2}px`,
                marginTop: `${-face.height / 2}px`,
                transform,
                clipPath: face.clip,
                borderRadius: face.radius,
                backfaceVisibility: 'hidden',
                backgroundColor: boardColor,
              }}
              aria-label={getBoxFaceSlotLabel(face.slot, locale)}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={getBoxFaceSlotLabel(face.slot, locale)}
                  className="h-full w-full select-none object-contain object-center"
                  style={
                    structure
                      ? {
                          transform: `rotate(${(dielineArtworkRotation(structure, face.slot) + foldTurnDegrees(structure, face.slot)) % 360}deg)`,
                        }
                      : undefined
                  }
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
  structure,
  lidOpen = 0,
  viewPreset,
  boardColor,
}: {
  dimensionsMm: { length: number; width: number; height: number }
  faceSlots: FaceSlots
  locale: WebLocale
  sceneClassName: string
  toolbarExtra?: ReactNode
  downloadHint?: string | null
  wrapperClassName?: string
  structure?: BoxDielineStructure
  lidOpen?: number
  viewPreset?: 'outside' | 'inside'
  boardColor?: string
}) {
  const sceneWrapRef = useRef<HTMLDivElement>(null)
  const viewport = useViewportSize(sceneWrapRef)
  const controller = usePackagingBoxMockup3D(dimensionsMm, faceSlots, viewport, viewPreset, structure)

  return (
    <div className={wrapperClassName}>
      <div ref={sceneWrapRef} className={sceneClassName}>
        <PackagingBoxMockup3DScene
          controller={controller}
          locale={locale}
          sceneClassName="h-full w-full"
          structure={structure}
          lidOpen={lidOpen}
          boardColor={boardColor}
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
  structure,
  lidOpen = 0,
  viewPreset,
  boardColor,
  appearance = 'card',
  footer,
  toolbarExtra,
}: {
  dimensionsMm: { length: number; width: number; height: number }
  faceSlots: FaceSlots
  locale: WebLocale
  downloadUrl?: string | null
  downloadFilename?: string
  downloadLabels?: DownloadImageButtonLabels
  showShareMenu?: boolean
  structure?: BoxDielineStructure
  /** 0 đóng nắp, 1 mở nắp. Chỉ đổi khung xem. */
  lidOpen?: number
  viewPreset?: 'outside' | 'inside'
  boardColor?: string
  appearance?: 'card' | 'studio'
  footer?: ReactNode
  toolbarExtra?: ReactNode
}) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const text = COPY[locale]
  const resolvedDownloadFilename = downloadFilename ?? mockupDownloadFilename(dimensionsMm)

  const shareButton = showShareMenu ? (
    <PackagingMockupShareMenu dimensionsMm={dimensionsMm} faceSlots={faceSlots} locale={locale} />
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
    <PackagingMockupShareMenu
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
        dropdownContentClassName={FULLSCREEN_NESTED_CONTENT_CLASS}
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

  const studio = appearance === 'studio'

  return (
    <>
      <div
        className={
          studio
            ? 'w-full rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-3 text-slate-900'
            : 'w-full max-w-[420px] rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800'
        }
      >
        <PackagingBoxMockup3DViewport
          dimensionsMm={dimensionsMm}
          faceSlots={faceSlots}
          locale={locale}
          structure={structure}
          lidOpen={lidOpen}
          viewPreset={viewPreset}
          boardColor={boardColor}
          sceneClassName={studio ? 'h-[360px]' : 'h-[300px]'}
          toolbarExtra={
            <>
              {toolbarExtra}
              {shareButton}
              {downloadButton}
              {fullscreenButton}
            </>
          }
          downloadHint={downloadUrl || showShareMenu ? text.downloadShareHint : null}
        />
        {structure ? (
          <p
            className={
              studio
                ? 'mt-2 text-[11px] text-slate-600'
                : 'mt-2 text-[11px] text-slate-600 dark:text-slate-300'
            }
          >
            {FOLD_CAPTION[locale]}
          </p>
        ) : null}
        {footer}
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
              structure={structure}
              lidOpen={lidOpen}
              viewPreset={viewPreset}
              boardColor={boardColor}
              sceneClassName="min-h-0 w-full flex-1"
              toolbarExtra={
                <>
                  {toolbarExtra}
                  {fullscreenShareButton}
                  {fullscreenDownloadButton}
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
