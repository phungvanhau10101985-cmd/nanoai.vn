'use client'

import type { ReactNode } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { LandingPageSection } from '@/lib/hub-chat/landing-page-sections'
import { HubLandingLogoControls } from '@/components/hub-chat/hub-landing-logo-controls'

const COPY: Record<
  WebLocale,
  {
    previewTitle: string
    fullPageReady: string
    fullPageNote: string
    publishedLink: string
    empty: string
  }
> = {
  vi: {
    previewTitle: 'Xem trước landing (một ảnh dọc đầy đủ)',
    fullPageReady: 'Đã có ảnh landing đầy đủ (1:4)',
    fullPageNote:
      'Một ảnh mockup dọc tỷ lệ 1:4 — Hero, sản phẩm/dịch vụ, giá, đánh giá, FAQ, CTA; logo đã ghép trong ảnh. Không phải website thật.',
    publishedLink: 'Link xem trước:',
    empty: 'Chưa có ảnh landing. Tải/tạo logo rồi bấm tạo ảnh landing đầy đủ.',
  },
  en: {
    previewTitle: 'Landing preview (single full-page image)',
    fullPageReady: 'Full landing image ready (1:4)',
    fullPageNote:
      'One tall 1:4 mockup — hero, products/services, pricing, reviews, FAQ, CTA; logo composited in the image. Not a live website.',
    publishedLink: 'Preview link:',
    empty: 'No landing image yet. Upload/generate logo, then create the full landing image.',
  },
  zh: {
    previewTitle: '落地页预览（单张完整纵向图）',
    fullPageReady: '完整落地页图片已就绪（1:4）',
    fullPageNote:
      '单张 1:4 纵向 mockup — 主视觉、产品/服务、价格、评价、FAQ、CTA；logo 已合成在图中。非真实网站。',
    publishedLink: '预览链接：',
    empty: '尚无落地页图片。上传/生成 logo 后创建完整落地页图。',
  },
  ja: {
    previewTitle: 'ランディングプレビュー（1枚の縦長フルページ）',
    fullPageReady: 'フルランディング画像完成（1:4）',
    fullPageNote:
      '1:4の縦長1枚 — ヒーロー、商品/サービス、料金、レビュー、FAQ、CTA；ロゴは画像内に合成済み。本物のサイトではありません。',
    publishedLink: 'プレビューリンク：',
    empty: 'ランディング画像がありません。ロゴをアップロード/生成してからフルLPを作成してください。',
  },
  ko: {
    previewTitle: '랜딩 미리보기(세로 전체 페이지 1장)',
    fullPageReady: '전체 랜딩 이미지 완료(1:4)',
    fullPageNote:
      '1:4 세로 mockup 1장 — 히어로, 상품/서비스, 가격, 후기, FAQ, CTA; 로고는 이미지에 합성됨. 실제 웹사이트가 아닙니다.',
    publishedLink: '미리보기 링크:',
    empty: '랜딩 이미지가 없습니다. 로고 업로드/생성 후 전체 랜딩 이미지를 만드세요.',
  },
}

export function HubLandingComposedPreview({
  locale,
  title,
  logoUrl,
  logoBrief = '',
  sections,
  shareMenu,
  publishedShareUrl,
  busy,
  onLogoBriefChange,
  onUploadLogo,
  onRemoveLogo,
  onGenerateLogo,
}: {
  locale: WebLocale
  title: string
  logoUrl?: string | null
  logoBrief?: string
  sections: LandingPageSection[]
  shareMenu?: ReactNode
  publishedShareUrl?: string | null
  busy?: boolean
  onLogoBriefChange?: (value: string) => void
  onUploadLogo?: (files: FileList) => void | Promise<void>
  onRemoveLogo?: () => void | Promise<void>
  onGenerateLogo?: (brief: string) => void | Promise<void>
}) {
  const t = COPY[locale]
  const section = sections[0]
  const editableLogo = Boolean(onUploadLogo || onGenerateLogo)

  if (!section?.url && !logoUrl?.trim()) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t.previewTitle}</h3>
          <p className="text-xs text-muted-foreground">{title}</p>
          {section?.url ? (
            <p className="text-xs text-muted-foreground">{t.fullPageReady}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t.empty}</p>
          )}
          {publishedShareUrl ? (
            <p className="mt-1 text-[11px] text-indigo-700 dark:text-indigo-300">
              {t.publishedLink}{' '}
              <a
                href={publishedShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all underline"
              >
                {publishedShareUrl}
              </a>
            </p>
          ) : null}
        </div>
        {shareMenu ? <div className="shrink-0">{shareMenu}</div> : null}
      </div>

      <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90">{t.fullPageNote}</p>

      {editableLogo && onLogoBriefChange && !section?.url ? (
        <HubLandingLogoControls
          locale={locale}
          logoUrl={logoUrl}
          logoBrief={logoBrief}
          busy={Boolean(busy)}
          onLogoBriefChange={onLogoBriefChange}
          onUploadLogo={onUploadLogo}
          onRemoveLogo={onRemoveLogo}
          onGenerateLogo={onGenerateLogo}
        />
      ) : null}

      {section?.url ? (
        <div className="flex max-h-[min(72vh,720px)] flex-col overflow-y-auto rounded-lg border border-slate-200/60 bg-slate-900/95 p-3 dark:border-slate-700">
          <div className="flex justify-center py-2">
            <div
              className="w-full max-w-[320px] overflow-hidden rounded-[22px] border-[3px] border-slate-600 bg-slate-800 shadow-lg"
              aria-label={section.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={section.url}
                alt={section.label}
                className="block h-auto w-full"
                draggable={false}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
