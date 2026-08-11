import { fetchPartnerLandingPageByIdPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { fetchLandingSectionByIdPg, updateLandingSectionPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { buildLandingAiContext } from '@/lib/partner-website/landing/landing-ai-context'
import {
  generateOrRegenerateLandingSection,
  type LandingSectionGenerateTarget,
} from '@/lib/partner-website/landing/landing-ai-dispatcher'
import { generateAndSaveLandingSeoIfMissing } from '@/lib/partner-website/landing/landing-ai-seo'
import type { LandingAiSectionRow } from '@/lib/partner-website/landing/landing-ai-types'

/** L3.6 — dùng chung cho route generate/regenerate: build context, gọi dispatcher, lưu DB, tự sinh SEO khi đủ. */
export async function runLandingSectionGenerate(
  partnerId: string,
  landingId: string,
  sectionId: string,
  opts: { target?: LandingSectionGenerateTarget; customPrompt?: string }
): Promise<{ ok: true; section: LandingAiSectionRow } | { ok: false; error: string; status: number }> {
  const landing = await fetchPartnerLandingPageByIdPg(partnerId, landingId)
  if (!landing) return { ok: false, error: 'Landing not found', status: 404 }
  const section = await fetchLandingSectionByIdPg(landingId, sectionId)
  if (!section) return { ok: false, error: 'Section not found', status: 404 }

  const context = await buildLandingAiContext(partnerId, landing)
  if (!context) return { ok: false, error: 'Could not resolve landing context', status: 400 }
  if (!context.products.length) {
    return { ok: false, error: 'No live products resolved for this landing yet.', status: 400 }
  }

  try {
    const data = await generateOrRegenerateLandingSection(context, section, {
      target: opts.target ?? 'all',
      customPrompt: opts.customPrompt,
      partnerId,
    })
    const updated = await updateLandingSectionPg({
      landingId,
      sectionId,
      status: 'ready',
      data,
      promptUsed: opts.customPrompt ?? section.promptUsed,
      errorMessage: null,
    })
    if (!updated) return { ok: false, error: 'Could not save section', status: 500 }
    void generateAndSaveLandingSeoIfMissing(partnerId, landingId)
    return { ok: true, section: updated }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await updateLandingSectionPg({ landingId, sectionId, status: 'error', errorMessage: msg })
    return { ok: false, error: msg, status: 502 }
  }
}
