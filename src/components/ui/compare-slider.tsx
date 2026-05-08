'use client'

import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Maximize2, X } from 'lucide-react'

interface CompareSliderProps {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
  className?: string
  /**
   * Trên viewport hẹp (≤767px), tự mở lớp fullscreen một lần khi mount — kéo so sánh có đủ chỗ;
   * người dùng vẫn đóng bằng X/ESC và có thể bấm «Full màn» để mở lại.
   */
  autoMobileFullscreen?: boolean
}

function SliderContent({
  before,
  after,
  beforeLabel,
  afterLabel,
  position,
  setPosition,
  containerRef,
  setIsDragging,
  isFullscreen,
}: {
  before: string
  after: string
  beforeLabel: string
  afterLabel: string
  position: number
  setPosition: (v: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  setIsDragging: (v: boolean) => void
  isFullscreen?: boolean
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isHorizontalRef = useRef<boolean | null>(null)

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, x)))
  }

  return (
    <div
      ref={containerRef as React.LegacyRef<HTMLDivElement>}
      className={cn(
        'relative overflow-hidden select-none bg-black',
        isFullscreen ? 'flex-1 min-h-0 h-full w-full' : 'aspect-video'
      )}
      style={{ touchAction: isFullscreen ? 'none' : 'pan-y' }}
      onMouseDown={(e) => {
        e.preventDefault()
        setIsDragging(true)
        handleMove(e.clientX)
      }}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t) {
          touchStartRef.current = { x: t.clientX, y: t.clientY }
          isHorizontalRef.current = null
          setIsDragging(true)
          handleMove(t.clientX)
        }
      }}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (!t || !touchStartRef.current) return
        const dx = t.clientX - touchStartRef.current.x
        const dy = t.clientY - touchStartRef.current.y
        if (isHorizontalRef.current === null) {
          isHorizontalRef.current = Math.abs(dx) > Math.abs(dy)
        }
        if (isHorizontalRef.current) {
          e.preventDefault()
          handleMove(t.clientX)
        }
      }}
      onTouchEnd={() => {
        touchStartRef.current = null
        isHorizontalRef.current = null
        setIsDragging(false)
      }}
      onTouchCancel={() => {
        touchStartRef.current = null
        isHorizontalRef.current = null
        setIsDragging(false)
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt={afterLabel}
        className={cn(
          'absolute inset-0 w-full h-full',
          isFullscreen ? 'object-contain object-center' : 'object-contain'
        )}
      />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt={beforeLabel}
          className={cn(
            'absolute inset-0 w-full h-full',
            isFullscreen ? 'object-contain object-center' : 'object-contain'
          )}
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
        style={{ left: `calc(${position}% - 2px)` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 rounded-full bg-white shadow flex items-center justify-center">
          <div className="flex gap-0.5">
            <span className="w-0.5 h-2 bg-gray-600 rounded" />
            <span className="w-0.5 h-2 bg-gray-600 rounded" />
          </div>
        </div>
      </div>
      <div
        className={cn(
          'absolute z-10 rounded bg-black/60 px-2 py-1 text-xs text-white',
          isFullscreen
            ? 'left-[max(0.5rem,env(safe-area-inset-left))] bottom-[max(0.5rem,env(safe-area-inset-bottom))]'
            : 'left-2 bottom-2'
        )}
      >
        {beforeLabel}
      </div>
      <div
        className={cn(
          'absolute z-10 rounded bg-black/60 px-2 py-1 text-xs text-white',
          isFullscreen
            ? 'right-[max(0.5rem,env(safe-area-inset-right))] bottom-[max(0.5rem,env(safe-area-inset-bottom))]'
            : 'right-2 bottom-2'
        )}
      >
        {afterLabel}
      </div>
    </div>
  )
}

export function CompareSlider({
  before,
  after,
  beforeLabel = 'Trước',
  afterLabel = 'Sau',
  className,
  autoMobileFullscreen = true,
}: CompareSliderProps) {
  const uiLocale = useWebLocaleFromDocumentCookie()
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const finalBeforeLabel = beforeLabel === 'Trước' ? tr('Trước', 'Before', '之前', '前', '이전') : beforeLabel
  const finalAfterLabel = afterLabel === 'Sau' ? tr('Sau', 'After', '之后', '後', '이후') : afterLabel

  const handleMove = useCallback((clientX: number) => {
    const ref = isFullscreen ? fullscreenRef : containerRef
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, x)))
  }, [isFullscreen])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => handleMove(e.clientX)
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleMove, isDragging])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isFullscreen])

  useEffect(() => {
    if (!autoMobileFullscreen || typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    setIsFullscreen(true)
  }, [autoMobileFullscreen])

  return (
    <>
      {!isFullscreen ? (
        <div className={cn('relative aspect-video overflow-hidden rounded-lg border select-none', className)}>
          <SliderContent
            before={before}
            after={after}
            beforeLabel={finalBeforeLabel}
            afterLabel={finalAfterLabel}
            position={position}
            setPosition={setPosition}
            containerRef={containerRef}
            setIsDragging={setIsDragging}
          />
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="absolute top-2 right-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 px-2 py-1.5 rounded bg-black/60 hover:bg-black/80 active:bg-black/90 text-white text-xs flex items-center justify-center gap-1.5 z-20 transition-colors touch-manipulation"
            title={tr('Mở full màn hình', 'Open fullscreen', '全屏查看', '全画面表示', '전체 화면 열기')}
          >
            <Maximize2 className="h-4 w-4 shrink-0" />
            <span>{tr('Full màn', 'Fullscreen', '全屏', '全画面', '전체 화면')}</span>
          </button>
        </div>
      ) : null}

      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] min-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-black overscroll-none">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SliderContent
              before={before}
              after={after}
              beforeLabel={finalBeforeLabel}
              afterLabel={finalAfterLabel}
              position={position}
              setPosition={setPosition}
              containerRef={fullscreenRef}
              setIsDragging={setIsDragging}
              isFullscreen
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/20 p-2 text-white touch-manipulation transition-colors hover:bg-white/30 active:bg-white/40"
            title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
          >
            <X className="h-6 w-6" />
          </button>
          <p className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 hidden max-w-[90vw] -translate-x-1/2 text-center text-xs text-white/70 sm:block sm:text-sm">
            {tr('Nhấn ESC để đóng', 'Press ESC to close', '按 ESC 关闭', 'ESCで閉じる', 'ESC를 눌러 닫기')}
          </p>
        </div>
      )}
    </>
  )
}
