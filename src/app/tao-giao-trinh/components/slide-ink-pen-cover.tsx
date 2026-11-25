'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { SlideInkPenFrame } from '../lib/slide-ink-pen'

function objectAnchor(value: string): { x: number; y: number } {
  const map = (token: string) => {
    if (token === 'left' || token === 'top') return 0
    if (token === 'right' || token === 'bottom') return 1
    if (token === 'center') return 0.5
    if (token.endsWith('%')) {
      const n = parseFloat(token)
      return Number.isFinite(n) ? n / 100 : 0.5
    }
    return 0.5
  }
  const parts = value.trim().split(/\s+/)
  return { x: map(parts[0] || 'center'), y: map(parts[1] || 'center') }
}

function drawPen(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.82)
  ctx.scale(0.92, 0.92)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#6d28d9'
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(-14, 2)
  ctx.lineTo(0, 0)
  ctx.stroke()
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(8, -12)
  ctx.lineTo(16, -7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#7c3aed'
  ctx.strokeStyle = '#4c1d95'
  ctx.beginPath()
  ctx.moveTo(8, -12)
  ctx.lineTo(40, -42)
  ctx.lineTo(50, -32)
  ctx.lineTo(16, -7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ddd6fe'
  ctx.beginPath()
  ctx.moveTo(40, -42)
  ctx.lineTo(54, -50)
  ctx.lineTo(58, -38)
  ctx.lineTo(44, -32)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function imageBox(img: HTMLImageElement, root: HTMLElement) {
  const imgRect = img.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  const naturalW = img.naturalWidth || 0
  const naturalH = img.naturalHeight || 0
  if (naturalW < 2 || naturalH < 2 || imgRect.width < 2 || imgRect.height < 2) return null
  const scale = Math.min(imgRect.width / naturalW, imgRect.height / naturalH)
  const width = naturalW * scale
  const height = naturalH * scale
  const anchor = objectAnchor(getComputedStyle(img).objectPosition || '50% 50%')
  const left = imgRect.left + (imgRect.width - width) * anchor.x - rootRect.left
  const top = imgRect.top + (imgRect.height - height) * anchor.y - rootRect.top
  return {
    left,
    top,
    width,
    height,
    coverWidth: Math.max(width, imgRect.right - rootRect.left - left),
    coverHeight: Math.max(height, imgRect.bottom - rootRect.top - top),
  }
}

/** Tăng số này khi đổi cách vẽ để vòng requestAnimationFrame chạy lại sau khi nạp module. */
const INK_COVER_PAINT = 10

/** Phủ trắng phần bút chưa đi tới. `frameRef` đổi từng khung hình, không kéo theo render của cả trang. */
export function SlideInkPenCover({
  frameRef,
  src,
}: {
  frameRef: RefObject<SlideInkPenFrame | null>
  src: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const penRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const pen = penRef.current
    if (!root || !canvas || !pen) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const paint = () => {
      raf = window.requestAnimationFrame(paint)
      const stage = root.parentElement
      const img = stage?.querySelector('img')
      const frame = frameRef.current
      const box = stage && img instanceof HTMLImageElement ? imageBox(img, root) : null
      const active = Boolean(
        frame?.enabled &&
          frame.imageUrl &&
          src &&
          frame.imageUrl === src &&
          box &&
          Number.isFinite(box.left) &&
          Number.isFinite(box.top) &&
          Number.isFinite(box.coverWidth) &&
          Number.isFinite(box.coverHeight) &&
          box.coverWidth > 1 &&
          box.coverHeight > 1,
      )
      if (!active || !box) {
        if (canvas.width !== 0) {
          canvas.width = 0
          canvas.height = 0
        }
        pen.style.display = 'none'
        return
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const pxW = Math.max(1, Math.round(box.coverWidth * dpr))
      const pxH = Math.max(1, Math.round(box.coverHeight * dpr))
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW
        canvas.height = pxH
      }
      canvas.style.zIndex = '1'
      canvas.style.left = `${box.left}px`
      canvas.style.top = `${box.top}px`
      canvas.style.width = `${box.coverWidth}px`
      canvas.style.height = `${box.coverHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, box.coverWidth, box.coverHeight)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, box.coverWidth, box.coverHeight)
      ctx.globalCompositeOperation = 'destination-out'
      for (const band of frame?.bands ?? []) {
        ctx.fillRect(band.x * box.width, band.y * box.height, band.w * box.width, band.h * box.height)
      }
      ctx.globalCompositeOperation = 'source-over'
      pen.style.display = 'none'
      if (frame?.pen) {
        drawPen(ctx, frame.pen.x * box.width, frame.pen.y * box.height)
      }
    }
    raf = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(raf)
  }, [frameRef, src, INK_COVER_PAINT])

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[3]" data-slide-ink-pen>
      <canvas ref={canvasRef} className="absolute z-[1]" aria-hidden />
      <div ref={penRef} className="absolute z-[8] hidden" aria-hidden>
        <svg
          width="88"
          height="88"
          viewBox="0 0 72 72"
          style={{ transform: 'translate(-9.78px, -78.22px)', filter: 'drop-shadow(0 2px 2px rgba(15,23,42,0.45))' }}
        >
          <path d="M2 64h8" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M26 56 58 24c4-4 6-9 2-13l-3-3c-4-4-9-2-13 2L18 48l8 8Z" fill="#7c3aed" stroke="#4c1d95" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M50 16 58 12l4 6-6 4" fill="#ddd6fe" stroke="#6d28d9" strokeWidth="1" strokeLinejoin="round" />
          <path d="M22 50 30 46l6 6-8 4Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" strokeLinejoin="round" />
          <path d="M8 64 20 50l8 6L14 66c-2 1-5 0-6-2Z" fill="#f8fafc" stroke="#334155" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M8 64 18 54" stroke="#4c1d95" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
