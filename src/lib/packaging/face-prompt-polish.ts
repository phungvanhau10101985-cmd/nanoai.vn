import type { WebLocale } from '@/lib/i18n/config'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'
import {
  missingQuotedPrintSpans,
  PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS,
} from '@/lib/packaging/face-prompt-polish-credit'

export const PACKAGING_FACE_POLISH_SYSTEM = `You rewrite a shopper's rough note into one clear brief for ONE flat packaging print panel. The shopper will read and edit your text before any image is generated.

Rules:
- Reply in the same language as the draft.
- Organize layout, hierarchy, and what sits where, using only ideas already in the draft.
- Any name, slogan, ingredient list, instruction, warning, address, number, or other wording meant to be printed must be copied character-for-character. If the draft already wraps that wording in quotes, keep those exact characters inside quotation marks. Never translate, transliterate, spell-correct, summarize, or drop those strings.
- Do not invent product claims, ingredients, slogans, or brand names that are not in the draft.
- Do not mention 3D boxes, mockups, dielines, millimeters, bleed, cameras, or studio backgrounds.
- No markdown, no preamble, no explanation. Return only the rewritten brief.`

function shopperLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

export function buildPackagingFacePolishUserPrompt(input: {
  faceLabel: string
  draft: string
  locale: WebLocale
}): string {
  const label = input.faceLabel.trim() || 'print face'
  return `Shopper UI language: ${shopperLanguage(input.locale)}. Keep the draft's own language.\nFace role (context only — do not print this label): ${label}\n\nDraft:\n${input.draft.trim()}`
}

function stripModelFence(text: string): string {
  let out = text.trim()
  if (out.startsWith('```')) {
    out = out.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  }
  return out
}

export function packagingFacePolishApiReady(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim())
}

export type PackagingFacePolishResult =
  | { ok: true; text: string }
  | { ok: false; code: 'NO_KEY' | 'EMPTY' | 'FAILED' | 'DROPPED_COPY' | 'TOO_LONG' }

export async function polishPackagingFaceDraft(input: {
  draft: string
  faceLabel: string
  locale: WebLocale
  userId?: string | null
}): Promise<PackagingFacePolishResult> {
  const draft = input.draft.trim()
  if (!draft) return { ok: false, code: 'EMPTY' }
  if (draft.length > PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS) return { ok: false, code: 'TOO_LONG' }

  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { ok: false, code: 'NO_KEY' }

  const model = resolveDeepSeekChatModel()
  const userPrompt = buildPackagingFacePolishUserPrompt({
    faceLabel: input.faceLabel,
    draft,
    locale: input.locale,
  })

  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDeepSeekCompletionBody('chat', {
          messages: [
            { role: 'system', content: PACKAGING_FACE_POLISH_SYSTEM },
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
      error?: { message?: string }
    }

    if (!res.ok) return { ok: false, code: 'FAILED' }

    const text = stripModelFence(json.choices?.[0]?.message?.content ?? '')
    if (!text) return { ok: false, code: 'FAILED' }
    if (missingQuotedPrintSpans(draft, text).length > 0) return { ok: false, code: 'DROPPED_COPY' }

    trackOpenAiStyleCompletionUsage({
      userId: input.userId ?? null,
      model,
      feature: 'packaging-face-prompt-polish',
      usage: json.usage,
      fallbackPromptChars: PACKAGING_FACE_POLISH_SYSTEM.length + userPrompt.length,
      fallbackOutputChars: text.length,
    })

    return { text: text.slice(0, PACKAGING_FACE_PROMPT_POLISH_MAX_CHARS), ok: true }
  } catch {
    return { ok: false, code: 'FAILED' }
  }
}
