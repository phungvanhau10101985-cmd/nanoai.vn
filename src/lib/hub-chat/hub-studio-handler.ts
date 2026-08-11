import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { HUB_CHAT_CREDIT } from '@/lib/hub-chat/hub-chat-catalog'
import { buildBannerImageGenerationPrompt } from '@/lib/hub-chat/banner-image-prompt-builder'
import { buildMenuImageGenerationPrompt } from '@/lib/hub-chat/menu-image-prompt-builder'
import {
  menuInputHasContent,
  normalizeMenuDishes,
  type MenuDishItem,
} from '@/lib/hub-chat/menu-dish-items'
import {
  getMenuFormatPresetById,
  getMenuFormatPresetLabel,
  normalizeMenuFormatPresetId,
  type MenuFormatPresetId,
} from '@/lib/hub-chat/menu-format-presets'
import {
  BANNER_AD_PRESETS,
  DEFAULT_BANNER_AD_PRESET_ID,
  MAX_BANNER_BATCH_PRESETS,
  findBannerAdPreset,
  getBannerAdPlatformHint,
  getBannerAdPresetLabel,
  getBannerAdPresetById,
  normalizeBannerAdPresetId,
  normalizeBannerAspectRatioForGemini,
  type BannerAdPresetId,
} from '@/lib/banner-ad-presets'
import {
  emptyStudioSession,
  type HubStudioIntent,
  type HubStudioMessagePayload,
  type HubStudioPendingPreview,
  type HubStudioPreviewKind,
  type HubStudioProcessStep,
  type HubStudioReferenceImage,
  type HubStudioSession,
  type HubPackagingState,
} from '@/lib/hub-chat/hub-studio-types'
import {
  allDiscoveryDone,
  buildStepsFromPreset,
  getPresetKickoff,
  getPrimaryLogoStepKey,
  getStepAspectRatio,
  getStepAskPrompt,
  getStepFormFactor,
  getStepGenerator,
  getStudioPreset,
  hasPrimaryLogoReference,
  isDiscoveryStep,
  isLogoDesignStep,
  isStepAfterPrimaryLogo,
  briefNotesForStepGeneration,
  matchStudioPresetWithScore,
  presetTitle,
  primaryLogoApproved,
} from '@/lib/hub-chat/hub-studio-presets'
import {
  hasSaleBannerDiscoveryBrief,
  SALE_BANNER_COPY_BRIEF_KEYS,
  hasLandingDiscoveryBrief,
  hasLandingHeaderLogo,
  isLandingDesignStepKey,
  landingSectionHasCopy,
  LANDING_DISCOVERY_BRIEF_KEYS,
  normalizeLandingDesignStepKey,
  readLandingSectionBrief,
} from '@/lib/hub-chat/hub-studio-preset-flows'
import { buildLandingStructuredImagePrompt, buildLandingLogoGenerationPrompt } from '@/lib/hub-chat/landing-page-prompt-builder'
import { resolveLandingImageGenerationPrompt } from '@/lib/hub-chat/landing-page-ai-prompt-optimizer'
import {
  applySuggestedPreset,
  appendCurrentDiscoveryAsk,
  appendFirstStepAsk,
  appendPresetKickoffIfNeeded,
  buildPresetCatalogForBrain,
  discoveryReadyForBoxSize,
  getActiveStepKey,
  isPresetTitleEcho,
  isValidStudioPresetId,
  reconcileDiscoveryProgress,
  syncDiscoveryCurrentStep,
} from '@/lib/hub-chat/hub-studio-preset-intent'
import {
  resolveCurrentStudioDesignStep,
  saveCurrentStudioStepBrief,
} from '@/lib/hub-chat/hub-studio-step-engine'
import {
  classifyStudioFlowSwitchWithAi,
  isHighConfidenceFlowSwitch,
} from '@/lib/hub-chat/hub-studio-flow-classifier'
import { classifyFeatureIntentWithAi } from '@/lib/hub-chat/hub-feature-intent-classifier'
import { matchFeatureFlowByMessage, resolveIdleFeatureMatch, isShortAffirmativeReply } from '@/lib/hub-chat/hub-feature-flow-registry'
import {
  buildFullFeatureCatalogForBrain,
  getHubFeatureCatalogEntry,
  resolveHubFeatureSelection,
} from '@/lib/hub-chat/hub-feature-catalog'
import {
  blocksPresetStartOnThread,
  detectStudioFlowSwitch,
  FLOW_SWITCH_AI_MIN_CONFIDENCE,
  isActiveStudioFlow,
  shouldSkipFlowSwitchAiClassification,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import {
  buildReferencePreviewsPayload,
  canAddReferenceImage,
  generatorSupportsReference,
  isPackagingCompositeArtifactStepKey,
  pickedReferenceUrls,
  STUDIO_MAX_REFERENCE_IMAGES,
  STUDIO_REFERENCE_ATTACH_LIMIT,
} from '@/lib/hub-chat/hub-studio-reference-limits'
import {
  clearStalePendingForArtifactGenerate,
  mergeApprovedPackagingMockupIntoStudio,
  pendingPreviewBlocksWorkflowInput,
  resolveWorkflowPendingAfterApprovedFaceEdit,
} from '@/lib/hub-chat/hub-studio-step-preview'
import {
  appendGenerationProductUrls,
  applyGenerationRefKeys,
  buildGenerationRefPickerPayload,
  pickedPackagingFaceReferenceUrls,
  resolveReferenceEntriesForUrls,
  removeGenerationProductUrl,
  resetGenerationSelectionForStep,
  resolveGenerationAttachments,
  sanitizeGenerationSelection,
  stepSupportsGenerationRefPicker,
  hasPrimaryFaceStyleReference,
} from '@/lib/hub-chat/hub-studio-generation-refs'
import { runStudioImagePipeline, uploadStudioImages } from '@/lib/hub-agent/studio-image-pipeline'
import { runLyriaPipeline } from '@/lib/hub-agent/lyria-pipeline'
import {
  buildAdvisoryPayload,
  buildStandaloneFeatureAdvisoryReply,
  buildToolCatalogForBrain,
  normalizeHubRoute,
  type HubChatPlanPayload,
  type HubChatWorkflowSuggestion,
  type HubRouteKind,
} from '@/lib/hub-chat/hub-advisory'
import {
  pgDeleteHubMessagesAfter,
  pgGetHubChatThread,
  pgGetHubThreadSession,
  pgInsertHubChatMessage,
  pgReplaceLatestHubStudioImageMessage,
  pgSaveHubThreadSession,
  pgUpdateLatestHubStudioImageUrl,
  pgUpdateHubChatMessageContent,
} from '@/lib/db/hub-chat-pg'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'
import {
  applyStepRetryRepair,
  buildDesignStepCatalog,
  buildPendingStepStudio,
  findBlockingIncompleteStep,
  inferAiRetryFromGenerationFlags,
  isDeterministicPackagingGenerator,
  isExplicitRetryIntent,
  isValidDesignStepKey,
  mergeKeywordRetryHint,
  needsStepRetryRepair,
  normalizeRetryIntent,
  resolveRetryTargetStep,
  sanitizeAiRetryHint,
  shouldExecuteDeferredDesignAction,
  shouldExecuteDesignGeneration,
  shouldForceGenerateForStep,
  shouldShowPendingRetry,
  wantsContinueNextStep,
} from '@/lib/hub-chat/hub-studio-step-retry'
import type { HubStudioAiRetryHint, HubStudioRetryIntent } from '@/lib/hub-chat/hub-studio-types'
import {
  getFaceDimensionsMm,
  parseBoxDimensions,
  type BoxDimensionsMm,
  type PackagingFaceKey,
} from '@/lib/packaging/dimensions'
import {
  buildBoxFaceConfirmSummary,
  buildPackagingFaceAspectPlan,
  faceAspectRatiosFromPlan,
  getFaceGeminiAspectRatio,
  isBoxFaceConfirmAck,
  packagingBoxConfirmStudioExtras,
} from '@/lib/packaging/face-aspect'
import {
  appendStudioUiColorPaletteToPrompt,
  formatStudioColorPaletteBriefFromSelections,
  isStudioColorPalettePickerStep,
  normalizeStudioColorSelections,
  resolveStudioColorSelections,
  studioColorPaletteUserLabel,
  studioColorSelectionHasPrimary,
  type StudioColorSelection,
} from '@/lib/hub-chat/studio-color-palette'
import {
  applyMobileShopStyleAnchorReference,
  isMobileShopContinueOnlyApproveStep,
  isMobileShopUiStyleAnchorStep,
  shouldKeepMobileShopReferenceOnApprove,
} from '@/lib/hub-chat/hub-mobile-shop-style-anchor'
import {
  findPackagingColorPaletteChoice,
  findPackagingStyleMoodChoice,
  packagingDiscoveryChoiceBrief,
  packagingDiscoveryChoiceLabel,
} from '@/lib/packaging/packaging-discovery-choices'
import {
  buildPackagingFacePromptBlock,
  collectPackagingBrandIdentifiers,
  PACKAGING_FACE_APPROVED_LOGO_RULES,
  stripBrandLogoFromPackagingFaceVisualPrompt,
  stripPackagingFaceTechnicalMeasurementsFromVisualPrompt,
} from '@/lib/packaging/face-print-prompt'
import { normalizePanelArtworkToPrintSize } from '@/lib/packaging/panel-artwork-fit'
import { formatMmSize } from '@/lib/packaging/face-crop-size'
import {
  applyStudioSessionLabels,
  applyBagSessionLabels,
  resolvePackagingStepLabel,
} from '@/lib/packaging/packaging-face-labels'
import { generateBarcodeLabelBuffer } from '@/lib/barcode/generate-barcode-label'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { invalidatePackagingFromStep } from '@/lib/packaging/session-dependencies'
import { exportAllBoxDielineVariants } from '@/lib/packaging/export-dieline'
import { exportBoxMockupFromFaces } from '@/lib/packaging/export-box-mockup'
import {
  buildProductLabelPromptBlock,
  isLogoOnlyReferenceStepKey,
  isPackagingContinueOnlyApproveStep,
  isValidFlatStickerShape,
  resolveLogoCompositeReferenceUrls,
  resolveProductLabelAspectRatio,
  resolveProductLabelShape,
  resolveSealStickerAspectRatio,
  resolveSealStickerShape,
  stripLabelTechnicalMeasurementsFromVisualPrompt,
} from '@/lib/packaging/product-label-step'
import { isValidGeminiAspectRatio } from '@/lib/label-size-presets'
import { resolveBarcodeLabelInput } from '@/lib/packaging/barcode-label-step'
import {
  exportPackagingBarcodeBundle,
  type PackagingBarcodeFormEntry,
} from '@/lib/packaging/packaging-barcode-bundle'
import {
  PACKAGING_MOCKUP_SCENE_RULES,
} from '@/lib/packaging/packaging-mockup-prompt'
import {
  applyDiscoveryBriefEdit,
  matchDiscoveryBriefEditStep,
} from '@/lib/hub-chat/hub-studio-discovery-edit'
import { isValidHubStudioMessage } from '@/lib/hub-chat/hub-studio-message'
import {
  applyInPlaceDiscoveryBriefEdit,
  inferStepKeyForUserMessage,
  isInPlaceDiscoveryBriefEdit,
  isInPlacePackagingImageEdit,
  resolveEditUserMessage,
  restoreTimelineAfterInPlaceImageEdit,
  rewindSessionForStepEdit,
} from '@/lib/hub-chat/hub-studio-step-edit'
import {
  applyReferenceRemoval,
  canNavigateToStep,
  focusSessionOnDesignStep,
  isNavigatedBackEdit,
  navigateSessionToStep,
  pendingPreviewFromApprovedReference,
} from '@/lib/hub-chat/hub-studio-step-navigate'
import {
  copySourceUrlForSlot,
  faceSlotsToCreatedFaces,
  faceSlotsToMockupFaces,
  getPackagingFaceSizeForStep,
  getPrimaryPackagingStyleFaceStepKey,
  isFirstPackagingFaceStep,
  isPackagingFaceStepKey,
  isPackagingFaceReEdit,
  packagingStepKeyToSizeKey,
  packagingStepKeyToSlot,
  parseSecondaryFaceIntent,
  allPackagingFaceSlotsCommitted,
  preparePackagingFaceSlotsForArtifact,
  resolvePackagingFaceReferenceUrl,
  syncResolvedPackagingFaces,
  type HubPackagingFaceSlotEntry,
} from '@/lib/packaging/hub-face-steps'
import { resolveDielineSlotUrls, BOX_FACE_COPY_SOURCE, getBoxFaceSlotLabel } from '@/lib/packaging/box-face-slots'
import { runFaceCropOutpaint } from '@/lib/packaging/face-crop-outpaint'
import {
  FACE_PRINT_STYLE_STEP_KEY,
  facePrintStyleBriefValue,
  facePrintStyleLabel,
  facePrintStylePromptBlock,
  packagingFacePrintStyleStudioExtras,
  parseFacePrintStyleKey,
  reconcilePackagingProcessSteps,
  resolveFacePrintStyle,
} from '@/lib/packaging/face-print-style'
import {
  ensurePackagingStyleBrief,
  formatPackagingStyleBriefBlock,
  formatPackagingColorPaletteBlock,
  resolvePackagingColorPaletteBrief,
  appendPackagingFaceOneStylePrompt,
  appendPackagingPrintLanguagePrompt,
  PACKAGING_STYLE_DISCOVERY_KEYS,
  packagingStyleDiscoveryExcludeKeys,
} from '@/lib/packaging/packaging-style-brief'
import {
  appendDesignRecreateGeneratePrompt,
  designRecreateUploadReply,
  ensureDesignRecreationBrief,
} from '@/lib/design/design-recreation-brief'
import {
  DESIGN_RECREATE_LOGO_KEY,
  reconcileDesignRecreateProcessSteps,
} from '@/lib/design/design-recreate-process-steps'
import { findDesignRecreateDiscoveryChoice } from '@/lib/design/design-discovery-choices'
import { DESIGN_RECREATE_MAX_UPLOAD, SECTOR_TEMPLATES, resolveDesignSector } from '@/lib/design/design-sector-templates'
import {
  applyDefaultPrintLanguageToBriefNotes,
  defaultPrintLanguageDetail,
  defaultPrintLanguageFields,
  findPackagingPrintLanguageChoice,
  PRINT_LANGUAGE_DETAIL_STEP_KEY,
  PRINT_LANGUAGE_STEP_KEY,
  type PackagingPrintLanguageKey,
} from '@/lib/packaging/packaging-print-language'
import {
  getBodyStripSegments,
  getBodyStripSizeMm,
} from '@/lib/packaging/body-strip'
import { splitBodyStripBuffer } from '@/lib/packaging/body-strip-server'
import {
  defaultTuckBoxProductionParams,
  normalizeTuckBoxProductionParams,
  validateTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'
import {
  generateTuckEndBlankSvg,
  getBoxDielineLayoutData,
} from '@/lib/packaging/box-net-svg'
import {
  BOX_DIELINE_STRUCTURE_KEYS,
  DEFAULT_BOX_DIELINE_STRUCTURE,
  boxDielineStructureCopy,
  parseBoxDielineStructure,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import {
  advanceBagDiscoveryAfterBriefAnswer,
  advanceAfterBagFaceStep,
  applyBagFaceSlotToSession,
  bagKitPanelConfirmStudioExtras,
  bagKitStartBriefNotes,
  bagStepKeyToSlot,
  buildBagSizeConfirmReply,
  completeBagPanelConfirmSession,
  copySourceUrlForBagSlot,
  emptyBagKitState,
  isBagFaceReEdit,
  isBagKitPreset,
  isFirstBagFaceStep,
  resolveBagFacePrintSizeMm,
  runBagDielineExport,
  runBagMockupGeneration,
} from '@/lib/hub-chat/bag-kit-handler'
import {
  formatBagBriefSize,
  isBagFaceStepKey,
  normalizeBagDimensionsMm,
  parseBagDimensions,
} from '@/lib/packaging/bag-dimensions'

export type HubStudioAction =
  | 'message'
  | 'generate_current_step'
  | 'generate_packaging_barcodes'
  | 'approve_reference'
  | 'regenerate'
  | 'upload_images'
  | 'confirm_sample_upload'
  | 'upload_logo_reference'
  | 'upload_packaging_face'
  | 'upload_generation_product'
  | 'set_generation_refs'
  | 'remove_generation_product'
  | 'start_preset'
  | 'remove_reference'
  | 'edit_step'
  | 'navigate_step'
  | 'crop_pending_image'
  | 'outpaint_crop_gaps'
  | 'revert_pending_image'
  | 'set_face_print_style'
  | 'set_print_language'
  | 'set_label_aspect_ratio'
  | 'set_label_shape'
  | 'set_banner_ad_format'
  | 'set_banner_design_setup'
  | 'upload_banner_logo'
  | 'remove_banner_logo'
  | 'upload_menu_logo'
  | 'remove_menu_logo'
  | 'select_banner_batch_item'
  | 'banner_finish_flow'
  | 'set_menu_design_setup'
  | 'menu_finish_flow'
  | 'upload_landing_logo'
  | 'remove_landing_logo'
  | 'generate_landing_logo'
  | 'set_landing_design_setup'
  | 'set_landing_publish_url'
  | 'set_landing_html_source'
  | 'confirm_box_face'
  | 'set_bag_dimensions'
  | 'confirm_bag_panel'
  | 'set_discovery_choice'
  | 'set_color_palette'
  | 'set_box_production'
  | 'set_box_dieline_structure'
  | 'skip_packaging_face'
  | 'copy_packaging_face'
  | 'classify_flow_switch'
  | 'classify_feature_intent'
  | 'select_feature'

export type HubStudioHandlerInput = {
  userId: string
  threadId: string
  locale: WebLocale
  message?: string
  action?: HubStudioAction
  presetId?: string
  featureKey?: string
  referenceScreenKey?: string
  generationRefKeys?: string[]
  productUrl?: string
  editMessageId?: string
  editStepKey?: string
  navigateStepKey?: string
  regenerateStepKey?: string
  facePrintStyle?: string
  printLanguage?: string
  printLanguageDetail?: string
  labelAspectRatio?: string
  labelShape?: string
  bannerAdPresetId?: string
  bannerAdPresetIds?: string[]
  bannerOverlayText?: string
  bannerDomainName?: string
  bannerBatchIndex?: number
  menuFormatPresetId?: string
  menuDishes?: MenuDishItem[]
  menuDishesBulkText?: string
  menuVenueName?: string
  landingSectionCopy?: string
  landingLogoBrief?: string
  landingPublishedShareUrl?: string
  landingPublishedShareToken?: string
  landingHtmlSource?: string
  discoveryChoice?: string
  discoveryChoiceStep?: string
  colorPaletteKeys?: string[]
  colorPaletteSelection?: StudioColorSelection[]
  boxDielineStructure?: string
  boxDimensionsMm?: Partial<BoxDimensionsMm>
  bagDimensionsMm?: Partial<{ width: number; height: number; gusset: number }>
  boxProduction?: Partial<TuckBoxProductionParams>
  barcodeEntries?: PackagingBarcodeFormEntry[]
  cropSizeMm?: { width: number; height: number }
  cropAspectRatio?: string
  cropScreenKey?: string
  skipUserInsert?: boolean
  apiKey: string
  uploadFiles?: { buffer: Buffer; mimeType: string }[]
}

export type HubStudioHandlerResult = {
  ok: boolean
  reply: string
  studio?: HubStudioMessagePayload
  session: HubStudioSession
  threadId: string
  chargedChat: number
  chargedImage?: number
  error?: string
  workflows?: HubChatWorkflowSuggestion[]
  plan?: HubChatPlanPayload | null
  hubRoute?: HubRouteKind
  threadMessages?: {
    id: string
    role: 'user' | 'assistant'
    content: string
    studio?: HubStudioMessagePayload | null
    createdAt?: string
  }[]
  userMessageId?: string
  flowSwitch?: {
    switchPresetId: string | null
    confidence: number
  }
  featureIntent?: {
    featureKey: string | null
    confidence: number
  }
  showFeaturePicker?: boolean
}

function isPackagingLikePreset(presetId: string | null | undefined): boolean {
  return presetId === 'packaging_kit' || presetId === 'bag_kit'
}

function langName(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

const BOX_SIZE_STEP_KEYS = ['box_size', 'box_size_length', 'box_size_width', 'box_size_height'] as const

function isBoxSizeStepKey(stepKey: string | null | undefined): boolean {
  return BOX_SIZE_STEP_KEYS.includes(stepKey as (typeof BOX_SIZE_STEP_KEYS)[number])
}

function completeBoxFaceConfirmSession(session: HubStudioSession, ackLabel: string): HubStudioSession {
  const dimensionsMm = session.packaging?.dimensionsMm
  if (!dimensionsMm) return session
  const plan = buildPackagingFaceAspectPlan(dimensionsMm)
  return {
    ...session,
    packaging: {
      ...session.packaging!,
      faceAspectRatios: faceAspectRatiosFromPlan(plan),
      facesConfirmed: true,
    },
    briefNotes: {
      ...session.briefNotes,
      box_face_confirm: ackLabel,
    },
  }
}

function advanceDiscoveryAfterBriefAnswer(
  session: HubStudioSession,
  locale: WebLocale,
  stepKey: string,
  userLabel: string,
  confirmedReply: string
): { session: HubStudioSession; reply: string; studio: HubStudioMessagePayload } {
  const presetId = session.presetId
  if (!presetId) {
    return {
      session,
      reply: confirmedReply,
      studio: { processSteps: session.processSteps },
    }
  }
  let nextSession = {
    ...session,
    briefNotes: {
      ...session.briefNotes,
      [stepKey]: userLabel,
    },
    processSteps: markStepDone(session.processSteps, stepKey),
  }
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
  } else if (
    nextSession.currentStepKey &&
    isDiscoveryStep(presetId, nextSession.currentStepKey)
  ) {
    reply = appendStepAsk(reply, locale, presetId, nextSession.currentStepKey)
  }
  nextSession = reconcileDiscoveryProgress(nextSession, locale)
  nextSession = syncDiscoveryCurrentStep(nextSession, locale)
  if (nextSession.presetId === 'packaging_kit') {
    nextSession = {
      ...nextSession,
      briefNotes: applyDefaultPrintLanguageToBriefNotes(nextSession.briefNotes, locale),
    }
  }
  const studio: HubStudioMessagePayload = {
    processSteps: nextSession.processSteps,
    ...packagingBoxConfirmStudioExtras(locale, nextSession),
    ...packagingFacePrintStyleStudioExtras(locale, nextSession),
  }
  return { session: nextSession, reply, studio }
}

function advancePackagingLikeDiscoveryAfterBriefAnswer(
  session: HubStudioSession,
  locale: WebLocale,
  stepKey: string,
  briefValue: string,
  confirmedReply: string
): { session: HubStudioSession; reply: string; studio: HubStudioMessagePayload } {
  if (isBagKitPreset(session.presetId)) {
    const advanced = advanceBagDiscoveryAfterBriefAnswer(
      session,
      locale,
      stepKey,
      briefValue,
      confirmedReply
    )
    return {
      ...advanced,
      session: applyBagSessionLabels(advanced.session, locale),
    }
  }
  return advanceDiscoveryAfterBriefAnswer(session, locale, stepKey, briefValue, confirmedReply)
}

function completeBoxSizeDiscovery(session: HubStudioSession): HubStudioSession {
  let processSteps = session.processSteps
  for (const key of BOX_SIZE_STEP_KEYS) {
    if (processSteps.some((s) => s.key === key)) {
      processSteps = markStepDone(processSteps, key)
    }
  }
  const next = nextPendingStep(processSteps)
  return {
    ...session,
    processSteps: setStepInProgress(processSteps, next?.key ?? null),
    currentStepKey: next?.key ?? null,
  }
}

function buildBoxSizeConfirmReply(
  locale: WebLocale,
  dimensionsMm: BoxDimensionsMm,
  processSteps: HubStudioProcessStep[],
  production?: TuckBoxProductionParams,
  structure?: BoxDielineStructure
): { reply: string; studio: HubStudioMessagePayload } {
  let reply = buildBoxFaceConfirmSummary(locale, dimensionsMm)
  const confirmAsk = getStepAskPrompt(locale, 'packaging_kit', 'box_face_confirm')
  if (confirmAsk && !reply.includes(confirmAsk)) reply = `${reply}\n\n${confirmAsk}`
  const studio: HubStudioMessagePayload = {
    processSteps,
  }
  if (!structure) return { reply, studio }

  const resolvedStructure = structure
  const resolvedProduction = normalizeTuckBoxProductionParams(production, dimensionsMm.height)
  const boxDimensions = {
    lengthMm: dimensionsMm.length,
    widthMm: dimensionsMm.width,
    heightMm: dimensionsMm.height,
  }
  const layout = getBoxDielineLayoutData(resolvedStructure, boxDimensions, resolvedProduction)
  studio.boxWireframeSvg = generateTuckEndBlankSvg(
    boxDimensions,
    resolvedProduction,
    locale,
    resolvedStructure
  )
  studio.boxProductionSummary = {
    netWidthMm: layout.bounds.widthMm,
    netHeightMm: layout.bounds.heightMm,
    ...resolvedProduction,
  }
  return { reply, studio }
}

function packagingBase(session: HubStudioSession): HubPackagingState {
  return session.packaging ?? { version: 2 as const, dimensionsMm: null, faces: {} }
}

/** Keep one assistant image bubble per studio screenKey — regenerate replaces instead of stacking. */
async function upsertHubStudioImageMessage(params: {
  threadId: string
  content: string
  studio?: HubStudioMessagePayload | null
  workflows?: HubChatWorkflowSuggestion[] | null
  planId?: string | null
}): Promise<void> {
  const screenKey = params.studio?.screenKey
  const imageUrl = params.studio?.imageUrl ?? params.studio?.artifactUrl
  const stackVersions = Boolean(params.studio?.stackImageVersions)
  if (screenKey && imageUrl && !stackVersions) {
    const replacedMessageId = await pgReplaceLatestHubStudioImageMessage({
      threadId: params.threadId,
      screenKey,
      content: params.content,
      studio: params.studio!,
    })
    if (replacedMessageId) return
  }
  await pgInsertHubChatMessage({
    threadId: params.threadId,
    role: 'assistant',
    content: params.content,
    studio: params.studio,
    workflows: params.workflows?.length ? params.workflows : null,
    planId: params.planId ?? null,
  })
}

function invalidatePackagingForDimensionChange(session: HubStudioSession): HubStudioSession {
  const currentStepKey = session.currentStepKey
  const invalidated = invalidatePackagingFromStep(session, 'face_top')
  return { ...invalidated, currentStepKey }
}

function formatBoxBriefSize(locale: WebLocale, box: { length: number; width: number; height: number }): string {
  const fmt = (mm: number) => {
    const cm = (mm / 10).toFixed(1)
    return locale === 'vi' ? cm.replace('.', ',') : cm
  }
  return `${fmt(box.length)} × ${fmt(box.width)} × ${fmt(box.height)} cm`
}

function boxSizeError(locale: WebLocale, kind: 'format' | 'range'): string {
  const rows = {
    vi: kind === 'format'
      ? 'Kích thước chưa đúng định dạng. Hãy nhập Dài × Rộng × Cao, ví dụ: 20 × 15 × 10 cm.'
      : 'Mỗi chiều của hộp phải lớn hơn 0.',
    en: kind === 'format'
      ? 'Invalid size format. Enter Length × Width × Height, for example: 20 × 15 × 10 cm.'
      : 'Each box dimension must be greater than 0.',
    zh: kind === 'format'
      ? '尺寸格式不正确。请输入 长×宽×高，例如：20 × 15 × 10 cm。'
      : '每个尺寸须大于 0。',
    ja: kind === 'format'
      ? 'サイズ形式が正しくありません。長さ × 幅 × 高さ（例：20 × 15 × 10 cm）で入力してください。'
      : '各辺は 0 より大きく入力してください。',
    ko: kind === 'format'
      ? '크기 형식이 올바르지 않습니다. 길이 × 너비 × 높이(예: 20 × 15 × 10 cm)로 입력하세요.'
      : '각 치수는 0보다 커야 합니다.',
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

function incompletePackagingArtworkError(locale: WebLocale, hybrid: boolean): string {
  const rows: Record<WebLocale, string> = hybrid
    ? {
        vi: 'Cần hoàn thành mặt trên, dải thân liền và mặt đáy trước khi tạo file.',
        en: 'Complete the top, continuous body strip, and bottom before creating this file.',
        zh: '请先完成顶面、连续盒身和底面，再创建文件。',
        ja: 'ファイルを作成する前に、天面・連続胴面・底面を完成してください。',
        ko: '파일을 만들기 전에 윗면, 연속 몸통, 아랫면을 완료하세요.',
      }
    : {
        vi: 'Cần hoàn thành đủ 6 mặt hộp trước khi tạo file.',
        en: 'Complete all six box faces before creating this file.',
        zh: '请先完成盒子的六个面，再创建文件。',
        ja: 'ファイルを作成する前に、箱の6面をすべて完成してください。',
        ko: '파일을 만들기 전에 상자의 6개 면을 모두 완료하세요.',
      }
  return rows[locale]
}

function dielineExportFailedError(locale: WebLocale): string {
  const rows: Record<WebLocale, string> = {
    vi: 'Không xuất được Dieline PDF. Kiểm tra ảnh 6 mặt còn tải được, rồi bấm «Tạo đầu ra bước này» lại.',
    en: 'Could not export the Dieline PDF. Make sure all six face images are still reachable, then tap «Generate output for this step» again.',
    zh: '无法导出 Dieline PDF。请确认六个面的图片仍可访问，然后再次点击「生成本步骤输出」。',
    ja: 'Dieline PDFを出力できませんでした。6面の画像が取得できるか確認し、「このステップの出力を作成」をもう一度押してください。',
    ko: 'Dieline PDF를 내보낼 수 없습니다. 6면 이미지에 접근 가능한지 확인한 뒤 «이 단계 출력 생성»을 다시 누르세요.',
  }
  return rows[locale]
}

function formatDielineExportError(locale: WebLocale, raw: string): string {
  if (/pixel limit/i.test(raw)) {
    const rows: Record<WebLocale, string> = {
      vi: 'Net Dieline quá lớn hoặc ảnh mặt quá nặng — hệ thống đã tự giảm độ phân giải nhưng vẫn chưa xuất được. Thử thu nhỏ kích thước hộp hoặc tạo lại ảnh mặt rồi thử lại.',
      en: 'The dieline net or face artwork is too large — auto downscale still failed. Try a smaller box size or regenerate face images, then retry.',
      zh: '刀模 net 或面图过大，自动降分辨率后仍无法导出。请缩小盒尺寸或重新生成面图后再试。',
      ja: 'Dieline net または面画像が大きすぎます。自動解像度調整後も出力できませんでした。箱サイズを小さくするか、面画像を作り直して再試行してください。',
      ko: 'Dieline net 또는 면 이미지가 너무 큽니다. 자동 해상도 조정 후에도 내보낼 수 없습니다. 상자 크기를 줄이거나 면 이미지를 다시 만든 뒤 재시도하세요.',
    }
    return rows[locale]
  }
  if (raw === 'export_failed' || raw.startsWith('export_failed')) {
    return dielineExportFailedError(locale)
  }
  return raw
}

function artifactCopy(locale: WebLocale, kind: 'pdf' | 'barcode', bleedMm = 3) {
  const rows = {
    vi: kind === 'pdf'
      ? {
          download: 'Tải Dieline PDF',
          note: `Cut đỏ liền, Crease xanh đứt, bleed ${bleedMm} mm. Xưởng in cần preflight theo vật liệu thực tế.`,
        }
      : {
          download: 'Tải mã vạch',
          note: 'Mã được tạo bằng thư viện barcode, có quiet zone và có thể quét; không phải hình minh họa AI.',
        },
    en: kind === 'pdf'
      ? {
          download: 'Download Dieline PDF',
          note: `Solid red Cut, dashed green Crease and ${bleedMm} mm bleed. Ask the printer to preflight for the actual stock.`,
        }
      : {
          download: 'Download barcode',
          note: 'Generated with a barcode library, with a quiet zone and scannable output; not an AI illustration.',
        },
    zh: kind === 'pdf'
      ? { download: '下载 Dieline PDF', note: `红色实线为切割，绿色虚线为压痕，出血${bleedMm}毫米。请印厂按实际纸材预检。` }
      : { download: '下载条码', note: '使用条码库生成，保留静区且可扫描；不是AI示意图。' },
    ja: kind === 'pdf'
      ? { download: 'Dieline PDFをダウンロード', note: `赤実線はカット、緑破線は折り、塗り足し${bleedMm}mmです。実際の紙材で印刷会社のプリフライトが必要です。` }
      : { download: 'バーコードをダウンロード', note: 'バーコードライブラリで生成し、クワイエットゾーンを確保した読み取り可能なデータです。AI画像ではありません。' },
    ko: kind === 'pdf'
      ? { download: 'Dieline PDF 다운로드', note: `빨간 실선은 절단, 초록 점선은 접힘, 블리드는 ${bleedMm}mm입니다. 실제 용지 기준 인쇄소 프리플라이트가 필요합니다.` }
      : { download: '바코드 다운로드', note: '바코드 라이브러리로 생성되어 여백이 확보되고 스캔할 수 있으며 AI 삽화가 아닙니다.' },
  } satisfies Record<WebLocale, { download: string; note: string }>
  return rows[locale]
}

type PackagingDielineVariantState = Partial<
  Record<BoxDielineStructure, { url: string; fileName: string }>
>

function buildPackagingDielineVariantState(
  exported: Partial<
    Record<BoxDielineStructure, { pdfUrl: string; fileName: string; resolutionDpi?: number }>
  >
): PackagingDielineVariantState {
  const variants: PackagingDielineVariantState = {}
  for (const structure of BOX_DIELINE_STRUCTURE_KEYS) {
    const item = exported[structure]
    if (!item?.pdfUrl) continue
    variants[structure] = { url: item.pdfUrl, fileName: item.fileName }
  }
  return variants
}

function buildDielineStudioArtifacts(
  locale: WebLocale,
  variants: PackagingDielineVariantState,
  bleedMm: number
): HubStudioMessagePayload['dielineArtifacts'] {
  const copy = artifactCopy(locale, 'pdf', bleedMm)
  return BOX_DIELINE_STRUCTURE_KEYS.flatMap((structure) => {
    const variant = variants[structure]
    if (!variant) return []
    const structureCopy = boxDielineStructureCopy(structure, locale)
    return [
      {
        structure,
        url: variant.url,
        fileName: variant.fileName,
        label: structureCopy.label,
        downloadLabel: copy.download,
      },
    ]
  })
}

function primaryDielineVariant(
  variants: PackagingDielineVariantState
): { url: string; fileName: string } | undefined {
  return (
    variants[DEFAULT_BOX_DIELINE_STRUCTURE] ??
    variants.cross_fold ??
    Object.values(variants).find(Boolean)
  )
}

async function exportPackagingDielineBundle(input: {
  userId: string
  packaging: HubPackagingState
}): Promise<
  | {
      variants: PackagingDielineVariantState
      resolutionDpi?: number
    }
  | { error: string }
> {
  const { userId, packaging } = input
  const dimensionsMm = packaging.dimensionsMm
  if (!dimensionsMm || !allPackagingFaceSlotsCommitted(packaging)) {
    return { error: 'incomplete_faces' }
  }
  const created = faceSlotsToCreatedFaces(packaging.faceSlots ?? {})
  const slotUrls = resolveDielineSlotUrls(created)
  try {
    const exported = await exportAllBoxDielineVariants({
      userId,
      slotUrls,
      dimensionsMm,
      bodyStripUrl:
        packaging.layout === 'hybrid_strip' ? packaging.bodyStrip?.originalUrl : undefined,
      production: packaging.production,
    })
    const variants = buildPackagingDielineVariantState(exported)
    if (BOX_DIELINE_STRUCTURE_KEYS.some((structure) => !variants[structure]?.url)) {
      return { error: 'export_failed' }
    }
    const resolutionDpi = exported[DEFAULT_BOX_DIELINE_STRUCTURE]?.resolutionDpi
    return { variants, resolutionDpi }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

function buildDielineGenerationStudio(
  locale: WebLocale,
  screenLabel: string,
  packaging: HubPackagingState,
  variants: PackagingDielineVariantState,
  processSteps: HubStudioProcessStep[],
  resolutionDpi?: number
): HubStudioMessagePayload {
  const dimensionsMm = packaging.dimensionsMm!
  const bleedMm = packaging.production?.bleedMm ?? 3
  const copy = artifactCopy(locale, 'pdf', bleedMm)
  const production = packaging.production
    ? normalizeTuckBoxProductionParams(packaging.production, dimensionsMm.height)
    : {
        ...defaultTuckBoxProductionParams(dimensionsMm.height),
        compensationGapMm: 0,
      }
  const net = getBoxDielineLayoutData(DEFAULT_BOX_DIELINE_STRUCTURE, {
    lengthMm: dimensionsMm.length,
    widthMm: dimensionsMm.width,
    heightMm: dimensionsMm.height,
  }, production)
  const dielineArtifacts = buildDielineStudioArtifacts(locale, variants, bleedMm)
  const primary = primaryDielineVariant(variants)
  return {
    processSteps,
    artifactUrl: primary?.url,
    artifactKind: 'pdf',
    artifactFileName: primary?.fileName,
    artifactLabel: screenLabel,
    artifactNote: copy.note,
    artifactDownloadLabel: copy.download,
    dielineArtifacts,
    boxProductionSummary: {
      netWidthMm: net.bounds.widthMm,
      netHeightMm: net.bounds.heightMm,
      ...production,
      resolutionDpi,
    },
  }
}

function previewKindFromGenerator(gen: StudioGeneratorKind): HubStudioPreviewKind {
  if (gen === 'lyria_music') return 'audio'
  if (gen === 'banner') return 'banner'
  if (gen === 'logo') return 'logo'
  if (gen === 'product_photo') return 'product_photo'
  if (gen === 'invitation') return 'invitation'
  if (
    gen === 'packaging' ||
    gen === 'packaging_face' ||
    gen === 'packaging_mockup' ||
    gen === 'interior' ||
    gen === 'story_panel' ||
    gen === 'infographic' ||
    gen === 'portrait'
  ) {
    return 'banner'
  }
  if (gen === 'ui_desktop') return 'ui_mockup'
  return 'ui_mockup'
}

function generatorUsesUpload(gen: StudioGeneratorKind): boolean {
  return (
    gen === 'product_photo' ||
    gen === 'portrait' ||
    gen === 'interior' ||
    gen === 'infographic' ||
    gen === 'banner'
  )
}

function aspectHintFromGenerator(
  gen: StudioGeneratorKind | null,
  presetId: string | null,
  stepKey: string
): 'portrait' | 'square' | 'landscape' {
  const form = presetId ? getStepFormFactor(presetId, stepKey) : undefined
  if (form === 'square') return 'square'
  if (form === 'desktop') return 'landscape'
  if (gen === 'logo') return 'square'
  if (gen === 'banner' || gen === 'ui_desktop' || gen === 'interior' || gen === 'infographic' || gen === 'story_panel') {
    return 'landscape'
  }
  if (gen === 'packaging' || gen === 'packaging_face' || gen === 'packaging_mockup' || gen === 'portrait') return 'portrait'
  return 'portrait'
}

function packagingFaceKeyFromStep(stepKey: string): PackagingFaceKey | null {
  return packagingStepKeyToSizeKey(stepKey)
}

function applyPackagingFaceSlotToSession(
  session: HubStudioSession,
  stepKey: string,
  entry: HubPackagingFaceSlotEntry
): HubPackagingState {
  const slot = packagingStepKeyToSlot(stepKey)
  const base = session.packaging ?? { version: 2 as const, dimensionsMm: null, faces: {} }
  if (!slot) return base
  return syncResolvedPackagingFaces({
    ...base,
    faceSlots: { ...(base.faceSlots ?? {}), [slot]: entry },
    dielineUrl: undefined,
    dielineVariants: undefined,
    mockupUrl: undefined,
  })
}

function advanceAfterPackagingFaceStep(
  session: HubStudioSession,
  stepKey: string,
  screenLabel: string,
  locale: WebLocale,
  entry: HubPackagingFaceSlotEntry,
  addReference: boolean,
  options?: { stayOnStep?: boolean }
): { session: HubStudioSession; reply: string } {
  let nextSession: HubStudioSession = {
    ...session,
    processSteps: markStepDone(session.processSteps, stepKey),
    pendingPreview: null,
    lastGenerationPrompt: null,
    packaging: applyPackagingFaceSlotToSession(session, stepKey, entry),
  }
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

function parseAiStudioFromText(text: string): ReturnType<typeof parseAiStudio> | null {
  const attempts: string[] = [text.trim()]
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) attempts.push(fenced[1].trim())
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) attempts.push(text.slice(start, end + 1))

  for (const chunk of attempts) {
    if (!chunk) continue
    try {
      return parseAiStudio(JSON.parse(chunk))
    } catch {
      /* try next chunk */
    }
  }

  const replyMatch = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (replyMatch) {
    try {
      return {
        reply: JSON.parse(`"${replyMatch[1]}"`),
        intent: 'chat',
        shouldGenerate: false,
        retryIntent: 'none',
      }
    } catch {
      return { reply: replyMatch[1], intent: 'chat', shouldGenerate: false, retryIntent: 'none' }
    }
  }
  return null
}

function sanitizeAssistantReply(reply: string): string {
  const trimmed = reply.trim()
  if (!trimmed.startsWith('{')) return reply
  const parsed = parseAiStudioFromText(trimmed)
  return parsed?.reply?.trim() || reply
}

function parseAiStudio(raw: unknown): {
  reply: string
  intent: HubStudioIntent
  projectTitle?: string
  processSteps?: { key: string; label: string }[]
  currentStepKey?: string
  generationPrompt?: string
  shouldGenerate: boolean
  briefUpdates?: Record<string, string>
  completeCurrentStep?: boolean
  retryIntent: HubStudioRetryIntent
  retryStepKey?: string
  suggestedPresetId?: string
  hubRoute?: HubRouteKind
  workflows?: unknown
  plan?: unknown
} {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const intent = String(row.intent ?? 'chat') as HubStudioIntent
  const stepsRaw = row.processSteps
  const processSteps = Array.isArray(stepsRaw)
    ? stepsRaw
        .map((s) => {
          const x = s as Record<string, unknown>
          return { key: String(x.key ?? '').trim(), label: String(x.label ?? '').trim() }
        })
        .filter((s) => s.key && s.label)
    : undefined

  const briefUpdatesRaw = row.briefUpdates
  const briefUpdates =
    briefUpdatesRaw && typeof briefUpdatesRaw === 'object'
      ? Object.fromEntries(
          Object.entries(briefUpdatesRaw as Record<string, unknown>)
            .map(([k, v]) => [k, String(v ?? '').trim()])
            .filter(([, v]) => v)
        )
      : undefined

  return {
    reply: String(row.reply ?? '').trim(),
    intent: ['plan_process', 'ask_requirements', 'generate_ui', 'clarify', 'chat'].includes(intent)
      ? intent
      : 'chat',
    projectTitle: String(row.projectTitle ?? '').trim() || undefined,
    processSteps,
    currentStepKey: String(row.currentStepKey ?? '').trim() || undefined,
    generationPrompt: String(row.generationPrompt ?? '').trim() || undefined,
    shouldGenerate: row.shouldGenerate === true,
    briefUpdates,
    completeCurrentStep: row.completeCurrentStep === true,
    retryIntent: normalizeRetryIntent(row.retryIntent),
    retryStepKey: String(row.retryStepKey ?? '').trim() || undefined,
    suggestedPresetId: String(row.suggestedPresetId ?? '').trim() || undefined,
    hubRoute: normalizeHubRoute(row.hubRoute),
    workflows: row.workflows,
    plan: row.plan,
  }
}

function setStepInProgress(steps: HubStudioProcessStep[], key: string | null): HubStudioProcessStep[] {
  if (!key) return steps
  return steps.map((s) => ({
    ...s,
    status: s.key === key ? 'in_progress' : s.status === 'done' ? 'done' : 'pending',
  }))
}

function markStepDone(steps: HubStudioProcessStep[], key: string): HubStudioProcessStep[] {
  return steps.map((s) => (s.key === key ? { ...s, status: 'done' as const } : s))
}

function nextPendingStep(steps: HubStudioProcessStep[]): HubStudioProcessStep | null {
  return steps.find((s) => s.status !== 'done') ?? null
}

function stepLabel(session: HubStudioSession, key: string | null, locale: WebLocale): string {
  return resolvePackagingStepLabel(
    session.processSteps,
    key,
    locale,
    session.presetId,
    session.packaging?.dimensionsMm ?? null,
    session.bagKit?.dimensionsMm ?? null
  )
}

function applyMatchedPreset(session: HubStudioSession): HubStudioSession {
  /** Preset selection is AI-only — see applySuggestedPreset after callStudioBrain. */
  return session
}

function presetCatalogForBrain(locale: WebLocale): string {
  return buildPresetCatalogForBrain(locale)
}

function appendBriefToPrompt(
  session: HubStudioSession,
  prompt: string,
  screenKey?: string | null,
  excludeKeys?: string[]
): string {
  const exclude = new Set(excludeKeys ?? [])
  const notes =
    screenKey && session.presetId
      ? Object.entries(briefNotesForStepGeneration(session.presetId, screenKey, session.briefNotes))
      : Object.entries(session.briefNotes)
  const filtered = notes.filter(([k]) => !exclude.has(k))
  if (!filtered.length) return prompt
  const block = filtered.map(([k, v]) => `- ${k}: ${v}`).join('\n')
  return `${prompt}\n\nCollected brand brief:\n${block}`
}

function buildDesignPromptFromMessage(
  session: HubStudioSession,
  presetId: string,
  stepKey: string,
  message: string,
  locale: WebLocale
): string {
  const label = stepLabel(session, stepKey, locale)
  const userBrief = session.briefNotes[stepKey] || message
  const askHint = getStepAskPrompt(locale, presetId, stepKey)
  return `Design: ${label}
User requirements: ${userBrief}
${askHint ? `Step context: ${askHint}` : ''}
Project: ${session.projectTitle || presetTitle(locale, presetId)}`
}

function shouldForceGenerateDesign(
  session: HubStudioSession,
  presetId: string | null,
  stepKey: string | null,
  message: string,
  onDiscovery: boolean,
  explicitRetryStep: string | null,
  aiHint?: HubStudioAiRetryHint,
  options?: { skipSameTurnDesignEntry?: boolean; locale?: WebLocale }
): boolean {
  if (!presetId || !stepKey) return false
  return shouldForceGenerateForStep(
    session,
    presetId,
    stepKey,
    message,
    onDiscovery,
    explicitRetryStep,
    aiHint,
    options
  )
}

function appendStepAsk(reply: string, locale: WebLocale, presetId: string, stepKey: string): string {
  return appendFirstStepAsk(reply, locale, presetId, stepKey)
}

async function callStudioBrain(
  apiKey: string,
  userId: string,
  locale: WebLocale,
  message: string,
  session: HubStudioSession
): Promise<ReturnType<typeof parseAiStudio>> {
  const lang = langName(locale)
  const preset = session.presetId ? getStudioPreset(session.presetId) : null
  const onDiscovery =
    session.presetId && session.currentStepKey
      ? isDiscoveryStep(session.presetId, session.currentStepKey)
      : false
  const designSteps = session.presetId
    ? buildDesignStepCatalog(locale, session.presetId, session)
    : []
  const sessionJson = JSON.stringify({
    presetId: session.presetId,
    projectTitle: session.projectTitle,
    processSteps: session.processSteps,
    currentStepKey: session.currentStepKey,
    discoveryComplete: session.discoveryComplete,
    onDiscoveryStep: onDiscovery,
    briefNotes:
      session.presetId && session.currentStepKey && isLogoDesignStep(session.presetId, session.currentStepKey)
        ? briefNotesForStepGeneration(session.presetId, session.currentStepKey, session.briefNotes)
        : session.briefNotes,
    designSteps,
    referenceImages: session.referenceImages.map((r) => ({ label: r.screenLabel, key: r.screenKey })),
    referenceImagesCount: session.referenceImages.length,
    uploadImagesCount: session.uploadImages.length,
    needsUpload: preset?.needsUpload && !session.uploadImages.length,
    pendingPreview: session.pendingPreview?.screenLabel ?? null,
    pendingPreviewStepKey: session.pendingPreview?.screenKey ?? null,
  })

  const { catalogJson } = buildToolCatalogForBrain(locale)
  const featureFlowCatalog = buildFullFeatureCatalogForBrain(locale)

  const sys = `You are NanoAI Hub — one unified assistant. Classify EVERY user message with hubRoute, then respond appropriately. Server applies PROGRAMMATIC routing when user taps a featureKey chip — when intent is ambiguous YOU must NOT guess presetId or href.

Reply in ${lang}.

FULL FEATURE CATALOG (every featureKey is a chip in UI; user taps → server routes without AI):
${featureFlowCatalog}

Inline design presets summary (studio:* keys — flow=studio_complete):
${presetCatalogForBrain(locale)}

Standalone tools summary (tool:* href keys — flow=standalone_open_tool):
${catalogJson}

Current session:
${sessionJson}

Respond with ONLY valid JSON:
{
  "hubRoute": "design" | "consultation" | "workflow" | "pipeline",
  "reply": "conversational message in ${lang}",
  "intent": "plan_process" | "ask_requirements" | "generate_ui" | "clarify" | "chat",
  "suggestedPresetId": "preset id when starting inline design, else empty string",
  "projectTitle": "short project name if known",
  "currentStepKey": "keep current unless advancing",
  "generationPrompt": "detailed English VISUAL instructions ONLY when generating; preserve every user-supplied string that must be printed verbatim in its original language inside quotation marks",
  "shouldGenerate": true/false,
  "briefUpdates": { "step_key": "user answer summary for current discovery step" },
  "completeCurrentStep": true/false,
  "retryIntent": "none" | "create" | "regenerate" | "recover_flow" | "continue_next",
  "retryStepKey": "exact key from designSteps catalog, or empty string",
  "workflows": [{ "href": "/from-catalog", "labelKey": "...", "label": "...", "reason": "...", "prefillPrompt": "...", "confidence": 0.0-1.0 }],
  "plan": { "title": "...", "steps": [{ "href": "...", "labelKey": "...", "label": "...", "prefillPrompt": "...", "reason": "..." }] }
}

HUB ROUTE (classify first — mandatory):
- "design": user wants INLINE step-by-step design in this chat (app UI, logo, banner set, packaging flow, etc.). Use suggestedPresetId + studio fields. workflows/plan usually empty.
- "consultation": general advice, questions about NanoAI, how-to, pricing, which approach — answer in reply; optional workflows 0-2 if a single tool helps. Do NOT start design preset unless user clearly wants inline design.
- "workflow": user needs ONE standalone tool page (try-on, sharpen, curriculum…). Fill workflows 1-3 items from catalog; hubRoute workflow. Banner quảng cáo → hubRoute "design" + suggestedPresetId sale_banner (NOT /tao-banner).
- "pipeline": user needs MULTI-STEP plan across 2-6 different tools in order (e.g. studio banner → sharpen → upload). Fill plan.steps 2-6 ordered; hubRoute pipeline.
- When session presetId is set and user continues the inline project: hubRoute MUST stay "design" unless they explicitly ask only for tool advice (then consultation + keep reply short).
- When session presetId is null and message fits inline preset: hubRoute "design" + suggestedPresetId.
- Tư vấn / consultation is a valid intent — use hubRoute "consultation", not a separate UI mode.
- FEATURE FLOW: If intent matches flow=studio_complete → hubRoute "design" + suggestedPresetId. If intent matches flow=standalone_open_tool only → hubRoute "workflow" (or "consultation" with workflows) and href from catalog; NEVER suggestedPresetId.
- Standalone tools without a complete inline flow MUST appear in workflows so the user can confirm opening the tool page.
- AMBIGUOUS INTENT: If you cannot pick exactly ONE featureKey with high confidence, set intent "clarify", hubRoute "consultation", suggestedPresetId empty, workflows empty. Reply briefly and tell the user to tap the matching feature chip below (list 3-6 closest labels from FULL FEATURE CATALOG). Server shows all feature chips — do NOT invent featureKey values.
- When user message is only a feature name matching one catalog label exactly, you MAY set the matching suggestedPresetId or workflow href — but chip tap uses server programmatic routing without you.

PRESET / PROJECT INTENT (hubRoute "design"):
- When session presetId is null: infer what the user wants to create from ANY natural wording (all languages, typos, short replies).
- Set suggestedPresetId to exactly one id from the preset library when intent is clear.
- intent "plan_process" or "ask_requirements": user wants to start a multi-step inline design flow — set suggestedPresetId, explain briefly in reply, do NOT generate images yet.
- intent "clarify": user wants design help but preset is ambiguous — suggestedPresetId empty, workflows empty; ask user to pick a feature chip from FULL FEATURE CATALOG.
- intent "chat": unrelated to starting a design flow — suggestedPresetId empty.
- When presetId is already set: suggestedPresetId must be empty string (do not switch preset mid-flow unless user explicitly asks to change project type — then clarify first).
- Examples: "thiết kế app bán quần áo" → mobile_shop; "làm bao bì mỹ phẩm" → packaging_kit; "banner quảng cáo", "google ads banner" → sale_banner; "thiết kế menu quán ăn", "thực đơn cafe" → food_menu; "phòng khách japandi" → interior_design; "bộ post instagram" → social_media_kit; "truyện tranh cho bé" → story_with_images; "tóm tắt sách thành slide" → infographic_series; "campaign lookbook hè" → fashion_campaign; ANY phrase with both "lại" + "thiết kế" (e.g. "tạo lại bản thiết kế", "dựng lại thiết kế", "làm lại thiết kế", "thiết kế lại") OR "concept sheet từ ảnh" / "làm giống mẫu sản phẩm" → design_recreate (do NOT ask which design — start design_recreate immediately); "ảnh thẻ linkedin" → profile_photo_pack; ANY invitation intent ("thiết kế thiệp mời", "tạo thiệp cưới", "thiệp mời") → hubRoute "workflow" + tool /tao-thiep-moi-cuoi-ai (NOT inline studio preset).

RETRY / FLOW INTENT (YOU must classify — server does NOT parse fixed phrases):
- Understand ANY natural wording (Vietnamese, English, voice-style, typos, short replies).
- retryIntent "continue_next": user wants to move on to the NEXT design step after the previous one was OK / approved / done. Examples (non-exhaustive): "tiếp theo", "ok rồi", "đi tiếp", "next", "xong bước này", "làm bước sau", "continue". currentStepKey should already be the NEXT step. shouldGenerate false unless the same message also fully describes the CURRENT step. retryStepKey MUST be empty. NEVER target an already-approved step.
- retryIntent "create": generate a step that has NO approved output yet.
- retryIntent "regenerate": user wants a NEW version of a specific step (even if already approved).
- retryIntent "recover_flow": flow is broken/stuck — pick FIRST incomplete design step from designSteps.
- retryIntent "none": normal chat / describing current step requirements.
- retryStepKey: exact "key" from designSteps when retryIntent is create/regenerate/recover_flow; empty for continue_next.
- NEVER set retryStepKey to a step with status "done" that is in referenceImages unless retryIntent is "regenerate".
- When pendingPreviewStepKey matches a step and user wants to continue: retryIntent "continue_next" means they should approve first — reply should remind them; shouldGenerate false.

CRITICAL — continue vs recreate:
- After user approved mobile homepage and currentStepKey is home_desktop: "tiếp theo", "ok", "làm tiếp" → continue_next, generate desktop ONLY when user describes desktop (or shouldGenerate true with generationPrompt for home_desktop).
- Do NOT set retryStepKey to home_mobile if home_mobile is done + in referenceImages.

CRITICAL RULES:
- NEVER shouldGenerate true on discovery/brief steps (steps without image generator).
- On discovery steps ONLY: set completeCurrentStep true when user answered the CURRENT discovery step; NEVER set completeCurrentStep on design steps (logo, ui screens) — design steps advance only after user approves generated image.
- When user wants to CORRECT a previous brief/discovery answer (e.g. "sửa lại màu", "đổi màu sắc", "change color", or sends a new color answer while on Logo step): set completeCurrentStep false, shouldGenerate false — server will update the earlier brief field and keep flow position.
- When completeCurrentStep advances from the LAST discovery step to the FIRST design step (e.g. color_palette → logo): shouldGenerate MUST be false — the user's message was the brief answer, NOT logo/design requirements. Ask the design step question only; wait for the NEXT user message to generate.
- DISCOVERY ORDER: follow processSteps strictly in order — never skip a brief step (e.g. packaging_kit: brand_name → product_type → box_size → box_face_confirm → style_mood → color_palette → face_print_style). On product_type, user also picks print_language (vi/en/bilingual/other) via UI chips — default from UI locale; stored in briefNotes.print_language. Box dimensions: user enters length × width × height freely (thin boxes OK); each face image uses the closest Gemini aspect ratio to real mm size. Print content and product images are entered when creating each box face (face_top, face_front, face_right, face_bottom, face_back, face_left) in that exact order. The selected face_print_style is the visual art treatment (realistic photography / line art / flat illustration / watercolour abstract), not whether product images are included. Apply it consistently to all 6 faces together with approved references, style mood and color palette. Ask ONLY the current step question; use the exact ask text from the preset when possible.
- NEVER set currentStepKey to a later discovery step before all earlier discovery steps are done.
- LOGO STEP — two paths: (A) User already has a logo file → they upload via UI; shouldGenerate false, do not generate. (B) User describes logo to create → intent generate_ui, shouldGenerate true IMMEDIATELY — do not ask "ready to see?" or wait for confirmation.
- If user says they already have a logo / will upload / has logo file: shouldGenerate false; remind them to use the logo upload button in chat.
- When user wants to create/regenerate ANY design step (any wording): set retryIntent + retryStepKey; shouldGenerate true if requirements are clear enough to generate.
- ACTION EXECUTION (mandatory): If the user asks to create, generate, regenerate, remake, or run ANY design step, you MUST set shouldGenerate true AND retryIntent (create or regenerate) AND retryStepKey. The server executes immediately — NEVER reply with only "I will do it" / "understood" without shouldGenerate true. Text-only acknowledgments without execution flags are forbidden when the user requested an action.
- NEVER set retryStepKey to a step that is already approved/done (status done + in referenceImages) unless retryIntent is "regenerate".
- When user says they want the NEXT step (continue_next): retryIntent "continue_next", retryStepKey empty — stay on currentStepKey and ask for that step OR shouldGenerate for currentStepKey only if they described it.
- If pendingPreview exists for current step, user must approve it before moving on — do not shouldGenerate for the same step again (EXCEPT box_dieline_pdf / box_mockup_3d: user "tạo/tạo lại" → shouldGenerate true, retryIntent create/regenerate — server composites immediately).
- When user describes any design step with clear requirements: shouldGenerate true, fill generationPrompt from user description.
- PACKAGING FACE steps (face_top → … → face_left): generate ONE flat 2D print artwork per face — full bleed edge-to-edge, artwork fills 100% of canvas, like a pre-press PNG before folding. FORBIDDEN: 3D box on grey studio background, margins around a small box, drop shadow, perspective mockup. User text IS the design brief when they describe printable content — intent generate_ui, shouldGenerate true, generationPrompt in English. ANY face may be left blank (shouldGenerate false). Secondary faces may copy primary without generating. Dieline PDF and 3D mockup are LATER separate steps.
- PACKAGING TEXT LANGUAGE LOCK: translate only visual directions into English. Copy every brand name, product name, slogan, ingredient, instruction, warning, address, and other text the user wants printed EXACTLY from the user's message, keep its original language, and put it in quotation marks inside generationPrompt. NEVER translate, transliterate, rewrite, spell-correct, or summarize print copy. For auto-generated packaging copy (when user did not supply exact wording), follow briefNotes.print_language (vi/en/bilingual/other).
- product_label / seal_sticker: flat peel-and-stick LABEL or tamper seal artwork (NOT box dieline). Both steps: user picks Gemini aspect ratio + die-cut shape (round/square/rectangle/ellipse) + types copy. Reference attachment is LOGO ONLY — never box face images.
- barcode_label: real scannable barcode (Code128 default) — encode product code/SKU; label header shows brand name + product name from brief. User may specify EAN-13/UPC/QR explicitly.
- box_dieline_pdf: server builds technical PDF from committed 6 face slots — user "tạo dieline/pdf" → shouldGenerate true, retryIntent create, no confirmation question.
- box_mockup_3d: server composites isometric mockup from 6 face images (no AI image gen). User "tạo mockup 3d" → shouldGenerate true, retryIntent create — do NOT ask "bạn muốn tạo ngay chứ?".
- Do NOT generate images/music until discoveryComplete is true AND current step is a design step AND user gave enough detail for THAT design step.
- LOGO-FIRST RULE: If preset has a logo step, complete logo BEFORE any ui_mockup/ui_desktop screens. Never skip logo.
- After logo is approved as reference, ALL later UI screens must use logo reference in generationPrompt (logo in header/nav, brand colors).
- When referenceImagesCount > 0, generationPrompt must match attached references; logo reference must be embedded on UI screens.
- After user approved a screen and describes the NEXT screen (currentStepKey), treat as design input: if description is clear enough, intent generate_ui, shouldGenerate true.
- Do NOT generate until user describes the current design step (except when regenerating).
- Include collected briefNotes in generationPrompt context when generating.
- For banner steps: respect platform aspect ratio in generationPrompt (Google Display → AI 16:9, Facebook 1:1, Story 9:16).
- For lyria_music: generationPrompt = mood, tempo, instruments; instrumental only.
- For hubRoute workflow/pipeline: href MUST match catalog exactly; prefillPrompt in ${lang}.
- NEVER tell user to open another page for INLINE design steps — inline design stays in chat.
- generationPrompt visual instructions must be in English, but literal text to print must remain verbatim in the user's original language.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0.35, maxOutputTokens: 1800, responseMimeType: 'application/json' },
  })
  const r = await model.generateContent([{ text: `${sys}\n\nUser:\n${message}` }])
  await trackFromUsageMetadata(r.response.usageMetadata, GEMINI_25_FLASH_NO_THINKING.model, 'hub-chat-studio', userId)

  const text = r.response.text()?.trim() ?? ''
  const parsed = parseAiStudioFromText(text)
  if (parsed) {
    if (parsed.suggestedPresetId && !isValidStudioPresetId(parsed.suggestedPresetId)) {
      parsed.suggestedPresetId = undefined
    }
    if (parsed.retryStepKey && session.presetId && !isValidDesignStepKey(session.presetId, parsed.retryStepKey)) {
      parsed.retryStepKey = undefined
    }
    return parsed
  }
  return { reply: text || '...', intent: 'chat', shouldGenerate: false, retryIntent: 'none' }
}

async function generateAsset(
  userId: string,
  session: HubStudioSession,
  generationPrompt: string,
  screenKey: string,
  screenLabel: string,
  locale: WebLocale
): Promise<{ session: HubStudioSession; studio: HubStudioMessagePayload; chargedImage: number; error?: string }> {
  const effectiveScreenKey =
    session.presetId === 'landing_page'
      ? normalizeLandingDesignStepKey(screenKey) ?? screenKey
      : screenKey
  const isLandingFull =
    session.presetId === 'landing_page' && effectiveScreenKey === 'landing_full'
  const generator = session.presetId
    ? getStepGenerator(session.presetId, effectiveScreenKey)
    : ('ui_mockup' as StudioGeneratorKind)
  let workSession = session
  if (
    session.presetId === 'packaging_kit' &&
    (generator === 'packaging_mockup' || generator === 'dieline_pdf')
  ) {
    workSession = {
      ...session,
      packaging: preparePackagingFaceSlotsForArtifact({
        packaging: session.packaging,
        referenceImages: session.referenceImages,
        processSteps: session.processSteps,
      }),
    }
  }
  if (!generator) {
    const t = getDictionary(locale).hubChat
    return {
      session: workSession,
      studio: { processSteps: workSession.processSteps },
      chargedImage: 0,
      error: t.studioDiscoveryBlocked,
    }
  }

  const t = getDictionary(locale).hubChat
  const skipLogoGate =
    generator === 'packaging_mockup' ||
    generator === 'dieline_pdf' ||
    generator === 'bag_dieline_pdf' ||
    generator === 'barcode'
  if (
    workSession.presetId &&
    !skipLogoGate &&
    isStepAfterPrimaryLogo(workSession.presetId, screenKey) &&
    !primaryLogoApproved(workSession.processSteps, workSession.presetId)
  ) {
    return {
      session: workSession,
      studio: { processSteps: workSession.processSteps },
      chargedImage: 0,
      error: t.studioLogoFirst,
    }
  }
  if (
    workSession.presetId &&
    !skipLogoGate &&
    isStepAfterPrimaryLogo(workSession.presetId, screenKey) &&
    !hasPrimaryLogoReference(workSession.referenceImages, workSession.presetId)
  ) {
    return {
      session: workSession,
      studio: { processSteps: workSession.processSteps },
      chargedImage: 0,
      error: t.studioNeedLogoReference,
    }
  }

  if (generator === 'bag_dieline_pdf') {
    const exported = await runBagDielineExport({
      userId,
      locale,
      session: workSession,
      screenKey,
      screenLabel,
      generationPrompt,
    })
    if (!exported.ok) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error:
          exported.error === 'incomplete_faces'
            ? incompletePackagingArtworkError(locale, false)
            : exported.error,
      }
    }
    return {
      session: exported.session,
      studio: exported.studio,
      chargedImage: 0,
    }
  }

  if (generator === 'dieline_pdf') {
    const dimensionsMm = workSession.packaging?.dimensionsMm
    if (!dimensionsMm || !allPackagingFaceSlotsCommitted(workSession.packaging)) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: incompletePackagingArtworkError(
          locale,
          workSession.packaging?.layout === 'hybrid_strip'
        ),
      }
    }
    try {
      const bundle = await exportPackagingDielineBundle({
        userId,
        packaging: workSession.packaging!,
      })
      if ('error' in bundle) {
        if (bundle.error === 'incomplete_faces') {
          return {
            session: workSession,
            studio: { processSteps: workSession.processSteps },
            chargedImage: 0,
            error: incompletePackagingArtworkError(
              locale,
              workSession.packaging?.layout === 'hybrid_strip'
            ),
          }
        }
        throw new Error(formatDielineExportError(locale, bundle.error === 'export_failed' ? 'export_failed' : bundle.error))
      }
      const primary = primaryDielineVariant(bundle.variants)
      if (!primary?.url) {
        return {
          session: workSession,
          studio: { processSteps: workSession.processSteps },
          chargedImage: 0,
          error: dielineExportFailedError(locale),
        }
      }
      const dielinePackaging = {
        ...workSession.packaging!,
        dielineUrl: primary?.url,
        dielineVariants: bundle.variants,
      }
      const pending: HubStudioSession['pendingPreview'] = {
        screenKey,
        screenLabel,
        url: primary?.url ?? '',
        generationPrompt,
      }
      const nextSession: HubStudioSession = {
        ...workSession,
        pendingPreview: pending,
        lastGenerationPrompt: generationPrompt,
        packaging: dielinePackaging,
      }
      return {
        session: nextSession,
        studio: {
          ...buildDielineGenerationStudio(
            locale,
            screenLabel,
            dielinePackaging,
            bundle.variants,
            workSession.processSteps,
            bundle.resolutionDpi
          ),
          screenKey,
          screenLabel,
          showRegenerate: true,
          showApproveReference: true,
        },
        chargedImage: 0,
      }
    } catch (error) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: error instanceof Error ? formatDielineExportError(locale, error.message) : String(error),
      }
    }
  }

  if (generator === 'packaging_mockup') {
    if (isBagKitPreset(workSession.presetId)) {
      const exported = await runBagMockupGeneration({
        userId,
        locale,
        session: workSession,
        screenKey,
        screenLabel,
        generationPrompt,
      })
      if (!exported.ok) {
        return {
          session: workSession,
          studio: { processSteps: workSession.processSteps },
          chargedImage: 0,
          error:
            exported.error === 'incomplete_faces'
              ? incompletePackagingArtworkError(locale, false)
              : exported.error,
        }
      }
      return {
        session: exported.session,
        studio: exported.studio,
        chargedImage: exported.chargedImage,
      }
    }
    const dimensionsMm = workSession.packaging?.dimensionsMm
    if (!dimensionsMm || !allPackagingFaceSlotsCommitted(workSession.packaging)) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: incompletePackagingArtworkError(
          locale,
          workSession.packaging?.layout === 'hybrid_strip'
        ),
      }
    }
    const faceSlots = workSession.packaging!.faceSlots ?? {}
    const created = faceSlotsToMockupFaces(faceSlots)
    try {
      const exported = await exportBoxMockupFromFaces({
        userId,
        faces: created,
        faceSlots,
        dimensionsMm,
      })
      const pending: HubStudioSession['pendingPreview'] = {
        screenKey,
        screenLabel,
        url: exported.pngUrl,
        generationPrompt,
      }
      const nextSession: HubStudioSession = {
        ...workSession,
        pendingPreview: pending,
        lastGenerationPrompt: generationPrompt,
        packaging: {
          ...workSession.packaging!,
          mockupUrl: exported.pngUrl,
        },
      }
      return {
        session: nextSession,
        studio: {
          imageUrl: exported.pngUrl,
          screenKey,
          screenLabel,
          previewKind: previewKindFromGenerator(generator),
          aspectHint: aspectHintFromGenerator(generator, workSession.presetId, screenKey),
          processSteps: nextSession.processSteps,
          showRegenerate: true,
          showApproveReference: generatorSupportsReference(generator),
          imageCharged: 0,
        },
        chargedImage: 0,
      }
    } catch (error) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (generator === 'barcode') {
    try {
      const barcodeInput = resolveBarcodeLabelInput(session, generationPrompt)
      const buffer = await generateBarcodeLabelBuffer({
        type: barcodeInput.type,
        content: barcodeInput.content,
        brandName: barcodeInput.brandName,
        productName: barcodeInput.productName,
        productCode: barcodeInput.productCode,
      })
      const fileName = `barcode-${barcodeInput.type}-${Date.now()}.png`
      const { publicUrl } = await uploadTryOnImagePublic(
        `results/${userId}/${fileName}`,
        buffer,
        { contentType: 'image/png', upsert: true }
      )
      const nextSession: HubStudioSession = {
        ...session,
        pendingPreview: {
          screenKey,
          screenLabel,
          url: publicUrl,
          generationPrompt,
        },
        lastGenerationPrompt: generationPrompt,
      }
      const copy = artifactCopy(locale, 'barcode')
      return {
        session: nextSession,
        studio: {
          imageUrl: publicUrl,
          artifactUrl: publicUrl,
          artifactKind: 'barcode',
          artifactFileName: fileName,
          artifactLabel: screenLabel,
          artifactNote: copy.note,
          artifactDownloadLabel: copy.download,
          screenKey,
          screenLabel,
          previewKind: 'banner',
          aspectHint: 'square',
          processSteps: nextSession.processSteps,
          showRegenerate: true,
          showApproveReference: true,
        },
        chargedImage: 0,
      }
    } catch (error) {
      return {
        session,
        studio: { processSteps: session.processSteps },
        chargedImage: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const previewKind = previewKindFromGenerator(generator)
  const aspectHint = aspectHintFromGenerator(generator, session.presetId, screenKey)

  if (generator === 'packaging_face' && workSession.presetId === 'packaging_kit') {
    const ensured = await ensurePackagingStyleBrief(userId, workSession)
    if (ensured.error) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: ensured.error,
      }
    }
    workSession = ensured.session
  }
  if (generator === 'packaging_face' && isBagKitPreset(workSession.presetId)) {
    const ensured = await ensurePackagingStyleBrief(userId, workSession)
    if (ensured.error) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: ensured.error,
      }
    }
    workSession = ensured.session
  }
  if (workSession.presetId === 'design_recreate') {
    const ensured = await ensureDesignRecreationBrief(userId, workSession)
    workSession = ensured.session
    if (!workSession.uploadImages.length) {
      const t = getDictionary(locale).hubChat
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps, needsUpload: true },
        chargedImage: 0,
        error: t.studioNeedUpload,
      }
    }
  }

  const { referenceUrls: pickedRefs, productUrls: pickedProducts } = resolveGenerationAttachments(
    workSession,
    workSession.presetId,
    generator,
    screenKey
  )
  let refUrls =
    pickedRefs.length > 0
      ? pickedRefs
      : generator === 'packaging_face' && workSession.presetId
        ? pickedPackagingFaceReferenceUrls(workSession, workSession.presetId, screenKey)
        : pickedReferenceUrls(workSession.referenceImages, workSession.presetId, screenKey)
  let productUrls = [
    ...pickedProducts,
    ...(generatorUsesUpload(generator) ? workSession.uploadImages : []),
  ]
  const logoStepKey = workSession.presetId ? getPrimaryLogoStepKey(workSession.presetId) : null
  const hasApprovedLogoRef = Boolean(
    logoStepKey &&
      refUrls.some((url) =>
        workSession.referenceImages.some((r) => r.url === url && r.screenKey === logoStepKey)
      )
  )
  let faceVisualPrompt = generationPrompt
  let briefExcludeKeys: string[] | undefined
  if (generator === 'packaging_face' && hasApprovedLogoRef) {
    const brandNames = collectPackagingBrandIdentifiers(workSession.briefNotes, workSession.projectTitle)
    faceVisualPrompt = stripBrandLogoFromPackagingFaceVisualPrompt(faceVisualPrompt, brandNames)
    briefExcludeKeys = ['brand_name', ...(logoStepKey ? [logoStepKey] : [])]
  }
  if (generator === 'packaging_face') {
    const isFirstFace = isBagKitPreset(workSession.presetId)
      ? isFirstBagFaceStep(screenKey)
      : isFirstPackagingFaceStep(screenKey)
    briefExcludeKeys = [
      ...(briefExcludeKeys ?? []),
      ...(isFirstFace
        ? [...PACKAGING_STYLE_DISCOVERY_KEYS]
        : packagingStyleDiscoveryExcludeKeys(workSession)),
    ]
  }

  let labelHasLogoComposite = false
  if (isLogoOnlyReferenceStepKey(screenKey)) {
    refUrls = resolveLogoCompositeReferenceUrls(workSession, workSession.presetId)
    productUrls = []
    labelHasLogoComposite = refUrls.length > 0
    if (labelHasLogoComposite) {
      const brandNames = collectPackagingBrandIdentifiers(workSession.briefNotes, workSession.projectTitle)
      faceVisualPrompt = stripBrandLogoFromPackagingFaceVisualPrompt(faceVisualPrompt, brandNames)
      briefExcludeKeys = ['brand_name', ...(logoStepKey ? [logoStepKey] : [])]
    }
  }

  let fullPrompt = appendReferenceContext(
    workSession,
    isLandingFull
      ? faceVisualPrompt
      : appendBriefToPrompt(workSession, faceVisualPrompt, effectiveScreenKey, briefExcludeKeys),
    workSession.presetId,
    {
      generator,
      attachedRefUrls: refUrls,
      targetStepKey: effectiveScreenKey,
      hasProductRefs: productUrls.length > 0,
    }
  )
  let aspectRatio = workSession.presetId
    ? getStepAspectRatio(workSession.presetId, effectiveScreenKey)
    : undefined
  if (isLandingFull && !aspectRatio) {
    aspectRatio = '1:4'
  }
  if (generator === 'banner' && workSession.presetId === 'sale_banner' && workSession.bannerAd?.aspectRatio) {
    aspectRatio = normalizeBannerAspectRatioForGemini(workSession.bannerAd.aspectRatio)
  }
  if (generator === 'banner' && workSession.presetId === 'food_menu' && workSession.foodMenu?.aspectRatio) {
    aspectRatio = normalizeBannerAspectRatioForGemini(workSession.foodMenu.aspectRatio)
  }
  if (workSession.presetId === 'design_recreate') {
    fullPrompt = appendDesignRecreateGeneratePrompt(fullPrompt, workSession, effectiveScreenKey)
    if (effectiveScreenKey === 'concept_sheet') {
      const sector = resolveDesignSector(workSession.briefNotes)
      aspectRatio = SECTOR_TEMPLATES[sector].aspectRatio
    }
  }
  let printSizeMm: { widthMm: number; heightMm: number } | undefined

  if (generator === 'packaging_face') {
    if (isBagKitPreset(workSession.presetId)) {
      const printSize = resolveBagFacePrintSizeMm(workSession, screenKey)
      if (!printSize) {
        return {
          session: workSession,
          studio: { processSteps: workSession.processSteps },
          chargedImage: 0,
          error: boxSizeError(locale, 'format'),
        }
      }
      printSizeMm = printSize
      aspectRatio = getFaceGeminiAspectRatio(printSize.widthMm, printSize.heightMm)
      fullPrompt += `\n\nFlat paper bag panel (front or back) — full bleed print artwork only, NOT a 3D bag mockup. Both panels are ${printSize.widthMm}×${printSize.heightMm} mm.`
      if (isFirstBagFaceStep(screenKey)) {
        fullPrompt = appendPackagingFaceOneStylePrompt(fullPrompt, workSession)
      } else {
        const styleBrief = workSession.bagKit?.packagingStyleBrief?.trim()
        if (styleBrief) {
          fullPrompt += `\n\n${formatPackagingStyleBriefBlock(styleBrief, workSession.bagKit?.packagingStyleBriefSource)}`
        } else {
          const printStyle = resolveFacePrintStyle(workSession.briefNotes)
          fullPrompt += `\n\n${facePrintStylePromptBlock(printStyle)}`
        }
      }
      if (hasApprovedLogoRef) {
        fullPrompt += `\n\n${PACKAGING_FACE_APPROVED_LOGO_RULES}`
      }
      fullPrompt = appendPackagingPrintLanguagePrompt(fullPrompt, workSession.briefNotes)
      fullPrompt = stripPackagingFaceTechnicalMeasurementsFromVisualPrompt(fullPrompt)
    } else {
    const faceKey = packagingFaceKeyFromStep(screenKey)
    const faceSlot = packagingStepKeyToSlot(screenKey)
    const box = workSession.packaging?.dimensionsMm
    const isBodyStrip = screenKey === 'body_strip' && workSession.packaging?.layout === 'hybrid_strip'
    if ((!faceKey && !isBodyStrip) || !box) {
      return {
        session: workSession,
        studio: { processSteps: workSession.processSteps },
        chargedImage: 0,
        error: boxSizeError(locale, 'format'),
      }
    }
    const [faceWidth, faceHeight] = isBodyStrip
      ? [getBodyStripSizeMm(box).widthMm, getBodyStripSizeMm(box).heightMm]
      : getFaceDimensionsMm(faceKey!, box)
    printSizeMm = { widthMm: faceWidth, heightMm: faceHeight }
    aspectRatio =
      (faceKey ? workSession.packaging?.faceAspectRatios?.[faceKey] : undefined) ??
      getFaceGeminiAspectRatio(faceWidth, faceHeight)
    fullPrompt += `\n\n${buildPackagingFacePromptBlock({
      faceKey,
      faceSlot,
      isBodyStrip,
      isSquare: Math.abs(faceWidth - faceHeight) < 0.01,
    })}`
    if (productUrls.length) {
      fullPrompt +=
        '\nFlatten attached PRODUCT photo(s) into 2D printed graphics on this flat panel — NOT a 3D product bottle/box standing on kraft paper.'
    }
    const matchPrimaryFace = hasPrimaryFaceStyleReference(workSession, screenKey)
    const paletteBrief = resolvePackagingColorPaletteBrief(workSession)
    const isFirstFace = isFirstPackagingFaceStep(screenKey)
    const styleBrief = workSession.packaging?.packagingStyleBrief?.trim()

    if (isFirstFace) {
      fullPrompt = appendPackagingFaceOneStylePrompt(fullPrompt, workSession)
    } else if (matchPrimaryFace) {
      if (paletteBrief) {
        fullPrompt += `\n\n${formatPackagingColorPaletteBlock(paletteBrief, {
          referenceImagePriority: 'primary_face',
          matchPrimaryFaceArtwork: true,
        })}`
      }
    } else if (styleBrief) {
      fullPrompt += `\n\n${formatPackagingStyleBriefBlock(
        styleBrief,
        workSession.packaging?.packagingStyleBriefSource,
        { matchPrimaryFaceArtwork: matchPrimaryFace }
      )}`
    } else {
      const printStyle = resolveFacePrintStyle(workSession.briefNotes)
      fullPrompt += `\n\n${facePrintStylePromptBlock(printStyle)}`
    }
    if (hasApprovedLogoRef) {
      fullPrompt += `\n\n${PACKAGING_FACE_APPROVED_LOGO_RULES}`
    }
    fullPrompt = appendPackagingPrintLanguagePrompt(fullPrompt, workSession.briefNotes)
    fullPrompt = stripPackagingFaceTechnicalMeasurementsFromVisualPrompt(fullPrompt)
    }
  }

  if (isLogoOnlyReferenceStepKey(screenKey)) {
    if (labelHasLogoComposite) {
      fullPrompt += `\n\n${PACKAGING_FACE_APPROVED_LOGO_RULES}`
    }
    if (screenKey === 'product_label') {
      aspectRatio = resolveProductLabelAspectRatio(workSession.packaging, generationPrompt)
      printSizeMm = undefined
      fullPrompt = stripLabelTechnicalMeasurementsFromVisualPrompt(fullPrompt)
      fullPrompt += `\n\n${buildProductLabelPromptBlock('product_label', {
        aspectRatio,
        shape: resolveProductLabelShape(workSession.packaging),
      })}`
    } else {
      aspectRatio = resolveSealStickerAspectRatio(workSession.packaging, generationPrompt)
      printSizeMm = undefined
      fullPrompt = stripLabelTechnicalMeasurementsFromVisualPrompt(fullPrompt)
      fullPrompt += `\n\n${buildProductLabelPromptBlock('seal_sticker', {
        aspectRatio,
        shape: resolveSealStickerShape(workSession.packaging),
      })}`
    }
    if (workSession.presetId === 'packaging_kit') {
      fullPrompt = appendPackagingPrintLanguagePrompt(fullPrompt, workSession.briefNotes)
    }
  }

  fullPrompt = appendStudioUiColorPaletteToPrompt(fullPrompt, workSession, generator)

  if (generator === 'banner' && workSession.bannerAd?.presetId) {
    const bannerPresetId = workSession.bannerAd.presetId as BannerAdPresetId
    if (BANNER_AD_PRESETS.some((p) => p.id === bannerPresetId)) {
      fullPrompt += `\n\n${getBannerAdPlatformHint(bannerPresetId, locale)}`
    }
  }

  if (generator === 'banner' && workSession.presetId === 'sale_banner') {
    const bannerLogoUrl = workSession.bannerAd?.logoUrl?.trim()
    const styleAnchorUrl = workSession.bannerAd?.batchStyleAnchorUrl?.trim()
    if (bannerLogoUrl) {
      productUrls = productUrls.filter((u) => u !== bannerLogoUrl)
    }
    if (styleAnchorUrl) {
      productUrls = productUrls.filter((u) => u !== styleAnchorUrl)
      refUrls = refUrls.filter((u) => u !== styleAnchorUrl && u !== bannerLogoUrl)
      if (bannerLogoUrl) {
        refUrls = [bannerLogoUrl, styleAnchorUrl, ...refUrls]
      } else {
        refUrls = [styleAnchorUrl, ...refUrls]
      }
      fullPrompt += `\n\nCAMPAIGN STYLE ANCHOR: An attached image is the master banner from the first size in this batch. Match the SAME model identity (face, skin tone, outfit), color palette, typography style, and brand mood. Reframe the layout for this aspect ratio — do NOT copy pixel-identical layout; keep visual continuity across sizes.`
    } else if (bannerLogoUrl) {
      if (!refUrls.includes(bannerLogoUrl)) {
        refUrls = [bannerLogoUrl, ...refUrls]
      }
    }
    if (bannerLogoUrl) {
      fullPrompt += `\n\nIMPORTANT — LOGO COMPOSITE: The attached brand LOGO image — embed it exactly as provided (use the actual logo pixels). Place it prominently (typically top-left or top-center). Do NOT redraw, re-typeset, or recreate the logo; do NOT replace the logo with typed domain text.`
    }
  }

  if (generator === 'banner' && workSession.presetId === 'food_menu') {
    const menuLogoUrl = workSession.foodMenu?.logoUrl?.trim()
    if (menuLogoUrl) {
      productUrls = productUrls.filter((u) => u !== menuLogoUrl)
      if (!refUrls.includes(menuLogoUrl)) {
        refUrls = [menuLogoUrl, ...refUrls]
      }
      fullPrompt += `\n\nIMPORTANT — LOGO COMPOSITE: The attached brand LOGO image — embed it exactly as provided (use the actual logo pixels). Place it prominently on the menu header (typically top-center or top-left). Do NOT redraw or recreate the logo.`
    }
  }

  if (
    (generator === 'banner' || generator === 'ui_mockup') &&
    workSession.presetId === 'landing_page'
  ) {
    const landingLogoUrl = workSession.landingPage?.logoUrl?.trim()
    const landingScreenKey = normalizeLandingDesignStepKey(screenKey) ?? screenKey
    if (landingLogoUrl && landingScreenKey === 'landing_full') {
      productUrls = productUrls.filter((u) => u !== landingLogoUrl)
      if (!refUrls.includes(landingLogoUrl)) {
        refUrls = [landingLogoUrl, ...refUrls]
      }
      fullPrompt += `\n\nIMPORTANT — LOGO COMPOSITE: The attached brand LOGO image — embed it exactly as provided (use the actual logo pixels). Place it in the landing header / top nav (top-left or top-center). Do NOT redraw, re-typeset, or recreate the logo.`
    }
  }

  if (generator === 'product_photo' && !productUrls.length) {
    const t = getDictionary(locale).hubChat
    return {
      session,
      studio: { processSteps: session.processSteps, needsUpload: true },
      chargedImage: 0,
      error: t.studioNeedUpload,
    }
  }
  if (generatorUsesUpload(generator) && generator !== 'product_photo' && !productUrls.length) {
    const preset = session.presetId ? getStudioPreset(session.presetId) : null
    const bannerPromptOnly =
      (session.presetId === 'sale_banner' ||
        session.presetId === 'food_menu' ||
        session.presetId === 'landing_page') &&
      (generator === 'banner' || generator === 'ui_mockup')
    if (preset?.needsUpload && !bannerPromptOnly) {
      const t = getDictionary(locale).hubChat
      return {
        session,
        studio: { processSteps: session.processSteps, needsUpload: true },
        chargedImage: 0,
        error: t.studioNeedUpload,
      }
    }
  }

  if (generator === 'lyria_music') {
    const gen = await runLyriaPipeline({ userId, prompt: fullPrompt })
    if (!gen.ok) {
      return { session, studio: { processSteps: session.processSteps }, chargedImage: 0, error: gen.error }
    }
    const pending: HubStudioSession['pendingPreview'] = {
      screenKey,
      screenLabel,
      url: gen.resultUrl,
      generationPrompt,
    }
    const nextSession: HubStudioSession = {
      ...session,
      pendingPreview: pending,
      lastGenerationPrompt: generationPrompt,
    }
    return {
      session: nextSession,
      studio: {
        audioUrl: gen.resultUrl,
        screenKey,
        screenLabel,
        previewKind: 'audio',
        processSteps: nextSession.processSteps,
        showRegenerate: true,
        showApproveReference: true,
        imageCharged: gen.charged,
      },
      chargedImage: gen.charged,
    }
  }

  const pipelineInputBase = {
    userId,
    kind: generator,
    screenLabel,
    screenKey: effectiveScreenKey,
    projectTitle: workSession.projectTitle,
    referenceImageUrls: refUrls,
    referenceImageMeta: refUrls.map((url) => {
      const bannerLogoUrl =
        generator === 'banner' && workSession.presetId === 'sale_banner'
          ? workSession.bannerAd?.logoUrl?.trim()
          : ''
      const menuLogoUrl =
        generator === 'banner' && workSession.presetId === 'food_menu'
          ? workSession.foodMenu?.logoUrl?.trim()
          : ''
      const styleAnchorUrl =
        generator === 'banner' && workSession.presetId === 'sale_banner'
          ? workSession.bannerAd?.batchStyleAnchorUrl?.trim()
          : ''
      if (bannerLogoUrl && url === bannerLogoUrl) {
        return { screenKey: 'banner_logo', label: 'Brand logo' }
      }
      if (menuLogoUrl && url === menuLogoUrl) {
        return { screenKey: 'menu_logo', label: 'Brand logo' }
      }
      const landingLogoUrl =
        (generator === 'banner' || generator === 'ui_mockup') &&
        workSession.presetId === 'landing_page'
          ? workSession.landingPage?.logoUrl?.trim()
          : ''
      if (landingLogoUrl && url === landingLogoUrl) {
        return { screenKey: 'landing_logo', label: 'Brand logo' }
      }
      if (styleAnchorUrl && url === styleAnchorUrl) {
        return { screenKey: 'banner_style_anchor', label: 'Campaign style anchor' }
      }
      const ref = workSession.referenceImages.find((r) => r.url === url)
      if (ref) return { screenKey: ref.screenKey, label: ref.screenLabel }
      const primaryKey = getPrimaryPackagingStyleFaceStepKey()
      if (resolvePackagingFaceReferenceUrl(workSession, primaryKey) === url) {
        return { screenKey: primaryKey, label: 'Top' }
      }
      return { screenKey: '', label: '' }
    }),
    productImageUrls: productUrls.length ? productUrls : undefined,
    printSizeMm,
    verbatimPrompt: isLandingFull,
  }

  let gen: Awaited<ReturnType<typeof runStudioImagePipeline>> | null = null
  let lastPipelineError = ''

  if (isLandingFull) {
    const structuredFallback = buildLandingStructuredImagePrompt({
      locale,
      session: workSession,
      sectionCopy:
        readLandingSectionBrief('landing_full', workSession.briefNotes) ||
        generationPrompt.slice(0, 800),
      stepLabel: screenLabel,
    })
    const promptAttempts = [fullPrompt, structuredFallback].filter(
      (value, index, arr) => arr.indexOf(value) === index
    )
    const ratioAttempts = aspectRatio === '9:16' ? ['9:16'] : [aspectRatio ?? '1:4', '9:16']
    for (const briefAttempt of promptAttempts) {
      for (const ratioAttempt of ratioAttempts) {
        gen = await runStudioImagePipeline({
          ...pipelineInputBase,
          brief: briefAttempt,
          aspectRatio: ratioAttempt,
        })
        if (gen.ok) break
        lastPipelineError = gen.error
      }
      if (gen?.ok) break
    }
  } else {
    gen = await runStudioImagePipeline({
      ...pipelineInputBase,
      brief: fullPrompt,
      aspectRatio,
      verbatimPrompt: false,
    })
  }

  if (!gen?.ok) {
    return {
      session: workSession,
      studio: { processSteps: workSession.processSteps },
      chargedImage: 0,
      error: lastPipelineError || gen?.error || 'AI không trả về ảnh.',
    }
  }

  const pending: HubStudioSession['pendingPreview'] = {
    screenKey: effectiveScreenKey,
    screenLabel,
    url: gen.resultUrl,
    generationPrompt,
  }
  const nextSession: HubStudioSession = {
    ...workSession,
    pendingPreview: pending,
    lastGenerationPrompt: generationPrompt,
  }
  const useReference = generatorSupportsReference(generator)
  // design_recreate: single redesign image — only Tạo lại (no Tiếp), stack all versions.
  const isDesignRecreateImage =
    workSession.presetId === 'design_recreate' && effectiveScreenKey !== DESIGN_RECREATE_LOGO_KEY
  const pendingStudio =
    workSession.presetId && generator === 'packaging_face'
      ? buildPendingStepStudio(nextSession, screenKey, workSession.presetId)
      : null
  return {
    session: nextSession,
    studio: {
      imageUrl: gen.resultUrl,
      screenKey: effectiveScreenKey,
      screenLabel,
      previewKind,
      aspectHint,
      processSteps: nextSession.processSteps,
      showRegenerate: true,
      showApproveReference: isDesignRecreateImage ? false : useReference,
      ...(isDesignRecreateImage ? { stackImageVersions: true } : {}),
      imageCharged: gen.charged,
      ...(pendingStudio
        ? {
            showCropImage: pendingStudio.showCropImage,
            faceTargetSizeMm: pendingStudio.faceTargetSizeMm,
            faceEditedSizeMm: pendingStudio.faceEditedSizeMm,
          }
        : {}),
    },
    chargedImage: gen.charged,
  }
}

function referenceUsageReply(
  locale: WebLocale,
  storedCount: number,
  attachCount: number
): string {
  const t = getDictionary(locale).hubChat
  let msg = t.studioReferenceWillUse.replace('{n}', String(storedCount))
  if (storedCount > attachCount) {
    msg += `\n${t.studioReferenceAttachHint.replace('{n}', String(attachCount))}`
  }
  return msg
}

function isPackagingCompositeGenerator(gen: StudioGeneratorKind | null | undefined): boolean {
  return gen === 'packaging_face' || gen === 'packaging' || gen === 'packaging_mockup'
}

function appendReferenceContext(
  session: HubStudioSession,
  prompt: string,
  presetId: string | null,
  options?: {
    generator?: StudioGeneratorKind | null
    attachedRefUrls?: string[]
    targetStepKey?: string | null
    hasProductRefs?: boolean
  }
): string {
  const attachedUrls = options?.attachedRefUrls?.length
    ? options.attachedRefUrls
    : pickedReferenceUrls(session.referenceImages, presetId, session.currentStepKey)
  if (!attachedUrls.length) return prompt
  const refs = resolveReferenceEntriesForUrls(session, attachedUrls)
  if (!refs.length) return prompt

  const logoKey = presetId ? getPrimaryLogoStepKey(presetId) : null
  const primaryFaceKey = getPrimaryPackagingStyleFaceStepKey()
  const logoRef = logoKey ? refs.find((r) => r.screenKey === logoKey) : null
  const primaryFaceRef = refs.find((r) => r.screenKey === primaryFaceKey) ?? null
  const refList = refs.map((r) => `- ${r.screenLabel} (${r.screenKey})`).join('\n')
  const gen = options?.generator
  const activeStepKey = options?.targetStepKey ?? session.currentStepKey

  if (isPackagingCompositeGenerator(gen)) {
    if (isLogoOnlyReferenceStepKey(activeStepKey)) {
      const logoLine = logoRef
        ? `Attach and composite ONLY the approved LOGO image (${logoRef.screenLabel}) onto this flat label artwork — embed the attached logo pixels; do NOT redraw, re-typeset, or recreate the brand mark.`
        : 'No logo attached — use typography only per user brief.'
      return `${prompt}\n\n${logoLine}\nDo NOT use box face artwork, dieline panels, or 3D box photos as reference.`
    }
    if (gen === 'packaging_face' && activeStepKey && isFirstPackagingFaceStep(activeStepKey)) {
      let block = `FACE #1 — flat print panel:
- Visual style, colors, and print treatment come from PACKAGING STYLE DIRECTION in the prompt (brand discovery).`
      if (logoRef) {
        block += `\n- Composite ONLY the approved LOGO (${logoRef.screenLabel}) — do NOT redraw or re-typeset the logo.`
      }
      if (options?.hasProductRefs) {
        block += '\n- Flatten attached product photo(s) as 2D printed elements on this panel.'
      }
      if (refs.length) {
        block += `\n\nAttached references:\n${refList}`
      }
      return `${prompt}\n\n${block}`
    }
    if (gen === 'packaging_face' && logoRef && refs.length === 1 && !primaryFaceRef) {
      return `${prompt}\n\nComposite ONLY the attached approved LOGO (${logoRef.screenLabel}) onto this flat print panel — do NOT redraw or re-typeset the logo or brand name as new typography.
Visual style, colors, and illustration treatment come from PACKAGING STYLE DIRECTION in the brief.`
    }
    if (gen === 'packaging_face' && primaryFaceRef && activeStepKey && !isFirstPackagingFaceStep(activeStepKey)) {
      let block = `PACKAGING VISUAL CONSISTENCY — faces 2–6 must match face #1 exactly in color and style:
- Attached PRIMARY FACE #1 (${primaryFaceRef.screenLabel}) is the SOLE style authority — match its colors, illustration treatment, typography style, and material feel EXACTLY on this new panel.
- IGNORE pre-selected print style, mood, or illustration type text — reference image + color palette only.
- Generate NEW layout and NEW print copy for THIS face only — do NOT copy or paste the face #1 artwork, layout, or text onto this panel.
- All 6 faces must look like one unified box design — never invent a new palette or art style per face.`
      if (logoRef) {
        block += `\n- Composite ONLY the attached approved LOGO (${logoRef.screenLabel}) — do NOT redraw or re-typeset the logo.`
      }
      block += `\n\nAttached references:\n${refList}`
      return `${prompt}\n\n${block}`
    }
    let block = `COMPOSITE onto this FLAT 2D print panel — embed these attached images as printed graphics (not style-only reference, NOT a 3D mockup scene):\n${refList}`
    if (logoRef) {
      block +=
        gen === 'packaging_face'
          ? `\nComposite ONLY the attached approved LOGO (${logoRef.screenLabel}) for brand identity — do NOT redraw or re-typeset the logo or brand name as new typography.`
          : `\nPlace the approved LOGO (${logoRef.screenLabel}) prominently on this packaging surface.`
    }
    if (gen === 'packaging_face') {
      block +=
        '\nIncorporate attached product visuals as flat 2D printed elements on this single panel — edge-to-edge full bleed, NOT as a 3D box photo, NOT on grey studio background with margins or drop shadow.'
    } else if (gen === 'packaging_mockup') {
      block += `\nWrap each attached face artwork onto the mapped 3D box face only — never use logo-only images.
${PACKAGING_MOCKUP_SCENE_RULES}`
    } else {
      block += '\nIntegrate attached artwork elements into the print-ready packaging design.'
    }
    return `${prompt}\n\n${block}`
  }

  let block = `Use these approved reference images (attached to model):\n${refList}`
  if (logoRef && presetId === 'design_recreate') {
    block += `\nIMPORTANT: Composite the approved CLIENT LOGO (${logoRef.screenLabel}) onto the design board (title/header or brand-mark corner). Embed exact logo pixels — do NOT redraw. Do NOT copy marks from product sample photos.`
  } else if (logoRef) {
    block += `\nIMPORTANT: Place the approved LOGO (${logoRef.screenLabel}) in the app header / brand area. Match logo colors and typography across the whole UI.`
  } else {
    block += '\nMatch visual style, colors and typography across all references.'
  }
  return `${prompt}\n\n${block}`
}

function isSaleBannerApprovedKey(screenKey: string): boolean {
  return screenKey === 'banner_design' || screenKey.startsWith('banner_design_')
}

function countSaleBannerApprovals(session: HubStudioSession): number {
  return session.referenceImages.filter((r) => isSaleBannerApprovedKey(r.screenKey)).length
}

function getSaleBannerBatchPreviews(session: HubStudioSession): HubStudioPendingPreview[] {
  if (session.bannerBatchPreviews?.length) return session.bannerBatchPreviews
  const pending = session.pendingPreview
  const queue = session.bannerBatchQueue ?? []
  if (pending && queue.length > 0) return [pending, ...queue]
  if (pending && (session.bannerBatchTotal ?? 0) > 1) return [pending]
  if (pending) return [pending]
  return []
}

function buildSaleBannerBatchStudioPayload(
  previews: HubStudioPendingPreview[],
  selectedIndex: number,
  base: Partial<HubStudioMessagePayload> = {}
): HubStudioMessagePayload {
  const safeIndex = Math.max(0, Math.min(previews.length - 1, selectedIndex))
  const selected = previews[safeIndex] ?? previews[0]
  const multi = previews.length > 1
  return {
    ...base,
    imageUrl: selected?.url,
    screenKey: selected?.screenKey ?? 'banner_design',
    screenLabel: selected?.screenLabel,
    previewKind: 'banner',
    showRegenerate: base.showRegenerate ?? true,
    showApproveReference: base.showApproveReference ?? true,
    ...(multi
      ? {
          bannerBatchItems: previews.map((p, index) => ({
            url: p.url,
            screenLabel: p.screenLabel,
            index,
          })),
          bannerBatchSelectedIndex: safeIndex,
          bannerBatchTotal: previews.length,
        }
      : {}),
  }
}

function syncBannerBatchPreviewItem(
  session: HubStudioSession,
  preview: HubStudioPendingPreview
): HubStudioSession {
  const previews = getSaleBannerBatchPreviews(session)
  if (previews.length <= 1) {
    return { ...session, pendingPreview: preview }
  }
  const index =
    session.bannerBatchSelectedIndex ??
    Math.max(0, previews.findIndex((p) => p.url === session.pendingPreview?.url))
  const next = [...previews]
  next[index] = preview
  return {
    ...session,
    bannerBatchPreviews: next,
    bannerBatchSelectedIndex: index,
    pendingPreview: preview,
    bannerBatchQueue: undefined,
    bannerBatchTotal: next.length,
  }
}

function finalizeSaleBannerBatchApproval(session: HubStudioSession, locale: WebLocale): HubStudioSession {
  return {
    ...session,
    processSteps: setStepInProgress(
      session.processSteps.map((s) =>
        s.key === 'banner_design' ? { ...s, status: 'in_progress' as const } : s
      ),
      'banner_design'
    ),
    currentStepKey: 'banner_design',
    bannerAd: session.bannerAd ? { ...session.bannerAd, overlayText: undefined } : session.bannerAd,
    briefNotes: {
      ...session.briefNotes,
      banner_design: '',
    },
  }
}

function finishApproveSaleBannerBatch(
  session: HubStudioSession,
  previews: HubStudioPendingPreview[],
  locale: WebLocale
): HubStudioSession {
  const existingCount = countSaleBannerApprovals(session)
  const now = Date.now()
  const newRefs: HubStudioReferenceImage[] = previews.map((p, i) => ({
    screenKey: `banner_design_${existingCount + i + 1}`,
    screenLabel:
      previews.length > 1
        ? `${saleBannerScreenLabel(locale, existingCount + i + 1)} — ${p.screenLabel}`
        : saleBannerScreenLabel(locale, existingCount + i + 1),
    url: p.url,
    approvedAt: now + i,
  }))
  const firstUrl = previews[0]!.url
  let next: HubStudioSession = {
    ...session,
    referenceImages: [
      ...session.referenceImages.filter(
        (r) => r.screenKey !== 'banner_design' && !isSaleBannerApprovedKey(r.screenKey)
      ),
      ...newRefs,
    ],
    pendingPreview: null,
    bannerBatchPreviews: undefined,
    bannerBatchQueue: undefined,
    bannerBatchTotal: undefined,
    bannerBatchSelectedIndex: undefined,
    lastGenerationPrompt: null,
    generationSelection: {
      referenceScreenKeys: session.generationSelection?.referenceScreenKeys ?? [],
      productUrls: session.generationSelection?.productUrls ?? [],
      styleReferenceUrl: firstUrl,
    },
  }
  next = finalizeSaleBannerBatchApproval(next, locale)
  return next
}

function saleBannerScreenLabel(locale: WebLocale, n: number): string {
  const rows = {
    vi: `Banner ${n}`,
    en: `Banner ${n}`,
    zh: `横幅 ${n}`,
    ja: `バナー ${n}`,
    ko: `배너 ${n}`,
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

function finalizeSaleBannerApproval(session: HubStudioSession, locale: WebLocale): HubStudioSession {
  const bannerNum = countSaleBannerApprovals(session)
  const uniqueKey = `banner_design_${bannerNum}`
  const pendingRef = session.referenceImages.find((r) => r.screenKey === 'banner_design')
  const flowStyleRef =
    session.generationSelection?.styleReferenceUrl ??
    pendingRef?.url ??
    session.referenceImages.find((r) => isSaleBannerApprovedKey(r.screenKey))?.url

  return {
    ...session,
    referenceImages: session.referenceImages.map((r) =>
      r.screenKey === 'banner_design'
        ? { ...r, screenKey: uniqueKey, screenLabel: saleBannerScreenLabel(locale, bannerNum) }
        : r
    ),
    processSteps: setStepInProgress(
      session.processSteps.map((s) =>
        s.key === 'banner_design' ? { ...s, status: 'in_progress' as const } : s
      ),
      'banner_design'
    ),
    currentStepKey: 'banner_design',
    bannerAd: session.bannerAd ? { ...session.bannerAd, overlayText: undefined } : session.bannerAd,
    briefNotes: {
      ...session.briefNotes,
      banner_design: '',
    },
    generationSelection: flowStyleRef
      ? {
          referenceScreenKeys: session.generationSelection?.referenceScreenKeys ?? [],
          productUrls: session.generationSelection?.productUrls ?? [],
          styleReferenceUrl: session.generationSelection?.styleReferenceUrl ?? flowStyleRef,
        }
      : session.generationSelection,
  }
}

function buildAskForNextStep(
  session: HubStudioSession,
  locale: WebLocale,
  approvedScreenLabel: string,
  approvedScreenKey: string
): { reply: string; studio: HubStudioMessagePayload } {
  const t = getDictionary(locale).hubChat
  const nextKey = session.currentStepKey
  if (!nextKey || !session.presetId) {
    return { reply: t.studioAllDone, studio: { processSteps: session.processSteps } }
  }

  const nextLabel = stepLabel(session, nextKey, locale)
  let reply: string
  if (isLogoDesignStep(session.presetId, approvedScreenKey)) {
    reply = t.studioLogoApprovedNext.replace('{next}', nextLabel)
  } else {
    reply = t.studioApprovedNext.replace('{screen}', approvedScreenLabel).replace('{next}', nextLabel)
  }

  if (
    session.referenceImages.length > 0 &&
    !isPackagingCompositeArtifactStepKey(nextKey)
  ) {
    reply += `\n\n${referenceUsageReply(locale, session.referenceImages.length, STUDIO_REFERENCE_ATTACH_LIMIT)}`
  }

  const preset = getStudioPreset(session.presetId)
  if (preset?.needsUpload && !session.uploadImages.length) {
    reply += `\n\n${t.studioNeedUpload}`
  } else {
    reply = appendStepAsk(reply, locale, session.presetId, nextKey)
  }

  const studio = mergeApprovedPackagingMockupIntoStudio(session, {
    processSteps: session.processSteps,
    awaitingRequirements: true,
    ...buildReferencePreviewsPayload(session, nextKey),
    needsUpload: preset?.needsUpload && !session.uploadImages.length ? true : undefined,
  })
  return { reply, studio }
}

function deterministicPackagingGeneratedReply(locale: WebLocale, screenLabel: string): string {
  const rows = {
    vi: `Đã tạo **${screenLabel}** từ dữ liệu hộp có sẵn. Xem bên dưới — ổn thì bấm «Tiếp».`,
    en: `**${screenLabel}** is ready from your box data. Review below — tap «Continue» when it looks good.`,
    zh: `已根据现有盒型数据生成 **${screenLabel}**。请查看下方 — 确认后点「继续」。`,
    ja: `既存の箱データから **${screenLabel}** を作成しました。下を確認し、問題なければ「次へ」を押してください。`,
    ko: `기존 상자 데이터로 **${screenLabel}**을(를) 만들었습니다. 아래에서 확인 후 «계속»을 누르세요.`,
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

async function runPackagingArtifactStep(
  userId: string,
  session: HubStudioSession,
  locale: WebLocale,
  message: string,
  packagingArtifactStep: 'box_mockup_3d' | 'box_dieline_pdf'
): Promise<{
  session: HubStudioSession
  studio: HubStudioMessagePayload
  artifactLabel: string
  chargedImage?: number
  error?: string
}> {
  const hydratedPackaging = preparePackagingFaceSlotsForArtifact({
    packaging: session.packaging,
    referenceImages: session.referenceImages,
    processSteps: session.processSteps,
  })
  let workSession: HubStudioSession = { ...session, packaging: hydratedPackaging }
  if (workSession.currentStepKey !== packagingArtifactStep) {
    workSession = focusSessionOnDesignStep(workSession, 'packaging_kit', packagingArtifactStep, message)
  }
  workSession = clearStalePendingForArtifactGenerate(workSession, packagingArtifactStep)
  const artifactLabel = stepLabel(workSession, packagingArtifactStep, locale)
  const genResult = await generateAsset(
    userId,
    workSession,
    message,
    packagingArtifactStep,
    artifactLabel,
    locale
  )
  return {
    session: genResult.session,
    studio: genResult.studio,
    artifactLabel,
    chargedImage: genResult.chargedImage || undefined,
    error: genResult.error,
  }
}

async function refreshPackagingArtifactsAfterFaceChange(
  session: HubStudioSession,
  previousSession: HubStudioSession,
  userId: string
): Promise<HubStudioSession> {
  const hadCompletedMockup = Boolean(
    previousSession.packaging?.mockupUrl ||
      previousSession.processSteps.find((step) => step.key === 'box_mockup_3d')?.status === 'done'
  )
  const hadCompletedDieline = Boolean(
    previousSession.packaging?.dielineUrl ||
      previousSession.processSteps.find((step) => step.key === 'box_dieline_pdf')?.status === 'done'
  )
  const nextSession: HubStudioSession = {
    ...session,
    referenceImages: session.referenceImages.filter(
      (reference) => reference.screenKey !== 'box_mockup_3d'
    ),
  }
  const packaging = nextSession.packaging
  if (
    (!hadCompletedMockup && !hadCompletedDieline) ||
    !packaging?.dimensionsMm ||
    !allPackagingFaceSlotsCommitted(packaging)
  ) {
    return nextSession
  }
  const faceSlots = packaging.faceSlots ?? {}
  const createdFaces = faceSlotsToCreatedFaces(faceSlots)
  const [dielineResult, mockupResult] = await Promise.allSettled([
    hadCompletedDieline
      ? exportAllBoxDielineVariants({
          userId,
          slotUrls: resolveDielineSlotUrls(createdFaces),
          dimensionsMm: packaging.dimensionsMm,
          bodyStripUrl:
            packaging.layout === 'hybrid_strip' ? packaging.bodyStrip?.originalUrl : undefined,
          production: packaging.production,
        }).then((exported) => buildPackagingDielineVariantState(exported))
      : Promise.resolve(null),
    hadCompletedMockup
      ? exportBoxMockupFromFaces({
          userId,
          faces: faceSlotsToMockupFaces(faceSlots),
          faceSlots,
          dimensionsMm: packaging.dimensionsMm,
        })
      : Promise.resolve(null),
  ])
  if (dielineResult.status === 'rejected') {
    console.error('Failed to refresh packaging dieline after face edit', dielineResult.reason)
  }
  if (mockupResult.status === 'rejected') {
    console.error('Failed to refresh packaging mockup after face edit', mockupResult.reason)
  }
  const dielineVariants =
    dielineResult.status === 'fulfilled' && dielineResult.value
      ? dielineResult.value
      : undefined
  const dielineUrl = dielineVariants ? primaryDielineVariant(dielineVariants)?.url : undefined
  const mockupUrl =
    mockupResult.status === 'fulfilled' && mockupResult.value
      ? mockupResult.value.pngUrl
      : undefined
  return {
    ...nextSession,
    packaging: {
      ...packaging,
      dielineUrl,
      dielineVariants,
      mockupUrl,
    },
  }
}

function resolveSaleBannerDesignDraft(session: HubStudioSession): string {
  const overlay = session.bannerAd?.overlayText?.trim() ?? ''
  if (overlay) return overlay
  if (hasSaleBannerDiscoveryBrief(session.briefNotes)) {
    return SALE_BANNER_COPY_BRIEF_KEYS.map((key) => session.briefNotes[key]?.trim())
      .filter(Boolean)
      .join(' · ')
  }
  return ''
}

function resolveSelectedBannerPresetIds(
  session: HubStudioSession,
  input?: Pick<HubStudioHandlerInput, 'bannerAdPresetIds' | 'bannerAdPresetId'>
): BannerAdPresetId[] {
  const fromInput = (input?.bannerAdPresetIds ?? [])
    .map((id) => normalizeBannerAdPresetId(String(id)))
    .filter(Boolean)
  if (fromInput.length) return fromInput.slice(0, MAX_BANNER_BATCH_PRESETS)
  const fromSession = (session.bannerAd?.selectedPresetIds ?? []).map((id) =>
    normalizeBannerAdPresetId(id)
  )
  if (fromSession.length) return fromSession.slice(0, MAX_BANNER_BATCH_PRESETS)
  const single = input?.bannerAdPresetId ?? session.bannerAd?.presetId
  if (single) return [normalizeBannerAdPresetId(single)]
  return []
}

function mergeBannerDesignInputIntoSession(
  session: HubStudioSession,
  input: Pick<
    HubStudioHandlerInput,
    'bannerAdPresetId' | 'bannerAdPresetIds' | 'bannerOverlayText' | 'bannerDomainName'
  >
): HubStudioSession {
  if (session.presetId !== 'sale_banner' || session.currentStepKey !== 'banner_design') {
    return session
  }
  const presetIdsRaw = (input.bannerAdPresetIds ?? [])
    .map((id) => normalizeBannerAdPresetId(String(id)))
    .filter(Boolean)
    .slice(0, MAX_BANNER_BATCH_PRESETS)
  const presetIdRaw = input.bannerAdPresetId
    ? normalizeBannerAdPresetId(String(input.bannerAdPresetId))
    : ''
  const overlayRaw =
    input.bannerOverlayText !== undefined ? String(input.bannerOverlayText).trim() : undefined
  const domainRaw =
    input.bannerDomainName !== undefined ? String(input.bannerDomainName).trim() : undefined

  const selectedPresetIds =
    input.bannerAdPresetIds !== undefined
      ? presetIdsRaw
      : presetIdRaw
        ? [presetIdRaw]
        : session.bannerAd?.selectedPresetIds?.map((id) => normalizeBannerAdPresetId(id)) ?? []

  if (
    input.bannerAdPresetIds === undefined &&
    !presetIdRaw &&
    overlayRaw === undefined &&
    domainRaw === undefined
  ) {
    return session
  }
  if (
    input.bannerAdPresetIds !== undefined &&
    !selectedPresetIds.length &&
    overlayRaw === undefined &&
    domainRaw === undefined
  ) {
    const prev = session.bannerAd
    return {
      ...session,
      bannerAd: {
        ...prev,
        selectedPresetIds: [],
        presetId: '',
        aspectRatio: '',
        platform: undefined,
        logoUrl: prev?.logoUrl,
      },
    }
  }

  const primary = selectedPresetIds[0]
    ? findBannerAdPreset(selectedPresetIds[0]!)
    : null
  const prev = session.bannerAd
  const nextBriefNotes =
    domainRaw !== undefined
      ? { ...session.briefNotes, domain_name: domainRaw }
      : session.briefNotes
  return {
    ...session,
    briefNotes: nextBriefNotes,
    bannerAd: {
      selectedPresetIds: selectedPresetIds.length ? selectedPresetIds : prev?.selectedPresetIds,
      presetId: primary?.id ?? prev?.presetId ?? '',
      aspectRatio: primary?.aspectRatio ?? prev?.aspectRatio ?? '',
      platform: primary?.platform ?? prev?.platform,
      overlayText: overlayRaw !== undefined ? overlayRaw || undefined : prev?.overlayText,
      logoUrl: prev?.logoUrl,
    },
  }
}

async function generateSaleBannerBatch(input: {
  userId: string
  apiKey: string
  locale: WebLocale
  session: HubStudioSession
  presetIds: BannerAdPresetId[]
}): Promise<{
  ok: boolean
  session: HubStudioSession
  studio?: HubStudioMessagePayload
  chargedImage: number
  error?: string
  batchCount: number
}> {
  const t = getDictionary(input.locale).hubChat
  let workSession: HubStudioSession = {
    ...input.session,
    pendingPreview: null,
    bannerBatchQueue: undefined,
    bannerBatchTotal: undefined,
  }
  let totalCharged = 0
  const previews: HubStudioPendingPreview[] = []
  const hasLogo = Boolean(workSession.bannerAd?.logoUrl?.trim())
  const hasRefs = workSession.uploadImages.length > 0 || hasLogo

  const allAdChannels = input.presetIds.map((presetId) => {
    const adPreset = getBannerAdPresetById(presetId)
    return {
      presetId,
      aspectRatio: adPreset.aspectRatio,
      adChannelLabel: getBannerAdPresetLabel(adPreset, input.locale),
      platformHint: getBannerAdPlatformHint(presetId, input.locale),
    }
  })
  const primary = allAdChannels[0]!
  const draft = resolveSaleBannerDesignDraft(workSession)
  if (!draft) {
    return {
      ok: false,
      session: workSession,
      chargedImage: 0,
      error: t.studioBannerNeedCopy,
      batchCount: 0,
    }
  }
  const built = buildBannerImageGenerationPrompt({
    locale: input.locale,
    briefNotes: workSession.briefNotes,
    overlayText: workSession.bannerAd?.overlayText,
    presetId: primary.presetId,
    aspectRatio: primary.aspectRatio,
    adChannelLabel: primary.adChannelLabel,
    platformHint: primary.platformHint,
    hasReferenceImages: hasRefs,
    hasLogo,
    allAdChannels,
  })
  if (!built.ok) {
    return {
      ok: false,
      session: workSession,
      chargedImage: 0,
      error: t.studioBannerPromptBuildFailed,
      batchCount: 0,
    }
  }
  const prevBannerAd = workSession.bannerAd
  workSession = {
    ...workSession,
    bannerAd: {
      ...prevBannerAd,
      presetId: prevBannerAd?.presetId ?? primary.presetId,
      aspectRatio: prevBannerAd?.aspectRatio ?? primary.aspectRatio,
      platform: prevBannerAd?.platform ?? undefined,
      selectedPresetIds: input.presetIds,
      overlayText: built.structuredCopy,
      logoUrl: prevBannerAd?.logoUrl,
    },
    briefNotes: {
      ...workSession.briefNotes,
      banner_design: built.structuredCopy,
    },
  }
  const sharedPrompt = built.prompt
  let batchStyleAnchorUrl: string | undefined

  for (let i = 0; i < input.presetIds.length; i++) {
    const presetId = input.presetIds[i]!
    const adPreset = getBannerAdPresetById(presetId)
    const ratioLabel = getBannerAdPresetLabel(adPreset, input.locale)

    workSession = {
      ...workSession,
      bannerAd: {
        ...workSession.bannerAd,
        presetId: adPreset.id,
        aspectRatio: adPreset.aspectRatio,
        platform: adPreset.platform,
        selectedPresetIds: input.presetIds,
        overlayText: workSession.bannerAd?.overlayText,
        logoUrl: workSession.bannerAd?.logoUrl,
        batchStyleAnchorUrl: i > 0 ? batchStyleAnchorUrl : undefined,
      },
      pendingPreview: null,
    }

    const label =
      input.presetIds.length > 1
        ? `${ratioLabel} (${i + 1}/${input.presetIds.length})`
        : ratioLabel

    const gen = await generateAsset(
      input.userId,
      workSession,
      sharedPrompt,
      'banner_design',
      label,
      input.locale
    )
    workSession = gen.session
    totalCharged += gen.chargedImage
    if (gen.error) {
      return {
        ok: previews.length > 0,
        session: workSession,
        chargedImage: totalCharged,
        error: gen.error,
        batchCount: previews.length,
      }
    }
    if (workSession.pendingPreview) {
      if (i === 0 && input.presetIds.length > 1) {
        batchStyleAnchorUrl = workSession.pendingPreview.url
      }
      previews.push(workSession.pendingPreview)
      workSession = { ...workSession, pendingPreview: null }
    }
  }

  if (!previews.length) {
    return {
      ok: false,
      session: workSession,
      chargedImage: totalCharged,
      error: t.errorGeneric,
      batchCount: 0,
    }
  }

  workSession = {
    ...workSession,
    bannerBatchPreviews: previews.length > 1 ? previews : undefined,
    bannerBatchSelectedIndex: previews.length > 1 ? 0 : undefined,
    pendingPreview: previews[0] ?? null,
    bannerBatchQueue: undefined,
    bannerBatchTotal: previews.length > 1 ? previews.length : undefined,
    lastGenerationPrompt: previews[0]?.generationPrompt ?? null,
    bannerAd: workSession.bannerAd
      ? { ...workSession.bannerAd, batchStyleAnchorUrl: undefined }
      : workSession.bannerAd,
  }

  const studio = buildSaleBannerBatchStudioPayload(previews, 0, {
    processSteps: workSession.processSteps,
    imageCharged: totalCharged,
  })

  return {
    ok: true,
    session: workSession,
    studio,
    chargedImage: totalCharged,
    batchCount: previews.length,
  }
}

function mergeMenuDesignInputIntoSession(
  session: HubStudioSession,
  input: Pick<
    HubStudioHandlerInput,
    'menuFormatPresetId' | 'menuDishes' | 'menuDishesBulkText' | 'menuVenueName'
  >
): HubStudioSession {
  if (session.presetId !== 'food_menu' || session.currentStepKey !== 'menu_design') {
    return session
  }
  const hasFormat = input.menuFormatPresetId !== undefined
  const hasDishes = input.menuDishes !== undefined
  const hasBulkText = input.menuDishesBulkText !== undefined
  const hasVenue = input.menuVenueName !== undefined
  if (!hasFormat && !hasDishes && !hasBulkText && !hasVenue) {
    return session
  }

  const formatRaw = hasFormat ? normalizeMenuFormatPresetId(String(input.menuFormatPresetId)) : ''
  const dishesRaw = hasDishes ? normalizeMenuDishes(input.menuDishes!) : undefined
  const bulkTextRaw = hasBulkText ? String(input.menuDishesBulkText) : undefined
  const venueRaw = hasVenue ? String(input.menuVenueName).trim() : undefined

  const prev = session.foodMenu
  const formatPresetId = formatRaw || prev?.formatPresetId || ''
  const preset = formatPresetId ? getMenuFormatPresetById(formatPresetId as MenuFormatPresetId) : null
  const nextBriefNotes =
    venueRaw !== undefined ? { ...session.briefNotes, venue_name: venueRaw } : session.briefNotes

  return {
    ...session,
    briefNotes: nextBriefNotes,
    foodMenu: {
      formatPresetId: formatPresetId || prev?.formatPresetId,
      aspectRatio: preset?.aspectRatio ?? prev?.aspectRatio,
      venueName: venueRaw !== undefined ? venueRaw || undefined : prev?.venueName,
      logoUrl: prev?.logoUrl,
      dishes: dishesRaw !== undefined ? dishesRaw : prev?.dishes,
      dishesBulkText:
        bulkTextRaw !== undefined ? bulkTextRaw : prev?.dishesBulkText,
    },
  }
}

function mergeLandingDesignInputIntoSession(
  session: HubStudioSession,
  input: Pick<HubStudioHandlerInput, 'landingSectionCopy'>
): HubStudioSession {
  const rawKey = session.currentStepKey
  const stepKey =
    session.presetId === 'landing_page' && rawKey
      ? normalizeLandingDesignStepKey(rawKey) ?? rawKey
      : rawKey
  if (session.presetId !== 'landing_page' || !stepKey || !isLandingDesignStepKey(stepKey)) {
    return session
  }
  if (input.landingSectionCopy === undefined) {
    return stepKey !== rawKey ? { ...session, currentStepKey: stepKey } : session
  }
  const copy = String(input.landingSectionCopy).trim()
  return {
    ...session,
    currentStepKey: stepKey,
    briefNotes: {
      ...session.briefNotes,
      [stepKey]: copy,
    },
  }
}

async function generateFoodMenu(input: {
  userId: string
  apiKey: string
  locale: WebLocale
  session: HubStudioSession
}): Promise<{
  ok: boolean
  session: HubStudioSession
  studio?: HubStudioMessagePayload
  chargedImage: number
  error?: string
}> {
  const t = getDictionary(input.locale).hubChat
  let workSession: HubStudioSession = { ...input.session, pendingPreview: null }
  const formatId = normalizeMenuFormatPresetId(workSession.foodMenu?.formatPresetId ?? '')
  if (!formatId) {
    return {
      ok: false,
      session: workSession,
      chargedImage: 0,
      error: t.studioMenuNeedFormat,
    }
  }
  const dishes = normalizeMenuDishes(workSession.foodMenu?.dishes ?? [])
  const dishesBulkText = workSession.foodMenu?.dishesBulkText?.trim() ?? ''
  if (!menuInputHasContent(dishes, dishesBulkText)) {
    return {
      ok: false,
      session: workSession,
      chargedImage: 0,
      error: t.studioMenuNeedDishes,
    }
  }
  workSession = {
    ...workSession,
    foodMenu: {
      ...workSession.foodMenu,
      formatPresetId: formatId,
      dishes,
      dishesBulkText: dishesBulkText || undefined,
    },
  }
  const preset = getMenuFormatPresetById(formatId)
  const formatLabel = getMenuFormatPresetLabel(preset, input.locale)
  const venueName =
    workSession.foodMenu?.venueName?.trim() || workSession.briefNotes.venue_name?.trim() || ''
  const hasLogo = Boolean(workSession.foodMenu?.logoUrl?.trim())
  const built = buildMenuImageGenerationPrompt({
    locale: input.locale,
    briefNotes: workSession.briefNotes,
    dishes,
    dishesBulkText,
    formatPresetId: formatId,
    aspectRatio: preset.aspectRatio,
    formatLabel,
    venueName,
    hasLogo,
  })
  if (!built.ok) {
    return {
      ok: false,
      session: workSession,
      chargedImage: 0,
      error: t.studioMenuPromptBuildFailed,
    }
  }
  workSession = {
    ...workSession,
    foodMenu: {
      ...workSession.foodMenu,
      formatPresetId: formatId,
      aspectRatio: preset.aspectRatio,
      dishes,
    },
    briefNotes: {
      ...workSession.briefNotes,
      menu_design: built.prompt.slice(0, 500),
    },
  }
  const label = stepLabel(workSession, 'menu_design', input.locale)
  const gen = await generateAsset(
    input.userId,
    workSession,
    built.prompt,
    'menu_design',
    label,
    input.locale
  )
  return {
    ok: !gen.error,
    session: gen.session,
    studio: gen.studio,
    chargedImage: gen.chargedImage,
    error: gen.error,
  }
}

async function finishApprove(
  session: HubStudioSession,
  locale: WebLocale,
  threadId: string,
  userId: string
): Promise<{ session: HubStudioSession; reply: string; studio: HubStudioMessagePayload }> {
  const pending = session.pendingPreview!
  const previousCurrentStepKey = session.currentStepKey
  const stepWasDone =
    session.processSteps.find((s) => s.key === pending.screenKey)?.status === 'done'
  const isRestoringReference = Boolean(
    stepWasDone &&
      previousCurrentStepKey &&
      previousCurrentStepKey !== pending.screenKey
  )
  const isInPlaceFaceReEdit =
    (session.presetId === 'packaging_kit' && isPackagingFaceReEdit(session, pending.screenKey)) ||
    (isBagKitPreset(session.presetId) && isBagFaceReEdit(session, pending.screenKey))
  const generator = getStepGenerator(session.presetId, pending.screenKey)
  const isAudio = generator === 'lyria_music'
  const isPackagingFace =
    session.presetId === 'packaging_kit' &&
    generator === 'packaging_face' &&
    isPackagingFaceStepKey(pending.screenKey)
  const isBagFace =
    isBagKitPreset(session.presetId) &&
    generator === 'packaging_face' &&
    isBagFaceStepKey(pending.screenKey)
  const keepAsReference =
    !isAudio &&
    generator !== 'barcode' &&
    !isPackagingContinueOnlyApproveStep(pending.screenKey) &&
    !isPackagingFace &&
    !isBagFace &&
    shouldKeepMobileShopReferenceOnApprove(session, pending.screenKey, generator)

  let nextSession: HubStudioSession = {
    ...session,
    processSteps: markStepDone(session.processSteps, pending.screenKey),
    pendingPreview: null,
    lastGenerationPrompt: null,
  }

  if (keepAsReference) {
    nextSession = {
      ...nextSession,
      referenceImages: [
        ...nextSession.referenceImages.filter(
          (reference) => reference.screenKey !== pending.screenKey
        ),
        {
          screenKey: pending.screenKey,
          screenLabel: pending.screenLabel,
          url: pending.url,
          approvedAt: Date.now(),
        },
      ],
    }
  }

  if (
    session.presetId &&
    isMobileShopUiStyleAnchorStep(pending.screenKey) &&
    keepAsReference
  ) {
    nextSession = applyMobileShopStyleAnchorReference(
      nextSession,
      pending.screenKey,
      pending.screenLabel,
      pending.url
    )
  }

  if (pending.screenKey === 'box_mockup_3d') {
    nextSession = {
      ...nextSession,
      referenceImages: nextSession.referenceImages.filter(
        (reference) => reference.screenKey !== 'box_mockup_3d'
      ),
    }
  }

  if (session.presetId === 'packaging_kit' && (!isRestoringReference || isInPlaceFaceReEdit)) {
    const slot = packagingStepKeyToSlot(pending.screenKey)
    const faceKey = packagingFaceKeyFromStep(pending.screenKey)
    const packaging = nextSession.packaging ?? {
      version: 2 as const,
      dimensionsMm: null,
      faces: {},
    }
    if (
      pending.screenKey === 'body_strip' &&
      packaging.layout === 'hybrid_strip' &&
      packaging.dimensionsMm
    ) {
      const response = await fetch(pending.url)
      if (!response.ok) throw new Error(`Unable to load body strip (${response.status}).`)
      const split = await splitBodyStripBuffer(
        Buffer.from(await response.arrayBuffer()),
        packaging.dimensionsMm
      )
      const sideEntries: Partial<NonNullable<HubPackagingState['faceSlots']>> = {}
      await Promise.all(
        getBodyStripSegments(packaging.dimensionsMm).map(async ({ slot }) => {
          const buffer = split[slot]
          if (!buffer) return
          const { publicUrl } = await uploadTryOnImagePublic(
            `results/${userId}/body_strip_${slot}_${Date.now()}.png`,
            buffer,
            { contentType: 'image/png', upsert: true }
          )
          sideEntries[slot] = { sourceMode: 'generate', url: publicUrl }
        })
      )
      nextSession.packaging = syncResolvedPackagingFaces({
        ...packaging,
        faceSlots: { ...(packaging.faceSlots ?? {}), ...sideEntries },
        bodyStrip: {
          originalUrl: pending.url,
          foldOffsetsMm: [
            packaging.dimensionsMm.length,
            packaging.dimensionsMm.length + packaging.dimensionsMm.width,
            2 * packaging.dimensionsMm.length + packaging.dimensionsMm.width,
          ],
        },
        dielineUrl: undefined,
        dielineVariants: undefined,
        mockupUrl: undefined,
      })
      nextSession = await refreshPackagingArtifactsAfterFaceChange(nextSession, session, userId)
    } else if (slot) {
      const previousFace = packaging.faceSlots?.[slot]
      const faceArtworkChanged =
        previousFace?.sourceMode !== 'generate' || previousFace.url !== pending.url
      nextSession.packaging = syncResolvedPackagingFaces({
        ...packaging,
        faceSlots: {
          ...(packaging.faceSlots ?? {}),
          [slot]: { sourceMode: 'generate', url: pending.url },
        },
        dielineUrl: faceArtworkChanged ? undefined : packaging.dielineUrl,
        mockupUrl: faceArtworkChanged ? undefined : packaging.mockupUrl,
      })
      if (faceArtworkChanged) {
        nextSession = await refreshPackagingArtifactsAfterFaceChange(nextSession, session, userId)
      }
    } else if (faceKey) {
      const previousFace = faceKey === 'LxW'
        ? packaging.faceSlots?.top
        : faceKey === 'LxH'
          ? packaging.faceSlots?.front
          : packaging.faceSlots?.right
      const faceArtworkChanged =
        previousFace?.sourceMode !== 'generate' || previousFace?.url !== pending.url
      nextSession.packaging = syncResolvedPackagingFaces({
        ...packaging,
        faceSlots: {
          ...(packaging.faceSlots ?? {}),
          ...(faceKey === 'LxW' ? { top: { sourceMode: 'generate' as const, url: pending.url } } : {}),
          ...(faceKey === 'LxH' ? { front: { sourceMode: 'generate' as const, url: pending.url } } : {}),
          ...(faceKey === 'WxH' ? { right: { sourceMode: 'generate' as const, url: pending.url } } : {}),
        },
        dielineUrl: faceArtworkChanged ? undefined : packaging.dielineUrl,
        dielineVariants: faceArtworkChanged ? undefined : packaging.dielineVariants,
        mockupUrl: faceArtworkChanged ? undefined : packaging.mockupUrl,
      })
      if (faceArtworkChanged) {
        nextSession = await refreshPackagingArtifactsAfterFaceChange(nextSession, session, userId)
      }
    } else if (pending.screenKey === 'box_mockup_3d') {
      nextSession.packaging = { ...packaging, mockupUrl: pending.url }
    } else if (pending.screenKey === 'barcode_label') {
      nextSession.packaging = {
        ...packaging,
        barcodeUrl: pending.url,
        barcodeArtifacts: packaging.barcodeArtifacts,
        barcodeFormEntries: packaging.barcodeFormEntries,
        barcodeQrPayload: packaging.barcodeQrPayload,
      }
    }
  }

  if (isBagKitPreset(session.presetId) && (!isRestoringReference || isInPlaceFaceReEdit)) {
    const slot = bagStepKeyToSlot(pending.screenKey)
    if (slot) {
      nextSession = applyBagFaceSlotToSession(nextSession, pending.screenKey, {
        sourceMode: 'generate',
        url: pending.url,
      })
    } else if (pending.screenKey === 'bag_mockup_3d') {
      const existing = nextSession.bagKit ?? emptyBagKitState()
      nextSession = {
        ...nextSession,
        bagKit: {
          ...existing,
          mockupUrl: existing.mockupUrl ?? pending.url,
          mockupPhotoUrl:
            existing.mockupPhotoUrl ??
            (existing.mockupUrl && pending.url !== existing.mockupUrl ? pending.url : undefined),
        },
      }
    } else if (pending.screenKey === 'bag_dieline_pdf') {
      nextSession = {
        ...nextSession,
        bagKit: {
          ...(nextSession.bagKit ?? emptyBagKitState()),
          dielineUrl: pending.url,
        },
      }
    }
  }

  let next: HubStudioProcessStep | null = null
  const reEditStay = Boolean(
    (session.presetId === 'packaging_kit' &&
      isPackagingFaceReEdit(session, pending.screenKey) &&
      pending.screenKey === previousCurrentStepKey) ||
      (isBagKitPreset(session.presetId) &&
        isBagFaceReEdit(session, pending.screenKey) &&
        pending.screenKey === previousCurrentStepKey)
  )
  const navigatedBackStay =
    session.presetId &&
    isNavigatedBackEdit(session, session.presetId) &&
    pending.screenKey === previousCurrentStepKey
  const stayOnApprovedStep = (navigatedBackStay || reEditStay) && !isRestoringReference
  if (isRestoringReference && previousCurrentStepKey) {
    nextSession.currentStepKey = previousCurrentStepKey
    nextSession.processSteps = setStepInProgress(nextSession.processSteps, previousCurrentStepKey)
    next = nextSession.processSteps.find((s) => s.key === previousCurrentStepKey) ?? null
  } else if (stayOnApprovedStep) {
    nextSession.processSteps = markStepDone(nextSession.processSteps, pending.screenKey)
    nextSession.currentStepKey = pending.screenKey
    next = nextSession.processSteps.find((s) => s.key === pending.screenKey) ?? null
  } else {
    next = nextPendingStep(nextSession.processSteps)
    nextSession.currentStepKey = next?.key ?? null
    nextSession.processSteps = setStepInProgress(nextSession.processSteps, nextSession.currentStepKey)
  }
  if (
    nextSession.presetId &&
    nextSession.currentStepKey &&
    stepSupportsGenerationRefPicker(nextSession.presetId, nextSession.currentStepKey)
  ) {
    nextSession = resetGenerationSelectionForStep(nextSession, nextSession.presetId, nextSession.currentStepKey)
  }
  await pgSaveHubThreadSession(threadId, nextSession)

  const t = getDictionary(locale).hubChat
  const nextLabel = next?.label ?? ''
  const reply =
    stayOnApprovedStep
      ? t.studioStepSavedStay.replace('{screen}', pending.screenLabel)
      : next
        ? t.studioApprovedNext.replace('{screen}', pending.screenLabel).replace('{next}', nextLabel)
        : t.studioAllDone

  const studio: HubStudioMessagePayload = {
    processSteps: nextSession.processSteps,
    screenLabel: pending.screenLabel,
    screenKey: pending.screenKey,
    ...(isAudio ? { audioUrl: pending.url } : { imageUrl: pending.url }),
    showApproveReference: false,
    showRegenerate:
      isPackagingContinueOnlyApproveStep(pending.screenKey) ||
      isMobileShopContinueOnlyApproveStep(session.presetId, pending.screenKey, generator) ||
      generatorSupportsReference(getStepGenerator(session.presetId, pending.screenKey) ?? 'ui_mockup'),
  }
  return { session: nextSession, reply, studio }
}

export async function handleHubStudio(input: HubStudioHandlerInput): Promise<HubStudioHandlerResult> {
  const action: HubStudioAction = input.action ?? 'message'
  let session = (await pgGetHubThreadSession(input.threadId)) ?? emptyStudioSession()
  session = reconcilePackagingProcessSteps(session, input.locale)
  session = reconcileDesignRecreateProcessSteps(session, input.locale)
  session = applyStudioSessionLabels(session, input.locale)
  let reply = ''
  let studio: HubStudioMessagePayload | undefined
  let chargedChat = 0
  let chargedImage = 0
  const t = getDictionary(input.locale).hubChat

  if (action === 'classify_flow_switch') {
    const message = String(input.message ?? '').trim()
    const currentPresetId = session.presetId
    if (!message || !isActiveStudioFlow(session) || !currentPresetId) {
      return {
        ok: true,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        flowSwitch: { switchPresetId: null, confidence: 0 },
      }
    }

    const ruleMatch = detectStudioFlowSwitch(message, currentPresetId)
    if (ruleMatch) {
      return {
        ok: true,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        flowSwitch: { switchPresetId: ruleMatch, confidence: 1 },
      }
    }

    const classified = await classifyStudioFlowSwitchWithAi({
      apiKey: input.apiKey,
      userId: input.userId,
      locale: input.locale,
      message,
      currentPresetId,
    })
    const flowSwitch = isHighConfidenceFlowSwitch(classified, currentPresetId)
      ? classified
      : { switchPresetId: null, confidence: classified.confidence }

    return {
      ok: true,
      reply: '',
      session,
      threadId: input.threadId,
      chargedChat: 0,
      flowSwitch,
    }
  }

  if (action === 'classify_feature_intent') {
    const message = String(input.message ?? '').trim()
    const emptyIntent = { featureKey: null as string | null, confidence: 0 }
    if (!message) {
      return {
        ok: true,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        featureIntent: emptyIntent,
      }
    }

    const currentPresetId = session.presetId ?? null

    if (isActiveStudioFlow(session) && currentPresetId) {
      const ruleSwitch = detectStudioFlowSwitch(message, currentPresetId)
      if (ruleSwitch) {
        return {
          ok: true,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          featureIntent: { featureKey: `studio:${ruleSwitch}`, confidence: 1 },
        }
      }
    }

    if (!shouldSkipFlowSwitchAiClassification(message, session)) {
      const featureMatch = matchFeatureFlowByMessage(message, input.locale)
      if (featureMatch?.kind === 'standalone' && featureMatch.score >= 8) {
        return {
          ok: true,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          featureIntent: { featureKey: `tool:${featureMatch.href}`, confidence: 1 },
        }
      }
      if (
        featureMatch?.kind === 'studio' &&
        featureMatch.score >= 10 &&
        featureMatch.presetId !== currentPresetId
      ) {
        return {
          ok: true,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          featureIntent: { featureKey: `studio:${featureMatch.presetId}`, confidence: 1 },
        }
      }
    }

    if (shouldSkipFlowSwitchAiClassification(message, session)) {
      return {
        ok: true,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        featureIntent: emptyIntent,
      }
    }

    const classified = await classifyFeatureIntentWithAi({
      apiKey: input.apiKey,
      userId: input.userId,
      locale: input.locale,
      message,
      currentPresetId,
    })
    if (
      !classified.featureKey ||
      classified.confidence < FLOW_SWITCH_AI_MIN_CONFIDENCE ||
      !getHubFeatureCatalogEntry(input.locale, classified.featureKey)
    ) {
      return {
        ok: true,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        featureIntent: { featureKey: null, confidence: classified.confidence },
      }
    }

    const selection = resolveHubFeatureSelection(classified.featureKey, input.locale)
    if (selection?.kind === 'studio' && selection.presetId === currentPresetId) {
      return {
        ok: true,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        featureIntent: emptyIntent,
      }
    }

    return {
      ok: true,
      reply: '',
      session,
      threadId: input.threadId,
      chargedChat: 0,
      featureIntent: classified,
    }
  }

  if (action === 'select_feature') {
    if (blocksPresetStartOnThread(session)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNewFlowThreadRequired,
      }
    }

    const featureKey = String(input.featureKey ?? '').trim()
    const catalogEntry = getHubFeatureCatalogEntry(input.locale, featureKey)
    const selection = resolveHubFeatureSelection(featureKey, input.locale)
    if (!catalogEntry || !selection) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }

    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: catalogEntry.label,
    })

    if (selection.kind === 'studio') {
      const presetId = selection.presetId
      const preset = getStudioPreset(presetId)
      if (!preset) {
        return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
      }
      if (blocksPresetStartOnThread(session)) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.studioNewFlowThreadRequired,
        }
      }
      const steps = buildStepsFromPreset(input.locale, presetId)
      session = {
        ...emptyStudioSession(),
        presetId,
        projectTitle: presetTitle(input.locale, presetId),
        processSteps: steps,
        currentStepKey: steps[0]?.key ?? null,
        discoveryComplete: false,
        briefNotes:
          presetId === 'packaging_kit'
            ? (() => {
                const fields = defaultPrintLanguageFields(input.locale)
                return {
                  [PRINT_LANGUAGE_STEP_KEY]: fields.print_language,
                  ...(fields.print_language_detail
                    ? { [PRINT_LANGUAGE_DETAIL_STEP_KEY]: fields.print_language_detail }
                    : {}),
                }
              })()
            : presetId === 'bag_kit'
              ? bagKitStartBriefNotes(input.locale)
              : {},
        uploadImages: [],
        packaging: presetId === 'packaging_kit'
          ? { version: 2, layout: 'six_faces', dimensionsMm: null, faces: {} }
          : undefined,
        bagKit: presetId === 'bag_kit' ? emptyBagKitState() : undefined,
      }
      await pgSaveHubThreadSession(input.threadId, session)
      const firstKey = steps[0]?.key ?? ''
      reply = appendStepAsk(getPresetKickoff(input.locale, presetId), input.locale, presetId, firstKey)
      studio = { processSteps: session.processSteps, needsUpload: preset.needsUpload || undefined }
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
    }

    const advisory = await buildAdvisoryPayload({
      locale: input.locale,
      userId: input.userId,
      threadId: input.threadId,
      message: catalogEntry.label,
      hubRoute: 'workflow',
      workflowsRaw: [],
      planRaw: null,
    })
    reply = buildStandaloneFeatureAdvisoryReply(input.locale, selection)
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      workflows: advisory.workflows.length ? advisory.workflows : null,
    })
    return {
      ok: true,
      reply,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      workflows: advisory.workflows,
      hubRoute: 'workflow',
    }
  }

  if (action === 'start_preset') {
    const presetId = String(input.presetId ?? '').trim()
    const preset = getStudioPreset(presetId)
    if (!preset) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    if (blocksPresetStartOnThread(session)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNewFlowThreadRequired,
      }
    }
    const steps = buildStepsFromPreset(input.locale, presetId)
    session = {
      ...emptyStudioSession(),
      presetId,
      projectTitle: presetTitle(input.locale, presetId),
      processSteps: steps,
      currentStepKey: steps[0]?.key ?? null,
      discoveryComplete: false,
      briefNotes:
        presetId === 'packaging_kit'
          ? (() => {
              const fields = defaultPrintLanguageFields(input.locale)
              return {
                [PRINT_LANGUAGE_STEP_KEY]: fields.print_language,
                ...(fields.print_language_detail
                  ? { [PRINT_LANGUAGE_DETAIL_STEP_KEY]: fields.print_language_detail }
                  : {}),
              }
            })()
          : presetId === 'bag_kit'
            ? bagKitStartBriefNotes(input.locale)
            : {},
      uploadImages: [],
      packaging: presetId === 'packaging_kit'
        ? { version: 2, layout: 'six_faces', dimensionsMm: null, faces: {} }
        : undefined,
      bagKit: presetId === 'bag_kit' ? emptyBagKitState() : undefined,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    const firstKey = steps[0]?.key ?? ''
    reply = appendStepAsk(getPresetKickoff(input.locale, presetId), input.locale, presetId, firstKey)
    studio = { processSteps: session.processSteps, needsUpload: preset.needsUpload || undefined }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'generate_current_step') {
    const currentDesignStep = resolveCurrentStudioDesignStep(session)
    if (!currentDesignStep) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const { presetId, stepKey, generator } = currentDesignStep
    if (session.currentStepKey !== stepKey) {
      session = { ...session, currentStepKey: stepKey }
    }
    session = clearStalePendingForArtifactGenerate(session, stepKey)
    if (presetId === 'sale_banner' && stepKey === 'banner_design') {
      session = mergeBannerDesignInputIntoSession(session, input)
      await pgSaveHubThreadSession(input.threadId, session)
    }
    if (presetId === 'food_menu' && stepKey === 'menu_design') {
      session = mergeMenuDesignInputIntoSession(session, input)
      await pgSaveHubThreadSession(input.threadId, session)
    }
    if (presetId === 'landing_page' && isLandingDesignStepKey(stepKey)) {
      session = mergeLandingDesignInputIntoSession(session, input)
      await pgSaveHubThreadSession(input.threadId, session)
    }
    if (pendingPreviewBlocksWorkflowInput(session)) {
      const pendingKey = session.pendingPreview?.screenKey ?? stepKey
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioApproveBeforeNext.replace(
          '{screen}',
          stepLabel(session, pendingKey, input.locale)
        ),
      }
    }
    if (input.generationRefKeys !== undefined) {
      session = applyGenerationRefKeys(session, presetId, input.generationRefKeys)
    }
    if (input.message?.trim()) {
      session = saveCurrentStudioStepBrief(session, input.message.trim())
    }
    if (presetId === 'sale_banner' && stepKey === 'banner_design') {
      const presetIds = resolveSelectedBannerPresetIds(session, input)
      if (!presetIds.length) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.studioBannerNeedRatio,
        }
      }
      if (input.message?.trim()) {
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'user',
          content: input.message.trim(),
          studio: { stepKey },
        })
      }
      const label = stepLabel(session, stepKey, input.locale)
      const batch = await generateSaleBannerBatch({
        userId: input.userId,
        apiKey: input.apiKey,
        locale: input.locale,
        session,
        presetIds,
      })
      session = batch.session
      studio = batch.studio
      reply = batch.error
        ? batch.error
        : batch.batchCount > 1
          ? t.studioBannerBatchGenerated
              .replace('{n}', String(batch.batchCount))
              .replace('{total}', String(batch.batchCount))
          : t.studioGeneratedStep.replace('{screen}', label)
      await pgSaveHubThreadSession(input.threadId, session)
      if (studio?.imageUrl) {
        await upsertHubStudioImageMessage({
          threadId: input.threadId,
          content: reply,
          studio,
        })
      } else if (reply) {
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'assistant',
          content: reply,
          studio,
        })
      }
      return {
        ok: batch.ok && !batch.error,
        reply,
        studio,
        session,
        threadId: input.threadId,
        chargedChat: 0,
        chargedImage: batch.chargedImage || undefined,
        error: batch.error,
      }
    }
    if (presetId === 'food_menu' && stepKey === 'menu_design') {
      const formatId = normalizeMenuFormatPresetId(
        input.menuFormatPresetId ?? session.foodMenu?.formatPresetId ?? ''
      )
      if (!formatId) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.studioMenuNeedFormat,
        }
      }
      const dishes = normalizeMenuDishes(input.menuDishes ?? session.foodMenu?.dishes ?? [])
      const dishesBulkText =
        input.menuDishesBulkText !== undefined
          ? String(input.menuDishesBulkText)
          : session.foodMenu?.dishesBulkText ?? ''
      if (!menuInputHasContent(dishes, dishesBulkText)) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.studioMenuNeedDishes,
        }
      }
      session = mergeMenuDesignInputIntoSession(session, {
        menuFormatPresetId: formatId,
        menuDishes: dishes,
        menuDishesBulkText: dishesBulkText,
      })
      const label = stepLabel(session, stepKey, input.locale)
      const generated = await generateFoodMenu({
        userId: input.userId,
        apiKey: input.apiKey,
        locale: input.locale,
        session,
      })
      session = generated.session
      studio = generated.studio
      reply = generated.error
        ? generated.error
        : t.studioGeneratedStep.replace('{screen}', label)
      await pgSaveHubThreadSession(input.threadId, session)
      if (studio?.imageUrl) {
        await upsertHubStudioImageMessage({
          threadId: input.threadId,
          content: reply,
          studio,
        })
      } else if (reply) {
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'assistant',
          content: reply,
          studio,
        })
      }
      return {
        ok: generated.ok && !generated.error,
        reply,
        studio,
        session,
        threadId: input.threadId,
        chargedChat: 0,
        chargedImage: generated.chargedImage || undefined,
        error: generated.error,
      }
    }
    let prompt = session.briefNotes[stepKey]?.trim() ?? ''
    if (input.landingSectionCopy?.trim() && presetId === 'landing_page') {
      prompt = input.landingSectionCopy.trim()
      session = saveCurrentStudioStepBrief(session, prompt)
    }
    const canRunWithoutBrief =
      generator === 'packaging_mockup' || generator === 'dieline_pdf'
    const landingCopyReady =
      presetId === 'landing_page' &&
      isLandingDesignStepKey(stepKey) &&
      landingSectionHasCopy(stepKey, session.briefNotes, prompt)
    if (
      presetId === 'landing_page' &&
      stepKey === 'landing_full' &&
      !hasLandingHeaderLogo(session.landingPage)
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLandingNeedLogo,
      }
    }
    if (!generator || (!canRunWithoutBrief && !landingCopyReady && prompt.length < 2)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error:
          presetId === 'landing_page' && isLandingDesignStepKey(stepKey)
            ? t.studioLandingNeedCopy
            : t.studioNoPrompt,
      }
    }
    if (input.message?.trim()) {
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'user',
        content: input.message.trim(),
        studio: { stepKey },
      })
    }
    const label = stepLabel(session, stepKey, input.locale)
    const resolvedLandingCopy =
      presetId === 'landing_page' && isLandingDesignStepKey(stepKey)
        ? prompt ||
          (stepKey === 'landing_full' && hasLandingDiscoveryBrief(session.briefNotes)
            ? LANDING_DISCOVERY_BRIEF_KEYS.map((k) => session.briefNotes[k]?.trim())
                .filter(Boolean)
                .join(' · ')
            : label)
        : prompt || label
    let generationPrompt: string
    if (presetId === 'landing_page' && isLandingDesignStepKey(stepKey)) {
      const landingPrompt = await resolveLandingImageGenerationPrompt({
        userId: input.userId,
        apiKey: input.apiKey,
        locale: input.locale,
        session,
        sectionCopy: resolvedLandingCopy,
        stepLabel: label,
      })
      generationPrompt = landingPrompt.prompt
    } else {
      generationPrompt = buildDesignPromptFromMessage(
        session,
        presetId,
        stepKey,
        prompt || label,
        input.locale
      )
    }
    let generated = await generateAsset(
      input.userId,
      session,
      generationPrompt,
      stepKey,
      label,
      input.locale
    )
    session = generated.session
    studio = generated.studio
    reply = generated.error
      ? generated.error
      : generator === 'packaging_mockup' || generator === 'dieline_pdf'
        ? deterministicPackagingGeneratedReply(input.locale, label)
        : t.studioGeneratedStep.replace('{screen}', label)
    await pgSaveHubThreadSession(input.threadId, session)
    if (!generated.error) {
      await upsertHubStudioImageMessage({
        threadId: input.threadId,
        content: reply,
        studio,
      })
    }
    return {
      ok: !generated.error,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      chargedImage: generated.chargedImage || undefined,
      error: generated.error,
    }
  }

  if (action === 'generate_packaging_barcodes') {
    const activeStep = getActiveStepKey(session)
    if (
      session.presetId !== 'packaging_kit' ||
      activeStep !== 'barcode_label' ||
      !session.discoveryComplete
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = clearStalePendingForArtifactGenerate(session, 'barcode_label')
    if (pendingPreviewBlocksWorkflowInput(session)) {
      const pendingKey = session.pendingPreview?.screenKey ?? 'barcode_label'
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioApproveBeforeNext.replace(
          '{screen}',
          stepLabel(session, pendingKey, input.locale)
        ),
      }
    }
    const generateUserCopy: Record<WebLocale, string> = {
      vi: 'Tạo mã QR sản phẩm',
      en: 'Generate product QR code',
      zh: '生成产品 QR 码',
      ja: '製品QRコードを作成',
      ko: '제품 QR 코드 생성',
    }
    const userCopy = generateUserCopy[input.locale]
    const label = stepLabel(session, 'barcode_label', input.locale)
    const bundle = await exportPackagingBarcodeBundle({
      userId: input.userId,
      locale: input.locale,
      session,
      entries: input.barcodeEntries ?? [],
    })
    if ('error' in bundle) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: bundle.error,
      }
    }
    const barcodePackaging = {
      ...(session.packaging ?? {
        version: 2 as const,
        dimensionsMm: null,
        faces: {},
      }),
      barcodeUrl: bundle.primary.url,
      barcodeArtifacts: bundle.artifacts,
      barcodeFormEntries: bundle.formEntries,
      barcodeQrPayload: bundle.qrPayload,
    }
    session = {
      ...session,
      pendingPreview: {
        screenKey: 'barcode_label',
        screenLabel: label,
        url: bundle.primary.url,
        generationPrompt: userCopy,
      },
      lastGenerationPrompt: userCopy,
      packaging: barcodePackaging,
    }
    studio = {
      imageUrl: bundle.primary.url,
      artifactUrl: bundle.primary.url,
      artifactKind: 'barcode',
      artifactFileName: bundle.primary.fileName,
      artifactLabel: label,
      artifactNote: bundle.note,
      artifactDownloadLabel: bundle.downloadLabel,
      barcodeArtifacts: bundle.studioArtifacts,
      screenKey: 'barcode_label',
      screenLabel: label,
      previewKind: 'banner',
      aspectHint: 'square',
      processSteps: session.processSteps,
      showRegenerate: true,
      showApproveReference: true,
    }
    reply = bundle.note
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userCopy,
      studio: { stepKey: 'barcode_label' },
    })
    await upsertHubStudioImageMessage({
      threadId: input.threadId,
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'skip_packaging_face' || action === 'copy_packaging_face') {
    const stepKey = session.currentStepKey
    if (!stepKey || session.pendingPreview || !session.discoveryComplete) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }

    if (isBagKitPreset(session.presetId)) {
      if (!isBagFaceStepKey(stepKey)) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.errorGeneric,
        }
      }
      const slot = bagStepKeyToSlot(stepKey)
      if (!slot) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.errorGeneric,
        }
      }
      let entry: { sourceMode: 'empty' | 'copy'; url?: string }
      let addReference = false
      if (action === 'copy_packaging_face') {
        const sourceUrl = copySourceUrlForBagSlot(session.bagKit, slot)
        if (!sourceUrl) {
          return {
            ok: false,
            reply: '',
            session,
            threadId: input.threadId,
            chargedChat: 0,
            error: t.errorGeneric,
          }
        }
        entry = { sourceMode: 'copy', url: sourceUrl }
        addReference = true
      } else {
        entry = { sourceMode: 'empty' }
      }
      const label = stepLabel(session, stepKey, input.locale)
      const stayOnStep =
        isNavigatedBackEdit(session, session.presetId!) || isBagFaceReEdit(session, stepKey)
      const advanced = advanceAfterBagFaceStep(
        session,
        stepKey,
        label,
        input.locale,
        entry,
        addReference,
        { stayOnStep }
      )
      session = applyBagSessionLabels(advanced.session, input.locale)
      reply = advanced.reply
      studio = {
        processSteps: session.processSteps,
        ...buildReferencePreviewsPayload(session),
        ...(session.currentStepKey
          ? buildGenerationRefPickerPayload(session, 'bag_kit', session.currentStepKey)
          : {}),
      }
      await pgSaveHubThreadSession(input.threadId, session)
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
    }

    const slot = stepKey ? packagingStepKeyToSlot(stepKey) : null
    if (session.presetId !== 'packaging_kit' || !slot) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    let entry: { sourceMode: 'empty' | 'copy'; url?: string }
    let addReference = false
    if (action === 'copy_packaging_face') {
      const sourceUrl = session.packaging
        ? copySourceUrlForSlot(session.packaging, slot)
        : null
      if (!sourceUrl) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.errorGeneric,
        }
      }
      entry = { sourceMode: 'copy', url: sourceUrl }
      addReference = true
    } else {
      entry = { sourceMode: 'empty' }
    }
    const label = stepLabel(session, stepKey, input.locale)
    const stayOnStep =
      isNavigatedBackEdit(session, session.presetId) ||
      isPackagingFaceReEdit(session, stepKey)
    const advanced = advanceAfterPackagingFaceStep(
      session,
      stepKey,
      label,
      input.locale,
      entry,
      addReference,
      { stayOnStep }
    )
    session = advanced.session
    reply = advanced.reply
    studio = {
      processSteps: session.processSteps,
      ...buildReferencePreviewsPayload(session),
      ...(session.currentStepKey
        ? buildGenerationRefPickerPayload(session, 'packaging_kit', session.currentStepKey)
        : {}),
    }
    await pgSaveHubThreadSession(input.threadId, session)
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'set_box_production') {
    const raw = input.boxDimensionsMm
    const dimensionsMm =
      raw &&
      Number.isFinite(raw.length) &&
      Number.isFinite(raw.width) &&
      Number.isFinite(raw.height) &&
      Number(raw.length) > 0 &&
      Number(raw.width) > 0 &&
      Number(raw.height) > 0
        ? { length: Number(raw.length), width: Number(raw.width), height: Number(raw.height) }
        : null
    if (
      session.presetId !== 'packaging_kit' ||
      !dimensionsMm
    ) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: boxSizeError(input.locale, 'format') }
    }
    const activeStep = getActiveStepKey(session) ?? session.currentStepKey
    const fromFaceConfirm = activeStep === 'box_face_confirm'
    if (!isBoxSizeStepKey(activeStep) && !fromFaceConfirm) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: boxSizeError(input.locale, 'format') }
    }
    const productionCandidate = {
      ...defaultTuckBoxProductionParams(dimensionsMm.height),
      ...(input.boxProduction ?? {}),
    } as TuckBoxProductionParams
    if (Object.keys(validateTuckBoxProductionParams(productionCandidate)).length) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: boxSizeError(input.locale, 'range') }
    }
    const production = normalizeTuckBoxProductionParams(productionCandidate, dimensionsMm.height)
    const previous = session.packaging
    const dimensionsChanged =
      !previous?.dimensionsMm ||
      previous.dimensionsMm.length !== dimensionsMm.length ||
      previous.dimensionsMm.width !== dimensionsMm.width ||
      previous.dimensionsMm.height !== dimensionsMm.height
    const userValue = formatBoxBriefSize(input.locale, dimensionsMm)
    session = {
      ...session,
      packaging: {
        ...packagingBase(session),
        version: 2,
        layout: 'six_faces',
        dimensionsMm,
        production,
        dimensionDraft: undefined,
        facesConfirmed: false,
        faceAspectRatios: undefined,
        ...(dimensionsChanged
          ? { faces: {}, faceSlots: {}, bodyStrip: undefined, mockupUrl: undefined, dielineUrl: undefined, dielineVariants: undefined }
          : { dielineUrl: undefined, dielineVariants: undefined }),
      },
      briefNotes: { ...session.briefNotes, box_size: userValue },
    }
    if (dimensionsChanged) session = invalidatePackagingForDimensionChange(session)
    session = applyStudioSessionLabels(session, input.locale)
    if (fromFaceConfirm) {
      const confirmed = buildBoxSizeConfirmReply(input.locale, dimensionsMm, session.processSteps, production)
      reply = confirmed.reply
      await pgSaveHubThreadSession(input.threadId, session)
      const userMessageId = await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'user',
        content: userValue,
        studio: { stepKey: 'box_face_confirm' },
      })
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio: confirmed.studio,
      })
      return {
        ok: true,
        reply,
        studio: confirmed.studio,
        session,
        threadId: input.threadId,
        chargedChat: 0,
        userMessageId: userMessageId ?? undefined,
      }
    }
    session = completeBoxSizeDiscovery(session)
    session = applyStudioSessionLabels(session, input.locale)
    const confirmed = buildBoxSizeConfirmReply(input.locale, dimensionsMm, session.processSteps, production)
    reply = confirmed.reply
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userValue,
      studio: { stepKey: 'box_size' },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio: confirmed.studio,
    })
    return {
      ok: true,
      reply,
      studio: confirmed.studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'set_box_dieline_structure') {
    const structure = parseBoxDielineStructure(input.boxDielineStructure)
    const dimensionsMm = session.packaging?.dimensionsMm
    const activeStep = getActiveStepKey(session)
    if (
      !structure ||
      !dimensionsMm ||
      session.presetId !== 'packaging_kit' ||
      (activeStep !== 'box_face_confirm' && activeStep !== 'box_dieline_pdf')
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const structureLabel = boxDielineStructureCopy(structure, input.locale).label

    if (activeStep === 'box_dieline_pdf') {
      const generateUserCopy: Record<WebLocale, string> = {
        vi: 'Tạo 2 file Dieline PDF (Dải ngang + Chữ thập)',
        en: 'Generate both Dieline PDFs (horizontal strip + cross net)',
        zh: '生成 2 个 Dieline PDF（横向排版 + 十字排版）',
        ja: '2種類のDieline PDFを作成（横一列 + 十字型）',
        ko: 'Dieline PDF 2종 생성(가로 스트립 + 십자형)',
      }
      session = {
        ...session,
        packaging: {
          ...session.packaging!,
          dielineStructure: structure,
          dielineUrl: undefined,
          dielineVariants: undefined,
        },
      }
      const artifactLabel = stepLabel(session, 'box_dieline_pdf', input.locale)
      const generated = await generateAsset(
        input.userId,
        session,
        generateUserCopy[input.locale],
        'box_dieline_pdf',
        artifactLabel,
        input.locale
      )
      session = generated.session
      studio = generated.studio
      reply = generated.error
        ? generated.error
        : deterministicPackagingGeneratedReply(input.locale, artifactLabel)
      await pgSaveHubThreadSession(input.threadId, session)
      const userMessageId = await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'user',
        content: generateUserCopy[input.locale],
        studio: { stepKey: 'box_dieline_pdf' },
      })
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return {
        ok: true,
        reply,
        studio,
        session,
        threadId: input.threadId,
        chargedChat: 0,
        chargedImage: generated.chargedImage || undefined,
        userMessageId: userMessageId ?? undefined,
      }
    }

    const plan = buildPackagingFaceAspectPlan(dimensionsMm)
    const completedSteps = markStepDone(session.processSteps, 'box_face_confirm')
    const next = nextPendingStep(completedSteps)
    session = {
      ...session,
      briefNotes: {
        ...session.briefNotes,
        box_face_confirm: structure,
      },
      packaging: {
        ...session.packaging!,
        dielineStructure: structure,
        faceAspectRatios: faceAspectRatiosFromPlan(plan),
        facesConfirmed: true,
        dielineUrl: undefined,
        dielineVariants: undefined,
      },
      processSteps: setStepInProgress(completedSteps, next?.key ?? null),
      currentStepKey: next?.key ?? null,
    }
    const selectedCopy: Record<WebLocale, string> = {
      vi: `Đã chọn kết cấu dieline: **${structureLabel}**.`,
      en: `Dieline structure selected: **${structureLabel}**.`,
      zh: `已选择刀模结构：**${structureLabel}**。`,
      ja: `展開図の構造を選択しました：**${structureLabel}**。`,
      ko: `도면 구조를 선택했습니다: **${structureLabel}**.`,
    }
    reply = selectedCopy[input.locale]
    if (session.currentStepKey) {
      reply = appendStepAsk(reply, input.locale, 'packaging_kit', session.currentStepKey)
    }
    const selectedStudio = buildBoxSizeConfirmReply(
      input.locale,
      dimensionsMm,
      session.processSteps,
      session.packaging?.production,
      structure
    ).studio
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: structureLabel,
      studio: { stepKey: 'box_face_confirm' },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio: selectedStudio,
    })
    return {
      ok: true,
      reply,
      studio: selectedStudio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'upload_images') {
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNeedUpload }
    }
    let filesToUpload = files
    if (session.presetId === 'design_recreate') {
      const remaining = Math.max(0, DESIGN_RECREATE_MAX_UPLOAD - session.uploadImages.length)
      filesToUpload = files.slice(0, remaining)
      if (!filesToUpload.length) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: designRecreateUploadReply(input.locale, 'max'),
        }
      }
    }
    const urls = await uploadStudioImages(input.userId, filesToUpload)
    session = {
      ...session,
      uploadImages: [...session.uploadImages, ...urls],
      ...(session.presetId === 'design_recreate'
        ? {
            designRecreate: {
              ...(session.designRecreate ?? {}),
              recreationBrief: undefined,
              briefSource: undefined,
              analyzedAt: undefined,
            },
          }
        : {}),
    }
    if (session.presetId === 'design_recreate' && session.uploadImages.length > 0) {
      const ensured = await ensureDesignRecreationBrief(input.userId, session)
      session = ensured.session
      reply = t.studioImagesUploaded.replace('{n}', String(urls.length))
      if (session.designRecreate?.recreationBrief) {
        reply += designRecreateUploadReply(input.locale, 'analyzed')
      } else if (ensured.error) {
        reply += ` (${ensured.error})`
      }
    } else {
      reply = t.studioImagesUploaded.replace('{n}', String(urls.length))
    }
    await pgSaveHubThreadSession(input.threadId, session)
    studio = {
      processSteps: session.processSteps,
      needsUpload: session.presetId === 'design_recreate' ? session.uploadImages.length < DESIGN_RECREATE_MAX_UPLOAD : false,
    }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'confirm_sample_upload') {
    const stepKey = 'sample_upload'
    const activeKey = getActiveStepKey(session) ?? session.currentStepKey
    if (
      session.presetId !== 'design_recreate' ||
      activeKey !== stepKey ||
      session.uploadImages.length < 1
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error:
          session.presetId === 'design_recreate' && session.uploadImages.length < 1
            ? designRecreateUploadReply(input.locale, 'need_image')
            : t.errorGeneric,
      }
    }
    if (!session.designRecreate?.recreationBrief) {
      const ensured = await ensureDesignRecreationBrief(input.userId, session)
      session = ensured.session
    }
    const n = session.uploadImages.length
    const userLabel =
      input.locale === 'en'
        ? `Uploaded ${n} sample photo(s)`
        : input.locale === 'zh'
          ? `已上传 ${n} 张样品图`
          : input.locale === 'ja'
            ? `サンプル画像 ${n} 枚をアップロード`
            : input.locale === 'ko'
              ? `샘플 사진 ${n}장 업로드`
              : `Đã tải ${n} ảnh mẫu`
    let nextSession: HubStudioSession = {
      ...session,
      briefNotes: {
        ...session.briefNotes,
        [stepKey]: userLabel,
      },
      processSteps: markStepDone(session.processSteps, stepKey),
    }
    const justFinishedDiscovery = allDiscoveryDone('design_recreate', nextSession.processSteps)
    if (justFinishedDiscovery) nextSession.discoveryComplete = true
    const next = nextPendingStep(nextSession.processSteps)
    nextSession.currentStepKey = next?.key ?? null
    nextSession.processSteps = setStepInProgress(nextSession.processSteps, nextSession.currentStepKey)
    let confirmReply = designRecreateUploadReply(input.locale, 'confirmed')
    if (nextSession.currentStepKey) {
      confirmReply = appendStepAsk(confirmReply, input.locale, 'design_recreate', nextSession.currentStepKey)
    }
    nextSession = reconcileDiscoveryProgress(nextSession, input.locale)
    nextSession = syncDiscoveryCurrentStep(nextSession, input.locale)
    session = nextSession
    reply = confirmReply
    studio = {
      processSteps: session.processSteps,
      needsUpload: false,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userLabel,
      studio: { stepKey },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'set_generation_refs') {
    if (!session.presetId) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const presetId = session.presetId
    session = applyGenerationRefKeys(session, presetId, input.generationRefKeys ?? [])
    await pgSaveHubThreadSession(input.threadId, session)
    const stepKey = session.currentStepKey ?? ''
    studio = {
      processSteps: session.processSteps,
      ...buildGenerationRefPickerPayload(session, presetId, stepKey),
    }
    return { ok: true, reply: '', studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'set_face_print_style') {
    const styleKey = parseFacePrintStyleKey(input.facePrintStyle)
    if (
      !styleKey ||
      !isPackagingLikePreset(session.presetId) ||
      session.currentStepKey !== FACE_PRINT_STYLE_STEP_KEY
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const userLabel = facePrintStyleLabel(styleKey, input.locale)
    const confirmedReply = t.studioFacePrintStyleConfirmed.replace('{style}', userLabel)
    if (isBagKitPreset(session.presetId)) {
      const advanced = advanceBagDiscoveryAfterBriefAnswer(
        session,
        input.locale,
        FACE_PRINT_STYLE_STEP_KEY,
        facePrintStyleBriefValue(styleKey),
        confirmedReply
      )
      session = applyBagSessionLabels(advanced.session, input.locale)
      reply = advanced.reply
      studio = advanced.studio
      await pgSaveHubThreadSession(input.threadId, session)
      const userMessageId = await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'user',
        content: userLabel,
      })
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return {
        ok: true,
        reply,
        studio,
        session,
        threadId: input.threadId,
        chargedChat: 0,
        userMessageId: userMessageId ?? undefined,
      }
    }
    session = {
      ...session,
      briefNotes: {
        ...session.briefNotes,
        [FACE_PRINT_STYLE_STEP_KEY]: facePrintStyleBriefValue(styleKey),
      },
      processSteps: markStepDone(session.processSteps, FACE_PRINT_STYLE_STEP_KEY),
    }
    const justFinishedDiscovery = allDiscoveryDone('packaging_kit', session.processSteps)
    if (justFinishedDiscovery) session.discoveryComplete = true
    const next = nextPendingStep(session.processSteps)
    session.currentStepKey = next?.key ?? null
    session.processSteps = setStepInProgress(session.processSteps, session.currentStepKey)
    reply = t.studioFacePrintStyleConfirmed.replace('{style}', userLabel)
    if (justFinishedDiscovery && session.currentStepKey) {
      const logoKey = getPrimaryLogoStepKey('packaging_kit')
      if (logoKey && session.currentStepKey === logoKey) {
        reply = `${reply}\n\n${t.studioStartWithLogo}`
      }
      reply = appendStepAsk(reply, input.locale, 'packaging_kit', session.currentStepKey)
    } else if (session.presetId && session.currentStepKey && isDiscoveryStep(session.presetId, session.currentStepKey)) {
      reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
    }
    session = reconcileDiscoveryProgress(session, input.locale)
    session = syncDiscoveryCurrentStep(session, input.locale)
    await pgSaveHubThreadSession(input.threadId, session)
    studio = {
      processSteps: session.processSteps,
      ...packagingBoxConfirmStudioExtras(input.locale, session),
      ...packagingFacePrintStyleStudioExtras(input.locale, session),
    }
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userLabel,
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'confirm_box_face') {
    if (
      session.presetId !== 'packaging_kit' ||
      session.currentStepKey !== 'box_face_confirm' ||
      !session.packaging?.dimensionsMm
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const ackLabel = t.studioBoxFaceConfirmed.replace(/\*\*/g, '')
    session = completeBoxFaceConfirmSession(session, ackLabel)
    const advanced = advanceDiscoveryAfterBriefAnswer(
      session,
      input.locale,
      'box_face_confirm',
      ackLabel,
      t.studioBoxFaceConfirmed
    )
    session = advanced.session
    reply = advanced.reply
    studio = advanced.studio
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: ackLabel,
      studio: { stepKey: 'box_face_confirm' },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'set_bag_dimensions') {
    const raw = input.bagDimensionsMm
    const dimensionsMm = normalizeBagDimensionsMm(raw)
    if (!isBagKitPreset(session.presetId) || !dimensionsMm) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: boxSizeError(input.locale, 'format'),
      }
    }
    const activeStep = getActiveStepKey(session) ?? session.currentStepKey
    const fromPanelConfirm = activeStep === 'bag_panel_confirm'
    const userValue = formatBagBriefSize(input.locale, dimensionsMm)
    session = {
      ...session,
      bagKit: {
        ...(session.bagKit ?? emptyBagKitState()),
        dimensionsMm,
        facesConfirmed: false,
        dielineUrl: undefined,
      },
      briefNotes: { ...session.briefNotes, bag_size: userValue },
    }
    if (activeStep === 'bag_size' || fromPanelConfirm) {
      const marked = markStepDone(session.processSteps, 'bag_size')
      session = {
        ...session,
        processSteps: setStepInProgress(marked, 'bag_panel_confirm'),
        currentStepKey: 'bag_panel_confirm',
      }
    }
    const confirmed = buildBagSizeConfirmReply(input.locale, dimensionsMm, session.processSteps)
    session = applyBagSessionLabels(session, input.locale)
    reply = confirmed.reply
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userValue,
      studio: { stepKey: fromPanelConfirm ? 'bag_panel_confirm' : 'bag_size' },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio: confirmed.studio,
    })
    return {
      ok: true,
      reply,
      studio: confirmed.studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'confirm_bag_panel') {
    if (
      !isBagKitPreset(session.presetId) ||
      session.currentStepKey !== 'bag_panel_confirm' ||
      !session.bagKit?.dimensionsMm
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const ackLabel = t.studioBoxFaceConfirmed.replace(/\*\*/g, '')
    session = completeBagPanelConfirmSession(session, ackLabel)
    const advanced = advanceBagDiscoveryAfterBriefAnswer(
      session,
      input.locale,
      'bag_panel_confirm',
      ackLabel,
      t.studioBoxFaceConfirmed
    )
    session = applyBagSessionLabels(advanced.session, input.locale)
    reply = advanced.reply
    studio = advanced.studio
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: ackLabel,
      studio: { stepKey: 'bag_panel_confirm' },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'set_print_language') {
    const choiceKey = String(input.printLanguage ?? '').trim() as PackagingPrintLanguageKey
    const choice = findPackagingPrintLanguageChoice(choiceKey)
    if (
      !choice ||
      !isPackagingLikePreset(session.presetId) ||
      session.currentStepKey !== 'product_type'
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const nextBriefNotes: Record<string, string> = {
      ...session.briefNotes,
      [PRINT_LANGUAGE_STEP_KEY]: choice.key,
    }
    if (choice.key === 'other') {
      const detail =
        String(input.printLanguageDetail ?? '').trim() ||
        session.briefNotes[PRINT_LANGUAGE_DETAIL_STEP_KEY]?.trim() ||
        defaultPrintLanguageDetail(input.locale)
      if (detail) nextBriefNotes[PRINT_LANGUAGE_DETAIL_STEP_KEY] = detail
    } else {
      delete nextBriefNotes[PRINT_LANGUAGE_DETAIL_STEP_KEY]
    }
    session = {
      ...session,
      briefNotes: nextBriefNotes,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    studio = { processSteps: session.processSteps }
    return {
      ok: true,
      reply: '',
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'set_label_aspect_ratio') {
    const ratio = String(input.labelAspectRatio ?? '').trim()
    const stepKey = session.currentStepKey
    if (
      !isValidGeminiAspectRatio(ratio) ||
      session.presetId !== 'packaging_kit' ||
      (stepKey !== 'product_label' && stepKey !== 'seal_sticker')
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      packaging: {
        ...packagingBase(session),
        ...(stepKey === 'product_label'
          ? { productLabelAspectRatio: ratio }
          : { sealStickerAspectRatio: ratio }),
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    studio = { processSteps: session.processSteps }
    return {
      ok: true,
      reply: '',
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'upload_banner_logo') {
    if (session.presetId !== 'sale_banner' || session.currentStepKey !== 'banner_design') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioBannerLogoWrongStep,
      }
    }
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioBannerLogoNeedFile,
      }
    }
    const urls = await uploadStudioImages(input.userId, files.slice(0, 1))
    const logoUrl = urls[0]
    if (!logoUrl) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioBannerLogoNeedFile,
      }
    }
    session = {
      ...session,
      bannerAd: {
        ...session.bannerAd,
        presetId: session.bannerAd?.presetId ?? '',
        aspectRatio: session.bannerAd?.aspectRatio ?? '',
        logoUrl,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'remove_banner_logo') {
    if (session.presetId !== 'sale_banner') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      bannerAd: session.bannerAd
        ? { ...session.bannerAd, logoUrl: undefined }
        : session.bannerAd,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'upload_menu_logo') {
    if (session.presetId !== 'food_menu' || session.currentStepKey !== 'menu_design') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioMenuLogoWrongStep,
      }
    }
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioMenuLogoNeedFile,
      }
    }
    const urls = await uploadStudioImages(input.userId, files.slice(0, 1))
    const logoUrl = urls[0]
    if (!logoUrl) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioMenuLogoNeedFile,
      }
    }
    session = {
      ...session,
      foodMenu: {
        ...session.foodMenu,
        logoUrl,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'remove_menu_logo') {
    if (session.presetId !== 'food_menu') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      foodMenu: session.foodMenu ? { ...session.foodMenu, logoUrl: undefined } : session.foodMenu,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'upload_landing_logo') {
    if (session.presetId !== 'landing_page' || !session.discoveryComplete) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLandingLogoWrongStep,
      }
    }
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLandingLogoNeedFile,
      }
    }
    const urls = await uploadStudioImages(input.userId, files.slice(0, 1))
    const logoUrl = urls[0]
    if (!logoUrl) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLandingLogoNeedFile,
      }
    }
    session = {
      ...session,
      landingPage: {
        ...session.landingPage,
        logoUrl,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'remove_landing_logo') {
    if (session.presetId !== 'landing_page') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      landingPage: session.landingPage
        ? { ...session.landingPage, logoUrl: undefined }
        : session.landingPage,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'generate_landing_logo') {
    if (session.presetId !== 'landing_page' || !session.discoveryComplete) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLandingLogoWrongStep,
      }
    }
    if (pendingPreviewBlocksWorkflowInput(session)) {
      const pendingKey = session.pendingPreview?.screenKey ?? session.currentStepKey ?? 'landing_logo'
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioApproveBeforeNext.replace(
          '{screen}',
          stepLabel(session, pendingKey, input.locale)
        ),
      }
    }
    const logoBrief =
      input.landingLogoBrief?.trim() ||
      session.briefNotes.product_name?.trim() ||
      ''
    if (logoBrief.length < 2) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLandingLogoNeedBrief,
      }
    }
    const generationPrompt = buildLandingLogoGenerationPrompt({
      locale: input.locale,
      session,
      logoBrief,
    })
    const gen = await runStudioImagePipeline({
      userId: input.userId,
      kind: 'logo',
      screenLabel: 'Landing header logo',
      screenKey: 'landing_logo',
      brief: generationPrompt,
      projectTitle: session.projectTitle,
      referenceImageUrls: [],
      referenceImageMeta: [],
      aspectRatio: '1:1',
    })
    if (!gen.ok) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: gen.error || t.errorGeneric,
      }
    }
    session = {
      ...session,
      landingPage: {
        ...session.landingPage,
        logoUrl: gen.resultUrl,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: t.studioLandingLogoGenerated,
      studio: {
        imageUrl: gen.resultUrl,
        screenKey: 'landing_logo',
        screenLabel: 'Landing header logo',
        previewKind: 'logo',
        processSteps: session.processSteps,
        imageCharged: gen.charged,
      },
      session,
      threadId: input.threadId,
      chargedChat: 0,
      chargedImage: gen.charged,
    }
  }

  if (action === 'set_banner_design_setup') {
    const stepKey = session.currentStepKey
    if (session.presetId !== 'sale_banner' || stepKey !== 'banner_design') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = mergeBannerDesignInputIntoSession(session, input)
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'banner_finish_flow') {
    if (session.presetId !== 'sale_banner' || session.currentStepKey !== 'banner_design') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      processSteps: markStepDone(session.processSteps, 'banner_design'),
      currentStepKey: null,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioAllDone
    studio = { processSteps: session.processSteps }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'set_menu_design_setup') {
    const stepKey = session.currentStepKey
    if (session.presetId !== 'food_menu' || stepKey !== 'menu_design') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = mergeMenuDesignInputIntoSession(session, input)
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'set_landing_design_setup') {
    const stepKey = session.currentStepKey
    if (session.presetId !== 'landing_page' || !stepKey || !isLandingDesignStepKey(stepKey)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = mergeLandingDesignInputIntoSession(session, input)
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'set_landing_publish_url') {
    if (session.presetId !== 'landing_page') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const shareUrl = String(input.landingPublishedShareUrl ?? '').trim()
    const shareToken = String(input.landingPublishedShareToken ?? '').trim()
    if (!shareUrl) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      landingPage: {
        ...session.landingPage,
        publishedShareUrl: shareUrl,
        publishedShareToken: shareToken || undefined,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'set_landing_html_source') {
    if (session.presetId !== 'landing_page') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const htmlSource = String(input.landingHtmlSource ?? '')
    session = {
      ...session,
      landingPage: {
        ...session.landingPage,
        htmlSource: htmlSource || undefined,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    return {
      ok: true,
      reply: '',
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'menu_finish_flow') {
    if (session.presetId !== 'food_menu' || session.currentStepKey !== 'menu_design') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      processSteps: markStepDone(session.processSteps, 'menu_design'),
      currentStepKey: null,
    }
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioAllDone
    studio = { processSteps: session.processSteps }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'set_banner_ad_format') {
    const presetIdRaw = String(input.bannerAdPresetId ?? '').trim()
    const adPreset = findBannerAdPreset(presetIdRaw)
    const stepKey = session.currentStepKey
    if (!adPreset || session.presetId !== 'sale_banner' || stepKey !== 'banner_ad_format') {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const formatLabel = getBannerAdPresetLabel(adPreset, input.locale)
    session = {
      ...session,
      bannerAd: {
        ...session.bannerAd,
        presetId: adPreset.id,
        aspectRatio: adPreset.aspectRatio,
        platform: adPreset.platform,
      },
      briefNotes: {
        ...session.briefNotes,
        banner_ad_format: formatLabel,
      },
      processSteps: markStepDone(session.processSteps, 'banner_ad_format'),
      discoveryComplete: true,
    }
    const next = nextPendingStep(session.processSteps)
    session.currentStepKey = next?.key ?? null
    session.processSteps = setStepInProgress(session.processSteps, session.currentStepKey)
    await pgSaveHubThreadSession(input.threadId, session)
    const preset = getStudioPreset('sale_banner')
    const confirmedRows = {
      vi: `Đã chọn **${formatLabel}** (${adPreset.aspectRatio}).`,
      en: `Selected **${formatLabel}** (${adPreset.aspectRatio}).`,
      zh: `已选择 **${formatLabel}**（${adPreset.aspectRatio}）。`,
      ja: `**${formatLabel}**（${adPreset.aspectRatio}）を選択しました。`,
      ko: `**${formatLabel}** (${adPreset.aspectRatio})을(를) 선택했습니다.`,
    } satisfies Record<WebLocale, string>
    reply = confirmedRows[input.locale]
    if (session.currentStepKey) {
      reply = appendStepAsk(reply, input.locale, 'sale_banner', session.currentStepKey)
    }
    if (preset?.needsUpload && !session.uploadImages.length) {
      reply += `\n\n${t.studioNeedUpload}`
    }
    studio = {
      processSteps: session.processSteps,
      needsUpload: preset?.needsUpload && !session.uploadImages.length ? true : undefined,
    }
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: formatLabel,
      studio: { stepKey: 'banner_ad_format' },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'set_label_shape') {
    const shape = String(input.labelShape ?? '').trim()
    const stepKey = session.currentStepKey
    if (
      !isValidFlatStickerShape(shape) ||
      session.presetId !== 'packaging_kit' ||
      (stepKey !== 'product_label' && stepKey !== 'seal_sticker')
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    session = {
      ...session,
      packaging: {
        ...packagingBase(session),
        ...(stepKey === 'product_label'
          ? { productLabelShape: shape }
          : { sealStickerShape: shape }),
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    studio = { processSteps: session.processSteps }
    return {
      ok: true,
      reply: '',
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
    }
  }

  if (action === 'set_discovery_choice') {
    const stepKey = String(input.discoveryChoiceStep ?? session.currentStepKey ?? '').trim()
    const choiceKey = String(input.discoveryChoice ?? '').trim()
    const designChoice =
      session.presetId === 'design_recreate'
        ? findDesignRecreateDiscoveryChoice(stepKey, choiceKey, session.briefNotes)
        : undefined
    const packagingChoice =
      stepKey === 'style_mood'
        ? findPackagingStyleMoodChoice(choiceKey)
        : stepKey === 'color_palette'
          ? findPackagingColorPaletteChoice(choiceKey)
          : undefined
    const choice = designChoice ?? packagingChoice
    const allowDesign = session.presetId === 'design_recreate' && Boolean(designChoice)
    const allowPackaging = isPackagingLikePreset(session.presetId) && Boolean(packagingChoice)
    if (!choice || (!allowDesign && !allowPackaging) || session.currentStepKey !== stepKey) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const userLabel = packagingDiscoveryChoiceLabel(choice, input.locale)
    // design_recreate: keys for sector/format/render/language; human brief for design_notes.
    const briefValue =
      session.presetId === 'design_recreate'
        ? stepKey === 'design_notes'
          ? packagingDiscoveryChoiceBrief(choice, input.locale)
          : choice.key
        : packagingDiscoveryChoiceBrief(choice, input.locale)
    const advanced =
      session.presetId === 'design_recreate'
        ? advanceDiscoveryAfterBriefAnswer(
            session,
            input.locale,
            stepKey,
            briefValue,
            t.studioDiscoveryBriefConfirmed.replace('{value}', userLabel)
          )
        : advancePackagingLikeDiscoveryAfterBriefAnswer(
            session,
            input.locale,
            stepKey,
            briefValue,
            t.studioDiscoveryBriefConfirmed.replace('{value}', userLabel)
          )
    session = advanced.session
    reply = advanced.reply
    studio = advanced.studio
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userLabel,
      studio: { stepKey },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'set_color_palette') {
    const stepKey = 'color_palette'
    const selections = normalizeStudioColorSelections(
      input.colorPaletteSelection,
      input.colorPaletteKeys
    )
    const resolved = resolveStudioColorSelections(selections)
    if (
      !resolved.length ||
      !studioColorSelectionHasPrimary(selections) ||
      !session.presetId ||
      session.currentStepKey !== stepKey ||
      !isStudioColorPalettePickerStep(stepKey)
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.errorGeneric,
      }
    }
    const userLabel = studioColorPaletteUserLabel(selections, input.locale)
    const briefValue = formatStudioColorPaletteBriefFromSelections(selections, input.locale)
    const advanced = advancePackagingLikeDiscoveryAfterBriefAnswer(
      session,
      input.locale,
      stepKey,
      briefValue,
      t.studioDiscoveryBriefConfirmed.replace('{value}', userLabel)
    )
    session = advanced.session
    reply = advanced.reply
    studio = advanced.studio
    await pgSaveHubThreadSession(input.threadId, session)
    const userMessageId = await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'user',
      content: userLabel,
      studio: { stepKey },
    })
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      userMessageId: userMessageId ?? undefined,
    }
  }

  if (action === 'upload_generation_product') {
    const files = input.uploadFiles ?? []
    const stepKey = session.currentStepKey ?? ''
    if (
      !files.length ||
      !session.presetId ||
      !stepSupportsGenerationRefPicker(session.presetId, stepKey)
    ) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNeedUpload }
    }
    const presetId = session.presetId
    const urls = await uploadStudioImages(input.userId, files)
    session = appendGenerationProductUrls(session, presetId, urls)
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioGenProductUploaded.replace('{n}', String(urls.length))
    studio = {
      processSteps: session.processSteps,
      ...buildGenerationRefPickerPayload(session, presetId, stepKey),
    }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'remove_generation_product') {
    const url = String(input.productUrl ?? '').trim()
    if (!url) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    session = removeGenerationProductUrl(session, url)
    await pgSaveHubThreadSession(input.threadId, session)
    const stepKey = session.currentStepKey ?? ''
    studio = session.presetId
      ? {
          processSteps: session.processSteps,
          ...buildGenerationRefPickerPayload(session, session.presetId, stepKey),
        }
      : { processSteps: session.processSteps }
    return { ok: true, reply: '', studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'upload_logo_reference') {
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioLogoUploadNeedFile }
    }
    if (!session.presetId || !session.discoveryComplete) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const logoKey = getPrimaryLogoStepKey(session.presetId)
    if (!logoKey || !isLogoDesignStep(session.presetId, logoKey)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioLogoUploadWrongStep,
      }
    }
    if (session.currentStepKey !== logoKey) {
      const blockingStep = findBlockingIncompleteStep(session, session.presetId)
      if (blockingStep !== logoKey) {
        return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioLogoUploadWrongStep }
      }
    }
    if (
      hasPrimaryLogoReference(session.referenceImages, session.presetId) &&
      !(session.presetId && isNavigatedBackEdit(session, session.presetId) && session.currentStepKey === logoKey)
    ) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioLogoUploadAlready }
    }
    if (!canAddReferenceImage(session, logoKey)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioReferenceLimit.replace('{max}', String(STUDIO_MAX_REFERENCE_IMAGES)),
      }
    }
    const urls = await uploadStudioImages(input.userId, files.slice(0, 1))
    const url = urls[0]
    if (!url) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioLogoUploadNeedFile }
    }
    const logoLabel = stepLabel(session, logoKey, input.locale)
    const replacing = hasPrimaryLogoReference(session.referenceImages, session.presetId)
    session = {
      ...session,
      processSteps: markStepDone(session.processSteps, logoKey),
      pendingPreview: null,
      lastGenerationPrompt: null,
      referenceImages: [
        ...session.referenceImages.filter((r) => r.screenKey !== logoKey),
        {
          screenKey: logoKey,
          screenLabel: logoLabel,
          url,
          approvedAt: Date.now(),
        },
      ],
    }
    if (!replacing) {
      const next = nextPendingStep(session.processSteps)
      session.currentStepKey = next?.key ?? null
      session.processSteps = setStepInProgress(session.processSteps, session.currentStepKey)
    }
    await pgSaveHubThreadSession(input.threadId, session)
    const asked = replacing
      ? { reply: t.studioFaceUploadSaved.replace('{screen}', logoLabel), studio: { processSteps: session.processSteps } as HubStudioMessagePayload }
      : buildAskForNextStep(session, input.locale, logoLabel, logoKey)
    reply = asked.reply
    studio = {
      ...asked.studio,
      imageUrl: url,
      screenKey: logoKey,
      screenLabel: logoLabel,
      previewKind: 'logo',
      aspectHint: 'square',
    }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'upload_packaging_face') {
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioFaceUploadNeedFile }
    }
    if (
      (!isBagKitPreset(session.presetId) && session.presetId !== 'packaging_kit') ||
      !session.discoveryComplete
    ) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const stepKey = session.currentStepKey
    if (isBagKitPreset(session.presetId)) {
      if (!stepKey || !isBagFaceStepKey(stepKey)) {
        return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioFaceUploadWrongStep }
      }
    } else if (!stepKey || !isPackagingFaceStepKey(stepKey)) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioFaceUploadWrongStep }
    }
    const file = files[0]!
    const faceSize = isBagKitPreset(session.presetId)
      ? resolveBagFacePrintSizeMm(session, stepKey!)
      : getPackagingFaceSizeForStep(session.packaging?.dimensionsMm, stepKey!)
    const uploadBuffer = faceSize
      ? await normalizePanelArtworkToPrintSize(file.buffer, faceSize.widthMm, faceSize.heightMm)
      : file.buffer
    const urls = await uploadStudioImages(input.userId, [{ buffer: uploadBuffer, mimeType: file.mimeType }])
    const url = urls[0]
    if (!url) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioFaceUploadNeedFile }
    }
    const screenLabel = stepLabel(session, stepKey, input.locale)
    const pending = session.pendingPreview
    if (stepKey === 'body_strip' && !pending) {
      session = {
        ...session,
        pendingPreview: {
          screenKey: stepKey,
          screenLabel,
          url,
          generationPrompt: session.briefNotes[stepKey] ?? screenLabel,
        },
      }
      await pgSaveHubThreadSession(input.threadId, session)
      reply = t.studioFaceUploadSaved.replace('{screen}', screenLabel)
      studio = buildPendingStepStudio(session, stepKey, session.presetId!)
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
    }
    if (pending?.screenKey === stepKey) {
      session = {
        ...session,
        pendingPreview: {
          ...pending,
          originalUrl: pending.originalUrl ?? pending.url,
          url,
        },
      }
      await pgSaveHubThreadSession(input.threadId, session)
      reply = t.studioFaceUploadSaved.replace('{screen}', screenLabel)
      studio = buildPendingStepStudio(session, stepKey, session.presetId!)
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
    }
    if (!canAddReferenceImage(session, stepKey) && !session.referenceImages.some((r) => r.screenKey === stepKey)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioReferenceLimit.replace('{max}', String(STUDIO_MAX_REFERENCE_IMAGES)),
      }
    }
    const stayOnStep = Boolean(
      session.presetId &&
        (isNavigatedBackEdit(session, session.presetId) ||
          (isBagKitPreset(session.presetId)
            ? isBagFaceReEdit(session, stepKey)
            : isPackagingFaceReEdit(session, stepKey)))
    )
    if (isBagKitPreset(session.presetId)) {
      const advanced = advanceAfterBagFaceStep(
        session,
        stepKey,
        screenLabel,
        input.locale,
        { sourceMode: 'generate', url },
        true,
        { stayOnStep }
      )
      session = applyBagSessionLabels(advanced.session, input.locale)
      reply = stayOnStep
        ? t.studioFaceUploadSaved.replace('{screen}', screenLabel)
        : advanced.reply
      studio = {
        processSteps: session.processSteps,
        imageUrl: url,
        screenKey: stepKey,
        screenLabel,
        previewKind: previewKindFromGenerator('packaging_face'),
        aspectHint: aspectHintFromGenerator('packaging_face', session.presetId, stepKey),
        ...(session.currentStepKey
          ? buildGenerationRefPickerPayload(session, 'bag_kit', session.currentStepKey)
          : {}),
      }
      await pgSaveHubThreadSession(input.threadId, session)
      if (session.bagKit?.mockupUrl) {
        await pgUpdateLatestHubStudioImageUrl({
          threadId: input.threadId,
          screenKey: 'bag_mockup_3d',
          imageUrl: session.bagKit.mockupPhotoUrl ?? session.bagKit.mockupUrl,
        })
      }
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
    }
    const sessionBeforeFaceUpload = session
    const advanced = advanceAfterPackagingFaceStep(
      session,
      stepKey,
      screenLabel,
      input.locale,
      { sourceMode: 'generate', url },
      true,
      { stayOnStep }
    )
    session = await refreshPackagingArtifactsAfterFaceChange(
      advanced.session,
      sessionBeforeFaceUpload,
      input.userId
    )
    reply = stayOnStep
      ? t.studioFaceUploadSaved.replace('{screen}', screenLabel)
      : advanced.reply
    studio = {
      processSteps: session.processSteps,
      imageUrl: url,
      screenKey: stepKey,
      screenLabel,
      previewKind: previewKindFromGenerator('packaging_face'),
      aspectHint: aspectHintFromGenerator('packaging_face', session.presetId, stepKey),
      ...(session.presetId && session.currentStepKey
        ? buildGenerationRefPickerPayload(session, session.presetId, session.currentStepKey)
        : {}),
    }
    await pgSaveHubThreadSession(input.threadId, session)
    if (session.packaging?.mockupUrl) {
      await pgUpdateLatestHubStudioImageUrl({
        threadId: input.threadId,
        screenKey: 'box_mockup_3d',
        imageUrl: session.packaging.mockupUrl,
      })
    }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'select_banner_batch_item') {
    if (session.presetId !== 'sale_banner') {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const previews = getSaleBannerBatchPreviews(session)
    if (previews.length <= 1) {
      return { ok: true, reply: '', session, threadId: input.threadId, chargedChat: 0 }
    }
    const index = Math.max(
      0,
      Math.min(previews.length - 1, Number(input.bannerBatchIndex ?? 0))
    )
    const selected = previews[index]!
    session = {
      ...session,
      bannerBatchPreviews: previews,
      bannerBatchSelectedIndex: index,
      pendingPreview: selected,
      lastGenerationPrompt: selected.generationPrompt,
    }
    studio = buildSaleBannerBatchStudioPayload(previews, index, {
      processSteps: session.processSteps,
      showRegenerate: true,
      showApproveReference: true,
    })
    await pgSaveHubThreadSession(input.threadId, session)
    return { ok: true, reply: '', studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'approve_reference') {
    const pending = session.pendingPreview
    if (!pending) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNoPreview }
    }
    const pendingGenerator = session.presetId
      ? getStepGenerator(session.presetId, pending.screenKey)
      : null
    if (
      pendingGenerator !== 'barcode' &&
      !isPackagingContinueOnlyApproveStep(pending.screenKey) &&
      !canAddReferenceImage(session, pending.screenKey)
    ) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioReferenceLimit.replace('{max}', String(STUDIO_MAX_REFERENCE_IMAGES)),
      }
    }
    const approvedLabel = pending.screenLabel
    const approvedKey = pending.screenKey
    const wasReEdit = isPackagingFaceReEdit(session, approvedKey)
    const saleBannerBatchPreviews =
      session.presetId === 'sale_banner' &&
      approvedKey === 'banner_design' &&
      !wasReEdit
        ? getSaleBannerBatchPreviews(session)
        : []

    if (saleBannerBatchPreviews.length > 1) {
      if (
        session.referenceImages.length + saleBannerBatchPreviews.length >
        STUDIO_MAX_REFERENCE_IMAGES
      ) {
        return {
          ok: false,
          reply: '',
          session,
          threadId: input.threadId,
          chargedChat: 0,
          error: t.studioReferenceLimit.replace('{max}', String(STUDIO_MAX_REFERENCE_IMAGES)),
        }
      }
      session = finishApproveSaleBannerBatch(session, saleBannerBatchPreviews, input.locale)
      const n = countSaleBannerApprovals(session)
      reply = t.studioBannerSavedCreateNext.replace('{n}', String(n))
      studio = mergeApprovedPackagingMockupIntoStudio(session, {
        processSteps: session.processSteps,
        awaitingRequirements: true,
        showApproveReference: false,
        ...buildReferencePreviewsPayload(session, 'banner_design'),
      })
      await pgSaveHubThreadSession(input.threadId, session)
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
    }

    const finished = await finishApprove(session, input.locale, input.threadId, input.userId)
    session = finished.session
    const stayedOnEditedFace = Boolean(
      session.presetId &&
        session.currentStepKey === approvedKey &&
        (isNavigatedBackEdit(session, session.presetId) || wasReEdit)
    )
    const isSaleBannerLoop =
      session.presetId === 'sale_banner' && approvedKey === 'banner_design' && !stayedOnEditedFace
    if (isSaleBannerLoop) {
      session = finalizeSaleBannerApproval(session, input.locale)
      session = {
        ...session,
        bannerBatchTotal: undefined,
        bannerBatchQueue: undefined,
        bannerBatchPreviews: undefined,
        bannerBatchSelectedIndex: undefined,
      }
      const n = countSaleBannerApprovals(session)
      reply = t.studioBannerSavedCreateNext.replace('{n}', String(n))
      studio = mergeApprovedPackagingMockupIntoStudio(session, {
        processSteps: session.processSteps,
        awaitingRequirements: true,
        showApproveReference: false,
        ...buildReferencePreviewsPayload(session, 'banner_design'),
      })
      await pgSaveHubThreadSession(input.threadId, session)
    } else if (stayedOnEditedFace) {
      reply = finished.reply
      studio = mergeApprovedPackagingMockupIntoStudio(session, {
        ...finished.studio,
        screenKey: finished.studio.screenKey ?? approvedKey,
        processSteps: session.processSteps,
        showApproveReference: false,
        showRegenerate: finished.studio.showRegenerate ?? true,
        ...buildReferencePreviewsPayload(session),
      })
    } else {
      const asked = buildAskForNextStep(session, input.locale, approvedLabel, approvedKey)
      reply = asked.reply
      studio = asked.studio
    }

    if (session.packaging?.mockupUrl && approvedKey === 'box_mockup_3d') {
      await pgUpdateLatestHubStudioImageUrl({
        threadId: input.threadId,
        screenKey: 'box_mockup_3d',
        imageUrl: session.packaging.mockupUrl,
      })
      await upsertHubStudioImageMessage({
        threadId: input.threadId,
        content: finished.reply,
        studio: {
          ...finished.studio,
          imageUrl: session.packaging.mockupUrl,
          screenKey: 'box_mockup_3d',
          showApproveReference: false,
          showRegenerate: true,
          processSteps: session.processSteps,
        },
      })
    } else if (session.packaging?.mockupUrl) {
      await pgUpdateLatestHubStudioImageUrl({
        threadId: input.threadId,
        screenKey: 'box_mockup_3d',
        imageUrl: session.packaging.mockupUrl,
      })
    }

    if (stayedOnEditedFace && studio?.imageUrl && studio.screenKey) {
      await upsertHubStudioImageMessage({
        threadId: input.threadId,
        content: reply,
        studio,
      })
    } else {
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
    }
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      chargedImage: chargedImage || undefined,
    }
  }

  if (action === 'remove_reference') {
    const screenKey = String(input.referenceScreenKey ?? '').trim()
    if (!screenKey || !session.presetId) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const removed = session.referenceImages.find((r) => r.screenKey === screenKey)
    if (!removed) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const savedCurrentStepKey = session.currentStepKey
    session = {
      ...session,
      referenceImages: session.referenceImages.filter((r) => r.screenKey !== screenKey),
    }
    session = sanitizeGenerationSelection(session, session.presetId)
    if (
      session.presetId &&
      savedCurrentStepKey &&
      stepSupportsGenerationRefPicker(session.presetId, savedCurrentStepKey)
    ) {
      session = resetGenerationSelectionForStep(session, session.presetId, savedCurrentStepKey)
    } else {
      session = { ...session, generationSelection: undefined }
    }
    session = applyReferenceRemoval(session, removed, savedCurrentStepKey, session.presetId)
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioReferenceRemoved.replace('{screen}', removed.screenLabel)
    studio = {
      processSteps: session.processSteps,
      awaitingRequirements: true,
      ...buildReferencePreviewsPayload(session),
      ...(session.presetId &&
      savedCurrentStepKey &&
      session.pendingPreview?.screenKey === savedCurrentStepKey
        ? buildPendingStepStudio(session, savedCurrentStepKey, session.presetId)
        : {}),
      ...(session.presetId && savedCurrentStepKey
        ? buildGenerationRefPickerPayload(session, session.presetId, savedCurrentStepKey)
        : {}),
    }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'outpaint_crop_gaps') {
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioFaceUploadNeedFile }
    }
    const aspectRatio = input.cropAspectRatio?.trim() || '16:9'
    const gen = await runFaceCropOutpaint({
      userId: input.userId,
      imageBuffer: files[0]!.buffer,
      mimeType: files[0]!.mimeType,
      aspectRatio,
    })
    if (!gen.ok) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: gen.error }
    }
    reply = t.studioCropOutpaintDone
    studio = { imageUrl: gen.resultUrl, imageCharged: gen.charged }
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat: 0,
      chargedImage: gen.charged,
    }
  }

  if (action === 'crop_pending_image') {
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNoPreview,
      }
    }

    const targetScreenKey =
      String(input.cropScreenKey ?? '').trim() || session.pendingPreview?.screenKey
    if (!targetScreenKey) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNoPreview,
      }
    }

    const savedCurrentStepKey = session.currentStepKey
    const savedPendingPreview = session.pendingPreview

    let pending =
      session.pendingPreview?.screenKey === targetScreenKey
        ? session.pendingPreview
        : pendingPreviewFromApprovedReference(session, targetScreenKey, session.presetId)

    if (!pending?.url) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNoPreview,
      }
    }

    const urls = await uploadStudioImages(input.userId, files)
    const newUrl = urls[0]!
    const sessionBeforeFaceEdit = session
    const editedSizeMm =
      input.cropSizeMm ??
      pending.editedSizeMm ??
      (isBagKitPreset(session.presetId) && isBagFaceStepKey(pending.screenKey)
        ? (() => {
            const raw = resolveBagFacePrintSizeMm(session, pending.screenKey)
            return raw ? { width: raw.widthMm, height: raw.heightMm } : undefined
          })()
        : session.packaging?.dimensionsMm
          ? (() => {
              const raw = getPackagingFaceSizeForStep(session.packaging!.dimensionsMm!, pending.screenKey)
              return raw ? { width: raw.widthMm, height: raw.heightMm } : undefined
            })()
          : undefined)
    const croppedPending = {
      ...pending,
      originalUrl: pending.originalUrl ?? pending.url,
      url: newUrl,
      editedSizeMm: editedSizeMm ?? undefined,
    }

    session = {
      ...session,
      pendingPreview: croppedPending,
    }

    const editedSlot = packagingStepKeyToSlot(pending.screenKey)
    const faceCommitted = Boolean(
      editedSlot &&
        session.packaging &&
        (session.packaging.faceSlots?.[editedSlot] ||
          session.referenceImages.some((reference) => reference.screenKey === pending.screenKey))
    )
    if (faceCommitted && editedSlot && session.packaging) {
      const previousFace = session.packaging.faceSlots?.[editedSlot]
      const faceArtworkChanged =
        previousFace?.sourceMode !== 'generate' || previousFace?.url !== newUrl
      session = {
        ...session,
        packaging: syncResolvedPackagingFaces({
          ...session.packaging,
          faceSlots: {
            ...(session.packaging.faceSlots ?? {}),
            [editedSlot]: { sourceMode: 'generate', url: newUrl },
          },
          dielineUrl: faceArtworkChanged ? undefined : session.packaging.dielineUrl,
          dielineVariants: faceArtworkChanged ? undefined : session.packaging.dielineVariants,
          mockupUrl: faceArtworkChanged ? undefined : session.packaging.mockupUrl,
        }),
        referenceImages: session.referenceImages.some(
          (reference) => reference.screenKey === pending.screenKey
        )
          ? session.referenceImages.map((reference) =>
              reference.screenKey === pending.screenKey
                ? { ...reference, url: newUrl, approvedAt: Date.now() }
                : reference
            )
          : [
              ...session.referenceImages,
              {
                screenKey: pending.screenKey,
                screenLabel: pending.screenLabel,
                url: newUrl,
                approvedAt: Date.now(),
              },
            ],
      }
      if (faceArtworkChanged) {
        session = await refreshPackagingArtifactsAfterFaceChange(
          session,
          sessionBeforeFaceEdit,
          input.userId
        )
      }
    }

    const editedBagSlot = isBagKitPreset(session.presetId) ? bagStepKeyToSlot(pending.screenKey) : null
    const bagFaceCommitted = Boolean(
      editedBagSlot &&
        session.bagKit &&
        (session.bagKit.faceSlots?.[editedBagSlot] ||
          session.referenceImages.some((reference) => reference.screenKey === pending.screenKey))
    )
    if (bagFaceCommitted && editedBagSlot && session.bagKit) {
      session = applyBagFaceSlotToSession(session, pending.screenKey, {
        sourceMode: 'generate',
        url: newUrl,
      })
      session = {
        ...session,
        referenceImages: session.referenceImages.some(
          (reference) => reference.screenKey === pending.screenKey
        )
          ? session.referenceImages.map((reference) =>
              reference.screenKey === pending.screenKey
                ? { ...reference, url: newUrl, approvedAt: Date.now() }
                : reference
            )
          : [
              ...session.referenceImages,
              {
                screenKey: pending.screenKey,
                screenLabel: pending.screenLabel,
                url: newUrl,
                approvedAt: Date.now(),
              },
            ],
      }
      session = applyBagSessionLabels(session, input.locale)
    }

    if (savedCurrentStepKey && savedCurrentStepKey !== pending.screenKey) {
      session = {
        ...session,
        currentStepKey: savedCurrentStepKey,
        pendingPreview: resolveWorkflowPendingAfterApprovedFaceEdit(
          session,
          pending.screenKey,
          savedCurrentStepKey,
          savedPendingPreview
        ),
      }
    } else {
      session = {
        ...session,
        pendingPreview: croppedPending,
      }
    }

    await pgSaveHubThreadSession(input.threadId, session)
    const label = stepLabel(session, pending.screenKey, input.locale)
    reply = t.studioCropApplied.replace('{screen}', label)
    if (editedSizeMm) {
      reply += `\n${t.studioCropSizeLine.replace('{size}', formatMmSize(input.locale, editedSizeMm.width, editedSizeMm.height))}`
    }
    studio =
      session.presetId != null
        ? {
            ...buildPendingStepStudio(
              { ...session, pendingPreview: croppedPending },
              pending.screenKey,
              session.presetId
            ),
            showApproveReference: false,
          }
        : { processSteps: session.processSteps, imageUrl: newUrl, screenKey: pending.screenKey }
    const replacedMessageId = await pgReplaceLatestHubStudioImageMessage({
      threadId: input.threadId,
      screenKey: pending.screenKey,
      content: reply,
      studio,
    })
    if (!replacedMessageId) {
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
    }
    if (session.packaging?.mockupUrl) {
      await pgUpdateLatestHubStudioImageUrl({
        threadId: input.threadId,
        screenKey: 'box_mockup_3d',
        imageUrl: session.packaging.mockupUrl,
      })
    }
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'revert_pending_image') {
    const pending = session.pendingPreview
    const originalUrl = pending?.originalUrl
    if (!pending || !originalUrl || originalUrl === pending.url) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNoPreview,
      }
    }
    const sessionBeforeFaceEdit = session
    session = {
      ...session,
      pendingPreview: {
        ...pending,
        url: originalUrl,
        editedSizeMm: undefined,
      },
    }
    const editedSlot = packagingStepKeyToSlot(pending.screenKey)
    const existingFace = editedSlot ? session.packaging?.faceSlots?.[editedSlot] : undefined
    if (editedSlot && existingFace && session.packaging) {
      session = {
        ...session,
        packaging: syncResolvedPackagingFaces({
          ...session.packaging,
          faceSlots: {
            ...(session.packaging.faceSlots ?? {}),
            [editedSlot]: { sourceMode: 'generate', url: originalUrl },
          },
          dielineUrl: undefined,
          dielineVariants: undefined,
          mockupUrl: undefined,
        }),
        referenceImages: session.referenceImages.map((reference) =>
          reference.screenKey === pending.screenKey
            ? { ...reference, url: originalUrl, approvedAt: Date.now() }
            : reference
        ),
      }
      session = await refreshPackagingArtifactsAfterFaceChange(
        session,
        sessionBeforeFaceEdit,
        input.userId
      )
    }
    await pgSaveHubThreadSession(input.threadId, session)
    const label = stepLabel(session, pending.screenKey, input.locale)
    reply = t.studioEditReverted.replace('{screen}', label)
    studio =
      session.presetId != null
        ? buildPendingStepStudio(session, pending.screenKey, session.presetId)
        : { processSteps: session.processSteps, imageUrl: originalUrl }
    const replacedMessageId = await pgReplaceLatestHubStudioImageMessage({
      threadId: input.threadId,
      screenKey: pending.screenKey,
      content: reply,
      studio,
    })
    if (!replacedMessageId) {
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        studio,
      })
    }
    if (session.packaging?.mockupUrl) {
      await pgUpdateLatestHubStudioImageUrl({
        threadId: input.threadId,
        screenKey: 'box_mockup_3d',
        imageUrl: session.packaging.mockupUrl,
      })
    }
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'navigate_step') {
    const stepKey = String(input.navigateStepKey ?? '').trim()
    if (!session.presetId || !stepKey || !canNavigateToStep(session, session.presetId, stepKey)) {
      return {
        ok: false,
        reply: '',
        session,
        threadId: input.threadId,
        chargedChat: 0,
        error: t.studioNavigateStepBlocked,
      }
    }
    session = navigateSessionToStep(session, session.presetId, stepKey)
    await pgSaveHubThreadSession(input.threadId, session)
    const label = stepLabel(session, stepKey, input.locale)
    const reEditingCommittedFace = Boolean(
      session.presetId === 'packaging_kit' &&
        (isPackagingFaceReEdit(session, stepKey) || isNavigatedBackEdit(session, session.presetId))
    )
    reply = t.studioNavigatedToStep.replace('{screen}', label)
    if (session.presetId && !reEditingCommittedFace) {
      reply = appendStepAsk(reply, input.locale, session.presetId, stepKey)
    }
    const onDiscovery = isDiscoveryStep(session.presetId!, stepKey)
    studio = {
      processSteps: session.processSteps,
      awaitingRequirements: !onDiscovery && !reEditingCommittedFace,
      ...buildReferencePreviewsPayload(session),
      ...(session.presetId && reEditingCommittedFace && session.pendingPreview?.screenKey === stepKey
        ? buildPendingStepStudio(session, stepKey, session.presetId)
        : session.presetId && !onDiscovery && session.pendingPreview?.screenKey !== stepKey
          ? buildGenerationRefPickerPayload(session, session.presetId, stepKey)
          : {}),
    }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
  }

  if (action === 'regenerate') {
    const originalTimelineSession = session
    const requestedKey = String(input.regenerateStepKey ?? '').trim()
    const pending = session.pendingPreview
    const screenKey = requestedKey || pending?.screenKey || session.currentStepKey
    if (!screenKey) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNoPrompt }
    }
    if (
      session.presetId &&
      screenKey &&
      (session.currentStepKey !== screenKey || session.pendingPreview?.screenKey !== screenKey) &&
      canNavigateToStep(session, session.presetId, screenKey)
    ) {
      session = navigateSessionToStep(session, session.presetId, screenKey)
    }
    const stepPreview =
      session.pendingPreview?.screenKey === screenKey
        ? session.pendingPreview
        : pendingPreviewFromApprovedReference(session, screenKey, session.presetId)
    if (session.presetId && input.generationRefKeys !== undefined) {
      session = applyGenerationRefKeys(session, session.presetId, input.generationRefKeys)
    }
    const customPrompt = String(input.message ?? '').trim()
    const basePrompt =
      stepPreview?.generationPrompt ||
      session.briefNotes[screenKey]?.trim() ||
      session.lastGenerationPrompt ||
      ''
    const isDesignRecreateRegenerate =
      session.presetId === 'design_recreate' && screenKey !== DESIGN_RECREATE_LOGO_KEY
    const prompt = isDesignRecreateRegenerate
      ? customPrompt
        ? `${basePrompt}\n\nADDITIONAL CLIENT REQUESTS FOR THIS REGENERATE (apply on the design board):\n${customPrompt}`
        : basePrompt
      : customPrompt || basePrompt
    if (!prompt) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNoPrompt }
    }
    const label = stepLabel(session, screenKey, input.locale)
    const sessionBeforeGenerate = session
    const reEditFace = isPackagingFaceReEdit(sessionBeforeGenerate, screenKey)
    const genResult = await generateAsset(input.userId, session, prompt, screenKey, label, input.locale)
    if (genResult.error) {
      return { ok: false, reply: genResult.error, session, threadId: input.threadId, chargedChat: 0, error: genResult.error }
    }
    if (reEditFace && genResult.session.pendingPreview) {
      const editedImageUrl = genResult.session.pendingPreview.url
      const finished = await finishApprove(
        genResult.session,
        input.locale,
        input.threadId,
        input.userId
      )
      session = restoreTimelineAfterInPlaceImageEdit(
        finished.session,
        originalTimelineSession,
        screenKey
      )
      reply = finished.reply
      studio = {
        ...genResult.studio,
        ...finished.studio,
        screenKey,
        screenLabel: label,
        imageUrl: editedImageUrl,
        processSteps: session.processSteps,
        showApproveReference: false,
        showRegenerate: true,
        ...buildReferencePreviewsPayload(session),
      }
      chargedImage = genResult.chargedImage
      await pgSaveHubThreadSession(input.threadId, session)
      if (session.packaging?.mockupUrl) {
        await pgUpdateLatestHubStudioImageUrl({
          threadId: input.threadId,
          screenKey: 'box_mockup_3d',
          imageUrl: session.packaging.mockupUrl,
        })
      }
      await upsertHubStudioImageMessage({
        threadId: input.threadId,
        content: reply,
        studio,
      })
      return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0, chargedImage }
    }
    session = genResult.session
    if (
      session.presetId === 'sale_banner' &&
      screenKey === 'banner_design' &&
      genResult.session.pendingPreview
    ) {
      session = syncBannerBatchPreviewItem(session, genResult.session.pendingPreview)
      studio = buildSaleBannerBatchStudioPayload(
        getSaleBannerBatchPreviews(session),
        session.bannerBatchSelectedIndex ?? 0,
        {
          ...genResult.studio,
          processSteps: session.processSteps,
          imageCharged: genResult.chargedImage,
        }
      )
    } else {
      studio = genResult.studio
    }
    chargedImage = genResult.chargedImage
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioRegenerated.replace('{screen}', label)
    await upsertHubStudioImageMessage({
      threadId: input.threadId,
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0, chargedImage }
  }

  let skipUserInsert = Boolean(input.skipUserInsert)

  type EditStepPrepared = {
    resolved: { id: string; index: number; createdAt: string }
    editStepKey: string
    editMessage: string
    baseSession: HubStudioSession
  }
  let editPrepared: EditStepPrepared | null = null

  if (action === 'edit_step') {
    const editMessageId = String(input.editMessageId ?? '').trim()
    let editStepKey = String(input.editStepKey ?? '').trim()
    const editMessage = String(input.message ?? '').trim()
    if (!editMessageId || editMessage.length < 2) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const thread = await pgGetHubChatThread(input.userId, input.threadId)
    if (!thread?.session?.presetId) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    if (!editStepKey) {
      const msgIdxGuess = thread.messages.findIndex((m) => m.id === editMessageId)
      editStepKey =
        inferStepKeyForUserMessage(thread.messages, msgIdxGuess, thread.session.presetId) ?? ''
    }
    const resolved = resolveEditUserMessage(
      thread.messages,
      editMessageId,
      editStepKey,
      thread.session.presetId
    )
    if (!resolved || !editStepKey) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioEditStepUnknown }
    }
    editPrepared = {
      resolved,
      editStepKey,
      editMessage,
      baseSession: thread.session,
    }
  }

  if (action === 'message' || action === 'edit_step') {
  const message = String(input.message ?? '').trim()
  if (!isValidHubStudioMessage(message)) {
    return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioMinChars }
  }

  const shouldChargeChat = !session.presetId || action === 'edit_step'
  if (shouldChargeChat) {
    const chatCharge = await deductUserCredits(input.userId, HUB_CHAT_CREDIT)
    if (!chatCharge.ok) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: chatCharge.error }
    }
    chargedChat = HUB_CHAT_CREDIT
  }

  if (
    editPrepared &&
    isInPlacePackagingImageEdit(
      editPrepared.baseSession,
      editPrepared.baseSession.presetId!,
      editPrepared.editStepKey
    )
  ) {
    const originalSession = editPrepared.baseSession
    const editStepKey = editPrepared.editStepKey
    const editLabel = stepLabel(originalSession, editStepKey, input.locale)
    session = focusSessionOnDesignStep(
      originalSession,
      originalSession.presetId!,
      editStepKey,
      editPrepared.editMessage
    )

    const generated = await generateAsset(
      input.userId,
      session,
      editPrepared.editMessage,
      editStepKey,
      editLabel,
      input.locale
    )
    if (generated.error || !generated.session.pendingPreview) {
      return {
        ok: false,
        reply: generated.error ?? t.errorGeneric,
        session: originalSession,
        threadId: input.threadId,
        chargedChat,
        error: generated.error ?? t.errorGeneric,
      }
    }

    const editedImageUrl = generated.session.pendingPreview.url
    const finished = await finishApprove(
      generated.session,
      input.locale,
      input.threadId,
      input.userId
    )
    session = restoreTimelineAfterInPlaceImageEdit(
      finished.session,
      originalSession,
      editStepKey
    )
    reply = finished.reply
    chargedImage = generated.chargedImage
    studio = {
      ...generated.studio,
      ...finished.studio,
      screenKey: editStepKey,
      screenLabel: editLabel,
      imageUrl: editedImageUrl,
      processSteps: session.processSteps,
      showApproveReference: false,
      showRegenerate: true,
      ...buildReferencePreviewsPayload(session),
    }
    await pgUpdateHubChatMessageContent(editPrepared.resolved.id, editPrepared.editMessage, {
      stepKey: editStepKey,
    })
    await pgSaveHubThreadSession(input.threadId, session)
    if (session.packaging?.mockupUrl) {
      await pgUpdateLatestHubStudioImageUrl({
        threadId: input.threadId,
        screenKey: 'box_mockup_3d',
        imageUrl: session.packaging.mockupUrl,
      })
    }
    await upsertHubStudioImageMessage({
      threadId: input.threadId,
      content: reply,
      studio,
    })
    const refreshed = await pgGetHubChatThread(input.userId, input.threadId)
    const threadMessages =
      refreshed?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        studio: message.studio,
        createdAt: message.createdAt,
      })) ?? []
    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat,
      chargedImage: chargedImage || undefined,
      threadMessages,
    }
  }

  if (
    editPrepared &&
    isInPlaceDiscoveryBriefEdit(
      editPrepared.baseSession,
      editPrepared.baseSession.presetId!,
      editPrepared.editStepKey
    )
  ) {
    const originalSession = editPrepared.baseSession
    const editStepKey = editPrepared.editStepKey
    session = applyInPlaceDiscoveryBriefEdit(
      originalSession,
      editStepKey,
      editPrepared.editMessage
    )
    const editLabel = stepLabel(session, editStepKey, input.locale)
    reply = t.studioBriefUpdated.replace('{screen}', editLabel)
    await pgUpdateHubChatMessageContent(editPrepared.resolved.id, editPrepared.editMessage, {
      stepKey: editStepKey,
    })
    await pgSaveHubThreadSession(input.threadId, session)
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio: { processSteps: session.processSteps },
    })
    return {
      ok: true,
      reply,
      studio: { processSteps: session.processSteps },
      session,
      threadId: input.threadId,
      chargedChat,
    }
  }

  if (editPrepared) {
    session = rewindSessionForStepEdit(
      editPrepared.baseSession,
      editPrepared.baseSession.presetId!,
      editPrepared.editStepKey,
      editPrepared.editMessage
    )
    await pgUpdateHubChatMessageContent(editPrepared.resolved.id, editPrepared.editMessage, {
      stepKey: editPrepared.editStepKey,
    })
    await pgDeleteHubMessagesAfter(input.threadId, editPrepared.resolved.createdAt)
    await pgSaveHubThreadSession(input.threadId, session)
    skipUserInsert = true
  }

  let userMessageId: string | undefined
  if (!skipUserInsert) {
    userMessageId =
      (await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'user',
        content: message,
        studio: session.currentStepKey ? { stepKey: session.currentStepKey } : null,
      })) ?? undefined
  }

  try {
    session = applyMatchedPreset(session)

    if (input.generationRefKeys !== undefined && session.presetId) {
      session = applyGenerationRefKeys(session, session.presetId, input.generationRefKeys)
    }

    const preset = session.presetId ? getStudioPreset(session.presetId) : null

    const onDiscoveryBefore =
      session.presetId && session.currentStepKey
        ? isDiscoveryStep(session.presetId, session.currentStepKey)
        : false
    const generatorBefore =
      session.presetId && session.currentStepKey
        ? getStepGenerator(session.presetId, session.currentStepKey)
        : null
    if (session.currentStepKey && generatorBefore && !onDiscoveryBefore && message) {
      session = saveCurrentStudioStepBrief(session, message)
    }

    session = reconcileDiscoveryProgress(session, input.locale)

    if (session.presetId === 'packaging_kit') {
      const parsedEarly = parseBoxDimensions(message)
      if (parsedEarly.ok && discoveryReadyForBoxSize(session)) {
        session.packaging = {
          ...packagingBase(session),
          version: 2,
          dimensionDraft: undefined,
          dimensionsMm: parsedEarly.dimensionsMm,
          facesConfirmed: false,
          faceAspectRatios: undefined,
        }
        session.briefNotes = {
          ...session.briefNotes,
          box_size: message.trim(),
        }
        session = completeBoxSizeDiscovery(session)
        session = applyStudioSessionLabels(session, input.locale)
        const confirmed = buildBoxSizeConfirmReply(
          input.locale,
          parsedEarly.dimensionsMm,
          session.processSteps
        )
        reply = confirmed.reply
        await pgSaveHubThreadSession(input.threadId, session)
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'assistant',
          content: reply,
          studio: confirmed.studio,
        })
        return {
          ok: true,
          reply,
          studio: confirmed.studio,
          session,
          threadId: input.threadId,
          chargedChat,
        }
      }
    }

    if (!session.presetId || !isNavigatedBackEdit(session, session.presetId)) {
      session = syncDiscoveryCurrentStep(session, input.locale)
    }

    const boxSizeStepKey = getActiveStepKey(session) ?? session.currentStepKey
    if (
      session.presetId === 'packaging_kit' &&
      isBoxSizeStepKey(boxSizeStepKey)
    ) {
      const parsed = parseBoxDimensions(message)
      if (parsed.ok) {
        session.packaging = {
          ...packagingBase(session),
          version: 2,
          dimensionDraft: undefined,
          dimensionsMm: parsed.dimensionsMm,
          facesConfirmed: false,
          faceAspectRatios: undefined,
        }
        session.briefNotes = {
          ...session.briefNotes,
          box_size: message.trim(),
        }
        session = completeBoxSizeDiscovery(session)
        session = applyStudioSessionLabels(session, input.locale)
        const confirmed = buildBoxSizeConfirmReply(input.locale, parsed.dimensionsMm, session.processSteps)
        reply = confirmed.reply
        await pgSaveHubThreadSession(input.threadId, session)
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'assistant',
          content: reply,
          studio: confirmed.studio,
        })
        return {
          ok: true,
          reply,
          studio: confirmed.studio,
          session,
          threadId: input.threadId,
          chargedChat,
        }
      }
      if (/\d+\s*(?:x|×|\*)/i.test(message)) {
        reply = boxSizeError(input.locale, parsed.error)
        await pgSaveHubThreadSession(input.threadId, session)
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'assistant',
          content: reply,
          studio: { processSteps: session.processSteps },
        })
        return { ok: true, reply, session, threadId: input.threadId, chargedChat }
      }
    }

    if (
      session.presetId === 'packaging_kit' &&
      session.currentStepKey === 'box_face_confirm' &&
      session.packaging?.dimensionsMm
    ) {
      const reparse = parseBoxDimensions(message)
      if (reparse.ok) {
        const previousDimensions = session.packaging?.dimensionsMm
        const dimensionsChanged =
          !previousDimensions ||
          previousDimensions.length !== reparse.dimensionsMm.length ||
          previousDimensions.width !== reparse.dimensionsMm.width ||
          previousDimensions.height !== reparse.dimensionsMm.height
        session.packaging = {
          ...(session.packaging ?? { version: 2 as const, faces: {} }),
          version: 2,
          dimensionsMm: reparse.dimensionsMm,
          facesConfirmed: false,
          faceAspectRatios: undefined,
        }
        if (dimensionsChanged) session = invalidatePackagingForDimensionChange(session)
        session = applyStudioSessionLabels(session, input.locale)
        reply = buildBoxFaceConfirmSummary(input.locale, reparse.dimensionsMm)
        const confirmStudio = buildBoxSizeConfirmReply(
          input.locale,
          reparse.dimensionsMm,
          session.processSteps
        ).studio
        await pgSaveHubThreadSession(input.threadId, session)
        await pgInsertHubChatMessage({
          threadId: input.threadId,
          role: 'assistant',
          content: reply,
          studio: confirmStudio,
        })
        return {
          ok: true,
          reply,
          studio: confirmStudio,
          session,
          threadId: input.threadId,
          chargedChat,
        }
      }
    }

    let forceCompleteBoxFaceConfirm = false
    if (
      session.presetId === 'packaging_kit' &&
      session.currentStepKey === 'box_face_confirm' &&
      session.packaging?.dimensionsMm &&
      isBoxFaceConfirmAck(message)
    ) {
      const plan = buildPackagingFaceAspectPlan(session.packaging.dimensionsMm)
      session.packaging = {
        ...session.packaging,
        faceAspectRatios: faceAspectRatiosFromPlan(plan),
        facesConfirmed: true,
      }
      session.briefNotes = {
        ...session.briefNotes,
        box_face_confirm: message.trim(),
      }
      forceCompleteBoxFaceConfirm = true
    }

    const activeDesign = Boolean(session.presetId && session.processSteps.length)
    const ai: ReturnType<typeof parseAiStudio> = activeDesign
      ? {
          reply: '',
          intent: 'chat',
          shouldGenerate: false,
          retryIntent: 'none',
          completeCurrentStep: Boolean(
            session.presetId &&
              session.currentStepKey &&
              isDiscoveryStep(session.presetId, session.currentStepKey)
          ),
        }
      : await callStudioBrain(input.apiKey, input.userId, input.locale, message, session)

    const idleFeatureMatch = !activeDesign
      ? await (async () => {
          let recentContext: string | undefined
          if (isShortAffirmativeReply(message)) {
            const thread = await pgGetHubChatThread(input.userId, input.threadId)
            const lastAssistant = [...(thread?.messages ?? [])].reverse().find((m) => m.role === 'assistant')
            recentContext = lastAssistant?.content
          }
          return resolveIdleFeatureMatch(message, input.locale, recentContext)
        })()
      : null

    if (idleFeatureMatch?.kind === 'standalone' && idleFeatureMatch.href === '/tao-thiep-moi-cuoi-ai') {
      ai.suggestedPresetId = undefined
      ai.hubRoute = 'workflow'
    }

    if (!activeDesign && idleFeatureMatch) {
      if (idleFeatureMatch.kind === 'standalone') {
        const studioFallback = matchStudioPresetWithScore(message)
        if (
          ai.suggestedPresetId &&
          isValidStudioPresetId(ai.suggestedPresetId) &&
          studioFallback &&
          studioFallback.score >= 10
        ) {
          ai.hubRoute = 'design'
        } else {
          ai.suggestedPresetId = undefined
          ai.hubRoute = 'workflow'
        }
      } else if (
        idleFeatureMatch.kind === 'studio' &&
        !ai.suggestedPresetId &&
        isValidStudioPresetId(idleFeatureMatch.presetId)
      ) {
        ai.suggestedPresetId = idleFeatureMatch.presetId
        ai.hubRoute = 'design'
      }
    }

    const hubRoute: HubRouteKind = ai.hubRoute ?? 'design'
    const useAdvisory =
      !activeDesign &&
      !ai.suggestedPresetId &&
      (hubRoute !== 'design' || idleFeatureMatch?.kind === 'standalone')

    if (useAdvisory) {
      const advisory = await buildAdvisoryPayload({
        locale: input.locale,
        userId: input.userId,
        threadId: input.threadId,
        message,
        hubRoute,
        workflowsRaw: ai.workflows,
        planRaw: ai.plan,
      })
      const fallbackReply =
        idleFeatureMatch?.kind === 'standalone'
          ? buildStandaloneFeatureAdvisoryReply(input.locale, idleFeatureMatch)
          : '...'
      reply = sanitizeAssistantReply(ai.reply?.trim() || fallbackReply)
      await pgInsertHubChatMessage({
        threadId: input.threadId,
        role: 'assistant',
        content: reply,
        workflows: advisory.workflows.length ? advisory.workflows : null,
        planId: advisory.plan?.id ?? null,
      })
      return {
        ok: true,
        reply,
        session,
        threadId: input.threadId,
        chargedChat,
        workflows: advisory.workflows,
        plan: advisory.plan,
        hubRoute,
        showFeaturePicker: advisory.workflows.length === 0 && ai.intent === 'clarify',
      }
    }

    const hadPreset = Boolean(session.presetId)
    const justAppliedPreset =
      !hadPreset && Boolean(ai.suggestedPresetId && isValidStudioPresetId(ai.suggestedPresetId))
    if (!session.presetId && ai.suggestedPresetId && isValidStudioPresetId(ai.suggestedPresetId)) {
      session = applySuggestedPreset(session, input.locale, ai.suggestedPresetId)
      // Rule-matched studio start (e.g. "tạo lại bản thiết kế") — skip AI clarify fluff.
      const ruleStartedStudio =
        idleFeatureMatch?.kind === 'studio' && idleFeatureMatch.presetId === ai.suggestedPresetId
      const baseReply = ruleStartedStudio ? '' : ai.reply || '...'
      reply = appendPresetKickoffIfNeeded(baseReply, input.locale, ai.suggestedPresetId, true)
      reply = appendFirstStepAsk(reply, input.locale, ai.suggestedPresetId, session.currentStepKey)
      ai.completeCurrentStep = false
    }

    if (ai.projectTitle) session.projectTitle = ai.projectTitle

    const discoveryBriefEdit =
      action === 'edit_step' && session.presetId && message.trim()
        ? matchDiscoveryBriefEditStep(message, input.locale, session.presetId, session)
        : null

    if (discoveryBriefEdit && session.presetId) {
      session = applyDiscoveryBriefEdit(
        session,
        session.presetId,
        discoveryBriefEdit.stepKey,
        message,
        { reopenStep: discoveryBriefEdit.reopenStep }
      )
      ai.completeCurrentStep = false
      ai.shouldGenerate = false
      if (discoveryBriefEdit.stepKey === 'box_size' || isBoxSizeStepKey(discoveryBriefEdit.stepKey)) {
        const parsed = parseBoxDimensions(session.briefNotes.box_size ?? message)
        if (parsed.ok) {
          const previousDimensions = session.packaging?.dimensionsMm
          const dimensionsChanged =
            !previousDimensions ||
            previousDimensions.length !== parsed.dimensionsMm.length ||
            previousDimensions.width !== parsed.dimensionsMm.width ||
            previousDimensions.height !== parsed.dimensionsMm.height
          session.packaging = {
            ...(session.packaging ?? { version: 2 as const, faces: {} }),
            version: 2,
            dimensionsMm: parsed.dimensionsMm,
            dimensionDraft: undefined,
            facesConfirmed: false,
            faceAspectRatios: undefined,
          }
          if (dimensionsChanged) session = invalidatePackagingForDimensionChange(session)
          session = applyStudioSessionLabels(session, input.locale)
        } else {
          session.packaging = {
            ...(session.packaging ?? { version: 2 as const, faces: {} }),
            version: 2,
            dimensionDraft: undefined,
            dimensionsMm: null,
            facesConfirmed: false,
            faceAspectRatios: undefined,
          }
        }
      }
      const editedLabel = stepLabel(session, discoveryBriefEdit.stepKey, input.locale)
      reply = t.studioBriefUpdated.replace('{screen}', editedLabel)
      if (session.presetId && session.currentStepKey) {
        reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
      }
    }

    const onDiscoveryForBrief =
      session.presetId && session.currentStepKey
        ? isDiscoveryStep(session.presetId, session.currentStepKey)
        : false
    if (activeDesign && session.currentStepKey) {
      const screenLabel = stepLabel(session, session.currentStepKey, input.locale)
      if (
        session.presetId === 'landing_page' &&
        isLandingDesignStepKey(session.currentStepKey)
      ) {
        reply = t.studioLandingCopySaved.replace('{screen}', screenLabel)
      } else {
        reply = t.studioBriefUpdated.replace('{screen}', screenLabel)
      }
    }
    if (!discoveryBriefEdit && session.currentStepKey && message && !justAppliedPreset) {
      if (onDiscoveryForBrief) {
        const answer = ai.briefUpdates?.[session.currentStepKey]?.trim() || message
        const skipBrief =
          session.presetId &&
          isPresetTitleEcho(input.locale, session.presetId, answer) &&
          (session.currentStepKey === 'brand_name' ||
            (session.presetId === 'sale_banner' && session.currentStepKey === 'domain_name'))
        if (!skipBrief) {
          session.briefNotes = {
            ...session.briefNotes,
            [session.currentStepKey]: answer,
          }
        }
      } else if (ai.briefUpdates) {
        session.briefNotes = {
          ...session.briefNotes,
          ...ai.briefUpdates,
          [session.currentStepKey]: ai.briefUpdates[session.currentStepKey] ?? message,
        }
      }
    }

    if (
      session.presetId === 'packaging_kit' &&
      session.currentStepKey === FACE_PRINT_STYLE_STEP_KEY
    ) {
      const styleKey = parseFacePrintStyleKey(message)
      if (styleKey) {
        session.briefNotes = {
          ...session.briefNotes,
          [FACE_PRINT_STYLE_STEP_KEY]: facePrintStyleBriefValue(styleKey),
        }
        if (!ai.completeCurrentStep) ai.completeCurrentStep = true
        reply =
          reply ||
          t.studioFacePrintStyleConfirmed.replace('{style}', facePrintStyleLabel(styleKey, input.locale))
      }
    }

    if (session.presetId === 'sale_banner' && session.currentStepKey === 'banner_design') {
      ai.completeCurrentStep = false
    }

    if (session.presetId === 'sale_banner' && session.currentStepKey === 'banner_ad_format') {
      ai.completeCurrentStep = false
    }

    if (
      session.presetId === 'packaging_kit' &&
      session.currentStepKey === 'box_size'
    ) {
      const parsed = parseBoxDimensions(session.briefNotes.box_size ?? message)
      if (parsed.ok) {
        session.packaging = {
          ...(session.packaging ?? { version: 2 as const, faces: {} }),
          version: 2,
          dimensionDraft: undefined,
          dimensionsMm: parsed.dimensionsMm,
          facesConfirmed: false,
          faceAspectRatios: undefined,
        }
        reply = buildBoxFaceConfirmSummary(input.locale, parsed.dimensionsMm)
        if (!ai.completeCurrentStep) ai.completeCurrentStep = true
      } else if (ai.completeCurrentStep || /\d+\s*(?:x|×|\*)/i.test(message)) {
        ai.completeCurrentStep = false
        reply = boxSizeError(input.locale, parsed.error)
      }
    }

    if (isBagKitPreset(session.presetId) && session.currentStepKey === 'bag_size') {
      const parsed = parseBagDimensions(session.briefNotes.bag_size ?? message)
      if (parsed.ok) {
        session.bagKit = {
          ...(session.bagKit ?? emptyBagKitState()),
          dimensionsMm: parsed.dimensionsMm,
          facesConfirmed: false,
        }
        const confirmed = buildBagSizeConfirmReply(input.locale, parsed.dimensionsMm, session.processSteps)
        reply = confirmed.reply
        studio = { ...studio, ...confirmed.studio }
        if (!ai.completeCurrentStep) ai.completeCurrentStep = true
      } else if (ai.completeCurrentStep || /\d+\s*(?:x|×|\*)/i.test(message)) {
        ai.completeCurrentStep = false
        reply = boxSizeError(input.locale, parsed.error)
      }
    }

    if (forceCompleteBoxFaceConfirm) {
      ai.completeCurrentStep = true
      const ackRows = {
        vi: 'Đã xác nhận kích thước mặt đáy, mặt trước/sau và mặt bên.',
        en: 'Bottom, front/back and side face sizes are confirmed.',
        zh: '已确认底面、正/背面与侧面尺寸。',
        ja: '底面・正面/背面・側面のサイズを確認しました。',
        ko: '바닥/앞·뒤/측면 크기를 확인했습니다.',
      } satisfies Record<WebLocale, string>
      reply = ackRows[input.locale]
    }

    const aiRetry: HubStudioAiRetryHint = activeDesign
      ? { retryIntent: 'none' }
      : sanitizeAiRetryHint(
          session,
          inferAiRetryFromGenerationFlags(
            session,
            mergeKeywordRetryHint(session, input.locale, message, {
              retryIntent: normalizeRetryIntent(ai.retryIntent),
              retryStepKey: ai.retryStepKey,
            }),
            ai.shouldGenerate
          ),
          message,
          input.locale
        )
    const aiWantsRetry = aiRetry.retryIntent !== 'none' && aiRetry.retryIntent !== 'continue_next'

    if (
      !discoveryBriefEdit &&
      !justAppliedPreset &&
      session.presetId &&
      session.currentStepKey &&
      onDiscoveryForBrief &&
      !ai.completeCurrentStep &&
      !aiWantsRetry
    ) {
      const stored = session.briefNotes[session.currentStepKey]?.trim() ?? ''
      const skipAuto =
        session.currentStepKey === 'brand_name' &&
        isPresetTitleEcho(input.locale, session.presetId, stored)
      if (stored.length >= 2 && !skipAuto) {
        if (
          session.presetId === 'packaging_kit' &&
          (session.currentStepKey === 'box_size' || isBoxSizeStepKey(session.currentStepKey))
        ) {
          const parsed = parseBoxDimensions(stored)
          if (parsed.ok) ai.completeCurrentStep = true
        } else if (session.currentStepKey === FACE_PRINT_STYLE_STEP_KEY) {
          if (parseFacePrintStyleKey(stored)) ai.completeCurrentStep = true
        } else if (session.currentStepKey !== 'box_face_confirm' && session.currentStepKey !== 'banner_ad_format') {
          ai.completeCurrentStep = true
        }
      }
    }

    /** Cùng một tin nhắn vừa chốt brief (vd. bảng màu) — không được dùng để auto-tạo bước design kế tiếp (vd. logo). */
    let justEnteredDesignStep = false

    if (
      ai.completeCurrentStep &&
      session.presetId &&
      session.currentStepKey === 'brand_name' &&
      isPresetTitleEcho(input.locale, session.presetId, message)
    ) {
      ai.completeCurrentStep = false
    }

    if (ai.completeCurrentStep && session.currentStepKey && session.presetId) {
      const onDiscoveryStep = isDiscoveryStep(session.presetId, session.currentStepKey)
      if (onDiscoveryStep) {
        session.processSteps = markStepDone(session.processSteps, session.currentStepKey)
        const justFinishedDiscovery = allDiscoveryDone(session.presetId, session.processSteps)
        if (justFinishedDiscovery) {
          session.discoveryComplete = true
        }
        const next = nextPendingStep(session.processSteps)
        if (next?.key && !isDiscoveryStep(session.presetId, next.key)) {
          justEnteredDesignStep = true
        }
        session.currentStepKey = next?.key ?? null
        session.processSteps = setStepInProgress(session.processSteps, session.currentStepKey)
        if (
          session.presetId &&
          session.currentStepKey &&
          stepSupportsGenerationRefPicker(session.presetId, session.currentStepKey)
        ) {
          session = resetGenerationSelectionForStep(session, session.presetId, session.currentStepKey)
        }
        reply = reply || sanitizeAssistantReply(ai.reply || '...')
        if (justFinishedDiscovery && session.presetId) {
          const presetId = session.presetId
          const logoKey = getPrimaryLogoStepKey(presetId)
          // Chỉ nhắc bước Logo khi preset thật sự có generator=logo (không dùng referenceAnchor như concept_sheet).
          if (
            logoKey &&
            session.currentStepKey === logoKey &&
            isLogoDesignStep(presetId, logoKey)
          ) {
            reply = `${reply}\n\n${t.studioStartWithLogo}`
            reply = appendStepAsk(reply, input.locale, presetId, logoKey)
          } else if (session.currentStepKey) {
            reply = appendStepAsk(reply, input.locale, presetId, session.currentStepKey)
          }
        } else if (session.presetId && session.currentStepKey && isDiscoveryStep(session.presetId, session.currentStepKey)) {
          reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
        }
      } else {
        reply = reply || sanitizeAssistantReply(ai.reply || '...')
      }
    } else if (!activeDesign && ai.currentStepKey && !aiWantsRetry && session.discoveryComplete) {
      session.currentStepKey = ai.currentStepKey
      session.processSteps = setStepInProgress(session.processSteps, ai.currentStepKey)
      reply = hadPreset || session.presetId ? sanitizeAssistantReply(ai.reply || '...') : reply || sanitizeAssistantReply(ai.reply || '...')
    } else {
      reply = reply || sanitizeAssistantReply(ai.reply || '...')
    }

    session = reconcileDiscoveryProgress(session, input.locale)
    if (!session.presetId || !isNavigatedBackEdit(session, session.presetId)) {
      session = syncDiscoveryCurrentStep(session, input.locale)
    }

    let explicitRetryStep: string | null = null
    if (!activeDesign && session.presetId && session.discoveryComplete) {
      explicitRetryStep = resolveRetryTargetStep(
        session,
        session.presetId,
        input.locale,
        message,
        aiRetry
      )
      if (explicitRetryStep && needsStepRetryRepair(session, session.presetId, explicitRetryStep, message, input.locale, aiRetry)) {
        const navigatedBack =
          session.presetId != null && isNavigatedBackEdit(session, session.presetId)
        if (navigatedBack) {
          session = focusSessionOnDesignStep(
            session,
            session.presetId!,
            session.currentStepKey ?? explicitRetryStep,
            message
          )
        } else {
          session = applyStepRetryRepair(
            session,
            session.presetId,
            explicitRetryStep,
            message,
            input.locale,
            aiRetry
          )
          session = invalidatePackagingFromStep(
            session,
            session.currentStepKey ?? explicitRetryStep
          )
        }
        if (isExplicitRetryIntent(message, aiRetry)) {
          reply = sanitizeAssistantReply(reply)
        }
      }
    }

    let packagingFaceCompletedWithoutImage = false
    if (
      !activeDesign &&
      session.presetId === 'packaging_kit' &&
      session.currentStepKey &&
      isPackagingFaceStepKey(session.currentStepKey) &&
      !session.pendingPreview?.screenKey
    ) {
      const slot = packagingStepKeyToSlot(session.currentStepKey)
      if (slot) {
        const intent = parseSecondaryFaceIntent(message, slot)
        if (intent === 'empty') {
          const label = stepLabel(session, session.currentStepKey, input.locale)
          const stayOnStep =
            session.presetId != null &&
            (isNavigatedBackEdit(session, session.presetId) ||
              isPackagingFaceReEdit(session, session.currentStepKey))
          const advanced = advanceAfterPackagingFaceStep(
            session,
            session.currentStepKey,
            label,
            input.locale,
            { sourceMode: 'empty' },
            false,
            { stayOnStep }
          )
          session = advanced.session
          reply = advanced.reply
          packagingFaceCompletedWithoutImage = true
        } else if (intent === 'copy' && session.packaging) {
          const sourceUrl = copySourceUrlForSlot(session.packaging, slot)
          if (sourceUrl) {
            const label = stepLabel(session, session.currentStepKey, input.locale)
            const stayOnStep =
              session.presetId != null &&
              (isNavigatedBackEdit(session, session.presetId) ||
                isPackagingFaceReEdit(session, session.currentStepKey))
            const advanced = advanceAfterPackagingFaceStep(
              session,
              session.currentStepKey,
              label,
              input.locale,
              { sourceMode: 'copy', url: sourceUrl },
              true,
              { stayOnStep }
            )
            session = advanced.session
            reply = advanced.reply
            packagingFaceCompletedWithoutImage = true
          } else {
            const copyFrom = BOX_FACE_COPY_SOURCE[slot]
            const sourceLabel = copyFrom ? getBoxFaceSlotLabel(copyFrom, input.locale) : ''
            const copyFail = {
              vi: `Chưa có ảnh mặt **${sourceLabel}** để sao chép — hãy tạo ảnh mặt đó trước, mô tả nội dung riêng, hoặc **bỏ trống**.`,
              en: `No **${sourceLabel}** artwork to copy yet — create that face first, describe unique content, or **leave blank**.`,
              zh: `尚无**${sourceLabel}**图可复制 — 请先创建该面、描述独立内容，或**留空**。`,
              ja: `**${sourceLabel}**の画像がまだありません — 先に作成するか、別内容を記述するか、**空白**にしてください。`,
              ko: `**${sourceLabel}** 면 이미지가 없습니다 — 먼저 생성하거나, 별도 내용을 입력하거나, **비우기**를 선택하세요.`,
            } satisfies Record<WebLocale, string>
            reply = `${reply}\n\n${copyFail[input.locale]}`
          }
        }
      }
    }

    const onDiscovery =
      session.presetId && session.currentStepKey
        ? isDiscoveryStep(session.presetId, session.currentStepKey)
        : false
    const generator =
      session.presetId && session.currentStepKey
        ? getStepGenerator(session.presetId, session.currentStepKey)
        : null
    const canGenerate =
      Boolean(generator) &&
      !onDiscovery &&
      (session.discoveryComplete || !session.presetId) &&
      (!session.presetId ||
        !isStepAfterPrimaryLogo(session.presetId, session.currentStepKey!) ||
        (primaryLogoApproved(session.processSteps, session.presetId) &&
          hasPrimaryLogoReference(session.referenceImages, session.presetId)))

    const packagingArtifactReady = Boolean(
      session.presetId === 'packaging_kit' &&
        session.currentStepKey &&
        isDeterministicPackagingGenerator(generator) &&
        session.discoveryComplete &&
        session.packaging?.dimensionsMm &&
        allPackagingFaceSlotsCommitted(session.packaging)
    )

    const forceGenerate = Boolean(
      !activeDesign &&
        session.currentStepKey &&
        shouldForceGenerateDesign(
          session,
          session.presetId,
          session.currentStepKey,
          message,
          onDiscovery,
          explicitRetryStep,
          aiRetry,
          { skipSameTurnDesignEntry: justEnteredDesignStep, locale: input.locale }
        )
    )

    const pendingStepReady = Boolean(
      session.currentStepKey &&
        session.pendingPreview?.screenKey === session.currentStepKey &&
        shouldShowPendingRetry(session, session.currentStepKey, message, aiRetry)
    )

    const pendingOnCurrent = Boolean(
      session.currentStepKey &&
        session.pendingPreview?.screenKey === session.currentStepKey
    )

    const needsUpload = Boolean(preset?.needsUpload && !session.uploadImages.length)
    if (pendingOnCurrent && wantsContinueNextStep(aiRetry)) {
      const label = stepLabel(session, session.currentStepKey, input.locale)
      reply = t.studioApproveBeforeNext.replace('{screen}', label)
      studio = buildPendingStepStudio(session, session.currentStepKey!, session.presetId!)
    } else if (pendingStepReady) {
      const label = stepLabel(session, session.currentStepKey, input.locale)
      reply = t.studioStepPendingApprove.replace('{screen}', label)
      studio = buildPendingStepStudio(session, session.currentStepKey!, session.presetId!)
    } else if (needsUpload && (ai.shouldGenerate || forceGenerate)) {
      reply = `${reply}\n\n${t.studioNeedUpload}`
      studio = { processSteps: session.processSteps, needsUpload: true }
    } else if (
      session.presetId &&
      session.currentStepKey &&
      !isDeterministicPackagingGenerator(generator) &&
      isStepAfterPrimaryLogo(session.presetId, session.currentStepKey) &&
      !isLogoDesignStep(session.presetId, session.currentStepKey) &&
      !primaryLogoApproved(session.processSteps, session.presetId)
    ) {
      reply = `${reply}\n\n${t.studioLogoFirst}`
      studio = { processSteps: session.processSteps }
    } else if (
      session.presetId &&
      session.currentStepKey &&
      !isDeterministicPackagingGenerator(generator) &&
      isStepAfterPrimaryLogo(session.presetId, session.currentStepKey) &&
      !isLogoDesignStep(session.presetId, session.currentStepKey) &&
      !hasPrimaryLogoReference(session.referenceImages, session.presetId) &&
      !isExplicitRetryIntent(message, aiRetry)
    ) {
      reply = `${sanitizeAssistantReply(reply)}\n\n${t.studioNeedLogoReference}`
      studio = { processSteps: session.processSteps }
    } else if (
      (canGenerate || packagingArtifactReady) &&
      session.currentStepKey &&
      session.presetId &&
      !justEnteredDesignStep &&
      !packagingFaceCompletedWithoutImage &&
      (shouldExecuteDesignGeneration({
        onDiscovery,
        discoveryComplete: Boolean(session.discoveryComplete),
        forceGenerate,
        aiShouldGenerate: ai.shouldGenerate,
      }))
    ) {
      const label = stepLabel(session, session.currentStepKey, input.locale)
      const genPrompt =
        ai.generationPrompt?.trim() ||
        buildDesignPromptFromMessage(session, session.presetId, session.currentStepKey, message, input.locale)
      const genResult = await generateAsset(
        input.userId,
        session,
        genPrompt,
        session.currentStepKey,
        label,
        input.locale
      )
      if (genResult.error) {
        reply = `${reply}\n\n(${genResult.error})`
        studio = genResult.studio.needsUpload
          ? { processSteps: session.processSteps, needsUpload: true }
          : { processSteps: session.processSteps }
      } else {
        session = genResult.session
        studio = genResult.studio
        chargedImage = genResult.chargedImage
        if (generator === 'dieline_pdf') {
          reply = deterministicPackagingGeneratedReply(input.locale, label)
        } else if (
          generator === 'packaging_mockup' ||
          generator === 'packaging_face' ||
          forceGenerate ||
          (explicitRetryStep === session.currentStepKey && isExplicitRetryIntent(message, aiRetry))
        ) {
          reply =
            generator === 'packaging_mockup'
              ? deterministicPackagingGeneratedReply(input.locale, label)
              : t.studioGeneratedStep.replace('{screen}', label)
        }
      }
    } else if (
      shouldExecuteDeferredDesignAction({
        presetId: session.presetId,
        explicitRetryStep,
        aiWantsRetry,
        aiShouldGenerate: ai.shouldGenerate,
        packagingFaceCompletedWithoutImage,
        alreadyGenerated: Boolean(chargedImage || studio?.imageUrl),
        pendingBlocksGenerate: Boolean(
          explicitRetryStep &&
            session.pendingPreview?.screenKey === explicitRetryStep &&
            shouldShowPendingRetry(session, explicitRetryStep, message, aiRetry)
        ),
      })
    ) {
      const targetStep = explicitRetryStep!
      if (session.currentStepKey !== targetStep) {
        session = focusSessionOnDesignStep(session, session.presetId!, targetStep, message)
      }
      if (targetStep === 'box_mockup_3d' || targetStep === 'box_dieline_pdf') {
        const artifactResult = await runPackagingArtifactStep(
          input.userId,
          session,
          input.locale,
          message,
          targetStep
        )
        session = artifactResult.session
        studio = artifactResult.studio
        chargedImage = artifactResult.chargedImage ?? 0
        reply = artifactResult.error
          ? `${sanitizeAssistantReply(reply)}\n\n(${artifactResult.error})`
          : deterministicPackagingGeneratedReply(input.locale, artifactResult.artifactLabel)
      } else {
        const label = stepLabel(session, targetStep, input.locale)
        const genPrompt =
          ai.generationPrompt?.trim() ||
          buildDesignPromptFromMessage(session, session.presetId!, targetStep, message, input.locale)
        const genResult = await generateAsset(
          input.userId,
          session,
          genPrompt,
          targetStep,
          label,
          input.locale
        )
        if (genResult.error) {
          reply = `${sanitizeAssistantReply(reply)}\n\n(${genResult.error})`
          studio = genResult.studio.needsUpload
            ? { processSteps: session.processSteps, needsUpload: true }
            : { processSteps: session.processSteps }
        } else {
          session = genResult.session
          studio = genResult.studio
          chargedImage = genResult.chargedImage
          reply = t.studioGeneratedStep.replace('{screen}', label)
        }
      }
    } else if (
      wantsContinueNextStep(aiRetry) &&
      session.presetId &&
      session.currentStepKey &&
      !onDiscovery &&
      !(
        isNavigatedBackEdit(session, session.presetId) ||
        isPackagingFaceReEdit(session, session.currentStepKey)
      )
    ) {
      reply = sanitizeAssistantReply(reply)
      const ask = getStepAskPrompt(input.locale, session.presetId, session.currentStepKey)
      if (ask && !reply.includes(ask)) {
        reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
      }
      if (
        session.referenceImages.length > 0 &&
        !isPackagingCompositeArtifactStepKey(session.currentStepKey) &&
        !reply.includes(t.studioReferenceWillUse.replace('{n}', ''))
      ) {
        reply += `\n\n${referenceUsageReply(input.locale, session.referenceImages.length, STUDIO_REFERENCE_ATTACH_LIMIT)}`
      }
      studio = {
        processSteps: session.processSteps,
        awaitingRequirements: true,
        ...buildReferencePreviewsPayload(session, session.currentStepKey),
        ...(session.presetId && session.currentStepKey
          ? buildGenerationRefPickerPayload(session, session.presetId, session.currentStepKey)
          : {}),
        needsUpload: needsUpload || undefined,
      }
    } else {
      studio = {
        processSteps: session.processSteps,
        ...packagingBoxConfirmStudioExtras(input.locale, session),
        ...packagingFacePrintStyleStudioExtras(input.locale, session),
        ...(session.presetId &&
        session.currentStepKey &&
        !onDiscovery &&
        !session.pendingPreview?.screenKey
          ? buildGenerationRefPickerPayload(session, session.presetId, session.currentStepKey)
          : {}),
        needsUpload: needsUpload || undefined,
      }
    }

    session = reconcileDiscoveryProgress(session, input.locale)
    if (!session.presetId || !isNavigatedBackEdit(session, session.presetId)) {
      session = syncDiscoveryCurrentStep(session, input.locale)
    }
    reply = appendCurrentDiscoveryAsk(reply, input.locale, session)
    studio = {
      ...studio,
      processSteps: session.processSteps,
      ...packagingBoxConfirmStudioExtras(input.locale, session),
    }

    await pgSaveHubThreadSession(input.threadId, session)

    let advisoryWorkflows: HubChatWorkflowSuggestion[] = []
    let advisoryPlan: HubChatPlanPayload | null = null
    if (hubRoute === 'consultation' || hubRoute === 'workflow' || hubRoute === 'pipeline') {
      const advisory = await buildAdvisoryPayload({
        locale: input.locale,
        userId: input.userId,
        threadId: input.threadId,
        message,
        hubRoute,
        workflowsRaw: ai.workflows,
        planRaw: ai.plan,
      })
      advisoryWorkflows = advisory.workflows
      advisoryPlan = advisory.plan
    }

    await upsertHubStudioImageMessage({
      threadId: input.threadId,
      content: reply,
      studio,
      workflows: advisoryWorkflows.length ? advisoryWorkflows : null,
      planId: advisoryPlan?.id ?? null,
    })

    let threadMessages: HubStudioHandlerResult['threadMessages']
    if (action === 'edit_step') {
      const refreshed = await pgGetHubChatThread(input.userId, input.threadId)
      threadMessages =
        refreshed?.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          studio: m.studio,
          createdAt: m.createdAt,
        })) ?? []
    }

    return {
      ok: true,
      reply,
      studio,
      session,
      threadId: input.threadId,
      chargedChat,
      chargedImage: chargedImage || undefined,
      workflows: advisoryWorkflows.length ? advisoryWorkflows : undefined,
      plan: advisoryPlan,
      hubRoute,
      threadMessages,
      userMessageId,
    }
  } catch (e) {
    await refundUserCredits(input.userId, HUB_CHAT_CREDIT)
    const msg = e instanceof Error ? e.message : t.errorGeneric
    return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: msg }
  }
  }

  return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
}
