'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteInfoPath,
  partnerSiteProductPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteViewItemList,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { cn } from '@/lib/utils'

export type FashionHomeCategory = {
  name: string
  imageUrl: string
  href?: string
}

export type FashionHomeCopy = {
  heroTitle: string
  heroSubtitle: string
  heroCta: string
  heroImage: string
  categoriesTitle: string
  categories: FashionHomeCategory[]
  newArrivalsTitle: string
  bestSellersTitle: string
}

type Props = {
  siteSlug: string
  partnerSlug: string
  title: string
  logoUrl: string | null
  theme: PartnerWebsiteTheme
  locale: WebLocale
  chatPath: string
  tracking: PartnerSiteShopTrackingConfig
  copy: FashionHomeCopy
  newArrivals: PartnerSiteShopProduct[]
  bestSellers: PartnerSiteShopProduct[]
  fontClassName?: string
  showProductSections?: boolean
  showCategories?: boolean
  heroCtaHref?: string
  industryBadge?: string
  secondaryCtaLabel?: string
}

function ProductCard({
  siteSlug,
  product,
  showNew,
  cta,
  customDomain,
}: {
  siteSlug: string
  product: PartnerSiteShopProduct
  showNew?: boolean
  cta: string
  customDomain: boolean
}) {
  const href = partnerSiteProductPath(siteSlug, product.id, { customDomain, name: product.name })
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-[0_10px_40px_-20px_rgba(234,88,12,.45)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(234,88,12,.55)]">
      <Link href={href} className="relative aspect-[4/5] overflow-hidden bg-orange-50">
        {showNew ? (
          <span className="absolute left-3 top-3 z-10 rounded-md bg-stone-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            NEW
          </span>
        ) : null}
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-orange-200 to-amber-100" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-stone-800">
          <Link href={href}>{product.name}</Link>
        </h3>
        {product.priceHint ? (
          <p className="text-base font-extrabold tracking-tight text-orange-600">{product.priceHint}</p>
        ) : null}
        <Link
          href={href}
          className="mt-auto inline-flex w-full items-center justify-center gap-1 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-orange-600"
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}

