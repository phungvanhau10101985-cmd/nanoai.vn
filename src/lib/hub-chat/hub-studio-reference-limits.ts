import type { HubStudioReferenceImage, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { getPrimaryLogoStepKey, orderedReferenceUrls } from '@/lib/hub-chat/hub-studio-preset-flows'

/** Max approved reference images stored in session. */
export const STUDIO_MAX_REFERENCE_IMAGES = 6

/** Max reference images attached to the model per generation (logo always kept first). */
export const STUDIO_REFERENCE_ATTACH_LIMIT = 4

export function pickReferencesForGeneration(
  referenceImages: HubStudioReferenceImage[],
  presetId: string | null
): HubStudioReferenceImage[] {
  if (!referenceImages.length) return []
  const logoKey = presetId ? getPrimaryLogoStepKey(presetId) : null
  const logo = logoKey ? referenceImages.find((r) => r.screenKey === logoKey) : null
  const rest = referenceImages.filter((r) => r.screenKey !== logoKey)
  const slots = STUDIO_REFERENCE_ATTACH_LIMIT - (logo ? 1 : 0)
  const recent = rest.slice(-Math.max(slots, 0))
  return [...(logo ? [logo] : []), ...recent]
}

export function pickedReferenceUrls(
  referenceImages: HubStudioReferenceImage[],
  presetId: string | null
): string[] {
  return pickReferencesForGeneration(referenceImages, presetId).map((r) => r.url)
}

export function canAddReferenceImage(session: HubStudioSession, screenKey: string): boolean {
  if (session.referenceImages.some((r) => r.screenKey === screenKey)) return true
  return session.referenceImages.length < STUDIO_MAX_REFERENCE_IMAGES
}

export function buildReferencePreviewsPayload(session: HubStudioSession) {
  const count = session.referenceImages.length
  return {
    referencePreviews: session.referenceImages.map((r) => ({
      url: r.url,
      label: r.screenLabel,
      screenKey: r.screenKey,
    })),
    referenceCount: count,
    referenceMax: STUDIO_MAX_REFERENCE_IMAGES,
    referenceAttachLimit: STUDIO_REFERENCE_ATTACH_LIMIT,
    showReferenceRemove: count > 0,
  }
}

/** Ordered URLs for prompt context — same subset as model attachment. */
export function orderedPickedReferenceUrls(
  referenceImages: HubStudioReferenceImage[],
  presetId: string | null
): string[] {
  const picked = new Set(pickReferencesForGeneration(referenceImages, presetId).map((r) => r.screenKey))
  return orderedReferenceUrls(referenceImages, presetId ?? '').filter((url) => {
    const ref = referenceImages.find((r) => r.url === url)
    return ref ? picked.has(ref.screenKey) : false
  })
}
