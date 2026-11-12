/** Câu học sinh chưa bấm Tiếp. Lưu để mở lại đúng bước thì nội dung dở vẫn còn. */

export type PendingSpeechAnalysis = {
  targetTranscript: string
  nativeTranscript: string
  mergedTranscript: string
  inferredMeaning: string
  pronunciationIssues: string[]
  pronunciationScore: number
  weakWords: string[]
  pronunciationAccuracy: number
  pronunciationFluency: number
  pronunciationProsody: number
  wordScores: Array<{ word: string; score: number; issueType: string }>
}

export type PendingSpeechMeta = {
  rev: number
  savedAt: number
  pending: boolean
  discarded: boolean
  originalText: string
  meaning: string
  presetReplay: boolean
  analysis: PendingSpeechAnalysis | null
}

export type StoredPendingSpeech = {
  sessionId: string
  messageId: string
  text: string
  originalText: string
  meaning: string
  audioUrl: string
  presetReplay: boolean
  analysis: PendingSpeechAnalysis | null
  savedAt: number
}

export type HistorySpeechItem = {
  id: string
  role: string
  text: string
  audioUrl?: string | null
  aiPayloadJson?: string | null
}

const STORAGE_PREFIX = 'coach-pending-speech-v1:'

function clip(value: unknown, max: number): string {
  return String(value || '').trim().slice(0, max)
}

function cleanAnalysis(raw: unknown): PendingSpeechAnalysis | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<PendingSpeechAnalysis>
  const wordScores = Array.isArray(row.wordScores) ? row.wordScores : []
  return {
    targetTranscript: clip(row.targetTranscript, 2000),
    nativeTranscript: clip(row.nativeTranscript, 2000),
    mergedTranscript: clip(row.mergedTranscript, 2000),
    inferredMeaning: clip(row.inferredMeaning, 2000),
    pronunciationIssues: (Array.isArray(row.pronunciationIssues) ? row.pronunciationIssues : [])
      .map((item) => clip(item, 200))
      .filter(Boolean)
      .slice(0, 20),
    pronunciationScore: Number(row.pronunciationScore) || 0,
    weakWords: (Array.isArray(row.weakWords) ? row.weakWords : [])
      .map((item) => clip(item, 80))
      .filter(Boolean)
      .slice(0, 30),
    pronunciationAccuracy: Number(row.pronunciationAccuracy) || 0,
    pronunciationFluency: Number(row.pronunciationFluency) || 0,
    pronunciationProsody: Number(row.pronunciationProsody) || 0,
    wordScores: wordScores
      .slice(0, 40)
      .map((item) => ({
        word: clip(item?.word, 80),
        score: Number(item?.score) || 0,
        issueType: clip(item?.issueType, 40),
      }))
      .filter((item) => item.word),
  }
}

export function durableAudioUrl(url: string | null | undefined): string {
  const trimmed = String(url || '').trim()
  if (!trimmed || trimmed.startsWith('blob:')) return ''
  return trimmed.slice(0, 2000)
}

export function serializePendingSpeech(input: {
  rev: number
  savedAt: number
  pending: boolean
  discarded?: boolean
  originalText: string
  meaning: string
  presetReplay: boolean
  analysis: PendingSpeechAnalysis | null
}): string {
  const discarded = Boolean(input.discarded)
  return JSON.stringify({
    pendingSpeech: input.pending && !discarded,
    discarded,
    rev: Math.max(0, Math.floor(Number(input.rev) || 0)),
    savedAt: Math.max(0, Math.floor(Number(input.savedAt) || 0)),
    originalText: clip(input.originalText, 4000),
    meaning: clip(input.meaning, 4000),
    presetReplay: Boolean(input.presetReplay),
    analysis: cleanAnalysis(input.analysis),
  })
}

