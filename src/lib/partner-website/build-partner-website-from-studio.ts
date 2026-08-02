import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import {
  buildPartnerWebsiteFromTemplateStudio,
  type BuildPartnerWebsiteFromTemplateStudioInput,
} from '@/lib/partner-website/build-partner-website-from-template-studio'

export type BuildPartnerWebsiteFromStudioInput = BuildPartnerWebsiteFromTemplateStudioInput & {
  /** @deprecated AI mockup build retired — ignored. */
  userId?: string
  approvedMockupUrl?: string
  pageKey?: string
  referenceImageUrls?: string[]
  mockupSpec?: unknown
  presetId?: string | null
}

export type BuildPartnerWebsiteFromStudioResult =
  | { ok: true; website: PartnerWebsiteRow; source: 'template'; assistantMessage: string }
  | { ok: false; error: string }

/** Apply fixed landing-v1 template and wire platform shop features (no AI HTML). */
export async function buildPartnerWebsiteFromStudio(
  input: BuildPartnerWebsiteFromStudioInput
): Promise<BuildPartnerWebsiteFromStudioResult> {
  const result = await buildPartnerWebsiteFromTemplateStudio({
    locale: input.locale,
    partnerId: input.partnerId,
    answers: input.answers,
    siteSlug: input.siteSlug,
    presetId: input.presetId,
  })
  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  return {
    ok: true,
    website: result.website,
    source: 'template',
    assistantMessage: result.assistantMessage,
  }
}
