const CHUNK_MAX_COUNT = 3
const READING_MS_PER_WORD = 1_000
const NEXT_MESSAGE_READING_RATIO = 0.8

/** Chờ 80% thời gian đọc ước tính (1 từ/giây) trước khi gửi phần kế tiếp. */
export function automatedReplyNextChunkDelayMs(chunk: string): number {
  const words = chunk.trim().split(/\s+/u).filter(Boolean).length
  if (words === 0) return 0
  return Math.ceil(words * READING_MS_PER_WORD * NEXT_MESSAGE_READING_RATIO)
}

function capChunkCount(chunks: string[], maxCount: number): string[] {
  if (chunks.length <= maxCount) return chunks
  return [...chunks.slice(0, maxCount - 1), chunks.slice(maxCount - 1).join('\n\n')]
}

/**
 * Fallback cho câu trả lời cũ/chưa xuống đoạn: tách phần biến thể–màu sắc khỏi
 * phần mô tả chính khi câu mới đã chuyển chủ đề rõ ràng.
 */
function markVietnameseProductDetailTopicBoundaries(section: string): string {
  return section.replace(
    /([.!?…]["')\]]*)\s+(?=(?:Hiện có|(?:Mẫu|Sản phẩm|Quần|Áo|Váy|Đầm|Túi|Giày|Dép|Bộ|Set)\s+(?:này\s+)?(?:có|hiện có))(?=\s|:|,|;|$))/giu,
    '$1\n\n'
  )
}

/**
 * Mỗi đoạn nội dung do AI chủ động ngăn bằng một dòng trống là một bong bóng.
 * Không cắt theo ký tự/câu/từ vì như vậy có thể chẻ đôi một ý đang nói.
 */
export function splitAutomatedReplyIntoChunks(body: string): string[] {
  const normalized = body.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const semanticSections = markVietnameseProductDetailTopicBoundaries(normalized)
    .split(/\n[ \t]*\n+/u)
    .map((section) => section.trim())
    .filter(Boolean)
  return capChunkCount(
    semanticSections.length > 0 ? semanticSections : [normalized],
    CHUNK_MAX_COUNT
  )
}
