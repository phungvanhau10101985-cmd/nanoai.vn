import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'
import { getPrimaryLogoStepKey, getStepGenerator, isLogoDesignStep } from '@/lib/hub-chat/hub-studio-presets'
import { isLogoOnlyReferenceStepKey } from '@/lib/packaging/product-label-step'
import { HUB_PACKAGING_FACE_STEP_KEYS } from '@/lib/packaging/hub-face-steps'
import {
  STUDIO_REFERENCE_ATTACH_LIMIT,
  generatorSupportsReferenceForPicker,
} from '@/lib/hub-chat/hub-studio-reference-limits'
import type { HubStudioMessagePayload, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export function stepSupportsGenerationRefPicker(presetId: string, stepKey: string): boolean {
  if (isLogoDesignStep(presetId, stepKey)) return false
  const gen = getStepGenerator(presetId, stepKey)
  if (!gen) return false
  return generatorSupportsReferenceForPicker(gen)
}

export function defaultGenerationReferenceKeys(
  session: HubStudioSession,
  presetId: string,
  stepKey?: string | null
): string[] {
  const logoKey = getPrimaryLogoStepKey(presetId)
  const activeKey = stepKey ?? session.currentStepKey
  if (isLogoOnlyReferenceStepKey(activeKey)) {
    return logoKey && session.referenceImages.some((r) => r.screenKey === logoKey) ? [logoKey] : []
  }
  if (activeKey === 'box_mockup_3d' || activeKey === 'box_dieline_pdf') {
    return HUB_PACKAGING_FACE_STEP_KEYS.filter((k) =>
      session.referenceImages.some((r) => r.screenKey === k)
    )
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

export function sanitizeGenerationSelection(
  session: HubStudioSession,
  presetId: string | null
): HubStudioSession {
  if (!presetId || !session.generationSelection) return session
  const valid = new Set(session.referenceImages.map((r) => r.screenKey))
  const referenceScreenKeys = session.generationSelection.referenceScreenKeys.filter((k) =>
    valid.has(k)
  )
  const defaults = defaultGenerationReferenceKeys(session, presetId, session.currentStepKey)
  const nextKeys = referenceScreenKeys.length ? referenceScreenKeys : defaults
  const maxProducts = Math.max(0, STUDIO_REFERENCE_ATTACH_LIMIT - nextKeys.length)
  return {
    ...session,
    generationSelection: {
      referenceScreenKeys: nextKeys,
      productUrls: session.generationSelection.productUrls.slice(0, maxProducts),
    },
  }
}

export function ensureGenerationSelection(
  session: HubStudioSession,
  presetId: string
): HubStudioSession {
  const sanitized = sanitizeGenerationSelection(session, presetId)
  if (sanitized.generationSelection?.referenceScreenKeys.length) return sanitized
  return {
    ...sanitized,
    generationSelection: {
      referenceScreenKeys: defaultGenerationReferenceKeys(sanitized, presetId, sanitized.currentStepKey),
      productUrls: sanitized.generationSelection?.productUrls ?? [],
    },
  }
}

export function resetGenerationSelectionForStep(
  session: HubStudioSession,
  presetId: string,
  stepKey?: string | null
): HubStudioSession {
  const key = stepKey ?? session.currentStepKey
  return {
    ...session,
    generationSelection: {
      referenceScreenKeys: defaultGenerationReferenceKeys(session, presetId, key),
      productUrls: [],
    },
  }
}

export function applyGenerationRefKeys(
  session: HubStudioSession,
  presetId: string,
  keys: string[]
): HubStudioSession {
  const valid = new Set(session.referenceImages.map((r) => r.screenKey))
  const referenceScreenKeys = keys.filter((k) => valid.has(k)).slice(0, STUDIO_REFERENCE_ATTACH_LIMIT)
  const productUrls = session.generationSelection?.productUrls ?? []
  const maxProducts = Math.max(0, STUDIO_REFERENCE_ATTACH_LIMIT - referenceScreenKeys.length)
  return {
    ...session,
    generationSelection: {
      referenceScreenKeys,
      productUrls: productUrls.slice(0, maxProducts),
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

  const referenceUrls: string[] = []
  for (const key of selectedKeys) {
    const url = session.referenceImages.find((r) => r.screenKey === key)?.url
    if (url) referenceUrls.push(url)
  }

  const productUrls = [...(sel?.productUrls ?? [])]
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
  const refOptions = isLogoOnlyReferenceStepKey(stepKey)
    ? session.referenceImages.filter((r) => r.screenKey === getPrimaryLogoStepKey(presetId))
    : session.referenceImages
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
