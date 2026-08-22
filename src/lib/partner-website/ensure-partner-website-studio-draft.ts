import type { WebLocale } from '@/lib/i18n/config'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  fetchPartnerWebsiteOwnerBySlugPg,
  updatePartnerWebsiteCreationJournalPg,
  upsertPartnerWebsitePg,
  withPartnerWebsiteWriteLock,
} from '@/lib/db/messaging-partner-websites-pg'
import {
  appendJournalEntry,
  coerceJournalToTemplateSetup,
  coerceJournalToWebStudioFlow,
  createEmptyCreationJournal,
  discoveryKeysForJournal,
  ensureQuestionEntryForStep,
  getJournalFromBag,
  normalizeCreationJournals,
  upsertJournalInBag,
  type PartnerWebsiteCreationJournal,
} from '@/lib/partner-website/partner-website-creation-journal'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { normalizePartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { normalizePartnerWebsiteSlug, validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import {
  studioStepQuestionText,
  type PartnerWebsiteStudioStepKey,
} from '@/lib/partner-website/partner-website-studio-flow'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'

async function resolveStudioSiteSlug(input: {
  partnerId: string
  partnerSlug: string
  existingWebsite?: PartnerWebsiteRow | null
}): Promise<{ slug: string } | { error: string }> {
  if (input.existingWebsite?.siteSlug?.trim()) {
    return { slug: input.existingWebsite.siteSlug.trim().toLowerCase() }
  }
  const candidates = [
    input.partnerSlug.trim().toLowerCase(),
    normalizePartnerWebsiteSlug(`${input.partnerSlug}-shop`),
    normalizePartnerWebsiteSlug(`${input.partnerSlug}-web`),
    normalizePartnerWebsiteSlug(`${input.partnerSlug}-${input.partnerId.slice(0, 8)}`),
  ].filter(Boolean)
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)
    if (validatePartnerWebsiteSlug(candidate)) continue
    const owner = await fetchPartnerWebsiteOwnerBySlugPg(candidate)
    if (!owner || owner.partnerId === input.partnerId) return { slug: candidate }
  }
  return { error: 'Could not resolve a valid public site slug for this shop.' }
}

export async function ensurePartnerWebsiteStudioDraftPg(input: {
  partnerId: string
  locale: WebLocale
  defaultBrandName?: string
  questionTexts: Record<string, string>
  pageKey?: string
  /** When true, create/open journal for page without forcing first question until selected. */
  pickOnly?: boolean
}): Promise<
  | {
      ok: true
      website: PartnerWebsiteRow
      journal: PartnerWebsiteCreationJournal | null
      journals: ReturnType<typeof normalizeCreationJournals>
    }
  | { ok: false; reason: string }
