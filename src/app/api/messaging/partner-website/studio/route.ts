import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPartnerCapabilitiesForPartnerFromPg } from '@/lib/db/messaging-partners-pg'
import {
  fetchPartnerProfileForWebsitePg,
  updatePartnerWebsiteCreationJournalPg,
  updatePartnerWebsiteDraftPg,
} from '@/lib/db/messaging-partner-websites-pg'
import { getPartnerWebsiteEditSuggestions } from '@/lib/partner-website/partner-website-quick-edits'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { buildPartnerWebsiteFromTemplateStudio } from '@/lib/partner-website/build-partner-website-from-template-studio'
import {
  appendJournalEntry,
  discoveryKeysForJournal,
  getJournalFromBag,
  isCreationInProgress,
  isHomePageBuilt,
  type PartnerWebsiteCreationJournal,
} from '@/lib/partner-website/partner-website-creation-journal'
import {
  getPartnerWebsitePageDef,
  getPartnerWebsitePageStudioMode,
  listPartnerWebsiteStudioPickerPages,
  normalizePartnerWebsitePageKey,
  pageCatalogLabels,
} from '@/lib/partner-website/partner-website-page-catalog'
import {
  advanceJournalAfterAnswer,
  ensurePartnerWebsiteStudioDraftPg,
  persistPartnerWebsiteJournalPg,
} from '@/lib/partner-website/ensure-partner-website-studio-draft'
import {
  PARTNER_WEBSITE_STUDIO_DISCOVERY_KEYS,
  type PartnerWebsiteStudioAnswers,
  type PartnerWebsiteStudioStepKey,
} from '@/lib/partner-website/partner-website-studio-flow'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

export const maxDuration = 300

function siteBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  if (process.env.NODE_ENV === 'production') return defaultPublicOrigin().replace(/\/$/, '')
  return req.nextUrl.origin
}

function parseAnswers(raw: unknown): PartnerWebsiteStudioAnswers {
  if (!raw || typeof raw !== 'object') return {}
  const out: PartnerWebsiteStudioAnswers = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k as keyof PartnerWebsiteStudioAnswers] = v
  }
  return out
}

function questionTextsFromLocale(locale: WebLocale): Record<string, string> {
  const t = getPartnerWebsiteCopy(locale)
  return t as unknown as Record<string, string>
}

function isValidStepKey(v: string): v is PartnerWebsiteStudioStepKey {
  if (v === 'site_type') return true
  return (PARTNER_WEBSITE_STUDIO_DISCOVERY_KEYS as string[]).includes(v)
}

function pageStatusFromJournal(
  journal: PartnerWebsiteCreationJournal | null | undefined
): 'not_started' | 'in_progress' | 'built' {
  if (!journal || (journal.phase === 'discovery' && journal.entries.length === 0)) {
    return 'not_started'
  }
  if (journal.phase === 'built') return 'built'
  return 'in_progress'
}

