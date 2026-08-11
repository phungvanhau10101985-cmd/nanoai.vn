import type { WebLocale } from '@/lib/i18n/config'
import { buildStepsFromPreset } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { DESIGN_LANGUAGE_STEP_KEY } from '@/lib/design/design-discovery-choices'

export const DESIGN_RECREATE_LOGO_KEY = 'logo'
export const DESIGN_RECREATE_DESIGN_KEY = 'concept_sheet'
const DESIGN_RECREATE_POST_LOGO_KEYS = new Set([DESIGN_RECREATE_DESIGN_KEY])
/** Legacy multi-image steps removed — single redesign image only. */
const DESIGN_RECREATE_REMOVED_KEYS = new Set(['detail_panel', 'technical_flat'])

/** Align saved design_recreate sessions with the current single-image flow. */
export function reconcileDesignRecreateProcessSteps(
  session: HubStudioSession,
  locale: WebLocale
): HubStudioSession {
  if (session.presetId !== 'design_recreate' || !session.processSteps.length) return session

  const canonical = buildStepsFromPreset(locale, 'design_recreate')
  const byKey = new Map(session.processSteps.map((step) => [step.key, step]))
  const hasLogo = session.processSteps.some((step) => step.key === DESIGN_RECREATE_LOGO_KEY)
  const hasLanguage = session.processSteps.some((step) => step.key === DESIGN_LANGUAGE_STEP_KEY)
  const hasRemoved = session.processSteps.some((step) => DESIGN_RECREATE_REMOVED_KEYS.has(step.key))
  const alreadyAligned =
    hasLogo &&
    hasLanguage &&
    !hasRemoved &&
    session.processSteps.length === canonical.length &&
    session.processSteps.every((step, index) => step.key === canonical[index]?.key)
  if (alreadyAligned) return session

  const logoDone =
    byKey.get(DESIGN_RECREATE_LOGO_KEY)?.status === 'done' ||
    session.referenceImages.some((ref) => ref.screenKey === DESIGN_RECREATE_LOGO_KEY)
  const languageDone =
    Boolean(session.briefNotes[DESIGN_LANGUAGE_STEP_KEY]?.trim()) ||
    byKey.get(DESIGN_LANGUAGE_STEP_KEY)?.status === 'done'
  const designDone =
    byKey.get(DESIGN_RECREATE_DESIGN_KEY)?.status === 'done' ||
    [...DESIGN_RECREATE_REMOVED_KEYS].some((key) => byKey.get(key)?.status === 'done')
  const needsLogoNow = Boolean(session.discoveryComplete && !logoDone)
  const needsLanguageNow = Boolean(
    !session.discoveryComplete &&
      !languageDone &&
      byKey.get('design_notes')?.status === 'done' &&
      !needsLogoNow
  )

  const processSteps: HubStudioProcessStep[] = canonical.map((step) => {
    if (step.key === DESIGN_LANGUAGE_STEP_KEY) {
      return {
        ...step,
        status: languageDone ? 'done' : needsLanguageNow ? 'in_progress' : 'pending',
      }
    }
    if (step.key === DESIGN_RECREATE_LOGO_KEY) {
      return {
        ...step,
        status: logoDone ? 'done' : needsLogoNow ? 'in_progress' : 'pending',
      }
    }
    if (step.key === DESIGN_RECREATE_DESIGN_KEY) {
      const prev = byKey.get(DESIGN_RECREATE_DESIGN_KEY)
      if (designDone) return { ...step, status: 'done' }
      if (needsLogoNow || needsLanguageNow) return { ...step, status: 'pending' }
      if (prev?.status === 'in_progress') return { ...prev, label: step.label }
      if (
        session.currentStepKey &&
        DESIGN_RECREATE_REMOVED_KEYS.has(session.currentStepKey) &&
        logoDone
      ) {
        return { ...step, status: 'in_progress' }
      }
      return prev ? { ...prev, label: step.label } : step
    }
    const prev = byKey.get(step.key)
    if (!prev) return step
    if (needsLogoNow && DESIGN_RECREATE_POST_LOGO_KEYS.has(step.key) && prev.status === 'in_progress') {
      return { ...prev, label: step.label, status: 'pending' }
    }
    return { ...prev, label: step.label }
  })

  let currentStepKey = session.currentStepKey
  if (needsLogoNow) currentStepKey = DESIGN_RECREATE_LOGO_KEY
  else if (needsLanguageNow) currentStepKey = DESIGN_LANGUAGE_STEP_KEY
  else if (currentStepKey && DESIGN_RECREATE_REMOVED_KEYS.has(currentStepKey)) {
    currentStepKey = logoDone ? DESIGN_RECREATE_DESIGN_KEY : DESIGN_RECREATE_LOGO_KEY
  }

  return {
    ...session,
    processSteps,
    currentStepKey,
  }
}
