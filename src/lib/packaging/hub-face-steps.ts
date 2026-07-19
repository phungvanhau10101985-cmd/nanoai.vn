import type { HubPackagingState, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { PackagingFaceKey } from './dimensions'
import { getFaceDimensionsMm, normalizeBoxDimensionsMm } from './dimensions'
import {
  type BoxFaceSlot,
  type BoxCreatedFace,
  type FaceSourceMode,
  BOX_FACE_COPY_SOURCE,
  BOX_FACE_SLOT_ORDER,
  getSizeKeyForSlot,
  isSecondaryBoxFaceSlot,
  resolveBoxFaceUrl,
  resolveDielineFaceUrls,
  resolveMockupSlotUrl,
} from './box-face-slots'
import { getBodyStripSizeMm } from './body-strip'

/** Hub studio step keys — thứ tự: trên → trước → phải → dưới → sau → trái */
export const HUB_PACKAGING_FACE_STEP_KEYS = [
  'face_top',
  'face_front',
  'face_right',
  'face_bottom',
  'face_back',
  'face_left',
] as const

export type HubPackagingFaceStepKey = (typeof HUB_PACKAGING_FACE_STEP_KEYS)[number]

export function isFirstPackagingFaceStep(stepKey: string | null | undefined): boolean {
  return stepKey === HUB_PACKAGING_FACE_STEP_KEYS[0]
}

export function getPrimaryPackagingStyleFaceStepKey(): HubPackagingFaceStepKey {
  return HUB_PACKAGING_FACE_STEP_KEYS[0]
}

/** Approved face artwork URL — from referenceImages or committed faceSlots. */
export function resolvePackagingFaceReferenceUrl(
  session: HubStudioSession,
  stepKey: string
): string | null {
  const ref = session.referenceImages.find((r) => r.screenKey === stepKey)
  if (ref?.url) return ref.url
  const slot = packagingStepKeyToSlot(stepKey)
  if (!slot) return null
  const face = session.packaging?.faceSlots?.[slot]
  if (face?.url && face.sourceMode !== 'empty') return face.url
  return null
}

export function hasApprovedPrimaryPackagingFace(session: HubStudioSession): boolean {
  return Boolean(resolvePackagingFaceReferenceUrl(session, getPrimaryPackagingStyleFaceStepKey()))
}

export const PACKAGING_STYLE_REFERENCE_SCREEN_KEY = 'packaging_style_reference'

/** User-uploaded mood/style board URL (face #1 only). */
export function resolvePackagingStyleReferenceUrl(session: HubStudioSession): string | null {
  const url =
    session.generationSelection?.styleReferenceUrl?.trim() ||
    session.packaging?.styleReferenceUrl?.trim() ||
    ''
  return url || null
}

const LEGACY_STEP_TO_SLOT: Record<string, BoxFaceSlot> = {
  face_lxw: 'top',
  face_lxh: 'front',
  face_wxh: 'right',
}

const STEP_TO_SLOT: Record<string, BoxFaceSlot> = {
  face_top: 'top',
  face_front: 'front',
  face_right: 'right',
  face_bottom: 'bottom',
  face_back: 'back',
  face_left: 'left',
  ...LEGACY_STEP_TO_SLOT,
}

export type HubPackagingFaceSlotEntry = {
  sourceMode: FaceSourceMode
  url?: string
}

export function isPackagingFaceStepKey(stepKey: string): boolean {
  return stepKey === 'body_strip' || stepKey in STEP_TO_SLOT
}

/** Mặt đã từng chốt (ảnh / bỏ trống / sao chép) — sửa lại không đi tiếp flow mặt mới. */
export function isPackagingFaceReEdit(session: HubStudioSession, stepKey: string): boolean {
  if (session.presetId !== 'packaging_kit') return false
  if (!isPackagingFaceStepKey(stepKey)) return false
  if (session.referenceImages.some((reference) => reference.screenKey === stepKey)) return true
  if (stepKey === 'body_strip') {
    return Boolean(session.packaging?.bodyStrip?.originalUrl)
  }
  const slot = packagingStepKeyToSlot(stepKey)
  if (!slot) return false
  return session.packaging?.faceSlots?.[slot] != null
}

export function packagingStepKeyToSlot(stepKey: string): BoxFaceSlot | null {
  return STEP_TO_SLOT[stepKey] ?? null
}

export function packagingStepKeyToSizeKey(stepKey: string): PackagingFaceKey | null {
  const slot = packagingStepKeyToSlot(stepKey)
  return slot ? getSizeKeyForSlot(slot) : null
}

export function hubFaceStepKeyForSlot(slot: BoxFaceSlot): HubPackagingFaceStepKey {
  return `face_${slot}` as HubPackagingFaceStepKey
}

export function faceSlotsToCreatedFaces(
  faceSlots: Partial<Record<BoxFaceSlot, HubPackagingFaceSlotEntry>>
): BoxCreatedFace[] {
  return BOX_FACE_SLOT_ORDER.filter((slot) => faceSlots[slot]).map((slot) => {
    const entry = faceSlots[slot]!
    return {
      id: slot,
      slot,
      sizeKey: getSizeKeyForSlot(slot),
      sourceMode: entry.sourceMode,
      url: entry.url ?? null,
    }
  })
}

export function syncResolvedPackagingFaces(packaging: HubPackagingState): HubPackagingState {
  const faceSlots = packaging.faceSlots ?? {}
  const created = faceSlotsToCreatedFaces(faceSlots)
  const resolved = resolveDielineFaceUrls(created)
  const faces: Partial<Record<PackagingFaceKey, string>> = {}
  if (resolved.LxW) faces.LxW = resolved.LxW
  if (resolved.LxH) faces.LxH = resolved.LxH
  if (resolved.WxH) faces.WxH = resolved.WxH
  return { ...packaging, faces }
}

export function allHubPackagingFaceStepsFilled(packaging: HubPackagingState | undefined): boolean {
  if (!packaging?.faceSlots) return false
  return BOX_FACE_SLOT_ORDER.every((slot) => packaging.faceSlots![slot])
}

/** Mặt đã chốt (tạo ảnh, sao chép, hoặc bỏ trống) — không cần referenceImages. */
export function isPackagingFaceStepCommitted(
  packaging: HubPackagingState | undefined,
  stepKey: string
): boolean {
  if (stepKey === 'body_strip') {
    return Boolean(
      packaging?.bodyStrip?.originalUrl &&
      packaging.faceSlots?.front &&
      packaging.faceSlots?.right &&
      packaging.faceSlots?.back &&
      packaging.faceSlots?.left
    )
  }
  const slot = packagingStepKeyToSlot(stepKey)
  if (!slot || !packaging?.faceSlots) return false
  return packaging.faceSlots[slot] != null
}

/** Gom ảnh từng mặt hộp (không logo) — mỗi vị trí giữ đúng ảnh đã tạo. */
export function preparePackagingFaceSlotsForArtifact(input: {
  packaging: HubPackagingState | undefined
  referenceImages: { screenKey: string; url: string }[]
  processSteps: { key: string; status: string }[]
}): HubPackagingState {
  const packaging = input.packaging ?? { version: 2 as const, dimensionsMm: null, faces: {} }
  const faceSlots: Partial<Record<BoxFaceSlot, HubPackagingFaceSlotEntry>> = {
    ...(packaging.faceSlots ?? {}),
  }

  for (const stepKey of HUB_PACKAGING_FACE_STEP_KEYS) {
    const slot = packagingStepKeyToSlot(stepKey)
    if (!slot) continue
    const ref = input.referenceImages.find((r) => r.screenKey === stepKey)
    if (ref?.url) {
      faceSlots[slot] = { sourceMode: 'generate', url: ref.url }
    }
  }

  for (const stepKey of HUB_PACKAGING_FACE_STEP_KEYS) {
    const slot = packagingStepKeyToSlot(stepKey)
    if (!slot || faceSlots[slot]) continue
    const proc = input.processSteps.find((s) => s.key === stepKey)
    if (proc?.status === 'done' || proc?.status === 'skipped') {
      faceSlots[slot] = { sourceMode: 'empty' }
    }
  }

  return syncResolvedPackagingFaces({ ...packaging, faceSlots })
}

export function faceSlotsToMockupFaces(
  faceSlots: Partial<Record<BoxFaceSlot, HubPackagingFaceSlotEntry>>
): Pick<BoxCreatedFace, 'slot' | 'url' | 'sourceMode'>[] {
  return BOX_FACE_SLOT_ORDER.map((slot) => {
    const entry = faceSlots[slot]
    const sourceMode = entry?.sourceMode ?? 'empty'
    return {
      slot,
      sourceMode,
      url: sourceMode === 'empty' ? null : (entry?.url ?? null),
    }
  })
}

/** All six face slots committed (generate, copy, or empty). */
export function allPackagingFaceSlotsCommitted(packaging: HubPackagingState | undefined): boolean {
  if (!packaging?.faceSlots) return false
  return BOX_FACE_SLOT_ORDER.every((slot) => packaging.faceSlots![slot] != null)
}

export function resolvedPackagingFacesReady(packaging: HubPackagingState | undefined): boolean {
  if (!packaging) return false
  const created = faceSlotsToCreatedFaces(packaging.faceSlots ?? {})
  const resolved = resolveDielineFaceUrls(created)
  return Boolean(resolved.LxW && resolved.LxH && resolved.WxH)
}

/** Mockup: URL theo từng slot; mặt copy dùng ảnh của mặt nguồn, không dùng logo. */
export function resolveMockupFaceUrls(packaging: HubPackagingState): Partial<Record<BoxFaceSlot, string>> {
  const faceSlots = packaging.faceSlots ?? {}
  const out: Partial<Record<BoxFaceSlot, string>> = {}
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const url = resolveMockupSlotUrl(slot, faceSlots)
    if (url) out[slot] = url
  }
  return out
}

