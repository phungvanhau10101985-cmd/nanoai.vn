import type { WebLocale } from '@/lib/i18n/config'
import {
  allDiscoveryDone,
  buildStepsFromPreset,
  getFlowSteps,
  getPresetKickoff,
  getStepAskPrompt,
  isDiscoveryStep,
  presetTitle,
  STUDIO_PRESETS,
} from '@/lib/hub-chat/hub-studio-presets'
import { isNavigatedBackEdit } from '@/lib/hub-chat/hub-studio-step-navigate'
import type { HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { parseBoxDimensions } from '@/lib/packaging/dimensions'

export function isValidStudioPresetId(presetId: string | null | undefined): boolean {
  const id = String(presetId ?? '').trim()
  return Boolean(id && STUDIO_PRESETS.some((p) => p.id === id))
}

/** Rich preset list for Studio brain — AI picks suggestedPresetId from this catalog. */
export function buildPresetCatalogForBrain(locale: WebLocale): string {
  return STUDIO_PRESETS.map((p) => {
    const title = presetTitle(locale, p.id)
    const upload = p.needsUpload ? ' | needs_upload=true' : ''
    return `${p.id}: ${title}${upload}`
  }).join('\n')
}

export function firstIncompleteStepKey(steps: HubStudioProcessStep[]): string | null {
  return steps.find((s) => s.status !== 'done')?.key ?? null
}

export function getActiveStepKey(session: HubStudioSession | null | undefined): string | null {
  if (!session) return null
  const steps = Array.isArray(session.processSteps) ? session.processSteps : []
  if (!steps.length) return session.currentStepKey ?? null
  if (session.currentStepKey) {
    const current = steps.find((s) => s.key === session.currentStepKey)
    if (current && current.status !== 'done') return session.currentStepKey
  }
  return (
    steps.find((s) => s.status === 'in_progress')?.key ??
    firstIncompleteStepKey(steps)
  )
}

/** Removed from flow — print content is collected per face at design time. */
const OBSOLETE_PACKAGING_STEP_KEYS = new Set(['print_content'])

function stripObsoletePackagingSteps(session: HubStudioSession): HubStudioSession {
  if (session.presetId !== 'packaging_kit') return session
  const filtered = session.processSteps.filter((s) => !OBSOLETE_PACKAGING_STEP_KEYS.has(s.key))
  if (filtered.length === session.processSteps.length) return session
  const currentKey =
    session.currentStepKey && OBSOLETE_PACKAGING_STEP_KEYS.has(session.currentStepKey)
      ? null
      : session.currentStepKey
  return { ...session, processSteps: filtered, currentStepKey: currentKey }
}

const PACKAGING_BOX_SIZE_KEYS = ['box_size', 'box_size_length', 'box_size_width', 'box_size_height'] as const

function markDiscoveryStepDone(steps: HubStudioProcessStep[], key: string): HubStudioProcessStep[] {
  return steps.map((s) => (s.key === key ? { ...s, status: 'done' as const } : s))
}

function setDiscoveryStepInProgress(
  steps: HubStudioProcessStep[],
  key: string | null
): HubStudioProcessStep[] {
  if (!key) return steps
  return steps.map((s) => ({
    ...s,
    status: s.key === key ? 'in_progress' : s.status === 'done' ? 'done' : 'pending',
  }))
}

function hasSubstantiveBriefValue(value: string | undefined): boolean {
  return (value?.trim().length ?? 0) >= 2
}

/** Preset title / chip label is not a valid brand brief answer. */
export function isPresetTitleEcho(
  locale: WebLocale,
  presetId: string,
  value: string | undefined
): boolean {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return false
  return trimmed === presetTitle(locale, presetId).trim()
}

function shouldSkipDiscoveryBriefValue(
  session: HubStudioSession,
  stepKey: string,
  value: string | undefined,
  locale?: WebLocale
): boolean {
  if (!hasSubstantiveBriefValue(value)) return true
  if (stepKey === 'brand_name' && session.presetId && locale) {
    return isPresetTitleEcho(locale, session.presetId, value)
  }
  return false
}

function isPackagingBoxSizeStepKey(key: string): boolean {
  return PACKAGING_BOX_SIZE_KEYS.includes(key as (typeof PACKAGING_BOX_SIZE_KEYS)[number])
}

/** Prior packaging brief steps (brand, product type) are done — safe to accept box dimensions. */
export function discoveryReadyForBoxSize(session: HubStudioSession): boolean {
  if (session.presetId !== 'packaging_kit') return false
  const flow = getFlowSteps(session.presetId)
  const boxIdx = flow.findIndex((s) => s.key === 'box_size')
  if (boxIdx < 0) return false
  for (let i = 0; i < boxIdx; i++) {
    const step = flow[i]
    if (step.phase !== 'discovery') continue
    const proc = session.processSteps.find((s) => s.key === step.key)
    if (proc?.status !== 'done') return false
  }
  return true
}

/** Align processSteps with briefNotes when AI omitted completeCurrentStep. */
export function reconcileDiscoveryProgress(
  session: HubStudioSession,
  locale?: WebLocale
): HubStudioSession {
  session = stripObsoletePackagingSteps(session)
  if (!session.presetId || session.discoveryComplete || !session.processSteps.length) {
    return session
  }

  const flow = getFlowSteps(session.presetId)
  let processSteps = session.processSteps
  let changed = false

  for (const stepDef of flow) {
    if (stepDef.phase !== 'discovery') break

    const proc = processSteps.find((s) => s.key === stepDef.key)
    const stepIdx = flow.findIndex((s) => s.key === stepDef.key)

    if (
      proc?.status === 'done' &&
      shouldSkipDiscoveryBriefValue(session, stepDef.key, session.briefNotes[stepDef.key], locale)
    ) {
      processSteps = processSteps.map((s) => {
        const idx = flow.findIndex((f) => f.key === s.key)
        if (s.key === stepDef.key) return { ...s, status: 'in_progress' as const }
        if (idx > stepIdx && flow[idx]?.phase === 'discovery') {
          return { ...s, status: 'pending' as const }
        }
        return s
      })
      changed = true
      break
    }

    if (proc?.status === 'done') continue

    if (session.presetId === 'packaging_kit' && isPackagingBoxSizeStepKey(stepDef.key)) {
      const parsed = parseBoxDimensions(session.briefNotes.box_size ?? '')
      if (parsed.ok) {
        for (const key of PACKAGING_BOX_SIZE_KEYS) {
          if (processSteps.some((s) => s.key === key)) {
            processSteps = markDiscoveryStepDone(processSteps, key)
          }
        }
        changed = true
        continue
      }
      break
    }

    if (stepDef.key === 'box_face_confirm') {
      if (session.packaging?.facesConfirmed && session.packaging?.dimensionsMm) {
        processSteps = markDiscoveryStepDone(processSteps, stepDef.key)
        changed = true
        continue
      }
      break
    }

    if (hasSubstantiveBriefValue(session.briefNotes[stepDef.key])) {
      if (shouldSkipDiscoveryBriefValue(session, stepDef.key, session.briefNotes[stepDef.key], locale)) {
        break
      }
      processSteps = markDiscoveryStepDone(processSteps, stepDef.key)
      changed = true
      continue
    }

    break
  }

  if (!changed) return session

  const discoveryDone = allDiscoveryDone(session.presetId, processSteps)
  const firstPending = firstIncompleteStepKey(processSteps)
  return {
    ...session,
    processSteps: setDiscoveryStepInProgress(processSteps, firstPending),
    currentStepKey: firstPending,
    discoveryComplete: discoveryDone,
  }
}

/** Keep discovery on the first unanswered brief step — AI must not skip ahead. */
export function syncDiscoveryCurrentStep(session: HubStudioSession): HubStudioSession {
  session = stripObsoletePackagingSteps(session)
  if (!session.presetId || session.discoveryComplete || !session.processSteps.length) return session
  if (isNavigatedBackEdit(session, session.presetId)) return session
  const firstPendingKey = firstIncompleteStepKey(session.processSteps)
  if (!firstPendingKey) return session
  if (session.currentStepKey === firstPendingKey) {
    const inProgress = session.processSteps.some(
      (s) => s.key === firstPendingKey && s.status === 'in_progress'
    )
    if (inProgress) return session
  }
  return {
    ...session,
    currentStepKey: firstPendingKey,
    processSteps: session.processSteps.map((s) => ({
      ...s,
      status:
        s.status === 'done'
          ? ('done' as const)
          : s.key === firstPendingKey
            ? ('in_progress' as const)
            : ('pending' as const),
    })),
  }
}

export function applySuggestedPreset(
  session: HubStudioSession,
  locale: WebLocale,
  presetId: string
): HubStudioSession {
  const id = String(presetId).trim()
  if (!isValidStudioPresetId(id) || session.presetId || session.processSteps.length) {
    return session
  }
  const steps = buildStepsFromPreset(locale, id)
  return {
    ...session,
    presetId: id,
    projectTitle: session.projectTitle || presetTitle(locale, id),
    processSteps: steps,
    currentStepKey: steps[0]?.key ?? null,
    discoveryComplete: false,
    briefNotes: {},
    packaging:
      id === 'packaging_kit'
        ? { version: 2, dimensionsMm: null, faces: {} }
        : session.packaging,
  }
}

export function appendPresetKickoffIfNeeded(
  reply: string,
  locale: WebLocale,
  presetId: string,
  justStarted: boolean
): string {
  if (!justStarted) return reply
  const kickoff = getPresetKickoff(locale, presetId)
  if (reply.includes(presetTitle(locale, presetId))) return reply
  return `${reply}\n\n${kickoff}`
}

export function appendFirstStepAsk(
  reply: string,
  locale: WebLocale,
  presetId: string,
  stepKey: string | null
): string {
  if (!stepKey) return reply
  const ask = getStepAskPrompt(locale, presetId, stepKey)
  if (!ask || reply.includes(ask)) return reply
  return `${reply}\n\n${ask}`
}

export function appendCurrentDiscoveryAsk(
  reply: string,
  locale: WebLocale,
  session: HubStudioSession
): string {
  if (!session.presetId || session.discoveryComplete) return reply
  const stepKey = getActiveStepKey(session)
  if (!stepKey || !isDiscoveryStep(session.presetId, stepKey)) return reply
  return appendFirstStepAsk(reply, locale, session.presetId, stepKey)
}
