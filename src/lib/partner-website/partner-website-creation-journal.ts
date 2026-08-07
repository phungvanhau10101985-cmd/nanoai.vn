import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type {
  PartnerCapabilities,
  PartnerIndustryKey,
} from '@/lib/partner-website/partner-capabilities'
import { getPartnerWebsiteEditSuggestions } from '@/lib/partner-website/partner-website-quick-edits'
import {
  defaultFeatureSuggestions,
  discoveryKeysForPage,
  normalizePartnerWebsitePageKey,
  type PartnerWebsitePageKey,
} from '@/lib/partner-website/partner-website-page-catalog'
import {
  PARTNER_WEBSITE_STUDIO_DISCOVERY_KEYS,
  partnerWebsiteStudioWebShopAnswer,
  studioStepSuggestions,
  type PartnerWebsiteStudioAnswers,
  type PartnerWebsiteStudioStepKey,
} from '@/lib/partner-website/partner-website-studio-flow'
import {
  normalizePartnerWebsiteMockupUiSpec,
  type PartnerWebsiteBuildArtifacts,
  type PartnerWebsiteMockupUiSpec,
} from '@/lib/partner-website/pro/partner-website-mockup-ui-spec'

export type PartnerWebsiteJournalEntryKind =
  | 'question'
  | 'answer'
  | 'mockup_generated'
  | 'mockup_approved'
  | 'analyze_done'
  | 'build_progress'
  | 'section_built'
  | 'site_built'
  | 'edit_request'
  | 'edit_result'

export type PartnerWebsiteJournalEntry = {
  id: string
  pageKey: string
  kind: PartnerWebsiteJournalEntryKind
  stepKey?: PartnerWebsiteStudioStepKey
  role: 'system' | 'user' | 'assistant'
  content: string
  imageUrl?: string | null
  suggestions?: string[]
  createdAt: string
}

export type PartnerWebsiteCreationJournal = {
  version: 1
  pageKey: string
  phase: 'discovery' | 'mockup' | 'built'
  stepIndex: number
  answers: PartnerWebsiteStudioAnswers
  mockupUrl?: string | null
  approvedMockupUrl?: string | null
  /** Structured layout from GPT vision analysis of approved mockup. */
  mockupSpec?: PartnerWebsiteMockupUiSpec | null
  /** Intermediate content/images between incremental build_step calls. */
  buildArtifacts?: PartnerWebsiteBuildArtifacts | null
  entries: PartnerWebsiteJournalEntry[]
}

/** Multi-page journals bag (backward compatible with single v1 journal blob). */
export type PartnerWebsiteCreationJournalsV2 = {
  version: 2
  activePageKey: PartnerWebsitePageKey
  journals: Partial<Record<PartnerWebsitePageKey, PartnerWebsiteCreationJournal>>
}

export const PARTNER_WEBSITE_DEFAULT_PAGE_KEY: PartnerWebsitePageKey = 'home'

