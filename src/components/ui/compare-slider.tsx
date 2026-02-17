'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Maximize2, X } from 'lucide-react'

interface CompareSliderProps {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
  className?: string
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
      ref={containerRef}
      className={cn('relative overflow-hidden select-none bg-black', isFullscreen ? 'w-full h-full' : 'aspect-video')}
      style={{ touchAction: 'pan-y' }}
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
      <img src={after} alt={afterLabel} className="absolute inset-0 w-full h-full object-contain" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={before} alt={beforeLabel} className="absolute inset-0 w-full h-full object-contain" />
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
      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs z-10">{beforeLabel}</div>
      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs z-10">{afterLabel}</div>
    </div>
  )
}

export function CompareSlider({ before, after, beforeLabel = 'Trước', afterLabel = 'Sau', className }: CompareSliderProps) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleMove = (clientX: number) => {
    const ref = isFullscreen ? fullscreenRef : containerRef
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, x)))
  }

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
  }, [isDragging, isFullscreen])

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

  return (
    <>
      <div className={cn('relative aspect-video overflow-hidden rounded-lg border select-none', className)}>
        <SliderContent
          before={before}
          after={after}
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
          position={position}
          setPosition={setPosition}
          containerRef={containerRef}
          setIsDragging={setIsDragging}
        />
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="absolute top-2 right-2 px-2 py-1.5 rounded bg-black/60 hover:bg-black/80 text-white text-xs flex items-center gap-1.5 z-20 transition-colors"
          title="Mở full màn hình"
        >
          <Maximize2 className="h-4 w-4" /> Full màn
        </button>
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
          <div ref={fullscreenRef} className="w-full h-full flex items-center justify-center">
            <SliderContent
              before={before}
              after={after}
              beforeLabel={beforeLabel}
              afterLabel={afterLabel}
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
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white z-50 transition-colors"
            title="Đóng"
          >
            <X className="h-6 w-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">Nhấn ESC để đóng</p>
        </div>
      )}
    </>
  )
}
