import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserForCreditAction } from '@/lib/auth'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  buildHubToolCatalog,
  filterCatalogByGroup,
  HUB_CHAT_CREDIT,
  type HubChatMode,
  type HubWorkflowGroup,
} from '@/lib/hub-chat/hub-chat-catalog'
import {
  pgCreateHubMultiTaskPlan,
  pgEnsureHubChatThread,
  pgGetHubChatThread,
  pgInsertHubChatMessage,
  pgSaveHubThreadSession,
  type HubPlanStepInput,
} from '@/lib/db/hub-chat-pg'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

import { isValidHubStudioMessage } from '@/lib/hub-chat/hub-studio-message'
import { handleHubStudio, type HubStudioAction } from '@/lib/hub-chat/hub-studio-handler'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { reconcilePackagingProcessSteps } from '@/lib/packaging/face-print-style'
import { applyPackagingSessionLabels } from '@/lib/packaging/packaging-face-labels'

export const maxDuration = 300

const VALID_MODES = new Set<HubChatMode>(['chat', 'workflow', 'pipeline', 'studio'])
const VALID_GROUPS = new Set<HubWorkflowGroup>([
  'all',
  'try_on',
  'education',
  'image_edit',
  'design_creative',
  'three_d_special',
  'music_ai',
])

export type { HubChatWorkflowSuggestion, HubChatPlanPayload } from '@/lib/hub-chat/hub-advisory'

function cleanJsonResponse(raw: string): string {
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  }
  return t.trim()
}

function parseWorkflowSuggestions(raw: unknown, catalogHrefs: Set<string>): HubChatWorkflowSuggestion[] {
  if (!Array.isArray(raw)) return []
  const out: HubChatWorkflowSuggestion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const href = String(row.href ?? '').trim()
    if (!href || !catalogHrefs.has(href)) continue
    const confidence = Number(row.confidence)
    out.push({
      href,
      labelKey: String(row.labelKey ?? '').trim(),
      label: String(row.label ?? '').trim(),
      reason: String(row.reason ?? '').trim(),
      prefillPrompt: String(row.prefillPrompt ?? '').trim(),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    })
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 4)
}

function parsePlanSteps(raw: unknown, catalogHrefs: Set<string>): HubPlanStepInput[] {
  if (!raw || typeof raw !== 'object') return []
  const plan = raw as Record<string, unknown>
  const stepsRaw = plan.steps
  if (!Array.isArray(stepsRaw)) return []
  const out: HubPlanStepInput[] = []
  for (const item of stepsRaw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const href = String(row.href ?? '').trim()
    if (!href || !catalogHrefs.has(href)) continue
    out.push({
      href,
      labelKey: String(row.labelKey ?? '').trim(),
      label: String(row.label ?? '').trim(),
      prefillPrompt: String(row.prefillPrompt ?? '').trim(),
      reason: String(row.reason ?? '').trim(),
    })
  }
  return out.slice(0, 8)
}

function planToPayload(plan: Awaited<ReturnType<typeof pgCreateHubMultiTaskPlan>>): HubChatPlanPayload | null {
  if (!plan) return null
  return {
    id: plan.id,
    title: plan.title,
    steps: plan.steps.map((s) => ({
      stepIndex: s.stepIndex,
      href: s.href,
      labelKey: s.labelKey,
      label: s.label,
      prefillPrompt: s.prefillPrompt,
      reason: s.reason,
      status: s.status,
    })),
  }
}

