import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  BAG_FACE_STEP_KEYS,
  getBagFaceDimensionsMm,
  isBagFaceStepKey,
} from '@/lib/packaging/bag-dimensions'

const BAG_STEP_TO_SLOT: Record<string, 'back' | 'front'> = {
  face_back: 'back',
  face_front: 'front',
}

export type BagFaceSlot = 'back' | 'front'

export const BAG_FACE_COPY_SOURCE: Partial<Record<BagFaceSlot, BagFaceSlot>> = {
  front: 'back',
}

export function isBagKitPreset(presetId: string | null | undefined): boolean {
  return presetId === 'bag_kit'
}

export function emptyBagKitState(): NonNullable<HubStudioSession['bagKit']> {
  return { version: 1, dimensionsMm: null, faceSlots: {} }
}

export function bagStepKeyToSlot(stepKey: string): BagFaceSlot | null {
  return BAG_STEP_TO_SLOT[stepKey] ?? null
}

export function isSecondaryBagFaceSlot(slot: BagFaceSlot): boolean {
  return slot === 'front'
}

export function getBagFaceSlotLabel(slot: BagFaceSlot, locale: WebLocale): string {
  const labels: Record<WebLocale, Record<BagFaceSlot, string>> = {
    vi: { back: 'Mặt sau', front: 'Mặt trước' },
    en: { back: 'Back', front: 'Front' },
    zh: { back: '背面', front: '正面' },
    ja: { back: '背面', front: '正面' },
    ko: { back: '뒷면', front: '앞면' },
  }
  return labels[locale][slot]
}

export function resolveBagFacePreviewUrl(
  bagKit: {
    faceSlots?: Partial<Record<BagFaceSlot, { sourceMode: string; url?: string }>>
  } | null
  | undefined,
  slot: BagFaceSlot
): string | null {
  const entry = bagKit?.faceSlots?.[slot]
  if (!entry || entry.sourceMode === 'empty') return null
  if (entry.url?.trim()) return entry.url.trim()
  if (entry.sourceMode === 'copy' && slot === 'front') {
    return bagKit?.faceSlots?.back?.url?.trim() ?? null
  }
  return null
}

export function copySourceUrlForBagSlot(
  bagKit: HubStudioSession['bagKit'],
  slot: BagFaceSlot
): string | null {
  const copyFrom = BAG_FACE_COPY_SOURCE[slot]
  if (!copyFrom) return null
  return resolveBagFacePreviewUrl(bagKit, copyFrom)
}

export function isBagFaceReEdit(session: HubStudioSession, stepKey: string): boolean {
  if (!isBagKitPreset(session.presetId)) return false
  if (!isBagFaceStepKey(stepKey)) return false
  if (session.referenceImages.some((r) => r.screenKey === stepKey)) return true
  const slot = bagStepKeyToSlot(stepKey)
  if (!slot) return false
  return session.bagKit?.faceSlots?.[slot] != null
}

export function isFirstBagFaceStep(stepKey: string | null | undefined): boolean {
  return stepKey === BAG_FACE_STEP_KEYS[0]
}

export function resolveBagFacePrintSizeMm(
  session: HubStudioSession,
  stepKey: string
): { widthMm: number; heightMm: number } | null {
  const dims = getBagFaceDimensionsMm(stepKey, session.bagKit?.dimensionsMm)
  if (!dims) return null
  return { widthMm: dims[0], heightMm: dims[1] }
}

export function allBagPrintFacesCommitted(
  bagKit: {
    faceSlots?: Partial<Record<BagFaceSlot, { sourceMode: string; url?: string }>>
  } | null
  | undefined
): boolean {
  if (!bagKit?.faceSlots) return false
  return (['back', 'front'] as const).every((slot) => {
    const entry = bagKit.faceSlots?.[slot]
    return entry != null && (entry.sourceMode === 'empty' || Boolean(entry.url?.trim()))
  })
}

/** @deprecated use allBagPrintFacesCommitted */
export const allBagFaceSlotsCommitted = allBagPrintFacesCommitted
