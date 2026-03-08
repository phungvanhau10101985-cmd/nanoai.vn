'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Maximize2, X, Download, FileText, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
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
import { getPresetsForAspectRatio, inferAspectRatioFromDimensions } from '@/lib/print-ready-presets'
import { generatePrintReadyPdf } from '@/app/actions/print-ready'
import { useToast } from '@/hooks/use-toast'

interface ImagePreviewProps {
  src: string
  alt: string
  className?: string
  /** Tỷ lệ ảnh (vd: "1:1", "16:9") – nếu không thì tự suy từ kích thước */
  printReadyAspectRatio?: string
  /** Dùng img thay vì Image fill – cho grid/thumbnail không cần fill */
  asImg?: boolean
}

function isRestrictedInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /(FBAN|FBAV|FB_IAB|Instagram|Line\/|Zalo|TikTok)/i.test(ua)
}

export function ImagePreview({ src, alt, className, printReadyAspectRatio, asImg }: ImagePreviewProps) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [isOpen, setIsOpen] = useState(false)
  const [inferredAspectRatio, setInferredAspectRatio] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const hasPushedHistoryRef = useRef(false)
  const closingFromPopStateRef = useRef(false)
  const { toast } = useToast()

  const aspectRatio = printReadyAspectRatio || inferredAspectRatio
  const printPresets = aspectRatio ? getPresetsForAspectRatio(aspectRatio) : []
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    setInferredAspectRatio(null)
  }, [src])

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onPopState = () => {
      if (!isOpen) return
      closingFromPopStateRef.current = true
      hasPushedHistoryRef.current = false
      setIsOpen(false)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isOpen])

  const handleOpenChange = (open: boolean) => {
    if (typeof window === 'undefined') {
      setIsOpen(open)
      return
    }

    if (open) {
      if (!hasPushedHistoryRef.current) {
        window.history.pushState({ imagePreview: true }, '')
        hasPushedHistoryRef.current = true
      }
      setIsOpen(true)
      return
    }

    setIsOpen(false)
    if (closingFromPopStateRef.current) {
      closingFromPopStateRef.current = false
      return
    }

    if (hasPushedHistoryRef.current) {
      hasPushedHistoryRef.current = false
      window.history.back()
    }
  }

  const handleDownload = (format: 'png' | 'jpeg') => {
    if (isRestrictedInAppBrowser()) {
      // In-app browsers thường chặn tải bằng download/data URL.
      window.open(src, '_blank', 'noopener,noreferrer')
      return
    }
    if (!imageRef.current) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = imageRef.current
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    
    // Fill background with white for JPG to avoid black background on transparent PNGs
    if (format === 'jpeg') {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    
    ctx.drawImage(img, 0, 0)

    const link = document.createElement('a')
    const fileExtension = format === 'jpeg' ? 'jpg' : 'png'
    link.download = `${alt.replace(/\s+/g, '-') || 'image'}.${fileExtension}`
    link.href = canvas.toDataURL(`image/${format}`, 1.0) // Quality 1.0 for max quality
    link.click()
  }

  const handleImageLoad = () => {
    const img = imageRef.current
    if (img?.naturalWidth && img?.naturalHeight && !printReadyAspectRatio) {
      const inferred = inferAspectRatioFromDimensions(img.naturalWidth, img.naturalHeight)
      setInferredAspectRatio(inferred)
    }
  }

  const handlePrintReadyPdf = async (widthMm: number, heightMm: number) => {
    if (!src) return
    setPdfLoading(true)
    try {
      const result = await generatePrintReadyPdf(src, widthMm, heightMm)
      if ('error' in result) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
        return
      }
      const a = document.createElement('a')
      a.href = result.pdfUrl
      a.download = `${(alt || 'image').replace(/\s+/g, '-')}-${widthMm}x${heightMm}mm.pdf`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast({ title: tr('Đã tạo PDF chuẩn in', 'Print-ready PDF created', '已生成印刷用PDF', '印刷用PDFを作成しました', '인쇄용 PDF 생성됨'), duration: 3000 })
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {asImg ? (
          <button
            type="button"
            className={`relative cursor-pointer group block w-full h-full min-w-0 min-h-0 border-0 p-0 bg-transparent text-left overflow-hidden ${className}`}
            aria-label={tr('Xem ảnh phóng to', 'View enlarged image', '查看大图', '拡大画像を表示', '확대 이미지 보기')}
          >
            <img src={src} alt={alt} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <Maximize2 className="text-white w-6 h-6 drop-shadow-md" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            className={`relative cursor-pointer group block w-full h-full min-w-0 min-h-0 border-0 p-0 bg-transparent text-left ${className}`}
            aria-label={tr('Xem ảnh phóng to', 'View enlarged image', '查看大图', '拡大画像を表示', '확대 이미지 보기')}
          >
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <Maximize2 className="text-white w-6 h-6 drop-shadow-md" />
            </div>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[98vw] w-[98vw] min-h-[95vh] max-h-[95vh] p-0 bg-black/90 border-none shadow-lg flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full flex items-center justify-center p-2 min-h-[90vh] overflow-hidden">
          <div className="absolute top-2 right-2 z-50 flex gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white bg-white/20 hover:bg-white/40 rounded-full border border-white/30 h-8 w-8 shrink-0"
                  title={tr('Tải ảnh xuống', 'Download image', '下载图片', '画像をダウンロード', '이미지 다운로드')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="h-3 w-3 mr-2" />
                  {tr('Mở ảnh full size (tab mới)', 'Open full size (new tab)', '新标签页打开大图', '新タブで実寸表示', '새 탭에서 실제 크기')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload('png')} disabled={pdfLoading}>
                  {tr('Lưu dưới dạng PNG (Chất lượng cao nhất)', 'Save as PNG (Highest quality)', '保存为 PNG（最高质量）', 'PNGで保存（最高画質）', 'PNG로 저장 (최고 품질)')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload('jpeg')} disabled={pdfLoading}>
                  {tr('Lưu dưới dạng JPG (Chất lượng cao)', 'Save as JPG (High quality)', '保存为 JPG（高质量）', 'JPGで保存（高画質）', 'JPG로 저장 (고품질)')}
                </DropdownMenuItem>
                {printPresets.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={pdfLoading}>
                        <FileText className="h-3 w-3" />
                        {tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {printPresets.map((p) => (
                          <DropdownMenuItem
                            key={p.value}
                            onClick={() => handlePrintReadyPdf(p.widthMm, p.heightMm)}
                            disabled={pdfLoading}
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
            
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:text-white bg-white/20 hover:bg-white/40 rounded-full border border-white/30 h-8 w-8 shrink-0"
              onClick={() => handleOpenChange(false)}
              title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Dùng img thay vì Next/Image để đảm bảo ảnh hiển thị (tránh lỗi domain/CORS) */}
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
