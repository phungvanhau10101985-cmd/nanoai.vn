import type { WebLocale } from '@/lib/i18n/config'
import { presetStepLabel, getFlowSteps } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import { getBagFaceDimensionsMm, isBagFaceStepKey } from '@/lib/packaging/bag-dimensions'
import { getPackagingFaceSizeForStep, isPackagingFaceStepKey } from '@/lib/packaging/hub-face-steps'

export function formatFaceSizeCompact(locale: WebLocale, widthMm: number, heightMm: number): string {
  const fmt = (mm: number) => {
    const s = mm % 1 === 0 ? String(Math.round(mm)) : mm.toFixed(1)
    return locale === 'vi' ? s.replace('.', ',') : s
  }
  return `${fmt(widthMm)}×${fmt(heightMm)} mm`
}

export function packagingFaceStepLabelWithSize(
  locale: WebLocale,
  baseLabel: string,
  stepKey: string,
  dimensionsMm: BoxDimensionsMm | null | undefined
): string {
  if (!isPackagingFaceStepKey(stepKey)) return baseLabel
  const size = getPackagingFaceSizeForStep(dimensionsMm, stepKey)
  if (!size) return baseLabel
  return `${baseLabel} — ${formatFaceSizeCompact(locale, size.widthMm, size.heightMm)}`
}

export function bagFaceStepLabelWithSize(
  locale: WebLocale,
  baseLabel: string,
  stepKey: string,
  dimensionsMm: BagDimensionsMm | null | undefined
): string {
  if (!isBagFaceStepKey(stepKey) || !dimensionsMm) return baseLabel
  const dims = getBagFaceDimensionsMm(stepKey, dimensionsMm)
  if (!dims) return baseLabel
  return `${baseLabel} — ${formatFaceSizeCompact(locale, dims[0], dims[1])}`
}

export function refreshPackagingFaceStepLabels(
  steps: HubStudioProcessStep[],
  locale: WebLocale,
  presetId: string,
  dimensionsMm: BoxDimensionsMm | null | undefined
): HubStudioProcessStep[] {
  if (presetId !== 'packaging_kit' || !dimensionsMm) return steps
  const flowByKey = new Map(getFlowSteps(presetId).map((s) => [s.key, s]))
  return steps.map((step) => {
    if (!isPackagingFaceStepKey(step.key)) return step
    const flow = flowByKey.get(step.key)
    const base = presetStepLabel(locale, presetId, flow?.labelKey ?? step.key)
    return {
      ...step,
      label: packagingFaceStepLabelWithSize(locale, base, step.key, dimensionsMm),
    }
  })
}

export function refreshBagFaceStepLabels(
  steps: HubStudioProcessStep[],
  locale: WebLocale,
  presetId: string,
  dimensionsMm: BagDimensionsMm | null | undefined
): HubStudioProcessStep[] {
  if (presetId !== 'bag_kit' || !dimensionsMm) return steps
  const flowByKey = new Map(getFlowSteps(presetId).map((s) => [s.key, s]))
  return steps.map((step) => {
    if (!isBagFaceStepKey(step.key)) return step
    const flow = flowByKey.get(step.key)
    const base = presetStepLabel(locale, presetId, flow?.labelKey ?? step.key)
    return {
      ...step,
      label: bagFaceStepLabelWithSize(locale, base, step.key, dimensionsMm),
    }
  })
}

export function resolvePackagingStepLabel(
  steps: HubStudioProcessStep[],
  stepKey: string | null,
  locale: WebLocale,
  presetId: string | null | undefined,
  dimensionsMm: BoxDimensionsMm | null | undefined,
  bagDimensionsMm?: BagDimensionsMm | null | undefined
): string {
  if (!stepKey) return 'Screen'
  if (presetId === 'bag_kit' && isBagFaceStepKey(stepKey) && bagDimensionsMm) {
    const flow = getFlowSteps(presetId).find((s) => s.key === stepKey)
    const base = presetStepLabel(locale, presetId, flow?.labelKey ?? stepKey)
    return bagFaceStepLabelWithSize(locale, base, stepKey, bagDimensionsMm)
  }
  if (presetId !== 'packaging_kit' || !isPackagingFaceStepKey(stepKey)) {
    return steps.find((s) => s.key === stepKey)?.label ?? stepKey
  }
  const flow = getFlowSteps(presetId).find((s) => s.key === stepKey)
  const base = presetStepLabel(locale, presetId, flow?.labelKey ?? stepKey)
  return packagingFaceStepLabelWithSize(locale, base, stepKey, dimensionsMm)
}

/** Refresh face step + reference labels after box dimensions are known. */
export function applyPackagingSessionLabels(
  session: HubStudioSession,
  locale: WebLocale
): HubStudioSession {
  if (session.presetId !== 'packaging_kit' || !session.packaging?.dimensionsMm) return session
  const dims = session.packaging.dimensionsMm
  const processSteps = refreshPackagingFaceStepLabels(
    session.processSteps,
    locale,
    session.presetId,
    dims
  )
  const referenceImages = session.referenceImages.map((r) => ({
    ...r,
    screenLabel: resolvePackagingStepLabel(
      processSteps,
      r.screenKey,
      locale,
      session.presetId,
      dims
    ),
  }))
  const pendingPreview = session.pendingPreview
    ? {
        ...session.pendingPreview,
        screenLabel: resolvePackagingStepLabel(
          processSteps,
          session.pendingPreview.screenKey,
          locale,
          session.presetId,
          dims
        ),
      }
    : null
  return { ...session, processSteps, referenceImages, pendingPreview }
}

/** Refresh bag face step + reference labels after bag dimensions are known. */
export function applyBagSessionLabels(session: HubStudioSession, locale: WebLocale): HubStudioSession {
  if (session.presetId !== 'bag_kit' || !session.bagKit?.dimensionsMm) return session
  const dims = session.bagKit.dimensionsMm
  const processSteps = refreshBagFaceStepLabels(session.processSteps, locale, session.presetId, dims)
  const referenceImages = session.referenceImages.map((r) => ({
    ...r,
    screenLabel: resolvePackagingStepLabel(
      processSteps,
      r.screenKey,
      locale,
      session.presetId,
      null,
      dims
    ),
  }))
  const pendingPreview = session.pendingPreview
    ? {
        ...session.pendingPreview,
        screenLabel: resolvePackagingStepLabel(
          processSteps,
          session.pendingPreview.screenKey,
          locale,
          session.presetId,
          null,
          dims
        ),
      }
    : null
  return { ...session, processSteps, referenceImages, pendingPreview }
}

export function applyStudioSessionLabels(session: HubStudioSession, locale: WebLocale): HubStudioSession {
  return applyBagSessionLabels(applyPackagingSessionLabels(session, locale), locale)
}
