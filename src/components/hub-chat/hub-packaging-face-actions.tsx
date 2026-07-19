'use client'

import { useRef } from 'react'
import { FileImage } from 'lucide-react'
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
    sectionTitle: string
    hint: string
    uploadBtn: string
    uploadWarn: string
    blank: string
    sameAs: (label: string) => string
    blankMessage: string
    copyMessage: (label: string) => string
  }
> = {
  vi: {
    sectionTitle: 'Thay toàn bộ mặt in (file từ máy)',
    hint: 'Dùng khi bạn đã có file thiết kế in hoàn chỉnh. Hoặc mô tả bên dưới để AI tạo. Không in mặt này? Chọn nhanh — không tốn credits.',
    uploadBtn: 'Chọn file thay mặt in',
    uploadWarn:
      'Thay cả mặt in — không phải ghép ảnh sản phẩm. Muốn ghép SP lên thiết kế AI? Dùng «Thêm ảnh SP» ở khung xanh phía trên.',
    blank: 'Bỏ trống',
    sameAs: (label) => `Giống ${label}`,
    blankMessage: 'bỏ trống',
    copyMessage: (label) => `giống ${label.toLowerCase()}`,
  },
  en: {
    sectionTitle: 'Replace entire face print (file from device)',
    hint: 'Use when you already have a finished print file. Or describe below for AI. No print on this face? Quick action — no credits.',
    uploadBtn: 'Choose file to replace face',
    uploadWarn:
      'Replaces the whole face — not for compositing a product photo. To flatten a product onto AI artwork, use «Add product photo» in the blue panel above.',
    blank: 'Leave blank',
    sameAs: (label) => `Same as ${label}`,
    blankMessage: 'leave blank',
    copyMessage: (label) => `same as ${label.toLowerCase()}`,
  },
  zh: {
    sectionTitle: '替换整面印刷（本机文件）',
    hint: '已有完整印刷文件时使用；或在下方描述让 AI 生成。此面不印刷？快捷选择 — 不消耗积分。',
    uploadBtn: '选择文件替换盒面',
    uploadWarn:
      '会替换整面印刷，不是合成产品图。若要在 AI 设计上合成产品，请用上方蓝色区域的「添加产品图」。',
    blank: '留空',
    sameAs: (label) => `同${label}`,
    blankMessage: '留空',
    copyMessage: (label) => `同${label}`,
  },
  ja: {
    sectionTitle: '面印刷を差し替え（端末のファイル）',
    hint: '完成済みの印刷ファイルがある場合。または下に説明してAI生成。この面は印刷しない？クイック選択 — クレジット不要。',
    uploadBtn: 'ファイルを選んで面を差し替え',
    uploadWarn:
      '面全体を差し替えます — 商品写真の合成ではありません。AIデザインに商品を合成する場合は上の青枠「商品写真を追加」を使ってください。',
    blank: '空白',
    sameAs: (label) => `${label}と同じ`,
    blankMessage: '空白',
    copyMessage: (label) => `${label}と同じ`,
  },
  ko: {
    sectionTitle: '면 인쇄 전체 교체(기기 파일)',
    hint: '완성된 인쇄 파일이 있을 때 사용하거나, 아래에 설명해 AI 생성. 이 면은 인쇄 안 함? 빠른 선택 — 크레딧 없음.',
    uploadBtn: '파일 선택해 면 교체',
    uploadWarn:
      '면 전체를 교체합니다 — 제품 사진 합성이 아닙니다. AI 디자인에 제품을 합성하려면 위 파란 패널의 «제품 사진 추가»를 사용하세요.',
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
  onSkip,
  onCopy,
  onUpload,
}: {
  locale: WebLocale
  slot: BoxFaceSlot
  busy: boolean
  onSkip: () => void | Promise<void>
  onCopy: () => void | Promise<void>
  onUpload: (files: FileList | File[]) => void | Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const t = COPY[locale]
  const copyFrom = BOX_FACE_COPY_SOURCE[slot]
  const copySourceLabel = copyFrom ? getBoxFaceSlotLabel(copyFrom, locale) : null

  return (
    <div className="rounded-lg border-2 border-amber-300/80 bg-amber-50/90 p-3 dark:border-amber-800 dark:bg-amber-950/35">
      <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">{t.sectionTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
      <p className="mt-2 rounded-md border border-amber-200/80 bg-white/70 px-2 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
        {t.uploadWarn}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
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
          variant="outline"
          className="h-8 gap-1 border-amber-500 bg-white text-xs text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-950"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <FileImage className="h-3.5 w-3.5" />
          {t.uploadBtn}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => void onSkip()}
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
            onClick={() => void onCopy()}
          >
            {t.sameAs(copySourceLabel)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
