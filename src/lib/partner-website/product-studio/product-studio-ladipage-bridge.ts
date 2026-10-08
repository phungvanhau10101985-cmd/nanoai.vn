import {
  insertPartnerLandingPagePg,
  listPartnerLandingPagesPg,
  setPartnerLandingPublishedPg,
} from '@/lib/db/messaging-partner-landing-pages-pg'
import {
  ensureDefaultLandingSectionsPg,
  listLandingSectionsPg,
  updateLandingSectionPg,
} from '@/lib/db/messaging-partner-landing-sections-pg'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { defaultLandingSectionPlan, type LandingSectionData } from '@/lib/partner-website/landing/landing-ai-types'
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

export type StudioLadipageBootstrapOptions = {
  materialImageUrl?: string | null
  materialCallouts?: string[]
  materialBody?: string | null
}

async function patchStudioMaterialSection(
  landingId: string,
  options: StudioLadipageBootstrapOptions | undefined
): Promise<void> {
  const imageUrl = (options?.materialImageUrl || '').trim()
  const callouts = (options?.materialCallouts || []).map((item) => item.trim()).filter(Boolean)
  const body = (options?.materialBody || '').trim()
  if (!imageUrl && callouts.length === 0 && !body) return
  const material = (await listLandingSectionsPg(landingId)).find((section) => section.sectionType === 'material')
  if (!material) return
  const prev = (material.data || {}) as Record<string, unknown>
  const next: LandingSectionData = {
    ...prev,
    ...(imageUrl ? { imageUrl, imageSource: 'product' as const } : {}),
    ...(callouts.length ? { callouts } : {}),
    ...(body ? { body } : {}),
  }
  await updateLandingSectionPg({
    landingId,
    sectionId: material.id,
    status: 'ready',
    data: next,
  })
}

export async function bootstrapSingleProductLandingForStudio(
  partnerId: string,
  inventoryId: string,
  productName: string,
  options?: StudioLadipageBootstrapOptions
): Promise<{ landingId: string; landingSlug: string; published: boolean; warnings: string[] } | null> {
  const warnings: string[] = []
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  if (!website) return null

  const existing = await listPartnerLandingPagesPg(partnerId)
  const already = existing.find(
    (lp) => lp.sourceType === 'products' && lp.inventoryIds.length === 1 && lp.inventoryIds[0] === inventoryId
  )
  if (already?.isPublished) {
    await patchStudioMaterialSection(already.id, options)
    return {
      landingId: already.id,
      landingSlug: already.landingSlug,
      published: true,
      warnings: ['ladipage_bridge: landing already exists, reused'],
    }
  }

  let landing = already ?? null
  if (!landing) {
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
  }
  if (!landing) {
    warnings.push('ladipage_bridge: could not create landing (slug collision)')
    return null
  }

  const current = await listLandingSectionsPg(landing.id)
  const sections = current.length
    ? current
    : await ensureDefaultLandingSectionsPg(landing.id, defaultLandingSectionPlan(), {
        material: { imageSource: 'product' },
      })
  for (const section of sections) {
    if (section.sectionType === 'products_grid') continue
    if (section.status === 'ready' && section.sectionType !== 'material') continue
    const result = await runLandingSectionGenerate(partnerId, landing.id, section.id, { target: 'all' })
    if (!result.ok) warnings.push(`ladipage_bridge: section ${section.sectionType} failed (${result.error})`)
  }
  await patchStudioMaterialSection(landing.id, options)

  const heroReady = (await listLandingSectionsPg(landing.id)).some(
    (s) => s.sectionType === 'hero' && s.status === 'ready'
  )
  if (!heroReady) {
    warnings.push('ladipage_bridge: hero section not ready — landing created as draft, not published')
    return { landingId: landing.id, landingSlug: landing.landingSlug, published: false, warnings }
  }

  await generateAndSaveLandingSeo(partnerId, landing.id, { onlyMissing: true })
  const publishedRow = await setPartnerLandingPublishedPg({ partnerId, landingId: landing.id, published: true })
  const published = Boolean(publishedRow?.isPublished)
  if (!published) warnings.push('ladipage_bridge: publish failed')

  return { landingId: landing.id, landingSlug: landing.landingSlug, published, warnings }
}
