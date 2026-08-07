import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'
import { getPrimaryLogoStepKey, getStepGenerator, isLogoDesignStep } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioMessagePayload, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { isLogoOnlyReferenceStepKey, isPackagingPostMockupStepKey } from '@/lib/packaging/product-label-step'
import {
  getPrimaryPackagingStyleFaceStepKey,
  hasApprovedPrimaryPackagingFace,
  HUB_PACKAGING_FACE_STEP_KEYS,
  isFirstPackagingFaceStep,
  PACKAGING_STYLE_REFERENCE_SCREEN_KEY,
  resolvePackagingFaceReferenceUrl,
  resolvePackagingStyleReferenceUrl,
} from '@/lib/packaging/hub-face-steps'
import {
  STUDIO_REFERENCE_ATTACH_LIMIT,
} from '@/lib/hub-chat/hub-studio-reference-limits'
import { pickMobileShopReferencesForGeneration } from '@/lib/hub-chat/hub-mobile-shop-style-anchor'

export function stepSupportsGenerationRefPicker(presetId: string, stepKey: string): boolean {
  if (isLogoDesignStep(presetId, stepKey)) return false
  if (stepKey === 'box_mockup_3d' || stepKey === 'box_dieline_pdf') return false
  if (isPackagingPostMockupStepKey(stepKey)) return false
  const gen = getStepGenerator(presetId, stepKey)
  if (!gen) return false
  /** Product compositing picker is packaging-only — not for web/app UI mockups. */
  return gen === 'packaging_face' || gen === 'packaging'
}

function isPackagingFaceGenerator(presetId: string, stepKey?: string | null): boolean {
  if (!stepKey) return false
  return getStepGenerator(presetId, stepKey) === 'packaging_face'
}

function logoReferenceKeys(session: HubStudioSession, presetId: string): string[] {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return []
  return session.referenceImages.some((r) => r.screenKey === logoKey) ? [logoKey] : []
}

function primaryStyleFaceReferenceKey(session: HubStudioSession): string | null {
  if (!hasApprovedPrimaryPackagingFace(session)) return null
  return getPrimaryPackagingStyleFaceStepKey()
}

function validGenerationReferenceKeys(
  session: HubStudioSession,
  presetId: string,
  stepKey: string | null | undefined
): Set<string> {
  const valid = new Set(session.referenceImages.map((r) => r.screenKey))
  const activeKey = stepKey ?? session.currentStepKey
  if (
    activeKey &&
    isPackagingFaceGenerator(presetId, activeKey) &&
    primaryStyleFaceReferenceKey(session)
  ) {
    valid.add(getPrimaryPackagingStyleFaceStepKey())
  }
  return valid
}

function resolveReferenceUrlForKey(session: HubStudioSession, screenKey: string): string | null {
  const ref = session.referenceImages.find((r) => r.screenKey === screenKey)
  if (ref?.url) return ref.url
  return resolvePackagingFaceReferenceUrl(session, screenKey)
}

/** Logo on every face; face #1 artwork as style anchor from face 2 onward. */
export function packagingFaceGenerationReferenceKeys(
  session: HubStudioSession,
  presetId: string,
  stepKey?: string | null
): string[] {
  const activeKey = stepKey ?? session.currentStepKey
  if (!activeKey || !isPackagingFaceGenerator(presetId, activeKey)) {
    return logoReferenceKeys(session, presetId)
  }
  const keys = logoReferenceKeys(session, presetId)
  if (isFirstPackagingFaceStep(activeKey)) return keys
  const primaryFaceKey = primaryStyleFaceReferenceKey(session)
  if (primaryFaceKey && !keys.includes(primaryFaceKey)) {
    keys.push(primaryFaceKey)
  }
  return keys.slice(0, STUDIO_REFERENCE_ATTACH_LIMIT)
}

function filterReferenceKeysForStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string | null | undefined,
  keys: string[]
): string[] {
  const activeKey = stepKey ?? session.currentStepKey
  if (!activeKey) return keys
  if (isLogoOnlyReferenceStepKey(activeKey)) {
    const logoKey = getPrimaryLogoStepKey(presetId)
    return logoKey ? keys.filter((k) => k === logoKey) : []
  }
  if (isPackagingFaceGenerator(presetId, activeKey)) {
    const logoKey = getPrimaryLogoStepKey(presetId)
    const primaryFaceKey = primaryStyleFaceReferenceKey(session)
    const allowed = new Set<string>([...(logoKey ? [logoKey] : [])])
    if (!isFirstPackagingFaceStep(activeKey) && primaryFaceKey) {
      allowed.add(primaryFaceKey)
    }
    return keys.filter((k) => allowed.has(k))
  }
  return keys
}

export function defaultGenerationReferenceKeys(
  session: HubStudioSession,
  presetId: string,
  stepKey?: string | null
): string[] {
  const activeKey = stepKey ?? session.currentStepKey
  if (activeKey) {
    const mobileShopRefs = pickMobileShopReferencesForGeneration(
      session.referenceImages,
      presetId,
      activeKey
    )
    if (mobileShopRefs) {
      return mobileShopRefs.map((r) => r.screenKey)
    }
  }
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (isLogoOnlyReferenceStepKey(activeKey)) {
    return logoReferenceKeys(session, presetId)
  }
  if (activeKey === 'box_mockup_3d' || activeKey === 'box_dieline_pdf') {
    return HUB_PACKAGING_FACE_STEP_KEYS.filter((k) =>
      session.referenceImages.some((r) => r.screenKey === k)
    )
  }
  if (isPackagingFaceGenerator(presetId, activeKey)) {
    return packagingFaceGenerationReferenceKeys(session, presetId, activeKey)
  }
  const keys: string[] = []
  if (logoKey && session.referenceImages.some((r) => r.screenKey === logoKey)) {
    keys.push(logoKey)
  }
  for (const r of session.referenceImages) {
    if (keys.length >= STUDIO_REFERENCE_ATTACH_LIMIT) break
    if (r.screenKey === logoKey || keys.includes(r.screenKey)) continue
    keys.push(r.screenKey)
  }
  return keys
}

function generationRefOptionsForStep(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
) {
  if (isLogoOnlyReferenceStepKey(stepKey)) {
    return session.referenceImages.filter((r) => r.screenKey === getPrimaryLogoStepKey(presetId))
  }
  if (isPackagingFaceGenerator(presetId, stepKey)) {
    const options: HubStudioSession['referenceImages'] = []
    const logoKey = getPrimaryLogoStepKey(presetId)
    if (logoKey) {
      const logo = session.referenceImages.find((r) => r.screenKey === logoKey)
      if (logo) options.push(logo)
    }
    if (!isFirstPackagingFaceStep(stepKey)) {
      const primaryKey = getPrimaryPackagingStyleFaceStepKey()
      const primaryUrl = resolvePackagingFaceReferenceUrl(session, primaryKey)
      if (primaryUrl) {
        const existing = session.referenceImages.find((r) => r.screenKey === primaryKey)
        options.push(
          existing ?? {
            screenKey: primaryKey,
            screenLabel: 'Top',
            url: primaryUrl,
            approvedAt: 0,
          }
        )
      }
    }
    return options
  }
  return session.referenceImages.filter((r) => r.screenKey !== 'box_mockup_3d')
}

function resolvedStyleReferenceUrl(session: HubStudioSession): string | null {
  const url =
    session.generationSelection?.styleReferenceUrl?.trim() ||
    session.packaging?.styleReferenceUrl?.trim() ||
    ''
  return url || null
}

export function sanitizeGenerationSelection(
  session: HubStudioSession,
  presetId: string | null
): HubStudioSession {
  if (!presetId || !session.generationSelection) return session
  const valid = validGenerationReferenceKeys(session, presetId, session.currentStepKey)
  const referenceScreenKeys = filterReferenceKeysForStep(
    session,
    presetId,
    session.currentStepKey,
    session.generationSelection.referenceScreenKeys.filter((k) => valid.has(k))
  )
  const defaults = defaultGenerationReferenceKeys(session, presetId, session.currentStepKey)
  const nextKeys = referenceScreenKeys.length ? referenceScreenKeys : defaults
  const maxProducts = Math.max(0, STUDIO_REFERENCE_ATTACH_LIMIT - nextKeys.length)
  return {
    ...session,
    generationSelection: {
      referenceScreenKeys: nextKeys,
      productUrls: session.generationSelection.productUrls.slice(0, maxProducts),
      styleReferenceUrl: session.generationSelection.styleReferenceUrl ?? null,
    },
  }
}

