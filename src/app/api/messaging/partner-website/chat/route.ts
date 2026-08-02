import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  updatePartnerWebsiteCreationJournalPg,
  upsertPartnerWebsitePg,
} from '@/lib/db/messaging-partner-websites-pg'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  appendJournalEntry,
  editSuggestionsForJournal,
} from '@/lib/partner-website/partner-website-creation-journal'
import {
  generatePartnerWebsiteProject,
  type PartnerWebsiteChatMessage,
} from '@/lib/partner-website/partner-website-ai-generator'
import { composePartnerWebsiteHtmlAsync } from '@/lib/partner-website/compose-partner-website-html'
import { partnerWebsitePublicPath, validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import { resolvePartnerWebsiteModelId } from '@/lib/partner-website/partner-website-models'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

export const maxDuration = 120

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

function normalizeChatMessages(raw: unknown): PartnerWebsiteChatMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (m): m is PartnerWebsiteChatMessage =>
        Boolean(m) &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
    )
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0)
    .slice(-20)
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
      partnerId?: string
      message?: string
      modelId?: string
      messages?: unknown
      title?: string
      logoUrl?: string | null
      referenceImageUrls?: string[]
      siteSlug?: string
      locale?: string
    }

    const partnerId = String(body.partnerId ?? '').trim()
    const message = String(body.message ?? '').trim()
    if (!partnerId) {
      return NextResponse.json({ error: 'partnerId required' }, { status: 400 })
    }
    if (message.length < 2) {
      return NextResponse.json({ error: 'message too short' }, { status: 400 })
    }

    const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website')
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const partner = await fetchPartnerProfileForWebsitePg(partnerId)
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const existing = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
    const locale = normalizeWebLocale(body.locale) ?? ('vi' as WebLocale)
    const modelId = resolvePartnerWebsiteModelId(body.modelId)
    const chatMessages = normalizeChatMessages(body.messages)

    const title =
      String(body.title ?? '').trim() ||
      existing?.title?.trim() ||
      partner.brandName?.trim() ||
      partner.displayName?.trim() ||
      'Website'
    const siteSlugRaw = body.siteSlug?.trim() || existing?.siteSlug || partner.slug
    const slugError = validatePartnerWebsiteSlug(siteSlugRaw)
    if (slugError) {
      return NextResponse.json({ error: slugError }, { status: 400 })
    }
    const siteSlug = siteSlugRaw.trim().toLowerCase()

    const logoUrl =
      body.logoUrl?.trim() || existing?.logoUrl?.trim() || partner.logoUrl?.trim() || null
    const referenceImageUrls = Array.isArray(body.referenceImageUrls)
      ? body.referenceImageUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 8)
      : existing?.referenceImageUrls ?? []

    const briefParts = [
      existing?.briefText?.trim(),
      ...chatMessages.filter((m) => m.role === 'user').map((m) => m.content),
      message,
    ].filter(Boolean)
    const briefText = briefParts.join('\n\n').slice(0, 8000)

    const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`
    const { project, source, assistantMessage, editedFiles, editMode, agentSteps, fileDiffs, renderMode, templateId, theme, pages, htmlSource } =
      await generatePartnerWebsiteProject({
      locale,
      title,
      briefText,
      logoUrl,
      referenceImageUrls,
      chatPath,
      userId: auth.user.id,
      modelId,
      renderMode: existing?.renderMode ?? 'template',
      templateId: existing?.templateId,
      theme: existing?.theme,
      pages: existing?.pages,
      currentProject: existing?.project ?? null,
      chatMessages: [...chatMessages, { role: 'user', content: message }],
      userMessage: message,
    })

    const composedHtml =
      htmlSource ??
      (await composePartnerWebsiteHtmlAsync(
        {
          renderMode: renderMode ?? existing?.renderMode ?? 'template',
          templateId: templateId ?? existing?.templateId ?? 'landing-v1',
          theme: theme ?? existing?.theme!,
          pages: pages ?? existing?.pages ?? [],
          project,
          htmlSource: null,
          locale,
          title,
          logoUrl,
          partnerId,
          siteSlug,
        },
        { chatPath, hydrateInventory: true }
      ))

    if (source === 'fallback' && existing && (existing.project.files.length || existing.pages.length)) {
      const base = siteBaseUrl(req)
      return NextResponse.json({
        success: true,
        source,
        modelId,
        assistantMessage,
        website: existing,
        previewPath: partnerWebsitePublicPath(existing.siteSlug),
        publicUrl: existing.isPublished
          ? `${base}${partnerWebsitePublicPath(existing.siteSlug)}`
          : null,
        fileCount: existing.project.files.length,
      })
    }

    const saved = await upsertPartnerWebsitePg({
      partnerId,
      siteSlug,
      title,
      briefText,
      logoUrl,
      referenceImageUrls,
      renderMode: renderMode ?? existing?.renderMode ?? 'template',
      templateId: templateId ?? existing?.templateId ?? 'landing-v1',
      theme: theme ?? existing?.theme,
      pages: pages ?? existing?.pages ?? [],
      project,
      htmlSource: composedHtml,
      locale,
      sourceThreadId: existing?.sourceThreadId ?? null,
      changeNote: message.slice(0, 500),
      chatPath,
    })

    if (!saved) {
      return NextResponse.json({ error: 'Could not save website project' }, { status: 500 })
    }

    const pwCopy = getPartnerWebsiteCopy(locale)
    let journal = saved.creationJournal
    journal = appendJournalEntry(journal, {
      kind: 'edit_request',
      role: 'user',
      content: message,
      suggestions: editSuggestionsForJournal(journal, pwCopy),
    })
    journal = appendJournalEntry(journal, {
      kind: 'edit_result',
      role: 'assistant',
      content: assistantMessage?.trim() || (locale === 'vi' ? 'Đã cập nhật website.' : 'Website updated.'),
      suggestions: editSuggestionsForJournal({ ...journal, phase: 'built' }, pwCopy),
    })
    const withJournal = await updatePartnerWebsiteCreationJournalPg(partnerId, journal)
    const websiteOut = withJournal ?? { ...saved, creationJournal: journal }

    const base = siteBaseUrl(req)
    return NextResponse.json({
      success: true,
      source,
      modelId,
      assistantMessage,
      editedFiles,
      editMode,
      agentSteps,
      fileDiffs,
      website: websiteOut,
      journal,
      previewPath: partnerWebsitePublicPath(siteSlug),
      publicUrl: saved.isPublished ? `${base}${partnerWebsitePublicPath(siteSlug)}` : null,
      fileCount: project.files.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
