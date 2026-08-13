import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePage } from '@/lib/partner-website/template/partner-website-template-types'
import type { FashionHomeCopy } from '@/components/partner-website/shop/partner-site-fashion-home'
import { getShopTemplateSampleProducts } from '@/lib/partner-website/template/shop-template-sample-products'
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

export function buildFashionHomeCopy(input: {
  pages: PartnerWebsitePage[]
  locale: WebLocale
  siteSlug: string
  brandTitle: string
}): FashionHomeCopy {
  const home =
    input.pages.find((p) => p.slug === '/' || p.slug === 'index') ?? input.pages[0]
  const sections = home?.sections ?? []
  const hero = sections.find((s) => s.type === 'hero-v1')
  const cats = sections.find((s) => s.type === 'categories-v1')
  const productSections = sections.filter((s) => s.type === 'products-v1')
  const newSec = productSections.find((s) => s.props?.variant === 'new-arrivals') || productSections[0]
  const bestSec = productSections.find((s) => s.props?.variant === 'best-sellers') || productSections[1]

  const locale = input.locale
  const fallbackHero =
    locale === 'vi'
      ? {
          title: 'BỘ SƯU TẬP MỚI',
          subtitle: 'Khám phá xu hướng mới nhất',
          cta: 'MUA NGAY',
        }
      : {
          title: 'SUMMER ELEGANCE COLLECTION',
          subtitle: 'Shop the latest trends.',
          cta: 'EXPLORE NOW',
        }

  const catTitle =
    locale === 'vi'
      ? 'Danh mục nổi bật'
      : locale === 'zh'
        ? '精选分类'
        : 'FEATURED CATEGORIES'

  const itemsRaw = Array.isArray(cats?.props?.items) ? cats!.props.items : []
  const productsHref = partnerSiteProductsPath(input.siteSlug)
  const categories = itemsRaw
    .slice(0, 8)
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      return {
        name: str(o.name, 'Category'),
        imageUrl: str(o.imageUrl),
        href: str(o.href) || productsHref,
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  if (!categories.length) {
    const sample = getShopTemplateSampleProducts(locale).slice(0, 4)
    const names =
      locale === 'vi'
        ? ['Thời trang', 'Túi xách', 'Giày dép', 'Phụ kiện']
        : ['Clothing', 'Handbags', 'Shoes', 'Accessories']
    names.forEach((name, i) => {
      categories.push({
        name,
        imageUrl: sample[i]?.imageUrl || '',
        href: productsHref,
      })
    })
  }

  return {
    heroTitle: str(hero?.props?.title, fallbackHero.title),
    heroSubtitle: str(hero?.props?.subtitle, fallbackHero.subtitle),
    heroCta: str(hero?.props?.ctaText, fallbackHero.cta),
    heroImage: str(
      hero?.props?.backgroundImage,
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80'
    ),
    categoriesTitle: str(cats?.props?.title, catTitle),
    categories,
    newArrivalsTitle: str(
      newSec?.props?.title,
      locale === 'vi' ? 'Hàng mới về' : 'NEW ARRIVALS'
    ),
    bestSellersTitle: str(
      bestSec?.props?.title,
      locale === 'vi' ? 'Sản phẩm bán chạy' : 'BEST SELLERS'
    ),
  }
}

export type FashionHomeCopyPatch = {
  heroTitle?: string
  heroSubtitle?: string
  heroCta?: string
  heroImage?: string
  categoriesTitle?: string
  categories?: Array<{ name: string; imageUrl: string; href?: string }>
  newArrivalsTitle?: string
  bestSellersTitle?: string
}

export function parseFashionHomeCopyPatch(raw: unknown): FashionHomeCopyPatch | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const take = (key: keyof FashionHomeCopyPatch) => {
    const v = o[key]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : undefined
  }
  const categories = Array.isArray(o.categories)
    ? o.categories
        .slice(0, 8)
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          return {
            name: typeof row.name === 'string' ? row.name.trim().slice(0, 120) : '',
            imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl.trim().slice(0, 2000) : '',
            href: typeof row.href === 'string' ? row.href.trim().slice(0, 2000) : undefined,
          }
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row && (row.name || row.imageUrl)))
    : undefined
  const patch: FashionHomeCopyPatch = {
    heroTitle: take('heroTitle'),
    heroSubtitle: take('heroSubtitle'),
    heroCta: take('heroCta'),
    heroImage: take('heroImage'),
    categoriesTitle: take('categoriesTitle'),
    categories,
    newArrivalsTitle: take('newArrivalsTitle'),
    bestSellersTitle: take('bestSellersTitle'),
  }
  return Object.values(patch).some((v) => v != null && !(Array.isArray(v) && v.length === 0))
    ? patch
    : null
}

