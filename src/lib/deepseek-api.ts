/** DeepSeek chat/completions — V4 models (legacy deepseek-chat / deepseek-reasoner retired 2026-07-24). */
export const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions'

export const DEEPSEEK_V4_FLASH = 'deepseek-v4-flash'
export const DEEPSEEK_V4_PRO = 'deepseek-v4-pro'

const LEGACY_CHAT_MODEL = 'deepseek-chat'
const LEGACY_VERIFY_MODEL = 'deepseek-reasoner'
const LEGACY_ALIASES = new Set([LEGACY_CHAT_MODEL, LEGACY_VERIFY_MODEL])

function normalizeDeepSeekModelId(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim()
  if (!trimmed || LEGACY_ALIASES.has(trimmed)) return fallback
  return trimmed
}

export type DeepSeekCompletionMode = 'chat' | 'verify'

/** Chat / sinh văn bản — mặc định V4 Flash, thinking tắt. */
export function resolveDeepSeekChatModel(): string {
  return normalizeDeepSeekModelId(process.env.DEEPSEEK_MODEL, DEEPSEEK_V4_FLASH)
}

/** Verify / reasoning — mặc định V4 Flash, thinking bật. */
export function resolveDeepSeekVerifyModel(): string {
  return normalizeDeepSeekModelId(process.env.DEEPSEEK_VERIFY_MODEL, DEEPSEEK_V4_FLASH)
}

export function resolveDeepSeekModelForMode(mode: DeepSeekCompletionMode): string {
  return mode === 'verify' ? resolveDeepSeekVerifyModel() : resolveDeepSeekChatModel()
}

export function deepSeekThinkingParam(mode: DeepSeekCompletionMode): { thinking: { type: 'enabled' | 'disabled' } } {
  return { thinking: { type: mode === 'verify' ? 'enabled' : 'disabled' } }
}

/** Body gửi POST /chat/completions — tự gắn model V4 + thinking theo mode. */
export function buildDeepSeekCompletionBody(
  mode: DeepSeekCompletionMode,
  body: Record<string, unknown> & { model?: string }
): Record<string, unknown> {
  const { model: modelOverride, ...rest } = body
  return {
    model: modelOverride ?? resolveDeepSeekModelForMode(mode),
    ...deepSeekThinkingParam(mode),
    ...rest,
  }
}
