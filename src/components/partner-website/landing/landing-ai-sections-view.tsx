import Link from 'next/link'
import type {
  LandingAiContext,
  LandingAiSectionRow,
  LandingFaqData,
  LandingHeroData,
  LandingHighlightsData,
  LandingMaterialData,
  LandingTrustCtaData,
} from '@/lib/partner-website/landing/landing-ai-types'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'

/**
 * L3.8 — Render public Ladipage AI (section cố định). Server component thật (không qua iframe/HTML
 * tự do) — SEO tốt hơn, và nút mua đi thẳng PDP thật (tái dùng luồng cart/variant W1.1/W1.2, không
 * viết lại luồng mua riêng cho LP).
 */

function sectionData<T>(section: LandingAiSectionRow | undefined): T {
  return (section?.data ?? {}) as T
}

export function LandingAiSectionsView({
  sections,
  context,
}: {
  sections: LandingAiSectionRow[]
  context: LandingAiContext
}) {
  const byType = new Map(sections.map((s) => [s.sectionType, s]))
  const hero = sectionData<LandingHeroData>(byType.get('hero'))
  const highlights = sectionData<LandingHighlightsData>(byType.get('highlights'))
  const material = sectionData<LandingMaterialData>(byType.get('material'))
  const trustCta = sectionData<LandingTrustCtaData>(byType.get('trust_cta'))
  const faq = sectionData<LandingFaqData>(byType.get('faq'))
  const hasMaterial = Boolean(material.body || material.imageUrl)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HERO */}
      <section data-lp-section="hero" className="relative overflow-hidden bg-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col-reverse items-center gap-8 px-6 py-14 sm:flex-row sm:py-20">
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{hero.headline || context.title}</h1>
            {hero.subheadline ? <p className="text-lg text-slate-600">{hero.subheadline}</p> : null}
            <div className="pt-2">
              <a
                href="#lp-products"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-700"
              >
                {trustCta.ctaLabel || 'Mua ngay'}
              </a>
            </div>
          </div>
          {hero.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.imageUrl}
              alt={hero.headline || context.title}
              className="w-full max-w-sm flex-1 rounded-2xl object-cover shadow-lg sm:aspect-square"
            />
          ) : null}
        </div>
      </section>

      {/* HIGHLIGHTS */}
      {highlights.items?.length ? (
        <section data-lp-section="highlights" className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* MATERIAL */}
      {hasMaterial ? (
        <section data-lp-section="material" className="bg-slate-50">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-14 sm:flex-row">
            {material.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={material.imageUrl}
                alt={material.material || 'Chất liệu'}
                className="w-full max-w-md flex-1 rounded-2xl object-cover shadow"
              />
            ) : null}
            <div className="flex-1 space-y-3">
              {material.material ? (
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{material.material}</p>
              ) : null}
              {material.body ? <p className="leading-relaxed text-slate-700">{material.body}</p> : null}
              {material.callouts?.length ? (
                <ul className="grid gap-2 pt-2 sm:grid-cols-1">
                  {material.callouts.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* PRODUCTS GRID — luôn render live (giá/tồn thật), Mua ngay dẫn thẳng PDP thật */}
      <section id="lp-products" data-lp-section="products_grid" className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="mb-6 text-center text-2xl font-bold">{context.categoryName || context.title}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {context.products.map((p) => (
            <Link
              key={p.id}
              href={p.detailPath}
              data-nanoai-inventory={p.id}
              className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" />
              ) : null}
              <div className="space-y-1 p-4">
                <p className="line-clamp-2 font-medium text-slate-900">{p.name}</p>
                <p className="font-semibold text-slate-900">
                  {p.priceAmount ? formatVnd(p.priceAmount) : p.priceHint || ''}
                </p>
                <span className="inline-flex items-center pt-1 text-sm font-semibold text-slate-900 underline-offset-2 group-hover:underline">
                  Xem &amp; mua ngay →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* TRUST / CTA — rating thật từ review (W1.5), không phải AI bịa số liệu */}
      {trustCta.body ? (
        <section data-lp-section="trust_cta" className="bg-slate-900 text-white">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            {context.averageRating != null && context.totalReviews > 0 ? (
              <p className="mb-3 text-sm font-semibold text-amber-300">
                {'★'.repeat(Math.round(context.averageRating))}
                {'☆'.repeat(5 - Math.round(context.averageRating))} {context.averageRating}/5 ·{' '}
                {context.totalReviews} đánh giá thật
              </p>
            ) : null}
            <p className="leading-relaxed text-slate-200">{trustCta.body}</p>
            <a
              href="#lp-products"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow transition hover:bg-slate-100"
            >
              {trustCta.ctaLabel || 'Mua ngay'}
            </a>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {faq.items?.length ? (
        <section data-lp-section="faq" className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold">Câu hỏi thường gặp</h2>
          <div className="space-y-4">
            {faq.items.map((item, i) => (
              <details key={i} className="rounded-lg border border-slate-100 p-4">
                <summary className="cursor-pointer font-medium text-slate-900">{item.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
