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
} from '@/lib/hub-chat/hub-studio-types'
import {
  allDiscoveryDone,
  buildStepsFromPreset,
  getFlowSteps,
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
  STUDIO_PRESETS,
} from '@/lib/hub-chat/hub-studio-presets'
import {
  applySuggestedPreset,
  appendFirstStepAsk,
  appendPresetKickoffIfNeeded,
  buildPresetCatalogForBrain,
  isValidStudioPresetId,
} from '@/lib/hub-chat/hub-studio-preset-intent'
import {
  buildReferencePreviewsPayload,
  canAddReferenceImage,
  pickReferencesForGeneration,
  pickedReferenceUrls,
  STUDIO_MAX_REFERENCE_IMAGES,
  STUDIO_REFERENCE_ATTACH_LIMIT,
} from '@/lib/hub-chat/hub-studio-reference-limits'
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
  pgGetHubThreadSession,
  pgInsertHubChatMessage,
  pgSaveHubThreadSession,
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

export type HubStudioAction = 'message' | 'approve_reference' | 'regenerate' | 'upload_images' | 'start_preset' | 'remove_reference'

export type HubStudioHandlerInput = {
  userId: string
  threadId: string
  locale: WebLocale
  message?: string
  action?: HubStudioAction
  presetId?: string
  referenceScreenKey?: string
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
}

