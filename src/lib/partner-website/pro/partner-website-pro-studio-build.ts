import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
} from '@/lib/db/messaging-partner-websites-pg'
import type { WebLocale } from '@/lib/i18n/config'
import { analyzePartnerWebsiteMockup } from '@/lib/partner-website/pro/analyze-partner-website-mockup'
import {
  buildPartnerWebsiteIncrementalFull,
  mergePageIntoProject,
} from '@/lib/partner-website/pro/partner-website-incremental-build'
import type { PartnerWebsiteProSectionImages } from '@/lib/partner-website/pro/partner-website-pro-images'
import type { PartnerWebsiteMockupUiSpec } from '@/lib/partner-website/pro/partner-website-mockup-ui-spec'
import {
  buildPartnerWebsiteStudioBrief,
  type PartnerWebsiteStudioAnswers,
} from '@/lib/partner-website/partner-website-studio-flow'
import { normalizePartnerWebsiteSlug, validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'

export { mergePageIntoProject }

export type BuildPartnerWebsiteProStudioInput = {
  locale: WebLocale
  userId: string
  partnerId: string
  answers: PartnerWebsiteStudioAnswers
  approvedMockupUrl: string
  pageKey?: string
  /** User-uploaded reference photos from the studio UI — must be embedded in HTML. */
  referenceImageUrls?: string[]
  /** When already analyzed, skip a second vision analyze call. */
  mockupSpec?: PartnerWebsiteMockupUiSpec | null
}

export type BuildPartnerWebsiteProStudioResult =
  | {
      ok: true
      website: PartnerWebsiteRow
      source: 'ai'
      assistantMessage: string
      sectionImages: PartnerWebsiteProSectionImages
      imageCount: number
      mockupSpec: PartnerWebsiteMockupUiSpec
    }
  | { ok: false; error: string; stage?: 'analyze' | 'content' | 'images' | 'build' | 'save' }

/**
 * Analyze approved mockup → incremental shell/section/hooks build.
 * Prefer client-orchestrated analyze_mockup + build_step for progress UI;
 * this full orchestrator remains for the legacy single `build` action.
 */
export async function buildPartnerWebsiteProStudio(
  input: BuildPartnerWebsiteProStudioInput
): Promise<BuildPartnerWebsiteProStudioResult> {
  const partner = await fetchPartnerProfileForWebsitePg(input.partnerId)
  if (!partner) return { ok: false, error: 'Partner not found', stage: 'analyze' }

  const briefText = buildPartnerWebsiteStudioBrief(input.answers, input.locale)
  if (briefText.length < 8) return { ok: false, error: 'Brief too short', stage: 'analyze' }

  const title =
    input.answers.brand_name?.trim() ||
    partner.brandName?.trim() ||
    partner.displayName?.trim() ||
    'Website'

  const siteSlugRaw =
    (await fetchPartnerWebsiteByPartnerIdPg(input.partnerId))?.siteSlug?.trim().toLowerCase() ||
    (() => {
      const candidates = [
        partner.slug.trim().toLowerCase(),
        normalizePartnerWebsiteSlug(`${partner.slug}-shop`),
      ]
      for (const c of candidates) {
        if (c && !validatePartnerWebsiteSlug(c)) return c
      }
      return partner.slug.trim().toLowerCase()
    })()

  if (validatePartnerWebsiteSlug(siteSlugRaw)) {
    return { ok: false, error: validatePartnerWebsiteSlug(siteSlugRaw)!, stage: 'analyze' }
  }

  let mockupSpec = input.mockupSpec ?? null
  if (!mockupSpec) {
    const analyzed = await analyzePartnerWebsiteMockup({
      locale: input.locale,
      userId: input.userId,
      title,
      briefText,
      siteSlug: siteSlugRaw,
      approvedMockupUrl: input.approvedMockupUrl,
      extraImageUrls: input.referenceImageUrls,
    })
    if (!analyzed.ok) {
      return { ok: false, error: analyzed.error, stage: 'analyze' }
    }
    mockupSpec = analyzed.spec
  }

  const result = await buildPartnerWebsiteIncrementalFull({
    locale: input.locale,
    userId: input.userId,
    partnerId: input.partnerId,
    answers: input.answers,
    approvedMockupUrl: input.approvedMockupUrl,
    pageKey: input.pageKey,
    referenceImageUrls: input.referenceImageUrls,
    mockupSpec,
  })

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      stage: result.stage === 'prepare' ? 'content' : result.stage === 'finalize' ? 'save' : 'build',
    }
  }

  const sectionImages = (result.artifacts.sectionImages ?? {}) as PartnerWebsiteProSectionImages
  return {
    ok: true,
    website: result.website,
    source: 'ai',
    assistantMessage: result.assistantMessage,
    sectionImages,
    imageCount: Object.keys(sectionImages).length,
    mockupSpec,
  }
}
