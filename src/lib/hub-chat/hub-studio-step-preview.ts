import { getFlowSteps } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { packagingStepKeyToSlot } from '@/lib/packaging/hub-face-steps'
import { resolveMockupSlotUrl } from '@/lib/packaging/box-face-slots'

function stepLabelFromSession(session: HubStudioSession, stepKey: string): string {
  return session.processSteps.find((s) => s.key === stepKey)?.label ?? stepKey
}

/** Restore pending preview when user navigates back to a step that already has output. */
export function resolveStepPendingPreview(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): HubStudioSession['pendingPreview'] {
  if (session.pendingPreview?.screenKey === stepKey) return session.pendingPreview

  const ref = session.referenceImages.find((r) => r.screenKey === stepKey)
  if (ref?.url) {
    return {
      screenKey: stepKey,
      screenLabel: ref.screenLabel,
      url: ref.url,
      generationPrompt:
        session.briefNotes[stepKey]?.trim() ||
        session.lastGenerationPrompt?.trim() ||
        ref.screenLabel,
    }
  }

  if (presetId !== 'packaging_kit') return null

  const packaging = session.packaging
  const label = stepLabelFromSession(session, stepKey)
  const prompt =
    session.briefNotes[stepKey]?.trim() ||
    session.lastGenerationPrompt?.trim() ||
    label

  const slot = packagingStepKeyToSlot(stepKey)
  const faceUrl =
    slot && packaging?.faceSlots
      ? resolveMockupSlotUrl(slot, packaging.faceSlots)
      : null
  if (slot && faceUrl) {
    return {
      screenKey: stepKey,
      screenLabel: label,
      url: faceUrl,
      generationPrompt: prompt,
    }
  }

  if (stepKey === 'box_mockup_3d' && packaging?.mockupUrl) {
    return {
      screenKey: stepKey,
      screenLabel: label,
      url: packaging.mockupUrl,
      generationPrompt: prompt,
    }
  }

  if (stepKey === 'barcode_label' && packaging?.barcodeUrl) {
    return {
      screenKey: stepKey,
      screenLabel: label,
      url: packaging.barcodeUrl,
      generationPrompt: prompt,
    }
  }

  return null
}

export function flowStepIndex(presetId: string, stepKey: string): number {
  return getFlowSteps(presetId).findIndex((s) => s.key === stepKey)
}

export function isStepAtOrBefore(presetId: string, stepKey: string, maxStepKey: string | null | undefined): boolean {
  if (!maxStepKey) return true
  const a = flowStepIndex(presetId, stepKey)
  const b = flowStepIndex(presetId, maxStepKey)
  if (a < 0 || b < 0) return false
  return a <= b
}
