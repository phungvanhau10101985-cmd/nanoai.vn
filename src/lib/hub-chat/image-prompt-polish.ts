import type { WebLocale } from '@/lib/i18n/config'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'
import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { saveCurrentStudioStepBrief } from '@/lib/hub-chat/hub-studio-step-engine'
import {
  IMAGE_PROMPT_POLISH_SYSTEM,
  LOGO_PROMPT_POLISH_SYSTEM,
  MENU_LIST_POLISH_SYSTEM,
  missingNumericTokens,
  type ImagePromptPolishTarget,
} from '@/lib/hub-chat/image-prompt-polish-shared'
import {
  missingQuotedPrintSpans,
  PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS,
} from '@/lib/packaging/face-prompt-polish-credit'
import {
  packagingFacePolishApiReady,
  polishPackagingFaceDraft,
  type PackagingFacePolishResult,
} from '@/lib/packaging/face-prompt-polish'

export {
  IMAGE_PROMPT_POLISH_SYSTEM,
  LOGO_PROMPT_POLISH_SYSTEM,
  MENU_LIST_POLISH_SYSTEM,
  imagePromptPolishAllowed,
  isImagePromptPolishGenerator,
  isImagePromptPolishStep,
  missingNumericTokens,
  parseImagePromptPolishTarget,
} from '@/lib/hub-chat/image-prompt-polish-shared'
export type { ImagePromptPolishTarget } from '@/lib/hub-chat/image-prompt-polish-shared'

function shopperLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function stripModelFence(text: string): string {
  let out = text.trim()
  if (out.startsWith('```')) {
    out = out.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  }
  return out
}

type PolishKind = 'print' | 'logo' | 'menu_list' | 'image'

function polishKind(
  generator: StudioGeneratorKind | null,
  target: ImagePromptPolishTarget
): PolishKind {
  if (target === 'menu_bulk') return 'menu_list'
  if (target === 'landing_logo' || generator === 'logo') return 'logo'
  if (generator === 'packaging' || generator === 'packaging_face') return 'print'
  return 'image'
}

function systemFor(kind: Exclude<PolishKind, 'print'>): string {
  if (kind === 'logo') return LOGO_PROMPT_POLISH_SYSTEM
  if (kind === 'menu_list') return MENU_LIST_POLISH_SYSTEM
  return IMAGE_PROMPT_POLISH_SYSTEM
}

export function persistPolishedImagePrompt(
  session: HubStudioSession,
  stepKey: string,
  text: string,
  target: ImagePromptPolishTarget
): HubStudioSession {
  if (target === 'banner_overlay') {
    return {
      ...session,
      bannerAd: {
        ...session.bannerAd,
        overlayText: text,
      },
    }
  }
  if (target === 'menu_bulk') {
    return {
      ...session,
      foodMenu: {
        ...session.foodMenu,
        dishesBulkText: text,
      },
    }
  }
  if (target === 'landing_logo') {
    return {
      ...session,
      landingPage: {
        ...session.landingPage,
        logoBrief: text,
      },
    }
  }
  if (!stepKey) return session
  return saveCurrentStudioStepBrief(session, text)
}

export async function polishImagePromptDraft(input: {
  draft: string
  stepLabel: string
  locale: WebLocale
  generator: StudioGeneratorKind | null
  target: ImagePromptPolishTarget
  userId?: string | null
}): Promise<PackagingFacePolishResult> {
  const draft = input.draft.trim()
  if (!draft) return { ok: false, code: 'EMPTY' }
  if (draft.length > PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS) return { ok: false, code: 'TOO_LONG' }

  const kind = polishKind(input.generator, input.target)
  if (kind === 'print') {
    return polishPackagingFaceDraft({
      draft,
      faceLabel: input.stepLabel,
      locale: input.locale,
      userId: input.userId,
    })
  }

  if (!packagingFacePolishApiReady()) return { ok: false, code: 'NO_KEY' }

  const system = systemFor(kind)
  const label = input.stepLabel.trim() || 'image'
  const userPrompt = `Shopper UI language: ${shopperLanguage(input.locale)}. Keep the draft's own language.\nImage role (context only — do not print this label): ${label}\n\nDraft:\n${draft}`
  const model = resolveDeepSeekChatModel()

  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY?.trim() ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDeepSeekCompletionBody('chat', {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1200,
          temperature: 0.3,
        })
      ),
    })

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    if (!res.ok) return { ok: false, code: 'FAILED' }

    const text = stripModelFence(json.choices?.[0]?.message?.content ?? '')
    if (!text) return { ok: false, code: 'FAILED' }
    if (missingQuotedPrintSpans(draft, text).length > 0) return { ok: false, code: 'DROPPED_COPY' }
    if (kind === 'menu_list' && missingNumericTokens(draft, text).length > 0) {
      return { ok: false, code: 'DROPPED_COPY' }
    }

    trackOpenAiStyleCompletionUsage({
      userId: input.userId ?? null,
      model,
      feature: 'hub-image-prompt-polish',
      usage: json.usage,
      fallbackPromptChars: system.length + userPrompt.length,
      fallbackOutputChars: text.length,
    })

    return { text: text.slice(0, PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS), ok: true }
  } catch {
    return { ok: false, code: 'FAILED' }
  }
}