> {
  const partner = await fetchPartnerProfileForWebsitePg(input.partnerId)
  if (!partner) return { ok: false, reason: 'Partner not found' }

  const title =
    input.defaultBrandName?.trim() ||
    partner.brandName?.trim() ||
    partner.displayName?.trim() ||
    'Website'

  const created = await withPartnerWebsiteWriteLock(input.partnerId, async () => {
    let website = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
    const slugResolved = await resolveStudioSiteSlug({
      partnerId: input.partnerId,
      partnerSlug: partner.slug,
      existingWebsite: website,
    })
    if ('error' in slugResolved) return { ok: false as const, reason: slugResolved.error }

    if (!website) {
      const templateSite = buildDefaultLandingV1Site({
        locale: input.locale,
        title,
        briefText: title,
        logoUrl: partner.logoUrl,
      })
      const project = syncTemplateToProject(templateSite)
      const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`
      website = await upsertPartnerWebsitePg({
        partnerId: input.partnerId,
        siteSlug: slugResolved.slug,
        title,
        briefText: title,
        logoUrl: partner.logoUrl,
        referenceImageUrls: [],
        renderMode: 'template',
        templateId: templateSite.templateId,
        theme: templateSite.theme,
        pages: templateSite.pages,
        project,
        locale: input.locale,
        skipRevision: true,
        changeNote: 'studio_draft_init',
        chatPath,
      })
      if (!website) {
        website = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
      }
      if (!website) return { ok: false as const, reason: 'Could not create website draft' }
    }
    return { ok: true as const, website }
  })
  if (!created.ok) return { ok: false, reason: created.reason }
  let website = created.website

  let bag =
    website.creationJournals ??
    normalizeCreationJournals(null, { defaultBrandName: title, locale: input.locale })

  if (input.pickOnly || !input.pageKey?.trim()) {
    return {
      ok: true,
      website: { ...website, creationJournals: bag },
      journal: null,
      journals: bag,
    }
  }

  const pageKey = normalizePartnerWebsitePageKey(input.pageKey)
  const homeJournal = getJournalFromBag(bag, 'home')
  const homeAnswers = homeJournal?.answers ?? {}
  const homeBrand =
    homeAnswers.brand_name?.trim() ||
    partner.brandName?.trim() ||
    partner.displayName?.trim() ||
    title
  let journal =
    getJournalFromBag(bag, pageKey) ??
    createEmptyCreationJournal({
      defaultBrandName: homeBrand,
      locale: input.locale,
      pageKey,
    })
  // Inherit homepage visual system — other pages only customize features.
  if (pageKey !== 'home') {
    journal = {
      ...journal,
      answers: {
        ...journal.answers,
        brand_name: journal.answers.brand_name?.trim() || homeBrand,
        style_mood: homeAnswers.style_mood || journal.answers.style_mood,
        color_palette: homeAnswers.color_palette || journal.answers.color_palette,
        desktop_header: homeAnswers.desktop_header || journal.answers.desktop_header,
        desktop_footer: homeAnswers.desktop_footer || journal.answers.desktop_footer,
        mobile_header: homeAnswers.mobile_header || journal.answers.mobile_header,
        mobile_footer: homeAnswers.mobile_footer || journal.answers.mobile_footer,
        logo_url: homeAnswers.logo_url || journal.answers.logo_url,
        products_sell: homeAnswers.products_sell || journal.answers.products_sell,
        target_audience: homeAnswers.target_audience || journal.answers.target_audience,
        value_prop: journal.answers.value_prop || homeAnswers.value_prop,
      },
    }
  }
  journal = coerceJournalToWebStudioFlow(journal, input.locale)

  // Shop home: skip AI interview — go straight to fixed-template setup.
  if (pageKey === 'home' && journal.phase !== 'built') {
    const copy = getPartnerWebsiteCopy(input.locale)
    journal = coerceJournalToTemplateSetup(journal, {
      brandName: homeBrand,
      logoUrl: partner.logoUrl || journal.answers.logo_url || null,
      promptText: copy.studioPickTemplateHint,
    })
  } else if (journal.phase === 'discovery') {
    const keys = discoveryKeysForJournal(journal)
    const stepKey = keys[journal.stepIndex] ?? keys[0]!
    journal = ensureQuestionEntryForStep(
      journal,
      stepKey,
      studioStepQuestionText(stepKey, input.questionTexts),
      input.locale
    )
  }

  const updated = await updatePartnerWebsiteCreationJournalPg(input.partnerId, journal)
  if (updated) {
    website = updated
    bag = updated.creationJournals
    journal = updated.creationJournal.pageKey === pageKey
      ? updated.creationJournal
      : getJournalFromBag(updated.creationJournals, pageKey) ?? journal
  } else {
    bag = upsertJournalInBag(bag, journal)
    website = { ...website, creationJournal: journal, creationJournals: bag }
  }

  return { ok: true, website, journal, journals: bag }
}

export async function persistPartnerWebsiteJournalPg(
  partnerId: string,
  journal: PartnerWebsiteCreationJournal
): Promise<PartnerWebsiteRow | null> {
  return updatePartnerWebsiteCreationJournalPg(partnerId, journal)
}

export function advanceJournalAfterAnswer(input: {
  journal: PartnerWebsiteCreationJournal
  stepKey: PartnerWebsiteStudioStepKey
  answer: string
  locale: WebLocale
  questionTexts: Record<string, string>
  mockupPromptText?: string
}): PartnerWebsiteCreationJournal {
  const keys = discoveryKeysForJournal(input.journal)
  let journal = appendJournalEntry(input.journal, {
    kind: 'answer',
    stepKey: input.stepKey,
    role: 'user',
    content: input.answer.trim(),
  })
  journal = {
    ...journal,
    answers: {
      ...journal.answers,
      site_type: journal.answers.site_type || 'Web shop',
      [input.stepKey]: input.answer.trim(),
    },
  }

  const nextIndex = journal.stepIndex + 1
  if (nextIndex < keys.length) {
    const nextKey = keys[nextIndex]!
    journal = {
      ...journal,
      stepIndex: nextIndex,
    }
    journal = ensureQuestionEntryForStep(
      journal,
      nextKey,
      studioStepQuestionText(nextKey, input.questionTexts),
      input.locale
    )
    return journal
  }

  journal = {
    ...journal,
    stepIndex: nextIndex,
    // Reuse mockup phase as "ready to apply fixed template" (no AI mockup image).
    phase: 'mockup',
  }
  journal = appendJournalEntry(journal, {
    kind: 'question',
    role: 'system',
    content: input.mockupPromptText || 'Apply template shop layout',
    suggestions: [],
  })
  return journal
}