export function ensureGenerationSelection(
  session: HubStudioSession,
  presetId: string
): HubStudioSession {
  const sanitized = sanitizeGenerationSelection(session, presetId)
  const styleReferenceUrl =
    sanitized.generationSelection?.styleReferenceUrl ??
    sanitized.packaging?.styleReferenceUrl ??
    null
  if (sanitized.generationSelection?.referenceScreenKeys.length) {
    return {
      ...sanitized,
      generationSelection: {
        ...sanitized.generationSelection,
        styleReferenceUrl,
      },
    }
  }
  return {
    ...sanitized,
    generationSelection: {
      referenceScreenKeys: defaultGenerationReferenceKeys(sanitized, presetId, sanitized.currentStepKey),
      productUrls: sanitized.generationSelection?.productUrls ?? [],
      styleReferenceUrl,
    },
  }
}

export function resetGenerationSelectionForStep(
  session: HubStudioSession,
  presetId: string,
  stepKey?: string | null
): HubStudioSession {
  const key = stepKey ?? session.currentStepKey
  const styleReferenceUrl = isFirstPackagingFaceStep(key)
    ? resolvedStyleReferenceUrl(session)
    : null
  return {
    ...session,
    generationSelection: {
      referenceScreenKeys: defaultGenerationReferenceKeys(session, presetId, key),
      productUrls: [],
      styleReferenceUrl,
    },
  }
}

export function applyGenerationRefKeys(
  session: HubStudioSession,
  presetId: string,
  keys: string[]
): HubStudioSession {
  const valid = validGenerationReferenceKeys(session, presetId, session.currentStepKey)
  const referenceScreenKeys = filterReferenceKeysForStep(
    session,
    presetId,
    session.currentStepKey,
    keys.filter((k) => valid.has(k))
  ).slice(0, STUDIO_REFERENCE_ATTACH_LIMIT)
  const productUrls = session.generationSelection?.productUrls ?? []
  const maxProducts = Math.max(0, STUDIO_REFERENCE_ATTACH_LIMIT - referenceScreenKeys.length)
  return {
    ...session,
    generationSelection: {
      referenceScreenKeys,
      productUrls: productUrls.slice(0, maxProducts),
      styleReferenceUrl: session.generationSelection?.styleReferenceUrl ?? null,
    },
  }
}

export function setGenerationStyleReferenceUrl(
  session: HubStudioSession,
  presetId: string,
  url: string | null
): HubStudioSession {
  const base = ensureGenerationSelection(session, presetId)
  return {
    ...base,
    generationSelection: {
      ...base.generationSelection!,
      styleReferenceUrl: url,
    },
  }
}

export function appendGenerationProductUrls(
  session: HubStudioSession,
  presetId: string,
  urls: string[]
): HubStudioSession {
  const base = ensureGenerationSelection(session, presetId)
  const sel = base.generationSelection!
  const maxProducts = Math.max(
    0,
    STUDIO_REFERENCE_ATTACH_LIMIT - sel.referenceScreenKeys.length
  )
  const productUrls = [...sel.productUrls, ...urls].slice(0, maxProducts)
  return {
    ...base,
    generationSelection: { ...sel, productUrls },
  }
}

export function removeGenerationProductUrl(
  session: HubStudioSession,
  url: string
): HubStudioSession {
  const sel = session.generationSelection
  if (!sel) return session
  return {
    ...session,
    generationSelection: {
      ...sel,
      productUrls: sel.productUrls.filter((u) => u !== url),
    },
  }
}

