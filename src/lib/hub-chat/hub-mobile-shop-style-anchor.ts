import { getStepGenerator } from '@/lib/hub-chat/hub-studio-presets'
import { getPrimaryLogoStepKey } from '@/lib/hub-chat/hub-studio-preset-flows'
import type { HubStudioReferenceImage, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'

/** First approved mobile UI screen — sole style reference for the rest of mobile_shop. */
export const MOBILE_SHOP_UI_STYLE_ANCHOR_KEY = 'home_mobile'

export function isMobileShopPreset(presetId: string | null | undefined): boolean {
  return presetId === 'mobile_shop'
}

export function isMobileShopUiStyleAnchorStep(stepKey: string | null | undefined): boolean {
  return stepKey === MOBILE_SHOP_UI_STYLE_ANCHOR_KEY
}

export function isMobileShopUiGenerator(
  presetId: string | null | undefined,
  stepKey: string | null | undefined
): boolean {
  if (!presetId || !stepKey || !isMobileShopPreset(presetId)) return false
  const gen = getStepGenerator(presetId, stepKey)
  return gen === 'ui_mockup' || gen === 'ui_desktop'
}

export function mobileShopUiStyleAnchorApproved(referenceImages: HubStudioReferenceImage[]): boolean {
  return referenceImages.some((r) => r.screenKey === MOBILE_SHOP_UI_STYLE_ANCHOR_KEY)
}

/** Approve button shows «Tiếp tục» — style anchor is automatic, not a separate user choice. */
export function isMobileShopContinueOnlyApproveStep(
  presetId: string | null | undefined,
  stepKey: string | null | undefined,
  generator?: StudioGeneratorKind | null
): boolean {
  if (!isMobileShopUiGenerator(presetId, stepKey)) return false
  const gen = generator ?? (stepKey && presetId ? getStepGenerator(presetId, stepKey) : null)
  return gen === 'ui_mockup' || gen === 'ui_desktop'
}

export function pickMobileShopReferencesForGeneration(
  referenceImages: HubStudioReferenceImage[],
  presetId: string,
  stepKey: string | null | undefined
): HubStudioReferenceImage[] | null {
  if (!isMobileShopPreset(presetId) || !stepKey) return null
  if (!isMobileShopUiGenerator(presetId, stepKey)) return null

  const logoKey = getPrimaryLogoStepKey(presetId)
  const logo = logoKey ? referenceImages.find((r) => r.screenKey === logoKey) : null
  const anchor = referenceImages.find((r) => r.screenKey === MOBILE_SHOP_UI_STYLE_ANCHOR_KEY)

  if (anchor && stepKey !== MOBILE_SHOP_UI_STYLE_ANCHOR_KEY) {
    const refs: HubStudioReferenceImage[] = []
    if (logo) refs.push(logo)
    refs.push(anchor)
    return refs
  }

  if (stepKey === MOBILE_SHOP_UI_STYLE_ANCHOR_KEY) {
    return logo ? [logo] : []
  }

  return []
}

export function shouldKeepMobileShopReferenceOnApprove(
  session: HubStudioSession,
  stepKey: string,
  generator: StudioGeneratorKind | null
): boolean {
  if (!isMobileShopPreset(session.presetId)) return true
  if (generator === 'logo') return true
  if (isMobileShopUiStyleAnchorStep(stepKey)) return true
  if (isMobileShopUiGenerator(session.presetId, stepKey)) return false
  return true
}

export function applyMobileShopStyleAnchorReference(
  session: HubStudioSession,
  stepKey: string,
  screenLabel: string,
  url: string
): HubStudioSession {
  const presetId = session.presetId ?? 'mobile_shop'
  const logoKey = getPrimaryLogoStepKey(presetId)
  const logoRef = logoKey
    ? session.referenceImages.find((r) => r.screenKey === logoKey)
    : null
  const anchor: HubStudioReferenceImage = {
    screenKey: stepKey,
    screenLabel,
    url,
    approvedAt: Date.now(),
  }
  return {
    ...session,
    referenceImages: logoRef ? [logoRef, anchor] : [anchor],
  }
}