function newEntryId(): string {
  return `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyCreationJournal(input?: {
  defaultBrandName?: string
  pageKey?: string
  locale?: WebLocale
}): PartnerWebsiteCreationJournal {
  const pageKey = normalizePartnerWebsitePageKey(input?.pageKey)
  const locale = input?.locale ?? 'vi'
  // Do NOT pre-fill brand_name into answers — that auto-skips step 1.
  // UI may still suggest defaultBrandName in the input box for confirmation.
  return {
    version: 1,
    pageKey,
    phase: 'discovery',
    stepIndex: 0,
    answers: {
      site_type: partnerWebsiteStudioWebShopAnswer(locale),
    },
    mockupUrl: null,
    approvedMockupUrl: null,
    entries: [],
  }
}

export function hasUserAnswerForStep(
  journal: PartnerWebsiteCreationJournal,
  stepKey: PartnerWebsiteStudioStepKey
): boolean {
  return journal.entries.some(
    (e) => e.kind === 'answer' && e.role === 'user' && e.stepKey === stepKey && e.content.trim()
  )
}

function isStepKey(v: string): v is PartnerWebsiteStudioStepKey {
  if (v === 'site_type') return true
  return (PARTNER_WEBSITE_STUDIO_DISCOVERY_KEYS as string[]).includes(v)
}

export function discoveryKeysForJournal(journal: PartnerWebsiteCreationJournal): PartnerWebsiteStudioStepKey[] {
  return discoveryKeysForPage(journal.pageKey)
}

/** Drop legacy site_type interview step; resync step index for this page's keys. */
export function coerceJournalToWebStudioFlow(
  journal: PartnerWebsiteCreationJournal,
  locale: WebLocale = 'vi'
): PartnerWebsiteCreationJournal {
  const keys = discoveryKeysForJournal(journal)
  const answers: PartnerWebsiteStudioAnswers = {
    ...journal.answers,
    site_type: partnerWebsiteStudioWebShopAnswer(locale),
  }
  const entries = journal.entries.filter((e) => e.stepKey !== 'site_type')

  if (journal.phase !== 'discovery') {
    return { ...journal, answers, entries, pageKey: normalizePartnerWebsitePageKey(journal.pageKey) }
  }

  let stepIndex = 0
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!
    const val = answers[key]
    if (key === 'brand_name') {
      // Prefill from shop name must not skip — require explicit user confirm,
      // unless the user already answered later steps (resume mid-flow).
      const confirmed = hasUserAnswerForStep(journal, 'brand_name')
      const laterAnswered = keys.slice(i + 1).some((k) => Boolean(answers[k]?.trim()))
      if (confirmed || (val?.trim() && laterAnswered)) {
        stepIndex = i + 1
        continue
      }
      stepIndex = i
      break
    }
    if (key === 'logo_url') {
      const logo = val?.trim() ?? ''
      const valid = Boolean(logo && /^https?:\/\//i.test(logo))
      const confirmed = hasUserAnswerForStep(journal, 'logo_url')
      const laterAnswered = keys.slice(i + 1).some((k) => Boolean(answers[k]?.trim()))
      // Partner/workspace logo URL alone must not skip — user confirms via Next / upload / AI.
      if (valid && (confirmed || laterAnswered)) {
        stepIndex = i + 1
        continue
      }
      stepIndex = i
      break
    }
    if (val?.trim()) {
      stepIndex = i + 1
      continue
    }
    stepIndex = i
    break
  }

  if (stepIndex >= keys.length) {
    return {
      ...journal,
      pageKey: normalizePartnerWebsitePageKey(journal.pageKey),
      answers,
      entries,
      stepIndex: keys.length,
      phase: journal.phase === 'discovery' ? 'mockup' : journal.phase,
    }
  }

  return {
    ...journal,
    pageKey: normalizePartnerWebsitePageKey(journal.pageKey),
    answers,
    entries,
    stepIndex,
    phase: 'discovery',
  }
}

export function normalizeCreationJournal(
  raw: unknown,
  opts?: { websiteBuilt?: boolean; defaultBrandName?: string; pageKey?: string; locale?: WebLocale }
): PartnerWebsiteCreationJournal {
  const locale = opts?.locale ?? 'vi'
  if (!raw || typeof raw !== 'object') {
    if (opts?.websiteBuilt) {
      return {
        ...createEmptyCreationJournal({
          defaultBrandName: opts.defaultBrandName,
          pageKey: opts.pageKey,
          locale,
        }),
        phase: 'built',
        stepIndex: discoveryKeysForPage(opts.pageKey ?? 'home').length,
      }
    }
    return createEmptyCreationJournal({
      defaultBrandName: opts?.defaultBrandName,
      pageKey: opts?.pageKey,
      locale,
    })
  }
  const o = raw as Record<string, unknown>
  const base = createEmptyCreationJournal({
    defaultBrandName: opts?.defaultBrandName,
    pageKey:
      typeof o.pageKey === 'string'
        ? o.pageKey
        : opts?.pageKey || PARTNER_WEBSITE_DEFAULT_PAGE_KEY,
    locale,
  })
  const keys = discoveryKeysForPage(base.pageKey)
  const phase =
    o.phase === 'discovery' || o.phase === 'mockup' || o.phase === 'built' ? o.phase : base.phase
  const stepIndex =
    typeof o.stepIndex === 'number' && o.stepIndex >= 0
      ? Math.min(o.stepIndex, keys.length)
      : base.stepIndex
  const answers: PartnerWebsiteStudioAnswers = { ...base.answers }
  if (o.answers && typeof o.answers === 'object') {
    for (const [k, v] of Object.entries(o.answers as Record<string, unknown>)) {
      if (isStepKey(k) && typeof v === 'string') answers[k] = v
    }
  }
  const entries: PartnerWebsiteJournalEntry[] = []
  if (Array.isArray(o.entries)) {
    for (const item of o.entries) {
      if (!item || typeof item !== 'object') continue
      const e = item as Record<string, unknown>
      const content = typeof e.content === 'string' ? e.content.trim() : ''
      if (!content) continue
      const kind = e.kind as PartnerWebsiteJournalEntryKind
      if (
        kind !== 'question' &&
        kind !== 'answer' &&
        kind !== 'mockup_generated' &&
        kind !== 'mockup_approved' &&
        kind !== 'analyze_done' &&
        kind !== 'build_progress' &&
        kind !== 'section_built' &&
        kind !== 'site_built' &&
        kind !== 'edit_request' &&
        kind !== 'edit_result'
      ) {
        continue
      }
      entries.push({
        id: typeof e.id === 'string' ? e.id : newEntryId(),
        pageKey:
          typeof e.pageKey === 'string'
            ? normalizePartnerWebsitePageKey(e.pageKey)
            : base.pageKey,
        kind,
        stepKey: typeof e.stepKey === 'string' && isStepKey(e.stepKey) ? e.stepKey : undefined,
        role: e.role === 'user' || e.role === 'assistant' ? e.role : 'system',
        content,
        imageUrl: typeof e.imageUrl === 'string' ? e.imageUrl : null,
        suggestions: Array.isArray(e.suggestions)
          ? e.suggestions.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          : undefined,
        createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
      })
    }
  }
  const mockupSpec = normalizePartnerWebsiteMockupUiSpec(o.mockupSpec)
  let buildArtifacts: PartnerWebsiteBuildArtifacts | null = null
  if (o.buildArtifacts && typeof o.buildArtifacts === 'object') {
    const ba = o.buildArtifacts as Record<string, unknown>
    buildArtifacts = {
      contentJson: typeof ba.contentJson === 'string' ? ba.contentJson : undefined,
      sectionImages:
        ba.sectionImages && typeof ba.sectionImages === 'object'
          ? Object.fromEntries(
              Object.entries(ba.sectionImages as Record<string, unknown>).filter(
                (row): row is [string, string] => typeof row[1] === 'string' && Boolean(row[1].trim())
              )
            )
          : undefined,
      approvedMockupUrl:
        typeof ba.approvedMockupUrl === 'string' ? ba.approvedMockupUrl : undefined,
      builtSectionIds: Array.isArray(ba.builtSectionIds)
        ? ba.builtSectionIds.filter((x): x is string => typeof x === 'string')
        : undefined,
      siteSlug: typeof ba.siteSlug === 'string' ? ba.siteSlug : undefined,
      chatPath: typeof ba.chatPath === 'string' ? ba.chatPath : undefined,
      title: typeof ba.title === 'string' ? ba.title : undefined,
    }
  }

  const normalized: PartnerWebsiteCreationJournal = {
    version: 1,
    pageKey: base.pageKey,
    phase: opts?.websiteBuilt && !entries.length && phase !== 'mockup' ? 'built' : phase,
    stepIndex,
    answers,
    mockupUrl: typeof o.mockupUrl === 'string' ? o.mockupUrl : null,
    approvedMockupUrl: typeof o.approvedMockupUrl === 'string' ? o.approvedMockupUrl : null,
    mockupSpec,
    buildArtifacts,
    entries,
  }
  return coerceJournalToWebStudioFlow(normalized, locale)
}

export function createEmptyJournalsBag(input?: {
  defaultBrandName?: string
  locale?: WebLocale
  activePageKey?: string
}): PartnerWebsiteCreationJournalsV2 {
  const activePageKey = normalizePartnerWebsitePageKey(input?.activePageKey)
  return {
    version: 2,
    activePageKey,
    journals: {},
  }
}

export function normalizeCreationJournals(
  raw: unknown,
  opts?: { websiteBuilt?: boolean; defaultBrandName?: string; locale?: WebLocale }
): PartnerWebsiteCreationJournalsV2 {
  const locale = opts?.locale ?? 'vi'
  if (!raw || typeof raw !== 'object') {
    return createEmptyJournalsBag({
      defaultBrandName: opts?.defaultBrandName,
      locale,
    })
  }
  const o = raw as Record<string, unknown>
  if (o.version === 2 && o.journals && typeof o.journals === 'object') {
    const journals: PartnerWebsiteCreationJournalsV2['journals'] = {}
    for (const [k, v] of Object.entries(o.journals as Record<string, unknown>)) {
      const pageKey = normalizePartnerWebsitePageKey(k)
      journals[pageKey] = normalizeCreationJournal(v, {
        defaultBrandName: opts?.defaultBrandName,
        pageKey,
        locale,
        websiteBuilt: opts?.websiteBuilt && pageKey === 'home',
      })
    }
    return {
      version: 2,
      activePageKey: normalizePartnerWebsitePageKey(
        typeof o.activePageKey === 'string' ? o.activePageKey : 'home'
      ),
      journals,
    }
  }
  // Legacy single journal blob
  const single = normalizeCreationJournal(raw, {
    websiteBuilt: opts?.websiteBuilt,
    defaultBrandName: opts?.defaultBrandName,
    locale,
  })
  return {
    version: 2,
    activePageKey: normalizePartnerWebsitePageKey(single.pageKey),
    journals: { [normalizePartnerWebsitePageKey(single.pageKey)]: single },
  }
}

export function getJournalFromBag(
  bag: PartnerWebsiteCreationJournalsV2,
  pageKey: string
): PartnerWebsiteCreationJournal | null {
  const key = normalizePartnerWebsitePageKey(pageKey)
  return bag.journals[key] ?? null
}

export function upsertJournalInBag(
  bag: PartnerWebsiteCreationJournalsV2,
  journal: PartnerWebsiteCreationJournal
): PartnerWebsiteCreationJournalsV2 {
  const pageKey = normalizePartnerWebsitePageKey(journal.pageKey)
  return {
    version: 2,
    activePageKey: pageKey,
    journals: {
      ...bag.journals,
      [pageKey]: { ...journal, pageKey },
    },
  }
}

export function activeJournalFromBag(
  bag: PartnerWebsiteCreationJournalsV2
): PartnerWebsiteCreationJournal | null {
  return getJournalFromBag(bag, bag.activePageKey)
}

/** For PartnerWebsiteRow.creationJournal — active page journal (compat). */
export function primaryJournalFromRaw(
  raw: unknown,
  opts?: { websiteBuilt?: boolean; defaultBrandName?: string; locale?: WebLocale }
): PartnerWebsiteCreationJournal {
  const bag = normalizeCreationJournals(raw, opts)
  return (
    activeJournalFromBag(bag) ??
    createEmptyCreationJournal({
      defaultBrandName: opts?.defaultBrandName,
      pageKey: bag.activePageKey,
      locale: opts?.locale,
    })
  )
}

export function isCreationInProgress(journal: PartnerWebsiteCreationJournal): boolean {
  return journal.phase === 'discovery' || journal.phase === 'mockup'
}

/**
 * Skip AI discovery interview — jump home journal to template-pick phase with brand/logo filled.
 */
export function coerceJournalToTemplateSetup(
  journal: PartnerWebsiteCreationJournal,
  input: { brandName?: string; logoUrl?: string | null; promptText?: string }
): PartnerWebsiteCreationJournal {
  if (journal.phase === 'built') return journal
  const brand =
    journal.answers.brand_name?.trim() ||
    input.brandName?.trim() ||
    ''
  const logo =
    journal.answers.logo_url?.trim() ||
    (input.logoUrl && /^https?:\/\//i.test(input.logoUrl.trim()) ? input.logoUrl.trim() : '') ||
    ''
  const keys = discoveryKeysForJournal(journal)
  let next: PartnerWebsiteCreationJournal = {
    ...journal,
    pageKey: normalizePartnerWebsitePageKey(journal.pageKey),
    phase: 'mockup',
    stepIndex: keys.length,
    answers: {
      ...journal.answers,
      site_type: journal.answers.site_type || partnerWebsiteStudioWebShopAnswer('vi'),
      ...(brand ? { brand_name: brand } : {}),
      ...(logo ? { logo_url: logo } : {}),
    },
    mockupSpec: null,
    buildArtifacts: null,
  }
  const hasPrompt = next.entries.some(
    (e) => e.kind === 'question' && e.role === 'system' && e.content.includes('mẫu')
  )
  if (!hasPrompt && input.promptText?.trim()) {
    next = appendJournalEntry(next, {
      kind: 'question',
      role: 'system',
      content: input.promptText.trim(),
      suggestions: [],
    })
  }
  return next
}

export function isHomePageBuilt(bag: PartnerWebsiteCreationJournalsV2): boolean {
  return bag.journals.home?.phase === 'built'
}

export function currentDiscoveryStepKey(
  journal: PartnerWebsiteCreationJournal
): PartnerWebsiteStudioStepKey | null {
  if (journal.phase !== 'discovery') return null
  const keys = discoveryKeysForJournal(journal)
  return keys[journal.stepIndex] ?? null
}

export function appendJournalEntry(
  journal: PartnerWebsiteCreationJournal,
  entry: Omit<PartnerWebsiteJournalEntry, 'id' | 'createdAt' | 'pageKey'> & {
    id?: string
    createdAt?: string
    pageKey?: string
  }
): PartnerWebsiteCreationJournal {
  const next: PartnerWebsiteJournalEntry = {
    id: entry.id ?? newEntryId(),
    pageKey: entry.pageKey ?? journal.pageKey,
    kind: entry.kind,
    stepKey: entry.stepKey,
    role: entry.role,
    content: entry.content.trim(),
    imageUrl: entry.imageUrl ?? null,
    suggestions: entry.suggestions?.length ? entry.suggestions : undefined,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }
  return { ...journal, entries: [...journal.entries, next] }
}

export function ensureQuestionEntryForStep(
  journal: PartnerWebsiteCreationJournal,
  stepKey: PartnerWebsiteStudioStepKey,
  questionText: string,
  locale: WebLocale
): PartnerWebsiteCreationJournal {
  const exists = journal.entries.some(
    (e) => e.kind === 'question' && e.stepKey === stepKey && e.role === 'system'
  )
  if (exists) return journal
  const suggestions =
    stepKey === 'site_features'
      ? defaultFeatureSuggestions(journal.pageKey, locale)
      : studioStepSuggestions(locale, stepKey)
  return appendJournalEntry(journal, {
    kind: 'question',
    stepKey,
    role: 'system',
    content: questionText,
    suggestions,
  })
}

export function listMockupVersionsFromJournal(
  journal: PartnerWebsiteCreationJournal
): Array<{ url: string; createdAt: string; entryId: string }> {
  const seen = new Set<string>()
  const out: Array<{ url: string; createdAt: string; entryId: string }> = []
  for (const entry of journal.entries) {
    if (entry.kind !== 'mockup_generated') continue
    const url = entry.imageUrl?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ url, createdAt: entry.createdAt, entryId: entry.id })
  }
  const latest = journal.mockupUrl?.trim()
  if (latest && !seen.has(latest)) {
    out.push({ url: latest, createdAt: '', entryId: 'latest' })
  }
  return out
}

export function editSuggestionsForJournal(
  journal: PartnerWebsiteCreationJournal,
  t: PartnerWebsiteCopy,
  opts?: {
    locale?: WebLocale
    industryKey?: PartnerIndustryKey
    capabilities?: PartnerCapabilities | null
  }
): string[] {
  return getPartnerWebsiteEditSuggestions({
    locale: opts?.locale ?? 'vi',
    t,
    industryKey: opts?.industryKey ?? 'fashion',
    capabilities: opts?.capabilities ?? null,
    phase: journal.phase === 'built' ? 'built' : 'other',
  })
}
