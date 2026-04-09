'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useRef, useState, useEffect, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ImagePreview } from '@/components/ui/image-preview'
import { Upload, Shirt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface ImageState {
  file: File | null
  preview: string | null
}

interface GarmentUploaderProps {
  images: ImageState[]
  onImagesChange: (files: FileList) => void
  onImageRemove: (index: number) => void
  maxImages?: number
  compact?: boolean
  theme: {
    dashedBorder: string
    softBg: string
    accentText: string
    outlineButton: string
  }
}

export function GarmentUploader({
  images,
  onImagesChange,
  onImageRemove,
  maxImages = 6,
  theme,
  compact = false,
}: GarmentUploaderProps) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = readWebLocaleFromDocumentCookie()
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      if (images.length + files.length > maxImages) {
        toast({
          title: tr('Số lượng ảnh tối đa', 'Maximum image count', '最大图片数量', '最大画像数', '최대 이미지 수'),
          description: `${tr('Bạn chỉ có thể tải lên tối đa', 'You can upload up to', '你最多只能上传', 'アップロードできる最大数は', '최대 업로드 가능 수는')} ${maxImages} ${tr('ảnh cho mỗi người.', 'images per person.', '张/인입니다。', '枚/人です。', '장/인입니다.')}`,
          variant: 'destructive',
        })
        return
      }
      onImagesChange(files)
    }
    if (e.target) {
      e.target.value = ''
    }
  }

  return (
    <div className={cn('w-full rounded-lg border-2 border-dashed overflow-hidden flex flex-col relative', compact ? 'h-[140px] sm:h-[160px]' : 'h-[200px] sm:h-[260px]', theme.dashedBorder, theme.softBg)}>
      <div className={cn("flex-1 min-h-0 overflow-y-auto", compact ? "p-2" : "p-2 sm:p-3")}>
        {images.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5 sm:gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-md overflow-hidden border bg-white shadow-sm group shrink-0">
                <ImagePreview src={img.preview!} alt={`${tr('Sản phẩm', 'Garment', '服装', '衣装', '의류')} ${idx + 1}`} className="w-full h-full" />
                <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 min-h-[44px] min-w-[44px] rounded-full touch-manipulation"
                    onClick={(e) => { e.stopPropagation(); onImageRemove(idx); }}
                  >
                    <span className="sr-only">{tr('Xóa', 'Remove', '删除', '削除', '삭제')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <label className={cn("relative h-full flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 active:bg-black/5 rounded-md transition-colors border border-transparent hover:border-black/10 -m-1 p-2 touch-manipulation min-h-[120px]", compact ? "gap-1" : "gap-1.5")}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-manipulation z-10" style={{ fontSize: 0 }} onChange={handleFileChange} />
            <div className={cn("rounded-full bg-white shadow-sm pointer-events-none", theme.accentText, compact ? "p-1.5" : "p-2")}>
              <Shirt className={compact ? "h-4 w-4" : "h-5 w-5"} />
            </div>
            <p className="text-xs text-muted-foreground font-medium text-center pointer-events-none">{tr('Tải ảnh sản phẩm', 'Upload garment image', '上传服装图片', '衣装画像をアップロード', '의류 이미지 업로드')}</p>
            <span className={cn("pointer-events-none text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-md border", theme.outlineButton, compact ? "h-5" : "h-6")}>
              <Upload className="mr-1 h-3 w-3" /> {tr('Chọn ảnh', 'Select image', '选择图片', '画像を選択', '이미지 선택')}
            </span>
          </label>
        )}
      </div>
      {images.length > 0 && images.length < maxImages && (
        <label className={cn("relative shrink-0 flex items-center justify-center gap-2 border-t border-black/5 cursor-pointer hover:bg-black/5 active:bg-black/5 transition-colors touch-manipulation min-h-[44px]", compact ? "py-1.5 px-2" : "py-2 px-2")}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-manipulation" style={{ fontSize: 0 }} onChange={handleFileChange} />
          <div className={cn("p-1.5 rounded-full pointer-events-none", theme.accentText)}>
            <Upload className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs text-muted-foreground font-medium pointer-events-none">{tr('Thêm sản phẩm', 'Add garment', '添加服装', '衣装を追加', '의류 추가')}</span>
        </label>
      )}
    </div>
  )
}
