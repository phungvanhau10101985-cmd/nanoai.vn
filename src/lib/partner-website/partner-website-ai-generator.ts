import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  DEEPSEEK_V4_PRO,
} from '@/lib/deepseek-api'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import { buildSemanticLandingPageHtml } from '@/lib/hub-chat/landing-page-html-builder'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  defaultProjectFromHtml,
  normalizePartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-project'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { runPartnerWebsiteEditAgent, type PartnerWebsiteAgentStep } from '@/lib/partner-website/partner-website-agent-loop'
import type { FileDiff } from '@/lib/partner-website/partner-website-line-diff'
import {
  resolvePartnerWebsiteModelId,
  type PartnerWebsiteModelId,
} from '@/lib/partner-website/partner-website-models'
import { fetchPartnerWebsitePlatformConfigPg } from '@/lib/db/partner-website-platform-settings-pg'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { runPartnerWebsiteTemplateAgent } from '@/lib/partner-website/template/partner-website-template-agent'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'
import { composePartnerWebsiteHtml } from '@/lib/partner-website/compose-partner-website-html'
import {
  applyLogoGuardToProject,
  PARTNER_WEBSITE_LOGO_PROMPT_RULES,
} from '@/lib/partner-website/partner-website-logo-guard'
import {
  PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES,
  PARTNER_WEBSITE_RESPONSIVE_RULES,
} from '@/lib/partner-website/partner-website-mockup-build-rules'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'
import { PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL } from '@/lib/partner-website/generate-partner-website-from-mockup-vision'
import { trackFromUsageMetadata, trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import type { WebLocale } from '@/lib/i18n/config'

import type {
  PartnerWebsitePage,
  PartnerWebsiteRenderMode,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'

export type PartnerWebsiteChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type PartnerWebsiteAiGenerateInput = {
  locale: WebLocale
  title: string
  briefText: string
  logoUrl?: string | null
  referenceImageUrls?: string[]
  chatPath?: string
  userId?: string | null
  modelId?: PartnerWebsiteModelId | string | null
  currentProject?: PartnerWebsiteProject | null
  renderMode?: PartnerWebsiteRenderMode
  templateId?: string
  theme?: PartnerWebsiteTheme
  pages?: PartnerWebsitePage[]
  chatMessages?: PartnerWebsiteChatMessage[]
  userMessage?: string
}

export type PartnerWebsiteAiResult = {
  project: PartnerWebsiteProject
  source: 'ai' | 'fallback'
  assistantMessage: string
  renderMode?: PartnerWebsiteRenderMode
  templateId?: string
  theme?: PartnerWebsiteTheme
  pages?: PartnerWebsitePage[]
  htmlSource?: string | null
  editMode?: 'patch' | 'full' | 'agent' | 'template'
  editedFiles?: string[]
  agentSteps?: PartnerWebsiteAgentStep[]
  fileDiffs?: FileDiff[]
}

const SYSTEM_PROMPT =
  'You are a senior front-end developer. You output only strict JSON. HTML/CSS/JS must be escaped properly inside JSON strings. Always include assistantMessage summarizing changes in the user language.'

type AiProjectPayload = {
  assistantMessage?: string
  entryPath?: string
  files?: unknown
}

function buildFallbackSession(input: PartnerWebsiteAiGenerateInput): HubStudioSession {
  const brief =
    input.userMessage?.trim() ||
    input.briefText.trim() ||
    input.chatMessages?.filter((m) => m.role === 'user').map((m) => m.content).join('\n') ||
    ''
  const lines = brief.split(/\n+/).filter(Boolean)
  const productName = lines[0]?.slice(0, 120) || input.title.trim() || 'Sản phẩm'
  return {
    presetId: 'landing_page',
    projectTitle: input.title.trim() || productName,
    uploadImages: [],
    briefNotes: {
      product_name: productName,
      value_prop: lines[1]?.slice(0, 500) || brief.slice(0, 500),
      target_audience: lines[2]?.slice(0, 300) || '',
      style_mood: lines[3]?.slice(0, 300) || 'modern, clean',
      color_palette: lines[4]?.slice(0, 200) || '',
    },
    discoveryComplete: true,
    processSteps: [],
    currentStepKey: null,
    referenceImages: [],
    pendingPreview: null,
    lastGenerationPrompt: null,
    landingPage: input.logoUrl ? { logoUrl: input.logoUrl } : undefined,
  }
}

function buildContextBlock(input: PartnerWebsiteAiGenerateInput): string {
  const refUrls = input.referenceImageUrls?.filter((u) => u.trim()).slice(0, 12) ?? []
  const refsText = refUrls.length ? refUrls.join('\n- ') : '(none)'
  const refVisionLine =
    refUrls.length > 0
      ? `- ATTACHED REFERENCE IMAGES (${refUrls.length}): vision images are included — match layout, colors, typography, spacing, and section structure from these images when applying the user request.`
      : `- Reference image URLs (style inspiration only):\n- ${refsText}`
  const chatLine = input.chatPath?.trim()
    ? `Primary CTA must link to chat: ${input.chatPath.trim()}`
    : 'Include a contact section with id="contact".'
  const logoLine = input.logoUrl?.trim()
    ? `Brand logo URL (use in header): ${input.logoUrl.trim()}`
    : 'No logo URL — use text wordmark in header.'

  return `Requirements:
- Language/UI copy: ${input.locale}
- Brand/title: ${input.title.trim() || 'Landing Page'}
- ${logoLine}
${refVisionLine}
- ${chatLine}
- Include hero, features, social proof or FAQ, footer
- Separate CSS into css/main.css and optional js/main.js
- index.html must link css/main.css
- No external frameworks; pure HTML/CSS/vanilla JS only
${PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES}
${PARTNER_WEBSITE_RESPONSIVE_RULES}
${PARTNER_WEBSITE_LOGO_PROMPT_RULES}`
}

function buildAiPrompt(input: PartnerWebsiteAiGenerateInput): string {
  const context = buildContextBlock(input)
  const history =
    input.chatMessages?.slice(-8).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n') ||
    ''
  const latestUser =
    input.userMessage?.trim() ||
    input.briefText.trim() ||
    '(minimal brief — infer sensible SME landing page)'

  if (input.currentProject?.files.length) {
    const projectJson = JSON.stringify(
      {
        entryPath: input.currentProject.entryPath,
        files: input.currentProject.files.map((f) => ({
          path: f.path,
          kind: f.kind,
          content: f.content.slice(0, 120_000),
        })),
      },
      null,
      0
    )

    return `You are editing an existing static landing page project.

${context}

CURRENT PROJECT JSON:
${projectJson}

CHAT HISTORY:
${history || '(none)'}

USER REQUEST:
${latestUser}

Apply the user request to the project. Return ONLY valid JSON (no markdown fences):
{
  "assistantMessage": "Short summary of what you changed, in ${input.locale} language",
  "entryPath": "index.html",
  "files": [
    { "path": "index.html", "kind": "html", "content": "<!DOCTYPE html>..." },
    { "path": "css/main.css", "kind": "css", "content": "..." },
    { "path": "js/main.js", "kind": "js", "content": "..." }
  ]
}`
  }

  return `You are a senior front-end developer. Generate a complete static landing page project as JSON.

${context}

Initial brief / latest user message:
${latestUser}

CHAT HISTORY:
${history || '(none)'}

Return ONLY valid JSON (no markdown fences):
{
  "assistantMessage": "Short summary of the website you created, in ${input.locale} language",
  "entryPath": "index.html",
  "files": [
    { "path": "index.html", "kind": "html", "content": "<!DOCTYPE html>..." },
    { "path": "css/main.css", "kind": "css", "content": "..." },
    { "path": "js/main.js", "kind": "js", "content": "..." }
  ]
}`
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence?.[1]?.trim() || trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

function parseAiPayload(text: string): {
  project: PartnerWebsiteProject | null
  assistantMessage: string | null
} {
  const parsed = extractJsonObject(text) as AiProjectPayload | null
  if (!parsed) return { project: null, assistantMessage: null }
  const project = normalizePartnerWebsiteProject(parsed)
  const assistantMessage =
    typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage.trim() : null
  return { project, assistantMessage }
}

async function generateWithDeepseek(
  prompt: string,
  modelId: PartnerWebsiteModelId,
  userId?: string | null,
  systemPrompt = SYSTEM_PROMPT
): Promise<{ text: string | null; model: string }> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { text: null, model: modelId }

  const mode = modelId === DEEPSEEK_V4_PRO ? 'verify' : 'chat'
  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDeepSeekCompletionBody(mode, {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 8000,
          temperature: 0.45,
        })
      ),
    })
    const json = (await res.json().catch(() => null)) as
      | {
          choices?: Array<{ message?: { content?: string } }>
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
          }
        }
      | null
    if (!res.ok) return { text: null, model: modelId }
    const text = json?.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) return { text: null, model: modelId }
    trackOpenAiStyleCompletionUsage({
      userId,
      model: modelId,
      feature: 'partner-website-ai-chat',
      usage: json?.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })
    return { text, model: modelId }
  } catch {
    return { text: null, model: modelId }
  }
}

