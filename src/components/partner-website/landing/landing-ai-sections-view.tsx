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
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryPath,
  partnerSiteHomePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { normalizeWebLocale } from '@/lib/i18n/config'

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
  const locale = normalizeWebLocale(context.locale) ?? 'vi'
  const shop = getPartnerSiteShopCopy(locale)
  const byType = new Map(sections.map((s) => [s.sectionType, s]))
  const hero = sectionData<LandingHeroData>(byType.get('hero'))
  const highlights = sectionData<LandingHighlightsData>(byType.get('highlights'))
  const material = sectionData<LandingMaterialData>(byType.get('material'))
  const trustCta = sectionData<LandingTrustCtaData>(byType.get('trust_cta'))
  const faq = sectionData<LandingFaqData>(byType.get('faq'))
  const hasMaterial = Boolean(material.body || material.imageUrl)
  const isSingle = context.sourceType === 'products' && context.products.length === 1
  const heroCta = isSingle
    ? shop.buyNow
    : trustCta.ctaLabel || shop.lpExploreProducts
  const heroHref = isSingle ? context.products[0]?.detailPath || '#lp-products' : '#lp-products'
  const categoryHref = context.categoryPath
    ? partnerSiteCategoryPath(context.siteSlug, context.categoryPath)
    : null

  return (
    <div className="pw-lp min-h-screen bg-[var(--pw-bg,#fff)] text-[var(--pw-text,#0f172a)]">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-6 py-4 text-sm text-[var(--pw-muted,#64748b)]">
        <Link href={partnerSiteHomePath(context.siteSlug)} className="hover:text-[var(--pw-primary)]">
          {shop.navHome}
        </Link>
        {categoryHref && context.categoryName ? (
          <>
            <span>/</span>
            <Link href={categoryHref} className="hover:text-[var(--pw-primary)]">
              {context.categoryName}
            </Link>
          </>
        ) : null}
        <span>/</span>
        <span className="text-[var(--pw-text)]">{context.title}</span>
        {context.materialFilter ? (
          <span className="ml-2 rounded-full bg-[var(--pw-surface,#f1f5f9)] px-2 py-0.5 text-xs font-medium">
            {shop.lpMaterialChip.replace('{name}', context.materialFilter)}
          </span>
        ) : null}
        {categoryHref ? (
          <Link href={categoryHref} className="ml-auto text-xs font-semibold text-[var(--pw-primary)]">
            {shop.lpViewFullCategory}
          </Link>
        ) : null}
      </nav>

      <section data-lp-section="hero" className="relative overflow-hidden bg-[var(--pw-surface,#f8fafc)]">
        <div className="mx-auto flex max-w-5xl flex-col-reverse items-center gap-8 px-6 py-14 sm:flex-row sm:py-20">
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pw-primary)]">
              {shop.lpSuggestedForYou}
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{hero.headline || context.title}</h1>
            {hero.subheadline ? (
              <p className="text-lg text-[var(--pw-muted,#64748b)]">{hero.subheadline}</p>
            ) : null}
            <div className="pt-2">
              <a
                href={heroHref}
                className="inline-flex items-center justify-center rounded-full bg-[var(--pw-buy,var(--pw-primary,#0f172a))] px-8 py-3 text-sm font-semibold text-white shadow transition hover:opacity-90"
              >
                {heroCta}
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

      <section className="border-b border-[var(--pw-border,#e2e8f0)] bg-white">
        <div className="mx-auto grid max-w-5xl gap-4 px-6 py-5 sm:grid-cols-3">
          {[shop.lpTrust1, shop.lpTrust2, shop.lpTrust3].map((label) => (
            <p key={label} className="text-center text-sm font-medium text-[var(--pw-text)]">
              {label}
            </p>
          ))}
        </div>
      </section>

      {highlights.items?.length ? (
        <section data-lp-section="highlights" className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="mb-6 text-center text-2xl font-bold">{shop.lpHighlightsHeading}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--pw-border,#e2e8f0)] bg-white p-5 shadow-sm"
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--pw-muted,#64748b)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasMaterial ? (
        <section data-lp-section="material" className="bg-[var(--pw-surface,#f8fafc)]">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-14 sm:flex-row">
            {material.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={material.imageUrl}
                alt={material.material || ''}
                className="w-full max-w-md flex-1 rounded-2xl object-cover shadow"
              />
            ) : null}
            <div className="flex-1 space-y-3">
              {material.material ? (
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--pw-primary)]">
                  {material.material}
                </p>
              ) : null}
              {material.body ? <p className="leading-relaxed">{material.body}</p> : null}
              {material.callouts?.length ? (
                <ul className="grid gap-2 pt-2">
                  {material.callouts.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm font-medium">
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pw-primary)]" />
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {!isSingle ? (
        <section id="lp-products" data-lp-section="products_grid" className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold">{context.categoryName || context.title}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {context.products.map((p) => (
              <Link
                key={p.id}
                href={p.detailPath}
                data-nanoai-inventory={p.id}
                className="group overflow-hidden rounded-xl border border-[var(--pw-border,#e2e8f0)] bg-white shadow-sm transition hover:shadow-md"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" />
                ) : null}
                <div className="space-y-1 p-4">
                  <p className="line-clamp-2 font-medium">{p.name}</p>
                  <p className="font-semibold text-[var(--pw-primary)]">
                    {p.priceAmount ? formatVnd(p.priceAmount) : p.priceHint || ''}
                  </p>
                  <span className="inline-flex items-center pt-1 text-sm font-semibold text-[var(--pw-primary)]">
                    {shop.addToCart}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {trustCta.body ? (
        <section data-lp-section="trust_cta" className="bg-[var(--pw-primary,#0f172a)] text-white">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            {context.averageRating != null && context.totalReviews > 0 ? (
              <p className="mb-3 text-sm font-semibold text-amber-200">
                {'★'.repeat(Math.round(context.averageRating))}
                {'☆'.repeat(5 - Math.round(context.averageRating))}{' '}
                {shop.lpRealReviews
                  .replace('{rating}', String(context.averageRating))
                  .replace('{count}', String(context.totalReviews))}
              </p>
            ) : null}
            <p className="leading-relaxed text-white/90">{trustCta.body}</p>
            <a
              href={heroHref}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-[var(--pw-primary,#0f172a)] shadow"
            >
              {trustCta.ctaLabel || heroCta}
            </a>
          </div>
        </section>
      ) : null}

      {faq.items?.length ? (
        <section data-lp-section="faq" className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="mb-6 text-center text-2xl font-bold">{shop.lpFaqHeading}</h2>
          <div className="space-y-4">
            {faq.items.map((item, i) => (
              <details key={i} className="rounded-lg border border-[var(--pw-border,#e2e8f0)] p-4" open={i === 0}>
                <summary className="cursor-pointer font-medium">{item.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-[var(--pw-muted,#64748b)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 z-20 border-t border-[var(--pw-border,#e2e8f0)] bg-white/95 p-3 backdrop-blur sm:hidden">
        <a
          href={heroHref}
          className="flex w-full items-center justify-center rounded-full bg-[var(--pw-buy,var(--pw-primary,#0f172a))] py-3 text-sm font-semibold text-white"
        >
          {isSingle ? shop.buyNow : shop.lpViewProducts}
        </a>
      </div>
    </div>
  )
}
