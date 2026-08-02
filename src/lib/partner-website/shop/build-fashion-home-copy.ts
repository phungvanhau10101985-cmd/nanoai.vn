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
