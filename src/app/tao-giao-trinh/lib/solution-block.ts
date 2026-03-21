/**
 * Nhận diện block “lời giải / đáp án” để dùng chế độ gõ segment (phiếu bài tập + giáo trình).
 * Khớp quy ước strip heading trong `tao-giao-trinh-client-page`.
 */
export function blockHeaderLooksLikeSolution(header: string | undefined | null): boolean {
  const h = String(header ?? '').trim().toLowerCase()
  if (!h) return false
  return /(đáp án|lời giải|answer|solution)/i.test(h)
}

export function slideBlockUsesSolutionTypingReveal(block: { header?: string; isAnswer?: boolean }): boolean {
  return Boolean((block as { isAnswer?: boolean }).isAnswer) || blockHeaderLooksLikeSolution(block.header)
}
