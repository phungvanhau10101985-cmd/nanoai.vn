'use client'

import { useRef } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { LandingDesignStepKey } from '@/lib/hub-chat/hub-studio-preset-flows'
import { getStepAskPrompt } from '@/lib/hub-chat/hub-studio-presets'
import { HubLandingLogoControls } from '@/components/hub-chat/hub-landing-logo-controls'

const FULL_PAGE_PLACEHOLDER: Record<WebLocale, string> = {
  vi: 'Hero: «Mua sắm & trải nghiệm dịch vụ» · 3 cột ưu điểm · Gói giá (Pro nổi bật) · 2 review khách · FAQ 4 câu · CTA cuối «Mua ngay» — toàn bộ trong một ảnh dọc 1:4, logo ở header',
  en: 'Hero: «Shop products & book services» · 3-column benefits · Pricing tiers (Pro highlighted) · 2 customer reviews · 4 FAQ items · Bottom CTA «Shop now» — all in one tall 1:4 image, logo in header',
  zh: '主视觉：「选购产品 & 预约服务」· 三列优势 · 价格档（Pro 高亮）· 2 条评价 · 4 个 FAQ · 底部 CTA「立即购买」— 全部在一张 1:4 纵向图中，页眉含 logo',
  ja: 'ヒーロー：「商品購入＆サービス予約」· 3カラムメリット · 料金プラン（Pro強調）· レビュー2件 · FAQ4項目 · 下部CTA「今すぐ購入」— 1:4縦1枚、ヘッダーにロゴ',
  ko: '히어로: «상품 구매 & 서비스 예약» · 3열 혜택 · 요금제(Pro 강조) · 후기 2개 · FAQ 4항 · 하단 CTA «지금 구매» — 1:4 세로 1장, 헤더에 로고',
}

const COPY: Record<
  WebLocale,
  {
    intro: string
    sectionLabel: string
    sectionHint: string
    productUploadLabel: string
    productUploadBtn: string
    savedCount: string
    stepTitle: string
  }
> = {
  vi: {
    intro:
      'Tạo **một ảnh landing dọc đầy đủ** (tỷ lệ 1:4). Tải hoặc **Tạo logo AI** trước — AI ghép logo vào header. Mô tả nội dung các section (Hero → CTA) trong một ảnh.',
    sectionLabel: 'Mô tả landing đầy đủ (→ 1 ảnh dọc)',
    sectionHint: 'AI vẽ **một ảnh** chứa toàn bộ landing — headline, sản phẩm/dịch vụ, giá, FAQ, CTA…',
    productUploadLabel: 'Ảnh sản phẩm / tham khảo (tùy chọn)',
    productUploadBtn: 'Tải ảnh tham khảo',
    savedCount: 'Đã có ảnh landing đầy đủ',
    stepTitle: 'Landing đầy đủ (1 ảnh dọc 1:4)',
  },
  en: {
    intro:
      'Generate **one full vertical landing image** (1:4 ratio). Upload or **Generate AI logo** first — AI composites it in the header. Describe all sections (Hero → CTA) in a single image.',
    sectionLabel: 'Full landing description (→ 1 tall image)',
    sectionHint: 'AI draws **one image** with the entire landing — headline, products/services, pricing, FAQ, CTA…',
    productUploadLabel: 'Product / reference photos (optional)',
    productUploadBtn: 'Upload reference photos',
    savedCount: 'Full landing image ready',
    stepTitle: 'Full landing (1 vertical image 1:4)',
  },
  zh: {
    intro:
      '生成**一张完整纵向落地页**（1:4 比例）。先上传或**AI 生成 logo** — AI 合成到页眉。在一张图中描述全部区块（主视觉 → CTA）。',
    sectionLabel: '完整落地页描述（→ 1 张纵向图）',
    sectionHint: 'AI 绘制**一张图**包含完整落地页 — 标题、产品/服务、价格、FAQ、CTA…',
    productUploadLabel: '产品 / 参考图（可选）',
    productUploadBtn: '上传参考图',
    savedCount: '完整落地页图片已就绪',
    stepTitle: '完整落地页（1 张纵向图 1:4）',
  },
  ja: {
    intro:
      '**縦長1枚のフルランディング**（1:4）を生成。先にロゴをアップロードまたは**AIロゴ生成** — ヘッダーに合成。1枚に全セクション（ヒーロー→CTA）を記述。',
    sectionLabel: 'フルLP説明（→ 縦1枚）',
    sectionHint: 'AIが**1枚**でランディング全体 — 見出し、商品/サービス、料金、FAQ、CTA…',
    productUploadLabel: '商品 / 参考画像（任意）',
    productUploadBtn: '参考画像をアップロード',
    savedCount: 'フルランディング画像完成',
    stepTitle: 'フルランディング（縦1枚 1:4）',
  },
  ko: {
    intro:
      '**세로 전체 랜딩 이미지 1장**(1:4) 생성. 먼저 로고 업로드 또는 **AI 로고 생성** — 헤더에 합성. 한 장에 모든 섹션(히어로→CTA) 설명.',
    sectionLabel: '전체 랜딩 설명(→ 세로 1장)',
    sectionHint: 'AI가 **한 장**에 전체 랜딩 — 헤드라인, 상품/서비스, 가격, FAQ, CTA…',
    productUploadLabel: '상품 / 참고 이미지(선택)',
    productUploadBtn: '참고 이미지 업로드',
    savedCount: '전체 랜딩 이미지 완료',
    stepTitle: '전체 랜딩(세로 1장 1:4)',
  },
}

