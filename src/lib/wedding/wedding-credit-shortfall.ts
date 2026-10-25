export const WEDDING_INSUFFICIENT_CREDIT = 'INSUFFICIENT_CREDITS' as const

export type WeddingInsufficientCreditCode = typeof WEDDING_INSUFFICIENT_CREDIT

/** Nhận cả mã chuẩn và câu lỗi cũ còn chữ «Không đủ credit». */
export function isWeddingInsufficientCredit(result: { error?: string; code?: string } | null | undefined): boolean {
  if (!result?.error) return false
  if (result.code === WEDDING_INSUFFICIENT_CREDIT) return true
  return /không đủ credit/i.test(result.error)
}

export type WeddingCreateDraftKind = 'background' | 'frame'

export type WeddingCreateDraft = {
  cardId: string
  kind: WeddingCreateDraftKind
  savedAt: number
  extraPrompt: string
  backgroundStyleId: string
  gptQuality: string
  styleReferenceUrl: string
  framePrompt: string
  frameStyleId: string
  frameOpening: string
  frameImageEngine: string
  frameGptQuality: string
  frameGeminiQuality: string
  frameReferenceUrl: string
}

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

function weddingCreateDraftKey(cardId: string) {
  return `nanoai:wedding-create-draft:${cardId}`
}

export function writeWeddingCreateDraft(draft: WeddingCreateDraft) {
  if (typeof window === 'undefined' || !draft.cardId) return
  try {
    window.sessionStorage.setItem(weddingCreateDraftKey(draft.cardId), JSON.stringify(draft))
  } catch {
    // Phiên đầy thì form vẫn nằm trong bộ nhớ trang đang mở.
  }
}

export function readWeddingCreateDraft(cardId: string): WeddingCreateDraft | null {
  if (typeof window === 'undefined' || !cardId) return null
  try {
    const raw = window.sessionStorage.getItem(weddingCreateDraftKey(cardId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WeddingCreateDraft>
    if (parsed.cardId !== cardId) return null
    if (parsed.kind !== 'background' && parsed.kind !== 'frame') return null
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      window.sessionStorage.removeItem(weddingCreateDraftKey(cardId))
      return null
    }
    return {
      cardId,
      kind: parsed.kind,
      savedAt: parsed.savedAt,
      extraPrompt: typeof parsed.extraPrompt === 'string' ? parsed.extraPrompt : '',
      backgroundStyleId: typeof parsed.backgroundStyleId === 'string' ? parsed.backgroundStyleId : 'luxury',
      gptQuality: typeof parsed.gptQuality === 'string' ? parsed.gptQuality : 'medium',
      styleReferenceUrl: typeof parsed.styleReferenceUrl === 'string' ? parsed.styleReferenceUrl : '',
      framePrompt: typeof parsed.framePrompt === 'string' ? parsed.framePrompt : '',
      frameStyleId: typeof parsed.frameStyleId === 'string' ? parsed.frameStyleId : 'luxury',
      frameOpening: typeof parsed.frameOpening === 'string' ? parsed.frameOpening : 'ellipse',
      frameImageEngine: typeof parsed.frameImageEngine === 'string' ? parsed.frameImageEngine : 'gemini',
      frameGptQuality: typeof parsed.frameGptQuality === 'string' ? parsed.frameGptQuality : 'medium',
      frameGeminiQuality: typeof parsed.frameGeminiQuality === 'string' ? parsed.frameGeminiQuality : '2K',
      frameReferenceUrl: typeof parsed.frameReferenceUrl === 'string' ? parsed.frameReferenceUrl : '',
    }
  } catch {
    return null
  }
}

export function clearWeddingCreateDraft(cardId: string) {
  if (typeof window === 'undefined' || !cardId) return
  try {
    window.sessionStorage.removeItem(weddingCreateDraftKey(cardId))
  } catch {
    // Bỏ qua khi trình duyệt chặn storage.
  }
}
