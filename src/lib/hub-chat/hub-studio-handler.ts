import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { HUB_CHAT_CREDIT } from '@/lib/hub-chat/hub-chat-catalog'
import {
  emptyStudioSession,
  type HubStudioIntent,
  type HubStudioMessagePayload,
  type HubStudioPreviewKind,
  type HubStudioProcessStep,
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
  presetTitle,
  primaryLogoApproved,
} from '@/lib/hub-chat/hub-studio-presets'
import {
  applySuggestedPreset,
  appendCurrentDiscoveryAsk,
  appendFirstStepAsk,
  appendPresetKickoffIfNeeded,
  buildPresetCatalogForBrain,
  getActiveStepKey,
  isValidStudioPresetId,
  syncDiscoveryCurrentStep,
} from '@/lib/hub-chat/hub-studio-preset-intent'
import {
  buildReferencePreviewsPayload,
  canAddReferenceImage,
  generatorSupportsReference,
  pickedReferenceUrls,
  STUDIO_MAX_REFERENCE_IMAGES,
  STUDIO_REFERENCE_ATTACH_LIMIT,
} from '@/lib/hub-chat/hub-studio-reference-limits'
import {
  appendGenerationProductUrls,
  applyGenerationRefKeys,
  buildGenerationRefPickerPayload,
  removeGenerationProductUrl,
  resetGenerationSelectionForStep,
  resolveGenerationAttachments,
  sanitizeGenerationSelection,
  stepSupportsGenerationRefPicker,
} from '@/lib/hub-chat/hub-studio-generation-refs'
import { runStudioImagePipeline, uploadStudioImages } from '@/lib/hub-agent/studio-image-pipeline'
import { runLyriaPipeline } from '@/lib/hub-agent/lyria-pipeline'
import {
  buildAdvisoryPayload,
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
  pgSaveHubThreadSession,
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
  isExplicitRetryIntent,
  isValidDesignStepKey,
  needsStepRetryRepair,
  normalizeRetryIntent,
  resolveRetryTargetStep,
  sanitizeAiRetryHint,
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
  buildBoxFaceConfirmStudioPayload,
  buildPackagingFaceAspectPlan,
  faceAspectRatiosFromPlan,
  getFaceGeminiAspectRatio,
  isBoxFaceConfirmAck,
  packagingBoxConfirmStudioExtras,
} from '@/lib/packaging/face-aspect'
import { PACKAGING_FACE_FLAT_ARTWORK_RULES } from '@/lib/packaging/face-print-prompt'
import { formatMmSize } from '@/lib/packaging/face-crop-size'
import {
  applyPackagingSessionLabels,
  resolvePackagingStepLabel,
} from '@/lib/packaging/packaging-face-labels'
import { generateBarcodeLabelBuffer } from '@/lib/barcode/generate-barcode-label'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { invalidatePackagingFromStep } from '@/lib/packaging/session-dependencies'
import { exportBoxDielineFromUrls } from '@/lib/packaging/export-dieline'
import {
  buildProductLabelPromptBlock,
  isLogoOnlyReferenceStepKey,
  labelAspectRatioFromSize,
  parseLabelSizeMm,
} from '@/lib/packaging/product-label-step'
import { resolveBarcodeLabelInput } from '@/lib/packaging/barcode-label-step'
import {
  PACKAGING_MOCKUP_FACE_RULES,
  PACKAGING_MOCKUP_SCENE_RULES,
} from '@/lib/packaging/packaging-mockup-prompt'
import {
  applyDiscoveryBriefEdit,
  matchDiscoveryBriefEditStep,
} from '@/lib/hub-chat/hub-studio-discovery-edit'
import { isValidHubStudioMessage } from '@/lib/hub-chat/hub-studio-message'
import {
  inferStepKeyForUserMessage,
  resolveEditUserMessage,
  rewindSessionForStepEdit,
} from '@/lib/hub-chat/hub-studio-step-edit'
import {
  canNavigateToStep,
  focusSessionOnDesignStep,
  isNavigatedBackEdit,
  navigateSessionToStep,
} from '@/lib/hub-chat/hub-studio-step-navigate'
import {
  copySourceUrlForSlot,
  faceSlotsToCreatedFaces,
  getPackagingFaceSizeForStep,
  isPackagingFaceStepKey,
  packagingStepKeyToSizeKey,
  packagingStepKeyToSlot,
  parseSecondaryFaceIntent,
  resolvedPackagingFacesReady,
  syncResolvedPackagingFaces,
  type HubPackagingFaceSlotEntry,
} from '@/lib/packaging/hub-face-steps'
import { getStyleReferenceSlotForGenerate, isSecondaryBoxFaceSlot, resolveBoxFaceUrl, resolveDielineFaceUrls, BOX_FACE_COPY_SOURCE, getBoxFaceSlotLabel } from '@/lib/packaging/box-face-slots'

export type HubStudioAction =
  | 'message'
  | 'approve_reference'
  | 'regenerate'
  | 'upload_images'
  | 'upload_logo_reference'
  | 'upload_generation_product'
  | 'set_generation_refs'
  | 'remove_generation_product'
  | 'start_preset'
  | 'remove_reference'
  | 'edit_step'
  | 'navigate_step'
  | 'crop_pending_image'
  | 'revert_pending_image'

export type HubStudioHandlerInput = {
  userId: string
  threadId: string
  locale: WebLocale
  message?: string
  action?: HubStudioAction
  presetId?: string
  referenceScreenKey?: string
  generationRefKeys?: string[]
  productUrl?: string
  editMessageId?: string
  editStepKey?: string
  navigateStepKey?: string
  cropSizeMm?: { width: number; height: number }
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
  }[]
  userMessageId?: string
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
  processSteps: HubStudioProcessStep[]
): { reply: string; studio: HubStudioMessagePayload } {
  let reply = buildBoxFaceConfirmSummary(locale, dimensionsMm)
  const confirmAsk = getStepAskPrompt(locale, 'packaging_kit', 'box_face_confirm')
  if (confirmAsk && !reply.includes(confirmAsk)) reply = `${reply}\n\n${confirmAsk}`
  const studio = {
    processSteps,
    ...buildBoxFaceConfirmStudioPayload(locale, dimensionsMm, processSteps),
  }
  return { reply, studio }
}