function clonePages(pages: PartnerWebsitePage[]): PartnerWebsitePage[] {
  return pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      props: { ...section.props },
    })),
  }))
}

/** Persist Sửa nhanh text/image edits into the same pages JSON the React homepage reads. */
export function applyFashionHomeCopyToPages(
  pages: PartnerWebsitePage[],
  patch: FashionHomeCopyPatch
): PartnerWebsitePage[] {
  const next = clonePages(pages)
  const home = next.find((p) => p.slug === '/' || p.slug === 'index') ?? next[0]
  if (!home) return pages

  const hero = home.sections.find((s) => s.type === 'hero-v1')
  if (hero) {
    if (patch.heroTitle != null) hero.props.title = patch.heroTitle
    if (patch.heroSubtitle != null) hero.props.subtitle = patch.heroSubtitle
    if (patch.heroCta != null) hero.props.ctaText = patch.heroCta
    if (patch.heroImage != null) hero.props.backgroundImage = patch.heroImage
  }

  const cats = home.sections.find((s) => s.type === 'categories-v1')
  if (cats) {
    if (patch.categoriesTitle != null) cats.props.title = patch.categoriesTitle
    if (patch.categories?.length) {
      const prev = Array.isArray(cats.props.items) ? cats.props.items : []
      cats.props.items = patch.categories.map((cat, i) => {
        const old =
          prev[i] && typeof prev[i] === 'object' ? (prev[i] as Record<string, unknown>) : {}
        return {
          ...old,
          name: cat.name,
          imageUrl: cat.imageUrl,
          href: cat.href || (typeof old.href === 'string' ? old.href : undefined),
        }
      })
    }
  }

  const productSections = home.sections.filter((s) => s.type === 'products-v1')
  const newSec =
    productSections.find((s) => s.props?.variant === 'new-arrivals') || productSections[0]
  const bestSec =
    productSections.find((s) => s.props?.variant === 'best-sellers') || productSections[1]
  if (newSec && patch.newArrivalsTitle != null) newSec.props.title = patch.newArrivalsTitle
  if (bestSec && patch.bestSellersTitle != null) bestSec.props.title = patch.bestSellersTitle

  return next
}

function editText(doc: Document, key: string): string | undefined {
  const el = doc.querySelector(`[data-pw-edit="${key}"]`)
  const text = el?.textContent?.replace(/\s+/g, ' ').trim()
  return text || undefined
}

function editSrc(doc: Document, key: string): string | undefined {
  const el = doc.querySelector(`[data-pw-edit="${key}"]`)
  if (el instanceof HTMLImageElement && el.getAttribute('src')?.trim()) {
    return el.getAttribute('src')!.trim()
  }
  return undefined
}

export function extractFashionHomeCopyFromDocument(doc: Document): FashionHomeCopyPatch {
  const categories: Array<{ name: string; imageUrl: string }> = []
  for (let i = 0; i < 8; i += 1) {
    const name = editText(doc, `categoryName:${i}`)
    const imageUrl = editSrc(doc, `categoryImage:${i}`) || ''
    if (!name && !imageUrl) break
    categories.push({ name: name || '', imageUrl })
  }
  return {
    heroTitle: editText(doc, 'heroTitle'),
    heroSubtitle: editText(doc, 'heroSubtitle'),
    heroCta: editText(doc, 'heroCta'),
    heroImage: editSrc(doc, 'heroImage'),
    categoriesTitle: editText(doc, 'categoriesTitle'),
    categories: categories.length ? categories : undefined,
    newArrivalsTitle: editText(doc, 'newArrivalsTitle'),
    bestSellersTitle: editText(doc, 'bestSellersTitle'),
  }
}
