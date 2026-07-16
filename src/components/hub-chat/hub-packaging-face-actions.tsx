'use client'

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import {
  BOX_FACE_COPY_SOURCE,
  getBoxFaceSlotLabel,
  isSecondaryBoxFaceSlot,
  type BoxFaceSlot,
} from '@/lib/packaging/box-face-slots'

const COPY: Record<
  WebLocale,
  {
    hint: string
    uploadBtn: string
    blank: string
    sameAs: (label: string) => string
    blankMessage: string
    copyMessage: (label: string) => string
  }
> = {
  vi: {
    hint: 'Tải ảnh thiết kế có sẵn từ máy, hoặc mô tả bên dưới để AI tạo. Không in mặt này? Chọn nhanh — không tốn credits.',
    uploadBtn: 'Tải ảnh mặt',
    blank: 'Bỏ trống',
    sameAs: (label) => `Giống ${label}`,
    blankMessage: 'bỏ trống',
    copyMessage: (label) => `giống ${label.toLowerCase()}`,
  },
  en: {
    hint: 'Upload your own print artwork, or describe below for AI. No print on this face? Quick action — no credits.',
    uploadBtn: 'Upload face image',
    blank: 'Leave blank',
    sameAs: (label) => `Same as ${label}`,
    blankMessage: 'leave blank',
    copyMessage: (label) => `same as ${label.toLowerCase()}`,
  },
  zh: {
    hint: '从电脑上传印刷图，或在下方描述让 AI 生成。此面不印刷？快捷选择 — 不消耗积分。',
    uploadBtn: '上传该面图片',
    blank: '留空',
    sameAs: (label) => `同${label}`,
    blankMessage: '留空',
    copyMessage: (label) => `同${label}`,
  },
  ja: {
    hint: 'PCから印刷用画像をアップロード、または下に説明してAI生成。この面は印刷しない？クイック選択 — クレジット不要。',
    uploadBtn: '面画像をアップロード',
    blank: '空白',
    sameAs: (label) => `${label}と同じ`,
    blankMessage: '空白',
    copyMessage: (label) => `${label}と同じ`,
  },
  ko: {
    hint: 'PC에서 인쇄용 이미지 업로드, 또는 아래에 설명해 AI 생성. 이 면은 인쇄 안 함? 빠른 선택 — 크레딧 없음.',
    uploadBtn: '면 이미지 업로드',
    blank: '비우기',
    sameAs: (label) => `${label}와 동일`,
    blankMessage: '비우기',
    copyMessage: (label) => `${label}와 동일`,
  },
}

export function HubPackagingFaceActions({
  locale,
  slot,
  busy,
  onSubmit,
  onUpload,
}: {
  locale: WebLocale
  slot: BoxFaceSlot
  busy: boolean
  onSubmit: (message: string) => void | Promise<void>
  onUpload: (files: FileList | File[]) => void | Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const t = COPY[locale]
  const copyFrom = BOX_FACE_COPY_SOURCE[slot]
  const copySourceLabel = copyFrom ? getBoxFaceSlotLabel(copyFrom, locale) : null

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onUpload(e.target.files)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-8 gap-1 bg-indigo-600 text-xs hover:bg-indigo-700"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {t.uploadBtn}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => void onSubmit(t.blankMessage)}
        >
          {t.blank}
        </Button>
        {isSecondaryBoxFaceSlot(slot) && copySourceLabel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => void onSubmit(t.copyMessage(copySourceLabel))}
          >
            {t.sameAs(copySourceLabel)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
