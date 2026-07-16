'use client'

import { useState, useEffect } from 'react'
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
import { getPresetsForAspectRatio, inferAspectRatioFromDimensions } from '@/lib/print-ready-presets'
import { useToast } from '@/hooks/use-toast'

import { downloadImageFromUrl } from '@/lib/download-image-client'

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

export interface DownloadImageButtonLabels {
  button?: string
  png?: string
  jpeg?: string
  failedTitle?: string
  failedDescription?: string
}

export interface DownloadImageButtonProps {
  imageUrl: string
  filename?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  children?: React.ReactNode
  showLabel?: boolean
  labels?: DownloadImageButtonLabels
  /** Bật xuất PDF chuẩn in (bleed, crop marks, kích thước mm) */
  printReady?: boolean
  /** Tỷ lệ ảnh đang chọn (vd: "1:1", "3:4") – chỉ hiện khổ in phù hợp */
  printReadyAspectRatio?: string
  /** Khi true: nếu không có printReadyAspectRatio thì tự suy từ kích thước ảnh */
  printReadyInferFromImage?: boolean
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
  printReadyInferFromImage = false,
  printReadyLabel = 'Tải PDF chuẩn in',
  printReadySuccessToast = 'Đã tạo PDF chuẩn in. Bleed 3mm, crop marks. Gửi file cho xưởng in.',
  labels,
}: DownloadImageButtonProps) {
  const downloadLabels = {
    button: labels?.button ?? 'Tải về',
    png: labels?.png ?? 'Tải PNG (chất lượng tốt nhất)',
    jpeg: labels?.jpeg ?? 'Tải JPG (chất lượng tốt nhất)',
    failedTitle: labels?.failedTitle ?? 'Không tải được ảnh',
    failedDescription:
      labels?.failedDescription ?? 'Đã mở ảnh trong tab mới — giữ ảnh để lưu.',
  }
  const [inferredAspectRatio, setInferredAspectRatio] = useState<string | null>(null)
  const effectiveAspectRatio = printReadyAspectRatio ?? inferredAspectRatio ?? undefined
  const printPresets = effectiveAspectRatio
    ? getPresetsForAspectRatio(effectiveAspectRatio)
    : []
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!printReady || !printReadyInferFromImage || printReadyAspectRatio || !imageUrl) return
    setInferredAspectRatio(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const onLoad = () => {
      const ratio = inferAspectRatioFromDimensions(img.naturalWidth, img.naturalHeight)
      setInferredAspectRatio(ratio)
    }
    img.onload = onLoad
    img.onerror = () => setInferredAspectRatio(null)
    img.src = imageUrl
    return () => {
      img.onload = null
      img.onerror = null
      img.src = ''
    }
  }, [printReady, printReadyInferFromImage, printReadyAspectRatio, imageUrl])

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
    setLoading(true)
    try {
      await downloadImageFromUrl(imageUrl, format, filename)
    } catch {
      toast({
        title: downloadLabels.failedTitle,
        description: downloadLabels.failedDescription,
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  const hasLabel = showLabel || children
  const isBusy = loading || pdfLoading
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className} disabled={isBusy || !imageUrl}>
          <Download className="h-3 w-3" />
          {hasLabel && <span className="ml-1.5">{children || downloadLabels.button}</span>}
          <ChevronDown className={`h-3 w-3 ${hasLabel ? 'ml-1' : 'ml-0.5'}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleDownload('png')} disabled={isBusy}>
          {downloadLabels.png}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDownload('jpeg')} disabled={isBusy}>
          {downloadLabels.jpeg}
        </DropdownMenuItem>
        {printReady && (printPresets.length > 0 || printReadyInferFromImage) && (
          <>
            <DropdownMenuSeparator />
            {printPresets.length > 0 ? (
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
            ) : (
              <DropdownMenuItem
                onClick={async () => {
                  if (!imageUrl) return
                  const img = new Image()
                  img.crossOrigin = 'anonymous'
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve()
                    img.onerror = () => reject(new Error('Load failed'))
                    img.src = imageUrl
                  })
                  const pxPerMm = 300 / 25.4
                  const widthMm = Math.round((img.naturalWidth / pxPerMm) * 10) / 10
                  const heightMm = Math.round((img.naturalHeight / pxPerMm) * 10) / 10
                  const w = Math.max(10, Math.min(500, widthMm))
                  const h = Math.max(10, Math.min(500, heightMm))
                  await handlePrintReadyPdf(w, h)
                }}
                disabled={isBusy}
              >
                <FileText className="h-3 w-3" />
                {printReadyLabel}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
