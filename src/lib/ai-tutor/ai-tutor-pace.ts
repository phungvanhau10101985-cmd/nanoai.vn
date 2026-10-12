import { automatedReplyNextChunkDelayMs } from '@/lib/messaging/partner-ai-split-reply'

/** Thời gian tối thiểu hiện «Giáo viên đang trả lời» trước khi lộ bài, kể cả khi đã có cache. */
export const TUTOR_REPLY_FLOOR_MS = 3200

/** Một bong bóng khoảng hai câu ngắn, để học sinh đọc hết trước tin kế. */
const TUTOR_CHUNK_WORD_TARGET = 42
const TUTOR_SECTION_CHUNK_CAP = 3

/** Cùng nhịp chat SaaS: chờ 80% thời gian đọc của bong bóng vừa gửi. */
export const tutorNextBubbleDelayMs = automatedReplyNextChunkDelayMs

export type TutorReplyBubble = {
  section: 'explain' | 'practice'
  text: string
}

/** Phần còn lại của khoảng chờ. Câu soạn lâu hơn sàn thì hiện ngay khi xong. */
export function tutorReplyHoldMs(startedAtMs: number, nowMs: number, floorMs = TUTOR_REPLY_FLOOR_MS): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs) || !Number.isFinite(floorMs)) return 0
  return Math.max(0, floorMs - (nowMs - startedAtMs))
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length
}

function capChunks(chunks: string[]): string[] {
  if (chunks.length <= TUTOR_SECTION_CHUNK_CAP) return chunks
  return [...chunks.slice(0, TUTOR_SECTION_CHUNK_CAP - 1), chunks.slice(TUTOR_SECTION_CHUNK_CAP - 1).join(' ')]
}

/** Tách đoạn dài theo câu. Đoạn ngắn và câu chưa hết ý giữ nguyên một bong bóng. */
export function splitTutorProse(body: string): string[] {
  const normalized = body.replace(/\s+/gu, ' ').trim()
  if (!normalized) return []
  if (wordCount(normalized) <= TUTOR_CHUNK_WORD_TARGET) return [normalized]
  const sentences = normalized
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  if (sentences.length <= 1) return [normalized]
  const chunks: string[] = []
  let buffer: string[] = []
  let words = 0
  for (const sentence of sentences) {
    const count = wordCount(sentence)
    if (buffer.length > 0 && words + count > TUTOR_CHUNK_WORD_TARGET) {
      chunks.push(buffer.join(' '))
      buffer = []
      words = 0
    }
    buffer.push(sentence)
    words += count
  }
  if (buffer.length > 0) chunks.push(buffer.join(' '))
  return capChunks(chunks)
}

/** Giải thích rồi ví dụ, mỗi phần dài thành vài bong bóng gửi lần lượt. */
export function tutorReplyBubbles(answer: { explanation: string; practice: string }): TutorReplyBubble[] {
  const bubbles: TutorReplyBubble[] = []
  for (const text of splitTutorProse(answer.explanation)) bubbles.push({ section: 'explain', text })
  for (const text of splitTutorProse(answer.practice)) bubbles.push({ section: 'practice', text })
  return bubbles
}