export async function POST(req: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const auth = await getUserForCreditAction()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = (await req.json()) as {
      action?: string
      partnerId?: string
      locale?: string
      answers?: unknown
      stepKey?: string
      answer?: string
      defaultBrandName?: string
      pageKey?: string
      presetId?: string
    }

    const partnerId = String(body.partnerId ?? '').trim()
    if (!partnerId) {
      return NextResponse.json({ error: 'partnerId required' }, { status: 400 })
    }

    const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website')
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const locale = normalizeWebLocale(body.locale) ?? ('vi' as WebLocale)
    const t = getPartnerWebsiteCopy(locale)
    const questionTexts = questionTextsFromLocale(locale)
    const action = String(body.action ?? '').trim()
    const labels = pageCatalogLabels(locale)

    if (action === 'list_pages' || action === 'init') {
      const pageKeyRaw = body.pageKey?.trim()
      const pickOnly = action === 'list_pages' || !pageKeyRaw
      if (action === 'init' && pageKeyRaw) {
        const def = getPartnerWebsitePageDef(pageKeyRaw)
        if (def && getPartnerWebsitePageStudioMode(def) === 'platform') {
          return NextResponse.json(
            {
              error:
                locale === 'vi'
                  ? 'Trang này đã có sẵn trên nền tảng — mở trang sống sau khi áp mẫu trang chủ.'
                  : 'This page is already provided by the platform — open the live page after applying the home template.',
            },
            { status: 400 }
          )
        }
      }
      const draft = await ensurePartnerWebsiteStudioDraftPg({
        partnerId,
        locale,
        defaultBrandName: body.defaultBrandName?.trim(),
        questionTexts,
        pageKey: pageKeyRaw,
        pickOnly,
      })
      if (!draft.ok) {
        return NextResponse.json({ error: draft.reason }, { status: 422 })
      }

      const homeBuilt = isHomePageBuilt(draft.journals)
      const pages = listPartnerWebsiteStudioPickerPages().map((def) => {
        const mode = getPartnerWebsitePageStudioMode(def)
        const journal = getJournalFromBag(draft.journals, def.key)
        if (mode === 'platform') {
          return {
            key: def.key,
            htmlPath: def.htmlPath,
            routePath: def.routePath,
            title: labels[def.key].title,
            hint: labels[def.key].hint,
            status: homeBuilt ? ('built' as const) : ('not_started' as const),
            phase: homeBuilt ? ('built' as const) : null,
            studioMode: mode,
          }
        }
        return {
          key: def.key,
          htmlPath: def.htmlPath,
          routePath: def.routePath,
          title: labels[def.key].title,
          hint: labels[def.key].hint,
          status: pageStatusFromJournal(journal),
          phase: journal?.phase ?? null,
          studioMode: mode,
        }
      })

      return NextResponse.json({
        success: true,
        website: draft.website,
        journal: draft.journal,
        journals: draft.journals,
        pages,
        activePageKey: draft.journal?.pageKey ?? draft.journals.activePageKey,
        homeBuilt,
        creationInProgress: draft.journal ? isCreationInProgress(draft.journal) : false,
      })
    }

    const pageKey = normalizePartnerWebsitePageKey(body.pageKey)

    if (action === 'save_step') {
      const stepKey = String(body.stepKey ?? '').trim()
      const answer = String(body.answer ?? '').trim()
      if (!isValidStepKey(stepKey)) {
        return NextResponse.json({ error: 'Invalid stepKey' }, { status: 400 })
      }
      if (stepKey === 'logo_url') {
        if (!answer || !/^https?:\/\//i.test(answer)) {
          return NextResponse.json(
            { error: locale === 'vi' ? 'Cần URL logo hợp lệ (tải ảnh logo).' : 'Valid logo URL required (upload a logo image).' },
            { status: 400 }
          )
        }
      } else if (answer.length < (stepKey === 'brand_name' ? 2 : 3)) {
        return NextResponse.json({ error: 'answer too short' }, { status: 400 })
      }

      const draft = await ensurePartnerWebsiteStudioDraftPg({
        partnerId,
        locale,
        questionTexts,
        pageKey,
      })
      if (!draft.ok) {
        return NextResponse.json({ error: draft.reason }, { status: 422 })
      }
      if (!draft.journal) {
        return NextResponse.json({ error: 'pageKey required' }, { status: 400 })
      }

      const keys = discoveryKeysForJournal(draft.journal)
      const expectedKey = keys[draft.journal.stepIndex] ?? null
      if (draft.journal.phase !== 'discovery' || expectedKey !== stepKey) {
        return NextResponse.json(
          { error: 'Step out of sync; refresh the page and try again.' },
          { status: 409 }
        )
      }

      let journal = advanceJournalAfterAnswer({
        journal: draft.journal,
        stepKey,
        answer,
        locale,
        questionTexts,
        mockupPromptText: t.studioPickTemplateTitle,
      })

      // Persist confirmed logo onto website row so UI build can always resolve it.
      if (stepKey === 'logo_url' && /^https?:\/\//i.test(answer)) {
        await updatePartnerWebsiteDraftPg({
          partnerId,
          logoUrl: answer,
        }).catch(() => null)
      }

      const saved = await persistPartnerWebsiteJournalPg(partnerId, journal)
      if (!saved) {
        return NextResponse.json({ error: 'Could not save journal' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        website: saved,
        journal,
        pageKey: journal.pageKey,
        creationInProgress: isCreationInProgress(journal),
      })
    }

    // Retired AI creation paths — shop sites use fixed templates only; AI remains for post-build edits via /chat.
    if (
      action === 'generate_logo' ||
      action === 'generate_mockup' ||
      action === 'analyze_mockup' ||
      action === 'build_step'
    ) {
      return NextResponse.json(
        {
          error:
            locale === 'vi'
              ? 'Đã tắt tự tạo bằng AI. Chọn mẫu cố định rồi bấm áp giao diện. Sau khi có web, chỉnh nhanh vẫn dùng AI.'
              : 'AI auto-creation is disabled. Pick a fixed template and apply it. After the site exists, quick edits still use AI.',
        },
        { status: 410 }
      )
    }

    const draft = await ensurePartnerWebsiteStudioDraftPg({
      partnerId,
      locale,
      questionTexts,
      pageKey,
    })
    if (!draft.ok) {
      return NextResponse.json({ error: draft.reason }, { status: 422 })
    }
    if (!draft.journal) {
      return NextResponse.json({ error: 'pageKey required' }, { status: 400 })
    }

    const homeJournal = getJournalFromBag(draft.journals, 'home')
    const homeAnswers = homeJournal?.answers ?? {}
    const answers = {
      ...homeAnswers,
      ...draft.journal.answers,
      ...parseAnswers(body.answers),
      brand_name:
        parseAnswers(body.answers).brand_name?.trim() ||
        draft.journal.answers.brand_name?.trim() ||
        homeAnswers.brand_name?.trim() ||
        draft.website.title,
      // Always lock visual tokens to homepage for every page.
      style_mood: homeAnswers.style_mood || draft.journal.answers.style_mood,
      color_palette: homeAnswers.color_palette || draft.journal.answers.color_palette,
      desktop_header: homeAnswers.desktop_header || draft.journal.answers.desktop_header,
      desktop_footer: homeAnswers.desktop_footer || draft.journal.answers.desktop_footer,
      mobile_header: homeAnswers.mobile_header || draft.journal.answers.mobile_header,
      mobile_footer: homeAnswers.mobile_footer || draft.journal.answers.mobile_footer,
      logo_url: homeAnswers.logo_url || draft.journal.answers.logo_url,
    }

    if (action === 'apply_template') {
      const result = await buildPartnerWebsiteFromTemplateStudio({
        locale,
        partnerId,
        answers,
        presetId: String(body.presetId ?? '').trim() || null,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 422 })
      }

      let journal: PartnerWebsiteCreationJournal = appendJournalEntry(draft.journal, {
        kind: 'site_built',
        role: 'assistant',
        content: result.assistantMessage,
        suggestions: await editSuggestions(locale, t, partnerId),
      })
      journal = {
        ...journal,
        answers,
        phase: 'built',
        mockupSpec: null,
        buildArtifacts: null,
      }

      const saved = await updatePartnerWebsiteCreationJournalPg(partnerId, journal)
      const website = saved
        ? { ...result.website, creationJournal: journal, creationJournals: saved.creationJournals }
        : { ...result.website, creationJournal: journal }

      const base = siteBaseUrl(req)
      return NextResponse.json({
        success: true,
        source: 'template',
        assistantMessage: result.assistantMessage,
        website,
        journal,
        pageKey,
        creationInProgress: false,
        publicUrl: website.isPublished
          ? `${base}${partnerWebsitePublicPath(website.siteSlug)}`
          : null,
      })
    }

    if (action === 'build') {
      // Default path: fixed shop template presets (AI mockup incremental build is retired).
      const result = await buildPartnerWebsiteFromTemplateStudio({
        locale,
        partnerId,
        answers,
        presetId: String(body.presetId ?? '').trim() || null,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 422 })
      }

      let journal: PartnerWebsiteCreationJournal = appendJournalEntry(draft.journal, {
        kind: 'site_built',
        role: 'assistant',
        content: result.assistantMessage,
        suggestions: await editSuggestions(locale, t, partnerId),
      })
      journal = {
        ...journal,
        answers,
        phase: 'built',
        mockupSpec: null,
        buildArtifacts: null,
      }

      const saved = await updatePartnerWebsiteCreationJournalPg(partnerId, journal)
      const website = saved
        ? { ...result.website, creationJournal: journal, creationJournals: saved.creationJournals }
        : { ...result.website, creationJournal: journal }

      const base = siteBaseUrl(req)
      return NextResponse.json({
        success: true,
        source: 'template',
        assistantMessage: result.assistantMessage,
        website,
        journal,
        pageKey,
        creationInProgress: false,
        publicUrl: website.isPublished
          ? `${base}${partnerWebsitePublicPath(website.siteSlug)}`
          : null,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

async function editSuggestions(
  locale: WebLocale,
  t: ReturnType<typeof getPartnerWebsiteCopy>,
  partnerId: string
): Promise<string[]> {
  const profile = await fetchPartnerProfileForWebsitePg(partnerId)
  const industryKey = profile?.industryKey ?? 'fashion'
  const capabilities = await fetchPartnerCapabilitiesForPartnerFromPg(partnerId, industryKey)
  return getPartnerWebsiteEditSuggestions({
    locale,
    t,
    industryKey,
    capabilities,
    phase: 'built',
  })
}
