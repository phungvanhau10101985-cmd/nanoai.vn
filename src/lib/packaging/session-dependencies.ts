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
  'face_top',
  'body_strip',
  'face_bottom',
  'box_mockup_3d',
  'box_dieline_pdf',
  'product_label',
  'seal_sticker',
  'barcode_label',
] as const

const LEGACY_PACKAGING_DEPENDENCY_ORDER = [
  'logo',
  ...HUB_PACKAGING_FACE_STEP_KEYS,
  'face_lxw',
  'face_lxh',
  'face_wxh',
  'box_mockup_3d',
  'box_dieline_pdf',
  'product_label',
  'seal_sticker',
  'barcode_label',
] as const

export function invalidatePackagingFromStep(
  session: HubStudioSession,
  stepKey: string
): HubStudioSession {
  if (session.presetId !== 'packaging_kit') return session
  const order: readonly string[] =
    session.packaging?.layout === 'hybrid_strip'
      ? PACKAGING_DEPENDENCY_ORDER
      : LEGACY_PACKAGING_DEPENDENCY_ORDER
  const start = order.indexOf(stepKey)
  if (start < 0) return session
  const hybridArtworkSteps = new Set(['face_top', 'body_strip', 'face_bottom'])
  const invalidKeys =
    session.packaging?.layout === 'hybrid_strip' && hybridArtworkSteps.has(stepKey)
      ? new Set<string>([
          stepKey,
          ...order.slice(order.indexOf('box_mockup_3d')),
        ])
      : new Set<string>(order.slice(start))
  const packaging = session.packaging
  const faceSlots = { ...(packaging?.faceSlots ?? {}) }
  if (invalidKeys.has('body_strip')) {
    delete faceSlots.front
    delete faceSlots.right
    delete faceSlots.back
    delete faceSlots.left
  }
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
        bodyStrip: invalidKeys.has('body_strip') ? undefined : packaging.bodyStrip,
        faces,
        dielineUrl: start <= order.indexOf('box_dieline_pdf')
          ? undefined
          : packaging.dielineUrl,
        mockupUrl: start <= order.indexOf('box_mockup_3d')
          ? undefined
          : packaging.mockupUrl,
        barcodeUrl: start <= order.indexOf('barcode_label')
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
