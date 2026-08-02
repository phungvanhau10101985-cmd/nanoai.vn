import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { updatePartnerLandingPagePg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import type { WebLocale } from '@/lib/i18n/config'
import {
  formatLandingProductsForPrompt,
  loadPartnerLandingProductSnapshots,
} from '@/lib/partner-website/landing/partner-landing-products'
import type { PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'
import { generatePartnerWebsiteFromMockupVision } from '@/lib/partner-website/generate-partner-website-from-mockup-vision'
import {
  PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES,
  PARTNER_WEBSITE_RESPONSIVE_RULES,
} from '@/lib/partner-website/partner-website-mockup-build-rules'
import { PARTNER_WEBSITE_LOGO_PROMPT_RULES } from '@/lib/partner-website/partner-website-logo-guard'

function buildLandingMockupBrief(input: {
  locale: WebLocale
  title: string
  briefText: string
  brandName: string
  productsBlock: string
}): string {
  const vi = input.locale === 'vi'
  return `${vi ? 'Thiết kế mockup LANDING PAGE quảng cáo sản phẩm (dọc 9:16).' : 'Design a PRODUCT marketing LANDING PAGE mockup (vertical 9:16).'}

Brand: ${input.brandName}
Landing title: ${input.title}
Brief: ${input.briefText}

${vi ? 'SẢN PHẨM THẬT (dùng đúng tên, giá, bố cục thẻ SP):' : 'REAL PRODUCTS (use exact names, prices, product-card layout):'}
${input.productsBlock}

Include: header+logo, hero with product imagery, product showcase cards for EACH listed product, benefits, strong BUY CTA button, FAQ optional, footer.
Primary CTA label should mean Buy / Mua hàng (opens product list — not checkout form).
Single finished mockup image only.`
}

function buildLandingExtraInstructions(input: {
  locale: WebLocale
  siteSlug: string
  productsBlock: string
}): string {
  const vi = input.locale === 'vi'
  return `${vi ? 'LANDING GẮN SẢN PHẨM — QUY TẮC BẮT BUỘC:' : 'PRODUCT LANDING — MANDATORY RULES:'}
- Marketing content + images only. Do NOT implement cart/checkout forms or invent APIs.
- Render a products section with ONE card per product below (use exact image URLs, names, prices):
${input.productsBlock}
- Each product card must be an <a href="{detailPath}"> with data-nanoai-inventory="{id}".
- Primary buy CTA buttons must use attribute data-nanoai-buy (and class pw-lp-buy) — platform opens product list modal.
- Optional chat CTA: data-nanoai-open-chat.
- Link home optional: /site/${input.siteSlug}
- Do NOT use data-pw-personalize recommended grid (fixed selected products only).
${PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES}
${PARTNER_WEBSITE_RESPONSIVE_RULES}
${PARTNER_WEBSITE_LOGO_PROMPT_RULES}`
}

export async function buildPartnerLandingFromProducts(input: {
  locale: WebLocale
  userId: string
  partnerId: string
  landing: PartnerLandingPageRow
  regenerateMockup?: boolean
}): Promise<
  | { ok: true; landing: PartnerLandingPageRow; mockupUrl: string; assistantMessage: string }
  | { ok: false; error: string; stage: 'products' | 'mockup' | 'build' | 'save' }
> {
  const website = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  if (!website) {
    return { ok: false, error: 'Website not found — create main website first', stage: 'products' }
  }

  const partner = await fetchPartnerProfileForWebsitePg(input.partnerId)
  if (!partner) return { ok: false, error: 'Partner not found', stage: 'products' }

  const products = await loadPartnerLandingProductSnapshots({
    partnerId: input.partnerId,
    siteSlug: website.siteSlug,
    inventoryIds: input.landing.inventoryIds,
  })
  if (!products.length) {
    return {
      ok: false,
      error:
        input.locale === 'vi'
          ? 'Không tìm thấy sản phẩm đã chọn trong kho.'
          : 'Selected products not found in inventory.',
      stage: 'products',
    }
  }

  const productsBlock = formatLandingProductsForPrompt(products)
  const brandName =
    partner.brandName?.trim() || partner.displayName?.trim() || input.landing.title || 'Shop'

  let mockupUrl = input.landing.mockupUrl?.trim() || ''
  if (input.regenerateMockup || !mockupUrl || !/^https?:\/\//i.test(mockupUrl)) {
    const brief = buildLandingMockupBrief({
      locale: input.locale,
      title: input.landing.title,
      briefText: input.landing.briefText,
      brandName,
      productsBlock,
    })
    const refUrls = [
      ...(partner.logoUrl ? [partner.logoUrl] : []),
      ...products.map((p) => p.imageUrl).filter(Boolean),
    ].slice(0, 8)

    const gen = await runStudioImagePipeline({
      userId: input.userId,
      kind: 'ui_mockup',
      screenLabel: 'Product landing page',
      screenKey: 'landing_full',
      brief,
      projectTitle: input.landing.title || brandName,
      aspectRatio: '9:16',
      referenceImageUrls: refUrls,
      referenceImageMeta: refUrls.map((url, i) =>
        i === 0 && partner.logoUrl === url
          ? { screenKey: 'landing_logo' as const }
          : { screenKey: 'banner_style_anchor' as const }
      ),
      verbatimPrompt: true,
    })
    if (!gen.ok) {
      return { ok: false, error: gen.error || 'Mockup generation failed', stage: 'mockup' }
    }
    mockupUrl = gen.resultUrl
  }

  const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`
  const generated = await generatePartnerWebsiteFromMockupVision({
    locale: input.locale,
    userId: input.userId,
    title: input.landing.title || brandName,
    briefText: `${input.landing.briefText}\n\nProducts:\n${productsBlock}`,
    logoUrl: partner.logoUrl,
    approvedMockupUrl: mockupUrl,
    chatPath,
    siteSlug: website.siteSlug,
    siteType: 'landing',
    extraInstructions: buildLandingExtraInstructions({
      locale: input.locale,
      siteSlug: website.siteSlug,
      productsBlock,
    }),
    sectionImages: Object.fromEntries(
      products.slice(0, 4).map((p, i) => [`product_${i + 1}`, p.imageUrl || undefined])
    ),
  })

  if ('error' in generated) {
    return { ok: false, error: generated.error, stage: 'build' }
  }

  const saved = await updatePartnerLandingPagePg({
    partnerId: input.partnerId,
    landingId: input.landing.id,
    project: generated.project,
    htmlSource: generated.htmlSource,
    mockupUrl,
    referenceImageUrls: [
      mockupUrl,
      ...products.map((p) => p.imageUrl).filter(Boolean),
    ].slice(0, 12),
  })

  if (!saved) {
    return { ok: false, error: 'Failed to save landing', stage: 'save' }
  }

  return {
    ok: true,
    landing: saved,
    mockupUrl,
    assistantMessage: generated.assistantMessage,
  }
}
