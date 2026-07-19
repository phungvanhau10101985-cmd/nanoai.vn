import {
  buildHubToolCatalog,
  type HubWorkflowGroup,
} from '@/lib/hub-chat/hub-chat-catalog'
import {
  buildStandaloneWorkflowSuggestion,
  HUB_ADVISORY_EXTRA_TOOLS,
  matchFeatureFlowByMessage,
  type HubFeatureFlowMatch,
  workflowRequiresOpenConfirm,
  type HubFeatureFlowKind,
} from '@/lib/hub-chat/hub-feature-flow-registry'
import {
  pgCreateHubMultiTaskPlan,
  type HubPlanStepInput,
} from '@/lib/db/hub-chat-pg'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export type HubChatWorkflowSuggestion = {
  href: string
  labelKey: string
  label: string
  reason: string
  prefillPrompt: string
  confidence: number
  flowKind?: HubFeatureFlowKind
  requiresOpenConfirm?: boolean
  studioPresetId?: string
}

export type HubChatPlanPayload = {
  id: string
  title: string
  steps: {
    stepIndex: number
    href: string
    labelKey: string
    label: string
    prefillPrompt: string
    reason: string
    status: string
  }[]
}

export type HubRouteKind = 'design' | 'consultation' | 'workflow' | 'pipeline'

export function normalizeHubRoute(raw: unknown): HubRouteKind {
  const v = String(raw ?? 'design').trim().toLowerCase()
  if (v === 'consultation' || v === 'workflow' || v === 'pipeline') return v
  return 'design'
}

export function buildToolCatalogForBrain(locale: WebLocale, group: HubWorkflowGroup = 'all') {
  const t = getDictionary(locale)
  const full = buildHubToolCatalog(t.tool, t.navGroup)
  const extraHrefs = new Set(full.map((e) => e.href))
  for (const extra of HUB_ADVISORY_EXTRA_TOOLS) {
    if (extraHrefs.has(extra.href)) continue
    full.push({
      href: extra.href,
      labelKey: extra.labelKey,
      groupKey: 'design_creative',
      label: t.tool[extra.labelKey] ?? extra.labelKey,
      groupLabel: t.navGroup.design_creative ?? 'design_creative',
    })
    extraHrefs.add(extra.href)
  }
  const catalog = group === 'all' ? full : full
  const catalogHrefs = new Set(catalog.map((e) => e.href))
  const catalogJson = JSON.stringify(
    catalog.map((e) => ({
      href: e.href,
      labelKey: e.labelKey,
      label: e.label,
      group: e.groupLabel,
      flow: 'standalone_open_tool',
    }))
  )
  return { catalogJson, catalogHrefs, catalog }
}

export function parseWorkflowSuggestions(
  raw: unknown,
  catalogHrefs: Set<string>
): HubChatWorkflowSuggestion[] {
  if (!Array.isArray(raw)) return []
  const out: HubChatWorkflowSuggestion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const href = String(row.href ?? '').trim()
    if (!href || !catalogHrefs.has(href)) continue
    const confidence = Number(row.confidence)
    out.push({
      href,
      labelKey: String(row.labelKey ?? '').trim(),
      label: String(row.label ?? '').trim(),
      reason: String(row.reason ?? '').trim(),
      prefillPrompt: String(row.prefillPrompt ?? '').trim(),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    })
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 4)
}

export function parsePlanSteps(raw: unknown, catalogHrefs: Set<string>): HubPlanStepInput[] {
  if (!raw || typeof raw !== 'object') return []
  const plan = raw as Record<string, unknown>
  const stepsRaw = plan.steps
  if (!Array.isArray(stepsRaw)) return []
  const out: HubPlanStepInput[] = []
  for (const item of stepsRaw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const href = String(row.href ?? '').trim()
    if (!href || !catalogHrefs.has(href)) continue
    out.push({
      href,
      labelKey: String(row.labelKey ?? '').trim(),
      label: String(row.label ?? '').trim(),
      prefillPrompt: String(row.prefillPrompt ?? '').trim(),
      reason: String(row.reason ?? '').trim(),
    })
  }
  return out.slice(0, 8)
}

export function planToPayload(
  plan: Awaited<ReturnType<typeof pgCreateHubMultiTaskPlan>>
): HubChatPlanPayload | null {
  if (!plan) return null
  return {
    id: plan.id,
    title: plan.title,
    steps: plan.steps.map((s) => ({
      stepIndex: s.stepIndex,
      href: s.href,
      labelKey: s.labelKey,
      label: s.label,
      prefillPrompt: s.prefillPrompt,
      reason: s.reason,
      status: s.status,
    })),
  }
}

export function tagWorkflowFlowMeta(
  workflows: HubChatWorkflowSuggestion[],
  locale: WebLocale
): HubChatWorkflowSuggestion[] {
  return workflows.map((w) => {
    const requiresOpenConfirm = workflowRequiresOpenConfirm(w.href, locale)
    return {
      ...w,
      flowKind: requiresOpenConfirm ? 'standalone' : w.flowKind,
      requiresOpenConfirm: requiresOpenConfirm || w.requiresOpenConfirm,
    }
  })
}

export function buildStandaloneFeatureAdvisoryReply(
  locale: WebLocale,
  match: Extract<HubFeatureFlowMatch, { kind: 'standalone' }>
): string {
  const t = getDictionary(locale).hubChat
  return t.advisoryStandaloneFeatureBody.replace('{feature}', match.label)
}

export async function buildAdvisoryPayload(input: {
  locale: WebLocale
  userId: string
  threadId: string
  message: string
  hubRoute: HubRouteKind
  workflowsRaw: unknown
  planRaw: unknown
}): Promise<{ workflows: HubChatWorkflowSuggestion[]; plan: HubChatPlanPayload | null }> {
  const { catalogHrefs } = buildToolCatalogForBrain(input.locale)
  let workflows = parseWorkflowSuggestions(input.workflowsRaw, catalogHrefs)
  let planSteps = parsePlanSteps(input.planRaw, catalogHrefs)

  if (planSteps.length < 2 && input.hubRoute === 'pipeline' && workflows.length >= 2) {
    planSteps = workflows.map((w) => ({
      href: w.href,
      labelKey: w.labelKey,
      label: w.label,
      prefillPrompt: w.prefillPrompt,
      reason: w.reason,
    }))
  }

  let plan: HubChatPlanPayload | null = null
  if (input.hubRoute === 'pipeline' && planSteps.length >= 2) {
    const planObj = input.planRaw as Record<string, unknown> | undefined
    const planTitle = String(planObj?.title ?? '').trim() || input.message.slice(0, 80)
    const saved = await pgCreateHubMultiTaskPlan({
      userId: input.userId,
      threadId: input.threadId,
      title: planTitle,
      sourcePrompt: input.message,
      locale: input.locale,
      steps: planSteps,
    })
    plan = planToPayload(saved)
  }

  if (input.hubRoute === 'workflow' && !workflows.length && planSteps.length === 1) {
    const s = planSteps[0]!
    workflows = [
      {
        href: s.href,
        labelKey: s.labelKey,
        label: s.label,
        reason: s.reason,
        prefillPrompt: s.prefillPrompt,
        confidence: 0.9,
      },
    ]
  }

  const matched = matchFeatureFlowByMessage(input.message, input.locale)
  if (matched?.kind === 'standalone' && !workflows.some((w) => w.href === matched.href)) {
    workflows = [buildStandaloneWorkflowSuggestion(matched, input.message), ...workflows]
  }

  workflows = tagWorkflowFlowMeta(workflows, input.locale)

  return { workflows, plan }
}