function packagingBase(session: HubStudioSession): HubPackagingState {
  return session.packaging ?? { version: 2 as const, dimensionsMm: null, faces: {} }
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
      : 'Mỗi chiều của hộp phải từ 2 đến 50 cm.',
    en: kind === 'format'
      ? 'Invalid size format. Enter Length × Width × Height, for example: 20 × 15 × 10 cm.'
      : 'Each box dimension must be between 2 and 50 cm.',
    zh: kind === 'format'
      ? '尺寸格式不正确。请输入 长×宽×高，例如：20 × 15 × 10 cm。'
      : '盒子的每个尺寸必须在 2–50 cm 之间。',
    ja: kind === 'format'
      ? 'サイズ形式が正しくありません。長さ × 幅 × 高さ（例：20 × 15 × 10 cm）で入力してください。'
      : '各辺は2〜50 cmで入力してください。',
    ko: kind === 'format'
      ? '크기 형식이 올바르지 않습니다. 길이 × 너비 × 높이(예: 20 × 15 × 10 cm)로 입력하세요.'
      : '각 상자 치수는 2~50 cm여야 합니다.',
  } satisfies Record<WebLocale, string>
  return rows[locale]
}

function artifactCopy(locale: WebLocale, kind: 'pdf' | 'barcode') {
  const rows = {
    vi: kind === 'pdf'
      ? {
          download: 'Tải Dieline PDF',
          note: 'Cut đỏ liền, Crease xanh đứt, bleed 3 mm. Xưởng in cần preflight theo vật liệu thực tế.',
        }
      : {
          download: 'Tải mã vạch',
          note: 'Mã được tạo bằng thư viện barcode, có quiet zone và có thể quét; không phải hình minh họa AI.',
        },
    en: kind === 'pdf'
      ? {
          download: 'Download Dieline PDF',
          note: 'Solid red Cut, dashed green Crease and 3 mm bleed. Ask the printer to preflight for the actual stock.',
        }
      : {
          download: 'Download barcode',
          note: 'Generated with a barcode library, with a quiet zone and scannable output; not an AI illustration.',
        },
    zh: kind === 'pdf'
      ? { download: '下载 Dieline PDF', note: '红色实线为切割，绿色虚线为压痕，出血3毫米。请印厂按实际纸材预检。' }
      : { download: '下载条码', note: '使用条码库生成，保留静区且可扫描；不是AI示意图。' },
    ja: kind === 'pdf'
      ? { download: 'Dieline PDFをダウンロード', note: '赤実線はカット、緑破線は折り、塗り足し3mmです。実際の紙材で印刷会社のプリフライトが必要です。' }
      : { download: 'バーコードをダウンロード', note: 'バーコードライブラリで生成し、クワイエットゾーンを確保した読み取り可能なデータです。AI画像ではありません。' },
    ko: kind === 'pdf'
      ? { download: 'Dieline PDF 다운로드', note: '빨간 실선은 절단, 초록 점선은 접힘, 블리드는 3mm입니다. 실제 용지 기준 인쇄소 프리플라이트가 필요합니다.' }
      : { download: '바코드 다운로드', note: '바코드 라이브러리로 생성되어 여백이 확보되고 스캔할 수 있으며 AI 삽화가 아닙니다.' },
  } satisfies Record<WebLocale, { download: string; note: string }>
  return rows[locale]
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
  return gen === 'product_photo' || gen === 'portrait' || gen === 'interior' || gen === 'infographic'
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
    reply = t.studioNavigatedToStep.replace('{screen}', screenLabel)
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
    session.packaging?.dimensionsMm ?? null
  )
}

function applyMatchedPreset(session: HubStudioSession): HubStudioSession {
  /** Preset selection is AI-only — see applySuggestedPreset after callStudioBrain. */
  return session
}

function presetCatalogForBrain(locale: WebLocale): string {
  return buildPresetCatalogForBrain(locale)
}

