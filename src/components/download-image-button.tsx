'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, ChevronDown, FileText } from 'lucide-react'
import { generatePrintReadyPdf } from '@/app/actions/print-ready'
import { getPresetsForAspectRatio } from '@/lib/print-ready-presets'
import { useToast } from '@/hooks/use-toast'

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

export interface DownloadImageButtonProps {
  imageUrl: string
  filename?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  children?: React.ReactNode
  showLabel?: boolean
  /** Bật xuất PDF chuẩn in (bleed, crop marks, kích thước mm) */
  printReady?: boolean
  /** Tỷ lệ ảnh đang chọn (vd: "1:1", "3:4") – chỉ hiện khổ in phù hợp */
  printReadyAspectRatio?: string
  /** Nhãn cho mục PDF chuẩn in (đa ngôn ngữ) */
  printReadyLabel?: string
  /** Toast khi tạo PDF thành công (đa ngôn ngữ) */
  printReadySuccessToast?: string
}

export function DownloadImageButton({
  imageUrl,
  filename = 'image',
  variant = 'outline',
  size = 'sm',
  className,
  children,
  showLabel = true,
  printReady = false,
  printReadyAspectRatio,
  printReadyLabel = 'Tải PDF chuẩn in',
  printReadySuccessToast = 'Đã tạo PDF chuẩn in. Bleed 3mm, crop marks. Gửi file cho xưởng in.',
}: DownloadImageButtonProps) {
  const printPresets = printReadyAspectRatio
    ? getPresetsForAspectRatio(printReadyAspectRatio)
    : []
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const { toast } = useToast()

  const handlePrintReadyPdf = async (widthMm: number, heightMm: number) => {
    if (!imageUrl) return
    setPdfLoading(true)
    try {
      const result = await generatePrintReadyPdf(imageUrl, widthMm, heightMm)
      if ('error' in result) {
        toast({ title: 'Lỗi', description: result.error, variant: 'destructive' })
        return
      }
      const a = document.createElement('a')
      a.href = result.pdfUrl
      a.download = `${filename.replace(/\.[^.]+$/, '')}-${widthMm}x${heightMm}mm.pdf`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast({ title: printReadySuccessToast, duration: 3000 })
    } finally {
      setPdfLoading(false)
    }
  }

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
  const isBusy = loading || pdfLoading
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={isBusy || !imageUrl}>
          <Download className="h-3 w-3" />
          {hasLabel && <span className="ml-1.5">{children || 'Tải về'}</span>}
          <ChevronDown className={`h-3 w-3 ${hasLabel ? 'ml-1' : 'ml-0.5'}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleDownload('png')} disabled={isBusy}>
          Tải PNG (chất lượng tốt nhất)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('jpeg')} disabled={isBusy}>
          Tải JPG (chất lượng tốt nhất)
        </DropdownMenuItem>
        {printReady && printPresets.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={isBusy}>
                <FileText className="h-3 w-3" />
                {printReadyLabel}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {printPresets.map((p) => (
                  <DropdownMenuItem
                    key={p.value}
                    onClick={() => handlePrintReadyPdf(p.widthMm, p.heightMm)}
                    disabled={isBusy}
                  >
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
