'use client'
/* eslint-disable @next/next/no-img-element -- ngoài app Meta vẫn hiện ảnh QR SePay trực tiếp */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { detectInAppBrowser } from '@/lib/partner-website/shop/in-app-browser'
import {
  CREDIT_QR_TILE_COLS,
  CREDIT_QR_TILE_ROWS,
  creditQrTiles,
  isCreditPaymentQrImageUrl,
  type CreditQrTile,
} from '@/lib/payment-qr-image'

function isMetaInAppQrBrowser(): boolean {
  const kind = detectInAppBrowser()
  return kind === 'facebook' || kind === 'messenger' || kind === 'instagram'
}

type StripState = {
  width: number
  height: number
  tiles: CreditQrTile[]
  bitmap: ImageBitmap
}

/**
 * Trong Facebook / Messenger / Instagram: không gắn ảnh QR nguyên tấm.
 * App Meta thấy một ảnh VietQR thì tự mở sheet «Chọn phương thức thanh toán».
 * Cắt thành nhiều canvas để chỉ còn danh sách ngân hàng của trang.
 */
export function PaymentQrImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [meta, setMeta] = useState<boolean | null>(null)
  const [strips, setStrips] = useState<StripState | null>(null)
  const tileRefs = useRef<Array<HTMLCanvasElement | null>>([])

  useLayoutEffect(() => {
    setMeta(isMetaInAppQrBrowser())
  }, [])

  useEffect(() => {
    if (meta !== true) return
    if (!isCreditPaymentQrImageUrl(src)) return
    let cancelled = false
    const run = async () => {
      const res = await fetch(`/api/account/payment-qr-image?url=${encodeURIComponent(src)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('qr')
      const bytes = await res.arrayBuffer()
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      if (cancelled) {
        bitmap.close()
        return
      }
      setStrips({
        width: bitmap.width,
        height: bitmap.height,
        tiles: creditQrTiles(bitmap.width, bitmap.height, CREDIT_QR_TILE_COLS, CREDIT_QR_TILE_ROWS),
        bitmap,
      })
    }
    void run().catch(() => {
      if (!cancelled) setStrips(null)
    })
    return () => {
      cancelled = true
    }
  }, [meta, src])

  useLayoutEffect(() => {
    if (!strips) return
    strips.tiles.forEach((tile, index) => {
      const canvas = tileRefs.current[index]
      if (!canvas) return
      canvas.width = tile.w
      canvas.height = tile.h
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(strips.bitmap, tile.x, tile.y, tile.w, tile.h, 0, 0, tile.w, tile.h)
    })
  }, [strips])

  useEffect(() => {
    return () => {
      strips?.bitmap.close()
    }
  }, [strips])

  if (meta === false) {
    return <img src={src} alt={alt} className={className} />
  }

  const portrait = strips ? strips.height > strips.width : true

  return (
    <div className={cn('relative overflow-hidden bg-white', className)} aria-busy={!strips}>
      {strips ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute left-1/2 top-1/2"
          style={{
            aspectRatio: `${strips.width} / ${strips.height}`,
            width: portrait ? 'auto' : '100%',
            height: portrait ? '100%' : 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            transform: 'translate(-50%, -50%)',
            display: 'grid',
            gridTemplateColumns: `repeat(${CREDIT_QR_TILE_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${CREDIT_QR_TILE_ROWS}, minmax(0, 1fr))`,
            lineHeight: 0,
            gap: 0,
          }}
        >
          {strips.tiles.map((tile, index) => (
            <canvas
              key={`${tile.x}-${tile.y}`}
              ref={(node) => {
                tileRefs.current[index] = node
              }}
              className="block max-w-none"
              style={{ width: 'calc(100% + 1px)', height: 'calc(100% + 1px)' }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