export async function GET(request: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const threadId = request.nextUrl.searchParams.get('threadId')?.trim()
  if (!threadId) {
    return NextResponse.json({ error: 'Thiếu threadId.' }, { status: 400 })
  }

  const thread = await pgGetHubChatThread(auth.user.id, threadId)
  if (!thread) return NextResponse.json({ error: 'Không tìm thấy hội thoại.' }, { status: 404 })
  if (thread.session?.presetId === 'packaging_kit') {
    const locale = normalizeWebLocale(thread.locale) ?? 'vi'
    const migrated = applyPackagingSessionLabels(
      reconcilePackagingProcessSteps(thread.session, locale),
      locale
    )
    thread.session = migrated
    await pgSaveHubThreadSession(thread.id, migrated)
  }

  return NextResponse.json({ ok: true, thread })
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const auth = await getUserForCreditAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      const mode = String(fd.get('mode') ?? 'studio') as HubChatMode
      if (mode !== 'studio') {
        return NextResponse.json({ error: 'Multipart chỉ hỗ trợ mode studio.' }, { status: 400 })
      }
      const message = String(fd.get('message') ?? '').trim()
      const action = (String(fd.get('action') ?? 'upload_images') as HubStudioAction) || 'upload_images'
      const threadIdBody = String(fd.get('threadId') ?? '').trim() || undefined
      const localeBody = String(fd.get('locale') ?? '').trim() || undefined
      const cropWidthMm = Number(fd.get('cropWidthMm'))
      const cropHeightMm = Number(fd.get('cropHeightMm'))
      const cropSizeMm =
        Number.isFinite(cropWidthMm) &&
        Number.isFinite(cropHeightMm) &&
        cropWidthMm > 0 &&
        cropHeightMm > 0
          ? { width: cropWidthMm, height: cropHeightMm }
          : undefined
      const cropAspectRatio = String(fd.get('cropAspectRatio') ?? '').trim() || undefined
      const cropScreenKey = String(fd.get('cropScreenKey') ?? '').trim() || undefined
      const locale: WebLocale = normalizeWebLocale(localeBody) ?? 'vi'
      const files = fd.getAll('images').filter((f): f is File => f instanceof File && f.size > 0)
      const uploadFiles = files.length
        ? await Promise.all(
            files.map(async (f) => ({
              buffer: Buffer.from(await f.arrayBuffer()),
              mimeType: f.type || 'image/png',
            }))
          )
        : undefined

      const threadId = await pgEnsureHubChatThread(user.id, threadIdBody, locale, message.slice(0, 80) || 'Studio')
      if (!threadId) return NextResponse.json({ error: 'Không tạo được hội thoại.' }, { status: 500 })

      const result = await handleHubStudio({
        userId: user.id,
        threadId,
        locale,
        message,
        action,
        apiKey,
        uploadFiles,
        cropSizeMm,
        cropAspectRatio,
        cropScreenKey,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Studio lỗi.' }, { status: result.error ? 422 : 500 })
      }
      return NextResponse.json({
        ok: true,
        mode: 'studio',
        reply: result.reply,
        studio: result.studio,
        session: result.session,
        threadId: result.threadId,
        chargedChat: result.chargedChat,
        chargedImage: result.chargedImage,
        workflows: result.workflows,
        plan: result.plan ?? null,
        hubRoute: result.hubRoute,
      })
    }

    const body = (await request.json()) as {
      message?: string
      mode?: string
      workflowGroup?: string
      locale?: string
      threadId?: string
      action?: string
      presetId?: string
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
      discoveryChoice?: string
      discoveryChoiceStep?: string
      colorPaletteKeys?: string[]
      colorPaletteSelection?: Array<{ key?: string; role?: string }>
      boxDielineStructure?: string
      boxDimensionsMm?: { length?: number; width?: number; height?: number }
      boxProduction?: {
        bleedMm?: number
        glueTabMm?: number
        paperThicknessMm?: number
        compensationGapMm?: number
      }
      barcodeEntries?: Array<{
        type?: string
        content?: string
        label?: string
      }>
      featureKey?: string
    }

    const mode: HubChatMode = VALID_MODES.has(body?.mode as HubChatMode) ? (body.mode as HubChatMode) : 'chat'
    const locale: WebLocale = normalizeWebLocale(body?.locale) ?? 'vi'

    if (mode === 'studio') {
      const t = getDictionary(locale).hubChat
      const message = String(body?.message ?? '').trim()
      const action = (body?.action as HubStudioAction) || 'message'
      const presetId = String(body?.presetId ?? '').trim() || undefined
      const referenceScreenKey = String(body?.referenceScreenKey ?? '').trim() || undefined
      const generationRefKeys = Array.isArray(body?.generationRefKeys)
        ? body.generationRefKeys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : undefined
      const productUrl = String(body?.productUrl ?? '').trim() || undefined
      const editMessageId = String(body?.editMessageId ?? '').trim() || undefined
      const editStepKey = String(body?.editStepKey ?? '').trim() || undefined
      const navigateStepKey = String(body?.navigateStepKey ?? '').trim() || undefined
      const regenerateStepKey = String(body?.regenerateStepKey ?? '').trim() || undefined
      const facePrintStyle = String(body?.facePrintStyle ?? '').trim() || undefined
      const printLanguage = String(body?.printLanguage ?? '').trim() || undefined
      const printLanguageDetail = String(body?.printLanguageDetail ?? '').trim() || undefined
      const labelAspectRatio = String(body?.labelAspectRatio ?? '').trim() || undefined
      const labelShape = String(body?.labelShape ?? '').trim() || undefined
      const featureKey = String(body?.featureKey ?? '').trim() || undefined
      const discoveryChoice = String(body?.discoveryChoice ?? '').trim() || undefined
      const discoveryChoiceStep = String(body?.discoveryChoiceStep ?? '').trim() || undefined
      const colorPaletteKeys = Array.isArray(body?.colorPaletteKeys)
        ? body.colorPaletteKeys.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : undefined
      const colorPaletteSelection = Array.isArray(body?.colorPaletteSelection)
        ? body.colorPaletteSelection
            .map((item) => ({
              key: typeof item?.key === 'string' ? item.key.trim() : '',
              role: item?.role === 'secondary' ? ('secondary' as const) : ('primary' as const),
            }))
            .filter((item) => item.key.length > 0)
        : undefined
      const boxDielineStructure = String(body?.boxDielineStructure ?? '').trim() || undefined
      if (action === 'message' && !isValidHubStudioMessage(message)) {
        return NextResponse.json({ error: 'Nhập ít nhất 2 ký tự.' }, { status: 400 })
      }
      if (action === 'edit_step' && !isValidHubStudioMessage(message)) {
        return NextResponse.json({ error: 'Nhập ít nhất 2 ký tự.' }, { status: 400 })
      }
      if (action === 'classify_flow_switch' && !isValidHubStudioMessage(message)) {
        return NextResponse.json({ error: 'Nhập ít nhất 2 ký tự.' }, { status: 400 })
      }
      if (action === 'classify_feature_intent' && !isValidHubStudioMessage(message)) {
        return NextResponse.json({ error: 'Nhập ít nhất 2 ký tự.' }, { status: 400 })
      }
      if (action === 'select_feature' && !featureKey) {
        return NextResponse.json({ error: t.errorGeneric }, { status: 400 })
      }
      const threadTitle =
        action === 'start_preset' && presetId
          ? presetTitle(locale, presetId).slice(0, 80)
          : action === 'classify_flow_switch' || action === 'classify_feature_intent'
            ? 'Studio'
            : message.slice(0, 80) || 'Studio'
      const threadId = await pgEnsureHubChatThread(user.id, body?.threadId, locale, threadTitle)
      if (!threadId) return NextResponse.json({ error: 'Không tạo được hội thoại.' }, { status: 500 })

      const result = await handleHubStudio({
        userId: user.id,
        threadId,
        locale,
        message,
        action,
        presetId,
        referenceScreenKey,
        generationRefKeys,
        productUrl,
        editMessageId,
        editStepKey,
        navigateStepKey,
        regenerateStepKey,
        facePrintStyle,
        printLanguage,
        printLanguageDetail,
        labelAspectRatio,
        labelShape,
        discoveryChoice,
        discoveryChoiceStep,
        colorPaletteKeys,
        colorPaletteSelection,
        boxDielineStructure,
        boxDimensionsMm: body?.boxDimensionsMm,
        boxProduction: body?.boxProduction,
        barcodeEntries: body?.barcodeEntries,
        featureKey,
        apiKey,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Studio lỗi.' }, { status: result.error ? 422 : 500 })
      }
      return NextResponse.json({
        ok: true,
        mode: 'studio',
        reply: result.reply,
        studio: result.studio,
        session: result.session,
        threadId: result.threadId,
        chargedChat: result.chargedChat,
        chargedImage: result.chargedImage,
        workflows: result.workflows,
        plan: result.plan ?? null,
        hubRoute: result.hubRoute,
        threadMessages: result.threadMessages ?? null,
        userMessageId: result.userMessageId ?? null,
        flowSwitch: result.flowSwitch ?? null,
        featureIntent: result.featureIntent ?? null,
        showFeaturePicker: result.showFeaturePicker ?? false,
      })
    }

    const message = String(body?.message ?? '').trim()
    if (message.length < 2) {
      return NextResponse.json({ error: 'Nhập ít nhất 2 ký tự.' }, { status: 400 })
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Tin nhắn quá dài (tối đa 2000 ký tự).' }, { status: 400 })
    }

    const workflowGroup: HubWorkflowGroup = VALID_GROUPS.has(body?.workflowGroup as HubWorkflowGroup)
      ? (body.workflowGroup as HubWorkflowGroup)
      : 'all'
    const t = getDictionary(locale)

    const charged = await deductUserCredits(user.id, HUB_CHAT_CREDIT)
    if (!charged.ok) {
      const status = charged.code === 'INSUFFICIENT_CREDITS' ? 402 : 500
      return NextResponse.json({ error: charged.error, code: charged.code }, { status })
    }

    const fullCatalog = buildHubToolCatalog(t.tool, t.navGroup)
    const scopedCatalog = filterCatalogByGroup(fullCatalog, workflowGroup)
    const catalogForPrompt = scopedCatalog.length > 0 ? scopedCatalog : fullCatalog
    const catalogHrefs = new Set(catalogForPrompt.map((e) => e.href))

    const catalogJson = JSON.stringify(
      catalogForPrompt.map((e) => ({
        href: e.href,
        labelKey: e.labelKey,
        label: e.label,
        group: e.groupLabel,
      }))
    )

    const langName =
      locale === 'vi'
        ? 'Vietnamese'
        : locale === 'zh'
          ? 'Chinese (Simplified)'
          : locale === 'ja'
            ? 'Japanese'
            : locale === 'ko'
              ? 'Korean'
              : 'English'

    const modeHint =
      mode === 'pipeline'
        ? 'User wants a MULTI-STEP PIPELINE (ordered workflow). You MUST return a "plan" with 2-6 sequential steps when the request implies multiple tools (e.g. banner then sharpen then try-on).'
        : mode === 'workflow'
          ? `User is in WORKFLOW mode${workflowGroup !== 'all' ? ` (group: ${workflowGroup})` : ''}. Prioritize concrete tool recommendations.`
          : 'User is in CHAT mode. Answer helpfully and suggest tools when relevant.'

    const planBlock =
      mode === 'pipeline'
        ? `,
  "plan": {
    "title": "short plan title in ${langName}",
    "steps": [
      {
        "href": "/exact-href",
        "labelKey": "tool key",
        "label": "display name",
        "prefillPrompt": "prompt for this step only",
        "reason": "why this step at this position"
      }
    ]
  }`
        : ''

    const sys = `You are NanoAI Hub Assistant — a routing advisor for the NanoAI platform (AI tools for images, education, music, try-on fashion, design).

${modeHint}

Available tools (JSON array — ONLY recommend from this list):
${catalogJson}

Reply in ${langName}.

Respond with ONLY valid JSON (no markdown fences):
{
  "reply": "1-3 short sentences for the user",
  "workflows": [
    {
      "href": "/exact-href-from-catalog",
      "labelKey": "tool key from catalog",
      "label": "tool display name",
      "reason": "one sentence why this tool fits",
      "prefillPrompt": "ready-to-paste prompt/description for that tool page (in ${langName})",
      "confidence": 0.0-1.0
    }
  ]${planBlock}
}

Rules:
- Do NOT claim you generated images, music, or files — you only advise and route.
- workflows: 0-4 items for quick single-tool picks.
- For pipeline mode: plan.steps MUST have 2-6 items in logical execution order; each step uses a different tool when possible.
- prefillPrompt: actionable text for that specific step.
- href MUST match catalog exactly.`

    const threadId = await pgEnsureHubChatThread(user.id, body?.threadId, locale, message.slice(0, 80))

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        ...GEMINI_25_FLASH_NO_THINKING,
        generationConfig: {
          temperature: mode === 'pipeline' ? 0.3 : 0.35,
          maxOutputTokens: mode === 'pipeline' ? 2000 : 1200,
          responseMimeType: 'application/json',
        },
      })

      const r = await model.generateContent([{ text: `${sys}\n\nUser message:\n${message}` }])
      await trackFromUsageMetadata(
        r.response.usageMetadata,
        GEMINI_25_FLASH_NO_THINKING.model,
        mode === 'pipeline' ? 'hub-chat-pipeline' : 'hub-chat',
        user.id
      )

      const resText = r.response.text()?.trim() ?? ''
      if (!resText) {
        await refundUserCredits(user.id, HUB_CHAT_CREDIT)
        return NextResponse.json({ error: 'Model không trả lời.' }, { status: 502 })
      }

      let parsed: { reply?: unknown; workflows?: unknown; plan?: unknown }
      try {
        parsed = JSON.parse(cleanJsonResponse(resText)) as {
          reply?: unknown
          workflows?: unknown
          plan?: unknown
        }
      } catch {
        await refundUserCredits(user.id, HUB_CHAT_CREDIT)
        return NextResponse.json({ error: 'Phản hồi AI không hợp lệ. Thử lại.' }, { status: 502 })
      }

      const reply = String(parsed.reply ?? '').trim() || t.hubChat.fallbackReply
      const workflows = parseWorkflowSuggestions(parsed.workflows, catalogHrefs)

      let planPayload: HubChatPlanPayload | null = null
      let planSteps = parsePlanSteps(parsed.plan, catalogHrefs)
      if (planSteps.length < 2 && mode === 'pipeline' && workflows.length >= 2) {
        planSteps = workflows.map((w) => ({
          href: w.href,
          labelKey: w.labelKey,
          label: w.label,
          prefillPrompt: w.prefillPrompt,
          reason: w.reason,
        }))
      }
      if (planSteps.length >= 2) {
        const planObj = parsed.plan as Record<string, unknown> | undefined
        const planTitle = String(planObj?.title ?? '').trim() || message.slice(0, 80)
        const saved = await pgCreateHubMultiTaskPlan({
          userId: user.id,
          threadId,
          title: planTitle,
          sourcePrompt: message,
          locale,
          steps: planSteps,
        })
        planPayload = planToPayload(saved)
      }

      if (threadId) {
        await pgInsertHubChatMessage({ threadId, role: 'user', content: message })
        await pgInsertHubChatMessage({
          threadId,
          role: 'assistant',
          content: reply,
          workflows: workflows.length ? workflows : null,
          planId: planPayload?.id ?? null,
        })
      }

      return NextResponse.json({
        ok: true,
        reply,
        workflows,
        plan: planPayload,
        threadId,
        charged: HUB_CHAT_CREDIT,
        balance: charged.balance,
      })
    } catch (e) {
      await refundUserCredits(user.id, HUB_CHAT_CREDIT)
      const msg = e instanceof Error ? e.message : 'Lỗi gọi AI.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
