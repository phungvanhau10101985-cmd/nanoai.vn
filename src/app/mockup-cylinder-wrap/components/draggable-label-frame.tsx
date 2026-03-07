'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface DraggableLabelFrameProps {
  widthMm: number
  heightMm: number
  imageUrl: string | null
  onExportData?: (data: { panX: number; panY: number; scale: number; imgW: number; imgH: number; frameW: number; frameH: number }) => void
  className?: string
}

const PAD = 2
const DIM_OUTSIDE = 6 // Khoảng đặt số kích thước bên ngoài ảnh

/**
 * Khung nhãn cho phép kéo ảnh để định vị trực tiếp.
 * Ảnh cover khung, kéo = pan để chọn vùng hiển thị.
 * Đường dóng (extension lines) ở trong ảnh, số kích thước ra ngoài.
 */
export function DraggableLabelFrame({
  widthMm,
  heightMm,
  imageUrl,
  onExportData,
  className = '',
}: DraggableLabelFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const [scaledImgSize, setScaledImgSize] = useState({ w: 0, h: 0 })

  const scaleRef = useRef(1)
  const maxPanRef = useRef({ x: 0, y: 0 })

  const notifyExport = useCallback(() => {
    const frame = frameRef.current
    const img = imgRef.current
    if (frame && img && img.naturalWidth && onExportData) {
      onExportData({
        panX: pan.x,
        panY: pan.y,
        scale: scaleRef.current,
        imgW: img.naturalWidth,
        imgH: img.naturalHeight,
        frameW: frame.clientWidth,
        frameH: frame.clientHeight,
      })
    }
  }, [pan, onExportData])

  useEffect(() => {
    notifyExport()
  }, [pan, notifyExport])

  useEffect(() => {
    if (imageUrl && imgLoaded) {
      const img = imgRef.current
      const frame = frameRef.current
      if (!img || !frame || !img.naturalWidth) return

      const fw = frame.clientWidth
      const fh = frame.clientHeight
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const scale = Math.max(fw / iw, fh / ih)
      scaleRef.current = scale
      const sw = iw * scale
      const sh = ih * scale
      maxPanRef.current = { x: Math.max(0, sw - fw), y: Math.max(0, sh - fh) }
      setScaledImgSize({ w: sw, h: sh })
      setPan({ x: maxPanRef.current.x / 2, y: maxPanRef.current.y / 2 })
    } else {
      setScaledImgSize({ w: 0, h: 0 })
      setPan({ x: 0, y: 0 })
    }
  }, [imageUrl, imgLoaded])

  useEffect(() => {
    if (!imgLoaded || !imageUrl) return
    const frame = frameRef.current
    const img = imgRef.current
    if (!frame || !img?.naturalWidth) return

    const update = () => {
      const fw = frame.clientWidth
      const fh = frame.clientHeight
      if (fw === 0 || fh === 0) return
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const scale = Math.max(fw / iw, fh / ih)
      scaleRef.current = scale
      const sw = iw * scale
      const sh = ih * scale
      maxPanRef.current = { x: Math.max(0, sw - fw), y: Math.max(0, sh - fh) }
      setScaledImgSize((prev) => (prev.w !== sw || prev.h !== sh ? { w: sw, h: sh } : prev))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [imgLoaded, imageUrl])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageUrl) return
    const max = maxPanRef.current
    let newX = e.clientX - dragStart.x
    let newY = e.clientY - dragStart.y
    newX = Math.max(0, Math.min(max.x, newX))
    newY = Math.max(0, Math.min(max.y, newY))
    setPan({ x: newX, y: newY })
  }

  const handleMouseUp = () => setIsDragging(false)
  const handleMouseLeave = () => setIsDragging(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageUrl) return
    const t = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: t.clientX - pan.x, y: t.clientY - pan.y })
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !imageUrl) return
    e.preventDefault()
    const t = e.touches[0]
    const max = maxPanRef.current
    let newX = t.clientX - dragStart.x
    let newY = t.clientY - dragStart.y
    newX = Math.max(0, Math.min(max.x, newX))
    newY = Math.max(0, Math.min(max.y, newY))
    setPan({ x: newX, y: newY })
  }
  const handleTouchEnd = () => setIsDragging(false)

  const PI = Math.PI
  const stroke = 0.4
  const tickLen = 1.5
  const fs = Math.max(2, Math.min(widthMm / 3, heightMm / 3) * 0.08)
  const dimText = `Ø ${Math.round(widthMm / PI)} × H ${heightMm} mm`
  const totalW = widthMm + PAD * 2
  const totalH = heightMm + PAD * 2 + DIM_OUTSIDE

  const extLines = (
    <g stroke="#64748b" strokeWidth={stroke * 0.8} fill="none">
      <line x1={PAD} y1={PAD + heightMm} x2={PAD} y2={PAD + heightMm - tickLen} />
      <line x1={PAD + widthMm} y1={PAD + heightMm} x2={PAD + widthMm} y2={PAD + heightMm - tickLen} />
      <line x1={PAD + widthMm} y1={PAD} x2={PAD + widthMm - tickLen} y2={PAD} />
      <line x1={PAD + widthMm} y1={PAD + heightMm} x2={PAD + widthMm - tickLen} y2={PAD + heightMm} />
    </g>
  )

  if (!imageUrl) {
    return (
      <div
        className={`relative overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border flex items-center justify-center ${className}`}
        style={{ aspectRatio: `${totalW} / ${totalH}` }}
      >
        <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <rect width="100%" height="100%" fill="#fff" />
          <rect x={PAD} y={PAD} width={widthMm} height={heightMm} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.5} />
          <rect x={PAD} y={PAD} width={widthMm} height={heightMm} fill="none" stroke="#dc2626" strokeWidth={stroke} />
          {extLines}
          <text x={PAD + widthMm / 2} y={PAD + heightMm + DIM_OUTSIDE - 1} textAnchor="middle" dominantBaseline="auto" fontSize={fs} fill="#64748b" fontFamily="sans-serif">{dimText}</text>
        </svg>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      style={{ aspectRatio: `${totalW} / ${totalH}` }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 bg-white" />
      <div
        ref={frameRef}
        className="absolute overflow-hidden"
        style={{
          left: `${(PAD / totalW) * 100}%`,
          top: `${(PAD / totalH) * 100}%`,
          width: `${(widthMm / totalW) * 100}%`,
          height: `${(heightMm / totalH) * 100}%`,
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          className="block pointer-events-none"
          style={{
            position: 'absolute',
            left: -pan.x,
            top: -pan.y,
            width: scaledImgSize.w || undefined,
            height: scaledImgSize.h || undefined,
            minWidth: '100%',
            minHeight: '100%',
            objectFit: 'cover',
          }}
          onLoad={() => setImgLoaded(true)}
        />
      </div>
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={PAD} y={PAD} width={widthMm} height={heightMm} fill="none" stroke="#dc2626" strokeWidth={stroke} />
        {extLines}
        <text x={PAD + widthMm / 2} y={PAD + heightMm + DIM_OUTSIDE - 1} textAnchor="middle" dominantBaseline="auto" fontSize={fs} fill="#64748b" fontFamily="sans-serif">{dimText}</text>
      </svg>
    </div>
  )
}