async function generateWithGemini(
  prompt: string,
  modelId: PartnerWebsiteModelId,
  userId?: string | null,
  systemPrompt = SYSTEM_PROMPT,
  referenceImageUrls: string[] = []
): Promise<{ text: string | null; model: string }> {
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return { text: null, model: modelId }
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: { temperature: 0.45, maxOutputTokens: 8192 },
    })
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: `${systemPrompt}\n\n${prompt}` },
    ]
    for (const url of referenceImageUrls.slice(0, 12)) {
      const loaded = await loadImageBufferFromUrl(url)
      if (loaded) {
        parts.push({
          inlineData: {
            data: loaded.buffer.toString('base64'),
            mimeType: loaded.mimeType || 'image/png',
          },
        })
      }
    }
    const result = await model.generateContent(parts)
    const text = result.response.text()?.trim() ?? ''
    if (!text) return { text: null, model: modelId }
    trackFromUsageMetadata(result.response.usageMetadata, modelId, 'partner-website-ai-chat', userId)
    return { text, model: modelId }
  } catch {
    return { text: null, model: modelId }
  }
}

async function generateWithOpenAiVision(
  prompt: string,
  userId?: string | null,
  systemPrompt = SYSTEM_PROMPT,
  referenceImageUrls: string[] = []
): Promise<{ text: string | null; model: string }> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const modelId = PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL
  if (!openaiKey || referenceImageUrls.length === 0) return { text: null, model: modelId }

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
  > = [{ type: 'text', text: prompt }]
  for (const url of referenceImageUrls.slice(0, 12)) {
    const loaded = await loadImageBufferFromUrl(url)
    if (loaded) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${loaded.mimeType};base64,${loaded.buffer.toString('base64')}`,
          detail: 'high',
        },
      })
    }
  }
  if (userContent.length < 2) return { text: null, model: modelId }

  const body: Record<string, unknown> = {
    model: modelId,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }
  const m = modelId.toLowerCase()
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    body.max_completion_tokens = 8192
  } else {
    body.max_tokens = 8192
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(body),
    })
    const rawText = await res.text()
    if (!res.ok) return { text: null, model: modelId }
    const data = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    if (!text) return { text: null, model: modelId }
    trackOpenAiStyleCompletionUsage({
      userId,
      model: modelId,
      feature: 'partner-website-ai-chat-vision',
      usage: data?.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })
    return { text, model: modelId }
  } catch {
    return { text: null, model: modelId }
  }
}

async function generateProjectWithModel(
  prompt: string,
  modelId: PartnerWebsiteModelId,
  userId?: string | null,
  systemPrompt = SYSTEM_PROMPT,
  referenceImageUrls?: string[]
): Promise<{ text: string | null; model: string }> {
  const refs = referenceImageUrls?.filter((u) => u.trim()).slice(0, 12) ?? []
  if (refs.length > 0) {
    // Any edit/build with attached images → GPT vision only.
    return generateWithOpenAiVision(prompt, userId, systemPrompt, refs)
  }
  const entry = modelId.startsWith('gemini')
    ? await generateWithGemini(prompt, modelId, userId, systemPrompt)
    : await generateWithDeepseek(prompt, modelId, userId, systemPrompt)
  return entry
}

async function generateParsedProjectWithModel(
  prompt: string,
  modelId: PartnerWebsiteModelId,
  userId?: string | null,
  systemPrompt = SYSTEM_PROMPT,
  referenceImageUrls?: string[]
): Promise<{ project: PartnerWebsiteProject | null; assistantMessage: string | null }> {
  const entry = await generateProjectWithModel(
    prompt,
    modelId,
    userId,
    systemPrompt,
    referenceImageUrls
  )
  if (!entry.text) return { project: null, assistantMessage: null }
  return parseAiPayload(entry.text)
}

async function tryAgentPatchEdit(
  input: PartnerWebsiteAiGenerateInput,
  modelId: PartnerWebsiteModelId
): Promise<PartnerWebsiteAiResult | null> {
  const project = input.currentProject
  const userMessage = input.userMessage?.trim() || ''
  if (!project?.files.length || !userMessage) return null

  const history =
    input.chatMessages?.slice(-8).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n') || ''

  const agentResult = await runPartnerWebsiteEditAgent({
    locale: input.locale,
    context: buildContextBlock(input),
    userMessage,
    history,
    project,
    modelId,
    generate: async (prompt, systemPrompt) => {
      const res = await generateProjectWithModel(
        prompt,
        modelId,
        input.userId,
        systemPrompt,
        input.referenceImageUrls
      )
      return { text: res.text }
    },
  })

  if (!agentResult) return null

  return {
    project: applyLogoGuardToProject(agentResult.project),
    source: 'ai',
    editMode: 'agent',
    editedFiles: agentResult.appliedPaths,
    agentSteps: agentResult.steps,
    fileDiffs: agentResult.fileDiffs,
    assistantMessage: agentResult.assistantMessage,
  }
}

async function tryTemplateEdit(
  input: PartnerWebsiteAiGenerateInput,
  modelId: PartnerWebsiteModelId
): Promise<PartnerWebsiteAiResult | null> {
  const userMessage = input.userMessage?.trim() || ''
  if (!userMessage) return null

  const platform = await fetchPartnerWebsitePlatformConfigPg()
  const isLegacy =
    input.renderMode === 'legacy' &&
    Boolean(input.currentProject?.files.some((f) => f.path !== 'site.config.json' && f.kind !== 'json'))

  if (isLegacy) return null

  const defaultSite = buildDefaultLandingV1Site({
    locale: input.locale,
    title: input.title,
    briefText: input.briefText,
    logoUrl: input.logoUrl,
    theme: input.theme,
  })

  const hasTemplatePages = Boolean(input.pages?.length)
  const site = hasTemplatePages
    ? { templateId: input.templateId ?? platform.defaultTemplateId, theme: input.theme ?? defaultSite.theme, pages: input.pages! }
    : defaultSite

  const history =
    input.chatMessages?.slice(-8).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n') || ''

  const agentResult = await runPartnerWebsiteTemplateAgent({
    locale: input.locale,
    title: input.title,
    briefText: input.briefText,
    userMessage,
    history,
    site,
    enabledTypes: platform.enabledSectionTypes,
    modelId,
    isInitial: !hasTemplatePages,
    generate: async (prompt, systemPrompt) => {
      const res = await generateProjectWithModel(
        prompt,
        modelId,
        input.userId,
        systemPrompt,
        input.referenceImageUrls
      )
      return { text: res.text }
    },
  })

  if (!agentResult) {
    if (hasTemplatePages && input.pages?.length) {
      const preserved = {
        templateId: input.templateId ?? platform.defaultTemplateId,
        theme: input.theme ?? defaultSite.theme,
        pages: input.pages,
      }
      const project = syncTemplateToProject(preserved)
      return {
        project,
        source: 'fallback',
        renderMode: 'template',
        templateId: preserved.templateId,
        theme: preserved.theme,
        pages: preserved.pages,
        htmlSource: composePartnerWebsiteHtml(
          {
            renderMode: 'template',
            templateId: preserved.templateId,
            theme: preserved.theme,
            pages: preserved.pages,
            project,
            htmlSource: null,
            locale: input.locale,
            title: input.title,
            logoUrl: input.logoUrl ?? null,
          },
          { chatPath: input.chatPath, enabledSectionTypes: platform.enabledSectionTypes }
        ),
        editMode: 'template',
        assistantMessage:
          input.locale === 'vi'
            ? 'AI không áp dụng được thay đổi — giao diện giữ nguyên. Thử đổi model hoặc mô tả ngắn hơn.'
            : 'AI could not apply changes — UI unchanged. Try another model or a shorter prompt.',
      }
    }
    const fallbackSite = defaultSite
    const project = syncTemplateToProject(fallbackSite)
    const htmlSource = composePartnerWebsiteHtml(
      {
        renderMode: 'template',
        templateId: fallbackSite.templateId,
        theme: fallbackSite.theme,
        pages: fallbackSite.pages,
        project,
        htmlSource: null,
        locale: input.locale,
        title: input.title,
        logoUrl: input.logoUrl ?? null,
      },
      { chatPath: input.chatPath, enabledSectionTypes: platform.enabledSectionTypes }
    )
    return {
      project,
      source: 'fallback',
      renderMode: 'template',
      templateId: fallbackSite.templateId,
      theme: fallbackSite.theme,
      pages: fallbackSite.pages,
      htmlSource,
      editMode: 'template',
      editedFiles: ['site.config.json'],
      assistantMessage:
        input.locale === 'vi'
          ? 'Đã tạo landing mẫu (template) — bạn có thể chat để chỉnh giao diện.'
          : 'Created default template landing — chat to customize the UI.',
    }
  }

  const project = syncTemplateToProject(agentResult.site)
  const htmlSource = composePartnerWebsiteHtml(
    {
      renderMode: 'template',
      templateId: agentResult.site.templateId,
      theme: agentResult.site.theme,
      pages: agentResult.site.pages,
      project,
      htmlSource: null,
      locale: input.locale,
      title: input.title,
      logoUrl: input.logoUrl ?? null,
    },
    { chatPath: input.chatPath, enabledSectionTypes: platform.enabledSectionTypes }
  )

  return {
    project,
    source: 'ai',
    renderMode: 'template',
    templateId: agentResult.site.templateId,
    theme: agentResult.site.theme,
    pages: agentResult.site.pages,
    htmlSource,
    editMode: 'template',
    editedFiles: ['site.config.json'],
    agentSteps: agentResult.steps,
    fileDiffs: agentResult.fileDiffs,
    assistantMessage: agentResult.assistantMessage,
  }
}

export async function generatePartnerWebsiteProject(
  input: PartnerWebsiteAiGenerateInput
): Promise<PartnerWebsiteAiResult> {
  const modelId = resolvePartnerWebsiteModelId(input.modelId)

  const templateResult = await tryTemplateEdit(input, modelId)
  if (templateResult) return templateResult

  if (input.currentProject?.files.length) {
    const agentResult = await tryAgentPatchEdit(input, modelId)
    if (agentResult) return agentResult
  }

  const prompt = buildAiPrompt(input)
  const fromAi = await generateParsedProjectWithModel(
    prompt,
    modelId,
    input.userId,
    SYSTEM_PROMPT,
    input.referenceImageUrls
  )

  if (fromAi.project && fromAi.project.files.length >= 1) {
    return {
      project: applyLogoGuardToProject(fromAi.project),
      source: 'ai',
      editMode: 'full',
      assistantMessage:
        fromAi.assistantMessage ||
        (input.locale === 'vi'
          ? 'Đã cập nhật website theo yêu cầu của bạn.'
          : 'Website updated per your request.'),
    }
  }

  const hadExistingProject = Boolean(input.currentProject?.files.length)
  if (hadExistingProject && input.currentProject) {
    return {
      project: input.currentProject,
      source: 'fallback',
      assistantMessage:
        input.locale === 'vi'
          ? 'AI không phản hồi hoặc trả về lỗi — website giữ nguyên, chưa áp dụng thay đổi. Thử gửi lại, đổi model (Gemini 2.5 Flash), hoặc mô tả ngắn gọn hơn.'
          : 'AI did not respond or returned invalid data — your site is unchanged. Retry, switch model, or use a shorter prompt.',
    }
  }

  const session = buildFallbackSession(input)
  const html = buildSemanticLandingPageHtml({ session, locale: input.locale })
  return {
    project: defaultProjectFromHtml(html, input.title),
    source: 'fallback',
    assistantMessage:
      input.locale === 'vi'
        ? 'AI không phản hồi — đã dùng mẫu HTML dự phòng. Thử lại hoặc đổi model.'
        : 'AI did not respond — used fallback HTML template. Retry or switch model.',
  }
}
