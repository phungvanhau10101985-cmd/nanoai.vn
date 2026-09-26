import { normalizeWebLocale } from '@/lib/i18n/config'
import { catalogFeedIsInStock } from '@/lib/messaging/catalog-feed-shared'
import { formatPartnerShopMoneyVnd } from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteInfoPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type PartnerPdpMerchantFacts = {
  availability: 'in_stock' | 'out_of_stock'
  availabilityLabel: string
  note: string
  timingLabel: string
  shippingHref: string
  shippingLabel: string
  returnsHref: string
  returnsLabel: string
}

function escText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escAttr(value: string): string {
  return escText(value).replace(/"/g, '&quot;')
}

function policyHref(
  siteSlug: string | null | undefined,
  page: 'shipping' | 'returns',
  customDomain?: boolean
): string {
  const slug = String(siteSlug || '').trim()
  if (!slug) return `/${page}`
  return partnerSiteInfoPath(slug, page, { customDomain: Boolean(customDomain) })
}

export function partnerPdpInStock(input: { stockQty?: number | null; inStock?: boolean | null }): boolean {
  if (typeof input.inStock === 'boolean') return input.inStock
  if (input.stockQty == null) return catalogFeedIsInStock({ stock_qty: null })
  return input.stockQty > 0
}

export function buildPartnerPdpMerchantFacts(input: {
  locale?: string | null
  siteSlug?: string | null
  customDomain?: boolean
  stockQty?: number | null
  inStock?: boolean | null
  shippingFeeAmount?: number | null
}): PartnerPdpMerchantFacts {
  const locale = normalizeWebLocale(typeof input.locale === 'string' ? input.locale : null) ?? 'vi'
  const t = getPartnerSiteShopCopy(locale)
  const inStock = partnerPdpInStock(input)
  const fee = input.shippingFeeAmount
  const feePhrase =
    fee == null || !Number.isFinite(fee)
      ? ''
      : fee <= 0
        ? t.pdpShipFreePhrase
        : t.pdpShipFeePhrase.replace('{amount}', formatPartnerShopMoneyVnd(fee))
  return {
    availability: inStock ? 'in_stock' : 'out_of_stock',
    availabilityLabel: inStock ? t.pdpInStock : t.pdpOutOfStock,
    note: t.pdpShippingNote.replace('{free}', feePhrase),
    timingLabel: t.pdpShipTiming,
    shippingHref: policyHref(input.siteSlug, 'shipping', input.customDomain),
    shippingLabel: t.pdpShippingPolicyLink,
    returnsHref: policyHref(input.siteSlug, 'returns', input.customDomain),
    returnsLabel: t.pdpReturnsPolicyLink,
  }
}

export function renderPartnerPdpMerchantFactsHtml(facts: PartnerPdpMerchantFacts): string {
  return (
    `<div class="pw-pdp-merchant-facts" data-pw-pdp-slot="merchant-facts">` +
    `<p data-pw-merchant-availability="${facts.availability}">${escText(facts.availabilityLabel)}</p>` +
    `<p>${escText(facts.note)}</p>` +
    `<p>${escText(facts.timingLabel)} <a href="${escAttr(facts.shippingHref)}">${escText(facts.shippingLabel)}</a></p>` +
    `<p><a href="${escAttr(facts.returnsHref)}">${escText(facts.returnsLabel)}</a></p>` +
    `</div>`
  )
}