export function HubLandingDesignPreparePanel({
  locale,
  stepKey,
  sectionCopy,
  logoUrl,
  logoBrief = '',
  uploadImages,
  approvedSectionCount,
  busy,
  onSectionCopyChange,
  onLogoBriefChange,
  onUploadLogo,
  onRemoveLogo,
  onGenerateLogo,
  onUploadProductFiles,
}: {
  locale: WebLocale
  stepKey: LandingDesignStepKey
  sectionCopy: string
  logoUrl?: string | null
  logoBrief?: string
  uploadImages: string[]
  approvedSectionCount: number
  busy?: boolean
  onSectionCopyChange: (value: string) => void
  onLogoBriefChange: (value: string) => void
  onUploadLogo?: (files: FileList) => void | Promise<void>
  onRemoveLogo?: () => void | Promise<void>
  onGenerateLogo?: (brief: string) => void | Promise<void>
  onUploadProductFiles: (files: FileList) => void | Promise<void>
}) {
  const t = COPY[locale]
  const productFileRef = useRef<HTMLInputElement>(null)
  const askHint = getStepAskPrompt(locale, 'landing_page', stepKey)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t.stepTitle}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t.intro}</p>
        {askHint ? <p className="mt-1 text-xs text-muted-foreground/90">{askHint}</p> : null}
      </div>

      <HubLandingLogoControls
        locale={locale}
        logoUrl={logoUrl}
        logoBrief={logoBrief}
        busy={busy ?? false}
        onLogoBriefChange={onLogoBriefChange}
        onUploadLogo={onUploadLogo}
        onRemoveLogo={onRemoveLogo}
        onGenerateLogo={onGenerateLogo}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">{t.sectionLabel}</label>
        <p className="text-xs text-muted-foreground">{t.sectionHint}</p>
        <Textarea
          value={sectionCopy}
          onChange={(e) => onSectionCopyChange(e.target.value)}
          placeholder={FULL_PAGE_PLACEHOLDER[locale]}
          rows={5}
          disabled={busy}
          className="min-h-[120px] resize-y text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">{t.productUploadLabel}</p>
        </div>
        <input
          ref={productFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files
            if (files?.length) void onUploadProductFiles(files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => productFileRef.current?.click()}
        >
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1 h-3.5 w-3.5" />}
          {t.productUploadBtn}
        </Button>
        {uploadImages.length ? (
          <div className="flex flex-wrap gap-2">
            {uploadImages.map((url) => (
              <div key={url} className="relative h-14 w-14 overflow-hidden rounded border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {approvedSectionCount > 0 ? (
        <p className="text-xs text-muted-foreground">{t.savedCount}</p>
      ) : null}
    </div>
  )
}
