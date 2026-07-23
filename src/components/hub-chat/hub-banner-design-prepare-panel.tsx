'use client'

import { useRef } from 'react'

import { ImagePlus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { BannerAdPresetId } from '@/lib/banner-ad-presets'
import { HubBannerAdRatioPicker } from '@/components/hub-chat/hub-banner-ad-ratio-picker'

const COPY: Record<
  WebLocale,
  {
    title: string
    intro: string
    overlayLabel: string
    overlayHint: string
    overlayPlaceholder: string
    uploadLabel: string
    uploadBtn: string
    finishFlow: string
    savedCount: string
  }
> = {
  vi: {
    title: 'Thiết kế banner',
    intro:
      'Chọn 1–4 tỷ lệ phù hợp kênh quảng cáo, tải ảnh tham khảo (không bắt buộc) rồi bấm «Tạo banner». Nếu không nhập nội dung & bố cục, hệ thống tự lấy brief chiến dịch đã nhập và tối ưu bằng AI.',
    overlayLabel: 'Nội dung & bố cục banner',
    overlayHint: 'Tùy chọn — để trống sẽ dùng nội dung chiến dịch đã nhập ở các bước trước.',
    overlayPlaceholder:
      'Ví dụ: GIẢM 50% — MUA NGAY · sản phẩm bên phải, logo góc trên trái, nền gradient tím',
    uploadLabel: 'Ảnh tham khảo (tùy chọn — sản phẩm, logo…)',
    uploadBtn: 'Tải ảnh',
    finishFlow: 'Hoàn tất quy trình',
    savedCount: 'Đã lưu {n} banner',
  },
  en: {
    title: 'Design banner',
    intro:
      'Pick 1–4 ad ratios, upload optional reference images, then tap «Generate banner». If copy & layout is empty, we use your campaign brief from earlier steps and optimize it with AI automatically.',
    overlayLabel: 'Banner copy & layout',
    overlayHint: 'Optional — leave empty to use the campaign brief from earlier steps.',
    overlayPlaceholder:
      'e.g. 50% OFF — SHOP NOW · product on the right, logo top-left, purple gradient background',
    uploadLabel: 'Reference images (optional — product, logo…)',
    uploadBtn: 'Upload images',
    finishFlow: 'Finish flow',
    savedCount: '{n} banner(s) saved',
  },
  zh: {
    title: '设计横幅',
    intro:
      '选择 1–4 个广告比例，上传可选参考图，然后点击「生成横幅」。若文案与布局留空，将自动使用前面步骤的活动 brief 并由 AI 优化。',
    overlayLabel: '横幅文案与布局',
    overlayHint: '可选 — 留空则使用前面步骤已填的活动 brief。',
    overlayPlaceholder: '例如：5折 — 立即购买 · 产品在右，Logo 左上，紫色渐变背景',
    uploadLabel: '参考图（可选 — 产品、Logo…）',
    uploadBtn: '上传图片',
    finishFlow: '完成流程',
    savedCount: '已保存 {n} 个横幅',
  },
  ja: {
    title: 'バナーデザイン',
    intro:
      '1〜4 比率を選び、参考画像（任意）をアップロードして「バナー生成」を押してください。文案・レイアウトが空の場合は、前のステップのキャンペーン brief を AI が自動最適化します。',
    overlayLabel: 'バナー文案・レイアウト',
    overlayHint: '任意 — 空欄の場合は前のステップで入力したキャンペーン brief を使用します。',
    overlayPlaceholder:
      '例：50%OFF — 今すぐ購入 · 商品は右、ロゴ左上、紫グラデーション背景',
    uploadLabel: '参考画像（任意 — 商品・ロゴなど）',
    uploadBtn: '画像をアップロード',
    finishFlow: 'フローを完了',
    savedCount: 'バナー {n} 件保存済み',
  },
  ko: {
    title: '배너 디자인',
    intro:
      '1–4개 광고 비율을 선택하고 참고 이미지(선택)를 업로드한 뒤 «배너 생성»을 누르세요. 문구·레이아웃을 비우면 이전 단계의 캠페인 brief를 AI가 자동 최적화합니다.',
    overlayLabel: '배너 문구·레이아웃',
    overlayHint: '선택 사항 — 비워 두면 이전 단계에서 입력한 캠페인 brief를 사용합니다.',
    overlayPlaceholder:
      '예: 50% 할인 — 지금 구매 · 제품 오른쪽, 로고 좌상단, 보라색 gradient 배경',
    uploadLabel: '참고 이미지(선택 — 제품, 로고…)',
    uploadBtn: '이미지 업로드',
    finishFlow: '플로우 완료',
    savedCount: '배너 {n}개 저장됨',
  },
}

export function HubBannerDesignPreparePanel({
  locale,
  selectedPresetIds,
  overlayText,
  uploadImages,
  approvedBannerCount,
  busy,
  onTogglePreset,
  onMaxPresetsSelected,
  onOverlayTextChange,
  onOverlayTextCommit,
  onUploadFiles,
  onFinishFlow,
}: {
  locale: WebLocale
  selectedPresetIds: BannerAdPresetId[]
  overlayText: string
  uploadImages: string[]
  approvedBannerCount: number
  busy: boolean
  onTogglePreset: (presetId: BannerAdPresetId) => void | Promise<void>
  onMaxPresetsSelected?: () => void
  /** Local typing — no API call per keystroke. */
  onOverlayTextChange: (text: string) => void
  /** Persist to session on blur / before generate. */
  onOverlayTextCommit?: (text: string) => void | Promise<void>
  onUploadFiles: (files: FileList) => void | Promise<void>
  onFinishFlow: () => void | Promise<void>
}) {
  const t = COPY[locale]
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
      <div>
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t.title}</p>
        <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">{t.intro}</p>
        {approvedBannerCount > 0 ? (
          <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {t.savedCount.replace('{n}', String(approvedBannerCount))}
          </p>
        ) : null}
      </div>

      <HubBannerAdRatioPicker
        locale={locale}
        selectedPresetIds={selectedPresetIds}
        busy={busy}
        onTogglePreset={onTogglePreset}
        onMaxSelected={onMaxPresetsSelected}
        compact
      />

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-amber-900 dark:text-amber-100">{t.overlayLabel}</label>
        <p className="text-[11px] text-amber-800/70 dark:text-amber-200/70">{t.overlayHint}</p>
        <Textarea
          value={overlayText}
          onChange={(e) => onOverlayTextChange(e.target.value)}
          onBlur={(e) => void onOverlayTextCommit?.(e.target.value)}
          placeholder={t.overlayPlaceholder}
          rows={3}
          className="min-h-[72px] resize-y text-sm"
          disabled={busy}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">{t.uploadLabel}</p>
        {uploadImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uploadImages.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                className="h-14 w-14 rounded-md border border-amber-200 object-cover dark:border-amber-800"
              />
            ))}
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onUploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-amber-300 text-xs"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {t.uploadBtn}
        </Button>
      </div>

      {approvedBannerCount > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => void onFinishFlow()}
        >
          {t.finishFlow}
        </Button>
      ) : null}
    </div>
  )
}
