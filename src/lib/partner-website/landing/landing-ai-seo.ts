import { fetchPartnerLandingPageByIdPg, updatePartnerLandingPagePg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { listLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { buildLandingAiContext } from '@/lib/partner-website/landing/landing-ai-context'
import { generateLandingSeo } from '@/lib/partner-website/landing/landing-ai-content-generator'
import type { LandingHeroData } from '@/lib/partner-website/landing/landing-ai-types'
import type { PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'

/** L3.7 — SEO tự sinh (guardrail chống trùng category page) + tự sinh sau khi mọi section AI xong. */

function heroCopyFromSections(sections: { sectionType: string; data: unknown }[]): {
  headline: string | null
  subheadline: string | null
} {
  const hero = sections.find((s) => s.sectionType === 'hero')
  const data = (hero?.data ?? {}) as LandingHeroData
  return { headline: data.headline?.trim() || null, subheadline: data.subheadline?.trim() || null }
}

export async function generateAndSaveLandingSeo(
  partnerId: string,
  landingId: string,
  opts: { onlyMissing?: boolean } = {}
): Promise<{ metaTitle: string; metaDescription: string } | null> {
  const landing = await fetchPartnerLandingPageByIdPg(partnerId, landingId)
  if (!landing) return null
  if (opts.onlyMissing && landing.metaTitle?.trim() && landing.metaDescription?.trim()) {
    return { metaTitle: landing.metaTitle, metaDescription: landing.metaDescription ?? '' }
  }
  const context = await buildLandingAiContext(partnerId, landing)
  if (!context) return null
  const sections = await listLandingSectionsPg(landingId)
  const { headline, subheadline } = heroCopyFromSections(sections)
  const seo = await generateLandingSeo(context, headline, subheadline)
  if (!seo) return null

  const saved = await updatePartnerLandingPagePg({
    partnerId,
    landingId,
    metaTitle: opts.onlyMissing && landing.metaTitle?.trim() ? undefined : seo.metaTitle,
    metaDescription: opts.onlyMissing && landing.metaDescription?.trim() ? undefined : seo.metaDescription,
  })
  if (!saved) return null
  return { metaTitle: saved.metaTitle ?? seo.metaTitle, metaDescription: saved.metaDescription ?? seo.metaDescription }
}

/** Tự sinh SEO còn thiếu khi các section AI (trừ products_grid) đã "ready" — fire-and-forget, không chặn response. */
export async function generateAndSaveLandingSeoIfMissing(partnerId: string, landingId: string): Promise<void> {
  try {
    const landing = await fetchPartnerLandingPageByIdPg(partnerId, landingId)
    if (!landing) return
    if (landing.metaTitle?.trim() && landing.metaDescription?.trim()) return
    const sections = await listLandingSectionsPg(landingId)
    const pendingAi = sections.filter((s) => s.sectionType !== 'products_grid' && s.status !== 'ready')
    if (pendingAi.length) return
    await generateAndSaveLandingSeo(partnerId, landingId, { onlyMissing: true })
  } catch (e) {
    console.warn('[landing-ai-seo] auto SEO after section failed', e)
  }
}

export function landingNeedsSeo(landing: PartnerLandingPageRow): boolean {
  return !landing.metaTitle?.trim() || !landing.metaDescription?.trim()
}
