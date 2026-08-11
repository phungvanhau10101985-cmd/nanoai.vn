import {
  insertPartnerLandingPagePg,
  listPartnerLandingPagesPg,
  setPartnerLandingPublishedPg,
} from '@/lib/db/messaging-partner-landing-pages-pg'
import { ensureDefaultLandingSectionsPg, listLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { defaultLandingSectionPlan } from '@/lib/partner-website/landing/landing-ai-types'
import { runLandingSectionGenerate } from '@/lib/partner-website/landing/landing-ai-section-route-helpers'
import { generateAndSaveLandingSeo } from '@/lib/partner-website/landing/landing-ai-seo'
import { normalizePartnerLandingSlug, validatePartnerLandingSlug } from '@/lib/partner-website/partner-website-slug'

/**
 * PS.9 — sau khi đăng sản phẩm (thủ công hoặc AI), tự tạo + publish 1 Ladipage AI riêng cho sản phẩm
 * đó bằng engine L3 (mirror `bootstrap_single_product_ladipage` của 188) — "sản phẩm → landing bán
 * hàng chuyển đổi cao" theo đúng yêu cầu kết hợp 2 tính năng. Bám nguyên tắc L3.2: sản phẩm resolve
 * LIVE từ inventory, không snapshot — landing này chỉ giữ `inventoryIds=[id mới]`.
 */

function uniqueLandingSlugCandidates(base: string): string[] {
  const normalized = normalizePartnerLandingSlug(base) || 'san-pham'
  return [normalized, `${normalized}-lp`, `${normalized}-${Date.now().toString(36).slice(-5)}`]
}

export async function bootstrapSingleProductLandingForStudio(
  partnerId: string,
  inventoryId: string,
  productName: string
): Promise<{ landingId: string; landingSlug: string; warnings: string[] } | null> {
  const warnings: string[] = []
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  if (!website) {
    // Chưa có web chính — Landing luôn yêu cầu web chính trước (W0.5), bỏ qua an toàn, không lỗi publish.
    return null
  }

  // Skip-if-exists — tránh tạo trùng landing 1-SP nếu merchant publish lại/regenerate.
  const existing = await listPartnerLandingPagesPg(partnerId)
  const already = existing.find(
    (lp) => lp.sourceType === 'products' && lp.inventoryIds.length === 1 && lp.inventoryIds[0] === inventoryId
  )
  if (already) {
    return { landingId: already.id, landingSlug: already.landingSlug, warnings: ['ladipage_bridge: landing already exists, reused'] }
  }

  let landing = null
  for (const candidate of uniqueLandingSlugCandidates(productName)) {
    if (validatePartnerLandingSlug(candidate)) continue
    landing = await insertPartnerLandingPagePg({
      partnerId,
      websiteId: website.id,
      landingSlug: candidate,
      title: productName,
      briefText: '',
      locale: website.locale,
      inventoryIds: [inventoryId],
      sourceType: 'products',
    })
    if (landing) break
  }
  if (!landing) {
    warnings.push('ladipage_bridge: could not create landing (slug collision)')
    return null
  }

  const sections = await ensureDefaultLandingSectionsPg(landing.id, defaultLandingSectionPlan())
  for (const section of sections) {
    if (section.sectionType === 'products_grid') continue
    const result = await runLandingSectionGenerate(partnerId, landing.id, section.id, { target: 'all' })
    if (!result.ok) warnings.push(`ladipage_bridge: section ${section.sectionType} failed (${result.error})`)
  }

  const heroReady = (await listLandingSectionsPg(landing.id)).some(
    (s) => s.sectionType === 'hero' && s.status === 'ready'
  )
  if (!heroReady) {
    warnings.push('ladipage_bridge: hero section not ready — landing created as draft, not published')
    return { landingId: landing.id, landingSlug: landing.landingSlug, warnings }
  }

  await generateAndSaveLandingSeo(partnerId, landing.id, { onlyMissing: true })
  const published = await setPartnerLandingPublishedPg({ partnerId, landingId: landing.id, published: true })
  if (!published) warnings.push('ladipage_bridge: publish failed')

  return { landingId: landing.id, landingSlug: landing.landingSlug, warnings }
}
