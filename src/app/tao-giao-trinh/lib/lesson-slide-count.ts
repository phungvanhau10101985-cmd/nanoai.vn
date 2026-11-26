/** Mỗi tiết chiếu đúng bấy nhiêu slide. Mọi ý của tiết nằm trong 10 slide này. */
export const LESSON_SLIDES_PER_LESSON = 10

export type LessonSlideBlock = { header: string; content: string }

export type LessonSlideDraft = {
  title: string
  blocks: LessonSlideBlock[]
  teacherNotes?: string
}

function continuationTitle(title: string): string {
  const base = title.trim() || 'Slide'
  if (/\(tiếp\)$/.test(base)) return base
  return `${base} (tiếp)`
}

function splitContent(content: string): [string, string] | null {
  const text = content.trim()
  if (text.length < 2) return null
  const mid = Math.floor(text.length / 2)
  const seps = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' ']
  for (const sep of seps) {
    let bestCut = -1
    let bestDist = Number.POSITIVE_INFINITY
    let from = 0
    while (from < text.length) {
      const found = text.indexOf(sep, from)
      if (found < 0) break
      if (found === 0) {
        from = Math.max(1, sep.length)
        continue
      }
      const cut = found + sep.length
      const left = text.slice(0, cut).trim()
      const right = text.slice(cut).trim()
      if (left && right) {
        const dist = Math.abs(found - mid)
        if (dist < bestDist) {
          bestDist = dist
          bestCut = cut
        }
      }
      from = found + Math.max(1, sep.length)
    }
    if (bestCut > 0) {
      return [text.slice(0, bestCut).trim(), text.slice(bestCut).trim()]
    }
  }
  const midCut = Math.floor(text.length / 2)
  const left = text.slice(0, midCut).trim()
  const right = text.slice(midCut).trim()
  if (!left || !right) return null
  return [left, right]
}

function withoutNotes<T extends LessonSlideDraft>(slide: T): T {
  const next = { ...slide, blocks: slide.blocks.map((block) => ({ ...block })) }
  delete next.teacherNotes
  return next
}

function splitSlide<T extends LessonSlideDraft>(slide: T): [T, T] | null {
  const blocks = slide.blocks.filter((block) => block.content.trim())
  if (blocks.length >= 2) {
    const mid = Math.ceil(blocks.length / 2)
    const leftBlocks = blocks.slice(0, mid).map((block) => ({ ...block }))
    const rightBlocks = blocks.slice(mid).map((block) => ({ ...block }))
    if (leftBlocks.length === 0 || rightBlocks.length === 0) return null
    return [
      { ...slide, blocks: leftBlocks },
      withoutNotes({ ...slide, title: continuationTitle(slide.title), blocks: rightBlocks }),
    ]
  }
  const block = blocks[0]
  if (!block) return null
  const parts = splitContent(block.content)
  if (!parts) return null
  return [
    { ...slide, blocks: [{ ...block, content: parts[0] }] },
    withoutNotes({
      ...slide,
      title: continuationTitle(slide.title),
      blocks: [{ ...block, content: parts[1] }],
    }),
  ]
}

function mergeSlidesToCount<T extends LessonSlideDraft>(slides: T[], count: number): T[] {
  const groups: T[][] = Array.from({ length: count }, () => [])
  slides.forEach((slide, index) => {
    const bucket = Math.min(count - 1, Math.floor((index * count) / slides.length))
    groups[bucket].push(slide)
  })
  return groups.map((group) => {
    const first = group[0]
    const blocks = group.flatMap((slide) =>
      slide.blocks.filter((block) => block.content.trim()).map((block) => ({ ...block }))
    )
    const notes = group
      .map((slide) => String(slide.teacherNotes || '').trim())
      .filter((note) => note.length > 0)
      .join('\n')
      .slice(0, 280)
    const next = { ...first, blocks }
    if (notes) next.teacherNotes = notes
    else delete next.teacherNotes
    return next
  })
}

function expandSlidesToCount<T extends LessonSlideDraft>(slides: T[], count: number): T[] {
  const out = slides.map((slide) => ({
    ...slide,
    blocks: slide.blocks.map((block) => ({ ...block })),
  }))
  while (out.length < count) {
    const order = out
      .map((slide, index) => ({
        index,
        len: slide.blocks.reduce((sum, block) => sum + block.content.length, 0),
      }))
      .sort((a, b) => b.len - a.len)
    let splitAt = -1
    let pair: [T, T] | null = null
    for (const item of order) {
      const next = splitSlide(out[item.index])
      if (next) {
        splitAt = item.index
        pair = next
        break
      }
    }
    if (!pair || splitAt < 0) break
    out.splice(splitAt, 1, pair[0], pair[1])
  }
  return out
}

/** Gộp hoặc tách để đủ đúng 10 slide. Không xóa chữ của các ý đã có. */
export function fitLessonSlidesToExactCount<T extends LessonSlideDraft>(slides: T[]): T[] {
  const kept = slides
    .map((slide) => ({
      ...slide,
      title: String(slide.title || '').trim() || 'Slide',
      blocks: (slide.blocks || [])
        .map((block) => ({
          header: String(block?.header || 'Nội dung').trim() || 'Nội dung',
          content: String(block?.content || '').trim(),
        }))
        .filter((block) => block.content.length > 0),
    }))
    .filter((slide) => slide.blocks.length > 0)
  if (kept.length === 0) return []
  if (kept.length === LESSON_SLIDES_PER_LESSON) return kept
  if (kept.length > LESSON_SLIDES_PER_LESSON) return mergeSlidesToCount(kept, LESSON_SLIDES_PER_LESSON)
  return expandSlidesToCount(kept, LESSON_SLIDES_PER_LESSON)
}

/** Chia toàn bộ đoạn của tiết vào đúng 10 slide. Đoạn nào cũng còn. */
export function buildLessonSlidesFromPieces(lessonTitle: string, pieces: string[]): LessonSlideDraft[] {
  const clean = pieces.map((piece) => piece.trim()).filter((piece) => piece.length > 0)
  if (clean.length === 0) return []
  const baseTitle = lessonTitle.trim() || 'Tiết học'
  const slides = clean.map((content) => ({
    title: baseTitle,
    blocks: [{ header: 'Nội dung', content }],
  }))
  return fitLessonSlidesToExactCount(slides).map((slide, index) => ({
    ...slide,
    title: `${baseTitle} - Slide ${index + 1}`,
  }))
}