function langName(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function previewKindFromGenerator(gen: StudioGeneratorKind): HubStudioPreviewKind {
  if (gen === 'lyria_music') return 'audio'
  if (gen === 'banner') return 'banner'
  if (gen === 'logo') return 'logo'
  if (gen === 'product_photo') return 'product_photo'
  if (gen === 'invitation') return 'invitation'
  if (gen === 'packaging' || gen === 'interior' || gen === 'story_panel' || gen === 'infographic' || gen === 'portrait') {
    return 'banner'
  }
  if (gen === 'ui_desktop') return 'ui_mockup'
  return 'ui_mockup'
}

function generatorUsesUpload(gen: StudioGeneratorKind): boolean {
  return gen === 'product_photo' || gen === 'portrait' || gen === 'interior' || gen === 'infographic'
}

function generatorSupportsReference(gen: StudioGeneratorKind): boolean {
  return (
    gen === 'ui_mockup' ||
    gen === 'ui_desktop' ||
    gen === 'banner' ||
    gen === 'logo' ||
    gen === 'packaging' ||
    gen === 'interior' ||
    gen === 'story_panel' ||
    gen === 'infographic' ||
    gen === 'portrait' ||
    gen === 'product_photo'
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
  if (gen === 'packaging' || gen === 'portrait') return 'portrait'
  return 'portrait'
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

function mergeProcessSteps(
  incoming: { key: string; label: string }[] | undefined,
  existing: HubStudioProcessStep[]
): HubStudioProcessStep[] {
  if (!incoming?.length) return existing
  const doneKeys = new Set(existing.filter((s) => s.status === 'done').map((s) => s.key))
  return incoming.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: doneKeys.has(s.key) ? 'done' : i === 0 && !existing.length ? 'in_progress' : 'pending',
  }))
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

function stepLabel(steps: HubStudioProcessStep[], key: string | null): string {
  if (!key) return 'Screen'
  return steps.find((s) => s.key === key)?.label ?? key
}

function applyMatchedPreset(_session: HubStudioSession, _locale: WebLocale, _message: string): HubStudioSession {
  /** Preset selection is AI-only — see applySuggestedPreset after callStudioBrain. */
  return _session
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
  const label = stepLabel(session.processSteps, stepKey)
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
  aiHint?: HubStudioAiRetryHint
): boolean {
  if (!presetId || !stepKey) return false
  return shouldForceGenerateForStep(
    session,
    presetId,
    stepKey,
    message,
    onDiscovery,
    explicitRetryStep,
    aiHint
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
- On discovery steps ONLY: set completeCurrentStep true when user answered; NEVER set completeCurrentStep on design steps (logo, ui screens) — design steps advance only after user approves generated image.
- When user describes logo at logo step: intent generate_ui, shouldGenerate true IMMEDIATELY — do not ask "ready to see?" or wait for confirmation.
- When user wants to create/regenerate ANY design step (any wording): set retryIntent + retryStepKey; shouldGenerate true if requirements are clear enough to generate.
- NEVER set retryStepKey to a step that is already approved/done (status done + in referenceImages) unless retryIntent is "regenerate".
- When user says they want the NEXT step (continue_next): retryIntent "continue_next", retryStepKey empty — stay on currentStepKey and ask for that step OR shouldGenerate for currentStepKey only if they described it.
- If pendingPreview exists for current step, user must approve it before moving on — do not shouldGenerate for the same step again.
- When user describes any design step with clear requirements: shouldGenerate true, fill generationPrompt from user description.
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

  const previewKind = previewKindFromGenerator(generator)
  const aspectHint = aspectHintFromGenerator(generator, session.presetId, screenKey)
  const refUrls = pickedReferenceUrls(session.referenceImages, session.presetId)
  const productUrls = session.uploadImages
  const fullPrompt = appendReferenceContext(session, appendBriefToPrompt(session, generationPrompt), session.presetId)
  const aspectRatio =
    session.presetId ? getStepAspectRatio(session.presetId, screenKey) : undefined

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
    productImageUrls: generatorUsesUpload(generator) ? productUrls : undefined,
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

function appendReferenceContext(session: HubStudioSession, prompt: string, presetId: string | null): string {
  const pickedRefs = pickReferencesForGeneration(session.referenceImages, presetId)
  if (!pickedRefs.length) return prompt
  const logoKey = presetId ? getPrimaryLogoStepKey(presetId) : null
  const logoRef = logoKey ? pickedRefs.find((r) => r.screenKey === logoKey) : null
  const refs = pickedRefs.map((r) => `- ${r.screenLabel} (${r.screenKey})`).join('\n')
  let block = `Use these approved reference images (attached to model):\n${refs}`
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

  const nextLabel = stepLabel(session.processSteps, nextKey)
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
  const generator = getStepGenerator(session.presetId, pending.screenKey)
  const isAudio = generator === 'lyria_music'

  let nextSession: HubStudioSession = {
    ...session,
    processSteps: markStepDone(session.processSteps, pending.screenKey),
    pendingPreview: null,
    lastGenerationPrompt: null,
  }

  if (!isAudio) {
    nextSession = {
      ...nextSession,
      referenceImages: [
        ...nextSession.referenceImages,
        {
          screenKey: pending.screenKey,
          screenLabel: pending.screenLabel,
          url: pending.url,
          approvedAt: Date.now(),
        },
      ],
    }
  }

  const next = nextPendingStep(nextSession.processSteps)
  nextSession.currentStepKey = next?.key ?? null
  nextSession.processSteps = setStepInProgress(nextSession.processSteps, nextSession.currentStepKey)
  await pgSaveHubThreadSession(threadId, nextSession)

  const t = getDictionary(locale).hubChat
  const nextLabel = next?.label ?? ''
  const reply = next
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

  if (action === 'approve_reference') {
    const pending = session.pendingPreview
    if (!pending) {
      return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioNoPreview }
    }
    if (!canAddReferenceImage(session, pending.screenKey)) {
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
    session = {
      ...session,
      referenceImages: session.referenceImages.filter((r) => r.screenKey !== screenKey),
      processSteps: session.processSteps.map((s) =>
        s.key === screenKey ? { ...s, status: 'in_progress' as const } : s
      ),
    }
    await pgSaveHubThreadSession(input.threadId, session)
    reply = t.studioReferenceRemoved.replace('{screen}', removed.screenLabel)
    studio = {
      processSteps: session.processSteps,
      awaitingRequirements: true,
      ...buildReferencePreviewsPayload(session),
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
    const label = stepLabel(session.processSteps, screenKey)
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

  const message = String(input.message ?? '').trim()
  if (message.length < 2) {
    return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: t.studioMinChars }
  }

  const chatCharge = await deductUserCredits(input.userId, HUB_CHAT_CREDIT)
  if (!chatCharge.ok) {
    return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: chatCharge.error }
  }
  chargedChat = HUB_CHAT_CREDIT

  await pgInsertHubChatMessage({ threadId: input.threadId, role: 'user', content: message })

  try {
    session = applyMatchedPreset(session, input.locale, message)

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
    if (ai.briefUpdates && session.currentStepKey) {
      session.briefNotes = {
        ...session.briefNotes,
        ...ai.briefUpdates,
        [session.currentStepKey]: ai.briefUpdates[session.currentStepKey] ?? Object.values(ai.briefUpdates)[0] ?? message,
      }
    }

    let aiRetry: HubStudioAiRetryHint = sanitizeAiRetryHint(session, {
      retryIntent: ai.retryIntent ?? 'none',
      retryStepKey: ai.retryStepKey,
    })
    const aiWantsRetry = aiRetry.retryIntent !== 'none' && aiRetry.retryIntent !== 'continue_next'

    if (ai.completeCurrentStep && session.currentStepKey && session.presetId) {
      const onDiscoveryStep = isDiscoveryStep(session.presetId, session.currentStepKey)
      if (onDiscoveryStep) {
        session.processSteps = markStepDone(session.processSteps, session.currentStepKey)
        const justFinishedDiscovery = allDiscoveryDone(session.presetId, session.processSteps)
        if (justFinishedDiscovery) {
          session.discoveryComplete = true
        }
        const next = nextPendingStep(session.processSteps)
        session.currentStepKey = next?.key ?? null
        session.processSteps = setStepInProgress(session.processSteps, session.currentStepKey)
        reply = reply || sanitizeAssistantReply(ai.reply || '...')
        if (justFinishedDiscovery) {
          const logoKey = getPrimaryLogoStepKey(session.presetId)
          if (logoKey && session.currentStepKey === logoKey) {
            reply = `${reply}\n\n${t.studioStartWithLogo}`
            reply = appendStepAsk(reply, input.locale, session.presetId, logoKey)
          }
        }
      } else {
        reply = reply || sanitizeAssistantReply(ai.reply || '...')
      }
    } else if (ai.currentStepKey && !aiWantsRetry) {
      session.currentStepKey = ai.currentStepKey
      session.processSteps = setStepInProgress(session.processSteps, ai.currentStepKey)
      reply = hadPreset || session.presetId ? sanitizeAssistantReply(ai.reply || '...') : reply || sanitizeAssistantReply(ai.reply || '...')
    } else {
      reply = reply || sanitizeAssistantReply(ai.reply || '...')
    }

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
        session = applyStepRetryRepair(
          session,
          session.presetId,
          explicitRetryStep,
          message,
          input.locale,
          aiRetry
        )
        if (isExplicitRetryIntent(message, aiRetry)) {
          reply = sanitizeAssistantReply(reply)
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
          aiRetry
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
      const label = stepLabel(session.processSteps, session.currentStepKey)
      reply = t.studioApproveBeforeNext.replace('{screen}', label)
      studio = buildPendingStepStudio(session, session.currentStepKey!, session.presetId!)
    } else if (pendingStepReady) {
      const label = stepLabel(session.processSteps, session.currentStepKey)
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
      ((ai.intent === 'generate_ui' && ai.shouldGenerate && ai.generationPrompt) || forceGenerate)
    ) {
      const label = stepLabel(session.processSteps, session.currentStepKey)
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
        if (forceGenerate || (explicitRetryStep === session.currentStepKey && isExplicitRetryIntent(message, aiRetry))) {
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
        needsUpload: needsUpload || undefined,
      }
    } else {
      if (onDiscovery && session.presetId && session.currentStepKey) {
        const ask = getStepAskPrompt(input.locale, session.presetId, session.currentStepKey)
        if (ask && !reply.includes(ask)) reply = `${reply}\n\n${ask}`
      }
      studio = {
        processSteps: session.processSteps,
        needsUpload: needsUpload || undefined,
      }
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

    await pgInsertHubChatMessage({
      threadId: input.threadId,
      role: 'assistant',
      content: reply,
      studio,
      workflows: advisoryWorkflows.length ? advisoryWorkflows : null,
      planId: advisoryPlan?.id ?? null,
    })

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
    }
  } catch (e) {
    await refundUserCredits(input.userId, HUB_CHAT_CREDIT)
    const msg = e instanceof Error ? e.message : t.errorGeneric
    return { ok: false, reply: '', session, threadId: input.threadId, chargedChat: 0, error: msg }
  }
}