export function resolveReferenceEntriesForUrls(
  session: HubStudioSession,
  urls: string[]
): Array<{ screenKey: string; screenLabel: string; url: string }> {
  const entries: Array<{ screenKey: string; screenLabel: string; url: string }> = []
  for (const url of urls) {
    const ref = session.referenceImages.find((r) => r.url === url)
    if (ref) {
      entries.push({ screenKey: ref.screenKey, screenLabel: ref.screenLabel, url })
      continue
    }
    const primaryKey = getPrimaryPackagingStyleFaceStepKey()
    if (resolvePackagingFaceReferenceUrl(session, primaryKey) === url) {
      const existing = session.referenceImages.find((r) => r.screenKey === primaryKey)
      entries.push({
        screenKey: primaryKey,
        screenLabel: existing?.screenLabel ?? 'Top',
        url,
      })
      continue
    }
    if (resolvePackagingStyleReferenceUrl(session) === url) {
      entries.push({
        screenKey: PACKAGING_STYLE_REFERENCE_SCREEN_KEY,
        screenLabel: 'Style reference',
        url,
      })
    }
  }
  return entries
}

export function resolveGenerationAttachments(
  session: HubStudioSession,
  presetId: string | null,
  generator: StudioGeneratorKind | null,
  stepKey?: string | null
): { referenceUrls: string[]; productUrls: string[] } {
  if (!presetId || !generator) {
    return { referenceUrls: [], productUrls: [] }
  }

  const activeKey = stepKey ?? session.currentStepKey
  const sel = session.generationSelection
  const selectedKeys =
    sel?.referenceScreenKeys?.length
      ? sel.referenceScreenKeys
      : defaultGenerationReferenceKeys(session, presetId, activeKey)

  const filteredKeys =
    generator === 'packaging_face'
      ? filterReferenceKeysForStep(session, presetId, activeKey, selectedKeys)
      : selectedKeys

  const referenceUrls: string[] = []
  for (const key of filteredKeys) {
    const url = resolveReferenceUrlForKey(session, key)
    if (url) referenceUrls.push(url)
  }

  const productUrls =
    generator === 'packaging_face' || generator === 'packaging'
      ? [...(sel?.productUrls ?? [])]
      : []
  let slots = STUDIO_REFERENCE_ATTACH_LIMIT
  const cappedRefs = referenceUrls.slice(0, slots)
  slots -= cappedRefs.length
  const cappedProducts = productUrls.slice(0, Math.max(slots, 0))

  return { referenceUrls: cappedRefs, productUrls: cappedProducts }
}

export function buildGenerationRefPickerPayload(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): Pick<
  HubStudioMessagePayload,
  | 'showGenerationRefPicker'
  | 'generationRefOptions'
  | 'selectedGenerationRefKeys'
  | 'generationProductPreviews'
  | 'generationAttachUsed'
  | 'referenceAttachLimit'
> {
  if (!stepSupportsGenerationRefPicker(presetId, stepKey)) {
    return {}
  }
  const withSel = ensureGenerationSelection(session, presetId)
  const sel = withSel.generationSelection!
  const used = sel.referenceScreenKeys.length + sel.productUrls.length
  const refOptions = generationRefOptionsForStep(session, presetId, stepKey)
  return {
    showGenerationRefPicker: true,
    generationRefOptions: refOptions.map((r) => ({
      url: r.url,
      label: r.screenLabel,
      screenKey: r.screenKey,
    })),
    selectedGenerationRefKeys: sel.referenceScreenKeys,
    generationProductPreviews: sel.productUrls.map((url, i) => ({
      url,
      label: `Product ${i + 1}`,
    })),
    generationAttachUsed: used,
    referenceAttachLimit: STUDIO_REFERENCE_ATTACH_LIMIT,
  }
}

export function pickedPackagingFaceReferenceUrls(
  session: HubStudioSession,
  presetId: string,
  stepKey: string
): string[] {
  return packagingFaceGenerationReferenceKeys(session, presetId, stepKey)
    .map((key) => resolveReferenceUrlForKey(session, key))
    .filter((url): url is string => Boolean(url))
}

export function hasPrimaryFaceStyleReference(
  session: HubStudioSession,
  stepKey: string
): boolean {
  if (isFirstPackagingFaceStep(stepKey)) return false
  return hasApprovedPrimaryPackagingFace(session)
}

/** @deprecated use pickedPackagingFaceReferenceUrls */
export function pickedLogoReferenceUrls(
  session: HubStudioSession,
  presetId: string
): string[] {
  return pickedPackagingFaceReferenceUrls(session, presetId, session.currentStepKey ?? 'face_top')
}
