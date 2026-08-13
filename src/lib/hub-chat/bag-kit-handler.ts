import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioMessagePayload, HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  allDiscoveryDone,
  getPrimaryLogoStepKey,
  getStepAskPrompt,
  isDiscoveryStep,
  isLogoDesignStep,
} from '@/lib/hub-chat/hub-studio-presets'
import {
  defaultPrintLanguageFields,
  PRINT_LANGUAGE_DETAIL_STEP_KEY,
  PRINT_LANGUAGE_STEP_KEY,
} from '@/lib/packaging/packaging-print-language'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getBagStructuralGussetMm, type BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import { buildBagPanelConfirmSummary, buildBagWireframeSvg } from '@/lib/packaging/bag-discovery'
import { exportBagDielinePdf } from '@/lib/packaging/export-bag-dieline'
import { exportBagMockupFromFaces } from '@/lib/packaging/export-bag-mockup'
import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import {
  allBagPrintFacesCommitted,
  bagStepKeyToSlot,
  emptyBagKitState,
  isBagKitPreset,
  resolveBagFacePreviewUrl,
} from '@/lib/hub-chat/bag-kit-shared'

export type { BagFaceSlot } from '@/lib/hub-chat/bag-kit-shared'
export {
  allBagFaceSlotsCommitted,
  allBagPrintFacesCommitted,
  BAG_FACE_COPY_SOURCE,
  bagStepKeyToSlot,
  copySourceUrlForBagSlot,
  emptyBagKitState,
  getBagFaceSlotLabel,
  isBagFaceReEdit,
  isBagKitPreset,
  isFirstBagFaceStep,
  isSecondaryBagFaceSlot,
  resolveBagFacePreviewUrl,
  resolveBagFacePrintSizeMm,
} from '@/lib/hub-chat/bag-kit-shared'

function appendStepAsk(reply: string, locale: WebLocale, presetId: string, stepKey: string): string {
  const ask = getStepAskPrompt(locale, presetId, stepKey)
  return ask ? `${reply}\n\n${ask}` : reply
}

function markStepDone(steps: HubStudioProcessStep[], key: string): HubStudioProcessStep[] {
  return steps.map((step) => (step.key === key ? { ...step, status: 'done' as const } : step))
}

function setStepInProgress(
  steps: HubStudioProcessStep[],
  key: string | null | undefined
): HubStudioProcessStep[] {
  if (!key) return steps
  return steps.map((step) =>
    step.key === key ? { ...step, status: 'in_progress' as const } : step
  )
}

function nextPendingStep(steps: HubStudioProcessStep[]): HubStudioProcessStep | null {
  return steps.find((step) => step.status !== 'done') ?? null
}

export function bagKitStartBriefNotes(locale: WebLocale): Record<string, string> {
  const fields = defaultPrintLanguageFields(locale)
  return {
    [PRINT_LANGUAGE_STEP_KEY]: fields.print_language,
    ...(fields.print_language_detail
      ? { [PRINT_LANGUAGE_DETAIL_STEP_KEY]: fields.print_language_detail }
      : {}),
  }
}

export function bagKitPanelConfirmStudioExtras(
  session: HubStudioSession
): Pick<HubStudioMessagePayload, 'processSteps' | 'boxWireframeSvg'> | null {
  if (
    !isBagKitPreset(session.presetId) ||
    session.currentStepKey !== 'bag_panel_confirm' ||
    !session.bagKit?.dimensionsMm ||
    session.bagKit.facesConfirmed
  ) {
    return null
  }
  return {
    processSteps: session.processSteps,
    boxWireframeSvg: buildBagWireframeSvg(session.bagKit.dimensionsMm),
  }
}

export function completeBagPanelConfirmSession(session: HubStudioSession, ackLabel: string): HubStudioSession {
  const dimensionsMm = session.bagKit?.dimensionsMm
  if (!dimensionsMm) return session
  return {
    ...session,
    bagKit: {
      ...session.bagKit!,
      facesConfirmed: true,
    },
    briefNotes: {
      ...session.briefNotes,
      bag_panel_confirm: ackLabel,
    },
  }
}

