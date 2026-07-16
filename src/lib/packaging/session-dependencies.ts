import type { HubStudioSession, HubPackagingState } from '@/lib/hub-chat/hub-studio-types'
import {
  HUB_PACKAGING_FACE_STEP_KEYS,
  isPackagingFaceStepKey,
  packagingStepKeyToSlot,
  syncResolvedPackagingFaces,
} from '@/lib/packaging/hub-face-steps'
import { BOX_FACE_SLOT_ORDER } from '@/lib/packaging/box-face-slots'

export const PACKAGING_DEPENDENCY_ORDER = [
  'logo',
  ...HUB_PACKAGING_FACE_STEP_KEYS,
  'face_lxw',
  'face_lxh',
  'face_wxh',
  'box_dieline_pdf',
  'box_mockup_3d',
  'product_label',
  'seal_sticker',
  'barcode_label',
] as const

export function invalidatePackagingFromStep(
  session: HubStudioSession,
  stepKey: string
): HubStudioSession {
  if (session.presetId !== 'packaging_kit') return session
  const start = PACKAGING_DEPENDENCY_ORDER.indexOf(
    stepKey as (typeof PACKAGING_DEPENDENCY_ORDER)[number]
  )
  if (start < 0) return session
  const invalidKeys = new Set<string>(PACKAGING_DEPENDENCY_ORDER.slice(start))
  const packaging = session.packaging
  const faceSlots = { ...(packaging?.faceSlots ?? {}) }
  for (const slot of BOX_FACE_SLOT_ORDER) {
    if (invalidKeys.has(`face_${slot}`)) delete faceSlots[slot]
  }
  const faces = { ...(packaging?.faces ?? {}) }
  if (invalidKeys.has('face_lxw') || invalidKeys.has('face_top') || invalidKeys.has('face_bottom')) {
    delete faces.LxW
  }
  if (invalidKeys.has('face_lxh') || invalidKeys.has('face_front') || invalidKeys.has('face_back')) {
    delete faces.LxH
  }
  if (invalidKeys.has('face_wxh') || invalidKeys.has('face_right') || invalidKeys.has('face_left')) {
    delete faces.WxH
  }
  let nextPackaging: HubPackagingState | undefined = packaging
    ? {
        ...packaging,
        faceSlots,
        faces,
        dielineUrl: start <= PACKAGING_DEPENDENCY_ORDER.indexOf('box_dieline_pdf')
          ? undefined
          : packaging.dielineUrl,
        mockupUrl: start <= PACKAGING_DEPENDENCY_ORDER.indexOf('box_mockup_3d')
          ? undefined
          : packaging.mockupUrl,
        barcodeUrl: start <= PACKAGING_DEPENDENCY_ORDER.indexOf('barcode_label')
          ? undefined
          : packaging.barcodeUrl,
      }
    : undefined
  if (nextPackaging) {
    if (Object.keys(nextPackaging.faceSlots ?? {}).length > 0) {
      nextPackaging = syncResolvedPackagingFaces(nextPackaging)
    }
  }
  return {
    ...session,
    currentStepKey: stepKey,
    pendingPreview: null,
    lastGenerationPrompt: null,
    referenceImages: session.referenceImages.filter((r) => !invalidKeys.has(r.screenKey)),
    processSteps: session.processSteps.map((step) =>
      invalidKeys.has(step.key)
        ? { ...step, status: step.key === stepKey ? ('in_progress' as const) : ('pending' as const) }
        : step
    ),
    packaging: nextPackaging,
  }
}

export function isPackagingFaceDependencyStep(stepKey: string): boolean {
  return isPackagingFaceStepKey(stepKey) || stepKey === 'face_lxw' || stepKey === 'face_lxh' || stepKey === 'face_wxh'
}

export function packagingFaceSlotFromInvalidation(stepKey: string) {
  return packagingStepKeyToSlot(stepKey)
}
