'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid3x3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

type Props = {
  urls: string[]
  index: number
  onIndexChange: (i: number) => void
  /** Đóng hết — quay lại nội dung thiệp */
  onCloseToInvitation: () => void
  /** Chỉ về lưới ảnh (album vẫn mở) */
  onOpenGallery: () => void
}

export function WeddingAlbumLightbox({ urls, index, onIndexChange, onCloseToInvitation, onOpenGallery }: Props) {
  const locale = readWebLocaleFromDocumentCookie()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (locale === 'en') return en
    if (locale === 'zh') return zh
    if (locale === 'ja') return ja
    if (locale === 'ko') return ko
    return vi
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [userScale, setUserScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  /** Vuốt dọc kiểu TikTok để đổi ảnh (chỉ khi zoom ~ 1) */
  const [carouselShiftY, setCarouselShiftY] = useState(0)
  const carouselShiftYRef = useRef(0)
  const userScaleRef = useRef(userScale)
  useEffect(() => {
    userScaleRef.current = userScale
  }, [userScale])
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startTx: number
    startTy: number
    gesture: 'unset' | 'tiktokVertical' | 'pan'
  } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const posRef = useRef({ tx: 0, ty: 0 })

  useEffect(() => {
    carouselShiftYRef.current = carouselShiftY
  }, [carouselShiftY])

  useEffect(() => {
    posRef.current = { tx, ty }
  }, [tx, ty])

  const clampToBounds = useCallback(() => {
    const img = imgRef.current
    const c = containerRef.current
    if (!img || !c) return
    const ir = img.getBoundingClientRect()
    const cr = c.getBoundingClientRect()
    let nx = tx
    let ny = ty
    if (ir.width <= cr.width + 1) nx = 0
    else {
      if (ir.left > cr.left) nx += cr.left - ir.left
      if (ir.right < cr.right) nx += cr.right - ir.right
    }
    if (ir.height <= cr.height + 1) ny = 0
    else {
      if (ir.top > cr.top) ny += cr.top - ir.top
      if (ir.bottom < cr.bottom) ny += cr.bottom - ir.bottom
    }
    if (nx !== tx || ny !== ty) {
      setTx(nx)
      setTy(ny)
    }
  }, [tx, ty])

  useEffect(() => {
    setUserScale(1)
    setTx(0)
    setTy(0)
    carouselShiftYRef.current = 0
    setCarouselShiftY(0)
  }, [index])

  useEffect(() => {
    const raf = requestAnimationFrame(() => clampToBounds())
    return () => cancelAnimationFrame(raf)
  }, [index, userScale, urls, clampToBounds])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const onResize = () => requestAnimationFrame(() => clampToBounds())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampToBounds])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const t = e.nativeEvent
    containerRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: t.clientX,
      startY: t.clientY,
      startTx: posRef.current.tx,
      startTy: posRef.current.ty,
      gesture: 'unset',
    }
    swipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }

  const dampVertical = (dy: number, i: number) => {
    if (urls.length <= 1) return dy * 0.35
    /** Đầu album: không còn “ảnh trước”, kéo xuống co giật nhẹ */
    if (i <= 0 && dy > 0) return dy * 0.35
    /** Cuối album: không còn “ảnh sau”, kéo lên co giật nhẹ */
    if (i >= urls.length - 1 && dy < 0) return dy * 0.35
    return dy
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const t = e.nativeEvent
    const dx = t.clientX - dragRef.current.startX
    const dy = t.clientY - dragRef.current.startY

    const z = userScaleRef.current
    if (z <= 1.05) {
      const d = dragRef.current
      if (d.gesture === 'unset' && dx * dx + dy * dy > 36) {
        /** Ưu tiên vuốt dọc như TikTok; kéo ngang chủ đạo không đổi ảnh */
        d.gesture = Math.abs(dy) >= Math.abs(dx) ? 'tiktokVertical' : 'pan'
      }
      if (d.gesture === 'tiktokVertical' || d.gesture === 'unset') {
        /** Vuốt lên (dy < 0): ảnh sau · Vuốt xuống (dy > 0): ảnh trước */
        const next = dampVertical(dy, index)
        carouselShiftYRef.current = next
        setCarouselShiftY(next)
        setTx(0)
        setTy(0)
        return
      }
      return
    }

    dragRef.current.gesture = 'pan'
    setCarouselShiftY(0)
    setTx(dragRef.current.startTx + dx)
    setTy(dragRef.current.startTy + dy)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    const gesture = dragRef.current.gesture

    dragRef.current = null
    try {
      containerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    const s = swipeRef.current
    swipeRef.current = null

    const z = userScaleRef.current
    if (z <= 1.05 && urls.length > 1 && gesture !== 'pan') {
      const ch = containerRef.current?.clientHeight ?? 480
      const distTh = Math.max(52, Math.min(140, ch * 0.12))
      const dt = Math.max(1, s ? Date.now() - s.t : 1)
      const swipeDy = e.clientY - (s?.y ?? e.clientY)
      const vy = (swipeDy / dt) * 1000
      const shift = carouselShiftYRef.current
      let go: -1 | 0 | 1 = 0
      /** Kéo lên / flick lên → ảnh sau · Kéo xuống → ảnh trước */
      if (shift < -distTh || vy < -620) go = 1
      else if (shift > distTh || vy > 620) go = -1
      carouselShiftYRef.current = 0
      setCarouselShiftY(0)
      if (go === 1) onIndexChange((index + 1) % urls.length)
      else if (go === -1) onIndexChange((index - 1 + urls.length) % urls.length)
      return
    }

    carouselShiftYRef.current = 0
    setCarouselShiftY(0)
    requestAnimationFrame(() => clampToBounds())
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { dist, scale: userScale }
      dragRef.current = null
      carouselShiftYRef.current = 0
      setCarouselShiftY(0)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const ratio = dist / pinchRef.current.dist
      const next = Math.min(4, Math.max(1, pinchRef.current.scale * ratio))
      setUserScale(next)
    }
  }

  const onTouchEnd = () => {
    pinchRef.current = null
    requestAnimationFrame(() => clampToBounds())
  }

  const wheelCooldownRef = useRef(0)

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = -e.deltaY * 0.002
      setUserScale((s) => Math.min(4, Math.max(1, s + delta)))
      return
    }
    /** PC: lăn dọc ≈ TikTok đổi ảnh (khi chưa zoom) */
    if (userScaleRef.current > 1.05 || urls.length <= 1) return
    const absY = Math.abs(e.deltaY)
    const absX = Math.abs(e.deltaX)
    if (absY < 28 || absY < absX * 1.25) return
    const now = Date.now()
    if (now - wheelCooldownRef.current < 320) return
    e.preventDefault()
    wheelCooldownRef.current = now
    if (e.deltaY < 0) onIndexChange((index + 1) % urls.length)
    else onIndexChange((index - 1 + urls.length) % urls.length)
  }

  const url = urls[index]

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={tr('Xem ảnh album', 'Album photo viewer', '相册大图', 'アルバム写真', '앨범 사진')}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-black/90 px-3 py-2 text-white">
        <p className="min-w-0 truncate text-sm font-medium sm:text-base">
          {tr('Ảnh', 'Photo', '照片', '写真', '사진')} {index + 1} / {urls.length}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={onOpenGallery}
            aria-label={tr('Xem lưới ảnh', 'Photo grid', '图片网格', '写真グリッド', '그리드 보기')}
          >
            <Grid3x3 className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">{tr('Lưới', 'Grid', '网格', 'グリッド', '그리드')}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={onCloseToInvitation}
            aria-label={tr('Đóng và quay lại thiệp', 'Close and return to invitation', '关闭返回请柬', '閉じて招待状へ', '닫고 청첩장으로')}
          >
            <X className="mr-1 h-4 w-4" />
            {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- external wedding album URLs */}
        <img
          ref={imgRef}
          key={url}
          src={url}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-[100%] max-w-[100%] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
          style={{
            transform:
              userScale <= 1.05
                ? `translate(-50%, calc(-50% + ${carouselShiftY}px)) scale(${userScale})`
                : `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${userScale})`,
          }}
          onLoad={() => {
            requestAnimationFrame(() => clampToBounds())
          }}
        />

        {urls.length > 1 && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 shadow-md"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index - 1 + urls.length) % urls.length)
              }}
              aria-label={tr('Ảnh trước', 'Previous photo', '上一张', '前へ', '이전')}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-white/90 shadow-md"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index + 1) % urls.length)
              }}
              aria-label={tr('Ảnh sau', 'Next photo', '下一张', '次へ', '다음')}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      <p className="shrink-0 bg-black/90 px-3 py-2 text-center text-xs text-white/70">
        {tr(
          'Vuốt dọc như TikTok: lên — ảnh sau · xuống — ảnh trước · Chuột máy tính: lăn dọc đổi ảnh · Phóng to rồi kéo xem chi tiết (hai ngón / Ctrl+lăn)',
          'Swipe vertically (TikTok-style): up — next · down — previous · Mouse wheel vertically changes photo · Zoom then pinch/Ctrl+scroll to pan',
          '上下滑动如抖音：向上 — 下一张 · 向下 — 上一张 · 鼠标滚轮换图 · 缩放后可拖动',
          'TikTok風の縦スワイプ：上 — 次へ · 下 — 前へ · マウスホイールで切替 · ピンチ／Ctrl+ホイールで拡大後はドラッグで移動',
          '티톡처럼 세로 스와이프: 위 — 다음 · 아래 — 이전 · 마우스 휠로 전환 · 확대(핀치/Ctrl+휠) 후 드래그',
        )}
      </p>
    </div>
  )
}