export function advanceBagDiscoveryAfterBriefAnswer(
  session: HubStudioSession,
  locale: WebLocale,
  stepKey: string,
  userLabel: string,
  confirmedReply: string
): { session: HubStudioSession; reply: string; studio: HubStudioMessagePayload } {
  const nextSession: HubStudioSession = {
    ...session,
    briefNotes: {
      ...session.briefNotes,
      [stepKey]: userLabel,
    },
    processSteps: markStepDone(session.processSteps, stepKey),
  }
  const presetId = session.presetId ?? 'bag_kit'
  const justFinishedDiscovery = allDiscoveryDone(presetId, nextSession.processSteps)
  if (justFinishedDiscovery) nextSession.discoveryComplete = true
  const next = nextPendingStep(nextSession.processSteps)
  nextSession.currentStepKey = next?.key ?? null
  nextSession.processSteps = setStepInProgress(nextSession.processSteps, nextSession.currentStepKey)
  let reply = confirmedReply
  if (justFinishedDiscovery && nextSession.currentStepKey) {
    const logoKey = getPrimaryLogoStepKey(presetId)
    if (logoKey && nextSession.currentStepKey === logoKey && isLogoDesignStep(presetId, logoKey)) {
      reply = `${reply}\n\n${getDictionary(locale).hubChat.studioStartWithLogo}`
    }
    reply = appendStepAsk(reply, locale, presetId, nextSession.currentStepKey)
  } else if (nextSession.currentStepKey && isDiscoveryStep(presetId, nextSession.currentStepKey)) {
    reply = appendStepAsk(reply, locale, presetId, nextSession.currentStepKey)
  }
  const studio: HubStudioMessagePayload = {
    processSteps: nextSession.processSteps,
    ...(bagKitPanelConfirmStudioExtras(nextSession) ?? {}),
  }
  return { session: nextSession, reply, studio }
}

export function applyBagFaceSlotToSession(
  session: HubStudioSession,
  stepKey: string,
  entry: { sourceMode: 'generate' | 'copy' | 'empty'; url?: string }
): HubStudioSession {
  const slot = bagStepKeyToSlot(stepKey)
  if (!slot) return session
  return {
    ...session,
    bagKit: {
      ...(session.bagKit ?? emptyBagKitState()),
      faceSlots: {
        ...(session.bagKit?.faceSlots ?? {}),
        [slot]: entry,
      },
      dielineUrl: undefined,
      mockupUrl: undefined,
      mockupPhotoUrl: undefined,
    },
  }
}

export function advanceAfterBagFaceStep(
  session: HubStudioSession,
  stepKey: string,
  screenLabel: string,
  locale: WebLocale,
  entry: { sourceMode: 'generate' | 'copy' | 'empty'; url?: string },
  addReference: boolean,
  options?: { stayOnStep?: boolean }
): { session: HubStudioSession; reply: string } {
  let nextSession = applyBagFaceSlotToSession(
    {
      ...session,
      processSteps: markStepDone(session.processSteps, stepKey),
      pendingPreview: null,
      lastGenerationPrompt: null,
    },
    stepKey,
    entry
  )
  if (addReference && entry.url) {
    nextSession = {
      ...nextSession,
      referenceImages: [
        ...nextSession.referenceImages.filter((r) => r.screenKey !== stepKey),
        {
          screenKey: stepKey,
          screenLabel,
          url: entry.url,
          approvedAt: Date.now(),
        },
      ],
    }
  }
  const t = getDictionary(locale).hubChat
  let reply: string
  if (options?.stayOnStep) {
    nextSession.currentStepKey = stepKey
    nextSession.processSteps = markStepDone(nextSession.processSteps, stepKey)
    reply = t.studioStepSavedStay.replace('{screen}', screenLabel)
  } else {
    const next = nextPendingStep(nextSession.processSteps)
    nextSession.currentStepKey = next?.key ?? null
    nextSession.processSteps = setStepInProgress(nextSession.processSteps, nextSession.currentStepKey)
    reply = next
      ? t.studioApprovedNext.replace('{screen}', screenLabel).replace('{next}', next.label)
      : t.studioAllDone
    if (nextSession.presetId && nextSession.currentStepKey) {
      reply = appendStepAsk(reply, locale, nextSession.presetId, nextSession.currentStepKey)
    }
  }
  return { session: nextSession, reply }
}

export async function runBagDielineExport(input: {
  userId: string
  locale: WebLocale
  session: HubStudioSession
  screenKey: string
  screenLabel: string
  generationPrompt: string
}): Promise<
  | { ok: true; session: HubStudioSession; studio: HubStudioMessagePayload }
  | { ok: false; error: string }
> {
  const dimensionsMm = input.session.bagKit?.dimensionsMm
  if (!dimensionsMm || !allBagPrintFacesCommitted(input.session.bagKit)) {
    return { ok: false, error: 'incomplete_faces' }
  }
  const exported = await exportBagDielinePdf({
    userId: input.userId,
    dimensionsMm,
    faceUrls: {
      back: resolveBagFacePreviewUrl(input.session.bagKit, 'back'),
      front: resolveBagFacePreviewUrl(input.session.bagKit, 'front'),
    },
  })
  if ('error' in exported) return { ok: false, error: exported.error }
  const pending: HubStudioSession['pendingPreview'] = {
    screenKey: input.screenKey,
    screenLabel: input.screenLabel,
    url: exported.url,
    generationPrompt: input.generationPrompt,
  }
  const nextSession: HubStudioSession = {
    ...input.session,
    pendingPreview: pending,
    lastGenerationPrompt: input.generationPrompt,
    bagKit: {
      ...(input.session.bagKit ?? emptyBagKitState()),
      dielineUrl: exported.url,
    },
  }
  const t = getDictionary(input.locale).hubChat
  return {
    ok: true,
    session: nextSession,
    studio: {
      artifactUrl: exported.url,
      artifactKind: 'pdf',
      artifactFileName: exported.fileName,
      artifactLabel: input.screenLabel,
      artifactDownloadLabel: t.studioDownload ?? 'Download',
      screenKey: input.screenKey,
      screenLabel: input.screenLabel,
      processSteps: nextSession.processSteps,
      showRegenerate: true,
      showApproveReference: true,
    },
  }
}

