'use client'

import { useRef } from 'react'

import { ImagePlus, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    domainLabel: string
    domainHint: string
    domainPlaceholder: string
    logoLabel: string
    logoHint: string
    logoUploadBtn: string
    logoRemoveBtn: string
    productUploadLabel: string
    productUploadBtn: string
    finishFlow: string
    savedCount: string
  }
> = {
  vi: {
    title: 'Thiết kế banner',
    intro:
      'Chọn 1–4 tỷ lệ, tải logo để ghép vào banner (khuyến nghị), thêm ảnh sản phẩm nếu cần — rồi bấm «Tạo banner».',
    overlayLabel: 'Nội dung & bố cục banner',
    overlayHint: 'Tùy chọn — để trống sẽ dùng nội dung chiến dịch đã nhập ở các bước trước.',
    overlayPlaceholder:
      'Ví dụ: GIẢM 50% — MUA NGAY · sản phẩm bên phải, logo góc trên trái, nền gradient tím',
    domainLabel: 'Tên miền hoặc thương hiệu',
    domainHint: 'Hiển thị trên banner — có thể là domain website hoặc tên thương hiệu.',
    domainPlaceholder: 'vd: 188.com.vn hoặc Vân Anh Fashion',
    logoLabel: 'Logo thương hiệu (ghép vào banner)',
    logoHint: 'Tải file logo PNG/JPG — AI sẽ ghép đúng logo của bạn lên banner.',
    logoUploadBtn: 'Tải logo',
    logoRemoveBtn: 'Xóa logo',
    productUploadLabel: 'Ảnh sản phẩm thêm (tùy chọn)',
    productUploadBtn: 'Tải ảnh sản phẩm',
    finishFlow: 'Hoàn tất quy trình',
    savedCount: 'Đã lưu {n} banner',
  },
  en: {
    title: 'Design banner',
    intro:
      'Pick 1–4 ratios, upload your logo to composite on the banner (recommended), add product photos if needed — then tap «Generate banner».',
    overlayLabel: 'Banner copy & layout',
    overlayHint: 'Optional — leave empty to use the campaign brief from earlier steps.',
    overlayPlaceholder:
      'e.g. 50% OFF — SHOP NOW · product on the right, logo top-left, purple gradient background',
    domainLabel: 'Domain or brand name',
    domainHint: 'Shown on the banner — can be a website domain or brand name.',
    domainPlaceholder: 'e.g. 188.com.vn or Van Anh Fashion',
    logoLabel: 'Brand logo (composite on banner)',
    logoHint: 'Upload PNG/JPG logo — AI will embed your exact logo on the banner.',
    logoUploadBtn: 'Upload logo',
    logoRemoveBtn: 'Remove logo',
    productUploadLabel: 'Extra product photos (optional)',
    productUploadBtn: 'Upload product photos',
    finishFlow: 'Finish flow',
    savedCount: '{n} banner(s) saved',
  },
  zh: {
    title: '设计横幅',
    intro:
      '选择 1–4 个比例，上传 logo 合成到横幅（推荐），可按需添加产品图 — 然后点击「生成横幅」。',
    overlayLabel: '横幅文案与布局',
    overlayHint: '可选 — 留空则使用前面步骤已填的活动 brief。',
    overlayPlaceholder: '例如：5折 — 立即购买 · 产品在右，Logo 左上，紫色渐变背景',
    domainLabel: '域名或品牌名',
    domainHint: '显示在横幅上 — 可以是网站域名或品牌名称。',
    domainPlaceholder: '例如：188.com.vn 或 梵安时尚',
    logoLabel: '品牌 Logo（合成到横幅）',
    logoHint: '上传 PNG/JPG logo — AI 会将您的 logo 嵌入横幅。',
    logoUploadBtn: '上传 Logo',
    logoRemoveBtn: '删除 Logo',
    productUploadLabel: '额外产品图（可选）',
    productUploadBtn: '上传产品图',
    finishFlow: '完成流程',
    savedCount: '已保存 {n} 个横幅',
  },
  ja: {
    title: 'バナーデザイン',
    intro:
      '1〜4 比率を選び、ロゴをアップロードしてバナーに合成（推奨）、必要なら商品画像を追加 — 「バナー生成」を押してください。',
    overlayLabel: 'バナー文案・レイアウト',
    overlayHint: '任意 — 空欄の場合は前のステップのキャンペーン brief を使用します。',
    overlayPlaceholder:
      '例：50%OFF — 今すぐ購入 · 商品は右、ロゴ左上、紫グラデーション背景',
    domainLabel: 'ドメインまたはブランド名',
    domainHint: 'バナーに表示 — ウェブサイトのドメインまたはブランド名。',
    domainPlaceholder: '例：188.com.vn または Van Anh Fashion',
    logoLabel: 'ブランドロゴ（バナーに合成）',
    logoHint: 'PNG/JPG ロゴをアップロード — AI がそのロゴをバナーに埋め込みます。',
    logoUploadBtn: 'ロゴをアップロード',
    logoRemoveBtn: 'ロゴを削除',
    productUploadLabel: '追加の商品画像（任意）',
    productUploadBtn: '商品画像をアップロード',
    finishFlow: 'フローを完了',
    savedCount: 'バナー {n} 件保存済み',
  },
  ko: {
    title: '배너 디자인',
    intro:
      '1–4개 비율 선택, 로고 업로드해 배너에 합성(권장), 필요 시 제품 사진 추가 — «배너 생성»을 누르세요.',
    overlayLabel: '배너 문구·레이아웃',
    overlayHint: '선택 사항 — 비워 두면 이전 단계의 캠페인 brief를 사용합니다.',
    overlayPlaceholder:
      '예: 50% 할인 — 지금 구매 · 제품 오른쪽, 로고 좌상단, 보라색 gradient 배경',
    domainLabel: '도메인 또는 브랜드명',
    domainHint: '배너에 표시 — 웹사이트 도메인 또는 브랜드명.',
    domainPlaceholder: '예: 188.com.vn 또는 Van Anh Fashion',
    logoLabel: '브랜드 로고(배너에 합성)',
    logoHint: 'PNG/JPG 로고 업로드 — AI가 배너에 로고를 그대로 합성합니다.',
    logoUploadBtn: '로고 업로드',
    logoRemoveBtn: '로고 삭제',
    productUploadLabel: '추가 제품 사진(선택)',
    productUploadBtn: '제품 사진 업로드',
    finishFlow: '플로우 완료',
    savedCount: '배너 {n}개 저장됨',
  },
}