function FashionHomeInner({
  siteSlug,
  locale,
  copy,
  newArrivals,
  bestSellers,
  showProductSections = true,
  showCategories = true,
  heroCtaHref,
  industryBadge,
  secondaryCtaLabel,
}: Pick<
  Props,
  | 'siteSlug'
  | 'locale'
  | 'copy'
  | 'newArrivals'
  | 'bestSellers'
  | 'showProductSections'
  | 'showCategories'
  | 'heroCtaHref'
  | 'industryBadge'
  | 'secondaryCtaLabel'
>) {
  const t = getPartnerSiteShopCopy(locale)
  const { tracking } = usePartnerSiteShop()
  const customDomain = usePartnerSiteCustomDomain()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    trackPartnerSiteViewItemList(
      tracking,
      [...newArrivals, ...bestSellers].map((p) => shopProductToTrackingProduct(p))
    )
  }, [bestSellers, newArrivals, tracking])

  const productsHref = heroCtaHref || partnerSiteProductsPath(siteSlug, { customDomain })
  const secondaryHref = heroCtaHref ? heroCtaHref : partnerSiteInfoPath(siteSlug, 'sale', { customDomain })
  const badge =
    industryBadge || (locale === 'vi' ? 'Bộ sưu tập mới' : 'New season')
  const secondaryLabel =
    secondaryCtaLabel || (locale === 'vi' ? 'Khuyến mãi' : 'Sale')

  return (
    <div className={cn('space-y-0', mounted && 'pw-fashion-ready')}>
      <section className="relative mb-8 overflow-hidden rounded-[1.75rem] sm:mb-12 sm:rounded-[2rem]">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={copy.heroImage}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-950/75 via-orange-700/45 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,.35),transparent_55%)]" />
        </div>
        <div className="relative grid min-h-[340px] content-center gap-5 px-6 py-14 sm:min-h-[420px] sm:px-12 lg:min-h-[480px]">
          <p className="pw-anim-in inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-50 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {badge}
          </p>
          <h1
            className="pw-anim-in pw-anim-in-d1 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--pw-font-display)' }}
          >
            {copy.heroTitle}
          </h1>
          <p className="pw-anim-in pw-anim-in-d2 max-w-md text-base text-orange-50/95 sm:text-lg">
            {copy.heroSubtitle}
          </p>
          <div className="pw-anim-in pw-anim-in-d3 flex flex-wrap gap-3">
            <Link
              href={productsHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-orange-600 shadow-lg shadow-orange-950/20 transition hover:scale-[1.02] hover:bg-orange-50"
            >
              {copy.heroCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex items-center rounded-2xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              {secondaryLabel}
            </Link>
          </div>
          <div className="pw-anim-in pw-anim-in-d4 mt-2 flex gap-2" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-white" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
          </div>
        </div>
      </section>

      {showCategories ? (
      <section className="mb-12 sm:mb-16">
        <h2
          className="mb-6 text-center text-sm font-extrabold uppercase tracking-[0.2em] text-orange-600 sm:text-base"
          style={{ fontFamily: 'var(--pw-font-display)' }}
        >
          {copy.categoriesTitle}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {copy.categories.map((cat, i) => (
            <Link
              key={cat.name}
              href={cat.href || productsHref}
              className={cn(
                'group flex flex-col items-center gap-3 text-center',
                'pw-anim-in',
                i === 1 && 'pw-anim-in-d1',
                i === 2 && 'pw-anim-in-d2',
                i === 3 && 'pw-anim-in-d3'
              )}
            >
              <span className="relative block aspect-square w-full max-w-[140px] overflow-hidden rounded-full border-[3px] border-orange-400 bg-orange-50 shadow-md transition duration-500 group-hover:scale-105 group-hover:border-orange-500 sm:max-w-none">
                {cat.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : null}
              </span>
              <span className="text-sm font-bold text-stone-700">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>
      ) : null}

      {showProductSections ? (
      <>
      <section className="mb-12 sm:mb-16">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h2
            className="text-sm font-extrabold uppercase tracking-[0.2em] text-orange-600 sm:text-base"
            style={{ fontFamily: 'var(--pw-font-display)' }}
          >
            {copy.newArrivalsTitle}
          </h2>
          <Link
            href={productsHref}
            className="text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-orange-600"
          >
            {t.navProducts} →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {newArrivals.slice(0, 8).map((p) => (
            <ProductCard key={p.id} siteSlug={siteSlug} product={p} showNew cta={t.addToCart} customDomain={customDomain} />
          ))}
        </div>
        {!newArrivals.length ? (
          <p className="mt-4 text-center text-sm text-stone-500">{t.catalogEmpty}</p>
        ) : null}
      </section>

      <section className="relative mb-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 px-4 py-10 sm:mb-8 sm:rounded-[2rem] sm:px-8 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-amber-200/30 blur-2xl" />
        <h2
          className="relative mb-8 text-center text-sm font-extrabold uppercase tracking-[0.22em] text-white sm:text-base"
          style={{ fontFamily: 'var(--pw-font-display)' }}
        >
          {copy.bestSellersTitle}
        </h2>
        <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {(bestSellers.length ? bestSellers : newArrivals).slice(0, 8).map((p) => (
            <ProductCard key={`best-${p.id}`} siteSlug={siteSlug} product={p} cta={t.addToCart} customDomain={customDomain} />
          ))}
        </div>
      </section>
      </>
      ) : null}
    </div>
  )
}

export function PartnerSiteFashionHome(props: Props) {
  return (
    <div
      className={props.fontClassName}
      style={{ fontFamily: 'var(--pw-font-ui), Outfit, system-ui, sans-serif' }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes pwFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}.pw-fashion-ready .pw-anim-in{animation:pwFadeUp .7s cubic-bezier(.22,1,.36,1) both}.pw-fashion-ready .pw-anim-in-d1{animation-delay:.08s}.pw-fashion-ready .pw-anim-in-d2{animation-delay:.16s}.pw-fashion-ready .pw-anim-in-d3{animation-delay:.24s}.pw-fashion-ready .pw-anim-in-d4{animation-delay:.32s}@media (prefers-reduced-motion:reduce){.pw-fashion-ready .pw-anim-in{animation:none}}`,
        }}
      />
      <PartnerSiteShopShell
        siteSlug={props.siteSlug}
        partnerSlug={props.partnerSlug}
        title={props.title}
        logoUrl={props.logoUrl}
        theme={props.theme}
        locale={props.locale}
        chatPath={props.chatPath}
        tracking={props.tracking}
        activeNav="home"
      >
        <FashionHomeInner
          siteSlug={props.siteSlug}
          locale={props.locale}
          copy={props.copy}
          newArrivals={props.newArrivals}
          bestSellers={props.bestSellers}
          showProductSections={props.showProductSections}
          showCategories={props.showCategories}
          heroCtaHref={props.heroCtaHref}
          industryBadge={props.industryBadge}
          secondaryCtaLabel={props.secondaryCtaLabel}
        />
      </PartnerSiteShopShell>
    </div>
  )
}