export function buildBagSizeConfirmReply(
  locale: WebLocale,
  dimensionsMm: BagDimensionsMm,
  processSteps?: HubStudioProcessStep[]
): { reply: string; studio: HubStudioMessagePayload } {
  return {
    reply: buildBagPanelConfirmSummary(locale, dimensionsMm),
    studio: {
      processSteps,
      boxWireframeSvg: buildBagWireframeSvg(dimensionsMm),
    },
  }
}

export async function runBagMockupGeneration(input: {
  userId: string
  locale: WebLocale
  session: HubStudioSession
  screenKey: string
  screenLabel: string
  generationPrompt: string
}): Promise<
  | { ok: true; session: HubStudioSession; studio: HubStudioMessagePayload; chargedImage: number }
  | { ok: false; error: string }
> {
  const dims = input.session.bagKit?.dimensionsMm
  if (!dims || !allBagPrintFacesCommitted(input.session.bagKit)) {
    return { ok: false, error: 'incomplete_faces' }
  }
  const faceSlots = input.session.bagKit?.faceSlots ?? {}
  if (!resolveBagFacePreviewUrl({ faceSlots }, 'back') || !resolveBagFacePreviewUrl({ faceSlots }, 'front')) {
    return { ok: false, error: 'incomplete_faces' }
  }

  try {
    const backUrl = resolveBagFacePreviewUrl({ faceSlots }, 'back')
    const frontUrl = resolveBagFacePreviewUrl({ faceSlots }, 'front')
    const depth = getBagStructuralGussetMm(dims)
    const photoBrief = [
      input.generationPrompt,
      `Paper shopping bag mockup.`,
      `Bag size: front/back panel ${dims.width}×${dims.height} mm (equal), depth/gusset ${depth} mm (structural, usually unprinted kraft).`,
      `Apply attached BACK panel art on the back face and FRONT panel art on the front face.`,
      `Photorealistic standing bag, subtle shadows, product photography quality.`,
    ].join('\n')

    const [compositeSettled, photoSettled] = await Promise.allSettled([
      exportBagMockupFromFaces({
        userId: input.userId,
        faceSlots,
        dimensionsMm: dims,
      }),
      runStudioImagePipeline({
        userId: input.userId,
        kind: 'packaging_mockup',
        screenLabel: input.screenLabel,
        screenKey: input.screenKey,
        brief: photoBrief,
        projectTitle: input.session.projectTitle,
        referenceImageUrls: [backUrl, frontUrl].filter((url): url is string => Boolean(url)),
        referenceImageMeta: [
          { screenKey: 'face_back', label: 'Back panel' },
          { screenKey: 'face_front', label: 'Front panel' },
        ],
        aspectRatio: '1:1',
      }),
    ])

    if (compositeSettled.status !== 'fulfilled') {
      const reason =
        compositeSettled.reason instanceof Error
          ? compositeSettled.reason.message
          : String(compositeSettled.reason)
      return { ok: false, error: reason }
    }
    const exported = compositeSettled.value

    let mockupPhotoUrl: string | undefined
    let chargedImage = 0
    if (photoSettled.status === 'fulfilled' && photoSettled.value.ok) {
      mockupPhotoUrl = photoSettled.value.resultUrl
      chargedImage = photoSettled.value.charged
    }

    const displayUrl = mockupPhotoUrl ?? exported.pngUrl
    const pending: HubStudioSession['pendingPreview'] = {
      screenKey: input.screenKey,
      screenLabel: input.screenLabel,
      url: displayUrl,
      generationPrompt: input.generationPrompt,
    }
    const nextSession: HubStudioSession = {
      ...input.session,
      pendingPreview: pending,
      lastGenerationPrompt: input.generationPrompt,
      bagKit: {
        ...(input.session.bagKit ?? emptyBagKitState()),
        mockupUrl: exported.pngUrl,
        mockupPhotoUrl,
      },
    }
    return {
      ok: true,
      session: nextSession,
      chargedImage,
      studio: {
        imageUrl: displayUrl,
        screenKey: input.screenKey,
        screenLabel: input.screenLabel,
        previewKind: 'banner',
        aspectHint: 'square',
        processSteps: nextSession.processSteps,
        showRegenerate: true,
        showApproveReference: true,
        imageCharged: chargedImage,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
