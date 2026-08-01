import type { HubStudioReferenceImage, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { getPrimaryLogoStepKey, orderedReferenceUrls } from '@/lib/hub-chat/hub-studio-preset-flows'
import { pickMobileShopReferencesForGeneration } from '@/lib/hub-chat/hub-mobile-shop-style-anchor'
import { isLogoDesignStep } from '@/lib/hub-chat/hub-studio-presets'
import { isStepAtOrBefore } from '@/lib/hub-chat/hub-studio-step-preview'
import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'
import { isLogoOnlyReferenceStepKey } from '@/lib/packaging/product-label-step'
import { isPackagingFaceStepKey } from '@/lib/packaging/hub-face-steps'

/** Max approved reference images stored in session (packaging needs logo + 3 faces + downstream assets). */
export const STUDIO_MAX_REFERENCE_IMAGES = 8

/** Max reference images attached to the model per generation (logo always kept first). */
export const STUDIO_REFERENCE_ATTACH_LIMIT = 4

function pickLandingPageReferencesForGeneration(
  referenceImages: HubStudioReferenceImage[],
  presetId: string,
  stepKey: string
): HubStudioReferenceImage[] | null {
  if (presetId !== 'landing_page') return null
  return []
}

export function pickReferencesForGeneration(
  referenceImages: HubStudioReferenceImage[],
  presetId: string | null,
  stepKey?: string | null
): HubStudioReferenceImage[] {
  if (!referenceImages.length) return []
  if (presetId && stepKey) {
    const mobileShopRefs = pickMobileShopReferencesForGeneration(referenceImages, presetId, stepKey)
    if (mobileShopRefs) return mobileShopRefs
    const landingRefs = pickLandingPageReferencesForGeneration(referenceImages, presetId, stepKey)
    if (landingRefs !== null) return landingRefs
  }
  const logoKey = presetId ? getPrimaryLogoStepKey(presetId) : null
  if (presetId && stepKey && isLogoDesignStep(presetId, stepKey)) {
    return []
  }
  if (isLogoOnlyReferenceStepKey(stepKey)) {
    const logo = logoKey ? referenceImages.find((r) => r.screenKey === logoKey) : null
    return logo ? [logo] : []
  }
  if (stepKey === 'box_mockup_3d' || stepKey === 'box_dieline_pdf') {
    return referenceImages.filter((r) => isPackagingFaceStepKey(r.screenKey))
  }
  const logo = logoKey ? referenceImages.find((r) => r.screenKey === logoKey) : null
  const rest = referenceImages.filter((r) => {
    if (r.screenKey === logoKey) return false
    if (r.screenKey === 'box_mockup_3d') return false
    if (presetId && stepKey && !isStepAtOrBefore(presetId, r.screenKey, stepKey)) return false
    return true
  })
  const slots = STUDIO_REFERENCE_ATTACH_LIMIT - (logo ? 1 : 0)
  const recent = rest.slice(-Math.max(slots, 0))
  return [...(logo ? [logo] : []), ...recent]
}

export function pickedReferenceUrls(
  referenceImages: HubStudioReferenceImage[],
  presetId: string | null,
  stepKey?: string | null
): string[] {
  return pickReferencesForGeneration(referenceImages, presetId, stepKey).map((r) => r.url)
}

export function canAddReferenceImage(session: HubStudioSession, screenKey: string): boolean {
  if (session.referenceImages.some((r) => r.screenKey === screenKey)) return true
  return session.referenceImages.length < STUDIO_MAX_REFERENCE_IMAGES
}

/** Mockup / dieline composite from face slots — no reference-image picker or preview UI. */
export function isPackagingCompositeArtifactStepKey(stepKey: string | null | undefined): boolean {
  return stepKey === 'box_mockup_3d' || stepKey === 'box_dieline_pdf'
}

export function shouldShowStudioReferencePreviews(
  session: HubStudioSession,
  stepKey?: string | null
): boolean {
  return !isPackagingCompositeArtifactStepKey(stepKey ?? session.currentStepKey)
}

export type HubStudioReferencePreview = {
  url: string
  label: string
  screenKey: string
}

/** Drop previews that were removed from the live session (historical chat lines keep stale payloads). */
export function filterStaleReferencePreviews(
  previews: HubStudioReferencePreview[] | null | undefined,
  session: HubStudioSession | null | undefined
): HubStudioReferencePreview[] {
  if (!previews?.length) return []
  if (!session) return previews
  const activeKeys = new Set(session.referenceImages.map((r) => r.screenKey))
  return previews.filter((preview) => preview.screenKey && activeKeys.has(preview.screenKey))
}

export function buildReferencePreviewsPayload(
  session: HubStudioSession,
  stepKey?: string | null
) {
  if (!shouldShowStudioReferencePreviews(session, stepKey)) {
    return {
      referencePreviews: [] as { url: string; label: string; screenKey: string }[],
      showReferenceRemove: false,
    }
  }
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
  presetId: string | null,
  stepKey?: string | null
): string[] {
  const picked = new Set(
    pickReferencesForGeneration(referenceImages, presetId, stepKey).map((r) => r.screenKey)
  )
  return orderedReferenceUrls(referenceImages, presetId ?? '').filter((url) => {
    const ref = referenceImages.find((r) => r.url === url)
    return ref ? picked.has(ref.screenKey) : false
  })
}

export function generatorSupportsReference(gen: StudioGeneratorKind): boolean {
  return (
    gen === 'ui_mockup' ||
    gen === 'ui_desktop' ||
    gen === 'banner' ||
    gen === 'logo' ||
    gen === 'packaging' ||
    gen === 'packaging_face' ||
    gen === 'packaging_mockup' ||
    gen === 'interior' ||
    gen === 'story_panel' ||
    gen === 'infographic' ||
    gen === 'portrait' ||
    gen === 'product_photo'
  )
}

export function generatorSupportsReferenceForPicker(gen: StudioGeneratorKind): boolean {
  return generatorSupportsReference(gen)
}
