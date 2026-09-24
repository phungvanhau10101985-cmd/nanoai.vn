import { listLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { pgQueryOne } from '@/lib/db/pg-query'
import { fetchPartnerProductRatingSummaryFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type {
  LandingFaqData,
  LandingHeroData,
  LandingHighlightsData,
  LandingMaterialData,
  LandingTrustCtaData,
} from '@/lib/partner-website/landing/landing-ai-types'
import { formatPdpOfferLine } from '@/lib/partner-website/shop/pdp-ladipage-copy'
import type { PdpLadipageOverlay, PdpLadipageStory } from '@/lib/partner-website/shop/pdp-ladipage-sections'

/** Landing đã publish, hero ready, đúng một inventory id. Không có thì null. */
export async function loadPublishedPdpLadipageStory(
  partnerId: string,
  inventoryId: string
): Promise<PdpLadipageStory | null> {
  if (!isPgConfigured()) return null
  const landing = await pgQueryOne<{ id: string }>(
    `select id::text as id
     from public.messaging_partner_landing_pages
     where partner_id = $1::uuid
       and is_published = true
       and source_type = 'products'
       and cardinality(inventory_ids) = 1
       and inventory_ids[1] = $2::uuid
     limit 1`,
    [partnerId, inventoryId]
  )
  if (!landing) return null
  const sections = await listLandingSectionsPg(landing.id)
  const hero = sections.find((section) => section.sectionType === 'hero')
  if (!hero || hero.status !== 'ready') return null
  const highlights = sections.find((section) => section.sectionType === 'highlights')
  const material = sections.find((section) => section.sectionType === 'material')
  const trust = sections.find((section) => section.sectionType === 'trust_cta')
  const faq = sections.find((section) => section.sectionType === 'faq')
  const heroData = (hero.data ?? {}) as LandingHeroData
  const highlightItems = ((highlights?.data ?? {}) as LandingHighlightsData).items ?? []
  const materialData = material?.status === 'ready' ? ((material.data ?? {}) as LandingMaterialData) : null
  const trustData = trust?.status === 'ready' ? ((trust.data ?? {}) as LandingTrustCtaData) : null
  const faqItems = faq?.status === 'ready' ? (((faq.data ?? {}) as LandingFaqData).items ?? []) : []
  const rating = await fetchPartnerProductRatingSummaryFromPg(partnerId, inventoryId).catch(() => null)
  return {
    landingId: landing.id,
    hero: heroData,
    highlights: highlightItems.filter((item) => item.title || item.desc),
    material: materialData && (materialData.body || materialData.imageUrl || materialData.material) ? materialData : null,
    trust: trustData?.body ? trustData : null,
    faq: faqItems.filter((item) => item.q && item.a),
    averageRating: rating && rating.total > 0 ? rating.average : null,
    totalReviews: rating && rating.total > 0 ? rating.total : 0,
  }
}

export async function loadPdpLadipageOverlay(input: {
  partnerId: string
  inventoryId: string
  productName: string
  imageUrl: string
  locale: string
}): Promise<PdpLadipageOverlay | null> {
  const [story, payment] = await Promise.all([
    loadPublishedPdpLadipageStory(input.partnerId, input.inventoryId).catch((error) => {
      console.warn('[pdp-ladipage] story', error)
      return null
    }),
    fetchPartnerPaymentSettingsFromPg(input.partnerId).catch(() => null),
  ])
  const offerLine = payment
    ? formatPdpOfferLine({
        locale: input.locale,
        depositMode: payment.default_deposit_mode,
        depositPercent: payment.default_deposit_percent,
        depositAmount: payment.default_deposit_amount,
        shippingFeeAmount: payment.shipping_fee_amount,
        includeDeposit: false,
      })
    : ''
  if (!story && !offerLine) return null
  return {
    story,
    offerLine,
    productName: input.productName,
    imageUrl: input.imageUrl,
  }
}
