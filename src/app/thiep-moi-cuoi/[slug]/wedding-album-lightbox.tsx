'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  albumPhotoFrameStyle,
  defaultAlbumPhotoFrame,
  resolveAlbumPhotoFrame,
  type WeddingAlbumPhotoCrop,
} from '@/lib/wedding/wedding-section-config'

type Props = {
  urls: string[]
  index: number
  onIndexChange: (i: number) => void
  /** Đóng hết — quay lại nội dung thiệp */
  onCloseToInvitation: () => void
  /** Chỉ về lưới ảnh (album vẫn mở) */
  onOpenGallery: () => void
  crops?: WeddingAlbumPhotoCrop[]
}

export function WeddingAlbumLightbox({ urls, index, onIndexChange, onCloseToInvitation, crops }: Props) {
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
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [userScale, setUserScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  /** Vuốt ngang để đổi ảnh (chỉ khi zoom ~ 1) */
  const [carouselShiftX, setCarouselShiftX] = useState(0)
  const carouselShiftXRef = useRef(0)
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
    gesture: 'unset' | 'carouselHorizontal' | 'pan'
  } | null>(null)
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const posRef = useRef({ tx: 0, ty: 0 })
  const indexRef = useRef(index)
  const urlsLenRef = useRef(urls.length)
  const onIndexChangeRef = useRef(onIndexChange)
  indexRef.current = index
  urlsLenRef.current = urls.length
  onIndexChangeRef.current = onIndexChange

  useEffect(() => {
    carouselShiftXRef.current = carouselShiftX
  }, [carouselShiftX])

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
    carouselShiftXRef.current = 0
    setCarouselShiftX(0)
  }, [index])

  useEffect(() => {
    const raf = requestAnimationFrame(() => clampToBounds())
    return () => cancelAnimationFrame(raf)
  }, [index, userScale, urls, clampToBounds])

  useEffect(() => {
    thumbRefs.current[index]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [index])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let tracking = false
    let gesture: 'unset' | 'x' | 'y' = 'unset'
    let startX = 0
    let startY = 0
    let startT = 0
    let lastX = 0

    const damp = (dx: number, i: number, len: number) => {
      if (len <= 1) return dx * 0.35
      if (i <= 0 && dx > 0) return dx * 0.35
      if (i >= len - 1 && dx < 0) return dx * 0.35
      return dx
    }

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        tracking = false
        return
      }
      const touch = event.touches[0]
      tracking = true
      gesture = 'unset'
      startX = lastX = touch.clientX
      startY = touch.clientY
      startT = Date.now()
    }

    const onMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1 || userScaleRef.current > 1.05) return
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      lastX = touch.clientX
      if (gesture === 'unset' && dx * dx + dy * dy > 36) {
        gesture = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      }
      if (gesture !== 'x') return
      if (event.cancelable) event.preventDefault()
      const next = damp(dx, indexRef.current, urlsLenRef.current)
      carouselShiftXRef.current = next
      setCarouselShiftX(next)
      setTx(0)
      setTy(0)
    }

    const onEnd = () => {
      if (!tracking) return
      const wasHorizontal = gesture === 'x'
      tracking = false
      gesture = 'unset'
      if (!wasHorizontal) return
      const len = urlsLenRef.current
      const current = indexRef.current
      const shift = carouselShiftXRef.current
      carouselShiftXRef.current = 0
      setCarouselShiftX(0)
      if (userScaleRef.current > 1.05 || len <= 1) return
      const distTh = Math.max(52, Math.min(140, (el.clientWidth || 360) * 0.12))
      const dt = Math.max(1, Date.now() - startT)
      const vx = ((lastX - startX) / dt) * 1000
      let go: -1 | 0 | 1 = 0
      if (shift < -distTh || vx < -620) go = 1
      else if (shift > distTh || vx > 620) go = -1
      if (go === 1) onIndexChangeRef.current((current + 1) % len)
      else if (go === -1) onIndexChangeRef.current((current - 1 + len) % len)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

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
    if (e.pointerType === 'touch' && userScaleRef.current <= 1.05) return
    try {
      containerRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* chuột đã nhả */
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: posRef.current.tx,
      startTy: posRef.current.ty,
      gesture: 'unset',
    }
    swipeRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }

  const dampHorizontal = (dx: number, i: number) => {
    if (urls.length <= 1) return dx * 0.35
    /** Đầu album: không còn “ảnh trước”, kéo sang phải co giật nhẹ */
    if (i <= 0 && dx > 0) return dx * 0.35
    /** Cuối album: không còn “ảnh sau”, kéo sang trái co giật nhẹ */
    if (i >= urls.length - 1 && dx < 0) return dx * 0.35
    return dx
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && userScaleRef.current <= 1.05) return
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const t = e.nativeEvent
    const dx = t.clientX - dragRef.current.startX
    const dy = t.clientY - dragRef.current.startY

    const z = userScaleRef.current
    if (z <= 1.05) {
      const d = dragRef.current
      if (d.gesture === 'unset' && dx * dx + dy * dy > 36) {
        /** Ưu tiên vuốt ngang để đổi ảnh (mobile gallery) */
        d.gesture = Math.abs(dx) >= Math.abs(dy) ? 'carouselHorizontal' : 'pan'
      }
      if (d.gesture === 'carouselHorizontal' || d.gesture === 'unset') {
        /** Vuốt trái (dx < 0): ảnh sau · Vuốt phải (dx > 0): ảnh trước */
        const next = dampHorizontal(dx, index)
        carouselShiftXRef.current = next
        setCarouselShiftX(next)
        setTx(0)
        setTy(0)
        return
      }
      return
    }

    dragRef.current.gesture = 'pan'
    setCarouselShiftX(0)
    setTx(dragRef.current.startTx + dx)
    setTy(dragRef.current.startTy + dy)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && userScaleRef.current <= 1.05) return
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
      const cw = containerRef.current?.clientWidth ?? 360
      const distTh = Math.max(52, Math.min(140, cw * 0.12))
      const dt = Math.max(1, s ? Date.now() - s.t : 1)
      const swipeDx = e.clientX - (s?.x ?? e.clientX)
      const vx = (swipeDx / dt) * 1000
      const shift = carouselShiftXRef.current
      let go: -1 | 0 | 1 = 0
      /** Vuốt trái / flick trái → ảnh sau · Vuốt phải → ảnh trước */
      if (shift < -distTh || vx < -620) go = 1
      else if (shift > distTh || vx > 620) go = -1
      carouselShiftXRef.current = 0
      setCarouselShiftX(0)
      if (go === 1) onIndexChange((index + 1) % urls.length)
      else if (go === -1) onIndexChange((index - 1 + urls.length) % urls.length)
      return
    }

    carouselShiftXRef.current = 0
    setCarouselShiftX(0)
    requestAnimationFrame(() => clampToBounds())
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { dist, scale: userScale }
      dragRef.current = null
      carouselShiftXRef.current = 0
      setCarouselShiftX(0)
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
    /** PC: lăn ngang/dọc đổi ảnh (khi chưa zoom) */
    if (userScaleRef.current > 1.05 || urls.length <= 1) return
    const absY = Math.abs(e.deltaY)
    const absX = Math.abs(e.deltaX)
    const useX = absX >= absY
    const delta = useX ? e.deltaX : e.deltaY
    if (Math.abs(delta) < 28) return
    const now = Date.now()
    if (now - wheelCooldownRef.current < 320) return
    e.preventDefault()
    wheelCooldownRef.current = now
    if (delta < 0) onIndexChange((index + 1) % urls.length)
    else onIndexChange((index - 1 + urls.length) % urls.length)
  }

  const showNav = urls.length > 1 && userScale <= 1.05
  const goPrev = () => onIndexChange((index - 1 + urls.length) % urls.length)
  const goNext = () => onIndexChange((index + 1) % urls.length)
  const url = urls[index]

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={tr('Xem ảnh album', 'Album photo viewer', '相册大图', 'アルバム写真', '앨범 사진')}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-end px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-10 w-10 rounded-full text-white hover:bg-white/15 hover:text-white"
          onClick={onCloseToInvitation}
          aria-label={tr('Đóng và quay lại thiệp', 'Close and return to invitation', '关闭返回请柬', '閉じて招待状へ', '닫고 청첩장으로')}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(2.75rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex w-full max-w-[min(100%,42rem)] items-center justify-center gap-1 sm:max-w-3xl sm:gap-2">
          {showNav ? (
            <button
              type="button"
              className="flex h-10 w-8 shrink-0 items-center justify-center text-white/75 transition-colors hover:text-white sm:h-12 sm:w-10"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              aria-label={tr('Ảnh trước', 'Previous photo', '上一张', '前へ', '이전')}
            >
              <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
            </button>
          ) : (
            <span className="w-8 shrink-0 sm:w-10" aria-hidden />
          )}

          <div
            ref={containerRef}
            className="relative min-h-0 min-w-0 flex-1 touch-none overflow-hidden rounded-2xl bg-black sm:rounded-3xl"
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
              className="pointer-events-none mx-auto block max-h-[calc(100dvh-13rem)] w-full select-none object-contain touch-none sm:max-h-[calc(100dvh-14rem)]"
              style={{
                transform:
                  userScale <= 1.05
                    ? `translateX(${carouselShiftX}px) scale(${userScale})`
                    : `translate(${tx}px, ${ty}px) scale(${userScale})`,
              }}
              onLoad={() => {
                requestAnimationFrame(() => clampToBounds())
              }}
            />
          </div>

          {showNav ? (
            <button
              type="button"
              className="flex h-10 w-8 shrink-0 items-center justify-center text-white/75 transition-colors hover:text-white sm:h-12 sm:w-10"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              aria-label={tr('Ảnh sau', 'Next photo', '下一张', '次へ', '다음')}
            >
              <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
            </button>
          ) : (
            <span className="w-8 shrink-0 sm:w-10" aria-hidden />
          )}
        </div>

        {urls.length > 1 && userScale <= 1.05 ? (
          <div className="mt-4 w-full max-w-[min(100%,42rem)] sm:max-w-3xl">
            <div className="overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto flex w-max max-w-full gap-2">
                {urls.map((thumbUrl, i) => {
                const active = i === index
                const frame = resolveAlbumPhotoFrame(crops, i)
                const base = defaultAlbumPhotoFrame()
                const shaped = frame.x !== base.x || frame.y !== base.y || frame.scale !== base.scale
                return (
                  <button
                    key={`${thumbUrl}-${i}`}
                    ref={(el) => {
                      thumbRefs.current[i] = el
                    }}
                    type="button"
                    onClick={() => onIndexChange(i)}
                    className={[
                      'relative shrink-0 overflow-hidden rounded-xl transition-all',
                      active
                        ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-black'
                        : 'opacity-70 hover:opacity-100',
                    ].join(' ')}
                    aria-label={tr(
                      `Xem ảnh ${i + 1}`,
                      `View photo ${i + 1}`,
                      `查看第 ${i + 1} 张`,
                      `写真 ${i + 1} を表示`,
                      `사진 ${i + 1} 보기`,
                    )}
                    aria-current={active ? 'true' : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- external wedding album URLs */}
                    <img
                      src={thumbUrl}
                      alt=""
                      className="block h-16 w-16 object-cover sm:h-[4.5rem] sm:w-[4.5rem]"
                      draggable={false}
                      style={shaped ? albumPhotoFrameStyle(frame) : undefined}
                    />
                  </button>
                )
              })}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-white/55">
              {index + 1} / {urls.length}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
