import { parseContentToBlocks } from './curriculum-to-slides'

type BeatSlide = {
  blocks?: Array<{ header?: string; content?: string }> | null
  content?: string | null
}

/** Các đoạn đang chiếu của một slide — cùng cách tách block với cột chữ giáo viên. */
export function presentationBlocks(slide: BeatSlide | undefined | null) {
  if (!slide) return []
  const raw = Array.isArray(slide.blocks) && slide.blocks.length > 0
    ? slide.blocks
    : slide.content
      ? parseContentToBlocks(slide.content)
      : []
  if (raw.length > 0 && raw.every((b) => !(b.content ?? '').trim()) && String(slide.content ?? '').trim()) {
    return parseContentToBlocks(slide.content ?? '')
  }
  return raw
}

/** Một slide không có đoạn vẫn là một nhịp, để nút tiếp đi sang slide sau. */
export function presentationBeatCount(slide: BeatSlide | undefined | null): number {
  return Math.max(1, presentationBlocks(slide).length || 1)
}

/**
 * Tiến hoặc lùi một nhịp. Đoạn trong slide đi như slide: hết đoạn thì dừng,
 * nhịp kế mới sang slide khác.
 */
export function stepPresentationBeat(
  index: number,
  blockIndex: number,
  direction: 1 | -1,
  beatCounts: number[],
): { index: number; blockIndex: number } {
  const total = beatCounts.length
  if (total <= 0) return { index: 0, blockIndex: 0 }
  const i = Math.max(0, Math.min(index, total - 1))
  const count = Math.max(1, beatCounts[i] || 1)
  const b = Math.max(0, Math.min(blockIndex, count - 1))
  if (direction > 0) {
    if (b + 1 < count) return { index: i, blockIndex: b + 1 }
    if (i + 1 < total) return { index: i + 1, blockIndex: 0 }
    return { index: i, blockIndex: b }
  }
  if (b > 0) return { index: i, blockIndex: b - 1 }
  if (i > 0) {
    const prevCount = Math.max(1, beatCounts[i - 1] || 1)
    return { index: i - 1, blockIndex: prevCount - 1 }
  }
  return { index: 0, blockIndex: 0 }
}
