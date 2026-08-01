import {
  applyTemplateEditPayload,
  parseTemplateEditPayload,
} from '@/lib/partner-website/template/apply-template-edits'
import type { PartnerWebsiteTemplateSite } from '@/lib/partner-website/template/partner-website-template-types'
import { PARTNER_WEBSITE_SECTION_REGISTRY } from '@/lib/partner-website/template/section-registry'
import type { PartnerWebsiteModelId } from '@/lib/partner-website/partner-website-models'
import type { PartnerWebsiteAgentStep } from '@/lib/partner-website/partner-website-agent-loop'
import { buildFileDiff, type FileDiff } from '@/lib/partner-website/partner-website-line-diff'

export type TemplateAgentGenerateFn = (
  prompt: string,
  systemPrompt: string
) => Promise<{ text: string | null }>

const TEMPLATE_SYSTEM_PROMPT = `You are a landing page editor for a multi-tenant SaaS platform.
Output ONLY strict JSON. Customers may edit theme colors and section content props — NEVER backend URLs or platform logic.
Allowed section types: ${PARTNER_WEBSITE_SECTION_REGISTRY.map((s) => s.type).join(', ')}.
Use sectionOps to add/update/remove/reorder sections. chat-cta-v1 button links are injected by platform — do not set chat URLs in props.`

function buildTemplateEditPrompt(input: {
  locale: string
  title: string
  briefText: string
  userMessage: string
  history: string
  site: PartnerWebsiteTemplateSite
  enabledTypes: string[]
  retryNote?: string
}): string {
  return `Language: ${input.locale}
Brand: ${input.title}
Brief: ${input.briefText.slice(0, 2000)}

CURRENT site.config.json:
\`\`\`json
${JSON.stringify(input.site, null, 2)}
\`\`\`

Enabled section types: ${input.enabledTypes.join(', ')}

Chat history:
${input.history || '(none)'}

User request: ${input.userMessage}

Return JSON:
{
  "assistantMessage": "summary in user language",
  "theme": { "primaryColor": "#...", ... optional partial theme },
  "sectionOps": [
    { "op": "update", "sectionId": "...", "props": { ... } },
    { "op": "add", "pageSlug": "/", "type": "faq-v1", "props": { ... }, "afterSectionId": "optional" },
    { "op": "remove", "sectionId": "..." },
    { "op": "reorder", "pageSlug": "/", "sectionIds": ["id1","id2"] }
  ]
}

Rules:
- Prefer surgical sectionOps over replacing entire pages
- Do not remove chat-cta-v1 unless user explicitly asks
- For color/style requests, update theme and/or section props
${input.retryNote ? `\nRETRY: ${input.retryNote}` : ''}`
}

function buildGeneratePrompt(input: {
  locale: string
  title: string
  briefText: string
  userMessage: string
  enabledTypes: string[]
}): string {
  return `Language: ${input.locale}
Brand/title: ${input.title}
Brief: ${input.briefText.slice(0, 3000)}
User message: ${input.userMessage}

Create a landing page config JSON for template landing-v1.
Return JSON:
{
  "assistantMessage": "summary",
  "theme": { "primaryColor", "accentColor", "backgroundColor", "textColor", "mutedColor", "fontFamily", "logoUrl" },
  "pages": [{
    "slug": "/",
    "title": "...",
    "sections": [{ "id": "unique-id", "type": "hero-v1|features-v1|...", "props": {} }]
  }]
}

Use only enabled types: ${input.enabledTypes.join(', ')}
Include hero-v1, features-v1, faq-v1, chat-cta-v1, footer-v1 by default.`
}

export async function runPartnerWebsiteTemplateAgent(input: {
  locale: string
  title: string
  briefText: string
  userMessage: string
  history: string
  site: PartnerWebsiteTemplateSite
  enabledTypes: string[]
  modelId: PartnerWebsiteModelId
  generate: TemplateAgentGenerateFn
  isInitial?: boolean
}): Promise<{
  site: PartnerWebsiteTemplateSite
  assistantMessage: string
  steps: PartnerWebsiteAgentStep[]
  fileDiffs: FileDiff[]
  sectionTypesTouched: string[]
} | null> {
  const beforeJson = JSON.stringify(input.site, null, 2)
  const steps: PartnerWebsiteAgentStep[] = []
  let retryNote = ''
  let lastSite = input.site
  let assistantMessage = ''

  steps.push({
    kind: 'search',
    message:
      input.locale === 'vi'
        ? `Chế độ template — ${input.site.pages[0]?.sections.length ?? 0} section trên trang chủ.`
        : `Template mode — ${input.site.pages[0]?.sections.length ?? 0} sections on home page.`,
    files: ['site.config.json'],
  })

  for (let round = 1; round <= 3; round++) {
    if (round > 1) {
      steps.push({
        kind: 'retry',
        message: input.locale === 'vi' ? `Thử lại lần ${round}…` : `Retry ${round}…`,
      })
    }

    const prompt = input.isInitial
      ? buildGeneratePrompt({
          locale: input.locale,
          title: input.title,
          briefText: input.briefText,
          userMessage: input.userMessage,
          enabledTypes: input.enabledTypes,
        })
      : buildTemplateEditPrompt({
          locale: input.locale,
          title: input.title,
          briefText: input.briefText,
          userMessage: input.userMessage,
          history: input.history,
          site: lastSite,
          enabledTypes: input.enabledTypes,
          retryNote,
        })

    steps.push({
      kind: 'patch',
      message: input.locale === 'vi' ? 'Đang cập nhật site.config.json…' : 'Updating site.config.json…',
      files: ['site.config.json'],
    })

    const response = await input.generate(prompt, TEMPLATE_SYSTEM_PROMPT)
    if (!response.text) continue

    const payload = parseTemplateEditPayload(response.text)
    if (!payload) {
      retryNote = 'Invalid JSON — return strict JSON only.'
      continue
    }

    assistantMessage = payload.assistantMessage?.trim() || assistantMessage

    if (input.isInitial && (payload as { pages?: unknown }).pages) {
      const gen = payload as PartnerWebsiteTemplateSite & { pages: PartnerWebsiteTemplateSite['pages'] }
      if (Array.isArray(gen.pages) && gen.pages.length) {
        lastSite = {
          templateId: 'landing-v1',
          theme: { ...input.site.theme, ...(payload.theme ?? {}) },
          pages: gen.pages,
        }
      }
    } else {
      const applied = applyTemplateEditPayload(lastSite, payload, input.enabledTypes)
      if (applied.errors.length && !payload.sectionOps?.length && !payload.theme) {
        retryNote = applied.errors.join('; ')
        continue
      }
      lastSite = applied.site
    }

    steps.push({
      kind: 'verify',
      message:
        input.locale === 'vi'
          ? `OK — ${lastSite.pages[0]?.sections.length ?? 0} section.`
          : `OK — ${lastSite.pages[0]?.sections.length ?? 0} sections.`,
      files: ['site.config.json'],
    })
    break
  }

  const afterJson = JSON.stringify(lastSite, null, 2)
  if (beforeJson === afterJson && !input.isInitial) return null

  const fileDiffs = [buildFileDiff('site.config.json', beforeJson, afterJson)]
  const sectionTypesTouched = [
    ...new Set(lastSite.pages.flatMap((p) => p.sections.map((s) => s.type))),
  ]

  return {
    site: lastSite,
    assistantMessage:
      assistantMessage ||
      (input.locale === 'vi' ? 'Đã cập nhật giao diện landing.' : 'Landing UI updated.'),
    steps,
    fileDiffs,
    sectionTypesTouched,
  }
}