const EMPTY_PATTERNS =
  /\b(bỏ trống|bo trong|để trống|de trong|blank|empty|không in|khong in|no print|leave blank)\b/i
const COPY_PATTERNS =
  /\b(giống|giong|same as|copy|dùng giống|dung giong|như mặt|nhu mat|giống mặt|giong mat)\b/i

export function parseSecondaryFaceIntent(message: string, slot: BoxFaceSlot): FaceSourceMode | null {
  const trimmed = message.trim()
  if (!trimmed) return null
  if (EMPTY_PATTERNS.test(trimmed)) return 'empty'
  if (isSecondaryBoxFaceSlot(slot) && COPY_PATTERNS.test(trimmed)) return 'copy'
  return null
}

export function getPackagingFaceSizeForStep(
  dimensionsMm: { length: number; width: number; height: number } | null | undefined,
  stepKey: string
): { widthMm: number; heightMm: number } | null {
  const box = normalizeBoxDimensionsMm(dimensionsMm)
  if (!box) return null
  if (stepKey === 'body_strip') return getBodyStripSizeMm(box)
  const faceKey = packagingStepKeyToSizeKey(stepKey)
  if (!faceKey) return null
  const [widthMm, heightMm] = getFaceDimensionsMm(faceKey, box)
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return null
  }
  return { widthMm, heightMm }
}

export function copySourceUrlForSlot(
  packaging: HubPackagingState,
  slot: BoxFaceSlot
): string | null {
  const copyFrom = BOX_FACE_COPY_SOURCE[slot]
  if (!copyFrom) return null
  const created = faceSlotsToCreatedFaces(packaging.faceSlots ?? {})
  return resolveBoxFaceUrl(copyFrom, created)
}
