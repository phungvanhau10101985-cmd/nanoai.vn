'use client'

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'

const COPY: Record<WebLocale, { hint: string; upload: string }> = {
  vi: {
    hint: 'Mô tả thiết kế thân liền trong ô chat hoặc tải một ảnh theo thứ tự trước | phải | sau | trái.',
    upload: 'Tải ảnh thân liền',
  },
  en: {
    hint: 'Describe the continuous body in chat or upload one image ordered front | right | back | left.',
    upload: 'Upload body strip',
  },
  zh: {
    hint: '在聊天框描述连续盒身，或上传一张按 正面 | 右侧 | 背面 | 左侧 排列的图片。',
    upload: '上传连续盒身',
  },
  ja: {
    hint: 'チャットで連続胴面を説明するか、正面 | 右 | 背面 | 左 の順の画像をアップロードします。',
    upload: '胴面ストリップをアップロード',
  },
  ko: {
    hint: '채팅에 연속 몸통 디자인을 설명하거나 앞 | 오른쪽 | 뒤 | 왼쪽 순서의 이미지를 업로드하세요.',
    upload: '연속 몸통 업로드',
  },
}

export function HubPackagingBodyStripActions({
  locale,
  busy,
  onUpload,
}: {
  locale: WebLocale
  busy: boolean
  onUpload: (files: FileList) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const t = COPY[locale]

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-violet-50/70 px-2.5 py-2 text-xs text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
      <span className="min-w-0 flex-1">{t.hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onUpload(event.target.files)
          event.currentTarget.value = ''
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 shrink-0 text-xs"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        {t.upload}
      </Button>
    </div>
  )
}
