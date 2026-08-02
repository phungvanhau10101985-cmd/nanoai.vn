import Link from 'next/link'
import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  listShopTemplatePresets,
  shopTemplatePresetDescription,
  shopTemplatePresetLabel,
} from '@/lib/partner-website/template/shop-template-presets'
import { shopTemplateSamplePreviewPath } from '@/lib/partner-website/template/build-shop-template-sample-html'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerDictionary()
  const t = getPartnerWebsiteCopy(locale)
  const keywordsByLocale: Record<string, string[]> = {
    vi: ['kho giao diện', 'web mẫu shop', 'mẫu website thời trang'],
    en: ['shop template gallery', 'fashion website sample'],
    zh: ['店铺模板库', '时尚网站样例'],
    ja: ['ショップテンプレート', 'ファッションサイト見本'],
    ko: ['샵 템플릿 갤러리', '패션 웹 샘플'],
  }
  return buildMetadata({
    title: t.templateGalleryTitle,
    description: t.templateGalleryHint,
    path: '/mau-giao-dien',
    keywords: keywordsByLocale[locale] ?? keywordsByLocale.vi,
  })
}

export default async function ShopTemplateGalleryPage() {
  const { locale } = await getServerDictionary()
  const t = getPartnerWebsiteCopy(locale)
  const presets = listShopTemplatePresets()

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-600">
            {t.templateGalleryEyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t.templateGalleryTitle}
          </h1>
          <p className="mt-3 text-base text-slate-600">{t.templateGalleryHint}</p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {presets.map((preset) => {
            const previewHref = shopTemplateSamplePreviewPath(preset.id, locale)
            return (
              <article
                key={preset.id}
                className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-orange-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preset.coverImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent"
                    aria-hidden
                  />
                  {preset.readyToUse ? (
                    <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      {t.templateGalleryReadyBadge}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {shopTemplatePresetLabel(preset, locale)}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {shopTemplatePresetDescription(preset, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                    >
                      {t.templateGalleryViewSample}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/dashboard/messaging"
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      {t.templateGalleryUseTemplate}
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
