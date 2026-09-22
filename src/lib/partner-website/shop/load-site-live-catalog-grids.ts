/**
 * Fetch card pages for live visual first paint. Not written into Sửa nhanh HTML.
 */

import { fetchPartnerInventoryActiveCardPageWithCountFromPg, fetchPartnerInventoryCardPageByCategoryFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  inventoryCardRowToShopProduct,
  type PartnerInventoryShopCardRow,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import { applyPartnerStorefrontSaleFaces, loadPartnerSiteSaleOverlay } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import { resolvePartnerStorefrontSaleIdentity } from '@/lib/partner-website/shop/partner-site-personalization'
import type { LiveCatalogGridBind } from '@/lib/partner-website/shop/bind-live-catalog-grids-to-html'
import type { LiveCategoryListingBind } from '@/lib/partner-website/shop/bind-live-category-listing-to-html'
import {
  clampProductGridRows,
  productGridColsForDevice,
  productGridPageSize,
  PW_GRID_PAGE_MAX,
} from '@/lib/partner-website/shop/pw-product-grid-page'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import type { WebLocale } from '@/lib/i18n/config'

function attr(open: string, name: string): string {
  return open.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.trim() || ''
}

function hostNeedsBind(open: string): boolean {
  if (
    /\bdata-pw-(?:outfit|featured-categories)\b/i.test(open) ||
    /\bdata-pw-personalize\s*=\s*["']featured-categories["']/i.test(open) ||
    /\bdata-pw-grid-kind\s*=\s*["'](?:outfit|featured-categories|related)["']/i.test(open) ||
    /\bdata-pw-related\s*=/i.test(open)
  ) {
    return false
  }
  return (
    /\bdata-pw-catalog\b/i.test(open) ||
    /\bdata-pw-personalize\s*=\s*["'](?:recently-viewed|recommended|flash-sale)["']/i.test(open)
  )
}

function scanCatalogNeeds(html: string, device?: VisualDeviceVariant | null): {
  generic: boolean
  listing: boolean
  personalize: boolean
  maxLimit: number
} {
  const cols = productGridColsForDevice(device)
  let generic = false
  let listing = false
  let personalize = false
  let maxLimit = 0
  const re = /<(section|div)\b([^>]*\bdata-pw-(?:catalog|personalize)\b[^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const open = match[0]
    if (!hostNeedsBind(open)) continue
    const rows = clampProductGridRows(attr(open, 'data-pw-grid-rows') || 1)
    const limitAttr = Math.floor(Number(attr(open, 'data-limit') || 0))
    const page = productGridPageSize(rows, cols)
    const limit = Math.max(1, Math.min(PW_GRID_PAGE_MAX, limitAttr > 0 ? Math.min(limitAttr, page) : page))
    maxLimit = Math.max(maxLimit, limit)
    if (/\bdata-pw-personalize\s*=\s*["'](?:recently-viewed|recommended|flash-sale)["']/i.test(open)) {
      personalize = true
      continue
    }
    if (/\bdata-category-id\s*=/i.test(open) || /\bdata-pw-listing-href\s*=/i.test(open)) {
      listing = true
      continue
    }
    generic = true
  }
  return { generic, listing, personalize, maxLimit: Math.max(1, Math.min(PW_GRID_PAGE_MAX, maxLimit || 12)) }
}

async function mapSaleCards(
  partnerId: string,
  siteSlug: string,
  rows: PartnerInventoryShopCardRow[]
): Promise<PartnerSiteShopProduct[]> {
  const overlay = await loadPartnerSiteSaleOverlay(partnerId).catch(() => null)
  const identity = await resolvePartnerStorefrontSaleIdentity(partnerId)
  const mapped = rows
    .map((row) => inventoryCardRowToShopProduct(siteSlug, row))
    .filter((p): p is PartnerSiteShopProduct => Boolean(p))
  return applyPartnerStorefrontSaleFaces(mapped, {
    partnerId,
    ...identity,
    overlay,
  })
}

export async function loadSiteLiveCatalogGrids(input: {
  html: string
  partnerId: string
  siteSlug: string
  locale: WebLocale
  device?: VisualDeviceVariant | null
  liveListing?: (LiveCategoryListingBind & { products?: PartnerSiteShopProduct[] | null }) | null
}): Promise<LiveCatalogGridBind | null> {
  const html = input.html || ''
  if (!html.trim() || !input.partnerId) return null
  const listingHint = Boolean(input.liveListing?.id)
  const needs = scanCatalogNeeds(html, input.device)
  if (listingHint) needs.listing = true
  if (!needs.generic && !needs.listing && !needs.personalize) return null

  const listingProvided = (input.liveListing?.products || []).filter((p) => p?.id)
  let generic: PartnerSiteShopProduct[] = []
  let listing: PartnerSiteShopProduct[] = listingProvided
  let personalize: PartnerSiteShopProduct[] = []

  const fetches: Array<Promise<void>> = []
  if (needs.generic || needs.personalize) {
    fetches.push(
      (async () => {
        const page = await fetchPartnerInventoryActiveCardPageWithCountFromPg(
          input.partnerId,
          0,
          needs.maxLimit
        )
        const cards = await mapSaleCards(input.partnerId, input.siteSlug, page?.rows ?? [])
        generic = cards
        personalize = cards
      })()
    )
  }
  if (needs.listing && !listing.length && input.liveListing?.id) {
    fetches.push(
      (async () => {
        const page = await fetchPartnerInventoryCardPageByCategoryFromPg(input.partnerId, {
          offset: 0,
          limit: needs.maxLimit,
          categoryId: input.liveListing!.id,
          sort: 'newest',
          includeDescendants: true,
        })
        listing = await mapSaleCards(input.partnerId, input.siteSlug, page?.rows ?? [])
      })()
    )
  }

  await Promise.all(fetches)
  if (!generic.length && !listing.length && !personalize.length) return null
  return { generic, listing, personalize }
}
