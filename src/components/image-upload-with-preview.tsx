'use client'

import { useRef, forwardRef } from 'react'
import { Upload, RefreshCw } from 'lucide-react'
import { ImagePreview } from '@/components/ui/image-preview'

interface ImageUploadWithPreviewProps {
  /** URL preview khi đã chọn ảnh */
  preview: string | null
  /** Callback khi chọn file */
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** ID input (để label htmlFor) */
  inputId: string
  /** Text khi chưa chọn */
  emptyLabel?: string
  /** Class cho container */
  className?: string
  /** Class cho vùng preview */
  previewClassName?: string
  /** accept cho input (mặc định image/*) */
  accept?: string
  /** multiple cho input */
  multiple?: boolean
  /** Nút "Chọn lại" - hiện khi đã có ảnh */
  changeLabel?: string
}

/**
 * Vùng chọn ảnh: khi chưa chọn hiện "Chọn ảnh", khi đã chọn hiện preview + nút "Chọn lại".
 * Khách có thể bấm "Chọn lại" để đổi ảnh khác.
 */
export const ImageUploadWithPreview = forwardRef<HTMLInputElement, ImageUploadWithPreviewProps>(
  function ImageUploadWithPreview(
    {
      preview,
      onFileChange,
      inputId,
      emptyLabel = 'Chọn ảnh',
      className = 'block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
      previewClassName = 'w-full h-full object-contain rounded-lg',
      accept = 'image/*',
      multiple = false,
      changeLabel = 'Chọn lại',
    },
    ref
  ) {
    const internalRef = useRef<HTMLInputElement | null>(null) as React.MutableRefObject<HTMLInputElement | null>

    const triggerInput = () => {
      internalRef.current?.click()
    }

    return (
      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className={`${className} ${preview ? 'border-solid' : ''}`}
        >
          {preview ? (
            <div className="relative w-full h-full min-h-[200px] flex flex-col items-center justify-center rounded-lg overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,#1f2937_0%_50%)] bg-[length:12px_12px]">
              <ImagePreview src={preview} alt="Preview" className={previewClassName} />
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground font-medium">{emptyLabel}</p>
            </>
          )}
        </label>
        <input
          id={inputId}
          ref={(el) => {
            internalRef.current = el
            if (typeof ref === 'function') ref(el)
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
          }}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={onFileChange}
        />
        {preview && (
          <button
            type="button"
            onClick={triggerInput}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {changeLabel}
          </button>
        )}
      </div>
    )
  }
)
