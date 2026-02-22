'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, ChevronDown } from 'lucide-react'

function isRestrictedInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /(FBAN|FBAV|FB_IAB|Instagram|Line\/|Zalo|TikTok)/i.test(ua)
}

function openDirectImage(url: string) {
  if (typeof window === 'undefined') return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function trackDownloadEvent(format: 'png' | 'jpeg', filename: string) {
  if (typeof window === 'undefined') return
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag !== 'function') return
  gtag('event', 'image_download', {
    route: window.location.pathname,
    format,
    filename: filename.slice(0, 100),
  })
}

async function downloadImageAsFormat(
  imageUrl: string,
  format: 'png' | 'jpeg',
  filename: string
): Promise<void> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Không load được ảnh'))
    img.src = imageUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas')
  ctx.drawImage(img, 0, 0)

  const baseName = filename.replace(/\.[^.]+$/, '')
  const ext = format === 'jpeg' ? '.jpg' : '.png'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error('Không tạo được file'))
          return
        }
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url
        a.download = baseName + ext
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        resolve()
      },
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      format === 'jpeg' ? 1 : undefined
    )
  })
}

interface DownloadImageButtonProps {
  imageUrl: string
  filename?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  children?: React.ReactNode
  showLabel?: boolean
}

export function DownloadImageButton({
  imageUrl,
  filename = 'image',
  variant = 'outline',
  size = 'sm',
  className,
  children,
  showLabel = true,
}: DownloadImageButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async (format: 'png' | 'jpeg') => {
    if (!imageUrl) return
    trackDownloadEvent(format, filename)
    if (isRestrictedInAppBrowser()) {
      // In-app browsers (FB/IG...) thường chặn download blob/data URL.
      openDirectImage(imageUrl)
      return
    }
    setLoading(true)
    try {
      await downloadImageAsFormat(imageUrl, format, filename)
    } catch {
      try {
        const res = await fetch(imageUrl, { mode: 'cors' })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename.replace(/\.[^.]+$/, '') + (format === 'jpeg' ? '.jpg' : '.png')
          a.style.display = 'none'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } else throw new Error('Fetch failed')
      } catch {
        openDirectImage(imageUrl)
      }
    } finally {
      setLoading(false)
    }
  }

  const hasLabel = showLabel || children
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={loading || !imageUrl}>
          <Download className="h-3 w-3" />
          {hasLabel && <span className="ml-1.5">{children || 'Tải về'}</span>}
          <ChevronDown className={`h-3 w-3 ${hasLabel ? 'ml-1' : 'ml-0.5'}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleDownload('png')} disabled={loading}>
          Tải PNG (chất lượng tốt nhất)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('jpeg')} disabled={loading}>
          Tải JPG (chất lượng tốt nhất)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