function payloadRev(raw: string | null | undefined): number | null {
  if (!raw) return null
  try {
    const rev = (JSON.parse(raw) as { rev?: unknown }).rev
    const parsed = Number(rev)
    if (!Number.isFinite(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/** Bản ghi mới hơn mới được ghi đè. Payload không có rev vẫn được cập nhật câu chữ, nhưng không xóa bản nháp. */
export function draftRevisionPlan(
  existingPayload: string | null | undefined,
  incomingPayload: string | null | undefined,
): 'apply' | 'text-only' | 'skip' {
  const existing = payloadRev(existingPayload)
  if (existing == null) return 'apply'
  const incoming = payloadRev(incomingPayload)
  if (incoming == null) return 'text-only'
  if (incoming < existing) return 'skip'
  return 'apply'
}

export function shouldApplyDraftRevision(
  existingPayload: string | null | undefined,
  incomingPayload: string | null | undefined,
): boolean {
  return draftRevisionPlan(existingPayload, incomingPayload) === 'apply'
}

export function readPendingSpeechPayload(raw: string | null | undefined): PendingSpeechMeta | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.pendingSpeech !== true && parsed.discarded !== true) return null
    const discarded = parsed.discarded === true
    return {
      rev: Number(parsed.rev) || 0,
      savedAt: Number(parsed.savedAt) || 0,
      pending: parsed.pendingSpeech === true && !discarded,
      discarded,
      originalText: String(parsed.originalText || ''),
      meaning: String(parsed.meaning || ''),
      presetReplay: parsed.presetReplay === true,
      analysis: cleanAnalysis(parsed.analysis),
    }
  } catch {
    return null
  }
}

export function isDiscardedSpeechPayload(raw: string | null | undefined): boolean {
  return readPendingSpeechPayload(raw)?.discarded === true
}

export function findRestorablePendingSpeech<T extends HistorySpeechItem>(items: T[]): T | null {
  if (items.length === 0) return null
  const last = items[items.length - 1]
  if (last.role !== 'student') return null
  const meta = readPendingSpeechPayload(last.aiPayloadJson)
  if (!meta?.pending || meta.discarded) return null
  if (!String(last.text || '').trim()) return null
  return last
}

/** Câu đã nói và đã bấm Tiếp. Bài ôn mini của câu trước không được nuốt lượt này. */
export function recordedTurnBypassesMiniHold(opts?: {
  existingStudentMessageId?: string
  silentDrill?: boolean
  drillSpeaking?: boolean
} | null): boolean {
  if (!String(opts?.existingStudentMessageId || '').trim()) return false
  if (opts?.silentDrill || opts?.drillSpeaking) return false
  return true
}

/** Câu học sinh đã chốt, không còn là bản nháp đang sửa. */
export function isUnansweredStudentTurn<T extends {
  role?: string
  text?: string | null
  aiPayloadJson?: string | null
}>(item?: T | null): item is T {
  if (!item || item.role !== 'student') return false
  if (!String(item.text || '').trim()) return false
  const meta = readPendingSpeechPayload(item.aiPayloadJson)
  if (meta?.pending || meta?.discarded) return false
  return true
}

export function readStoredSpeechAnalysis(raw: string | null | undefined): PendingSpeechAnalysis | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { analysis?: unknown }
    return cleanAnalysis(parsed.analysis)
  } catch {
    return null
  }
}

export function shouldAttachLocalPendingDraft(
  items: HistorySpeechItem[],
  local: StoredPendingSpeech | null,
): boolean {
  if (!local || !String(local.text || '').trim()) return false
  if (findRestorablePendingSpeech(items)) return false
  const last = items[items.length - 1]
  if (!last) return true
  return last.role === 'teacher'
}

export function newerDraftText(
  serverText: string,
  serverSavedAt: number,
  local: StoredPendingSpeech | null,
  sessionId: string,
): string {
  const server = String(serverText || '').trim()
  if (!local || local.sessionId !== sessionId) return server
  const localText = String(local.text || '').trim()
  if (!localText) return server
  if ((local.savedAt || 0) > (serverSavedAt || 0)) return localText
  return server
}

export function pendingSpeechStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`
}

export function writePendingSpeechStorage(draft: StoredPendingSpeech): void {
  if (typeof window === 'undefined') return
  const sessionId = String(draft.sessionId || '').trim()
  const text = String(draft.text || '').trim()
  if (!sessionId || !text) return
  try {
    window.sessionStorage.setItem(pendingSpeechStorageKey(sessionId), JSON.stringify({
      ...draft,
      sessionId,
      text,
      audioUrl: durableAudioUrl(draft.audioUrl),
      savedAt: draft.savedAt || Date.now(),
    }))
  } catch {
    // Bộ nhớ trình duyệt đầy thì vẫn còn bản trên server.
  }
}

export function readPendingSpeechStorage(sessionId: string): StoredPendingSpeech | null {
  if (typeof window === 'undefined') return null
  const id = String(sessionId || '').trim()
  if (!id) return null
  try {
    const raw = window.sessionStorage.getItem(pendingSpeechStorageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPendingSpeech
    if (!parsed || String(parsed.sessionId || '') !== id) return null
    const text = String(parsed.text || '').trim()
    if (!text) return null
    return {
      sessionId: id,
      messageId: String(parsed.messageId || ''),
      text,
      originalText: String(parsed.originalText || text),
      meaning: String(parsed.meaning || ''),
      audioUrl: durableAudioUrl(parsed.audioUrl),
      presetReplay: parsed.presetReplay === true,
      analysis: cleanAnalysis(parsed.analysis),
      savedAt: Number(parsed.savedAt) || 0,
    }
  } catch {
    return null
  }
}

export function clearPendingSpeechStorage(sessionId: string): void {
  if (typeof window === 'undefined') return
  const id = String(sessionId || '').trim()
  if (!id) return
  try {
    window.sessionStorage.removeItem(pendingSpeechStorageKey(id))
  } catch {
    // ignore
  }
}