function appendBriefToPrompt(session: HubStudioSession, prompt: string): string {
  const notes = Object.entries(session.briefNotes)
  if (!notes.length) return prompt
  const block = notes.map(([k, v]) => `- ${k}: ${v}`).join('\n')
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
  options?: { skipSameTurnDesignEntry?: boolean }
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
    briefNotes: session.briefNotes,
    designSteps,
    referenceImages: session.referenceImages.map((r) => ({ label: r.screenLabel, key: r.screenKey })),
    referenceImagesCount: session.referenceImages.length,
    uploadImagesCount: session.uploadImages.length,
    needsUpload: preset?.needsUpload && !session.uploadImages.length,
    pendingPreview: session.pendingPreview?.screenLabel ?? null,
    pendingPreviewStepKey: session.pendingPreview?.screenKey ?? null,
  })

  const { catalogJson } = buildToolCatalogForBrain(locale)

  const sys = `You are NanoAI Hub — one unified assistant. Classify EVERY user message with hubRoute, then respond appropriately. Server does NOT use keyword/regex routing — YOU decide.

Reply in ${lang}.

Inline design presets (hubRoute "design" — pick suggestedPresetId from ids):
${presetCatalogForBrain(locale)}

Standalone platform tools (hubRoute "workflow" / "pipeline" / attach to "consultation"):
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
  "generationPrompt": "detailed English prompt ONLY when generating a design step",
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
- "workflow": user needs ONE standalone tool page (try-on, sharpen, curriculum, single banner tool…). Fill workflows 1-3 items from catalog; hubRoute workflow.
- "pipeline": user needs MULTI-STEP plan across 2-6 different tools in order (e.g. banner → sharpen → upload). Fill plan.steps 2-6 ordered; hubRoute pipeline.
- When session presetId is set and user continues the inline project: hubRoute MUST stay "design" unless they explicitly ask only for tool advice (then consultation + keep reply short).
- When session presetId is null and message fits inline preset: hubRoute "design" + suggestedPresetId.
- Tư vấn / consultation is a valid intent — use hubRoute "consultation", not a separate UI mode.

PRESET / PROJECT INTENT (hubRoute "design"):
- When session presetId is null: infer what the user wants to create from ANY natural wording (all languages, typos, short replies).
- Set suggestedPresetId to exactly one id from the preset library when intent is clear.
- intent "plan_process" or "ask_requirements": user wants to start a multi-step inline design flow — set suggestedPresetId, explain briefly in reply, do NOT generate images yet.
- intent "clarify": user wants design help but preset is ambiguous — suggestedPresetId empty, ask which type (offer 2–3 preset titles).
- intent "chat": unrelated to starting a design flow — suggestedPresetId empty.
- When presetId is already set: suggestedPresetId must be empty string (do not switch preset mid-flow unless user explicitly asks to change project type — then clarify first).
- Examples: "thiết kế app bán quần áo" → mobile_shop; "làm bao bì mỹ phẩm" → packaging_kit; "phòng khách japandi" → interior_design; "bộ post instagram" → social_media_kit; "truyện tranh cho bé" → story_with_images; "tóm tắt sách thành slide" → infographic_series; "campaign lookbook hè" → fashion_campaign; "ảnh thẻ linkedin" → profile_photo_pack.

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
- DISCOVERY ORDER: follow processSteps strictly in order — never skip a brief step (e.g. packaging_kit: brand_name → product_type → box_size → box_face_confirm → style_mood → color_palette). Box dimensions: user picks length, width from Gemini L×W ratios, height freely (thin boxes OK); side faces use closest Gemini ratio for AI images. Print content is NOT collected in brief — it is entered when creating each box face (face_top, face_front, face_right, face_bottom, face_back, face_left) in that exact order. Ask ONLY the current step question; use the exact ask text from the preset when possible.
- NEVER set currentStepKey to a later discovery step before all earlier discovery steps are done.
- LOGO STEP — two paths: (A) User already has a logo file → they upload via UI; shouldGenerate false, do not generate. (B) User describes logo to create → intent generate_ui, shouldGenerate true IMMEDIATELY — do not ask "ready to see?" or wait for confirmation.
- If user says they already have a logo / will upload / has logo file: shouldGenerate false; remind them to use the logo upload button in chat.
- When user wants to create/regenerate ANY design step (any wording): set retryIntent + retryStepKey; shouldGenerate true if requirements are clear enough to generate.
- NEVER set retryStepKey to a step that is already approved/done (status done + in referenceImages) unless retryIntent is "regenerate".
- When user says they want the NEXT step (continue_next): retryIntent "continue_next", retryStepKey empty — stay on currentStepKey and ask for that step OR shouldGenerate for currentStepKey only if they described it.
- If pendingPreview exists for current step, user must approve it before moving on — do not shouldGenerate for the same step again.
- When user describes any design step with clear requirements: shouldGenerate true, fill generationPrompt from user description.
- PACKAGING FACE steps (face_top → … → face_left): generate ONE flat 2D print artwork per face — like a pre-press file before folding (NOT a 3D box, NOT dieline/net with fold lines). User text IS the design brief when they describe printable content — intent generate_ui, shouldGenerate true, generationPrompt in English. ANY face may be left blank (shouldGenerate false). Secondary faces may copy primary without generating. Dieline PDF and 3D mockup are LATER separate steps.
- product_label / seal_sticker: flat peel-and-stick LABEL or tamper seal artwork (NOT box dieline). User must give size (WxH mm) and text content. Reference attachment is LOGO ONLY — never box face images.
- barcode_label: real scannable barcode (Code128 default) — encode product code/SKU; label header shows brand name + product name from brief. User may specify EAN-13/UPC/QR explicitly.
- box_mockup_3d: photorealistic 3D box with approved face art mapped to faces ONLY. Scene background must contrast (neutral studio/wood/marble) — NEVER tile or extend box print texture/pattern onto the environment.
- Do NOT generate images/music until discoveryComplete is true AND current step is a design step AND user gave enough detail for THAT design step.
- LOGO-FIRST RULE: If preset has a logo step, complete logo BEFORE any ui_mockup/ui_desktop screens. Never skip logo.
- After logo is approved as reference, ALL later UI screens must use logo reference in generationPrompt (logo in header/nav, brand colors).
- When referenceImagesCount > 0, generationPrompt must match attached references; logo reference must be embedded on UI screens.
- After user approved a screen and describes the NEXT screen (currentStepKey), treat as design input: if description is clear enough, intent generate_ui, shouldGenerate true.
- Do NOT generate until user describes the current design step (except when regenerating).
- Include collected briefNotes in generationPrompt context when generating.
- For banner steps: respect platform aspect ratio in generationPrompt (Google 1.91:1, Facebook 1:1, Story 9:16).
- For lyria_music: generationPrompt = mood, tempo, instruments; instrumental only.
- For hubRoute workflow/pipeline: href MUST match catalog exactly; prefillPrompt in ${lang}.
- NEVER tell user to open another page for INLINE design steps — inline design stays in chat.
- generationPrompt must be in English.`

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
  const generator = session.presetId
    ? getStepGenerator(session.presetId, screenKey)
    : ('ui_mockup' as StudioGeneratorKind)
  if (!generator) {
    const t = getDictionary(locale).hubChat
    return {
      session,
      studio: { processSteps: session.processSteps },
      chargedImage: 0,
      error: t.studioDiscoveryBlocked,
    }
  }

  const t = getDictionary(locale).hubChat
  if (
    session.presetId &&
    isStepAfterPrimaryLogo(session.presetId, screenKey) &&
    !primaryLogoApproved(session.processSteps, session.presetId)
  ) {
    return {
      session,
      studio: { processSteps: session.processSteps },
      chargedImage: 0,
      error: t.studioLogoFirst,
    }
  }
  if (
    session.presetId &&
    isStepAfterPrimaryLogo(session.presetId, screenKey) &&
    !hasPrimaryLogoReference(session.referenceImages, session.presetId)
  ) {
    return {
      session,
      studio: { processSteps: session.processSteps },
      chargedImage: 0,
      error: t.studioNeedLogoReference,
    }
  }

  if (generator === 'dieline_pdf') {
    const dimensionsMm = session.packaging?.dimensionsMm
    if (!dimensionsMm || !resolvedPackagingFacesReady(session.packaging)) {
      return {
        session,
        studio: { processSteps: session.processSteps },
        chargedImage: 0,
        error: 'Cần hoàn thành 6 bước mặt và có ít nhất một mặt in cho mỗi nhóm L×W, L×H, W×H trước khi xuất Dieline (không bắt buộc tạo ảnh cả 6 mặt).',
      }
    }
    const created = faceSlotsToCreatedFaces(session.packaging!.faceSlots ?? {})
    const resolved = resolveDielineFaceUrls(created)
    try {
      const exported = await exportBoxDielineFromUrls({
        userId,
        faces: { LxW: resolved.LxW!, LxH: resolved.LxH!, WxH: resolved.WxH! },
        dimensionsMm,
      })
      const completedSteps = markStepDone(session.processSteps, screenKey)
      const next = nextPendingStep(completedSteps)
      const nextSession: HubStudioSession = {
        ...session,
        processSteps: setStepInProgress(completedSteps, next?.key ?? null),
        currentStepKey: next?.key ?? null,
        packaging: {
          ...session.packaging!,
          dielineUrl: exported.pdfUrl,
        },
      }
      const copy = artifactCopy(locale, 'pdf')
      return {
        session: nextSession,
        studio: {
          processSteps: nextSession.processSteps,
          artifactUrl: exported.pdfUrl,
          artifactKind: 'pdf',
          artifactFileName: exported.fileName,
          artifactLabel: screenLabel,
          artifactNote: copy.note,
          artifactDownloadLabel: copy.download,
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
  const { referenceUrls: pickedRefs, productUrls: pickedProducts } =
    generator === 'packaging_mockup'
      ? { referenceUrls: [] as string[], productUrls: [] as string[] }
      : resolveGenerationAttachments(session, session.presetId, generator, screenKey)
  let refUrls = pickedRefs.length
    ? pickedRefs
    : pickedReferenceUrls(session.referenceImages, session.presetId, screenKey)
  let productUrls = [
    ...pickedProducts,
    ...(generatorUsesUpload(generator) ? session.uploadImages : []),
  ]
  let fullPrompt = appendReferenceContext(
    session,
    appendBriefToPrompt(session, generationPrompt),
    session.presetId,
    { generator, attachedRefUrls: refUrls }
  )
  let aspectRatio = session.presetId ? getStepAspectRatio(session.presetId, screenKey) : undefined

  if (generator === 'packaging_face') {
    const faceKey = packagingFaceKeyFromStep(screenKey)
    const faceSlot = packagingStepKeyToSlot(screenKey)
    const box = session.packaging?.dimensionsMm
    if (!faceKey || !box) {
      return {
        session,
        studio: { processSteps: session.processSteps },
        chargedImage: 0,
        error: boxSizeError(locale, 'format'),
      }
    }
    const [faceWidth, faceHeight] = getFaceDimensionsMm(faceKey, box)
    aspectRatio =
      session.packaging?.faceAspectRatios?.[faceKey] ??
      getFaceGeminiAspectRatio(faceWidth, faceHeight)
    fullPrompt += `\n\nTECHNICAL FACE: ${faceKey}${faceSlot ? ` (${faceSlot.toUpperCase()})` : ''}, exact size ${faceWidth} × ${faceHeight} mm, Gemini aspect ${aspectRatio}.\n${PACKAGING_FACE_FLAT_ARTWORK_RULES}`
    if (productUrls.length) {
      fullPrompt +=
        '\nCOMPOSITE attached PRODUCT photo(s) onto this packaging face — print/display the real product prominently on the surface as hero visual, integrated naturally into the artwork.'
    }
  }

  if (generator === 'packaging_mockup') {
    const box = session.packaging?.dimensionsMm
    if (!box || !resolvedPackagingFacesReady(session.packaging)) {
      return {
        session,
        studio: { processSteps: session.processSteps },
        chargedImage: 0,
        error: 'Cần hoàn thành đủ 6 mặt hộp trước khi tạo mockup 3D.',
      }
    }
    const created = faceSlotsToCreatedFaces(session.packaging!.faceSlots ?? {})
    const resolved = resolveDielineFaceUrls(created)
    const logo = session.referenceImages.find((r) => r.screenKey === 'logo')?.url
    refUrls = [...(logo ? [logo] : []), resolved.LxW!, resolved.LxH!, resolved.WxH!]
    fullPrompt += `\n\nEXACT BOX: ${box.length} × ${box.width} × ${box.height} mm (L×W×H).
${PACKAGING_MOCKUP_SCENE_RULES}
${PACKAGING_MOCKUP_FACE_RULES}`
  }

  if (isLogoOnlyReferenceStepKey(screenKey)) {
    const logoKey = session.presetId ? getPrimaryLogoStepKey(session.presetId) : 'logo'
    const logoUrl = session.referenceImages.find((r) => r.screenKey === logoKey)?.url
    refUrls = logoUrl ? [logoUrl] : []
    productUrls = []
    const parsedSize =
      parseLabelSizeMm(generationPrompt) ??
      (screenKey === 'seal_sticker'
        ? session.packaging?.sealStickerSizeMm
        : session.packaging?.productLabelSizeMm) ??
      null
    if (parsedSize) {
      aspectRatio = labelAspectRatioFromSize(parsedSize)
    } else if (screenKey === 'seal_sticker') {
      aspectRatio = '1:1'
    }
    fullPrompt += `\n\n${buildProductLabelPromptBlock(parsedSize, screenKey)}`
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
    if (preset?.needsUpload) {
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

  const gen = await runStudioImagePipeline({
    userId,
    kind: generator,
    screenLabel,
    screenKey,
    brief: fullPrompt,
    projectTitle: session.projectTitle,
    referenceImageUrls: refUrls,
    productImageUrls: productUrls.length ? productUrls : undefined,
    aspectRatio,
  })
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
  const useReference = generatorSupportsReference(generator)
  const pendingStudio =
    session.presetId && generator === 'packaging_face'
      ? buildPendingStepStudio(nextSession, screenKey, session.presetId)
      : null
  return {
    session: nextSession,
    studio: {
      imageUrl: gen.resultUrl,
      screenKey,
      screenLabel,
      previewKind,
      aspectHint,
      processSteps: nextSession.processSteps,
      showRegenerate: true,
      showApproveReference: useReference,
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
  }
): string {
  const attachedUrls = options?.attachedRefUrls?.length
    ? options.attachedRefUrls
    : pickedReferenceUrls(session.referenceImages, presetId, session.currentStepKey)
  const refs = session.referenceImages.filter((r) => attachedUrls.includes(r.url))
  if (!refs.length) return prompt

  const logoKey = presetId ? getPrimaryLogoStepKey(presetId) : null
  const logoRef = logoKey ? refs.find((r) => r.screenKey === logoKey) : null
  const refList = refs.map((r) => `- ${r.screenLabel} (${r.screenKey})`).join('\n')
  const gen = options?.generator

  if (isPackagingCompositeGenerator(gen)) {
    if (isLogoOnlyReferenceStepKey(session.currentStepKey)) {
      const logoLine = logoRef
        ? `Attach and composite ONLY the approved LOGO (${logoRef.screenLabel}) onto this label artwork.`
        : 'No logo attached — use typography only per user brief.'
      return `${prompt}\n\n${logoLine}\nDo NOT use box face artwork, dieline panels, or 3D box photos as reference.`
    }
    let block = `COMPOSITE onto packaging — print/place these attached images directly on the packaging artwork (not style-only reference):\n${refList}`
    if (logoRef) {
      block += `\nPlace the approved LOGO (${logoRef.screenLabel}) prominently on this packaging surface.`
    }
    if (gen === 'packaging_face') {
      block +=
        '\nIncorporate logos, product visuals and brand marks from attachments into the flat print-face layout as if printed on real packaging.'
    } else if (gen === 'packaging_mockup') {
      block += `\nWrap each approved face artwork onto the correct 3D box face without redesigning or distorting.
${PACKAGING_MOCKUP_SCENE_RULES}`
    } else {
      block += '\nIntegrate attached artwork elements into the print-ready packaging design.'
    }
    return `${prompt}\n\n${block}`
  }

  let block = `Use these approved reference images (attached to model):\n${refList}`
  if (logoRef) {
    block += `\nIMPORTANT: Place the approved LOGO (${logoRef.screenLabel}) in the app header / brand area. Match logo colors and typography across the whole UI.`
  } else {
    block += '\nMatch visual style, colors and typography across all references.'
  }
  return `${prompt}\n\n${block}`
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

  if (session.referenceImages.length > 0) {
    reply += `\n\n${referenceUsageReply(locale, session.referenceImages.length, STUDIO_REFERENCE_ATTACH_LIMIT)}`
  }

  const preset = getStudioPreset(session.presetId)
  if (preset?.needsUpload && !session.uploadImages.length) {
    reply += `\n\n${t.studioNeedUpload}`
  } else {
    reply = appendStepAsk(reply, locale, session.presetId, nextKey)
  }

  const studio: HubStudioMessagePayload = {
    processSteps: session.processSteps,
    awaitingRequirements: true,
    ...buildReferencePreviewsPayload(session),
    needsUpload: preset?.needsUpload && !session.uploadImages.length ? true : undefined,
  }
  return { reply, studio }
}

async function finishApprove(
  session: HubStudioSession,
  locale: WebLocale,
  threadId: string
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
  const generator = getStepGenerator(session.presetId, pending.screenKey)
  const isAudio = generator === 'lyria_music'
  const keepAsReference = !isAudio && generator !== 'barcode'

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
        ...nextSession.referenceImages.filter((r) => r.screenKey !== pending.screenKey),
        {
          screenKey: pending.screenKey,
          screenLabel: pending.screenLabel,
          url: pending.url,
          approvedAt: Date.now(),
        },
      ],
    }
  }

  if (session.presetId === 'packaging_kit' && !isRestoringReference) {
    const slot = packagingStepKeyToSlot(pending.screenKey)
    const faceKey = packagingFaceKeyFromStep(pending.screenKey)
    const packaging = nextSession.packaging ?? {
      version: 2 as const,
      dimensionsMm: null,
      faces: {},
    }
    if (slot) {
      nextSession.packaging = syncResolvedPackagingFaces({
        ...packaging,
        faceSlots: {
          ...(packaging.faceSlots ?? {}),
          [slot]: { sourceMode: 'generate', url: pending.url },
        },
        dielineUrl: undefined,
        mockupUrl: undefined,
      })
    } else if (faceKey) {
      nextSession.packaging = syncResolvedPackagingFaces({
        ...packaging,
        faceSlots: {
          ...(packaging.faceSlots ?? {}),
          ...(faceKey === 'LxW' ? { top: { sourceMode: 'generate' as const, url: pending.url } } : {}),
          ...(faceKey === 'LxH' ? { front: { sourceMode: 'generate' as const, url: pending.url } } : {}),
          ...(faceKey === 'WxH' ? { right: { sourceMode: 'generate' as const, url: pending.url } } : {}),
        },
        dielineUrl: undefined,
        mockupUrl: undefined,
      })
    } else if (pending.screenKey === 'box_mockup_3d') {
      nextSession.packaging = { ...packaging, mockupUrl: pending.url }
    } else if (pending.screenKey === 'barcode_label') {
      nextSession.packaging = { ...packaging, barcodeUrl: pending.url }
    }
  }

  let next: HubStudioProcessStep | null = null
  const navigatedBackStay =
    session.presetId &&
    isNavigatedBackEdit(session, session.presetId) &&
    pending.screenKey === previousCurrentStepKey
  if (isRestoringReference && previousCurrentStepKey) {
    nextSession.currentStepKey = previousCurrentStepKey
    nextSession.processSteps = setStepInProgress(nextSession.processSteps, previousCurrentStepKey)
    next = nextSession.processSteps.find((s) => s.key === previousCurrentStepKey) ?? null
  } else if (navigatedBackStay) {
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
    navigatedBackStay && !isRestoringReference
      ? t.studioStepSavedStay.replace('{screen}', pending.screenLabel)
      : next
        ? t.studioApprovedNext.replace('{screen}', pending.screenLabel).replace('{next}', nextLabel)
        : t.studioAllDone

  const studio: HubStudioMessagePayload = {
    processSteps: nextSession.processSteps,
    screenLabel: pending.screenLabel,
    ...(isAudio ? { audioUrl: pending.url } : { imageUrl: pending.url }),
  }
  return { session: nextSession, reply, studio }
}

export async function handleHubStudio(input: HubStudioHandlerInput): Promise<HubStudioHandlerResult> {
  const action: HubStudioAction = input.action ?? 'message'
  let session = (await pgGetHubThreadSession(input.threadId)) ?? emptyStudioSession()
  session = applyPackagingSessionLabels(session, input.locale)
  let reply = ''
  let studio: HubStudioMessagePayload | undefined
  let chargedChat = 0
  let chargedImage = 0
  const t = getDictionary(input.locale).hubChat

  if (action === 'start_preset') {
    const presetId = String(input.presetId ?? '').trim()
    const preset = getStudioPreset(presetId)
    if (!preset) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    const steps = buildStepsFromPreset(input.locale, presetId)
    session = {
      ...emptyStudioSession(),
      presetId,
      projectTitle: presetTitle(input.locale, presetId),
      processSteps: steps,
      currentStepKey: steps[0]?.key ?? null,
      discoveryComplete: false,
      briefNotes: {},
      uploadImages: [],
      packaging: presetId === 'packaging_kit'
        ? { version: 2, dimensionsMm: null, faces: {} }
        : undefined,
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

  if (action === 'upload_images') {
    const files = input.uploadFiles ?? []
    if (!files.length) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNeedUpload }
    }
    const urls = await uploadStudioImages(input.userId, files)
    session = { ...session, uploadImages: [...session.uploadImages, ...urls] }
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioImagesUploaded.replace('{n}', String(urls.length))
    studio = { processSteps: session.processSteps, needsUpload: false }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
    return { ok: true, reply, studio, session, threadId: input.threadId, chargedChat: 0 }
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

  if (action === 'upload_generation_product') {
    const files = input.uploadFiles ?? []
    if (!files.length || !session.presetId) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNeedUpload }
    }
    const presetId = session.presetId
    const urls = await uploadStudioImages(input.userId, files)
    session = appendGenerationProductUrls(session, presetId, urls)
    await pgSaveHubThreadSession(input.threadId, session)
    const stepKey = session.currentStepKey ?? ''
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
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.errorGeneric }
    }
    if (session.currentStepKey !== logoKey) {
      const blockingStep = findBlockingIncompleteStep(session, session.presetId)
      if (blockingStep !== logoKey) {
        return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioLogoUploadWrongStep }
      }
    }
    if (hasPrimaryLogoReference(session.referenceImages, session.presetId)) {
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
    session = {
      ...session,
      processSteps: markStepDone(session.processSteps, logoKey),
      pendingPreview: null,
      lastGenerationPrompt: null,
      referenceImages: [
        ...session.referenceImages,
        {
          screenKey: logoKey,
          screenLabel: logoLabel,
          url,
          approvedAt: Date.now(),
        },
      ],
    }
    const next = nextPendingStep(session.processSteps)
    session.currentStepKey = next?.key ?? null
    session.processSteps = setStepInProgress(session.processSteps, session.currentStepKey)
    await pgSaveHubThreadSession(input.threadId, session)
    const asked = buildAskForNextStep(session, input.locale, logoLabel, logoKey)
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

  if (action === 'approve_reference') {
    const pending = session.pendingPreview
    if (!pending) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNoPreview }
    }
    const pendingGenerator = session.presetId
      ? getStepGenerator(session.presetId, pending.screenKey)
      : null
    if (pendingGenerator !== 'barcode' && !canAddReferenceImage(session, pending.screenKey)) {
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
    const finished = await finishApprove(session, input.locale, input.threadId)
    session = finished.session
    const asked = buildAskForNextStep(session, input.locale, approvedLabel, approvedKey)
    reply = asked.reply
    studio = asked.studio

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
    const restorePrompt =
      session.briefNotes[removed.screenKey]?.trim() || removed.screenLabel
    session = {
      ...session,
      currentStepKey: savedCurrentStepKey,
      pendingPreview: {
        screenKey: removed.screenKey,
        screenLabel: removed.screenLabel,
        url: removed.url,
        generationPrompt: restorePrompt,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioReferenceRemoved.replace('{screen}', removed.screenLabel)
    studio = {
      processSteps: session.processSteps,
      awaitingRequirements: true,
      ...buildReferencePreviewsPayload(session),
      ...(session.presetId
        ? buildPendingStepStudio(session, removed.screenKey, session.presetId)
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

  if (action === 'crop_pending_image') {
    const pending = session.pendingPreview
    const files = input.uploadFiles ?? []
    if (!pending || !files.length) {
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
    const editedSizeMm =
      input.cropSizeMm ??
      pending.editedSizeMm ??
      (session.packaging?.dimensionsMm
        ? (() => {
            const raw = getPackagingFaceSizeForStep(session.packaging!.dimensionsMm!, pending.screenKey)
            return raw ? { width: raw.widthMm, height: raw.heightMm } : undefined
          })()
        : undefined)
    session = {
      ...session,
      pendingPreview: {
        ...pending,
        originalUrl: pending.originalUrl ?? pending.url,
        url: newUrl,
        editedSizeMm: editedSizeMm ?? undefined,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    const label = stepLabel(session, pending.screenKey, input.locale)
    reply = t.studioCropApplied.replace('{screen}', label)
    if (editedSizeMm) {
      reply += `\n${t.studioCropSizeLine.replace('{size}', formatMmSize(input.locale, editedSizeMm.width, editedSizeMm.height))}`
    }
    studio =
      session.presetId != null
        ? buildPendingStepStudio(session, pending.screenKey, session.presetId)
        : { processSteps: session.processSteps, imageUrl: newUrl }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
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
    session = {
      ...session,
      pendingPreview: {
        ...pending,
        url: originalUrl,
        editedSizeMm: undefined,
      },
    }
    await pgSaveHubThreadSession(input.threadId, session)
    const label = stepLabel(session, pending.screenKey, input.locale)
    reply = t.studioEditReverted.replace('{screen}', label)
    studio =
      session.presetId != null
        ? buildPendingStepStudio(session, pending.screenKey, session.presetId)
        : { processSteps: session.processSteps, imageUrl: originalUrl }
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
    })
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
    reply = t.studioNavigatedToStep.replace('{screen}', label)
    if (session.presetId) {
      reply = appendStepAsk(reply, input.locale, session.presetId, stepKey)
    }
    const onDiscovery = isDiscoveryStep(session.presetId, stepKey)
    studio = {
      processSteps: session.processSteps,
      awaitingRequirements: !onDiscovery,
      ...buildReferencePreviewsPayload(session),
      ...(session.presetId && !onDiscovery
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
    const pending = session.pendingPreview
    const prompt = pending?.generationPrompt ?? session.lastGenerationPrompt
    const screenKey = pending?.screenKey ?? session.currentStepKey
    if (!prompt || !screenKey) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNoPrompt }
    }
    const label = stepLabel(session, screenKey, input.locale)
    const genResult = await generateAsset(input.userId, session, prompt, screenKey, label, input.locale)
    if (genResult.error) {
      return { ok: false, reply: genResult.error, session, threadId: input.threadId, chargedChat: 0, error: genResult.error }
    }
    session = genResult.session
    studio = genResult.studio
    chargedImage = genResult.chargedImage
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioRegenerated.replace('{screen}', label)
    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
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

  const chatCharge = await deductUserCredits(input.userId, HUB_CHAT_CREDIT)
  if (!chatCharge.ok) {
    return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: chatCharge.error }
  }
  chargedChat = HUB_CHAT_CREDIT

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

    if (input.generationRefKeys?.length && session.presetId) {
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
      session.briefNotes = { ...session.briefNotes, [session.currentStepKey]: message }
    }

    if (
      session.presetId === 'packaging_kit' &&
      session.currentStepKey === 'product_label' &&
      message
    ) {
      const labelSize = parseLabelSizeMm(message)
      if (labelSize) {
        session.packaging = {
          ...packagingBase(session),
          productLabelSizeMm: labelSize,
        }
      }
    }

    if (
      session.presetId === 'packaging_kit' &&
      session.currentStepKey === 'seal_sticker' &&
      message
    ) {
      const sealSize = parseLabelSizeMm(message)
      if (sealSize) {
        session.packaging = {
          ...packagingBase(session),
          sealStickerSizeMm: sealSize,
        }
      }
    }

    session = syncDiscoveryCurrentStep(session)

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
        session = applyPackagingSessionLabels(session, input.locale)
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
        session.packaging = {
          ...(session.packaging ?? { version: 2 as const, faces: {} }),
          version: 2,
          dimensionsMm: reparse.dimensionsMm,
          facesConfirmed: false,
          faceAspectRatios: undefined,
        }
        session = applyPackagingSessionLabels(session, input.locale)
        reply = buildBoxFaceConfirmSummary(input.locale, reparse.dimensionsMm)
        const confirmStudio = buildBoxFaceConfirmStudioPayload(
          input.locale,
          reparse.dimensionsMm,
          session.processSteps
        )
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
      forceCompleteBoxFaceConfirm = true
    }

    const ai = await callStudioBrain(input.apiKey, input.userId, input.locale, message, session)

    const hubRoute: HubRouteKind = ai.hubRoute ?? 'design'
    const activeDesign = Boolean(session.presetId && session.processSteps.length)

    if (!activeDesign && hubRoute !== 'design' && !ai.suggestedPresetId) {
      const advisory = await buildAdvisoryPayload({
        locale: input.locale,
        userId: input.userId,
        threadId: input.threadId,
        message,
        hubRoute,
        workflowsRaw: ai.workflows,
        planRaw: ai.plan,
      })
      reply = sanitizeAssistantReply(ai.reply || '...')
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
      }
    }

    const hadPreset = Boolean(session.presetId)
    if (!session.presetId && ai.suggestedPresetId && isValidStudioPresetId(ai.suggestedPresetId)) {
      session = applySuggestedPreset(session, input.locale, ai.suggestedPresetId)
      reply = appendPresetKickoffIfNeeded(ai.reply || '...', input.locale, ai.suggestedPresetId, true)
      reply = appendFirstStepAsk(reply, input.locale, ai.suggestedPresetId, session.currentStepKey)
    }

    if (ai.projectTitle) session.projectTitle = ai.projectTitle

    const discoveryBriefEdit =
      session.presetId && message.trim()
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
          session.packaging = {
            ...(session.packaging ?? { version: 2 as const, faces: {} }),
            version: 2,
            dimensionsMm: parsed.dimensionsMm,
            dimensionDraft: undefined,
            facesConfirmed: false,
            faceAspectRatios: undefined,
          }
          session = applyPackagingSessionLabels(session, input.locale)
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
    if (!discoveryBriefEdit && session.currentStepKey && message) {
      if (onDiscoveryForBrief) {
        const answer =
          ai.briefUpdates?.[session.currentStepKey]?.trim() ||
          Object.values(ai.briefUpdates ?? {})[0]?.trim() ||
          message
        session.briefNotes = {
          ...session.briefNotes,
          [session.currentStepKey]: answer,
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

    const aiRetry: HubStudioAiRetryHint = sanitizeAiRetryHint(session, {
      retryIntent: ai.retryIntent ?? 'none',
      retryStepKey: ai.retryStepKey,
    })
    const aiWantsRetry = aiRetry.retryIntent !== 'none' && aiRetry.retryIntent !== 'continue_next'

    /** Cùng một tin nhắn vừa chốt brief (vd. bảng màu) — không được dùng để auto-tạo bước design kế tiếp (vd. logo). */
    let justEnteredDesignStep = false

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
          if (logoKey && session.currentStepKey === logoKey) {
            reply = `${reply}\n\n${t.studioStartWithLogo}`
            reply = appendStepAsk(reply, input.locale, presetId, logoKey)
          }
        } else if (session.presetId && session.currentStepKey && isDiscoveryStep(session.presetId, session.currentStepKey)) {
          reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
        }
      } else {
        reply = reply || sanitizeAssistantReply(ai.reply || '...')
      }
    } else if (ai.currentStepKey && !aiWantsRetry && session.discoveryComplete) {
      session.currentStepKey = ai.currentStepKey
      session.processSteps = setStepInProgress(session.processSteps, ai.currentStepKey)
      reply = hadPreset || session.presetId ? sanitizeAssistantReply(ai.reply || '...') : reply || sanitizeAssistantReply(ai.reply || '...')
    } else {
      reply = reply || sanitizeAssistantReply(ai.reply || '...')
    }

    session = syncDiscoveryCurrentStep(session)

    let explicitRetryStep: string | null = null
    if (session.presetId && session.discoveryComplete) {
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
          session = invalidatePackagingFromStep(session, explicitRetryStep)
        }
        if (isExplicitRetryIntent(message, aiRetry)) {
          reply = sanitizeAssistantReply(reply)
        }
      }
    }

    let packagingFaceCompletedWithoutImage = false
    if (
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
            session.presetId != null && isNavigatedBackEdit(session, session.presetId)
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
              session.presetId != null && isNavigatedBackEdit(session, session.presetId)
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

    const forceGenerate = Boolean(
      session.currentStepKey &&
        shouldForceGenerateDesign(
          session,
          session.presetId,
          session.currentStepKey,
          message,
          onDiscovery,
          explicitRetryStep,
          aiRetry,
          { skipSameTurnDesignEntry: justEnteredDesignStep }
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
      isStepAfterPrimaryLogo(session.presetId, session.currentStepKey) &&
      !isLogoDesignStep(session.presetId, session.currentStepKey) &&
      !primaryLogoApproved(session.processSteps, session.presetId)
    ) {
      reply = `${reply}\n\n${t.studioLogoFirst}`
      studio = { processSteps: session.processSteps }
    } else if (
      session.presetId &&
      session.currentStepKey &&
      isStepAfterPrimaryLogo(session.presetId, session.currentStepKey) &&
      !isLogoDesignStep(session.presetId, session.currentStepKey) &&
      !hasPrimaryLogoReference(session.referenceImages, session.presetId) &&
      !isExplicitRetryIntent(message, aiRetry)
    ) {
      reply = `${sanitizeAssistantReply(reply)}\n\n${t.studioNeedLogoReference}`
      studio = { processSteps: session.processSteps }
    } else if (
      canGenerate &&
      session.currentStepKey &&
      session.presetId &&
      !justEnteredDesignStep &&
      !packagingFaceCompletedWithoutImage &&
      (forceGenerate || (ai.intent === 'generate_ui' && ai.shouldGenerate))
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
          reply = t.studioGeneratedStep.replace('{screen}', label)
          if (session.currentStepKey && session.presetId) {
            reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
          }
        } else if (forceGenerate || (explicitRetryStep === session.currentStepKey && isExplicitRetryIntent(message, aiRetry))) {
          reply = t.studioGeneratedStep.replace('{screen}', label)
        }
      }
    } else if (
      wantsContinueNextStep(aiRetry) &&
      session.presetId &&
      session.currentStepKey &&
      !onDiscovery
    ) {
      reply = sanitizeAssistantReply(reply)
      const ask = getStepAskPrompt(input.locale, session.presetId, session.currentStepKey)
      if (ask && !reply.includes(ask)) {
        reply = appendStepAsk(reply, input.locale, session.presetId, session.currentStepKey)
      }
      if (session.referenceImages.length > 0 && !reply.includes(t.studioReferenceWillUse.replace('{n}', ''))) {
        reply += `\n\n${referenceUsageReply(input.locale, session.referenceImages.length, STUDIO_REFERENCE_ATTACH_LIMIT)}`
      }
      studio = {
        processSteps: session.processSteps,
        awaitingRequirements: true,
        ...buildReferencePreviewsPayload(session),
        ...(session.presetId && session.currentStepKey
          ? buildGenerationRefPickerPayload(session, session.presetId, session.currentStepKey)
          : {}),
        needsUpload: needsUpload || undefined,
      }
    } else {
      if (onDiscovery && session.presetId && session.currentStepKey) {
        const ask = getStepAskPrompt(input.locale, session.presetId, session.currentStepKey)
        if (ask && !reply.includes(ask)) reply = `${reply}\n\n${ask}`
      }
      studio = {
        processSteps: session.processSteps,
        ...packagingBoxConfirmStudioExtras(input.locale, session),
        ...(session.presetId &&
        session.currentStepKey &&
        !onDiscovery &&
        !session.pendingPreview?.screenKey
          ? buildGenerationRefPickerPayload(session, session.presetId, session.currentStepKey)
          : {}),
        needsUpload: needsUpload || undefined,
      }
    }

    session = syncDiscoveryCurrentStep(session)
    reply = appendCurrentDiscoveryAsk(reply, input.locale, session)

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

    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
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