export function HubBannerDesignPreparePanel({
  locale,
  selectedPresetIds,
  domainName,
  overlayText,
  logoUrl,
  uploadImages,
  approvedBannerCount,
  busy,
  onTogglePreset,
  onMaxPresetsSelected,
  onDomainNameChange,
  onDomainNameCommit,
  onOverlayTextChange,
  onOverlayTextCommit,
  onUploadLogo,
  onRemoveLogo,
  onUploadProductFiles,
  onFinishFlow,
}: {
  locale: WebLocale
  selectedPresetIds: BannerAdPresetId[]
  domainName: string
  overlayText: string
  logoUrl?: string | null
  uploadImages: string[]
  approvedBannerCount: number
  busy: boolean
  onTogglePreset: (presetId: BannerAdPresetId) => void | Promise<void>
  onMaxPresetsSelected?: () => void
  onDomainNameChange: (text: string) => void
  onDomainNameCommit?: (text: string) => void | Promise<void>
  /** Local typing — no API call per keystroke. */
  onOverlayTextChange: (text: string) => void
  /** Persist to session on blur / before generate. */
  onOverlayTextCommit?: (text: string) => void | Promise<void>
  onUploadLogo: (files: FileList) => void | Promise<void>
  onRemoveLogo: () => void | Promise<void>
  onUploadProductFiles: (files: FileList) => void | Promise<void>
  onFinishFlow: () => void | Promise<void>
}) {
  const t = COPY[locale]
  const logoFileRef = useRef<HTMLInputElement>(null)
  const productFileRef = useRef<HTMLInputElement>(null)

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

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-amber-900 dark:text-amber-100">{t.domainLabel}</label>
        <p className="text-[11px] text-amber-800/70 dark:text-amber-200/70">{t.domainHint}</p>
        <Input
          value={domainName}
          onChange={(e) => onDomainNameChange(e.target.value)}
          onBlur={(e) => void onDomainNameCommit?.(e.target.value)}
          placeholder={t.domainPlaceholder}
          className="h-9 text-sm"
          disabled={busy}
        />
      </div>

      <HubBannerAdRatioPicker
        locale={locale}
        selectedPresetIds={selectedPresetIds}
        busy={busy}
        onTogglePreset={onTogglePreset}
        onMaxSelected={onMaxPresetsSelected}
        compact
      />

      <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/60 p-2.5 dark:border-violet-800 dark:bg-violet-950/20">
        <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">{t.logoLabel}</p>
        <p className="text-[11px] text-violet-800/80 dark:text-violet-200/80">{t.logoHint}</p>
        {logoUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload preview */}
            <img
              src={logoUrl}
              alt=""
              className="h-16 w-16 rounded-md border border-violet-200 bg-white object-contain p-1 dark:border-violet-700"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={busy}
              onClick={() => void onRemoveLogo()}
            >
              <X className="h-3.5 w-3.5" />
              {t.logoRemoveBtn}
            </Button>
          </div>
        ) : null}
        <input
          ref={logoFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onUploadLogo(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-violet-300 text-xs"
          disabled={busy}
          onClick={() => logoFileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {t.logoUploadBtn}
        </Button>
      </div>

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
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">{t.productUploadLabel}</p>
        {uploadImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uploadImages.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- user upload preview
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
          ref={productFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onUploadProductFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-amber-300 text-xs"
          disabled={busy}
          onClick={() => productFileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {t.productUploadBtn}
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
