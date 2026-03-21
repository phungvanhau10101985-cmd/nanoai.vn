/**
 * Đếm segment lời giải phiếu bài tập — khớp `WorksheetBlockContentWithEmbeds`:
 * mỗi ký tự chuỗi UTF-16 + mỗi embed = 1 segment.
 */
import { splitContentWithEmbeds } from '@/app/tao-giao-trinh/components/content-embed'

export type WorksheetAnswerPart = ReturnType<typeof splitContentWithEmbeds>[number]

export function worksheetAnswerParts(content: string): WorksheetAnswerPart[] {
  return splitContentWithEmbeds(content ?? '')
}

export function worksheetAnswerSegmentCount(content: string): number {
  let n = 0
  for (const p of worksheetAnswerParts(content)) {
    if (p.type === 'text') n += p.value.length
    else n += 1
  }
  return n
}

/**
 * Số segment khi render học sinh (`hideQuiz` bỏ quiz khỏi luồng) — khớp `WorksheetBlockContentWithEmbeds`
 * (quiz bị return null trước khi tăng `consumed`).
 */
export function worksheetAnswerDisplaySegmentCount(content: string, hideQuiz?: boolean): number {
  let n = 0
  for (const p of worksheetAnswerParts(content)) {
    if (p.type === 'text') {
      n += p.value.length
      continue
    }
    const ep = p as { type: 'embed'; embedType: string }
    if (hideQuiz && ep.embedType === 'quiz') continue
    n += 1
  }
  return n
}

/** Phần đầu: tối đa `visible` segment (đã “gõ” cho học sinh). */
export function sliceWorksheetAnswerPartsToSegments(parts: WorksheetAnswerPart[], visible: number): WorksheetAnswerPart[] {
  let rem = Math.max(0, visible)
  const out: WorksheetAnswerPart[] = []
  for (const p of parts) {
    if (rem <= 0) break
    if (p.type === 'text') {
      const len = p.value.length
      if (len === 0) continue
      if (rem >= len) {
        out.push(p)
        rem -= len
      } else {
        out.push({ type: 'text', value: p.value.slice(0, rem) })
        rem = 0
        break
      }
    } else {
      rem -= 1
      out.push(p)
    }
  }
  return out
}

/** Phần sau segment thứ `skip` (chưa gõ cho học sinh). */
export function sliceWorksheetAnswerPartsAfterSegments(parts: WorksheetAnswerPart[], skip: number): WorksheetAnswerPart[] {
  let rem = Math.max(0, skip)
  const out: WorksheetAnswerPart[] = []
  for (const p of parts) {
    if (rem <= 0) {
      out.push(p)
      continue
    }
    if (p.type === 'text') {
      const len = p.value.length
      if (rem >= len) {
        rem -= len
      } else {
        out.push({ type: 'text', value: p.value.slice(rem) })
        rem = 0
      }
    } else {
      rem -= 1
    }
  }
  return out
}

/** Block tối thiểu (trên → dưới) còn segment chưa lộ — khớp interval GV + chỉ một bút “đang gõ”. */
export type BlockLikeForSequentialReveal = { content?: string; isAnswer?: boolean }

export function findFirstSequentialSolutionBlockIndex(
  blocks: BlockLikeForSequentialReveal[],
  slideIndex: number,
  params: {
    worksheetPresentation: boolean
    hasCurriculumSegmentTyping: boolean
    reveal: Record<string, number> | undefined
    typingEnabled: Record<string, boolean> | undefined
    typingPaused?: Record<string, boolean> | undefined
    /** Giống `answerVisibility` GV: `key === false` → bỏ qua block (ẩn trên màn HS). */
    answerVisibility?: Record<string, boolean> | undefined
  }
): number | null {
  if (!blocks.length) return null
  const useSeg = params.worksheetPresentation || params.hasCurriculumSegmentTyping
  if (!useSeg) return null

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]
    const should = params.worksheetPresentation ? Boolean(b.isAnswer) : params.hasCurriculumSegmentTyping
    if (!should) continue
    const key = `${slideIndex}-${bi}`
    if (params.answerVisibility?.[key] === false) continue
    if (params.typingPaused?.[key] === true) break
    if (params.typingEnabled?.[key] === false) continue
    const total = worksheetAnswerSegmentCount(b.content ?? '')
    const cur = params.reveal?.[key] ?? 0
    if (cur < total) return bi
  }
  return null
}

/** Cùng điều kiện block tham gia gõ segment như interval GV / tìm leader. */
export type SlideSolutionSegmentOpts = {
  worksheetPresentation: boolean
  hasCurriculumSegmentTyping: boolean
}

export function typableSolutionBlockIndices(
  blocks: BlockLikeForSequentialReveal[],
  opts: SlideSolutionSegmentOpts
): number[] {
  const out: number[] = []
  for (let bi = 0; bi < blocks.length; bi++) {
    const should = opts.worksheetPresentation ? Boolean(blocks[bi].isAnswer) : opts.hasCurriculumSegmentTyping
    if (should) out.push(bi)
  }
  return out
}

/** Tổng số segment (ký tự + embed) của mọi block gõ trên một slide. */
export function slideSolutionSegmentsGlobalTotal(
  blocks: BlockLikeForSequentialReveal[],
  opts: SlideSolutionSegmentOpts
): number {
  let sum = 0
  for (const bi of typableSolutionBlockIndices(blocks, opts)) {
    sum += worksheetAnswerSegmentCount(blocks[bi].content ?? '')
  }
  return sum
}

/**
 * Tổng segment đã “lộ” trên slide (cộng theo thứ tự block), dùng làm giá trị thanh tiến độ cả slide.
 * Mỗi block chỉ đếm tối đa `total` của block đó (tránh số lệch nếu state cũ không tuần tự).
 */
export function globalRevealedSegmentsOnSlide(
  blocks: BlockLikeForSequentialReveal[],
  slideIndex: number,
  reveal: Record<string, number>,
  opts: SlideSolutionSegmentOpts
): number {
  let sum = 0
  for (const bi of typableSolutionBlockIndices(blocks, opts)) {
    const total = worksheetAnswerSegmentCount(blocks[bi].content ?? '')
    const r = reveal[`${slideIndex}-${bi}`] ?? 0
    sum += Math.min(total, Math.max(0, r))
  }
  return sum
}

/**
 * Chia `globalN` segment cho các block trên slide theo thứ tự trên → dưới (đổ đầy block trước rồi mới block sau).
 * Trả về map `slideIndex-blockIndex` → số segment đã hiện.
 */
export function distributeGlobalRevealAcrossSlide(
  globalN: number,
  blocks: BlockLikeForSequentialReveal[],
  slideIndex: number,
  opts: SlideSolutionSegmentOpts
): Record<string, number> {
  let remaining = Math.max(0, Math.round(Number.isFinite(globalN) ? globalN : 0))
  const out: Record<string, number> = {}
  for (const bi of typableSolutionBlockIndices(blocks, opts)) {
    const total = worksheetAnswerSegmentCount(blocks[bi].content ?? '')
    const give = Math.min(total, remaining)
    out[`${slideIndex}-${bi}`] = give
    remaining -= give
  }
  return out
}
